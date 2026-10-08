/**
 * One-time migration: copy local uploads/ folder to S3.
 *
 * Usage:
 *   MEDIA_STORAGE=dual AWS_S3_BUCKET=your-bucket AWS_REGION=ap-south-1 npx tsx scripts/sync-uploads-to-s3.ts
 *
 * Uses EC2 IAM role or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY from env.
 */
import fs from "fs";
import path from "path";
import "dotenv/config";
import { buildPublicUploadPath, saveUploadBuffer } from "../server/utils/media-storage";

const uploadsRoot = path.join(process.cwd(), "uploads");

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) {
      out.push(...(await walk(abs)));
    } else {
      out.push(abs);
    }
  }
  return out;
}

async function main(): Promise<void> {
  if (!process.env.AWS_S3_BUCKET?.trim()) {
    console.error("Set AWS_S3_BUCKET before running this script.");
    process.exit(1);
  }

  const files = await walk(uploadsRoot);
  console.log(`Found ${files.length} files under uploads/`);

  let ok = 0;
  let fail = 0;
  for (const abs of files) {
    const rel = path.relative(uploadsRoot, abs).replace(/\\/g, "/");
    const publicPath = buildPublicUploadPath(...rel.split("/"));
    try {
      const buffer = fs.readFileSync(abs);
      await saveUploadBuffer(publicPath, buffer);
      ok++;
      if (ok % 50 === 0) console.log(`Uploaded ${ok}/${files.length}...`);
    } catch (e: any) {
      fail++;
      console.warn(`Failed ${rel}:`, e?.message || e);
    }
  }

  console.log(`Done. uploaded=${ok} failed=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
