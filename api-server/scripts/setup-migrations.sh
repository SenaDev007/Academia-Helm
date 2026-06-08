#!/bin/bash

# Script d'Initialisation pour les Migrations Prisma
# Academia Hub - Setup des outils de migration

echo "🔧 Configuration des outils de migration Prisma..."
echo ""

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
  echo "❌ Erreur: Ce script doit être exécuté depuis le répertoire apps/api-server"
  exit 1
fi

# Vérifier que Prisma est installé
if ! command -v npx &> /dev/null; then
  echo "❌ Erreur: npx n'est pas installé. Installez Node.js et npm."
  exit 1
fi

# Installer les dépendances si nécessaire
if [ ! -d "node_modules" ]; then
  echo "📦 Installation des dépendances..."
  npm install
fi

# Vérifier que Prisma CLI est disponible
if ! npx prisma --version &> /dev/null; then
  echo "📦 Installation de Prisma CLI..."
  npm install --save-dev prisma@^5.19.0
fi

# Vérifier que ts-node est disponible
if ! npx ts-node --version &> /dev/null; then
  echo "📦 Installation de ts-node..."
  npm install --save-dev ts-node@^10.9.2
fi

# Vérifier que @prisma/internals est disponible
if ! npm list @prisma/internals &> /dev/null; then
  echo "📦 Installation de @prisma/internals..."
  npm install --save-dev @prisma/internals@^5.19.0
fi

# Créer le répertoire migrations s'il n'existe pas
if [ ! -d "prisma/migrations" ]; then
  echo "📁 Création du répertoire prisma/migrations..."
  mkdir -p prisma/migrations
fi

echo ""
echo "✅ Configuration terminée!"
echo ""
echo "📋 Commandes disponibles:"
echo "   npm run analyze:schema          - Analyser le schéma"
echo "   npm run migrate:generate-safe   - Générer les migrations"
echo "   npm run migrate:validate        - Valider les migrations"
echo "   npm run migrate:status          - Vérifier l'état"
echo "   npm run migrate:dev             - Appliquer (développement)"
echo "   npm run migrate:deploy          - Appliquer (production)"
echo ""

