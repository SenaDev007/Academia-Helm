#!/bin/bash

/**
 * ============================================================================
 * SCRIPT DE RESTAURATION POSTGRESQL - ACADEMIA HUB
 * ============================================================================
 * 
 * Restaure un backup PostgreSQL
 * 
 * Usage :
 *   ./scripts/restore.sh <backup_file.sql>
 * 
 * Exemple :
 *   ./scripts/restore.sh backups/academiahub_20240101_120000.sql
 * 
 * Variables d'environnement requises :
 *   - DATABASE_URL : URL de connexion PostgreSQL
 * ============================================================================
 */

set -euo pipefail

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier les arguments
if [ $# -eq 0 ]; then
    echo -e "${RED}❌ ERREUR : Aucun fichier de backup spécifié${NC}"
    echo ""
    echo "Usage : $0 <backup_file.sql>"
    echo ""
    echo "Exemple :"
    echo "  $0 backups/academiahub_20240101_120000.sql"
    exit 1
fi

BACKUP_FILE="$1"

# Vérifier que le fichier existe
if [ ! -f "${BACKUP_FILE}" ]; then
    echo -e "${RED}❌ ERREUR : Le fichier ${BACKUP_FILE} n'existe pas${NC}"
    exit 1
fi

# Vérifier que DATABASE_URL est définie
if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${RED}❌ ERREUR : DATABASE_URL n'est pas définie${NC}"
    echo "   Définissez-la avec : export DATABASE_URL='postgresql://...'"
    exit 1
fi

# Confirmation avant restauration
echo -e "${YELLOW}⚠️  ATTENTION : Cette opération va ÉCRASER la base de données actuelle${NC}"
echo ""
echo "   Fichier de backup : ${BACKUP_FILE}"
echo "   Base de données : ${DATABASE_URL}"
echo ""
read -p "   Êtes-vous sûr de vouloir continuer ? (oui/non) " -r
echo ""

if [[ ! $REPLY =~ ^[Oo]ui$ ]]; then
    echo -e "${YELLOW}❌ Restauration annulée${NC}"
    exit 0
fi

# Restauration
echo -e "${GREEN}🔄 Début de la restauration...${NC}"
echo "   Date : $(date)"
echo ""

if psql "${DATABASE_URL}" < "${BACKUP_FILE}"; then
    echo ""
    echo -e "${GREEN}✅ Restauration réussie !${NC}"
    echo "   Base de données restaurée depuis : ${BACKUP_FILE}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ ERREUR : Échec de la restauration${NC}"
    exit 1
fi

