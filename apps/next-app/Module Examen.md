Parfait. On va attaquer le **Module 3 — Examens, Notes & Bulletins** proprement, en mode **architecture produit + BDD + backend + frontend**, **onglet par onglet**.

L’objectif : faire de ce module un vrai **moteur académique institutionnel**, pas un simple tableau de notes.

> Référence utile : un bulletin scolaire doit synthétiser les résultats d’un élève sur une période précise, avec en-tête établissement/année/classe/identité, corps des matières/moyennes/appréciations, puis pied de page avec appréciation globale, décisions, cachet/signature. ([Wikipédia][1])
> Pour le Bénin, il existe des textes récents sur les modes de calcul des moyennes par discipline et des moyennes périodiques ; donc Academia Helm doit prévoir un moteur configurable, pas des formules figées en dur. ([journaldubenin.com][2])

---

# MODULE 3 — EXAMENS, NOTES & BULLETINS

## Positionnement dans Academia Helm

Le module **Examens, Notes & Bulletins** est connecté à :

* **Module 1 — Élèves & Scolarité** : élèves, classes, inscriptions, statuts scolaires.
* **Module 2 — Organisation pédagogique** : classes, matières, coefficients, enseignants, séries.
* **Module 4 — Finance** : blocage éventuel de consultation/téléchargement du bulletin si politique activée.
* **Module Paramètres** : périodes, système de notation, modèles de bulletins, signatures.
* **Module Agrégation** : statistiques consolidées.
* **ORION** : analyse des performances, anomalies, alertes pédagogiques.

---

# 1. Objectifs fonctionnels du module

Le module doit permettre de gérer :

1. Configuration des périodes d’évaluation.
2. Configuration des types d’évaluations.
3. Création des devoirs, compositions, examens blancs.
4. Saisie des notes.
5. Validation des notes.
6. Calcul automatique des moyennes.
7. Classements.
8. Conseils de classe.
9. Décisions pédagogiques.
10. Génération des bulletins PDF.
11. Publication des bulletins.
12. Historique et audit académique.
13. Analyse ORION.

---

# 2. Onglets du module

Je propose une structure propre en **10 onglets** :

```text
1. Tableau de bord
2. Paramétrage académique
3. Évaluations
4. Saisie des notes
5. Validation & verrouillage
6. Moyennes & classements
7. Conseils de classe
8. Bulletins
9. Statistiques & ORION
10. Audit académique
```

---

# ONGLET 1 — TABLEAU DE BORD EXAMENS

## 1.1 Objectif

Donner à la direction et à l’administration une vue instantanée de l’état académique :

* notes saisies
* notes manquantes
* évaluations en retard
* bulletins prêts
* classes verrouillées
* anomalies ORION

---

## 1.2 Frontend

### Page

```text
/exams/dashboard
```

### Composants

```text
ExamDashboardPage
ExamKpiCards
ExamPeriodSelector
ClassProgressTable
PendingGradesWidget
OrionAcademicAlerts
RecentExamActivity
```

### KPI affichés

```text
- Classes actives
- Évaluations créées
- Notes saisies
- Notes manquantes
- Bulletins générés
- Bulletins publiés
- Classes verrouillées
- Alertes ORION
```

### UX attendue

Interface directionnelle :

```text
[Année scolaire] [Période] [Niveau] [Classe]

Cartes KPI
Graphique progression saisie
Table classes
Alertes ORION
Activité récente
```

---

## 1.3 Backend

### Endpoints

```http
GET /api/exams/dashboard
GET /api/exams/dashboard/classes-progress
GET /api/exams/dashboard/pending-grades
GET /api/exams/dashboard/orion-alerts
```

### Query params

```ts
academicYearId
periodId
levelId?
classId?
```

### Services

```ts
ExamDashboardService
AcademicProgressService
ExamOrionInsightService
```

---

## 1.4 BDD

Tables utilisées :

```text
academic_years
academic_periods
classes
students
subjects
evaluations
grades
grade_locks
bulletins
orion_alerts
academic_audit_logs
```

---

# ONGLET 2 — PARAMÉTRAGE ACADÉMIQUE

## 2.1 Objectif

Configurer le moteur d’évaluation.

C’est ici que l’école définit :

* périodes : trimestre, semestre, séquence
* barèmes : /20, /10, /100
* coefficients
* règles de calcul
* mentions
* seuils de réussite
* modèles de bulletins
* règles de publication

---

## 2.2 Sous-sections frontend

```text
1. Périodes
2. Barèmes
3. Types d’évaluations
4. Règles de calcul
5. Mentions & décisions
6. Templates bulletins
7. Règles de publication
```

---

## 2.3 Frontend

### Page

```text
/exams/settings
```

### Composants

```text
ExamSettingsPage
AcademicPeriodManager
GradeScaleManager
EvaluationTypeManager
CalculationRuleBuilder
MentionDecisionManager
BulletinTemplateManager
PublicationPolicyPanel
```

---

## 2.4 BDD — modèles principaux

### `academic_periods`

```prisma
model AcademicPeriod {
  id             String   @id @default(cuid())
  tenantId       String
  academicYearId String

  name           String   // Trimestre 1, Semestre 1, Séquence 1
  code           String
  type           AcademicPeriodType
  startDate      DateTime
  endDate        DateTime
  orderIndex     Int

  isActive       Boolean  @default(true)
  isLocked       Boolean  @default(false)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([tenantId, academicYearId])
  @@unique([tenantId, academicYearId, code])
}

enum AcademicPeriodType {
  TRIMESTER
  SEMESTER
  SEQUENCE
  ANNUAL
}
```

### `grade_scales`

```prisma
model GradeScale {
  id        String   @id @default(cuid())
  tenantId  String

  name      String   // Barème /20
  maxScore  Decimal  @db.Decimal(5,2)
  minScore  Decimal  @db.Decimal(5,2) @default(0)
  passScore Decimal  @db.Decimal(5,2)

  isDefault Boolean  @default(false)
  isActive  Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId])
}
```

### `evaluation_types`

```prisma
model EvaluationType {
  id          String   @id @default(cuid())
  tenantId    String

  name        String   // Devoir, Interrogation, Composition
  code        String
  weight      Decimal  @db.Decimal(6,2) @default(1)
  isMandatory Boolean  @default(true)
  isActive    Boolean  @default(true)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, code])
}
```

### `exam_calculation_rules`

```prisma
model ExamCalculationRule {
  id              String   @id @default(cuid())
  tenantId        String
  academicYearId  String

  name            String
  levelId         String?
  classId         String?
  seriesId        String?

  periodType      AcademicPeriodType
  formulaType     CalculationFormulaType
  configJson      Json

  isDefault       Boolean @default(false)
  isActive        Boolean @default(true)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId, academicYearId])
}

enum CalculationFormulaType {
  SIMPLE_AVERAGE
  WEIGHTED_AVERAGE
  DUTY_COMPOSITION
  CUSTOM_JSON_RULE
}
```

---

## 2.5 Backend

### Endpoints

```http
GET    /api/exams/settings
POST   /api/exams/periods
PATCH  /api/exams/periods/:id
POST   /api/exams/grade-scales
POST   /api/exams/evaluation-types
POST   /api/exams/calculation-rules
POST   /api/exams/mentions
POST   /api/exams/publication-policy
```

---

## 2.6 Règles métier

1. Une période ne peut pas chevaucher une autre période du même type.
2. Une période verrouillée ne peut plus être modifiée.
3. Un barème par défaut obligatoire.
4. Une règle de calcul active obligatoire par année scolaire.
5. Les coefficients viennent prioritairement du Module 2.
6. Si une classe a une règle spécifique, elle surcharge la règle du niveau.
7. Toute modification de règle après saisie des notes exige validation direction.
8. Toutes les modifications sont auditées.

---

# ONGLET 3 — ÉVALUATIONS

## 3.1 Objectif

Créer et gérer les évaluations :

* devoirs
* interrogations
* compositions
* examens blancs
* épreuves pratiques
* oraux

---

## 3.2 Frontend

### Page

```text
/exams/evaluations
```

### Composants

```text
EvaluationListPage
EvaluationCreateModal
EvaluationCalendar
EvaluationFilters
EvaluationStatusBadge
EvaluationBulkActions
```

### Colonnes

```text
Titre | Classe | Matière | Enseignant | Type | Date | Barème | Statut | Actions
```

---

## 3.3 BDD

### `evaluations`

```prisma
model Evaluation {
  id               String   @id @default(cuid())
  tenantId         String
  academicYearId   String
  periodId         String

  classId          String
  subjectId        String
  teacherId        String?
  evaluationTypeId String
  gradeScaleId     String

  title            String
  description      String?
  evaluationDate   DateTime
  maxScore         Decimal  @db.Decimal(5,2)
  weight           Decimal  @db.Decimal(6,2) @default(1)

  status           EvaluationStatus @default(DRAFT)
  isLocked         Boolean @default(false)

  createdById      String
  validatedById    String?
  validatedAt      DateTime?

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([tenantId, academicYearId, periodId])
  @@index([classId, subjectId])
}

enum EvaluationStatus {
  DRAFT
  PLANNED
  OPEN_FOR_GRADING
  SUBMITTED
  VALIDATED
  LOCKED
  CANCELLED
}
```

---

## 3.4 Backend

### Endpoints

```http
GET    /api/exams/evaluations
POST   /api/exams/evaluations
GET    /api/exams/evaluations/:id
PATCH  /api/exams/evaluations/:id
POST   /api/exams/evaluations/:id/open
POST   /api/exams/evaluations/:id/cancel
```

---

## 3.5 Règles métier

1. Une évaluation doit être liée à une classe, une matière, une période et un barème.
2. L’enseignant doit être affecté à la matière/classe.
3. Impossible de supprimer une évaluation ayant déjà des notes.
4. Une évaluation validée ne peut plus être modifiée.
5. Une évaluation annulée reste visible dans l’historique.
6. Si la période est verrouillée, aucune nouvelle évaluation ne peut être créée.

---

# ONGLET 4 — SAISIE DES NOTES

## 4.1 Objectif

Permettre aux enseignants ou à l’administration de saisir les notes rapidement, proprement et sans erreur.

---

## 4.2 Frontend

### Page

```text
/exams/grades-entry
```

### Composants

```text
GradeEntryPage
GradeEntryGrid
StudentGradeRow
BulkGradeImportModal
GradeValidationPanel
MissingGradesAlert
SaveDraftButton
SubmitGradesButton
```

### UX

```text
[Année] [Période] [Classe] [Matière] [Évaluation]

Table :
Élève | Matricule | Note | Absence | Appréciation | Statut
```

---

## 4.3 BDD

### `grades`

```prisma
model Grade {
  id              String   @id @default(cuid())
  tenantId        String
  academicYearId  String
  periodId        String

  evaluationId    String
  studentId       String
  classId         String
  subjectId       String

  score           Decimal? @db.Decimal(5,2)
  maxScore        Decimal  @db.Decimal(5,2)
  normalizedScore Decimal? @db.Decimal(5,2) // ramené sur 20 ou barème par défaut

  isAbsent        Boolean  @default(false)
  absenceReason   String?
  appreciation    String?

  status          GradeStatus @default(DRAFT)

  enteredById     String
  submittedById   String?
  submittedAt     DateTime?
  validatedById   String?
  validatedAt     DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([tenantId, evaluationId, studentId])
  @@index([tenantId, academicYearId, periodId])
  @@index([studentId, subjectId])
}

enum GradeStatus {
  DRAFT
  SUBMITTED
  VALIDATED
  LOCKED
  REJECTED
}
```

---

## 4.4 Backend

### Endpoints

```http
GET   /api/exams/grades-entry
POST  /api/exams/grades/bulk-save
POST  /api/exams/grades/:evaluationId/submit
POST  /api/exams/grades/import
GET   /api/exams/grades/missing
```

---

## 4.5 Validations API

```ts
score >= 0
score <= maxScore
if isAbsent === true => score must be null or 0 depending policy
student must be enrolled in class for period
evaluation must be OPEN_FOR_GRADING
teacher must be authorized
period must not be locked
```

---

## 4.6 Règles métier

1. Une note ne peut pas dépasser le barème.
2. Un élève absent doit être explicitement marqué absent.
3. Les notes brouillon peuvent être modifiées.
4. Les notes soumises attendent validation.
5. Les notes validées ne peuvent plus être modifiées sans procédure de correction.
6. Import Excel accepté uniquement avec validation préalable.
7. Les notes sont normalisées pour les calculs.
8. Toute modification est historisée.

---

# ONGLET 5 — VALIDATION & VERROUILLAGE

## 5.1 Objectif

Créer un circuit institutionnel de validation.

---

## 5.2 Frontend

### Page

```text
/exams/validation
```

### Composants

```text
GradeValidationPage
SubmittedGradesTable
ValidationDetailDrawer
RejectGradeModal
LockPeriodModal
CorrectionRequestPanel
```

### Actions

```text
Valider
Rejeter
Demander correction
Verrouiller matière
Verrouiller classe
Verrouiller période
```

---

## 5.3 BDD

### `grade_validation_batches`

```prisma
model GradeValidationBatch {
  id              String   @id @default(cuid())
  tenantId        String
  academicYearId  String
  periodId        String

  evaluationId    String
  classId         String
  subjectId       String

  status          ValidationBatchStatus @default(PENDING)
  submittedById   String
  submittedAt     DateTime @default(now())
  reviewedById    String?
  reviewedAt      DateTime?
  reviewComment   String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId, academicYearId, periodId])
}

enum ValidationBatchStatus {
  PENDING
  APPROVED
  REJECTED
  CORRECTION_REQUESTED
}
```

### `grade_locks`

```prisma
model GradeLock {
  id             String   @id @default(cuid())
  tenantId       String
  academicYearId String
  periodId       String

  classId        String?
  subjectId      String?
  evaluationId   String?

  lockType       GradeLockType
  reason         String?

  lockedById     String
  lockedAt       DateTime @default(now())

  isActive       Boolean @default(true)

  @@index([tenantId, academicYearId, periodId])
}

enum GradeLockType {
  EVALUATION
  SUBJECT_CLASS
  CLASS_PERIOD
  PERIOD_GLOBAL
}
```

---

## 5.4 Backend

### Endpoints

```http
GET  /api/exams/validation/pending
POST /api/exams/validation/:batchId/approve
POST /api/exams/validation/:batchId/reject
POST /api/exams/validation/:batchId/request-correction
POST /api/exams/locks
POST /api/exams/locks/:id/release
```

---

## 5.5 Règles métier

1. Seuls directeur, censeur, admin académique peuvent valider.
2. Une validation transforme les notes en `VALIDATED`.
3. Un verrouillage transforme les notes en `LOCKED`.
4. Une note verrouillée ne peut être corrigée que via demande officielle.
5. Déverrouillage exceptionnel audité.
6. Une période globale verrouillée bloque tout le module pour cette période.

---

# ONGLET 6 — MOYENNES & CLASSEMENTS

## 6.1 Objectif

Calculer automatiquement :

* moyenne par matière
* moyenne générale
* rang par classe
* rang par matière
* mention
* évolution par période

---

## 6.2 Frontend

### Page

```text
/exams/averages-rankings
```

### Composants

```text
AveragesRankingPage
ClassAverageTable
StudentAverageDetailDrawer
SubjectRankingTable
RecalculateButton
RankingPublishButton
```

---

## 6.3 BDD

### `student_subject_averages`

```prisma
model StudentSubjectAverage {
  id              String   @id @default(cuid())
  tenantId        String
  academicYearId  String
  periodId        String

  studentId       String
  classId         String
  subjectId       String

  average         Decimal  @db.Decimal(5,2)
  coefficient     Decimal  @db.Decimal(6,2)
  weightedAverage Decimal  @db.Decimal(6,2)

  rankInSubject   Int?
  appreciation    String?

  calculatedAt    DateTime @default(now())

  @@unique([tenantId, academicYearId, periodId, studentId, subjectId])
  @@index([classId, subjectId])
}
```

### `student_period_averages`

```prisma
model StudentPeriodAverage {
  id              String   @id @default(cuid())
  tenantId        String
  academicYearId  String
  periodId        String

  studentId       String
  classId         String

  totalWeighted   Decimal @db.Decimal(8,2)
  totalCoefficient Decimal @db.Decimal(8,2)
  generalAverage  Decimal @db.Decimal(5,2)

  classRank       Int?
  mention         String?
  decisionHint    String?

  calculatedAt    DateTime @default(now())
  isPublished     Boolean @default(false)

  @@unique([tenantId, academicYearId, periodId, studentId])
  @@index([classId])
}
```

---

## 6.4 Backend

### Endpoints

```http
POST /api/exams/averages/recalculate
GET  /api/exams/averages/class/:classId
GET  /api/exams/averages/student/:studentId
POST /api/exams/rankings/recalculate
POST /api/exams/rankings/publish
```

---

## 6.5 Moteur de calcul

### Moyenne matière

```text
Moyenne matière =
somme(note_normalisée × poids_evaluation) / somme(poids_evaluation)
```

### Moyenne générale

```text
Moyenne générale =
somme(moyenne_matière × coefficient_matière) / somme(coefficients)
```

### Classement

```text
Rang = position décroissante selon moyenne générale
```

### Gestion ex æquo

Configuration possible :

```text
DENSE_RANK
COMPETITION_RANK
UNIQUE_WITH_TIE_BREAKERS
```

---

## 6.6 Règles métier

1. Calcul uniquement sur notes validées.
2. Les notes brouillon ne participent pas aux moyennes.
3. Les absences peuvent être traitées selon politique :

   * note zéro
   * ignorée
   * non classé
4. Les coefficients viennent des matières configurées.
5. Recalcul interdit après verrouillage global, sauf procédure exceptionnelle.
6. Tout recalcul est historisé.

---

# ONGLET 7 — CONSEILS DE CLASSE

## 7.1 Objectif

Formaliser les décisions pédagogiques.

---

## 7.2 Frontend

### Page

```text
/exams/class-councils
```

### Composants

```text
ClassCouncilPage
CouncilSessionList
CouncilCreateModal
StudentCouncilReviewTable
DecisionModal
CouncilMinutesGenerator
```

---

## 7.3 BDD

### `class_councils`

```prisma
model ClassCouncil {
  id              String   @id @default(cuid())
  tenantId        String
  academicYearId  String
  periodId        String
  classId         String

  title           String
  scheduledAt     DateTime
  status          ClassCouncilStatus @default(PLANNED)

  chairedById     String?
  minutesUrl      String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId, academicYearId, periodId, classId])
}

enum ClassCouncilStatus {
  PLANNED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}
```

### `student_council_decisions`

```prisma
model StudentCouncilDecision {
  id              String   @id @default(cuid())
  tenantId        String
  councilId       String
  studentId       String

  decision        AcademicDecision
  appreciation    String?
  recommendation  String?
  sanctions       String?

  decidedById     String
  decidedAt       DateTime @default(now())

  @@unique([tenantId, councilId, studentId])
}

enum AcademicDecision {
  PROMOTED
  REPEATED
  WARNING
  ENCOURAGEMENT
  HONOR_ROLL
  CONDITIONAL_PROMOTION
  TRANSFER_RECOMMENDED
}
```

---

## 7.4 Backend

### Endpoints

```http
POST /api/exams/class-councils
GET  /api/exams/class-councils
GET  /api/exams/class-councils/:id
POST /api/exams/class-councils/:id/start
POST /api/exams/class-councils/:id/decisions
POST /api/exams/class-councils/:id/complete
POST /api/exams/class-councils/:id/minutes
```

---

## 7.5 Règles métier

1. Un conseil ne peut être clôturé que si les moyennes sont calculées.
2. Une décision par élève obligatoire si bulletin final.
3. Les décisions sont non supprimables.
4. Le PV est généré automatiquement.
5. Les décisions alimentent le bulletin.

---

# ONGLET 8 — BULLETINS

## 8.1 Objectif

Générer des bulletins officiels PDF, avec QR code, cachet, signature et historique.

---

## 8.2 Frontend

### Page

```text
/exams/bulletins
```

### Composants

```text
BulletinPage
BulletinGenerationWizard
BulletinPreview
BulletinTemplateSelector
BulletinPublishPanel
BulletinDownloadButton
BulletinQRCodeVerifier
```

---

## 8.3 Structure du bulletin

Un bulletin doit contenir :

### En-tête

```text
Nom école
Logo
Adresse
Année scolaire
Période
Classe
Identité élève
Matricule
```

### Corps

```text
Matière
Coefficient
Moyenne élève
Moyenne classe
Rang matière
Appréciation
```

### Synthèse

```text
Moyenne générale
Rang classe
Mention
Absences / retards
Appréciation générale
Décision conseil
```

### Pied

```text
Signature
Cachet
QR code de vérification
Date d’émission
```

---

## 8.4 BDD

### `bulletins`

```prisma
model Bulletin {
  id              String   @id @default(cuid())
  tenantId        String
  academicYearId  String
  periodId        String
  studentId       String
  classId         String

  bulletinNumber  String
  status          BulletinStatus @default(DRAFT)

  averageSnapshot Json
  decisionSnapshot Json?
  pdfUrl          String?
  qrToken         String?

  generatedById   String?
  generatedAt     DateTime?
  publishedById   String?
  publishedAt     DateTime?

  isLocked        Boolean @default(false)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([tenantId, academicYearId, periodId, studentId])
  @@index([classId])
}

enum BulletinStatus {
  DRAFT
  GENERATED
  PUBLISHED
  ARCHIVED
  CANCELLED
}
```

### `bulletin_templates`

```prisma
model BulletinTemplate {
  id          String   @id @default(cuid())
  tenantId    String

  name        String
  levelId     String?
  classId     String?
  language    BulletinLanguage @default(FR)

  layoutJson  Json
  isDefault   Boolean @default(false)
  isActive    Boolean @default(true)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum BulletinLanguage {
  FR
  EN
  BILINGUAL
}
```

---

## 8.5 Backend

### Endpoints

```http
POST /api/exams/bulletins/generate
POST /api/exams/bulletins/generate-class
GET  /api/exams/bulletins/:id
GET  /api/exams/bulletins/student/:studentId
POST /api/exams/bulletins/:id/publish
GET  /api/exams/bulletins/:id/download
GET  /api/public/bulletins/verify/:qrToken
```

---

## 8.6 Règles métier

1. Bulletin généré uniquement si moyennes calculées.
2. Publication possible uniquement après validation direction.
3. Bulletin publié devient verrouillé.
4. QR code obligatoire.
5. Snapshot obligatoire pour éviter que les anciennes données changent.
6. Téléchargement parent peut être bloqué si politique Finance activée.
7. Toute régénération crée une version.

---

# ONGLET 9 — STATISTIQUES & ORION

## 9.1 Objectif

Analyser les performances académiques.

---

## 9.2 Frontend

### Page

```text
/exams/analytics
```

### Composants

```text
ExamAnalyticsPage
PerformanceKpiCards
ClassPerformanceChart
SubjectWeaknessTable
StudentRiskTable
OrionAcademicInsights
TrendComparisonPanel
```

---

## 9.3 KPI

```text
- Moyenne générale par classe
- Taux de réussite
- Taux d’échec
- Meilleure classe
- Matière la plus faible
- Élèves à risque
- Progression par période
- Distribution des notes
- Taux de notes manquantes
```

---

## 9.4 BDD

### `academic_analytics_snapshots`

```prisma
model AcademicAnalyticsSnapshot {
  id              String   @id @default(cuid())
  tenantId        String
  academicYearId  String
  periodId        String?

  scopeType       AnalyticsScopeType
  scopeId         String?

  dataJson        Json
  calculatedAt    DateTime @default(now())

  @@index([tenantId, academicYearId, periodId])
}

enum AnalyticsScopeType {
  GLOBAL
  LEVEL
  CLASS
  SUBJECT
  STUDENT
}
```

---

## 9.5 Backend

### Endpoints

```http
GET  /api/exams/analytics/overview
GET  /api/exams/analytics/classes
GET  /api/exams/analytics/subjects
GET  /api/exams/analytics/students-risk
POST /api/exams/analytics/recalculate
GET  /api/exams/orion/insights
```

---

## 9.6 ORION — analyses attendues

ORION doit détecter :

```text
- classe en baisse
- matière globalement faible
- élève en chute brutale
- enseignant avec taux d’échec anormal
- notes trop uniformes
- notes manquantes critiques
- incohérence entre devoirs et compositions
```

---

# ONGLET 10 — AUDIT ACADÉMIQUE

## 10.1 Objectif

Garantir l’intégrité académique.

---

## 10.2 Frontend

### Page

```text
/exams/audit
```

### Composants

```text
AcademicAuditPage
AuditLogTable
GradeChangeHistoryDrawer
CorrectionRequestList
SuspiciousActivityPanel
```

---

## 10.3 BDD

### `academic_audit_logs`

```prisma
model AcademicAuditLog {
  id             String   @id @default(cuid())
  tenantId       String
  academicYearId String?

  entityType     String
  entityId       String
  action         String

  oldValue       Json?
  newValue       Json?

  reason         String?
  ipAddress      String?
  userAgent      String?

  performedById  String
  createdAt      DateTime @default(now())

  @@index([tenantId, entityType, entityId])
  @@index([performedById])
}
```

### `grade_correction_requests`

```prisma
model GradeCorrectionRequest {
  id              String   @id @default(cuid())
  tenantId        String
  gradeId         String

  requestedById   String
  reason          String
  oldScore        Decimal? @db.Decimal(5,2)
  newScore        Decimal? @db.Decimal(5,2)

  status          CorrectionRequestStatus @default(PENDING)

  reviewedById    String?
  reviewedAt      DateTime?
  reviewComment   String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum CorrectionRequestStatus {
  PENDING
  APPROVED
  REJECTED
  APPLIED
}
```

---

## 10.4 Backend

### Endpoints

```http
GET  /api/exams/audit/logs
GET  /api/exams/audit/grade/:gradeId/history
POST /api/exams/corrections
POST /api/exams/corrections/:id/approve
POST /api/exams/corrections/:id/reject
POST /api/exams/corrections/:id/apply
```

---

# 3. Rôles & permissions

## Rôles principaux

```text
PLATFORM_OWNER
PLATFORM_ADMIN
PROMOTER
SCHOOL_DIRECTOR
ACADEMIC_DIRECTOR
CENSOR
TEACHER
SECRETARY
PARENT
STUDENT
```

## Permissions critiques

| Action                    | Rôles autorisés                        |
| ------------------------- | -------------------------------------- |
| Configurer règles         | Direction / Admin                      |
| Créer évaluation          | Direction / Enseignant autorisé        |
| Saisir notes              | Enseignant autorisé / Admin académique |
| Valider notes             | Direction / Censeur                    |
| Verrouiller période       | Direction                              |
| Générer bulletins         | Direction / Secrétariat autorisé       |
| Publier bulletins         | Direction                              |
| Corriger note verrouillée | Direction après demande                |
| Voir audit                | Direction / Platform Admin             |

---

# 4. Flux global du module

```text
Paramétrage
   ↓
Création évaluations
   ↓
Saisie notes
   ↓
Soumission
   ↓
Validation direction
   ↓
Calcul moyennes
   ↓
Classement
   ↓
Conseil de classe
   ↓
Génération bulletin
   ↓
Publication
   ↓
Archivage + ORION
```

---

# 5. Architecture backend recommandée

## Dossiers

```text
src/modules/exams
├── controllers
├── services
├── repositories
├── validators
├── calculators
├── pdf
├── analytics
├── orion
├── audit
└── dto
```

## Services clés

```ts
ExamSettingsService
EvaluationService
GradeEntryService
GradeValidationService
AverageCalculationService
RankingService
ClassCouncilService
BulletinService
BulletinPdfService
AcademicAnalyticsService
AcademicAuditService
ExamOrionService
```

---

# 6. Architecture frontend recommandée

## Dossiers

```text
app/(school)/exams
├── dashboard
├── settings
├── evaluations
├── grades-entry
├── validation
├── averages-rankings
├── class-councils
├── bulletins
├── analytics
└── audit
```

## Composants partagés

```text
components/exams
├── filters
├── tables
├── modals
├── forms
├── charts
├── bulletin-preview
└── status-badges
```

---

# 7. Sécurité technique

## Obligatoire

```text
- tenantId obligatoire sur toutes les requêtes
- academicYearId obligatoire
- RBAC strict
- audit automatique
- aucune suppression physique
- verrouillage transactionnel
- validation Zod côté API
- transactions Prisma
- pagination serveur
- rate limiting sur import/export
```

---

# 8. Triggers SQL critiques

À prévoir :

```sql
-- empêcher modification note LOCKED
-- empêcher suppression note validée
-- empêcher création évaluation sur période verrouillée
-- auditer changement de note
-- empêcher bulletin publié d’être modifié
-- empêcher cross-tenant par RLS si activé
```

---

# 9. Points à ne pas rater

Voici les erreurs qui tuent ce type de module :

```text
❌ calculer les moyennes sur des notes brouillon
❌ modifier un bulletin publié sans snapshot
❌ ne pas historiser les corrections
❌ mélanger paramètres globaux et règles par classe
❌ ne pas gérer les absences
❌ ne pas gérer les ex æquo
❌ ne pas verrouiller les périodes
❌ oublier le blocage Finance des bulletins
❌ ne pas prévoir l’import Excel
❌ ne pas prévoir les modèles de bulletins
```

---

# 10. Ordre d’implémentation conseillé

Pour Cursor, il faut construire dans cet ordre :

```text
1. BDD Prisma complète
2. Paramétrage académique
3. Évaluations
4. Saisie notes
5. Validation/verrouillage
6. Calcul moyennes
7. Classements
8. Bulletins PDF
9. Conseils de classe
10. Analytics ORION
11. Audit académique
```

---

# Conclusion

Le Module Examen doit être traité comme un **module institutionnel sensible**.

Il doit être :

```text
fiable
verrouillé
auditable
configurable
connecté à ORION
connecté au module Finance
compatible bulletins officiels
```

Parfait. On attaque **Onglet 1 — Tableau de bord Examens** du **Module 3 — Examens, Notes & Bulletins** de **Academia Helm**, en mode propre : **Frontend + BDD + Backend + règles métier + instructions Google Antigravity**.

---

# MODULE 3 — EXAMENS, NOTES & BULLETINS

## ONGLET 1 — TABLEAU DE BORD EXAMENS

---

# 1. Objectif de l’onglet

Le **Tableau de bord Examens** est l’écran de pilotage académique immédiat.

Il permet à la direction, au censeur et à l’administration académique de voir rapidement :

* l’état des évaluations ;
* l’avancement de la saisie des notes ;
* les notes manquantes ;
* les lots soumis à validation ;
* les classes prêtes pour calcul des moyennes ;
* les bulletins générés ou publiés ;
* les alertes pédagogiques ORION ;
* l’activité récente du module.

👉 Ce n’est pas une page décorative.
C’est le **centre de contrôle opérationnel du module Examen**.

---

# 2. Positionnement dans l’application

## Route frontend

```txt
/exams/dashboard
```

## Nom affiché dans le menu

```txt
Tableau de bord
```

## Module parent

```txt
Examens, Notes & Bulletins
```

## Accès recommandé

```txt
Direction
Censeur
Administration académique
Secrétariat académique
Promoteur
Platform Admin
```

Les enseignants peuvent avoir une vue limitée à leurs propres classes et matières si l’école l’active dans les paramètres.

---

# 3. Rôle stratégique de l’onglet

Cet onglet doit répondre à 5 questions :

```txt
1. Où en est la saisie des notes ?
2. Quelles classes sont en retard ?
3. Quelles évaluations posent problème ?
4. Quels bulletins sont prêts ou bloqués ?
5. Quelles anomalies ORION détecte ?
```

C’est donc une page **directionnelle**, pas une simple liste.

---

# 4. Frontend

---

## 4.1 Page principale

```txt
app/(school)/exams/dashboard/page.tsx
```

---

## 4.2 Composants à créer

```txt
components/exams/dashboard/ExamDashboardPage.tsx
components/exams/dashboard/ExamDashboardFilters.tsx
components/exams/dashboard/ExamKpiCards.tsx
components/exams/dashboard/ExamProgressChart.tsx
components/exams/dashboard/ClassExamProgressTable.tsx
components/exams/dashboard/PendingGradesWidget.tsx
components/exams/dashboard/BulletinStatusWidget.tsx
components/exams/dashboard/OrionAcademicAlerts.tsx
components/exams/dashboard/RecentExamActivity.tsx
components/exams/dashboard/ExamQuickActions.tsx
```

---

## 4.3 Structure visuelle recommandée

```txt
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TABLEAU DE BORD EXAMENS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Filtres : Année | Période | Niveau | Classe | Série | Langue]

[KPI Cards]

[Graphique progression saisie]

[Tableau avancement par classe]

[Notes manquantes] [Statut bulletins]

[Alertes ORION]

[Activité récente]
```

---

## 4.4 Filtres obligatoires

```txt
Année scolaire
Période
Niveau
Classe
Série
Langue
Statut évaluation
```

### Langue

```txt
FR
EN
GLOBAL
```

La langue est importante pour les écoles bilingues.

---

## 4.5 KPI Cards

Les cartes KPI doivent afficher :

```txt
Classes actives
Évaluations créées
Évaluations ouvertes à la saisie
Notes saisies
Notes manquantes
Taux de saisie
Lots soumis
Lots validés
Classes prêtes pour moyennes
Bulletins générés
Bulletins publiés
Alertes ORION
```

---

## 4.6 Exemple d’affichage KPI

```txt
Classes actives : 18
Évaluations créées : 124
Notes saisies : 4 820
Notes manquantes : 316
Taux de saisie : 93,8 %
Bulletins générés : 740
Alertes ORION : 6
```

---

## 4.7 Tableau d’avancement par classe

### Colonnes

```txt
Classe
Niveau
Élèves
Évaluations
Notes attendues
Notes saisies
Notes manquantes
Taux saisie
Taux validation
Statut bulletin
Actions
```

---

## 4.8 Statuts bulletin

```txt
NOT_READY
READY
GENERATED
PUBLISHED
BLOCKED_BY_FINANCE
```

---

## 4.9 Actions rapides

Depuis le dashboard, l’utilisateur doit pouvoir accéder rapidement à :

```txt
Créer une évaluation
Saisir les notes
Valider les notes
Calculer les moyennes
Générer les bulletins
Voir les alertes ORION
```

---

# 5. Backend

---

## 5.1 Routes API

```http
GET /api/exams/dashboard
GET /api/exams/dashboard/kpis
GET /api/exams/dashboard/progress
GET /api/exams/dashboard/classes-progress
GET /api/exams/dashboard/pending-grades
GET /api/exams/dashboard/bulletins-status
GET /api/exams/dashboard/recent-activity
GET /api/exams/dashboard/orion-alerts
```

---

## 5.2 Query params

```ts
academicYearId: string
periodId?: string
levelId?: string
classId?: string
seriesId?: string
language?: "FR" | "EN" | "GLOBAL"
```

---

## 5.3 Services backend à créer

```txt
ExamDashboardService
ExamKpiService
ExamProgressService
PendingGradesService
BulletinDashboardService
ExamRecentActivityService
ExamOrionAlertService
```

---

## 5.4 Réponse attendue de `/api/exams/dashboard`

```ts
type ExamDashboardResponse = {
  filters: {
    academicYearId: string
    periodId?: string
    levelId?: string
    classId?: string
    language?: "FR" | "EN" | "GLOBAL"
  }

  kpis: {
    activeClasses: number
    totalEvaluations: number
    openEvaluations: number
    enteredGrades: number
    missingGrades: number
    gradeEntryRate: number
    submittedBatches: number
    validatedBatches: number
    readyClassesForAverages: number
    generatedBulletins: number
    publishedBulletins: number
    orionAlerts: number
  }

  classProgress: Array<{
    classId: string
    className: string
    levelName: string
    totalStudents: number
    totalEvaluations: number
    enteredGrades: number
    expectedGrades: number
    missingGrades: number
    gradeEntryRate: number
    validationRate: number
    bulletinStatus: "NOT_READY" | "READY" | "GENERATED" | "PUBLISHED" | "BLOCKED_BY_FINANCE"
  }>

  pendingGrades: Array<{
    evaluationId: string
    evaluationTitle: string
    className: string
    subjectName: string
    teacherName?: string
    missingCount: number
    dueDate?: string
  }>

  bulletinStatus: {
    totalExpected: number
    generated: number
    published: number
    blockedByFinance: number
  }

  orionAlerts: Array<{
    id: string
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    title: string
    message: string
    scopeType: "GLOBAL" | "LEVEL" | "CLASS" | "SUBJECT" | "STUDENT"
    scopeId?: string
    createdAt: string
  }>

  recentActivity: Array<{
    id: string
    action: string
    entityType: string
    actorName: string
    createdAt: string
  }>
}
```

---

# 6. Base de données

---

## 6.1 Tables utilisées

L’onglet Tableau de bord ne crée pas forcément beaucoup de tables métier. Il agrège les données existantes.

Tables utilisées :

```txt
academic_years
academic_periods
school_levels
classes
series
students
student_enrollments
subjects
teacher_assignments
evaluations
grades
grade_validation_batches
grade_locks
student_subject_averages
student_period_averages
bulletins
orion_alerts
academic_audit_logs
```

---

## 6.2 Table optionnelle : snapshot dashboard

Pour optimiser les performances, surtout quand l’école aura beaucoup d’élèves, on peut ajouter une table de snapshot.

```prisma
model ExamDashboardSnapshot {
  id             String   @id @default(cuid())
  tenantId       String
  academicYearId String
  periodId       String?

  scopeType      DashboardScopeType
  scopeId        String?

  dataJson       Json
  calculatedAt   DateTime @default(now())

  createdAt      DateTime @default(now())

  @@index([tenantId, academicYearId, periodId])
  @@index([scopeType, scopeId])
}

enum DashboardScopeType {
  GLOBAL
  LEVEL
  CLASS
  SERIES
}
```

---

## 6.3 Pourquoi cette table est utile

Elle permet :

* d’éviter de recalculer tous les KPI à chaque chargement ;
* d’accélérer les dashboards direction ;
* de stocker des états historiques ;
* d’alimenter ORION plus proprement.

👉 Pour le MVP, on peut commencer sans snapshot.
👉 Pour la version production sérieuse, le snapshot devient recommandé.

---

# 7. Règles métier

---

## 7.1 Règles générales

```txt
1. Le dashboard affiche uniquement les données du tenant courant.
2. L’année scolaire active est sélectionnée par défaut.
3. La période active est sélectionnée par défaut si elle existe.
4. Les notes brouillon comptent dans “notes saisies”.
5. Les notes brouillon ne comptent pas dans “notes validées”.
6. Les moyennes sont prêtes uniquement si les notes obligatoires sont validées.
7. Les bulletins sont publiables uniquement après validation académique.
8. Les bulletins peuvent être bloqués par Finance si la politique est activée.
9. Les alertes ORION sont en lecture seule.
10. Les enseignants ne voient que leurs propres classes/matières.
```

---

## 7.2 Règle de calcul du taux de saisie

```txt
Taux de saisie =
(notes saisies / notes attendues) × 100
```

---

## 7.3 Notes attendues

```txt
Notes attendues =
nombre d’élèves actifs × nombre d’évaluations obligatoires
```

---

## 7.4 Classe prête pour calcul des moyennes

Une classe est prête si :

```txt
- toutes les évaluations obligatoires sont terminées ;
- toutes les notes obligatoires sont validées ;
- aucun verrou bloquant n’est incohérent ;
- la période n’est pas en erreur ;
- les matières obligatoires sont couvertes.
```

---

## 7.5 Bulletin prêt

Un bulletin est prêt si :

```txt
- moyennes calculées ;
- classement calculé ;
- décision conseil disponible si exigée ;
- template bulletin disponible ;
- aucune erreur critique ;
- aucune restriction Finance bloquante.
```

---

# 8. Sécurité

---

## 8.1 Contrôles obligatoires

```txt
Authentification obligatoire
tenantId dérivé de la session
academicYearId obligatoire
RBAC strict
Aucun accès cross-tenant
Pagination serveur
Cache contrôlé
Audit des accès sensibles
```

---

## 8.2 Permissions à créer

```ts
EXAMS_DASHBOARD_VIEW
EXAMS_DASHBOARD_VIEW_ALL
EXAMS_DASHBOARD_VIEW_OWN_CLASSES
EXAMS_ORION_ALERTS_VIEW
EXAMS_RECENT_ACTIVITY_VIEW
```

---

## 8.3 Accès par rôle

| Rôle               | Accès                        |
| ------------------ | ---------------------------- |
| PLATFORM_OWNER     | Global plateforme            |
| PLATFORM_ADMIN     | Global plateforme            |
| PROMOTER           | Toutes les écoles du tenant  |
| SCHOOL_DIRECTOR    | Tout le dashboard école      |
| ACADEMIC_DIRECTOR  | Tout le dashboard académique |
| CENSOR             | Tout le dashboard académique |
| SECRETARY_ACADEMIC | Vue opérationnelle           |
| TEACHER            | Vue limitée si activée       |
| PARENT             | Aucun accès                  |
| STUDENT            | Aucun accès                  |

---

# 9. ORION dans cet onglet

---

## 9.1 Rôle d’ORION

ORION doit détecter et afficher les anomalies pédagogiques importantes.

Exemples :

```txt
Classe avec taux de saisie faible
Matière avec trop de notes manquantes
Évaluation non saisie après échéance
Enseignant en retard de soumission
Classe prête mais bulletin non généré
Taux d’échec inhabituel
Notes trop uniformes
Chute brutale de performance
```

---

## 9.2 Types d’alertes

```txt
LOW
MEDIUM
HIGH
CRITICAL
```

---

## 9.3 Exemple d’alerte

```txt
CRITICAL — Notes manquantes importantes

La classe de 3ème A présente 42 notes manquantes pour la période Trimestre 1.
Action recommandée : relancer les enseignants concernés avant validation.
```

---

# 10. États UI à prévoir

---

## 10.1 Loading state

Afficher des skeletons propres :

```txt
Chargement des indicateurs...
Chargement de la progression...
Chargement des alertes ORION...
```

---

## 10.2 Empty state

Exemple :

```txt
Aucune évaluation créée pour cette période.
Commencez par créer une évaluation.
```

---

## 10.3 Error state

Exemple :

```txt
Impossible de charger le tableau de bord Examens.
Veuillez réessayer ou contacter l’administrateur.
```

---

# 11. Instructions Google Antigravity

---

## Mission

Implémenter l’**Onglet 1 — Tableau de bord Examens** du **Module 3 — Examens, Notes & Bulletins** d’Academia Helm.

---

## Contraintes techniques

```txt
Stack : Next.js / React / TypeScript / Prisma / PostgreSQL
Architecture multi-tenant stricte
tenantId toujours récupéré depuis la session
Aucun accès cross-tenant
Année scolaire obligatoire
Période optionnelle mais recommandée
RBAC obligatoire
Interface professionnelle, institutionnelle, responsive
Prévoir loading, empty states, error states
Prévoir composants réutilisables
```

---

## À créer côté frontend

```txt
Page /exams/dashboard

Composants :
- ExamDashboardPage
- ExamDashboardFilters
- ExamKpiCards
- ExamProgressChart
- ClassExamProgressTable
- PendingGradesWidget
- BulletinStatusWidget
- OrionAcademicAlerts
- RecentExamActivity
- ExamQuickActions
```

---

## À créer côté backend

```txt
Route principale :
GET /api/exams/dashboard

Routes secondaires :
GET /api/exams/dashboard/kpis
GET /api/exams/dashboard/progress
GET /api/exams/dashboard/classes-progress
GET /api/exams/dashboard/pending-grades
GET /api/exams/dashboard/bulletins-status
GET /api/exams/dashboard/recent-activity
GET /api/exams/dashboard/orion-alerts
```

---

## Services à créer

```txt
ExamDashboardService
ExamKpiService
ExamProgressService
PendingGradesService
BulletinDashboardService
ExamRecentActivityService
ExamOrionAlertService
```

---

## À créer côté BDD

```txt
Utiliser les tables existantes du module examens.
Ajouter optionnellement ExamDashboardSnapshot.
Indexer tenantId, academicYearId, periodId, classId.
```

---

## Résultat attendu

Google Antigravity doit produire :

```txt
Un dashboard examens complet,
rapide,
sécurisé,
filtrable,
orienté direction,
connecté aux données réelles,
préparé pour ORION,
compatible multi-tenant,
et prêt pour l’évolution production.
```

---

# 12. Ordre d’implémentation recommandé

```txt
1. Créer les types TypeScript du dashboard
2. Créer les endpoints backend
3. Créer les services d’agrégation
4. Créer les composants frontend
5. Connecter les filtres
6. Ajouter les états loading/empty/error
7. Ajouter les permissions RBAC
8. Ajouter les alertes ORION
9. Tester avec données fictives
10. Tester avec données réelles
```

---

# 13. Points critiques à ne pas rater

```txt
Ne jamais prendre tenantId depuis le frontend.
Ne jamais calculer les moyennes sur des notes brouillon.
Ne jamais afficher les données d’une autre école.
Ne pas confondre notes saisies et notes validées.
Ne pas publier un bulletin non validé.
Ne pas oublier le blocage Finance.
Ne pas oublier les écoles bilingues.
Ne pas oublier les séries du secondaire.
Ne pas oublier les classes maternelle 1 et maternelle 2.
```

---

# Conclusion

L’**Onglet 1 — Tableau de bord Examens** doit être traité comme le **poste de commandement académique**.

Il doit permettre à la direction de savoir immédiatement :

```txt
ce qui est prêt,
ce qui est bloqué,
ce qui est en retard,
ce qui est risqué,
et ce qu’il faut faire maintenant.
```

C’est exactement ce qui donnera à Academia Helm une sensation de plateforme sérieuse, institutionnelle et intelligente.

---
Parfait. On attaque **Onglet 2 — Paramétrage académique** du **Module 3 — Examens, Notes & Bulletins** de **Academia Helm**.

Ici, on construit le **moteur de configuration académique**. C’est une zone sensible : si ce paramétrage est mal conçu, les notes, moyennes, classements et bulletins seront mécaniquement faux. Donc on va faire ça proprement, sans bricolage Excel déguisé en SaaS.

---

# MODULE 3 — EXAMENS, NOTES & BULLETINS

## ONGLET 2 — PARAMÉTRAGE ACADÉMIQUE

---

# 1. Objectif de l’onglet

L’onglet **Paramétrage académique** permet de configurer tout le moteur d’évaluation de l’école :

* périodes académiques ;
* barèmes de notation ;
* types d’évaluations ;
* règles de calcul ;
* coefficients ;
* mentions ;
* décisions académiques ;
* templates de bulletins ;
* politiques de publication ;
* paramètres avancés.

👉 C’est le **socle mathématique et institutionnel** du module Examen.

---

# 2. Positionnement dans l’application

## Route frontend

```txt
/exams/settings
```

## Nom affiché dans le menu

```txt
Paramétrage académique
```

## Module parent

```txt
Examens, Notes & Bulletins
```

---

# 3. Acteurs autorisés

## Accès gestion

```txt
PLATFORM_OWNER
PLATFORM_ADMIN
PROMOTER
SCHOOL_DIRECTOR
ACADEMIC_DIRECTOR
CENSOR
```

## Accès lecture possible

```txt
SECRETARY_ACADEMIC
TEACHER selon configuration
```

---

# 4. Structure de l’onglet

L’onglet doit être organisé en sous-sections internes :

```txt
Paramétrage académique
├── Périodes
├── Barèmes
├── Types d’évaluations
├── Calculs
├── Coefficients
├── Mentions
├── Décisions
├── Bulletins
├── Publication
└── Avancé
```

---

# 5. Frontend

---

## 5.1 Page principale

```txt
app/(school)/exams/settings/page.tsx
```

---

## 5.2 Composants à créer

```txt
components/exams/settings/ExamSettingsPage.tsx
components/exams/settings/ExamSettingsTabs.tsx
components/exams/settings/AcademicPeriodManager.tsx
components/exams/settings/GradeScaleManager.tsx
components/exams/settings/EvaluationTypeManager.tsx
components/exams/settings/CalculationRuleBuilder.tsx
components/exams/settings/CoefficientInheritancePanel.tsx
components/exams/settings/MentionAppreciationManager.tsx
components/exams/settings/AcademicDecisionManager.tsx
components/exams/settings/BulletinTemplateManager.tsx
components/exams/settings/PublicationPolicyPanel.tsx
components/exams/settings/ExamAdvancedSettingsPanel.tsx
components/exams/settings/SettingsAuditTimeline.tsx
```

---

## 5.3 UX attendue

Interface professionnelle, structurée et sécurisée.

### Haut de page

```txt
Paramétrage académique

[Année scolaire] [Niveau] [Classe] [Série] [Langue]
```

### Zone principale

```txt
Tabs internes :
Périodes | Barèmes | Types | Calculs | Coefficients | Mentions | Décisions | Bulletins | Publication | Avancé
```

### Alerte importante

Si des notes existent déjà, afficher :

```txt
Attention : des notes ont déjà été saisies pour cette année scolaire.
Toute modification des règles de calcul peut impacter les moyennes.
```

---

# 6. Sous-section 1 — Périodes académiques

---

## 6.1 Objectif

Définir les périodes d’évaluation :

```txt
Trimestre
Semestre
Séquence
Annuel
```

---

## 6.2 Champs

```txt
Nom
Code
Type
Date début
Date fin
Ordre
Actif
Verrouillé
```

---

## 6.3 Modèle Prisma

```prisma
model AcademicPeriod {
  id             String   @id @default(cuid())
  tenantId       String
  academicYearId String

  name           String
  code           String
  type           AcademicPeriodType
  startDate      DateTime
  endDate        DateTime
  orderIndex     Int

  isActive       Boolean  @default(true)
  isLocked       Boolean  @default(false)

  createdById    String?
  updatedById    String?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([tenantId, academicYearId])
  @@unique([tenantId, academicYearId, code])
}

enum AcademicPeriodType {
  TRIMESTER
  SEMESTER
  SEQUENCE
  ANNUAL
}
```

---

## 6.4 Règles métier

```txt
1. Une période appartient toujours à une année scolaire.
2. Deux périodes du même type ne doivent pas se chevaucher.
3. Une période verrouillée ne peut plus être modifiée.
4. Une période verrouillée bloque la création d’évaluations.
5. Une période verrouillée bloque la modification des notes.
6. L’ordre des périodes doit être unique dans une même année scolaire.
```

---

# 7. Sous-section 2 — Barèmes de notation

---

## 7.1 Objectif

Définir les échelles de notation :

```txt
/20
/10
/100
Personnalisé
```

---

## 7.2 Modèle Prisma

```prisma
model GradeScale {
  id        String   @id @default(cuid())
  tenantId  String

  name      String
  code      String
  maxScore  Decimal  @db.Decimal(6,2)
  minScore  Decimal  @db.Decimal(6,2) @default(0)
  passScore Decimal  @db.Decimal(6,2)

  isDefault Boolean  @default(false)
  isActive  Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, code])
  @@index([tenantId])
}
```

---

## 7.3 Règles métier

```txt
1. Un barème par défaut est obligatoire.
2. Une note ne peut jamais dépasser le maxScore.
3. Une note ne peut jamais être inférieure au minScore.
4. Les notes doivent être normalisées pour les calculs.
5. Un barème utilisé par des évaluations ne doit pas être supprimé.
```

---

# 8. Sous-section 3 — Types d’évaluations

---

## 8.1 Objectif

Configurer les types d’évaluations :

```txt
Interrogation
Devoir
Composition
Examen blanc
Oral
Pratique
Projet
```

---

## 8.2 Modèle Prisma

```prisma
model EvaluationType {
  id           String   @id @default(cuid())
  tenantId     String

  name         String
  code         String
  description  String?

  weight       Decimal  @db.Decimal(6,2) @default(1)
  isMandatory  Boolean  @default(true)
  isExam       Boolean  @default(false)
  isActive     Boolean  @default(true)

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([tenantId, code])
  @@index([tenantId])
}
```

---

## 8.3 Règles métier

```txt
1. Chaque type possède un poids par défaut.
2. Un type obligatoire doit être pris en compte dans le calcul.
3. Un type désactivé ne peut plus être utilisé pour de nouvelles évaluations.
4. Les évaluations existantes gardent leur type historique.
```

---

# 9. Sous-section 4 — Règles de calcul

---

## 9.1 Objectif

Définir comment Academia Helm calcule les moyennes.

---

## 9.2 Types de formules

```txt
Moyenne simple
Moyenne pondérée
Devoir + composition
Formule personnalisée JSON
```

---

## 9.3 Modèle Prisma

```prisma
model ExamCalculationRule {
  id              String   @id @default(cuid())
  tenantId        String
  academicYearId  String

  name            String
  description     String?

  levelId         String?
  classId         String?
  seriesId        String?

  periodType      AcademicPeriodType
  formulaType     CalculationFormulaType
  configJson      Json

  absencePolicy   AbsenceGradePolicy @default(EXCLUDE_FROM_AVERAGE)
  rankingPolicy   RankingPolicy      @default(DENSE_RANK)

  isDefault       Boolean @default(false)
  isActive        Boolean @default(true)

  createdById     String?
  updatedById     String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId, academicYearId])
  @@index([levelId, classId, seriesId])
}

enum CalculationFormulaType {
  SIMPLE_AVERAGE
  WEIGHTED_AVERAGE
  DUTY_COMPOSITION
  CUSTOM_JSON_RULE
}

enum AbsenceGradePolicy {
  ZERO
  EXCLUDE_FROM_AVERAGE
  NOT_CLASSIFIED
}

enum RankingPolicy {
  DENSE_RANK
  COMPETITION_RANK
  UNIQUE_WITH_TIE_BREAKERS
}
```

---

## 9.4 Exemple de configuration JSON

```json
{
  "baseScale": 20,
  "subjectAverage": {
    "method": "weighted_evaluation_average"
  },
  "generalAverage": {
    "method": "weighted_subject_average",
    "useSubjectCoefficients": true
  },
  "requiredEvaluationTypes": ["COMPOSITION"],
  "rounding": {
    "mode": "HALF_UP",
    "precision": 2
  }
}
```

---

## 9.5 Règles métier

```txt
1. Une règle active par défaut est obligatoire.
2. Une règle classe surcharge une règle niveau.
3. Une règle série surcharge une règle niveau si applicable.
4. Les coefficients viennent du module Organisation pédagogique.
5. Une modification après saisie des notes déclenche une alerte et un audit.
6. Les règles doivent être versionnées si elles impactent des calculs déjà effectués.
```

---

# 10. Sous-section 5 — Coefficients & héritage pédagogique

---

## 10.1 Objectif

Contrôler les coefficients utilisés dans les moyennes.

Les coefficients viennent principalement du **Module 2 — Organisation pédagogique**.

---

## 10.2 Logique d’héritage

```txt
1. Coefficient matière global
2. Coefficient par niveau
3. Coefficient par série
4. Coefficient par classe
```

👉 Le niveau le plus spécifique gagne.

---

## 10.3 Table optionnelle de surcharge

```prisma
model ExamSubjectCoefficientOverride {
  id             String   @id @default(cuid())
  tenantId       String
  academicYearId String

  subjectId      String
  levelId        String?
  classId        String?
  seriesId       String?

  coefficient    Decimal  @db.Decimal(6,2)
  reason         String?

  isActive       Boolean @default(true)

  createdById    String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([tenantId, academicYearId])
  @@index([subjectId, levelId, classId, seriesId])
}
```

---

## 10.4 Règles métier

```txt
1. Les coefficients principaux restent dans le module pédagogique.
2. Les surcharges doivent être exceptionnelles et auditées.
3. Une matière obligatoire sans coefficient bloque le calcul.
4. Une classe sans configuration matière bloque les moyennes.
```

---

# 11. Sous-section 6 — Mentions & appréciations

---

## 11.1 Objectif

Définir les mentions selon les moyennes.

---

## 11.2 Modèle Prisma

```prisma
model AcademicMentionRule {
  id             String   @id @default(cuid())
  tenantId       String
  academicYearId String?

  name           String
  minAverage     Decimal  @db.Decimal(5,2)
  maxAverage     Decimal  @db.Decimal(5,2)
  appreciation   String?

  language       BulletinLanguage @default(FR)
  isActive       Boolean @default(true)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([tenantId, academicYearId])
}

enum BulletinLanguage {
  FR
  EN
  BILINGUAL
}
```

---

## 11.3 Exemples de mentions

```txt
16 à 20      : Très Bien
14 à 15.99   : Bien
12 à 13.99   : Assez Bien
10 à 11.99   : Passable
0 à 9.99     : Insuffisant
```

---

## 11.4 Règles métier

```txt
1. Les intervalles ne doivent pas se chevaucher.
2. Les intervalles doivent couvrir toute l’échelle utile.
3. Les mentions peuvent être différentes en FR et EN.
4. Les mentions sont snapshotées dans le bulletin.
```

---

# 12. Sous-section 7 — Décisions académiques

---

## 12.1 Objectif

Configurer les décisions possibles :

```txt
Admis
Redouble
Avertissement
Encouragement
Tableau d’honneur
Passage conditionnel
Orientation recommandée
```

---

## 12.2 Modèle Prisma

```prisma
model AcademicDecisionRule {
  id              String   @id @default(cuid())
  tenantId        String
  academicYearId  String?

  code            String
  label           String
  description     String?

  minAverage      Decimal? @db.Decimal(5,2)
  maxAverage      Decimal? @db.Decimal(5,2)

  requiresCouncil Boolean @default(true)
  isPositive      Boolean @default(false)
  isActive        Boolean @default(true)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([tenantId, code])
}
```

---

## 12.3 Règles métier

```txt
1. Les décisions finales doivent passer par le conseil de classe si requis.
2. Une décision ne doit pas être supprimée si elle a déjà été utilisée.
3. Les décisions doivent être historisées dans les bulletins.
```

---

# 13. Sous-section 8 — Templates de bulletins

---

## 13.1 Objectif

Configurer les modèles PDF de bulletins.

---

## 13.2 Modèle Prisma

```prisma
model BulletinTemplate {
  id          String   @id @default(cuid())
  tenantId    String

  name        String
  levelId     String?
  classId     String?
  seriesId    String?
  language    BulletinLanguage @default(FR)

  layoutJson  Json
  isDefault   Boolean @default(false)
  isActive    Boolean @default(true)

  createdById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([tenantId, levelId, classId, seriesId])
}
```

---

## 13.3 Le template doit gérer

```txt
Logo école
Identité école
Identité élève
Classe
Année scolaire
Période
Matières
Coefficients
Moyennes
Rang
Mention
Absences
Appréciation
Décision
Signature
Cachet
QR code
```

---

## 13.4 Règles métier

```txt
1. Un template par défaut est obligatoire.
2. Un template classe surcharge un template niveau.
3. Un bulletin publié conserve un snapshot du template.
4. QR code obligatoire pour vérification.
```

---

# 14. Sous-section 9 — Politiques de publication

---

## 14.1 Objectif

Définir les conditions de publication des bulletins.

---

## 14.2 Modèle Prisma

```prisma
model BulletinPublicationPolicy {
  id                      String   @id @default(cuid())
  tenantId                String
  academicYearId          String?

  requireGradeValidation  Boolean @default(true)
  requireClassCouncil     Boolean @default(true)
  requireDirectorApproval Boolean @default(true)
  blockIfFinanceDebt      Boolean @default(false)
  allowParentDownload     Boolean @default(true)
  allowStudentDownload    Boolean @default(false)

  publicationMode         BulletinPublicationMode @default(MANUAL)

  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  @@index([tenantId, academicYearId])
}

enum BulletinPublicationMode {
  MANUAL
  SCHEDULED
  AUTO_AFTER_APPROVAL
}
```

---

## 14.3 Règles métier

```txt
1. Publication impossible si notes non validées.
2. Publication impossible si conseil requis mais non terminé.
3. Si Finance bloque, le parent peut voir un message mais pas télécharger.
4. La publication automatique ne doit jamais ignorer les validations.
5. Tout changement de politique est audité.
```

---

# 15. Sous-section 10 — Paramètres avancés & verrouillage

---

## 15.1 Objectif

Contrôler les règles sensibles :

```txt
verrouillage des périodes
correction des notes
import Excel
arrondis
ex æquo
absences
visibilité parent
```

---

## 15.2 Modèle Prisma

```prisma
model ExamAdvancedSetting {
  id                                  String   @id @default(cuid())
  tenantId                            String
  academicYearId                      String?

  allowTeacherGradeEditAfterSubmit    Boolean @default(false)
  allowGradeCorrectionAfterLock       Boolean @default(false)
  requireCorrectionApproval           Boolean @default(true)
  allowExcelImport                    Boolean @default(true)
  allowExcelExport                    Boolean @default(true)

  roundingPrecision                   Int @default(2)
  roundingMode                        RoundingMode @default(HALF_UP)

  showClassAverageOnBulletin          Boolean @default(true)
  showSubjectRankOnBulletin           Boolean @default(true)
  showGeneralRankOnBulletin           Boolean @default(true)

  createdAt                           DateTime @default(now())
  updatedAt                           DateTime @updatedAt

  @@index([tenantId, academicYearId])
}

enum RoundingMode {
  HALF_UP
  HALF_DOWN
  FLOOR
  CEIL
}
```

---

# 16. Backend

---

## 16.1 Routes API

```http
GET    /api/exams/settings
GET    /api/exams/settings/audit

POST   /api/exams/periods
PATCH  /api/exams/periods/:id
POST   /api/exams/periods/:id/lock
POST   /api/exams/periods/:id/unlock

POST   /api/exams/grade-scales
PATCH  /api/exams/grade-scales/:id

POST   /api/exams/evaluation-types
PATCH  /api/exams/evaluation-types/:id

POST   /api/exams/calculation-rules
PATCH  /api/exams/calculation-rules/:id
POST   /api/exams/calculation-rules/:id/activate

POST   /api/exams/mentions
PATCH  /api/exams/mentions/:id

POST   /api/exams/decision-rules
PATCH  /api/exams/decision-rules/:id

POST   /api/exams/bulletin-templates
PATCH  /api/exams/bulletin-templates/:id
POST   /api/exams/bulletin-templates/:id/set-default

POST   /api/exams/publication-policy
PATCH  /api/exams/publication-policy/:id

POST   /api/exams/advanced-settings
PATCH  /api/exams/advanced-settings/:id
```

---

## 16.2 Services backend

```txt
ExamSettingsService
AcademicPeriodService
GradeScaleService
EvaluationTypeService
CalculationRuleService
CoefficientResolverService
MentionRuleService
AcademicDecisionRuleService
BulletinTemplateService
PublicationPolicyService
ExamAdvancedSettingService
ExamSettingsAuditService
```

---

# 17. Sécurité

---

## 17.1 Permissions

```ts
EXAMS_SETTINGS_VIEW
EXAMS_SETTINGS_MANAGE
EXAMS_PERIODS_MANAGE
EXAMS_CALCULATION_RULES_MANAGE
EXAMS_BULLETIN_TEMPLATES_MANAGE
EXAMS_PUBLICATION_POLICY_MANAGE
EXAMS_ADVANCED_SETTINGS_MANAGE
```

---

## 17.2 Contrôles obligatoires

```txt
tenantId toujours issu de la session
RBAC strict
Audit obligatoire
Aucune suppression destructive
Validation des règles avant activation
Protection des périodes verrouillées
Protection des configurations déjà utilisées
```

---

# 18. Audit

Chaque modification doit enregistrer :

```txt
entité
ancienne valeur
nouvelle valeur
utilisateur
date
raison si modification critique
```

---

## Actions auditées

```txt
création période
verrouillage période
modification barème
activation règle calcul
modification template bulletin
modification politique publication
modification paramètres avancés
```

Table recommandée :

```txt
academic_audit_logs
```

---

# 19. ORION dans cet onglet

---

## 19.1 Ce qu’ORION doit surveiller

```txt
changement de règle après saisie des notes
période verrouillée trop tôt
absence de barème par défaut
classe sans coefficient
template bulletin manquant
politique Finance incohérente
règle de calcul non couverte pour une classe
```

---

## 19.2 Exemple d’alerte ORION

```txt
HIGH — Règle de calcul modifiée après saisie des notes.

Cette modification peut impacter les moyennes déjà calculées.
Recalcul contrôlé recommandé.
```

---

# 20. Instructions Google Antigravity

---

## Mission

Implémenter l’**Onglet 2 — Paramétrage académique** du **Module 3 — Examens, Notes & Bulletins** d’Academia Helm.

---

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
```

---

## Contraintes

```txt
Multi-tenant strict
tenantId depuis session uniquement
RBAC obligatoire
Audit obligatoire
Aucune suppression destructive
Périodes verrouillables
Règles de calcul versionnables
Templates bulletins configurables
Support FR / EN / BILINGUAL
Compatible séries du secondaire
Compatible Maternelle 1 et Maternelle 2
```

---

## À créer côté frontend

```txt
Page /exams/settings
Onglets internes
Gestion périodes
Gestion barèmes
Gestion types évaluations
Builder règles de calcul
Gestion mentions
Gestion décisions
Gestion templates bulletins
Gestion politiques publication
Gestion paramètres avancés
Timeline audit
```

---

## À créer côté backend

```txt
Toutes les routes API listées
Services listés
Validations Zod
Transactions Prisma
Contrôles RBAC
Audit automatique
```

---

## À créer côté BDD

```txt
Modèles Prisma listés
Index tenantId / academicYearId
Contraintes d’unicité
Enums
Relations avec modules existants
```

---

# 21. Résultat attendu

Google Antigravity doit produire un paramétrage académique :

```txt
robuste
institutionnel
configurable
auditable
sécurisé
compatible bilingue
compatible séries
prêt pour les calculs
prêt pour les bulletins
prêt pour ORION
```

---

# Conclusion

L’**Onglet 2 — Paramétrage académique** est le **cerveau réglementaire du module Examen**.

C’est lui qui garantit que :

```txt
les notes sont cohérentes,
les moyennes sont justes,
les classements sont fiables,
les bulletins sont officiels,
et les décisions pédagogiques sont défendables.
```

Si cet onglet est bien fait, tout le reste du module Examen devient solide.

---

Très bien. On reprend **Onglet 2 — Paramétrage académique** en version **corrigée, consolidée et alignée** avec ta structure scolaire réelle.

Ici, il faut éviter une erreur de conception : traiter tous les niveaux comme s’ils fonctionnaient comme le secondaire. Ce serait techniquement simple, mais pédagogiquement faux. Academia Helm doit être plus intelligent que ça.

---

# MODULE 3 — EXAMENS, NOTES & BULLETINS

## ONGLET 2 — PARAMÉTRAGE ACADÉMIQUE

### Version consolidée avec Maternelle, Primaire, Secondaire et Bilingue pédagogique

---

# 1. Objectif de l’onglet

L’onglet **Paramétrage académique** est le centre de configuration du moteur d’évaluation d’Academia Helm.

Il doit permettre à chaque école de définir :

* ses périodes d’évaluation ;
* ses modes d’évaluation ;
* ses échelles qualitatives ;
* ses barèmes de notes ;
* ses types d’évaluations ;
* ses règles de calcul ;
* ses coefficients ;
* ses mentions ;
* ses décisions académiques ;
* ses modèles de bulletins ;
* ses politiques de publication ;
* son fonctionnement bilingue pédagogique.

Le principe central est simple :

```txt
L’école définit ses règles de calcul de notes, de moyennes, d’appréciations et de décisions.
```

Academia Helm fournit le moteur.
L’école configure sa logique.

---

# 2. Structure scolaire officielle à respecter

---

## 2.1 Maternelle

```txt
Maternelle 1
Maternelle 2
```

---

## 2.2 Primaire

```txt
CI
CP
CE1
CE2
CM1
CM2
```

---

## 2.3 Secondaire

### Premier cycle

```txt
6ème
5ème
4ème
3ème
```

### Second cycle

```txt
2nde
1ère
Tle
```

---

# 3. Logique d’évaluation par niveau

---

# 3.1 Maternelle — Évaluation qualitative

## Nature

Au niveau **Maternelle**, l’évaluation est :

```txt
qualitative
```

Il ne faut donc pas imposer :

* des notes chiffrées ;
* des coefficients ;
* des classements classiques ;
* des moyennes générales numériques.

---

## Échelle qualitative par défaut

Academia Helm doit intégrer par défaut :

```txt
TS = Très Satisfaisant
S  = Satisfaisant
PS = Peu Satisfaisant
NS = Non Satisfaisant
```

---

## Nombre d’évaluations

Par défaut :

```txt
3 évaluations pour l’année scolaire
```

Mais l’école peut décider :

```txt
du nombre d’évaluations
du nom des évaluations
des périodes d’observation
de la méthode de synthèse qualitative
```

Donc le système doit proposer 3 par défaut, mais rester configurable.

---

## Domaines évaluables

Exemples :

```txt
Langage
Motricité
Socialisation
Autonomie
Pré-mathématiques
Pré-lecture
Créativité
Comportement
Participation
Hygiène
Éveil sensoriel
```

---

# 3.2 Primaire — Quantitatif sans coefficient

## Nature

Au niveau **Primaire**, l’évaluation est :

```txt
quantitative avec appréciations
```

Les élèves reçoivent :

```txt
notes
appréciations
moyennes
bulletins
```

---

## Coefficient

Au Primaire :

```txt
coefficient = 1
```

Toutes les matières ont le même poids par défaut.

Le système peut prévoir une exception avancée, mais le comportement standard doit être :

```txt
Primaire = coefficient 1
```

---

## Types d’évaluations

```txt
Évaluations mensuelles
Évaluations certificatives
```

---

## Calculs configurables

L’école décide de la méthode de calcul :

```txt
moyenne mensuelle
moyenne séquentielle
moyenne trimestrielle
moyenne annuelle
```

Exemples :

```txt
moyenne simple
moyenne mensuelle + certificative
moyenne pondérée mensuelle/certificative
moyenne des notes validées uniquement
formule personnalisée
```

---

# 3.3 Secondaire — Quantitatif avec coefficients

## Nature

Au niveau **Secondaire**, l’évaluation est :

```txt
quantitative avec coefficients
```

Les élèves reçoivent :

```txt
notes
appréciations
moyennes par matière
moyennes générales
classements
bulletins
décisions pédagogiques
```

---

## Coefficients

Les coefficients peuvent dépendre de :

```txt
niveau
classe
cycle
série
matière
langue pédagogique
spécialité
```

Le second cycle doit pouvoir gérer les séries.

---

## Types d’évaluations

Exemples :

```txt
Interrogations
Devoirs surveillés
Compositions
Examens blancs
Travaux pratiques
Oraux
Projets
```

---

## Calculs configurables

L’école décide de la méthode de calcul :

```txt
moyenne séquentielle
moyenne trimestrielle
moyenne annuelle
moyenne par matière
moyenne générale
classement
```

Exemples :

```txt
moyenne simple
moyenne pondérée
interrogations + devoirs surveillés + composition
devoirs + composition
formule spécifique par série
formule spécifique par classe
```

---

# 4. Bilingue pédagogique

Point très important : le bilingue dans Academia Helm ne doit pas être une simple traduction d’interface.

Ce n’est pas seulement :

```txt
FR / EN dans les boutons
```

C’est un vrai système pédagogique bilingue.

---

## 4.1 Ce que le bilingue doit permettre

```txt
matières en français
matières en anglais
matières bilingues
évaluations en français
évaluations en anglais
enseignants affectés par langue
bulletins bilingues
appréciations bilingues
analyses ORION FR/EN
```

---

## 4.2 Langue pédagogique des matières

Chaque matière doit pouvoir avoir une langue pédagogique :

```txt
FR
EN
BILINGUAL
```

---

## 4.3 Exemples de matières en français

```txt
Français
Mathématiques
Histoire-Géographie
Sciences
Éducation civique
Lecture
Expression écrite
```

---

## 4.4 Exemples de matières en anglais

```txt
English Language
Mathematics in English
Science in English
Social Studies
Reading
Grammar
Phonics
Literature
```

---

## 4.5 Impact sur les bulletins

Le bulletin bilingue doit pouvoir afficher :

```txt
matières françaises
matières anglaises
appréciations françaises
appréciations anglaises
synthèse globale
synthèse par langue si activée
signature
cachet
QR code
```

---

# 5. Structure finale de l’onglet

L’onglet **Paramétrage académique** doit maintenant être structuré ainsi :

```txt
Paramétrage académique
├── Paramétrage par niveau scolaire
├── Périodes académiques
├── Échelles qualitatives
├── Barèmes de notation
├── Types d’évaluations
├── Règles de calcul
├── Coefficients & héritage pédagogique
├── Mentions & appréciations
├── Décisions académiques
├── Templates de bulletins
├── Politiques de publication
├── Bilingue pédagogique
├── Paramètres avancés
└── Audit des paramètres
```

C’est plus complet, plus propre, et surtout plus fidèle au terrain.

---

# 6. Frontend

---

## 6.1 Route

```txt
/exams/settings
```

---

## 6.2 Page principale

```txt
app/(school)/exams/settings/page.tsx
```

---

## 6.3 Composants à créer

```txt
components/exams/settings/ExamSettingsPage.tsx
components/exams/settings/ExamSettingsTabs.tsx
components/exams/settings/LevelEvaluationPolicyManager.tsx
components/exams/settings/AcademicPeriodManager.tsx
components/exams/settings/QualitativeScaleManager.tsx
components/exams/settings/GradeScaleManager.tsx
components/exams/settings/EvaluationTypeManager.tsx
components/exams/settings/CalculationRuleBuilder.tsx
components/exams/settings/CoefficientInheritancePanel.tsx
components/exams/settings/MentionAppreciationManager.tsx
components/exams/settings/AcademicDecisionManager.tsx
components/exams/settings/BulletinTemplateManager.tsx
components/exams/settings/PublicationPolicyPanel.tsx
components/exams/settings/BilingualPedagogySettings.tsx
components/exams/settings/ExamAdvancedSettingsPanel.tsx
components/exams/settings/SettingsAuditTimeline.tsx
```

---

## 6.4 UX recommandée

En haut :

```txt
Paramétrage académique

[Année scolaire] [Niveau] [Classe] [Série] [Langue pédagogique]
```

Ensuite :

```txt
Paramétrage par niveau | Périodes | Échelles qualitatives | Barèmes | Types | Calculs | Coefficients | Mentions | Décisions | Bulletins | Publication | Bilingue | Avancé | Audit
```

---

## 6.5 Affichage conditionnel intelligent

Le formulaire doit changer selon le niveau sélectionné.

### Si Maternelle

Afficher :

```txt
Échelle qualitative
Domaines évalués
Nombre d’évaluations
Synthèse qualitative
Bulletin qualitatif
```

Masquer :

```txt
coefficients
classement numérique
moyenne générale chiffrée obligatoire
```

---

### Si Primaire

Afficher :

```txt
barème
notes
appréciations
évaluations mensuelles
évaluations certificatives
méthodes de calcul
coefficient par défaut = 1
```

Masquer ou verrouiller :

```txt
coefficients différenciés
séries
```

---

### Si Secondaire

Afficher :

```txt
barème
types d’évaluations
coefficients
séries
moyennes
classements
règles de calcul avancées
```

---

# 7. Base de données — Enums principaux

---

## 7.1 Niveau scolaire

```prisma
enum SchoolStage {
  MATERNELLE
  PRIMAIRE
  SECONDAIRE
}
```

---

## 7.2 Classes officielles

```prisma
enum OfficialGradeCode {
  MATERNELLE_1
  MATERNELLE_2

  CI
  CP
  CE1
  CE2
  CM1
  CM2

  SIXIEME
  CINQUIEME
  QUATRIEME
  TROISIEME

  SECONDE
  PREMIERE
  TERMINALE
}
```

---

## 7.3 Cycle secondaire

```prisma
enum SecondaryCycle {
  FIRST_CYCLE
  SECOND_CYCLE
}
```

---

## 7.4 Mode d’évaluation

```prisma
enum EvaluationMode {
  QUALITATIVE
  QUANTITATIVE_NO_COEFFICIENT
  QUANTITATIVE_WITH_COEFFICIENT
}
```

---

## 7.5 Langue pédagogique

```prisma
enum PedagogicalLanguage {
  FR
  EN
  BILINGUAL
}
```

---

# 8. Base de données — Échelles qualitatives

---

## 8.1 Modèle Prisma

```prisma
model QualitativeScale {
  id        String @id @default(cuid())
  tenantId  String

  code      String
  label     String
  rank      Int
  isDefault Boolean @default(false)
  isActive  Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, code])
}
```

---

## 8.2 Valeurs par défaut

```txt
TS — Très Satisfaisant
S  — Satisfaisant
PS — Peu Satisfaisant
NS — Non Satisfaisant
```

---

# 9. Base de données — Politique d’évaluation par niveau

---

## 9.1 Modèle Prisma

```prisma
model LevelEvaluationPolicy {
  id                 String @id @default(cuid())
  tenantId           String
  academicYearId     String

  schoolStage        SchoolStage
  levelId            String?
  classId            String?
  seriesId           String?

  evaluationMode     EvaluationMode
  defaultCoefficient Decimal? @db.Decimal(6,2)

  qualitativeScaleId String?
  calculationRuleId  String?

  defaultEvaluationCount Int?

  isActive           Boolean @default(true)

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([tenantId, academicYearId])
  @@index([schoolStage, levelId, classId, seriesId])
}
```

---

## 9.2 Rôle de cette table

Elle permet de dire :

```txt
Pour la Maternelle, utiliser une logique qualitative.
Pour le Primaire, utiliser des notes avec coefficient 1.
Pour le Secondaire, utiliser des notes avec coefficients.
```

Et elle permet aussi les surcharges :

```txt
par classe
par série
par année scolaire
```

---

# 10. Base de données — Périodes académiques

---

## 10.1 Modèle Prisma

```prisma
model AcademicPeriod {
  id             String   @id @default(cuid())
  tenantId       String
  academicYearId String

  name           String
  code           String
  type           AcademicPeriodType
  startDate      DateTime
  endDate        DateTime
  orderIndex     Int

  isActive       Boolean  @default(true)
  isLocked       Boolean  @default(false)

  createdById    String?
  updatedById    String?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([tenantId, academicYearId])
  @@unique([tenantId, academicYearId, code])
}

enum AcademicPeriodType {
  MONTH
  SEQUENCE
  TRIMESTER
  SEMESTER
  ANNUAL
  CUSTOM
}
```

---

## 10.2 Pourquoi ajouter MONTH et CUSTOM

Parce que :

* le Primaire utilise des évaluations mensuelles ;
* certaines écoles peuvent avoir leurs propres périodes ;
* la Maternelle peut avoir des périodes d’observation personnalisées.

---

# 11. Base de données — Barèmes de notation

---

```prisma
model GradeScale {
  id        String   @id @default(cuid())
  tenantId  String

  name      String
  code      String
  maxScore  Decimal  @db.Decimal(6,2)
  minScore  Decimal  @db.Decimal(6,2) @default(0)
  passScore Decimal  @db.Decimal(6,2)

  isDefault Boolean  @default(false)
  isActive  Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([tenantId, code])
  @@index([tenantId])
}
```

---

# 12. Base de données — Types d’évaluations

---

```prisma
model EvaluationType {
  id            String   @id @default(cuid())
  tenantId      String

  name          String
  code          String
  description   String?

  schoolStage   SchoolStage?
  language      PedagogicalLanguage?

  weight        Decimal  @db.Decimal(6,2) @default(1)
  isMandatory   Boolean  @default(true)
  isExam        Boolean  @default(false)
  isActive      Boolean  @default(true)

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([tenantId, code])
  @@index([tenantId, schoolStage])
}
```

---

## 12.1 Exemples par niveau

### Maternelle

```txt
Observation 1
Observation 2
Observation 3
Évaluation comportementale
Évaluation de langage
```

### Primaire

```txt
Évaluation mensuelle
Évaluation certificative
Dictée
Lecture
Calcul mental
```

### Secondaire

```txt
Interrogation
Devoir surveillé
Composition
Examen blanc
TP
Oral
Projet
```

---

# 13. Base de données — Règles de calcul

---

```prisma
model ExamCalculationRule {
  id              String   @id @default(cuid())
  tenantId        String
  academicYearId  String

  name            String
  description     String?

  schoolStage     SchoolStage?
  levelId         String?
  classId         String?
  seriesId        String?
  language        PedagogicalLanguage?

  periodType      AcademicPeriodType
  formulaType     CalculationFormulaType
  configJson      Json

  absencePolicy   AbsenceGradePolicy @default(EXCLUDE_FROM_AVERAGE)
  rankingPolicy   RankingPolicy      @default(DENSE_RANK)

  version         Int @default(1)
  isDefault       Boolean @default(false)
  isActive        Boolean @default(true)

  createdById     String?
  updatedById     String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId, academicYearId])
  @@index([schoolStage, levelId, classId, seriesId, language])
}

enum CalculationFormulaType {
  QUALITATIVE_SYNTHESIS
  SIMPLE_AVERAGE
  WEIGHTED_AVERAGE
  MONTHLY_CERTIFICATIVE
  DUTY_COMPOSITION
  CUSTOM_JSON_RULE
}

enum AbsenceGradePolicy {
  ZERO
  EXCLUDE_FROM_AVERAGE
  NOT_CLASSIFIED
}

enum RankingPolicy {
  DENSE_RANK
  COMPETITION_RANK
  UNIQUE_WITH_TIE_BREAKERS
}
```

---

# 14. Exemple de règles de calcul

---

## 14.1 Maternelle

```json
{
  "mode": "QUALITATIVE_SYNTHESIS",
  "scale": ["TS", "S", "PS", "NS"],
  "defaultEvaluationCount": 3,
  "synthesisMethod": "MAJORITY",
  "allowTeacherNarrativeAppreciation": true,
  "displayNumericScore": false
}
```

---

## 14.2 Primaire

```json
{
  "mode": "MONTHLY_CERTIFICATIVE",
  "baseScale": 20,
  "defaultCoefficient": 1,
  "monthlyWeight": 0.4,
  "certificativeWeight": 0.6,
  "rounding": {
    "mode": "HALF_UP",
    "precision": 2
  }
}
```

---

## 14.3 Secondaire

```json
{
  "mode": "DUTY_COMPOSITION",
  "baseScale": 20,
  "useSubjectCoefficients": true,
  "subjectAverage": {
    "method": "weighted_evaluation_average"
  },
  "generalAverage": {
    "method": "weighted_subject_average"
  },
  "rounding": {
    "mode": "HALF_UP",
    "precision": 2
  }
}
```

---

# 15. Base de données — Bilingue pédagogique

---

```prisma
model BilingualPedagogyPolicy {
  id                               String @id @default(cuid())
  tenantId                         String
  academicYearId                   String?

  isEnabled                        Boolean @default(false)

  allowFrenchSubjects              Boolean @default(true)
  allowEnglishSubjects             Boolean @default(true)
  allowBilingualSubjects           Boolean @default(true)

  separateLanguageAverages         Boolean @default(false)
  showLanguageSectionsOnBulletin   Boolean @default(true)
  allowBilingualAppreciations      Boolean @default(true)

  createdAt                        DateTime @default(now())
  updatedAt                        DateTime @updatedAt

  @@index([tenantId, academicYearId])
}
```

---

# 16. Backend

---

## 16.1 Routes API principales

```http
GET    /api/exams/settings
GET    /api/exams/settings/audit

POST   /api/exams/level-policies
PATCH  /api/exams/level-policies/:id

POST   /api/exams/qualitative-scales
PATCH  /api/exams/qualitative-scales/:id

POST   /api/exams/periods
PATCH  /api/exams/periods/:id
POST   /api/exams/periods/:id/lock
POST   /api/exams/periods/:id/unlock

POST   /api/exams/grade-scales
PATCH  /api/exams/grade-scales/:id

POST   /api/exams/evaluation-types
PATCH  /api/exams/evaluation-types/:id

POST   /api/exams/calculation-rules
PATCH  /api/exams/calculation-rules/:id
POST   /api/exams/calculation-rules/:id/activate

POST   /api/exams/bilingual-policy
PATCH  /api/exams/bilingual-policy/:id
```

---

## 16.2 Services backend

```txt
ExamSettingsService
LevelEvaluationPolicyService
QualitativeScaleService
AcademicPeriodService
GradeScaleService
EvaluationTypeService
CalculationRuleService
CoefficientResolverService
BilingualPedagogyPolicyService
ExamSettingsAuditService
```

---

# 17. Règles métier critiques

```txt
1. Une classe de Maternelle ne doit pas exiger de note chiffrée.
2. Une classe de Maternelle doit utiliser une échelle qualitative.
3. Le nombre d’évaluations maternelle est 3 par défaut, mais personnalisable.
4. Une classe de Primaire doit avoir coefficient 1 par défaut.
5. Une classe de Primaire utilise des notes et appréciations.
6. Une classe de Secondaire utilise des coefficients.
7. Le second cycle secondaire peut dépendre d’une série.
8. L’école définit ses règles de calcul.
9. Les règles de calcul doivent être versionnées.
10. Le bilingue doit être pédagogique, pas seulement linguistique.
11. Les matières anglaises sont de vraies matières évaluables.
12. Les bulletins doivent respecter le mode d’évaluation du niveau.
13. ORION doit analyser séparément FR et EN si le bilingue est activé.
14. Toute modification sensible doit être auditée.
15. Une configuration utilisée ne doit jamais être supprimée physiquement.
```

---

# 18. Sécurité

---

## 18.1 Permissions

```ts
EXAMS_SETTINGS_VIEW
EXAMS_SETTINGS_MANAGE
EXAMS_LEVEL_POLICIES_MANAGE
EXAMS_QUALITATIVE_SCALES_MANAGE
EXAMS_CALCULATION_RULES_MANAGE
EXAMS_BILINGUAL_POLICY_MANAGE
EXAMS_BULLETIN_TEMPLATES_MANAGE
```

---

## 18.2 Contrôles

```txt
tenantId issu de la session uniquement
RBAC strict
audit obligatoire
aucune suppression destructive
validation Zod
transactions Prisma
verrouillage des périodes sensibles
```

---

# 19. Audit

Chaque modification sensible doit enregistrer :

```txt
entité modifiée
ancienne valeur
nouvelle valeur
utilisateur
date
raison si critique
adresse IP
user agent
```

Actions auditées :

```txt
modification du mode d’évaluation
modification de l’échelle qualitative
modification des règles de calcul
modification du bilingue
modification des coefficients
verrouillage/déverrouillage de période
```

---

# 20. ORION dans l’onglet 2

ORION doit détecter :

```txt
maternelle configurée avec notes chiffrées
primaire avec coefficient différent de 1 sans justification
secondaire sans coefficient
série sans règles de calcul
matière bilingue sans langue pédagogique
matière anglaise non évaluée
règle modifiée après saisie des notes
template bulletin incompatible avec le niveau
```

Exemple :

```txt
HIGH — Configuration incohérente détectée

La classe Maternelle 2 utilise une règle quantitative.
Action recommandée : basculer cette classe vers une évaluation qualitative.
```

---

# 21. Instructions Google Antigravity

---

## Mission

Implémenter l’**Onglet 2 — Paramétrage académique consolidé** du **Module 3 — Examens, Notes & Bulletins**.

---

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
```

---

## Contraintes

```txt
Multi-tenant strict
RBAC obligatoire
Audit obligatoire
Compatible Maternelle qualitative
Compatible Primaire coefficient 1
Compatible Secondaire avec coefficients
Compatible séries
Compatible bilingue pédagogique FR/EN
Règles de calcul personnalisables par école
Aucune suppression destructive
```

---

## À créer côté frontend

```txt
Page /exams/settings
LevelEvaluationPolicyManager
QualitativeScaleManager
AcademicPeriodManager
GradeScaleManager
EvaluationTypeManager
CalculationRuleBuilder
CoefficientInheritancePanel
BilingualPedagogySettings
SettingsAuditTimeline
```

---

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Transactions Prisma
Contrôles RBAC
Audit automatique
Gestion des règles par niveau
Gestion des règles par série
Gestion du bilingue pédagogique
```

---

## À créer côté BDD

```txt
Enums SchoolStage, OfficialGradeCode, SecondaryCycle
Enum EvaluationMode
Enum PedagogicalLanguage
Table QualitativeScale
Table LevelEvaluationPolicy
Table BilingualPedagogyPolicy
Adaptation EvaluationType
Adaptation ExamCalculationRule
Adaptation AcademicPeriod
```

---

# 22. Résultat attendu

Google Antigravity doit produire un paramétrage académique :

```txt
complet
configurable
sécurisé
auditable
adapté à la Maternelle
adapté au Primaire
adapté au Secondaire
compatible séries
compatible bilingue pédagogique
prêt pour les évaluations
prêt pour les moyennes
prêt pour les bulletins
prêt pour ORION
```

---

# Conclusion

Cet onglet est le **cerveau réglementaire du module Examen**.

Sa vraie force sera de permettre à chaque école de configurer son propre système sans casser la cohérence globale.

La bonne logique est donc :

```txt
Un seul module Examen,
mais plusieurs modes d’évaluation selon le niveau scolaire.
```

C’est exactement ce qui rend Academia Helm crédible pour gérer une école complète, de **Maternelle 1** jusqu’en **Terminale**.

---

Très bien. On passe à **Onglet 3 — Évaluations & Sessions** du **Module 3 — Examens, Notes & Bulletins**.

Ici, on ne parle pas encore de saisie des notes en détail. On parle d’abord de la **création, planification, organisation, validation et verrouillage des évaluations**.

C’est l’onglet qui transforme le paramétrage académique en actions concrètes.

---

# MODULE 3 — EXAMENS, NOTES & BULLETINS

## ONGLET 3 — ÉVALUATIONS & SESSIONS

---

# 1. Objectif de l’onglet

L’onglet **Évaluations & Sessions** permet de gérer toutes les évaluations de l’école :

* observations de Maternelle ;
* évaluations mensuelles du Primaire ;
* évaluations certificatives ;
* interrogations ;
* devoirs surveillés ;
* compositions ;
* examens blancs ;
* travaux pratiques ;
* oraux ;
* projets ;
* sessions d’examens.

Cet onglet sert de pont entre :

```txt
paramétrage académique
enseignants
classes
matières
domaines
périodes
saisie des résultats
bulletins
```

Son rôle est simple : **définir officiellement ce qui doit être évalué, quand, par qui, pour quelle classe et selon quelles règles**.

---

# 2. Principe général

Une évaluation doit toujours être rattachée à :

```txt
année scolaire
période académique
niveau scolaire
classe
matière ou domaine
enseignant responsable
type d’évaluation
mode d’évaluation
langue pédagogique si applicable
```

Sans ce contexte, une évaluation devient une ligne flottante dans la base de données. Et une ligne flottante finit toujours par devenir un problème de bulletin.

---

# 3. Compatibilité par niveau scolaire

---

## 3.1 Maternelle

Mode :

```txt
QUALITATIVE
```

L’évaluation porte sur :

```txt
domaines
compétences
observations
appréciations TS/S/PS/NS
commentaires pédagogiques
```

Il ne faut pas imposer de note chiffrée.

Exemples :

```txt
Observation langage
Observation motricité
Observation autonomie
Observation socialisation
Observation créativité
```

---

## 3.2 Primaire

Mode :

```txt
QUANTITATIVE_NO_COEFFICIENT
```

L’évaluation porte sur :

```txt
matière
note
appréciation
période mensuelle
période séquentielle
période trimestrielle
période annuelle
```

Coefficient par défaut :

```txt
1
```

---

## 3.3 Secondaire

Mode :

```txt
QUANTITATIVE_WITH_COEFFICIENT
```

L’évaluation porte sur :

```txt
matière
note
coefficient matière
type d’évaluation
série si applicable
période académique
```

---

# 4. Bilingue pédagogique

Une évaluation peut être :

```txt
FR
EN
BILINGUAL
```

Cela permet de gérer :

```txt
évaluations en français
évaluations en anglais
évaluations bilingues
matières anglaises évaluables
analyses ORION séparées par langue
bulletins structurés par langue pédagogique
```

Exemple :

```txt
CM1 — Science in English — Évaluation mensuelle
3ème — English Language — Devoir surveillé
Tle — Mathematics in English — Composition
```

---

# 5. Structure fonctionnelle de l’onglet

L’onglet doit contenir les sous-sections suivantes :

```txt
Évaluations & Sessions
├── Vue d’ensemble
├── Création d’évaluation
├── Planification
├── Affectation enseignants
├── Évaluations Maternelle
├── Évaluations Primaire
├── Évaluations Secondaire
├── Sessions d’examen
├── Import / Export
├── Verrouillage & validation
├── Suivi ORION
└── Audit
```

---

# 6. Frontend

---

## 6.1 Route

```txt
/exams/evaluations
```

---

## 6.2 Page principale

```txt
app/(school)/exams/evaluations/page.tsx
```

---

## 6.3 Composants à créer

```txt
components/exams/evaluations/EvaluationSessionsPage.tsx
components/exams/evaluations/EvaluationOverviewCards.tsx
components/exams/evaluations/EvaluationFilters.tsx
components/exams/evaluations/EvaluationCalendar.tsx
components/exams/evaluations/EvaluationCreationWizard.tsx
components/exams/evaluations/EvaluationTypeSelector.tsx
components/exams/evaluations/EvaluationLevelModePanel.tsx
components/exams/evaluations/KindergartenEvaluationBuilder.tsx
components/exams/evaluations/PrimaryEvaluationBuilder.tsx
components/exams/evaluations/SecondaryEvaluationBuilder.tsx
components/exams/evaluations/EvaluationTeacherAssignment.tsx
components/exams/evaluations/EvaluationSessionManager.tsx
components/exams/evaluations/EvaluationImportExportPanel.tsx
components/exams/evaluations/EvaluationLockPanel.tsx
components/exams/evaluations/EvaluationOrionInsights.tsx
components/exams/evaluations/EvaluationAuditTimeline.tsx
```

---

# 7. Filtres principaux

L’interface doit permettre de filtrer par :

```txt
année scolaire
période
niveau scolaire
classe
série
matière
domaine
enseignant
type d’évaluation
langue pédagogique
statut
```

---

# 8. Statuts d’une évaluation

Une évaluation doit suivre un cycle de vie clair :

```txt
Brouillon
Planifiée
Ouverte
En cours de saisie
Soumise
Validée
Verrouillée
Annulée
Archivée
```

Version technique :

```ts
enum EvaluationStatus {
  DRAFT
  PLANNED
  OPEN
  INPUT_IN_PROGRESS
  SUBMITTED
  VALIDATED
  LOCKED
  CANCELLED
  ARCHIVED
}
```

---

# 9. Base de données — Modèle Evaluation

```prisma
model Evaluation {
  id                    String @id @default(cuid())
  tenantId              String
  academicYearId        String

  title                 String
  code                  String?
  description           String?

  schoolStage           SchoolStage
  evaluationMode        EvaluationMode
  pedagogicalLanguage   PedagogicalLanguage @default(FR)

  periodId              String
  classId               String?
  levelId               String?
  seriesId              String?

  subjectId             String?
  domainId              String?
  teacherId             String?

  evaluationTypeId      String

  maxScore              Decimal? @db.Decimal(6,2)
  coefficient           Decimal? @db.Decimal(6,2)

  scheduledDate         DateTime?
  startTime             DateTime?
  endTime               DateTime?
  durationMinutes       Int?

  status                EvaluationStatus @default(DRAFT)

  allowTeacherInput     Boolean @default(true)
  allowExcelImport      Boolean @default(true)
  requireValidation     Boolean @default(true)

  createdById           String?
  updatedById           String?
  validatedById         String?
  lockedById            String?

  validatedAt           DateTime?
  lockedAt              DateTime?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([tenantId, academicYearId])
  @@index([schoolStage, classId, seriesId])
  @@index([periodId, evaluationTypeId])
  @@index([teacherId])
  @@unique([tenantId, academicYearId, code])
}

enum EvaluationStatus {
  DRAFT
  PLANNED
  OPEN
  INPUT_IN_PROGRESS
  SUBMITTED
  VALIDATED
  LOCKED
  CANCELLED
  ARCHIVED
}
```

---

# 10. Base de données — Domaines Maternelle

Pour la Maternelle, il faut gérer les domaines évaluables.

```prisma
model KindergartenEvaluationDomain {
  id             String @id @default(cuid())
  tenantId       String
  academicYearId String

  name           String
  code           String
  description    String?

  isDefault      Boolean @default(false)
  isActive       Boolean @default(true)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([tenantId, academicYearId, code])
  @@index([tenantId, academicYearId])
}
```

Exemples :

```txt
Langage
Motricité
Socialisation
Autonomie
Créativité
Comportement
```

---

# 11. Base de données — Compétences évaluées

```prisma
model EvaluationCompetency {
  id             String @id @default(cuid())
  tenantId       String
  evaluationId   String

  domainId       String?
  label          String
  description    String?
  expectedLevel  String?

  orderIndex     Int @default(0)
  isActive       Boolean @default(true)

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([tenantId, evaluationId])
  @@index([domainId])
}
```

Exemple :

```txt
Reconnaît les couleurs principales
S’exprime clairement devant le groupe
Participe aux activités collectives
Respecte les consignes simples
```

---

# 12. Base de données — Sessions d’évaluation

Une session permet de regrouper plusieurs évaluations.

Exemples :

```txt
Évaluations mensuelles de novembre
Composition du 1er trimestre
Examens blancs BEPC
Examens blancs BAC
Observations Maternelle — Période 1
```

```prisma
model EvaluationSession {
  id             String @id @default(cuid())
  tenantId       String
  academicYearId String

  name           String
  code           String?
  description    String?

  periodId       String
  schoolStage    SchoolStage
  levelId        String?
  classId        String?
  seriesId       String?

  startDate      DateTime?
  endDate        DateTime?

  status         EvaluationSessionStatus @default(DRAFT)

  createdById    String?
  validatedById  String?
  lockedById     String?

  validatedAt    DateTime?
  lockedAt       DateTime?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([tenantId, academicYearId])
  @@index([periodId, schoolStage, classId, seriesId])
}

enum EvaluationSessionStatus {
  DRAFT
  PLANNED
  OPEN
  CLOSED
  VALIDATED
  LOCKED
  CANCELLED
}
```

---

# 13. Base de données — Participants

```prisma
model EvaluationParticipant {
  id              String @id @default(cuid())
  tenantId        String
  evaluationId    String
  studentId       String

  isEligible      Boolean @default(true)
  exclusionReason String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([tenantId, evaluationId, studentId])
  @@index([studentId])
}
```

Ce modèle permet de savoir quels élèves sont concernés par une évaluation.

---

# 14. Workflow de création d’évaluation

---

## Étape 1 — Contexte

L’utilisateur choisit :

```txt
année scolaire
période
niveau
classe
série si secondaire second cycle
langue pédagogique
```

---

## Étape 2 — Type d’évaluation

Selon le niveau :

```txt
Observation maternelle
Évaluation mensuelle
Évaluation certificative
Interrogation
Devoir surveillé
Composition
Examen blanc
Projet
Oral
TP
```

---

## Étape 3 — Cible pédagogique

Selon le niveau :

```txt
Maternelle : domaine / compétence
Primaire : matière
Secondaire : matière + coefficient
```

---

## Étape 4 — Enseignant

Sélection de :

```txt
enseignant responsable
co-enseignants éventuels
droit de saisie
```

---

## Étape 5 — Planning

Configuration :

```txt
date
heure début
heure fin
durée
salle si applicable
consignes
```

---

## Étape 6 — Validation

Actions possibles :

```txt
enregistrer brouillon
planifier
ouvrir
notifier les enseignants
```

---

# 15. Règles métier — Maternelle

```txt
1. Une évaluation maternelle doit utiliser QUALITATIVE.
2. Elle doit être liée à au moins un domaine ou une compétence.
3. Elle ne doit pas exiger de note chiffrée.
4. Elle doit utiliser l’échelle qualitative active.
5. Le nombre d’évaluations par défaut est 3, mais configurable.
6. Les commentaires enseignants doivent être autorisés.
7. Aucun classement numérique ne doit être généré.
```

---

# 16. Règles métier — Primaire

```txt
1. Une évaluation primaire doit utiliser QUANTITATIVE_NO_COEFFICIENT.
2. Le coefficient par défaut est toujours 1.
3. Les types principaux sont mensuel et certificatif.
4. Les notes doivent respecter le barème actif.
5. Une appréciation peut être générée automatiquement ou saisie manuellement.
6. Les moyennes sont calculées selon la règle définie par l’école.
```

---

# 17. Règles métier — Secondaire

```txt
1. Une évaluation secondaire doit utiliser QUANTITATIVE_WITH_COEFFICIENT.
2. La matière doit avoir un coefficient.
3. La série doit être prise en compte si applicable.
4. Les types d’évaluations sont configurables.
5. Les notes doivent respecter le barème actif.
6. Les coefficients sont hérités du module pédagogique sauf surcharge autorisée.
7. Les classements ne sont générés qu’après validation des notes.
```

---

# 18. Règles métier — Bilingue

```txt
1. Une évaluation doit avoir une langue pédagogique.
2. Une matière EN doit pouvoir être évaluée indépendamment.
3. Une matière FR doit pouvoir être évaluée indépendamment.
4. Une évaluation bilingue peut contenir deux volets.
5. ORION doit pouvoir comparer les performances FR et EN.
6. Les bulletins doivent conserver la langue pédagogique de l’évaluation.
```

---

# 19. Import / Export

L’onglet doit permettre :

```txt
export Excel des listes d’élèves
import Excel des évaluations planifiées
import des notes plus tard dans l’onglet Saisie des notes
export PDF du planning
export CSV administratif
```

Important :

```txt
L’import ne doit jamais écraser une évaluation validée ou verrouillée.
```

---

# 20. Verrouillage

Une évaluation verrouillée :

```txt
ne peut plus être modifiée
ne peut plus être supprimée
ne peut plus changer de barème
ne peut plus changer de type
ne peut plus changer de matière
ne peut plus changer de coefficient
peut seulement être consultée
```

Déverrouillage possible uniquement avec permission spéciale et audit obligatoire.

---

# 21. Backend — Routes API

```http
GET    /api/exams/evaluations
GET    /api/exams/evaluations/:id

POST   /api/exams/evaluations
PATCH  /api/exams/evaluations/:id
POST   /api/exams/evaluations/:id/open
POST   /api/exams/evaluations/:id/submit
POST   /api/exams/evaluations/:id/validate
POST   /api/exams/evaluations/:id/lock
POST   /api/exams/evaluations/:id/unlock
POST   /api/exams/evaluations/:id/cancel
POST   /api/exams/evaluations/:id/archive

GET    /api/exams/sessions
POST   /api/exams/sessions
PATCH  /api/exams/sessions/:id
POST   /api/exams/sessions/:id/open
POST   /api/exams/sessions/:id/close
POST   /api/exams/sessions/:id/validate
POST   /api/exams/sessions/:id/lock

GET    /api/exams/kindergarten-domains
POST   /api/exams/kindergarten-domains
PATCH  /api/exams/kindergarten-domains/:id

POST   /api/exams/evaluations/:id/participants/sync
GET    /api/exams/evaluations/:id/audit
```

---

# 22. Backend — Services

```txt
EvaluationService
EvaluationSessionService
EvaluationWorkflowService
EvaluationParticipantService
KindergartenEvaluationDomainService
EvaluationCompetencyService
EvaluationPlanningService
EvaluationLockService
EvaluationAuditService
EvaluationOrionService
```

---

# 23. Sécurité

## Permissions

```ts
EXAMS_EVALUATIONS_VIEW
EXAMS_EVALUATIONS_CREATE
EXAMS_EVALUATIONS_UPDATE
EXAMS_EVALUATIONS_VALIDATE
EXAMS_EVALUATIONS_LOCK
EXAMS_EVALUATIONS_UNLOCK
EXAMS_SESSIONS_MANAGE
EXAMS_KINDERGARTEN_DOMAINS_MANAGE
```

---

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
aucune suppression destructive
audit obligatoire
verrouillage irréversible sans permission spéciale
validation Zod
transactions Prisma
```

---

# 24. Audit

Auditer obligatoirement :

```txt
création d’évaluation
modification d’évaluation
changement de période
changement de matière
changement de coefficient
ouverture
soumission
validation
verrouillage
déverrouillage
annulation
archivage
```

---

# 25. ORION

ORION doit détecter :

```txt
évaluation sans enseignant
évaluation sans matière
évaluation secondaire sans coefficient
évaluation maternelle avec note chiffrée
évaluation primaire avec coefficient différent de 1
évaluation bilingue sans langue pédagogique
chevauchement de planning
trop d’évaluations sur une même journée
classe sans évaluation prévue
matière jamais évaluée
enseignant surchargé
```

Exemple :

```txt
ORION — Surcharge d’évaluations détectée

La classe 4ème A a 4 évaluations planifiées le même jour.
Action recommandée : répartir les évaluations sur plusieurs jours.
```

---

# 26. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 3 — Évaluations & Sessions** du **Module 3 — Examens, Notes & Bulletins**.

---

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
```

---

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
audit obligatoire
compatible Maternelle qualitative
compatible Primaire coefficient 1
compatible Secondaire avec coefficients
compatible séries
compatible bilingue pédagogique
workflow de statut robuste
verrouillage sécurisé
aucune suppression destructive
```

---

## À créer côté frontend

```txt
Page /exams/evaluations
EvaluationSessionsPage
EvaluationOverviewCards
EvaluationFilters
EvaluationCalendar
EvaluationCreationWizard
KindergartenEvaluationBuilder
PrimaryEvaluationBuilder
SecondaryEvaluationBuilder
EvaluationSessionManager
EvaluationImportExportPanel
EvaluationLockPanel
EvaluationOrionInsights
EvaluationAuditTimeline
```

---

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Transactions Prisma
Contrôles RBAC
Audit automatique
Gestion des sessions
Gestion des participants
Gestion du verrouillage
Gestion des évaluations par niveau
```

---

## À créer côté BDD

```txt
Evaluation
EvaluationSession
EvaluationParticipant
KindergartenEvaluationDomain
EvaluationCompetency
Enums EvaluationStatus et EvaluationSessionStatus
Relations avec AcademicYear, Period, Class, Subject, Teacher, Series
```

---

# 27. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
créer les évaluations
planifier les sessions
affecter les enseignants
gérer les domaines maternelle
gérer les évaluations primaires
gérer les évaluations secondaires
prendre en compte le bilingue pédagogique
verrouiller les évaluations
auditer les changements
préparer la saisie des résultats
alimenter ORION
```

---

# Conclusion

L’onglet **Évaluations & Sessions** est le **centre opérationnel du module Examen**.

L’onglet 2 définit les règles.
L’onglet 3 crée les évaluations réelles selon ces règles.

La logique est donc :

```txt
Paramétrage académique = règles
Évaluations & Sessions = application opérationnelle des règles
Saisie des notes = résultats
Bulletins = restitution officielle
```

C’est cette séparation qui rendra le module solide, maintenable et professionnel.

---

Très bien. On attaque **Onglet 4 — Saisie des résultats & appréciations** du **Module 3 — Examens, Notes & Bulletins**.

Ici, on entre dans une zone très sensible : la **saisie réelle des résultats**. C’est là que les enseignants renseignent les appréciations, les notes, les observations, puis soumettent les résultats pour validation.

L’onglet doit être solide, verrouillé, auditable et intelligent. Pas question d’avoir un système où quelqu’un peut modifier une note validée comme s’il corrigeait une faute de frappe dans WhatsApp.

---

# MODULE 3 — EXAMENS, NOTES & BULLETINS

## ONGLET 4 — SAISIE DES RÉSULTATS & APPRÉCIATIONS

---

# 1. Objectif de l’onglet

L’onglet **Saisie des résultats & appréciations** permet de renseigner les résultats des évaluations créées dans l’onglet précédent.

Il doit gérer :

```txt
les appréciations qualitatives de la Maternelle
les notes du Primaire
les notes avec coefficients du Secondaire
les appréciations pédagogiques
l’import Excel
la validation
la correction contrôlée
le verrouillage
l’audit
l’analyse ORION
```

Cet onglet ne doit jamais être conçu comme une simple grille de notes.
Il doit être un **poste de saisie académique sécurisé**.

---

# 2. Positionnement dans le module

## Route frontend

```txt
/exams/results
```

## Module parent

```txt
Examens, Notes & Bulletins
```

## Dépendances directes

```txt
Onglet 2 — Paramétrage académique
Onglet 3 — Évaluations & Sessions
Module Élèves & Scolarité
Module Structure académique
Module Enseignants
Module Finance pour certains blocages de publication
ORION
```

---

# 3. Acteurs autorisés

---

## 3.1 Enseignant

L’enseignant peut :

```txt
voir ses évaluations
saisir les résultats autorisés
ajouter les appréciations
sauvegarder en brouillon
soumettre les résultats
consulter les corrections demandées
```

---

## 3.2 Censeur / Responsable pédagogique

Il peut :

```txt
contrôler les résultats
détecter les anomalies
demander une correction
valider les résultats
verrouiller selon permission
```

---

## 3.3 Direction

Elle peut :

```txt
superviser les résultats
valider définitivement
autoriser certaines corrections sensibles
consulter les statistiques
suivre les anomalies ORION
```

---

## 3.4 Platform owner / Platform admin

Accès technique et supervision globale selon les droits multi-tenant.

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit être organisé ainsi :

```txt
Saisie des résultats & appréciations
├── Vue d’ensemble
├── Sélection de l’évaluation
├── Saisie Maternelle qualitative
├── Saisie Primaire quantitative
├── Saisie Secondaire quantitative
├── Appréciations individuelles
├── Import / Export Excel
├── Contrôle & anomalies
├── Soumission enseignant
├── Validation direction
├── Correction contrôlée
├── Verrouillage
├── ORION
└── Audit
```

---

# 5. Frontend

---

## 5.1 Route

```txt
/exams/results
```

---

## 5.2 Page principale

```txt
app/(school)/exams/results/page.tsx
```

---

## 5.3 Composants à créer

```txt
components/exams/results/ResultsEntryPage.tsx
components/exams/results/ResultsOverviewCards.tsx
components/exams/results/ResultsEvaluationSelector.tsx
components/exams/results/ResultsFilters.tsx
components/exams/results/KindergartenQualitativeEntryGrid.tsx
components/exams/results/PrimaryGradeEntryGrid.tsx
components/exams/results/SecondaryGradeEntryGrid.tsx
components/exams/results/AppreciationEditor.tsx
components/exams/results/BulkAppreciationAssistant.tsx
components/exams/results/ResultsExcelImportPanel.tsx
components/exams/results/ResultsValidationPanel.tsx
components/exams/results/ResultsAnomalyPanel.tsx
components/exams/results/ResultsCorrectionRequestPanel.tsx
components/exams/results/ResultsLockPanel.tsx
components/exams/results/ResultsOrionInsights.tsx
components/exams/results/ResultsAuditTimeline.tsx
```

---

# 6. Filtres principaux

L’interface doit permettre de filtrer par :

```txt
année scolaire
période
niveau scolaire
classe
série
matière
domaine
enseignant
type d’évaluation
langue pédagogique
statut de saisie
statut de validation
```

---

# 7. Statuts de saisie

```prisma
enum ResultEntryStatus {
  NOT_STARTED
  IN_PROGRESS
  SUBMITTED
  RETURNED_FOR_CORRECTION
  VALIDATED
  LOCKED
}
```

Cycle métier :

```txt
Non commencé
En cours
Soumis
Retourné pour correction
Validé
Verrouillé
```

---

# 8. Base de données — EvaluationResult

```prisma
model EvaluationResult {
  id              String @id @default(cuid())
  tenantId        String
  evaluationId    String
  studentId       String

  numericScore    Decimal? @db.Decimal(6,2)
  qualitativeCode String?

  appreciation    String?
  teacherComment  String?
  directorComment String?

  isAbsent        Boolean @default(false)
  isExempted      Boolean @default(false)
  absenceReason   String?

  status          ResultEntryStatus @default(NOT_STARTED)

  enteredById     String?
  submittedById   String?
  validatedById   String?
  lockedById      String?

  enteredAt       DateTime?
  submittedAt     DateTime?
  validatedAt     DateTime?
  lockedAt        DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([tenantId, evaluationId, studentId])
  @@index([tenantId, evaluationId])
  @@index([studentId])
  @@index([status])
}
```

---

# 9. Base de données — Demandes de correction

```prisma
model ResultCorrectionRequest {
  id                 String @id @default(cuid())
  tenantId           String
  resultId           String
  evaluationId       String
  studentId          String

  requestedById      String
  approvedById       String?

  reason             String
  oldNumericScore    Decimal? @db.Decimal(6,2)
  newNumericScore    Decimal? @db.Decimal(6,2)

  oldQualitativeCode String?
  newQualitativeCode String?

  oldAppreciation    String?
  newAppreciation    String?

  status             CorrectionRequestStatus @default(PENDING)

  requestedAt        DateTime @default(now())
  approvedAt         DateTime?
  rejectedAt         DateTime?

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([tenantId, evaluationId])
  @@index([resultId])
}

enum CorrectionRequestStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}
```

---

# 10. Base de données — Lots d’import

```prisma
model ResultImportBatch {
  id              String @id @default(cuid())
  tenantId        String
  evaluationId    String

  fileName        String
  totalRows       Int
  successRows     Int
  errorRows       Int

  status          ImportBatchStatus @default(PENDING)
  errorReportUrl  String?

  importedById    String?
  importedAt      DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId, evaluationId])
}

enum ImportBatchStatus {
  PENDING
  PROCESSING
  COMPLETED
  COMPLETED_WITH_ERRORS
  FAILED
}
```

---

# 11. Saisie Maternelle qualitative

## Principe

Pour la **Maternelle**, la grille ne doit pas afficher une note chiffrée.

Elle doit afficher :

```txt
élève
domaine
compétence
échelle TS/S/PS/NS
commentaire enseignant
observation direction si nécessaire
```

---

## Champs affichés

```txt
Élève
Domaine
Compétence
TS / S / PS / NS
Commentaire
Statut
```

---

## Règles métier

```txt
1. Aucun champ note chiffrée obligatoire.
2. L’échelle qualitative active doit être utilisée.
3. Les appréciations narratives doivent être possibles.
4. La synthèse qualitative sera calculée plus tard selon la règle définie.
5. Aucun classement numérique ne doit être produit.
6. Une observation peut être sauvegardée en brouillon.
7. La validation direction peut être obligatoire selon paramétrage.
```

---

# 12. Saisie Primaire quantitative

## Principe

Pour le **Primaire**, la grille affiche des notes avec appréciations.

Coefficient :

```txt
1
```

---

## Champs affichés

```txt
Élève
Note
Barème
Appréciation automatique
Appréciation personnalisée
Absence
Statut
```

---

## Règles métier

```txt
1. La note doit respecter le barème actif.
2. Le coefficient est 1 par défaut.
3. Les évaluations mensuelles et certificatives doivent être distinguées.
4. L’appréciation peut être générée automatiquement.
5. L’enseignant peut personnaliser l’appréciation si autorisé.
6. Les moyennes seront calculées selon la règle de l’école.
7. Une note validée ne peut plus être modifiée sans demande de correction.
```

---

# 13. Saisie Secondaire quantitative

## Principe

Pour le **Secondaire**, la grille affiche les notes en tenant compte :

```txt
matière
coefficient
série
type d’évaluation
barème
langue pédagogique
```

---

## Champs affichés

```txt
Élève
Note
Barème
Coefficient matière
Appréciation
Absence
Statut
```

---

## Règles métier

```txt
1. La matière doit avoir un coefficient.
2. La note doit respecter le barème actif.
3. La série doit être prise en compte si applicable.
4. Les coefficients ne sont pas modifiables depuis la saisie sauf permission spéciale.
5. Une note validée ne peut être corrigée que via workflow.
6. Les classements ne sont pas générés tant que les résultats ne sont pas validés.
```

---

# 14. Appréciations

## Types d’appréciations

```txt
appréciation automatique
appréciation personnalisée enseignant
appréciation direction
appréciation bilingue
```

---

## Exemples d’appréciations automatiques

```txt
Excellent travail
Bon niveau
Résultat acceptable
Des efforts sont nécessaires
Compétence à renforcer
```

---

## Bilingue

Pour les matières anglophones, l’appréciation peut être en anglais.

Pour les bulletins bilingues, le système peut stocker :

```txt
appreciationFr
appreciationEn
```

---

## Modèle optionnel

```prisma
model ResultAppreciationTranslation {
  id          String @id @default(cuid())
  tenantId    String
  resultId    String

  language    PedagogicalLanguage
  content     String

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, resultId, language])
}
```

---

# 15. Import / Export Excel

## Export attendu

L’enseignant peut exporter une grille Excel contenant :

```txt
liste des élèves
matricule
classe
matière ou domaine
type d’évaluation
colonne note ou appréciation qualitative
colonne commentaire
```

---

## Import attendu

Le système doit :

```txt
lire le fichier
vérifier les élèves
vérifier les notes
vérifier les codes qualitatifs
détecter les doublons
rejeter les lignes invalides
produire un rapport d’erreurs
ne jamais écraser une donnée validée ou verrouillée
```

---

# 16. Contrôle des anomalies

Le système doit détecter :

```txt
note supérieure au barème
note négative
élève absent avec note
élève sans résultat
doublon de résultat
code qualitatif invalide
coefficient manquant
résultat modifié après soumission
import incohérent
saisie hors période autorisée
```

---

# 17. Workflow de validation

```txt
1. Saisie enseignant
2. Sauvegarde brouillon
3. Soumission
4. Contrôle pédagogique
5. Validation
6. Verrouillage
```

---

## 17.1 Étape 1 — Saisie enseignant

L’enseignant saisit les résultats autorisés.

---

## 17.2 Étape 2 — Sauvegarde brouillon

Les résultats restent modifiables tant qu’ils ne sont pas soumis.

---

## 17.3 Étape 3 — Soumission

L’enseignant soumet officiellement les résultats.

---

## 17.4 Étape 4 — Contrôle

Le responsable pédagogique vérifie les anomalies.

---

## 17.5 Étape 5 — Validation

Les résultats deviennent validés.

---

## 17.6 Étape 6 — Verrouillage

Les résultats deviennent non modifiables.

---

# 18. Correction contrôlée

Une correction après validation doit passer par :

```txt
demande de correction
justification obligatoire
approbation direction
application de la correction
recalcul éventuel
audit complet
```

Aucune correction silencieuse ne doit être autorisée.

---

# 19. Verrouillage

Un résultat verrouillé :

```txt
ne peut plus être modifié
ne peut plus être supprimé
ne peut plus être remplacé par import
peut seulement être consulté
peut être corrigé uniquement via workflow exceptionnel
```

---

# 20. Backend — Routes API

```http
GET    /api/exams/results
GET    /api/exams/results/:id

POST   /api/exams/evaluations/:evaluationId/results
PATCH  /api/exams/results/:id

POST   /api/exams/evaluations/:evaluationId/results/bulk-save
POST   /api/exams/evaluations/:evaluationId/results/submit
POST   /api/exams/evaluations/:evaluationId/results/validate
POST   /api/exams/evaluations/:evaluationId/results/lock
POST   /api/exams/evaluations/:evaluationId/results/unlock

POST   /api/exams/results/:id/correction-request
POST   /api/exams/correction-requests/:id/approve
POST   /api/exams/correction-requests/:id/reject

POST   /api/exams/evaluations/:evaluationId/results/import
GET    /api/exams/evaluations/:evaluationId/results/export
GET    /api/exams/evaluations/:evaluationId/results/import-template

GET    /api/exams/evaluations/:evaluationId/results/anomalies
GET    /api/exams/evaluations/:evaluationId/results/audit
```

---

# 21. Backend — Services

```txt
ResultEntryService
KindergartenResultService
PrimaryResultService
SecondaryResultService
ResultValidationService
ResultCorrectionService
ResultImportExportService
ResultAnomalyService
ResultLockService
ResultAppreciationService
ResultAuditService
ResultOrionService
```

---

# 22. Sécurité

## Permissions

```ts
EXAMS_RESULTS_VIEW
EXAMS_RESULTS_ENTRY
EXAMS_RESULTS_SUBMIT
EXAMS_RESULTS_VALIDATE
EXAMS_RESULTS_LOCK
EXAMS_RESULTS_UNLOCK
EXAMS_RESULTS_CORRECTION_REQUEST
EXAMS_RESULTS_CORRECTION_APPROVE
EXAMS_RESULTS_IMPORT
EXAMS_RESULTS_EXPORT
```

---

## Contrôles

```txt
tenantId depuis session uniquement
enseignant limité à ses évaluations
RBAC strict
validation Zod
transactions Prisma
audit obligatoire
aucune suppression destructive
interdiction d’écraser une donnée verrouillée
```

---

# 23. Audit

Auditer :

```txt
création résultat
modification résultat
import résultat
soumission
validation
verrouillage
déverrouillage
demande de correction
approbation correction
rejet correction
modification d’appréciation
```

Chaque log doit contenir :

```txt
utilisateur
rôle
ancienne valeur
nouvelle valeur
date
raison
adresse IP
user agent
```

---

# 24. ORION

ORION doit analyser :

```txt
taux de saisie par enseignant
retards de saisie
notes anormalement hautes
notes anormalement basses
absence massive de résultats
incohérences absence/note
matières non saisies
écarts FR/EN en bilingue
progression ou régression d’une classe
surcharge d’anomalies par enseignant
corrections fréquentes après validation
```

Exemple :

```txt
ORION — Anomalie détectée

38% des élèves de 5ème B ont une note inférieure à 5/20 en Mathématiques.
Vérification pédagogique recommandée.
```

---

# 25. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 4 — Saisie des résultats & appréciations** du **Module 3 — Examens, Notes & Bulletins**.

---

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
```

---

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
enseignant limité à ses évaluations
compatible Maternelle qualitative
compatible Primaire coefficient 1
compatible Secondaire avec coefficients
compatible bilingue pédagogique
import/export Excel sécurisé
validation et verrouillage robustes
correction contrôlée
audit complet
aucune suppression destructive
```

---

## À créer côté frontend

```txt
Page /exams/results
ResultsEntryPage
ResultsOverviewCards
ResultsEvaluationSelector
ResultsFilters
KindergartenQualitativeEntryGrid
PrimaryGradeEntryGrid
SecondaryGradeEntryGrid
AppreciationEditor
BulkAppreciationAssistant
ResultsExcelImportPanel
ResultsValidationPanel
ResultsAnomalyPanel
ResultsCorrectionRequestPanel
ResultsLockPanel
ResultsOrionInsights
ResultsAuditTimeline
```

---

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Transactions Prisma
Contrôles RBAC
Gestion des imports Excel
Gestion des corrections
Gestion du verrouillage
Audit automatique
Détection anomalies
```

---

## À créer côté BDD

```txt
EvaluationResult
ResultCorrectionRequest
ResultImportBatch
ResultAppreciationTranslation
Enums ResultEntryStatus, CorrectionRequestStatus, ImportBatchStatus
Relations avec Evaluation, Student, Teacher, User
```

---

# 26. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
saisir les résultats
saisir les appréciations
importer les résultats
exporter les grilles
contrôler les anomalies
soumettre les résultats
valider les résultats
corriger proprement
verrouiller définitivement
alimenter ORION
préparer le calcul des moyennes
```

---

# Conclusion

L’onglet **Saisie des résultats & appréciations** est le **poste de contrôle opérationnel des performances élèves**.

L’onglet 3 crée les évaluations.
L’onglet 4 reçoit les résultats.
Les onglets suivants calculeront, consolideront et publieront.

La règle d’or ici :

```txt
Une note validée ne se modifie jamais silencieusement.
```

C’est ce niveau de rigueur qui donnera à Academia Helm une crédibilité institutionnelle.

---

Parfait. On passe à **Onglet 5 — Calculs, Moyennes & Classements** du **Module 3 — Examens, Notes & Bulletins**.

Cet onglet est critique : c’est le **moteur de consolidation académique**. Il transforme les résultats saisis et validés en moyennes, synthèses, rangs, classements et données prêtes pour les bulletins.

Ici, il faut être très rigoureux. Un mauvais calcul de moyenne, c’est une bombe administrative à retardement.

---

# MODULE 3 — EXAMENS, NOTES & BULLETINS

## ONGLET 5 — CALCULS, MOYENNES & CLASSEMENTS

---

# 1. Objectif de l’onglet

L’onglet **Calculs, Moyennes & Classements** permet de transformer les résultats validés en données académiques consolidées.

Il produit :

```txt
moyennes par matière
moyennes par période
moyennes générales
synthèses qualitatives pour la Maternelle
rangs et classements
indicateurs de performance
données prêtes pour les bulletins
signaux ORION
```

Cet onglet ne doit pas être un simple bouton :

```txt
Calculer moyenne
```

Ce serait trop fragile.

Il doit être un **moteur académique configurable, traçable, simulable, auditable et verrouillable**.

---

# 2. Positionnement dans le module

## Route frontend

```txt
/exams/calculations
```

## Module parent

```txt
Examens, Notes & Bulletins
```

## Dépendances directes

```txt
Onglet 2 — Paramétrage académique
Onglet 3 — Évaluations & Sessions
Onglet 4 — Saisie des résultats & appréciations
Module Structure académique
Module Élèves & Scolarité
Module Enseignants
ORION
```

---

# 3. Principe général

Le moteur doit appliquer automatiquement la bonne logique selon le niveau scolaire.

---

## 3.1 Maternelle

Pour la Maternelle, le système produit :

```txt
synthèse qualitative
consolidation TS/S/PS/NS
synthèse par domaine
synthèse par compétence
commentaires narratifs
```

Il ne doit pas produire :

```txt
moyenne numérique obligatoire
classement numérique
rang académique classique
```

---

## 3.2 Primaire

Pour le Primaire, le système produit :

```txt
moyennes mensuelles
moyennes séquentielles
moyennes trimestrielles
moyennes annuelles
appréciations
classements si activés
```

Règle centrale :

```txt
coefficient = 1
```

---

## 3.3 Secondaire

Pour le Secondaire, le système produit :

```txt
moyennes par matière
moyennes générales pondérées
classements
moyennes par série
moyennes par langue si bilingue
données officielles pour bulletins
```

Règle centrale :

```txt
moyenne générale = somme(moyenne matière × coefficient) / somme(coefficients)
```

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit être structuré ainsi :

```txt
Calculs, Moyennes & Classements
├── Vue d’ensemble
├── Sélection du périmètre de calcul
├── Pré-contrôle des résultats
├── Calcul Maternelle qualitative
├── Calcul Primaire
├── Calcul Secondaire
├── Moyennes par matière
├── Moyennes générales
├── Classements
├── Recalcul contrôlé
├── Simulation avant validation
├── Validation des calculs
├── Verrouillage des calculs
├── ORION
└── Audit
```

---

# 5. Frontend

---

## 5.1 Route

```txt
/exams/calculations
```

---

## 5.2 Page principale

```txt
app/(school)/exams/calculations/page.tsx
```

---

## 5.3 Composants à créer

```txt
components/exams/calculations/ExamCalculationsPage.tsx
components/exams/calculations/CalculationOverviewCards.tsx
components/exams/calculations/CalculationScopeSelector.tsx
components/exams/calculations/CalculationPrecheckPanel.tsx
components/exams/calculations/KindergartenSynthesisPanel.tsx
components/exams/calculations/PrimaryAverageCalculationPanel.tsx
components/exams/calculations/SecondaryAverageCalculationPanel.tsx
components/exams/calculations/SubjectAverageTable.tsx
components/exams/calculations/GeneralAverageTable.tsx
components/exams/calculations/RankingTable.tsx
components/exams/calculations/CalculationSimulationPanel.tsx
components/exams/calculations/RecalculationRequestPanel.tsx
components/exams/calculations/CalculationValidationPanel.tsx
components/exams/calculations/CalculationLockPanel.tsx
components/exams/calculations/CalculationOrionInsights.tsx
components/exams/calculations/CalculationAuditTimeline.tsx
```

---

# 6. Filtres principaux

L’interface doit permettre de filtrer par :

```txt
année scolaire
période
niveau scolaire
classe
série
matière
langue pédagogique
type de calcul
statut de calcul
statut de validation
```

---

# 7. Statuts de calcul

```prisma
enum CalculationStatus {
  NOT_STARTED
  PRECHECK_FAILED
  READY
  SIMULATED
  CALCULATED
  VALIDATED
  LOCKED
  CANCELLED
}
```

Version métier :

```txt
Non commencé
Pré-contrôle échoué
Prêt
Simulé
Calculé
Validé
Verrouillé
Annulé
```

---

# 8. Types de calcul

```prisma
enum CalculationScopeType {
  KINDERGARTEN_SYNTHESIS
  SUBJECT_AVERAGE
  PERIOD_AVERAGE
  GENERAL_AVERAGE
  ANNUAL_AVERAGE
  RANKING
  LANGUAGE_AVERAGE
}
```

---

# 9. Base de données — ExamCalculationRun

Ce modèle représente une exécution de calcul.

```prisma
model ExamCalculationRun {
  id                  String @id @default(cuid())
  tenantId            String
  academicYearId      String

  name                String
  scopeType           CalculationScopeType

  schoolStage         SchoolStage
  periodId            String?
  classId             String?
  levelId             String?
  seriesId            String?
  subjectId           String?
  language            PedagogicalLanguage?

  calculationRuleId   String?

  status              CalculationStatus @default(NOT_STARTED)

  totalStudents       Int @default(0)
  processedStudents   Int @default(0)
  anomalyCount        Int @default(0)

  isSimulation        Boolean @default(false)
  isLocked            Boolean @default(false)

  startedById         String?
  validatedById       String?
  lockedById          String?

  startedAt           DateTime?
  completedAt         DateTime?
  validatedAt         DateTime?
  lockedAt            DateTime?

  configSnapshot      Json?
  resultSummary       Json?

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([tenantId, academicYearId])
  @@index([schoolStage, periodId, classId, seriesId])
  @@index([status])
}
```

---

# 10. Base de données — Moyenne par matière

```prisma
model StudentSubjectAverage {
  id                  String @id @default(cuid())
  tenantId            String
  academicYearId      String

  studentId           String
  classId             String
  levelId             String?
  seriesId            String?
  periodId            String
  subjectId           String
  language            PedagogicalLanguage?

  average             Decimal? @db.Decimal(6,2)
  coefficient         Decimal? @db.Decimal(6,2)
  weightedScore       Decimal? @db.Decimal(8,2)

  appreciation        String?
  rankInSubject       Int?

  calculationRunId    String
  status              CalculationStatus @default(CALCULATED)

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@unique([tenantId, academicYearId, studentId, periodId, subjectId, language])
  @@index([tenantId, classId, periodId])
  @@index([studentId])
  @@index([subjectId])
}
```

---

# 11. Base de données — Moyenne périodique

```prisma
model StudentPeriodAverage {
  id                    String @id @default(cuid())
  tenantId              String
  academicYearId        String

  studentId             String
  classId               String
  levelId               String?
  seriesId              String?
  periodId              String

  schoolStage           SchoolStage

  generalAverage        Decimal? @db.Decimal(6,2)
  totalCoefficient      Decimal? @db.Decimal(8,2)
  totalWeightedScore    Decimal? @db.Decimal(8,2)

  rankInClass           Int?
  rankLabel             String?
  mention               String?
  decisionHint          String?

  frenchAverage         Decimal? @db.Decimal(6,2)
  englishAverage        Decimal? @db.Decimal(6,2)

  calculationRunId      String
  status                CalculationStatus @default(CALCULATED)

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@unique([tenantId, academicYearId, studentId, periodId])
  @@index([tenantId, classId, periodId])
  @@index([studentId])
}
```

---

# 12. Base de données — Synthèse Maternelle

```prisma
model KindergartenSynthesis {
  id                    String @id @default(cuid())
  tenantId              String
  academicYearId        String

  studentId             String
  classId               String
  levelId               String?
  periodId              String

  dominantCode          String?
  synthesisLabel        String?
  narrativeSummary      String?

  domainSummary         Json?
  competencySummary     Json?

  teacherComment        String?
  directorComment       String?

  calculationRunId      String
  status                CalculationStatus @default(CALCULATED)

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@unique([tenantId, academicYearId, studentId, periodId])
  @@index([tenantId, classId, periodId])
  @@index([studentId])
}
```

---

# 13. Base de données — Moyenne annuelle

```prisma
model StudentAnnualAverage {
  id                    String @id @default(cuid())
  tenantId              String
  academicYearId        String

  studentId             String
  classId               String
  levelId               String?
  seriesId              String?

  schoolStage           SchoolStage

  annualAverage         Decimal? @db.Decimal(6,2)
  annualRank            Int?
  annualMention         String?
  annualDecisionHint    String?

  frenchAnnualAverage   Decimal? @db.Decimal(6,2)
  englishAnnualAverage  Decimal? @db.Decimal(6,2)

  calculationRunId      String
  status                CalculationStatus @default(CALCULATED)

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@unique([tenantId, academicYearId, studentId])
  @@index([tenantId, classId])
  @@index([studentId])
}
```

---

# 14. Pré-contrôle avant calcul

Avant tout calcul, le système doit vérifier :

```txt
toutes les évaluations requises existent
les résultats sont saisis
les résultats sont validés
les résultats ne sont pas incohérents
les coefficients existent pour le Secondaire
le Primaire n’a pas de coefficient différencié non autorisé
la Maternelle utilise bien une échelle qualitative
les règles de calcul sont actives
la période n’est pas déjà verrouillée
les matières bilingues ont une langue pédagogique
```

Si une anomalie critique existe, le calcul doit être bloqué.

Exemple :

```txt
Calcul bloqué

La classe 2nde A contient 3 matières sans coefficient.
Veuillez corriger les coefficients avant de lancer le calcul.
```

---

# 15. Calcul Maternelle qualitative

## Principe

Le système consolide les appréciations qualitatives.

Sources :

```txt
domaines
compétences
codes TS/S/PS/NS
commentaires enseignants
observations direction
```

---

## Méthodes possibles

```txt
majorité des codes
pondération par domaine
synthèse manuelle assistée
synthèse ORION proposée puis validée humainement
```

---

## Règles métier

```txt
1. Aucun calcul de moyenne numérique obligatoire.
2. Aucun classement numérique.
3. Synthèse par domaine.
4. Synthèse par compétence.
5. Commentaire narratif autorisé.
6. Validation direction possible.
7. Les scores internes éventuels ne doivent pas être affichés publiquement sauf configuration explicite.
```

---

# 16. Calcul Primaire

## Principe

Le système calcule les moyennes selon les règles définies par l’école.

Coefficient :

```txt
1
```

---

## Types de moyennes

```txt
moyenne mensuelle
moyenne séquentielle
moyenne trimestrielle
moyenne annuelle
```

---

## Méthodes possibles

```txt
moyenne simple
moyenne mensuelle + certificative
moyenne pondérée par type d’évaluation
formule personnalisée
```

---

## Règles métier

```txt
1. Toutes les matières ont coefficient 1 par défaut.
2. Les notes doivent être validées.
3. Les absences sont traitées selon la politique définie.
4. Les appréciations peuvent être générées automatiquement.
5. Le classement peut être activé ou désactivé selon politique de l’école.
```

---

# 17. Calcul Secondaire

## Principe

Le système calcule :

```txt
moyenne par matière
moyenne générale
moyenne par langue si bilingue
classement par classe
classement par série si applicable
```

---

## Formule standard

```txt
Moyenne générale = Somme(moyenne matière × coefficient) / Somme(coefficients)
```

---

## Règles métier

```txt
1. Chaque matière doit avoir un coefficient.
2. Les séries doivent être prises en compte.
3. Les absences suivent la politique définie.
4. Les notes doivent être validées.
5. Les coefficients doivent être figés au moment du calcul via snapshot.
6. Les classements ne sont produits qu’après calcul validé.
```

---

# 18. Classements

## Types de classement

```txt
classement dense
classement compétition
classement avec départage
classement désactivé
```

---

## Enum technique

```prisma
enum RankingMode {
  DISABLED
  DENSE_RANK
  COMPETITION_RANK
  UNIQUE_WITH_TIE_BREAKERS
}
```

---

## Règles métier

```txt
1. Pas de classement numérique pour la Maternelle.
2. Classement optionnel au Primaire.
3. Classement standard au Secondaire si activé.
4. Les ex aequo doivent suivre la politique choisie.
5. Le classement doit être recalculé si une moyenne validée change via correction approuvée.
```

---

# 19. Simulation avant validation

Le système doit permettre une simulation :

```txt
sans écrire les résultats définitifs
avec aperçu des moyennes
avec aperçu des rangs
avec liste des anomalies
avec comparaison avec calcul précédent
```

Une simulation ne doit jamais alimenter les bulletins officiels.

---

# 20. Recalcul contrôlé

Un recalcul est autorisé si :

```txt
une correction validée a été faite
une règle de calcul a changé avant verrouillage
une anomalie a été corrigée
la direction l’autorise
```

Le recalcul doit :

```txt
créer un nouveau ExamCalculationRun
conserver l’ancien calcul
journaliser les écarts
demander une justification
invalider les bulletins non verrouillés si nécessaire
```

Aucun recalcul silencieux. Les mathématiques aiment la précision, l’administration aime les preuves.

---

# 21. Validation des calculs

Après calcul :

```txt
le responsable vérifie
ORION signale les anomalies
la direction valide
les résultats deviennent utilisables pour les bulletins
```

Un calcul validé peut ensuite être verrouillé.

---

# 22. Verrouillage des calculs

Un calcul verrouillé :

```txt
ne peut plus être modifié
ne peut plus être remplacé
ne peut plus être recalculé sans procédure exceptionnelle
devient la source officielle des bulletins
```

---

# 23. Backend — Routes API

```http
GET    /api/exams/calculations
GET    /api/exams/calculations/:id

POST   /api/exams/calculations/precheck
POST   /api/exams/calculations/simulate
POST   /api/exams/calculations/run
POST   /api/exams/calculations/:id/validate
POST   /api/exams/calculations/:id/lock
POST   /api/exams/calculations/:id/unlock

GET    /api/exams/calculations/:id/subject-averages
GET    /api/exams/calculations/:id/period-averages
GET    /api/exams/calculations/:id/annual-averages
GET    /api/exams/calculations/:id/kindergarten-synthesis
GET    /api/exams/calculations/:id/rankings
GET    /api/exams/calculations/:id/anomalies
GET    /api/exams/calculations/:id/audit
```

---

# 24. Backend — Services

```txt
ExamCalculationService
CalculationPrecheckService
KindergartenSynthesisService
PrimaryAverageService
SecondaryAverageService
SubjectAverageService
GeneralAverageService
AnnualAverageService
RankingService
CalculationSimulationService
RecalculationService
CalculationValidationService
CalculationLockService
CalculationAuditService
CalculationOrionService
```

---

# 25. Sécurité

## Permissions

```ts
EXAMS_CALCULATIONS_VIEW
EXAMS_CALCULATIONS_PRECHECK
EXAMS_CALCULATIONS_SIMULATE
EXAMS_CALCULATIONS_RUN
EXAMS_CALCULATIONS_VALIDATE
EXAMS_CALCULATIONS_LOCK
EXAMS_CALCULATIONS_UNLOCK
EXAMS_CALCULATIONS_RECALCULATE
```

---

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
audit obligatoire
aucune suppression destructive
snapshot des règles de calcul
snapshot des coefficients
transaction Prisma
blocage si résultats non validés
blocage si période verrouillée
```

---

# 26. Audit

Auditer :

```txt
pré-contrôle
simulation
calcul
validation
verrouillage
déverrouillage
recalcul
changement de règle
écart entre deux calculs
```

Chaque audit doit stocker :

```txt
utilisateur
rôle
périmètre
règle utilisée
ancienne valeur
nouvelle valeur
justification
date
IP
user agent
```

---

# 27. ORION

ORION doit détecter :

```txt
chute brutale de moyenne
hausse anormale
classe avec moyenne très faible
matière critique
enseignant avec résultats statistiquement atypiques
écart important FR/EN
série avec performance faible
élève en risque académique
absence massive impactant les moyennes
classement instable après correction
calcul lancé malgré anomalies
```

Exemple :

```txt
ORION — Risque académique détecté

42% des élèves de 3ème A ont une moyenne générale inférieure à 8/20.
Action recommandée : organiser un conseil pédagogique ciblé.
```

---

# 28. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 5 — Calculs, Moyennes & Classements** du **Module 3 — Examens, Notes & Bulletins**.

---

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
```

---

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
audit obligatoire
compatible Maternelle qualitative
compatible Primaire coefficient 1
compatible Secondaire avec coefficients
compatible séries
compatible bilingue pédagogique
simulation avant validation
recalcul contrôlé
snapshot des règles
snapshot des coefficients
verrouillage sécurisé
aucune suppression destructive
```

---

## À créer côté frontend

```txt
Page /exams/calculations
ExamCalculationsPage
CalculationOverviewCards
CalculationScopeSelector
CalculationPrecheckPanel
KindergartenSynthesisPanel
PrimaryAverageCalculationPanel
SecondaryAverageCalculationPanel
SubjectAverageTable
GeneralAverageTable
RankingTable
CalculationSimulationPanel
RecalculationRequestPanel
CalculationValidationPanel
CalculationLockPanel
CalculationOrionInsights
CalculationAuditTimeline
```

---

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Transactions Prisma
Contrôles RBAC
Pré-contrôle
Simulation
Calcul réel
Validation
Verrouillage
Recalcul contrôlé
Audit automatique
```

---

## À créer côté BDD

```txt
ExamCalculationRun
StudentSubjectAverage
StudentPeriodAverage
StudentAnnualAverage
KindergartenSynthesis
Enums CalculationStatus, CalculationScopeType, RankingMode
Relations avec Student, Class, Subject, Period, AcademicYear, CalculationRule
```

---

# 29. Résultat attendu

Google Antigravity doit produire un moteur permettant de :

```txt
pré-contrôler les résultats
simuler les moyennes
calculer les moyennes par matière
calculer les moyennes générales
produire les synthèses Maternelle
calculer les classements
gérer les séries
gérer le bilingue FR/EN
valider les calculs
verrouiller les calculs
auditer les recalculs
alimenter les bulletins
alimenter ORION
```

---

# Conclusion

L’onglet **Calculs, Moyennes & Classements** est le **cœur mathématique et réglementaire** du module Examen.

La logique complète devient :

```txt
Onglet 2 = règles
Onglet 3 = évaluations
Onglet 4 = résultats
Onglet 5 = consolidation officielle
```

La règle d’or ici :

```txt
Aucun calcul officiel sans résultats validés, règles figées et audit.
```

C’est cette rigueur qui permettra à Academia Helm d’être crédible devant une direction d’école, des enseignants, des parents et une administration.

---

Très bien. On passe à **Onglet 6 — Bulletins, Relevés & Documents académiques** du **Module 3 — Examens, Notes & Bulletins**.

Ici, on arrive à la partie visible par la direction, les parents, les élèves et parfois l’administration. Donc le niveau d’exigence doit monter encore d’un cran : **un bulletin n’est pas un simple PDF, c’est un document académique officiel**.

---

# MODULE 3 — EXAMENS, NOTES & BULLETINS

## ONGLET 6 — BULLETINS, RELEVÉS & DOCUMENTS ACADÉMIQUES

---

# 1. Objectif de l’onglet

L’onglet **Bulletins, Relevés & Documents académiques** permet de générer, contrôler, valider, publier et archiver les documents officiels issus des évaluations et calculs.

Il produit notamment :

```txt
bulletins périodiques
bulletins trimestriels
bulletins annuels
relevés de notes
synthèses qualitatives de Maternelle
documents bilingues FR/EN
exports PDF
archives académiques officielles
```

Cet onglet est la **vitrine officielle des résultats**.
Il doit donc être irréprochable : visuellement propre, juridiquement traçable, pédagogiquement lisible.

---

# 2. Positionnement dans le module

## Route frontend

```txt
/exams/report-cards
```

## Module parent

```txt
Examens, Notes & Bulletins
```

## Dépendances directes

```txt
Onglet 2 — Paramétrage académique
Onglet 3 — Évaluations & Sessions
Onglet 4 — Saisie des résultats & appréciations
Onglet 5 — Calculs, Moyennes & Classements
Module Élèves & Scolarité
Module Structure académique
Module Finance pour les politiques de blocage
Module Communication pour notification
ORION
```

---

# 3. Principe général

Un bulletin ne doit jamais être généré directement depuis des notes brutes.

La chaîne correcte est :

```txt
1. évaluations créées
2. résultats saisis
3. résultats validés
4. moyennes calculées
5. calculs validés
6. bulletin généré
7. bulletin contrôlé
8. bulletin validé
9. bulletin publié
10. bulletin archivé
```

Cette chaîne évite les erreurs classiques :

```txt
bulletin généré avec notes non validées
moyenne recalculée sans audit
PDF modifié après publication
rang incohérent
appréciation manquante
document publié malgré blocage financier
```

---

# 4. Compatibilité par niveau scolaire

---

## 4.1 Maternelle

Le bulletin de Maternelle doit être **qualitatif**.

Il contient :

```txt
domaines
compétences
codes TS/S/PS/NS
observations
synthèse narrative
appréciation enseignant
appréciation direction
signatures
```

Il ne doit pas contenir :

```txt
classement numérique
rang classique
moyenne obligatoire
logique de compétition académique
```

---

## 4.2 Primaire

Le bulletin du Primaire est **quantitatif sans coefficient différencié**.

Il contient :

```txt
matières
notes
moyennes
appréciations
moyenne générale
rang si activé
observation enseignant
observation direction
décision
```

Règle centrale :

```txt
coefficient 1 implicite
```

---

## 4.3 Secondaire

Le bulletin du Secondaire est **quantitatif avec coefficients**.

Il contient :

```txt
matières
notes
coefficients
moyennes matière
moyennes pondérées
moyenne générale
rang
mention
décision
série si applicable
appréciations
signatures
```

Règle centrale :

```txt
les données viennent du calcul validé et non d’un recalcul sauvage
```

---

# 5. Bilingue pédagogique

Le bulletin doit pouvoir être :

```txt
français
anglais
bilingue FR/EN
```

Le système doit gérer :

```txt
libellés traduits
matières en anglais
appréciations en anglais
sections FR/EN
moyennes séparées FR/EN si activées
modèle PDF bilingue
```

Exemples :

```txt
Français / French
Mathématiques / Mathematics
Sciences / Science
Appréciation générale / General comment
```

---

# 6. Structure fonctionnelle de l’onglet

L’onglet doit être organisé ainsi :

```txt
Bulletins, Relevés & Documents académiques
├── Vue d’ensemble
├── Sélection du périmètre
├── Pré-contrôle des bulletins
├── Modèles de bulletins
├── Génération des bulletins
├── Aperçu individuel
├── Contrôle direction
├── Validation des bulletins
├── Publication
├── Téléchargement PDF
├── Relevés de notes
├── Documents académiques
├── Archivage
├── ORION
└── Audit
```

---

# 7. Frontend

---

## 7.1 Route

```txt
/exams/report-cards
```

---

## 7.2 Page principale

```txt
app/(school)/exams/report-cards/page.tsx
```

---

## 7.3 Composants à créer

```txt
components/exams/report-cards/ReportCardsPage.tsx
components/exams/report-cards/ReportCardsOverviewCards.tsx
components/exams/report-cards/ReportCardScopeSelector.tsx
components/exams/report-cards/ReportCardPrecheckPanel.tsx
components/exams/report-cards/ReportCardTemplateSelector.tsx
components/exams/report-cards/ReportCardGenerationPanel.tsx
components/exams/report-cards/ReportCardPreview.tsx
components/exams/report-cards/KindergartenReportCardPreview.tsx
components/exams/report-cards/PrimaryReportCardPreview.tsx
components/exams/report-cards/SecondaryReportCardPreview.tsx
components/exams/report-cards/BilingualReportCardPreview.tsx
components/exams/report-cards/ReportCardValidationPanel.tsx
components/exams/report-cards/ReportCardPublicationPanel.tsx
components/exams/report-cards/ReportCardPdfExportPanel.tsx
components/exams/report-cards/TranscriptPanel.tsx
components/exams/report-cards/AcademicDocumentsPanel.tsx
components/exams/report-cards/ReportCardArchivePanel.tsx
components/exams/report-cards/ReportCardOrionInsights.tsx
components/exams/report-cards/ReportCardAuditTimeline.tsx
```

---

# 8. Filtres principaux

L’interface doit permettre de filtrer par :

```txt
année scolaire
période
niveau scolaire
classe
série
élève
type de bulletin
langue
statut
statut de publication
statut financier si blocage activé
```

---

# 9. Statuts de bulletin

```prisma
enum ReportCardStatus {
  DRAFT
  GENERATED
  UNDER_REVIEW
  VALIDATED
  PUBLISHED
  LOCKED
  ARCHIVED
  CANCELLED
}
```

Version métier :

```txt
Brouillon
Généré
En contrôle
Validé
Publié
Verrouillé
Archivé
Annulé
```

---

# 10. Types de documents académiques

```prisma
enum AcademicDocumentType {
  KINDERGARTEN_REPORT
  PRIMARY_REPORT
  SECONDARY_REPORT
  PERIOD_REPORT_CARD
  TERM_REPORT_CARD
  ANNUAL_REPORT_CARD
  TRANSCRIPT
  CERTIFICATE_OF_ATTENDANCE
  PERFORMANCE_SUMMARY
  BILINGUAL_REPORT_CARD
}
```

---

# 11. Base de données — ReportCard

```prisma
model ReportCard {
  id                    String @id @default(cuid())
  tenantId              String
  academicYearId        String

  studentId             String
  classId               String
  levelId               String?
  seriesId              String?
  periodId              String?

  schoolStage           SchoolStage
  documentType          AcademicDocumentType
  language              PedagogicalLanguage @default(FR)

  calculationRunId      String?
  templateId            String?

  title                 String
  reference             String?

  status                ReportCardStatus @default(DRAFT)

  generalAverage        Decimal? @db.Decimal(6,2)
  rankInClass           Int?
  rankLabel             String?
  mention               String?
  decision              String?

  kindergartenSummary   Json?
  subjectLines          Json?
  attendanceSummary     Json?
  appreciationSummary   Json?
  bilingualSummary      Json?

  pdfUrl                String?
  pdfHash               String?

  isPublished           Boolean @default(false)
  isLocked              Boolean @default(false)
  isFinanciallyBlocked  Boolean @default(false)

  generatedById         String?
  validatedById         String?
  publishedById         String?
  lockedById            String?

  generatedAt           DateTime?
  validatedAt           DateTime?
  publishedAt           DateTime?
  lockedAt              DateTime?
  archivedAt            DateTime?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@unique([tenantId, academicYearId, studentId, periodId, documentType, language])
  @@index([tenantId, academicYearId])
  @@index([studentId])
  @@index([classId, periodId])
  @@index([status])
}
```

---

# 12. Base de données — ReportCardTemplate

```prisma
model ReportCardTemplate {
  id                  String @id @default(cuid())
  tenantId            String?

  name                String
  code                String
  description         String?

  schoolStage         SchoolStage?
  documentType        AcademicDocumentType
  language            PedagogicalLanguage @default(FR)

  isPlatformDefault   Boolean @default(false)
  isActive            Boolean @default(true)

  layoutConfig        Json
  styleConfig         Json?
  sectionConfig       Json?
  printConfig         Json?

  createdById         String?

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@unique([tenantId, code])
  @@index([tenantId, documentType, schoolStage])
}
```

---

# 13. Base de données — ReportCardPublication

```prisma
model ReportCardPublication {
  id             String @id @default(cuid())
  tenantId       String
  reportCardId   String
  studentId      String
  parentId       String?

  channel        PublicationChannel
  status         PublicationStatus @default(PENDING)

  publishedById  String?
  publishedAt    DateTime?
  viewedAt       DateTime?
  downloadedAt   DateTime?

  failureReason  String?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([tenantId, reportCardId])
  @@index([studentId])
  @@index([parentId])
}

enum PublicationChannel {
  PORTAL
  EMAIL
  WHATSAPP
  PRINT
}

enum PublicationStatus {
  PENDING
  SENT
  VIEWED
  DOWNLOADED
  FAILED
  BLOCKED
}
```

---

# 14. Base de données — AcademicDocumentArchive

```prisma
model AcademicDocumentArchive {
  id              String @id @default(cuid())
  tenantId        String
  academicYearId  String

  studentId       String
  documentType    AcademicDocumentType
  reportCardId    String?

  fileUrl         String
  fileHash        String?
  reference       String?

  archivedById    String?
  archivedAt      DateTime @default(now())

  metadata        Json?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId, academicYearId])
  @@index([studentId])
  @@index([documentType])
}
```

---

# 15. Pré-contrôle avant génération

Avant de générer les bulletins, le système doit vérifier :

```txt
résultats validés
calculs validés
période cohérente
élève actif ou statut autorisé
modèle de bulletin disponible
données d’identité complètes
appréciations disponibles si obligatoires
décision ou mention selon configuration
blocage financier selon politique
absence de bulletin déjà verrouillé
```

Si une anomalie critique existe, la génération est bloquée.

Exemple :

```txt
Génération bloquée

La classe 6ème B contient 7 élèves avec calculs non validés.
Veuillez valider les calculs avant génération des bulletins.
```

---

# 16. Génération des bulletins

La génération doit suivre ce processus :

```txt
1. charger les données élève
2. charger la classe, le niveau, la série
3. charger les moyennes calculées
4. charger les appréciations
5. appliquer le modèle de bulletin
6. générer un aperçu
7. produire un PDF
8. calculer un hash du PDF
9. enregistrer le bulletin
10. journaliser l’opération
```

Le PDF doit être reproductible, traçable et archivable.

---

# 17. Bulletin Maternelle

## Sections recommandées

```txt
identité élève
période
domaines évalués
compétences
appréciations TS/S/PS/NS
observations
synthèse narrative
appréciation enseignant
appréciation direction
signatures
```

## Règles métier

```txt
1. Pas de moyenne numérique obligatoire.
2. Pas de rang.
3. Pas de classement.
4. Synthèse qualitative claire.
5. Langage compréhensible pour les parents.
```

---

# 18. Bulletin Primaire

## Sections recommandées

```txt
identité élève
matières
notes
moyennes
appréciations
moyenne générale
rang si activé
observation enseignant
observation direction
décision
signatures
```

## Règles métier

```txt
1. Coefficient 1 implicite.
2. Affichage coefficient optionnel mais non différencié.
3. Appréciations automatiques ou manuelles.
4. Classement selon politique école.
```

---

# 19. Bulletin Secondaire

## Sections recommandées

```txt
identité élève
classe
série
matières
notes
coefficients
moyennes pondérées
moyenne générale
rang
mention
décision
appréciations
signatures
```

## Règles métier

```txt
1. Coefficients obligatoires.
2. Série affichée si applicable.
3. Moyenne pondérée obligatoire.
4. Classement selon politique.
5. Données figées depuis le calcul validé.
```

---

# 20. Relevés de notes

Le système doit générer des relevés :

```txt
par période
annuels
par matière
par élève
en français
en anglais
bilingues
```

Un relevé peut être plus administratif qu’un bulletin et contenir moins d’appréciations.

Exemple :

```txt
Relevé annuel de notes — Élève X — Année scolaire 2026-2027
```

---

# 21. Publication

## Canaux de publication

```txt
portail parent/élève
email
WhatsApp si activé
impression
téléchargement interne
```

## Règles métier

```txt
1. Seuls les bulletins validés peuvent être publiés.
2. Les bulletins bloqués financièrement ne sont pas publiés selon politique.
3. Toute publication est auditée.
4. La consultation parent est tracée.
5. Le PDF publié doit être identique au PDF archivé.
```

---

# 22. Blocage financier

Selon la politique de l’école, un bulletin peut être :

```txt
visible malgré dette
visible partiellement
bloqué
téléchargeable uniquement après régularisation
soumis à validation direction
```

Point important :

```txt
Le blocage financier ne doit jamais supprimer le bulletin.
Il limite uniquement la publication ou l’accès.
```

---

# 23. Validation des bulletins

La validation doit confirmer :

```txt
exactitude des moyennes
cohérence des appréciations
conformité du modèle
absence d’anomalies critiques
conformité de la période
conformité des signatures
```

---

# 24. Verrouillage et archivage

Un bulletin verrouillé :

```txt
ne peut plus être modifié
ne peut plus être régénéré silencieusement
ne peut plus changer de PDF
devient document officiel
```

L’archivage doit conserver :

```txt
PDF
hash
métadonnées
utilisateur
date
version du modèle
snapshot des données
```

---

# 25. Backend — Routes API

```http
GET    /api/exams/report-cards
GET    /api/exams/report-cards/:id

POST   /api/exams/report-cards/precheck
POST   /api/exams/report-cards/generate
POST   /api/exams/report-cards/bulk-generate
POST   /api/exams/report-cards/:id/preview
POST   /api/exams/report-cards/:id/validate
POST   /api/exams/report-cards/:id/publish
POST   /api/exams/report-cards/:id/lock
POST   /api/exams/report-cards/:id/archive
POST   /api/exams/report-cards/:id/cancel

GET    /api/exams/report-cards/:id/pdf
GET    /api/exams/report-cards/:id/audit
GET    /api/exams/report-cards/:id/publications

GET    /api/exams/report-card-templates
POST   /api/exams/report-card-templates
PATCH  /api/exams/report-card-templates/:id

GET    /api/exams/transcripts
POST   /api/exams/transcripts/generate
```

---

# 26. Backend — Services

```txt
ReportCardService
ReportCardPrecheckService
ReportCardGenerationService
ReportCardPdfService
ReportCardTemplateService
KindergartenReportCardService
PrimaryReportCardService
SecondaryReportCardService
BilingualReportCardService
TranscriptService
ReportCardValidationService
ReportCardPublicationService
ReportCardArchiveService
ReportCardFinanceGateService
ReportCardAuditService
ReportCardOrionService
```

---

# 27. Sécurité

## Permissions

```ts
EXAMS_REPORT_CARDS_VIEW
EXAMS_REPORT_CARDS_GENERATE
EXAMS_REPORT_CARDS_VALIDATE
EXAMS_REPORT_CARDS_PUBLISH
EXAMS_REPORT_CARDS_LOCK
EXAMS_REPORT_CARDS_ARCHIVE
EXAMS_REPORT_CARDS_TEMPLATE_MANAGE
EXAMS_TRANSCRIPTS_GENERATE
EXAMS_REPORT_CARDS_DOWNLOAD
```

---

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
accès parent limité à ses enfants
enseignant en lecture selon politique
audit obligatoire
aucune suppression destructive
PDF hashé
modèle versionné
publication contrôlée
```

---

# 28. Audit

Auditer :

```txt
pré-contrôle
génération
régénération
validation
publication
téléchargement
verrouillage
archivage
blocage financier
changement de modèle
consultation parent
```

Chaque audit doit stocker :

```txt
utilisateur
rôle
action
bulletin concerné
ancienne valeur
nouvelle valeur
justification
date
IP
user agent
```

---

# 29. ORION

ORION doit détecter :

```txt
bulletin généré avec données manquantes
appréciations absentes
incohérence moyenne / mention
incohérence rang / moyenne
bulletin bloqué financièrement
classe avec bulletins non générés
retard de publication
différence entre PDF généré et PDF archivé
modèle non conforme
anomalies bilingues FR/EN
taux d’échec de publication
```

Exemple :

```txt
ORION — Publication incomplète

12 bulletins de CM2 A ne sont pas publiables :
- appréciation direction manquante ;
- 3 élèves sous blocage financier.
```

---

# 30. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 6 — Bulletins, Relevés & Documents académiques** du **Module 3 — Examens, Notes & Bulletins**.

---

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
```

---

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
compatible Maternelle qualitative
compatible Primaire coefficient 1
compatible Secondaire avec coefficients
compatible séries
compatible bilingue pédagogique
génération PDF robuste
hash PDF
modèles versionnés
publication contrôlée
blocage financier configurable
audit complet
archivage officiel
aucune suppression destructive
```

---

## À créer côté frontend

```txt
Page /exams/report-cards
ReportCardsPage
ReportCardsOverviewCards
ReportCardScopeSelector
ReportCardPrecheckPanel
ReportCardTemplateSelector
ReportCardGenerationPanel
ReportCardPreview
KindergartenReportCardPreview
PrimaryReportCardPreview
SecondaryReportCardPreview
BilingualReportCardPreview
ReportCardValidationPanel
ReportCardPublicationPanel
ReportCardPdfExportPanel
TranscriptPanel
AcademicDocumentsPanel
ReportCardArchivePanel
ReportCardOrionInsights
ReportCardAuditTimeline
```

---

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Transactions Prisma
Contrôles RBAC
Génération PDF
Hash PDF
Publication
Archivage
Blocage financier
Audit automatique
```

---

## À créer côté BDD

```txt
ReportCard
ReportCardTemplate
ReportCardPublication
AcademicDocumentArchive
Enums ReportCardStatus, AcademicDocumentType, PublicationChannel, PublicationStatus
Relations avec Student, Class, Period, AcademicYear, CalculationRun, User
```

---

# 31. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
pré-contrôler les bulletins
générer les bulletins
prévisualiser les bulletins
gérer les modèles
générer les PDF
valider les bulletins
publier les bulletins
bloquer selon politique financière
télécharger les relevés
archiver les documents
auditer toutes les actions
alimenter ORION
```

---

# Conclusion

L’onglet **Bulletins, Relevés & Documents académiques** est le **centre de production officielle des documents académiques**.

La chaîne devient maintenant :

```txt
Onglet 2 = règles
Onglet 3 = évaluations
Onglet 4 = résultats
Onglet 5 = calculs
Onglet 6 = documents officiels
```

La règle d’or ici :

```txt
Un bulletin publié doit être traçable, verrouillé, archivable et reproductible.
```

C’est ce niveau de rigueur qui donnera à Academia Helm une vraie stature de plateforme scolaire professionnelle.

---

Parfait. On passe à **Onglet 7 — Publication, Accès Parents/Élèves & Communication des Résultats** du **Module 3 — Examens, Notes & Bulletins**.

Ici, on ne génère plus les bulletins. On gère leur **diffusion officielle**, leur **accès sécurisé**, les **notifications**, les **blocages financiers**, les **consultations parents** et l’**audit de publication**.

C’est l’onglet qui répond à une question très concrète :
**qui peut voir quoi, quand, par quel canal, et sous quelles conditions ?**

---

# MODULE 3 — EXAMENS, NOTES & BULLETINS

## ONGLET 7 — PUBLICATION, ACCÈS PARENTS/ÉLÈVES & COMMUNICATION DES RÉSULTATS

---

# 1. Objectif de l’onglet

L’onglet **Publication, Accès Parents/Élèves & Communication des Résultats** permet de gérer la mise à disposition officielle des bulletins, relevés et résultats validés auprès des parents, élèves et parties autorisées.

Cet onglet couvre :

```txt
publication sur portail parent/élève
publication individuelle ou par lot
notification email
notification WhatsApp si activée
contrôle des accès
blocage financier
suivi des consultations
téléchargement sécurisé
accusés de consultation
audit
alertes ORION
```

Cet onglet ne doit pas être traité comme un simple module “envoyer PDF”.
Il doit être un **système de diffusion académique contrôlée**.

---

# 2. Positionnement dans le module

## Route frontend

```txt
/exams/publication
```

## Module parent

```txt
Examens, Notes & Bulletins
```

## Dépendances directes

```txt
Onglet 6 — Bulletins, Relevés & Documents académiques
Module Élèves & Scolarité
Module Parents/Portail
Module Finance
Module Communication
Module Paramètres
ORION
```

---

# 3. Principe général

Un résultat ou bulletin ne doit être publié que si :

```txt
1. le bulletin est généré
2. le bulletin est validé
3. le bulletin n’est pas annulé
4. la politique financière autorise l’accès
5. le parent ou l’élève dispose d’un compte actif
6. les droits d’accès sont conformes
7. la publication est auditée
```

La publication est donc un **workflow de diffusion officielle**, pas un simple bouton :

```txt
Envoyer
```

Parce qu’un bouton “Envoyer” sans contrôle, c’est souvent le début d’un lundi matin très long.

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit être organisé ainsi :

```txt
Publication & Communication
├── Vue d’ensemble
├── Sélection du périmètre
├── Pré-contrôle de publication
├── Publication individuelle
├── Publication par classe
├── Publication par niveau
├── Publication par période
├── Blocage financier
├── Notifications
├── Accès portail parent/élève
├── Suivi des consultations
├── Téléchargements
├── Relances automatiques
├── ORION
└── Audit
```

---

# 5. Frontend

---

## 5.1 Route

```txt
/exams/publication
```

---

## 5.2 Page principale

```txt
app/(school)/exams/publication/page.tsx
```

---

## 5.3 Composants à créer

```txt
components/exams/publication/ResultsPublicationPage.tsx
components/exams/publication/PublicationOverviewCards.tsx
components/exams/publication/PublicationScopeSelector.tsx
components/exams/publication/PublicationPrecheckPanel.tsx
components/exams/publication/IndividualPublicationPanel.tsx
components/exams/publication/BulkPublicationPanel.tsx
components/exams/publication/FinancialBlockingPanel.tsx
components/exams/publication/NotificationChannelSelector.tsx
components/exams/publication/ParentPortalAccessPanel.tsx
components/exams/publication/PublicationTrackingTable.tsx
components/exams/publication/DownloadTrackingPanel.tsx
components/exams/publication/PublicationReminderPanel.tsx
components/exams/publication/PublicationOrionInsights.tsx
components/exams/publication/PublicationAuditTimeline.tsx
```

---

# 6. Filtres principaux

L’interface doit permettre de filtrer par :

```txt
année scolaire
période
niveau scolaire
classe
série
élève
parent
type de document
statut du bulletin
statut financier
statut de publication
statut de consultation
canal de notification
```

---

# 7. Statuts de publication

```prisma
enum ResultPublicationStatus {
  NOT_PUBLISHED
  READY
  BLOCKED
  PUBLISHED
  PARTIALLY_PUBLISHED
  VIEWED
  DOWNLOADED
  FAILED
  CANCELLED
}
```

Version métier :

```txt
Non publié
Prêt
Bloqué
Publié
Partiellement publié
Consulté
Téléchargé
Échec
Annulé
```

---

# 8. Base de données — ResultPublicationBatch

Ce modèle représente une publication groupée.

```prisma
model ResultPublicationBatch {
  id                String @id @default(cuid())
  tenantId          String
  academicYearId    String

  name              String
  periodId          String?
  classId           String?
  levelId           String?
  seriesId          String?

  documentType      AcademicDocumentType
  channel           PublicationChannel?

  totalDocuments    Int @default(0)
  publishedCount    Int @default(0)
  blockedCount      Int @default(0)
  failedCount       Int @default(0)
  viewedCount       Int @default(0)
  downloadedCount   Int @default(0)

  status            ResultPublicationStatus @default(NOT_PUBLISHED)

  startedById       String?
  completedById     String?

  startedAt         DateTime?
  completedAt       DateTime?

  configSnapshot    Json?
  summary           Json?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([tenantId, academicYearId])
  @@index([periodId, classId, levelId, seriesId])
  @@index([status])
}
```

---

# 9. Base de données — ResultPublicationAccess

Ce modèle contrôle l’accès aux documents publiés.

```prisma
model ResultPublicationAccess {
  id                    String @id @default(cuid())
  tenantId              String

  reportCardId          String
  studentId             String
  parentId              String?
  userId                String?

  canView               Boolean @default(false)
  canDownload           Boolean @default(false)
  canPrint              Boolean @default(false)

  isFinanciallyBlocked  Boolean @default(false)
  blockingReason        String?

  accessTokenHash       String?
  expiresAt             DateTime?

  grantedById           String?
  revokedById           String?

  grantedAt             DateTime?
  revokedAt             DateTime?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([tenantId, reportCardId])
  @@index([studentId])
  @@index([parentId])
  @@index([userId])
}
```

---

# 10. Base de données — ResultPublicationEvent

Ce modèle trace les événements de publication, notification, consultation et téléchargement.

```prisma
model ResultPublicationEvent {
  id                String @id @default(cuid())
  tenantId          String

  batchId           String?
  reportCardId      String
  studentId         String
  parentId          String?
  userId            String?

  channel           PublicationChannel
  status            PublicationStatus

  messageTitle      String?
  messageBody       String?

  sentAt            DateTime?
  viewedAt          DateTime?
  downloadedAt      DateTime?
  failedAt          DateTime?

  failureReason     String?
  metadata          Json?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([tenantId, reportCardId])
  @@index([batchId])
  @@index([studentId])
  @@index([parentId])
  @@index([status])
}
```

---

# 11. Pré-contrôle de publication

Avant publication, le système doit vérifier :

```txt
bulletin généré
bulletin validé
bulletin non annulé
bulletin non archivé comme obsolète
PDF disponible
hash PDF présent
parent ou élève avec compte actif
accès autorisé
politique financière appliquée
canal de notification configuré
modèle de message disponible
aucune publication contradictoire
```

Si une anomalie critique existe, la publication est bloquée.

Exemple :

```txt
Publication bloquée

8 bulletins de 5ème A ne peuvent pas être publiés :
- 3 bulletins non validés ;
- 2 parents sans compte actif ;
- 3 élèves sous blocage financier.
```

---

# 12. Publication individuelle

La publication individuelle permet de publier un bulletin pour un seul élève.

Actions disponibles :

```txt
voir le statut du bulletin
voir le statut financier
voir les parents liés
publier sur portail
envoyer notification
autoriser téléchargement
bloquer/débloquer selon permission
consulter l’historique
```

---

# 13. Publication par lot

La publication par lot peut se faire par :

```txt
classe
niveau
série
période
type de document
statut financier
statut de validation
```

Le système doit produire un rapport :

```txt
nombre de bulletins publiés
nombre de bulletins bloqués
nombre d’échecs
raisons d’échec
parents notifiés
bulletins consultés
bulletins téléchargés
```

---

# 14. Blocage financier

Le blocage financier doit être configurable.

Modes possibles :

```txt
aucun blocage
blocage téléchargement uniquement
blocage consultation complète
consultation partielle
autorisation manuelle direction
délai de grâce
seuil de dette
```

Règles métier :

```txt
1. Le bulletin reste généré et archivé.
2. Le blocage limite uniquement l’accès.
3. Le motif doit être visible côté administration.
4. Le message parent doit rester professionnel.
5. Le déblocage doit être audité.
6. Le système doit se synchroniser avec le module Finance.
```

Message parent recommandé :

```txt
Votre document académique est temporairement indisponible. Veuillez contacter l’administration de l’école pour régularisation.
```

Il faut éviter les messages humiliants ou trop directs. On reste professionnel.

---

# 15. Portail parent/élève

Depuis le portail, le parent ou l’élève doit pouvoir :

```txt
voir les bulletins publiés
consulter les relevés
télécharger si autorisé
voir les périodes disponibles
voir les messages de blocage si applicable
recevoir les notifications
confirmer la consultation si activé
```

Accès strict :

```txt
un parent ne voit que ses enfants
un élève ne voit que ses propres documents
aucun accès inter-tenant
aucun lien public non sécurisé
```

---

# 16. Notifications

## Canaux

```txt
portail
email
WhatsApp si activé
SMS si futur module activé
notification interne
```

## Modèles de messages

```txt
bulletin disponible
relevé disponible
document bloqué pour régularisation
rappel de consultation
publication annulée
nouveau document académique
```

Exemple :

```txt
Le bulletin de votre enfant est disponible dans votre espace parent. Veuillez vous connecter pour le consulter.
```

---

# 17. Suivi des consultations

Le système doit suivre :

```txt
document publié
notification envoyée
parent connecté
document consulté
document téléchargé
échec de notification
accès bloqué
relance envoyée
```

Ces données alimentent :

```txt
direction
communication
finance
ORION
audit
```

---

# 18. Relances automatiques

Le système doit permettre :

```txt
relance des parents n’ayant pas consulté
relance après échec email
relance après régularisation financière
relance avant réunion parents
relance personnalisée par classe
```

Les relances doivent respecter :

```txt
fréquence maximale
consentement canal
horaires autorisés
audit
désactivation possible
```

---

# 19. Annulation de publication

Une publication peut être annulée si :

```txt
bulletin erroné
erreur de période
mauvais document
correction validée après publication
décision direction
```

L’annulation doit :

```txt
retirer l’accès
conserver l’audit
conserver l’ancien document archivé
notifier si nécessaire
générer une nouvelle publication après correction
```

---

# 20. Backend — Routes API

```http
GET    /api/exams/publications
GET    /api/exams/publications/:id

POST   /api/exams/publications/precheck
POST   /api/exams/publications/publish-one
POST   /api/exams/publications/publish-bulk
POST   /api/exams/publications/:id/cancel

GET    /api/exams/publications/batches
GET    /api/exams/publications/batches/:id
GET    /api/exams/publications/batches/:id/report

POST   /api/exams/report-cards/:id/grant-access
POST   /api/exams/report-cards/:id/revoke-access
POST   /api/exams/report-cards/:id/send-notification
POST   /api/exams/report-cards/:id/resend-notification

GET    /api/exams/report-cards/:id/access
GET    /api/exams/report-cards/:id/events
GET    /api/exams/publications/tracking

POST   /api/exams/publications/reminders/send
GET    /api/exams/publications/audit
```

---

# 21. Backend — Services

```txt
ResultPublicationService
PublicationPrecheckService
BulkPublicationService
IndividualPublicationService
PublicationAccessService
PublicationNotificationService
PublicationTrackingService
PublicationReminderService
PublicationFinanceGateService
PublicationCancellationService
PublicationAuditService
PublicationOrionService
```

---

# 22. Sécurité

## Permissions

```ts
EXAMS_PUBLICATIONS_VIEW
EXAMS_PUBLICATIONS_PRECHECK
EXAMS_PUBLICATIONS_PUBLISH_ONE
EXAMS_PUBLICATIONS_PUBLISH_BULK
EXAMS_PUBLICATIONS_CANCEL
EXAMS_PUBLICATIONS_GRANT_ACCESS
EXAMS_PUBLICATIONS_REVOKE_ACCESS
EXAMS_PUBLICATIONS_SEND_NOTIFICATION
EXAMS_PUBLICATIONS_TRACKING_VIEW
```

---

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
parent limité à ses enfants
élève limité à ses documents
liens sécurisés
tokens hashés
expiration des accès temporaires
audit obligatoire
aucune suppression destructive
```

---

# 23. Audit

Auditer :

```txt
pré-contrôle
publication individuelle
publication par lot
accès accordé
accès révoqué
notification envoyée
notification échouée
consultation
téléchargement
blocage financier
déblocage
annulation de publication
relance
```

Chaque audit doit stocker :

```txt
utilisateur
rôle
action
document
élève
parent
canal
ancienne valeur
nouvelle valeur
justification
date
IP
user agent
```

---

# 24. ORION

ORION doit détecter :

```txt
bulletins validés mais non publiés
taux de consultation faible
échecs massifs de notification
parents non connectés
classe avec beaucoup de bulletins bloqués
incohérence entre statut financier et accès
téléchargement suspect
accès révoqué après publication
publication annulée après consultation
retards de publication
```

Exemple :

```txt
ORION — Consultation faible

37% des parents de 6ème A n’ont pas consulté les bulletins 72h après publication.
Relance recommandée.
```

---

# 25. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 7 — Publication, Accès Parents/Élèves & Communication des Résultats** du **Module 3 — Examens, Notes & Bulletins**.

---

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
```

---

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
accès parent/enfant strict
accès élève strict
publication uniquement de bulletins validés
blocage financier configurable
notifications traçables
suivi consultation/téléchargement
tokens sécurisés
audit complet
aucune suppression destructive
ORION intégré
```

---

## À créer côté frontend

```txt
Page /exams/publication
ResultsPublicationPage
PublicationOverviewCards
PublicationScopeSelector
PublicationPrecheckPanel
IndividualPublicationPanel
BulkPublicationPanel
FinancialBlockingPanel
NotificationChannelSelector
ParentPortalAccessPanel
PublicationTrackingTable
DownloadTrackingPanel
PublicationReminderPanel
PublicationOrionInsights
PublicationAuditTimeline
```

---

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Transactions Prisma
Contrôles RBAC
Publication individuelle
Publication par lot
Gestion accès parent/élève
Notifications
Blocage financier
Suivi consultation
Relances
Audit automatique
```

---

## À créer côté BDD

```txt
ResultPublicationBatch
ResultPublicationAccess
ResultPublicationEvent
Enums ResultPublicationStatus
Relations avec ReportCard, Student, Parent, User, AcademicYear, Period, Class
```

---

# 26. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
pré-contrôler la publication
publier un bulletin individuellement
publier par lot
gérer les accès parents/élèves
appliquer les blocages financiers
envoyer les notifications
suivre les consultations
suivre les téléchargements
relancer automatiquement
annuler une publication
auditer toutes les actions
alimenter ORION
```

---

# Conclusion

L’onglet **Publication, Accès Parents/Élèves & Communication des Résultats** est le **centre de diffusion officielle des documents académiques**.

La chaîne du module devient :

```txt
Onglet 2 = règles
Onglet 3 = évaluations
Onglet 4 = résultats
Onglet 5 = calculs
Onglet 6 = documents officiels
Onglet 7 = publication contrôlée
```

La règle d’or ici :

```txt
Un bulletin validé n’est pas forcément publiable.
```

Il doit passer par les contrôles d’accès, les politiques financières, les droits parent/élève et l’audit. C’est ce qui donne à Academia Helm une vraie maturité SaaS institutionnelle.

---

Très bien. On attaque **l’onglet suivant**, donc :

# MODULE 3 — EXAMENS, NOTES & BULLETINS

## ONGLET 8 — RAPPORTS, STATISTIQUES & ANALYTIQUE ACADÉMIQUE ORION

Cet onglet est le **poste de pilotage stratégique** du module Examens.
Les onglets précédents produisent les données. Celui-ci les transforme en **lecture décisionnelle** : performances, risques, anomalies, progressions, publications, comportements parents, efficacité pédagogique.

Autrement dit : ici, Academia Helm ne se contente plus de “gérer les notes”. Il aide la direction à **comprendre ce qui se passe réellement dans l’école**.

---

# 1. Objectif de l’onglet

L’onglet **Rapports, Statistiques & Analytique académique ORION** permet d’exploiter les données issues des évaluations, résultats, moyennes, bulletins et publications afin de produire des tableaux décisionnels fiables pour la direction.

Il couvre :

```txt
rapports de performance par élève
rapports par classe
rapports par niveau
rapports par série
rapports par matière
rapports par enseignant
rapports par période
analyse bilingue FR/EN
suivi des progressions
détection des risques académiques
indicateurs de publication
export PDF/Excel
recommandations ORION
```

Cet onglet transforme les données scolaires en **pilotage stratégique**.

---

# 2. Positionnement dans le module

## Route frontend

```txt
/exams/analytics
```

## Module parent

```txt
Examens, Notes & Bulletins
```

## Dépendances directes

```txt
Onglet 3 — Évaluations & Sessions
Onglet 4 — Saisie des résultats & appréciations
Onglet 5 — Calculs, Moyennes & Classements
Onglet 6 — Bulletins, Relevés & Documents académiques
Onglet 7 — Publication & Communication
Module Structure académique
Module Élèves & Scolarité
Module Enseignants
Module Finance
ORION
```

---

# 3. Principe général

L’onglet ne doit pas être un simple tableau de statistiques.

Il doit répondre à des questions de direction :

```txt
quelles classes sont en difficulté ?
quelles matières tirent les moyennes vers le bas ?
quels enseignants ont des résultats atypiques ?
quels élèves sont à risque ?
quelles séries performent mieux ?
les matières en anglais progressent-elles ?
les bulletins sont-ils publiés à temps ?
les parents consultent-ils les résultats ?
quelles actions pédagogiques recommander ?
```

C’est là que l’IA ORION devient réellement utile : elle ne doit pas seulement afficher des chiffres, elle doit **faire émerger les signaux faibles**.

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit être organisé ainsi :

```txt
Rapports & Analytique
├── Vue d’ensemble académique
├── Analyse par élève
├── Analyse par classe
├── Analyse par niveau
├── Analyse par série
├── Analyse par matière
├── Analyse par enseignant
├── Analyse par période
├── Analyse bilingue FR/EN
├── Analyse des classements
├── Analyse des bulletins
├── Analyse de publication
├── Détection des risques
├── Recommandations ORION
├── Exports
└── Audit
```

---

# 5. Frontend

## 5.1 Route

```txt
/exams/analytics
```

## 5.2 Page principale

```txt
app/(school)/exams/analytics/page.tsx
```

## 5.3 Composants à créer

```txt
components/exams/analytics/ExamAnalyticsPage.tsx
components/exams/analytics/ExamAnalyticsOverviewCards.tsx
components/exams/analytics/AnalyticsScopeSelector.tsx
components/exams/analytics/StudentPerformancePanel.tsx
components/exams/analytics/ClassPerformancePanel.tsx
components/exams/analytics/LevelPerformancePanel.tsx
components/exams/analytics/SeriesPerformancePanel.tsx
components/exams/analytics/SubjectPerformancePanel.tsx
components/exams/analytics/TeacherPerformancePanel.tsx
components/exams/analytics/PeriodComparisonPanel.tsx
components/exams/analytics/BilingualAnalyticsPanel.tsx
components/exams/analytics/RankingAnalyticsPanel.tsx
components/exams/analytics/ReportCardAnalyticsPanel.tsx
components/exams/analytics/PublicationAnalyticsPanel.tsx
components/exams/analytics/AcademicRiskPanel.tsx
components/exams/analytics/OrionRecommendationPanel.tsx
components/exams/analytics/AnalyticsExportPanel.tsx
components/exams/analytics/AnalyticsAuditTimeline.tsx
```

---

# 6. Filtres principaux

L’interface doit permettre de filtrer par :

```txt
année scolaire
période
niveau scolaire
classe
série
élève
enseignant
matière
langue pédagogique
type d’évaluation
type de document
statut de publication
indicateur ORION
seuil de risque
```

---

# 7. Indicateurs clés

## 7.1 Indicateurs académiques

```txt
moyenne générale par classe
moyenne par matière
moyenne par niveau
moyenne par série
taux de réussite
taux d’échec
taux d’excellence
taux d’élèves à risque
progression moyenne
régression moyenne
dispersion des notes
écart-type
meilleure progression
plus forte baisse
```

---

## 7.2 Indicateurs pédagogiques

```txt
matière la plus faible
matière la plus forte
classe la plus fragile
enseignant avec résultats atypiques
évaluation avec anomalie
volume d’absences aux évaluations
taux de devoirs non saisis
taux de corrections après validation
```

---

## 7.3 Indicateurs publication

```txt
bulletins générés
bulletins validés
bulletins publiés
bulletins bloqués financièrement
bulletins consultés
bulletins téléchargés
parents non connectés
taux d’échec notification
```

---

# 8. Base de données — ExamAnalyticsSnapshot

```prisma
model ExamAnalyticsSnapshot {
  id              String @id @default(cuid())
  tenantId        String
  academicYearId  String

  periodId        String?
  classId         String?
  levelId         String?
  seriesId        String?
  subjectId       String?
  teacherId       String?

  scopeType       AnalyticsScopeType

  averageValue    Decimal? @db.Decimal(6,2)
  successRate     Decimal? @db.Decimal(6,2)
  failureRate     Decimal? @db.Decimal(6,2)
  excellenceRate  Decimal? @db.Decimal(6,2)
  riskRate        Decimal? @db.Decimal(6,2)

  totalStudents   Int @default(0)
  rankedStudents  Int @default(0)
  atRiskStudents  Int @default(0)

  metrics         Json
  generatedById   String?
  generatedAt     DateTime @default(now())

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId, academicYearId])
  @@index([periodId, classId, levelId, seriesId])
  @@index([subjectId])
  @@index([teacherId])
}
```

---

# 9. Enum — AnalyticsScopeType

```prisma
enum AnalyticsScopeType {
  GLOBAL
  STUDENT
  CLASS
  LEVEL
  SERIES
  SUBJECT
  TEACHER
  PERIOD
  BILINGUAL
  PUBLICATION
  RANKING
}
```

---

# 10. Base de données — AcademicRiskSignal

```prisma
model AcademicRiskSignal {
  id              String @id @default(cuid())
  tenantId        String
  academicYearId  String

  studentId       String?
  classId         String?
  levelId         String?
  seriesId        String?
  subjectId       String?
  teacherId       String?
  periodId        String?

  riskType        AcademicRiskType
  severity        RiskSeverity

  title           String
  description     String
  recommendation  String?

  score           Decimal? @db.Decimal(6,2)
  metadata        Json?

  status          RiskSignalStatus @default(OPEN)

  detectedAt      DateTime @default(now())
  resolvedAt      DateTime?
  resolvedById    String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId, academicYearId])
  @@index([studentId])
  @@index([classId])
  @@index([subjectId])
  @@index([riskType, severity])
}
```

---

# 11. Enums risques

```prisma
enum AcademicRiskType {
  LOW_AVERAGE
  SHARP_DECLINE
  REPEATED_FAILURE
  SUBJECT_FAILURE
  CLASS_UNDERPERFORMANCE
  SERIES_UNDERPERFORMANCE
  TEACHER_RESULT_ANOMALY
  BILINGUAL_GAP
  ABSENCE_IMPACT
  PUBLICATION_DELAY
  LOW_PARENT_ENGAGEMENT
}

enum RiskSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum RiskSignalStatus {
  OPEN
  ACKNOWLEDGED
  IN_PROGRESS
  RESOLVED
  DISMISSED
}
```

---

# 12. Analyse par élève

Le système doit afficher :

```txt
moyenne par période
évolution annuelle
rang
matières fortes
matières faibles
absences aux évaluations
appréciations récurrentes
risques détectés
recommandations ORION
historique des bulletins
```

Objectif : permettre à la direction de suivre rapidement un élève fragile ou performant.

---

# 13. Analyse par classe

Le système doit afficher :

```txt
moyenne générale de classe
distribution des moyennes
meilleurs élèves
élèves à risque
matières faibles
taux de réussite
taux d’échec
comparaison avec autres classes
progression depuis la période précédente
alertes ORION
```

---

# 14. Analyse par niveau

Le système doit afficher :

```txt
performance globale du niveau
comparaison entre classes
matières critiques
taux de réussite
taux de redoublement probable
évolution par période
recommandations pédagogiques
```

---

# 15. Analyse par série

Pour le Secondaire, le système doit analyser :

```txt
moyenne par série
performance par matière de spécialité
comparaison entre séries
matières discriminantes
taux de réussite par série
risques spécifiques
recommandations ORION
```

Exemples de séries :

```txt
A
B
C
D
G
séries personnalisées selon école
```

---

# 16. Analyse par matière

Le système doit afficher :

```txt
moyenne matière
taux d’échec
taux d’excellence
progression
classes en difficulté
enseignants associés
volume d’évaluations
cohérence des notes
anomalies statistiques
```

---

# 17. Analyse par enseignant

Le système doit afficher :

```txt
matières enseignées
classes suivies
taux de saisie
retards de saisie
moyenne des classes
distribution des notes
corrections après validation
anomalies ORION
évolution des performances
```

Point important : l’analyse enseignant doit être un **outil de pilotage pédagogique**, pas un outil de sanction automatique. Les chiffres indiquent des signaux ; la décision reste humaine.

---

# 18. Analyse bilingue FR/EN

Le système doit analyser :

```txt
performance des matières en français
performance des matières en anglais
écart FR/EN
progression des matières anglophones
élèves en difficulté sur le parcours bilingue
classes avec déséquilibre linguistique
recommandations ORION
```

---

# 19. Analyse des classements

Le système doit afficher :

```txt
rangs par classe
évolution des rangs
ex aequo
élèves en progression
élèves en chute
stabilité du classement
anomalies de classement
impact des corrections
```

---

# 20. Analyse des bulletins

Le système doit suivre :

```txt
bulletins générés
bulletins validés
bulletins verrouillés
bulletins archivés
bulletins annulés
bulletins régénérés
anomalies de PDF
modèles utilisés
```

---

# 21. Analyse de publication

Le système doit suivre :

```txt
taux de publication
taux de consultation
taux de téléchargement
taux de blocage financier
échecs de notification
parents non connectés
relances envoyées
délai moyen de consultation
```

---

# 22. Recommandations ORION

ORION doit produire des recommandations exploitables :

```txt
organiser une remédiation
revoir une progression pédagogique
contrôler une matière
convoquer un conseil pédagogique
relancer les parents
vérifier une anomalie de saisie
accompagner un enseignant
renforcer le bilingue
surveiller une série
```

Chaque recommandation doit avoir :

```txt
titre
justification
niveau de priorité
périmètre
action recommandée
responsable suggéré
délai conseillé
```

Exemple :

```txt
ORION — Risque académique élevé

La classe 3ème B présente un taux d’échec de 48% en Mathématiques sur deux périodes consécutives.
Action recommandée : organiser une séance de remédiation ciblée et analyser les évaluations concernées.
```

---

# 23. Exports

Formats :

```txt
PDF
Excel
CSV
impression
```

Types d’exports :

```txt
rapport global
rapport classe
rapport matière
rapport enseignant
rapport série
rapport bilingue
rapport ORION
rapport publication
```

---

# 24. Backend — Routes API

```http
GET    /api/exams/analytics/overview
GET    /api/exams/analytics/students/:studentId
GET    /api/exams/analytics/classes/:classId
GET    /api/exams/analytics/levels/:levelId
GET    /api/exams/analytics/series/:seriesId
GET    /api/exams/analytics/subjects/:subjectId
GET    /api/exams/analytics/teachers/:teacherId
GET    /api/exams/analytics/bilingual
GET    /api/exams/analytics/rankings
GET    /api/exams/analytics/report-cards
GET    /api/exams/analytics/publications
GET    /api/exams/analytics/risks
GET    /api/exams/analytics/orion-recommendations

POST   /api/exams/analytics/snapshots/generate
GET    /api/exams/analytics/snapshots

POST   /api/exams/analytics/export
GET    /api/exams/analytics/audit
```

---

# 25. Backend — Services

```txt
ExamAnalyticsService
AnalyticsSnapshotService
StudentAnalyticsService
ClassAnalyticsService
LevelAnalyticsService
SeriesAnalyticsService
SubjectAnalyticsService
TeacherAnalyticsService
BilingualAnalyticsService
RankingAnalyticsService
ReportCardAnalyticsService
PublicationAnalyticsService
AcademicRiskService
OrionRecommendationService
AnalyticsExportService
AnalyticsAuditService
```

---

# 26. Sécurité

## Permissions

```ts
EXAMS_ANALYTICS_VIEW
EXAMS_ANALYTICS_STUDENT_VIEW
EXAMS_ANALYTICS_CLASS_VIEW
EXAMS_ANALYTICS_TEACHER_VIEW
EXAMS_ANALYTICS_RISK_VIEW
EXAMS_ANALYTICS_EXPORT
EXAMS_ANALYTICS_ORION_VIEW
```

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
données sensibles limitées selon rôle
export contrôlé
audit des consultations sensibles
aucune exposition parent non autorisée
anonymisation possible pour certains rapports
```

---

# 27. Audit

Auditer :

```txt
consultation rapport global
consultation rapport élève
consultation rapport enseignant
export
génération snapshot
consultation risques
résolution risque
rejet recommandation ORION
```

Chaque audit doit stocker :

```txt
utilisateur
rôle
périmètre
action
filtres utilisés
date
IP
user agent
```

---

# 28. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 8 — Rapports, Statistiques & Analytique académique ORION** du **Module 3 — Examens, Notes & Bulletins**.

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
```

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
analytics par élève, classe, niveau, série, matière, enseignant
compatible Maternelle, Primaire, Secondaire
compatible bilingue FR/EN
compatible séries
exports PDF/Excel
ORION intégré
audit complet
aucune suppression destructive
```

## À créer côté frontend

```txt
Page /exams/analytics
ExamAnalyticsPage
ExamAnalyticsOverviewCards
AnalyticsScopeSelector
StudentPerformancePanel
ClassPerformancePanel
LevelPerformancePanel
SeriesPerformancePanel
SubjectPerformancePanel
TeacherPerformancePanel
PeriodComparisonPanel
BilingualAnalyticsPanel
RankingAnalyticsPanel
ReportCardAnalyticsPanel
PublicationAnalyticsPanel
AcademicRiskPanel
OrionRecommendationPanel
AnalyticsExportPanel
AnalyticsAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Agrégations statistiques
Snapshots analytiques
Détection risques
Recommandations ORION
Exports PDF/Excel
Audit automatique
```

## À créer côté BDD

```txt
ExamAnalyticsSnapshot
AcademicRiskSignal
Enums AnalyticsScopeType, AcademicRiskType, RiskSeverity, RiskSignalStatus
Relations avec Student, Class, Level, Series, Subject, Teacher, Period, AcademicYear
```

---

# 29. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
visualiser les performances académiques
analyser les élèves
analyser les classes
analyser les niveaux
analyser les séries
analyser les matières
analyser les enseignants
suivre le bilingue
suivre les classements
suivre les bulletins
suivre les publications
détecter les risques
générer des recommandations ORION
exporter les rapports
auditer les consultations sensibles
```

---

# Conclusion

L’onglet **Rapports, Statistiques & Analytique académique ORION** est le **cerveau décisionnel** du module Examens.

La chaîne devient :

```txt
Onglet 2 = règles
Onglet 3 = évaluations
Onglet 4 = résultats
Onglet 5 = calculs
Onglet 6 = documents officiels
Onglet 7 = publication
Onglet 8 = intelligence décisionnelle
```

La règle d’or ici :

```txt
Les statistiques ne doivent pas seulement informer ; elles doivent orienter l’action.
```

Avec cet onglet, Academia Helm passe d’un logiciel de gestion scolaire à une **plateforme intelligente de pilotage académique**.

---

Parfait. L’onglet suivant logique est :

# MODULE 3 — EXAMENS, NOTES & BULLETINS

## ONGLET 9 — PARAMÉTRAGE AVANCÉ DES EXAMENS, NOTES, BULLETINS & CONFORMITÉ ACADÉMIQUE

Cet onglet est stratégique.
C’est lui qui empêche Academia Helm de devenir un logiciel rigide. Ici, chaque école peut configurer son fonctionnement académique sans demander au développeur de “changer deux petites choses vite fait” — phrase connue pour ouvrir des portails dimensionnels de bugs.

---

# 1. Objectif de l’onglet

L’onglet **Paramétrage avancé** centralise toutes les règles configurables du module **Examens, Notes & Bulletins**.

Il permet à chaque école de définir son fonctionnement académique sans modifier le code :

```txt
périodes d’évaluation
types d’évaluations
règles de calcul
règles de moyenne
règles de classement
règles d’appréciation
règles de bulletin
règles de publication
règles bilingues FR/EN
règles par niveau scolaire
règles par série
seuils ORION
contrôles automatiques
politiques de verrouillage
conformité académique interne
```

Cet onglet est le **panneau de contrôle du moteur académique**.

---

# 2. Positionnement dans le module

## Route frontend

```txt
/exams/settings
```

## Module parent

```txt
Examens, Notes & Bulletins
```

## Dépendances directes

```txt
Module Structure académique
Module Élèves & Scolarité
Module Matières & Programmes
Module Enseignants
Module Finance
Module Communication
Module Paramètres
ORION
```

---

# 3. Principe général

Aucune règle académique sensible ne doit être codée en dur.

Le système doit permettre à l’école de configurer :

```txt
comment elle évalue
comment elle calcule
comment elle classe
comment elle apprécie
comment elle publie
comment elle bloque
comment elle archive
comment ORION surveille
```

La plateforme doit fournir des valeurs par défaut robustes, mais l’école doit pouvoir adapter les règles selon son fonctionnement.

La logique est simple :

```txt
Academia Helm fournit le moteur.
L’école définit les règles.
Le système applique, trace et verrouille.
```

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit être organisé ainsi :

```txt
Paramétrage avancé
├── Vue d’ensemble
├── Paramètres par niveau scolaire
├── Paramètres Maternelle
├── Paramètres Primaire
├── Paramètres Secondaire
├── Paramètres séries
├── Types d’évaluations
├── Périodes et sessions
├── Règles de notes
├── Règles de moyennes
├── Règles de classement
├── Règles d’appréciations
├── Règles de bulletins
├── Règles de publication
├── Règles bilingues FR/EN
├── Règles de verrouillage
├── Seuils ORION
├── Import/export de configuration
└── Audit
```

---

# 5. Frontend

## 5.1 Route

```txt
/exams/settings
```

## 5.2 Page principale

```txt
app/(school)/exams/settings/page.tsx
```

## 5.3 Composants à créer

```txt
components/exams/settings/ExamSettingsPage.tsx
components/exams/settings/ExamSettingsOverviewCards.tsx
components/exams/settings/SchoolStageSettingsPanel.tsx
components/exams/settings/KindergartenSettingsPanel.tsx
components/exams/settings/PrimarySettingsPanel.tsx
components/exams/settings/SecondarySettingsPanel.tsx
components/exams/settings/SeriesSettingsPanel.tsx
components/exams/settings/AssessmentTypeSettingsPanel.tsx
components/exams/settings/PeriodSessionSettingsPanel.tsx
components/exams/settings/GradeRulesSettingsPanel.tsx
components/exams/settings/AverageRulesSettingsPanel.tsx
components/exams/settings/RankingRulesSettingsPanel.tsx
components/exams/settings/AppreciationRulesSettingsPanel.tsx
components/exams/settings/ReportCardRulesSettingsPanel.tsx
components/exams/settings/PublicationRulesSettingsPanel.tsx
components/exams/settings/BilingualRulesSettingsPanel.tsx
components/exams/settings/LockingRulesSettingsPanel.tsx
components/exams/settings/OrionThresholdSettingsPanel.tsx
components/exams/settings/SettingsImportExportPanel.tsx
components/exams/settings/ExamSettingsAuditTimeline.tsx
```

---

# 6. Paramètres par niveau scolaire

Le système doit gérer les trois niveaux scolaires déjà définis dans Academia Helm :

```txt
Maternelle : Maternelle 1, Maternelle 2
Primaire : CI, CP, CE1, CE2, CM1, CM2
Secondaire : 6ème, 5ème, 4ème, 3ème, 2nde, 1ère, Tle
```

Chaque niveau peut avoir ses propres règles :

```txt
types d’évaluation
périodes
règles de calcul
règles d’appréciation
modèles de bulletin
règles de publication
seuils ORION
```

---

# 7. Paramètres Maternelle

La Maternelle doit permettre :

```txt
évaluation qualitative
codes TS/S/PS/NS
nombre d’évaluations annuel configurable
domaines et compétences
synthèse narrative
absence de classement
absence de moyenne numérique obligatoire
bulletin qualitatif
appréciations pédagogiques
```

Codes par défaut :

```txt
TS : Très Satisfaisant
S  : Satisfaisant
PS : Peu Satisfaisant
NS : Non Satisfaisant
```

Point important : la Maternelle ne doit jamais être forcée dans une logique de notes classiques.
Elle doit rester dans une logique d’observation, d’évolution et d’accompagnement.

---

# 8. Paramètres Primaire

Le Primaire doit permettre :

```txt
notes quantitatives
coefficient 1 implicite
évaluations mensuelles
évaluations certificatives
appréciations
moyenne séquentielle
moyenne trimestrielle
moyenne annuelle
classement activable ou désactivable
règles de passage configurables
```

Règle centrale :

```txt
Primaire = quantitatif, mais sans coefficient différencié.
```

---

# 9. Paramètres Secondaire

Le Secondaire doit permettre :

```txt
notes quantitatives
coefficients par matière
interrogations
devoirs surveillés
compositions
moyenne séquentielle
moyenne trimestrielle
moyenne annuelle
classement
mentions
décisions
séries
matières de spécialité
```

Règle centrale :

```txt
Secondaire = quantitatif avec coefficients et séries.
```

---

# 10. Paramètres séries

Le système doit permettre :

```txt
création de séries
affectation de séries aux classes
matières propres aux séries
coefficients par série
règles de moyenne par série
classement par série
bulletins avec affichage série
statistiques par série
```

Exemples :

```txt
A
B
C
D
G
séries personnalisées selon école
```

---

# 11. Types d’évaluations

Le système doit permettre de configurer :

```txt
nom
code
niveau concerné
coefficient d’évaluation si applicable
périodicité
obligation
ordre d’affichage
impact sur moyenne
langue
statut actif/inactif
```

Exemples :

```txt
Interrogation
Devoir Surveillé
Composition
Évaluation mensuelle
Évaluation certificative
Évaluation qualitative
Projet
Oral
Pratique
```

---

# 12. Règles de notes

Paramètres possibles :

```txt
note maximale
note minimale
décimales autorisées
arrondi
seuil de validation
absence justifiée
absence non justifiée
note neutralisée
note bonus
note pénalité
saisie verrouillée après validation
```

---

# 13. Règles de moyennes

Paramètres possibles :

```txt
moyenne simple
moyenne pondérée
moyenne par groupe de matières
moyenne séquentielle
moyenne trimestrielle
moyenne annuelle
meilleure note retenue
note la plus faible ignorée
absence neutralisée
arrondi
seuil de réussite
seuil d’excellence
```

Point fondamental :

```txt
L’école définit la méthode de calcul.
Le système applique, trace et verrouille.
```

---

# 14. Règles de classement

Paramètres possibles :

```txt
classement activé/désactivé
classement par classe
classement par niveau
classement par série
gestion des ex aequo
affichage du rang
affichage du percentile
exclusion des élèves non classables
classement masqué aux parents
classement visible direction uniquement
```

---

# 15. Règles d’appréciations

Paramètres possibles :

```txt
appréciations automatiques
appréciations manuelles
appréciations hybrides
seuils par moyenne
modèles par niveau
modèles par langue
appréciations enseignant
appréciations direction
appréciations obligatoires ou optionnelles
```

Exemple :

```txt
16 à 20     : Excellent travail
14 à 15,99  : Très bon travail
12 à 13,99  : Bon travail
10 à 11,99  : Travail passable
moins de 10 : Efforts à renforcer
```

---

# 16. Règles de bulletins

Paramètres possibles :

```txt
modèle par niveau
modèle par classe
modèle par série
modèle bilingue
sections affichées
signatures
cachet
rang visible ou non
moyenne visible ou non
appréciation direction obligatoire
QR code de vérification
verrouillage après publication
archivage automatique
```

---

# 17. Règles de publication

Paramètres possibles :

```txt
publication manuelle
publication automatique après validation
publication par classe
publication par période
publication différée
notification automatique
accès parent
accès élève
téléchargement autorisé
impression autorisée
blocage financier
délai de grâce
```

---

# 18. Règles bilingues FR/EN

Paramètres possibles :

```txt
interface bulletin FR
interface bulletin EN
bulletin bilingue
matières en anglais
appréciations bilingues
libellés traduits
moyennes séparées FR/EN
analyse ORION bilingue
modèle de bulletin bilingue
```

---

# 19. Règles de verrouillage

Le système doit permettre de définir :

```txt
verrouillage après validation
verrouillage après publication
verrouillage après archivage
autorisation de régénération
obligation de justification
niveau de permission requis
conservation ancienne version
audit renforcé
```

---

# 20. Seuils ORION

Paramètres possibles :

```txt
seuil élève à risque
seuil classe en difficulté
seuil matière critique
seuil baisse brutale
seuil écart bilingue
seuil retard de saisie
seuil retard de publication
seuil faible consultation parent
seuil anomalies de notes
seuil corrections après validation
```

---

# 21. Import/export de configuration

Le système doit permettre :

```txt
export JSON de configuration
import JSON contrôlé
duplication depuis une année scolaire précédente
duplication vers une autre école si autorisé plateforme
prévisualisation avant import
rollback en cas d’erreur
audit complet
```

Très utile pour une école qui veut reconduire ses règles d’une année à l’autre sans tout refaire.

---

# 22. Base de données — ExamSettingsProfile

```prisma
model ExamSettingsProfile {
  id              String @id @default(cuid())
  tenantId        String
  academicYearId  String

  name            String
  code            String
  description     String?

  isDefault        Boolean @default(false)
  isActive         Boolean @default(true)

  schoolStage     SchoolStage?
  levelId         String?
  classId         String?
  seriesId        String?

  config          Json

  createdById     String?
  updatedById     String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([tenantId, academicYearId, code])
  @@index([tenantId, academicYearId])
  @@index([schoolStage, levelId, classId, seriesId])
}
```

---

# 23. Base de données — ExamRuleSet

```prisma
model ExamRuleSet {
  id              String @id @default(cuid())
  tenantId        String
  academicYearId  String

  name            String
  code            String
  ruleType        ExamRuleType

  schoolStage     SchoolStage?
  levelId         String?
  classId         String?
  seriesId        String?
  subjectId       String?

  isActive        Boolean @default(true)
  priority        Int @default(0)

  rules           Json

  createdById     String?
  updatedById     String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([tenantId, academicYearId, code])
  @@index([tenantId, academicYearId, ruleType])
  @@index([schoolStage, levelId, classId, seriesId, subjectId])
}
```

---

# 24. Enum — ExamRuleType

```prisma
enum ExamRuleType {
  ASSESSMENT_TYPE
  GRADE
  AVERAGE
  RANKING
  APPRECIATION
  REPORT_CARD
  PUBLICATION
  BILINGUAL
  LOCKING
  ORION_THRESHOLD
}
```

---

# 25. Backend — Routes API

```http
GET    /api/exams/settings
GET    /api/exams/settings/profile/:id
POST   /api/exams/settings/profile
PATCH  /api/exams/settings/profile/:id
POST   /api/exams/settings/profile/:id/activate
POST   /api/exams/settings/profile/:id/deactivate

GET    /api/exams/settings/rules
GET    /api/exams/settings/rules/:id
POST   /api/exams/settings/rules
PATCH  /api/exams/settings/rules/:id
POST   /api/exams/settings/rules/:id/activate
POST   /api/exams/settings/rules/:id/deactivate

POST   /api/exams/settings/import
POST   /api/exams/settings/export
POST   /api/exams/settings/duplicate-from-year
POST   /api/exams/settings/validate
GET    /api/exams/settings/audit
```

---

# 26. Backend — Services

```txt
ExamSettingsService
ExamSettingsProfileService
ExamRuleSetService
SchoolStageSettingsService
KindergartenExamSettingsService
PrimaryExamSettingsService
SecondaryExamSettingsService
SeriesExamSettingsService
AssessmentTypeSettingsService
GradeRulesService
AverageRulesService
RankingRulesService
AppreciationRulesService
ReportCardRulesService
PublicationRulesService
BilingualRulesService
LockingRulesService
OrionThresholdRulesService
ExamSettingsImportExportService
ExamSettingsAuditService
```

---

# 27. Sécurité

## Permissions

```ts
EXAMS_SETTINGS_VIEW
EXAMS_SETTINGS_MANAGE
EXAMS_SETTINGS_RULES_MANAGE
EXAMS_SETTINGS_IMPORT
EXAMS_SETTINGS_EXPORT
EXAMS_SETTINGS_DUPLICATE
EXAMS_SETTINGS_AUDIT_VIEW
```

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
aucune règle critique modifiée sans audit
validation avant activation
versionnement recommandé
rollback possible
import sécurisé
aucune suppression destructive
```

---

# 28. Audit

Auditer :

```txt
création profil
modification profil
activation/désactivation profil
création règle
modification règle
activation/désactivation règle
import
export
duplication depuis année précédente
validation configuration
rollback
```

Chaque audit doit stocker :

```txt
utilisateur
rôle
action
règle concernée
ancienne valeur
nouvelle valeur
justification
date
IP
user agent
```

---

# 29. ORION

ORION doit surveiller :

```txt
règle incohérente
coefficient manquant
niveau sans modèle bulletin
série sans coefficients
seuils contradictoires
classement activé sans règle de moyenne
publication automatique sans validation obligatoire
bilingue activé sans traduction
verrouillage désactivé sur documents officiels
configuration non testée
```

Exemple :

```txt
ORION — Configuration incomplète

La série D possède 3 matières sans coefficient.
Les calculs du Secondaire peuvent devenir incohérents.
```

---

# 30. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 9 — Paramétrage avancé des examens, notes, bulletins & conformité académique** du **Module 3 — Examens, Notes & Bulletins**.

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
```

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
règles non codées en dur
compatible Maternelle 1 et Maternelle 2
compatible Primaire
compatible Secondaire
compatible séries
compatible bilingue FR/EN
import/export de configuration
validation avant activation
audit complet
ORION intégré
aucune suppression destructive
```

## À créer côté frontend

```txt
Page /exams/settings
ExamSettingsPage
ExamSettingsOverviewCards
SchoolStageSettingsPanel
KindergartenSettingsPanel
PrimarySettingsPanel
SecondarySettingsPanel
SeriesSettingsPanel
AssessmentTypeSettingsPanel
PeriodSessionSettingsPanel
GradeRulesSettingsPanel
AverageRulesSettingsPanel
RankingRulesSettingsPanel
AppreciationRulesSettingsPanel
ReportCardRulesSettingsPanel
PublicationRulesSettingsPanel
BilingualRulesSettingsPanel
LockingRulesSettingsPanel
OrionThresholdSettingsPanel
SettingsImportExportPanel
ExamSettingsAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Validation de configuration
Import/export JSON
Duplication depuis année scolaire précédente
Rollback
Audit automatique
ORION configuration checker
```

## À créer côté BDD

```txt
ExamSettingsProfile
ExamRuleSet
Enum ExamRuleType
Relations avec AcademicYear, Level, Class, Series, Subject, User
```

---

# 31. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
configurer les règles de notes
configurer les règles de moyennes
configurer les règles de classement
configurer les règles d’appréciation
configurer les modèles de bulletins
configurer les publications
configurer le bilingue FR/EN
configurer les séries
configurer les seuils ORION
importer/exporter les configurations
dupliquer les règles d’une année à l’autre
auditer toutes les modifications
```

---

# Conclusion

L’onglet **Paramétrage avancé** est le **cerveau réglementaire** du module Examens.

La chaîne devient :

```txt
Onglet 2 = règles académiques de base
Onglet 3 = évaluations
Onglet 4 = résultats
Onglet 5 = calculs
Onglet 6 = documents officiels
Onglet 7 = publication
Onglet 8 = analytique
Onglet 9 = paramétrage avancé
```

La règle d’or ici :

```txt
Ce qui peut varier d’une école à une autre doit être configurable, pas codé en dur.
```

Avec cet onglet, Academia Helm devient adaptable, durable et commercialement solide. C’est exactement ce qu’il faut pour vendre à plusieurs écoles sans transformer chaque client en chantier technique.

---

Excellent. On clôture le **Module 3 — Examens, Notes & Bulletins** avec son onglet de gouvernance.

# MODULE 3 — EXAMENS, NOTES & BULLETINS

## ONGLET 10 — AUDIT, HISTORIQUE, VERROUILLAGE & CONFORMITÉ ACADÉMIQUE

Cet onglet est la **boîte noire institutionnelle** du module Examens.
Il ne sert pas seulement à voir ce qui s’est passé. Il sert à **prouver**, **contrôler**, **verrouiller** et **sécuriser** tout ce qui touche aux notes, moyennes, classements, bulletins et publications.

Dans une école, une note modifiée sans trace, c’est une grenade administrative. Cet onglet retire la goupille du problème avant qu’il n’explose.

---

# 1. Objectif de l’onglet

L’onglet **Audit, Historique, Verrouillage & Conformité académique** constitue la couche de gouvernance finale du module **Examens, Notes & Bulletins**.

Il permet de tracer, contrôler, verrouiller et prouver toutes les opérations sensibles liées aux :

```txt id="fue5gr"
évaluations
notes
moyennes
classements
bulletins
publications
exports
paramétrages
verrouillages
déverrouillages
```

Cet onglet répond aux questions critiques :

```txt id="48ahc0"
qui a modifié quoi ?
quand ?
pourquoi ?
quelle était l’ancienne valeur ?
quelle est la nouvelle valeur ?
qui a validé ?
qui a publié ?
qui a régénéré ?
qui a annulé ?
le document est-il verrouillé ?
le processus est-il conforme ?
```

---

# 2. Positionnement dans le module

## Route frontend

```txt id="yz0l58"
/exams/audit-compliance
```

## Module parent

```txt id="vnnvxs"
Examens, Notes & Bulletins
```

## Dépendances directes

```txt id="s35z99"
Onglet 2 — Paramétrage académique
Onglet 3 — Évaluations & Sessions
Onglet 4 — Saisie des résultats
Onglet 5 — Calculs, Moyennes & Classements
Onglet 6 — Bulletins & Documents
Onglet 7 — Publication
Onglet 8 — Analytique ORION
Onglet 9 — Paramétrage avancé
Module Utilisateurs & Permissions
Module Paramètres
ORION
```

---

# 3. Principe général

Toute action sensible dans le module Examens doit produire une trace exploitable.

Aucune modification importante ne doit être invisible.

Les notes, moyennes, classements, bulletins et publications doivent pouvoir être :

```txt id="enby2s"
consultés
comparés
verrouillés
déverrouillés sous permission
justifiés
audités
exportés comme preuve administrative
```

Principe non négociable :

```txt id="a1dgv8"
Une donnée académique officielle ne se modifie jamais en silence.
```

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit être organisé ainsi :

```txt id="pkrn51"
Audit & Conformité
├── Vue d’ensemble conformité
├── Journal des actions sensibles
├── Historique des notes
├── Historique des moyennes
├── Historique des classements
├── Historique des bulletins
├── Historique des publications
├── Historique des exports
├── Verrouillage académique
├── Déverrouillage contrôlé
├── Comparaison avant/après
├── Preuves administratives
├── Alertes ORION
├── Rapports d’audit
├── Paramètres de conformité
└── Audit de l’audit
```

---

# 5. Frontend

## 5.1 Route

```txt id="5p5oy7"
/exams/audit-compliance
```

## 5.2 Page principale

```txt id="hjjlgc"
app/(school)/exams/audit-compliance/page.tsx
```

## 5.3 Composants à créer

```txt id="t7lxky"
components/exams/audit/ExamAuditCompliancePage.tsx
components/exams/audit/ComplianceOverviewCards.tsx
components/exams/audit/SensitiveActionLogTable.tsx
components/exams/audit/GradeHistoryPanel.tsx
components/exams/audit/AverageHistoryPanel.tsx
components/exams/audit/RankingHistoryPanel.tsx
components/exams/audit/ReportCardHistoryPanel.tsx
components/exams/audit/PublicationHistoryPanel.tsx
components/exams/audit/ExportHistoryPanel.tsx
components/exams/audit/AcademicLockingPanel.tsx
components/exams/audit/ControlledUnlockPanel.tsx
components/exams/audit/BeforeAfterComparisonDrawer.tsx
components/exams/audit/AdministrativeEvidencePanel.tsx
components/exams/audit/AuditOrionAlertsPanel.tsx
components/exams/audit/AuditReportExportPanel.tsx
components/exams/audit/ComplianceSettingsPanel.tsx
components/exams/audit/AuditTrailTimeline.tsx
```

---

# 6. Filtres principaux

L’interface doit permettre de filtrer par :

```txt id="10q8b3"
année scolaire
période
niveau scolaire
classe
série
élève
enseignant
matière
type d’action
utilisateur
rôle
date
statut de verrouillage
gravité ORION
document concerné
IP
canal
```

---

# 7. Types d’actions sensibles à tracer

Le système doit tracer :

```txt id="0xmt74"
création d’évaluation
modification d’évaluation
suppression logique d’évaluation
saisie de note
modification de note
annulation de note
validation de note
correction après validation
recalcul de moyenne
modification de règle de calcul
génération de bulletin
régénération de bulletin
validation de bulletin
annulation de bulletin
publication
annulation de publication
déblocage financier
export PDF
export Excel
téléchargement parent
consultation parent
déverrouillage académique
changement de paramétrage
```

---

# 8. Base de données — ExamAuditLog

```prisma id="svw0la"
model ExamAuditLog {
  id              String @id @default(cuid())
  tenantId        String
  academicYearId  String?

  entityType      ExamAuditEntityType
  entityId        String?
  actionType      ExamAuditActionType

  studentId       String?
  classId         String?
  levelId         String?
  seriesId        String?
  subjectId       String?
  teacherId       String?
  periodId        String?

  actorUserId     String?
  actorRole       String?

  oldValue        Json?
  newValue        Json?
  diff            Json?

  reason          String?
  severity        AuditSeverity @default(INFO)

  ipAddress       String?
  userAgent       String?
  deviceInfo      Json?

  metadata        Json?

  createdAt       DateTime @default(now())

  @@index([tenantId, academicYearId])
  @@index([entityType, entityId])
  @@index([actionType])
  @@index([studentId])
  @@index([classId])
  @@index([actorUserId])
  @@index([createdAt])
}
```

---

# 9. Enums audit

```prisma id="7rw72h"
enum ExamAuditEntityType {
  ASSESSMENT
  GRADE
  AVERAGE
  RANKING
  REPORT_CARD
  PUBLICATION
  EXPORT
  SETTINGS
  LOCK
  UNLOCK
  ORION_ALERT
}

enum ExamAuditActionType {
  CREATE
  UPDATE
  DELETE_SOFT
  SUBMIT
  VALIDATE
  REJECT
  CANCEL
  GENERATE
  REGENERATE
  PUBLISH
  UNPUBLISH
  LOCK
  UNLOCK
  EXPORT
  VIEW
  DOWNLOAD
  RECALCULATE
  OVERRIDE
  CONFIG_CHANGE
}

enum AuditSeverity {
  INFO
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

---

# 10. Base de données — AcademicLock

```prisma id="2adfkx"
model AcademicLock {
  id              String @id @default(cuid())
  tenantId        String
  academicYearId  String

  lockScope       AcademicLockScope

  periodId        String?
  classId         String?
  levelId         String?
  seriesId        String?
  studentId       String?
  subjectId       String?

  reason          String?
  isActive        Boolean @default(true)

  lockedById      String?
  unlockedById    String?

  lockedAt        DateTime @default(now())
  unlockedAt      DateTime?

  unlockReason    String?
  metadata        Json?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId, academicYearId])
  @@index([lockScope])
  @@index([periodId, classId, levelId, seriesId])
  @@index([studentId, subjectId])
  @@index([isActive])
}
```

---

# 11. Enum — AcademicLockScope

```prisma id="4u7crz"
enum AcademicLockScope {
  PERIOD
  CLASS
  LEVEL
  SERIES
  STUDENT
  SUBJECT
  REPORT_CARD
  PUBLICATION
  GLOBAL_EXAMS
}
```

---

# 12. Base de données — ExamEvidenceFile

```prisma id="j97wye"
model ExamEvidenceFile {
  id              String @id @default(cuid())
  tenantId        String
  academicYearId  String?

  auditLogId      String?
  entityType      ExamAuditEntityType
  entityId        String?

  fileName        String
  fileType        String
  fileUrl         String
  fileHash        String?

  generatedById   String?
  generatedAt     DateTime @default(now())

  metadata        Json?

  createdAt       DateTime @default(now())

  @@index([tenantId, academicYearId])
  @@index([auditLogId])
  @@index([entityType, entityId])
}
```

---

# 13. Journal des actions sensibles

Le journal doit afficher :

```txt id="f19sm7"
date
utilisateur
rôle
action
entité concernée
élève concerné
classe
matière
ancienne valeur
nouvelle valeur
justification
niveau de gravité
IP
appareil
lien vers preuve
```

Le journal doit être :

```txt id="17tbz3"
filtrable
exportable
non modifiable
horodaté
rattaché au tenant
sécurisé par rôle
```

---

# 14. Historique des notes

Pour chaque note, le système doit conserver :

```txt id="o9sfkq"
valeur initiale
modifications successives
auteur de chaque modification
date
justification
validation
correction après validation
impact sur moyenne
impact sur rang
statut verrouillé ou non
```

Exemple d’usage :

```txt id="6cl2m4"
La note de Mathématiques de l’élève X est passée de 12/20 à 14/20 après validation.
Motif : erreur de saisie corrigée.
Auteur : Responsable pédagogique.
Date : 14/05/2026.
```

---

# 15. Historique des moyennes

Le système doit conserver :

```txt id="f88qz7"
moyenne initiale
recalculs
règles appliquées
version des règles
notes utilisées
exclusions
arrondis
auteur du recalcul
date
justification
impact sur bulletin
```

---

# 16. Historique des classements

Le système doit conserver :

```txt id="12brb0"
rang initial
rang recalculé
ex aequo
règle de classement appliquée
élèves exclus
impact des corrections
date de génération
utilisateur
version du calcul
```

---

# 17. Historique des bulletins

Le système doit conserver :

```txt id="at0auo"
première génération
régénérations
versions PDF
hash de chaque PDF
modèle utilisé
données snapshot
validateur
date de validation
date de publication
annulations
motif d’annulation
```

Principe :

```txt id="b9u5p4"
Aucun bulletin publié ne doit être remplacé silencieusement.
```

Si un bulletin est corrigé après publication, le système conserve l’ancienne version et crée une nouvelle version.

---

# 18. Historique des publications

Le système doit conserver :

```txt id="wx2cql"
publication initiale
canal
parent/élève concerné
notification envoyée
consultation
téléchargement
blocage financier
déblocage
annulation
relance
échec de notification
```

---

# 19. Historique des exports

Le système doit tracer :

```txt id="5dr93g"
export PDF
export Excel
export CSV
export rapport ORION
export bulletin
export rapport classe
export rapport enseignant
export rapport direction
```

Chaque export doit indiquer :

```txt id="hcx00i"
utilisateur
périmètre
filtres
date
nombre de lignes/documents
hash fichier si généré
motif si export sensible
```

---

# 20. Verrouillage académique

Le verrouillage permet d’empêcher toute modification après une étape critique.

Verrouillages possibles :

```txt id="py5e1k"
période
classe
niveau
série
élève
matière
bulletin
publication
module examens global
```

Effets :

```txt id="a2baf4"
notes non modifiables
moyennes non recalculables sans permission
bulletins non régénérables
publications non annulables sans permission
paramétrage sensible gelé
```

---

# 21. Déverrouillage contrôlé

Le déverrouillage doit exiger :

```txt id="evmvsa"
permission élevée
justification obligatoire
périmètre précis
durée limitée si temporaire
audit renforcé
notification direction si activée
```

Le système doit éviter le déverrouillage global abusif.

Bonne règle :

```txt id="h6hy60"
On ne déverrouille pas tout le module pour corriger une seule note.
```

---

# 22. Comparaison avant/après

Le système doit proposer une vue de comparaison :

```txt id="k5ywml"
ancienne note vs nouvelle note
ancienne moyenne vs nouvelle moyenne
ancien rang vs nouveau rang
ancien bulletin vs nouveau bulletin
ancienne règle vs nouvelle règle
ancienne publication vs nouvelle publication
```

Objectif : rendre les modifications compréhensibles rapidement.

---

# 23. Preuves administratives

Le système doit générer des preuves :

```txt id="8pkrrp"
rapport d’audit PDF
certificat de verrouillage
certificat de publication
historique d’un bulletin
historique d’une note
rapport de correction
rapport de conformité période
rapport de validation
```

Ces documents doivent pouvoir être exportés avec :

```txt id="w0sjp2"
date
signature numérique interne
hash
QR code de vérification si activé
```

---

# 24. ORION Audit

ORION doit détecter :

```txt id="q7f4cc"
modification de note après validation
recalcul fréquent d’une même classe
régénération excessive de bulletins
annulation de publication après consultation
export massif
utilisateur avec activité inhabituelle
déverrouillage répété
changement de règle avant calcul
incohérence ancienne/nouvelle valeur
absence de justification
accès parent anormal
```

Exemple :

```txt id="3x6dzx"
ORION Audit — Activité sensible détectée

12 notes de Mathématiques ont été modifiées après validation en 3ème A.
Vérification recommandée.
```

---

# 25. Backend — Routes API

```http id="9qvtrw"
GET    /api/exams/audit
GET    /api/exams/audit/:id
GET    /api/exams/audit/entity/:entityType/:entityId

GET    /api/exams/audit/grades/:gradeId/history
GET    /api/exams/audit/averages/:averageId/history
GET    /api/exams/audit/rankings/:rankingId/history
GET    /api/exams/audit/report-cards/:reportCardId/history
GET    /api/exams/audit/publications/:publicationId/history
GET    /api/exams/audit/exports

GET    /api/exams/locks
POST   /api/exams/locks
POST   /api/exams/locks/:id/unlock
GET    /api/exams/locks/:id

POST   /api/exams/audit/evidence/generate
GET    /api/exams/audit/evidence/:id

GET    /api/exams/audit/orion-alerts
POST   /api/exams/audit/export
GET    /api/exams/audit/compliance-report
```

---

# 26. Backend — Services

```txt id="dy1erq"
ExamAuditService
ExamAuditLogService
GradeHistoryService
AverageHistoryService
RankingHistoryService
ReportCardHistoryService
PublicationHistoryService
ExportHistoryService
AcademicLockService
ControlledUnlockService
BeforeAfterDiffService
ExamEvidenceService
ExamComplianceReportService
OrionAuditService
```

---

# 27. Sécurité

## Permissions

```ts id="idaxfx"
EXAMS_AUDIT_VIEW
EXAMS_AUDIT_EXPORT
EXAMS_AUDIT_EVIDENCE_GENERATE
EXAMS_LOCK_VIEW
EXAMS_LOCK_MANAGE
EXAMS_UNLOCK_REQUEST
EXAMS_UNLOCK_APPROVE
EXAMS_COMPLIANCE_VIEW
EXAMS_ORION_AUDIT_VIEW
```

## Contrôles

```txt id="x9c7dc"
tenantId depuis session uniquement
RBAC strict
audit non modifiable
verrouillage non supprimable
déverrouillage justifié
exports sensibles contrôlés
preuves hashées
accès limité aux rôles autorisés
aucune suppression destructive
```

---

# 28. Audit de l’audit

Même la consultation de l’audit doit être tracée pour les données sensibles.

Tracer :

```txt id="2ktwpf"
consultation historique note
consultation historique bulletin
export audit
génération preuve
consultation rapport conformité
consultation activité utilisateur
```

Pourquoi ?
Parce qu’un historique sensible consulté par une personne non concernée peut aussi être un risque.

---

# 29. Paramètres de conformité

Paramètres configurables :

```txt id="cj4f7t"
durée de conservation des audits
obligation justification modification note
obligation justification déverrouillage
verrouillage automatique après validation
verrouillage automatique après publication
niveau de permission pour déverrouillage
seuil export massif
seuil ORION audit
génération automatique preuves
QR code de vérification
```

---

# 30. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 10 — Audit, Historique, Verrouillage & Conformité académique** du **Module 3 — Examens, Notes & Bulletins**.

## Stack

```txt id="ihm0og"
Next.js
React
TypeScript
Prisma
PostgreSQL
```

## Contraintes

```txt id="a9e8h9"
multi-tenant strict
RBAC obligatoire
audit append-only
aucune suppression destructive
historique complet notes/moyennes/classements/bulletins/publications
verrouillage académique
déverrouillage contrôlé
preuves administratives
ORION Audit
exports contrôlés
compatibilité Maternelle, Primaire, Secondaire, séries, bilingue
```

## À créer côté frontend

```txt id="52xsdq"
Page /exams/audit-compliance
ExamAuditCompliancePage
ComplianceOverviewCards
SensitiveActionLogTable
GradeHistoryPanel
AverageHistoryPanel
RankingHistoryPanel
ReportCardHistoryPanel
PublicationHistoryPanel
ExportHistoryPanel
AcademicLockingPanel
ControlledUnlockPanel
BeforeAfterComparisonDrawer
AdministrativeEvidencePanel
AuditOrionAlertsPanel
AuditReportExportPanel
ComplianceSettingsPanel
AuditTrailTimeline
```

## À créer côté backend

```txt id="a2y1sq"
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Audit append-only
Historique des notes
Historique des moyennes
Historique des classements
Historique des bulletins
Historique des publications
Historique des exports
Verrouillage académique
Déverrouillage contrôlé
Génération de preuves
ORION Audit
Exports de conformité
```

## À créer côté BDD

```txt id="yvxw2k"
ExamAuditLog
AcademicLock
ExamEvidenceFile
Enums ExamAuditEntityType, ExamAuditActionType, AuditSeverity, AcademicLockScope
Relations avec Student, Class, Level, Series, Subject, Teacher, Period, AcademicYear, User
```

---

# 31. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt id="a11x2m"
tracer toutes les actions sensibles
consulter l’historique des notes
consulter l’historique des moyennes
consulter l’historique des classements
consulter l’historique des bulletins
consulter l’historique des publications
consulter l’historique des exports
verrouiller les périodes/classes/documents
déverrouiller sous contrôle
comparer avant/après
générer des preuves administratives
détecter les anomalies avec ORION
exporter les rapports d’audit
auditer même les consultations sensibles
```

---

# Conclusion

L’onglet **Audit, Historique, Verrouillage & Conformité académique** donne au module Examens sa dimension institutionnelle.

La chaîne finale devient :

```txt id="khcz11"
Onglet 1  = Vue d’ensemble
Onglet 2  = Paramétrage académique
Onglet 3  = Évaluations & Sessions
Onglet 4  = Saisie des résultats
Onglet 5  = Calculs, Moyennes & Classements
Onglet 6  = Bulletins & Documents officiels
Onglet 7  = Publication & Communication
Onglet 8  = Rapports & Analytique ORION
Onglet 9  = Paramétrage avancé
Onglet 10 = Audit & Conformité
```

La règle d’or :

```txt id="w5i2gg"
Ce qui est officiel doit être traçable.
Ce qui est traçable doit être vérifiable.
Ce qui est vérifiable inspire confiance.
```

Avec cet onglet, Academia Helm ne gère pas seulement les examens. Il sécurise la crédibilité académique de l’établissement.

---

