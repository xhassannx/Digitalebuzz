/**
 * Phase-by-phase RDS probe: TCP → SSLRequest → TLS → pg auth.
 * nc can succeed while Node hangs (wrong source IP, TLS hang, etc.).
 *
 * Usage: npx tsx --env-file=.env scripts/db-probe.ts
 */
import dns from "dns";
import net from "net";
import tls from "tls";
import { spawnSync } from "child_process";
import { getDatabaseUrl, parseDatabaseUrl, stripSslParamsFromDatabaseUrl } from "../db/pg-connection";

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const SSL_REQUEST = Buffer.from([0x00, 0x00, 0x00, 0x08, 0x04, 0xd2, 0x16, 0x2f]);

function ms(started: number) {
  return `${Date.now() - started}ms`;
}

async function phaseTcp(host: string, port: number): Promise<{ socket: net.Socket; localAddress: string }> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port, family: 4 }, () => {
      const localAddress = socket.localAddress || "(unknown)";
      console.log(`[probe] 1) TCP connect OK in ${ms(started)} — localAddress=${localAddress} remote=${host}:${port}`);
      resolve({ socket, localAddress });
    });
    socket.setTimeout(10_000, () => {
      socket.destroy();
      reject(new Error(`TCP connect timeout after ${ms(started)}`));
    });
    socket.on("error", reject);
  });
}

async function phaseSslRequest(socket: net.Socket): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const onData = (buf: Buffer) => {
      socket.off("data", onData);
      const code = buf.toString("utf8", 0, 1);
      console.log(`[probe] 2) SSLRequest response='${code}' in ${ms(started)} (want 'S')`);
      if (code === "S") resolve();
      else reject(new Error(`Server refused SSL (got '${code}')`));
    };
    socket.on("data", onData);
    socket.write(SSL_REQUEST);
    socket.setTimeout(10_000, () => {
      socket.off("data", onData);
      reject(new Error(`SSLRequest timeout after ${ms(started)} — TCP open but Postgres SSL handshake stuck`));
    });
  });
}

async function phaseTls(socket: net.Socket, servername: string): Promise<tls.TLSSocket> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const secure = tls.connect(
      {
        socket,
        servername,
        rejectUnauthorized: false,
        minVersion: "TLSv1.2",
      },
      () => {
        console.log(
          `[probe] 3) TLS OK in ${ms(started)} — ${secure.getProtocol()} ${secure.getCipher()?.name || ""}`
        );
        resolve(secure);
      }
    );
    secure.setTimeout(15_000, () => {
      secure.destroy();
      reject(new Error(`TLS handshake timeout after ${ms(started)}`));
    });
    secure.on("error", reject);
  });
}

async function main() {
  const url = getDatabaseUrl().trim().replace(/^["']|["']$/g, "");
  const parsed = parseDatabaseUrl(url);
  const ip = (await dns.promises.lookup(parsed.host, { family: 4 })).address;

  console.log(`[probe] target ${parsed.user}@${parsed.host}:${parsed.port}/${parsed.database}`);
  console.log(`[probe] resolved IPv4 ${ip}`);
  console.log(`[probe] cleaned URL host still hostname (SNI)=${parsed.host}`);

  // Compare with psql if installed
  const psql = spawnSync(
    "psql",
    [
      stripSslParamsFromDatabaseUrl(url),
      "-c",
      "select 1",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      env: { ...process.env, PGSSLMODE: "require" },
      encoding: "utf8",
      timeout: 20_000,
    }
  );
  if (psql.error) {
    console.log(`[probe] psql not runnable: ${psql.error.message}`);
  } else if (psql.status === 0) {
    console.log(`[probe] psql: OK`);
  } else {
    console.log(`[probe] psql: FAIL (exit ${psql.status})`);
    if (psql.stderr) console.log(psql.stderr.slice(0, 500));
  }

  let socket: net.Socket | undefined;
  try {
    const tcp = await phaseTcp(ip, parsed.port);
    socket = tcp.socket;

    if (tcp.localAddress && tcp.localAddress !== "191.96.31.5" && !tcp.localAddress.startsWith("127.")) {
      console.log(`
[probe] WARNING: Node sourced this connection from ${tcp.localAddress}, not 191.96.31.5.
RDS SG only allows the public IP. If ${tcp.localAddress} is not in the SG (or not NATed to 191.96.31.5), connects will hang.
Fix: add ${tcp.localAddress}/32 to RDS SG, or set PG_LOCAL_ADDRESS / fix routing.
`);
    }

    await phaseSslRequest(socket);
    const secure = await phaseTls(socket, parsed.host);
    secure.end();
    console.log(`[probe] TCP+SSL path works. If pg still fails, issue is after TLS (auth/startup).`);
  } catch (err) {
    console.error(`[probe] FAILED:`, err instanceof Error ? err.message : err);
    console.error(`
Next checks:
  - ip -4 addr
  - ss -tn | head
  - Re-run: PGPASSWORD='...' psql "host=... dbname=... user=... sslmode=require" -c 'select 1'
  - Confirm RDS SG port is 5432 (not only "inbound" without port)
`);
    process.exit(1);
  } finally {
    socket?.destroy();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
