import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import { getDatabaseUrl, getPgPoolConfig, isNeonUrl } from "./migration-sql-client-url";

/**
 * Split SQL on `;` while ignoring semicolons inside:
 * - single-quoted string literals ('...')
 * - dollar-quoted strings ($$...$$ / $tag$...$tag$)
 * Line comments (--) are stripped when not inside a string.
 */
export function splitSqlStatements(sql: string): string[] {
  const cleaned = sql
    .split("\n")
    .map((line) => {
      let result = "";
      let inSingle = false;
      let dollarTag: string | null = null;
      for (let i = 0; i < line.length; i++) {
        const c = line[i]!;

        if (dollarTag !== null) {
          if (c === "$" && line.startsWith(dollarTag, i)) {
            result += dollarTag;
            i += dollarTag.length - 1;
            dollarTag = null;
          } else {
            result += c;
          }
          continue;
        }

        if (inSingle) {
          if (c === "'") {
            if (line[i + 1] === "'") {
              result += "''";
              i++;
            } else {
              inSingle = false;
              result += c;
            }
          } else {
            result += c;
          }
          continue;
        }

        if (c === "'") {
          inSingle = true;
          result += c;
          continue;
        }

        if (c === "$") {
          const rest = line.slice(i);
          const m = rest.match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/);
          if (m) {
            dollarTag = m[0];
            result += dollarTag;
            i += dollarTag.length - 1;
            continue;
          }
        }

        if (c === "-" && line[i + 1] === "-") break;
        result += c;
      }
      return result;
    })
    .join("\n");

  const statements: string[] = [];
  let current = "";
  let inSingle = false;
  let dollarTag: string | null = null;

  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i]!;

    if (dollarTag !== null) {
      if (c === "$" && cleaned.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length - 1;
        dollarTag = null;
      } else {
        current += c;
      }
      continue;
    }

    if (inSingle) {
      if (c === "'") {
        if (cleaned[i + 1] === "'") {
          current += "''";
          i++;
        } else {
          inSingle = false;
          current += c;
        }
      } else {
        current += c;
      }
      continue;
    }

    if (c === "'") {
      inSingle = true;
      current += c;
      continue;
    }

    if (c === "$") {
      const rest = cleaned.slice(i);
      const m = rest.match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/);
      if (m) {
        dollarTag = m[0];
        current += dollarTag;
        i += dollarTag.length - 1;
        continue;
      }
    }

    if (c === ";") {
      const trimmed = current.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      current = "";
      continue;
    }

    current += c;
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) statements.push(trimmed);
  return statements;
}

export { getDatabaseUrl } from "./migration-sql-client-url";
export async function runMigrationStatements(statements: string[]): Promise<void> {
  const databaseUrl = getDatabaseUrl();

  if (isNeonUrl(databaseUrl)) {
    const sql = neon(databaseUrl);
    for (let i = 0; i < statements.length; i++) {
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      await sql(statements[i]);
    }
    return;
  }

  const pool = new Pool(getPgPoolConfig(databaseUrl));

  try {
    for (let i = 0; i < statements.length; i++) {
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      await pool.query(statements[i]);
    }
  } finally {
    await pool.end();
  }
}
