# Spécification d’implémentation — Dernier onglet du module Examens/Notes

## Module concerné

```txt
Academia Helm
Module : Examens / Notes
Dernier onglet à implémenter : Paramètres / Paramétrage académique
```

## Contexte important

Tous les autres onglets du module Examens/Notes sont déjà implémentés.

Les onglets existants peuvent inclure notamment :

```txt
Tableau de bord
Saisie des notes
Contrôle des notes
Calcul des moyennes
Bulletins / livrets
Classements / rangs
Décisions de passage
Examens officiels
Validation / publication
Rapports statistiques
Archives
```

Le travail demandé ne consiste donc pas à recréer ces onglets.

Le travail demandé consiste à :

```txt
1. Auditer ce qui existe déjà dans le module Examens/Notes.
2. Identifier les règles actuellement codées en dur.
3. Implémenter le dernier onglet Paramètres / Paramétrage académique.
4. Faire de cet onglet la source de vérité du module.
5. Adapter tous les autres onglets existants pour qu’ils utilisent les paramètres configurés.
6. Garantir que le module fonctionne selon les réalités académiques du pays, du cycle, du niveau, de la classe et de la matière.
```

---

# 1. Objectif stratégique de l’onglet Paramètres

L’onglet **Paramètres / Paramétrage académique** doit permettre à chaque école de configurer son propre système d’évaluation.

Academia Helm ne doit pas imposer une logique unique de calcul des notes.

Le système doit pouvoir s’adapter aux réalités de plusieurs pays :

```txt
Bénin
Togo
Côte d’Ivoire
Cameroun
Sénégal
Burkina Faso
Mali
RDC
Autres pays
```

Et aussi aux réalités internes de chaque école :

```txt
Maternelle
Primaire
Secondaire
Technique / Professionnel
Système francophone
Système anglophone
École privée
École confessionnelle
École internationale
```

Le principe produit est le suivant :

```txt
Academia Helm ne force pas l’école à s’adapter au logiciel.
Academia Helm adapte le logiciel aux règles académiques de l’école.
```

---

# 2. Principe technique fondamental

Le nouvel onglet **Paramètres** doit devenir la **source de vérité** du module Examens/Notes.

Cela signifie que les autres onglets ne doivent plus décider eux-mêmes :

```txt
quelles colonnes afficher
quels types de notes utiliser
comment calculer les moyennes
comment appliquer les coefficients
comment générer les bulletins
comment calculer les rangs
comment décider du passage
comment afficher les appréciations
comment contrôler les notes
```

Ils doivent interroger le backend pour récupérer la configuration active.

Architecture attendue :

```txt
Onglet Paramètres
        ↓
Configuration académique active
        ↓
Moteur de règles académiques
        ↓
Saisie des notes
Calcul des moyennes
Bulletins
Classements
Décisions de passage
Rapports
Archives
```

---

# 3. Nom recommandé de l’onglet

Côté interface, utiliser :

```txt
Paramètres
```

Ou, si l’espace le permet :

```txt
Paramétrage académique
```

Dans le code, utiliser un nom explicite :

```txt
ExamSettings
AcademicSettings
AcademicEvaluationSettings
```

Nom recommandé :

```txt
AcademicEvaluationSettings
```

---

# 4. Ce que Gravity doit d’abord vérifier

Avant toute implémentation, Gravity doit auditer le module existant.

## 4.1 Vérifier les routes existantes

Rechercher les routes liées au module Examens/Notes :

```bash
grep -r "exam\|examen\|note\|grade\|bulletin\|report-card\|average\|moyenne" app/ src/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" -n
```

Objectif :

```txt
Identifier les pages existantes.
Identifier les composants existants.
Identifier les API existantes.
Éviter les doublons.
Ne pas casser les onglets déjà implémentés.
```

---

## 4.2 Vérifier les composants front-end existants

Gravity doit rechercher :

```bash
grep -r "Exam\|Grade\|Note\|Bulletin\|Average\|Moyenne\|Ranking\|Classement" components/ app/ src/ --include="*.tsx" -n
```

Objectif :

```txt
Identifier les tableaux de notes existants.
Identifier les composants de bulletins.
Identifier les composants de calcul.
Identifier les composants de validation.
Identifier les composants de rapport.
```

---

## 4.3 Vérifier les modèles Prisma existants

Gravity doit vérifier le schéma actuel :

```bash
grep -n "model .*Exam\|model .*Grade\|model .*Note\|model .*Bulletin\|model .*Average\|model .*Subject\|model .*Class\|model .*Student" prisma/schema.prisma
```

Objectif :

```txt
Ne pas recréer inutilement des modèles déjà présents.
Étendre les modèles existants proprement.
Ajouter uniquement les tables manquantes.
Respecter le multi-tenant.
```

---

## 4.4 Vérifier les API existantes

Gravity doit vérifier :

```bash
find app/api -type f | grep -Ei "exam|grade|note|bulletin|average|report|ranking|school"
```

Objectif :

```txt
Identifier les endpoints déjà disponibles.
Réutiliser ce qui existe.
Ajouter les endpoints de configuration manquants.
Ne pas créer deux API pour la même responsabilité.
```

---

## 4.5 Vérifier les règles codées en dur

Gravity doit rechercher les formules ou règles fixes :

```bash
grep -r "/ 2\|/2\|/ 3\|/3\|coefficient\|coef\|average\|moyenne\|rank\|rang" app/ src/ lib/ components/ --include="*.ts" --include="*.tsx" -n
```

Objectif :

```txt
Repérer les calculs de moyennes codés directement dans le front-end.
Repérer les coefficients codés en dur.
Repérer les colonnes de saisie fixes.
Repérer les décisions de passage fixes.
Repérer les mentions fixes.
```

Ces règles doivent progressivement être remplacées par le moteur de configuration.

---


# 5. Structure fonctionnelle de l’onglet Paramètres

L’onglet Paramètres doit contenir plusieurs sous-sections.

## 5.1 Vue générale

```txt
Résumé du profil académique actif
Pays sélectionné
Système scolaire sélectionné
Cycles configurés
Niveaux configurés
Périodes configurées
Types d’évaluations actifs
Règles de calcul actives
Modèles de bulletins actifs
Statut de verrouillage
Année scolaire concernée
```

---

## 5.2 Pays & système scolaire

L’école doit pouvoir définir :

```txt
Pays académique
Système scolaire
Langue principale
Système francophone / anglophone si applicable
Mode national / personnalisé
```

Exemples :

```txt
Bénin — Système national
Togo — Système national
Côte d’Ivoire — Système national
Cameroun — Francophone
Cameroun — Anglophone
Personnalisé
```

Champs recommandés :

```txt
countryCode
countryName
educationSystemCode
educationSystemName
language
gradingMode
isCustom
```

---

## 5.3 Cycles scolaires

L’école doit pouvoir activer/configurer :

```txt
Maternelle
Primaire
Secondaire
Technique / Professionnel
Autre
```

Chaque cycle doit avoir ses propres règles.

Exemple :

```txt
Maternelle : évaluation qualitative
Primaire : notes + moyennes
Secondaire : notes + coefficients + rangs
```

---

## 5.4 Niveaux et classes

L’école doit pouvoir configurer les règles par :

```txt
cycle
niveau
classe
matière
```

Exemples :

```txt
Primaire > CM2
Secondaire > 3e
Secondaire > Terminale
Maternelle > Grande Section
```

La priorité des règles doit être :

```txt
Règle matière
Règle classe
Règle niveau
Règle cycle
Règle pays
Règle par défaut
```

---

## 5.5 Périodes scolaires

L’école doit pouvoir définir :

```txt
Trimestre
Semestre
Séquence
Composition
Période personnalisée
```

Exemples :

```txt
Bénin : 3 trimestres
Cameroun : séquences + trimestres
École personnalisée : périodes internes
```

Champs recommandés :

```txt
periodType
periodName
periodCode
startDate
endDate
order
isActive
isLocked
```

---

## 5.6 Types d’évaluations

L’école doit pouvoir créer et configurer ses types d’évaluations :

```txt
Interrogation
Devoir
Composition
Examen blanc
Évaluation orale
Évaluation pratique
Projet
Exposé
Travail de recherche
Contrôle continu
Participation
Récitation
Cahier
Compétence
```

Chaque type doit avoir :

```txt
nom
code
barème
coefficient
poids
obligatoire ou facultatif
visible sur bulletin ou non
pris en compte dans la moyenne ou non
cycle concerné
niveau concerné
classe concernée
matière concernée
période concernée
```

---

## 5.7 Matières et coefficients

L’école doit pouvoir définir :

```txt
matières par niveau
matières par classe
matières obligatoires
matières facultatives
coefficients
groupes de matières
ordre d’affichage sur bulletin
matières éliminatoires si applicable
```

Exemples :

```txt
Français — coefficient 3
Mathématiques — coefficient 4
Anglais — coefficient 2
EPS — coefficient 1
```

---

## 5.8 Règles de calcul des moyennes

C’est le cœur du système.

Gravity doit implémenter un moteur permettant de définir :

```txt
moyenne simple
moyenne pondérée
moyenne avec coefficients
moyenne par poids
moyenne par séquences
moyenne trimestrielle
moyenne annuelle
moyenne par groupe de matières
moyenne générale
```

Exemples de règles :

```txt
Moyenne = (Devoir 1 + Devoir 2 + Composition) / 3
Moyenne = ((Devoir × 1) + (Composition × 2)) / 3
Moyenne générale = Somme(Moyenne matière × Coefficient) / Somme(Coefficients)
Moyenne trimestre = (Séquence 1 + Séquence 2) / 2
```

Le moteur doit aussi gérer :

```txt
note manquante
absence justifiée
absence non justifiée
note hors barème
matière dispensée
matière facultative
coefficient nul
arrondi
nombre de décimales
```

---

## 5.9 Règles de classement

L’école doit pouvoir définir :

```txt
classement par classe
classement par niveau
classement par matière
classement général
ex æquo autorisé ou non
rang visible ou non sur bulletin
moyenne de classe visible ou non
plus forte moyenne visible ou non
plus faible moyenne visible ou non
```

---

## 5.10 Mentions et appréciations

L’école doit pouvoir configurer :

```txt
Très bien
Bien
Assez bien
Passable
Insuffisant
Faible
Excellent
À encourager
Tableau d’honneur
Avertissement travail
Avertissement conduite
Blâme
```

Chaque mention doit avoir :

```txt
seuil minimum
seuil maximum
condition complémentaire
cycle concerné
niveau concerné
visible sur bulletin
```

---

## 5.11 Règles de passage

L’école doit pouvoir configurer :

```txt
admis
redouble
ajourné
exclu
admis sous réserve
conseil de classe obligatoire
passage conditionnel
```

Exemples :

```txt
Si moyenne >= 10 : admis
Si moyenne < 10 : redoublement proposé
Si absences > seuil : conseil obligatoire
Si conduite insuffisante : décision manuelle
```

Important : le système doit permettre la décision automatique, mais la direction doit pouvoir valider ou modifier selon les droits.

---

## 5.12 Modèles de bulletins et livrets

L’école doit pouvoir configurer :

```txt
colonnes visibles
ordre des matières
groupes de matières
affichage des coefficients
affichage des rangs
affichage des moyennes de classe
affichage des appréciations
signature du directeur
cachet
QR code de vérification
logo école
pied de page
format PDF
format imprimable
```

Pour la maternelle :

```txt
livret qualitatif
compétences observées
niveaux d’acquisition
observations
progression
comportement
autonomie
langage
motricité
socialisation
```

---

## 5.13 Verrouillage et versioning

Gravity doit implémenter un système de version des règles.

Une configuration académique peut avoir les statuts :

```txt
BROUILLON
ACTIVE
VERROUILLÉE
ARCHIVÉE
```

Règle importante :

```txt
Une règle utilisée pour calculer des moyennes ou publier des bulletins ne doit pas être supprimée.
Elle doit être archivée ou versionnée.
```

Pourquoi ?

Parce que si une école change la formule après publication des bulletins, les anciens résultats doivent rester cohérents.

Exemple :

```txt
BENIN_PRIMARY_PROFILE_V1_2026
BENIN_PRIMARY_PROFILE_V2_2027
```

---


# 6. Comportement attendu des autres onglets après implémentation

Les autres onglets doivent s’aligner automatiquement sur l’onglet Paramètres.

## 6.1 Onglet Saisie des notes

Il doit récupérer le schéma de saisie actif.

Exemple :

```txt
École
Année scolaire
Cycle
Niveau
Classe
Matière
Période
```

Le backend doit retourner les colonnes à afficher.

Exemple :

```json
{
  "columns": [
    {
      "key": "devoir_1",
      "label": "Devoir 1",
      "type": "number",
      "max": 20,
      "required": true
    },
    {
      "key": "composition",
      "label": "Composition",
      "type": "number",
      "max": 20,
      "required": true
    },
    {
      "key": "average",
      "label": "Moyenne",
      "type": "computed",
      "formula": "((devoir_1 * 1) + (composition * 2)) / 3"
    }
  ]
}
```

Donc Gravity doit supprimer la logique de colonnes fixes si elle existe.

---

## 6.2 Onglet Contrôle des notes

Il doit vérifier selon les règles configurées :

```txt
notes manquantes
notes hors barème
notes obligatoires non saisies
matières sans coefficient
élèves sans note
classes non clôturées
périodes non configurées
formules invalides
```

---

## 6.3 Onglet Calcul des moyennes

Il doit utiliser uniquement le moteur de règles.

Il ne doit pas contenir de formule codée en dur.

Le calcul doit tenir compte de :

```txt
types d’évaluations
poids
coefficients
barèmes
matières
périodes
absences
notes neutralisées
règles d’arrondi
```

---

## 6.4 Onglet Bulletins / livrets

Il doit utiliser :

```txt
le modèle de bulletin actif
les colonnes configurées
les mentions configurées
les appréciations configurées
les règles de décision
les paramètres de visibilité
```

Pour la maternelle, il doit afficher un livret qualitatif et non un bulletin classique si le profil académique le demande.

---

## 6.5 Onglet Classements / rangs

Il doit utiliser :

```txt
règles de classement configurées
gestion des ex æquo
classement par classe
classement par niveau
classement par matière
visibilité des rangs
```

---

## 6.6 Onglet Décisions de passage

Il doit utiliser :

```txt
règles de passage configurées
seuils de moyenne
conditions d’absence
conditions disciplinaires
validation manuelle direction
conseil de classe
```

---

## 6.7 Onglet Rapports statistiques

Il doit exploiter les résultats selon la configuration active :

```txt
moyennes par classe
moyennes par matière
taux de réussite
taux d’échec
matières faibles
classes en difficulté
évolution par période
comparaison par niveau
```

---

## 6.8 Onglet Archives

Il doit conserver :

```txt
configuration utilisée
version de la règle
moyennes calculées
bulletins publiés
date de publication
utilisateur ayant validé
historique des modifications
```

---

# 7. Architecture backend recommandée

Gravity doit créer ou adapter les services suivants.

```txt
AcademicProfileService
AcademicSettingsService
EvaluationConfigService
AssessmentTypeService
ScoreEntrySchemaService
AverageCalculationService
RankingService
ReportCardTemplateService
PromotionDecisionService
AcademicRulesEngine
AcademicSettingsVersionService
AcademicValidationService
```

## Responsabilité des services

### AcademicSettingsService

```txt
Créer, modifier, lire et activer les paramètres académiques d’une école.
```

### ScoreEntrySchemaService

```txt
Générer dynamiquement les colonnes de saisie des notes selon la configuration active.
```

### AcademicRulesEngine

```txt
Exécuter les règles de calcul des moyennes, rangs, mentions et décisions.
```

### ReportCardTemplateService

```txt
Gérer les modèles de bulletins et livrets.
```

### AcademicSettingsVersionService

```txt
Versionner les règles utilisées par année scolaire.
```

---

# 8. API backend recommandées

Gravity doit créer ou adapter les endpoints suivants.

## Paramètres académiques

```txt
GET    /api/exams/settings
POST   /api/exams/settings
GET    /api/exams/settings/active
PATCH  /api/exams/settings/:id
POST   /api/exams/settings/:id/activate
POST   /api/exams/settings/:id/lock
POST   /api/exams/settings/:id/archive
POST   /api/exams/settings/:id/duplicate
```

## Profils pays

```txt
GET    /api/exams/academic-profiles
POST   /api/exams/academic-profiles
GET    /api/exams/academic-profiles/:id
```

## Types d’évaluations

```txt
GET    /api/exams/assessment-types
POST   /api/exams/assessment-types
PATCH  /api/exams/assessment-types/:id
DELETE /api/exams/assessment-types/:id
```

## Règles de calcul

```txt
GET    /api/exams/calculation-rules
POST   /api/exams/calculation-rules
PATCH  /api/exams/calculation-rules/:id
POST   /api/exams/calculation-rules/:id/test
```

## Schéma dynamique de saisie

```txt
GET /api/exams/score-entry-schema?schoolYearId=&cycleId=&levelId=&classId=&subjectId=&periodId=
```

## Calculs

```txt
POST /api/exams/calculate-averages
POST /api/exams/calculate-rankings
POST /api/exams/generate-report-cards
POST /api/exams/promotion-decisions
```

## Validation

```txt
POST /api/exams/settings/validate
POST /api/exams/settings/simulate
```

---


# 9. Modèles de base de données recommandés

Gravity doit vérifier d’abord les modèles existants avant d’ajouter ceux-ci.

## Tables à prévoir ou adapter

```txt
academic_country_profiles
school_academic_settings
academic_cycles
academic_levels_config
academic_periods
assessment_types
assessment_rules
subject_coefficients
calculation_rules
calculation_rule_versions
score_entry_schemas
grading_scales
ranking_rules
promotion_rules
report_card_templates
report_card_template_versions
academic_settings_audit_logs
student_scores
student_averages
student_rankings
report_card_snapshots
```

---

# 10. Exemple de modèle Prisma conceptuel

Gravity doit adapter au schéma existant, sans dupliquer inutilement.

```prisma
model SchoolAcademicSettings {
  id              String   @id @default(cuid())
  tenantId        String
  schoolYearId    String

  countryCode     String
  systemCode      String?
  cycleCode       String?
  levelCode       String?
  classId         String?

  name            String
  description     String?

  status          AcademicSettingsStatus @default(DRAFT)
  version         Int      @default(1)
  isActive        Boolean  @default(false)
  isLocked        Boolean  @default(false)

  config          Json

  createdById     String?
  activatedById   String?
  lockedById      String?

  activatedAt     DateTime?
  lockedAt        DateTime?
  archivedAt      DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
  @@index([schoolYearId])
  @@index([countryCode])
  @@index([status])
  @@index([isActive])
}
```

```prisma
enum AcademicSettingsStatus {
  DRAFT
  ACTIVE
  LOCKED
  ARCHIVED
}
```

---

# 11. Exemple de configuration JSON attendue

```json
{
  "country": "BENIN",
  "system": "BENIN_NATIONAL",
  "cycle": "PRIMARY",
  "level": "CM2",
  "periodType": "TRIMESTER",
  "gradingMode": "NUMERIC",
  "scoreScale": {
    "min": 0,
    "max": 20,
    "decimals": 2,
    "rounding": "NEAREST"
  },
  "assessmentTypes": [
    {
      "code": "DEVOIR_1",
      "label": "Devoir 1",
      "maxScore": 20,
      "weight": 1,
      "required": true,
      "includedInAverage": true,
      "visibleOnReportCard": true
    },
    {
      "code": "COMPOSITION",
      "label": "Composition",
      "maxScore": 20,
      "weight": 2,
      "required": true,
      "includedInAverage": true,
      "visibleOnReportCard": true
    }
  ],
  "calculationRules": {
    "subjectAverage": {
      "type": "WEIGHTED_AVERAGE",
      "expression": "((DEVOIR_1 * 1) + (COMPOSITION * 2)) / 3"
    },
    "generalAverage": {
      "type": "COEFFICIENT_AVERAGE",
      "expression": "SUM(subjectAverage * coefficient) / SUM(coefficient)"
    }
  },
  "rankingRules": {
    "enabled": true,
    "scope": "CLASS",
    "tieMode": "SAME_RANK"
  },
  "promotionRules": {
    "enabled": true,
    "rules": [
      {
        "condition": "generalAverage >= 10",
        "decision": "ADMITTED"
      },
      {
        "condition": "generalAverage < 10",
        "decision": "REVIEW_REQUIRED"
      }
    ]
  },
  "reportCard": {
    "showRank": true,
    "showClassAverage": true,
    "showHighestAverage": true,
    "showLowestAverage": false,
    "showTeacherComment": true,
    "showDirectorDecision": true,
    "showQrCode": true
  }
}
```

---

# 12. Interface front-end attendue

L’onglet Paramètres doit être organisé proprement.

## Layout recommandé

```txt
Page : ExamSettingsPage
```

Avec sections :

```txt
1. Profil académique
2. Cycles & niveaux
3. Périodes scolaires
4. Types d’évaluations
5. Matières & coefficients
6. Règles de calcul
7. Mentions & appréciations
8. Règles de classement
9. Règles de passage
10. Modèles de bulletins
11. Simulation & validation
12. Verrouillage annuel
```

---

## Composants front-end recommandés

```txt
AcademicProfileSelector
CycleLevelSettingsPanel
AcademicPeriodManager
AssessmentTypeManager
SubjectCoefficientManager
CalculationRuleBuilder
GradingScaleManager
RankingRuleManager
PromotionRuleBuilder
ReportCardTemplateBuilder
AcademicSettingsSimulator
AcademicSettingsValidationPanel
AcademicSettingsVersionHistory
```

---

# 13. UX attendue

L’utilisateur ne doit pas être noyé dans la complexité.

Il faut prévoir deux modes.

## Mode simple

Pour les écoles classiques :

```txt
Choisir un pays
Choisir un cycle
Choisir un modèle prédéfini
Adapter quelques paramètres
Valider
```

## Mode expert

Pour les écoles avancées :

```txt
Créer ses propres types d’évaluations
Modifier les formules
Configurer les coefficients
Configurer les bulletins
Configurer les décisions
Tester avec simulation
```

---

# 14. Simulation obligatoire avant activation

Avant d’activer une configuration, Gravity doit prévoir une simulation.

La simulation doit permettre de :

```txt
tester la saisie des notes
calculer les moyennes
voir les rangs
voir les mentions
prévisualiser le bulletin
détecter les erreurs
```

Exemple :

```txt
Créer 3 à 5 élèves fictifs
Saisir des notes de test
Calculer les résultats
Afficher le bulletin de test
Afficher les erreurs éventuelles
```

---

# 15. Validation avant activation

Avant activation, le système doit vérifier :

```txt
au moins une période active
au moins un type d’évaluation
barème défini
formule valide
matières configurées
coefficients cohérents
modèle de bulletin disponible
règles de classement cohérentes
règles de passage cohérentes
aucune référence manquante
```

Si une erreur existe, l’activation doit être bloquée.

---


# 16. Sécurité et permissions

Gravity doit respecter le RBAC existant.

Permissions recommandées :

```txt
EXAM_SETTINGS_VIEW
EXAM_SETTINGS_CREATE
EXAM_SETTINGS_UPDATE
EXAM_SETTINGS_ACTIVATE
EXAM_SETTINGS_LOCK
EXAM_SETTINGS_ARCHIVE
EXAM_SETTINGS_SIMULATE
EXAM_SETTINGS_AUDIT_VIEW

ASSESSMENT_TYPE_MANAGE
CALCULATION_RULE_MANAGE
REPORT_CARD_TEMPLATE_MANAGE
PROMOTION_RULE_MANAGE

SCORE_ENTRY_SCHEMA_VIEW
AVERAGE_CALCULATE
BULLETIN_GENERATE
BULLETIN_VALIDATE
BULLETIN_PUBLISH
```

Rôles pouvant gérer ces paramètres :

```txt
Platform Super Admin
Promoteur / Fondateur
Directeur Général
Directeur d’établissement
Responsable pédagogique
Responsable scolarité
Administrateur école
```

Les enseignants peuvent consulter uniquement ce qui impacte leur saisie, sauf permission spéciale.

---

# 17. Règles de verrouillage

Une configuration active pour une année scolaire doit pouvoir être verrouillée.

Règles :

```txt
Une configuration verrouillée ne peut plus être modifiée directement.
Toute modification doit créer une nouvelle version.
Une configuration utilisée pour publier des bulletins ne peut pas être supprimée.
Une configuration archivée reste consultable.
Les anciens bulletins doivent toujours utiliser la version historique utilisée au moment de leur génération.
```

---

# 18. Audit logs

Toutes les actions sensibles doivent être journalisées :

```txt
création de configuration
modification de formule
activation
verrouillage
archivage
duplication
modification de coefficient
modification de règle de passage
modification de modèle de bulletin
publication des bulletins
recalcul des moyennes
```

Chaque log doit contenir :

```txt
tenantId
schoolYearId
userId
action
oldValue
newValue
timestamp
ipAddress si disponible
userAgent si disponible
```

---

# 19. Multi-tenant obligatoire

Gravity doit s’assurer que toutes les requêtes sont filtrées par :

```txt
tenantId
schoolYearId
```

Aucune école ne doit pouvoir lire ou modifier les paramètres d’une autre école.

Règle non négociable :

```txt
Toute configuration académique appartient à un tenant.
Toute lecture doit être scopée au tenant connecté.
Toute écriture doit être scopée au tenant connecté.
```

---

# 20. Alignement des onglets existants

Après implémentation de l’onglet Paramètres, Gravity doit faire un refactoring contrôlé des autres onglets.

## Objectif

Remplacer les logiques fixes par :

```txt
useActiveAcademicSettings()
useScoreEntrySchema()
useAcademicRulesEngine()
useReportCardTemplate()
```

## Hooks front-end recommandés

```txt
useAcademicSettings
useActiveAcademicSettings
useScoreEntrySchema
useAssessmentTypes
useCalculationRules
useReportCardTemplate
usePromotionRules
```

## Exemple attendu

Au lieu de :

```ts
const columns = ["Devoir 1", "Devoir 2", "Composition", "Moyenne"];
```

Utiliser :

```ts
const { data: schema } = useScoreEntrySchema({
  schoolYearId,
  cycleId,
  levelId,
  classId,
  subjectId,
  periodId,
});
```

Puis :

```ts
const columns = schema.columns;
```

---

# 21. États à gérer côté UI

Gravity doit gérer proprement :

```txt
loading
empty state
error state
configuration manquante
configuration brouillon
configuration active
configuration verrouillée
configuration archivée
absence de profil pays
absence de période
absence de type d’évaluation
formule invalide
```

Exemples de messages :

```txt
Aucune configuration académique active pour cette année scolaire.
Veuillez configurer les paramètres d’évaluation avant de saisir les notes.

La configuration actuelle est verrouillée.
Créez une nouvelle version pour effectuer des modifications.

Impossible de calculer les moyennes.
La règle de calcul active est invalide ou incomplète.
```

---

# 22. Tests à effectuer

Gravity doit tester les cas suivants.

## Cas 1 — Bénin Primaire

```txt
Pays : Bénin
Cycle : Primaire
Période : Trimestre
Types : Devoir + Composition
Calcul : moyenne pondérée
Bulletin : primaire classique
```

Vérifier :

```txt
colonnes dynamiques
saisie des notes
calcul correct
bulletin généré
rang calculé
décision affichée
```

---

## Cas 2 — Secondaire avec coefficients

```txt
Cycle : Secondaire
Matières avec coefficients
Calcul moyenne générale pondérée
Classement par classe
Bulletin avec coefficients
```

Vérifier :

```txt
coefficients pris en compte
total pondéré correct
rang correct
bulletin correct
```

---

## Cas 3 — Maternelle qualitative

```txt
Cycle : Maternelle
Mode : Qualitatif
Compétences
Niveaux d’acquisition
Livret qualitatif
```

Vérifier :

```txt
pas de moyenne numérique obligatoire
pas de rang obligatoire
livret qualitatif généré
observations visibles
```

---

## Cas 4 — Cameroun avec séquences

```txt
Pays : Cameroun
Système : Francophone
Périodes : Séquence 1, Séquence 2, Trimestre
Calcul : moyenne des séquences
```

Vérifier :

```txt
colonnes séquentielles
calcul trimestre
bulletin adapté
```

---

## Cas 5 — Modification après publication

```txt
Bulletins publiés
Modification d’une règle
```

Résultat attendu :

```txt
ancienne règle conservée
nouvelle version créée
anciens bulletins inchangés
audit log créé
```

---

# 23. Contraintes importantes

Gravity doit respecter ces règles :

```txt
Ne pas casser les onglets déjà implémentés.
Ne pas recréer des composants existants inutilement.
Ne pas dupliquer les API existantes.
Ne pas coder les règles académiques en dur.
Ne pas imposer uniquement le système béninois.
Ne pas permettre la suppression d’une règle déjà utilisée.
Ne pas permettre une configuration active invalide.
Ne pas permettre l’accès inter-tenant.
Ne pas calculer une moyenne sans configuration active.
```

---

# 24. Résultat attendu à la fin

À la fin de l’implémentation, Academia Helm doit permettre ceci :

```txt
Une école configure son pays, son cycle, ses périodes, ses types d’évaluations, ses coefficients et ses règles de calcul.
Les tableaux de saisie des notes s’adaptent automatiquement.
Les moyennes sont calculées selon les règles configurées.
Les bulletins sont générés selon le modèle actif.
Les rangs et décisions suivent les règles définies.
Les anciennes configurations restent historisées.
Les autres onglets du module Examens/Notes fonctionnent avec cette configuration.
```

---

# 25. Instruction finale à Gravity

```txt
Gravity, tu dois implémenter uniquement le dernier onglet Paramètres / Paramétrage académique du module Examens/Notes d’Academia Helm.

Tous les autres onglets du module sont déjà implémentés. Tu dois donc commencer par auditer l’existant afin d’identifier les pages, composants, services, hooks, API et modèles déjà présents.

Ensuite, tu dois créer ou compléter le système de paramétrage académique qui permettra à chaque école de définir ses règles d’évaluation selon son pays, son cycle, son niveau, sa classe, ses matières et son année scolaire.

Cet onglet Paramètres doit devenir la source de vérité du module Examens/Notes. Les autres onglets existants doivent être alignés sur cette configuration : saisie des notes, contrôle, calcul des moyennes, bulletins, classements, décisions de passage, rapports et archives.

Aucune règle de calcul ne doit rester codée en dur dans les composants front-end. Les tableaux de saisie doivent être générés dynamiquement depuis la configuration active. Les calculs doivent passer par un moteur de règles académique côté backend. Les bulletins doivent utiliser le modèle actif. Les configurations doivent être versionnées, verrouillables, auditables et strictement isolées par tenant.

L’objectif final est que le module Examens/Notes fonctionne à 100 % pour plusieurs réalités académiques : Bénin, Togo, Côte d’Ivoire, Cameroun et autres pays, sans devoir modifier le code à chaque nouveau pays ou système scolaire.
```

---

# 26. Résumé opérationnel

Ce que Gravity doit livrer :

```txt
1. Audit complet du module Examens/Notes existant.
2. Création de l’onglet Paramètres / Paramétrage académique.
3. Backend de configuration académique.
4. Moteur de règles de calcul.
5. Génération dynamique des schémas de saisie.
6. Gestion des profils pays et profils personnalisés.
7. Gestion des périodes, types d’évaluations, coefficients et formules.
8. Gestion des bulletins et livrets.
9. Versioning, verrouillage et audit logs.
10. Alignement des autres onglets existants sur cette configuration.
11. Tests fonctionnels Bénin, Secondaire, Maternelle, Cameroun.
12. Respect strict du multi-tenant et du RBAC.
```

Conclusion : ce dernier onglet n’est pas un simple écran de paramètres. C’est le **cerveau réglementaire** du module Examens/Notes. S’il est bien conçu, Academia Helm pourra s’adapter à plusieurs pays sans réécriture du code. C’est précisément ce qui donnera à la plateforme une vraie capacité d’expansion panafricaine.
