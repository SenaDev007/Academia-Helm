#!/bin/bash
# ============================================================================
# ACADEMIA HUB - SCRIPT DE DÉMARRAGE ORCHESTRÉ (Linux/Mac)
# ============================================================================
# 
# Ce script démarre tous les services dans le bon ordre professionnel :
# 1. PostgreSQL (vérification)
# 2. API Server
# 3. Frontend
# 
# ============================================================================

set -e  # Arrêter en cas d'erreur

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Démarrage Academia Hub (Mode Professionnel)${NC}"
echo ""

# ============================================================================
# 1. VÉRIFICATION POSTGRESQL
# ============================================================================
echo -e "${YELLOW}[1/3] Vérification PostgreSQL...${NC}"

if command -v pg_isready > /dev/null 2>&1; then
    if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL OK (localhost:5432)${NC}"
    else
        echo -e "${RED}❌ PostgreSQL n'est pas accessible${NC}"
        echo ""
        echo "   Solutions :"
        echo "   - Linux: sudo systemctl start postgresql"
        echo "   - Mac: brew services start postgresql"
        echo "   - Docker: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15"
        echo ""
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  pg_isready non trouvé, vérification manuelle requise${NC}"
    echo "   Assurez-vous que PostgreSQL est démarré sur le port 5432"
fi

# ============================================================================
# 1.5. VÉRIFICATION DES MIGRATIONS
# ============================================================================
echo -e "${YELLOW}[1.5/3] Vérification des migrations...${NC}"

if [ -f "apps/api-server/prisma/schema.prisma" ]; then
    cd apps/api-server
    if npx prisma migrate deploy > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Migrations appliquées${NC}"
    else
        echo -e "${YELLOW}⚠️  Migrations déjà appliquées ou erreur (non bloquant)${NC}"
    fi
    cd ../..
else
    echo -e "${YELLOW}⚠️  Schema Prisma non trouvé${NC}"
fi

# ============================================================================
# 2. DÉMARRAGE API SERVER
# ============================================================================
echo -e "${YELLOW}[2/3] Démarrage API Server...${NC}"

cd apps/api-server

# Créer le dossier de logs si nécessaire
mkdir -p /tmp/academia-hub

# Démarrer l'API en arrière-plan
npm run start:dev > /tmp/academia-hub/api-server.log 2>&1 &
API_PID=$!
cd ../..

echo "   PID: $API_PID"
echo "   Logs: tail -f /tmp/academia-hub/api-server.log"

# Attendre que l'API soit prête (health check)
echo -e "${YELLOW}⏳ Attente de l'API...${NC}"

MAX_ATTEMPTS=30
ATTEMPT=0
API_READY=false

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        # Vérifier que la DB est connectée
        HEALTH_RESPONSE=$(curl -s http://localhost:3000/api/health)
        if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
            echo -e "${GREEN}✅ API Server OK (http://localhost:3000/api)${NC}"
            API_READY=true
            break
        fi
    fi
    ATTEMPT=$((ATTEMPT + 1))
    sleep 1
    echo -n "."
done

echo ""

if [ "$API_READY" = false ]; then
    echo -e "${RED}❌ API Server n'a pas démarré dans les temps${NC}"
    echo "   Vérifiez les logs: tail -f /tmp/academia-hub/api-server.log"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

# ============================================================================
# 3. DÉMARRAGE FRONTEND
# ============================================================================
echo -e "${YELLOW}[3/3] Démarrage Frontend...${NC}"

cd apps/web-app

# Démarrer le Frontend en arrière-plan
npm run dev > /tmp/academia-hub/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ../..

echo "   PID: $FRONTEND_PID"
echo "   Logs: tail -f /tmp/academia-hub/frontend.log"

# Attendre un peu que le Frontend démarre
echo -e "${YELLOW}⏳ Attente du Frontend...${NC}"
sleep 5

# ============================================================================
# RÉSUMÉ
# ============================================================================
echo ""
echo -e "${GREEN}✅ Academia Hub démarré avec succès !${NC}"
echo ""
echo "   📊 Database: PostgreSQL (localhost:5432)"
echo "   🔧 API: http://localhost:3000/api"
echo "   🌐 Frontend: http://localhost:3001"
echo ""
echo "📝 Logs:"
echo "   API: tail -f /tmp/academia-hub/api-server.log"
echo "   Frontend: tail -f /tmp/academia-hub/frontend.log"
echo ""
echo -e "${BLUE}Appuyez sur Ctrl+C pour arrêter${NC}"
echo ""

# ============================================================================
# NETTOYAGE À L'ARRÊT
# ============================================================================
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Arrêt des services...${NC}"
    kill $API_PID $FRONTEND_PID 2>/dev/null || true
    echo -e "${GREEN}✅ Services arrêtés${NC}"
    exit 0
}

trap cleanup INT TERM

# Attendre indéfiniment
wait
