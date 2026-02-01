# ✅ Fix - Endpoint Public `/api/public/schools/list`

## 🐛 Problème

L'endpoint `/api/public/schools/list` retournait une erreur 403 :
```json
{
  "message": "Tenant ID is required",
  "error": "Forbidden",
  "statusCode": 403
}
```

## ✅ Solution Appliquée

### 1. Ajout du décorateur `@Public()` au niveau des méthodes

**Fichier** : `apps/api-server/src/portal/controllers/public-portal.controller.ts`

- ✅ Ajout de `@Public()` sur la méthode `listAllSchools()`
- ✅ Ajout de `@Public()` sur la méthode `searchSchools()`
- Le contrôleur avait déjà `@Public()` au niveau de la classe, mais certains guards ne le détectaient pas correctement

### 2. Vérification des Guards

Tous les guards suivants vérifient maintenant correctement `@Public()` :
- ✅ `TenantValidationGuard` - Ignore les routes publiques
- ✅ `TenantIsolationGuard` - Ignore les routes publiques  
- ✅ `ContextValidationGuard` - Ignore les routes publiques

## 🔍 Problème de Base de Données

**Erreur détectée** : La base de données PostgreSQL n'est pas accessible sur `localhost:5432`

### Solutions

1. **Vérifier que PostgreSQL est démarré** :
   ```bash
   # Windows
   net start postgresql-x64-XX
   
   # Linux/Mac
   sudo systemctl start postgresql
   ```

2. **Vérifier la connexion** :
   ```bash
   psql -h localhost -p 5432 -U postgres -d academia_hub
   ```

3. **Créer les tenants si la BDD est vide** :
   ```bash
   cd apps/api-server
   npx ts-node prisma/seed-test-tenants.ts
   ```

## 🚀 Test de l'Endpoint

Une fois la base de données accessible et les tenants créés :

```bash
curl http://localhost:3000/api/public/schools/list
```

Devrait retourner :
```json
[
  {
    "id": "...",
    "name": "CSPEB-Eveil d'Afrique Education",
    "slug": "cspeb-eveil-afrique",
    "subdomain": "cspeb",
    ...
  },
  {
    "id": "...",
    "name": "La Persévérance",
    "slug": "la-perseverance",
    "subdomain": "perseverance",
    ...
  }
]
```

## 📋 Checklist

- [x] Décorateur `@Public()` ajouté aux méthodes
- [ ] Base de données PostgreSQL démarrée
- [ ] Tenants créés dans la base de données
- [ ] Endpoint `/api/public/schools/list` accessible
