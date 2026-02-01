#!/bin/bash
# Script pour démarrer ngrok facilement
# Usage: ./start-ngrok.sh [port]
# Exemple: ./start-ngrok.sh 3000

NGROK_PATH="/c/Users/HP/Downloads/ngrok-v3-stable-windows-386/ngrok.exe"
PORT=${1:-3000}

echo "========================================"
echo "Démarrage de ngrok pour le port $PORT"
echo "========================================"
echo ""
echo "URL du webhook FedaPay:"
echo "https://VOTRE-URL-NGROK.ngrok-free.app/api/billing/fedapay/webhook"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter ngrok"
echo ""

# Vérifier si le fichier existe
if [ ! -f "$NGROK_PATH" ]; then
    echo "❌ Erreur: ngrok.exe non trouvé à: $NGROK_PATH"
    echo ""
    echo "💡 Essayez d'exécuter directement:"
    echo "   cmd.exe //c \"C:\\Users\\HP\\Downloads\\ngrok-v3-stable-windows-386\\ngrok.exe\" http $PORT"
    exit 1
fi

# Exécuter ngrok directement (Git Bash peut exécuter .exe)
"$NGROK_PATH" http "$PORT"
