Parfait. On attaque le **Module Élèves & Scolarité** proprement.

Ce module est **fondamental** : c’est la base vivante de toute la plateforme. Si le dossier élève est mal structuré, tout le reste devient fragile : finance, examens, bulletins, parents, communication, statistiques, EDUCMASTER… tout dépend de lui.

# MODULE 1 — ÉLÈVES & SCOLARITÉ

## Architecture globale, périmètre fonctionnel et structure des onglets

---

# 1. Objectif général du module

Le module **Élèves & Scolarité** est le socle administratif et académique de chaque établissement dans Academia Helm.

Il permet de gérer tout le cycle de vie d’un élève :

```txt
préinscription
admission
inscription
réinscription
affectation en classe
dossier administratif
dossier académique
responsables légaux
pièces justificatives
scolarité
statut de l’élève
historique de parcours
transfert
sortie
archivage
export EDUCMASTER
synchronisation avec les autres modules
```

Ce module est la **source de vérité principale** pour toutes les données élèves.

---

# 2. Rôle stratégique dans Academia Helm

Le module Élèves alimente directement :

```txt
Structure académique
Examens, Notes & Bulletins
Finance & Scolarité
Parents/Élèves
Communication
Présence & Discipline
Transport
Cantine
Bibliothèque
Statistiques ORION
Exports officiels
EDUCMASTER
```

Une mauvaise donnée élève contamine toute la plateforme.

Exemple simple :

```txt
Élève mal affecté à une classe
= mauvaise facture
= mauvais bulletin
= mauvais portail parent
= mauvaise statistique
= mauvais export EDUCMASTER
```

Donc ici, on ne bricole pas. On construit une base solide.

---

# 3. Principes fondamentaux

Le module doit respecter les principes suivants :

```txt
1. Multi-tenant strict.
2. Données élèves isolées par école.
3. Identifiant élève unique.
4. Historique complet du parcours.
5. Aucune suppression destructive.
6. Dossier élève complet et vérifiable.
7. Gestion claire des responsables légaux.
8. Statuts académiques maîtrisés.
9. Compatibilité Maternelle, Primaire, Secondaire.
10. Compatibilité séries au Secondaire.
11. Export EDUCMASTER intégré.
12. Audit obligatoire sur les actions sensibles.
13. ORION intégré pour la détection d’anomalies.
```

La règle d’or :

```txt
Un élève n’est pas seulement une ligne dans une table.
C’est un dossier vivant avec une histoire, des liens, des droits, des obligations et des impacts.
```

---

# 4. Niveaux scolaires pris en charge

Academia Helm doit gérer les trois grands niveaux scolaires.

## 4.1 Maternelle

```txt
Maternelle 1
Maternelle 2
```

## 4.2 Primaire

```txt
CI
CP
CE1
CE2
CM1
CM2
```

## 4.3 Secondaire

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

## 4.4 Séries au Secondaire

Le Secondaire doit gérer les séries :

```txt
A
B
C
D
G
séries personnalisées selon l’école
```

---

# 5. Structure recommandée des onglets du module

Pour un module professionnel, je recommande  **12 onglets** .

```txt
MODULE 1 — Élèves & Scolarité

Onglet 1  — Tableau de bord Élèves
Onglet 2  — Préinscriptions & Admissions
Onglet 3  — Inscriptions & Réinscriptions
Onglet 4  — Dossiers élèves
Onglet 5  — Responsables légaux & Familles
Onglet 6  — Affectations classes, séries & groupes
Onglet 7  — Mouvements scolaires
Onglet 8  — Documents, pièces & conformité dossier
Onglet 9  — EDUCMASTER Export
Onglet 10 — Rapports, Statistiques & ORION Élèves
Onglet 11 — Paramétrage Élèves & Scolarité
Onglet 12 — Audit, Historique & Conformité
```

---

# 6. Détail rapide des onglets

## Onglet 1 — Tableau de bord Élèves

Vue consolidée des effectifs, admissions, inscriptions, réinscriptions, mouvements, alertes et indicateurs ORION.

Il doit répondre rapidement à :

```txt
combien d’élèves actifs ?
combien de nouveaux inscrits ?
combien de réinscriptions en attente ?
combien d’élèves sans classe ?
combien de dossiers incomplets ?
quelles classes sont surchargées ?
quels risques ORION sont détectés ?
```

---

## Onglet 2 — Préinscriptions & Admissions

Gestion des demandes d’admission, dossiers candidats, validation, rejet, conversion en élève inscrit.

Fonctions clés :

```txt
création demande admission
dossier candidat
documents requis
entretien/test si applicable
statut admission
validation direction
conversion en inscription
notification parent
```

---

## Onglet 3 — Inscriptions & Réinscriptions

Gestion de l’inscription annuelle, réinscription, statut scolaire, année académique, classe cible, série, régime, frais liés.

Fonctions clés :

```txt
inscription nouvel élève
réinscription ancien élève
choix année scolaire
classe cible
série si secondaire
statut financier initial
liaison frais scolaires
validation administrative
```

---

## Onglet 4 — Dossiers élèves

Fiche complète de l’élève.

Contenu :

```txt
identité
photo
matricule
date et lieu de naissance
sexe
nationalité
adresse
niveau
classe
série
statut
historique scolaire
documents
responsables liés
observations administratives
```

---

## Onglet 5 — Responsables légaux & Familles

Gestion des parents, tuteurs, liens familiaux, droits d’accès portail, autorisations, contacts d’urgence et fratries.

Fonctions clés :

```txt
parent principal
parent secondaire
tuteur
contact urgence
droits portail parent
autorisation récupération enfant
fratrie
lien financier
```

---

## Onglet 6 — Affectations classes, séries & groupes

Gestion des affectations académiques.

Fonctions clés :

```txt
affectation classe
affectation série
affectation groupe
affectation parcours bilingue
changement de classe
changement de série
contrôle capacité classe
historique affectations
```

---

## Onglet 7 — Mouvements scolaires

Gestion des mouvements dans le parcours de l’élève.

Fonctions clés :

```txt
transfert
départ
abandon
sortie
exclusion administrative
changement établissement
réintégration
changement de classe
changement de série
historique mouvement
```

---

## Onglet 8 — Documents, pièces & conformité dossier

Gestion documentaire du dossier élève.

Fonctions clés :

```txt
acte de naissance
certificat de scolarité
photo
ancienne attestation
bulletin précédent
fiche médicale administrative
autorisation parentale
documents personnalisés
contrôle complétude dossier
expiration document
```

---

## Onglet 9 — EDUCMASTER Export

Génération des fichiers Excel de classes et élèves au format compatible  **EDUCMASTER** .

Fonctions clés :

```txt
sélection année scolaire
sélection niveau
sélection classe
sélection série
prévisualisation données
contrôle anomalies
génération Excel
historique exports
audit export
```

Cet onglet est important parce qu’il évite à l’école de refaire manuellement des fichiers pour EDUCMASTER. Et franchement, ressaisir des classes à la main en 2026, c’est une punition administrative.

---

## Onglet 10 — Rapports, Statistiques & ORION Élèves

Analytique des effectifs, admissions, inscriptions, mouvements, risques administratifs, anomalies et projections.

Fonctions clés :

```txt
effectifs par classe
effectifs par niveau
effectifs par série
nouveaux élèves
anciens élèves
taux réinscription
dossiers incomplets
classes surchargées
élèves sans responsable
élèves sans classe
risques ORION
```

---

## Onglet 11 — Paramétrage Élèves & Scolarité

Configuration des règles du module.

Fonctions clés :

```txt
statuts élèves
règles d’inscription
règles de réinscription
documents requis
modèles de matricule
règles de passage
règles d’affectation
règles EDUCMASTER
seuils ORION
```

---

## Onglet 12 — Audit, Historique & Conformité

Journal des actions sensibles, historique des modifications, verrouillage des dossiers et preuves administratives.

Fonctions clés :

```txt
historique modification élève
historique inscription
historique réinscription
historique affectation
historique documents
historique export EDUCMASTER
verrouillage dossier
audit consultation
preuve administrative
```

---

# 7. Architecture frontend globale

## Route racine

```txt
/students
```

## Routes recommandées

```txt
/students/dashboard
/students/admissions
/students/enrollments
/students/records
/students/families
/students/assignments
/students/movements
/students/documents
/students/educmaster
/students/analytics
/students/settings
/students/audit
```

## Composants globaux

```txt
StudentsModuleLayout
StudentsSidebar
StudentsHeader
StudentsScopeSelector
StudentSearchCommand
StudentQuickActions
StudentStatusBadge
StudentIdentityCard
StudentAcademicPathTimeline
StudentOrionAlerts
```

---

# 8. Architecture backend globale

## Services principaux

```txt
StudentService
StudentIdentityService
AdmissionService
EnrollmentService
ReEnrollmentService
StudentRecordService
FamilyService
GuardianService
StudentAssignmentService
StudentMovementService
StudentDocumentService
EducmasterExportService
StudentAnalyticsService
StudentSettingsService
StudentAuditService
StudentOrionService
```

## Routes API principales

```txt
/api/students
/api/students/admissions
/api/students/enrollments
/api/students/records
/api/students/families
/api/students/assignments
/api/students/movements
/api/students/documents
/api/students/educmaster
/api/students/analytics
/api/students/settings
/api/students/audit
```

---

# 9. Entités de base à prévoir

Les modèles principaux seront :

```txt
Student
StudentProfile
StudentEnrollment
StudentAdmission
StudentGuardian
Guardian
StudentFamily
StudentClassAssignment
StudentSeriesAssignment
StudentMovement
StudentDocument
StudentStatusHistory
StudentEducmasterExport
StudentAuditLog
StudentSettingsProfile
```

---

# 10. Statuts élèves recommandés

## Statuts administratifs

```txt
candidat
admis
inscrit
réinscrit
en attente
suspendu
transféré
sorti
archivé
```

## Statuts scolaires

```txt
actif
affecté
non affecté
redoublant
nouveau
ancien
boursier
dispensé partiellement
en observation
```

---

# 11. ORION Élèves

ORION doit détecter :

```txt
dossier incomplet
élève inscrit sans classe
élève sans responsable légal
doublon potentiel
matricule incohérent
élève affecté à une classe incompatible avec son niveau
série manquante au Secondaire
documents expirés
réinscription non finalisée
effectif classe dépassé
mouvement scolaire inhabituel
anomalie EDUCMASTER avant export
```

Exemple :

```txt
ORION Élèves — Anomalie détectée

17 élèves sont inscrits mais non affectés à une classe.
Impact possible : facturation, bulletins, présence et portail parent incomplets.
```

---

# 12. Sécurité globale

## Permissions principales

```ts
STUDENTS_VIEW
STUDENTS_CREATE
STUDENTS_UPDATE
STUDENTS_ARCHIVE
STUDENTS_ADMISSIONS_MANAGE
STUDENTS_ENROLLMENTS_MANAGE
STUDENTS_ASSIGNMENTS_MANAGE
STUDENTS_DOCUMENTS_MANAGE
STUDENTS_EDUCMASTER_EXPORT
STUDENTS_ANALYTICS_VIEW
STUDENTS_SETTINGS_MANAGE
STUDENTS_AUDIT_VIEW
```

## Contrôles obligatoires

```txt
tenantId depuis session uniquement
RBAC strict
audit des modifications sensibles
aucune suppression destructive
accès parent limité aux enfants liés
données exportées contrôlées
documents protégés
```

---

# 13. Instructions Google Antigravity

## Mission

Implémenter le **Module 1 — Élèves & Scolarité** de Academia Helm, en commençant onglet par onglet.

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Vercel
Neon
```

## Contraintes

```txt
multi-tenant strict
compatible Maternelle 1 et Maternelle 2
compatible Primaire
compatible Secondaire
compatible séries
gestion complète du dossier élève
intégration avec Finance, Examens, Parents, Structure académique
export EDUCMASTER Excel
ORION Élèves
audit complet
aucune suppression destructive
```

---

# 14. Résultat attendu

Le module doit permettre de centraliser toute la vie administrative et scolaire de l’élève :

```txt
avant son admission
pendant son inscription
pendant sa scolarité
lors de ses changements de classe ou série
jusqu’à sa sortie ou son archivage
```

Avec ce module, Academia Helm devient capable de gérer une école de manière structurée, fiable et scalable.

---

# Conclusion

Le **Module Élèves & Scolarité** est le cœur administratif de Academia Helm.

La logique de construction sera :

```txt
Onglet 1  = vision globale
Onglet 2  = entrée des candidats
Onglet 3  = inscription officielle
Onglet 4  = dossier complet
Onglet 5  = famille et responsables
Onglet 6  = affectations
Onglet 7  = mouvements
Onglet 8  = documents
Onglet 9  = EDUCMASTER
Onglet 10 = analytique ORION
Onglet 11 = paramétrage
Onglet 12 = audit conformité
```

On peut maintenant commencer  **onglet par onglet** , avec le même niveau de rigueur que pour le module Examens.

La prochaine étape logique :
 **Onglet 1 — Tableau de bord Élèves** .

---

Oui, l’**Onglet 1 — Tableau de bord Élèves** a déjà été traité. Je te le confirme clairement : il est bien positionné comme le **cockpit opérationnel** du module  **Élèves & Scolarité** .

Le fichier précédemment généré contient déjà la structure détaillée de cet onglet : objectifs, route `/students/dashboard`, composants frontend, routes API, services backend, modèle Prisma, sécurité, ORION et instructions pour Google Antigravity. Le fichier chargé dans la conversation est bien disponible comme référence de travail.

## Synthèse de l’Onglet 1

# MODULE 1 — ÉLÈVES & SCOLARITÉ

## ONGLET 1 — TABLEAU DE BORD ÉLÈVES

Cet onglet sert à piloter rapidement :

```txt
effectifs globaux
nouveaux élèves
anciens élèves
inscriptions
réinscriptions
élèves sans classe
dossiers incomplets
mouvements scolaires
alertes ORION
anomalies administratives
répartition par niveau, classe, série et statut
```

## Route principale

```txt
/students/dashboard
```

## Page frontend

```txt
app/(school)/students/dashboard/page.tsx
```

## Composants principaux

```txt
StudentsDashboardPage
StudentsDashboardHeader
StudentsOverviewCards
StudentsEnrollmentSummary
StudentsByStageChart
StudentsByLevelChart
StudentsByClassTable
StudentsBySeriesChart
StudentsStatusDistribution
IncompleteRecordsWidget
UnassignedStudentsWidget
RecentStudentMovements
StudentOrionAlertsPanel
StudentsQuickActions
StudentsTrendChart
StudentsPriorityFollowUpTable
StudentsDashboardExportButton
StudentsRecentActivityTimeline
```

## Indicateurs clés

```txt
Total élèves actifs
Nouveaux élèves
Anciens élèves
Réinscriptions finalisées
Inscriptions en attente
Élèves sans classe
Dossiers incomplets
Élèves transférés
Élèves sortis
Alertes ORION ouvertes
```

## ORION Élèves doit détecter

```txt
élève inscrit sans classe
élève sans responsable légal
dossier incomplet
doublon potentiel
classe surchargée
série manquante
niveau incohérent
matricule en conflit
inscription non finalisée
réinscription bloquée
anomalie EDUCMASTER
```

## Actions rapides

```txt
Ajouter un élève
Créer une préinscription
Finaliser une inscription
Lancer une réinscription
Affecter des élèves à une classe
Corriger les dossiers incomplets
Exporter vers EDUCMASTER
Générer un rapport élèves
Ouvrir les alertes ORION
Accéder au paramétrage
```

## Conclusion opérationnelle

L’onglet 1 est donc validé comme  **interface de pilotage consolidée** .

La suite logique est :

```txt
Onglet 2 — Préinscriptions & Admissions
```

C’est là qu’on va gérer l’entrée des candidats dans l’école : demande d’admission, dossier candidat, documents, validation, rejet, conversion en inscription officielle.

---

Parfait. On attaque maintenant :

# MODULE 1 — ÉLÈVES & SCOLARITÉ

## ONGLET 2 — PRÉINSCRIPTIONS & ADMISSIONS

Cet onglet est la **porte d’entrée officielle** des futurs élèves dans Academia Helm.
Il doit gérer tout ce qui se passe **avant** qu’un candidat devienne un élève inscrit.

La distinction est capitale :

```txt
Préinscription ≠ Inscription officielle
Candidat ≠ Élève actif
Admission acceptée ≠ Élève inscrit
```

C’est ici qu’on évite les confusions administratives qui finissent souvent en “mais l’enfant est dans quelle classe déjà ?” — phrase qui annonce généralement une longue matinée.

---

# 1. Objectif de l’onglet

L’onglet **Préinscriptions & Admissions** gère l’entrée initiale des candidats dans l’établissement avant leur inscription officielle.

Il permet de :

```txt
créer une demande de préinscription
enregistrer un candidat
collecter les informations administratives
collecter les informations familiales
collecter les pièces justificatives
suivre le statut du dossier
organiser un test ou entretien si nécessaire
valider ou rejeter une admission
convertir un candidat admis en élève inscrit
notifier les responsables
auditer tout le processus d’admission
```

Cet onglet est la première étape du cycle de vie élève.

---

# 2. Positionnement dans le module

## Route frontend

```txt
/students/admissions
```

## Module parent

```txt
Élèves & Scolarité
```

## Dépendances directes

```txt
Module Structure académique
Module Finance & Scolarité
Module Communication
Module Parents/Élèves
Module Documents
Module Paramètres
ORION Élèves
```

---

# 3. Principe général

Une préinscription n’est pas encore une inscription officielle.

Le système doit distinguer clairement :

```txt
candidat
préinscrit
dossier en étude
admis
refusé
en attente de complément
converti en élève inscrit
```

Aucun candidat ne doit être considéré comme élève actif tant que :

```txt
l’admission n’a pas été validée
ET
la conversion en inscription officielle n’a pas été effectuée
```

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit contenir :

```txt
1. Vue d’ensemble des admissions
2. Liste des demandes
3. Création d’une préinscription
4. Fiche candidat
5. Informations responsables/famille
6. Pièces justificatives
7. Tests et entretiens
8. Workflow de validation
9. Conversion en inscription
10. Notifications
11. Alertes ORION
12. Exports
13. Audit admission
```

---

# 5. Frontend

## 5.1 Route

```txt
/students/admissions
```

## 5.2 Page principale

```txt
app/(school)/students/admissions/page.tsx
```

## 5.3 Composants recommandés

```txt
components/students/admissions/AdmissionsPage.tsx
components/students/admissions/AdmissionsHeader.tsx
components/students/admissions/AdmissionsOverviewCards.tsx
components/students/admissions/AdmissionRequestsTable.tsx
components/students/admissions/AdmissionCreateDrawer.tsx
components/students/admissions/AdmissionCandidateForm.tsx
components/students/admissions/AdmissionFamilyForm.tsx
components/students/admissions/AdmissionDocumentsPanel.tsx
components/students/admissions/AdmissionInterviewPanel.tsx
components/students/admissions/AdmissionDecisionPanel.tsx
components/students/admissions/AdmissionConversionWizard.tsx
components/students/admissions/AdmissionStatusBadge.tsx
components/students/admissions/AdmissionOrionAlertsPanel.tsx
components/students/admissions/AdmissionExportButton.tsx
components/students/admissions/AdmissionAuditTimeline.tsx
```

---

# 6. Statuts admission

Statuts recommandés :

```ts
DRAFT              // brouillon
SUBMITTED          // demande soumise
UNDER_REVIEW       // dossier en étude
MISSING_DOCUMENTS  // pièces manquantes
INTERVIEW_REQUIRED // entretien requis
TEST_REQUIRED      // test requis
ACCEPTED           // admis
REJECTED           // refusé
WAITLISTED         // liste d’attente
CONVERTED          // converti en inscription
CANCELLED          // annulé
```

Ces statuts doivent être visibles sous forme de badges clairs.

---

# 7. Informations candidat

Champs recommandés :

```txt
nom
prénoms
sexe
date de naissance
lieu de naissance
nationalité
adresse
photo
niveau demandé
classe demandée
série demandée si Secondaire
parcours bilingue souhaité
ancienne école
dernier niveau fréquenté
motif de changement
observations
```

## Points de contrôle

Le système doit vérifier :

```txt
âge cohérent avec le niveau demandé
niveau demandé existant
classe demandée disponible
série obligatoire si niveau secondaire concerné
doublon potentiel sur nom + date de naissance + responsable
```

---

# 8. Informations famille/responsables

Champs recommandés :

```txt
parent/tuteur principal
lien avec l’enfant
téléphone
email
adresse
profession
contact secondaire
contact d’urgence
autorisation de contact
responsable financier
responsable académique
responsable autorisé à récupérer l’enfant
```

Important : le responsable financier et le responsable académique peuvent être différents.

Exemple :

```txt
Le père peut être responsable financier.
La mère peut être responsable académique.
Un tuteur peut être autorisé à récupérer l’enfant.
```

---

# 9. Pièces justificatives

Pièces possibles :

```txt
acte de naissance
photo d’identité
bulletin précédent
certificat de scolarité
certificat de transfert
document d’identité du responsable
autorisation parentale
fiche de renseignements
autres documents personnalisés par l’école
```

Chaque document doit avoir :

```txt
type
statut
fichier
date de dépôt
date d’expiration si applicable
validation administrative
commentaire
historique
```

Statuts document :

```txt
PENDING
SUBMITTED
VALIDATED
REJECTED
EXPIRED
```

---

# 10. Tests et entretiens

Le système doit permettre :

```txt
planification d’un entretien
planification d’un test
affectation d’un responsable
saisie du résultat
commentaire pédagogique
avis admission
pièce jointe éventuelle
notification parent
```

Statuts possibles :

```txt
non requis
planifié
réalisé
absent
favorable
défavorable
à revoir
```

---

# 11. Workflow de validation

Workflow recommandé :

```txt
1. Brouillon
2. Soumission
3. Contrôle dossier
4. Demande complément si nécessaire
5. Test/entretien si applicable
6. Avis administratif
7. Avis pédagogique
8. Décision finale
9. Admission acceptée ou refusée
10. Conversion en inscription
```

La décision finale doit être réservée aux rôles autorisés.

---

# 12. Conversion en inscription

Lorsqu’un candidat est accepté, le système doit permettre de le convertir en inscription officielle.

La conversion doit :

```txt
créer ou lier un Student
créer une inscription annuelle
générer ou réserver un matricule
affecter l’année scolaire
proposer une classe cible
proposer une série si nécessaire
créer les responsables légaux
transférer les documents validés
initialiser les frais scolaires si le module Finance est actif
créer un accès parent si activé
notifier les responsables
tracer l’action
```

Après conversion, le statut admission devient :

```txt
CONVERTED
```

Règle métier importante :

```txt
Un candidat accepté mais non converti n’est pas encore un élève actif.
```

---

# 13. ORION Admissions

ORION doit détecter :

```txt
doublon candidat
dossier incomplet
âge incohérent avec niveau demandé
classe demandée pleine
série manquante
document expiré
responsable légal absent
téléphone invalide
candidat déjà inscrit
admission acceptée mais non convertie
trop de dossiers en attente
taux de rejet inhabituel
conversion bloquée
```

Exemple :

```txt
ORION Admissions — Doublon potentiel

Un candidat portant le même nom, la même date de naissance et le même contact responsable existe déjà dans les admissions.
Vérification recommandée avant conversion.
```

---

# 14. Base de données — StudentAdmission

```prisma
model StudentAdmission {
  id              String @id @default(cuid())
  tenantId        String
  academicYearId  String

  admissionNumber String?
  status          AdmissionStatus @default(DRAFT)

  firstName       String
  lastName        String
  gender          Gender?
  birthDate       DateTime?
  birthPlace      String?
  nationality     String?
  address         String?
  photoUrl        String?

  requestedLevelId  String?
  requestedClassId  String?
  requestedSeriesId String?
  wantsBilingual    Boolean @default(false)

  previousSchool   String?
  previousLevel    String?
  changeReason     String?

  mainGuardianName         String?
  mainGuardianPhone        String?
  mainGuardianEmail        String?
  mainGuardianAddress      String?
  mainGuardianProfession   String?
  mainGuardianRelationship String?

  reviewComment    String?
  decisionComment  String?
  decisionById     String?
  decisionAt       DateTime?

  convertedStudentId String?
  convertedAt        DateTime?

  metadata        Json?

  createdById     String?
  updatedById     String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId, academicYearId])
  @@index([status])
  @@index([requestedLevelId, requestedClassId, requestedSeriesId])
  @@index([convertedStudentId])
}
```

---

# 15. Enum — AdmissionStatus

```prisma
enum AdmissionStatus {
  DRAFT
  SUBMITTED
  UNDER_REVIEW
  MISSING_DOCUMENTS
  INTERVIEW_REQUIRED
  TEST_REQUIRED
  ACCEPTED
  REJECTED
  WAITLISTED
  CONVERTED
  CANCELLED
}
```

---

# 16. Base de données — AdmissionDocument

```prisma
model AdmissionDocument {
  id              String @id @default(cuid())
  tenantId        String
  admissionId     String

  documentType    String
  fileName        String?
  fileUrl         String?
  status          DocumentStatus @default(PENDING)

  expiresAt       DateTime?
  validatedById   String?
  validatedAt     DateTime?
  comment         String?

  admission       StudentAdmission @relation(fields: [admissionId], references: [id])

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
  @@index([admissionId])
  @@index([documentType])
  @@index([status])
}
```

---

# 17. Base de données — AdmissionInterview

```prisma
model AdmissionInterview {
  id              String @id @default(cuid())
  tenantId        String
  admissionId     String

  type            AdmissionInterviewType
  status          AdmissionInterviewStatus @default(PLANNED)

  scheduledAt     DateTime?
  conductedAt     DateTime?
  responsibleId   String?

  result          String?
  score           Float?
  comment         String?
  recommendation  String?

  admission       StudentAdmission @relation(fields: [admissionId], references: [id])

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
  @@index([admissionId])
  @@index([type])
  @@index([status])
}
```

---

# 18. Enums documents et entretiens

```prisma
enum DocumentStatus {
  PENDING
  SUBMITTED
  VALIDATED
  REJECTED
  EXPIRED
}

enum AdmissionInterviewType {
  INTERVIEW
  TEST
  OBSERVATION
}

enum AdmissionInterviewStatus {
  NOT_REQUIRED
  PLANNED
  DONE
  ABSENT
  FAVORABLE
  UNFAVORABLE
  TO_REVIEW
}
```

---

# 19. Backend — Routes API

```http
GET    /api/students/admissions
GET    /api/students/admissions/:id
POST   /api/students/admissions
PATCH  /api/students/admissions/:id

POST   /api/students/admissions/:id/submit
POST   /api/students/admissions/:id/request-documents
POST   /api/students/admissions/:id/accept
POST   /api/students/admissions/:id/reject
POST   /api/students/admissions/:id/waitlist
POST   /api/students/admissions/:id/cancel
POST   /api/students/admissions/:id/convert

GET    /api/students/admissions/:id/documents
POST   /api/students/admissions/:id/documents
PATCH  /api/students/admissions/documents/:documentId
POST   /api/students/admissions/documents/:documentId/validate
POST   /api/students/admissions/documents/:documentId/reject

GET    /api/students/admissions/:id/interviews
POST   /api/students/admissions/:id/interviews
PATCH  /api/students/admissions/interviews/:interviewId
POST   /api/students/admissions/interviews/:interviewId/complete

GET    /api/students/admissions/orion-alerts
POST   /api/students/admissions/export
```

---

# 20. Backend — Services

Services recommandés :

```txt
AdmissionService
AdmissionCandidateService
AdmissionDocumentService
AdmissionInterviewService
AdmissionDecisionService
AdmissionConversionService
AdmissionNotificationService
AdmissionOrionService
AdmissionExportService
AdmissionAuditService
```

---

# 21. Sécurité

## Permissions

```ts
STUDENTS_ADMISSIONS_VIEW
STUDENTS_ADMISSIONS_CREATE
STUDENTS_ADMISSIONS_UPDATE
STUDENTS_ADMISSIONS_REVIEW
STUDENTS_ADMISSIONS_DECIDE
STUDENTS_ADMISSIONS_CONVERT
STUDENTS_ADMISSIONS_DOCUMENTS_MANAGE
STUDENTS_ADMISSIONS_EXPORT
STUDENTS_ADMISSIONS_AUDIT_VIEW
```

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
décision finale réservée aux rôles autorisés
conversion impossible si admission non acceptée
conversion impossible si dossier bloquant incomplet
aucune suppression destructive
audit complet
documents protégés
export contrôlé
```

---

# 22. Audit

Auditer :

```txt
création demande
modification demande
soumission
demande de complément
ajout document
validation document
rejet document
planification entretien/test
résultat entretien/test
acceptation
refus
mise en liste d’attente
conversion en inscription
annulation
```

---

# 23. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 2 — Préinscriptions & Admissions** du  **Module 1 — Élèves & Scolarité** .

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
admission distincte de l’inscription
compatibilité Maternelle 1, Maternelle 2, Primaire, Secondaire
compatibilité séries au Secondaire
documents admission
tests/entretiens
workflow de décision
conversion contrôlée en inscription
ORION Admissions
audit complet
aucune suppression destructive
```

## À créer côté frontend

```txt
Page /students/admissions
AdmissionsPage
AdmissionsHeader
AdmissionsOverviewCards
AdmissionRequestsTable
AdmissionCreateDrawer
AdmissionCandidateForm
AdmissionFamilyForm
AdmissionDocumentsPanel
AdmissionInterviewPanel
AdmissionDecisionPanel
AdmissionConversionWizard
AdmissionStatusBadge
AdmissionOrionAlertsPanel
AdmissionExportButton
AdmissionAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Workflow admission
Gestion documents
Gestion tests/entretiens
Décision admission
Conversion en inscription
Notifications
ORION Admissions
Audit admission
Export admissions
```

## À créer côté BDD

```txt
StudentAdmission
AdmissionDocument
AdmissionInterview
Enums AdmissionStatus, DocumentStatus, AdmissionInterviewType, AdmissionInterviewStatus
Relations avec AcademicYear, Level, Class, Series, Student, User
```

---

# 24. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
créer une préinscription
suivre les demandes d’admission
gérer les dossiers candidats
gérer les pièces justificatives
organiser les tests/entretiens
prendre une décision d’admission
convertir un candidat admis en élève inscrit
notifier les responsables
détecter les anomalies avec ORION
auditer tout le processus
exporter les admissions
```

---

# Conclusion

L’onglet **Préinscriptions & Admissions** structure proprement l’entrée des futurs élèves dans l’établissement.

La règle d’or :

```txt
Un candidat devient élève uniquement après validation et conversion officielle.
```

Avec cet onglet, Academia Helm évite les inscriptions floues, les doublons, les dossiers incomplets et les confusions administratives.

La suite logique sera :

```txt
Onglet 3 — Inscriptions & Réinscriptions
```

C’est là qu’on va gérer l’inscription officielle annuelle, la réinscription, la classe cible, la série, le statut scolaire et la liaison avec les frais de scolarité.

---

Parfait. On passe à l’onglet qui officialise réellement la scolarité de l’élève.

# MODULE 1 — ÉLÈVES & SCOLARITÉ

## ONGLET 3 — INSCRIPTIONS & RÉINSCRIPTIONS

Cet onglet est critique : il transforme un candidat admis ou un ancien élève en  **élève officiellement actif pour une année scolaire donnée** .

La règle est simple :

```txt
Un élève peut exister dans la base,
mais il n’est actif dans l’année scolaire
que s’il possède une inscription annuelle validée.
```

Sans inscription annuelle active, pas de classe, pas de facturation, pas de bulletin, pas de présence, pas de portail parent complet. Bref : il existe dans la base, mais il n’est pas encore “dans le système scolaire opérationnel”.

---

# 1. Objectif de l’onglet

L’onglet **Inscriptions & Réinscriptions** gère l’inscription officielle annuelle des élèves dans l’établissement.

Il couvre :

```txt
l’inscription d’un nouvel élève admis
l’inscription directe si l’école l’autorise
la réinscription d’un ancien élève
l’affectation à une année scolaire
la classe cible
la série au Secondaire
le régime scolaire
le statut scolaire
la liaison avec les frais de scolarité
la validation administrative
l’historique annuel de scolarité
```

Cet onglet transforme une admission ou un dossier existant en scolarité officielle pour une année donnée.

---

# 2. Positionnement dans le module

## Route frontend

```txt
/students/enrollments
```

## Module parent

```txt
Élèves & Scolarité
```

## Dépendances directes

```txt
Préinscriptions & Admissions
Dossiers élèves
Responsables légaux & Familles
Affectations classes, séries & groupes
Finance & Scolarité
Structure académique
Paramètres
ORION Élèves
Audit
```

---

# 3. Principe général

Une inscription est  **annuelle** .

Le système doit distinguer :

```txt
élève existant
élève admis
élève inscrit
élève réinscrit
élève en attente de validation
élève non réinscrit
élève sorti ou transféré
```

## Règle métier majeure

```txt
Un élève ne doit pas apparaître dans les classes, bulletins, présences ou facturations de l’année
s’il n’a pas d’inscription annuelle active.
```

C’est une règle structurante. Elle évite les élèves “fantômes” dans les classes et les erreurs de facturation.

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit contenir :

```txt
1. Vue d’ensemble inscriptions/réinscriptions
2. Liste des inscriptions
3. Inscription nouvel élève
4. Réinscription ancien élève
5. Assistant d’inscription
6. Assistant de réinscription massive
7. Validation administrative
8. Liaison avec les frais de scolarité
9. Statuts scolaires
10. Historique annuel
11. Alertes ORION
12. Exports
13. Audit
```

---

# 5. Frontend

## 5.1 Route

```txt
/students/enrollments
```

## 5.2 Page principale

```txt
app/(school)/students/enrollments/page.tsx
```

## 5.3 Composants recommandés

```txt
components/students/enrollments/EnrollmentsPage.tsx
components/students/enrollments/EnrollmentsHeader.tsx
components/students/enrollments/EnrollmentsOverviewCards.tsx
components/students/enrollments/EnrollmentsTable.tsx
components/students/enrollments/NewEnrollmentWizard.tsx
components/students/enrollments/ReEnrollmentWizard.tsx
components/students/enrollments/BulkReEnrollmentWizard.tsx
components/students/enrollments/EnrollmentValidationPanel.tsx
components/students/enrollments/EnrollmentFinanceLinkPanel.tsx
components/students/enrollments/EnrollmentStatusBadge.tsx
components/students/enrollments/EnrollmentAcademicPathPanel.tsx
components/students/enrollments/EnrollmentOrionAlertsPanel.tsx
components/students/enrollments/EnrollmentExportButton.tsx
components/students/enrollments/EnrollmentAuditTimeline.tsx
```

---

# 6. Types d’inscription

Types recommandés :

```txt
Nouvelle inscription
Réinscription
Inscription directe
Réintégration
Transfert entrant
Régularisation administrative
```

## Explication

```txt
Nouvelle inscription      = élève admis pour la première fois
Réinscription             = ancien élève poursuivant sa scolarité
Inscription directe       = inscription sans passer par admission, si autorisée
Réintégration             = ancien élève revenu après interruption
Transfert entrant         = élève venant d’un autre établissement
Régularisation admin      = correction contrôlée d’un cas administratif
```

---

# 7. Statuts d’inscription

Statuts recommandés :

```txt
brouillon
en attente
validée
rejetée
annulée
suspendue
clôturée
transférée
sortie
```

Version technique :

```ts
DRAFT
PENDING
VALIDATED
REJECTED
CANCELLED
SUSPENDED
CLOSED
TRANSFERRED
EXITED
```

---

# 8. Champs principaux d’une inscription

Champs nécessaires :

```txt
élève
année scolaire
type d’inscription
niveau
classe cible
série si Secondaire
régime scolaire
parcours bilingue
statut
date d’inscription
date de validation
validateur
motif
observation
source admission si applicable
lien finance
lien responsable financier
metadata
```

---

# 9. Inscription nouvel élève

Le système doit permettre :

```txt
inscription depuis une admission acceptée
inscription directe si autorisée
création ou liaison d’un dossier élève
sélection année scolaire
sélection niveau
sélection classe cible
sélection série si nécessaire
choix parcours bilingue
association responsables
vérification documents
initialisation frais
validation administrative
```

## Contrôle important

```txt
Une admission acceptée ne devient inscription officielle qu’après conversion et validation.
```

---

# 10. Réinscription ancien élève

Le système doit permettre :

```txt
sélection des élèves de l’année précédente
proposition automatique de niveau/classe suivante
gestion redoublement
changement de série
changement de parcours
mise à jour responsables
vérification documents
génération frais de réinscription
validation individuelle
validation massive
```

---

# 11. Réinscription massive

L’assistant de réinscription massive doit permettre :

```txt
filtrer par année précédente
filtrer par niveau
filtrer par classe
sélectionner élèves
appliquer règles de passage
exclure élèves sortis/transférés
gérer redoublants
prévisualiser résultats
valider en lot
générer rapport d’opération
```

## Exemple

```txt
Tous les élèves de CE1 A passent automatiquement en CE2 A,
sauf ceux marqués comme redoublants ou sortis.
```

Le système doit toujours afficher une prévisualisation avant validation. Une réinscription massive sans prévisualisation, c’est comme lancer une fusée sans vérifier le carburant.

---

# 12. Liaison Finance & Scolarité

À la validation d’une inscription, le système peut :

```txt
initialiser les frais scolaires
générer les échéanciers
appliquer remises/bourses si définies
associer le responsable financier
créer une ligne de compte élève
bloquer ou autoriser certains accès selon statut financier
```

Cette liaison doit être configurable par école.

## Exemple de règle

```txt
À la validation de l’inscription,
le système génère automatiquement les frais d’inscription,
les frais de scolarité annuelle et les échéances mensuelles.
```

---

# 13. ORION Inscriptions

ORION doit détecter :

```txt
élève inscrit deux fois dans la même année
élève sans classe
élève secondaire sans série
classe pleine
élève non réinscrit
ancien élève absent de la campagne de réinscription
admission acceptée non convertie
inscription sans responsable financier
inscription sans documents obligatoires
niveau/classe incohérent
redoublement non justifié
frais non initialisés
doublon potentiel
```

Exemple :

```txt
ORION Inscriptions — Élève sans classe

23 élèves ont une inscription validée mais aucune classe affectée.
Impact possible : bulletins, présences, emploi du temps et facturation incomplets.
Action recommandée : lancer l’assistant d’affectation.
```

---

# 14. Base de données — StudentEnrollment

```prisma
model StudentEnrollment {
  id              String @id @default(cuid())
  tenantId        String
  studentId       String
  academicYearId  String

  enrollmentType  EnrollmentType
  status          EnrollmentStatus @default(PENDING)

  levelId         String?
  classId         String?
  seriesId        String?

  isBilingual     Boolean @default(false)
  schoolRegime    SchoolRegime?

  admissionId     String?
  previousEnrollmentId String?

  enrolledAt      DateTime?
  validatedAt     DateTime?
  validatedById   String?

  cancelledAt     DateTime?
  cancelledById   String?
  cancellationReason String?

  financialAccountId String?
  financialGuardianId String?

  notes           String?
  metadata        Json?

  createdById     String?
  updatedById     String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([tenantId, studentId, academicYearId])
  @@index([tenantId, academicYearId])
  @@index([studentId])
  @@index([levelId, classId, seriesId])
  @@index([status])
}
```

---

# 15. Enums

```prisma
enum EnrollmentType {
  NEW
  RE_ENROLLMENT
  DIRECT
  REINTEGRATION
  TRANSFER_IN
  ADMIN_REGULARIZATION
}

enum EnrollmentStatus {
  DRAFT
  PENDING
  VALIDATED
  REJECTED
  CANCELLED
  SUSPENDED
  CLOSED
  TRANSFERRED
  EXITED
}

enum SchoolRegime {
  DAY
  BOARDING
  HALF_BOARDING
  OTHER
}
```

---

# 16. Base de données — ReEnrollmentCampaign

```prisma
model ReEnrollmentCampaign {
  id              String @id @default(cuid())
  tenantId        String
  academicYearId  String
  sourceAcademicYearId String?

  name            String
  status          ReEnrollmentCampaignStatus @default(DRAFT)

  rules           Json?
  statistics      Json?

  launchedById    String?
  launchedAt      DateTime?
  closedById      String?
  closedAt        DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId, academicYearId])
  @@index([status])
}
```

---

# 17. Enum — ReEnrollmentCampaignStatus

```prisma
enum ReEnrollmentCampaignStatus {
  DRAFT
  OPEN
  PROCESSING
  CLOSED
  CANCELLED
}
```

---

# 18. Backend — Routes API

```http
GET    /api/students/enrollments
GET    /api/students/enrollments/:id
POST   /api/students/enrollments
PATCH  /api/students/enrollments/:id

POST   /api/students/enrollments/:id/validate
POST   /api/students/enrollments/:id/reject
POST   /api/students/enrollments/:id/cancel
POST   /api/students/enrollments/:id/suspend
POST   /api/students/enrollments/:id/close

POST   /api/students/enrollments/from-admission/:admissionId
POST   /api/students/enrollments/direct
POST   /api/students/enrollments/re-enroll

GET    /api/students/re-enrollment-campaigns
POST   /api/students/re-enrollment-campaigns
GET    /api/students/re-enrollment-campaigns/:id
POST   /api/students/re-enrollment-campaigns/:id/launch
POST   /api/students/re-enrollment-campaigns/:id/process
POST   /api/students/re-enrollment-campaigns/:id/close

GET    /api/students/enrollments/orion-alerts
POST   /api/students/enrollments/export
```

---

# 19. Backend — Services

Services recommandés :

```txt
EnrollmentService
NewEnrollmentService
DirectEnrollmentService
ReEnrollmentService
BulkReEnrollmentService
EnrollmentValidationService
EnrollmentFinanceLinkService
EnrollmentAcademicPathService
ReEnrollmentCampaignService
EnrollmentOrionService
EnrollmentExportService
EnrollmentAuditService
```

---

# 20. Sécurité

## Permissions

```ts
STUDENTS_ENROLLMENTS_VIEW
STUDENTS_ENROLLMENTS_CREATE
STUDENTS_ENROLLMENTS_UPDATE
STUDENTS_ENROLLMENTS_VALIDATE
STUDENTS_ENROLLMENTS_CANCEL
STUDENTS_RE_ENROLLMENTS_MANAGE
STUDENTS_BULK_RE_ENROLL
STUDENTS_ENROLLMENTS_EXPORT
STUDENTS_ENROLLMENTS_AUDIT_VIEW
```

## Contrôles

```txt
tenantId depuis session uniquement
une seule inscription active par élève et par année
validation réservée aux rôles autorisés
inscription impossible sans année scolaire
série obligatoire selon niveau/classe
liaison finance contrôlée
aucune suppression destructive
audit complet
```

---

# 21. Audit

Auditer :

```txt
création inscription
modification inscription
validation
rejet
annulation
suspension
clôture
inscription depuis admission
inscription directe
réinscription
réinscription massive
changement classe
changement série
liaison finance
export
```

---

# 22. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 3 — Inscriptions & Réinscriptions** du  **Module 1 — Élèves & Scolarité** .

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
une inscription par élève et par année scolaire
compatibilité Maternelle 1, Maternelle 2, Primaire, Secondaire
compatibilité séries au Secondaire
inscription annuelle obligatoire
réinscription individuelle et massive
liaison Finance & Scolarité
ORION Inscriptions
audit complet
aucune suppression destructive
```

## À créer côté frontend

```txt
Page /students/enrollments
EnrollmentsPage
EnrollmentsHeader
EnrollmentsOverviewCards
EnrollmentsTable
NewEnrollmentWizard
ReEnrollmentWizard
BulkReEnrollmentWizard
EnrollmentValidationPanel
EnrollmentFinanceLinkPanel
EnrollmentStatusBadge
EnrollmentAcademicPathPanel
EnrollmentOrionAlertsPanel
EnrollmentExportButton
EnrollmentAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Inscription depuis admission
Inscription directe
Réinscription individuelle
Réinscription massive
Validation administrative
Liaison Finance & Scolarité
ORION Inscriptions
Audit inscriptions
Export inscriptions
```

## À créer côté BDD

```txt
StudentEnrollment
ReEnrollmentCampaign
Enums EnrollmentType, EnrollmentStatus, SchoolRegime, ReEnrollmentCampaignStatus
Relations avec Student, AcademicYear, Level, Class, Series, Admission, User, FinanceAccount, Guardian
```

---

# 23. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
inscrire un nouvel élève
réinscrire un ancien élève
convertir une admission acceptée en inscription
faire une inscription directe si autorisée
gérer les campagnes de réinscription
réinscrire en masse
valider administrativement une inscription
lier l’inscription aux frais scolaires
détecter les anomalies avec ORION
auditer tout le processus
exporter les inscriptions
```

---

# Conclusion

L’onglet **Inscriptions & Réinscriptions** est le point où l’élève devient officiellement actif pour une année scolaire.

La règle d’or :

```txt
Pas d’inscription annuelle validée,
pas d’élève actif dans l’année scolaire.
```

Avec cet onglet, Academia Helm évite les élèves fantômes, les réinscriptions floues, les doublons annuels et les erreurs de facturation.

La suite logique sera :

```txt
Onglet 4 — Dossiers élèves
```

C’est là qu’on va structurer la fiche complète de l’élève : identité, photo, matricule, état civil, parcours, documents, responsables, historique et conformité du dossier.

---

Très bien. On attaque maintenant le cœur documentaire et administratif de l’élève.

# MODULE 1 — ÉLÈVES & SCOLARITÉ

## ONGLET 4 — DOSSIERS ÉLÈVES

Cet onglet est la  **fiche centrale de l’élève** .
C’est ici que l’administration retrouve l’identité, le matricule, la photo, le parcours scolaire, les responsables, les documents, les observations et les alertes ORION.

En clair : si quelqu’un demande “qui est cet élève dans l’établissement ?”, la réponse doit se trouver ici.

---

# 1. Objectif de l’onglet

L’onglet **Dossiers élèves** centralise la fiche complète de chaque élève.

Il permet de consulter, créer, modifier, compléter et suivre toutes les informations :

```txt
administratives
scolaires
familiales
documentaires
historiques
liées à un élève
```

C’est la fiche de référence de l’élève dans Academia Helm.

---

# 2. Positionnement dans le module

## Route frontend

```txt
/students/records
```

## Module parent

```txt
Élèves & Scolarité
```

## Dépendances directes

```txt
Admissions
Inscriptions & Réinscriptions
Responsables légaux & Familles
Affectations classes, séries & groupes
Documents & conformité
Examens, Notes & Bulletins
Finance & Scolarité
Présence & Discipline
Communication
ORION Élèves
Audit
```

---

# 3. Principe général

Le dossier élève est une  **entité vivante** .

Il doit contenir :

```txt
identité
état civil
photo
matricule
informations administratives
informations scolaires
responsables liés
parcours académique
documents
historique
observations
statut
alertes ORION
audit
```

Règle importante :

```txt
Aucune suppression destructive ne doit être autorisée.
```

On archive, on historise, on trace. On ne fait pas disparaître un élève comme une ligne Excel gênante.

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit contenir :

```txt
1. Liste des élèves
2. Recherche avancée
3. Fiche identité
4. Informations administratives
5. Informations scolaires
6. Responsables liés
7. Parcours académique
8. Documents liés
9. Historique de scolarité
10. Observations
11. Alertes ORION
12. Actions rapides
13. Export dossier
14. Audit dossier
```

---

# 5. Frontend

## 5.1 Route

```txt
/students/records
```

## 5.2 Page principale

```txt
app/(school)/students/records/page.tsx
```

## 5.3 Composants recommandés

```txt
components/students/records/StudentRecordsPage.tsx
components/students/records/StudentRecordsHeader.tsx
components/students/records/StudentRecordsTable.tsx
components/students/records/StudentAdvancedSearchPanel.tsx
components/students/records/StudentRecordDrawer.tsx
components/students/records/StudentIdentitySection.tsx
components/students/records/StudentAdministrativeSection.tsx
components/students/records/StudentAcademicSection.tsx
components/students/records/StudentGuardiansSection.tsx
components/students/records/StudentDocumentsSection.tsx
components/students/records/StudentAcademicPathTimeline.tsx
components/students/records/StudentObservationsPanel.tsx
components/students/records/StudentOrionAlertsPanel.tsx
components/students/records/StudentRecordActions.tsx
components/students/records/StudentRecordExportButton.tsx
components/students/records/StudentRecordAuditTimeline.tsx
```

---

# 6. Liste des élèves

La liste doit afficher :

```txt
photo
matricule
nom
prénoms
sexe
niveau
classe
série
statut
régime
parcours bilingue
responsable principal
téléphone responsable
état du dossier
alertes ORION
actions
```

## Filtres

```txt
année scolaire
niveau
classe
série
statut
sexe
régime
parcours bilingue
dossier complet/incomplet
élève actif/inactif
nouvel élève
ancien élève
redoublant
transféré
sorti
```

---

# 7. Recherche avancée

Recherche par :

```txt
nom
prénoms
matricule
téléphone parent
email parent
date de naissance
lieu de naissance
ancienne école
numéro admission
document
classe
série
```

Objectif : retrouver un élève rapidement, même si l’utilisateur ne connaît qu’une partie de l’information.

---

# 8. Fiche identité

Champs :

```txt
photo
matricule
nom
prénoms
sexe
date de naissance
lieu de naissance
nationalité
adresse
langue principale
statut élève
QR code interne si activé
```

## Matricule

Le matricule doit être :

```txt
unique par école
généré automatiquement ou saisi selon paramétrage
non réutilisable
historisé en cas de modification
```

---

# 9. Informations administratives

Champs :

```txt
numéro dossier
date création dossier
source du dossier
admission liée
inscription active
régime scolaire
statut administratif
statut scolaire
boursier
assurance
autorisations particulières
observations administratives
```

---

# 10. Informations scolaires

Champs :

```txt
année scolaire active
niveau
classe
série
groupe
parcours bilingue
options
redoublant
nouvel élève
ancien élève
date d’entrée
ancienne école
dernier niveau fréquenté
```

---

# 11. Responsables liés

Afficher :

```txt
responsable principal
responsable financier
responsable académique
contacts d’urgence
personnes autorisées à récupérer l’enfant
fratrie
droits portail parent
```

La modification avancée des responsables se fait dans l’ **Onglet 5 — Responsables légaux & Familles** , mais l’onglet 4 doit afficher un résumé clair.

---

# 12. Parcours académique

Le dossier doit afficher une timeline :

```txt
admission
inscription
réinscriptions
changements de classe
changements de série
redoublements
transferts
sorties
réintégrations
archivage
```

Chaque événement doit afficher :

```txt
date
type
ancienne situation
nouvelle situation
motif
auteur
```

---

# 13. Documents liés

Afficher :

```txt
acte de naissance
photo
bulletin précédent
certificat de scolarité
autorisation parentale
document identité responsable
autres pièces configurées
```

Chaque document :

```txt
statut
date dépôt
validation
expiration
commentaire
accès au fichier
```

La gestion avancée des documents sera dans :

```txt
Onglet 8 — Documents, pièces & conformité dossier
```

---

# 14. Observations

Types d’observations :

```txt
administrative
pédagogique
disciplinaire
financière
familiale
générale
```

Les observations sensibles doivent être protégées par permission.

Exemple :

```txt
Une observation financière ne doit pas forcément être visible par un enseignant.
Une observation pédagogique ne doit pas forcément être visible par le service comptable.
```

---

# 15. ORION Dossier Élève

ORION doit détecter :

```txt
dossier incomplet
matricule manquant
doublon potentiel
élève sans inscription active
élève sans classe
élève secondaire sans série
responsable principal absent
responsable financier absent
document obligatoire manquant
document expiré
âge incohérent
niveau/classe incohérent
données contradictoires
historique scolaire incomplet
```

Exemple :

```txt
ORION Dossier Élève — Dossier incomplet

L’élève possède une inscription active, mais aucun responsable financier n’est défini.
Impact possible : facturation et relances impossibles.
```

---

# 16. Base de données — Student

```prisma
model Student {
  id              String @id @default(cuid())
  tenantId        String

  matricule       String?
  firstName       String
  lastName        String
  gender          Gender?
  birthDate       DateTime?
  birthPlace      String?
  nationality     String?
  address         String?
  photoUrl        String?

  status          StudentStatus @default(ACTIVE)
  administrativeStatus StudentAdministrativeStatus @default(REGISTERED)

  primaryLanguage String?
  qrCodeValue     String?

  createdFromAdmissionId String?

  metadata        Json?

  createdById     String?
  updatedById     String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  archivedAt      DateTime?

  @@unique([tenantId, matricule])
  @@index([tenantId])
  @@index([status])
  @@index([administrativeStatus])
  @@index([lastName, firstName])
}
```

---

# 17. Base de données — StudentProfile

```prisma
model StudentProfile {
  id              String @id @default(cuid())
  tenantId        String
  studentId       String @unique

  dossierNumber   String?
  source          StudentRecordSource?
  insuranceInfo   String?
  scholarshipType String?
  specialAuthorizations Json?
  administrativeNotes String?

  previousSchool  String?
  previousLevel   String?
  entryDate       DateTime?

  student         Student @relation(fields: [studentId], references: [id])

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
}
```

---

# 18. Enums

```prisma
enum StudentStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
  TRANSFERRED
  EXITED
  ARCHIVED
}

enum StudentAdministrativeStatus {
  CANDIDATE
  ADMITTED
  REGISTERED
  RE_REGISTERED
  PENDING
  SUSPENDED
  TRANSFERRED
  EXITED
  ARCHIVED
}

enum StudentRecordSource {
  ADMISSION
  DIRECT_CREATION
  IMPORT
  ADMIN_REGULARIZATION
}
```

---

# 19. Backend — Routes API

```http
GET    /api/students/records
GET    /api/students/records/:studentId
POST   /api/students/records
PATCH  /api/students/records/:studentId
POST   /api/students/records/:studentId/archive
POST   /api/students/records/:studentId/restore

GET    /api/students/records/:studentId/profile
PATCH  /api/students/records/:studentId/profile

GET    /api/students/records/:studentId/academic-path
GET    /api/students/records/:studentId/documents
GET    /api/students/records/:studentId/guardians
GET    /api/students/records/:studentId/orion-alerts
GET    /api/students/records/:studentId/audit

POST   /api/students/records/export
POST   /api/students/records/:studentId/export
```

---

# 20. Backend — Services

Services recommandés :

```txt
StudentRecordService
StudentIdentityService
StudentProfileService
StudentSearchService
StudentAcademicPathService
StudentRecordDocumentService
StudentRecordGuardianService
StudentObservationService
StudentRecordOrionService
StudentRecordExportService
StudentRecordAuditService
```

---

# 21. Sécurité

## Permissions

```ts
STUDENTS_RECORDS_VIEW
STUDENTS_RECORDS_CREATE
STUDENTS_RECORDS_UPDATE
STUDENTS_RECORDS_ARCHIVE
STUDENTS_RECORDS_EXPORT
STUDENTS_RECORDS_SENSITIVE_VIEW
STUDENTS_RECORDS_AUDIT_VIEW
```

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
matricule unique par école
aucune suppression destructive
archivage contrôlé
observations sensibles protégées
documents protégés
audit complet
```

---

# 22. Audit

Auditer :

```txt
création dossier
modification identité
modification informations administratives
modification informations scolaires
modification photo
changement statut
archivage
restauration
export dossier
consultation données sensibles
```

---

# 23. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 4 — Dossiers élèves** du  **Module 1 — Élèves & Scolarité** .

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
matricule unique par tenant
fiche élève complète
compatibilité Maternelle 1, Maternelle 2, Primaire, Secondaire
compatibilité séries au Secondaire
affichage responsables
affichage parcours académique
affichage documents
ORION Dossier Élève
audit complet
aucune suppression destructive
```

## À créer côté frontend

```txt
Page /students/records
StudentRecordsPage
StudentRecordsHeader
StudentRecordsTable
StudentAdvancedSearchPanel
StudentRecordDrawer
StudentIdentitySection
StudentAdministrativeSection
StudentAcademicSection
StudentGuardiansSection
StudentDocumentsSection
StudentAcademicPathTimeline
StudentObservationsPanel
StudentOrionAlertsPanel
StudentRecordActions
StudentRecordExportButton
StudentRecordAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Gestion identité élève
Gestion profil élève
Recherche avancée
Timeline parcours académique
Résumé responsables
Résumé documents
ORION Dossier Élève
Audit dossier
Export dossier
Archivage/restauration
```

## À créer côté BDD

```txt
Student
StudentProfile
Enums StudentStatus, StudentAdministrativeStatus, StudentRecordSource
Relations avec Admission, Enrollment, Guardian, Document, Class, Level, Series, AcademicYear, User
```

---

# 24. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
lister les élèves
rechercher un élève rapidement
ouvrir une fiche élève complète
modifier les informations autorisées
afficher l’identité
afficher la scolarité
afficher les responsables liés
afficher les documents
afficher le parcours académique
afficher les alertes ORION
archiver/restaurer un dossier
exporter un dossier élève
auditer les actions sensibles
```

---

# Conclusion

L’onglet **Dossiers élèves** est la fiche centrale de chaque élève.

La règle d’or :

```txt
Le dossier élève doit être complet, fiable, traçable et exploitable par tous les modules autorisés.
```

Avec cet onglet, Academia Helm dispose d’une base élève propre, structurée et professionnelle.

La suite logique sera :

```txt
Onglet 5 — Responsables légaux & Familles
```

C’est là qu’on va structurer les parents, tuteurs, contacts d’urgence, responsables financiers, responsables académiques, fratries et accès portail parent.

---

Parfait. On attaque maintenant un onglet très sensible :  **les responsables légaux et les familles** .
Ici, on ne gère pas seulement des contacts. On gère les personnes qui ont autorité, responsabilité financière, responsabilité académique, droit d’accès, droit de retrait de l’enfant et capacité à recevoir des informations sensibles.

# MODULE 1 — ÉLÈVES & SCOLARITÉ

## ONGLET 5 — RESPONSABLES LÉGAUX & FAMILLES

Cet onglet doit être traité avec rigueur, parce qu’une mauvaise gestion des responsables peut provoquer des erreurs sérieuses : facture envoyée à la mauvaise personne, bulletin visible par un parent non autorisé, enfant remis à une personne non habilitée. Donc ici, la règle est simple :  **rôle clair, droit clair, historique clair** .

---

# 1. Objectif de l’onglet

L’onglet **Responsables légaux & Familles** centralise la gestion des parents, tuteurs, responsables financiers, responsables académiques, contacts d’urgence, personnes autorisées à récupérer l’enfant et liens familiaux.

Il permet de :

```txt
créer et gérer les responsables
lier un responsable à un ou plusieurs élèves
définir les rôles familiaux et administratifs
gérer les droits d’accès au portail parent
gérer les contacts d’urgence
suivre les fratries
identifier le responsable financier
identifier le responsable académique
sécuriser les informations sensibles
auditer les modifications
```

---

# 2. Positionnement dans le module

## Route frontend

```txt
/students/guardians
```

## Module parent

```txt
Élèves & Scolarité
```

## Dépendances directes

```txt
Dossiers élèves
Inscriptions & Réinscriptions
Finance & Scolarité
Communication
Portail Parent/Élève
Documents & conformité
Paramètres
ORION Élèves
Audit
```

---

# 3. Principe général

Un élève peut avoir plusieurs responsables.

Un responsable peut être lié à plusieurs élèves.

Le système doit distinguer :

```txt
responsable légal
responsable principal
responsable financier
responsable académique
contact d’urgence
personne autorisée à récupérer l’enfant
tuteur
parent non autorisé
contact secondaire
```

La relation entre un élève et un responsable doit être  **historisée et contrôlée** .

Point important : un même responsable peut avoir des rôles différents selon l’élève.

Exemple :

```txt
Un père peut être responsable financier de l’élève A,
mais seulement contact d’urgence de l’élève B.
```

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit contenir :

```txt
1. Vue d’ensemble familles/responsables
2. Liste des responsables
3. Fiche responsable
4. Liaison responsable-élève
5. Gestion des rôles
6. Responsables financiers
7. Responsables académiques
8. Contacts d’urgence
9. Personnes autorisées à récupérer l’enfant
10. Fratries
11. Accès portail parent
12. Consentements et autorisations
13. Alertes ORION
14. Exports
15. Audit
```

---

# 5. Frontend

## 5.1 Route

```txt
/students/guardians
```

## 5.2 Page principale

```txt
app/(school)/students/guardians/page.tsx
```

## 5.3 Composants recommandés

```txt
components/students/guardians/GuardiansPage.tsx
components/students/guardians/GuardiansHeader.tsx
components/students/guardians/GuardiansOverviewCards.tsx
components/students/guardians/GuardiansTable.tsx
components/students/guardians/GuardianRecordDrawer.tsx
components/students/guardians/GuardianIdentitySection.tsx
components/students/guardians/GuardianContactSection.tsx
components/students/guardians/GuardianLinkedStudentsSection.tsx
components/students/guardians/GuardianRolesPanel.tsx
components/students/guardians/GuardianFinanceRolePanel.tsx
components/students/guardians/GuardianAcademicRolePanel.tsx
components/students/guardians/GuardianEmergencyContactsPanel.tsx
components/students/guardians/GuardianPickupAuthorizationPanel.tsx
components/students/guardians/SiblingGroupPanel.tsx
components/students/guardians/GuardianPortalAccessPanel.tsx
components/students/guardians/GuardianConsentPanel.tsx
components/students/guardians/GuardianOrionAlertsPanel.tsx
components/students/guardians/GuardianExportButton.tsx
components/students/guardians/GuardianAuditTimeline.tsx
```

---

# 6. Liste des responsables

La liste doit afficher :

```txt
nom
prénoms
téléphone
email
relation principale
nombre d’élèves liés
rôle financier
rôle académique
accès portail parent
statut
alertes ORION
actions
```

## Filtres

```txt
type de responsable
rôle
statut
accès portail actif/inactif
responsable financier
responsable académique
contact d’urgence
autorisé à récupérer
famille/fratrie
dossier incomplet
```

---

# 7. Fiche responsable

Champs recommandés :

```txt
nom
prénoms
sexe
téléphone principal
téléphone secondaire
email
adresse
profession
employeur
numéro d’identification si nécessaire
langue de communication
canal préféré
statut
notes administratives
```

---

# 8. Liaison responsable-élève

La relation doit contenir :

```txt
élève lié
lien familial
rôle
responsable principal
responsable financier
responsable académique
contact d’urgence
autorisé à récupérer
priorité de contact
date de début
date de fin
statut
observation
```

Cette relation est plus importante que la fiche responsable elle-même. Pourquoi ? Parce que le droit d’un responsable dépend du lien avec l’élève concerné.

---

# 9. Rôles possibles

Rôles recommandés :

```txt
père
mère
tuteur
oncle
tante
grand-parent
frère/sœur majeur
représentant légal
responsable financier
responsable académique
contact d’urgence
personne autorisée au retrait
autre
```

---

# 10. Responsable financier

Le responsable financier est utilisé par le module **Finance & Scolarité** pour :

```txt
facturation
reçus
relances
échéanciers
remises
bourses
historique de paiement
notifications financières
```

## Règle métier

```txt
Un élève actif doit avoir au moins un responsable financier,
sauf exception explicitement paramétrée.
```

Sans responsable financier, la facturation devient bancale. Et une facturation bancale, c’est rarement une bonne nouvelle pour la trésorerie.

---

# 11. Responsable académique

Le responsable académique est utilisé pour :

```txt
suivi des notes
bulletins
absences
discipline
rendez-vous pédagogiques
communication enseignant/parent
accès aux résultats
notifications académiques
```

---

# 12. Contacts d’urgence

Le système doit permettre :

```txt
plusieurs contacts d’urgence
ordre de priorité
lien avec l’élève
téléphone principal
téléphone secondaire
disponibilité
commentaire
statut actif/inactif
```

---

# 13. Personnes autorisées à récupérer l’enfant

Fonction particulièrement importante pour la **Maternelle** et le  **Primaire** .

Le système doit gérer :

```txt
nom
téléphone
lien avec l’enfant
pièce d’identité si nécessaire
photo si activée
autorisation active
période de validité
restriction éventuelle
commentaire
historique
```

Règle stricte :

```txt
Un enfant ne doit être remis qu’à une personne autorisée et active dans le système.
```

---

# 14. Fratries

Le système doit détecter et gérer les fratries :

```txt
élèves ayant les mêmes responsables
élèves déclarés comme frères/sœurs
familles multi-enfants
regroupement financier éventuel
communication familiale consolidée
remise famille nombreuse si paramétrée
```

---

# 15. Accès portail parent

Le système doit permettre :

```txt
créer un compte portail parent
activer/désactiver l’accès
réinitialiser le mot de passe
envoyer une invitation
définir les droits visibles
limiter l’accès financier
limiter l’accès académique
consulter l’historique de connexion
bloquer un accès
```

## Droits possibles

```txt
voir bulletins
voir notes
voir absences
voir discipline
voir factures
payer en ligne si activé
télécharger reçus
envoyer messages
recevoir notifications
```

---

# 16. Consentements et autorisations

Consentements possibles :

```txt
autorisation photo/vidéo
autorisation sortie pédagogique
autorisation médicale d’urgence
autorisation communication numérique
autorisation retrait par tiers
acceptation règlement intérieur
consentement traitement données personnelles
```

Chaque consentement doit être :

```txt
daté
signé ou validé
lié à un responsable
historisé
révocable si applicable
```

---

# 17. ORION Responsables & Familles

ORION doit détecter :

```txt
élève actif sans responsable principal
élève actif sans responsable financier
élève actif sans contact d’urgence
responsable sans téléphone
responsable sans lien familial défini
doublon responsable
email invalide
téléphone invalide
accès portail parent non activé
responsable financier incohérent
autorisation de retrait expirée
consentement obligatoire manquant
fratrie probable non liée
conflit de rôle entre responsables
```

Exemple :

```txt
ORION Responsables — Contact d’urgence manquant

L’élève est actif, mais aucun contact d’urgence n’est défini.
Impact possible : impossibilité de joindre une personne autorisée en cas d’urgence.
Action recommandée : compléter la fiche famille.
```

---

# 18. Base de données — Guardian

```prisma
model Guardian {
  id              String @id @default(cuid())
  tenantId        String

  firstName       String
  lastName        String
  gender          Gender?

  primaryPhone    String?
  secondaryPhone  String?
  email           String?
  address         String?

  profession      String?
  employer        String?
  identificationNumber String?

  preferredLanguage String?
  preferredChannel  CommunicationChannel?

  status          GuardianStatus @default(ACTIVE)

  portalUserId    String?
  portalAccessEnabled Boolean @default(false)

  notes           String?
  metadata        Json?

  createdById     String?
  updatedById     String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  archivedAt      DateTime?

  @@index([tenantId])
  @@index([primaryPhone])
  @@index([email])
  @@index([status])
  @@index([lastName, firstName])
}
```

---

# 19. Base de données — StudentGuardianRelation

```prisma
model StudentGuardianRelation {
  id              String @id @default(cuid())
  tenantId        String

  studentId       String
  guardianId      String

  relationship    GuardianRelationship
  customRelationship String?

  isPrimary       Boolean @default(false)
  isLegalGuardian Boolean @default(false)
  isFinancialResponsible Boolean @default(false)
  isAcademicResponsible  Boolean @default(false)
  isEmergencyContact     Boolean @default(false)
  isPickupAuthorized     Boolean @default(false)

  contactPriority Int?
  startsAt        DateTime?
  endsAt          DateTime?

  status          GuardianRelationStatus @default(ACTIVE)

  notes           String?
  metadata        Json?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([tenantId, studentId, guardianId])
  @@index([tenantId])
  @@index([studentId])
  @@index([guardianId])
  @@index([relationship])
  @@index([status])
}
```

---

# 20. Base de données — PickupAuthorization

```prisma
model PickupAuthorization {
  id              String @id @default(cuid())
  tenantId        String

  studentId       String
  guardianId      String?

  fullName        String
  phone           String?
  relationship    String?
  identityDocumentUrl String?
  photoUrl        String?

  validFrom       DateTime?
  validUntil      DateTime?
  isActive        Boolean @default(true)

  restrictionNote String?
  notes           String?

  createdById     String?
  updatedById     String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
  @@index([studentId])
  @@index([guardianId])
  @@index([isActive])
}
```

---

# 21. Base de données — GuardianConsent

```prisma
model GuardianConsent {
  id              String @id @default(cuid())
  tenantId        String

  studentId       String
  guardianId      String

  consentType     GuardianConsentType
  status          ConsentStatus @default(PENDING)

  signedAt        DateTime?
  revokedAt       DateTime?
  expiresAt       DateTime?

  proofFileUrl    String?
  notes           String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
  @@index([studentId])
  @@index([guardianId])
  @@index([consentType])
  @@index([status])
}
```

---

# 22. Enums

```prisma
enum GuardianStatus {
  ACTIVE
  INACTIVE
  BLOCKED
  ARCHIVED
}

enum GuardianRelationStatus {
  ACTIVE
  INACTIVE
  ENDED
  DISPUTED
}

enum GuardianRelationship {
  FATHER
  MOTHER
  TUTOR
  UNCLE
  AUNT
  GRAND_PARENT
  SIBLING
  LEGAL_REPRESENTATIVE
  OTHER
}

enum CommunicationChannel {
  SMS
  EMAIL
  WHATSAPP
  PHONE_CALL
  PORTAL
}

enum GuardianConsentType {
  PHOTO_VIDEO
  SCHOOL_TRIP
  EMERGENCY_MEDICAL
  DIGITAL_COMMUNICATION
  THIRD_PARTY_PICKUP
  INTERNAL_RULES
  PERSONAL_DATA_PROCESSING
}

enum ConsentStatus {
  PENDING
  GRANTED
  REFUSED
  REVOKED
  EXPIRED
}
```

---

# 23. Backend — Routes API

```http
GET    /api/students/guardians
GET    /api/students/guardians/:guardianId
POST   /api/students/guardians
PATCH  /api/students/guardians/:guardianId
POST   /api/students/guardians/:guardianId/archive
POST   /api/students/guardians/:guardianId/restore

GET    /api/students/:studentId/guardians
POST   /api/students/:studentId/guardians/link
PATCH  /api/students/:studentId/guardians/:relationId
POST   /api/students/:studentId/guardians/:relationId/end

GET    /api/students/:studentId/pickup-authorizations
POST   /api/students/:studentId/pickup-authorizations
PATCH  /api/students/pickup-authorizations/:authorizationId
POST   /api/students/pickup-authorizations/:authorizationId/revoke

GET    /api/students/:studentId/consents
POST   /api/students/:studentId/consents
PATCH  /api/students/consents/:consentId
POST   /api/students/consents/:consentId/revoke

POST   /api/students/guardians/:guardianId/portal/invite
POST   /api/students/guardians/:guardianId/portal/enable
POST   /api/students/guardians/:guardianId/portal/disable
POST   /api/students/guardians/:guardianId/portal/reset-password

GET    /api/students/guardians/orion-alerts
POST   /api/students/guardians/export
```

---

# 24. Backend — Services

Services recommandés :

```txt
GuardianService
GuardianRelationService
GuardianRoleService
FinancialGuardianService
AcademicGuardianService
EmergencyContactService
PickupAuthorizationService
SiblingDetectionService
GuardianPortalAccessService
GuardianConsentService
GuardianOrionService
GuardianExportService
GuardianAuditService
```

---

# 25. Sécurité

## Permissions

```ts
STUDENTS_GUARDIANS_VIEW
STUDENTS_GUARDIANS_CREATE
STUDENTS_GUARDIANS_UPDATE
STUDENTS_GUARDIANS_ARCHIVE
STUDENTS_GUARDIANS_LINK
STUDENTS_GUARDIANS_ROLES_MANAGE
STUDENTS_GUARDIANS_PORTAL_MANAGE
STUDENTS_GUARDIANS_CONSENTS_MANAGE
STUDENTS_GUARDIANS_EXPORT
STUDENTS_GUARDIANS_AUDIT_VIEW
```

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
un responsable ne peut être lié qu’aux élèves du même tenant
données sensibles protégées
accès portail contrôlé
aucune suppression destructive
archivage contrôlé
audit complet
```

---

# 26. Audit

Auditer :

```txt
création responsable
modification responsable
archivage/restauration
liaison à un élève
modification rôle
retrait rôle
activation/désactivation portail
invitation portail
réinitialisation mot de passe
ajout consentement
révocation consentement
ajout autorisation retrait
révocation autorisation retrait
export
```

---

# 27. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 5 — Responsables légaux & Familles** du  **Module 1 — Élèves & Scolarité** .

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
responsables multi-élèves
élèves multi-responsables
rôles différenciés par élève
responsable financier obligatoire selon règle école
contact d’urgence recommandé/obligatoire selon règle école
accès portail parent contrôlé
consentements historisés
autorisations de retrait historisées
ORION Responsables & Familles
audit complet
aucune suppression destructive
```

## À créer côté frontend

```txt
Page /students/guardians
GuardiansPage
GuardiansHeader
GuardiansOverviewCards
GuardiansTable
GuardianRecordDrawer
GuardianIdentitySection
GuardianContactSection
GuardianLinkedStudentsSection
GuardianRolesPanel
GuardianFinanceRolePanel
GuardianAcademicRolePanel
GuardianEmergencyContactsPanel
GuardianPickupAuthorizationPanel
SiblingGroupPanel
GuardianPortalAccessPanel
GuardianConsentPanel
GuardianOrionAlertsPanel
GuardianExportButton
GuardianAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Gestion responsables
Gestion relations élève-responsable
Gestion rôles financiers/académiques
Gestion contacts d’urgence
Gestion autorisations de retrait
Gestion consentements
Gestion portail parent
Détection fratries
ORION Responsables & Familles
Audit complet
Export
```

## À créer côté BDD

```txt
Guardian
StudentGuardianRelation
PickupAuthorization
GuardianConsent
Enums GuardianStatus, GuardianRelationStatus, GuardianRelationship, CommunicationChannel, GuardianConsentType, ConsentStatus
Relations avec Student, User, Finance, Communication, PortalAccess
```

---

# 28. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
créer et gérer les responsables
lier les responsables aux élèves
définir les rôles par élève
identifier les responsables financiers
identifier les responsables académiques
gérer les contacts d’urgence
gérer les personnes autorisées à récupérer l’enfant
détecter les fratries
gérer les accès portail parent
gérer les consentements
détecter les anomalies avec ORION
auditer toutes les actions sensibles
exporter les données familles/responsables
```

---

# Conclusion

L’onglet **Responsables légaux & Familles** est un pilier de sécurité administrative.

La règle d’or :

```txt
Chaque élève actif doit avoir des responsables clairement identifiés,
avec des rôles, droits et autorisations parfaitement traçables.
```

Avec cet onglet, Academia Helm sécurise la relation école-famille, fiabilise la facturation, renforce la communication et évite les erreurs sensibles.

La suite logique sera :

```txt
Onglet 6 — Affectations Classes, Séries & Groupes
```

C’est là qu’on va gérer l’affectation réelle des élèves dans les classes, séries, groupes pédagogiques, parcours bilingues et structures académiques.

---

Très bien. On passe à l’onglet qui rend l’élève **opérationnel pédagogiquement** dans l’établissement.

# MODULE 1 — ÉLÈVES & SCOLARITÉ

## ONGLET 6 — AFFECTATIONS CLASSES, SÉRIES & GROUPES

Cet onglet est stratégique. Une inscription validée dit que l’élève appartient à l’année scolaire. Mais l’affectation dit **où il étudie concrètement** : classe, série, groupe, parcours bilingue.

La règle est nette :

```txt
Inscrit ≠ Affecté.
Un élève inscrit sans classe reste administrativement présent,
mais pédagogiquement inexploitable.
```

Sans affectation correcte, les présences, notes, bulletins, emplois du temps et exports EDUCMASTER deviennent bancals. Et un système scolaire bancal, c’est rarement une bonne publicité.

---

# 1. Objectif de l’onglet

L’onglet **Affectations Classes, Séries & Groupes** gère l’affectation opérationnelle des élèves inscrits dans les structures pédagogiques de l’année scolaire.

Il permet de :

```txt
affecter un élève à une classe
affecter un élève du Secondaire à une série
gérer les groupes pédagogiques
gérer les parcours bilingues
contrôler les capacités de classe
suivre les changements de classe
suivre les changements de série
préparer les données pour les emplois du temps, présences, notes, bulletins et EDUCMASTER
détecter les incohérences avec ORION
historiser toutes les affectations
```

---

# 2. Positionnement dans le module

## Route frontend

```txt
/students/assignments
```

## Module parent

```txt
Élèves & Scolarité
```

## Dépendances directes

```txt
Inscriptions & Réinscriptions
Dossiers élèves
Structure académique
Examens, Notes & Bulletins
Présence & Discipline
Emploi du temps
Finance & Scolarité
EDUCMASTER
ORION Élèves
Audit
```

---

# 3. Principe général

Une inscription validée ne suffit pas toujours à rendre l’élève exploitable pédagogiquement.

L’élève doit être affecté à :

```txt
une année scolaire
un niveau
une classe
une série si nécessaire
un groupe pédagogique si applicable
un parcours bilingue si applicable
```

## Règle métier majeure

```txt
Un élève inscrit mais non affecté à une classe ne doit pas être exploitable dans les présences, notes, bulletins, emplois du temps et exports EDUCMASTER.
```

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit contenir :

```txt
1. Vue d’ensemble des affectations
2. Liste des élèves affectés
3. Liste des élèves non affectés
4. Affectation individuelle
5. Affectation massive
6. Gestion des classes
7. Gestion des séries
8. Gestion des groupes pédagogiques
9. Gestion du parcours bilingue
10. Changements de classe
11. Changements de série
12. Contrôle de capacité
13. Préparation EDUCMASTER
14. Alertes ORION
15. Exports
16. Audit
```

---

# 5. Frontend

## 5.1 Route

```txt
/students/assignments
```

## 5.2 Page principale

```txt
app/(school)/students/assignments/page.tsx
```

## 5.3 Composants recommandés

```txt
components/students/assignments/StudentAssignmentsPage.tsx
components/students/assignments/StudentAssignmentsHeader.tsx
components/students/assignments/AssignmentsOverviewCards.tsx
components/students/assignments/AssignedStudentsTable.tsx
components/students/assignments/UnassignedStudentsTable.tsx
components/students/assignments/StudentAssignmentDrawer.tsx
components/students/assignments/BulkAssignmentWizard.tsx
components/students/assignments/ClassCapacityPanel.tsx
components/students/assignments/SeriesAssignmentPanel.tsx
components/students/assignments/PedagogicalGroupsPanel.tsx
components/students/assignments/BilingualPathAssignmentPanel.tsx
components/students/assignments/ClassChangeWizard.tsx
components/students/assignments/SeriesChangeWizard.tsx
components/students/assignments/EducmasterPreparationPanel.tsx
components/students/assignments/AssignmentOrionAlertsPanel.tsx
components/students/assignments/AssignmentExportButton.tsx
components/students/assignments/AssignmentAuditTimeline.tsx
```

---

# 6. Vue d’ensemble

Cartes statistiques :

```txt
élèves inscrits
élèves affectés
élèves non affectés
classes pleines
classes surchargées
élèves secondaires sans série
élèves sans groupe pédagogique
élèves bilingues affectés
changements récents
anomalies ORION
```

---

# 7. Liste des élèves affectés

Colonnes :

```txt
matricule
nom
prénoms
niveau
classe
série
groupe
parcours bilingue
statut inscription
date affectation
affecté par
alertes
actions
```

## Filtres

```txt
année scolaire
niveau
classe
série
groupe
parcours bilingue
statut
nouvel élève
ancien élève
redoublant
affectation récente
```

---

# 8. Liste des élèves non affectés

La liste doit afficher tous les élèves ayant une inscription validée mais sans classe active.

Colonnes :

```txt
matricule
nom
prénoms
niveau demandé
classe proposée
série attendue
statut inscription
motif blocage
action recommandée
```

## Actions

```txt
affecter individuellement
affecter en lot
corriger niveau
corriger série
ouvrir dossier élève
ouvrir alerte ORION
```

---

# 9. Affectation individuelle

Le système doit permettre :

```txt
choisir l’élève
sélectionner l’année scolaire
sélectionner le niveau
sélectionner la classe
sélectionner la série si nécessaire
sélectionner le groupe pédagogique
définir le parcours bilingue
vérifier la capacité
vérifier les prérequis
valider l’affectation
historiser l’opération
```

---

# 10. Affectation massive

L’assistant d’affectation massive doit permettre :

```txt
filtrer les élèves non affectés
sélectionner une cohorte
appliquer une classe cible
appliquer une série
appliquer un groupe
appliquer un parcours bilingue
prévisualiser les résultats
détecter les conflits
exclure les cas bloqués
valider en lot
générer un rapport
```

Règle stricte :

```txt
Aucune affectation massive ne doit être validée sans prévisualisation.
```

C’est le genre de bouton qui doit être traité comme un cockpit d’avion : on vérifie avant de décoller.

---

# 11. Classes

Le système doit afficher :

```txt
classe
niveau
capacité maximale
effectif actuel
places restantes
responsable de classe si défini
statut
surcharge
actions
```

## Contrôles

```txt
capacité dépassée
niveau incompatible
classe inactive
année scolaire incorrecte
```

---

# 12. Séries

Au Secondaire, la série doit être gérée avec rigueur.

Le système doit permettre :

```txt
affecter une série à un élève
changer une série
filtrer par série
détecter les élèves sans série
contrôler la cohérence série/niveau/classe
gérer les séries personnalisées par école
```

## Séries par défaut

```txt
A
B
C
D
G
séries personnalisées
```

---

# 13. Groupes pédagogiques

Les groupes pédagogiques peuvent servir à :

```txt
travaux dirigés
groupes de langue
groupes de niveau
groupes bilingues
groupes d’options
groupes temporaires
groupes de soutien
groupes d’examen
```

Chaque groupe doit contenir :

```txt
nom
type
classe liée
matière liée si applicable
enseignant référent si applicable
capacité
élèves
période active
statut
```

---

# 14. Parcours bilingue

Le système bilingue d’Academia Helm ne doit pas être réduit à une simple traduction d’interface.

Il doit permettre de gérer des élèves suivant plusieurs matières en anglais, comme pour le français.

Le système doit permettre :

```txt
marquer un élève comme bilingue
affecter un parcours bilingue
lier les matières anglaises
filtrer les élèves bilingues
préparer les bulletins bilingues
préparer les exports adaptés
transmettre l’information aux enseignants concernés
```

---

# 15. Changements de classe

Le système doit permettre :

```txt
changer un élève de classe
indiquer le motif
définir la date d’effet
conserver l’ancienne affectation
notifier les modules liés
recalculer les accès si nécessaire
historiser l’action
```

## Motifs possibles

```txt
rééquilibrage effectif
erreur administrative
changement pédagogique
demande parent
discipline
santé
autre
```

---

# 16. Changements de série

Le changement de série doit être strictement contrôlé.

Le système doit permettre :

```txt
ancienne série
nouvelle série
motif
date d’effet
validation par rôle autorisé
impact sur matières
impact sur notes
impact sur bulletins
impact sur EDUCMASTER
historique
```

---

# 17. Préparation EDUCMASTER

L’onglet doit préparer les données nécessaires à la génération des classes au format Excel exportable vers EDUCMASTER.

## Contrôles avant export

```txt
élève avec matricule
élève avec nom/prénoms
élève avec niveau
élève avec classe
élève secondaire avec série si applicable
classe conforme
doublon absent
données obligatoires complètes
statut inscription validé
affectation active
```

---

# 18. ORION Affectations

ORION doit détecter :

```txt
élève inscrit sans classe
élève affecté à une classe inactive
élève affecté à une classe d’un autre niveau
élève secondaire sans série
série incompatible avec classe
classe surchargée
groupe pédagogique vide
élève bilingue sans parcours bilingue
élève dans plusieurs classes actives
changement de classe non historisé
données EDUCMASTER incomplètes
conflit entre inscription et affectation
```

Exemple :

```txt
ORION Affectations — Élève inscrit sans classe

L’élève possède une inscription validée pour l’année scolaire active,
mais aucune affectation classe n’est définie.
Impact possible : présence, notes, bulletins et export EDUCMASTER bloqués.
Action recommandée : affecter l’élève à une classe.
```

---

# 19. Base de données — StudentClassAssignment

```prisma
model StudentClassAssignment {
  id              String @id @default(cuid())
  tenantId        String

  studentId       String
  enrollmentId    String
  academicYearId  String

  levelId         String
  classId         String
  seriesId        String?
  groupId         String?

  isBilingual     Boolean @default(false)
  bilingualPathId String?

  status          AssignmentStatus @default(ACTIVE)

  startsAt        DateTime?
  endsAt          DateTime?

  assignedById    String?
  assignmentReason String?

  endedById       String?
  endReason       String?

  metadata        Json?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId, academicYearId])
  @@index([studentId])
  @@index([enrollmentId])
  @@index([levelId, classId, seriesId])
  @@index([status])
}
```

---

# 20. Base de données — PedagogicalGroup

```prisma
model PedagogicalGroup {
  id              String @id @default(cuid())
  tenantId        String
  academicYearId  String

  name            String
  type            PedagogicalGroupType
  levelId         String?
  classId         String?
  subjectId       String?
  teacherId       String?

  capacity        Int?
  status          PedagogicalGroupStatus @default(ACTIVE)

  startsAt        DateTime?
  endsAt          DateTime?

  metadata        Json?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId, academicYearId])
  @@index([classId])
  @@index([subjectId])
  @@index([teacherId])
  @@index([status])
}
```

---

# 21. Base de données — PedagogicalGroupMember

```prisma
model PedagogicalGroupMember {
  id              String @id @default(cuid())
  tenantId        String

  groupId         String
  studentId       String
  assignmentId    String?

  status          GroupMemberStatus @default(ACTIVE)

  joinedAt        DateTime?
  leftAt          DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([tenantId, groupId, studentId])
  @@index([tenantId])
  @@index([groupId])
  @@index([studentId])
  @@index([status])
}
```

---

# 22. Enums

```prisma
enum AssignmentStatus {
  ACTIVE
  ENDED
  CANCELLED
  TRANSFERRED
}

enum PedagogicalGroupType {
  LANGUAGE
  LEVEL
  SUPPORT
  OPTION
  BILINGUAL
  EXAM
  TEMPORARY
  OTHER
}

enum PedagogicalGroupStatus {
  ACTIVE
  INACTIVE
  CLOSED
  ARCHIVED
}

enum GroupMemberStatus {
  ACTIVE
  LEFT
  REMOVED
}
```

---

# 23. Backend — Routes API

```http
GET    /api/students/assignments
GET    /api/students/assignments/unassigned
GET    /api/students/assignments/:assignmentId
POST   /api/students/assignments
PATCH  /api/students/assignments/:assignmentId
POST   /api/students/assignments/:assignmentId/end

POST   /api/students/assignments/bulk
POST   /api/students/assignments/change-class
POST   /api/students/assignments/change-series

GET    /api/students/assignments/classes/capacity
GET    /api/students/assignments/orion-alerts

GET    /api/students/pedagogical-groups
POST   /api/students/pedagogical-groups
GET    /api/students/pedagogical-groups/:groupId
PATCH  /api/students/pedagogical-groups/:groupId
POST   /api/students/pedagogical-groups/:groupId/archive

POST   /api/students/pedagogical-groups/:groupId/members
POST   /api/students/pedagogical-groups/:groupId/members/bulk
POST   /api/students/pedagogical-groups/:groupId/members/:memberId/remove

POST   /api/students/assignments/educmaster/validate
POST   /api/students/assignments/export
```

---

# 24. Backend — Services

Services recommandés :

```txt
StudentAssignmentService
UnassignedStudentService
BulkAssignmentService
ClassCapacityService
SeriesAssignmentService
ClassChangeService
SeriesChangeService
PedagogicalGroupService
PedagogicalGroupMemberService
BilingualPathAssignmentService
EducmasterAssignmentValidationService
AssignmentOrionService
AssignmentExportService
AssignmentAuditService
```

---

# 25. Sécurité

## Permissions

```ts
STUDENTS_ASSIGNMENTS_VIEW
STUDENTS_ASSIGNMENTS_CREATE
STUDENTS_ASSIGNMENTS_UPDATE
STUDENTS_ASSIGNMENTS_BULK
STUDENTS_ASSIGNMENTS_CHANGE_CLASS
STUDENTS_ASSIGNMENTS_CHANGE_SERIES
STUDENTS_GROUPS_MANAGE
STUDENTS_ASSIGNMENTS_EXPORT
STUDENTS_ASSIGNMENTS_AUDIT_VIEW
```

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
affectation impossible sans inscription validée
une seule affectation classe active par élève et par année
série obligatoire au Secondaire selon règle école
contrôle de capacité selon paramétrage
changement de série réservé aux rôles autorisés
aucune suppression destructive
audit complet
```

---

# 26. Audit

Auditer :

```txt
affectation individuelle
affectation massive
changement de classe
changement de série
fin d’affectation
création groupe
modification groupe
ajout membre groupe
retrait membre groupe
validation EDUCMASTER
export
```

---

# 27. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 6 — Affectations Classes, Séries & Groupes** du  **Module 1 — Élèves & Scolarité** .

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
inscription validée obligatoire avant affectation
une affectation classe active par élève et par année
compatibilité Maternelle 1, Maternelle 2, Primaire, Secondaire
compatibilité séries au Secondaire
gestion groupes pédagogiques
gestion parcours bilingue
contrôle capacité
préparation EDUCMASTER
ORION Affectations
audit complet
aucune suppression destructive
```

## À créer côté frontend

```txt
Page /students/assignments
StudentAssignmentsPage
StudentAssignmentsHeader
AssignmentsOverviewCards
AssignedStudentsTable
UnassignedStudentsTable
StudentAssignmentDrawer
BulkAssignmentWizard
ClassCapacityPanel
SeriesAssignmentPanel
PedagogicalGroupsPanel
BilingualPathAssignmentPanel
ClassChangeWizard
SeriesChangeWizard
EducmasterPreparationPanel
AssignmentOrionAlertsPanel
AssignmentExportButton
AssignmentAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Affectation individuelle
Affectation massive
Changement de classe
Changement de série
Gestion groupes pédagogiques
Gestion parcours bilingue
Contrôle capacité
Validation EDUCMASTER
ORION Affectations
Audit complet
Export
```

## À créer côté BDD

```txt
StudentClassAssignment
PedagogicalGroup
PedagogicalGroupMember
Enums AssignmentStatus, PedagogicalGroupType, PedagogicalGroupStatus, GroupMemberStatus
Relations avec Student, Enrollment, AcademicYear, Level, Class, Series, Subject, Teacher, User
```

---

# 28. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
affecter les élèves aux classes
affecter les élèves du Secondaire aux séries
gérer les groupes pédagogiques
gérer les parcours bilingues
faire des affectations massives sécurisées
changer un élève de classe
changer un élève de série
contrôler les capacités
préparer les données EDUCMASTER
détecter les anomalies avec ORION
auditer toutes les opérations
exporter les affectations
```

---

# Conclusion

L’onglet **Affectations Classes, Séries & Groupes** est le pont entre l’administration et la pédagogie.

La règle d’or :

```txt
Un élève inscrit devient pédagogiquement exploitable uniquement après une affectation correcte.
```

Avec cet onglet, Academia Helm garantit que les élèves sont correctement positionnés dans les classes, séries, groupes et parcours bilingues avant d’alimenter les présences, notes, bulletins, emplois du temps et exports EDUCMASTER.

La suite logique sera :

```txt
Onglet 7 — Mouvements scolaires
```

C’est là qu’on va gérer les transferts, sorties, abandons, réintégrations, suspensions, changements de statut et historique administratif de mobilité scolaire.

---

Très bien. On attaque maintenant l’onglet qui gère les **événements de mobilité scolaire** : transferts, sorties, abandons, suspensions, exclusions, réintégrations et changements de statut.

# MODULE 1 — ÉLÈVES & SCOLARITÉ

## ONGLET 7 — MOUVEMENTS SCOLAIRES

Cet onglet est indispensable pour éviter les élèves “présents partout mais officiellement partis”, ou “sortis financièrement mais encore actifs pédagogiquement”. C’est ici qu’on aligne l’administration, la pédagogie, la finance et le portail parent.

La règle est simple :

```txt
Tout mouvement scolaire doit être typé, daté, motivé, validé si nécessaire,
appliqué aux modules concernés et historisé.
```

---

# 1. Objectif de l’onglet

L’onglet **Mouvements scolaires** gère tous les changements majeurs du statut scolaire et administratif d’un élève au cours de son parcours dans l’établissement.

Il permet de suivre :

```txt
les transferts sortants
les transferts entrants
les sorties définitives
les abandons
les suspensions
les exclusions
les réintégrations
les changements de statut
les changements d’établissement
les fins de scolarité
les historiques de mobilité
```

Cet onglet garantit une traçabilité complète du parcours scolaire hors affectation simple de classe ou de série.

---

# 2. Positionnement dans le module

## Route frontend

```txt
/students/movements
```

## Module parent

```txt
Élèves & Scolarité
```

## Dépendances directes

```txt
Dossiers élèves
Inscriptions & Réinscriptions
Affectations Classes, Séries & Groupes
Documents & conformité
Finance & Scolarité
Examens, Notes & Bulletins
Présence & Discipline
Communication
Portail Parent/Élève
ORION Élèves
Audit
```

---

# 3. Principe général

Un mouvement scolaire est un **événement structurant** qui modifie la situation officielle d’un élève.

Il ne doit pas être confondu avec :

```txt
une simple affectation de classe
un changement de groupe pédagogique
une modification de fiche
une correction administrative mineure
```

Un mouvement scolaire doit être :

```txt
typé
daté
motivé
validé si nécessaire
historisé
auditable
répercuté sur les modules concernés
```

---

# 4. Types de mouvements

Types recommandés :

```txt
transfert entrant
transfert sortant
sortie définitive
abandon
suspension
exclusion
réintégration
changement de statut
fin de cycle
fin de scolarité
décès
autre
```

Note importante :

```txt
Le type décès doit exister pour conformité administrative,
mais son accès doit être strictement contrôlé et traité avec sobriété dans l’interface.
```

---

# 5. Structure fonctionnelle de l’onglet

L’onglet doit contenir :

```txt
1. Vue d’ensemble des mouvements
2. Liste des mouvements
3. Création d’un mouvement
4. Fiche mouvement
5. Workflow de validation
6. Transferts sortants
7. Transferts entrants
8. Sorties/abandons
9. Suspensions/exclusions
10. Réintégrations
11. Impacts sur inscription et affectation
12. Impacts finance
13. Documents liés
14. Notifications
15. Alertes ORION
16. Exports
17. Audit
```

---

# 6. Frontend

## 6.1 Route

```txt
/students/movements
```

## 6.2 Page principale

```txt
app/(school)/students/movements/page.tsx
```

## 6.3 Composants recommandés

```txt
components/students/movements/StudentMovementsPage.tsx
components/students/movements/StudentMovementsHeader.tsx
components/students/movements/StudentMovementsOverviewCards.tsx
components/students/movements/StudentMovementsTable.tsx
components/students/movements/StudentMovementCreateDrawer.tsx
components/students/movements/StudentMovementRecordDrawer.tsx
components/students/movements/StudentMovementTypeBadge.tsx
components/students/movements/StudentMovementStatusBadge.tsx
components/students/movements/StudentMovementValidationPanel.tsx
components/students/movements/StudentTransferOutPanel.tsx
components/students/movements/StudentTransferInPanel.tsx
components/students/movements/StudentExitPanel.tsx
components/students/movements/StudentSuspensionPanel.tsx
components/students/movements/StudentReintegrationPanel.tsx
components/students/movements/StudentMovementImpactPanel.tsx
components/students/movements/StudentMovementDocumentsPanel.tsx
components/students/movements/StudentMovementNotificationPanel.tsx
components/students/movements/StudentMovementOrionAlertsPanel.tsx
components/students/movements/StudentMovementExportButton.tsx
components/students/movements/StudentMovementAuditTimeline.tsx
```

---

# 7. Vue d’ensemble

Cartes statistiques :

```txt
mouvements du mois
transferts sortants
transferts entrants
sorties définitives
abandons
suspensions actives
exclusions
réintégrations
mouvements en attente
anomalies ORION
```

---

# 8. Liste des mouvements

Colonnes :

```txt
date
élève
matricule
classe
type de mouvement
statut
date d’effet
motif
validateur
documents
impact finance
alertes
actions
```

## Filtres

```txt
année scolaire
période
type
statut
niveau
classe
série
élève
validateur
mouvement avec document
mouvement avec impact finance
mouvement en attente
```

---

# 9. Création d’un mouvement

Champs :

```txt
élève
type de mouvement
année scolaire
date de demande
date d’effet
motif
commentaire
établissement d’origine si transfert entrant
établissement de destination si transfert sortant
documents liés
impact attendu
notification parent
validation requise
```

---

# 10. Statuts d’un mouvement

Statuts recommandés :

```txt
brouillon
soumis
en étude
validé
rejeté
annulé
appliqué
archivé
```

Version technique :

```ts
DRAFT
SUBMITTED
UNDER_REVIEW
APPROVED
REJECTED
CANCELLED
APPLIED
ARCHIVED
```

---

# 11. Workflow de validation

Workflow recommandé :

```txt
1. Création du mouvement
2. Soumission
3. Contrôle administratif
4. Contrôle financier si nécessaire
5. Validation direction
6. Application automatique ou manuelle
7. Notification
8. Archivage
```

Certains mouvements peuvent être configurés pour validation obligatoire :

```txt
transfert sortant
sortie définitive
suspension
exclusion
réintégration
changement de statut sensible
```

---

# 12. Transfert sortant

Le transfert sortant doit permettre :

```txt
sélectionner l’élève
préciser l’établissement de destination
indiquer le motif
joindre les documents
clôturer ou suspendre l’inscription
mettre fin à l’affectation active
gérer les frais restants
générer une attestation/certificat si activé
notifier les responsables
historiser l’action
```

---

# 13. Transfert entrant

Le transfert entrant doit permettre :

```txt
créer ou lier un dossier élève
renseigner l’établissement d’origine
joindre les documents
créer une inscription
affecter une classe
affecter une série si nécessaire
initialiser les frais
déclencher ORION pour vérification
historiser l’action
```

---

# 14. Sorties et abandons

Le système doit permettre :

```txt
déclarer une sortie définitive
déclarer un abandon
préciser la date d’effet
préciser le motif
clôturer l’inscription
mettre fin aux affectations
gérer l’impact finance
désactiver certains accès portail
conserver l’historique
```

---

# 15. Suspensions et exclusions

Le système doit permettre :

```txt
suspendre temporairement un élève
exclure un élève
préciser la période
préciser le motif
définir les restrictions
gérer l’accès portail
bloquer les présences/notes si nécessaire
notifier les responsables
réactiver ou clôturer selon décision
```

Règle de confidentialité :

```txt
Les motifs sensibles doivent être visibles uniquement selon permissions.
```

---

# 16. Réintégrations

Le système doit permettre :

```txt
réintégrer un élève sorti, suspendu ou transféré
créer une nouvelle inscription si nécessaire
réactiver une inscription existante si autorisé
affecter une classe
mettre à jour le statut
réactiver les accès
historiser l’opération
```

---

# 17. Impacts sur inscription et affectation

Lorsqu’un mouvement est appliqué, le système doit mettre à jour :

```txt
statut élève
statut administratif
inscription annuelle
affectation classe
groupe pédagogique
accès portail
disponibilité dans les notes
disponibilité dans les présences
disponibilité dans les bulletins
```

Exemple :

```txt
Un transfert sortant validé doit mettre fin à l’affectation active
et passer l’inscription en statut transférée.
```

---

# 18. Impacts finance

Selon le type de mouvement, le système doit :

```txt
conserver les frais dus
annuler certains frais futurs
recalculer les échéances
générer un solde de sortie
bloquer une sortie si dette non traitée selon règle école
produire un état financier de départ
notifier le responsable financier
```

Cette logique doit être configurable par école.

---

# 19. Documents liés

Documents possibles :

```txt
demande de transfert
certificat de scolarité
attestation de sortie
bulletin
reçu/solde financier
lettre de suspension
décision d’exclusion
document de réintégration
justificatif parent
autres documents configurés
```

---

# 20. Notifications

Notifications possibles :

```txt
responsable principal
responsable financier
responsable académique
direction
secrétariat
comptabilité
enseignant principal
portail parent
```

## Canaux

```txt
portail
email
SMS
WhatsApp si activé
```

---

# 21. ORION Mouvements scolaires

ORION doit détecter :

```txt
élève transféré mais encore affecté à une classe active
élève sorti mais encore facturé
élève suspendu encore présent dans les présences
mouvement sans date d’effet
mouvement sans motif
mouvement sensible sans validation
transfert sortant sans document
réintégration sans nouvelle inscription
conflit entre statut élève et inscription
accès portail encore actif après sortie
dette non traitée avant sortie si règle active
abandon non confirmé
```

Exemple :

```txt
ORION Mouvements — Élève transféré encore actif

L’élève est marqué comme transféré,
mais possède encore une affectation classe active.
Impact possible : présence, notes, bulletins et facturation incohérents.
Action recommandée : appliquer complètement le mouvement de transfert.
```

---

# 22. Base de données — StudentMovement

```prisma
model StudentMovement {
  id              String @id @default(cuid())
  tenantId        String

  studentId       String
  enrollmentId    String?
  academicYearId  String?

  type            StudentMovementType
  status          StudentMovementStatus @default(DRAFT)

  requestedAt     DateTime?
  effectiveAt     DateTime?

  reason          String?
  comment         String?

  originSchool    String?
  destinationSchool String?

  requiresValidation Boolean @default(false)

  submittedById   String?
  submittedAt     DateTime?

  reviewedById    String?
  reviewedAt      DateTime?

  approvedById    String?
  approvedAt      DateTime?

  rejectedById    String?
  rejectedAt      DateTime?
  rejectionReason String?

  appliedById     String?
  appliedAt       DateTime?

  financeImpact   Json?
  academicImpact  Json?
  portalImpact    Json?

  metadata        Json?

  createdById     String?
  updatedById     String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId, academicYearId])
  @@index([studentId])
  @@index([enrollmentId])
  @@index([type])
  @@index([status])
  @@index([effectiveAt])
}
```

---

# 23. Base de données — StudentMovementDocument

```prisma
model StudentMovementDocument {
  id              String @id @default(cuid())
  tenantId        String

  movementId      String
  documentType    String

  fileName        String?
  fileUrl         String?

  status          DocumentStatus @default(SUBMITTED)

  validatedById   String?
  validatedAt     DateTime?
  comment         String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
  @@index([movementId])
  @@index([documentType])
  @@index([status])
}
```

---

# 24. Enums

```prisma
enum StudentMovementType {
  TRANSFER_IN
  TRANSFER_OUT
  FINAL_EXIT
  DROPOUT
  SUSPENSION
  EXPULSION
  REINTEGRATION
  STATUS_CHANGE
  END_OF_CYCLE
  END_OF_SCHOOLING
  DECEASED
  OTHER
}

enum StudentMovementStatus {
  DRAFT
  SUBMITTED
  UNDER_REVIEW
  APPROVED
  REJECTED
  CANCELLED
  APPLIED
  ARCHIVED
}
```

---

# 25. Backend — Routes API

```http
GET    /api/students/movements
GET    /api/students/movements/:movementId
POST   /api/students/movements
PATCH  /api/students/movements/:movementId

POST   /api/students/movements/:movementId/submit
POST   /api/students/movements/:movementId/review
POST   /api/students/movements/:movementId/approve
POST   /api/students/movements/:movementId/reject
POST   /api/students/movements/:movementId/cancel
POST   /api/students/movements/:movementId/apply
POST   /api/students/movements/:movementId/archive

GET    /api/students/:studentId/movements

GET    /api/students/movements/:movementId/documents
POST   /api/students/movements/:movementId/documents
PATCH  /api/students/movements/documents/:documentId
POST   /api/students/movements/documents/:documentId/validate
POST   /api/students/movements/documents/:documentId/reject

GET    /api/students/movements/orion-alerts
POST   /api/students/movements/export
```

---

# 26. Backend — Services

Services recommandés :

```txt
StudentMovementService
StudentTransferInService
StudentTransferOutService
StudentExitService
StudentDropoutService
StudentSuspensionService
StudentExpulsionService
StudentReintegrationService
StudentMovementValidationService
StudentMovementApplicationService
StudentMovementFinanceImpactService
StudentMovementAcademicImpactService
StudentMovementDocumentService
StudentMovementNotificationService
StudentMovementOrionService
StudentMovementExportService
StudentMovementAuditService
```

---

# 27. Sécurité

## Permissions

```ts
STUDENTS_MOVEMENTS_VIEW
STUDENTS_MOVEMENTS_CREATE
STUDENTS_MOVEMENTS_UPDATE
STUDENTS_MOVEMENTS_SUBMIT
STUDENTS_MOVEMENTS_REVIEW
STUDENTS_MOVEMENTS_APPROVE
STUDENTS_MOVEMENTS_APPLY
STUDENTS_MOVEMENTS_CANCEL
STUDENTS_MOVEMENTS_DOCUMENTS_MANAGE
STUDENTS_MOVEMENTS_EXPORT
STUDENTS_MOVEMENTS_AUDIT_VIEW
STUDENTS_MOVEMENTS_SENSITIVE_VIEW
```

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
mouvements sensibles protégés
validation obligatoire selon paramétrage
application impossible si mouvement non approuvé
aucune suppression destructive
audit complet
impact finance contrôlé
impact académique contrôlé
```

---

# 28. Audit

Auditer :

```txt
création mouvement
modification mouvement
soumission
revue
validation
rejet
annulation
application
archivage
ajout document
validation document
notification
impact finance
impact académique
export
```

---

# 29. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 7 — Mouvements scolaires** du  **Module 1 — Élèves & Scolarité** .

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
mouvements typés, datés, motivés et historisés
workflow de validation configurable
impact automatique sur inscription, affectation, finance et portail
documents liés
notifications
ORION Mouvements scolaires
audit complet
aucune suppression destructive
```

## À créer côté frontend

```txt
Page /students/movements
StudentMovementsPage
StudentMovementsHeader
StudentMovementsOverviewCards
StudentMovementsTable
StudentMovementCreateDrawer
StudentMovementRecordDrawer
StudentMovementTypeBadge
StudentMovementStatusBadge
StudentMovementValidationPanel
StudentTransferOutPanel
StudentTransferInPanel
StudentExitPanel
StudentSuspensionPanel
StudentReintegrationPanel
StudentMovementImpactPanel
StudentMovementDocumentsPanel
StudentMovementNotificationPanel
StudentMovementOrionAlertsPanel
StudentMovementExportButton
StudentMovementAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Workflow mouvement
Transfert entrant
Transfert sortant
Sortie définitive
Abandon
Suspension
Exclusion
Réintégration
Application des impacts
Documents liés
Notifications
ORION Mouvements scolaires
Audit complet
Export
```

## À créer côté BDD

```txt
StudentMovement
StudentMovementDocument
Enums StudentMovementType, StudentMovementStatus
Relations avec Student, Enrollment, AcademicYear, User, Documents, Finance, PortalAccess
```

---

# 30. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
créer un mouvement scolaire
soumettre un mouvement
valider ou rejeter un mouvement
appliquer un mouvement
gérer les transferts entrants
gérer les transferts sortants
gérer les sorties définitives
gérer les abandons
gérer les suspensions
gérer les exclusions
gérer les réintégrations
mesurer les impacts finance/académique/portail
joindre des documents
notifier les parties concernées
détecter les incohérences avec ORION
auditer tout le processus
exporter les mouvements
```

---

# Conclusion

L’onglet **Mouvements scolaires** assure la cohérence du cycle de vie administratif de l’élève.

La règle d’or :

```txt
Un mouvement scolaire n’est complet que lorsqu’il est appliqué aux inscriptions,
aux affectations, à la finance, au portail et à l’historique.
```

Avec cet onglet, Academia Helm évite les élèves transférés encore actifs, les élèves sortis encore facturés, les suspensions non répercutées et les réintégrations mal tracées.

La suite logique sera :

```txt
Onglet 8 — Documents, pièces & conformité dossier
```

C’est là qu’on va gérer les pièces obligatoires, les documents élèves, les validations, les expirations, les relances, la conformité administrative et les exports documentaires.

---

Très bien. On passe à l’onglet qui sécurise la  **conformité administrative du dossier élève** .

# MODULE 1 — ÉLÈVES & SCOLARITÉ

## ONGLET 8 — DOCUMENTS, PIÈCES & CONFORMITÉ DOSSIER

Cet onglet est critique. Il ne s’agit pas simplement de stocker des fichiers PDF. Il s’agit de savoir si un élève possède un dossier conforme, complet, validé, exploitable et juridiquement propre.

La règle est simple :

```txt
Un document déposé n’est pas forcément un document valide.
Un dossier rempli n’est pas forcément un dossier conforme.
```

---

# 1. Objectif de l’onglet

L’onglet **Documents, Pièces & Conformité Dossier** centralise la gestion documentaire des élèves et garantit que chaque dossier scolaire respecte les exigences administratives de l’établissement.

Il permet de :

```txt
définir les pièces obligatoires par niveau, cycle, statut ou type d’inscription
collecter les documents des élèves
valider ou rejeter les documents
suivre les documents manquants
suivre les documents expirés
relancer les responsables
gérer les versions de documents
sécuriser l’accès aux pièces sensibles
produire un état de conformité du dossier
alimenter ORION pour les anomalies documentaires
```

---

# 2. Positionnement dans le module

## Route frontend

```txt
/students/documents-compliance
```

## Module parent

```txt
Élèves & Scolarité
```

## Dépendances directes

```txt
Admissions
Inscriptions & Réinscriptions
Dossiers élèves
Responsables légaux & Familles
Mouvements scolaires
Finance & Scolarité
Communication
Portail Parent/Élève
Paramètres
ORION Élèves
Audit
```

---

# 3. Principe général

Un dossier élève n’est pas seulement une fiche administrative. C’est un ensemble de pièces justificatives qui prouvent :

```txt
l’identité
la scolarité
les autorisations
la situation familiale
la conformité administrative
la validité du parcours scolaire
```

Le système doit gérer :

```txt
les exigences documentaires
les documents réellement fournis
leur statut de validation
leur date d’expiration
leur version
leur visibilité
leur traçabilité
```

## Règle métier

```txt
Un élève peut être inscrit même si son dossier est incomplet, si l’école l’autorise.
Mais le système doit clairement signaler les pièces manquantes, les risques et les échéances.
```

Autrement dit : Academia Helm ne bloque pas bêtement, il informe intelligemment.

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit contenir :

```txt
1. Vue d’ensemble conformité
2. Liste des dossiers documentaires élèves
3. Documents manquants
4. Documents expirés
5. Documents en attente de validation
6. Fiche documentaire élève
7. Dépôt de document
8. Validation/rejet
9. Gestion des pièces obligatoires
10. Versions de documents
11. Documents sensibles
12. Relances responsables
13. Exports
14. Alertes ORION
15. Audit
```

---

# 5. Frontend

## 5.1 Route

```txt
/students/documents-compliance
```

## 5.2 Page principale

```txt
app/(school)/students/documents-compliance/page.tsx
```

## 5.3 Composants recommandés

```txt
components/students/documents/StudentDocumentsCompliancePage.tsx
components/students/documents/StudentDocumentsComplianceHeader.tsx
components/students/documents/DocumentsComplianceOverviewCards.tsx
components/students/documents/StudentDocumentFoldersTable.tsx
components/students/documents/MissingDocumentsTable.tsx
components/students/documents/ExpiredDocumentsTable.tsx
components/students/documents/PendingValidationDocumentsTable.tsx
components/students/documents/StudentDocumentFolderDrawer.tsx
components/students/documents/StudentDocumentUploadDrawer.tsx
components/students/documents/StudentDocumentValidationPanel.tsx
components/students/documents/RequiredDocumentsRulesPanel.tsx
components/students/documents/DocumentVersionHistoryPanel.tsx
components/students/documents/SensitiveDocumentsAccessPanel.tsx
components/students/documents/DocumentReminderPanel.tsx
components/students/documents/DocumentOrionAlertsPanel.tsx
components/students/documents/DocumentExportButton.tsx
components/students/documents/DocumentAuditTimeline.tsx
```

---

# 6. Vue d’ensemble conformité

Cartes statistiques :

```txt
dossiers complets
dossiers incomplets
documents manquants
documents expirés
documents en attente
documents rejetés
documents sensibles
relances envoyées
conformité moyenne
alertes ORION
```

---

# 7. Liste des dossiers documentaires élèves

Colonnes :

```txt
matricule
élève
niveau
classe
statut inscription
taux de conformité
documents requis
documents fournis
documents manquants
documents expirés
documents en attente
dernière mise à jour
alertes
actions
```

## Filtres

```txt
année scolaire
niveau
classe
statut inscription
dossier complet
dossier incomplet
document manquant
document expiré
document rejeté
document sensible
conformité faible
```

---

# 8. Fiche documentaire élève

La fiche documentaire doit afficher :

```txt
identité élève
statut inscription
classe
responsables
taux de conformité
liste des pièces requises
documents fournis
documents manquants
documents expirés
documents rejetés
historique des dépôts
observations
actions rapides
```

---

# 9. Types de documents

Types recommandés :

```txt
acte de naissance
photo d’identité
certificat de scolarité
bulletin précédent
certificat de transfert
pièce d’identité élève si applicable
pièce d’identité responsable
autorisation parentale
autorisation photo/vidéo
autorisation sortie pédagogique
autorisation médicale
justificatif de domicile
attestation d’assurance
certificat médical
reçu d’inscription
décision administrative
autre
```

---

# 10. Gestion des pièces obligatoires

L’école doit pouvoir définir les pièces obligatoires selon :

```txt
niveau
cycle
classe
type d’inscription
statut élève
nouvel élève
ancien élève
transféré
boursier
régime
parcours bilingue
situation particulière
```

Exemples :

```txt
Un nouvel élève peut nécessiter :
acte de naissance, photo, bulletin précédent, pièce d’identité du responsable.

Un ancien élève peut seulement nécessiter :
mise à jour d’assurance, autorisation parentale ou document expiré.
```

---

# 11. Dépôt de document

Le dépôt doit permettre :

```txt
sélectionner l’élève
sélectionner le type de document
joindre le fichier
renseigner la date d’émission
renseigner la date d’expiration
ajouter un commentaire
marquer comme sensible si autorisé
soumettre pour validation
notifier l’administration si nécessaire
```

## Formats acceptés recommandés

```txt
PDF
JPG
PNG
DOCX si activé
```

## Contrôles techniques

```txt
taille maximale
type MIME
extension autorisée
analyse antivirus si disponible
nommage automatique
stockage sécurisé
accès par URL signée ou proxy sécurisé
```

---

# 12. Validation et rejet

Le système doit permettre :

```txt
valider un document
rejeter un document
demander une nouvelle version
ajouter un motif de rejet
ajouter une observation
notifier le responsable
historiser le validateur
historiser la date de validation
```

## Statuts recommandés

```txt
requis
manquant
soumis
en attente
validé
rejeté
expiré
remplacé
archivé
```

---

# 13. Versions de documents

Un document peut avoir plusieurs versions.

Le système doit conserver :

```txt
version actuelle
anciennes versions
date de dépôt
auteur du dépôt
validateur
motif de remplacement
statut de chaque version
```

Règle stricte :

```txt
Aucune version ne doit être supprimée définitivement.
```

---

# 14. Documents sensibles

Certains documents doivent être protégés :

```txt
documents médicaux
décisions disciplinaires
documents juridiques
documents familiaux sensibles
documents financiers
pièces d’identité
documents liés à une situation particulière
```

Ces documents doivent nécessiter une permission spécifique.

---

# 15. Relances responsables

Le système doit permettre :

```txt
relance manuelle
relance automatique
relance par type de document
relance par classe
relance par niveau
relance avant expiration
relance après rejet
historique des relances
```

## Canaux

```txt
portail parent
email
SMS
WhatsApp si activé
```

---

# 16. Conformité dossier

Le système doit calculer un taux de conformité.

Exemple :

```txt
8 documents requis
6 validés
1 en attente
1 manquant
```

## Taux de conformité strict

```txt
documents validés / documents requis
```

## Taux de conformité souple

```txt
documents validés + documents en attente / documents requis
```

L’école doit pouvoir choisir la méthode.

---

# 17. ORION Documents & Conformité

ORION doit détecter :

```txt
document obligatoire manquant
document expiré
document rejeté non remplacé
document soumis non validé depuis trop longtemps
document sensible consulté anormalement
document sans fichier
document sans type
document dupliqué
dossier incomplet malgré inscription active
pièce d’identité responsable manquante
certificat médical expiré
autorisation parentale manquante
conformité faible
règle documentaire non configurée
```

Exemple :

```txt
ORION Documents — Document obligatoire manquant

L’élève possède une inscription active, mais l’acte de naissance est manquant.
Impact possible : dossier administratif non conforme.
Action recommandée : relancer le responsable principal.
```

---

# 18. Base de données — StudentDocument

```prisma
model StudentDocument {
  id              String @id @default(cuid())
  tenantId        String

  studentId       String
  guardianId      String?
  enrollmentId    String?
  academicYearId  String?

  documentTypeId  String
  title           String?

  status          StudentDocumentStatus @default(SUBMITTED)

  isSensitive     Boolean @default(false)
  sensitivityLevel DocumentSensitivityLevel @default(NORMAL)

  issueDate       DateTime?
  expiryDate      DateTime?

  currentVersionId String?

  validationComment String?
  rejectionReason   String?

  submittedById   String?
  submittedAt     DateTime?

  validatedById   String?
  validatedAt     DateTime?

  rejectedById    String?
  rejectedAt      DateTime?

  metadata        Json?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  archivedAt      DateTime?

  @@index([tenantId, studentId])
  @@index([guardianId])
  @@index([enrollmentId])
  @@index([academicYearId])
  @@index([documentTypeId])
  @@index([status])
  @@index([expiryDate])
}
```

---

# 19. Base de données — StudentDocumentVersion

```prisma
model StudentDocumentVersion {
  id              String @id @default(cuid())
  tenantId        String

  documentId      String

  versionNumber   Int
  fileName        String
  fileUrl         String
  mimeType        String?
  fileSize        Int?

  uploadedById    String?
  uploadedAt      DateTime @default(now())

  replacementReason String?
  checksum        String?

  metadata        Json?

  createdAt       DateTime @default(now())

  @@unique([tenantId, documentId, versionNumber])
  @@index([tenantId])
  @@index([documentId])
}
```

---

# 20. Base de données — RequiredStudentDocumentRule

```prisma
model RequiredStudentDocumentRule {
  id              String @id @default(cuid())
  tenantId        String

  documentTypeId  String

  academicYearId  String?
  cycle           SchoolCycle?
  levelId         String?
  classId         String?

  enrollmentType  EnrollmentType?
  studentStatus   StudentStatus?
  isNewStudent    Boolean?
  isTransferred   Boolean?
  isScholarship   Boolean?
  isBilingual     Boolean?

  isRequired      Boolean @default(true)
  requiresExpiry  Boolean @default(false)
  requiresValidation Boolean @default(true)

  reminderBeforeDays Int?

  status          RuleStatus @default(ACTIVE)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
  @@index([documentTypeId])
  @@index([academicYearId])
  @@index([cycle])
  @@index([levelId])
  @@index([classId])
  @@index([status])
}
```

---

# 21. Base de données — DocumentReminderLog

```prisma
model DocumentReminderLog {
  id              String @id @default(cuid())
  tenantId        String

  studentId       String
  guardianId      String?
  documentId      String?
  documentTypeId  String?

  reminderType    DocumentReminderType
  channel         CommunicationChannel
  status          ReminderStatus @default(SENT)

  sentById        String?
  sentAt          DateTime @default(now())

  message         String?
  metadata        Json?

  @@index([tenantId])
  @@index([studentId])
  @@index([guardianId])
  @@index([documentTypeId])
  @@index([sentAt])
}
```

---

# 22. Enums

```prisma
enum StudentDocumentStatus {
  REQUIRED
  MISSING
  SUBMITTED
  PENDING_REVIEW
  VALIDATED
  REJECTED
  EXPIRED
  REPLACED
  ARCHIVED
}

enum DocumentSensitivityLevel {
  NORMAL
  CONFIDENTIAL
  HIGHLY_CONFIDENTIAL
}

enum RuleStatus {
  ACTIVE
  INACTIVE
  ARCHIVED
}

enum DocumentReminderType {
  MISSING_DOCUMENT
  EXPIRING_DOCUMENT
  REJECTED_DOCUMENT
  PENDING_VALIDATION
}

enum ReminderStatus {
  SENT
  FAILED
  READ
}
```

---

# 23. Backend — Routes API

```http
GET    /api/students/documents-compliance
GET    /api/students/documents-compliance/missing
GET    /api/students/documents-compliance/expired
GET    /api/students/documents-compliance/pending-validation

GET    /api/students/:studentId/documents
POST   /api/students/:studentId/documents
GET    /api/students/documents/:documentId
PATCH  /api/students/documents/:documentId
POST   /api/students/documents/:documentId/submit
POST   /api/students/documents/:documentId/validate
POST   /api/students/documents/:documentId/reject
POST   /api/students/documents/:documentId/archive

GET    /api/students/documents/:documentId/versions
POST   /api/students/documents/:documentId/versions

GET    /api/students/documents/rules
POST   /api/students/documents/rules
PATCH  /api/students/documents/rules/:ruleId
POST   /api/students/documents/rules/:ruleId/archive

POST   /api/students/documents/reminders/send
GET    /api/students/documents/reminders/logs

GET    /api/students/documents-compliance/orion-alerts
POST   /api/students/documents-compliance/export
```

---

# 24. Backend — Services

Services recommandés :

```txt
StudentDocumentComplianceService
StudentDocumentService
StudentDocumentVersionService
RequiredStudentDocumentRuleService
StudentDocumentValidationService
StudentDocumentReminderService
StudentDocumentSecurityService
StudentDocumentStorageService
StudentDocumentOrionService
StudentDocumentExportService
StudentDocumentAuditService
```

---

# 25. Sécurité

## Permissions

```ts
STUDENTS_DOCUMENTS_VIEW
STUDENTS_DOCUMENTS_UPLOAD
STUDENTS_DOCUMENTS_UPDATE
STUDENTS_DOCUMENTS_VALIDATE
STUDENTS_DOCUMENTS_REJECT
STUDENTS_DOCUMENTS_ARCHIVE
STUDENTS_DOCUMENTS_RULES_MANAGE
STUDENTS_DOCUMENTS_REMINDERS_SEND
STUDENTS_DOCUMENTS_SENSITIVE_VIEW
STUDENTS_DOCUMENTS_EXPORT
STUDENTS_DOCUMENTS_AUDIT_VIEW
```

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
accès fichiers signé ou protégé
documents sensibles protégés
validation réservée aux rôles autorisés
aucune suppression destructive
audit complet
stockage sécurisé
vérification MIME/extension/taille
```

---

# 26. Audit

Auditer :

```txt
dépôt document
consultation document sensible
téléchargement document
validation
rejet
remplacement
archivage
création règle documentaire
modification règle documentaire
relance envoyée
export
accès refusé
```

---

# 27. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 8 — Documents, Pièces & Conformité Dossier** du  **Module 1 — Élèves & Scolarité** .

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
gestion des documents requis
validation/rejet
versioning documentaire
documents sensibles protégés
relances
conformité dossier
ORION Documents & Conformité
audit complet
aucune suppression destructive
```

## À créer côté frontend

```txt
Page /students/documents-compliance
StudentDocumentsCompliancePage
StudentDocumentsComplianceHeader
DocumentsComplianceOverviewCards
StudentDocumentFoldersTable
MissingDocumentsTable
ExpiredDocumentsTable
PendingValidationDocumentsTable
StudentDocumentFolderDrawer
StudentDocumentUploadDrawer
StudentDocumentValidationPanel
RequiredDocumentsRulesPanel
DocumentVersionHistoryPanel
SensitiveDocumentsAccessPanel
DocumentReminderPanel
DocumentOrionAlertsPanel
DocumentExportButton
DocumentAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Gestion documents élèves
Gestion versions
Gestion règles documentaires
Validation/rejet
Relances
Sécurité fichiers
ORION Documents & Conformité
Audit complet
Export
```

## À créer côté BDD

```txt
StudentDocument
StudentDocumentVersion
RequiredStudentDocumentRule
DocumentReminderLog
Enums StudentDocumentStatus, DocumentSensitivityLevel, RuleStatus, DocumentReminderType, ReminderStatus
Relations avec Student, Guardian, Enrollment, AcademicYear, User, Communication
```

---

# 28. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
consulter la conformité documentaire des élèves
voir les dossiers incomplets
voir les documents manquants
voir les documents expirés
déposer des documents
valider ou rejeter des documents
gérer les versions
configurer les pièces obligatoires
protéger les documents sensibles
relancer les responsables
détecter les anomalies avec ORION
auditer toutes les actions sensibles
exporter les états documentaires
```

---

# Conclusion

L’onglet **Documents, Pièces & Conformité Dossier** transforme le stockage documentaire en véritable système de conformité scolaire.

La règle d’or :

```txt
Un dossier élève est conforme uniquement lorsque les pièces requises sont présentes,
validées, à jour, sécurisées et traçables.
```

Avec cet onglet, Academia Helm ne se contente pas d’empiler des fichiers. Il contrôle, vérifie, historise, protège et alerte.

La suite logique sera :

```txt
Onglet 9 — Exports, Importations & Synchronisations
```

C’est là qu’on va gérer les imports Excel, exports administratifs, synchronisations internes, exports EDUCMASTER, modèles de fichiers et contrôles de qualité des données.

---

Très bien. On attaque maintenant l’onglet qui va éviter à Academia Helm de devenir une forteresse isolée :  **imports, exports et synchronisations** .

# MODULE 1 — ÉLÈVES & SCOLARITÉ

## ONGLET 9 — IMPORTS, EXPORTS & SYNCHRONISATIONS

Cet onglet est le  **centre de gouvernance des données élèves** .
Il ne s’agit pas seulement d’importer un fichier Excel. Il s’agit de contrôler, nettoyer, valider, synchroniser et exporter des données fiables.

La règle est nette :

```txt
Un import massif sans prévisualisation est une prise de risque.
Un export sans contrôle qualité est une bombe administrative à retardement.
```

---

# 1. Objectif de l’onglet

L’onglet **Imports, Exports & Synchronisations** centralise toutes les opérations d’entrée, de sortie et d’échange de données liées aux élèves.

Il permet de :

```txt
importer des élèves depuis Excel/CSV
importer des responsables
importer des inscriptions
importer des affectations
exporter les listes élèves
exporter les classes
générer les fichiers compatibles EDUCMASTER
synchroniser les données entre modules internes
contrôler la qualité des données avant intégration
tracer toutes les opérations
détecter les anomalies avec ORION
```

---

# 2. Positionnement dans le module

## Route frontend

```txt
/students/data-exchange
```

## Module parent

```txt
Élèves & Scolarité
```

## Dépendances directes

```txt
Admissions
Dossiers élèves
Inscriptions & Réinscriptions
Responsables légaux & Familles
Affectations Classes, Séries & Groupes
Documents & Conformité
Finance & Scolarité
Examens, Notes & Bulletins
EDUCMASTER
ORION Élèves
Audit
```

---

# 3. Principe général

Cet onglet n’est pas un simple bouton  **“Importer Excel”** .
C’est un  **centre de gouvernance des données élèves** .

Le système doit permettre :

```txt
préparation
validation
prévisualisation
correction
import
export
synchronisation
journalisation
rollback si possible
rapport d’exécution
```

## Règle métier

```txt
Aucun import massif ne doit modifier la base sans prévisualisation,
validation des erreurs et confirmation explicite.
```

C’est le genre de sécurité qui évite de transformer 800 élèves en “Classe inconnue”. Et franchement, personne ne veut déboguer ça un lundi matin.

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit contenir :

```txt
1. Vue d’ensemble des échanges
2. Imports élèves
3. Imports responsables
4. Imports inscriptions
5. Imports affectations
6. Exports élèves
7. Exports classes
8. Export EDUCMASTER
9. Modèles de fichiers
10. Mapping des colonnes
11. Prévisualisation
12. Contrôle qualité
13. Synchronisations internes
14. Historique des opérations
15. Rapports d’import/export
16. Alertes ORION
17. Audit
```

---

# 5. Frontend

## 5.1 Route

```txt
/students/data-exchange
```

## 5.2 Page principale

```txt
app/(school)/students/data-exchange/page.tsx
```

## 5.3 Composants recommandés

```txt
components/students/data-exchange/StudentDataExchangePage.tsx
components/students/data-exchange/StudentDataExchangeHeader.tsx
components/students/data-exchange/DataExchangeOverviewCards.tsx
components/students/data-exchange/StudentImportWizard.tsx
components/students/data-exchange/GuardianImportWizard.tsx
components/students/data-exchange/EnrollmentImportWizard.tsx
components/students/data-exchange/AssignmentImportWizard.tsx
components/students/data-exchange/StudentExportPanel.tsx
components/students/data-exchange/ClassExportPanel.tsx
components/students/data-exchange/EducmasterExportPanel.tsx
components/students/data-exchange/ImportTemplatePanel.tsx
components/students/data-exchange/ColumnMappingPanel.tsx
components/students/data-exchange/ImportPreviewTable.tsx
components/students/data-exchange/DataQualityCheckPanel.tsx
components/students/data-exchange/InternalSyncPanel.tsx
components/students/data-exchange/DataExchangeHistoryTable.tsx
components/students/data-exchange/DataExchangeReportDrawer.tsx
components/students/data-exchange/DataExchangeOrionAlertsPanel.tsx
components/students/data-exchange/DataExchangeAuditTimeline.tsx
```

---

# 6. Vue d’ensemble

Cartes statistiques :

```txt
imports du mois
exports du mois
imports réussis
imports partiels
imports échoués
lignes traitées
lignes rejetées
exports EDUCMASTER générés
synchronisations internes
anomalies ORION
```

---

# 7. Imports élèves

L’import élèves doit permettre de créer ou mettre à jour des dossiers élèves.

## Champs importables

```txt
matricule
nom
prénoms
sexe
date de naissance
lieu de naissance
nationalité
adresse
niveau
classe
série
régime
parcours bilingue
ancienne école
statut
observations
```

## Modes d’import

```txt
création uniquement
mise à jour uniquement
création + mise à jour
simulation sans écriture
```

## Contrôles

```txt
matricule unique
nom obligatoire
prénom obligatoire selon règle école
date de naissance valide
niveau valide
classe valide
série obligatoire au Secondaire si règle active
doublons potentiels
format de données correct
```

---

# 8. Imports responsables

L’import responsables doit permettre :

```txt
créer des responsables
lier des responsables aux élèves
définir les rôles
définir responsable financier
définir responsable académique
définir contact d’urgence
définir accès portail parent si activé
```

## Champs importables

```txt
matricule élève
nom responsable
prénoms responsable
téléphone
email
adresse
profession
lien familial
responsable principal
responsable financier
responsable académique
contact d’urgence
autorisé à récupérer
accès portail
```

## Contrôles

```txt
élève existant
téléphone valide
email valide
lien familial renseigné
doublon responsable
rôle financier cohérent
rôle académique cohérent
```

---

# 9. Imports inscriptions

L’import inscriptions doit permettre :

```txt
créer des inscriptions annuelles
créer des réinscriptions
rattacher l’élève à l’année scolaire
définir le niveau
définir le type d’inscription
initialiser les frais si activé
préparer l’affectation
```

## Champs importables

```txt
matricule
année scolaire
type inscription
niveau
statut inscription
régime
boursier
remise
date inscription
observation
```

## Contrôles

```txt
élève existant
année scolaire active ou autorisée
une inscription active par élève et par année
niveau valide
statut cohérent
frais configurés si initialisation financière activée
```

---

# 10. Imports affectations

L’import affectations doit permettre :

```txt
affecter les élèves à une classe
affecter les élèves du Secondaire à une série
affecter les groupes pédagogiques
affecter le parcours bilingue
préparer les exports EDUCMASTER
```

## Champs importables

```txt
matricule
année scolaire
niveau
classe
série
groupe
parcours bilingue
date d’affectation
```

## Contrôles

```txt
inscription validée
classe existante
classe active
niveau cohérent
capacité classe
série obligatoire au Secondaire
une seule affectation active par élève et par année
```

---

# 11. Exports élèves

Exports disponibles :

```txt
liste complète des élèves
élèves par classe
élèves par niveau
élèves par série
élèves actifs
élèves sortis
élèves transférés
élèves sans responsable
élèves sans classe
élèves avec dossier incomplet
élèves bilingues
élèves boursiers
```

## Formats

```txt
XLSX
CSV
PDF si activé
```

---

# 12. Exports classes

Exports classes :

```txt
liste de classe simple
liste de classe avec matricules
liste de classe avec responsables
liste de classe avec contacts d’urgence
liste de classe pour enseignants
liste de classe pour administration
liste de classe pour examens
liste de classe bilingue
liste de classe par série
```

---

# 13. Export EDUCMASTER

L’export **EDUCMASTER** est un élément stratégique du module Élèves.

Le système doit générer des fichiers Excel conformes aux exigences attendues par EDUCMASTER.

## Contrôles avant génération

```txt
matricule présent
nom et prénoms présents
niveau présent
classe présente
série présente pour le Secondaire si applicable
doublon absent
affectation active
inscription validée
format des colonnes conforme
données normalisées
```

## Fonctionnalités

```txt
choisir l’année scolaire
choisir le niveau
choisir la classe
choisir la série
prévisualiser
valider
générer Excel
télécharger
historiser
régénérer si nécessaire
```

---

# 14. Modèles de fichiers

Le système doit fournir des modèles téléchargeables :

```txt
modèle import élèves
modèle import responsables
modèle import inscriptions
modèle import affectations
modèle export EDUCMASTER
modèle de correction des erreurs
modèle multi-feuilles complet
```

Chaque modèle doit contenir :

```txt
colonnes attendues
exemples
contraintes
valeurs autorisées
indications de format
```

---

# 15. Mapping des colonnes

Le système doit permettre :

```txt
mapping automatique
mapping manuel
sauvegarde d’un mapping
réutilisation d’un mapping
détection des colonnes inconnues
signalement des colonnes obligatoires manquantes
```

Exemple :

```txt
Nom élève → lastName
Prénoms → firstName
Classe → className
Téléphone parent → guardianPhone
```

---

# 16. Prévisualisation

Avant import, le système doit afficher :

```txt
nombre total de lignes
lignes valides
lignes avec avertissements
lignes bloquées
erreurs par ligne
erreurs par colonne
doublons détectés
actions proposées
```

Règle stricte :

```txt
Aucun import massif ne doit être exécuté sans cette étape.
```

---

# 17. Contrôle qualité

Contrôles qualité :

```txt
doublons matricule
doublons nom/date naissance
téléphone invalide
email invalide
classe inconnue
niveau inconnu
série inconnue
responsable manquant
affectation incohérente
inscription absente
document obligatoire manquant si contrôle activé
données EDUCMASTER non conformes
```

---

# 18. Synchronisations internes

Synchronisations possibles :

```txt
dossiers élèves vers inscriptions
inscriptions vers affectations
affectations vers notes
affectations vers présences
affectations vers bulletins
responsables vers portail parent
responsables vers finance
élèves vers communication
élèves vers EDUCMASTER export
```

Le système doit permettre :

```txt
synchronisation manuelle
synchronisation planifiée
synchronisation après import
rapport de synchronisation
détection des conflits
```

---

# 19. Historique des opérations

Chaque opération doit afficher :

```txt
type d’opération
utilisateur
date
fichier source
nombre de lignes
lignes réussies
lignes rejetées
statut
rapport
actions
```

## Statuts recommandés

```txt
brouillon
prévisualisé
validé
en cours
réussi
partiel
échoué
annulé
```

---

# 20. ORION Imports, Exports & Synchronisations

ORION doit détecter :

```txt
import avec trop d’erreurs
fichier avec colonnes manquantes
fichier avec doublons critiques
export EDUCMASTER incomplet
élèves sans classe dans export
élèves secondaires sans série
responsables non liés après import
inscriptions créées sans affectation
synchronisation échouée
mapping incohérent
modèle obsolète
données non normalisées
```

Exemple :

```txt
ORION Data Exchange — Export EDUCMASTER incomplet

L’export contient des élèves inscrits sans affectation classe active.
Impact possible : rejet du fichier ou incohérence dans EDUCMASTER.
Action recommandée : corriger les affectations avant génération finale.
```

---

# 21. Base de données — DataExchangeJob

```prisma
model DataExchangeJob {
  id              String @id @default(cuid())
  tenantId        String

  type            DataExchangeType
  target          DataExchangeTarget
  status          DataExchangeStatus @default(DRAFT)

  fileName        String?
  fileUrl         String?
  fileMimeType    String?
  fileSize        Int?

  totalRows       Int?
  validRows       Int?
  warningRows     Int?
  rejectedRows    Int?
  processedRows   Int?

  mapping         Json?
  options         Json?
  summary         Json?

  startedAt       DateTime?
  completedAt     DateTime?
  failedAt        DateTime?

  errorMessage    String?

  createdById     String?
  updatedById     String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
  @@index([type])
  @@index([target])
  @@index([status])
  @@index([createdAt])
}
```

---

# 22. Base de données — DataExchangeRow

```prisma
model DataExchangeRow {
  id              String @id @default(cuid())
  tenantId        String

  jobId           String
  rowNumber       Int

  rawData         Json
  normalizedData  Json?
  validationStatus RowValidationStatus @default(PENDING)

  errors          Json?
  warnings        Json?

  action          DataExchangeRowAction?
  entityId        String?

  processedAt     DateTime?

  createdAt       DateTime @default(now())

  @@index([tenantId])
  @@index([jobId])
  @@index([rowNumber])
  @@index([validationStatus])
}
```

---

# 23. Base de données — DataExchangeTemplate

```prisma
model DataExchangeTemplate {
  id              String @id @default(cuid())
  tenantId        String?

  name            String
  target          DataExchangeTarget
  format          DataExchangeFileFormat

  columns         Json
  sampleData      Json?
  constraints     Json?

  isSystem        Boolean @default(false)
  status          TemplateStatus @default(ACTIVE)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
  @@index([target])
  @@index([format])
  @@index([status])
}
```

---

# 24. Enums

```prisma
enum DataExchangeType {
  IMPORT
  EXPORT
  SYNC
}

enum DataExchangeTarget {
  STUDENTS
  GUARDIANS
  ENROLLMENTS
  ASSIGNMENTS
  CLASSES
  EDUCMASTER
  DOCUMENTS
  FINANCE
  PORTAL
}

enum DataExchangeStatus {
  DRAFT
  PREVIEWED
  VALIDATED
  RUNNING
  SUCCESS
  PARTIAL_SUCCESS
  FAILED
  CANCELLED
}

enum RowValidationStatus {
  PENDING
  VALID
  WARNING
  BLOCKED
  PROCESSED
  FAILED
}

enum DataExchangeRowAction {
  CREATE
  UPDATE
  SKIP
  MERGE
  REJECT
}

enum DataExchangeFileFormat {
  XLSX
  CSV
  PDF
}

enum TemplateStatus {
  ACTIVE
  INACTIVE
  ARCHIVED
}
```

---

# 25. Backend — Routes API

```http
GET    /api/students/data-exchange
GET    /api/students/data-exchange/jobs
GET    /api/students/data-exchange/jobs/:jobId
POST   /api/students/data-exchange/import
POST   /api/students/data-exchange/jobs/:jobId/preview
POST   /api/students/data-exchange/jobs/:jobId/validate
POST   /api/students/data-exchange/jobs/:jobId/run
POST   /api/students/data-exchange/jobs/:jobId/cancel

GET    /api/students/data-exchange/jobs/:jobId/rows
GET    /api/students/data-exchange/jobs/:jobId/report

POST   /api/students/data-exchange/export/students
POST   /api/students/data-exchange/export/classes
POST   /api/students/data-exchange/export/educmaster

GET    /api/students/data-exchange/templates
GET    /api/students/data-exchange/templates/:templateId
POST   /api/students/data-exchange/templates
PATCH  /api/students/data-exchange/templates/:templateId
POST   /api/students/data-exchange/templates/:templateId/archive

POST   /api/students/data-exchange/sync
GET    /api/students/data-exchange/orion-alerts
```

---

# 26. Backend — Services

Services recommandés :

```txt
StudentDataExchangeService
StudentImportService
GuardianImportService
EnrollmentImportService
AssignmentImportService
StudentExportService
ClassExportService
EducmasterExportService
DataExchangeTemplateService
ColumnMappingService
DataQualityValidationService
InternalSynchronizationService
DataExchangeReportService
DataExchangeOrionService
DataExchangeAuditService
```

---

# 27. Sécurité

## Permissions

```ts
STUDENTS_DATA_EXCHANGE_VIEW
STUDENTS_IMPORT_CREATE
STUDENTS_IMPORT_PREVIEW
STUDENTS_IMPORT_RUN
STUDENTS_EXPORT_RUN
STUDENTS_EDUCMASTER_EXPORT
STUDENTS_SYNC_RUN
STUDENTS_TEMPLATES_MANAGE
STUDENTS_DATA_EXCHANGE_REPORT_VIEW
STUDENTS_DATA_EXCHANGE_AUDIT_VIEW
```

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
prévisualisation obligatoire avant import
validation obligatoire avant exécution
fichiers contrôlés
aucune suppression destructive
journalisation complète
export EDUCMASTER contrôlé
accès aux rapports protégé
```

---

# 28. Audit

Auditer :

```txt
upload fichier
prévisualisation
validation import
exécution import
import partiel
échec import
export élèves
export classes
export EDUCMASTER
création modèle
modification modèle
synchronisation interne
téléchargement rapport
annulation job
```

---

# 29. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 9 — Imports, Exports & Synchronisations** du  **Module 1 — Élèves & Scolarité** .

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
imports Excel/CSV
prévisualisation obligatoire
mapping colonnes
validation qualité
exports XLSX/CSV/PDF
export EDUCMASTER
synchronisations internes
rapports d’exécution
ORION Data Exchange
audit complet
aucune suppression destructive
```

## À créer côté frontend

```txt
Page /students/data-exchange
StudentDataExchangePage
StudentDataExchangeHeader
DataExchangeOverviewCards
StudentImportWizard
GuardianImportWizard
EnrollmentImportWizard
AssignmentImportWizard
StudentExportPanel
ClassExportPanel
EducmasterExportPanel
ImportTemplatePanel
ColumnMappingPanel
ImportPreviewTable
DataQualityCheckPanel
InternalSyncPanel
DataExchangeHistoryTable
DataExchangeReportDrawer
DataExchangeOrionAlertsPanel
DataExchangeAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Import élèves
Import responsables
Import inscriptions
Import affectations
Export élèves
Export classes
Export EDUCMASTER
Mapping colonnes
Prévisualisation
Contrôle qualité
Synchronisations internes
Rapports d’exécution
ORION Data Exchange
Audit complet
```

## À créer côté BDD

```txt
DataExchangeJob
DataExchangeRow
DataExchangeTemplate
Enums DataExchangeType, DataExchangeTarget, DataExchangeStatus, RowValidationStatus, DataExchangeRowAction, DataExchangeFileFormat, TemplateStatus
Relations avec Student, Guardian, Enrollment, Assignment, User, AcademicYear
```

---

# 30. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
importer les élèves
importer les responsables
importer les inscriptions
importer les affectations
prévisualiser les données
corriger les erreurs
contrôler la qualité
exporter les listes élèves
exporter les classes
générer les fichiers EDUCMASTER
gérer les modèles de fichiers
synchroniser les modules internes
consulter les rapports
détecter les anomalies avec ORION
auditer toutes les opérations
```

---

# Conclusion

L’onglet **Imports, Exports & Synchronisations** donne à Academia Helm une vraie capacité d’intégration terrain.

La règle d’or :

```txt
Toute donnée importée doit être contrôlée.
Toute donnée exportée doit être fiable.
Toute synchronisation doit être traçable.
```

Avec cet onglet, Academia Helm devient capable d’intégrer rapidement des écoles existantes, de générer des fichiers propres pour EDUCMASTER, de réduire les erreurs Excel et de fiabiliser tout le cycle de vie des données élèves.

La suite logique sera :

```txt
Onglet 10 — Rapports, Statistiques & Pilotage Élèves
```

C’est là qu’on va transformer les données élèves en indicateurs de pilotage pour la direction : effectifs, inscriptions, mouvements, conformité, répartition par niveau, genre, classe, série, statut et alertes stratégiques.

---

Parfait. On arrive à l’onglet qui transforme le module Élèves en  **outil de pilotage stratégique** .

# MODULE 1 — ÉLÈVES & SCOLARITÉ

## ONGLET 10 — RAPPORTS, STATISTIQUES & PILOTAGE ÉLÈVES

Cet onglet est le cockpit directionnel du module. Il ne sert pas seulement à “voir des chiffres”. Il sert à **prendre de meilleures décisions** : capacité des classes, inscriptions, mouvements, conformité, répartition des élèves, risques administratifs, tendances et alertes ORION.

La règle est simple :

```txt
Une donnée élève non analysée reste une archive.
Une donnée élève bien exploitée devient un levier de pilotage.
```

---

# 1. Objectif de l’onglet

L’onglet **Rapports, Statistiques & Pilotage Élèves** transforme les données du module Élèves & Scolarité en indicateurs décisionnels exploitables par la direction, l’administration, la vie scolaire et les responsables pédagogiques.

Il permet de :

```txt
suivre les effectifs globaux
analyser les inscriptions et réinscriptions
suivre les admissions
analyser les mouvements scolaires
mesurer la conformité des dossiers
suivre les affectations
détecter les élèves sans classe
produire des rapports administratifs
exporter des statistiques
alimenter ORION pour les alertes stratégiques
fournir à la direction une vision claire et fiable de la population scolaire
```

---

# 2. Positionnement dans le module

## Route frontend

```txt
/students/reports-analytics
```

## Module parent

```txt
Élèves & Scolarité
```

## Dépendances directes

```txt
Admissions
Dossiers élèves
Responsables légaux & Familles
Inscriptions & Réinscriptions
Affectations Classes, Séries & Groupes
Mouvements scolaires
Documents & Conformité
Imports, Exports & Synchronisations
Finance & Scolarité
Examens, Notes & Bulletins
Présence & Discipline
ORION Élèves
Direction
Audit
```

---

# 3. Principe général

Cet onglet n’est pas une simple page de statistiques.
C’est un  **cockpit de pilotage élèves** .

Il doit permettre à une école de répondre rapidement à des questions comme :

```txt
Combien d’élèves avons-nous cette année ?
Combien sont inscrits, réinscrits, transférés ou sortis ?
Quelles classes sont surchargées ?
Quels élèves sont inscrits mais non affectés ?
Quels dossiers sont incomplets ?
Quel est le taux de conformité documentaire ?
Quelle est la répartition par niveau, classe, genre, statut, série ou régime ?
Quels sont les risques administratifs détectés par ORION ?
```

## Règle métier

```txt
Les rapports doivent être basés sur les données actives de l’année scolaire sélectionnée,
avec possibilité de comparaison historique.
```

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit contenir :

```txt
1. Tableau de bord général élèves
2. Statistiques d’effectifs
3. Statistiques inscriptions/réinscriptions
4. Statistiques admissions
5. Statistiques affectations
6. Statistiques mouvements scolaires
7. Statistiques responsables/familles
8. Statistiques documents & conformité
9. Statistiques bilingue
10. Statistiques par niveau, classe, série et genre
11. Rapports administratifs
12. Rapports personnalisés
13. Comparaisons historiques
14. Indicateurs ORION
15. Exports
16. Audit
```

---

# 5. Frontend

## 5.1 Route

```txt
/students/reports-analytics
```

## 5.2 Page principale

```txt
app/(school)/students/reports-analytics/page.tsx
```

## 5.3 Composants recommandés

```txt
components/students/reports/StudentReportsAnalyticsPage.tsx
components/students/reports/StudentReportsAnalyticsHeader.tsx
components/students/reports/StudentAnalyticsOverviewCards.tsx
components/students/reports/StudentEnrollmentStatsPanel.tsx
components/students/reports/StudentAdmissionStatsPanel.tsx
components/students/reports/StudentAssignmentStatsPanel.tsx
components/students/reports/StudentMovementStatsPanel.tsx
components/students/reports/StudentGuardianStatsPanel.tsx
components/students/reports/StudentDocumentComplianceStatsPanel.tsx
components/students/reports/StudentBilingualStatsPanel.tsx
components/students/reports/StudentDistributionCharts.tsx
components/students/reports/StudentClassCapacityAnalyticsPanel.tsx
components/students/reports/StudentRiskIndicatorsPanel.tsx
components/students/reports/StudentCustomReportBuilder.tsx
components/students/reports/StudentHistoricalComparisonPanel.tsx
components/students/reports/StudentAdministrativeReportsPanel.tsx
components/students/reports/StudentOrionInsightsPanel.tsx
components/students/reports/StudentReportsExportButton.tsx
components/students/reports/StudentReportsAuditTimeline.tsx
```

---

# 6. Tableau de bord général

Cartes principales :

```txt
total élèves actifs
nouveaux inscrits
réinscrits
élèves en attente
élèves affectés
élèves sans classe
élèves transférés
élèves sortis
dossiers complets
dossiers incomplets
classes surchargées
alertes ORION critiques
```

---

# 7. Statistiques d’effectifs

Le système doit afficher :

```txt
effectif total
effectif par cycle
effectif par niveau
effectif par classe
effectif par série
effectif par genre
effectif par statut
effectif par régime
effectif par parcours bilingue
effectif par nationalité si activé
```

## Cycles à prendre en compte

```txt
Maternelle
Primaire
Secondaire 1er cycle
Secondaire 2nd cycle
```

## Niveaux à prendre en compte

```txt
Maternelle 1
Maternelle 2
CI
CP
CE1
CE2
CM1
CM2
6ème
5ème
4ème
3ème
2nde
1ère
Tle
```

---

# 8. Statistiques inscriptions/réinscriptions

Indicateurs :

```txt
inscriptions validées
inscriptions en attente
inscriptions rejetées
réinscriptions validées
taux de réinscription
élèves non réinscrits
inscriptions par période
inscriptions par niveau
inscriptions par classe
inscriptions avec frais initialisés
inscriptions sans affectation
inscriptions avec dossier incomplet
```

---

# 9. Statistiques admissions

Indicateurs :

```txt
candidatures reçues
candidatures acceptées
candidatures refusées
candidatures en attente
taux de conversion admission vers inscription
admissions par niveau demandé
admissions par source
admissions avec documents incomplets
admissions transformées en élèves
```

---

# 10. Statistiques affectations

Indicateurs :

```txt
élèves affectés
élèves non affectés
taux d’affectation
classes pleines
classes surchargées
places disponibles
élèves secondaires sans série
élèves sans groupe pédagogique
élèves bilingues sans parcours
changements de classe
changements de série
```

---

# 11. Statistiques mouvements scolaires

Indicateurs :

```txt
transferts entrants
transferts sortants
sorties définitives
abandons
suspensions
exclusions
réintégrations
mouvements en attente
mouvements validés
mouvements appliqués
mouvements par période
mouvements par niveau
mouvements par classe
```

---

# 12. Statistiques responsables/familles

Indicateurs :

```txt
élèves avec responsable principal
élèves sans responsable principal
élèves avec responsable financier
élèves sans responsable financier
élèves avec contact d’urgence
responsables avec téléphone
responsables avec email
accès portail parent activés
familles avec plusieurs enfants
responsables autorisés à récupérer l’élève
```

---

# 13. Statistiques documents & conformité

Indicateurs :

```txt
dossiers complets
dossiers incomplets
taux de conformité documentaire
documents manquants
documents expirés
documents rejetés
documents en attente de validation
documents sensibles
relances envoyées
dossiers à risque
```

---

# 14. Statistiques bilingue

Le système doit fournir une lecture spécifique du parcours bilingue.

Indicateurs :

```txt
élèves bilingues
élèves non bilingues
élèves bilingues par niveau
élèves bilingues par classe
élèves bilingues par série
élèves bilingues sans affectation complète
élèves bilingues avec documents incomplets
classes bilingues
groupes bilingues
```

---

# 15. Répartition par niveau, classe, série et genre

Le système doit proposer des graphiques et tableaux :

```txt
répartition par cycle
répartition par niveau
répartition par classe
répartition par série
répartition par genre
répartition par statut
répartition par régime
répartition par âge
pyramide des âges si activée
comparaison garçons/filles par niveau
```

---

# 16. Capacité des classes

Indicateurs :

```txt
capacité totale
effectif actuel
places restantes
taux d’occupation
classes sous-utilisées
classes équilibrées
classes pleines
classes surchargées
```

## Règles

```txt
la capacité doit venir du paramétrage académique
les alertes doivent être calculées selon les seuils définis par l’école
ORION doit signaler les classes à risque
```

---

# 17. Rapports administratifs

Rapports standards :

```txt
liste générale des élèves
liste par classe
liste par niveau
liste par série
liste des nouveaux élèves
liste des anciens élèves
liste des élèves transférés
liste des élèves sortis
liste des élèves sans classe
liste des élèves sans responsable
liste des élèves avec dossier incomplet
liste des élèves bilingues
liste des élèves boursiers
rapport d’effectif officiel
rapport de rentrée scolaire
rapport de fin d’année
```

---

# 18. Rapports personnalisés

Le système doit permettre de créer des rapports personnalisés avec :

```txt
choix des colonnes
choix des filtres
choix de l’année scolaire
choix du niveau
choix de la classe
choix du statut
choix du format
sauvegarde du modèle
réutilisation du modèle
export
```

## Colonnes disponibles

```txt
identité
matricule
niveau
classe
série
statut
genre
date de naissance
responsable
contact
inscription
affectation
conformité
mouvement
bilingue
finance si permission
```

---

# 19. Comparaisons historiques

Le système doit permettre de comparer :

```txt
effectifs année N vs année N-1
inscriptions année N vs année N-1
réinscriptions année N vs année N-1
sorties année N vs année N-1
transferts année N vs année N-1
conformité documentaire année N vs année N-1
taux d’occupation des classes
évolution par niveau
évolution par cycle
```

---

# 20. Indicateurs ORION

ORION doit produire des insights stratégiques :

```txt
baisse anormale d’effectif
hausse anormale des sorties
classe surchargée
classe sous-utilisée
taux de réinscription faible
trop d’élèves sans classe
trop de dossiers incomplets
trop de responsables sans contact
export EDUCMASTER à risque
incohérences entre inscriptions et affectations
niveau avec forte instabilité
série secondaire sous-représentée
```

Exemple :

```txt
ORION Pilotage Élèves — Taux de réinscription faible

Le taux de réinscription du niveau CM2 vers 6ème est inférieur au seuil défini.
Impact possible : perte d’effectif au passage vers le secondaire.
Action recommandée : analyser les élèves non réinscrits et contacter les familles.
```

---

# 21. Exports

## Formats

```txt
XLSX
CSV
PDF
JSON si activé pour API interne
```

## Exports disponibles

```txt
statistiques globales
rapports administratifs
rapports personnalisés
graphiques en PDF
données ORION
comparaisons historiques
états de conformité
rapports d’effectifs officiels
```

---

# 22. Base de données — StudentReportSnapshot

```prisma
model StudentReportSnapshot {
  id              String @id @default(cuid())
  tenantId        String

  academicYearId  String
  periodType      ReportPeriodType
  periodStart     DateTime?
  periodEnd       DateTime?

  title           String
  scope           StudentReportScope

  filters         Json?
  metrics         Json
  charts          Json?
  summary         Json?

  generatedById   String?
  generatedAt     DateTime @default(now())

  createdAt       DateTime @default(now())

  @@index([tenantId])
  @@index([academicYearId])
  @@index([periodType])
  @@index([scope])
  @@index([generatedAt])
}
```

---

# 23. Base de données — StudentCustomReport

```prisma
model StudentCustomReport {
  id              String @id @default(cuid())
  tenantId        String

  name            String
  description     String?

  columns         Json
  filters         Json?
  sorting         Json?
  grouping        Json?

  visibility      ReportVisibility @default(PRIVATE)
  status          ReportTemplateStatus @default(ACTIVE)

  createdById     String?
  updatedById     String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
  @@index([visibility])
  @@index([status])
  @@index([createdById])
}
```

---

# 24. Base de données — StudentReportExport

```prisma
model StudentReportExport {
  id              String @id @default(cuid())
  tenantId        String

  reportType      StudentReportExportType
  format          ReportExportFormat
  status          ReportExportStatus @default(PENDING)

  fileName        String?
  fileUrl         String?

  filters         Json?
  metadata        Json?

  requestedById   String?
  requestedAt     DateTime @default(now())

  completedAt     DateTime?
  failedAt        DateTime?
  errorMessage    String?

  @@index([tenantId])
  @@index([reportType])
  @@index([format])
  @@index([status])
  @@index([requestedAt])
}
```

---

# 25. Enums

```prisma
enum ReportPeriodType {
  DAILY
  WEEKLY
  MONTHLY
  TERM
  SEMESTER
  ANNUAL
  CUSTOM
}

enum StudentReportScope {
  GLOBAL
  CYCLE
  LEVEL
  CLASS
  SERIES
  STATUS
  COMPLIANCE
  MOVEMENT
  BILINGUAL
}

enum ReportVisibility {
  PRIVATE
  SCHOOL
  ROLE_BASED
}

enum ReportTemplateStatus {
  ACTIVE
  INACTIVE
  ARCHIVED
}

enum StudentReportExportType {
  GLOBAL_DASHBOARD
  ENROLLMENT
  ADMISSION
  ASSIGNMENT
  MOVEMENT
  GUARDIAN
  DOCUMENT_COMPLIANCE
  BILINGUAL
  ADMINISTRATIVE
  CUSTOM
  ORION
}

enum ReportExportFormat {
  XLSX
  CSV
  PDF
  JSON
}

enum ReportExportStatus {
  PENDING
  RUNNING
  SUCCESS
  FAILED
  CANCELLED
}
```

---

# 26. Backend — Routes API

```http
GET    /api/students/reports-analytics
GET    /api/students/reports-analytics/overview
GET    /api/students/reports-analytics/effectives
GET    /api/students/reports-analytics/enrollments
GET    /api/students/reports-analytics/admissions
GET    /api/students/reports-analytics/assignments
GET    /api/students/reports-analytics/movements
GET    /api/students/reports-analytics/guardians
GET    /api/students/reports-analytics/documents-compliance
GET    /api/students/reports-analytics/bilingual
GET    /api/students/reports-analytics/class-capacity
GET    /api/students/reports-analytics/historical-comparison
GET    /api/students/reports-analytics/orion-insights

GET    /api/students/reports-analytics/custom-reports
POST   /api/students/reports-analytics/custom-reports
GET    /api/students/reports-analytics/custom-reports/:reportId
PATCH  /api/students/reports-analytics/custom-reports/:reportId
POST   /api/students/reports-analytics/custom-reports/:reportId/archive
POST   /api/students/reports-analytics/custom-reports/:reportId/run

POST   /api/students/reports-analytics/snapshots
GET    /api/students/reports-analytics/snapshots

POST   /api/students/reports-analytics/export
GET    /api/students/reports-analytics/exports/:exportId
```

---

# 27. Backend — Services

Services recommandés :

```txt
StudentReportsAnalyticsService
StudentOverviewMetricsService
StudentEffectiveStatsService
StudentEnrollmentStatsService
StudentAdmissionStatsService
StudentAssignmentStatsService
StudentMovementStatsService
StudentGuardianStatsService
StudentDocumentComplianceStatsService
StudentBilingualStatsService
StudentClassCapacityAnalyticsService
StudentHistoricalComparisonService
StudentCustomReportService
StudentReportSnapshotService
StudentReportExportService
StudentOrionInsightsService
StudentReportsAuditService
```

---

# 28. Sécurité

## Permissions

```ts
STUDENTS_REPORTS_VIEW
STUDENTS_REPORTS_EXPORT
STUDENTS_REPORTS_CUSTOM_CREATE
STUDENTS_REPORTS_CUSTOM_UPDATE
STUDENTS_REPORTS_CUSTOM_RUN
STUDENTS_REPORTS_SNAPSHOTS_CREATE
STUDENTS_REPORTS_ORION_VIEW
STUDENTS_REPORTS_FINANCE_FIELDS_VIEW
STUDENTS_REPORTS_AUDIT_VIEW
```

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
masquage des champs sensibles selon permissions
accès aux données financières uniquement si autorisé
exports protégés
rapports personnalisés soumis aux permissions
audit complet des exports et consultations sensibles
```

---

# 29. Audit

Auditer :

```txt
consultation tableau de bord
génération rapport
création rapport personnalisé
modification rapport personnalisé
exécution rapport personnalisé
création snapshot
export XLSX
export CSV
export PDF
accès aux indicateurs sensibles
accès aux champs financiers
consultation ORION insights
```

---

# 30. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 10 — Rapports, Statistiques & Pilotage Élèves** du  **Module 1 — Élèves & Scolarité** .

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
données filtrées par année scolaire
statistiques temps réel ou quasi temps réel
graphiques décisionnels
rapports administratifs
rapports personnalisés
comparaisons historiques
exports XLSX/CSV/PDF
ORION Insights
audit complet
masquage des données sensibles selon permissions
```

## À créer côté frontend

```txt
Page /students/reports-analytics
StudentReportsAnalyticsPage
StudentReportsAnalyticsHeader
StudentAnalyticsOverviewCards
StudentEnrollmentStatsPanel
StudentAdmissionStatsPanel
StudentAssignmentStatsPanel
StudentMovementStatsPanel
StudentGuardianStatsPanel
StudentDocumentComplianceStatsPanel
StudentBilingualStatsPanel
StudentDistributionCharts
StudentClassCapacityAnalyticsPanel
StudentRiskIndicatorsPanel
StudentCustomReportBuilder
StudentHistoricalComparisonPanel
StudentAdministrativeReportsPanel
StudentOrionInsightsPanel
StudentReportsExportButton
StudentReportsAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Agrégations statistiques
Rapports administratifs
Rapports personnalisés
Snapshots
Exports
Comparaisons historiques
ORION Insights
Audit complet
```

## À créer côté BDD

```txt
StudentReportSnapshot
StudentCustomReport
StudentReportExport
Enums ReportPeriodType, StudentReportScope, ReportVisibility, ReportTemplateStatus, StudentReportExportType, ReportExportFormat, ReportExportStatus
Relations avec Student, Enrollment, Assignment, Movement, Guardian, Document, AcademicYear, User
```

---

# 31. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
visualiser les effectifs
analyser les inscriptions
analyser les admissions
analyser les affectations
analyser les mouvements scolaires
suivre la conformité documentaire
suivre les responsables/familles
piloter le bilingue
analyser la capacité des classes
générer des rapports administratifs
créer des rapports personnalisés
comparer les années scolaires
exporter les données
consulter les insights ORION
auditer les consultations et exports sensibles
```

---

# Conclusion

L’onglet **Rapports, Statistiques & Pilotage Élèves** donne à la direction une vision claire, fiable et exploitable de la population scolaire.

La règle d’or :

```txt
Ce qui n’est pas mesuré est difficile à piloter.
Ce qui est bien mesuré devient maîtrisable.
```

Avec cet onglet, Academia Helm passe d’un simple système de gestion élèves à une plateforme de  **pilotage scolaire intelligent** .

La suite logique sera :

```txt
Onglet 11 — Paramétrage Élèves & Scolarité
```

C’est là qu’on va centraliser les règles propres au module Élèves : statuts, matricules, documents requis, règles d’inscription, règles d’affectation, seuils ORION, formats d’exports et comportements automatisés.

---

Parfait. On termine proprement le module Élèves avec l’onglet qui donne à chaque école son  **moteur de configuration métier** .

# MODULE 1 — ÉLÈVES & SCOLARITÉ

## ONGLET 11 — PARAMÉTRAGE ÉLÈVES & SCOLARITÉ

Cet onglet est stratégique. Il permet à Academia Helm de ne pas être une application rigide, mais une plateforme configurable selon les réalités de chaque établissement.

La règle est claire :

```txt
Une école ne doit pas s’adapter au logiciel.
Le logiciel doit s’adapter intelligemment aux règles de l’école.
```

---

# 1. Objectif de l’onglet

L’onglet **Paramétrage Élèves & Scolarité** centralise toutes les règles métier qui gouvernent le module Élèves.

Il permet à chaque école de configurer son fonctionnement sans modifier le code source.

Il permet de gérer :

```txt
les statuts élèves
les règles de matricule
les règles d’admission
les règles d’inscription et de réinscription
les règles d’affectation
les règles de transfert et sortie
les règles documentaires
les règles liées au parcours bilingue
les règles EDUCMASTER
les seuils ORION
les formats d’import/export
les politiques de validation
les automatisations du module
```

---

# 2. Positionnement dans le module

## Route frontend

```txt
/students/settings
```

## Module parent

```txt
Élèves & Scolarité
```

## Dépendances directes

```txt
Paramètres globaux
Années scolaires
Niveaux, classes, séries
Admissions
Inscriptions & Réinscriptions
Affectations
Documents & Conformité
Imports/Exports
EDUCMASTER
ORION Élèves
Audit
```

---

# 3. Principe général

Cet onglet n’est pas un simple écran de préférences.
C’est le **moteur de règles métier** du module Élèves.

Le système doit permettre à une école de définir comment elle fonctionne :

```txt
comment les matricules sont générés
quels statuts élèves existent
quelles validations sont obligatoires
quelles pièces sont requises
comment les élèves sont affectés
quels contrôles bloquent ou avertissent
comment les exports EDUCMASTER sont générés
quels seuils déclenchent les alertes ORION
```

## Règle métier

```txt
Aucune règle critique ne doit être modifiée sans traçabilité,
contrôle de permission et historisation.
```

Ici, on ne laisse pas un clic hasardeux transformer la politique d’inscription de toute une école. L’innovation, oui. Le chaos administratif, non.

---

# 4. Structure fonctionnelle de l’onglet

L’onglet doit contenir :

```txt
1. Vue d’ensemble des paramètres
2. Statuts élèves
3. Matricules élèves
4. Règles d’admission
5. Règles d’inscription/réinscription
6. Règles d’affectation
7. Règles de mouvements scolaires
8. Règles documentaires
9. Paramètres responsables/familles
10. Paramètres parcours bilingue
11. Paramètres EDUCMASTER
12. Paramètres imports/exports
13. Seuils ORION
14. Automatisations
15. Politiques de validation
16. Historique des changements
17. Audit
```

---

# 5. Frontend

## 5.1 Route

```txt
/students/settings
```

## 5.2 Page principale

```txt
app/(school)/students/settings/page.tsx
```

## 5.3 Composants recommandés

```txt
components/students/settings/StudentSettingsPage.tsx
components/students/settings/StudentSettingsHeader.tsx
components/students/settings/StudentSettingsOverviewCards.tsx
components/students/settings/StudentStatusSettingsPanel.tsx
components/students/settings/StudentMatriculeSettingsPanel.tsx
components/students/settings/AdmissionRulesSettingsPanel.tsx
components/students/settings/EnrollmentRulesSettingsPanel.tsx
components/students/settings/AssignmentRulesSettingsPanel.tsx
components/students/settings/MovementRulesSettingsPanel.tsx
components/students/settings/DocumentRulesSettingsPanel.tsx
components/students/settings/GuardianSettingsPanel.tsx
components/students/settings/BilingualPathSettingsPanel.tsx
components/students/settings/EducmasterSettingsPanel.tsx
components/students/settings/DataExchangeSettingsPanel.tsx
components/students/settings/StudentOrionThresholdSettingsPanel.tsx
components/students/settings/StudentAutomationSettingsPanel.tsx
components/students/settings/StudentValidationPolicyPanel.tsx
components/students/settings/StudentSettingsChangeHistory.tsx
components/students/settings/StudentSettingsAuditTimeline.tsx
```

---

# 6. Vue d’ensemble des paramètres

Cartes de synthèse :

```txt
règles actives
règles critiques
paramètres incomplets
seuils ORION actifs
automatisations actives
règles documentaires actives
exports EDUCMASTER configurés
dernière modification
anomalies de configuration
alertes ORION configuration
```

---

# 7. Statuts élèves

Le système doit permettre de gérer les statuts élèves.

## Statuts recommandés

```txt
candidat
admis
inscrit
réinscrit
actif
en attente
suspendu
transféré
sorti
abandonné
exclu
diplômé
archivé
```

## Chaque statut doit avoir

```txt
libellé
code
description
couleur UI
statut système ou personnalisé
autorise inscription
autorise affectation
autorise facturation
autorise présence
autorise notes
autorise portail
ordre d’affichage
actif/inactif
```

---

# 8. Matricules élèves

Le système doit permettre de configurer la génération des matricules.

## Options

```txt
génération automatique
saisie manuelle
génération semi-automatique
préfixe école
préfixe année scolaire
préfixe cycle
préfixe niveau
compteur séquentiel
longueur minimale
séparateur
réinitialisation annuelle ou continue
vérification unicité
```

## Exemples

```txt
AH-2026-0001
ECOLE-CI-00045
MAT-SEC-2026-1234
```

## Règles

```txt
un matricule doit être unique dans le tenant
la modification d’un matricule doit être contrôlée
l’historique des changements doit être conservé
```

---

# 9. Règles d’admission

Paramètres :

```txt
admission obligatoire avant inscription
validation administrative obligatoire
validation pédagogique obligatoire
documents obligatoires à l’admission
conversion automatique candidat → élève
création automatique du dossier élève
notification après admission
durée de validité d’une admission
niveaux ouverts à l’admission
contrôle capacité avant admission
```

---

# 10. Règles d’inscription/réinscription

Paramètres :

```txt
inscription sans admission autorisée
réinscription automatique autorisée
validation obligatoire
paiement initial obligatoire avant validation
dossier complet obligatoire
affectation automatique après inscription
initialisation automatique des frais
blocage si dette antérieure
blocage si document obligatoire manquant
autoriser inscription avec avertissement
période d’inscription
période de réinscription
```

---

# 11. Règles d’affectation

Paramètres :

```txt
affectation automatique
affectation manuelle
affectation obligatoire après inscription
contrôle capacité classe
autoriser dépassement capacité
série obligatoire au Secondaire
groupe pédagogique obligatoire
parcours bilingue obligatoire si élève bilingue
changement de classe soumis à validation
changement de série soumis à validation
historique obligatoire
```

---

# 12. Règles de mouvements scolaires

Paramètres :

```txt
transfert soumis à validation
sortie soumise à validation
suspension soumise à validation
exclusion soumise à validation
réintégration soumise à validation
motif obligatoire
document justificatif obligatoire
notification responsable
impact automatique sur affectation
impact automatique sur facturation
impact automatique sur présence
impact automatique sur portail
```

---

# 13. Règles documentaires

Paramètres :

```txt
documents obligatoires par niveau
documents obligatoires par cycle
documents obligatoires par type d’inscription
documents obligatoires pour nouvel élève
documents obligatoires pour ancien élève
documents obligatoires pour élève transféré
documents obligatoires pour boursier
documents obligatoires pour parcours bilingue
validation documentaire obligatoire
expiration contrôlée
relance automatique
accès documents sensibles
taux de conformité strict ou souple
```

---

# 14. Paramètres responsables/familles

Paramètres :

```txt
responsable principal obligatoire
responsable financier obligatoire
responsable académique obligatoire
contact d’urgence obligatoire
téléphone obligatoire
email obligatoire
autorisation de récupération obligatoire
accès portail parent automatique
validation du responsable avant activation portail
nombre minimal de responsables
nombre maximal de responsables
```

---

# 15. Paramètres parcours bilingue

Le système doit gérer le bilingue comme un parcours pédagogique structuré.

## Paramètres

```txt
parcours bilingue activé
niveaux concernés
classes concernées
matières anglaises activées
groupes bilingues
affectation bilingue obligatoire
documents spécifiques bilingue
export bilingue
rapports bilingues
alertes ORION bilingue
```

## Rappel métier

```txt
Le bilingue dans Academia Helm ne signifie pas une simple traduction d’interface.
Il signifie que plusieurs matières peuvent être enseignées en anglais comme en français.
```

---

# 16. Paramètres EDUCMASTER

Paramètres :

```txt
export EDUCMASTER activé
modèle de fichier actif
colonnes obligatoires
ordre des colonnes
normalisation des noms
format des niveaux
format des classes
format des séries
règles pour le Secondaire
contrôle avant export
blocage si données incomplètes
historique des exports
nommage automatique des fichiers
```

---

# 17. Paramètres imports/exports

Paramètres :

```txt
formats autorisés
taille maximale fichier
prévisualisation obligatoire
validation obligatoire avant import
import création autorisé
import mise à jour autorisé
import mixte autorisé
simulation obligatoire si fichier volumineux
mapping automatique
mapping manuel
modèles actifs
export PDF autorisé
export XLSX autorisé
export CSV autorisé
```

---

# 18. Seuils ORION

Seuils configurables :

```txt
taux maximal de dossiers incomplets
taux maximal d’élèves sans classe
taux maximal de documents expirés
taux minimal de réinscription
capacité maximale classe
seuil de surcharge classe
délai maximal validation document
délai maximal affectation après inscription
taux maximal d’erreurs import
seuil export EDUCMASTER incomplet
nombre maximal d’élèves sans responsable
délai maximal de traitement admission
```

---

# 19. Automatisations

Automatisations possibles :

```txt
générer matricule à la création élève
créer dossier élève après admission
créer inscription après admission validée
initialiser frais après inscription
affecter automatiquement selon règles
créer accès portail parent
relancer documents manquants
relancer documents expirants
synchroniser responsables vers finance
synchroniser affectations vers notes
générer alertes ORION
archiver élèves sortis après délai
```

---

# 20. Politiques de validation

Le système doit permettre de définir des workflows de validation pour :

```txt
admission
inscription
réinscription
affectation
changement de classe
changement de série
transfert
sortie
suspension
exclusion
réintégration
document sensible
export EDUCMASTER
import massif
```

Chaque workflow doit pouvoir définir :

```txt
étapes
rôles validateurs
validation simple ou multiple
commentaire obligatoire
délai maximal
notification
escalade ORION
```

---

# 21. Historique des changements

Chaque changement de paramètre doit conserver :

```txt
paramètre modifié
ancienne valeur
nouvelle valeur
utilisateur
date
motif si critique
impact potentiel
rollback possible ou non
```

---

# 22. ORION Configuration Élèves

ORION doit détecter :

```txt
matricule non configuré
règles d’inscription contradictoires
documents obligatoires non définis
seuils ORION absents
EDUCMASTER activé sans modèle
bilingue activé sans matières anglaises
affectation automatique activée sans capacité classe
import autorisé sans prévisualisation
export autorisé sans contrôle qualité
responsable financier obligatoire mais non contrôlé
statut élève mal configuré
workflow critique absent
```

Exemple :

```txt
ORION Configuration Élèves — Export EDUCMASTER activé sans modèle actif

L’export EDUCMASTER est activé, mais aucun modèle de fichier n’est défini.
Impact possible : génération de fichiers incompatibles.
Action recommandée : configurer un modèle EDUCMASTER avant d’autoriser les exports.
```

---

# 23. Base de données — StudentModuleSettings

```prisma
model StudentModuleSettings {
  id              String @id @default(cuid())
  tenantId        String @unique

  matriculeConfig Json?
  admissionRules  Json?
  enrollmentRules Json?
  assignmentRules Json?
  movementRules   Json?
  documentRules   Json?
  guardianRules   Json?
  bilingualRules  Json?
  educmasterRules Json?
  dataExchangeRules Json?
  orionThresholds Json?
  automationRules Json?
  validationPolicies Json?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  updatedById     String?

  @@index([tenantId])
}
```

---

# 24. Base de données — StudentStatusConfig

```prisma
model StudentStatusConfig {
  id              String @id @default(cuid())
  tenantId        String

  code            String
  label           String
  description     String?
  color           String?

  isSystem        Boolean @default(false)
  isActive        Boolean @default(true)

  allowEnrollment Boolean @default(false)
  allowAssignment Boolean @default(false)
  allowBilling    Boolean @default(false)
  allowAttendance Boolean @default(false)
  allowGrades     Boolean @default(false)
  allowPortal     Boolean @default(false)

  displayOrder    Int @default(0)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([tenantId, code])
  @@index([tenantId])
  @@index([isActive])
}
```

---

# 25. Base de données — StudentSettingsChangeLog

```prisma
model StudentSettingsChangeLog {
  id              String @id @default(cuid())
  tenantId        String

  section         StudentSettingsSection
  key             String

  oldValue        Json?
  newValue        Json?

  reason          String?
  impact          String?

  changedById     String?
  changedAt       DateTime @default(now())

  canRollback     Boolean @default(false)
  rollbackData    Json?

  @@index([tenantId])
  @@index([section])
  @@index([changedAt])
  @@index([changedById])
}
```

---

# 26. Enums

```prisma
enum StudentSettingsSection {
  OVERVIEW
  STATUS
  MATRICULE
  ADMISSION
  ENROLLMENT
  ASSIGNMENT
  MOVEMENT
  DOCUMENT
  GUARDIAN
  BILINGUAL
  EDUCMASTER
  DATA_EXCHANGE
  ORION
  AUTOMATION
  VALIDATION_POLICY
}
```

---

# 27. Backend — Routes API

```http
GET    /api/students/settings
PATCH  /api/students/settings

GET    /api/students/settings/statuses
POST   /api/students/settings/statuses
PATCH  /api/students/settings/statuses/:statusId
POST   /api/students/settings/statuses/:statusId/archive

GET    /api/students/settings/matricule
PATCH  /api/students/settings/matricule
POST   /api/students/settings/matricule/preview

GET    /api/students/settings/admission-rules
PATCH  /api/students/settings/admission-rules

GET    /api/students/settings/enrollment-rules
PATCH  /api/students/settings/enrollment-rules

GET    /api/students/settings/assignment-rules
PATCH  /api/students/settings/assignment-rules

GET    /api/students/settings/movement-rules
PATCH  /api/students/settings/movement-rules

GET    /api/students/settings/document-rules
PATCH  /api/students/settings/document-rules

GET    /api/students/settings/guardian-rules
PATCH  /api/students/settings/guardian-rules

GET    /api/students/settings/bilingual-rules
PATCH  /api/students/settings/bilingual-rules

GET    /api/students/settings/educmaster-rules
PATCH  /api/students/settings/educmaster-rules

GET    /api/students/settings/data-exchange-rules
PATCH  /api/students/settings/data-exchange-rules

GET    /api/students/settings/orion-thresholds
PATCH  /api/students/settings/orion-thresholds

GET    /api/students/settings/automation-rules
PATCH  /api/students/settings/automation-rules

GET    /api/students/settings/validation-policies
PATCH  /api/students/settings/validation-policies

GET    /api/students/settings/change-logs
POST   /api/students/settings/change-logs/:changeId/rollback
GET    /api/students/settings/orion-alerts
```

---

# 28. Backend — Services

Services recommandés :

```txt
StudentSettingsService
StudentStatusConfigService
StudentMatriculeConfigService
StudentAdmissionRulesService
StudentEnrollmentRulesService
StudentAssignmentRulesService
StudentMovementRulesService
StudentDocumentRulesService
StudentGuardianRulesService
StudentBilingualRulesService
StudentEducmasterRulesService
StudentDataExchangeRulesService
StudentOrionThresholdService
StudentAutomationRulesService
StudentValidationPolicyService
StudentSettingsChangeLogService
StudentSettingsOrionService
StudentSettingsAuditService
```

---

# 29. Sécurité

## Permissions

```ts
STUDENTS_SETTINGS_VIEW
STUDENTS_SETTINGS_UPDATE
STUDENTS_STATUS_MANAGE
STUDENTS_MATRICULE_CONFIG_MANAGE
STUDENTS_ADMISSION_RULES_MANAGE
STUDENTS_ENROLLMENT_RULES_MANAGE
STUDENTS_ASSIGNMENT_RULES_MANAGE
STUDENTS_MOVEMENT_RULES_MANAGE
STUDENTS_DOCUMENT_RULES_MANAGE
STUDENTS_GUARDIAN_RULES_MANAGE
STUDENTS_BILINGUAL_RULES_MANAGE
STUDENTS_EDUCMASTER_RULES_MANAGE
STUDENTS_DATA_EXCHANGE_RULES_MANAGE
STUDENTS_ORION_THRESHOLDS_MANAGE
STUDENTS_AUTOMATION_RULES_MANAGE
STUDENTS_VALIDATION_POLICIES_MANAGE
STUDENTS_SETTINGS_CHANGELOG_VIEW
STUDENTS_SETTINGS_ROLLBACK
STUDENTS_SETTINGS_AUDIT_VIEW
```

## Contrôles

```txt
tenantId depuis session uniquement
RBAC strict
changement critique avec motif obligatoire
audit complet
rollback uniquement si autorisé
validation Zod stricte
pas de suppression destructive
verrouillage des statuts système critiques
ORION Configuration obligatoire
```

---

# 30. Audit

Auditer :

```txt
consultation paramètres
modification statut
modification matricule
modification règles admission
modification règles inscription
modification règles affectation
modification règles mouvement
modification règles documentaires
modification règles responsables
modification règles bilingue
modification règles EDUCMASTER
modification seuils ORION
modification automatisations
modification workflows validation
rollback
accès refusé
```

---

# 31. Instructions Google Antigravity

## Mission

Implémenter l’**Onglet 11 — Paramétrage Élèves & Scolarité** du  **Module 1 — Élèves & Scolarité** .

## Stack

```txt
Next.js
React
TypeScript
Prisma
PostgreSQL
Neon
Vercel
```

## Contraintes

```txt
multi-tenant strict
RBAC obligatoire
configuration par école
règles métier dynamiques
historique des changements
rollback contrôlé
ORION Configuration
audit complet
validation stricte
aucun changement critique non tracé
```

## À créer côté frontend

```txt
Page /students/settings
StudentSettingsPage
StudentSettingsHeader
StudentSettingsOverviewCards
StudentStatusSettingsPanel
StudentMatriculeSettingsPanel
AdmissionRulesSettingsPanel
EnrollmentRulesSettingsPanel
AssignmentRulesSettingsPanel
MovementRulesSettingsPanel
DocumentRulesSettingsPanel
GuardianSettingsPanel
BilingualPathSettingsPanel
EducmasterSettingsPanel
DataExchangeSettingsPanel
StudentOrionThresholdSettingsPanel
StudentAutomationSettingsPanel
StudentValidationPolicyPanel
StudentSettingsChangeHistory
StudentSettingsAuditTimeline
```

## À créer côté backend

```txt
Routes API listées
Services listés
Validations Zod
Contrôles RBAC
Gestion statuts élèves
Configuration matricules
Règles admission
Règles inscription/réinscription
Règles affectation
Règles mouvements
Règles documentaires
Règles responsables/familles
Règles bilingue
Règles EDUCMASTER
Règles imports/exports
Seuils ORION
Automatisations
Workflows de validation
Historique changements
Rollback contrôlé
Audit complet
```

## À créer côté BDD

```txt
StudentModuleSettings
StudentStatusConfig
StudentSettingsChangeLog
Enum StudentSettingsSection
Relations avec Tenant, User, AuditLog
```

---

# 32. Résultat attendu

Google Antigravity doit produire un onglet permettant de :

```txt
configurer les statuts élèves
configurer les matricules
configurer les règles d’admission
configurer les règles d’inscription
configurer les règles d’affectation
configurer les règles de mouvements scolaires
configurer les règles documentaires
configurer les règles responsables/familles
configurer le parcours bilingue
configurer EDUCMASTER
configurer les imports/exports
configurer les seuils ORION
configurer les automatisations
configurer les workflows de validation
consulter l’historique des changements
effectuer un rollback contrôlé
auditer toutes les modifications sensibles
```

---

# Conclusion

L’onglet **Paramétrage Élèves & Scolarité** donne à Academia Helm sa vraie puissance SaaS : chaque école peut adapter le module Élèves à ses règles internes sans intervention technique.

La règle d’or :

```txt
Le code doit rester stable.
Les règles métier doivent rester configurables.
```

Avec cet onglet, Academia Helm devient une plateforme scolaire flexible, robuste et prête pour des établissements aux fonctionnements différents.

Le **Module 1 — Élèves & Scolarité** est maintenant structurellement complet avec ses 11 onglets.

---
