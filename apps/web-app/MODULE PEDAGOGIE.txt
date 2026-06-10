Dawes, [01/03/2026 13:51]
Parfait.
On entre maintenant dans le cœur académique d’Academia Helm.

Le module 2 n’est pas un simple “emploi du temps + matières”.
C’est le moteur pédagogique institutionnel.

Il doit :

structurer l’école

organiser les ressources

encadrer les enseignants

contrôler la conformité pédagogique

produire des données fiables pour ORION


On construit ça proprement.


---

🎓 MODULE 2 — ORGANISATION PÉDAGOGIQUE & ÉTUDES

(Institutionnel – Multi-niveaux – Multi-année – Bilingue – Offline-first)


---

🎯 OBJECTIF STRATÉGIQUE

Permettre à l’établissement de :

Structurer ses niveaux

Définir cycles & classes

Gérer matières & coefficients

Affecter enseignants

Générer emplois du temps

Encadrer la production pédagogique

Contrôler les heures effectives

Produire indicateurs pédagogiques pour ORION



---

🧱 STRUCTURE GLOBALE DU MODULE

Module 2 est organisé en 8 sous-modules :

1️⃣ Structure académique
2️⃣ Matières & programmes
3️⃣ Gestion des enseignants (académique)
4️⃣ Affectations & charges horaires
5️⃣ Emplois du temps intelligents
6️⃣ Espace pédagogique (enseignants)
7️⃣ Contrôle pédagogique direction
8️⃣ Analytique pédagogique ORION


---

🔹 SOUS-MODULE 1 — STRUCTURE ACADÉMIQUE

⚠️ Déjà lié au module Paramètres, mais ici opérationnel.

Contenu :

Niveaux : Maternelle / Primaire / Secondaire

Cycles :

PS, MS, GS

CI → CM2

6ème → Terminale


Classes par année scolaire

Capacité maximale

Salle affectée

Responsable classe


Contraintes :

Lié à academicYearId

Aucune classe sans niveau

Historique conservé



---

🔹 SOUS-MODULE 2 — MATIÈRES & PROGRAMMES

🎯 Gestion académique formelle.

Fonctionnalités :

Catalogue matières

Matières par niveau

Matières par classe

Coefficients

Volume horaire hebdomadaire

Type matière (obligatoire / facultative)

Langue (FR / EN si bilingue)

Programme officiel attaché (PDF)


Schéma clé :

model Subject {
  id            String @id @default(uuid())
  tenantId      String
  academicYearId String
  name          String
  level         String
  language      String?
  coefficient   Int
  weeklyHours   Int
  isMandatory   Boolean
}


---

🔹 SOUS-MODULE 3 — GESTION ACADÉMIQUE DES ENSEIGNANTS

⚠️ Complément du Module RH.

Ici on gère :

Qualification matière

Charge horaire max

Disponibilités

Niveaux autorisés

Statut pédagogique actif/inactif


Pas de gestion salariale ici.


---

🔹 SOUS-MODULE 4 — AFFECTATIONS & CHARGES HORAIRES

Objectif :

Affecter un enseignant à :

une matière

une classe

un volume horaire

une période


Contraintes :

Pas de double affectation horaire

Respect charge max enseignant

Historique conservé


ORION surveille :

surcharge horaire

heures non couvertes

matière sans enseignant



---

🔹 SOUS-MODULE 5 — EMPLOI DU TEMPS INTELLIGENT

🎯 Génération semi-automatique ou manuelle.

Fonctionnalités :

Création plages horaires

Assignation matière + enseignant

Détection conflits :

salle

enseignant

classe


Export PDF

Versionnement emploi du temps


Mode :

Génération automatique

Ajustement manuel

Historique versions


Offline-first :

Modification locale

Sync serveur avec vérification conflit



---

🔹 SOUS-MODULE 6 — ESPACE PÉDAGOGIQUE ENSEIGNANT

⚠️ Partie stratégique.

Chaque enseignant dispose :

Espace fiches pédagogiques

Cahier journal

Cahier de texte

Cahier du semainier

Upload supports

Historique validation direction


Workflow :

1. Enseignant crée


2. Envoie


3. Directeur reçoit notification


4. Commentaire


5. Validation / rejet


6. Archivage signé



Notifications :

SMS

WhatsApp

Notification interne



---

🔹 SOUS-MODULE 7 — CONTRÔLE PÉDAGOGIQUE DIRECTION

Vue consolidée :

Fiches en attente

Retards de soumission

Heures non assurées

Cahiers incomplets

Semainier non soumis


ORION surveille :

enseignant retardataire

classe sans cahier validé

taux de soumission faible



---

🔹 SOUS-MODULE 8 — ANALYTIQUE PÉDAGOGIQUE (ORION)

KPI pédagogiques :

Taux couverture horaire

Taux validation fiches

Volume horaire assuré vs prévu

Matières sous-représentées

Enseignant surcharge


ORION produit :

Dawes, [01/03/2026 13:51]
Alertes pédagogiques

Rapport direction hebdomadaire

Projection risque résultats faibles



---

🔐 RÈGLES MÉTIER CRITIQUES

Année scolaire obligatoire

Multi-tenant strict

Bilingue séparé FR / EN

Pas modification rétroactive validée

Historique complet versionné

Audit pédagogique



---

🧠 INTÉGRATION BILINGUE

Si bilingue actif :

Matières dupliquées FR / EN

Emploi du temps distinct

Cahiers séparés

ORION KPI distinct FR vs EN



---

🧩 WIREFRAME GLOBAL MODULE 2

----------------------------------------------------
| Organisation pédagogique                         |
----------------------------------------------------

[ Structure ]
[ Matières ]
[ Enseignants académiques ]
[ Affectations ]
[ Emploi du temps ]
[ Espace pédagogique ]
[ Contrôle direction ]
[ Analytique ORION ]


---

🔄 OFFLINE-FIRST

Autorisés offline :

Fiches pédagogiques

Cahier de texte

Emploi du temps édition


Interdit offline :

Validation officielle direction

Modification structure majeure



---

🚀 PROMPT CURSOR — MODULE 2 COMPLET

Copier-coller :


---

Tu es un architecte SaaS institutionnel multi-tenant.

OBJECTIF : Implémenter le Module 2 — Organisation pédagogique & Études d’Academia Helm.

CONTRAINTES :

Multi-tenant strict

Année scolaire obligatoire

Compatible bilingue

Compatible offline-first

Historique versionné

Intégration ORION


INCLURE :

1. Structure académique


2. Matières & coefficients


3. Gestion académique enseignants


4. Affectations & charges


5. Emploi du temps intelligent


6. Espace pédagogique enseignant


7. Contrôle direction


8. KPI pédagogiques ORION



BACKEND :

Modèles Prisma

Endpoints sécurisés

Validation conflits horaires

Versionnement

Audit logs


FRONTEND :

Onglets modulaires

Vue enseignant

Vue direction

Détection conflit UI

Indicateurs ORION visibles


OBJECTIF FINAL : Créer un moteur pédagogique institutionnel, structuré, contrôlé et analysable.


---

Excellent.
On commence par la fondation absolue du Module 2.

Si la Structure académique est mal pensée,
tout le reste (matières, emplois du temps, examens, finances) devient instable.

On la construit donc comme une architecture institutionnelle versionnée, multi-niveaux, multi-année, bilingue-compatible.


---

🎓 SOUS-MODULE 1 — STRUCTURE ACADÉMIQUE

(Academia Helm — Moteur de structuration pédagogique)


---

🎯 OBJECTIF

Permettre à l’établissement de :

Définir ses niveaux scolaires

Définir ses cycles

Créer ses classes par année scolaire

Gérer capacité & salles

Désigner responsables

Versionner par année

Supporter le bilingue

Garantir cohérence multi-modules



---

🧱 HIÉRARCHIE STRUCTURELLE

La structure académique suit cette logique stricte :

Tenant
 └── AcademicYear
      └── Level (Maternelle / Primaire / Secondaire)
           └── Cycle (PS/MS/GS, CI-CP…, 1er cycle…)
                └── Class (PSA, CM2B, 6ème A…)


---

🗃 1️⃣ SCHÉMA PRISMA COMPLET


---

🎓 Level

model AcademicLevel {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String
  name            String   // Maternelle / Primaire / Secondaire
  orderIndex      Int
  isActive        Boolean  @default(true)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}


---

🎓 Cycle

model AcademicCycle {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String
  levelId         String
  name            String   // PS, MS, GS, CI, CP, etc.
  orderIndex      Int
  isActive        Boolean  @default(true)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}


---

🎓 Class

model AcademicClass {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String
  levelId         String
  cycleId         String

  name            String   // "CM2 A"
  code            String   // CM2A
  capacity        Int?
  roomId          String?
  mainTeacherId   String?

  languageTrack   String?  // FR / EN (si bilingue)
  isActive        Boolean   @default(true)

Dawes, [01/03/2026 13:51]
createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}


---

🔒 2️⃣ RÈGLES MÉTIER CRITIQUES


---

📌 Année scolaire obligatoire

Aucune classe ne peut exister sans :

tenantId

academicYearId



---

📌 Unicité

Une classe ne peut pas avoir le même code dans la même année scolaire

Un cycle appartient à un seul niveau

Un niveau appartient à une seule année



---

📌 Suppression interdite

Aucun DELETE physique.

Si classe contient :

élèves

emplois du temps

notes

matières


→ désactivation uniquement.


---

📌 Bilingue

Si option bilingue activée :

languageTrack obligatoire pour classe

FR & EN distinct

Pas de mélange de matières



---

📌 Capacité

Capacity facultative

Si définie → ne pas dépasser effectif



---

📌 Historique multi-année

Chaque année recrée sa structure.

Pas de duplication automatique invisible.


---

🎨 3️⃣ UI — STRUCTURE ACADÉMIQUE


---

Écran principal

--------------------------------------------------
| Structure académique                           |
--------------------------------------------------

[ Année scolaire ▼ ]

Niveaux
  ├─ Maternelle
  ├─ Primaire
  └─ Secondaire

Cliquer → voir cycles
Cliquer cycle → voir classes


---

Vue Classes

--------------------------------------------------
| CM2 — Année 2024-2025                         |
--------------------------------------------------

Classe | Capacité | Effectif | Salle | Responsable | Statut

CM2 A  | 45       | 42       | S01   | Mme K.      | Actif
CM2 B  | 40       | 38       | S02   | M. T.       | Actif

Actions :

Ajouter classe

Modifier

Désactiver

Voir élèves

Voir emploi du temps



---

🔄 4️⃣ OFFLINE-FIRST

Autorisé offline :

Consultation structure

Création classe (temporaire)

Modification capacity


Interdit offline :

Suppression

Modification massive

Réorganisation cycles


Sync serveur obligatoire validation.


---

🧠 5️⃣ INTÉGRATION ORION

ORION surveille :

Classe dépassant capacité

Classe sans responsable

Cycle sans classe

Niveau déséquilibré

Classes vides


Exemple :

🧠 ORION — Structure académique

🟡 CM2 A proche saturation (93%)
🔴 6ème B sans responsable
🟢 Structure équilibrée globalement


---

🔐 6️⃣ TRIGGERS SQL CRITIQUES

1️⃣ Empêcher suppression si dépendances

2️⃣ Empêcher duplication code classe

3️⃣ Empêcher modification année scolaire après création


---

🚀 7️⃣ PROMPT CURSOR — STRUCTURE ACADÉMIQUE

Copier-coller :


---

Tu es un architecte SaaS institutionnel multi-tenant.

OBJECTIF : Implémenter le sous-module Structure académique du Module 2 d’Academia Helm.

CONTRAINTES :

Multi-tenant strict

Année scolaire obligatoire

Compatible bilingue

Historique conservé

Aucun delete destructif

Intégration ORION

Compatible offline-first


BACKEND :

Implémenter modèles : AcademicLevel AcademicCycle AcademicClass

Valider unicité code classe

Empêcher suppression si dépendances

Intégrer audit logs

Intégrer alertes ORION


FRONTEND :

Vue hiérarchique dynamique

Création niveau/cycle/classe

Validation capacity

Indicateurs visuels saturation

Mode responsive


OBJECTIF FINAL : Créer une structure académique robuste, versionnée, institutionnelle et stable.


---

🏛 Résultat

Avec ce sous-module :

Tu as une base solide

Le module Finance peut se brancher dessus

Le module Examens devient cohérent

ORION obtient structure fiable



---
Excellent.
Si on renforce la Structure académique avec la gestion des salles, on passe d’un simple organigramme scolaire à une architecture physique + pédagogique intégrée.

L’objectif n’est pas juste “lister des salles”.
C’est :

contrôler l’occupation

éviter les conflits d’emploi du temps

tracer l’usage

surveiller la capacité réelle

intégrer ORION pour détection d’anomalies


On le fait au niveau institutionnel.


---

🏫 EXTENSION — GESTION DES SALLES INTÉGRÉE À LA STRUCTURE


---

🎯 OBJECTIF

Permettre à l’établissement de :

Définir toutes les salles

Classifier les types

Associer capacité réelle

Affecter salle à classe

Vérifier compatibilité capacité

Bloquer conflit horaire

Dawes, [01/03/2026 13:51]
Gérer maintenance & indisponibilités

Produire KPI d’occupation



---

🧱 1️⃣ ARCHITECTURE CONCEPTUELLE

La salle devient une entité transversale liée à :

Structure académique

Emploi du temps

Examens

Maintenance

ORION


Hiérarchie :

Tenant
 └── AcademicYear
      └── Rooms
      └── Classes
            └── Assigned Room


---

🗃 2️⃣ SCHÉMA PRISMA — SALLES


---

🏫 Salle principale

model Room {
  id              String   @id @default(uuid())
  tenantId        String
  name            String   // Salle 01
  code            String   // S01
  type            String   // CLASSROOM / LAB / LIBRARY / OFFICE
  capacity        Int
  building        String?
  floor           String?

  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}


---

🛠 Maintenance salle

model RoomMaintenance {
  id          String   @id @default(uuid())
  tenantId    String
  roomId      String
  startDate   DateTime
  endDate     DateTime?
  reason      String
  isActive    Boolean  @default(true)
}


---

🔄 Occupation horaire (prévention conflits)

model RoomSchedule {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String
  roomId          String
  dayOfWeek       Int
  startTime       String
  endTime         String
  classId         String?
}


---

🔒 3️⃣ RÈGLES MÉTIER CRITIQUES


---

📌 Capacité réelle

Si classe affectée à salle :

Class.effectif <= Room.capacity

Sinon → erreur.


---

📌 Salle en maintenance

Si maintenance active → blocage affectation.


---

📌 Conflit horaire

Une salle ne peut pas être utilisée :

même jour

même créneau

deux classes différentes


Validation obligatoire côté backend.


---

📌 Suppression

Salle liée à :

emploi du temps

classe

examen


→ désactivation uniquement.


---

📌 Multi-année

Room est globale tenant
RoomSchedule est lié à academicYear.


---

🎨 4️⃣ UI — GESTION DES SALLES


---

Onglet “Salles”

-----------------------------------------
| Gestion des salles                    |
-----------------------------------------

Salle | Type | Capacité | Bâtiment | Statut

S01   | Classe | 45 | Bloc A | Active
LAB1  | Laboratoire | 30 | Bloc B | Active

Actions :

Ajouter salle

Modifier

Planifier maintenance

Voir occupation



---

Vue détail salle

-----------------------------------------
Salle S01
-----------------------------------------
Capacité : 45
Bâtiment : Bloc A

Occupation semaine :
Lundi 8h-10h : CM2 A
Mardi 10h-12h : 6ème B


---

🧠 5️⃣ INTÉGRATION ORION

ORION doit détecter :

Classe surchargée par rapport salle

Salle sur-utilisée (> 90%)

Salle jamais utilisée

Maintenance prolongée

Salle sans affectation


Exemple :

🧠 ORION — Infrastructure

🟡 Salle S03 inutilisée depuis 30 jours
🔴 CM2 B dépasse capacité salle S02
🟢 Répartition équilibrée


---

🔄 6️⃣ OFFLINE-FIRST

Autorisé offline :

Consultation salles

Affectation classe simple


Interdit offline :

Maintenance critique

Réorganisation massive


Conflits vérifiés au sync serveur.


---

🔐 7️⃣ TRIGGERS SQL CRITIQUES

1️⃣ Empêcher suppression salle active

2️⃣ Empêcher double occupation

3️⃣ Vérifier capacité classe


---

🚀 8️⃣ PROMPT CURSOR — GESTION DES SALLES

Copier-coller :


---

Tu es un architecte SaaS institutionnel multi-tenant.

OBJECTIF : Renforcer la Structure académique d’Academia Helm avec la Gestion des salles intégrée.

CONTRAINTES :

Multi-tenant strict

Année scolaire obligatoire pour planning

Pas de delete destructif

Compatible emploi du temps

Compatible ORION

Compatible offline-first


BACKEND :

Implémenter modèles : Room RoomMaintenance RoomSchedule

Implémenter validation capacité

Implémenter validation conflits horaires

Empêcher suppression si dépendances

Intégrer ORION détection infrastructure


FRONTEND :

Vue liste salles

Vue détail salle

Planification maintenance

Indicateur capacité visuel

Indicateur occupation graphique


OBJECTIF FINAL : Créer une gestion d’infrastructure pédagogique intégrée, sécurisée et institutionnelle.


---

🏛 Résultat

Dawes, [01/03/2026 13:51]
Avec cette extension :

L’emploi du temps devient fiable

Les examens deviennent organisés

Les conflits disparaissent

ORION obtient une vue physique de l’école

Academia Helm dépasse 95% des logiciels scolaires



---
Excellent.
On entre maintenant dans le cœur académique réel.

La Structure définit l’ossature.
Les Matières & Programmes définissent le contenu pédagogique officiel.

Et tu as raison :
👉 On doit intégrer la notion de Séries (A, C, D, G2, etc.) pour le secondaire.

Sinon le module sera incomplet institutionnellement.

On construit ça proprement.


---

📚 SOUS-MODULE 2 — MATIÈRES & PROGRAMMES

(Fond pédagogique institutionnel — Multi-niveaux — Séries — Bilingue)


---

🎯 OBJECTIF

Permettre à l’établissement de :

Définir toutes les matières

Associer matières aux niveaux

Associer matières aux cycles

Associer matières aux classes

Gérer coefficients

Gérer volume horaire

Gérer séries (secondaire)

Gérer langue (FR / EN)

Attacher programme officiel

Historiser par année scolaire



---

🧱 ARCHITECTURE CONCEPTUELLE

Hiérarchie logique :

Tenant
 └── AcademicYear
      └── Level
           └── Cycle
                └── Series (si secondaire)
                     └── Subjects
                          └── ClassSubjectAssignment

⚠️ Les séries ne concernent que le secondaire.


---

🗃 1️⃣ SCHÉMA PRISMA COMPLET


---

🎓 Série (Secondaire uniquement)

model AcademicSeries {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String
  levelId         String   // Doit être secondaire
  name            String   // A, C, D, G2...
  description     String?
  isActive        Boolean  @default(true)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}


---

📚 Matière

model Subject {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String

  name            String
  code            String
  levelId         String
  cycleId         String?

  languageTrack   String?  // FR / EN si bilingue
  isOptional      Boolean  @default(false)
  isActive        Boolean  @default(true)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}


---

🎓 Matière par Série

model SeriesSubject {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String
  seriesId        String
  subjectId       String

  coefficient     Int
  weeklyHours     Int

  createdAt       DateTime @default(now())
}


---

🎓 Matière par Classe

model ClassSubject {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String
  classId         String
  subjectId       String

  coefficient     Int
  weeklyHours     Int

  createdAt       DateTime @default(now())
}


---

📄 Programme Officiel

model SubjectProgram {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String
  subjectId       String

  documentUrl     String
  version         String
  approvedById    String?
  approvedAt      DateTime?

  createdAt       DateTime @default(now())
}


---

🔒 2️⃣ RÈGLES MÉTIER CRITIQUES


---

📌 Année scolaire obligatoire

Toutes les matières sont liées à academicYearId.


---

📌 Unicité

Code matière unique par année

Série unique par niveau secondaire

Une matière ne peut être affectée deux fois à la même classe



---

📌 Séries

Les séries ne sont autorisées que si level = secondaire

Une classe secondaire peut être liée à une série

Une matière spécifique série ne peut être assignée hors série



---

📌 Bilingue

Si option bilingue activée :

languageTrack obligatoire

FR et EN distinct

Pas de mélange dans une même classe



---

📌 Coefficient

Obligatoire pour secondaire

Facultatif pour maternelle



---

📌 Suppression

Aucune suppression si matière utilisée dans :

Emploi du temps

Notes

Examens

Fiches pédagogiques


→ désactivation uniquement


---

🎨 3️⃣ UI — MATIÈRES & PROGRAMMES


---

Vue principale

Dawes, [01/03/2026 13:51]
------------------------------------------------
| Matières & Programmes                       |
------------------------------------------------

[ Année ▼ ] [ Niveau ▼ ] [ Série ▼ ]

Liste matières :

Code | Nom | Coeff | Heures | Série | Langue | Statut


---

Gestion séries

--------------------------------------------
| Séries — Secondaire                      |
--------------------------------------------

Série A — Littéraire
Série C — Scientifique
Série D — Scientifique Bio


---

Affectation matières

Sélection classe

Sélection matière

Définir coefficient

Définir volume horaire



---

Programme officiel

Upload PDF

Versionnement

Validation direction

Historique



---

🧠 4️⃣ INTÉGRATION ORION

ORION surveille :

Matière sans coefficient

Classe sans matière obligatoire

Série mal configurée

Volume horaire insuffisant

Déséquilibre pédagogique


Exemple :

🧠 ORION — Analyse pédagogique

🔴 1ère C : Physique coefficient non défini
🟡 Série D volume biologie inférieur norme
🟢 Structure matières cohérente


---

🔄 5️⃣ OFFLINE-FIRST

Autorisé offline :

Consultation

Affectation classe simple


Interdit offline :

Modification coefficient globale

Création série

Upload programme



---

🔐 6️⃣ TRIGGERS SQL CRITIQUES

1️⃣ Empêcher double affectation classe/matière
2️⃣ Empêcher suppression si utilisée
3️⃣ Empêcher série hors secondaire
4️⃣ Vérifier cohérence bilingue


---

🚀 7️⃣ PROMPT CURSOR — MATIÈRES & PROGRAMMES

Copier-coller :


---

Tu es un architecte SaaS institutionnel multi-tenant.

OBJECTIF : Implémenter le sous-module Matières & Programmes du Module 2 d’Academia Helm.

CONTRAINTES :

Multi-tenant strict

Année scolaire obligatoire

Compatible séries secondaire

Compatible bilingue

Pas de delete destructif

Intégration ORION

Compatible offline-first


INCLURE :

AcademicSeries

Subject

SeriesSubject

ClassSubject

SubjectProgram

Validation coefficient

Validation cohérence série

Validation bilingue

Versionnement programme officiel


FRONTEND :

Gestion matières par niveau

Gestion séries

Affectation classe

Upload programme officiel

Indicateurs ORION


OBJECTIF FINAL : Créer un moteur pédagogique structuré, conforme aux exigences institutionnelles secondaire et séries incluses.


---

🏛 Résultat

Avec ce sous-module :

Tu couvres secondaire complet

Tu rends examens cohérents

Tu permets bulletins structurés

ORION devient analytique pédagogique

Academia Helm atteint niveau institutionnel complet


--
Parfait.
On entre maintenant dans une zone stratégique.

Le module RH gère le contrat, la paie, la CNSS.
Mais ici, dans Organisation pédagogique, on gère :

👉 la capacité académique réelle de l’enseignant
👉 sa légitimité pédagogique
👉 sa charge d’enseignement
👉 son périmètre autorisé

C’est totalement différent.

On construit ça proprement.


---

👩‍🏫 SOUS-MODULE 3 — GESTION ACADÉMIQUE DES ENSEIGNANTS

(Académique uniquement — distinct du module RH)


---

🎯 OBJECTIF

Permettre à l’établissement de :

Définir les compétences pédagogiques d’un enseignant

Associer matières autorisées

Associer niveaux autorisés

Définir charge horaire maximale

Gérer disponibilité hebdomadaire

Vérifier surcharge

Vérifier conflit

Alimenter emploi du temps

Alimenter ORION pédagogique



---

🧱 ARCHITECTURE CONCEPTUELLE

Hiérarchie :

User (role = TEACHER)
 └── TeacherAcademicProfile
      ├── QualifiedSubjects
      ├── AuthorizedLevels
      ├── WeeklyAvailability
      ├── MaxWeeklyHours
      └── AcademicStatus

⚠️ Un enseignant peut exister en RH mais être inactif pédagogiquement.


---

🗃 1️⃣ SCHÉMA PRISMA COMPLET


---

👨‍🏫 Profil académique

model TeacherAcademicProfile {
  id               String   @id @default(uuid())
  tenantId         String
  academicYearId   String
  userId           String

  maxWeeklyHours   Int
  isActive         Boolean  @default(true)
  isSemainier      Boolean  @default(false)

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}


---

📚 Matières autorisées

Dawes, [01/03/2026 13:51]
model TeacherSubjectQualification {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String
  teacherId       String
  subjectId       String

  certified       Boolean  @default(false)
}


---

🎓 Niveaux autorisés

model TeacherLevelAuthorization {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String
  teacherId       String
  levelId         String
}


---

🕒 Disponibilités hebdomadaires

model TeacherAvailability {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String
  teacherId       String
  dayOfWeek       Int
  startTime       String
  endTime         String
}


---

📊 Charge horaire réelle

(sera calculée automatiquement via affectations)


---

🔒 2️⃣ RÈGLES MÉTIER CRITIQUES


---

📌 Année scolaire obligatoire

Chaque profil académique est lié à l’année.


---

📌 Double validation

Un enseignant ne peut :

être affecté à une matière non qualifiée

être affecté à un niveau non autorisé



---

📌 Charge maximale

Total heures affectées ≤ maxWeeklyHours

Sinon → blocage backend.


---

📌 Disponibilité

Un enseignant ne peut être placé en emploi du temps :

hors créneaux autorisés



---

📌 Désactivation

Si enseignant quitte établissement :

profil académique désactivé

historique conservé



---

🎨 3️⃣ UI — GESTION ACADÉMIQUE ENSEIGNANTS


---

Vue principale

------------------------------------------------
| Gestion académique enseignants              |
------------------------------------------------

Nom | Charge max | Charge actuelle | Statut

M. K. | 20h | 18h | Actif
Mme T. | 18h | 22h | 🔴 Surcharge


---

Vue détail enseignant

----------------------------------------
Profil pédagogique — Mme T.
----------------------------------------

Charge max : 18h
Charge actuelle : 22h 🔴

Matières autorisées :
- Mathématiques (certifiée)
- Physique

Niveaux :
- Secondaire 1er cycle
- Secondaire 2nd cycle

Disponibilités :
Lundi 8h-12h
Mardi 10h-16h


---

🧠 4️⃣ INTÉGRATION ORION

ORION surveille :

Enseignant surchargé

Enseignant sous-utilisé

Enseignant affecté hors compétence

Manque matière critique

Déséquilibre charge globale


Exemple :

🧠 ORION — Analyse enseignants

🔴 Mme T. surcharge 4h
🟡 6ème sans enseignant Physique
🟢 Répartition globale équilibrée


---

🔄 5️⃣ OFFLINE-FIRST

Autorisé offline :

Consultation profil

Modification disponibilité


Interdit offline :

Modification charge max

Affectation majeure


Sync serveur valide règles.


---

🔐 6️⃣ TRIGGERS SQL CRITIQUES

1️⃣ Empêcher affectation hors qualification
2️⃣ Empêcher dépassement maxWeeklyHours
3️⃣ Empêcher suppression si affectations existantes
4️⃣ Vérifier cohérence bilingue


---

🚀 7️⃣ PROMPT CURSOR — GESTION ACADÉMIQUE ENSEIGNANTS

Copier-coller :


---

Tu es un architecte SaaS institutionnel multi-tenant.

OBJECTIF : Implémenter le sous-module Gestion académique enseignants du Module 2 d’Academia Helm.

CONTRAINTES :

Multi-tenant strict

Année scolaire obligatoire

Distinction RH / Académique

Validation charge horaire

Validation qualification matière

Validation niveau autorisé

Compatible ORION

Compatible offline-first

Aucun delete destructif


BACKEND :

Implémenter modèles : TeacherAcademicProfile TeacherSubjectQualification TeacherLevelAuthorization TeacherAvailability

Implémenter calcul charge horaire

Implémenter validations automatiques

Intégrer ORION surveillance


FRONTEND :

Vue liste enseignants académique

Vue détail profil pédagogique

Indicateur surcharge visuel

Gestion disponibilités calendrier

Alertes ORION visibles


OBJECTIF FINAL : Créer un moteur académique enseignant robuste, sécurisé et conforme aux standards institutionnels.


---

🏛 Résultat

Avec ce sous-module :

L’emploi du temps devient fiable

Les examens deviennent cohérents

Les surcharges sont détectées

ORION devient un vrai assistant pédagogique

Academia Helm monte en gamme institutionnelle



---
Parfait.
On entre dans le moteur opérationnel pédagogique.

Dawes, [01/03/2026 13:51]
La Structure est prête.
Les Matières sont définies.
Les Enseignants sont qualifiés.

👉 Maintenant on relie tout.

C’est le sous-module qui alimente :

Emploi du temps

Cahier de texte

Examens

Bulletins

ORION


On le construit comme un moteur contractuel académique.


---

🎯 SOUS-MODULE 4 — AFFECTATIONS & CHARGES HORAIRES

(Cœur opérationnel pédagogique — Academia Helm)


---

🎯 OBJECTIF

Permettre de :

Affecter un enseignant à :

une classe

une matière

une série (si secondaire)


Définir :

volume horaire hebdomadaire

période d’affectation


Vérifier :

qualification

niveau autorisé

surcharge

disponibilité


Alimenter automatiquement :

charge réelle enseignant

futur emploi du temps

ORION pédagogique




---

🧱 ARCHITECTURE CONCEPTUELLE

TeacherAcademicProfile
   + Subject
   + AcademicClass
   + AcademicYear
   = TeachingAssignment

Chaque affectation est une unité pédagogique contractuelle.


---

🗃 1️⃣ SCHÉMA PRISMA COMPLET


---

📘 Affectation principale

model TeachingAssignment {
  id                String   @id @default(uuid())
  tenantId          String
  academicYearId    String

  teacherId         String
  classId           String
  subjectId         String
  seriesId          String?   // obligatoire si secondaire série

  weeklyHours       Int
  startDate         DateTime
  endDate           DateTime?

  isActive          Boolean   @default(true)

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}


---

🔒 2️⃣ RÈGLES MÉTIER CRITIQUES


---

📌 Année scolaire obligatoire

Toute affectation est liée à academicYearId.


---

📌 Qualification obligatoire

Un enseignant ne peut être affecté que si :

subjectId ∈ TeacherSubjectQualification

levelId ∈ TeacherLevelAuthorization


Sinon → rejet API.


---

📌 Surcharge interdite

Somme(weeklyHours) ≤ maxWeeklyHours.

Validation backend obligatoire.


---

📌 Série obligatoire

Si classe secondaire liée à série :

seriesId doit être cohérent.


---

📌 Unicité

Une combinaison :

teacherId + classId + subjectId + academicYearId

ne peut exister qu’une fois.


---

📌 Période

Affectation peut être temporaire

Historique conservé

Pas de suppression si déjà utilisée



---

📊 3️⃣ CALCUL CHARGE HORAIRE AUTOMATIQUE

Charge réelle = somme weeklyHours de toutes les affectations actives.

Doit être recalculée :

à chaque nouvelle affectation

à chaque modification

à chaque désactivation



---

🎨 4️⃣ UI — AFFECTATIONS & CHARGES


---

Vue globale

------------------------------------------------
| Affectations pédagogiques                    |
------------------------------------------------

Enseignant | Classe | Matière | Heures | Statut

Mme K      | 6ème A | Maths   | 4h     | Actif
M. T       | 1ère C | Physique| 6h     | Actif


---

Vue charge enseignant

---------------------------------------
Mme T — Charge pédagogique
---------------------------------------

Max : 18h
Actuelle : 22h 🔴

Détail :
- 1ère C — Physique — 6h
- Terminale D — Physique — 8h
- 2nde C — Maths — 8h


---

Formulaire affectation

Champs :

Enseignant

Classe

Série (si secondaire)

Matière

Volume horaire

Date début

Date fin


Validation en temps réel :

Charge restante

Qualification

Niveau



---

🧠 5️⃣ INTÉGRATION ORION

ORION doit surveiller :

Enseignant surchargé

Classe sans enseignant matière critique

Série déséquilibrée

Charge moyenne trop faible

Affectation temporaire expirée


Exemple :

🧠 ORION — Affectations

🔴 Mme T. surcharge 4h
🟡 1ère C sans enseignant SVT
🟢 Couverture pédagogique globale 95%


---

🔄 6️⃣ OFFLINE-FIRST

Autorisé offline :

Consultation affectations

Création provisoire


Interdit offline :

Validation finale surcharge

Modification massive


Sync serveur valide règles.


---

🔐 7️⃣ TRIGGERS SQL CRITIQUES

1️⃣ Empêcher surcharge :

IF total_hours > maxWeeklyHours THEN RAISE EXCEPTION;

2️⃣ Empêcher affectation hors qualification

3️⃣ Empêcher suppression si emploi du temps existe

4️⃣ Vérifier cohérence série secondaire


---

🚀 8️⃣ PROMPT CURSOR — AFFECTATIONS & CHARGES

Dawes, [01/03/2026 13:51]
Copier-coller :


---

Tu es un architecte SaaS institutionnel multi-tenant.

OBJECTIF : Implémenter le sous-module Affectations & Charges horaires du Module 2 d’Academia Helm.

CONTRAINTES :

Multi-tenant strict

Année scolaire obligatoire

Validation qualification matière

Validation niveau autorisé

Validation surcharge horaire

Validation cohérence série secondaire

Historique conservé

Compatible ORION

Compatible offline-first

Aucun delete destructif


BACKEND :

Implémenter modèle TeachingAssignment

Implémenter calcul charge automatique

Implémenter validations strictes

Implémenter triggers sécurité

Intégrer ORION détection anomalies


FRONTEND :

Vue globale affectations

Vue charge enseignant

Indicateur surcharge visuel

Formulaire validation temps réel

Alertes ORION visibles


OBJECTIF FINAL : Créer un moteur d’affectation pédagogique fiable, sécurisé et institutionnel.


---

🏛 Résultat

Avec ce sous-module :

L’emploi du temps peut être généré

Les examens sont cohérents

Les surcharges sont bloquées

ORION devient proactif

Academia Helm devient moteur pédagogique sérieux

Dawes, [01/03/2026 14:12]
Excellent.
On entre maintenant dans le module le plus sensible pédagogiquement.

Si l’emploi du temps est mal conçu :

conflits permanents

surcharge enseignants

salles mal utilisées

désorganisation totale


Si on le fait bien, Academia Helm devient moteur d’orchestration académique.

On va le concevoir comme un système intelligent, conflict-aware, versionné, et compatible offline-first.


---

🧠 SOUS-MODULE 5 — EMPLOI DU TEMPS INTELLIGENT

(Scheduling Engine Institutionnel — Multi-niveaux — Multi-séries — Multi-salles)


---

🎯 OBJECTIF

Permettre :

Génération automatique ou manuelle

Détection conflits :

enseignant

salle

classe


Respect charge horaire

Respect disponibilités

Respect capacité salle

Versionnement

Export officiel

Intégration ORION



---

🧱 ARCHITECTURE CONCEPTUELLE

L’emploi du temps repose sur :

TeachingAssignment
+ Room
+ TeacherAvailability
+ AcademicClass
+ AcademicYear
= TimetableSlot

Chaque créneau est une unité verrouillée.


---

🗃 1️⃣ SCHÉMA PRISMA COMPLET


---

🗓 Timetable principal

model Timetable {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String
  classId         String
  version         Int
  isActive        Boolean  @default(true)

  createdById     String
  createdAt       DateTime @default(now())
}


---

⏱ Créneaux horaires

model TimetableSlot {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String
  timetableId     String

  dayOfWeek       Int
  startTime       String
  endTime         String

  teacherId       String
  subjectId       String
  classId         String
  roomId          String?

  createdAt       DateTime @default(now())
}


---

🔒 2️⃣ RÈGLES MÉTIER CRITIQUES


---

📌 Conflit enseignant

Un enseignant ne peut avoir deux slots :

même jour

même heure



---

📌 Conflit salle

Une salle ne peut être utilisée par deux classes au même moment.


---

📌 Conflit classe

Une classe ne peut avoir deux matières au même créneau.


---

📌 Respect affectation

Chaque slot doit correspondre à un TeachingAssignment valide.


---

📌 Respect charge horaire

Total heures planifiées = weeklyHours assignées.


---

📌 Respect disponibilité enseignant

Slot doit être inclus dans TeacherAvailability.


---

📌 Versionnement

Chaque modification majeure crée :

version + 1
ancienne version conservée


---

⚙️ 3️⃣ GÉNÉRATION AUTOMATIQUE (ALGORITHME)

Stratégie simple mais robuste :

1. Lire TeachingAssignments


2. Créer grille semaine


3. Placer matières à volume horaire requis


4. Vérifier conflits à chaque placement


5. Replacer si conflit


6. Bloquer si impossibilité



Mode :

Auto-génération

Manuel assisté

Drag & Drop intelligent



---

🎨 4️⃣ UI — EMPLOI DU TEMPS


---

Vue classe

------------------------------------------------
| Emploi du temps — 6ème A                    |
------------------------------------------------

        L   M   M   J   V

8-9h    M   P   M   S   A
9-10h   P   M   S   A   M

Indicateurs :

🟢 valide
🟡 conflit mineur
🔴 conflit bloquant


---

Vue enseignant

-----------------------------------------
Mme K — Emploi du temps
-----------------------------------------


---

Mode édition

Drag & drop

Auto-détection conflits

Suggestion alternative



---

🧠 5️⃣ INTÉGRATION ORION

ORION analyse :

Déséquilibre matière

Surcharge quotidienne enseignant

Classe trop chargée en fin journée

Salle sur-utilisée

Heures creuses excessives


Exemple :

🧠 ORION — Analyse emploi du temps

🔴 Mme T. 6h consécutives le lundi
🟡 Salle S01 utilisée 100%
🟢 Répartition matières équilibrée


---

🔄 6️⃣ OFFLINE-FIRST

Autorisé offline :

Consultation

Modification locale


Sync serveur :

Validation conflits

Recalcule cohérence globale



---

🔐 7️⃣ TRIGGERS SQL CRITIQUES

1️⃣ Empêcher double slot enseignant
2️⃣ Empêcher double slot salle
3️⃣ Empêcher double slot classe
4️⃣ Vérifier cohérence TeachingAssignment


---

🚀 8️⃣ PROMPT CURSOR — EMPLOI DU TEMPS INTELLIGENT

Copier-coller :


---

Dawes, [01/03/2026 14:12]
Tu es un architecte SaaS institutionnel spécialisé en scheduling engine multi-tenant.

OBJECTIF : Implémenter le sous-module Emploi du temps intelligent du Module 2 d’Academia Helm.

CONTRAINTES :

Multi-tenant strict

Année scolaire obligatoire

Validation conflits enseignant

Validation conflits salle

Validation conflits classe

Validation TeachingAssignment

Versionnement obligatoire

Compatible ORION

Compatible offline-first

Aucun delete destructif


BACKEND :

Implémenter modèles : Timetable TimetableSlot

Implémenter moteur génération automatique

Implémenter détection conflits

Implémenter versionnement

Intégrer ORION analyse planning


FRONTEND :

Vue grille hebdomadaire

Vue classe

Vue enseignant

Drag & drop

Indicateurs conflit temps réel


OBJECTIF FINAL : Créer un moteur d’orchestration pédagogique intelligent, fiable, conflict-aware et institutionnel.


---

🏛 Résultat

Avec ce sous-module :

L’école fonctionne sans chaos

Les enseignants sont protégés

Les salles sont optimisées

ORION devient assistant organisationnel

Academia Helm dépasse largement les solutions classiques



---

Excellent.
Nous entrons ici dans un module hautement stratégique.

L’Espace pédagogique enseignant n’est pas un simple formulaire.
C’est :

un espace de production pédagogique

un espace de validation hiérarchique

un espace d’archivage institutionnel

un espace d’analyse ORION

un outil de conformité académique


Et tu as posé une exigence importante :

> 🔒 Platform Owner, Platform Admin et Promoteur doivent pouvoir consulter en lecture seule.



Donc on va concevoir :

isolation forte des données

RBAC strict

audit complet

versionnement intelligent

signature numérique interne


On construit ça proprement.


---

🧠 SOUS-MODULE 6 — ESPACE PÉDAGOGIQUE ENSEIGNANT

(Moteur pédagogique institutionnel — Workflow validé — Archivage signé)


---

🎯 OBJECTIF

Permettre à chaque enseignant de :

Préparer ses fiches pédagogiques

Rédiger son cahier journal

Renseigner son cahier de texte

Remplir le cahier du semainier

Joindre supports pédagogiques

Envoyer pour validation

Recevoir commentaires direction

Versionner ses documents

Signer numériquement ses productions


Permettre à :

Directeur : validation / commentaire

Promoteur : lecture

Platform Admin : lecture

Platform Owner : lecture globale multi-tenant



---

🧱 ARCHITECTURE CONCEPTUELLE

Teacher
 └── TeacherAcademicProfile
      └── PedagogicalWorkspace
            ├── LessonPlan (Fiche pédagogique)
            ├── TeachingJournal (Cahier journal)
            ├── ClassLog (Cahier de texte)
            ├── WeeklyReport (Semainier)
            ├── Attachments
            ├── ValidationWorkflow
            └── DigitalSignature

Chaque élément est :

lié à une classe

lié à une matière

lié à une affectation

lié à une année scolaire



---

🗃 1️⃣ SCHÉMA PRISMA COMPLET


---

📘 Fiche pédagogique

model LessonPlan {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String
  teacherId       String
  classId         String
  subjectId       String

  title           String
  objectives      String
  content         String
  methodology     String
  materials       String
  evaluation      String

  status          String   @default("DRAFT") // DRAFT / SUBMITTED / APPROVED / REJECTED
  version         Int      @default(1)

  submittedAt     DateTime?
  approvedAt      DateTime?
  approvedById    String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}


---

📕 Cahier journal

model TeachingJournal {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String
  teacherId       String
  weekStartDate   DateTime

  content         String
  status          String   @default("DRAFT")

  submittedAt     DateTime?
  approvedAt      DateTime?
  approvedById    String?

  createdAt       DateTime @default(now())
}


---

📗 Cahier de texte

Dawes, [01/03/2026 14:12]
model ClassLog {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String
  teacherId       String
  classId         String
  subjectId       String
  lessonDate      DateTime

  topic           String
  homework        String?
  durationHours   Int

  createdAt       DateTime @default(now())
}


---

📙 Cahier du semainier

model WeeklyReport {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String
  teacherId       String
  weekStartDate   DateTime

  summary         String
  issues          String?
  recommendations String?

  status          String   @default("DRAFT")
  submittedAt     DateTime?
  approvedAt      DateTime?

  createdAt       DateTime @default(now())
}


---

📎 Pièces jointes

model PedagogicalAttachment {
  id          String   @id @default(uuid())
  entityType  String   // LESSON_PLAN, JOURNAL...
  entityId    String
  fileUrl     String
  uploadedAt  DateTime @default(now())
}


---

🔏 Signature numérique interne

model PedagogicalSignature {
  id              String   @id @default(uuid())
  entityType      String
  entityId        String
  signedById      String
  signedAt        DateTime @default(now())
  signatureHash   String
}


---

🔒 2️⃣ WORKFLOW DE VALIDATION

Étapes :

1. DRAFT


2. SUBMITTED


3. DIRECTOR_REVIEW


4. APPROVED / REJECTED



Règles :

Après APPROVED → lecture seule

Toute modification crée nouvelle version

Historique conservé



---

🎨 3️⃣ UI — ESPACE ENSEIGNANT


---

Tableau de bord enseignant

-----------------------------------------
Espace pédagogique — Mme T.
-----------------------------------------

Fiches pédagogiques
Cahier journal
Cahier de texte
Cahier du semainier
Supports
Statistiques ORION

Indicateurs :

🟡 En attente validation
🔴 Rejeté
🟢 Approuvé


---

Vue Directeur

-----------------------------------------
Validation pédagogique
-----------------------------------------

Enseignant | Document | Classe | Statut

Actions :

Commenter

Approuver

Rejeter

Voir historique versions



---

🧠 4️⃣ INTÉGRATION ORION

ORION analyse :

Retard soumission

Manque fiches

Classe sans cahier de texte

Enseignant inactif

Qualité rédaction (longueur / cohérence)


Exemple :

🧠 ORION — Suivi pédagogique

🔴 Mme T. n’a soumis aucune fiche cette semaine
🟡 CM2 A sans cahier de texte lundi
🟢 Soumission globale 92%


---

🔐 5️⃣ PERMISSIONS RBAC

Rôle Action

Enseignant CRUD personnel
Directeur Lecture + validation
Promoteur Lecture seule
Platform Admin Lecture seule
Platform Owner Lecture globale multi-tenant


⚠️ Aucune modification possible hors enseignant & directeur.


---

🔄 6️⃣ OFFLINE-FIRST

Autorisé offline :

Création DRAFT

Modification DRAFT

Lecture locale


Interdit offline :

Validation officielle

Signature définitive



---

🔐 7️⃣ TRIGGERS CRITIQUES

Empêcher modification après APPROVED

Empêcher suppression document validé

Générer signature hash automatique

Empêcher double validation



---

🚀 8️⃣ PROMPT CURSOR — ESPACE PÉDAGOGIQUE

Copier-coller :


---

Tu es un architecte SaaS institutionnel spécialisé en gestion pédagogique multi-tenant.

OBJECTIF : Implémenter le sous-module Espace pédagogique enseignant d’Academia Helm.

CONTRAINTES :

Multi-tenant strict

Année scolaire obligatoire

Versionnement obligatoire

Workflow validation strict

Signature numérique interne

Lecture seule pour Promoteur / Platform Admin / Platform Owner

Compatible ORION

Compatible offline-first

Aucun delete destructif


INCLURE :

LessonPlan

TeachingJournal

ClassLog

WeeklyReport

PedagogicalAttachment

PedagogicalSignature

Workflow validation

Historique versions

Audit logs


FRONTEND :

Dashboard enseignant

Vue validation direction

Indicateurs statut visuels

Notifications automatiques

Lecture globale admin


OBJECTIF FINAL : Créer un espace pédagogique intelligent, institutionnel, versionné et auditable.


---

🏛 Résultat

Avec ce sous-module :

L’enseignant devient structuré

Le directeur contrôle réellement

Le promoteur a une vision globale

Dawes, [01/03/2026 14:12]
ORION devient assistant pédagogique

Academia Helm atteint un niveau institutionnel rare



---
Excellent.
On entre maintenant dans la tour de contrôle pédagogique.

L’Espace enseignant permet de produire.
Le module Contrôle pédagogique permet de superviser, analyser, décider.

Ce n’est pas une simple liste de documents.
C’est un centre de pilotage académique consolidé.

On le construit comme un cockpit directionnel institutionnel.


---

🧠 SOUS-MODULE 7 — CONTRÔLE PÉDAGOGIQUE DIRECTION

(Supervision consolidée — Lecture intelligente — Alertes ORION)


---

🎯 OBJECTIF

Permettre au :

Directeur

Promoteur (lecture)

Platform Admin (lecture)

Platform Owner (lecture globale multi-tenant)


de :

Voir l’état global de la production pédagogique

Identifier retards et anomalies

Contrôler couverture horaire réelle

Suivre validations

Visualiser performance enseignant

Recevoir alertes ORION

Produire rapports institutionnels



---

🧱 ARCHITECTURE CONCEPTUELLE

Ce module agrège :

LessonPlan
TeachingJournal
ClassLog
WeeklyReport
TeachingAssignment
TimetableSlot

Il ne crée pas de nouvelle entité métier lourde.
Il consolide.


---

📊 1️⃣ TABLES D’AGRÉGATION (OPTIONNELLES MAIS RECOMMANDÉES)

Pour performance et analytics :

model PedagogicalKpiSnapshot {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String
  teacherId       String?
  classId         String?

  lessonPlanRate  Float
  journalRate     Float
  classLogRate    Float
  weeklyReportRate Float

  calculatedAt    DateTime @default(now())
}

Peut être recalculé par cron ORION.


---

🔍 2️⃣ TABLEAU DE BORD CONSOLIDÉ DIRECTION


---

🟢 Indicateurs globaux

% fiches soumises

% fiches validées

% cahiers journal à jour

% cahiers de texte complétés

% semainiers validés

Enseignants en retard

Classes non couvertes



---

🟡 Indicateurs par enseignant

| Enseignant | Fiches | Journal | Cahier texte | Retards | Statut |


---

🔴 Indicateurs par classe

| Classe | Matières couvertes | Heures assurées | Anomalies |


---

🎨 3️⃣ UI — DASHBOARD CONTRÔLE


---

----------------------------------------------------
| Contrôle pédagogique — Année 2024-2025          |
----------------------------------------------------

[ Vue globale ]
[ Par enseignant ]
[ Par classe ]
[ Alertes ORION ]
[ Rapports exportables ]


---

🔎 Vue globale

Cartes KPI :

92% fiches validées

85% cahiers journal soumis

3 enseignants en retard

1 classe sans couverture complète


Graphiques :

Evolution hebdomadaire

Comparaison par cycle

Couverture horaire



---

🔍 Vue par enseignant

Mme T.

Fiches : 4/5
Journal : validé
Cahier texte : incomplet lundi
Semainier : en attente


---

🔍 Vue par classe

6ème A

Couverture matières : 100%
Heures prévues : 28
Heures assurées : 24 🔴


---

🧠 4️⃣ INTÉGRATION ORION

ORION devient analytique.

Il détecte :

Enseignant récurrent en retard

Classe sans cahier de texte

Déséquilibre matière

Absence production pédagogique

Corrélation performance académique


Exemple :

🧠 ORION — Supervision pédagogique

🔴 Mme K. 3 retards consécutifs
🟡 6ème B cahier texte incomplet 2 jours
🟢 Production globale satisfaisante


---

🔐 5️⃣ PERMISSIONS

Rôle Accès

Directeur Lecture + export
Promoteur Lecture
Platform Admin Lecture
Platform Owner Lecture globale
Enseignant Aucun accès



---

🔒 6️⃣ RÈGLES MÉTIER CRITIQUES

Année scolaire obligatoire

Données en lecture seule

Export PDF institutionnel signé

Historique consultable

Aucun delete



---

🔄 7️⃣ OFFLINE-FIRST

Autorisé offline :

Consultation des KPI locaux


Interdit offline :

Validation

Export officiel

Analyse globale multi-classe



---

📄 8️⃣ RAPPORTS EXPORTABLES

Types :

Rapport hebdomadaire pédagogique

Rapport mensuel production

Rapport individuel enseignant

Rapport classe

Rapport institutionnel complet


Inclut :

Logo

Cachet numérique

Signature direction

QR vérification



---

🚀 9️⃣ PROMPT CURSOR — CONTRÔLE PÉDAGOGIQUE

Copier-coller :


---

Tu es un architecte SaaS institutionnel spécialisé en supervision pédagogique multi-tenant.

Dawes, [01/03/2026 14:12]
OBJECTIF : Implémenter le sous-module Contrôle pédagogique direction du Module 2 d’Academia Helm.

CONTRAINTES :

Multi-tenant strict

Année scolaire obligatoire

Lecture seule

Compatible ORION

Compatible offline-first

Aucun delete destructif

Export institutionnel signé


INCLURE :

Dashboard consolidé

Vue par enseignant

Vue par classe

Agrégation KPI

Modèle PedagogicalKpiSnapshot

Intégration ORION

Export PDF officiel


FRONTEND :

Cartes KPI

Graphiques évolutifs

Filtres par cycle / niveau

Indicateurs visuels

Section alertes ORION


OBJECTIF FINAL : Créer une tour de contrôle pédagogique institutionnelle, analytique et décisionnelle.


---

🏛 Résultat

Avec ce module :

Le directeur pilote réellement

Le promoteur a visibilité stratégique

ORION devient assistant pédagogique

L’école passe en mode gouvernance active

Academia Helm devient plateforme de pilotage éducatif



---
Parfait.
On entre ici dans la couche stratégique différenciante.

L’Analytique pédagogique ORION avancée transforme Academia Helm en plateforme de pilotage éducatif prédictive — pas un simple logiciel administratif.

Ici, ORION :

ne se contente plus d’alerter,

il corrèle,

il projette,

il anticipe,

il recommande.



---

🧠 MODULE — ANALYTIQUE PÉDAGOGIQUE ORION AVANCÉE

(Moteur d’intelligence institutionnelle — Analyse corrélative — Projection académique)


---

🎯 OBJECTIF

Permettre à la direction et au promoteur :

d’anticiper les baisses de performance

d’identifier les fragilités pédagogiques

de détecter les déséquilibres matières

de mesurer la cohérence production ↔ résultats

de prédire les risques académiques


Sans jamais modifier les données.

Lecture seule.
Analyse uniquement.


---

🧱 ARCHITECTURE CONCEPTUELLE

ORION consomme :

Students
Grades
LessonPlans
TeachingJournals
ClassLogs
WeeklyReports
Attendance
TeacherAssignments
TimetableSlots
AcademicTerms

Et produit :

OrionPedagogicalInsight
OrionRiskFlag
OrionRecommendation
OrionForecast


---

🗃 1️⃣ SCHÉMA PRISMA — ANALYTIQUE ORION


---

🔎 Insight généré

model OrionPedagogicalInsight {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String

  scopeType       String   // SCHOOL / CLASS / TEACHER / SUBJECT
  scopeId         String?

  insightType     String   // RISK / TREND / CORRELATION / FORECAST
  severity        String   // LOW / MEDIUM / HIGH / CRITICAL

  title           String
  description     String
  confidenceScore Float

  createdAt       DateTime @default(now())
}


---

🚨 Flag de risque

model OrionRiskFlag {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String

  entityType      String   // STUDENT / CLASS / TEACHER
  entityId        String

  riskCategory    String   // PERFORMANCE / DISCIPLINE / ATTENDANCE
  riskScore       Float
  level           String   // GREEN / YELLOW / RED

  createdAt       DateTime @default(now())
}


---

📈 Prévision académique

model OrionForecast {
  id              String   @id @default(uuid())
  tenantId        String
  academicYearId  String

  entityType      String   // CLASS / STUDENT / SUBJECT
  entityId        String

  predictedAverage Float
  riskProbability  Float

  generatedAt     DateTime @default(now())
}


---

🧠 2️⃣ TYPES D’ANALYSES AVANCÉES


---

1️⃣ Corrélation Production ↔ Résultats

Analyse :

taux de fiches validées

régularité cahier texte

volume horaire réel

moyennes classe


Détection :

> Classe 4ème A : baisse moyenne mathématiques
corrélée à 3 semaines de fiches non soumises.




---

2️⃣ Risque élève

Variables :

absences

moyenne cumulée

incidents disciplinaires

retard paiement (impact motivation indirecte)


Sortie :

> Élève A. — risque échec : 78% — catégorie rouge




---

3️⃣ Performance enseignant

régularité pédagogique

performance moyenne classes

évolution annuelle

conformité programme



---

4️⃣ Déséquilibre matière

heures prévues vs heures assurées

surcharge horaire

matière sous-représentée



---

5️⃣ Projection fin de trimestre

ORION estime :

moyenne prévisionnelle

Dawes, [01/03/2026 14:12]
taux réussite estimé

taux échec probable



---

🎨 3️⃣ UI — DASHBOARD ORION AVANCÉ


---

------------------------------------------
ORION — Analytique pédagogique avancée
------------------------------------------

[ Vue établissement ]
[ Risques ]
[ Corrélations ]
[ Prévisions ]
[ Recommandations ]


---

🔴 Section Risques

3 élèves risque élevé

1 classe déséquilibrée

2 enseignants en anomalie production



---

📈 Section Prévisions

Graphique projection moyenne trimestre


---

🧠 Section Recommandations

Exemple :

Renforcer suivi 5ème B en mathématiques

Programmer réunion pédagogique urgent

Vérifier surcharge horaire professeur X



---

🔐 4️⃣ RÈGLES STRICTES

Lecture seule absolue

Pas d’action directe

Historique analyses conservé

Pas de suppression possible

Accessible uniquement direction+



---

🔄 5️⃣ OFFLINE-FIRST

Autorisé offline :

Consultation derniers insights


Interdit offline :

Génération nouvelle analyse

Calcul prédictif



---

⚙️ 6️⃣ MOTEUR ORION (LOGIQUE)

Cycle :

1. Collecte données


2. Agrégation KPI


3. Analyse corrélative


4. Calcul score risque


5. Génération insight


6. Stockage snapshot



Fréquence :

Quotidienne

Hebdomadaire

À la demande direction



---

🧠 7️⃣ EXEMPLES DE FORMULES


---

Score risque élève

RiskScore =
  (AbsenceRate * 0.3)
+ (GradeDecline * 0.4)
+ (DisciplineEvents * 0.2)
+ (HomeworkCompletionRate * -0.1)


---

Corrélation pédagogique

CorrelationScore =
  LessonPlanCompliance
  vs
  ClassAverageTrend


---

🚀 8️⃣ PROMPT CURSOR — ORION ANALYTIQUE AVANCÉ

Copier-coller :


---

Tu es un architecte IA senior spécialisé en SaaS institutionnel multi-tenant.

OBJECTIF : Implémenter le module Analytique pédagogique ORION avancée dans Academia Helm.

CONTRAINTES :

Lecture seule

Multi-tenant strict

Année scolaire obligatoire

Historique non supprimable

Compatible offline-first

Compatible RBAC

Pas d’action automatique sur données


INCLURE :

OrionPedagogicalInsight

OrionRiskFlag

OrionForecast

Moteur calcul corrélation

Moteur score risque

Dashboard ORION avancé

Graphiques projection

Recommandations intelligentes


FRONTEND :

UI analytique premium

Cartes risques

Graphiques tendances

Filtres cycles

Section recommandations


OBJECTIF FINAL : Transformer Academia Helm en plateforme de pilotage éducatif prédictive.


---

🏛 Résultat stratégique

Avec ORION avancé :

La direction anticipe

Le promoteur décide sur données

L’école devient gouvernée scientifiquement

Tu crées un différenciateur marché massif

Aucun concurrent local ne sera à ce niveau
