#!/bin/bash
# ============================================================================
# Script de déploiement Railway — Academia Helm API
# ============================================================================
# Usage:
#   ./scripts/deploy-railway.sh
#
# Prérequis:
#   1. Railway CLI installé : npm install -g @railway/cli
#   2. Connecté : railway login
# ============================================================================

set -e

echo "🚀 Déploiement Railway — Academia Helm API"
echo "============================================"
echo ""

# Vérifier que Railway CLI est installé
if ! command -v railway &> /dev/null; then
  echo "❌ Railway CLI non installé. Lancez : npm install -g @railway/cli"
  exit 1
fi

# Vérifier que l'utilisateur est connecté
if ! railway whoami &> /dev/null; then
  echo "❌ Non connecté à Railway. Lancez : railway login"
  exit 1
fi

echo "✅ Connecté à Railway"
echo ""

# Aller dans le dossier API
cd /home/z/my-project/apps/api-server

# Vérifier que le projet Railway existe
RAILWAY_STATUS=$(railway status 2>&1 || true)
if echo "$RAILWAY_STATUS" | grep -q "No project linked"; then
  echo "📦 Création d'un nouveau projet Railway..."
  railway link --create academia-helm-api
  echo "✅ Projet créé et lié"
else
  echo "✅ Projet Railway déjà lié"
fi

echo ""
echo "🔧 Variables d'environnement..."
echo "   (Vérifiez que toutes les variables obligatoires sont configurées)"
echo "   DATABASE_URL, JWT_SECRET, NODE_ENV, PORT"
echo ""

echo "🔨 Déploiement en cours..."
railway up --detach

echo ""
echo "⏳ En attente du démarrage..."
sleep 10

# Récupérer l'URL Railway
RAILWAY_URL=$(railway domain 2>&1 || true)
if [ -n "$RAILWAY_URL" ]; then
  echo ""
  echo "✅ Déploiement terminé !"
  echo "   URL API : https://$RAILWAY_URL"
  echo ""
  echo "📝 Pour mettre à jour le frontend, changez NEXT_PUBLIC_API_URL dans Vercel :"
  echo "   NEXT_PUBLIC_API_URL=https://$RAILWAY_URL/api"
  echo ""
  echo "🔍 Health check :"
  echo "   curl https://$RAILWAY_URL/health"
else
  echo ""
  echo "⚠️  URL non disponible immédiatement. Vérifiez le dashboard Railway :"
  echo "   https://railway.app/dashboard"
fi
