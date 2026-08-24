#!/bin/bash
# ============================================================================
# Script : apply_sync_outbox_migration.sh
# But    : Appliquer la migration _sync_outbox sur Neon (PostgreSQL)
# Usage  : ./apply_sync_outbox_migration.sh "postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require"
# ============================================================================

set -e

DATABASE_URL="${1:-$DATABASE_URL}"

if [ -z "$DATABASE_URL" ]; then
  echo "❌ Erreur : DATABASE_URL non fourni"
  echo ""
  echo "Usage :"
  echo "  $0 \"postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require\""
  echo ""
  echo "Ou exportez DATABASE_URL avant de lancer le script :"
  echo "  export DATABASE_URL='postgresql://...'"
  echo "  $0"
  exit 1
fi

MIGRATION_FILE="/home/z/my-project/apps/api-server/prisma/migrations/create_sync_outbox_idempotency.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "🔄 Applying migration: $MIGRATION_FILE"
echo "🎯 Database: ${DATABASE_URL%%@*}@*** (hidden)"
echo ""

# Vérifier que psql est installé
if ! command -v psql &> /dev/null; then
  echo "❌ psql not installed. Install with:"
  echo "  sudo apt install postgresql-client"
  exit 1
fi

# Appliquer la migration
psql "$DATABASE_URL" -f "$MIGRATION_FILE"

echo ""
echo "✅ Migration applied successfully!"
echo ""
echo "Vérification :"
psql "$DATABASE_URL" -c "\dt _sync_outbox" -c "SELECT count(*) FROM _sync_outbox;" 2>&1 || true
echo ""
echo "La table _sync_outbox est prête pour l'idempotence multi-tenant."
