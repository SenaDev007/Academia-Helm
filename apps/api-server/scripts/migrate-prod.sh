#!/usr/bin/env bash
set -euo pipefail
echo "🚀 Exécution des migrations Academia Helm"
cd "$(dirname "$0")/.."
npx prisma migrate deploy
echo "✅ Migrations terminées"
npx prisma db seed 2>/dev/null || echo "⚠️ Seed ignoré"
