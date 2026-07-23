# ============================================================================
# Déploiement Backend — Railway
# ============================================================================
#
## Étapes de déploiement :
#
## 1. Installer Railway CLI
#    npm install -g @railway/cli
#    railway login
#
## 2. Créer le projet + service
#    cd apps/api-server
#    railway link --create academia-helm-api
#
## 3. Configurer les variables d'environnement
#    railway variables set DATABASE_URL="postgresql://neondb_owner:..." \
#      JWT_SECRET="..." \
#      NODE_ENV=production \
#      PORT=3000 \
#      PUPPETEER_SKIP_DOWNLOAD=true \
#      PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
#      ...
#
## 4. Déployer
#    railway up --detach
#
## 5. Récupérer l'URL Railway
#    railway domain
#
## 6. Mettre à jour le frontend (Vercel)
#    NEXT_PUBLIC_API_URL=https://academia-helm-api-production.up.railway.app/api
#
## 7. (Optionnel) Configurer un domaine personnalisé
#    railway domain add api.academiahelm.com
#
# ============================================================================
