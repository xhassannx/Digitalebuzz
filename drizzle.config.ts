import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import {
  getDatabaseUrl,
  getPgSslOption,
  stripSslParamsFromDatabaseUrl,
} from "./db/pg-connection";

const rawUrl = getDatabaseUrl();
const ssl = getPgSslOption(rawUrl);

/**
 * drizzle-kit's pg driver often ignores dbCredentials.ssl and only honors the URL.
 * We strip ssl* query params for node-pg compatibility, then put sslmode back in the
 * URL when SSL is required (Neon/RDS/etc) so `drizzle-kit push` does not connect plaintext.
 * Also drop channel_binding=require — it breaks many Node pg / drizzle-kit clients.
 *
 * uselibpqcompat=true avoids the Node pg warning that treats sslmode=require as verify-full.
 */
function drizzleKitDatabaseUrl(url: string): string {
  const withoutChannelBinding = url
    .replace(/([?&])channel_binding=[^&]*/gi, "$1")
    .replace(/\?&/, "?")
    .replace(/[?&]$/, "");

  const base = stripSslParamsFromDatabaseUrl(withoutChannelBinding);
  if (ssl === false || ssl === undefined) {
    return base;
  }

  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}sslmode=require&uselibpqcompat=true`;
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  // Exclude-only (do NOT mix with "*") — drizzle-kit rejects include+exclude together.
  // Without this, an empty/partial DB mis-detects "_helicoptic_sql_migrations → addons"
  // and crashes: TypeError reading 'columns'.
  // Note: tablesFilter does NOT ignore SERIAL sequence(s) for that table; `_id_seq`
  // and `_id_seq1` are declared via pgSequence in shared/schema.ts so push does not
  // try to DROP them (Postgres 2BP01).
  tablesFilter: ["!_helicoptic_sql_migrations"],
  dbCredentials: {
    url: drizzleKitDatabaseUrl(rawUrl),
    ...(ssl !== undefined
      ? { ssl: ssl as boolean | { rejectUnauthorized: boolean } }
      : {}),
  },
});
