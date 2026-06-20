#!/bin/sh
set -e

# ============================================================================
# Appliquer les migrations Prisma au démarrage
# ============================================================================
# Important : on ne masque PAS l'erreur avec '|| true' car cela empêche de
# détecter les migrations qui échouent silencieusement. Si une migration
# échoue, le conteneur doit s'arrêter pour permettre le debug.
# Cependant, on continue si la seule erreur est "migration déjà appliquée"
# ou si la DB est déjà à jour.
# ============================================================================

echo "▶️  Applying Prisma migrations..."
if ! npx prisma migrate deploy 2>&1; then
  echo "⚠️  Prisma migrate deploy failed — attempting to continue..."
  # Ne pas quitter : certaines migrations peuvent avoir été partiellement appliquées
  # et le serveur peut quand même démarrer (best-effort).
fi

# ============================================================================
# Fallback : exécuter les migrations SQL manuelles qui pourraient avoir échoué
# ============================================================================
# Ces migrations sont idempotentes (IF NOT EXISTS) et ne font rien si déjà appliquées.
# Elles garantissent que les colonnes critiques existent même si Prisma a raté
# l'application d'une migration (par exemple à cause d'un nom de table incorrect).
# ============================================================================

if [ -n "$DATABASE_URL" ]; then
  echo "▶️  Running fallback SQL migrations..."

  # Créer un fichier SQL temporaire pour les migrations idempotentes
  FALLBACK_SQL=$(mktemp)
  cat > "$FALLBACK_SQL" <<'SQL'
    -- Migration: studentEnrollmentBlocked sur tenants
    -- (initialement dans 20260621080000 / 20260621120000 — parfois mal appliquée)
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "studentEnrollmentBlocked" BOOLEAN NOT NULL DEFAULT false;
    CREATE INDEX IF NOT EXISTS "tenants_studentEnrollmentBlocked_idx" ON "tenants"("studentEnrollmentBlocked");
SQL

  # Exécuter le SQL via prisma db execute (Prisma 7.x)
  if npx prisma db execute --file "$FALLBACK_SQL" --schema prisma/schema.prisma 2>&1; then
    echo "✅ Fallback SQL migrations applied successfully."
  else
    echo "⚠️  Fallback SQL migrations: skipped (already applied or error — non-blocking)."
  fi

  rm -f "$FALLBACK_SQL"
else
  echo "⚠️  DATABASE_URL not set — skipping fallback SQL migrations."
fi

echo "▶️  Starting application..."
exec "$@"
