#!/bin/bash
#
# ============================================================================
# Script de déploiement — Academia Helm STE V2+
# ============================================================================
#
# Ce script applique le patch préparé (build fixes + STE V2+) sur votre clone
# local du repo Academia-Helm, puis pousse sur GitHub pour déclencher les
# builds Vercel + Fly.io.
#
# PRÉREQUIS :
#   - Git installé
#   - Accès au repo GitHub SenaDev007/Academia-Helm (SSH ou HTTPS avec token)
#   - Le fichier patch à /home/z/my-project/download/academia-helm-build-fix-and-v2plus.patch
#     (ou passé en argument $1)
#
# UTILISATION :
#   chmod +x deploy-ste-v2plus.sh
#   ./deploy-ste-v2plus.sh
#
# OU si le patch est ailleurs :
#   ./deploy-ste-v2plus.sh /chemin/vers/patch.patch
#
# ============================================================================

set -e

PATCH_FILE="${1:-/home/z/my-project/download/academia-helm-build-fix-and-v2plus.patch}"
REPO_URL="https://github.com/SenaDev007/Academia-Helm.git"
WORK_DIR="${HOME}/academia-helm-deploy-$(date +%s)"

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║  Déploiement Academia Helm — STE V2+ (build fixes + contraintes)   ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# ─── Vérifier le patch ─────────────────────────────────────────────────────
if [ ! -f "$PATCH_FILE" ]; then
  echo "❌ Patch introuvable : $PATCH_FILE"
  echo ""
  echo "💡 Vous pouvez télécharger le patch depuis le sandbox, OU le régénérer"
  echo "   en clonant origin/main et en appliquant les modifications manuelles."
  exit 1
fi

echo "✅ Patch trouvé : $PATCH_FILE ($(wc -c < "$PATCH_FILE") bytes)"
echo ""

# ─── Cloner origin/main ────────────────────────────────────────────────────
echo "📦 Clonage du repo depuis GitHub..."
git clone "$REPO_URL" "$WORK_DIR"
cd "$WORK_DIR"
echo "✅ Clone prêt dans $WORK_DIR"
echo "   Branche : $(git branch --show-current)"
echo "   Dernier commit : $(git log --oneline -1)"
echo ""

# ─── Vérifier qu'on est bien sur origin/main (avant le fix) ────────────────
CURRENT_HASH=$(git rev-parse HEAD)
EXPECTED_HASH="bf2e2eb0ff444bf95baaf3b51134a6960889d62b"

if [ "$CURRENT_HASH" != "$EXPECTED_HASH" ]; then
  echo "⚠️  ATTENTION : Le commit actuel ne correspond pas à bf2e2eb0."
  echo "   Actuel : $CURRENT_HASH"
  echo "   Attendu : $EXPECTED_HASH"
  echo ""
  echo "   Cela peut signifier que quelqu'un a déjà pushé des modifications."
  echo "   Le patch peut encore s'appliquer — on continue..."
  echo ""
fi

# ─── Appliquer le patch ────────────────────────────────────────────────────
echo "🔧 Application du patch..."
git am "$PATCH_FILE"

if [ $? -ne 0 ]; then
  echo "❌ Échec de l'application du patch (conflit éventuel)"
  echo ""
  echo "💡 Solutions :"
  echo "   1. Résoudre les conflits manuellement : git mergetool"
  echo "   2. Annuler et réessayer : git am --abort"
  echo "   3. Appliquer sans commit : git apply $PATCH_FILE"
  exit 1
fi

echo "✅ Patch appliqué avec succès"
echo "   Nouveau HEAD : $(git log --oneline -1)"
echo ""

# ─── Vérifications de cohérence ────────────────────────────────────────────
echo "🔍 Vérifications..."

# 1. Pas de modèles dupliqués dans le schema Prisma
DUPLICATES=$(grep -E "^model " apps/api-server/prisma/schema.prisma | sort | uniq -d | wc -l)
if [ "$DUPLICATES" -eq 0 ]; then
  echo "   ✅ Aucun modèle Prisma dupliqué"
else
  echo "   ❌ $DUPLICATES modèle(s) dupliqué(s) — le build Fly.io échouera"
  exit 1
fi

# 2. Le modèle TeacherAvailability n'existe qu'une fois
TA_COUNT=$(grep -c "^model TeacherAvailability " apps/api-server/prisma/schema.prisma)
TTA_COUNT=$(grep -c "^model TimetableTeacherAvailability " apps/api-server/prisma/schema.prisma)
if [ "$TA_COUNT" -eq 1 ] && [ "$TTA_COUNT" -eq 1 ]; then
  echo "   ✅ TeacherAvailability (1) + TimetableTeacherAvailability (1) — OK"
else
  echo "   ❌ Comptes incorrects : TA=$TA_COUNT, TTA=$TTA_COUNT"
  exit 1
fi

# 3. SubjectsWorkspace.tsx n'a plus l'erreur de syntaxe
if grep -q "BilingualTrack" apps/web-app/src/components/pedagogy/subjects/SubjectsWorkspace.tsx; then
  echo "   ❌ BilingualTrack encore présent dans SubjectsWorkspace"
  exit 1
else
  echo "   ✅ Import BilingualTrack supprimé"
fi

echo ""

# ─── Push vers GitHub ──────────────────────────────────────────────────────
echo "🚀 Push vers GitHub..."
echo ""
echo "   Si on vous demande des credentials :"
echo "   - HTTPS : utilisez un Personal Access Token (PAT) comme mot de passe"
echo "     (GitHub ne supporte plus l'auth par mot de passe)"
echo "     Créer un PAT : https://github.com/settings/tokens (scope: repo)"
echo "   - SSH : configurez ~/.ssh/id_ed25519 et utilisez git@github.com:..."
echo ""

git push origin main

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Échec du push"
  echo ""
  echo "💡 Solutions :"
  echo "   1. Vérifiez vos credentials GitHub"
  echo "   2. Si le repo a divergé, essayez : git push --force-with-lease origin main"
  echo "   3. Si vous n'avez pas la permission, demandez à SenaDev007 de vous ajouter"
  echo "      comme collaborateur sur le repo"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║  ✅ PUSH RÉUSSI — déploiement déclenché !                            ║"
echo "╠══════════════════════════════════════════════════════════════════════╣"
echo "║                                                                       ║"
echo "║  Vercel (web-app) :                                                   ║"
echo "║    https://vercel.com/dashboard → votre projet → Deployments          ║"
echo "║    Build attendu : ~2-3 min, statut Ready                             ║"
echo "║                                                                       ║"
echo "║  Fly.io (api-server) :                                                ║"
echo "║    https://fly.io/dashboard → academia-helm-api                       ║"
echo "║    Ou relancez : flyctl deploy --build-only --push -a academia-helm-api║"
echo "║                                                                       ║"
echo "║  Après déploiement, testez STE V2+ :                                  ║"
echo "║    /app/pedagogy/timetables → 6 onglets (Config, Dispo, Contraintes,  ║"
echo "║    Génération, Solutions, Édition manuelle)                           ║"
echo "║                                                                       ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📝 Le clone temporaire est conservé dans : $WORK_DIR"
echo "   Vous pouvez le supprimer avec : rm -rf $WORK_DIR"
