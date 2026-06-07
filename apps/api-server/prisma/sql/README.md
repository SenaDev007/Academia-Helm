# 🔧 Triggers SQL Critiques - Academia Hub

**Dossier** : `apps/api-server/prisma/sql/`  
**Statut** : ✅ **Scripts SQL prêts à exécuter**

---

## 📋 Fichiers

### 1. `functions.sql`
Fonctions helper pour les triggers :
- `check_payment_allocation_priority()` - Vérifie priorité allocation paiement
- `check_student_fee_profile_exists()` - Vérifie profil tarifaire élève
- `prevent_payment_deletion()` - Empêche suppression paiement
- `ensure_student_fee_profile_before_fee()` - Oblige profil avant frais

### 2. `triggers.sql`
Triggers appliquant les règles métier :
- **Priorité paiement arriérés** : Garantit que les arriérés ont toujours ordre 1
- **Interdiction suppression paiements** : Empêche suppression si allocations/reçu
- **Obligation profil tarifaire** : Vérifie profil avant création StudentFee

---

## 🚀 Application

### Étape 1 : Créer les fonctions

Dans pgAdmin Query Tool :

1. Ouvrir le fichier `prisma/sql/functions.sql`
2. Exécuter (F5)

**Résultat attendu** : 4 fonctions créées sans erreur.

### Étape 2 : Créer les triggers

Dans pgAdmin Query Tool :

1. Ouvrir le fichier `prisma/sql/triggers.sql`
2. Exécuter (F5)

**Résultat attendu** : 3 triggers créés sans erreur.

---

## ✅ Règles Métier Implémentées

### 1. Priorité Paiement Arriérés

**Règle** : Les arriérés (`targetType = 'ARREAR'`) ont **toujours** priorité maximale (`allocationOrder = 1`).

**Vérifications** :
- ✅ ARREAR → `allocationOrder` doit être `1`
- ✅ Non-ARREAR → `allocationOrder` doit être `>= 2`
- ✅ Pas de non-ARREAR avec ordre `1` si ARREAR existe

**Exemple d'erreur** :
```sql
-- ❌ Erreur : ARREAR avec ordre 2
INSERT INTO payment_allocations ("targetType", "allocationOrder", ...)
VALUES ('ARREAR', 2, ...);

-- ❌ Erreur : Non-ARREAR avec ordre 1 alors qu'un ARREAR existe
INSERT INTO payment_allocations ("targetType", "allocationOrder", ...)
VALUES ('STUDENT_FEE', 1, ...);
```

---

### 2. Interdiction Suppression Paiements

**Règle** : Un paiement avec allocations ou reçu **ne peut pas être supprimé**.

**Vérifications** :
- ✅ Vérifie présence d'allocations (`payment_allocations`)
- ✅ Vérifie présence de reçu (`payment_receipts`)
- ✅ Empêche DELETE si l'un des deux existe

**Exemple d'erreur** :
```sql
-- ❌ Erreur : Paiement avec allocations
DELETE FROM payments WHERE id = 'payment-with-allocations';

-- ❌ Erreur : Paiement avec reçu
DELETE FROM payments WHERE id = 'payment-with-receipt';
```

**Alternative** : Utiliser soft delete (mettre `status = 'CANCELLED'`) au lieu de DELETE.

---

### 3. Obligation Profil Tarifaire Élève

**Règle** : Un `StudentFee` ne peut être créé que si l'élève a un `StudentFeeProfile` pour l'année scolaire.

**Vérifications** :
- ✅ Avant INSERT dans `student_fees`
- ✅ Vérifie existence `student_fee_profiles` pour `studentId` + `academicYearId`
- ✅ Empêche création si profil manquant

**Exemple d'erreur** :
```sql
-- ❌ Erreur : Pas de profil tarifaire pour cet élève/année
INSERT INTO student_fees ("studentId", "academicYearId", ...)
VALUES ('student-without-profile', 'academic-year-id', ...);
```

**Solution** : Créer d'abord le `StudentFeeProfile` :
```sql
-- ✅ Créer profil d'abord
INSERT INTO student_fee_profiles ("studentId", "academicYearId", "feeRegimeId", ...)
VALUES ('student-id', 'academic-year-id', 'standard-regime-id', ...);

-- ✅ Puis créer StudentFee
INSERT INTO student_fees ("studentId", "academicYearId", ...)
VALUES ('student-id', 'academic-year-id', ...);
```

---

## 🧪 Tests

### Test 1 : Priorité Arriérés

```sql
-- ❌ Devrait échouer : ARREAR avec ordre 2
INSERT INTO payment_allocations (
  "id", "paymentId", "targetType", "targetId", 
  "allocatedAmount", "allocationOrder"
)
VALUES (
  'test-1', 'payment-id', 'ARREAR', 'arrear-id', 
  100.00, 2
);
-- Erreur attendue : "Les arriérés doivent avoir allocationOrder = 1"
```

### Test 2 : Interdiction Suppression

```sql
-- ❌ Devrait échouer : Suppression paiement avec allocations
DELETE FROM payments 
WHERE id = (SELECT "paymentId" FROM payment_allocations LIMIT 1);
-- Erreur attendue : "Impossible de supprimer le paiement. Il a X allocation(s)..."
```

### Test 3 : Obligation Profil

```sql
-- ❌ Devrait échouer : StudentFee sans profil
INSERT INTO student_fees (
  "id", "tenantId", "studentId", "feeDefinitionId", 
  "academicYearId", "totalAmount"
)
VALUES (
  'test-1', 'tenant-id', 'student-without-profile', 
  'fee-def-id', 'academic-year-id', 100.00
);
-- Erreur attendue : "Impossible de créer un StudentFee sans profil tarifaire..."
```

---

## ✅ Vérification Post-Installation

### Vérifier les fonctions créées

```sql
SELECT 
  proname as function_name,
  n.nspname as schema_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND proname IN (
  'check_payment_allocation_priority',
  'check_student_fee_profile_exists',
  'prevent_payment_deletion',
  'ensure_student_fee_profile_before_fee'
)
ORDER BY proname;
```

**Résultat attendu** : 4 fonctions listées.

### Vérifier les triggers créés

```sql
SELECT 
  trigger_name,
  event_object_table as table_name,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND trigger_name LIKE 'trigger_%'
ORDER BY table_name, trigger_name;
```

**Résultat attendu** : 3 triggers listés :
- `trigger_check_payment_allocation_priority` sur `payment_allocations`
- `trigger_prevent_payment_deletion` sur `payments`
- `trigger_ensure_student_fee_profile_before_fee` sur `student_fees`

---

## 📊 Impact

### Tables Protégées

| Table | Trigger | Règle Métier |
|-------|---------|--------------|
| `payment_allocations` | `trigger_check_payment_allocation_priority` | Priorité arriérés |
| `payments` | `trigger_prevent_payment_deletion` | Interdiction suppression |
| `student_fees` | `trigger_ensure_student_fee_profile_before_fee` | Obligation profil |

---

## ⚠️ Notes Importantes

1. **Idempotent** : Les scripts peuvent être relancés plusieurs fois sans erreur (`DROP TRIGGER IF EXISTS`).

2. **Ordre d'exécution** : Toujours exécuter `functions.sql` **avant** `triggers.sql`.

3. **Pas de modifications destructives** : Ces scripts n'utilisent pas `DROP TABLE` ni `ALTER` destructif.

4. **PostgreSQL standard** : Utilise uniquement des fonctionnalités PostgreSQL standard (pas de dépendances externes).

---

**Les scripts SQL sont prêts à être exécutés dans pgAdmin !** ✅
