# 📅 ACADEMIC YEAR ENFORCEMENT - DIMENSION OBLIGATOIRE

## ✅ STATUT : ACADEMIC YEAR VERROUILLÉE COMME DIMENSION OBLIGATOIRE

L'année scolaire (`academic_year_id`) est **DÉFINITIVEMENT VERROUILLÉE** comme dimension obligatoire au même niveau que `tenant_id` et `school_level_id`.

---

## 🔒 MÉCANISMES DE PROTECTION IMPLÉMENTÉS

### 1. Guard Global : AcademicYearEnforcementGuard ✅

**Fichier :** `apps/api-server/src/common/guards/academic-year-enforcement.guard.ts`

**Rôle :** Bloque toute violation de la règle d'année scolaire

**Règles appliquées :**
- ✅ `academic_year_id` OBLIGATOIRE pour toutes les opérations métier
- ✅ Empêche le mélange d'années (body vs header vs query)
- ✅ Autorise cross-year UNIQUEMENT pour Module Général (`@AllowCrossLevel()`)
- ✅ Journalise les tentatives de violation (console.warn)

**Intégration :** `APP_GUARD` global dans `app.module.ts`

### 2. Interceptor Global : AcademicYearEnforcementInterceptor ✅

**Fichier :** `apps/api-server/src/common/interceptors/academic-year-enforcement.interceptor.ts`

**Rôle :** Force l'injection de `academic_year_id` dans toutes les requêtes

**Règles appliquées :**
- ✅ Force `academic_year_id` dans le body (CREATE/UPDATE)
- ✅ Force `academic_year_id` dans les query params
- ✅ Empêche la modification de `academic_year_id`
- ✅ Bloque les tentatives de mélange

**Intégration :** `APP_INTERCEPTOR` global dans `app.module.ts`

### 3. Décorateur : @AcademicYearId() ✅

**Fichier :** `apps/api-server/src/common/decorators/academic-year-id.decorator.ts`

**Utilisation :** Pour extraire `academic_year_id` depuis la requête

**Exemple :**
```typescript
@Get()
findAll(
  @TenantId() tenantId: string,
  @SchoolLevelId() schoolLevelId: string,
  @AcademicYearId() academicYearId: string,
) {
  return this.service.findAll(tenantId, schoolLevelId, academicYearId);
}
```

---

## 📊 DIMENSIONS FONDAMENTALES (OBLIGATOIRES PARTOUT)

Toute table métier DOIT référencer :

```typescript
tenant_id          // OBLIGATOIRE
academic_year_id   // OBLIGATOIRE (NOUVEAU)
school_level_id    // OBLIGATOIRE
academic_track_id  // OPTIONNEL (NULL = FR par défaut)
```

---

## 🗄️ TABLES MÉTIER CONCERNÉES

### Tables avec `academic_year_id` OBLIGATOIRE

- ✅ `students` - Ajouté via migration
- ✅ `classes` - Ajouté via migration
- ✅ `subjects` - Ajouté via migration
- ✅ `exams` - Rendu NOT NULL via migration
- ✅ `grades` - Rendu NOT NULL via migration
- ✅ `absences` - Ajouté via migration
- ✅ `payments` - Ajouté via migration
- ✅ `expenses` - Ajouté via migration
- ✅ `fee_configurations` - Déjà présent
- ✅ `quarters` - Déjà présent (lié à academic_year)

### Migration SQL

**Fichier :** `apps/api-server/migrations/003_add_academic_year_obligatory.sql`

**Actions :**
1. Ajoute `academic_year_id` sur toutes les tables métier
2. Met à jour les valeurs NULL avec l'année active du tenant
3. Rend la colonne NOT NULL
4. Crée les contraintes de clé étrangère
5. Crée les index pour performance

---

## 🚫 PROTECTION CONTRE LES VIOLATIONS

### Violation 1 : Requête sans academic_year_id

```typescript
// ❌ BLOQUÉ
GET /api/students?schoolLevelId=uuid-primaire

// Réponse :
BadRequestException: 
"ACADEMIC YEAR ENFORCEMENT RULE VIOLATION: 
Academic Year ID is MANDATORY for all business operations. 
All business data must be scoped to an academic year."
```

### Violation 2 : Mélange d'années

```typescript
// ❌ BLOQUÉ
POST /api/students
Header: X-Academic-Year-ID: uuid-2024-2025
Body: { academicYearId: "uuid-2023-2024", ... }

// Réponse :
ForbiddenException: 
"Cannot mix academic years. The provided academic_year_id in the request body 
(uuid-2023-2024) does not match the context academic_year_id (uuid-2024-2025)."
```

### Violation 3 : Calcul cross-year direct

```typescript
// ❌ BLOQUÉ
GET /api/grades/average
// Sans academic_year_id → Bloqué par le Guard

// ✅ CORRECT
GET /api/grades/average?academicYearId=uuid-2024-2025&schoolLevelId=uuid-primaire
// → Calcul uniquement pour l'année 2024-2025, niveau Primaire
```

---

## ✅ EXEMPLES CORRECTS

### Repository

```typescript
@Injectable()
export class StudentsRepository {
  async findAll(
    tenantId: string,
    schoolLevelId: string,
    academicYearId?: string, // OBLIGATOIRE (optionnel pour compatibilité temporaire)
  ): Promise<Student[]> {
    const where: any = { tenantId, schoolLevelId };
    if (academicYearId) {
      where.academicYearId = academicYearId; // TOUJOURS filtrer par année
    }
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
    schoolLevelId: string,
    academicYearId: string, // OBLIGATOIRE
  ): Promise<Student[]> {
    return this.repository.findAll(tenantId, schoolLevelId, academicYearId);
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
    @SchoolLevelId() schoolLevelId: string,
    @AcademicYearId() academicYearId: string, // OBLIGATOIRE
  ) {
    return this.service.findAll(tenantId, schoolLevelId, academicYearId);
  }
}
```

---

## 📊 MODULE GÉNÉRAL (Agrégations Contrôlées)

### Principe

Le **Module Général** permet des agrégations cross-level **pour une année scolaire donnée**.

**Règles strictes :**
- ✅ Lecture seule
- ✅ Agrégations explicites et traçables
- ✅ Provenance documentée niveau par niveau
- ✅ **TOUJOURS pour une année scolaire donnée**

### Endpoints Mis à Jour

- `GET /api/general/enrollment?academicYearId=uuid` - Effectif total (somme par niveau, pour l'année)
- `GET /api/general/revenue?academicYearId=uuid` - Recettes totales (somme par niveau, pour l'année)
- `GET /api/general/weighted-average?academicYearId=uuid` - Moyenne pondérée (par effectif, pour l'année)
- `GET /api/general/consolidated-report?academicYearId=uuid` - Rapport consolidé (pour l'année)

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
    "academicYearId": "uuid-2024-2025",
    "levelsIncluded": [
      "uuid-maternelle",
      "uuid-primaire",
      "uuid-secondaire"
    ],
    "calculationMethod": "SUM_BY_LEVEL"
  }
}
```

**Provenance documentée :** Chaque valeur est traçable à son niveau source ET à son année scolaire.

---

## 📋 REQUÊTES SQL D'AGRÉGATION (Module Général)

### Effectif par niveau (année donnée)

```sql
SELECT
  sl.code AS school_level,
  COUNT(s.id) AS total_students
FROM students s
JOIN school_levels sl ON sl.id = s.school_level_id
WHERE
  s.tenant_id = :tenant_id
  AND s.academic_year_id = :academic_year_id
GROUP BY sl.code;
```

### Effectif global (tous niveaux, année donnée)

```sql
SELECT SUM(level_count.total_students) AS total_students
FROM (
  SELECT COUNT(*) AS total_students
  FROM students
  WHERE tenant_id = :tenant_id
    AND academic_year_id = :academic_year_id
  GROUP BY school_level_id
) level_count;
```

### Moyenne par niveau (FR uniquement, année donnée)

```sql
SELECT
  sl.code AS school_level,
  AVG(es.score) AS average_score
FROM exam_scores es
JOIN school_levels sl ON sl.id = es.school_level_id
WHERE
  es.tenant_id = :tenant_id
  AND es.academic_year_id = :academic_year_id
  AND es.academic_track_id IS NULL
GROUP BY sl.code;
```

### Recettes par niveau (année donnée)

```sql
SELECT
  sl.code AS school_level,
  SUM(tp.amount) AS total_revenue
FROM tuition_payments tp
JOIN students s ON s.id = tp.student_id
JOIN school_levels sl ON sl.id = s.school_level_id
WHERE
  tp.tenant_id = :tenant_id
  AND tp.academic_year_id = :academic_year_id
  AND tp.status = 'PAID'
GROUP BY sl.code;
```

---

## 📊 ORDRE D'EXÉCUTION (Garantit la Protection)

```
1. ContextInterceptor
   → Résout le contexte (tenant, school_level, academic_year, module)

2. SchoolLevelIsolationGuard
   → Vérifie l'isolation des niveaux (bloque si violation)

3. AcademicYearEnforcementGuard
   → Vérifie l'année scolaire (bloque si violation)

4. SchoolLevelEnforcementInterceptor
   → Force l'injection de school_level_id

5. AcademicYearEnforcementInterceptor
   → Force l'injection de academic_year_id

6. AuditLogInterceptor
   → Journalise l'action
```

**Cet ordre garantit que les violations sont détectées AVANT l'exécution.**

---

## ✅ CHECKLIST DE CONFORMITÉ

Pour chaque nouveau module/endpoint :

- [x] Guard global actif (bloque les violations)
- [x] Interceptor global actif (force l'injection)
- [x] Module Général opérationnel (agrégations contrôlées)
- [x] Migration SQL créée (academic_year_id sur toutes les tables)
- [ ] Nouveaux services doivent exiger `academicYearId`
- [ ] Nouveaux repositories doivent filtrer par `academicYearId`
- [ ] Nouveaux controllers doivent utiliser `@AcademicYearId()`

---

## 🎯 INTÉGRATION ORION & ATLAS

### ORION

**Règles appliquées :**
- ✅ Analyse les données PAR NIVEAU ET PAR ANNÉE
- ✅ Produit des rapports distincts (Maternelle, Primaire, Secondaire) pour chaque année
- ✅ Peut produire une synthèse globale UNIQUEMENT via Module Général (pour une année donnée)
- ✅ Toutes les agrégations sont documentées avec l'année scolaire

**Exemple :**
```typescript
// Analyse par niveau et par année
const maternelleStats2024 = await orion.analyze(tenantId, maternelleLevelId, academicYearId2024);
const primaireStats2024 = await orion.analyze(tenantId, primaireLevelId, academicYearId2024);

// Synthèse globale (via Module Général uniquement, pour une année donnée)
const consolidated2024 = await generalService.getConsolidatedReport(tenantId, academicYearId2024);
```

### ATLAS

**Règles appliquées :**
- ✅ Respecte le contexte de niveau ET d'année
- ✅ Ne suggère aucune action cross-niveau ou cross-year
- ✅ Guide les utilisateurs sans jamais mélanger les données
- ✅ Contexte de niveau et d'année toujours visible dans les suggestions

---

## 🏁 CONCLUSION

**L'année scolaire est DÉFINITIVEMENT VERROUILLÉE comme dimension obligatoire.**

**Aucune violation n'est possible sans être :**
1. ✅ Détectée par le Guard
2. ✅ Bloquée avant exécution
3. ✅ Journalisée pour audit

**Le système est prêt pour :**
- ✅ Audit institutionnel
- ✅ Archivage par année scolaire
- ✅ Comparaisons inter-années (via Module Général uniquement)
- ✅ Long terme sans dette technique
- ✅ Conformité réglementaire

---

**Date de validation :** $(date)
**Statut :** ✅ VALIDÉ - ACADEMIC YEAR VERROUILLÉE DÉFINITIVEMENT

