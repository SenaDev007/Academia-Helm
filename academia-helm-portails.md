# Academia Helm — Documentation des Portails

> YEHI OR Tech — Confidentiel

ACADEMIA HELM — DOCUMENTATION DES PORTAILS
YEHI OR Tech • academiahelm.com
Portails Academia Helm
Documentation complète des rôles, responsabilités et accréditations

| PRODUIT Academia Helm | AUTEUR YEHI OR Tech | VERSION v1.0 — 2026 | STATUT CONFIDENTIEL |
| --- | --- | --- | --- |


## Architecture des portails


| PORTAIL | DESCRIPTION | RÔLES |
| --- | --- | --- |
| Portail Plateforme | 7 rôles — Administration SaaS globale | 7 |
| Portail École | 45 rôles — Gestion de l'établissement | 45 |
| Portail Enseignant | 11 rôles — Pédagogie & suivi | 11 |
| Portail Parent / Élève | 9 rôles — Suivi & communication | 9 |
| Portail Public | 5 rôles — Pré-inscription & acquisition | 5 |

Tous les portails partagent une architecture RBAC commune : portail → rôle → fonction → accréditations → scopes → permissions → modules autorisés.

| PORTAIL 01 Portail Plateforme Administration globale d'Academia Helm en tant que SaaS |
| --- |


| Platform Owner PLATEFORME | PORTAIL PLATEFORME |
| --- | --- |


### Responsabilités & Accès


| • Supervision business globale | • Pilotage stratégique |
| --- | --- |
| • Suivi des écoles clientes | • Accès aux statistiques globales |
| • Suivi des souscriptions initiales | • Supervision ORION global |
| • Suivi des abonnements actifs | • Supervision SARA AI |
| • Supervision des revenus SaaS | • Audit plateforme global |


### Modèle technique (RBAC)


| portal | PLATFORM |
| --- | --- |
| role | PLATFORM_OWNER |
| function | PLATFORM_OWNER |
| permissions | ALL — Accès total non restrictible |


| Platform Super Admin PLATEFORME | PORTAIL PLATEFORME |
| --- | --- |


### Responsabilités & Accès


| • Création et gestion des tenants | • Supervision sécurité |
| --- | --- |
| • Activation ou suspension des écoles | • Support technique avancé |
| • Configuration des plans SaaS | • Audit technique complet |
| • Configuration des modules par école | • Diagnostic système |
| • Gestion des rôles globaux | • Gestion des incidents critiques |


### Modèle technique (RBAC)


| portal | PLATFORM |
| --- | --- |
| role | PLATFORM_SUPER_ADMIN |
| function | SUPER_ADMIN |
| permissions | TENANT_MANAGE | PLAN_CONFIGURE | ROLE_MANAGE | SECURITY_AUDIT | SYSTEM_DIAGNOSE |


| Platform Admin PLATEFORME | PORTAIL PLATEFORME |
| --- | --- |


### Responsabilités & Accès


| • Suivi opérationnel des écoles | • Suivi des incidents |
| --- | --- |
| • Assistance aux établissements | • Gestion de certaines configurations |
| • Consultation des tenants autorisés | • Accès limité aux données sensibles |
| • Support niveau 1 et 2 |  |


### Modèle technique (RBAC)


| portal | PLATFORM |
| --- | --- |
| role | PLATFORM_ADMIN |
| function | PLATFORM_ADMIN |
| permissions | TENANT_VIEW | TENANT_SUPPORT | INCIDENT_MANAGE | CONFIG_LIMITED |


| Billing Manager Platform PLATEFORME | PORTAIL PLATEFORME |
| --- | --- |


### Responsabilités & Accès


| • Suivi des souscriptions initiales | • Relances pour impayés |
| --- | --- |
| • Suivi des abonnements récurrents | • Suspensions pour impayés |
| • Gestion des factures SaaS | • Rapports financiers SaaS |
| • Paiements des écoles |  |


### Modèle technique (RBAC)


| portal | PLATFORM |
| --- | --- |
| role | BILLING_MANAGER |
| function | BILLING_MANAGER |
| permissions | SUBSCRIPTION_MANAGE | INVOICE_MANAGE | PAYMENT_VIEW | SUSPENSION_TRIGGER | REPORT_FINANCIAL |


| Support Agent Platform PLATEFORME | PORTAIL PLATEFORME |
| --- | --- |


### Responsabilités & Accès


| • Assistance aux écoles clientes | • Remontée d'incidents |
| --- | --- |
| • Traitement des tickets de support | • Accompagnement utilisateurs |
| • Diagnostic de premier niveau | • Consultation limitée des données techniques |


### Modèle technique (RBAC)


| portal | PLATFORM |
| --- | --- |
| role | SUPPORT_AGENT |
| function | SUPPORT_AGENT |
| permissions | TICKET_MANAGE | TENANT_VIEW_LIMITED | INCIDENT_CREATE | USER_ASSIST |


| Technical Operator / DevOps PLATEFORME | PORTAIL PLATEFORME |
| --- | --- |


### Responsabilités & Accès


| • Monitoring des services | • Sécurité technique |
| --- | --- |
| • Gestion des logs | • Disponibilité des services |
| • Performances système | • Intégrations système |
| • Sauvegardes | • Gestion des incidents techniques |


### Modèle technique (RBAC)


| portal | PLATFORM |
| --- | --- |
| role | TECHNICAL_OPERATOR |
| function | DEVOPS |
| permissions | INFRA_MANAGE | LOG_ACCESS | BACKUP_MANAGE | SECURITY_TECHNICAL | INTEGRATION_MANAGE |


| Platform Auditor PLATEFORME | PORTAIL PLATEFORME |
| --- | --- |


### Responsabilités & Accès


| • Consultation des journaux d'audit | • Rapports d'audit plateforme |
| --- | --- |
| • Contrôle des actions sensibles | • Analyse des accès |
| • Vérification de conformité | • Aucun droit d'écriture |


### Modèle technique (RBAC)


| portal | PLATFORM |
| --- | --- |
| role | PLATFORM_AUDITOR |
| function | AUDITOR |
| permissions | AUDIT_LOG_VIEW | COMPLIANCE_REPORT | ACCESS_ANALYSIS — READ ONLY |


| PORTAIL 02 Portail École Gestion complète de l'établissement — vues dynamiques par accréditation |
| --- |


### 3.1 — Gouvernance et Direction Générale


| Promoteur / Fondateur ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Vision globale de l'établissement | • Suivi des résultats par niveau |
| --- | --- |
| • Pilotage stratégique | • Supervision Maternelle, Primaire, Secondaire |
| • Suivi des effectifs globaux | • Validation des grandes décisions |
| • Suivi des finances consolidées | • Consultation des rapports consolidés |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | SCHOOL_OWNER |
| function | PROMOTEUR |
| accreditations | ALL_LEVELS |
| permissions | ALL_VIEW | STRATEGIC_REPORT | FINANCE_CONSOLIDATED | DECISION_VALIDATE |


| Président / Représentant du Conseil d'Administration ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Supervision institutionnelle | • Suivi des performances par niveau |
| --- | --- |
| • Consultation des rapports | • Validation stratégique |
| • Suivi financier global | • Audit de gouvernance |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | BOARD_PRESIDENT |
| function | PRESIDENT_CA |
| accreditations | ALL_LEVELS |
| permissions | REPORT_VIEW | FINANCE_VIEW | GOVERNANCE_AUDIT | STRATEGIC_VALIDATE |


| Directeur Général ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Pilotage quotidien global | • Coordination administrative et pédagogique |
| --- | --- |
| • Supervision des responsables de niveau | • Suivi des incidents |
| • Validation des décisions importantes | • Rapports globaux |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | DIRECTOR_GENERAL |
| function | DG |
| accreditations | ALL_LEVELS |
| permissions | ALL_MANAGE | INCIDENT_MANAGE | REPORT_FULL | DECISION_VALIDATE |


| Directeur d'Établissement ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Gestion opérationnelle de l'école | • Supervision des élèves et enseignants |
| --- | --- |
| • Suivi administratif complet | • Communication officielle |
| • Suivi pédagogique | • Discipline générale |
| • Validation des bulletins |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | SCHOOL_DIRECTOR |
| function | DIRECTEUR |
| accreditations | ALL_LEVELS |
| permissions | STUDENT_MANAGE | TEACHER_MANAGE | BULLETIN_VALIDATE | DISCIPLINE_MANAGE | COMMUNICATION_OFFICIAL |


| Directeur Adjoint ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Appui au directeur | • Coordination interne |
| --- | --- |
| • Supervision déléguée | • Remplacement du directeur selon autorisation |
| • Validations partielles |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | DEPUTY_DIRECTOR |
| function | DIRECTEUR_ADJOINT |
| accreditations | ALL_LEVELS |
| permissions | STUDENT_VIEW | TEACHER_VIEW | BULLETIN_VIEW | COORDINATION_MANAGE — délégation configurable |


### 3.2 — Administration Générale


| Secrétaire Général ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Coordination administrative globale | • Supervision des secrétariats par niveau |
| --- | --- |
| • Gestion des documents officiels | • Dossiers institutionnels |
| • Courriers et archives institutionnelles |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | SCHOOL_ADMIN |
| function | SECRETAIRE_GENERAL |
| permissions | DOCUMENT_MANAGE | ARCHIVE_MANAGE | SECRETARIAT_SUPERVISE | MAIL_MANAGE |


| Agent Administratif ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Saisie de données | • Préparation de documents |
| --- | --- |
| • Classement et archivage | • Gestion des tâches autorisées |
| • Assistance administrative |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | ADMIN_AGENT |
| function | AGENT_ADMIN |
| permissions | DATA_ENTRY | DOCUMENT_PREPARE | ARCHIVE_VIEW | TASK_LIMITED |


| Responsable Scolarité Générale ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Politique d'inscription | • Consolidation des effectifs |
| --- | --- |
| • Admissions et réinscriptions | • Statistiques scolaires |
| • Affectations des élèves | • Supervision des responsables scolarité par niveau |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | SCHOOL_ADMIN |
| function | RESP_SCOLARITE |
| permissions | STUDENT_MANAGE | ADMISSION_MANAGE | ENROLLMENT_MANAGE | STAT_ACADEMIC | LEVEL_SUPERVISE |


| Data Manager / Responsable Données ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Qualité des données | • Contrôle des doublons |
| --- | --- |
| • Imports et exports de données | • Cohérence des fichiers |
| • Nettoyage et déduplication | • Consolidation multi-niveaux |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | DATA_MANAGER |
| function | DATA_MANAGER |
| permissions | DATA_IMPORT | DATA_EXPORT | DATA_CLEAN | DUPLICATE_MANAGE | CONSOLIDATION |


| Auditeur Interne ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Audit des actions sensibles | • Rapports de conformité |
| --- | --- |
| • Contrôle des accès utilisateurs | • Analyse des journaux d'activité |
| • Vérification scolarité et finances |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | INTERNAL_AUDITOR |
| function | AUDITEUR_INTERNE |
| permissions | AUDIT_LOG_VIEW | ACCESS_REVIEW | FINANCE_AUDIT | SCOLARITE_AUDIT — READ ONLY |


### 3.3 — Administration Maternelle | Accréditation : MATERNELLE_ADMIN


| Responsable Maternelle MATERNELLE | PORTAIL MATERNELLE |
| --- | --- |


### Responsabilités & Accès


| • Pilotage de la Maternelle | • Validation des livrets qualitatifs |
| --- | --- |
| • Suivi des classes M1 et M2 | • Communication avec les parents |
| • Supervision des enseignants maternelle | • Rapports Maternelle |
| • Suivi des évaluations qualitatives |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | SCHOOL_ADMIN |
| function | RESP_MATERNELLE |
| accreditations | MATERNELLE_ADMIN |
| levelScopes | MATERNELLE |
| classScopes | MATERNELLE_1 | MATERNELLE_2 |
| permissions | STUDENT_VIEW | STUDENT_CREATE | QUALITATIVE_EVAL_MANAGE | REPORT_BOOK_VALIDATE | PARENT_COMMUNICATION |


| Coordinateur Pédagogique Maternelle MATERNELLE | PORTAIL MATERNELLE |
| --- | --- |


### Responsabilités & Accès


| • Activités d'éveil | • Compétences observées |
| --- | --- |
| • Progression pédagogique | • Accompagnement des enseignants |
| • Grilles d'évaluation qualitatives | • Validation des appréciations |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | PEDAGOGIC_COORDINATOR |
| function | COORD_PED_MAT |
| accreditations | MATERNELLE_ADMIN |
| levelScopes | MATERNELLE |
| permissions | EVAL_QUALITATIVE | PROG_MANAGE | TEACHER_SUPPORT | APPRECIATION_VALIDATE |


| Secrétaire Maternelle MATERNELLE | PORTAIL MATERNELLE |
| --- | --- |


### Responsabilités & Accès


| • Inscriptions Maternelle | • Attestations |
| --- | --- |
| • Dossiers enfants | • Listes M1 et M2 |
| • Informations parents | • Documents administratifs |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | SECRETARY |
| function | SECRETAIRE_MAT |
| accreditations | MATERNELLE_ADMIN |
| levelScopes | MATERNELLE |
| permissions | STUDENT_CREATE | STUDENT_VIEW | DOCUMENT_GENERATE | PARENT_VIEW | LIST_EXPORT |


| Surveillant / Assistant Vie Scolaire Maternelle MATERNELLE | PORTAIL MATERNELLE |
| --- | --- |


### Responsabilités & Accès


| • Présences et retards | • Sécurité des enfants |
| --- | --- |
| • Gestion des sorties | • Communication rapide aux parents |
| • Incidents mineurs |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | MONITOR |
| function | SURVEILLANT_MAT |
| accreditations | MATERNELLE_ADMIN |
| levelScopes | MATERNELLE |
| permissions | ATTENDANCE_MANAGE | INCIDENT_MINOR | PARENT_ALERT |


| Assistant(e) Maternelle MATERNELLE | PORTAIL MATERNELLE |
| --- | --- |


### Responsabilités & Accès


| • Accompagnement en classe | • Assistance à l'enseignant |
| --- | --- |
| • Aide aux activités éducatives | • Suivi quotidien des enfants |
| • Observation comportementale |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | TEACHING_ASSISTANT |
| function | ASSISTANT_MAT |
| accreditations | MATERNELLE_ADMIN |
| levelScopes | MATERNELLE |
| permissions | STUDENT_VIEW | ATTENDANCE_VIEW | OBSERVATION_ADD |


### 3.4 — Administration Primaire | Accréditation : PRIMARY_ADMIN


| Responsable Primaire PRIMAIRE | PORTAIL PRIMAIRE |
| --- | --- |


### Responsabilités & Accès


| • Pilotage du Primaire | • Suivi des évaluations mensuelles et certificatives |
| --- | --- |
| • Suivi des classes CI à CM2 | • Validation des bulletins Primaire |
| • Supervision des enseignants titulaires | • Rapports Primaire |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | SCHOOL_ADMIN |
| function | RESP_PRIMAIRE |
| accreditations | PRIMARY_ADMIN |
| levelScopes | PRIMARY |
| classScopes | CI | CP | CE1 | CE2 | CM1 | CM2 |
| permissions | STUDENT_MANAGE | TEACHER_SUPERVISE | GRADE_VALIDATE | BULLETIN_VALIDATE | REPORT_PRIMARY |


| Coordinateur Pédagogique Primaire PRIMAIRE | PORTAIL PRIMAIRE |
| --- | --- |


### Responsabilités & Accès


| • Progression pédagogique | • Analyse des résultats |
| --- | --- |
| • Harmonisation des évaluations | • Accompagnement enseignants |
| • Suivi des compétences | • Qualité pédagogique |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | PEDAGOGIC_COORDINATOR |
| function | COORD_PED_PRI |
| accreditations | PRIMARY_ADMIN |
| levelScopes | PRIMARY |
| permissions | CURRICULUM_MANAGE | EVAL_HARMONIZE | COMPETENCE_TRACK | RESULT_ANALYZE | TEACHER_SUPPORT |


| Responsable Examens Primaire PRIMAIRE | PORTAIL PRIMAIRE |
| --- | --- |


### Responsabilités & Accès


| • Planification des évaluations mensuelles | • Contrôle des moyennes |
| --- | --- |
| • Planification des évaluations certificatives | • Préparation des bulletins |
| • Collecte des notes | • Suivi des règles de calcul |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | EXAM_MANAGER |
| function | RESP_EXAM_PRI |
| accreditations | PRIMARY_ADMIN |
| levelScopes | PRIMARY |
| permissions | EXAM_PLAN | GRADE_COLLECT | AVERAGE_COMPUTE | BULLETIN_PREPARE | CALC_RULES_VIEW |


| Secrétaire Primaire PRIMAIRE | PORTAIL PRIMAIRE |
| --- | --- |


### Responsabilités & Accès


| • Inscriptions Primaire | • Listes CI à CM2 |
| --- | --- |
| • Dossiers élèves | • Transferts élèves |
| • Certificats et attestations | • Export EDUCMASTER |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | SECRETARY |
| function | SECRETAIRE_PRI |
| accreditations | PRIMARY_ADMIN |
| levelScopes | PRIMARY |
| permissions | STUDENT_ENROLL | STUDENT_VIEW | CERTIFICATE_GENERATE | TRANSFER_MANAGE | EXPORT_EDUCMASTER |


| Surveillant Primaire PRIMAIRE | PORTAIL PRIMAIRE |
| --- | --- |


### Responsabilités & Accès


| • Présences et absences | • Sorties et incidents |
| --- | --- |
| • Retards | • Communication parents |
| • Discipline |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | MONITOR |
| function | SURVEILLANT_PRI |
| accreditations | PRIMARY_ADMIN |
| levelScopes | PRIMARY |
| permissions | ATTENDANCE_MANAGE | DISCIPLINE_MANAGE | INCIDENT_LOG | PARENT_ALERT |


| Responsable Activités Primaire PRIMAIRE | PORTAIL PRIMAIRE |
| --- | --- |


### Responsabilités & Accès


| • Activités éducatives | • Autorisations parentales |
| --- | --- |
| • Sorties pédagogiques | • Rapports d'activités |
| • Clubs et événements |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | ACTIVITIES_MANAGER |
| function | RESP_ACTIVITES_PRI |
| accreditations | PRIMARY_ADMIN |
| levelScopes | PRIMARY |
| permissions | ACTIVITY_MANAGE | TRIP_MANAGE | CLUB_MANAGE | CONSENT_MANAGE | ACTIVITY_REPORT |


### 3.5 — Administration Secondaire | Accréditation : SECONDARY_ADMIN


| Responsable Secondaire SECONDAIRE | PORTAIL SECONDAIRE |
| --- | --- |


### Responsabilités & Accès


| • Pilotage du Secondaire | • Validation des bulletins |
| --- | --- |
| • Suivi des classes 6ème à Tle | • Coordination des conseils de classe |
| • Supervision des enseignants du secondaire | • Rapports Secondaire |
| • Suivi des matières avec coefficients |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | SCHOOL_ADMIN |
| function | RESP_SECONDAIRE |
| accreditations | SECONDARY_ADMIN |
| levelScopes | SECONDARY |
| classScopes | SIXIEME | CINQUIEME | QUATRIEME | TROISIEME | SECONDE | PREMIERE | TERMINALE |
| permissions | STUDENT_MANAGE | SUBJECT_MANAGE | COEFFICIENT_MANAGE | EXAM_MANAGE | GRADE_VALIDATE | BULLETIN_VALIDATE | CLASS_COUNCIL |


| Censeur SECONDAIRE | PORTAIL SECONDAIRE |
| --- | --- |


### Responsabilités & Accès


| • Organisation pédagogique | • Contrôle des coefficients |
| --- | --- |
| • Emplois du temps | • Examens et bulletins |
| • Suivi des programmes | • Conseils de classe |
| • Supervision des notes |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | CENSOR |
| function | CENSEUR |
| accreditations | SECONDARY_ADMIN |
| levelScopes | SECONDARY |
| permissions | TIMETABLE_MANAGE | PROGRAM_SUPERVISE | GRADE_SUPERVISE | COEFFICIENT_CHECK | EXAM_SUPERVISE | BULLETIN_SUPERVISE | CLASS_COUNCIL |


| Surveillant Général SECONDAIRE | PORTAIL SECONDAIRE |
| --- | --- |


### Responsabilités & Accès


| • Vie scolaire du Secondaire | • Convocations |
| --- | --- |
| • Absences et retards | • Incidents |
| • Discipline et sanctions | • Rapports de vie scolaire |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | GENERAL_MONITOR |
| function | SURVEILLANT_GENERAL |
| accreditations | SECONDARY_ADMIN |
| levelScopes | SECONDARY |
| permissions | ATTENDANCE_MANAGE | DISCIPLINE_MANAGE | SANCTION_MANAGE | CONVOCATION_MANAGE | INCIDENT_LOG | LIFE_REPORT |


| Responsable Examens Secondaire SECONDAIRE | PORTAIL SECONDAIRE |
| --- | --- |


### Responsabilités & Accès


| • Interrogations et devoirs surveillés | • Classements |
| --- | --- |
| • Compositions et examens blancs | • Bulletins |
| • Coefficients et moyennes | • Procès-verbaux de délibération |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | EXAM_MANAGER |
| function | RESP_EXAM_SEC |
| accreditations | SECONDARY_ADMIN |
| levelScopes | SECONDARY |
| permissions | EXAM_PLAN | EXAM_SUPERVISE | GRADE_COLLECT | AVERAGE_COMPUTE | RANKING_GENERATE | BULLETIN_GENERATE | PV_GENERATE |


| Responsable Orientation SECONDAIRE | PORTAIL SECONDAIRE |
| --- | --- |


### Responsabilités & Accès


| • Orientation scolaire | • Conseils aux familles |
| --- | --- |
| • Choix de séries | • Préparation aux examens nationaux |
| • Suivi des élèves | • Dossiers d'orientation |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | ORIENTATION_MANAGER |
| function | RESP_ORIENTATION |
| accreditations | SECONDARY_ADMIN |
| levelScopes | SECONDARY |
| permissions | ORIENTATION_MANAGE | SERIES_ASSIGN | STUDENT_COUNSEL | FAMILY_COMMUNICATE | EXAM_PREPARE | DOSSIER_MANAGE |


| Secrétaire Secondaire SECONDAIRE | PORTAIL SECONDAIRE |
| --- | --- |


### Responsabilités & Accès


| • Inscriptions Secondaire | • Transferts |
| --- | --- |
| • Dossiers élèves | • Documents examens |
| • Certificats et attestations | • Export EDUCMASTER |
| • Listes 6ème à Tle |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | SECRETARY |
| function | SECRETAIRE_SEC |
| accreditations | SECONDARY_ADMIN |
| levelScopes | SECONDARY |
| permissions | STUDENT_ENROLL | STUDENT_VIEW | CERTIFICATE_GENERATE | TRANSFER_MANAGE | EXAM_DOCUMENT | EXPORT_EDUCMASTER |


### 3.6 — Finance et Économat


| Directeur Administratif et Financier ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Supervision financière globale | • Consolidation financière |
| --- | --- |
| • Gestion des budgets | • Validation des dépenses |
| • Contrôle des caisses | • Stratégie économique |
| • Rapports financiers |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | CFO |
| function | DAF |
| permissions | FINANCE_ALL | BUDGET_MANAGE | CASHIER_SUPERVISE | REPORT_FINANCIAL | EXPENSE_VALIDATE | STRATEGY_FINANCIAL |


| Responsable Financier ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Suivi financier quotidien | • Contrôle des encaissements |
| --- | --- |
| • Analyse des recettes | • Suivi des impayés |
| • Analyse des dépenses | • Rapports financiers |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | FINANCE_MANAGER |
| function | RESP_FINANCIER |
| permissions | FINANCE_VIEW | RECEIPT_MANAGE | EXPENSE_VIEW | ENCAISSEMENT_CHECK | UNPAID_TRACK | REPORT_FINANCIAL |


| Comptable ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Comptabilité générale | • États financiers |
| --- | --- |
| • Recettes et dépenses | • Bilans |
| • Rapprochements bancaires | • Audit financier |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | ACCOUNTANT |
| function | COMPTABLE |
| permissions | ACCOUNTING_MANAGE | RECEIPT_RECORD | EXPENSE_RECORD | BANK_RECONCILE | FINANCIAL_STATEMENT | AUDIT_FINANCIAL |


| Caissier ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Encaissements en caisse | • Clôture de caisse quotidienne |
| --- | --- |
| • Édition des reçus | • Historique caisse |
| • Consultation des soldes élèves | • Annulation selon permission |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | CASHIER |
| function | CAISSIER |
| permissions | PAYMENT_RECEIVE | RECEIPT_GENERATE | STUDENT_BALANCE_VIEW | CASHIER_CLOSE | CASHIER_HISTORY | CANCELLATION_LIMITED |


| Responsable Recouvrement ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Suivi des débiteurs | • Blocages selon politique école |
| --- | --- |
| • Relances des parents | • Rapports de recouvrement |
| • Gestion des échéanciers | • Coordination avec la communication |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | RECOVERY_MANAGER |
| function | RESP_RECOUVREMENT |
| permissions | DEBTOR_TRACK | PARENT_REMIND | PAYMENT_PLAN | ACCESS_BLOCK | RECOVERY_REPORT | COMMUNICATION_COORDINATE |


### 3.7 — Pédagogie, Vie Scolaire et Services


| Responsable Pédagogique Général ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Cohérence pédagogique globale | • Évaluations |
| --- | --- |
| • Coordination des responsables pédagogiques | • Qualité des enseignements |
| • Curricula | • Rapports pédagogiques consolidés |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | PEDAGOGIC_DIRECTOR |
| function | RESP_PED_GENERAL |
| permissions | CURRICULUM_ALL | EVAL_SUPERVISE | QUALITY_MANAGE | PEDAGOGY_REPORT | LEVEL_COORDINATE |


| Responsable Vie Scolaire ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Présences et absences | • Sanctions |
| --- | --- |
| • Retards | • Convocations |
| • Discipline | • Rapports de vie scolaire |
| • Incidents |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | SCHOOL_LIFE_MANAGER |
| function | RESP_VIE_SCOLAIRE |
| permissions | ATTENDANCE_ALL | DISCIPLINE_ALL | INCIDENT_MANAGE | SANCTION_MANAGE | SCHOOL_LIFE_REPORT |


| Responsable Communication ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Annonces et campagnes | • Communication officielle |
| --- | --- |
| • Notifications parents et enseignants | • Statistiques de communication |
| • Modèles de messages |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | COMMUNICATION_MANAGER |
| function | RESP_COMMUNICATION |
| permissions | ANNOUNCEMENT_MANAGE | CAMPAIGN_MANAGE | NOTIFICATION_MANAGE | MESSAGE_TEMPLATE | COMMUNICATION_STAT |


| Chargé de Communication ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Rédaction des messages | • Gestion des modèles |
| --- | --- |
| • Programmation des annonces | • Assistance communication |
| • Suivi des campagnes |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | COMMUNICATION_AGENT |
| function | CHARGE_COMMUNICATION |
| permissions | MESSAGE_WRITE | ANNOUNCEMENT_SCHEDULE | CAMPAIGN_TRACK | TEMPLATE_MANAGE | COMMUNICATION_ASSIST |


| Responsable RH ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Gestion du personnel | • Dossiers RH |
| --- | --- |
| • Enseignants et personnels non enseignants | • Évaluations |
| • Contrats CDI, CDD, Vacation | • Paie |
| • Absences du personnel |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | HR_MANAGER |
| function | RESP_RH |
| permissions | STAFF_MANAGE | CONTRACT_MANAGE | ABSENCE_STAFF | HR_DOSSIER | STAFF_EVAL | PAYROLL_MANAGE |


| Gestionnaire de Paie ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Calcul des salaires | • Historiques de paie |
| --- | --- |
| • Primes et retenues | • Exports paie |
| • Bulletins de paie |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | PAYROLL_MANAGER |
| function | GESTIONNAIRE_PAIE |
| permissions | PAYROLL_COMPUTE | SALARY_MANAGE | PAYSLIP_GENERATE | PAYROLL_HISTORY | PAYROLL_EXPORT |


| Responsable Informatique / IT Manager ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Comptes utilisateurs | • Sécurité locale |
| --- | --- |
| • Équipements | • Intégrations |
| • Accès et droits | • Configuration des portails |
| • Support interne |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | IT_MANAGER |
| function | RESP_IT |
| permissions | USER_MANAGE | EQUIPMENT_MANAGE | ACCESS_MANAGE | SECURITY_LOCAL | INTEGRATION_MANAGE | PORTAL_CONFIG |


| Bibliothécaire ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Catalogue des livres | • Ressources numériques |
| --- | --- |
| • Emprunts et retours | • Statistiques bibliothèque |
| • Pénalités |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | LIBRARIAN |
| function | BIBLIOTHECAIRE |
| permissions | CATALOG_MANAGE | LOAN_MANAGE | PENALTY_MANAGE | DIGITAL_RESOURCE | LIBRARY_STAT |


| Responsable Cantine ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Menus hebdomadaires | • Paiements cantine |
| --- | --- |
| • Abonnements cantine | • Gestion des stocks |
| • Présences repas | • Rapports cantine |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | CANTEEN_MANAGER |
| function | RESP_CANTINE |
| permissions | MENU_MANAGE | SUBSCRIPTION_CANTEEN | MEAL_ATTENDANCE | CANTEEN_PAYMENT | STOCK_MANAGE | CANTEEN_REPORT |


| Responsable Transport ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Gestion des bus | • Paiements transport |
| --- | --- |
| • Trajets et itinéraires | • Incidents transport |
| • Chauffeurs | • Rapports transport |
| • Élèves transportés |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | TRANSPORT_MANAGER |
| function | RESP_TRANSPORT |
| permissions | BUS_MANAGE | ROUTE_MANAGE | DRIVER_MANAGE | STUDENT_TRANSPORT | TRANSPORT_PAYMENT | TRANSPORT_INCIDENT | TRANSPORT_REPORT |


| Responsable Internat ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Chambres et dortoirs | • Repas internat |
| --- | --- |
| • Présences internat | • Sorties et incidents |
| • Discipline internat | • Rapports internat |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | BOARDING_MANAGER |
| function | RESP_INTERNAT |
| permissions | ROOM_MANAGE | BOARDING_ATTENDANCE | BOARDING_DISCIPLINE | BOARDING_MEAL | BOARDING_EXIT | BOARDING_REPORT |


| Responsable Santé / Infirmerie ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Fiches santé élèves | • Autorisations médicales |
| --- | --- |
| • Passages infirmerie | • Alertes aux parents |
| • Allergies et contre-indications | • Rapports médicaux |
| • Incidents santé |  |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | HEALTH_MANAGER |
| function | RESP_SANTE |
| permissions | HEALTH_RECORD | MEDICAL_VISIT | ALLERGY_MANAGE | HEALTH_INCIDENT | MEDICAL_AUTH | HEALTH_ALERT | HEALTH_REPORT |


| Responsable Sécurité ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Contrôle des accès | • Incidents sécurité |
| --- | --- |
| • Gestion des visiteurs | • Alertes sécurité |
| • Sorties des élèves | • Rapports sécurité |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | SECURITY_MANAGER |
| function | RESP_SECURITE |
| permissions | ACCESS_CONTROL | VISITOR_MANAGE | EXIT_AUTHORIZE | SECURITY_INCIDENT | SECURITY_ALERT | SECURITY_REPORT |


| Responsable Paramètres ÉCOLE | PORTAIL ÉCOLE |
| --- | --- |


### Responsabilités & Accès


| • Configuration de l'établissement | • Matières et coefficients |
| --- | --- |
| • Années scolaires | • Règles de calcul |
| • Périodes et trimestres | • Modèles de documents |
| • Niveaux et classes | • Permissions locales |


### Modèle technique (RBAC)


| portal | SCHOOL |
| --- | --- |
| role | SETTINGS_MANAGER |
| function | RESP_PARAMETRES |
| permissions | SCHOOL_CONFIG | ACADEMIC_YEAR | PERIOD_MANAGE | CLASS_SETUP | SUBJECT_SETUP | CALC_RULES | TEMPLATE_MANAGE | PERMISSION_LOCAL |


| PORTAIL 03 Portail Enseignant Interface unique — affichage dynamique selon niveau, matière et classe |
| --- |


| Enseignant Maternelle ENSEIGNANT | PORTAIL ENSEIGNANT |
| --- | --- |


### Responsabilités & Accès


| • Activités d'éveil | • Présences |
| --- | --- |
| • Observation qualitative des enfants | • Communication avec les parents |
| • Appréciations qualitatives | • Ressources pédagogiques adaptées |
| • Livrets qualitatifs |  |


### Modèle technique (RBAC)


| portal | TEACHER |
| --- | --- |
| role | TEACHER |
| function | TEACHER_MATERNELLE |
| levelScopes | MATERNELLE |
| permissions | QUALITATIVE_EVAL | ATTENDANCE_MANAGE | LIVRET_EDIT | PARENT_MESSAGE | RESOURCE_ACCESS |


| Assistant(e) Enseignant Maternelle ENSEIGNANT | PORTAIL ENSEIGNANT |
| --- | --- |


### Responsabilités & Accès


| • Accompagnement des enfants en classe | • Présence |
| --- | --- |
| • Aide aux activités | • Assistance quotidienne à l'enseignant |
| • Observation comportementale |  |


### Modèle technique (RBAC)


| portal | TEACHER |
| --- | --- |
| role | TEACHING_ASSISTANT |
| function | ASSISTANT_TEACHER_MAT |
| levelScopes | MATERNELLE |
| permissions | ATTENDANCE_VIEW | OBSERVATION_ADD | RESOURCE_VIEW — droits limités |


| Enseignant Titulaire Primaire ENSEIGNANT | PORTAIL ENSEIGNANT |
| --- | --- |


### Responsabilités & Accès


| • Gestion de sa classe primaire | • Notes coefficient 1 |
| --- | --- |
| • Matières principales | • Appréciations |
| • Présences | • Devoirs |
| • Évaluations mensuelles et certificatives | • Communication avec les parents |


### Modèle technique (RBAC)


| portal | TEACHER |
| --- | --- |
| role | TEACHER |
| function | TEACHER_TITULAIRE_PRI |
| levelScopes | PRIMARY |
| permissions | CLASS_MANAGE | ATTENDANCE_MANAGE | GRADE_ENTRY | APPRECIATION_ADD | HOMEWORK_MANAGE | PARENT_MESSAGE | BULLETIN_VIEW |


| Enseignant de Matière Primaire ENSEIGNANT | PORTAIL ENSEIGNANT |
| --- | --- |


### Responsabilités & Accès


| • Matière spécifique assignée | • Ressources pédagogiques |
| --- | --- |
| • Évaluations et notes | • Suivi des élèves par matière |
| • Devoirs |  |


### Modèle technique (RBAC)


| portal | TEACHER |
| --- | --- |
| role | TEACHER |
| function | TEACHER_MATIERE_PRI |
| levelScopes | PRIMARY |
| subjectScope | matière assignée uniquement |
| permissions | GRADE_ENTRY | HOMEWORK_MANAGE | RESOURCE_ADD | STUDENT_VIEW_LIMITED |


| Enseignant de Matière Secondaire ENSEIGNANT | PORTAIL ENSEIGNANT |
| --- | --- |


### Responsabilités & Accès


| • Cours par matière assignée | • Cahier de texte numérique |
| --- | --- |
| • Interrogations et devoirs surveillés | • Ressources pédagogiques |
| • Compositions | • Statistiques par matière |
| • Notes et coefficients |  |


### Modèle technique (RBAC)


| portal | TEACHER |
| --- | --- |
| role | TEACHER |
| function | TEACHER_MATIERE_SEC |
| levelScopes | SECONDARY |
| subjectScope | matière assignée uniquement |
| permissions | GRADE_ENTRY | EXAM_SUPERVISE | CAHIER_TEXTE | RESOURCE_ADD | STAT_SUBJECT | HOMEWORK_MANAGE |


| Professeur Principal ENSEIGNANT | PORTAIL ENSEIGNANT |
| --- | --- |


### Responsabilités & Accès


| • Suivi global d'une classe | • Coordination avec les enseignants |
| --- | --- |
| • Synthèse des résultats de classe | • Préparation des conseils de classe |
| • Appréciation générale de classe | • Communication avec l'administration |


### Modèle technique (RBAC)


| portal | TEACHER |
| --- | --- |
| role | HEAD_TEACHER |
| function | PROF_PRINCIPAL |
| levelScopes | SECONDARY | PRIMARY |
| classScope | classe assignée |
| permissions | CLASS_OVERVIEW | RESULT_SYNTHESIS | CLASS_APPRECIATION | CLASS_COUNCIL_PREPARE | ADMIN_COMMUNICATE |


| Enseignant Bilingue ENSEIGNANT | PORTAIL ENSEIGNANT |
| --- | --- |


### Responsabilités & Accès


| • Matières enseignées en anglais | • Ressources en anglais |
| --- | --- |
| • Cours bilingues FR/EN | • Appréciations adaptées |
| • Évaluations bilingues | • Suivi des matières bilingues |


### Modèle technique (RBAC)


| portal | TEACHER |
| --- | --- |
| role | TEACHER |
| function | TEACHER_BILINGUE |
| levelScopes | configurable |
| permissions | GRADE_ENTRY | BILINGUAL_CONTENT | RESOURCE_EN | EVAL_BILINGUAL | CAHIER_TEXTE_BILINGUAL |


| Enseignant Remplaçant ENSEIGNANT | PORTAIL ENSEIGNANT |
| --- | --- |


### Responsabilités & Accès


| • Accès limité aux classes assignées temporairement | • Devoirs |
| --- | --- |
| • Présences | • Notes si autorisé explicitement |
| • Cahier de texte |  |


### Modèle technique (RBAC)


| portal | TEACHER |
| --- | --- |
| role | SUBSTITUTE_TEACHER |
| function | TEACHER_REMPLAGANT |
| levelScopes | classes assignées uniquement |
| permissions | ATTENDANCE_MANAGE | CAHIER_TEXTE | HOMEWORK_MANAGE | GRADE_ENTRY_IF_AUTHORIZED — droits temporaires |


| Assistant Enseignant ENSEIGNANT | PORTAIL ENSEIGNANT |
| --- | --- |


### Responsabilités & Accès


| • Aide en classe | • Ressources pédagogiques |
| --- | --- |
| • Suivi des devoirs | • Présence selon permission |
| • Accompagnement des élèves |  |


### Modèle technique (RBAC)


| portal | TEACHER |
| --- | --- |
| role | TEACHING_ASSISTANT |
| function | ASSISTANT_TEACHER |
| levelScopes | classes assignées |
| permissions | STUDENT_VIEW | HOMEWORK_VIEW | RESOURCE_VIEW | ATTENDANCE_VIEW_LIMITED |


| Coordinateur de Département ENSEIGNANT | PORTAIL ENSEIGNANT |
| --- | --- |


### Responsabilités & Accès


| • Coordination des enseignants du département | • Statistiques du département |
| --- | --- |
| • Progression par matière | • Ressources communes |
| • Harmonisation des évaluations |  |


### Modèle technique (RBAC)


| portal | TEACHER |
| --- | --- |
| role | DEPARTMENT_COORDINATOR |
| function | COORD_DEPARTEMENT |
| departmentScope | département assigné |
| permissions | TEACHER_COORDINATE | PROGRESSION_MANAGE | EVAL_HARMONIZE | DEPARTMENT_STAT | RESOURCE_SHARE |


| Conseiller Pédagogique ENSEIGNANT | PORTAIL ENSEIGNANT |
| --- | --- |


### Responsabilités & Accès


| • Observation pédagogique des enseignants | • Analyse des progressions |
| --- | --- |
| • Recommandations pédagogiques | • Rapports pédagogiques |
| • Suivi des enseignants |  |


### Modèle technique (RBAC)


| portal | TEACHER |
| --- | --- |
| role | PEDAGOGIC_ADVISOR |
| function | CONSEILLER_PED |
| permissions | TEACHER_OBSERVE | RECOMMENDATION_ADD | PROGRESSION_ANALYZE | PEDAGOGIC_REPORT — READ + WRITE REPORT ONLY |


| PORTAIL 04 Portail Parent / Élève Interface unique — affichage adapté au profil connecté |
| --- |


| Parent Principal PARENT | PORTAIL PARENT |
| --- | --- |


### Responsabilités & Accès


| • Suivi complet de l'enfant | • Convocations |
| --- | --- |
| • Paiements des frais scolaires | • Consentements et autorisations |
| • Bulletins et résultats | • Documents scolaires |
| • Absences et retards | • Préférences de communication |
| • Messages école | • Assistance vocale en langues locales |


### Modèle technique (RBAC)


| portal | PARENT |
| --- | --- |
| role | PARENT_PRIMARY |
| function | PARENT_PRINCIPAL |
| childScope | enfants liés |
| permissions | CHILD_VIEW | PAYMENT_MAKE | BULLETIN_VIEW | ABSENCE_VIEW | MESSAGE_RECEIVE | MESSAGE_SEND | CONSENT_SIGN | DOCUMENT_DOWNLOAD | NOTIFICATION_PREF | VOICE_ASSISTANCE |


| Parent Secondaire PARENT | PORTAIL PARENT |
| --- | --- |


### Responsabilités & Accès


| • Consultation du suivi enfant | • Communication avec l'école |
| --- | --- |
| • Réception des notifications | • Paiements si autorisé par le Parent Principal |
| • Consultation des bulletins |  |


### Modèle technique (RBAC)


| portal | PARENT |
| --- | --- |
| role | PARENT_SECONDARY |
| function | PARENT_SECONDAIRE |
| childScope | enfants liés |
| permissions | CHILD_VIEW | BULLETIN_VIEW | NOTIFICATION_RECEIVE | MESSAGE_RECEIVE | PAYMENT_IF_AUTHORIZED |


| Tuteur Légal PARENT | PORTAIL PARENT |
| --- | --- |


### Responsabilités & Accès


| • Autorisations et décisions scolaires | • Documents officiels |
| --- | --- |
| • Paiements des frais | • Suivi complet selon droits accordés |


### Modèle technique (RBAC)


| portal | PARENT |
| --- | --- |
| role | LEGAL_GUARDIAN |
| function | TUTEUR_LEGAL |
| childScope | enfants assignés |
| permissions | CONSENT_SIGN | PAYMENT_MAKE | DOCUMENT_DOWNLOAD | FULL_VIEW_IF_AUTHORIZED — droits configurables |


| Responsable Financier de l'Élève PARENT | PORTAIL PARENT |
| --- | --- |


### Responsabilités & Accès


| • Consultation du solde scolaire | • Suivi des échéanciers |
| --- | --- |
| • Paiements des frais | • Réception des relances financières |
| • Reçus et justificatifs |  |


### Modèle technique (RBAC)


| portal | PARENT |
| --- | --- |
| role | FINANCIAL_RESPONSIBLE |
| function | RESP_FINANCIER_ELEVE |
| childScope | élèves assignés |
| permissions | BALANCE_VIEW | PAYMENT_MAKE | RECEIPT_DOWNLOAD | PAYMENT_PLAN_VIEW | REMINDER_RECEIVE |


### Accès Élèves — Politique par Niveau


| Élève Maternelle ÉLÈVE | PORTAIL ÉLÈVE |
| --- | --- |


### Responsabilités & Accès


| • Pas d'accès autonome par défaut | • Ressources simples si activées par l'école |
| --- | --- |
| • Suivi uniquement via le compte parent |  |


### Modèle technique (RBAC)


| portal | PARENT |
| --- | --- |
| role | STUDENT |
| function | ELEVE_MATERNELLE |
| level | MATERNELLE |
| permissions | NO_AUTONOMOUS_ACCESS — contenu accessible via compte parent uniquement |


| Élève Primaire ÉLÈVE | PORTAIL ÉLÈVE |
| --- | --- |


### Responsabilités & Accès


| • Devoirs et agenda | • Notes si autorisé par l'école |
| --- | --- |
| • Ressources pédagogiques | • Progression simplifiée |
| • Messages pédagogiques |  |


### Modèle technique (RBAC)


| portal | PARENT |
| --- | --- |
| role | STUDENT |
| function | ELEVE_PRIMAIRE |
| level | PRIMARY |
| permissions | HOMEWORK_VIEW | AGENDA_VIEW | RESOURCE_VIEW | GRADE_VIEW_IF_AUTHORIZED | PROGRESSION_VIEW |


| Élève Secondaire ÉLÈVE | PORTAIL ÉLÈVE |
| --- | --- |


### Responsabilités & Accès


| • Emploi du temps | • Agenda personnel |
| --- | --- |
| • Devoirs et ressources | • Progression |
| • Notes et bulletins si autorisé | • Orientation |
| • Messages enseignants |  |


### Modèle technique (RBAC)


| portal | PARENT |
| --- | --- |
| role | STUDENT |
| function | ELEVE_SECONDAIRE |
| level | SECONDARY |
| permissions | TIMETABLE_VIEW | HOMEWORK_VIEW | GRADE_VIEW | BULLETIN_IF_AUTHORIZED | TEACHER_MESSAGE | AGENDA | PROGRESSION_VIEW | ORIENTATION_VIEW |


| Élève Délégué ÉLÈVE | PORTAIL ÉLÈVE |
| --- | --- |


### Responsabilités & Accès


| • Espace élève standard | • Communication limitée avec l'administration |
| --- | --- |
| • Remontée d'informations de classe si autorisé | • Suivi des annonces de classe |


### Modèle technique (RBAC)


| portal | PARENT |
| --- | --- |
| role | CLASS_DELEGATE |
| function | ELEVE_DELEGUE |
| permissions | STUDENT_STANDARD + CLASS_INFO_SUBMIT_IF_AUTHORIZED | ADMIN_MESSAGE_LIMITED | ANNOUNCEMENT_VIEW |


| Ancien Élève / Alumni ALUMNI | PORTAIL ALUMNI |
| --- | --- |


### Responsabilités & Accès


| • Documents historiques | • Espace alumni si activé |
| --- | --- |
| • Attestations archivées | • Demandes administratives |
| • Bulletins archivés |  |


### Modèle technique (RBAC)


| portal | PARENT |
| --- | --- |
| role | ALUMNI |
| function | ANCIEN_ELEVE |
| permissions | DOCUMENT_ARCHIVE_VIEW | ATTESTATION_REQUEST | BULLETIN_ARCHIVE | ALUMNI_SPACE_IF_ENABLED | ADMIN_REQUEST |


| PORTAIL 05 Portail Public / Pré-inscription Acquisition, information et admission — aucune authentification requise |
| --- |


| Visiteur PUBLIC | PORTAIL PUBLIC |
| --- | --- |


### Responsabilités & Accès


| • Consulter la page publique de l'école | • Consulter les conditions d'inscription |
| --- | --- |
| • Voir les informations publiques | • Lancer une pré-inscription |
| • Demander un contact |  |


### Modèle technique (RBAC)


| portal | PUBLIC |
| --- | --- |
| role | VISITOR |
| function | VISITEUR |
| permissions | PUBLIC_VIEW | CONTACT_REQUEST | PRE_ENROLLMENT_START — aucune authentification |


| Parent Prospect PUBLIC | PORTAIL PUBLIC |
| --- | --- |


### Responsabilités & Accès


| • Demander des informations | • Suivre l'avancement du dossier |
| --- | --- |
| • Inscrire un enfant | • Recevoir les messages d'admission |
| • Envoyer les documents de candidature |  |


### Modèle technique (RBAC)


| portal | PUBLIC |
| --- | --- |
| role | PROSPECT_PARENT |
| function | PARENT_PROSPECT |
| permissions | INFO_REQUEST | CHILD_PRE_ENROLL | DOCUMENT_UPLOAD | APPLICATION_TRACK | ADMISSION_MESSAGE_RECEIVE |


| Candidat Élève Maternelle PUBLIC | PORTAIL PUBLIC |
| --- | --- |


### Responsabilités & Accès


| • Pré-inscription en Maternelle 1 ou Maternelle 2 | • Suivi du dossier |
| --- | --- |
| • Soumission des documents | • Finalisation de l'inscription |


### Modèle technique (RBAC)


| portal | PUBLIC |
| --- | --- |
| role | APPLICANT |
| function | CANDIDAT_MAT |
| levelScope | MATERNELLE |
| permissions | PRE_ENROLLMENT | DOCUMENT_SUBMIT | APPLICATION_STATUS | ENROLLMENT_FINALIZE |


| Candidat Élève Primaire PUBLIC | PORTAIL PUBLIC |
| --- | --- |


### Responsabilités & Accès


| • Pré-inscription CI à CM2 | • Suivi du dossier |
| --- | --- |
| • Soumission des documents | • Finalisation de l'inscription |


### Modèle technique (RBAC)


| portal | PUBLIC |
| --- | --- |
| role | APPLICANT |
| function | CANDIDAT_PRI |
| levelScope | PRIMARY |
| permissions | PRE_ENROLLMENT | DOCUMENT_SUBMIT | APPLICATION_STATUS | ENROLLMENT_FINALIZE |


| Candidat Élève Secondaire PUBLIC | PORTAIL PUBLIC |
| --- | --- |


### Responsabilités & Accès


| • Pré-inscription 6ème à Tle | • Suivi du dossier |
| --- | --- |
| • Soumission des documents | • Finalisation de l'inscription |
| • Choix de série si applicable |  |


### Modèle technique (RBAC)


| portal | PUBLIC |
| --- | --- |
| role | APPLICANT |
| function | CANDIDAT_SEC |
| levelScope | SECONDARY |
| permissions | PRE_ENROLLMENT | SERIES_CHOOSE | DOCUMENT_SUBMIT | APPLICATION_STATUS | ENROLLMENT_FINALIZE |


## ANNEXE — MODÈLE RBAC GLOBAL


### Modèle Technique Recommandé

Chaque utilisateur est défini par 7 dimensions :

| DIMENSION | VALEURS POSSIBLES | RÔLE |
| --- | --- | --- |
| portal | PLATFORM | SCHOOL | TEACHER | PARENT | PUBLIC | Portail d'accès |
| role | PLATFORM_OWNER | SCHOOL_DIRECTOR | TEACHER | PARENT_PRIMARY | STUDENT | … | Rôle global |
| function | DIRECTEUR | CENSEUR | CAISSIER | PROF_PRINCIPAL | … | Fonction métier |
| accreditations | MATERNELLE_ADMIN | PRIMARY_ADMIN | SECONDARY_ADMIN | ALL_LEVELS | Périmètre niveau |
| levelScopes | MATERNELLE | PRIMARY | SECONDARY | Niveaux autorisés |
| classScopes | MATERNELLE_1 | CI | SIXIEME | … | TERMINALE | Classes autorisées |
| permissions | STUDENT_VIEW | GRADE_ENTRY | PAYMENT_MAKE | BULLETIN_VALIDATE | … | Actions autorisées |


### Exemple — Responsable Secondaire


| portal | SCHOOL |
| --- | --- |
| role | SCHOOL_ADMIN |
| function | RESP_SECONDAIRE |
| accreditations | SECONDARY_ADMIN |
| levelScopes | SECONDARY |
| classScopes | SIXIEME | CINQUIEME | QUATRIEME | TROISIEME | SECONDE | PREMIERE | TERMINALE |
| permissions | STUDENT_MANAGE | SUBJECT_MANAGE | COEFFICIENT_MANAGE | EXAM_MANAGE | GRADE_VALIDATE | BULLETIN_VALIDATE | CLASS_COUNCIL |


### Exemple — Responsable Maternelle


| portal | SCHOOL |
| --- | --- |
| role | SCHOOL_ADMIN |
| function | RESP_MATERNELLE |
| accreditations | MATERNELLE_ADMIN |
| levelScopes | MATERNELLE |
| classScopes | MATERNELLE_1 | MATERNELLE_2 |
| permissions | STUDENT_VIEW | STUDENT_CREATE | QUALITATIVE_EVAL_MANAGE | REPORT_BOOK_VALIDATE | PARENT_COMMUNICATION |

Academia Helm — Documentation des portails v1.0 • YEHI OR Tech • Confidentiel