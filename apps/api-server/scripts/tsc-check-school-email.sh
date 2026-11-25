#!/usr/bin/env bash
# ============================================================================
# 📧 HARNais TSC school-email SANS `prisma generate` (contrainte sandbox OOM)
# ============================================================================
# Usage : bash scripts/tsc-check-school-email.sh   (depuis apps/api-server)
#
# `prisma generate` est OOM-killé (exit 137) dans le sandbox de dev sur le
# schéma 536 modèles. Ce script remplace TEMPORAIREMENT les types
# @prisma/client par un stub à signature d'index (tout modèle = any), lance
# tsc --noEmit sur src/school-email SEUL, puis RESTAURE les fichiers originaux
# quoi qu'il arrive (trap).
#
# Résultat attendu : 0 erreur dans src/school-email. Les erreurs éventuelles
# dans d'autres dossiers (importés transitivement) sont le bruit de base du
# stub — les ignorer. Le build Railway (nest build, client complet) reste la
# porte finale.
set -euo pipefail
cd "$(dirname "$0")/.."

PKG="node_modules/@prisma/client"
STUB_HEADER="/* STUB TEMPORAIRE — voir scripts/tsc-check-school-email.sh */"

if [ ! -f "$PKG/default.d.ts" ] || [ ! -f "$PKG/index.d.ts" ]; then
  echo "❌ node_modules/@prisma/client absent — lancez d'abord npm install."
  exit 1
fi

restore() {
  printf 'export * from %s.prisma/client/default%s\n' "'" "'" > "$PKG/default.d.ts"
  printf 'export * from %s.prisma/client/default%s\n' "'" "'" > "$PKG/index.d.ts"
  echo "↩️  Types @prisma/client restaurés."
}
trap restore EXIT

# Mise en place du stub (signature d'index : prisma.<modele> = any).
cat > "$PKG/default.d.ts" <<'EOF'
/* STUB TEMPORAIRE — voir scripts/tsc-check-school-email.sh */
export declare class PrismaClient {
  constructor(options?: any);
  $queryRaw: any;
  $executeRaw: any;
  $transaction: any;
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
  [key: string]: any;
}
export const Prisma: any;
EOF
printf 'export * from %s./default%s;\n' "'" "'" > "$PKG/index.d.ts"

# tsconfig dédié (créé/supprimé à la volée).
cat > tsconfig.check-schoolemail.json <<'EOF'
{
  "extends": "./tsconfig.json",
  "include": ["src/school-email/**/*"],
  "compilerOptions": { "noEmit": true, "incremental": false }
}
EOF

echo "🔍 tsc --noEmit sur src/school-email (stub prisma actif)…"
set +e
OUT="$(./node_modules/.bin/tsc -p tsconfig.check-schoolemail.json 2>&1)"
CODE=$?
set -e
rm -f tsconfig.check-schoolemail.json

SCHOOL_ERRS="$(echo "$OUT" | grep -c 'school-email' || true)"
echo "$OUT" | grep 'school-email' || true
echo "────────────────────────────────────────────"
if [ "$CODE" -eq 0 ]; then
  echo "✅ src/school-email : 0 erreur tsc."
elif [ "$SCHOOL_ERRS" -eq 0 ]; then
  echo "✅ src/school-email : 0 erreur tsc (bruit stub ailleurs ignoré)."
else
  echo "❌ $SCHOOL_ERRS erreur(s) dans src/school-email — voir ci-dessus."
  exit 1
fi
