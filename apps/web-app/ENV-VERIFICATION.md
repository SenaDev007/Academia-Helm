# ✅ Vérification du fichier .env.local

## 📋 Checklist Complète

Vérifiez que votre fichier `.env.local` contient **TOUTES** ces variables :

### ✅ 1. Environnement
```bash
NEXT_PUBLIC_ENV=local
```

### ✅ 2. URLs Application
```bash
# URL de base (SANS trailing slash)
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Domaine de base (SANS protocole)
NEXT_PUBLIC_BASE_DOMAIN=localhost:3001
```

### ✅ 3. URLs API
```bash
# URL de l'API (SANS trailing slash)
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### ✅ 4. Supabase (OBLIGATOIRE)
```bash
# URL de votre projet Supabase
NEXT_PUBLIC_SUPABASE_URL=https://ankbtgwlofidxtafdueu.supabase.co

# Clé publique Supabase
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_1XCM6w3jm4368f-P36BaKw_XrCoHmZy
```

### ✅ 5. Database (SERVER-SIDE ONLY)
```bash
# ⚠️ NE PAS mettre NEXT_PUBLIC_ devant ces variables
DATABASE_URL=postgresql://postgres:password@db.ankbtgwlofidxtafdueu.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:password@db.ankbtgwlofidxtafdueu.supabase.co:5432/postgres
```

### ✅ 6. Platform
```bash
NEXT_PUBLIC_PLATFORM=web
```

---

## ⚠️ Erreurs Courantes à Éviter

### ❌ ERREUR 1 : Trailing slash
```bash
# ❌ MAUVAIS
NEXT_PUBLIC_APP_URL=http://localhost:3001/
NEXT_PUBLIC_API_URL=http://localhost:3000/api/

# ✅ CORRECT
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### ❌ ERREUR 2 : Protocole dans BASE_DOMAIN
```bash
# ❌ MAUVAIS
NEXT_PUBLIC_BASE_DOMAIN=http://localhost:3001

# ✅ CORRECT
NEXT_PUBLIC_BASE_DOMAIN=localhost:3001
```

### ❌ ERREUR 3 : NEXT_PUBLIC_ sur DATABASE_URL
```bash
# ❌ MAUVAIS (DANGEREUX - expose la DB au client)
NEXT_PUBLIC_DATABASE_URL=postgresql://...

# ✅ CORRECT
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
```

### ❌ ERREUR 4 : Variables manquantes
```bash
# ❌ Si une variable est manquante, l'application utilisera les fallbacks
# mais cela peut causer des problèmes en production

# ✅ Vérifiez que TOUTES les variables sont présentes
```

---

## 🔍 Comment Vérifier

### Méthode 1 : Vérification Manuelle
1. Ouvrez `apps/web-app/.env.local`
2. Comparez avec cette checklist
3. Vérifiez qu'il n'y a pas d'erreurs communes

### Méthode 2 : Test de l'Application
1. Démarrez l'application : `npm run dev`
2. Vérifiez la console pour les erreurs
3. Si vous voyez des erreurs comme :
   - `Missing Supabase environment variables`
   - `Cannot connect to database`
   - `Invalid URL`
   → Vérifiez les variables correspondantes

### Méthode 3 : Vérification dans le Code
Les helpers dans `src/lib/utils/urls.ts` utilisent ces variables :
- `getAppBaseUrl()` → `NEXT_PUBLIC_APP_URL`
- `getApiBaseUrl()` → `NEXT_PUBLIC_API_URL`
- `getBaseDomain()` → `NEXT_PUBLIC_BASE_DOMAIN`

---

## 📝 Exemple de .env.local Correct

```bash
# Environnement
NEXT_PUBLIC_ENV=local

# URLs Application
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_BASE_DOMAIN=localhost:3001

# URLs API
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://ankbtgwlofidxtafdueu.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_1XCM6w3jm4368f-P36BaKw_XrCoHmZy

# Database (server-side only)
DATABASE_URL=postgresql://postgres:C%40ptain.Yehioracadhub202%21@db.ankbtgwlofidxtafdueu.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:C%40ptain.Yehioracadhub202%21@db.ankbtgwlofidxtafdueu.supabase.co:5432/postgres

# Platform
NEXT_PUBLIC_PLATFORM=web
```

---

## ✅ Si Tout Est Correct

Si votre `.env.local` contient toutes ces variables avec les bonnes valeurs :
- ✅ L'application devrait démarrer sans erreur
- ✅ Les redirections multi-tenant fonctionneront
- ✅ Supabase Auth sera configuré
- ✅ La connexion à la base de données fonctionnera

---

## 🆘 Si Vous Avez des Problèmes

1. **Vérifiez les erreurs dans la console**
2. **Comparez avec l'exemple ci-dessus**
3. **Vérifiez qu'il n'y a pas d'espaces avant/après les `=`**
4. **Vérifiez que les URLs Supabase sont correctes**
5. **Vérifiez que les credentials DATABASE_URL sont corrects**
