# 📋 Guide de Configuration .env.local

## 🎯 Vue d'Ensemble

Ce guide explique comment configurer correctement les variables d'environnement pour Academia Hub dans tous les environnements : **local**, **preview (Vercel)**, et **production**.

---

## 🏠 1. LOCAL (Développement - localhost)

### Configuration Rapide

1. **Copiez le template** :
   ```bash
   cd apps/web-app
   cp .env.local.example .env.local
   ```

2. **Modifiez `.env.local`** avec vos valeurs Supabase :
   ```bash
   # Environnement
   NEXT_PUBLIC_ENV=local
   
   # URLs Application (déjà configurées pour localhost)
   NEXT_PUBLIC_APP_URL=http://localhost:3001
   NEXT_PUBLIC_BASE_DOMAIN=localhost:3001
   NEXT_PUBLIC_API_URL=http://localhost:3000/api
   
   # Supabase (remplacer par vos valeurs)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-key-here
   
   # Database (remplacer par vos valeurs)
   DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
   DIRECT_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
   
   # Platform
   NEXT_PUBLIC_PLATFORM=web
   ```

3. **Testez** :
   ```bash
   npm run dev
   ```

### ✅ Vérification

L'application devrait démarrer sur `http://localhost:3001` sans erreur.

---

## 🚀 2. PREVIEW (Vercel)

### Configuration dans Vercel Dashboard

1. **Accédez à Vercel Dashboard** :
   - Allez sur https://vercel.com/dashboard
   - Sélectionnez votre projet
   - Settings > Environment Variables

2. **Ajoutez les variables** pour **Preview** :
   ```bash
   # Environnement
   NEXT_PUBLIC_ENV=preview
   
   # URLs Application (optionnel - détectées automatiquement)
   # Vercel fournit automatiquement VERCEL_URL
   NEXT_PUBLIC_APP_URL=https://academia-hub-abc123.vercel.app
   NEXT_PUBLIC_BASE_DOMAIN=academia-hub-abc123.vercel.app
   NEXT_PUBLIC_API_URL=https://api.academia-hub.com/api
   
   # Supabase (mêmes valeurs que local)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-key-here
   
   # Database (mêmes valeurs que local pour preview)
   DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
   DIRECT_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
   
   # Platform
   NEXT_PUBLIC_PLATFORM=web
   ```

3. **Déployez** :
   - Push sur votre branche
   - Vercel crée automatiquement une preview

### ✅ Vérification

La preview devrait être accessible sur une URL `*.vercel.app` et fonctionner correctement.

---

## 🌐 3. PRODUCTION (Vercel + Domaine)

### Configuration dans Vercel Dashboard

1. **Accédez à Vercel Dashboard** :
   - Settings > Environment Variables
   - Sélectionnez **Production**

2. **Ajoutez les variables** pour **Production** :
   ```bash
   # Environnement
   NEXT_PUBLIC_ENV=production
   
   # URLs Application (DOMAINE PUBLIC)
   NEXT_PUBLIC_APP_URL=https://academia-hub.com
   NEXT_PUBLIC_BASE_DOMAIN=academia-hub.com
   NEXT_PUBLIC_API_URL=https://api.academia-hub.com/api
   
   # Supabase (mêmes valeurs que local/preview)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-key-here
   
   # Database (⚠️ Recommandé: utiliser connection pooling en production)
   # Connection pooling (port 6543) pour DATABASE_URL
   DATABASE_URL=postgresql://postgres.xxx:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   
   # Direct connection (port 5432) pour DIRECT_URL (migrations uniquement)
   DIRECT_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
   
   # Platform
   NEXT_PUBLIC_PLATFORM=web
   ```

3. **Configurez le domaine** :
   - Settings > Domains
   - Ajoutez votre domaine custom (ex: `academia-hub.com`)
   - Configurez les DNS selon les instructions Vercel

4. **Déployez** :
   - Merge sur `main` ou `master`
   - Vercel déploie automatiquement en production

### ⚠️ Notes Production

- **Connection Pooling** : En production, utilisez le port **6543** avec `pgbouncer=true` pour `DATABASE_URL`
- **DIRECT_URL** : Gardez le port **5432** pour les migrations Prisma
- **Domaine** : Configurez les DNS avant le déploiement

### ✅ Vérification

L'application devrait être accessible sur `https://academia-hub.com` et fonctionner correctement.

---

## 🔐 4. SUPABASE Configuration

### Variables Requises

Ces variables sont **identiques** pour tous les environnements :

```bash
# URL du projet Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Clé publique Supabase (anon key)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-key-here
```

### Où Trouver ces Valeurs

1. **Accédez au Dashboard Supabase** :
   - https://app.supabase.com/project/[PROJECT_ID]/settings/api

2. **Récupérez** :
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

### Database URLs

**Local/Preview** :
```bash
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

**Production** (recommandé avec connection pooling) :
```bash
# Connection pooling (port 6543)
DATABASE_URL=postgresql://postgres.xxx:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true

# Direct connection (port 5432)
DIRECT_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

---

## ✅ Checklist de Vérification

### Local
- [ ] `.env.local` existe dans `apps/web-app/`
- [ ] `NEXT_PUBLIC_APP_URL=http://localhost:3001`
- [ ] `NEXT_PUBLIC_BASE_DOMAIN=localhost:3001`
- [ ] `NEXT_PUBLIC_API_URL=http://localhost:3000/api`
- [ ] Variables Supabase configurées
- [ ] `npm run dev` fonctionne sans erreur

### Preview (Vercel)
- [ ] Variables configurées dans Vercel Dashboard (Preview)
- [ ] `NEXT_PUBLIC_ENV=preview`
- [ ] Preview accessible sur URL `*.vercel.app`

### Production (Vercel)
- [ ] Variables configurées dans Vercel Dashboard (Production)
- [ ] `NEXT_PUBLIC_ENV=production`
- [ ] `NEXT_PUBLIC_APP_URL=https://academia-hub.com`
- [ ] `NEXT_PUBLIC_BASE_DOMAIN=academia-hub.com`
- [ ] Connection pooling configuré pour `DATABASE_URL`
- [ ] Domaine DNS configuré
- [ ] Production accessible sur domaine public

---

## 🆘 Résolution de Problèmes

### Erreur: "Missing Supabase environment variables"
→ Vérifiez que `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` sont définis

### Erreur: "Cannot connect to database"
→ Vérifiez que `DATABASE_URL` et `DIRECT_URL` sont corrects
→ Vérifiez que le mot de passe est encodé en URL (%40 pour @, etc.)

### Erreur: "Invalid URL" ou redirections incorrectes
→ Vérifiez qu'il n'y a pas de trailing slash (/) à la fin des URLs
→ Vérifiez que `NEXT_PUBLIC_BASE_DOMAIN` n'a pas de protocole (http://)

### Preview/Production pointe vers localhost
→ Vérifiez que les variables sont bien configurées dans Vercel Dashboard
→ Vérifiez que l'environnement (Preview/Production) est bien sélectionné

---

## 📚 Références

- [Documentation Next.js - Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Documentation Supabase - Environment Variables](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs)
- [Documentation Vercel - Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

**Dernière mise à jour**: Configuration pour système multi-tenant avec redirection intelligente
