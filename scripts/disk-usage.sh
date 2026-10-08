#!/usr/bin/env bash
# Run from project root to see what's using disk space.
# Usage: bash scripts/disk-usage.sh   OR   ./scripts/disk-usage.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Project disk usage (top directories, from $ROOT) ==="
du -sh . 2>/dev/null || true
echo ""
echo "=== Largest directories (run from project root) ==="
du -h --max-depth=1 . 2>/dev/null | sort -hr | head -25

echo ""
echo "=== node_modules size ==="
du -sh node_modules 2>/dev/null || echo "node_modules not found"

echo ""
echo "=== uploads (user media – can be very large) ==="
du -sh uploads 2>/dev/null || echo "uploads not found"

echo ""
echo "=== dist (build output) ==="
du -sh dist 2>/dev/null || echo "dist not found"

echo ""
echo "=== WhatsApp caches ==="
du -sh .wwebjs_cache .wwebjs_auth 2>/dev/null || true

echo ""
echo "=== Dump/SQL files (Neon backups) ==="
find . -maxdepth 2 -type f \( -name "*.dump" -o -name "*.sql" \) 2>/dev/null | while read f; do du -h "$f"; done

echo ""
echo "=== php_reference / other reference folders ==="
du -sh php_reference 2>/dev/null || echo "php_reference not found"
