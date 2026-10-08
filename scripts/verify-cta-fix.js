#!/usr/bin/env node
/**
 * Run after deploy to verify the CTA (template button click) fix is in the built bundle.
 * Usage: node scripts/verify-cta-fix.js
 * Exit 0 = fix present, 1 = fix not found (old build).
 */
const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist', 'index.js');
const markers = [
  'Template button click received',
  'template button click',
];

if (!fs.existsSync(distPath)) {
  console.error('dist/index.js not found. Run: npm run build');
  process.exit(1);
}

const content = fs.readFileSync(distPath, 'utf8');
const missing = markers.filter((m) => !content.includes(m));

if (missing.length) {
  console.error('CTA fix not found in dist/index.js. Missing:', missing.join(', '));
  console.error('Run on server: npm run build && pm2 restart helicoptic-whatsapp');
  process.exit(1);
}

console.log('OK: CTA (template button click) fix is present in dist/index.js');
process.exit(0);
