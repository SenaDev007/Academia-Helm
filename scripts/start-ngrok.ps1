# Script pour démarrer ngrok pour FedaPay
# Usage: .\scripts\start-ngrok.ps1

Write-Host "🚀 Démarrage de ngrok pour FedaPay" -ForegroundColor Cyan
Write-Host ""

# Vérifier si ngrok est installé
try {
    $ngrokVersion = ngrok version 2>&1
    Write-Host "✅ ngrok est installé" -ForegroundColor Green
} catch {
    Write-Host "❌ ngrok n'est pas installé. Installez-le avec: npm install -g ngrok" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "⚠️  IMPORTANT: Vous devez d'abord configurer votre authtoken ngrok" -ForegroundColor Yellow
Write-Host "   1. Créez un compte sur https://ngrok.com (gratuit)" -ForegroundColor Yellow
Write-Host "   2. Récupérez votre authtoken sur https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor Yellow
Write-Host "   3. Exécutez: ngrok config add-authtoken VOTRE_AUTHTOKEN" -ForegroundColor Yellow
Write-Host ""

$continue = Read-Host "Avez-vous déjà configuré votre authtoken ? (o/n)"
if ($continue -ne "o" -and $continue -ne "O") {
    Write-Host "Configurez d'abord votre authtoken, puis relancez ce script." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "📋 Instructions:" -ForegroundColor Cyan
Write-Host "   Ce script va démarrer 2 tunnels ngrok:" -ForegroundColor White
Write-Host "   - Frontend (port 3001)" -ForegroundColor White
Write-Host "   - API (port 3000)" -ForegroundColor White
Write-Host ""
Write-Host "   ⚠️  Gardez ces fenêtres ouvertes pendant vos tests!" -ForegroundColor Yellow
Write-Host ""

# Démarrer le tunnel frontend dans une nouvelle fenêtre
Write-Host "🌐 Démarrage du tunnel Frontend (port 3001)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ngrok http 3001; Read-Host 'Appuyez sur Entrée pour fermer'"

Start-Sleep -Seconds 2

# Démarrer le tunnel API dans une nouvelle fenêtre
Write-Host "🔌 Démarrage du tunnel API (port 3000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ngrok http 3000; Read-Host 'Appuyez sur Entrée pour fermer'"

Write-Host ""
Write-Host "✅ Les tunnels ngrok sont en cours de démarrage..." -ForegroundColor Green
Write-Host ""
Write-Host "📝 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "   1. Dans chaque fenêtre ngrok, copiez l'URL 'Forwarding' (ex: https://xxxx.ngrok-free.app)" -ForegroundColor White
Write-Host "   2. Mettez à jour apps/api-server/.env avec ces URLs:" -ForegroundColor White
Write-Host "      FRONTEND_URL=https://votre-url-frontend.ngrok-free.app" -ForegroundColor Gray
Write-Host "      API_URL=https://votre-url-api.ngrok-free.app" -ForegroundColor Gray
Write-Host "   3. Redémarrez l'API" -ForegroundColor White
Write-Host "   4. Configurez le webhook dans FedaPay:" -ForegroundColor White
Write-Host "      URL: https://votre-url-api.ngrok-free.app/api/billing/fedapay/webhook" -ForegroundColor Gray
Write-Host ""
Write-Host "📖 Guide complet: docs/NGROK-SETUP.md" -ForegroundColor Cyan
