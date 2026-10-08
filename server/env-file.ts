/**
 * Read and update .env file (admin only). Preserves comments and order.
 * Sensitive keys are masked when returning for display.
 */
import fs from "fs";
import path from "path";

const ENV_PATH = path.join(process.cwd(), ".env");
const SENSITIVE_SUBSTRINGS = ["SECRET", "PASSWORD", "TOKEN", "KEY", "CREDENTIAL", "PRIVATE"];

function isSensitiveKey(key: string): boolean {
  const upper = key.toUpperCase();
  return SENSITIVE_SUBSTRINGS.some((s) => upper.includes(s));
}

/** Parse a single line: return { type: 'entry'|'comment'|'empty', key?, value?, raw } */
function parseLine(line: string): { type: "entry"; key: string; value: string } | { type: "comment" | "empty"; raw: string } {
  const trimmed = line.trimEnd();
  if (trimmed === "") return { type: "empty", raw: line };
  if (trimmed.startsWith("#")) return { type: "comment", raw: line };
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match) return { type: "comment", raw: line };
  let value = match[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"');
  }
  return { type: "entry", key: match[1], value };
}

/** Serialize value for .env (quote if contains space, #, or newline) */
function serializeValue(value: string): string {
  if (value.includes("\n") || value.includes(" ") || value.includes("#") || value.includes("=")) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
  }
  return value;
}

export type EnvEntry = { key: string; value: string; masked?: boolean };

/** Get raw value for a single key (for admin "view" of masked secrets). Returns null if not found. */
export function getEnvValue(key: string): string | null {
  try {
    if (!fs.existsSync(ENV_PATH)) return null;
    const content = fs.readFileSync(ENV_PATH, "utf8");
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const parsed = parseLine(line);
      if (parsed.type === "entry" && parsed.key === key) return parsed.value;
    }
    return null;
  } catch {
    return null;
  }
}

export function readEnvFile(): { entries: EnvEntry[]; error?: string } {
  try {
    if (!fs.existsSync(ENV_PATH)) {
      return { entries: [] };
    }
    const content = fs.readFileSync(ENV_PATH, "utf8");
    const lines = content.split(/\r?\n/);
    const entries: EnvEntry[] = [];
    for (const line of lines) {
      const parsed = parseLine(line);
      if (parsed.type === "entry") {
        entries.push({
          key: parsed.key,
          value: isSensitiveKey(parsed.key) ? "********" : parsed.value,
          masked: isSensitiveKey(parsed.key),
        });
      }
    }
    return { entries };
  } catch (err: any) {
    return { entries: [], error: err?.message || "Failed to read .env" };
  }
}

/** Read raw .env and return full parsed structure for applying updates */
function readEnvRaw(): { lines: Array<{ type: "entry"; key: string; value: string } | { type: "comment" | "empty"; raw: string }> } {
  const content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const lines = content.split(/\r?\n/);
  return {
    lines: lines.map((line) => {
      const p = parseLine(line);
      if (p.type === "entry") return { type: "entry" as const, key: p.key, value: p.value };
      return { type: p.type, raw: p.raw };
    }),
  };
}

/** Apply updates (by key) and write back .env. Skips updating if value is "********" (masked placeholder). */
export function updateEnvFile(updates: Array<{ key: string; value: string }>): { success: boolean; error?: string } {
  if (!updates.length) return { success: true };
  const updateMap = new Map(updates.map((u) => [u.key, u.value]));
  try {
    const { lines } = readEnvRaw();
    const newLines: string[] = [];
    const keysWritten = new Set<string>();
    for (const item of lines) {
      if (item.type === "entry") {
        const newVal = updateMap.get(item.key);
        if (newVal !== undefined && newVal !== "********") {
          newLines.push(`${item.key}=${serializeValue(newVal)}`);
          keysWritten.add(item.key);
        } else {
          newLines.push(`${item.key}=${serializeValue(item.value)}`);
        }
      } else {
        newLines.push(item.raw);
      }
    }
    for (const { key, value } of updates) {
      if (value !== "********" && !keysWritten.has(key)) {
        newLines.push(`${key}=${serializeValue(value)}`);
      }
    }
    const tempPath = ENV_PATH + ".tmp." + Date.now();
    fs.writeFileSync(tempPath, newLines.join("\n") + "\n", "utf8");
    fs.renameSync(tempPath, ENV_PATH);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to write .env" };
  }
}
