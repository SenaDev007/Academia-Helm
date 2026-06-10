@echo off
REM ============================================================================
REM ACADEMIA HUB - SCRIPT DE DÉMARRAGE ORCHESTRÉ (Windows)
REM ============================================================================
REM 
REM Ce script démarre tous les services dans le bon ordre professionnel :
REM 1. PostgreSQL (vérification)
REM 2. API Server
REM 3. Frontend
REM 
REM ============================================================================

echo.
echo 🚀 Démarrage Academia Hub (Mode Professionnel)
echo.

REM ============================================================================
REM 1. VÉRIFICATION POSTGRESQL
REM ============================================================================
echo [1/3] Vérification PostgreSQL...

REM Vérifier si PostgreSQL est accessible
REM Note: Sur Windows, on peut utiliser psql ou vérifier le service
where psql >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ PostgreSQL trouvé (vérification manuelle requise)
) else (
    echo ⚠️  PostgreSQL non trouvé dans PATH
    echo    Assurez-vous que PostgreSQL est démarré sur le port 5432
)

REM ============================================================================
REM 1.5. VÉRIFICATION DES MIGRATIONS
REM ============================================================================
echo [1.5/3] Vérification des migrations...

if exist "apps\api-server\prisma\schema.prisma" (
    cd apps\api-server
    call npx prisma migrate deploy >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo ✅ Migrations appliquées
    ) else (
        echo ⚠️  Migrations déjà appliquées ou erreur (non bloquant)
    )
    cd ..\..
) else (
    echo ⚠️  Schema Prisma non trouvé
)

REM ============================================================================
REM 2. DÉMARRAGE API SERVER
REM ============================================================================
echo [2/3] Démarrage API Server...

cd apps\api-server
start "Academia Hub - API Server" cmd /k "npm run start:dev"
cd ..\..

echo    Fenêtre séparée ouverte pour l'API Server
echo    ⏳ Attente du démarrage de l'API (10 secondes)...

REM Attendre que l'API démarre
timeout /t 10 /nobreak >nul

REM Vérifier que l'API répond
:CHECK_API
curl -s http://localhost:3000/api/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ API Server OK (http://localhost:3000/api)
) else (
    echo ⚠️  API Server en cours de démarrage...
    timeout /t 2 /nobreak >nul
    goto CHECK_API
)

REM ============================================================================
REM 3. DÉMARRAGE FRONTEND
REM ============================================================================
echo [3/3] Démarrage Frontend...

cd apps\web-app
start "Academia Hub - Frontend" cmd /k "npm run dev"
cd ..\..

echo    Fenêtre séparée ouverte pour le Frontend
echo    ⏳ Attente du démarrage du Frontend (5 secondes)...

timeout /t 5 /nobreak >nul

REM ============================================================================
REM RÉSUMÉ
REM ============================================================================
echo.
echo ✅ Academia Hub démarré avec succès !
echo.
echo    📊 Database: PostgreSQL (localhost:5432)
echo    🔧 API: http://localhost:3000/api
echo    🌐 Frontend: http://localhost:3001
echo.
echo Les services sont démarrés dans des fenêtres séparées.
echo Fermez ces fenêtres pour arrêter les services.
echo.
pause
