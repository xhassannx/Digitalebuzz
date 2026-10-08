#!/usr/bin/env node
/**
 * Convert a Markdown (.md) file to a Word document (.docx).
 * Usage: node scripts/md-to-docx.js <path-to-file.md> [output.docx]
 * Example: node scripts/md-to-docx.js docs/API_CLIENT_GUIDE.md
 *          node scripts/md-to-docx.js docs/API_CLIENT_GUIDE.md docs/API_CLIENT_GUIDE.docx
 */

import { readFile, writeFile } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { convertMarkdownToDocx } from "@mohtasham/md-to-docx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const input = process.argv[2];
if (!input || !input.endsWith(".md")) {
  console.error("Usage: node scripts/md-to-docx.js <file.md> [output.docx]");
  process.exit(1);
}

const inputPath = resolve(root, input);
const outputPath = process.argv[3]
  ? resolve(root, process.argv[3])
  : inputPath.replace(/\.md$/i, ".docx");

async function main() {
  const markdown = await readFile(inputPath, "utf-8");
  const blob = await convertMarkdownToDocx(markdown);
  const buffer = Buffer.from(await blob.arrayBuffer());
  await writeFile(outputPath, buffer);
  console.log("Created:", outputPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
