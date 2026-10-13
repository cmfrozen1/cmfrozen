#!/bin/bash
# Fukupetstore - Cloudflare D1 + R2 + Workers Deploy Script
# Requires: npx wrangler (v3+), authenticated via `npx wrangler login`
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "=== Fukupetstore Cloudflare Deploy ==="
echo "Step 1: Check wrangler login"
npx wrangler whoami || { echo "❌ กรุณา login ก่อน: npx wrangler login"; exit 1; }

echo ""
echo "Step 2: Create D1 Database (if not exists)"
# Try create, capture ID
set +e
D1_CREATE_OUT=$(npx wrangler d1 create fukupetstore-db 2>&1)
D1_STATUS=$?
set -e
echo "$D1_CREATE_OUT"

# Extract database_id from output (format: database_id = "xxxx")
DB_ID=$(echo "$D1_CREATE_OUT" | grep -oE 'database_id[[:space:]]*=[[:space:]]*"[^"]+"' | grep -oE '"[^"]+"' | tr -d '"' | head -n1)
if [ -z "$DB_ID" ]; then
  # Maybe already exists - try list
  echo "→ Database maybe exists, listing..."
  npx wrangler d1 list
  DB_ID=$(npx wrangler d1 list 2>&1 | grep -A2 fukupetstore-db | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -n1)
fi

if [ -n "$DB_ID" ] && [ "$DB_ID" != "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" ]; then
  echo "✅ D1 Database ID: $DB_ID"
  # Patch wrangler.toml if still placeholder
  if grep -q "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" wrangler.toml; then
    echo "→ Patching wrangler.toml with database_id..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s/XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX/$DB_ID/g" wrangler.toml
    else
      sed -i "s/XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX/$DB_ID/g" wrangler.toml
    fi
    echo "✅ wrangler.toml updated"
  else
    echo "ℹ️ wrangler.toml already has a database_id, skipping patch"
    echo "   Please verify it matches: $DB_ID"
  fi
else
  echo "⚠️ Could not auto-detect D1 ID, please update wrangler.toml manually"
  echo "   Run: npx wrangler d1 list  -> copy database_id"
fi

echo ""
echo "Step 3: Create R2 Bucket (if not exists)"
set +e
npx wrangler r2 bucket create fukupetstore-images 2>&1 | tee /tmp/r2_out.txt
if grep -q "already exists" /tmp/r2_out.txt; then
  echo "ℹ️ Bucket already exists, ok"
fi
set -e

echo ""
echo "Step 4: Apply D1 Schema"
npx wrangler d1 execute fukupetstore-db --file=./schema-d1.sql --remote
echo "✅ Schema applied"

echo ""
echo "Step 5: Seed initial data (INSERT OR IGNORE - safe to re-run)"
npx wrangler d1 execute fukupetstore-db --file=./seed-d1.sql --remote
echo "✅ Seed done"

echo ""
echo "Step 6: Deploy Worker + Assets (exclude api.php to let Worker handle API)"
# api.php ต้องไม่ถูก upload เป็น static asset มิเช่นนั้นจะบัง Worker route /api.php
if [ -f "api.php" ]; then
  mv api.php /tmp/api.php.bak
  API_MOVED=1
else
  API_MOVED=0
fi
npx wrangler deploy
DEPLOY_STATUS=$?
if [ "$API_MOVED" = "1" ]; then
  mv /tmp/api.php.bak api.php
fi
if [ $DEPLOY_STATUS -ne 0 ]; then exit $DEPLOY_STATUS; fi
echo ""
echo "🎉 Deploy complete! Worker URL will be shown above."
echo "   Test: curl https://<your-worker>.workers.dev/api.php?action=db_status"
echo "   Test: curl https://<your-worker>.workers.dev/api.php?action=get_content"
echo ""
echo "Next: ตั้งค่า Custom Domain ใน Cloudflare Dashboard > Workers > fukupetstore > Settings > Domains & Routes"
