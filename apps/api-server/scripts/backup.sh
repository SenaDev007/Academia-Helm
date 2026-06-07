#!/bin/bash

/**
 * ============================================================================
 * SCRIPT DE BACKUP POSTGRESQL - ACADEMIA HUB
 * ============================================================================
 * 
 * Niveau 2 : Backups manuels versionnés (hebdomadaire)
 * 
 * Usage :
 *   ./scripts/backup.sh
 * 
 * Variables d'environnement requises :
 *   - DATABASE_URL : URL de connexion PostgreSQL
 *   - BACKUP_STORAGE_PATH : Chemin de stockage (optionnel, défaut: ./backups)
 * ============================================================================
 */

set -euo pipefail

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="${BACKUP_STORAGE_PATH:-./backups}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/academiahub_${DATE}.sql"
LOG_FILE="${BACKUP_DIR}/backup_${DATE}.log"

# Vérifier que DATABASE_URL est définie
if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${RED}❌ ERREUR : DATABASE_URL n'est pas définie${NC}"
    echo "   Définissez-la avec : export DATABASE_URL='postgresql://...'"
    exit 1
fi

# Créer le répertoire de backup s'il n'existe pas
mkdir -p "${BACKUP_DIR}"

echo -e "${GREEN}🔄 Début du backup Academia Hub${NC}"
echo "   Date : $(date)"
echo "   Fichier : ${BACKUP_FILE}"
echo ""

# Exécuter le backup avec pg_dump
echo -e "${YELLOW}📦 Création du dump PostgreSQL...${NC}"
if pg_dump "${DATABASE_URL}" \
    --verbose \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    --format=plain \
    --file="${BACKUP_FILE}" 2>&1 | tee "${LOG_FILE}"; then
    
    # Vérifier que le fichier existe et n'est pas vide
    if [ -f "${BACKUP_FILE}" ] && [ -s "${BACKUP_FILE}" ]; then
        FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
        echo ""
        echo -e "${GREEN}✅ Backup réussi !${NC}"
        echo "   Fichier : ${BACKUP_FILE}"
        echo "   Taille : ${FILE_SIZE}"
        echo "   Log : ${LOG_FILE}"
        
        # Créer un lien symbolique vers le dernier backup
        ln -sf "${BACKUP_FILE}" "${BACKUP_DIR}/latest.sql"
        echo "   Lien symbolique : ${BACKUP_DIR}/latest.sql"
        
        # Compression optionnelle (décommenter si nécessaire)
        # echo ""
        # echo -e "${YELLOW}🗜️  Compression du backup...${NC}"
        # gzip "${BACKUP_FILE}"
        # echo -e "${GREEN}✅ Backup compressé : ${BACKUP_FILE}.gz${NC}"
        
        exit 0
    else
        echo -e "${RED}❌ ERREUR : Le fichier de backup est vide ou n'existe pas${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ ERREUR : Échec du backup${NC}"
    echo "   Vérifiez les logs : ${LOG_FILE}"
    exit 1
fi

