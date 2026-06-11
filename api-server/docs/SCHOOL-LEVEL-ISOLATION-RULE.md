# 🎓 RÈGLE STRUCTURANTE : ISOLATION DES NIVEAUX SCOLAIRES

## 📋 PRINCIPE FONDAMENTAL

**Les niveaux scolaires (Maternelle, Primaire, Secondaire) sont des DOMAINES MÉTIER AUTONOMES qui ne doivent JAMAIS être mélangés.**

Cette règle est **NON NÉGOCIABLE** et **VERROUILLÉE** dans toute l'architecture.

---

## 🔒 MÉCANISMES DE PROTECTION

### 1. Guard : SchoolLevelIsolationGuard

**Rôle :** Bloque toute requête sans `school_level_id` explicite

**Règles appliquées :**
- ✅ `school_level_id` OBLIGATOIRE pour toutes les opérations métier
- ✅ Empêche le mélange de niveaux
- ✅ Journalise toutes les tentatives de violation
- ✅ Autorise cross-level UNIQUEMENT pour Module Général

**Fichier :** `apps/api-server/src/common/guards/school-level-isolation.guard.ts`

### 2. Interceptor : SchoolLevelEnforcementInterceptor

**Rôle :** Force l'injection de `school_level_id` dans toutes les requêtes

**Règles appliquées :**
- ✅ Force `school_level_id` dans le body (CREATE/UPDATE)
- ✅ Force `school_level_id` dans les query params
- ✅ Empêche la modification de `school_level_id`
- ✅ Bloque les tentatives de mélange

**Fichier :** `apps/api-server/src/common/interceptors/school-level-enforcement.interceptor.ts`

### 3. Décorateur : @AllowCrossLevel()

**Rôle :** Autorise explicitement les opérations cross-level

**Utilisation :** UNIQUEMENT sur les endpoints du Module Général

**Fichier :** `apps/api-server/src/common/decorators/allow-cross-level.decorator.ts`

---

## 📊 MODULE GÉNÉRAL

### Principe

Le **Module Général** est le SEUL endroit autorisé pour les agrégations cross-level.

**Règles strictes :**
- ✅ Lecture seule
- ✅ Aucune écriture en base métier
- ✅ Agrégations explicites et traçables
- ✅ Provenance documentée niveau par niveau

### Endpoints

- `GET /api/general/enrollment` - Effectif total (somme par niveau)
- `GET /api/general/revenue` - Recettes totales (somme par niveau)
- `GET /api/general/weighted-average` - Moyenne pondérée (par effectif)
- `GET /api/general/consolidated-report` - Rapport consolidé

### Exemple de Réponse

```json
{
  "total": 450,
  "byLevel": [
    {
      "levelId": "uuid-maternelle",
      "levelName": "Maternelle",
      "value": 120
    },
    {
      "levelId": "uuid-primaire",
      "levelName": "Primaire",
      "value": 200
    },
    {
      "levelId": "uuid-secondaire",
      "levelName": "Secondaire",
      "value": 130
    }
  ],
  "metadata": {
    "calculationDate": "2024-01-15T10:30:00Z",
    "levelsIncluded": ["uuid-maternelle", "uuid-primaire", "uuid-secondaire"],
    "calculationMethod": "SUM_BY_LEVEL"
  }
}
```

---

## 🚫 INTERDICTIONS STRICTES

### ❌ INTERDIT : Calculs cross-level directs

```typescript
// ❌ MAUVAIS
SELECT AVG(score) FROM grades WHERE tenant_id = 'xxx';
// → Mélange Maternelle + Primaire + Secondaire

// ✅ BON
SELECT AVG(score) FROM grades 
WHERE tenant_id = 'xxx' AND school_level_id = 'uuid-primaire';
// → Primaire uniquement
```

### ❌ INTERDIT : Requêtes sans school_level_id

```typescript
// ❌ MAUVAIS
async findAll(tenantId: string) {
  return this.repository.find({ where: { tenantId } });
}

// ✅ BON
async findAll(tenantId: string, schoolLevelId: string) {
  return this.repository.find({ 
    where: { tenantId, schoolLevelId } 
  });
}
```

### ❌ INTERDIT : Modifications cross-level

```typescript
// ❌ MAUVAIS
await this.repository.update(
  { tenantId },
  { status: 'active' }
);
// → Modifie tous les niveaux

// ✅ BON
await this.repository.update(
  { tenantId, schoolLevelId },
  { status: 'active' }
);
// → Modifie uniquement le niveau spécifié
```

---

## ✅ EXEMPLES CORRECTS

### Repository

```typescript
@Injectable()
export class StudentsRepository {
  async findAll(
    tenantId: string,
    schoolLevelId: string, // OBLIGATOIRE
    filters?: any,
  ): Promise<Student[]> {
    const where: any = { tenantId, schoolLevelId }; // TOUJOURS filtrer par niveau
    // ... filtres additionnels
    return this.repository.find({ where });
  }
}
```

### Service

```typescript
@Injectable()
export class StudentsService {
  async findAll(
    tenantId: string,
    schoolLevelId: string, // OBLIGATOIRE
  ): Promise<Student[]> {
    return this.repository.findAll(tenantId, schoolLevelId);
  }
}
```

### Controller

```typescript
@Controller('students')
export class StudentsController {
  @Get()
  findAll(
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string, // OBLIGATOIRE
  ) {
    return this.service.findAll(tenantId, schoolLevelId);
  }
}
```

---

## 🔍 VÉRIFICATION DES TABLES

### Tables qui DOIVENT avoir school_level_id

- ✅ `students`
- ✅ `classes`
- ✅ `subjects`
- ✅ `exams`
- ✅ `grades`
- ✅ `absences`
- ✅ `discipline_records`
- ✅ `payments`
- ✅ `expenses`
- ✅ `announcements`
- ✅ `teachers` (assignation par niveau)
- ✅ `schedules` (emploi du temps)
- ✅ `staff_assignments`

### Vérification SQL

```sql
-- Vérifier qu'aucune table métier n'a de lignes sans school_level_id
SELECT 
  'students' as table_name,
  COUNT(*) as rows_without_level
FROM students
WHERE tenant_id = 'xxx' AND school_level_id IS NULL

UNION ALL

SELECT 
  'classes' as table_name,
  COUNT(*) as rows_without_level
FROM classes
WHERE tenant_id = 'xxx' AND school_level_id IS NULL;

-- Résultat attendu : 0 pour toutes les tables
```

---

## 📝 JOURNALISATION DES VIOLATIONS

Toutes les tentatives de violation sont journalisées dans `audit_logs` :

```typescript
{
  "action": "SCHOOL_LEVEL_VIOLATION_ATTEMPT",
  "resource": "guard",
  "changes": {
    "endpoint": "/api/students",
    "method": "GET",
    "reason": "Missing school_level_id"
  }
}
```

---

## 🎯 INTÉGRATION ORION & ATLAS

### ORION

- ✅ Analyse les données PAR NIVEAU
- ✅ Produit des rapports distincts (Maternelle, Primaire, Secondaire)
- ✅ Peut produire une synthèse globale UNIQUEMENT via Module Général

### ATLAS

- ✅ Respecte le contexte de niveau
- ✅ Ne suggère aucune action cross-niveau
- ✅ Guide les utilisateurs sans jamais mélanger les données

---

## ✅ CHECKLIST DE CONFORMITÉ

Pour chaque nouveau module/endpoint :

- [ ] `school_level_id` est OBLIGATOIRE dans tous les DTOs
- [ ] Repository filtre TOUJOURS par `school_level_id`
- [ ] Service exige explicitement `school_level_id`
- [ ] Controller utilise `@SchoolLevelId()` decorator
- [ ] Aucun calcul cross-level direct
- [ ] Agrégations uniquement via Module Général
- [ ] Tests vérifient l'isolation

---

## 🏁 CONCLUSION

Cette règle est **VERROUILLÉE** dans l'architecture via :

1. ✅ **Guard** : Bloque les violations
2. ✅ **Interceptor** : Force l'injection
3. ✅ **Module Général** : Agrégations contrôlées
4. ✅ **Audit** : Journalisation complète

**Aucune violation n'est possible sans être détectée et bloquée.**

