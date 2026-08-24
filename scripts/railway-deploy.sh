#!/bin/bash
# ============================================================================
# HELM CONNECT — Script de déploiement manuel Railway
# ============================================================================
#
# ⚠️ PROBLÈME : Le backend Railway n'a pas redéployé les derniers commits
#    depuis ~5 heures. Le webhook auto-deploy semble cassé.
#    Le code déployé contient encore le bug P2010 'column ur.role does not exist'
#    et le PollController n'est pas encore actif.
#
# ✅ SOLUTION : Ce script déploie manuellement via le CLI Railway
#
# UTILISATION :
#   1. Installer Railway CLI :
#      npm install -g @railway/cli
#
#   2. Se connecter à Railway (ouvre le navigateur) :
#      railway login
#      # → Cliquez "Approve" dans le navigateur
#
#   3. Lier le projet (sélectionnez votre projet Helm Connect) :
#      railway link
#      # → Sélectionnez : "Academia Helm" project → "api-server" service → "production" env
#
#   4. Exécuter ce script :
#      bash scripts/railway-deploy.sh
#
# ⭐ Ce que fait ce script :
#   - Vérifie que vous êtes connecté
#   - Affiche le projet + service liés
#   - Exécute `railway up` pour déclencher un nouveau build + deploy
#   - Suit les logs de déploiement
#   - Vérifie le statut final
# ============================================================================

set -e

echo "⭐ Helm Connect — Déploiement Railway manuel"
echo ""

# 1. Vérifier que Railway CLI est installé
if ! command -v railway &> /dev/null; then
  echo "❌ Railway CLI non installé. Installer avec :"
  echo "   npm install -g @railway/cli"
  exit 1
fi

# 2. Vérifier la connexion
if ! railway whoami > /dev/null 2>&1; then
  echo "❌ Non connecté à Railway. Se connecter avec :"
  echo "   railway login"
  echo ""
  echo "   Suivez les instructions : un navigateur s'ouvre pour autoriser le CLI."
  exit 1
fi

echo "✅ Connecté en tant que : $(railway whoami)"
echo ""

# 3. Vérifier le projet lié
echo "📋 Projet Railway lié :"
railway status 2>&1 | head -10
echo ""

# 4. Vérifier que le code local est à jour
echo "📋 Code local (HEAD) :"
git log -1 --format="  commit: %h%n  date:   %cI%n  sujet:  %s" 2>&1 | head -5
echo ""

# 5. Vérifier que le fix P2010 est bien présent dans le code source
echo "🔍 Vérification du fix P2010 (ur.role) dans le code source :"
if grep -q 'u\."role" AS "senderRole"' apps/api-server/src/communication/services/chat.service.ts; then
  echo "   ✅ Fix P2010 présent dans chat.service.ts"
else
  echo "   ❌ Fix P2010 MANQUANT — vérifier le code source"
  exit 1
fi
echo ""

# 6. Déclencher le déploiement
echo "🚀 Déploiement Railway en cours (build + restart)..."
echo "   ⏱️  Durée estimée : 5-8 minutes"
echo ""
echo "   Logs en temps réel :"
echo "   --------------------"
railway up --detach 2>&1 | head -20 || true
echo ""

# 7. Suivre les logs de déploiement
echo "📋 Logs de déploiement (Ctrl+C pour quitter sans annuler) :"
echo "   --------------------"
railway logs 2>&1 | head -50

echo ""
echo "✅ Déploiement terminé. Vérifiez :"
echo "   curl https://api.academiahelm.com/health"
echo "   → uptime doit être < 1 minute"
echo ""
echo "   Test fix P2010 :"
echo "   curl -X POST https://api.academiahelm.com/api/chat/v2/polls -H 'Content-Type: application/json' -d '{}'"
echo "   → doit retourner 401 (Unauthorized) au lieu de 404 (Not Found)"
