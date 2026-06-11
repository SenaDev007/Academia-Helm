# Guide d'Implémentation - Academic Tracks

## 🚀 Démarrage Rapide

### 1. Exécuter la Migration

```bash
# Exécuter la migration SQL
psql -U postgres -d academiahub -f migrations/001_add_academic_tracks.sql
```

La migration :
- ✅ Crée les tables `academic_tracks` et `student_academic_tracks`
- ✅ Ajoute les colonnes `academic_track_id` (NULLABLE) sur les tables existantes
- ✅ Initialise automatiquement le track FR pour tous les tenants existants
- ✅ Ne modifie **AUCUNE** donnée existante

### 2. Vérifier l'Initialisation

```bash
# Vérifier que le track FR a été créé pour chaque tenant
SELECT t.name, at.code, at.name, at.is_default
FROM tenants t
LEFT JOIN academic_tracks at ON at.tenant_id = t.id
ORDER BY t.name, at."order";
```

### 3. Créer un Track Anglophone (Optionnel)

```bash
# Via l'API
POST /api/academic-tracks
{
  "code": "EN",
  "name": "Anglophone",
  "description": "Piste académique anglophone",
  "order": 1,
  "isActive": true,
  "isDefault": false
}
```

## 📝 Utilisation dans le Code

### Créer un Examen avec Track

```typescript
// Examen FR (track par défaut si non spécifié)
const examFR = await examsService.create({
  name: "Contrôle de Mathématiques",
  subjectId: "math-fr-id",
  classId: "cp1-id",
  // academicTrackId non fourni → utilise le track FR par défaut
}, tenantId);

// Examen EN (track explicite)
const examEN = await examsService.create({
  name: "Mathematics Test",
  subjectId: "math-en-id",
  classId: "nursery1-id",
  academicTrackId: enTrackId, // Track EN explicite
}, tenantId);
```

### Créer une Note avec Héritage de Track

```typescript
// La note hérite automatiquement du track de l'examen
const grade = await gradesService.create({
  studentId: "student-id",
  examId: examEN.id, // Track EN hérité de l'examen
  subjectId: "math-en-id",
  score: 15,
  maxScore: 20,
  // academicTrackId non fourni → hérite de l'examen
}, tenantId);
```

### Filtrer les Données par Track

```typescript
// Récupérer uniquement les examens FR
const frExams = await examsService.findAll(
  tenantId,
  classId,
  undefined,
  undefined,
  frTrackId // Filtrer strictement par track FR
);

// Récupérer uniquement les notes EN
const enGrades = await gradesService.findAll(
  tenantId,
  studentId,
  undefined,
  undefined,
  undefined,
  enTrackId // Filtrer strictement par track EN
);
```

## 🧮 Calculs de Moyennes par Track

### Exemple : Calculer la Moyenne d'un Élève par Track

```typescript
async calculateStudentAverageByTrack(
  studentId: string,
  tenantId: string,
  academicTrackId: string,
): Promise<number> {
  // Récupérer UNIQUEMENT les notes du track spécifié
  const grades = await gradesService.findAll(
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
    return sum + (parseFloat(grade.score.toString()) * parseFloat(grade.coefficient.toString()));
  }, 0);

  const totalCoefficient = grades.reduce((sum, grade) => {
    return sum + parseFloat(grade.coefficient.toString());
  }, 0);

  return totalCoefficient > 0 ? totalScore / totalCoefficient : 0;
}

// Utilisation
const frAverage = await calculateStudentAverageByTrack(studentId, tenantId, frTrackId);
const enAverage = await calculateStudentAverageByTrack(studentId, tenantId, enTrackId);

// ❌ JAMAIS mélanger les deux
// const mixedAverage = await calculateStudentAverageByTrack(studentId, tenantId, null); // ERREUR !
```

## 🎓 Gestion des Élèves Bilingues

### Assigner un Élève à un Track

```typescript
// Créer une entrée dans student_academic_tracks
await studentAcademicTracksRepository.create({
  studentId: "student-id",
  academicTrackId: enTrackId,
  enrollmentDate: new Date(),
  isActive: true,
});
```

### Vérifier les Tracks d'un Élève

```typescript
// Récupérer tous les tracks d'un élève
const studentTracks = await studentAcademicTracksRepository.find({
  where: { studentId: "student-id", isActive: true },
  relations: ['academicTrack'],
});

// Si aucun track → l'élève appartient au track par défaut (FR)
const tracks = studentTracks.length > 0 
  ? studentTracks.map(st => st.academicTrack)
  : [await academicTracksService.getDefaultTrack(tenantId)];
```

## 📊 Génération de Bulletins

### Générer un Bulletin par Track

```typescript
async generateReportCard(
  studentId: string,
  tenantId: string,
  academicTrackId: string,
  quarterId: string,
): Promise<ReportCard> {
  // 1. Récupérer les notes du track
  const grades = await gradesService.findAll(
    tenantId,
    studentId,
    undefined,
    undefined,
    quarterId,
    academicTrackId, // Filtrer strictement par track
  );

  // 2. Calculer les moyennes par matière
  const subjectAverages = calculateSubjectAverages(grades);

  // 3. Calculer la moyenne générale
  const generalAverage = calculateGeneralAverage(subjectAverages);

  // 4. Générer le bulletin
  return {
    studentId,
    academicTrackId,
    quarterId,
    subjectAverages,
    generalAverage,
    // ... autres données
  };
}

// Pour un élève bilingue, générer 2 bulletins séparés
const frReportCard = await generateReportCard(studentId, tenantId, frTrackId, quarterId);
const enReportCard = await generateReportCard(studentId, tenantId, enTrackId, quarterId);
```

## ⚠️ Points d'Attention

### 1. Toujours Filtrer par Track dans les Requêtes Pédagogiques

```typescript
// ❌ MAUVAIS
const allGrades = await gradesRepository.findAll(tenantId, studentId);

// ✅ BON
const frGrades = await gradesRepository.findAll(tenantId, studentId, undefined, undefined, undefined, frTrackId);
```

### 2. Ne Jamais Mélanger les Tracks dans les Calculs

```typescript
// ❌ MAUVAIS
const allGrades = await gradesRepository.findAll(tenantId, studentId);
const average = calculateAverage(allGrades); // Mélange FR + EN !

// ✅ BON
const frAverage = await calculateAverage(studentId, frTrackId);
const enAverage = await calculateAverage(studentId, enTrackId);
```

### 3. Utiliser le Track par Défaut si Non Spécifié

```typescript
// ✅ BON
const defaultTrack = await academicTracksService.getDefaultTrack(tenantId);
const trackId = academicTrackId || defaultTrack.id;
```

### 4. Valider le Track Avant Toute Opération

```typescript
// ✅ BON
await academicTracksService.findOne(academicTrackId, tenantId);
```

## 🧪 Tests

### Test : Élève Monolingue FR

```typescript
it('should use default FR track for monolingual student', async () => {
  const student = await createStudent({ tenantId });
  
  // Pas d'entrée dans student_academic_tracks
  const tracks = await getStudentTracks(student.id);
  expect(tracks).toHaveLength(1);
  expect(tracks[0].code).toBe('FR');
});
```

### Test : Élève Bilingue FR+EN

```typescript
it('should separate calculations for bilingual student', async () => {
  const student = await createStudent({ tenantId });
  await assignStudentToTrack(student.id, frTrackId);
  await assignStudentToTrack(student.id, enTrackId);
  
  // Créer des notes FR et EN
  await createGrade({ studentId: student.id, examId: frExam.id });
  await createGrade({ studentId: student.id, examId: enExam.id });
  
  // Calculer les moyennes séparément
  const frAverage = await calculateAverage(student.id, frTrackId);
  const enAverage = await calculateAverage(student.id, enTrackId);
  
  // Les moyennes doivent être différentes et isolées
  expect(frAverage).not.toBe(enAverage);
});
```

## 📚 Ressources

- [Architecture Academic Tracks](./ACADEMIC-TRACKS-ARCHITECTURE.md)
- [Migration SQL](../migrations/001_add_academic_tracks.sql)
- [API Endpoints](../API-ENDPOINTS.md)

