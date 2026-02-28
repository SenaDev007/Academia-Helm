# ✅ Guide - Création de 2 Tenants/Écoles de Test

## 🎯 Script de Seed Créé

Un script complet a été créé pour créer **2 tenants/écoles** avec tous les utilisateurs et leurs identifiants depuis `.env.local`.

## 📋 Ce qui est créé

Le script `seed-test-tenants.ts` crée :

### 1. Tenant 1 : CSPEB-Eveil d'Afrique Education (Parakou)
- **Slug** : `cspeb-eveil-afrique`
- **Subdomain** : `cspeb`
- **Ville** : Parakou

### 2. Tenant 2 : La Persévérance (N'Dali)
- **Slug** : `la-perseverance`
- **Subdomain** : `perseverance`
- **Ville** : N'Dali

### Pour chaque tenant :

1. **Country (Pays)** : Bénin (BJ)
2. **Tenant** : Informations complètes
3. **School (École)** : Informations complètes
4. **SchoolLevels** : 3 niveaux (Maternelle, Primaire, Secondaire)
5. **AcademicYear** : 2025-2026 (active)
6. **Users** : Tous les types d'utilisateurs :
   - ✅ Promoteur
   - ✅ Directeur
   - ✅ Secrétaire
   - ✅ Comptable
   - ✅ Secrétaire-Comptable
   - ✅ Censeur
   - ✅ Surveillant
   - ✅ Enseignant 1 (EMP001)
   - ✅ Enseignant 2 (EMP002)

### Utilisateur Global :

- **PLATFORM_OWNER** : `dev@academia-hub.local` (sans tenantId, accès global)

## 🚀 Utilisation

### Prérequis

1. **PostgreSQL doit être démarré**
2. **Base de données `academia_helm` doit exister**
3. **Variables d'environnement configurées** dans `.env`

### Exécuter le script

```bash
cd apps/api-server
npx ts-node prisma/seed-test-tenants.ts
```

### Le script est idempotent

- ✅ Peut être exécuté plusieurs fois sans erreur
- ✅ Met à jour les données existantes si nécessaire
- ✅ Crée uniquement ce qui n'existe pas

## 📊 Résultat Attendu

Après exécution, vous devriez voir :

```
✅ SEED TERMINÉ AVEC SUCCÈS !
============================================================

📊 Résumé :
   • Pays: Bénin
   • PLATFORM_OWNER: dev@academia-hub.local
   • Nombre de tenants: 2

🏫 CSPEB-Eveil d'Afrique Education (cspeb-eveil-afrique)
   • École: Complexe Scolaire Privé Entrepreneurial et Bilingue - Eveil d'Afrique Education
   • Ville: A 500m de la RNIE 2, 1ère Von apres EPP Bèyarou
   • Année scolaire: Année scolaire 2025-2026
   • Utilisateurs: 9
   • Liste des utilisateurs:
     - Promoteur: promoteur@cspeb.bj
     - Directeur: s.akpovitohou@gmail.com
     - Secrétaire: secretaire@cspeb.bj
     - Comptable: comptable@cspeb.bj
     - Secrétaire-Comptable: secretaire.comptable@cspeb.bj
     - Censeur: censeur@cspeb.bj
     - Surveillant: surveillant@cspeb.bj
     - Enseignant 1: enseignant1@cspeb.bj
     - Enseignant 2: enseignant2@cspeb.bj

🏫 La Persévérance (la-perseverance)
   • École: La Persévérance
   • Ville: N'Dali, Bénin
   • Année scolaire: Année scolaire 2025-2026
   • Utilisateurs: 9
   • Liste des utilisateurs:
     - Promoteur: promoteur@perseverance.bj
     - Directeur: directeur@perseverance.bj
     - Secrétaire: secretaire@perseverance.bj
     - Comptable: comptable@perseverance.bj
     - Secrétaire-Comptable: secretaire.comptable@perseverance.bj
     - Censeur: censeur@perseverance.bj
     - Surveillant: surveillant@perseverance.bj
     - Enseignant 1: enseignant1@perseverance.bj
     - Enseignant 2: enseignant2@perseverance.bj

🔐 Identifiants PLATFORM_OWNER :
   Email: dev@academia-hub.local
   Password: C@ptain.Yehioracadhub2021
```

## 🔐 Identifiants de Connexion

### PLATFORM_OWNER (Accès global)
- **Email** : `dev@academia-hub.local`
- **Password** : `C@ptain.Yehioracadhub2021`

### CSPEB - Tous les utilisateurs
- **Promoteur** : `promoteur@cspeb.bj` / `promoteur123`
- **Directeur** : `s.akpovitohou@gmail.com` / `C@ptain.Yehioracadhub2021`
- **Secrétaire** : `secretaire@cspeb.bj` / `secretaire123`
- **Comptable** : `comptable@cspeb.bj` / `comptable123`
- **Secrétaire-Comptable** : `secretaire.comptable@cspeb.bj` / `seccompta123`
- **Censeur** : `censeur@cspeb.bj` / `censeur123`
- **Surveillant** : `surveillant@cspeb.bj` / `surveillant123`
- **Enseignant 1** : Matricule `EMP001` / `enseignant1@cspeb.bj` / `enseignant123`
- **Enseignant 2** : Matricule `EMP002` / `enseignant2@cspeb.bj` / `enseignant456`

### La Persévérance - Tous les utilisateurs
- **Promoteur** : `promoteur@perseverance.bj` / `promoteur123`
- **Directeur** : `directeur@perseverance.bj` / `C@ptain.Yehioracadhub2021`
- **Secrétaire** : `secretaire@perseverance.bj` / `secretaire123`
- **Comptable** : `comptable@perseverance.bj` / `comptable123`
- **Secrétaire-Comptable** : `secretaire.comptable@perseverance.bj` / `seccompta123`
- **Censeur** : `censeur@perseverance.bj` / `censeur123`
- **Surveillant** : `surveillant@perseverance.bj` / `surveillant123`
- **Enseignant 1** : Matricule `EMP001` / `enseignant1@perseverance.bj` / `enseignant123`
- **Enseignant 2** : Matricule `EMP002` / `enseignant2@perseverance.bj` / `enseignant456`

## ✅ Vérification

### 1. Vérifier que les tenants existent

```bash
cd apps/api-server
npx prisma studio
```

Ouvrir `http://localhost:5555` et vérifier :
- Table `Tenant` : Doit contenir les 2 tenants
- Table `School` : Doit contenir les 2 écoles
- Table `User` : Doit contenir tous les utilisateurs (19 utilisateurs : 1 PLATFORM_OWNER + 9 par tenant × 2)
- Table `Teacher` : Doit contenir 4 enseignants (2 par tenant)
- Table `SchoolLevel` : Doit contenir 6 niveaux (3 par tenant)
- Table `AcademicYear` : Doit contenir 2 années (1 par tenant, 2025-2026)

### 2. Vérifier via SQL

```sql
-- Vérifier les tenants
SELECT id, name, slug, subdomain, status FROM "Tenant" ORDER BY name;

-- Vérifier les écoles
SELECT s.id, s.name, s."tenantId", t.name as tenant_name 
FROM "School" s 
JOIN "Tenant" t ON s."tenantId" = t.id 
ORDER BY t.name;

-- Vérifier les utilisateurs par tenant
SELECT u.email, u.role, t.name as tenant_name 
FROM "User" u 
LEFT JOIN "Tenant" t ON u."tenantId" = t.id 
ORDER BY t.name, u.role;

-- Vérifier les enseignants
SELECT t.matricule, t."firstName", t."lastName", t.email, tn.name as tenant_name
FROM "Teacher" t
JOIN "Tenant" tn ON t."tenantId" = tn.id
ORDER BY tn.name, t.matricule;
```

### 3. Tester la recherche d'écoles

Après avoir redémarré l'API backend :

```bash
# Tester l'endpoint de liste
curl http://localhost:3000/api/public/schools/list

# Devrait retourner un tableau avec les 2 écoles
```

### 4. Tester depuis le frontend

1. Aller sur `http://localhost:3001/portal`
2. Sélectionner un type de portail (École, Enseignant, Parent)
3. Le sélecteur devrait maintenant afficher les 2 écoles :
   - CSPEB-Eveil d'Afrique Education (Parakou)
   - La Persévérance (N'Dali)
4. Rechercher "cspeb" ou "perseverance" → devrait trouver les écoles

## 🔧 Dépannage

### Erreur : "Can't reach database server"
- Vérifier que PostgreSQL est démarré
- Vérifier les variables d'environnement dans `.env`
- Tester la connexion : `npm run test:db`

### Erreur : "Country not found"
- Le script crée automatiquement le pays Bénin
- Si l'erreur persiste, vérifier la connexion à la base de données

### Aucune école dans le sélecteur
- Vérifier que l'API backend est démarrée
- Vérifier que la route `/api/public/schools/list` fonctionne
- Vérifier les logs de l'API pour les erreurs

### Utilisateurs non créés
- Vérifier que les mots de passe sont correctement hashés
- Vérifier que les emails sont uniques (pas de doublons)
- Vérifier les logs du script pour les erreurs spécifiques

## 📝 Notes

- **Année scolaire** : Fixée à **2025-2026** (comme demandé)
- **Mots de passe** : Hashés avec bcrypt (10 rounds)
- **Enseignants** : Créés avec le niveau PRIMAIRE par défaut
- **PLATFORM_OWNER** : Créé sans tenantId (accès global)
- Le script peut être exécuté plusieurs fois sans problème

## 🎯 Prochaines Étapes

Après avoir exécuté le script :

1. ✅ Redémarrer l'API backend (si nécessaire)
2. ✅ Vérifier que le sélecteur charge les 2 écoles
3. ✅ Tester le login avec différents utilisateurs
4. ✅ Vérifier que chaque utilisateur a accès uniquement à son tenant
