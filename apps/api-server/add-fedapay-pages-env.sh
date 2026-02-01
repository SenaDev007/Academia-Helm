#!/bin/bash

ENV_FILE="./.env"

# Fonction pour ajouter une variable si elle n'existe pas
add_env_variable() {
  local var_name=$1
  local default_value=$2
  local comment=$3

  if ! grep -q "^${var_name}=" "$ENV_FILE" 2>/dev/null; then
    echo "" >> "$ENV_FILE"
    echo "# ${comment}" >> "$ENV_FILE"
    echo "${var_name}=${default_value}" >> "$ENV_FILE"
    echo "✅ ${var_name} ajoutée"
  else
    echo "✅ ${var_name} est déjà présent dans .env"
  fi
}

# Vérifier si le fichier .env existe
if [ ! -f "$ENV_FILE" ]; then
  echo "Le fichier .env n'existe pas. Veuillez le créer manuellement ou copier .env.example."
  exit 1
fi

echo "Ajout des variables d'environnement pour les pages de paiement FedaPay..."

# Pages de paiement statiques FedaPay
add_env_variable "FEDAPAY_STATIC_PAGE_SUBSCRIPTION_URL" "https://sandbox-me.fedapay.com/zc6PFcSr" "URL page de paiement souscription initiale (FedaPay Sandbox)"
add_env_variable "FEDAPAY_STATIC_PAGE_MONTHLY_URL" "https://sandbox-me.fedapay.com/WWJQrruC" "URL page de paiement mensuel (FedaPay Sandbox)"

# URLs (si pas déjà présentes)
add_env_variable "FRONTEND_URL" "http://localhost:3001" "URL du frontend pour les callbacks"
add_env_variable "API_URL" "http://localhost:3000" "URL de l'API backend"

echo ""
echo "✅ Variables d'environnement ajoutées"
echo ""
echo "📝 Note : Pour utiliser les pages statiques, laissez FEDAPAY_STATIC_PAGE_SUBSCRIPTION_URL configuré."
echo "   Pour utiliser l'API dynamique, commentez ou supprimez cette variable."
