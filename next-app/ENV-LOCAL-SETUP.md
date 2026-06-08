# 📝 Configuration .env.local

## ✅ Fichier .env.local

Le fichier `.env.local` a été créé ou existe déjà dans `apps/web-app/`.

---

## 🔐 Variables d'Environnement Requises

Assurez-vous que votre fichier `.env.local` contient les variables suivantes :

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://ankbtgwlofidxtafdueu.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_1XCM6w3jm4368f-P36BaKw_XrCoHmZy

# Database Connection (server-side only)
DATABASE_URL=postgresql://postgres:C%40ptain.Yehioracadhub202%21@db.ankbtgwlofidxtafdueu.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:C%40ptain.Yehioracadhub202%21@db.ankbtgwlofidxtafdueu.supabase.co:5432/postgres

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_PLATFORM=web
NEXT_PUBLIC_ENV=development
```

---

## 🚀 Création Automatique

Vous pouvez utiliser le script pour créer/mettre à jour le fichier :

```bash
cd apps/web-app
node scripts/create-env-local.js
```

---

## ✅ Vérification

Vérifiez que le fichier existe et contient les bonnes variables :

```bash
cd apps/web-app
cat .env.local
```

---

## 🔒 Sécurité

- ✅ Le fichier `.env.local` est dans `.gitignore` (protégé)
- ✅ Ne jamais commiter ce fichier
- ✅ Les variables `DATABASE_URL` et `DIRECT_URL` sont server-side only

---

**Configuration terminée** ✅

