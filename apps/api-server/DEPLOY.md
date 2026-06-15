# Déploiement Academia Helm API sur Fly.io

## 1. Installer flyctl (une seule fois sur ta machine)
curl -L https://fly.io/install.sh | sh
fly auth login

## 2. Première fois uniquement
cd apps/api-server
fly launch --name academia-helm-api --region jnb --no-deploy

## 3. Variables d'environnement (une seule fois)
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set JWT_SECRET="votre-secret-min-32-chars"
fly secrets set JWT_EXPIRES_IN="7d"
fly secrets set FRONTEND_URL="https://academiahelm.com"

## 4. Déployer
fly deploy --remote-only

## 5. Vérifier
fly status
fly logs

## 6. Connecter le domaine custom
fly certs add api.academiahelm.com

## Redéployer après chaque modification
cd apps/api-server
fly deploy --remote-only
