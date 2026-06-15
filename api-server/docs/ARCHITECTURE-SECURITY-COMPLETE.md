# 🏛️ ARCHITECTURE SÉCURITÉ COMPLÈTE - ACADEMIA HUB

## ✅ STATUT : PROTECTION MULTI-COUCHES VERROUILLÉE

L'architecture de sécurité d'Academia Hub est **DÉFINITIVEMENT VERROUILLÉE** avec une protection **MULTI-COUCHES**.

---

## 🛡️ PROTECTION MULTI-COUCHES

### Couche 1 : Backend Guards & Interceptors ✅

**Rôle :** Première ligne de défense au niveau application

**Mécanismes :**
- ✅ `TenantIsolationGuard` - Isolation multi-tenant
- ✅ `SchoolLevelIsolationGuard` - Isolation des niveaux scolaires
- ✅ `AcademicYearEnforcementGuard` - Enforcement année scolaire
- ✅ `SchoolLevelEnforcementInterceptor` - Injection automatique
- ✅ `AcademicYearEnforcementInterceptor` - Injection automatique
- ✅ `ContextValidationGuard` - Validation du contexte complet

**Fichiers :**
- `apps/api-server/src/common/guards/`
- `apps/api-server/src/common/interceptors/`

### Couche 2 : Contraintes SQL ✅

**Rôle :** Deuxième ligne de défense au niveau base de données

**Mécanismes :**
- ✅ **Foreign Keys** - Intégrité référentielle
  - `ON DELETE CASCADE` pour tenant
  - `ON DELETE RESTRICT` pour année/niveau/track
- ✅ **CHECK Constraints** - Intégrité métier
  - Codes de niveaux autorisés
  - Codes de tracks autorisés
  - Séparation des flux financiers
  - Montants positifs
- ✅ **UNIQUE Constraints** - Unicité
  - Une seule année active par tenant

**Fichier :** `apps/api-server/migrations/004_database_constraints_and_triggers.sql`

### Couche 3 : Triggers SQL ✅

**Rôle :** Enforcement automatique au niveau base de données

**Mécanismes :**
- ✅ `enforce_tenant()` - Force tenant_id
- ✅ `enforce_academic_year()` - Force academic_year_id
- ✅ `enforce_school_level()` - Force school_level_id
- ✅ `audit_trigger()` - Journalisation automatique

**Fichier :** `apps/api-server/migrations/004_database_constraints_and_triggers.sql`

### Couche 4 : Audit Trail ✅

**Rôle :** Traçabilité complète de toutes les actions

**Mécanismes :**
- ✅ Table `audit_logs` avec historique complet
- ✅ Triggers automatiques sur tables critiques
- ✅ Contexte utilisateur (IP, User-Agent) capturé

**Fichier :** `apps/api-server/migrations/004_database_constraints_and_triggers.sql`

---

## 📊 FLUX D'EXÉCUTION COMPLET

### Lors d'une requête HTTP

```
1. Request arrive
   ↓
2. ContextInterceptor
   → Résout le contexte (tenant, academic_year, school_level, module)
   ↓
3. TenantIsolationGuard
   → Vérifie l'isolation par tenant
   ↓
4. SchoolLevelIsolationGuard
   → Vérifie l'isolation des niveaux
   ↓
5. AcademicYearEnforcementGuard
   → Vérifie l'année scolaire obligatoire
   ↓
6. SchoolLevelEnforcementInterceptor
   → Force l'injection de school_level_id
   ↓
7. AcademicYearEnforcementInterceptor
   → Force l'injection de academic_year_id
   ↓
8. Controller/Service/Repository
   → Exécute la logique métier
   ↓
9. Database (PostgreSQL)
   ↓
10. Trigger BEFORE : enforce_tenant()
    → Vérifie tenant_id
    ↓
11. Trigger BEFORE : enforce_academic_year()
    → Vérifie academic_year_id
    ↓
12. Trigger BEFORE : enforce_school_level()
    → Vérifie school_level_id
    ↓
13. CHECK Constraints
    → Vérifie les valeurs
    ↓
14. FOREIGN KEY Constraints
    → Vérifie les références
    ↓
15. INSERT/UPDATE/DELETE effectué
    ↓
16. Trigger AFTER : audit_trigger()
    → Journalise dans audit_logs
    ↓
17. Response retournée
```

---

## 🔑 DIMENSIONS FONDAMENTALES

### Hiérarchie

```
TENANT (Établissement)
  └── ACADEMIC_YEAR (Année scolaire)
        └── SCHOOL_LEVEL (Maternelle | Primaire | Secondaire)
              └── ACADEMIC_TRACK (FR | EN) [Optionnel]
```

### Protection par dimension

| Dimension | Guard | Interceptor | Foreign Key | Trigger | CHECK |
|-----------|-------|-------------|-------------|---------|-------|
| `tenant_id` | ✅ | ✅ | ✅ CASCADE | ✅ | - |
| `academic_year_id` | ✅ | ✅ | ✅ RESTRICT | ✅ | ✅ Unique active |
| `school_level_id` | ✅ | ✅ | ✅ RESTRICT | ✅ | ✅ Codes autorisés |
| `academic_track_id` | - | - | ✅ RESTRICT | - | ✅ Codes autorisés |

---

## 🚫 EXEMPLES DE PROTECTION

### Tentative 1 : Requête sans tenant_id

```typescript
// ❌ BLOQUÉ PAR TenantIsolationGuard
GET /api/students

// Réponse :
ForbiddenException: "Tenant ID is required"
```

### Tentative 2 : Requête sans academic_year_id

```typescript
// ❌ BLOQUÉ PAR AcademicYearEnforcementGuard
GET /api/students?schoolLevelId=uuid-primaire

// Réponse :
BadRequestException: "Academic Year ID is MANDATORY"
```

### Tentative 3 : Tentative d'insertion sans academic_year_id (bypass backend)

```sql
-- ❌ BLOQUÉ PAR TRIGGER SQL
INSERT INTO students (tenant_id, school_level_id, first_name, last_name)
VALUES ('uuid-tenant', 'uuid-level', 'Test', 'Student');

-- Réponse :
ERROR: academic_year_id is mandatory for table students
```

### Tentative 4 : Tentative de mélange de niveaux

```typescript
// ❌ BLOQUÉ PAR SchoolLevelIsolationGuard
POST /api/students
Header: X-School-Level-ID: uuid-maternelle
Body: { schoolLevelId: "uuid-primaire", ... }

// Réponse :
ForbiddenException: "Cannot mix school levels"
```

### Tentative 5 : Tentative de détournement de flux financier

```sql
-- ❌ BLOQUÉ PAR CHECK CONSTRAINT
INSERT INTO payment_flows (flow_type, destination, ...)
VALUES ('SAAS', 'SCHOOL', ...);

-- Réponse :
ERROR: new row for relation "payment_flows" violates check constraint "chk_payment_flow_type"
```

### Tentative 6 : Tentative de suppression d'année scolaire utilisée

```sql
-- ❌ BLOQUÉ PAR FOREIGN KEY RESTRICT
DELETE FROM academic_years WHERE id = 'uuid-year-used';

-- Réponse :
ERROR: update or delete on table "academic_years" violates foreign key constraint
```

---

## 📋 AUDIT TRAIL

### Table audit_logs

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID,
  action VARCHAR(50) NOT NULL,      -- INSERT, UPDATE, DELETE
  resource VARCHAR(100) NOT NULL,    -- Nom de la table
  resource_id UUID,                  -- ID de l'enregistrement
  changes JSONB,                     -- { old: {...}, new: {...} }
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Exemple d'entrée d'audit

```json
{
  "id": "uuid-audit-log",
  "tenant_id": "uuid-tenant",
  "user_id": "uuid-user",
  "action": "UPDATE",
  "resource": "students",
  "resource_id": "uuid-student",
  "changes": {
    "old": {
      "first_name": "Jean",
      "last_name": "Dupont"
    },
    "new": {
      "first_name": "Jean",
      "last_name": "Martin"
    }
  },
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Tables auditées

- ✅ `students`
- ✅ `payments`
- ✅ `expenses`
- ✅ `grades`
- ✅ `exams`
- ✅ `fee_configurations`

---

## 🧠 ORION & ATLAS

### ORION - Accès READ ONLY

**Protection :**
- ✅ Accès UNIQUEMENT via vues en lecture seule
- ✅ Aucune permission INSERT/UPDATE/DELETE
- ✅ Guards backend vérifient le rôle ORION
- ✅ Triggers SQL bloquent toute écriture

**Vue disponible :**
```sql
SELECT * FROM v_orion_stats_by_level_year
WHERE tenant_id = 'uuid-tenant'
  AND academic_year_id = 'uuid-year';
```

### ATLAS - Respect des permissions

**Protection :**
- ✅ Respecte les permissions utilisateur
- ✅ Jamais d'accès direct aux tables sensibles
- ✅ Aucune action financière directe
- ✅ Guards backend vérifient le rôle ATLAS

---

## ✅ CHECKLIST DE CONFORMITÉ

### Backend

- [x] Guards globaux actifs
- [x] Interceptors globaux actifs
- [x] Décorateurs pour extraction des dimensions
- [x] Services exigent toutes les dimensions
- [x] Repositories filtrent par toutes les dimensions

### Base de données

- [x] Foreign Keys sur toutes les tables métier
- [x] CHECK Constraints pour intégrité métier
- [x] Triggers BEFORE pour enforcement
- [x] Triggers AFTER pour audit
- [x] Index pour performance
- [x] Vues en lecture seule pour ORION

### Documentation

- [x] Documentation complète des guards/interceptors
- [x] Documentation complète des contraintes SQL
- [x] Documentation complète de l'audit trail
- [x] Exemples de protection
- [x] Checklist de conformité

---

## 🏁 CONCLUSION

**L'architecture de sécurité est DÉFINITIVEMENT VERROUILLÉE avec protection MULTI-COUCHES.**

**Aucune violation n'est possible sans être :**
1. ✅ Détectée par les Guards backend
2. ✅ Bloquée par les contraintes SQL
3. ✅ Journalisée dans audit_logs

**Le système est prêt pour :**
- ✅ Audit institutionnel
- ✅ Conformité réglementaire
- ✅ Traçabilité complète
- ✅ Intégrité des données garantie
- ✅ Long terme sans dette technique

---

**Date de validation :** $(date)
**Statut :** ✅ VALIDÉ - ARCHITECTURE SÉCURITÉ VERROUILLÉE DÉFINITIVEMENT

