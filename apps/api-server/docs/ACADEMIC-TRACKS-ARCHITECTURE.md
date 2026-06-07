# Architecture Academic Tracks - Système Bilingue FR/EN

## 📋 Vue d'ensemble

Ce document décrit l'architecture du système **Academic Tracks** pour gérer les écoles bilingues (Francophone/Anglophone) dans Academia Hub.

## 🎯 Principe Fondamental

**Le bilinguisme n'est PAS :**
- ❌ Une duplication d'école
- ❌ Une duplication d'élèves
- ❌ Une traduction simple des matières

**C'est une séparation STRICTE de la logique académique** au niveau :
- ✅ Matières
- ✅ Examens
- ✅ Notes
- ✅ Moyennes
- ✅ Bulletins
- ✅ Statistiques
- ✅ Tableaux d'honneur

**Les élèves restent les MÊMES.**  
**Les établissements restent les MÊMES.**

## 🏗️ Structure de la Base de Données

### Tables Principales

#### 1. `academic_tracks`
Table principale des pistes académiques.

```sql
CREATE TABLE academic_tracks (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    code VARCHAR(20) NOT NULL, -- 'FR' ou 'EN'
    name VARCHAR(255) NOT NULL,
    description TEXT,
    "order" INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE(tenant_id, code)
);
```

**Codes standardisés :**
- `FR` = Francophone (par défaut, toujours présent)
- `EN` = Anglophone (optionnel)

#### 2. `student_academic_tracks`
Table de liaison élève-track (pour élèves bilingues).

```sql
CREATE TABLE student_academic_tracks (
    id UUID PRIMARY KEY,
    student_id UUID NOT NULL,
    academic_track_id UUID NOT NULL,
    enrollment_date DATE,
    exit_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE(student_id, academic_track_id)
);
```

**Règle importante :**
- Si un élève n'a **AUCUNE** entrée dans cette table → Il appartient implicitement au track par défaut (FR)
- Cette table est **OPTIONNELLE** pour les élèves monolingues

### Colonnes Ajoutées (NULLABLE)

Les colonnes suivantes ont été ajoutées aux tables existantes :

#### `subjects.academic_track_id`
- **Type :** UUID, NULLABLE
- **Défaut :** NULL = track par défaut (FR)
- **Contrainte :** FOREIGN KEY vers `academic_tracks(id)` ON DELETE SET NULL

#### `exams.academic_track_id`
- **Type :** UUID, NULLABLE
- **Défaut :** NULL = track par défaut (FR)
- **OBLIGATOIRE** pour les nouveaux examens dans un contexte bilingue

#### `grades.academic_track_id`
- **Type :** UUID, NULLABLE
- **Défaut :** NULL = track par défaut (FR)
- Hérite généralement du track de l'examen ou de la matière

#### `classes.academic_track_id`
- **Type :** UUID, NULLABLE
- **Défaut :** NULL = track par défaut (FR)
- Exemples : CP1 (FR), Nursery 1 (EN)

## 🔄 Migration des Données

### Principe de Compatibilité

**Toutes les colonnes `academic_track_id` sont NULLABLE** pour garantir :
- ✅ Compatibilité avec les données existantes
- ✅ Aucune migration de données nécessaire
- ✅ Le système fonctionne immédiatement après la migration

### Règle d'Inférence

**Si `academic_track_id` est NULL :**
- → Le système considère que c'est le track par défaut (FR)
- → Les calculs et requêtes fonctionnent comme avant

**Si `academic_track_id` est défini :**
- → Le système filtre strictement par ce track
- → Les calculs sont isolés par track

## 📊 Calculs et Requêtes

### Filtrage par Track

Toutes les requêtes pédagogiques doivent **optionnellement** filtrer par `academic_track_id` :

```typescript
// Exemple : Récupérer les examens d'une classe
async findAll(
  tenantId: string,
  classId: string,
  academicTrackId?: string | null, // NULL = FR par défaut
): Promise<Exam[]> {
  const where: any = { tenantId, classId };
  
  // Si academicTrackId est null, on filtre les examens sans track (FR)
  // Si academicTrackId est défini, on filtre par ce track
  if (academicTrackId !== undefined) {
    where.academicTrackId = academicTrackId;
  }
  
  return this.repository.find({ where });
}
```

### Calculs de Moyennes

**RÈGLE CRITIQUE :** Les moyennes doivent **TOUJOURS** être calculées par track.

```typescript
// ❌ MAUVAIS : Mélanger FR et EN
const allGrades = await gradesRepository.findAll(tenantId, studentId);
const average = calculateAverage(allGrades); // ERREUR !

// ✅ BON : Filtrer par track
const frGrades = await gradesRepository.findAll(tenantId, studentId, null, null, null, frTrackId);
const enGrades = await gradesRepository.findAll(tenantId, studentId, null, null, null, enTrackId);

const frAverage = calculateAverage(frGrades);
const enAverage = calculateAverage(enGrades);
```

### Bulletins

Un élève bilingue aura :
- **1 bulletin FR** (calculé avec les notes FR)
- **1 bulletin EN** (calculé avec les notes EN)

**JAMAIS** de bulletin mixte FR+EN.

## 🎨 Interface Utilisateur

### Sélecteur de Track

Toute action pédagogique doit avoir un **sélecteur visible et obligatoire** :

```
[ Academic Track : Francophone | Anglophone ]
```

**INTERDICTION :**
- ❌ D'entrer une note sans track actif
- ❌ De créer un examen sans track actif
- ❌ De générer un bulletin sans track actif

### Workflow

1. **Sélection du track** (FR ou EN)
2. **Action pédagogique** (création d'examen, saisie de note, etc.)
3. **Le track est automatiquement associé** à la donnée créée

## 🔧 Adaptation des Services

### 1. Service Exams

```typescript
// Ajouter academicTrackId dans les DTOs
export class CreateExamDto {
  // ... autres champs
  @IsOptional()
  @IsUUID()
  academicTrackId?: string;
}

// Adapter le service pour valider le track
async create(createDto: CreateExamDto, tenantId: string): Promise<Exam> {
  // Si academicTrackId n'est pas fourni, utiliser le track par défaut
  if (!createDto.academicTrackId) {
    const defaultTrack = await this.academicTracksService.getDefaultTrack(tenantId);
    createDto.academicTrackId = defaultTrack.id;
  }
  
  // Valider que le track existe et appartient au tenant
  await this.academicTracksService.findOne(createDto.academicTrackId, tenantId);
  
  return this.repository.create({ ...createDto, tenantId });
}
```

### 2. Service Grades

```typescript
// Hériter le track de l'examen ou de la matière
async create(createDto: CreateGradeDto, tenantId: string): Promise<Grade> {
  let academicTrackId = createDto.academicTrackId;
  
  // Si non fourni, hériter de l'examen
  if (!academicTrackId && createDto.examId) {
    const exam = await this.examsService.findOne(createDto.examId, tenantId);
    academicTrackId = exam.academicTrackId;
  }
  
  // Si toujours non fourni, hériter de la matière
  if (!academicTrackId && createDto.subjectId) {
    const subject = await this.subjectsService.findOne(createDto.subjectId, tenantId);
    academicTrackId = subject.academicTrackId;
  }
  
  // Si toujours non fourni, utiliser le track par défaut
  if (!academicTrackId) {
    const defaultTrack = await this.academicTracksService.getDefaultTrack(tenantId);
    academicTrackId = defaultTrack.id;
  }
  
  return this.repository.create({ ...createDto, academicTrackId, tenantId });
}
```

### 3. Service de Calculs

```typescript
// Adapter les calculs pour filtrer par track
async calculateStudentAverage(
  studentId: string,
  tenantId: string,
  academicTrackId: string, // OBLIGATOIRE
): Promise<number> {
  const grades = await this.gradesRepository.findAll(
    tenantId,
    studentId,
    undefined,
    undefined,
    undefined,
    academicTrackId, // Filtrer strictement par track
  );
  
  if (grades.length === 0) {
    return 0;
  }
  
  // Calculer la moyenne pondérée
  const totalScore = grades.reduce((sum, grade) => {
    return sum + (grade.score * grade.coefficient);
  }, 0);
  
  const totalCoefficient = grades.reduce((sum, grade) => {
    return sum + grade.coefficient;
  }, 0);
  
  return totalCoefficient > 0 ? totalScore / totalCoefficient : 0;
}
```

## 🚫 Erreurs à Éviter

### ❌ Dupliquer les élèves
```typescript
// MAUVAIS
const frStudent = await createStudent({ ...data, track: 'FR' });
const enStudent = await createStudent({ ...data, track: 'EN' });
```

### ❌ Mélanger FR et EN dans les moyennes
```typescript
// MAUVAIS
const allGrades = await findAllGrades(studentId);
const average = calculateAverage(allGrades); // Mélange FR + EN !
```

### ❌ Modifier les notes existantes
```typescript
// MAUVAIS - Ne jamais migrer brutalement les données
await updateAllGrades({ academicTrackId: frTrackId }); // DANGEREUX !
```

### ❌ Introduire des if/else partout
```typescript
// MAUVAIS - Logique conditionnelle dispersée
if (track === 'FR') {
  // logique FR
} else if (track === 'EN') {
  // logique EN
}
```

**Solution :** Utiliser le filtrage par `academic_track_id` dans les requêtes.

## ✅ Bonnes Pratiques

### 1. Toujours filtrer par track dans les requêtes pédagogiques

```typescript
// ✅ BON
const exams = await examsRepository.findAll(tenantId, classId, undefined, undefined, academicTrackId);
```

### 2. Utiliser le track par défaut si non spécifié

```typescript
// ✅ BON
const defaultTrack = await academicTracksService.getDefaultTrack(tenantId);
const trackId = academicTrackId || defaultTrack.id;
```

### 3. Valider le track avant toute opération

```typescript
// ✅ BON
await academicTracksService.findOne(academicTrackId, tenantId);
```

### 4. Isoler les calculs par track

```typescript
// ✅ BON
const frAverage = await calculateAverage(studentId, frTrackId);
const enAverage = await calculateAverage(studentId, enTrackId);
```

## 📈 Extensibilité Future

L'architecture est conçue pour être extensible :

- **Cambridge** : Ajouter `code: 'CAMBRIDGE'`
- **IB** : Ajouter `code: 'IB'`
- **Montessori** : Ajouter `code: 'MONTESSORI'`

Aucune modification du schéma n'est nécessaire, juste l'ajout de nouveaux tracks dans la table `academic_tracks`.

## 🔍 Tests

### Scénarios de Test

1. **Élève monolingue FR**
   - Créer un élève sans entrée dans `student_academic_tracks`
   - Vérifier que les calculs utilisent le track FR par défaut

2. **Élève bilingue FR+EN**
   - Créer un élève avec entrées dans `student_academic_tracks` (FR et EN)
   - Vérifier que les calculs sont séparés par track

3. **Matières par track**
   - Créer "Mathématiques" (FR) et "Mathematics" (EN)
   - Vérifier qu'elles ne sont jamais mélangées

4. **Bulletins séparés**
   - Générer un bulletin FR et un bulletin EN pour un élève bilingue
   - Vérifier que les moyennes sont correctes et isolées

## 📝 Checklist d'Implémentation

- [x] Créer l'entité `AcademicTrack`
- [x] Créer l'entité `StudentAcademicTrack`
- [x] Ajouter `academic_track_id` sur `subjects`
- [x] Ajouter `academic_track_id` sur `exams`
- [x] Ajouter `academic_track_id` sur `grades`
- [x] Ajouter `academic_track_id` sur `classes`
- [x] Créer la migration SQL
- [ ] Adapter le service `ExamsService`
- [ ] Adapter le service `GradesService`
- [ ] Adapter les calculs de moyennes
- [ ] Adapter la génération de bulletins
- [ ] Créer le sélecteur de track dans l'UI
- [ ] Ajouter les tests unitaires
- [ ] Ajouter les tests d'intégration

## 🎯 Objectif Final

Obtenir :
- ✅ Un système FR intact (comme avant)
- ✅ Un système EN parallèle et isolé
- ✅ Une architecture extensible (Cambridge, IB, Montessori demain)
- ✅ Zéro régression
- ✅ Zéro dette technique

