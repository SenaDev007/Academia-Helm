Excellent.
Nous entrons ici dans un module **hautement stratégique**.

L’Espace pédagogique enseignant n’est pas un simple formulaire.
C’est :

* un espace de production pédagogique
* un espace de validation hiérarchique
* un espace d’archivage institutionnel
* un espace d’analyse ORION
* un outil de conformité académique

Et tu as posé une exigence importante :

> 🔒 Platform Owner, Platform Admin et Promoteur doivent pouvoir consulter en lecture seule.

Donc on va concevoir :

* isolation forte des données
* RBAC strict
* audit complet
* versionnement intelligent
* signature numérique interne

On construit ça proprement.

---

# 🧠 SOUS-MODULE 6 — ESPACE PÉDAGOGIQUE ENSEIGNANT

*(Moteur pédagogique institutionnel — Workflow validé — Archivage signé)*

---

# 🎯 OBJECTIF

Permettre à chaque enseignant de :

* Préparer ses fiches pédagogiques
* Rédiger son cahier journal
* Renseigner son cahier de texte
* Remplir le cahier du semainier
* Joindre supports pédagogiques
* Envoyer pour validation
* Recevoir commentaires direction
* Versionner ses documents
* Signer numériquement ses productions

Permettre à :

* Directeur : validation / commentaire
* Promoteur : lecture
* Platform Admin : lecture
* Platform Owner : lecture globale multi-tenant

---

# 🧱 ARCHITECTURE CONCEPTUELLE

```text
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
```

Chaque élément est :

* lié à une classe
* lié à une matière
* lié à une affectation
* lié à une année scolaire

---

# 🗃 1️⃣ SCHÉMA PRISMA COMPLET

---

## 📘 Fiche pédagogique

```prisma
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
```

---

## 📕 Cahier journal

```prisma
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
```

---

## 📗 Cahier de texte

```prisma
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
```

---

## 📙 Cahier du semainier

```prisma
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
```

---

## 📎 Pièces jointes

```prisma
model PedagogicalAttachment {
  id          String   @id @default(uuid())
  entityType  String   // LESSON_PLAN, JOURNAL...
  entityId    String
  fileUrl     String
  uploadedAt  DateTime @default(now())
}
```

---

## 🔏 Signature numérique interne

```prisma
model PedagogicalSignature {
  id              String   @id @default(uuid())
  entityType      String
  entityId        String
  signedById      String
  signedAt        DateTime @default(now())
  signatureHash   String
}
```

---

# 🔒 2️⃣ WORKFLOW DE VALIDATION

Étapes :

1. DRAFT
2. SUBMITTED
3. DIRECTOR_REVIEW
4. APPROVED / REJECTED

Règles :

* Après APPROVED → lecture seule
* Toute modification crée nouvelle version
* Historique conservé

---

# 🎨 3️⃣ UI — ESPACE ENSEIGNANT

---

## Tableau de bord enseignant

```text
-----------------------------------------
Espace pédagogique — Mme T.
-----------------------------------------

Fiches pédagogiques
Cahier journal
Cahier de texte
Cahier du semainier
Supports
Statistiques ORION
```

Indicateurs :

🟡 En attente validation
🔴 Rejeté
🟢 Approuvé

---

## Vue Directeur

```text
-----------------------------------------
Validation pédagogique
-----------------------------------------

Enseignant | Document | Classe | Statut
```

Actions :

* Commenter
* Approuver
* Rejeter
* Voir historique versions

---

# 🧠 4️⃣ INTÉGRATION ORION

ORION analyse :

* Retard soumission
* Manque fiches
* Classe sans cahier de texte
* Enseignant inactif
* Qualité rédaction (longueur / cohérence)

Exemple :

```text
🧠 ORION — Suivi pédagogique

🔴 Mme T. n’a soumis aucune fiche cette semaine
🟡 CM2 A sans cahier de texte lundi
🟢 Soumission globale 92%
```

---

# 🔐 5️⃣ PERMISSIONS RBAC

| Rôle           | Action                       |
| -------------- | ---------------------------- |
| Enseignant     | CRUD personnel               |
| Directeur      | Lecture + validation         |
| Promoteur      | Lecture seule                |
| Platform Admin | Lecture seule                |
| Platform Owner | Lecture globale multi-tenant |

⚠️ Aucune modification possible hors enseignant & directeur.

---

# 🔄 6️⃣ OFFLINE-FIRST

Autorisé offline :

* Création DRAFT
* Modification DRAFT
* Lecture locale

Interdit offline :

* Validation officielle
* Signature définitive

---

# 🔐 7️⃣ TRIGGERS CRITIQUES

* Empêcher modification après APPROVED
* Empêcher suppression document validé
* Générer signature hash automatique
* Empêcher double validation

---

# 🚀 8️⃣ PROMPT CURSOR — ESPACE PÉDAGOGIQUE

Copier-coller :

---

Tu es un architecte SaaS institutionnel spécialisé en gestion pédagogique multi-tenant.

OBJECTIF :
Implémenter le sous-module Espace pédagogique enseignant d’Academia Helm.

CONTRAINTES :

* Multi-tenant strict
* Année scolaire obligatoire
* Versionnement obligatoire
* Workflow validation strict
* Signature numérique interne
* Lecture seule pour Promoteur / Platform Admin / Platform Owner
* Compatible ORION
* Compatible offline-first
* Aucun delete destructif

INCLURE :

* LessonPlan
* TeachingJournal
* ClassLog
* WeeklyReport
* PedagogicalAttachment
* PedagogicalSignature
* Workflow validation
* Historique versions
* Audit logs

FRONTEND :

* Dashboard enseignant
* Vue validation direction
* Indicateurs statut visuels
* Notifications automatiques
* Lecture globale admin

OBJECTIF FINAL :
Créer un espace pédagogique intelligent,
institutionnel, versionné et auditable.

---

# 🏛 Résultat

Avec ce sous-module :

* L’enseignant devient structuré
* Le directeur contrôle réellement
* Le promoteur a une vision globale
* ORION devient assistant pédagogique
* Academia Helm atteint un niveau institutionnel rare

---
Excellent.
On entre maintenant dans la **tour de contrôle pédagogique**.

L’Espace enseignant permet de produire.
Le module Contrôle pédagogique permet de superviser, analyser, décider.

Ce n’est pas une simple liste de documents.
C’est un **centre de pilotage académique consolidé**.

On le construit comme un cockpit directionnel institutionnel.

---

# 🧠 SOUS-MODULE 7 — CONTRÔLE PÉDAGOGIQUE DIRECTION

*(Supervision consolidée — Lecture intelligente — Alertes ORION)*

---

# 🎯 OBJECTIF

Permettre au :

* Directeur
* Promoteur (lecture)
* Platform Admin (lecture)
* Platform Owner (lecture globale multi-tenant)

de :

* Voir l’état global de la production pédagogique
* Identifier retards et anomalies
* Contrôler couverture horaire réelle
* Suivre validations
* Visualiser performance enseignant
* Recevoir alertes ORION
* Produire rapports institutionnels

---

# 🧱 ARCHITECTURE CONCEPTUELLE

Ce module agrège :

```text id="xt9sbf"
LessonPlan
TeachingJournal
ClassLog
WeeklyReport
TeachingAssignment
TimetableSlot
```

Il ne crée pas de nouvelle entité métier lourde.
Il consolide.

---

# 📊 1️⃣ TABLES D’AGRÉGATION (OPTIONNELLES MAIS RECOMMANDÉES)

Pour performance et analytics :

```prisma id="cvo81g"
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
```

Peut être recalculé par cron ORION.

---

# 🔍 2️⃣ TABLEAU DE BORD CONSOLIDÉ DIRECTION

---

## 🟢 Indicateurs globaux

* % fiches soumises
* % fiches validées
* % cahiers journal à jour
* % cahiers de texte complétés
* % semainiers validés
* Enseignants en retard
* Classes non couvertes

---

## 🟡 Indicateurs par enseignant

| Enseignant | Fiches | Journal | Cahier texte | Retards | Statut |

---

## 🔴 Indicateurs par classe

| Classe | Matières couvertes | Heures assurées | Anomalies |

---

# 🎨 3️⃣ UI — DASHBOARD CONTRÔLE

---

```text id="6o1qtn"
----------------------------------------------------
| Contrôle pédagogique — Année 2024-2025          |
----------------------------------------------------

[ Vue globale ]
[ Par enseignant ]
[ Par classe ]
[ Alertes ORION ]
[ Rapports exportables ]
```

---

## 🔎 Vue globale

Cartes KPI :

* 92% fiches validées
* 85% cahiers journal soumis
* 3 enseignants en retard
* 1 classe sans couverture complète

Graphiques :

* Evolution hebdomadaire
* Comparaison par cycle
* Couverture horaire

---

## 🔍 Vue par enseignant

```text id="l8y8oq"
Mme T.

Fiches : 4/5
Journal : validé
Cahier texte : incomplet lundi
Semainier : en attente
```

---

## 🔍 Vue par classe

```text id="aj8r4z"
6ème A

Couverture matières : 100%
Heures prévues : 28
Heures assurées : 24 🔴
```

---

# 🧠 4️⃣ INTÉGRATION ORION

ORION devient analytique.

Il détecte :

* Enseignant récurrent en retard
* Classe sans cahier de texte
* Déséquilibre matière
* Absence production pédagogique
* Corrélation performance académique

Exemple :

```text id="vslh4k"
🧠 ORION — Supervision pédagogique

🔴 Mme K. 3 retards consécutifs
🟡 6ème B cahier texte incomplet 2 jours
🟢 Production globale satisfaisante
```

---

# 🔐 5️⃣ PERMISSIONS

| Rôle           | Accès            |
| -------------- | ---------------- |
| Directeur      | Lecture + export |
| Promoteur      | Lecture          |
| Platform Admin | Lecture          |
| Platform Owner | Lecture globale  |
| Enseignant     | Aucun accès      |

---

# 🔒 6️⃣ RÈGLES MÉTIER CRITIQUES

* Année scolaire obligatoire
* Données en lecture seule
* Export PDF institutionnel signé
* Historique consultable
* Aucun delete

---

# 🔄 7️⃣ OFFLINE-FIRST

Autorisé offline :

* Consultation des KPI locaux

Interdit offline :

* Validation
* Export officiel
* Analyse globale multi-classe

---

# 📄 8️⃣ RAPPORTS EXPORTABLES

Types :

* Rapport hebdomadaire pédagogique
* Rapport mensuel production
* Rapport individuel enseignant
* Rapport classe
* Rapport institutionnel complet

Inclut :

* Logo
* Cachet numérique
* Signature direction
* QR vérification

---

# 🚀 9️⃣ PROMPT CURSOR — CONTRÔLE PÉDAGOGIQUE

Copier-coller :

---

Tu es un architecte SaaS institutionnel spécialisé en supervision pédagogique multi-tenant.

OBJECTIF :
Implémenter le sous-module Contrôle pédagogique direction du Module 2 d’Academia Helm.

CONTRAINTES :

* Multi-tenant strict
* Année scolaire obligatoire
* Lecture seule
* Compatible ORION
* Compatible offline-first
* Aucun delete destructif
* Export institutionnel signé

INCLURE :

* Dashboard consolidé
* Vue par enseignant
* Vue par classe
* Agrégation KPI
* Modèle PedagogicalKpiSnapshot
* Intégration ORION
* Export PDF officiel

FRONTEND :

* Cartes KPI
* Graphiques évolutifs
* Filtres par cycle / niveau
* Indicateurs visuels
* Section alertes ORION

OBJECTIF FINAL :
Créer une tour de contrôle pédagogique institutionnelle,
analytique et décisionnelle.

---

# 🏛 Résultat

Avec ce module :

* Le directeur pilote réellement
* Le promoteur a visibilité stratégique
* ORION devient assistant pédagogique
* L’école passe en mode gouvernance active
* Academia Helm devient plateforme de pilotage éducatif

---

Parfait.
On entre ici dans la couche **stratégique différenciante**.

L’Analytique pédagogique ORION avancée transforme Academia Helm en **plateforme de pilotage éducatif prédictive** — pas un simple logiciel administratif.

Ici, ORION :

* ne se contente plus d’alerter,
* il corrèle,
* il projette,
* il anticipe,
* il recommande.

---

# 🧠 MODULE — ANALYTIQUE PÉDAGOGIQUE ORION AVANCÉE

*(Moteur d’intelligence institutionnelle — Analyse corrélative — Projection académique)*

---

# 🎯 OBJECTIF

Permettre à la direction et au promoteur :

* d’anticiper les baisses de performance
* d’identifier les fragilités pédagogiques
* de détecter les déséquilibres matières
* de mesurer la cohérence production ↔ résultats
* de prédire les risques académiques

Sans jamais modifier les données.

Lecture seule.
Analyse uniquement.

---

# 🧱 ARCHITECTURE CONCEPTUELLE

ORION consomme :

```text
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
```

Et produit :

```text
OrionPedagogicalInsight
OrionRiskFlag
OrionRecommendation
OrionForecast
```

---

# 🗃 1️⃣ SCHÉMA PRISMA — ANALYTIQUE ORION

---

## 🔎 Insight généré

```prisma
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
```

---

## 🚨 Flag de risque

```prisma
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
```

---

## 📈 Prévision académique

```prisma
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
```

---

# 🧠 2️⃣ TYPES D’ANALYSES AVANCÉES

---

## 1️⃣ Corrélation Production ↔ Résultats

Analyse :

* taux de fiches validées
* régularité cahier texte
* volume horaire réel
* moyennes classe

Détection :

> Classe 4ème A : baisse moyenne mathématiques
> corrélée à 3 semaines de fiches non soumises.

---

## 2️⃣ Risque élève

Variables :

* absences
* moyenne cumulée
* incidents disciplinaires
* retard paiement (impact motivation indirecte)

Sortie :

> Élève A. — risque échec : 78% — catégorie rouge

---

## 3️⃣ Performance enseignant

* régularité pédagogique
* performance moyenne classes
* évolution annuelle
* conformité programme

---

## 4️⃣ Déséquilibre matière

* heures prévues vs heures assurées
* surcharge horaire
* matière sous-représentée

---

## 5️⃣ Projection fin de trimestre

ORION estime :

* moyenne prévisionnelle
* taux réussite estimé
* taux échec probable

---

# 🎨 3️⃣ UI — DASHBOARD ORION AVANCÉ

---

```text
------------------------------------------
ORION — Analytique pédagogique avancée
------------------------------------------

[ Vue établissement ]
[ Risques ]
[ Corrélations ]
[ Prévisions ]
[ Recommandations ]
```

---

## 🔴 Section Risques

* 3 élèves risque élevé
* 1 classe déséquilibrée
* 2 enseignants en anomalie production

---

## 📈 Section Prévisions

Graphique projection moyenne trimestre

---

## 🧠 Section Recommandations

Exemple :

* Renforcer suivi 5ème B en mathématiques
* Programmer réunion pédagogique urgent
* Vérifier surcharge horaire professeur X

---

# 🔐 4️⃣ RÈGLES STRICTES

* Lecture seule absolue
* Pas d’action directe
* Historique analyses conservé
* Pas de suppression possible
* Accessible uniquement direction+

---

# 🔄 5️⃣ OFFLINE-FIRST

Autorisé offline :

* Consultation derniers insights

Interdit offline :

* Génération nouvelle analyse
* Calcul prédictif

---

# ⚙️ 6️⃣ MOTEUR ORION (LOGIQUE)

Cycle :

1. Collecte données
2. Agrégation KPI
3. Analyse corrélative
4. Calcul score risque
5. Génération insight
6. Stockage snapshot

Fréquence :

* Quotidienne
* Hebdomadaire
* À la demande direction

---

# 🧠 7️⃣ EXEMPLES DE FORMULES

---

### Score risque élève

```text
RiskScore =
  (AbsenceRate * 0.3)
+ (GradeDecline * 0.4)
+ (DisciplineEvents * 0.2)
+ (HomeworkCompletionRate * -0.1)
```

---

### Corrélation pédagogique

```text
CorrelationScore =
  LessonPlanCompliance
  vs
  ClassAverageTrend
```

---

# 🚀 8️⃣ PROMPT CURSOR — ORION ANALYTIQUE AVANCÉ

Copier-coller :

---

Tu es un architecte IA senior spécialisé en SaaS institutionnel multi-tenant.

OBJECTIF :
Implémenter le module Analytique pédagogique ORION avancée dans Academia Helm.

CONTRAINTES :

* Lecture seule
* Multi-tenant strict
* Année scolaire obligatoire
* Historique non supprimable
* Compatible offline-first
* Compatible RBAC
* Pas d’action automatique sur données

INCLURE :

* OrionPedagogicalInsight
* OrionRiskFlag
* OrionForecast
* Moteur calcul corrélation
* Moteur score risque
* Dashboard ORION avancé
* Graphiques projection
* Recommandations intelligentes

FRONTEND :

* UI analytique premium
* Cartes risques
* Graphiques tendances
* Filtres cycles
* Section recommandations

OBJECTIF FINAL :
Transformer Academia Helm en plateforme de pilotage éducatif prédictive.

---

# 🏛 Résultat stratégique

Avec ORION avancé :

* La direction anticipe
* Le promoteur décide sur données
* L’école devient gouvernée scientifiquement
* Tu crées un différenciateur marché massif
* Aucun concurrent local ne sera à ce niveau

---

