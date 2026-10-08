import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'organization_invoice_settings'
    ORDER BY ordinal_position
  `;
  const indexes = await sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'organization_invoice_settings'
  `;
  console.log("organization_invoice_settings columns:");
  console.log(JSON.stringify(rows, null, 2));
  console.log("indexes:");
  console.log(JSON.stringify(indexes, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
