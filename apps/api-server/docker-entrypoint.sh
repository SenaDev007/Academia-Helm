#!/bin/sh
set -e

# ============================================================================
# NE PAS exécuter `npx prisma migrate deploy` au démarrage !
# ============================================================================
# Problème : prisma migrate deploy peut déclencher un reset de la BDD si
# il détecte un "drift" entre le schema et la BDD (par exemple, si une
# contrainte a été modifiée manuellement). Ce reset VIDE TOUTES LES TABLES
# y compris subjects, teachers, etc.
#
# Les migrations sont appliquées manuellement sur Neon via scripts SQL.
# Si une nouvelle migration doit être appliquée, utiliser :
#   fly ssh console -C "npx prisma migrate deploy --schema=prisma/schema.prisma"
# ============================================================================

echo "▶️  Skipping Prisma migrations (applied manually on Neon)"
echo "▶️  Starting application..."
exec "$@"
