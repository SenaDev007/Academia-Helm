# Academia Helm — Ajout des modules Agrégation et ORION-Pilotage Direction

## Contexte

Deux modules stratégiques doivent être ajoutés à l’architecture globale d’Academia Helm :

1. Module Agrégation
2. Module ORION-Pilotage Direction

Ces deux modules ne doivent pas être traités comme de simples sous-fonctions.  
Ils constituent des briques de pilotage avancé pour le promoteur, le fondateur, la direction générale et les directions de niveau.

---

# 1. Module Agrégation

## 1.1 Définition

Le module Agrégation est le moteur de consolidation des données d’Academia Helm.

Il collecte, normalise, croise et consolide les données issues des différents modules afin de produire une vision globale, fiable et exploitable de l’établissement.

Il ne remplace pas les modules métiers.  
Il les connecte et les transforme en intelligence décisionnelle.

## 1.2 Objectif

Le module Agrégation permet de centraliser les données provenant de :

- Élèves ;
- Examens ;
- Finance / Économie ;
- Communication ;
- Pédagogie / Tutorat ;
- Paramètres ;
- Présences ;
- Discipline ;
- Services ;
- Transport ;
- Cantine ;
- Internat ;
- Santé ;
- RH ;
- Bibliothèque ;
- ORION ;
- Sara AI.

## 1.3 Utilisateurs concernés

Le module Agrégation concerne principalement :

- Promoteur / Fondateur ;
- Président / Conseil d’administration ;
- Directeur Général ;
- Directeur d’Établissement ;
- Directeur Adjoint ;
- Responsable Pédagogique Général ;
- Directeur Administratif et Financier ;
- Responsable Financier ;
- Responsable Scolarité Générale ;
- Data Manager ;
- Auditeur Interne ;
- Platform Owner côté SaaS si vue multi-écoles autorisée.

## 1.4 Fonctionnalités principales

### A. Agrégation des effectifs

- effectifs globaux ;
- effectifs par niveau ;
- effectifs par classe ;
- effectifs par sexe si l’école renseigne cette donnée ;
- nouveaux inscrits ;
- réinscriptions ;
- départs ;
- transferts ;
- abandons ;
- évolution mensuelle ;
- taux de croissance ;
- capacité d’accueil utilisée.

### B. Agrégation financière

- recettes globales ;
- encaissements par période ;
- impayés ;
- taux de recouvrement ;
- paiements par classe ;
- paiements par niveau ;
- paiements par service ;
- dépenses ;
- solde net ;
- prévisions de trésorerie ;
- élèves débiteurs ;
- services rentables ;
- services déficitaires.

### C. Agrégation pédagogique

- moyennes globales ;
- taux de réussite ;
- taux d’échec ;
- progression par classe ;
- progression par niveau ;
- matières faibles ;
- matières fortes ;
- enseignants avec notes manquantes ;
- classes à risque ;
- évolution des performances ;
- comparaison entre périodes ;
- analyse Maternelle qualitative ;
- analyse Primaire quantitative sans coefficient ;
- analyse Secondaire quantitative avec coefficient.

### D. Agrégation des présences et discipline

- absences globales ;
- retards ;
- absences répétitives ;
- élèves à risque ;
- incidents disciplinaires ;
- sanctions ;
- convocations ;
- classes les plus touchées ;
- évolution mensuelle ;
- corrélation absence/résultat.

### E. Agrégation communication

- messages envoyés ;
- messages lus ;
- messages non lus ;
- taux de lecture ;
- campagnes ;
- relances ;
- notifications critiques ;
- parents injoignables ;
- canaux les plus efficaces.

### F. Agrégation pédagogique enseignant

- fiches pédagogiques soumises ;
- fiches validées ;
- fiches rejetées ;
- cahiers journaux soumis ;
- cahiers de textes remplis ;
- cahiers de semaine ;
- retards de soumission ;
- taux de conformité pédagogique ;
- observations des directeurs ;
- performance administrative des enseignants.

### G. Agrégation services

- cantine ;
- transport ;
- internat ;
- bibliothèque ;
- infirmerie ;
- sécurité ;
- activités ;
- paiements associés ;
- fréquentation ;
- incidents ;
- rentabilité.

## 1.5 Onglets internes du module Agrégation

Structure recommandée :

1. Vue consolidée
2. Effectifs
3. Finances
4. Résultats scolaires
5. Présences & Discipline
6. Pédagogie Enseignant
7. Communication
8. Services
9. Comparaisons
10. Exports & Rapports

## 1.6 UI/UX recommandée

Le module Agrégation doit être très visuel :

- cartes KPI ;
- graphiques ;
- tableaux consolidés ;
- filtres globaux ;
- filtres par année scolaire ;
- filtres par niveau ;
- filtres par classe ;
- filtres par période ;
- filtres par module ;
- comparaisons temporelles ;
- exports PDF ;
- exports Excel ;
- rapports automatiques.

## 1.7 Backend attendu

Tables possibles :

- aggregation_snapshots
- aggregation_metrics
- aggregation_sources
- aggregation_reports
- aggregation_filters
- aggregation_exports
- aggregation_jobs
- aggregation_errors

## 1.8 Règles métier

- Les données agrégées doivent être traçables.
- Chaque indicateur doit indiquer sa source.
- Les calculs doivent respecter les règles configurées par l’école.
- Les données sensibles doivent respecter les permissions.
- Les rapports doivent pouvoir être figés à une date donnée.
- Les agrégations doivent être recalculables.
- Les erreurs d’agrégation doivent être journalisées.

---

# 2. Module ORION-Pilotage Direction

## 2.1 Définition

ORION-Pilotage Direction est le module de pilotage stratégique destiné au Promoteur/Fondateur, à la Direction Générale et aux directions autorisées.

Il exploite les données agrégées pour produire des alertes, des scores, des recommandations et des décisions assistées.

Ce module est différent de ORION Global côté plateforme.  
ORION Global pilote le SaaS.  
ORION-Pilotage Direction pilote l’établissement.

## 2.2 Objectif

ORION-Pilotage Direction permet à la direction de répondre rapidement à des questions essentielles :

- Où va l’école ?
- Quels sont les risques ?
- Quels élèves sont en difficulté ?
- Quelles classes décrochent ?
- Quels parents ne paient pas ?
- Quels enseignants sont en retard dans leurs obligations pédagogiques ?
- Quels services coûtent plus qu’ils ne rapportent ?
- Quelles décisions faut-il prendre cette semaine ?
- Quels indicateurs exigent une intervention immédiate ?

## 2.3 Utilisateurs concernés

- Promoteur / Fondateur ;
- Président / Conseil d’administration ;
- Directeur Général ;
- Directeur d’Établissement ;
- Directeur Adjoint ;
- Responsable Pédagogique Général ;
- Responsable Financier ;
- Directeur Administratif et Financier ;
- Responsable Scolarité Générale ;
- Responsables de niveau selon permissions ;
- Auditeur Interne en lecture seule.

## 2.4 Fonctionnalités principales

### A. Cockpit Direction

- santé globale de l’établissement ;
- score de performance générale ;
- score financier ;
- score pédagogique ;
- score discipline ;
- score communication ;
- score services ;
- score conformité pédagogique ;
- alertes critiques ;
- décisions recommandées.

### B. Alertes intelligentes

- baisse des résultats ;
- impayés élevés ;
- absences répétitives ;
- notes manquantes ;
- enseignants en retard ;
- classes à risque ;
- baisse de fréquentation cantine ;
- surcharge d’effectif ;
- incidents disciplinaires répétés ;
- parents non réactifs ;
- élèves à risque de décrochage.

### C. Recommandations directionnelles

- convoquer un parent ;
- relancer un débiteur ;
- organiser une réunion pédagogique ;
- renforcer une matière ;
- contrôler une classe ;
- demander une justification à un enseignant ;
- réviser une règle de calcul ;
- ajuster une communication ;
- revoir un service déficitaire ;
- planifier une inspection interne.

### D. Décisions assistées

Le module doit permettre de transformer une recommandation en action :

- créer une tâche ;
- envoyer une notification ;
- ouvrir un dossier de suivi ;
- assigner un responsable ;
- fixer une échéance ;
- suivre l’exécution ;
- clôturer la décision ;
- générer un rapport de décision.

### E. Analyse financière intelligente

- prévision des impayés ;
- projection de trésorerie ;
- taux de recouvrement attendu ;
- écoles/classes/niveaux les plus débiteurs ;
- services rentables ;
- services déficitaires ;
- alertes de baisse d’encaissement ;
- recommandations de relance.

### F. Analyse pédagogique intelligente

- matières faibles ;
- enseignants avec anomalies de notes ;
- classes à risque ;
- élèves en baisse ;
- évolution des performances ;
- comparaison par période ;
- alertes avant conseils de classe ;
- recommandations pédagogiques.

### G. Analyse administrative

- dossiers incomplets ;
- documents manquants ;
- inscriptions non finalisées ;
- retards administratifs ;
- anomalies de configuration ;
- doublons ;
- incohérences de données.

### H. Analyse RH et enseignants

- retards de soumission ;
- documents pédagogiques rejetés ;
- enseignants non conformes ;
- charges horaires ;
- absences enseignants ;
- besoin d’accompagnement ;
- performance administrative.

## 2.5 Onglets internes du module ORION-Pilotage Direction

Structure recommandée :

1. Cockpit Direction
2. Alertes critiques
3. Scores de pilotage
4. Recommandations
5. Décisions & Actions
6. Finances intelligentes
7. Pédagogie intelligente
8. Vie scolaire intelligente
9. Services intelligents
10. Rapports Direction

## 2.6 UI/UX recommandée

ORION-Pilotage Direction doit être conçu comme un tableau de bord exécutif.

Il doit être :

- clair ;
- synthétique ;
- priorisé ;
- orienté décision ;
- peu bavard ;
- très visuel ;
- filtrable ;
- exportable ;
- compatible mobile/tablette pour promoteur et direction.

Composants recommandés :

- score cards ;
- alert cards ;
- risk badges ;
- recommendation cards ;
- timeline décisionnelle ;
- matrice urgence/impact ;
- graphiques de tendance ;
- comparatifs par période ;
- bouton “Transformer en action” ;
- bouton “Assigner” ;
- bouton “Notifier” ;
- bouton “Générer rapport”.

## 2.7 Backend attendu

Tables possibles :

- orion_direction_scores
- orion_direction_alerts
- orion_direction_recommendations
- orion_direction_decisions
- orion_direction_actions
- orion_direction_reports
- orion_direction_risk_profiles
- orion_direction_notifications
- orion_direction_history

## 2.8 Règles métier

- ORION-Pilotage Direction doit s’appuyer sur les données du module Agrégation.
- Chaque alerte doit être justifiable.
- Chaque recommandation doit avoir une source.
- Une décision doit avoir un responsable et une échéance.
- Les actions doivent être traçables.
- Les scores doivent être recalculables.
- Les seuils doivent être configurables par l’école.
- Les accès doivent être strictement contrôlés.

---

# 3. Différence entre Agrégation et ORION-Pilotage Direction

| Élément | Module Agrégation | ORION-Pilotage Direction |
|---|---|---|
| Rôle | Consolider les données | Aider à décider |
| Nature | Statistique / analytique | Intelligence décisionnelle |
| Sortie | Indicateurs, rapports, tableaux | Alertes, scores, recommandations, actions |
| Utilisateurs | Direction, finance, pédagogie, data manager | Promoteur, direction, responsables autorisés |
| Question principale | Que disent les données ? | Que faut-il faire maintenant ? |
| Dépendance | Collecte les données des modules | Exploite les données agrégées |

Formule simple :

Le module Agrégation dit : “Voici la réalité consolidée.”  
ORION-Pilotage Direction dit : “Voici les décisions à prendre.”

---

# 4. Mise à jour du Panel Admin Principal

Le Panel Admin Principal doit désormais intégrer ces deux modules dans sa structure.

## Nouvelle structure recommandée

1. Tableau de bord global
2. Écoles / Tenants
3. Souscriptions initiales
4. Abonnements & Plans SaaS
5. Modules & Fonctionnalités
6. Agrégation
7. ORION-Pilotage Direction
8. Utilisateurs plateforme
9. Rôles & Permissions globales
10. Facturation SaaS
11. Paiements & Transactions
12. Support & Tickets
13. Incidents & Monitoring
14. ORION Global
15. Sara AI Global
16. Atlas Knowledge Base
17. Notifications globales
18. Rapports & Analytics
19. Audit & Logs
20. Sécurité
21. Intégrations
22. Paramètres plateforme

## Remarque importante

ORION-Pilotage Direction est un module école.  
ORION Global est un module plateforme.

Il ne faut pas les confondre.

- ORION Global surveille la santé SaaS de toutes les écoles.
- ORION-Pilotage Direction aide une école à piloter son établissement.

---

# 5. Intégration dans les portails

## Portail École

Le module Agrégation et ORION-Pilotage Direction doivent être visibles selon les rôles :

- Promoteur / Fondateur ;
- Directeur Général ;
- Directeur d’Établissement ;
- Directeur Adjoint ;
- Responsable Pédagogique Général ;
- Directeur Administratif et Financier ;
- Responsable Financier ;
- Responsable Scolarité Générale ;
- Auditeur Interne.

## Portail Plateforme

Le Platform Owner peut voir :

- agrégations multi-écoles ;
- indicateurs consolidés SaaS ;
- ORION Global ;
- santé des tenants ;
- adoption des modules.

Mais il ne doit pas accéder aux données sensibles détaillées d’une école sans cadre de permission clair.

---

# 6. Conclusion

Le module Agrégation et ORION-Pilotage Direction sont indispensables.

Sans Agrégation, les données restent dispersées.  
Sans ORION-Pilotage Direction, les données ne deviennent pas des décisions.

La combinaison idéale est donc :

1. Les modules métiers produisent les données.
2. Le module Agrégation consolide les données.
3. ORION-Pilotage Direction interprète les données.
4. La Direction prend des décisions.
5. Le système suit l’exécution des actions.

C’est cette chaîne qui donne à Academia Helm une vraie valeur de pilotage stratégique.
