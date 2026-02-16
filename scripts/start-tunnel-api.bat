@echo off
echo.
echo ========================================
echo   Tunnel API (port 3000) - localtunnel
echo ========================================
echo.
echo Sur le plan gratuit ngrok, un seul tunnel est actif.
echo Ce script utilise localtunnel pour exposer l'API.
echo.
echo L'URL s'affichera ci-dessous (ex: https://xxx.loca.lt)
echo Copiez-la et mettez a jour dans .env : API_URL=https://xxx.loca.lt
echo.
npx localtunnel --port 3000
pause
