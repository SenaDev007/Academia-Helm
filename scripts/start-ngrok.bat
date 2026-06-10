@echo off
echo.
echo ========================================
echo   Demarrage des tunnels ngrok
echo ========================================
echo.
echo IMPORTANT: Assurez-vous d'avoir configure votre authtoken ngrok
echo   1. Creer un compte sur https://ngrok.com
echo   2. Recuperer votre authtoken sur https://dashboard.ngrok.com/get-started/your-authtoken
echo   3. Executer: ngrok config add-authtoken VOTRE_AUTHTOKEN
echo.
pause
echo.
echo Demarrage du tunnel Frontend (port 3001)...
start "ngrok-frontend" cmd /k "ngrok http 3001"
timeout /t 2 /nobreak >nul
echo Demarrage du tunnel API (port 3000)...
start "ngrok-api" cmd /k "ngrok http 3000"
echo.
echo ========================================
echo   Tunnels demarres!
echo ========================================
echo.
echo Dans chaque fenetre ngrok, copiez l'URL 'Forwarding'
echo   Exemple: https://xxxx-xx-xx-xx-xx.ngrok-free.app
echo.
echo Mettez a jour apps/api-server/.env avec ces URLs:
echo   FRONTEND_URL=https://votre-url-frontend.ngrok-free.app
echo   API_URL=https://votre-url-api.ngrok-free.app
echo.
echo Puis redemarrez l'API et configurez le webhook dans FedaPay
echo.
pause
