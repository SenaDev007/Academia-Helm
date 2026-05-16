# Academia Helm — UI/UX spécifique par portail et utilisateur connecté

## Source de consolidation

Cette version reprend la logique UI/UX précédemment proposée et l’aligne avec l’architecture officielle prévue pour Academia Helm :

- Portail Plateforme ;
- Portail École ;
- Portail Enseignant ;
- Portail Parent / Élève ;
- Portail Public.

L’objectif est de conserver une expérience simple côté front-end, tout en gardant une architecture RBAC très fine côté backend.

---

# 1. Vision générale UI/UX

Academia Helm doit éviter deux erreurs :

1. créer trop de portails visibles ;
2. afficher les mêmes menus à tous les utilisateurs.

La bonne stratégie est la suivante :

**un portail visible par grande famille d’usage, puis une interface dynamique selon le rôle, la fonction, les accréditations, les scopes et les permissions.**

Autrement dit :

- le front-end reste simple ;
- le backend reste puissant ;
- chaque utilisateur voit uniquement ce qui le concerne ;
- les modules sont activés selon le rôle et l’abonnement ;
- les actions sensibles sont contrôlées côté backend.

---

# 2. Architecture officielle des portails

Academia Helm repose sur cinq portails principaux.

## 2.1 Portail Plateforme

Le Portail Plateforme sert à administrer Academia Helm comme solution SaaS.

Il concerne les rôles liés à la gestion globale de la plateforme :

- Platform Owner ;
- Platform Super Admin ;
- Platform Admin ;
- Billing Manager Platform ;
- Support Agent Platform ;
- Technical Operator / DevOps ;
- Platform Auditor.

Ce portail n’est pas destiné aux écoles clientes. Il est réservé à YEHI OR Tech et aux équipes autorisées.

## 2.2 Portail École

Le Portail École est le portail principal des établissements.

Il centralise :

- la gouvernance ;
- l’administration générale ;
- les administrations par niveau ;
- la finance ;
- la pédagogie ;
- la vie scolaire ;
- les services ;
- les paramètres locaux.

C’est dans ce portail que les accréditations Maternelle, Primaire et Secondaire sont appliquées.

Important : il ne faut pas créer trois portails front-end séparés pour Maternelle, Primaire et Secondaire. Le Portail École reste unique, mais son affichage change selon les accréditations.

## 2.3 Portail Enseignant

Le Portail Enseignant est l’espace pédagogique et académique des enseignants.

Il s’adapte selon :

- le niveau enseigné ;
- la classe assignée ;
- la matière assignée ;
- la fonction pédagogique ;
- les permissions accordées.

## 2.4 Portail Parent / Élève

Le Portail Parent / Élève est l’espace de suivi scolaire, financier, communicationnel et documentaire.

Il doit rester très simple, surtout en mobile.

Il gère :

- les parents principaux ;
- les parents secondaires ;
- les tuteurs légaux ;
- les responsables financiers ;
- les élèves selon leur niveau ;
- les anciens élèves si l’espace alumni est activé.

## 2.5 Portail Public

Le Portail Public sert à l’acquisition, à l’information et à la pré-inscription.

Il ne nécessite pas forcément une authentification au départ.

Il concerne :

- les visiteurs ;
- les parents prospects ;
- les candidats Maternelle ;
- les candidats Primaire ;
- les candidats Secondaire.

---

# 3. Principe RBAC global

Tous les portails doivent utiliser une architecture RBAC commune.

Chaque utilisateur doit être défini par sept dimensions principales :

| Dimension | Rôle |
|---|---|
| portal | Portail d’accès |
| role | Rôle global |
| function | Fonction métier |
| accreditations | Périmètre de niveau |
| levelScopes | Niveaux autorisés |
| classScopes | Classes autorisées |
| permissions | Actions autorisées |

Cette architecture permet de gérer des interfaces très différentes sans multiplier les applications front-end.

---

# 4. UI/UX du Portail Plateforme

## 4.1 Objectif

Le Portail Plateforme est le centre de commandement SaaS d’Academia Helm.

Il permet de gérer :

- les écoles clientes ;
- les tenants ;
- les plans SaaS ;
- les souscriptions initiales ;
- les abonnements ;
- la facturation ;
- le support ;
- la sécurité ;
- les logs ;
- les incidents ;
- ORION global ;
- Sara AI global ;
- Atlas global.

## 4.2 Utilisateurs concernés

### Platform Owner

Vue stratégique complète.

Dashboard recommandé :

- revenus SaaS ;
- écoles actives ;
- écoles suspendues ;
- souscriptions initiales ;
- abonnements actifs ;
- MRR / ARR ;
- incidents critiques ;
- usage ORION ;
- usage Sara AI ;
- consommation API ;
- croissance par pays ;
- taux de churn ;
- rapports consolidés.

Menus visibles :

- Vue globale ;
- Écoles ;
- Plans SaaS ;
- Souscriptions initiales ;
- Abonnements ;
- Revenus ;
- ORION Global ;
- Sara AI ;
- Atlas ;
- Audit ;
- Sécurité ;
- Paramètres plateforme.

### Platform Super Admin

Vue technique et opérationnelle complète.

Menus visibles :

- Tenants ;
- Écoles ;
- Modules ;
- Plans ;
- Rôles globaux ;
- Sécurité ;
- Logs ;
- Incidents ;
- Diagnostic système ;
- Intégrations ;
- Sauvegardes.

### Platform Admin

Vue d’assistance opérationnelle.

Menus visibles :

- Écoles autorisées ;
- Tickets ;
- Incidents ;
- Configurations limitées ;
- Support ;
- Rapports opérationnels.

### Billing Manager Platform

Vue financière SaaS.

Menus visibles :

- Souscriptions initiales ;
- Abonnements ;
- Factures ;
- Paiements ;
- Relances ;
- Suspensions ;
- Rapports financiers SaaS.

### Support Agent Platform

Vue support.

Menus visibles :

- Tickets ;
- Écoles assistées ;
- Utilisateurs ;
- Diagnostic limité ;
- Base de connaissance Atlas ;
- Historique support.

### Technical Operator / DevOps

Vue infrastructure.

Menus visibles :

- Monitoring ;
- Logs ;
- Sauvegardes ;
- Services ;
- Intégrations ;
- Sécurité technique ;
- Incidents techniques.

### Platform Auditor

Vue audit en lecture seule.

Menus visibles :

- Journaux d’audit ;
- Accès ;
- Actions sensibles ;
- Rapports conformité ;
- Historique plateforme.

---

# 5. UI/UX du Portail École

## 5.1 Objectif

Le Portail École est l’espace central de gestion de l’établissement.

Il doit gérer :

- la direction ;
- les élèves ;
- les enseignants ;
- les finances ;
- les examens ;
- la pédagogie ;
- la communication ;
- les services ;
- les paramètres ;
- les exports ;
- EDUCMASTER ;
- ORION local ;
- Sara AI selon les droits.

## 5.2 Principe d’affichage

Le Portail École est unique côté front-end.

Mais l’interface change selon :

- le rôle ;
- la fonction ;
- l’accréditation ;
- le niveau scolaire ;
- les classes autorisées ;
- les permissions.

Exemple :

- le Responsable Maternelle voit M1 et M2 ;
- le Responsable Primaire voit CI à CM2 ;
- le Responsable Secondaire voit 6ème à Tle ;
- le Comptable voit les finances ;
- le Caissier voit les encaissements ;
- le Responsable Paramètres voit la configuration ;
- le Promoteur voit les rapports consolidés.

## 5.3 Gouvernance et Direction Générale

### Promoteur / Fondateur

Dashboard :

- effectifs consolidés ;
- finances consolidées ;
- résultats par niveau ;
- inscriptions ;
- impayés ;
- performance globale ;
- alertes ORION ;
- décisions à valider ;
- rapports consolidés.

Menus :

- Vue globale ;
- Finances consolidées ;
- Élèves ;
- Résultats ;
- Rapports ;
- ORION ;
- Décisions ;
- Paramètres stratégiques.

### Président / Représentant du Conseil d’Administration

Dashboard :

- performances globales ;
- rapports financiers ;
- rapports pédagogiques ;
- gouvernance ;
- indicateurs institutionnels ;
- audits.

Menus :

- Rapports ;
- Gouvernance ;
- Finances ;
- Performances ;
- Audit ;
- Décisions stratégiques.

### Directeur Général

Dashboard :

- pilotage quotidien ;
- responsables de niveau ;
- incidents ;
- validations importantes ;
- rapports globaux ;
- alertes prioritaires.

Menus :

- Tableau de bord ;
- Élèves ;
- Enseignants ;
- Niveaux ;
- Pédagogie ;
- Examens ;
- Discipline ;
- Communication ;
- Rapports ;
- ORION.

### Directeur d’Établissement

Dashboard :

- élèves ;
- enseignants ;
- bulletins à valider ;
- discipline ;
- communications officielles ;
- documents administratifs.

Menus :

- Administration ;
- Élèves ;
- Enseignants ;
- Bulletins ;
- Discipline ;
- Communication ;
- Rapports.

### Directeur Adjoint

Interface proche du Directeur, mais limitée par délégation.

Menus :

- Coordination ;
- Élèves ;
- Enseignants ;
- Validations déléguées ;
- Rapports ;
- Suivi pédagogique.

---

# 6. Administration Générale — UI/UX

## 6.1 Secrétaire Général

Interface orientée documents et coordination.

Menus :

- Documents officiels ;
- Courriers ;
- Archives ;
- Secrétariats par niveau ;
- Dossiers institutionnels ;
- Rapports administratifs.

## 6.2 Agent Administratif

Interface simple de saisie.

Menus :

- Saisie ;
- Documents ;
- Archives ;
- Tâches assignées ;
- Notifications.

## 6.3 Responsable Scolarité Générale

Interface centrée sur admissions, réinscriptions et effectifs.

Menus :

- Admissions ;
- Réinscriptions ;
- Affectations ;
- Effectifs ;
- Statistiques ;
- Responsables par niveau ;
- Exports.

## 6.4 Data Manager

Interface orientée qualité des données.

Menus :

- Imports ;
- Exports ;
- Doublons ;
- Nettoyage ;
- Consolidation ;
- Contrôle qualité ;
- Historique des corrections.

## 6.5 Auditeur Interne

Interface lecture seule.

Menus :

- Journaux d’activité ;
- Accès utilisateurs ;
- Audit scolarité ;
- Audit finances ;
- Actions sensibles ;
- Rapports conformité.

---

# 7. Administration Maternelle — UI/UX

Accréditation : MATERNELLE_ADMIN  
Scope : Maternelle 1 et Maternelle 2.

## 7.1 Responsable Maternelle

Dashboard :

- effectifs M1 / M2 ;
- présences ;
- évaluations qualitatives ;
- livrets à valider ;
- fiches pédagogiques ;
- cahiers journaux ;
- communications parents ;
- alertes enfants.

Menus :

- Tableau de bord ;
- Enfants ;
- Classes Maternelle ;
- Enseignants ;
- Évaluations qualitatives ;
- Livrets ;
- Espace pédagogique ;
- Communication parents ;
- Rapports.

## 7.2 Coordinateur Pédagogique Maternelle

Menus :

- Activités d’éveil ;
- Progressions ;
- Grilles qualitatives ;
- Compétences observées ;
- Accompagnement enseignants ;
- Validation des appréciations.

## 7.3 Secrétaire Maternelle

Menus :

- Inscriptions Maternelle ;
- Dossiers enfants ;
- Listes M1 / M2 ;
- Attestations ;
- Informations parents ;
- Documents.

## 7.4 Surveillant / Assistant Vie Scolaire Maternelle

Menus :

- Présences ;
- Retards ;
- Sorties ;
- Incidents mineurs ;
- Alertes parents ;
- Sécurité enfants.

## 7.5 Assistant(e) Maternelle

Menus :

- Enfants ;
- Présences en lecture ;
- Observations ;
- Activités ;
- Suivi quotidien.

---

# 8. Administration Primaire — UI/UX

Accréditation : PRIMARY_ADMIN  
Scope : CI, CP, CE1, CE2, CM1, CM2.

## 8.1 Responsable Primaire

Dashboard :

- effectifs par classe ;
- évaluations mensuelles ;
- évaluations certificatives ;
- bulletins à valider ;
- enseignants titulaires ;
- résultats par classe ;
- alertes ORION ;
- cahiers pédagogiques.

Menus :

- Tableau de bord ;
- Élèves ;
- Classes ;
- Enseignants ;
- Évaluations ;
- Bulletins ;
- Espace pédagogique ;
- Rapports ;
- Communication.

## 8.2 Coordinateur Pédagogique Primaire

Menus :

- Progressions ;
- Curricula ;
- Harmonisation des évaluations ;
- Compétences ;
- Analyse des résultats ;
- Accompagnement enseignants.

## 8.3 Responsable Examens Primaire

Menus :

- Planification évaluations ;
- Collecte des notes ;
- Règles de calcul ;
- Moyennes ;
- Bulletins ;
- Contrôle des résultats.

## 8.4 Secrétaire Primaire

Menus :

- Inscriptions ;
- Dossiers élèves ;
- Transferts ;
- Certificats ;
- Listes CI à CM2 ;
- Export EDUCMASTER.

## 8.5 Surveillant Primaire

Menus :

- Présences ;
- Absences ;
- Retards ;
- Discipline ;
- Incidents ;
- Alertes parents.

## 8.6 Responsable Activités Primaire

Menus :

- Activités ;
- Clubs ;
- Sorties pédagogiques ;
- Autorisations parentales ;
- Rapports d’activités.

---

# 9. Administration Secondaire — UI/UX

Accréditation : SECONDARY_ADMIN  
Scope : 6ème, 5ème, 4ème, 3ème, 2nde, 1ère, Tle.

## 9.1 Responsable Secondaire

Dashboard :

- effectifs secondaire ;
- notes manquantes ;
- coefficients ;
- examens ;
- bulletins ;
- conseils de classe ;
- discipline ;
- cahiers de textes ;
- alertes ORION.

Menus :

- Tableau de bord ;
- Élèves ;
- Classes ;
- Matières ;
- Coefficients ;
- Examens ;
- Notes ;
- Bulletins ;
- Conseils de classe ;
- Rapports.

## 9.2 Censeur

Menus :

- Emplois du temps ;
- Programmes ;
- Notes ;
- Coefficients ;
- Examens ;
- Bulletins ;
- Conseils de classe ;
- Supervision pédagogique.

## 9.3 Surveillant Général

Menus :

- Absences ;
- Retards ;
- Discipline ;
- Sanctions ;
- Convocations ;
- Incidents ;
- Rapports vie scolaire.

## 9.4 Responsable Examens Secondaire

Menus :

- Interrogations ;
- Devoirs surveillés ;
- Compositions ;
- Examens blancs ;
- Notes ;
- Moyennes ;
- Classements ;
- Bulletins ;
- PV de délibération.

## 9.5 Responsable Orientation

Menus :

- Orientation ;
- Choix de séries ;
- Conseils familles ;
- Examens nationaux ;
- Dossiers d’orientation ;
- Suivi élèves.

## 9.6 Secrétaire Secondaire

Menus :

- Inscriptions ;
- Dossiers élèves ;
- Transferts ;
- Certificats ;
- Documents examens ;
- Listes 6ème à Tle ;
- Export EDUCMASTER.

---

# 10. Finance et Économat — UI/UX

## 10.1 Directeur Administratif et Financier

Menus :

- Finances globales ;
- Budgets ;
- Dépenses ;
- Caisses ;
- Rapports financiers ;
- Stratégie économique ;
- Validation dépenses.

## 10.2 Responsable Financier

Menus :

- Encaissements ;
- Recettes ;
- Dépenses ;
- Impayés ;
- Contrôle financier ;
- Rapports.

## 10.3 Comptable

Menus :

- Comptabilité ;
- Recettes ;
- Dépenses ;
- Rapprochement bancaire ;
- États financiers ;
- Audit financier.

## 10.4 Caissier

Menus :

- Encaissements ;
- Reçus ;
- Soldes élèves ;
- Clôture caisse ;
- Historique caisse ;
- Annulations limitées.

## 10.5 Responsable Recouvrement

Menus :

- Débiteurs ;
- Relances ;
- Échéanciers ;
- Blocages ;
- Rapports recouvrement ;
- Coordination communication.

---

# 11. Pédagogie, Vie Scolaire et Services — UI/UX

## 11.1 Responsable Pédagogique Général

Menus :

- Curricula ;
- Évaluations ;
- Qualité pédagogique ;
- Responsables pédagogiques ;
- Rapports consolidés.

## 11.2 Responsable Vie Scolaire

Menus :

- Présences ;
- Retards ;
- Discipline ;
- Incidents ;
- Sanctions ;
- Rapports vie scolaire.

## 11.3 Responsable Communication

Menus :

- Annonces ;
- Campagnes ;
- Notifications ;
- Modèles de messages ;
- Statistiques communication.

## 11.4 Chargé de Communication

Menus :

- Rédaction messages ;
- Programmation annonces ;
- Campagnes ;
- Modèles ;
- Suivi.

## 11.5 Responsable RH

Menus :

- Personnel ;
- Contrats ;
- Absences ;
- Dossiers RH ;
- Évaluations ;
- Paie.

## 11.6 Gestionnaire de Paie

Menus :

- Salaires ;
- Primes ;
- Retenues ;
- Bulletins de paie ;
- Historique ;
- Exports.

## 11.7 Responsable Informatique / IT Manager

Menus :

- Comptes utilisateurs ;
- Droits ;
- Équipements ;
- Sécurité locale ;
- Intégrations ;
- Configuration portails.

## 11.8 Bibliothécaire

Menus :

- Catalogue ;
- Emprunts ;
- Retours ;
- Pénalités ;
- Ressources numériques ;
- Statistiques.

## 11.9 Responsable Cantine

Menus :

- Menus ;
- Abonnements ;
- Paiements cantine ;
- Présences repas ;
- Stocks ;
- Rapports.

## 11.10 Responsable Transport

Menus :

- Bus ;
- Trajets ;
- Chauffeurs ;
- Élèves transportés ;
- Paiements transport ;
- Incidents ;
- Rapports.

## 11.11 Responsable Internat

Menus :

- Chambres ;
- Dortoirs ;
- Présences ;
- Repas ;
- Discipline ;
- Sorties ;
- Rapports.

## 11.12 Responsable Santé / Infirmerie

Menus :

- Fiches santé ;
- Passages infirmerie ;
- Allergies ;
- Incidents santé ;
- Autorisations médicales ;
- Alertes parents ;
- Rapports santé.

## 11.13 Responsable Sécurité

Menus :

- Contrôle accès ;
- Visiteurs ;
- Sorties élèves ;
- Incidents sécurité ;
- Alertes ;
- Rapports.

## 11.14 Responsable Paramètres

Menus :

- Configuration établissement ;
- Années scolaires ;
- Périodes ;
- Niveaux ;
- Classes ;
- Matières ;
- Coefficients ;
- Règles de calcul ;
- Modèles documents ;
- Permissions locales.

---

# 12. UI/UX du Portail Enseignant

## 12.1 Objectif

Le Portail Enseignant est une interface unique qui s’adapte selon le niveau, la matière, la classe et la fonction.

## 12.2 Dashboard général enseignant

Le tableau de bord doit afficher :

- cours du jour ;
- classes assignées ;
- matières assignées ;
- cahier journal ;
- fiches pédagogiques ;
- cahier de textes ;
- évaluations ;
- notes à saisir ;
- devoirs ;
- retours direction ;
- messages ;
- alertes ;
- Sara AI.

## 12.3 Profils enseignants

### Enseignant Maternelle

Menus :

- Présences ;
- Observations qualitatives ;
- Activités d’éveil ;
- Appréciations ;
- Livrets qualitatifs ;
- Ressources ;
- Communication parents.

### Assistant Enseignant Maternelle

Menus :

- Présences en lecture ;
- Observations ;
- Activités ;
- Ressources limitées.

### Enseignant Titulaire Primaire

Menus :

- Ma classe ;
- Présences ;
- Matières ;
- Évaluations ;
- Notes ;
- Appréciations ;
- Devoirs ;
- Bulletins ;
- Communication parents.

### Enseignant de Matière Primaire

Menus :

- Matière assignée ;
- Élèves concernés ;
- Notes ;
- Devoirs ;
- Ressources ;
- Progression.

### Enseignant de Matière Secondaire

Menus :

- Classes ;
- Matière ;
- Cahier de textes ;
- Interrogations ;
- Devoirs surveillés ;
- Compositions ;
- Notes ;
- Coefficients ;
- Ressources ;
- Statistiques.

### Professeur Principal

Menus :

- Vue classe ;
- Résultats ;
- Synthèses ;
- Appréciations générales ;
- Conseils de classe ;
- Communication administration.

### Enseignant Bilingue

Menus :

- Matières bilingues ;
- Contenus FR/EN ;
- Évaluations bilingues ;
- Ressources anglaises ;
- Cahier de textes bilingue.

### Enseignant Remplaçant

Menus temporaires :

- Classes assignées ;
- Présences ;
- Cahier de textes ;
- Devoirs ;
- Notes si autorisé.

### Assistant Enseignant

Menus :

- Élèves ;
- Devoirs ;
- Ressources ;
- Présences limitées.

### Coordinateur de Département

Menus :

- Enseignants du département ;
- Progressions ;
- Harmonisation évaluations ;
- Ressources communes ;
- Statistiques.

### Conseiller Pédagogique

Menus :

- Observations enseignants ;
- Recommandations ;
- Progressions ;
- Rapports pédagogiques.

---

# 13. UI/UX du Portail Parent / Élève

## 13.1 Objectif

Le Portail Parent / Élève doit être simple, mobile-first et centré sur le suivi.

## 13.2 Parent Principal

Dashboard :

- enfants liés ;
- situation financière ;
- paiements ;
- bulletins ;
- absences ;
- retards ;
- messages ;
- convocations ;
- consentements ;
- documents ;
- préférences de communication.

Menus :

- Mes enfants ;
- Paiements ;
- Bulletins ;
- Présences ;
- Messages ;
- Convocations ;
- Autorisations ;
- Documents ;
- Notifications ;
- Assistance vocale.

## 13.3 Parent Secondaire

Menus :

- Suivi enfant ;
- Bulletins ;
- Notifications ;
- Messages ;
- Paiements si autorisé.

## 13.4 Tuteur Légal

Menus :

- Autorisations ;
- Décisions scolaires ;
- Paiements ;
- Documents ;
- Suivi complet si autorisé.

## 13.5 Responsable Financier de l’Élève

Menus :

- Solde ;
- Paiements ;
- Reçus ;
- Échéanciers ;
- Relances.

## 13.6 Élève Maternelle

Pas d’accès autonome par défaut.

Le suivi passe par le compte parent.

## 13.7 Élève Primaire

Menus possibles :

- Devoirs ;
- Agenda ;
- Ressources ;
- Notes si autorisé ;
- Progression simplifiée.

## 13.8 Élève Secondaire

Menus :

- Emploi du temps ;
- Devoirs ;
- Ressources ;
- Notes ;
- Bulletins si autorisé ;
- Messages enseignants ;
- Agenda ;
- Orientation.

## 13.9 Élève Délégué

Menus :

- Espace élève standard ;
- Annonces classe ;
- Communication limitée administration ;
- Remontée d’informations si autorisée.

## 13.10 Ancien Élève / Alumni

Menus :

- Documents archivés ;
- Attestations ;
- Bulletins archivés ;
- Demandes administratives ;
- Espace alumni si activé.

---

# 14. UI/UX du Portail Public

## 14.1 Objectif

Le Portail Public sert à l’acquisition, à l’information et à la pré-inscription.

Il doit être fluide, moderne et orienté conversion.

## 14.2 Visiteur

Menus :

- Accueil ;
- Présentation école ;
- Conditions d’inscription ;
- Contact ;
- Pré-inscription.

## 14.3 Parent Prospect

Menus :

- Demande d’informations ;
- Pré-inscription enfant ;
- Documents à fournir ;
- Suivi dossier ;
- Messages admission.

## 14.4 Candidat Maternelle

Menus :

- Pré-inscription M1 / M2 ;
- Documents ;
- Statut dossier ;
- Finalisation inscription.

## 14.5 Candidat Primaire

Menus :

- Pré-inscription CI à CM2 ;
- Documents ;
- Statut dossier ;
- Finalisation inscription.

## 14.6 Candidat Secondaire

Menus :

- Pré-inscription 6ème à Tle ;
- Choix de série si applicable ;
- Documents ;
- Statut dossier ;
- Finalisation inscription.

---

# 15. ORION dans l’UI/UX

ORION doit être intégré comme moteur d’intelligence opérationnelle.

Il doit apparaître sous forme :

- alertes ;
- scores ;
- recommandations ;
- analyses ;
- risques ;
- rapports automatiques.

## Côté Plateforme

ORION analyse :

- écoles à risque ;
- impayés SaaS ;
- incidents ;
- consommation anormale ;
- usage faible ;
- performances globales.

## Côté École

ORION analyse :

- impayés ;
- absences ;
- baisse de performance ;
- notes manquantes ;
- classes à risque ;
- retards enseignants ;
- incidents disciplinaires ;
- anomalies financières.

## Côté Enseignant

ORION peut signaler :

- notes manquantes ;
- élèves en difficulté ;
- cahier de textes non rempli ;
- retards de soumission pédagogique ;
- progression pédagogique faible.

## Côté Parent / Élève

ORION doit rester discret :

- alerte absence ;
- alerte baisse de performance ;
- rappel paiement ;
- rappel devoir ;
- conseil de suivi.

---

# 16. Sara AI dans l’UI/UX

Sara AI doit être accessible selon les droits.

## Côté Plateforme

- assistance support ;
- génération de documentation ;
- analyse tickets ;
- synthèse incidents ;
- aide configuration.

## Côté École

- génération de rapports ;
- résumé des indicateurs ;
- aide à la communication ;
- analyse des données ;
- recommandations administratives.

## Côté Enseignant

- génération de fiches pédagogiques ;
- aide au cahier journal ;
- préparation d’exercices ;
- reformulation d’appréciations ;
- aide au cahier de textes ;
- création de ressources.

## Côté Parent / Élève

- explication d’un devoir ;
- résumé d’annonce ;
- aide à la révision ;
- explication simple d’une note.

---

# 17. Atlas dans l’UI/UX

Atlas doit être le centre documentaire et le cerveau de connaissance d’Academia Helm.

Il doit contenir :

- documentation des modules ;
- guides utilisateurs ;
- procédures ;
- FAQ ;
- tutoriels ;
- base de connaissance support ;
- cartographie des workflows ;
- documentation RBAC ;
- guides de formation.

Atlas peut alimenter Sara AI pour répondre avec précision aux utilisateurs.

---

# 18. Design System global

## 18.1 Principes

- interface sobre ;
- menus dynamiques ;
- tableaux filtrables ;
- badges de statut ;
- cartes KPI ;
- recherche globale ;
- notifications centralisées ;
- actions rapides ;
- responsive design ;
- mobile-first pour parents et enseignants ;
- desktop optimisé pour administration et finance.

## 18.2 Couleurs fonctionnelles

- vert : validé, payé, présent ;
- orange : en attente, partiel, attention ;
- rouge : rejeté, impayé, absent, critique ;
- bleu : information, soumis, consulté ;
- gris : archivé, désactivé.

## 18.3 Composants indispensables

- sidebar dynamique ;
- topbar contextuelle ;
- centre de notifications ;
- moteur de recherche ;
- assistant Sara AI ;
- centre d’alertes ORION ;
- tableaux avancés ;
- filtres rapides ;
- modales de validation ;
- exports PDF / Excel ;
- timelines ;
- historiques d’action.

---

# 19. Règle de sécurité UI/Backend

Il ne faut jamais compter uniquement sur le front-end pour sécuriser les accès.

Masquer un bouton n’est pas une sécurité.

Chaque action doit être contrôlée côté backend :

- voir ;
- créer ;
- modifier ;
- supprimer ;
- valider ;
- rejeter ;
- exporter ;
- archiver ;
- configurer ;
- notifier ;
- affecter.

---

# 20. Conclusion stratégique

Academia Helm doit être conçu comme une plateforme unique avec plusieurs expériences contextuelles.

La formule à retenir :

**5 portails officiels, une architecture RBAC commune, des interfaces dynamiques, zéro confusion utilisateur.**

La structure finale est donc :

- Portail Plateforme pour YEHI OR Tech ;
- Portail École pour les établissements ;
- Portail Enseignant pour la pédagogie ;
- Portail Parent / Élève pour le suivi scolaire ;
- Portail Public pour l’acquisition et la pré-inscription.

C’est propre, scalable, professionnel et commercialement défendable.
