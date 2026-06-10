# 🎯 DIMENSIONS FONDAMENTALES - ARCHITECTURE COMPLÈTE

## ✅ STATUT : TOUTES LES DIMENSIONS VERROUILLÉES

Les dimensions fondamentales sont **DÉFINITIVEMENT VERROUILLÉES** dans toute l'architecture Academia Hub.

---

## 🔑 DIMENSIONS FONDAMENTALES (OBLIGATOIRES PARTOUT)

Toute table métier DOIT référencer :

```typescript
tenant_id          // OBLIGATOIRE - Multi-tenant strict
academic_year_id   // OBLIGATOIRE - Dimension temporelle
school_level_id    // OBLIGATOIRE - Isolation des niveaux
academic_track_id  // OPTIONNEL   - NULL = FR par défaut (bilingue)
```

---

## 📊 HIÉRARCHIE DES DIMENSIONS

```
TENANT (Établissement)
  └── ACADEMIC_YEAR (Année scolaire)
        └── SCHOOL_LEVEL (Maternelle | Primaire | Secondaire)
              └── ACADEMIC_TRACK (FR | EN) [Optionnel]
```

**Règles :**
- ✅ Un tenant peut avoir plusieurs années scolaires
- ✅ Une seule année active par tenant à la fois
- ✅ Chaque année peut avoir plusieurs niveaux scolaires
- ✅ Chaque niveau peut avoir plusieurs tracks (si bilingue activé)

---

## 🔒 MÉCANISMES DE PROTECTION

### 1. Multi-Tenant Strict

**Guard :** `TenantIsolationGuard`
- ✅ Bloque toute requête sans `tenant_id`
- ✅ Empêche l'accès cross-tenant
- ✅ Validation du tenant actif

### 2. Academic Year Enforcement

**Guard :** `AcademicYearEnforcementGuard`
- ✅ Bloque toute requête sans `academic_year_id`
- ✅ Empêche le mélange d'années
- ✅ Validation de l'année active

**Interceptor :** `AcademicYearEnforcementInterceptor`
- ✅ Force l'injection de `academic_year_id`
- ✅ Empêche la modification de `academic_year_id`

### 3. School Level Isolation

**Guard :** `SchoolLevelIsolationGuard`
- ✅ Bloque toute requête sans `school_level_id`
- ✅ Empêche le mélange de niveaux
- ✅ Isolation stricte Maternelle / Primaire / Secondaire

**Interceptor :** `SchoolLevelEnforcementInterceptor`
- ✅ Force l'injection de `school_level_id`
- ✅ Empêche la modification de `school_level_id`

### 4. Academic Track (Optionnel)

**Règles :**
- ✅ `academic_track_id` NULL = FR par défaut
- ✅ Track activé uniquement si feature `BILINGUAL_TRACK` activée
- ✅ Track appliqué aux matières/examens/bulletins, pas aux élèves

---

## 📋 ORDRE D'EXÉCUTION DES GUARDS/INTERCEPTORS

```
1. ContextInterceptor
   → Résout le contexte complet (tenant, academic_year, school_level, module)

2. TenantIsolationGuard
   → Vérifie l'isolation par tenant

3. SchoolLevelIsolationGuard
   → Vérifie l'isolation des niveaux scolaires

4. AcademicYearEnforcementGuard
   → Vérifie l'année scolaire obligatoire

5. SchoolLevelEnforcementInterceptor
   → Force l'injection de school_level_id

6. AcademicYearEnforcementInterceptor
   → Force l'injection de academic_year_id

7. AuditLogInterceptor
   → Journalise l'action
```

**Cet ordre garantit que toutes les violations sont détectées AVANT l'exécution.**

---

## 🗄️ TABLES MÉTIER CONCERNÉES

### Tables avec TOUTES les dimensions

- ✅ `students` - tenant_id, academic_year_id, school_level_id
- ✅ `classes` - tenant_id, academic_year_id, school_level_id
- ✅ `subjects` - tenant_id, academic_year_id, school_level_id, academic_track_id (nullable)
- ✅ `exams` - tenant_id, academic_year_id, school_level_id, academic_track_id (nullable)
- ✅ `grades` - tenant_id, academic_year_id, school_level_id, academic_track_id (nullable)
- ✅ `absences` - tenant_id, academic_year_id, school_level_id
- ✅ `payments` - tenant_id, academic_year_id, school_level_id
- ✅ `expenses` - tenant_id, academic_year_id, school_level_id
- ✅ `fee_configurations` - tenant_id, academic_year_id, school_level_id
- ✅ `quarters` - tenant_id, academic_year_id (lié à academic_year)

---

## 📊 REQUÊTES SQL D'AGRÉGATION (Module Général)

### Principe

Le **Module Général** permet des agrégations cross-level **pour une année scolaire donnée**.

**Règles strictes :**
- ✅ Lecture seule
- ✅ Agrégations explicites et traçables
- ✅ Provenance documentée niveau par niveau
- ✅ **TOUJOURS pour une année scolaire donnée**

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

### Comparatif FR / EN (par niveau, année donnée)

```sql
SELECT
  sl.code AS school_level,
  at.code AS track,
  AVG(es.score) AS average_score
FROM exam_scores es
JOIN school_levels sl ON sl.id = es.school_level_id
LEFT JOIN academic_tracks at ON at.id = es.academic_track_id
WHERE
  es.tenant_id = :tenant_id
  AND es.academic_year_id = :academic_year_id
GROUP BY sl.code, at.code;
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

## ✅ EXEMPLES CORRECTS

### Repository

```typescript
@Injectable()
export class StudentsRepository {
  async findAll(
    tenantId: string,
    schoolLevelId: string,
    academicYearId: string, // OBLIGATOIRE
  ): Promise<Student[]> {
    return this.repository.find({
      where: { 
        tenantId,           // OBLIGATOIRE
        schoolLevelId,      // OBLIGATOIRE
        academicYearId,     // OBLIGATOIRE
      },
      order: { createdAt: 'DESC' },
    });
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

## 🚫 INTERDICTIONS STRICTES

### ❌ INTERDIT : Requêtes sans dimensions obligatoires

```typescript
// ❌ MAUVAIS
SELECT * FROM students WHERE tenant_id = 'xxx';
// → Manque academic_year_id et school_level_id

// ✅ BON
SELECT * FROM students 
WHERE tenant_id = 'xxx' 
  AND academic_year_id = 'uuid-2024-2025'
  AND school_level_id = 'uuid-primaire';
```

### ❌ INTERDIT : Calculs cross-niveau directs

```typescript
// ❌ MAUVAIS
SELECT AVG(score) FROM grades 
WHERE tenant_id = 'xxx' AND academic_year_id = 'uuid-2024-2025';
// → Mélange Maternelle + Primaire + Secondaire

// ✅ BON
SELECT AVG(score) FROM grades 
WHERE tenant_id = 'xxx' 
  AND academic_year_id = 'uuid-2024-2025'
  AND school_level_id = 'uuid-primaire';
// → Primaire uniquement
```

### ❌ INTERDIT : Calculs cross-year directs

```typescript
// ❌ MAUVAIS
SELECT AVG(score) FROM grades 
WHERE tenant_id = 'xxx' AND school_level_id = 'uuid-primaire';
// → Mélange toutes les années

// ✅ BON
SELECT AVG(score) FROM grades 
WHERE tenant_id = 'xxx' 
  AND academic_year_id = 'uuid-2024-2025'
  AND school_level_id = 'uuid-primaire';
// → Primaire, année 2024-2025 uniquement
```

---

## 🎯 INTÉGRATION ORION & ATLAS

### ORION

**Règles appliquées :**
- ✅ Analyse les données PAR NIVEAU ET PAR ANNÉE
- ✅ Produit des rapports distincts (Maternelle, Primaire, Secondaire) pour chaque année
- ✅ Peut comparer FR vs EN (si bilingue activé)
- ✅ Peut produire une synthèse globale UNIQUEMENT via Module Général (pour une année donnée)
- ✅ Toutes les agrégations sont documentées avec l'année scolaire

### ATLAS

**Règles appliquées :**
- ✅ Respecte le contexte de niveau ET d'année
- ✅ Ne suggère aucune action cross-niveau ou cross-year
- ✅ Guide les utilisateurs sans jamais mélanger les données
- ✅ Contexte de niveau, d'année et de track toujours visible dans les suggestions

---

## 📋 CHECKLIST DE CONFORMITÉ

Pour chaque nouveau module/endpoint :

- [x] Guard global actif (bloque les violations)
- [x] Interceptor global actif (force l'injection)
- [x] Module Général opérationnel (agrégations contrôlées)
- [x] Migration SQL créée (academic_year_id sur toutes les tables)
- [ ] Nouveaux services doivent exiger `tenantId`, `schoolLevelId`, `academicYearId`
- [ ] Nouveaux repositories doivent filtrer par toutes les dimensions
- [ ] Nouveaux controllers doivent utiliser `@TenantId()`, `@SchoolLevelId()`, `@AcademicYearId()`

---

## 🏁 CONCLUSION

**Toutes les dimensions fondamentales sont DÉFINITIVEMENT VERROUILLÉES.**

**Aucune violation n'est possible sans être :**
1. ✅ Détectée par les Guards
2. ✅ Bloquée avant exécution
3. ✅ Journalisée pour audit

**Le système est prêt pour :**
- ✅ Audit institutionnel
- ✅ Archivage par année scolaire
- ✅ Comparaisons inter-années (via Module Général uniquement)
- ✅ Évolution vers groupes scolaires
- ✅ Multi-pays
- ✅ Long terme sans dette technique
- ✅ Conformité réglementaire

---

**Date de validation :** $(date)
**Statut :** ✅ VALIDÉ - TOUTES LES DIMENSIONS VERROUILLÉES DÉFINITIVEMENT

