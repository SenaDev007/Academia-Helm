# ✅ Vérification - Seed des Tenants

## 🎉 Seed Réussi !

Le script a créé avec succès **2 tenants/écoles** avec tous les utilisateurs.

## 📊 Résumé de la Création

### ✅ Données Créées

1. **Pays** : Bénin (BJ) ✅
2. **PLATFORM_OWNER** : `dev@academia-hub.local` ✅
3. **Tenant 1** : CSPEB-Eveil d'Afrique Education ✅
   - Slug : `cspeb-eveil-afrique`
   - Subdomain : `cspeb`
   - Ville : Parakou
   - **9 utilisateurs créés**
4. **Tenant 2** : La Persévérance ✅
   - Slug : `la-perseverance`
   - Subdomain : `perseverance`
   - Ville : N'Dali
   - **9 utilisateurs créés**

### ✅ Pour Chaque Tenant

- ✅ **École** : Informations complètes
- ✅ **Niveaux scolaires** : Maternelle, Primaire, Secondaire
- ✅ **Année scolaire** : 2025-2026 (active)
- ✅ **Utilisateurs** : 9 types différents
- ✅ **Enseignants** : 2 avec matricules EMP001 et EMP002

## 🔍 Vérifications à Effectuer

### 1. Vérifier via Prisma Studio

```bash
cd apps/api-server
npx prisma studio
```

Ouvrir `http://localhost:5555` et vérifier :
- **Tenant** : 2 entrées
- **School** : 2 entrées
- **User** : 19 entrées (1 PLATFORM_OWNER + 9 × 2)
- **Teacher** : 4 entrées (2 × 2)
- **SchoolLevel** : 6 entrées (3 × 2)
- **AcademicYear** : 2 entrées (2025-2026)

### 2. Vérifier via SQL

```sql
-- Compter les tenants
SELECT COUNT(*) as total_tenants FROM "Tenant" WHERE status = 'active';
-- Devrait retourner : 2

-- Compter les écoles
SELECT COUNT(*) as total_schools FROM "School";
-- Devrait retourner : 2

-- Compter les utilisateurs par tenant
SELECT 
  t.name as tenant_name,
  COUNT(u.id) as user_count
FROM "Tenant" t
LEFT JOIN "User" u ON u."tenantId" = t.id
WHERE t.status = 'active'
GROUP BY t.id, t.name;
-- Devrait retourner : 9 pour chaque tenant

-- Vérifier les enseignants
SELECT 
  t.matricule,
  t."firstName",
  t."lastName",
  t.email,
  tn.name as tenant_name
FROM "Teacher" t
JOIN "Tenant" tn ON t."tenantId" = tn.id
ORDER BY tn.name, t.matricule;
-- Devrait retourner : 4 enseignants (2 par tenant)
```

### 3. Tester l'API Backend

```bash
# Tester la liste des écoles
curl http://localhost:3000/api/public/schools/list

# Devrait retourner un JSON avec 2 écoles
```

### 4. Tester le Frontend

1. Aller sur `http://localhost:3001/portal`
2. Sélectionner un type de portail
3. Le sélecteur devrait afficher **2 écoles** :
   - CSPEB-Eveil d'Afrique Education (Parakou)
   - La Persévérance (N'Dali)
4. Rechercher "cspeb" → devrait trouver CSPEB
5. Rechercher "perseverance" ou "ndali" → devrait trouver La Persévérance

### 5. Tester les Logins

#### Test PLATFORM_OWNER
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev@academia-hub.local",
    "password": "C@ptain.Yehioracadhub2021"
  }'
```

#### Test Directeur CSPEB
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "s.akpovitohou@gmail.com",
    "password": "C@ptain.Yehioracadhub2021"
  }'
```

#### Test Directeur La Persévérance
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "directeur@perseverance.bj",
    "password": "C@ptain.Yehioracadhub2021"
  }'
```

## 📋 Checklist de Vérification

- [x] Script de seed exécuté avec succès
- [x] 2 tenants créés
- [x] 2 écoles créées
- [x] 19 utilisateurs créés (1 PLATFORM_OWNER + 9 × 2)
- [x] 4 enseignants créés (2 × 2)
- [x] 6 niveaux scolaires créés (3 × 2)
- [x] 2 années scolaires 2025-2026 créées
- [ ] API backend redémarrée (si nécessaire)
- [ ] Route `/api/public/schools/list` fonctionne
- [ ] Sélecteur frontend affiche les 2 écoles
- [ ] Logins fonctionnent pour tous les utilisateurs

## 🎯 Prochaines Actions

1. **Redémarrer l'API backend** (si elle tourne déjà) pour que la route `/api/public/schools/list` soit disponible
2. **Tester le sélecteur** sur `/portal` pour vérifier que les 2 écoles apparaissent
3. **Tester les logins** avec différents utilisateurs pour vérifier l'isolation des tenants

## 🔐 Identifiants de Test

Tous les identifiants sont disponibles dans le fichier `ENV-EXAMPLE.txt` et ont été créés dans la base de données avec les mots de passe hashés.
