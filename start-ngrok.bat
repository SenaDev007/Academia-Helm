@echo off
REM Script pour démarrer ngrok facilement
REM Usage: start-ngrok.bat [port]
REM Exemple: start-ngrok.bat 3000

set NGROK_PATH=C:\Users\HP\Downloads\ngrok-v3-stable-windows-386\ngrok.exe
set PORT=%1

if "%PORT%"=="" set PORT=3000

echo ========================================
echo Demarrage de ngrok pour le port %PORT%
echo ========================================
echo.
echo URL du webhook FedaPay:
echo https://VOTRE-URL-NGROK.ngrok-free.app/api/billing/fedapay/webhook
echo.
echo Appuyez sur Ctrl+C pour arreter ngrok
echo.

"%NGROK_PATH%" http %PORT%
