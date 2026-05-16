# Academia Helm — Panel Admin Principal Global

## Contexte

Le Panel Admin Principal est le centre de commandement global d’Academia Helm.  
Il intervient après l’implémentation des 6 modules principaux et permet de piloter l’ensemble de la plateforme, des établissements, des utilisateurs, des modules, des accès, des abonnements, des données, des intégrations et de la supervision intelligente.

Ce panel n’est pas le portail d’une école.  
Ce panel est l’espace d’administration centrale de toute la solution Academia Helm.

---

# 1. Positionnement du Panel Admin Principal

Le Panel Admin Principal doit permettre à l’équipe propriétaire de la plateforme de :

- gérer toutes les écoles clientes ;
- gérer les tenants ;
- gérer les plans SaaS ;
- gérer les souscriptions initiales ;
- gérer les abonnements ;
- activer ou désactiver des modules ;
- contrôler les accès ;
- superviser les données ;
- gérer les paiements SaaS ;
- suivre les incidents ;
- consulter les journaux d’audit ;
- piloter ORION ;
- piloter Sara AI ;
- piloter Atlas ;
- gérer les paramètres globaux ;
- surveiller la santé technique de la plateforme.

---

# 2. Logique générale de navigation

Le Panel Admin Principal doit être organisé en onglets métier.

Structure recommandée :

1. Tableau de bord global
2. Écoles / Tenants
3. Souscriptions initiales
4. Abonnements & Plans SaaS
5. Modules & Fonctionnalités
6. Utilisateurs plateforme
7. Rôles & Permissions globales
8. Facturation SaaS
9. Paiements & Transactions
10. Support & Tickets
11. Incidents & Monitoring
12. ORION Global
13. Sara AI Global
14. Atlas Knowledge Base
15. Notifications globales
16. Rapports & Analytics
17. Audit & Logs
18. Sécurité
19. Intégrations
20. Paramètres plateforme

---

# Onglet 1 — Tableau de bord global

## Objectif

Offrir une vue instantanée de la santé business, technique et opérationnelle d’Academia Helm.

## Fonctionnalités

### KPI principaux

- nombre total d’écoles inscrites ;
- nombre d’écoles actives ;
- nombre d’écoles suspendues ;
- nombre d’écoles en période d’essai ;
- nombre total d’utilisateurs ;
- nombre total d’élèves gérés ;
- nombre total d’enseignants ;
- revenus mensuels récurrents ;
- revenus annuels estimés ;
- souscriptions initiales encaissées ;
- abonnements actifs ;
- abonnements expirés ;
- impayés SaaS ;
- tickets ouverts ;
- incidents critiques ;
- consommation ORION ;
- consommation Sara AI ;
- consommation stockage ;
- consommation API.

### Graphiques

- évolution des écoles clientes ;
- évolution du chiffre d’affaires ;
- répartition des écoles par pays ;
- répartition des écoles par plan ;
- taux d’activation des modules ;
- courbe des paiements ;
- courbe des incidents ;
- usage IA par établissement.

### Alertes rapides

- écoles proches de suspension ;
- abonnements expirant bientôt ;
- paiements échoués ;
- incidents critiques ;
- consommation anormale ;
- tenants inactifs ;
- tickets urgents ;
- modules mal configurés.

## Actions rapides

- créer une école ;
- activer une école ;
- suspendre une école ;
- créer une souscription ;
- générer une facture ;
- ouvrir un ticket ;
- envoyer une notification globale ;
- accéder à ORION ;
- accéder aux logs.

---

# Onglet 2 — Écoles / Tenants

## Objectif

Gérer toutes les écoles clientes comme tenants indépendants.

## Fonctionnalités

### Liste des écoles

Colonnes recommandées :

- nom de l’école ;
- code tenant ;
- pays ;
- ville ;
- promoteur ;
- responsable principal ;
- plan SaaS ;
- statut ;
- nombre d’élèves ;
- nombre d’utilisateurs ;
- date de création ;
- date d’expiration abonnement ;
- modules actifs ;
- état paiement ;
- dernière activité.

### Filtres

- pays ;
- ville ;
- statut ;
- plan ;
- module actif ;
- abonnement actif ;
- abonnement expiré ;
- impayé ;
- école suspendue ;
- école en essai ;
- date de création.

### Fiche détaillée école

La fiche école doit contenir :

- informations générales ;
- coordonnées ;
- logo ;
- domaine ou sous-domaine ;
- promoteur ;
- administrateurs ;
- niveaux scolaires activés ;
- modules activés ;
- plan SaaS ;
- souscription initiale ;
- abonnement ;
- historique paiements ;
- utilisateurs ;
- statistiques ;
- logs ;
- incidents ;
- documents contractuels.

### Actions

- créer une école ;
- modifier une école ;
- activer une école ;
- suspendre une école ;
- réactiver une école ;
- supprimer logiquement une école ;
- accéder au tenant ;
- réinitialiser le mot de passe admin école ;
- configurer les modules ;
- changer le plan ;
- générer une facture ;
- envoyer une notification ;
- consulter l’activité ;
- exporter les données.

## Backend attendu

Tables principales :

- tenants
- schools
- school_profiles
- school_contacts
- school_status_history
- tenant_modules
- tenant_settings
- tenant_activity_logs

---

# Onglet 3 — Souscriptions initiales

## Objectif

Gérer les frais d’entrée ou frais d’activation payés par une école avant l’utilisation officielle d’Academia Helm.

## Fonctionnalités

### Liste des souscriptions initiales

Colonnes :

- école ;
- montant ;
- devise ;
- statut ;
- date d’émission ;
- date de paiement ;
- mode de paiement ;
- référence paiement ;
- facture liée ;
- reçu ;
- agent responsable.

### Statuts

- en attente ;
- partiellement payée ;
- payée ;
- annulée ;
- remboursée ;
- en litige.

### Actions

- créer une souscription initiale ;
- associer à une école ;
- générer une facture ;
- enregistrer un paiement ;
- envoyer une relance ;
- marquer comme payée ;
- annuler ;
- télécharger facture ;
- télécharger reçu ;
- exporter.

## Règles métier

Une école ne doit pas passer en statut pleinement actif si la souscription initiale obligatoire n’est pas validée, sauf dérogation manuelle autorisée.

## Backend attendu

Tables :

- initial_subscriptions
- initial_subscription_payments
- initial_subscription_invoices
- initial_subscription_status_history

---

# Onglet 4 — Abonnements & Plans SaaS

## Objectif

Gérer les plans commerciaux, les cycles d’abonnement et les droits associés.

## Fonctionnalités

### Plans SaaS

Chaque plan doit définir :

- nom du plan ;
- prix mensuel ;
- prix annuel ;
- devise ;
- nombre maximal d’élèves ;
- nombre maximal d’utilisateurs ;
- modules inclus ;
- stockage inclus ;
- quota IA ;
- support inclus ;
- options avancées ;
- statut actif ou inactif.

### Abonnements écoles

Colonnes :

- école ;
- plan ;
- cycle ;
- date début ;
- date fin ;
- statut ;
- renouvellement automatique ;
- montant ;
- devise ;
- paiement ;
- prochaine échéance.

### Statuts

- actif ;
- expiré ;
- suspendu ;
- en essai ;
- annulé ;
- en attente de paiement.

### Actions

- créer un plan ;
- modifier un plan ;
- archiver un plan ;
- affecter un plan à une école ;
- renouveler un abonnement ;
- suspendre un abonnement ;
- changer de plan ;
- appliquer une remise ;
- générer une facture ;
- envoyer une relance.

## Backend attendu

Tables :

- plans
- plan_features
- subscriptions
- subscription_cycles
- subscription_history
- subscription_discounts

---

# Onglet 5 — Modules & Fonctionnalités

## Objectif

Contrôler les modules disponibles globalement et ceux activés par école.

## Fonctionnalités

### Catalogue des modules

Chaque module doit avoir :

- nom ;
- code ;
- description ;
- catégorie ;
- statut ;
- dépendances ;
- version ;
- disponibilité par plan ;
- disponibilité par niveau scolaire ;
- permissions associées.

### Activation par école

Pour chaque école :

- modules actifs ;
- modules inactifs ;
- modules en essai ;
- modules verrouillés ;
- modules premium ;
- date d’activation ;
- activé par ;
- historique.

### Actions

- activer un module ;
- désactiver un module ;
- activer en essai ;
- verrouiller un module ;
- définir une dépendance ;
- définir les permissions ;
- affecter à un plan ;
- consulter l’usage.

## Modules principaux déjà implémentés

Le panel doit permettre de superviser les 6 modules principaux déjà développés, notamment :

- module Examens ;
- module Élèves ;
- module Communication ;
- module Pédagogie / Tutorat ;
- module Paramètres ;
- module Finance / Économie si déjà intégré dans le socle principal.

À ajuster selon la liste exacte des 6 modules finalisés.

## Backend attendu

Tables :

- modules
- module_features
- tenant_modules
- module_permissions
- module_dependencies
- module_usage_logs

---

# Onglet 6 — Utilisateurs plateforme

## Objectif

Gérer les utilisateurs internes qui administrent Academia Helm.

## Profils concernés

- Platform Owner ;
- Platform Super Admin ;
- Platform Admin ;
- Billing Manager ;
- Support Agent ;
- Technical Operator / DevOps ;
- Platform Auditor.

## Fonctionnalités

### Liste utilisateurs

Colonnes :

- nom ;
- email ;
- téléphone ;
- rôle ;
- statut ;
- dernière connexion ;
- MFA activé ;
- date création ;
- créé par.

### Actions

- créer utilisateur ;
- modifier utilisateur ;
- désactiver utilisateur ;
- réactiver utilisateur ;
- réinitialiser mot de passe ;
- forcer MFA ;
- changer rôle ;
- consulter historique ;
- bloquer compte.

## Backend attendu

Tables :

- platform_users
- platform_user_profiles
- platform_user_roles
- platform_login_history
- platform_user_status_history

---

# Onglet 7 — Rôles & Permissions globales

## Objectif

Gérer le modèle RBAC global de la plateforme.

## Fonctionnalités

### Rôles

- créer un rôle ;
- modifier un rôle ;
- dupliquer un rôle ;
- archiver un rôle ;
- affecter des permissions ;
- définir les restrictions ;
- consulter les utilisateurs liés.

### Permissions

Chaque permission doit être définie par :

- code ;
- nom ;
- description ;
- module ;
- action ;
- niveau de criticité ;
- portée ;
- statut.

### Actions contrôlées

- view ;
- create ;
- update ;
- delete ;
- validate ;
- reject ;
- export ;
- import ;
- suspend ;
- configure ;
- assign ;
- notify ;
- audit.

## Backend attendu

Tables :

- roles
- permissions
- role_permissions
- user_roles
- permission_scopes

---

# Onglet 8 — Facturation SaaS

## Objectif

Gérer les factures émises aux écoles clientes.

## Fonctionnalités

### Liste factures

Colonnes :

- numéro facture ;
- école ;
- type ;
- montant ;
- devise ;
- statut ;
- date émission ;
- date échéance ;
- date paiement ;
- abonnement lié ;
- souscription liée.

### Types

- souscription initiale ;
- abonnement mensuel ;
- abonnement annuel ;
- module premium ;
- service additionnel ;
- pénalité ;
- remise.

### Statuts

- brouillon ;
- envoyée ;
- payée ;
- partiellement payée ;
- en retard ;
- annulée ;
- remboursée.

### Actions

- créer facture ;
- générer automatiquement ;
- envoyer ;
- télécharger PDF ;
- marquer comme payée ;
- associer paiement ;
- annuler ;
- relancer ;
- exporter.

## Backend attendu

Tables :

- invoices
- invoice_items
- invoice_status_history
- invoice_documents

---

# Onglet 9 — Paiements & Transactions

## Objectif

Suivre tous les paiements reçus par la plateforme.

## Fonctionnalités

### Liste transactions

Colonnes :

- référence ;
- école ;
- montant ;
- devise ;
- méthode ;
- statut ;
- date ;
- facture liée ;
- abonnement lié ;
- souscription liée ;
- opérateur ;
- preuve.

### Méthodes

- mobile money ;
- carte bancaire ;
- virement bancaire ;
- espèces ;
- chèque ;
- passerelle de paiement ;
- ajustement manuel.

### Actions

- enregistrer paiement ;
- valider paiement ;
- rejeter paiement ;
- associer à une facture ;
- importer preuve ;
- télécharger reçu ;
- rembourser ;
- exporter.

## Backend attendu

Tables :

- payments
- payment_methods
- payment_proofs
- payment_status_history
- refunds

---

# Onglet 10 — Support & Tickets

## Objectif

Gérer les demandes d’assistance des écoles et utilisateurs.

## Fonctionnalités

### Tickets

Colonnes :

- numéro ;
- école ;
- demandeur ;
- sujet ;
- catégorie ;
- priorité ;
- statut ;
- assigné à ;
- date création ;
- dernière réponse.

### Catégories

- technique ;
- facturation ;
- accès ;
- bug ;
- demande fonctionnalité ;
- configuration ;
- formation ;
- incident.

### Statuts

- ouvert ;
- en cours ;
- en attente client ;
- résolu ;
- fermé ;
- escaladé.

### Actions

- créer ticket ;
- assigner ;
- répondre ;
- ajouter note interne ;
- escalader ;
- lier à un incident ;
- clôturer ;
- rouvrir ;
- consulter historique.

## Backend attendu

Tables :

- support_tickets
- ticket_messages
- ticket_internal_notes
- ticket_attachments
- ticket_status_history
- ticket_assignments

---

# Onglet 11 — Incidents & Monitoring

## Objectif

Surveiller la santé technique et opérationnelle de la plateforme.

## Fonctionnalités

### Incidents

- incidents critiques ;
- incidents majeurs ;
- incidents mineurs ;
- incidents résolus ;
- incidents par tenant ;
- incidents par module.

### Monitoring

- disponibilité API ;
- disponibilité base de données ;
- files d’attente ;
- stockage ;
- temps de réponse ;
- erreurs serveur ;
- tâches cron ;
- emails envoyés ;
- SMS envoyés ;
- WhatsApp envoyés.

### Actions

- déclarer incident ;
- assigner incident ;
- changer priorité ;
- publier statut ;
- résoudre ;
- lier à ticket ;
- générer rapport post-incident.

## Backend attendu

Tables :

- incidents
- incident_updates
- incident_services
- monitoring_metrics
- service_status_history

---

# Onglet 12 — ORION Global

## Objectif

Piloter l’intelligence opérationnelle globale de la plateforme.

## Fonctionnalités

### Analyses globales

- écoles à risque ;
- abonnements à risque ;
- impayés probables ;
- baisse d’usage ;
- anomalies de connexion ;
- consommation IA anormale ;
- tickets récurrents ;
- modules sous-utilisés ;
- risque de churn.

### Scores

- score santé école ;
- score paiement ;
- score engagement ;
- score support ;
- score risque technique ;
- score adoption modules.

### Actions

- consulter recommandations ;
- générer rapport ;
- notifier équipe ;
- créer ticket automatiquement ;
- déclencher relance ;
- proposer action corrective.

## Backend attendu

Tables :

- orion_insights
- orion_scores
- orion_alerts
- orion_recommendations
- orion_actions

---

# Onglet 13 — Sara AI Global

## Objectif

Administrer l’assistante IA Sara AI au niveau plateforme.

## Fonctionnalités

### Gestion

- activation par école ;
- quotas ;
- modèles IA utilisés ;
- prompts système ;
- règles de sécurité ;
- historique d’usage ;
- coûts IA ;
- limites par plan ;
- permissions par rôle.

### Cas d’usage

- support automatique ;
- génération de rapports ;
- assistance enseignants ;
- aide aux parents ;
- résumé de tickets ;
- rédaction de messages ;
- analyse pédagogique.

### Actions

- activer Sara AI ;
- désactiver Sara AI ;
- configurer quotas ;
- consulter conversations ;
- auditer réponses ;
- gérer prompts ;
- limiter usage ;
- exporter statistiques.

## Backend attendu

Tables :

- ai_assistants
- ai_tenant_settings
- ai_usage_logs
- ai_prompts
- ai_conversation_logs
- ai_safety_logs

---

# Onglet 14 — Atlas Knowledge Base

## Objectif

Gérer la base de connaissance globale d’Academia Helm.

## Fonctionnalités

### Contenus

- documentation modules ;
- guides utilisateurs ;
- FAQ ;
- procédures internes ;
- tutoriels ;
- guides de formation ;
- documentation technique ;
- documentation RBAC ;
- workflows métier.

### Actions

- créer article ;
- modifier article ;
- publier ;
- archiver ;
- catégoriser ;
- lier à un module ;
- lier à un rôle ;
- rendre accessible à Sara AI ;
- rechercher ;
- exporter.

## Backend attendu

Tables :

- knowledge_articles
- knowledge_categories
- knowledge_tags
- knowledge_versions
- knowledge_permissions
- knowledge_ai_index

---

# Onglet 15 — Notifications globales

## Objectif

Envoyer et suivre les notifications plateforme.

## Canaux

- email ;
- SMS ;
- WhatsApp ;
- notification in-app ;
- push mobile.

## Fonctionnalités

- campagnes globales ;
- messages ciblés ;
- notifications système ;
- relances automatiques ;
- modèles de messages ;
- historique d’envoi ;
- statistiques de lecture ;
- échecs d’envoi.

## Actions

- créer notification ;
- cibler écoles ;
- cibler rôles ;
- programmer ;
- envoyer immédiatement ;
- annuler ;
- consulter statistiques.

## Backend attendu

Tables :

- global_notifications
- notification_templates
- notification_recipients
- notification_channels
- notification_delivery_logs

---

# Onglet 16 — Rapports & Analytics

## Objectif

Fournir des rapports consolidés sur toute la plateforme.

## Rapports disponibles

- rapport business ;
- rapport financier ;
- rapport écoles ;
- rapport abonnements ;
- rapport modules ;
- rapport utilisateurs ;
- rapport support ;
- rapport incidents ;
- rapport IA ;
- rapport sécurité ;
- rapport adoption.

## Actions

- générer rapport ;
- filtrer ;
- exporter PDF ;
- exporter Excel ;
- programmer rapport ;
- envoyer par email ;
- comparer périodes.

## Backend attendu

Tables :

- reports
- report_templates
- report_exports
- scheduled_reports
- analytics_snapshots

---

# Onglet 17 — Audit & Logs

## Objectif

Tracer toutes les actions sensibles de la plateforme.

## Logs à conserver

- connexions ;
- créations ;
- modifications ;
- suppressions ;
- validations ;
- suspensions ;
- changements de rôle ;
- changements de plan ;
- paiements ;
- exports ;
- accès aux données sensibles ;
- actions IA ;
- actions super admin.

## Fonctionnalités

- recherche avancée ;
- filtre par utilisateur ;
- filtre par école ;
- filtre par action ;
- filtre par module ;
- filtre par date ;
- export audit ;
- détection d’anomalies.

## Backend attendu

Tables :

- audit_logs
- login_logs
- sensitive_action_logs
- export_logs
- admin_action_logs

---

# Onglet 18 — Sécurité

## Objectif

Protéger la plateforme, les tenants et les données.

## Fonctionnalités

- MFA ;
- politique de mot de passe ;
- sessions actives ;
- blocage IP ;
- liste blanche IP ;
- appareils connectés ;
- tentatives échouées ;
- détection comportementale ;
- gestion des tokens ;
- rotation des clés ;
- politique de sauvegarde ;
- chiffrement ;
- conformité.

## Actions

- forcer MFA ;
- révoquer session ;
- bloquer utilisateur ;
- bloquer IP ;
- régénérer clé API ;
- consulter alertes sécurité ;
- exporter rapport sécurité.

## Backend attendu

Tables :

- security_settings
- mfa_settings
- user_sessions
- blocked_ips
- api_keys
- security_alerts
- password_policies

---

# Onglet 19 — Intégrations

## Objectif

Gérer les connexions externes utilisées par Academia Helm.

## Intégrations possibles

- passerelles de paiement ;
- SMS ;
- WhatsApp ;
- email SMTP ;
- stockage cloud ;
- APIs IA ;
- EDUCMASTER ;
- services de sauvegarde ;
- webhooks ;
- outils analytics.

## Fonctionnalités

- configurer intégration ;
- tester connexion ;
- activer ;
- désactiver ;
- consulter logs ;
- gérer clés API ;
- définir limites ;
- surveiller erreurs.

## Backend attendu

Tables :

- integrations
- integration_credentials
- integration_logs
- webhooks
- webhook_events

---

# Onglet 20 — Paramètres plateforme

## Objectif

Configurer les paramètres globaux d’Academia Helm.

## Paramètres

- nom plateforme ;
- logo ;
- domaine principal ;
- sous-domaines ;
- devises ;
- pays actifs ;
- langues ;
- fuseaux horaires ;
- règles SaaS ;
- règles suspension ;
- règles facturation ;
- règles notifications ;
- limites globales ;
- maintenance ;
- version système.

## Actions

- modifier paramètres ;
- activer mode maintenance ;
- gérer pays ;
- gérer devises ;
- gérer langues ;
- configurer domaines ;
- définir règles globales ;
- sauvegarder configuration.

## Backend attendu

Tables :

- platform_settings
- platform_localization
- platform_currencies
- platform_countries
- platform_maintenance
- platform_versions

---

# Conclusion

Le Panel Admin Principal d’Academia Helm doit être conçu comme le cockpit central de la plateforme.

Il doit permettre de contrôler :

- le business ;
- les écoles ;
- les abonnements ;
- les modules ;
- les utilisateurs ;
- les paiements ;
- le support ;
- les incidents ;
- l’intelligence ORION ;
- Sara AI ;
- Atlas ;
- la sécurité ;
- les intégrations ;
- les paramètres globaux.

La logique est simple :

**les écoles utilisent Academia Helm, mais le Panel Admin Principal contrôle Academia Helm.**

C’est ce panel qui transforme le projet en vrai SaaS professionnel, scalable et commercialisable.
