# Cloudflare R2 — Configuration pour les installables Academia Helm

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Page /downloads │────▶│  API /releases    │────▶│  Neon PostgreSQL│
│  (web-app)       │     │  (NestJS)         │     │  (metadata only)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │  Cloudflare R2   │
                                                │  (binaires: APK, │
                                                │   EXE, MSI)      │
                                                └─────────────────┘
```

## 1. Créer un bucket R2 sur Cloudflare

1. Aller sur https://dash.cloudflare.com → R2 Object Storage
2. Créer un bucket nommé `academia-helm-releases`
3. Activer l'accès public :
   - Settings → Public access → "Allow Access"
   - Lier un domaine personnalisé : `releases.academiahelm.com` (recommandé)
   - Ou utiliser le sous-domaine R2 : `pub-xxx.r2.dev`

## 2. Créer des credentials API R2

1. R2 → Manage R2 API Tokens → Create API Token
2. Permissions : Object Read & Write sur le bucket `academia-helm-releases`
3. Copier :
   - Account ID
   - Access Key ID
   - Secret Access Key

## 3. Variables d'environnement

### API Server (Railway / .env)

```env
# Cloudflare R2 — Installables storage
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=academia-helm-releases
R2_PUBLIC_URL=https://releases.academiahelm.com

# Neon PostgreSQL (déjà configuré)
DATABASE_URL=postgresql://...
```

### Web App (Vercel / .env.local)

```env
NEXT_PUBLIC_API_URL=https://api.academiahelm.com/api
```

## 4. Migration de la base de données

Exécuter le script SQL sur Neon :

```bash
psql $DATABASE_URL -f apps/api-server/prisma/migrations/create_app_releases.sql
```

Puis régénérer le client Prisma :

```bash
cd apps/api-server
npx prisma generate
```

## 5. Upload des installables

### Installer les dépendances du script

```bash
cd apps/api-server
npm install @aws-sdk/client-s3
```

### Uploader un fichier

```bash
# Variables d'environnement
export R2_ACCOUNT_ID=xxx
export R2_ACCESS_KEY_ID=xxx
export R2_SECRET_ACCESS_KEY=xxx
export R2_BUCKET_NAME=academia-helm-releases
export R2_PUBLIC_URL=https://releases.academiahelm.com
export DATABASE_URL=postgresql://...

# Upload APK Android
node scripts/upload-release.js \
  download/academia-helm-v1.2.8.apk \
  android 1.2.8 \
  --notes "Fix crash-on-launch, Firebase properly configured" \
  --latest \
  --min-os "Android 7.0"

# Upload Windows installer
node scripts/upload-release.js \
  download/Academia-Helm-v1.0.0-windows-setup.exe \
  windows 1.0.0 \
  --notes "Branded NSIS installer, offline-first splash" \
  --latest \
  --min-os "Windows 10"

# Upload Windows portable
node scripts/upload-release.js \
  download/academia-helm-desktop-v1.0.0.exe \
  windows 1.0.0 \
  --notes "Portable Windows executable" \
  --arch x64
```

## 6. API Endpoints

### Public (sans authentification)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/releases` | Liste (filtrable: `?platform=android&channel=stable`) |
| `GET` | `/api/releases/latest` | Dernière version par plateforme |
| `GET` | `/api/releases/:id` | Détails d'une release |

### Admin (JWT + rôle SUPER_ADMIN/PATRONAT)

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/releases` | Créer une release |
| `PATCH` | `/api/releases/:id/latest` | Marquer comme "latest" |
| `DELETE` | `/api/releases/:id` | Supprimer |

## 7. Exemple de réponse API

```json
// GET /api/releases/latest
[
  {
    "id": "a1b2c3d4-...",
    "version": "1.2.8",
    "platform": "android",
    "arch": "universal",
    "filename": "academia-helm-v1.2.8.apk",
    "fileSize": "64432295",
    "downloadUrl": "https://releases.academiahelm.com/releases/android/1.2.8/academia-helm-v1.2.8.apk",
    "checksumSha256": "a1b2c3...",
    "releaseChannel": "stable",
    "isLatest": true,
    "releaseNotes": "Fix crash-on-launch, Firebase properly configured",
    "minOsVersion": "Android 7.0",
    "uploadedAt": "2026-07-30T10:28:00.000Z"
  },
  {
    "id": "e5f6g7h8-...",
    "version": "1.0.0",
    "platform": "windows",
    "arch": "universal",
    "filename": "Academia-Helm-v1.0.0-windows-setup.exe",
    "fileSize": "6153731",
    "downloadUrl": "https://releases.academiahelm.com/releases/windows/1.0.0/Academia-Helm-v1.0.0-windows-setup.exe",
    "checksumSha256": "b3c4d5...",
    "releaseChannel": "stable",
    "isLatest": true,
    "releaseNotes": "Branded NSIS installer, offline-first splash",
    "minOsVersion": "Windows 10",
    "uploadedAt": "2026-07-30T20:46:00.000Z"
  }
]
```

## 8. Coûts estimés

| Ressource | Quantité | Coût/mois |
|-----------|----------|-----------|
| Stockage R2 | ~200 MB (10 versions × 3 plateformes) | ~0.003 $ |
| Egress (téléchargements) | **Gratuit** (R2 = 0 $ egress) | 0 $ |
| Requêtes R2 | ~1000/mois | ~0.0045 $ |
| **Total** | | **< 0.01 $/mois** |

Comparé à GitHub Releases : gratuit aussi, mais R2 offre :
- Domaine personnalisé (`releases.academiahelm.com`)
- Statistiques de téléchargement
- Pas de limite de 2 GB par fichier
- Contrôle total (versions, canaux stable/beta)
