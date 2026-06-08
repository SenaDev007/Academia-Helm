# 🔐 Guide - Mode Développement avec PLATFORM_OWNER

## 🎯 Objectif

Le bouton **"Mode Développement"** sur la page portail redirige maintenant vers la page de login avec le tenant de test, permettant d'utiliser les identifiants **PLATFORM_OWNER** pour se connecter.

## 🔄 Workflow

1. **Clic sur "Mode Développement"** sur `/portal`
2. **Récupération du tenant de test** via `/api/dev/test-tenant`
3. **Redirection vers `/login`** avec le tenant de test
4. **Connexion avec PLATFORM_OWNER** :
   - Email : `PLATFORM_OWNER_EMAIL` (défini dans `.env` du backend)
   - Password : `PLATFORM_OWNER_SECRET` (défini dans `.env` du backend)
5. **Redirection vers `/app`** après connexion réussie

## 📋 Configuration Requise

### Variables d'environnement Backend (`apps/api-server/.env`)

```env
# Mode développement
APP_ENV=development
NODE_ENV=development

# Identifiants PLATFORM_OWNER
PLATFORM_OWNER_EMAIL=dev@academia-hub.local
PLATFORM_OWNER_SECRET=C@ptain.Yehioracadhub2021

# Informations tenant de test
TEST_SCHOOL_SLUG=cspeb-eveil-afrique
TEST_SCHOOL_SUBDOMAIN=cspeb
TEST_SCHOOL_NAME=Complexe Scolaire Privé Entrepreneurial et Bilingue - Eveil d'Afrique Education
```

### Variables d'environnement Frontend (`apps/web-app/.env.local`) - Optionnel

Si vous voulez personnaliser le tenant de test côté frontend :

```env
# Tenant de test (optionnel, utilise les valeurs du backend par défaut)
NEXT_PUBLIC_TEST_SCHOOL_SLUG=cspeb-eveil-afrique
NEXT_PUBLIC_TEST_SCHOOL_SUBDOMAIN=cspeb
NEXT_PUBLIC_TEST_SCHOOL_NAME=CSPEB-Eveil d'Afrique Education
NEXT_PUBLIC_TEST_TENANT_ID=<uuid-du-tenant>  # Optionnel, sera recherché automatiquement
```

## 🔍 Fonctionnement Technique

### 1. Route API `/api/dev/test-tenant`

Cette route :
- ✅ Vérifie que c'est en développement
- ✅ Recherche le tenant de test dans la base de données via le backend
- ✅ Utilise le slug `TEST_SCHOOL_SLUG` pour la recherche
- ✅ Retourne les informations du tenant (id, slug, subdomain, name)
- ✅ Fallback sur les variables d'environnement si la recherche échoue

### 2. Bouton "Mode Développement"

Le bouton :
- ✅ Appelle `/api/dev/test-tenant` pour récupérer les informations
- ✅ Redirige vers `/login?tenant={id}&redirect=/app`
- ✅ Permet à l'utilisateur de saisir manuellement les identifiants PLATFORM_OWNER

### 3. Page de Login

La page de login :
- ✅ Détecte le paramètre `tenant` dans l'URL
- ✅ Affiche le formulaire standard (Email + Password)
- ✅ Utilise `/api/auth/login` pour l'authentification
- ✅ Le backend valide les identifiants PLATFORM_OWNER automatiquement

## 🧪 Test

1. **Aller sur `/portal`**
2. **Cliquer sur "Mode Développement"**
3. **Vérifier la redirection** vers `/login?tenant={id}&redirect=/app`
4. **Saisir les identifiants PLATFORM_OWNER** :
   - Email : `dev@academia-hub.local` (ou la valeur de `PLATFORM_OWNER_EMAIL`)
   - Password : `C@ptain.Yehioracadhub2021` (ou la valeur de `PLATFORM_OWNER_SECRET`)
5. **Vérifier la connexion** et la redirection vers `/app`

## ⚠️ Notes Importantes

- **UNIQUEMENT EN DÉVELOPPEMENT** : Le mode dev-login est désactivé en production
- **Tenant de test** : Le tenant doit exister dans la base de données avec le slug `TEST_SCHOOL_SLUG`
- **PLATFORM_OWNER** : L'utilisateur avec l'email `PLATFORM_OWNER_EMAIL` doit exister dans la base de données
- **Mot de passe** : Le mot de passe dans la DB doit être hashé avec bcrypt et correspondre à `PLATFORM_OWNER_SECRET`

## 🔧 Dépannage

### Erreur : "Test tenant is only available in development mode"
- Vérifier que `NODE_ENV=development` dans `.env.local`

### Erreur : "Impossible de récupérer les informations du tenant de test"
- Vérifier que `TEST_SCHOOL_SLUG` est défini dans `.env`
- Vérifier que le backend est démarré et accessible
- Vérifier que le tenant existe dans la base de données avec ce slug

### Erreur : "Identifiants invalides" lors de la connexion
- Vérifier que `PLATFORM_OWNER_EMAIL` et `PLATFORM_OWNER_SECRET` sont définis dans `.env` du backend
- Vérifier que l'utilisateur existe dans la base de données avec cet email
- Vérifier que le mot de passe hashé correspond à `PLATFORM_OWNER_SECRET`

## 📝 Différences avec l'Ancien Workflow

### Avant
- Le bouton appelait directement `/api/auth/dev-login`
- Connexion automatique sans interaction
- Pas de contrôle sur le tenant

### Maintenant
- Le bouton redirige vers `/login` avec le tenant de test
- L'utilisateur saisit manuellement les identifiants PLATFORM_OWNER
- Plus de contrôle et de visibilité sur le processus de connexion
- Permet de tester différents scénarios de connexion
