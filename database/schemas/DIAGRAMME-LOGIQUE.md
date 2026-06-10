# 📊 DIAGRAMME LOGIQUE - BASE DE DONNÉES POSTGRESQL MULTI-TENANT

## 🎯 Vue d'ensemble

Ce document présente le diagramme logique de la base de données PostgreSQL multi-tenant d'Academia Hub.

---

## 🏗️ Architecture générale

```
┌─────────────────────────────────────────────────────────────────┐
│                    COUCHE SAAS (Multi-tenant)                    │
├─────────────────────────────────────────────────────────────────┤
│  countries ──┐                                                  │
│              │                                                   │
│  tenants ────┼──► country_id (OBLIGATOIRE)                      │
│              │                                                   │
│  users ──────┼──► tenant_id                                      │
│  roles ──────┼──► tenant_id (nullable pour rôles globaux)      │
│  permissions │                                                   │
│  audit_logs ─┼──► tenant_id                                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              COUCHE MÉTIER (Isolation par tenant)                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ACADÉMIQUES                                                      │
│  ├── academic_years ──► tenant_id                                │
│  ├── quarters ────────► tenant_id + academic_year_id            │
│  └── schools ─────────► tenant_id (1:1)                          │
│                                                                   │
│  PÉDAGOGIQUES                                                     │
│  ├── classes ────────► tenant_id + academic_year_id             │
│  ├── subjects ───────► tenant_id                                │
│  ├── students ───────► tenant_id + class_id                     │
│  ├── teachers ───────► tenant_id + department_id                │
│  ├── departments ────► tenant_id                                │
│  └── rooms ──────────► tenant_id                                │
│                                                                   │
│  PRÉSENCE & DISCIPLINE                                            │
│  ├── absences ───────► tenant_id + student_id                   │
│  └── discipline ─────► tenant_id + student_id                   │
│                                                                   │
│  ÉVALUATION                                                       │
│  ├── exams ──────────► tenant_id + class_id + subject_id         │
│  └── grades ─────────► tenant_id + student_id + exam_id          │
│                                                                   │
│  FINANCE                                                          │
│  ├── fee_configurations ──► tenant_id + class_id                │
│  ├── payments ─────────────► tenant_id + student_id              │
│  └── expenses ─────────────► tenant_id                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              COUCHE POLICIES (Architecture Policy-Driven)        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  grading_policies ──► country_id + education_level              │
│  salary_policies ───► country_id                                 │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔗 Relations principales

### 1. Hiérarchie Multi-tenant

```
countries (1)
  └── tenants (N) ──► country_id (OBLIGATOIRE)
        └── users (N) ──► tenant_id
        └── [toutes les tables métier] ──► tenant_id
```

### 2. Relations académiques

```
academic_years (1)
  └── quarters (N) ──► academic_year_id
  └── classes (N) ──► academic_year_id
  └── subjects (N) ──► academic_year_id
  └── exams (N) ──► academic_year_id
  └── grades (N) ──► academic_year_id
```

### 3. Relations pédagogiques

```
classes (1)
  └── students (N) ──► class_id
  └── exams (N) ──► class_id
  └── grades (N) ──► class_id

subjects (1)
  └── grades (N) ──► subject_id
  └── exams (N) ──► subject_id

students (1)
  └── absences (N) ──► student_id
  └── discipline (N) ──► student_id
  └── grades (N) ──► student_id
  └── payments (N) ──► student_id

teachers (1)
  └── classes.main_teacher_id (1) ──► main_teacher_id
  └── departments.manager_id (1) ──► manager_id

departments (1)
  └── teachers (N) ──► department_id
```

### 4. Relations financières

```
fee_configurations (1)
  └── payments (N) ──► fee_configuration_id

students (1)
  └── payments (N) ──► student_id
```

### 5. Relations policies

```
countries (1)
  └── grading_policies (N) ──► country_id
  └── salary_policies (N) ──► country_id
```

---

## 🔒 Isolation par tenant

### Principe

**TOUTES les tables métier** ont un `tenant_id` qui :
- ✅ Est **OBLIGATOIRE** (NOT NULL)
- ✅ A une **contrainte de clé étrangère** vers `tenants(id)`
- ✅ Est **indexé** pour performance
- ✅ Est utilisé dans **toutes les requêtes** pour isolation

### Row-Level Security (RLS)

Toutes les tables métier ont RLS activé avec la politique :

```sql
CREATE POLICY {table}_tenant_isolation ON {table}
    FOR ALL USING (tenant_id = get_current_tenant_id());
```

---

## 📊 Index stratégiques

### Index par tenant (performance)

Toutes les tables métier ont au minimum :
- `idx_{table}_tenant` sur `(tenant_id)`
- Index composites sur `(tenant_id, {colonne_frequente})`

### Index spécifiques

- **Recherche textuelle** : `pg_trgm` sur noms, emails
- **JSONB** : Index GIN sur colonnes JSONB (equipment, settings, metadata)
- **Dates** : Index sur colonnes de dates pour requêtes temporelles
- **Statuts** : Index partiels sur statuts actifs (`WHERE status = 'active'`)

---

## 🎯 Contraintes d'intégrité

### Contraintes de domaine

- `CHECK` sur statuts (active, inactive, etc.)
- `CHECK` sur montants (`amount > 0`)
- `CHECK` sur dates (`end_date > start_date`)
- `CHECK` sur scores (`score >= 0 AND score <= max_score`)

### Contraintes d'unicité

- `UNIQUE (tenant_id, {colonne})` pour garantir l'unicité par tenant
- `UNIQUE (tenant_id, name, academic_year_id)` pour classes
- `UNIQUE (tenant_id, educmaster_number)` pour students

### Contraintes de clés étrangères

- **CASCADE** : Suppression en cascade pour relations dépendantes
- **SET NULL** : Mise à NULL pour relations optionnelles
- **RESTRICT** : Empêche la suppression si référencé (countries → tenants)

---

## 🔄 Synchronisation future

### Colonnes préparées

Toutes les tables ont :
- `created_at` : Timestamp de création
- `updated_at` : Timestamp de mise à jour (auto via trigger)
- `created_by` : UUID de l'utilisateur créateur

### Tables d'audit

- `audit_logs` : Logs complets de toutes les actions
- Champs JSONB pour stocker les changements (avant/après)

### Préparation offline

- Colonnes `sync_status` peuvent être ajoutées si nécessaire
- Colonnes `last_sync_at` pour tracking de synchronisation
- Colonnes `sync_id` pour identification unique des syncs

---

## 📈 Performance

### Stratégies d'indexation

1. **Index B-tree** : Colonnes fréquemment filtrées (tenant_id, dates, statuts)
2. **Index GIN** : Colonnes JSONB (equipment, settings, metadata)
3. **Index partiels** : Sur statuts actifs uniquement (`WHERE status = 'active'`)
4. **Index composites** : Sur combinaisons fréquentes (tenant_id + date, tenant_id + status)

### Partitionnement (futur)

Les tables volumineuses peuvent être partitionnées par :
- `tenant_id` (si multi-tenant avec beaucoup de tenants)
- `created_at` (par année/mois pour audit_logs, payments)

---

## 🎓 Exemples de requêtes

### Requête avec isolation tenant

```sql
-- Récupérer tous les étudiants actifs d'un tenant
SELECT * FROM students
WHERE tenant_id = 'tenant-uuid'
  AND enrollment_status = 'active'
ORDER BY last_name, first_name;
```

### Requête avec jointures tenant-safe

```sql
-- Récupérer les notes d'un étudiant avec isolation tenant
SELECT 
    g.score,
    g.max_score,
    s.name AS subject_name,
    e.name AS exam_name
FROM grades g
INNER JOIN subjects s ON s.id = g.subject_id AND s.tenant_id = g.tenant_id
LEFT JOIN exams e ON e.id = g.exam_id AND e.tenant_id = g.tenant_id
WHERE g.tenant_id = 'tenant-uuid'
  AND g.student_id = 'student-uuid'
ORDER BY g.created_at DESC;
```

### Requête avec policy

```sql
-- Calculer la moyenne d'un étudiant selon la policy du pays
SELECT 
    s.id,
    s.first_name || ' ' || s.last_name AS student_name,
    AVG(g.score) AS average_score,
    gp.grade_scales
FROM students s
INNER JOIN tenants t ON t.id = s.tenant_id
INNER JOIN grading_policies gp ON gp.country_id = t.country_id 
    AND gp.education_level = 'primary' 
    AND gp.is_default = TRUE
INNER JOIN grades g ON g.student_id = s.id AND g.tenant_id = s.tenant_id
WHERE s.tenant_id = 'tenant-uuid'
  AND s.id = 'student-uuid'
GROUP BY s.id, s.first_name, s.last_name, gp.grade_scales;
```

---

## 📝 Résumé

### Tables SaaS : 7
- countries, tenants, users, roles, permissions, role_permissions, user_roles, audit_logs

### Tables métier : 17
- Académiques : academic_years, quarters, schools
- Pédagogiques : classes, subjects, students, teachers, departments, rooms
- Présence : absences, discipline
- Évaluation : exams, grades
- Finance : fee_configurations, payments, expenses

### Tables policies : 2
- grading_policies, salary_policies

### Total : 26 tables principales

### Isolation garantie
- ✅ `tenant_id` sur toutes les tables métier
- ✅ RLS activé sur toutes les tables métier
- ✅ Index optimisés pour requêtes par tenant
- ✅ Contraintes d'intégrité strictes

---

**Date** : 2024  
**Version** : 1.0.0  
**Status** : ✅ **Schéma complet et prêt pour production**

