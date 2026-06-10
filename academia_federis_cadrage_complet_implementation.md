# Academia Federis — Cahier de cadrage complet pour implémentation dans Academia Helm

## 0. Contexte général

**Academia Federis** est l’application satellite officielle d’**Academia Helm** dédiée aux patronats scolaires privés, aux examens inter-écoles, à la gestion des écoles membres, à la publication des résultats et au pilotage institutionnel des performances.

Elle est conçue comme une application web autonome, rattachée à l’écosystème Academia Helm, mais disposant de sa propre landing page, de ses propres portails, de ses propres modules, de ses propres plans d’abonnement et de sa propre logique métier.

Nom produit officiel :

```txt
Academia Federis
```

Signature recommandée :

```txt
Academia Federis
by Academia Helm
```

Sous-domaine recommandé :

```txt
federis.academiahelm.com
```

Positionnement officiel :

```txt
Academia Federis est l’application satellite d’Academia Helm dédiée aux patronats scolaires privés, à la gestion des écoles membres, à l’organisation des examens inter-écoles, à la publication des résultats et au pilotage institutionnel des performances.
```

Slogan court :

```txt
Fédérer les écoles. Organiser les examens. Piloter la réussite.
```

Slogan institutionnel :

```txt
La plateforme de gouvernance, d’examens et de pilotage des réseaux scolaires privés.
```

---

# 1. Landing page officielle Academia Federis

## 1.1 Objectif de la landing page

La landing page doit présenter Academia Federis comme une solution SaaS institutionnelle destinée aux patronats scolaires privés, associations d’écoles, fédérations éducatives et structures organisatrices d’examens inter-écoles.

Elle doit permettre de :

- comprendre rapidement la promesse produit ;
- présenter les fonctionnalités principales ;
- rassurer sur la sécurité des données ;
- expliquer le lien avec Academia Helm ;
- présenter les plans d’abonnement ;
- déclencher l’inscription d’un patronat ;
- permettre une demande de démonstration ;
- permettre la connexion des utilisateurs existants.

## 1.2 Structure recommandée

### Section 1 — Hero

Contenu recommandé :

```txt
Academia Federis
Fédérer les écoles. Organiser les examens. Piloter la réussite.
```

Texte court :

```txt
La plateforme SaaS dédiée aux patronats scolaires privés pour gérer les écoles membres, organiser les examens inter-écoles, publier les résultats et piloter les performances institutionnelles.
```

Boutons :

- Créer un espace patronat
- Demander une démonstration
- Se connecter

### Section 2 — Problème

Mettre en avant les difficultés actuelles :

- gestion manuelle des écoles membres ;
- absence de données consolidées ;
- organisation lourde des examens ;
- listes de candidats dispersées ;
- saisie des notes non centralisée ;
- publication lente des résultats ;
- faible traçabilité ;
- absence de statistiques fiables.

### Section 3 — Solution

Présenter Academia Federis comme la solution qui centralise :

- écoles membres ;
- classes d’examen ;
- candidats ;
- centres d’examen ;
- sujets ;
- surveillance ;
- correction ;
- notes ;
- délibération ;
- résultats ;
- rapports ;
- notifications parents.

### Section 4 — Fonctionnalités clés

Cartes de fonctionnalités :

- Gestion des écoles membres
- Organisation des examens
- Centres d’examen
- Gestion des candidats
- Épreuves et sujets
- Surveillance et PV
- Correction et saisie des notes
- Délibération
- Publication des résultats
- Statistiques institutionnelles
- Notifications parents
- Abonnements patronat

### Section 5 — Connexion avec Academia Helm

Expliquer que les écoles déjà présentes dans Academia Helm peuvent être associées au patronat, avec accès limité aux données nécessaires.

Données accessibles :

- identité de l’école ;
- contacts officiels ;
- niveaux ouverts ;
- effectifs globaux autorisés ;
- effectifs des classes d’examen ;
- candidats concernés ;
- résultats des examens patronaux.

### Section 6 — Sécurité et confidentialité

Mettre en avant :

- accès limité aux données écoles ;
- isolation multi-tenant ;
- permissions par rôle ;
- journalisation des actions ;
- protection des sujets ;
- verrouillage des notes validées ;
- publication contrôlée des résultats.

### Section 7 — Plans d’abonnement

Présenter les plans :

- Starter
- Professional
- Enterprise

### Section 8 — Appel à l’action final

```txt
Prêt à moderniser la gouvernance de votre patronat scolaire ?
Créez votre espace Academia Federis dès aujourd’hui.
```

Boutons :

- Créer un patronat
- Contacter l’équipe
- Voir les plans

## 1.3 Routes publiques

```txt
/federis
/federis/features
/federis/pricing
/federis/about
/federis/contact
/federis/demo
/federis/login
/federis/register
```

---

# 2. Modules internes de l’application

## 2.1 Liste des modules principaux

Academia Federis doit contenir les modules suivants :

1. Tableau de bord Federis
2. Gestion du patronat
3. Écoles membres
4. Synchronisation Academia Helm
5. Classes d’examen
6. Examens
7. Centres d’examen
8. Candidats
9. Épreuves et sujets
10. Composition
11. Surveillance
12. Correction
13. Notes
14. Délibération
15. Résultats
16. Notifications parents
17. Statistiques et pilotage
18. Rapports
19. Finances et abonnements
20. Communication patronale
21. Documents et archives
22. Paramètres
23. Administration plateforme

## 2.2 Module 1 — Tableau de bord Federis

Objectif :

Afficher une vue consolidée du patronat.

KPI :

- nombre d’écoles membres ;
- écoles synchronisées ;
- écoles non synchronisées ;
- effectif total autorisé ;
- effectif CM2 ;
- effectif 3ème ;
- effectif Terminale ;
- examens actifs ;
- examens terminés ;
- candidats inscrits ;
- centres actifs ;
- notes saisies ;
- résultats publiés ;
- taux de réussite global ;
- performance par école ;
- statut de l’abonnement.

## 2.3 Module 2 — Gestion du patronat

Fonctionnalités :

- création du patronat ;
- modification des informations ;
- logo ;
- département ;
- commune ;
- contacts ;
- responsables ;
- membres du bureau ;
- documents officiels ;
- statut ;
- année scolaire active.

## 2.4 Module 3 — Écoles membres

Fonctionnalités :

- rechercher une école Academia Helm ;
- envoyer une demande d’association ;
- accepter/refuser une association ;
- créer une école provisoire ;
- inviter une école à rejoindre Academia Helm ;
- suivre le statut de synchronisation ;
- consulter les effectifs autorisés ;
- consulter les classes d’examen ;
- consulter les résultats liés aux examens patronaux.

Statuts :

- active ;
- en attente ;
- synchronisée ;
- non synchronisée ;
- ajoutée manuellement ;
- suspendue ;
- archivée.

## 2.5 Module 4 — Synchronisation Academia Helm

Fonctionnalités :

- association école existante ;
- validation par l’école ;
- récupération limitée des données ;
- mapping des classes ;
- mapping des candidats ;
- rapprochement d’une école provisoire avec une école réelle ;
- historique des synchronisations.

## 2.6 Module 5 — Classes d’examen

Classes prioritaires :

- CM2 ;
- 3ème ;
- Terminale.

Fonctionnalités :

- consulter les effectifs ;
- valider les candidats ;
- importer les listes ;
- suivre les inscriptions ;
- produire les statistiques par classe.

## 2.7 Module 6 — Examens

Fonctionnalités :

- créer un examen ;
- définir le type ;
- définir l’année scolaire ;
- définir les niveaux/classes ;
- définir les matières ;
- définir les coefficients ;
- définir les écoles participantes ;
- définir les centres ;
- définir le calendrier ;
- configurer les règles de calcul ;
- configurer les règles de délibération ;
- suivre l’état d’avancement.

Types d’examens :

- examen communal ;
- examen départemental ;
- examen blanc ;
- composition commune ;
- concours interne ;
- test de niveau ;
- examen préparatoire CEP ;
- examen préparatoire BEPC ;
- examen préparatoire BAC.

## 2.8 Module 7 — Centres d’examen

Fonctionnalités :

- créer un centre ;
- affecter une école hôte ;
- définir les salles ;
- définir la capacité ;
- affecter les candidats ;
- affecter les surveillants ;
- affecter le chef centre ;
- générer les listes ;
- générer les PV ;
- suivre les incidents.

## 2.9 Module 8 — Candidats

Fonctionnalités :

- récupérer depuis Academia Helm ;
- importer par Excel ;
- importer par CSV ;
- saisir manuellement ;
- valider les candidats ;
- générer les numéros candidats ;
- affecter les centres ;
- affecter les salles ;
- affecter les numéros de table ;
- gérer les absences ;
- suivre les résultats.

## 2.10 Module 9 — Épreuves et sujets

Fonctionnalités :

- créer les épreuves ;
- définir matières ;
- horaires ;
- durées ;
- coefficients ;
- charger les sujets ;
- charger les corrigés ;
- charger les barèmes ;
- sécuriser les documents ;
- programmer l’ouverture ;
- journaliser les accès ;
- verrouiller les sujets.

## 2.11 Module 10 — Composition

Fonctionnalités :

- feuille de présence ;
- liste des candidats ;
- émargement ;
- absence ;
- retard ;
- incident ;
- PV de composition ;
- clôture de séance ;
- transmission des copies.

## 2.12 Module 11 — Surveillance

Fonctionnalités :

- affectation surveillants ;
- planning de surveillance ;
- remplacement ;
- incidents ;
- PV de surveillance ;
- validation chef centre.

## 2.13 Module 12 — Correction

Fonctionnalités :

- affecter les correcteurs ;
- anonymiser les copies si activé ;
- saisir les notes ;
- double correction ;
- contrôle des écarts ;
- validation des notes ;
- verrouillage.

## 2.14 Module 13 — Notes

Fonctionnalités :

- saisie simple ;
- import Excel ;
- double saisie ;
- contrôle automatique ;
- notes manquantes ;
- notes hors barème ;
- notes incohérentes ;
- validation ;
- verrouillage.

## 2.15 Module 14 — Délibération

Fonctionnalités :

- calcul des moyennes ;
- classement ;
- mentions ;
- seuils ;
- notes éliminatoires ;
- cas limites ;
- repêchage ;
- validation jury ;
- PV de délibération ;
- verrouillage final.

## 2.16 Module 15 — Résultats

Fonctionnalités :

- publication par école ;
- publication par centre ;
- publication par candidat ;
- publication privée ;
- publication publique sécurisée ;
- notification parent ;
- export PDF ;
- export Excel ;
- bulletin/récapitulatif candidat ;
- classement selon autorisation.

## 2.17 Module 16 — Notifications parents

Fonctionnalités :

- notifier inscription examen ;
- notifier calendrier ;
- notifier centre ;
- notifier numéro de table ;
- notifier absence ou incident ;
- notifier publication des résultats ;
- notifier performance ;
- notifier recommandations.

Canaux :

- in-app ;
- email ;
- SMS ;
- WhatsApp ;
- push mobile.

## 2.18 Module 17 — Statistiques et pilotage

Indicateurs :

- taux de réussite global ;
- taux de réussite par école ;
- taux de réussite par commune ;
- taux de réussite par centre ;
- moyenne par matière ;
- classement écoles ;
- performance par sexe si autorisé ;
- évolution annuelle ;
- écoles en progression ;
- écoles en difficulté ;
- matières faibles ;
- absences ;
- incidents ;
- performance des centres.

## 2.19 Module 18 — Rapports

Rapports :

- rapport d’examen ;
- rapport par école ;
- rapport par centre ;
- rapport candidats ;
- rapport résultats ;
- rapport délibération ;
- rapport statistiques ;
- rapport financier ;
- rapport patronat annuel.

Exports :

- PDF ;
- Excel ;
- CSV.

## 2.20 Module 19 — Finances et abonnements

Fonctionnalités :

- plan choisi ;
- souscription initiale ;
- abonnement mensuel ;
- factures ;
- reçus ;
- paiements ;
- impayés ;
- période de grâce ;
- suspension ;
- réactivation ;
- changement de plan ;
- historique de facturation.

## 2.21 Module 20 — Communication patronale

Fonctionnalités :

- annonces ;
- communiqués ;
- messages aux écoles ;
- messages aux chefs centres ;
- messages aux surveillants ;
- messages aux parents si autorisé ;
- campagnes email/SMS/WhatsApp.

## 2.22 Module 21 — Documents et archives

Fonctionnalités :

- archives examens ;
- sujets ;
- corrigés ;
- PV ;
- listes ;
- résultats ;
- rapports ;
- documents administratifs ;
- documents patronat ;
- versioning ;
- recherche.

## 2.23 Module 22 — Paramètres

Paramètres :

- année scolaire ;
- types d’examens ;
- matières ;
- coefficients ;
- niveaux ;
- classes ;
- séries ;
- règles de calcul ;
- règles de délibération ;
- modèles de PV ;
- modèles de rapports ;
- notifications ;
- permissions ;
- sécurité.

## 2.24 Module 23 — Administration plateforme

Réservé au propriétaire de la plateforme Academia Helm.

Fonctionnalités :

- gestion des patronats ;
- validation des inscriptions ;
- plans d’abonnement ;
- facturation globale ;
- support ;
- suspension ;
- statistiques globales ;
- monitoring ;
- logs ;
- configuration globale.

---

# 3. Portails utilisateurs

## 3.1 Portail public

Utilisateurs :

- visiteurs ;
- patronats intéressés ;
- écoles intéressées ;
- parents consultant un résultat public si autorisé.

Fonctions :

- consulter la landing page ;
- voir les plans ;
- demander une démo ;
- créer un patronat ;
- se connecter ;
- consulter un résultat public sécurisé.

## 3.2 Portail patronat

Utilisateurs :

- président du patronat ;
- secrétaire général ;
- responsable examens ;
- responsable statistiques ;
- responsable finances ;
- responsable communication ;
- agents de saisie ;
- superviseurs.

Fonctions :

- gérer le patronat ;
- gérer les écoles ;
- organiser les examens ;
- gérer les centres ;
- gérer les candidats ;
- gérer les sujets ;
- suivre la composition ;
- gérer la correction ;
- valider la délibération ;
- publier les résultats ;
- consulter les statistiques ;
- gérer l’abonnement.

## 3.3 Portail école associée

Utilisateurs :

- promoteur ;
- directeur ;
- responsable examens école ;
- secrétaire ;
- responsable pédagogique.

Fonctions :

- accepter/refuser l’association ;
- valider les effectifs ;
- valider les candidats ;
- consulter les examens ;
- consulter les centres ;
- consulter les résultats de ses élèves ;
- télécharger les rapports ;
- recevoir les communications patronat.

## 3.4 Portail centre d’examen

Utilisateurs :

- chef centre ;
- surveillants ;
- agents centre.

Fonctions :

- consulter candidats affectés ;
- imprimer listes ;
- gérer présence ;
- déclarer incidents ;
- générer PV ;
- clôturer séance.

## 3.5 Portail correcteur

Utilisateurs :

- correcteurs ;
- superviseurs correction.

Fonctions :

- consulter copies affectées ;
- saisir notes ;
- corriger selon barème ;
- soumettre notes ;
- traiter corrections ;
- voir statut de validation.

## 3.6 Portail parent/élève Academia Helm

Utilisateurs :

- parents ;
- élèves selon autorisation.

Fonctions :

- recevoir notifications ;
- consulter calendrier ;
- consulter centre ;
- consulter numéro de table ;
- consulter résultats ;
- consulter performance ;
- télécharger relevé si autorisé.

## 3.7 Portail administration plateforme

Utilisateurs :

- platform owner ;
- super admin ;
- support technique ;
- support commercial.

Fonctions :

- gérer tous les patronats ;
- gérer plans ;
- gérer abonnements ;
- consulter statistiques globales ;
- assister les clients ;
- contrôler les logs ;
- gérer les incidents plateforme.

---

# 4. Plans d’abonnement

## 4.1 Logique commerciale

Chaque patronat doit choisir un plan lors de l’inscription.

Le modèle comprend :

- souscription initiale ;
- abonnement mensuel ;
- options premium ;
- frais de notification selon volume ;
- éventuels frais par candidat ou par examen selon stratégie.

## 4.2 Plan Starter

Cible :

- petit patronat communal ;
- réseau réduit ;
- examens simples.

Fonctionnalités :

- écoles membres limitées ;
- examens simples ;
- import candidats ;
- centres basiques ;
- saisie notes ;
- publication résultats ;
- rapports simples.

## 4.3 Plan Professional

Cible :

- patronat départemental ;
- organisation structurée.

Fonctionnalités :

- tout Starter ;
- examens multiples ;
- centres avancés ;
- surveillance ;
- correction ;
- délibération ;
- statistiques par école ;
- notifications parents ;
- exports avancés ;
- tableaux de bord.

## 4.4 Plan Enterprise

Cible :

- grande organisation ;
- fédération ;
- réseau multi-zone.

Fonctionnalités :

- tout Professional ;
- multi-départements si autorisé ;
- statistiques avancées ;
- ORION ;
- API ;
- notifications massives ;
- portail public de résultats ;
- support prioritaire ;
- personnalisation avancée.

## 4.5 Règles d’accès

- un patronat doit choisir un plan avant activation ;
- la souscription initiale est obligatoire sauf promotion ;
- l’abonnement mensuel conditionne l’accès continu ;
- paiement en retard = alerte ;
- période de grâce configurable ;
- suspension automatique après délai ;
- patronat suspendu ne peut pas créer de nouvel examen ;
- archives accessibles selon politique ;
- réactivation après paiement.

---

# 5. Workflow complet des examens

## 5.1 Workflow principal

1. Création de l’examen
2. Sélection des écoles participantes
3. Validation des classes concernées
4. Récupération/import des candidats
5. Validation des candidats par école
6. Validation finale par patronat
7. Création des centres
8. Affectation candidats/centres/salles
9. Génération des numéros de table
10. Création du calendrier
11. Gestion des sujets
12. Affectation des surveillants
13. Composition
14. Gestion des présences
15. PV de surveillance
16. Correction
17. Saisie des notes
18. Contrôle des notes
19. Calcul des moyennes
20. Délibération
21. Validation finale
22. Publication
23. Notification parents
24. Rapports
25. Archivage

## 5.2 États d’un examen

- brouillon ;
- configuré ;
- inscriptions ouvertes ;
- inscriptions clôturées ;
- centres configurés ;
- sujets prêts ;
- en composition ;
- en correction ;
- notes en contrôle ;
- en délibération ;
- résultats validés ;
- résultats publiés ;
- archivé ;
- annulé.

## 5.3 États d’un candidat

- inscrit ;
- validé école ;
- validé patronat ;
- affecté centre ;
- présent ;
- absent ;
- en correction ;
- notes complètes ;
- admis ;
- ajourné ;
- repêché ;
- résultat publié.

## 5.4 États d’une note

- non saisie ;
- saisie ;
- en contrôle ;
- incohérente ;
- validée ;
- verrouillée ;
- corrigée après autorisation spéciale.

---

# 6. Architecture technique

## 6.1 Architecture globale

```txt
Academia Helm Ecosystem
│
├── Academia Helm Core
│   └── Gestion complète des écoles
│
├── Academia Federis
│   └── Patronats, examens inter-écoles et pilotage institutionnel
│
├── Shared Auth / SSO
├── API Gateway
├── Notification Service
├── File Storage Service
├── Payment Service
├── Audit Log Service
├── ORION Analytics
├── Sara AI
└── Atlas Knowledge Base
```

## 6.2 Frontend recommandé

Technologies compatibles avec le projet :

- Next.js ;
- React ;
- TypeScript ;
- Tailwind CSS ;
- shadcn/ui ;
- React Hook Form ;
- Zod ;
- TanStack Query ;
- Recharts ;
- Zustand ou Redux Toolkit selon architecture existante.

## 6.3 Backend recommandé

Services :

- FederisTenantService
- FederisSubscriptionService
- PatronatService
- FederisSchoolMembershipService
- FederisExamService
- FederisCandidateService
- FederisCenterService
- FederisSubjectService
- FederisCompositionService
- FederisCorrectionService
- FederisGradeService
- FederisDeliberationService
- FederisResultService
- FederisNotificationService
- FederisReportService
- FederisAnalyticsService
- FederisArchiveService
- FederisSettingsService

## 6.4 API routes recommandées

```txt
GET /api/federis/dashboard
POST /api/federis/patronats
GET /api/federis/patronats/:id
PATCH /api/federis/patronats/:id

GET /api/federis/schools
POST /api/federis/schools/link
POST /api/federis/schools/manual
PATCH /api/federis/schools/:id/status

GET /api/federis/exams
POST /api/federis/exams
GET /api/federis/exams/:id
PATCH /api/federis/exams/:id
POST /api/federis/exams/:id/publish-results

GET /api/federis/exams/:id/candidates
POST /api/federis/exams/:id/candidates/import
POST /api/federis/exams/:id/candidates/validate

GET /api/federis/exams/:id/centers
POST /api/federis/exams/:id/centers
POST /api/federis/exams/:id/centers/assign-candidates

GET /api/federis/exams/:id/subjects
POST /api/federis/exams/:id/subjects

GET /api/federis/exams/:id/grades
POST /api/federis/exams/:id/grades
POST /api/federis/exams/:id/grades/validate

POST /api/federis/exams/:id/deliberation
POST /api/federis/exams/:id/results/publish

GET /api/federis/reports
GET /api/federis/subscription
POST /api/federis/subscription/change-plan
```

## 6.5 Sécurité

- authentification commune avec Academia Helm ;
- RBAC strict ;
- isolation par tenant ;
- journalisation ;
- chiffrement des documents sensibles ;
- accès restreint aux sujets ;
- verrouillage des notes ;
- traçabilité des délibérations ;
- permissions granulaires ;
- limitation d’accès aux données écoles.

---

# 7. Base de données

## 7.1 Tables principales

```txt
federis_tenants
federis_patronats
federis_patronat_users
federis_subscriptions
federis_subscription_plans
federis_invoices
federis_payments

federis_school_memberships
federis_manual_schools
federis_school_sync_requests
federis_school_sync_logs

federis_exams
federis_exam_levels
federis_exam_classes
federis_exam_subjects
federis_exam_schools
federis_exam_rules

federis_candidates
federis_candidate_imports
federis_candidate_validations

federis_centers
federis_center_rooms
federis_center_assignments
federis_center_staff

federis_subject_files
federis_subject_access_logs

federis_compositions
federis_attendance
federis_incidents
federis_supervision_reports

federis_correctors
federis_correction_assignments
federis_grades
federis_grade_controls
federis_grade_locks

federis_deliberations
federis_deliberation_cases
federis_deliberation_decisions
federis_deliberation_pv

federis_results
federis_result_publications
federis_parent_notifications

federis_reports
federis_archives
federis_settings
federis_audit_logs
```

## 7.2 Champs clés — federis_patronats

- id
- tenant_id
- name
- department
- commune
- address
- logo_url
- official_email
- official_phone
- president_name
- secretary_name
- status
- active_school_year_id
- created_at
- updated_at

## 7.3 Champs clés — federis_school_memberships

- id
- tenant_id
- patronat_id
- school_id
- manual_school_id
- membership_status
- sync_status
- allowed_total_students
- allowed_exam_class_students
- cm2_count
- troisieme_count
- terminale_count
- joined_at
- created_at
- updated_at

## 7.4 Champs clés — federis_exams

- id
- tenant_id
- patronat_id
- name
- exam_type
- school_year_id
- level
- class_name
- series
- start_date
- end_date
- status
- publication_mode
- deliberation_status
- created_by
- created_at
- updated_at

## 7.5 Champs clés — federis_candidates

- id
- tenant_id
- exam_id
- school_id
- student_id
- manual_candidate_id
- candidate_number
- table_number
- center_id
- room_id
- first_name
- last_name
- gender
- birth_date
- class_name
- series
- status
- final_decision
- created_at
- updated_at

## 7.6 Champs clés — federis_grades

- id
- tenant_id
- exam_id
- candidate_id
- subject_id
- corrector_id
- score
- max_score
- coefficient
- weighted_score
- status
- validated_by
- locked_at
- created_at
- updated_at

## 7.7 Champs clés — federis_results

- id
- tenant_id
- exam_id
- candidate_id
- total_score
- average
- rank
- mention
- decision
- published_at
- parent_notified_at
- created_at
- updated_at

---

# 8. Permissions et rôles

## 8.1 Rôles plateforme

- PLATFORM_OWNER
- SUPER_ADMIN
- SUPPORT_ADMIN
- BILLING_ADMIN
- TECHNICAL_ADMIN

## 8.2 Rôles patronat

- FEDERIS_PATRONAT_OWNER
- FEDERIS_PRESIDENT
- FEDERIS_SECRETARY
- FEDERIS_EXAM_MANAGER
- FEDERIS_STATISTICS_MANAGER
- FEDERIS_FINANCE_MANAGER
- FEDERIS_COMMUNICATION_MANAGER
- FEDERIS_DATA_ENTRY_AGENT
- FEDERIS_SUPERVISOR

## 8.3 Rôles école

- FEDERIS_SCHOOL_OWNER
- FEDERIS_SCHOOL_DIRECTOR
- FEDERIS_SCHOOL_EXAM_MANAGER
- FEDERIS_SCHOOL_SECRETARY

## 8.4 Rôles examen

- FEDERIS_CENTER_CHIEF
- FEDERIS_SUPERVISOR_AGENT
- FEDERIS_CORRECTOR
- FEDERIS_JURY_MEMBER
- FEDERIS_DELIBERATION_ADMIN

## 8.5 Permissions principales

```txt
FEDERIS_VIEW
FEDERIS_DASHBOARD_VIEW
FEDERIS_PATRONAT_MANAGE
FEDERIS_SUBSCRIPTION_MANAGE
FEDERIS_SCHOOL_VIEW
FEDERIS_SCHOOL_MANAGE
FEDERIS_SCHOOL_SYNC
FEDERIS_EXAM_VIEW
FEDERIS_EXAM_CREATE
FEDERIS_EXAM_MANAGE
FEDERIS_EXAM_DELETE
FEDERIS_CENTER_VIEW
FEDERIS_CENTER_MANAGE
FEDERIS_CANDIDATE_VIEW
FEDERIS_CANDIDATE_MANAGE
FEDERIS_SUBJECT_VIEW
FEDERIS_SUBJECT_MANAGE
FEDERIS_COMPOSITION_VIEW
FEDERIS_COMPOSITION_MANAGE
FEDERIS_CORRECTION_VIEW
FEDERIS_CORRECTION_MANAGE
FEDERIS_GRADE_VIEW
FEDERIS_GRADE_MANAGE
FEDERIS_GRADE_VALIDATE
FEDERIS_GRADE_LOCK
FEDERIS_DELIBERATION_VIEW
FEDERIS_DELIBERATION_MANAGE
FEDERIS_RESULT_VIEW
FEDERIS_RESULT_PUBLISH
FEDERIS_REPORT_VIEW
FEDERIS_REPORT_EXPORT
FEDERIS_NOTIFICATION_SEND
FEDERIS_SETTINGS_MANAGE
FEDERIS_AUDIT_LOG_VIEW
```

---

# 9. UI/UX du dashboard Federis

## 9.1 Principes UX

Le dashboard doit être :

- institutionnel ;
- clair ;
- rapide ;
- orienté décision ;
- mobile-friendly ;
- sécurisé ;
- adapté aux rôles ;
- centré sur les examens actifs ;
- centré sur les alertes critiques.

## 9.2 Navigation recommandée

Sidebar :

```txt
Dashboard
Patronat
Écoles membres
Classes d’examen
Examens
Centres
Candidats
Épreuves & sujets
Composition
Surveillance
Correction
Notes
Délibération
Résultats
Statistiques
Rapports
Communication
Finances
Archives
Paramètres
```

## 9.3 Widgets dashboard

- Statut abonnement
- Écoles membres
- Écoles synchronisées
- Effectifs classes d’examen
- Examens actifs
- Candidats inscrits
- Centres actifs
- Notes en attente
- Résultats à publier
- Alertes critiques
- Performance globale
- Top écoles
- Écoles à risque
- Paiements/abonnement

## 9.4 UI par rôle

### Président patronat

Vue :

- pilotage global ;
- statistiques ;
- résultats ;
- écoles ;
- finances ;
- rapports.

### Responsable examens

Vue :

- examens ;
- candidats ;
- centres ;
- sujets ;
- composition ;
- correction ;
- délibération.

### Responsable statistiques

Vue :

- résultats ;
- performances ;
- comparatifs ;
- exports ;
- rapports.

### Responsable finances

Vue :

- abonnement ;
- factures ;
- paiements ;
- frais examens ;
- reçus.

### École associée

Vue :

- examens disponibles ;
- candidats de l’école ;
- centres ;
- résultats ;
- rapports école.

### Parent

Vue :

- examens de l’enfant ;
- calendrier ;
- centre ;
- résultats ;
- performance ;
- recommandations.

## 9.5 Composants UI recommandés

```txt
FederisDashboardCards
FederisExamProgressTracker
FederisSchoolMembershipTable
FederisCandidateImportWizard
FederisExamCreationWizard
FederisCenterAssignmentBoard
FederisSubjectSecureVault
FederisCompositionAttendanceTable
FederisCorrectionWorkspace
FederisGradeControlPanel
FederisDeliberationBoard
FederisResultPublicationPanel
FederisAnalyticsCharts
FederisReportBuilder
FederisSubscriptionStatusCard
```

---

# 10. Cahier des charges complet — Synthèse opérationnelle

## 10.1 Objectif global

Construire Academia Federis comme une application satellite professionnelle de l’écosystème Academia Helm permettant aux patronats scolaires privés de gérer leurs écoles membres, organiser des examens inter-écoles, suivre les candidats, publier les résultats et piloter les performances institutionnelles.

## 10.2 Périmètre MVP recommandé

Le MVP doit inclure :

1. Landing page
2. Inscription patronat
3. Plans d’abonnement
4. Création espace patronat
5. Dashboard patronat
6. Gestion écoles membres
7. Création école manuelle
8. Recherche école Academia Helm
9. Association école
10. Création examen
11. Gestion candidats
12. Import Excel candidats
13. Centres d’examen
14. Épreuves
15. Saisie notes
16. Calcul résultats
17. Délibération simple
18. Publication résultats
19. Notification parents Academia Helm
20. Rapports PDF/Excel
21. Administration plateforme

## 10.3 Périmètre V2

À ajouter ensuite :

- double correction ;
- anonymat des copies ;
- portail correcteur complet ;
- portail centre avancé ;
- statistiques avancées ;
- ORION Federis ;
- Sara AI Federis ;
- portail public de résultats ;
- API externe ;
- paiement frais examens ;
- classement écoles ;
- génération automatique de PV ;
- signature électronique des PV ;
- verrouillage avancé des résultats.

## 10.4 Règles métier critiques

- Un patronat doit avoir un abonnement actif pour utiliser pleinement la plateforme.
- Le patronat n’accède jamais aux données internes complètes des écoles.
- Les données visibles sont limitées aux informations institutionnelles et examens.
- Les classes prioritaires sont CM2, 3ème et Terminale.
- Une école doit valider son association si elle existe déjà sur Academia Helm.
- Une école manuelle doit pouvoir être rapprochée plus tard d’un compte réel.
- Les sujets sont confidentiels et journalisés.
- Les notes validées sont verrouillées.
- La délibération est obligatoire avant publication.
- Les résultats publiés déclenchent les notifications parents.
- Les parents ne voient que les résultats de leurs enfants.
- Les écoles ne voient que leurs propres élèves.
- Les rapports sont exportables.
- Les actions sensibles sont journalisées.

## 10.5 Routes frontend recommandées

```txt
/federis
/federis/login
/federis/register
/federis/pricing
/federis/dashboard
/federis/patronat
/federis/schools
/federis/schools/sync
/federis/exam-classes
/federis/exams
/federis/exams/new
/federis/exams/[id]
/federis/exams/[id]/candidates
/federis/exams/[id]/centers
/federis/exams/[id]/subjects
/federis/exams/[id]/composition
/federis/exams/[id]/surveillance
/federis/exams/[id]/correction
/federis/exams/[id]/grades
/federis/exams/[id]/deliberation
/federis/exams/[id]/results
/federis/statistics
/federis/reports
/federis/communication
/federis/billing
/federis/archives
/federis/settings
/admin/federis
```

## 10.6 Nommage recommandé dans le code

Préfixe :

```txt
federis
```

Exemples :

```txt
FederisDashboard
FederisExam
FederisCandidate
FederisCenter
FederisResult
FederisSubscription
FederisSchoolMembership
```

Tables :

```txt
federis_exams
federis_candidates
federis_results
```

Permissions :

```txt
FEDERIS_EXAM_MANAGE
FEDERIS_RESULT_PUBLISH
```

## 10.7 Intégrations obligatoires avec Academia Helm

- Auth commune ;
- écoles existantes ;
- élèves/candidats autorisés ;
- parents ;
- notifications ;
- paiements ;
- fichiers ;
- audit logs ;
- ORION ;
- Sara AI ;
- Atlas Knowledge Base.

## 10.8 Livrables techniques attendus

- landing page Federis ;
- module d’inscription patronat ;
- module abonnement ;
- dashboard patronat ;
- module écoles membres ;
- module examens ;
- module candidats ;
- module centres ;
- module sujets ;
- module notes ;
- module délibération ;
- module résultats ;
- notifications parents ;
- rapports ;
- base de données ;
- permissions ;
- routes API ;
- composants UI ;
- documentation technique.

## 10.9 Conclusion

Academia Federis doit être conçu comme une application SaaS institutionnelle sérieuse, autonome et monétisable, mais profondément intégrée à Academia Helm.

Sa promesse centrale :

```txt
Permettre aux patronats scolaires privés de fédérer les écoles, organiser les examens inter-écoles, publier les résultats et piloter la performance éducative avec rigueur, sécurité et traçabilité.
```

Academia Helm gère l’école.

Academia Federis pilote le réseau d’écoles.

Les deux ensemble forment une infrastructure numérique éducative complète.
