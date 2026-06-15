# 🔐 Configuration du Workflow de Login avec Variables d'Environnement

## ✅ Résumé des Modifications

Tous les identifiants de test ont été déplacés des fichiers de code vers les variables d'environnement pour une meilleure sécurité et flexibilité.

## 📁 Fichiers Créés/Modifiés

### Documentation
- ✅ `apps/web-app/ENV-TEST-CREDENTIALS.md` - Documentation complète des variables d'environnement
- ✅ `apps/web-app/ENV-LOCAL-EXAMPLE.txt` - Fichier d'exemple pour `.env.local`
- ✅ `apps/api-server/ENV-TEST-CREDENTIALS.md` - Documentation pour l'API server
- ✅ `apps/api-server/ENV-EXAMPLE.txt` - Fichier d'exemple pour `.env`

### API Routes (Côté Serveur)
- ✅ `apps/web-app/src/app/api/auth/test-credentials/admin/route.ts` - Identifiants Super Admin
- ✅ `apps/web-app/src/app/api/auth/test-credentials/patronat/route.ts` - Identifiants Patronat
- ✅ `apps/web-app/src/app/api/auth/test-credentials/school/route.ts` - Identifiants École (tous rôles)
- ✅ `apps/web-app/src/app/api/auth/test-credentials/teacher/route.ts` - Identifiants Enseignant
- ✅ `apps/web-app/src/app/api/auth/test-credentials/parent/route.ts` - Identifiants Parent
- ✅ `apps/web-app/src/app/api/auth/test-credentials/student/route.ts` - Identifiants Élève

### Fichiers de Login Modifiés
- ✅ `apps/web-app/src/components/admin/AdminLoginPage.tsx` - Utilise maintenant les variables d'env
- ✅ `apps/web-app/src/app/(patronat)/patronat/login/page.tsx` - Utilise maintenant les variables d'env

### Seed Mis à Jour
- ✅ `apps/api-server/prisma/seed-tenant-cspeb.ts` - Utilise maintenant les variables d'env

## 📊 Hiérarchie des Utilisateurs Supportés

```
SYSTEM
└── PLATFORM_OWNER (DEV only)

PLATEFORME
└── SUPER_ADMIN

ÉCOLE
├── Promoteur
├── Directeur
├── Secrétaire
├── Comptable
├── Secrétaire-Comptable
├── Censeur (Secondaire)
├── Surveillant(e) (Secondaire)
└── Enseignant / Instituteur / Professeur

EXTERNES
├── Parent
└── Élève
```

## 🚀 Configuration Requise

### 1. Web App (`apps/web-app/`)

Créez un fichier `.env.local` en copiant `ENV-LOCAL-EXAMPLE.txt` :

```bash
cd apps/web-app
cp ENV-LOCAL-EXAMPLE.txt .env.local
# Puis éditez .env.local avec vos valeurs
```

### 2. API Server (`apps/api-server/`)

Créez un fichier `.env` en copiant `ENV-EXAMPLE.txt` :

```bash
cd apps/api-server
cp ENV-EXAMPLE.txt .env
# Puis éditez .env avec vos valeurs
```

## 📝 Variables d'Environnement Principales

### SYSTEM & PLATEFORME
- `PLATFORM_OWNER_EMAIL` / `PLATFORM_OWNER_SECRET`
- `TEST_SUPER_ADMIN_EMAIL` / `TEST_SUPER_ADMIN_PASSWORD`

### ÉCOLE
- `TEST_PROMOTEUR_EMAIL` / `TEST_PROMOTEUR_PASSWORD`
- `TEST_DIRECTEUR_EMAIL` / `TEST_DIRECTEUR_PASSWORD`
- `TEST_SECRETAIRE_EMAIL` / `TEST_SECRETAIRE_PASSWORD`
- `TEST_COMPTABLE_EMAIL` / `TEST_COMPTABLE_PASSWORD`
- `TEST_SECRETAIRE_COMPTABLE_EMAIL` / `TEST_SECRETAIRE_COMPTABLE_PASSWORD`
- `TEST_CENSEUR_EMAIL` / `TEST_CENSEUR_PASSWORD`
- `TEST_SURVEILLANT_EMAIL` / `TEST_SURVEILLANT_PASSWORD`
- `TEST_ENSEIGNANT_MATRICULE_X` / `TEST_ENSEIGNANT_EMAIL_X` / `TEST_ENSEIGNANT_PASSWORD_X`

### EXTERNES
- `TEST_PARENT_PHONE_X` / `TEST_PARENT_EMAIL_X` / `TEST_PARENT_OTP_X`
- `TEST_ELEVE_CODE_X` / `TEST_ELEVE_EMAIL_X` / `TEST_ELEVE_PASSWORD_X`

### ÉCOLE CSPEB
- `TEST_SCHOOL_NAME`, `TEST_SCHOOL_NAME_SHORT`
- `TEST_SCHOOL_ADDRESS`, `TEST_SCHOOL_CONTACT`
- `TEST_SCHOOL_EMAIL`, `TEST_SCHOOL_CITY`, `TEST_SCHOOL_COUNTRY`

## 🔒 Sécurité

- ✅ Tous les identifiants sont stockés dans `.env.local` / `.env` (non versionnés)
- ✅ Les API routes sont côté serveur uniquement (pas d'exposition client)
- ✅ Les identifiants de test sont uniquement pour le développement

## 📚 Documentation Complète

Voir :
- `apps/web-app/ENV-TEST-CREDENTIALS.md` pour la documentation complète
- `apps/api-server/ENV-TEST-CREDENTIALS.md` pour l'API server
