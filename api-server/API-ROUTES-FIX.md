# 🔧 Corrections - Routes API

## ❌ Problèmes Identifiés

### 1. Route `/api/public/schools/list` retourne 404

**Cause** : L'URL de l'API backend n'était pas correctement construite dans la route Next.js.

**Solution** : 
- ✅ Ajout de la gestion correcte de l'URL avec vérification du préfixe `/api`
- ✅ Ajout de logs pour le débogage
- ✅ Amélioration de la gestion des erreurs

**Fichier modifié** : `apps/web-app/src/app/api/public/schools/list/route.ts`

### 2. Erreur 401 sur `/api/auth/login`

**Cause** : Les identifiants PLATFORM_OWNER ne sont pas correctement validés ou l'utilisateur n'existe pas dans la base de données.

**Solution** : 
- Vérifier que l'utilisateur avec `PLATFORM_OWNER_EMAIL` existe dans la base de données
- Vérifier que le mot de passe hashé correspond à `PLATFORM_OWNER_SECRET`
- Vérifier que les variables d'environnement sont correctement définies

## ✅ Actions Requises

### Redémarrer l'API Backend

L'API backend doit être redémarrée pour que la nouvelle route `/api/public/schools/list` soit disponible :

```bash
cd apps/api-server
npm run start:dev
```

### Vérifier les Variables d'Environnement

Dans `apps/api-server/.env` :

```env
PLATFORM_OWNER_EMAIL=dev@academia-hub.local
PLATFORM_OWNER_SECRET=C@ptain.Yehioracadhub2021
```

### Vérifier l'Utilisateur dans la Base de Données

L'utilisateur avec l'email `PLATFORM_OWNER_EMAIL` doit exister :

```sql
SELECT id, email, "passwordHash" FROM users WHERE email = 'dev@academia-hub.local';
```

Si l'utilisateur n'existe pas, le créer avec le mot de passe hashé correspondant à `PLATFORM_OWNER_SECRET`.

## 🧪 Test

1. **Redémarrer l'API backend**
2. **Tester la route `/api/public/schools/list`** :
   ```bash
   curl http://localhost:3000/api/public/schools/list
   ```
3. **Vérifier que la liste des écoles se charge** dans le sélecteur
4. **Tester le login** avec les identifiants PLATFORM_OWNER
