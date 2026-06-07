# Academia Helm — Module Supplémentaire 2 : Transport

## 1. Présentation générale

Le module Transport d’Academia Helm permet de gérer les véhicules scolaires, les chauffeurs, les itinéraires, les élèves transportés, les affectations, les trajets, la maintenance, les incidents, les retards, les présences dans les bus et les rapports d’exploitation.

Ce module doit être conçu comme un centre de pilotage du transport scolaire, avec une logique de sécurité, de traçabilité, de ponctualité et de communication avec les parents.

---

## 2. Objectif métier

Le module Transport permet à l’école de :

- organiser les circuits de ramassage ;
- affecter les élèves aux véhicules ;
- suivre les chauffeurs et accompagnateurs ;
- contrôler les présences dans le bus ;
- informer les parents ;
- suivre les retards ;
- gérer les incidents ;
- planifier la maintenance des véhicules ;
- suivre les coûts de transport ;
- produire des rapports de fréquentation ;
- améliorer la sécurité des élèves.

---

## 3. Utilisateurs concernés

- Promoteur / Fondateur
- Direction générale
- Directeur d’établissement
- Responsable transport
- Chauffeurs
- Accompagnateurs de bus
- Surveillant général
- Comptabilité / Finance
- Parents
- Élèves en consultation limitée
- Responsable maintenance
- ORION Pilotage Direction
- Sara AI

---

## 4. Onglets recommandés

1. Tableau de bord
2. Véhicules
3. Chauffeurs & Accompagnateurs
4. Itinéraires
5. Arrêts & Zones
6. Élèves transportés
7. Planning des trajets
8. Suivi des trajets
9. Présences & Retards
10. Incidents & Sécurité
11. Maintenance
12. Paiements transport
13. Rapports & Statistiques
14. Paramètres

---

## 5. Onglet 1 — Tableau de bord

### Objectif

Afficher une vue globale de l’activité transport.

### Informations affichées

- nombre de véhicules actifs ;
- nombre de chauffeurs actifs ;
- trajets du jour ;
- élèves transportés ;
- retards du jour ;
- incidents récents ;
- véhicules en maintenance ;
- circuits actifs ;
- paiements transport en attente ;
- alertes critiques.

### KPI

- taux de ponctualité ;
- taux de présence transport ;
- taux d’occupation des véhicules ;
- coût moyen par trajet ;
- nombre d’incidents ;
- véhicules indisponibles ;
- élèves non récupérés ;
- parents non notifiés.

---

## 6. Onglet 2 — Véhicules

### Fonction

Gérer le parc automobile de l’école.

### Champs principaux

- nom ou code du véhicule ;
- immatriculation ;
- marque ;
- modèle ;
- type de véhicule ;
- capacité ;
- année ;
- statut ;
- chauffeur principal ;
- accompagnateur principal ;
- assurance ;
- visite technique ;
- carte grise ;
- kilométrage ;
- consommation ;
- date d’acquisition ;
- coût ;
- documents joints ;
- observations.

### Statuts

- actif ;
- disponible ;
- en trajet ;
- en maintenance ;
- hors service ;
- réservé ;
- archivé.

---

## 7. Onglet 3 — Chauffeurs & Accompagnateurs

### Fonction

Gérer les personnes responsables du transport.

### Champs chauffeur

- nom ;
- prénom ;
- téléphone ;
- email ;
- permis ;
- catégorie de permis ;
- date d’expiration du permis ;
- véhicule affecté ;
- statut ;
- documents ;
- historique des trajets ;
- incidents liés ;
- observations.

### Champs accompagnateur

- nom ;
- prénom ;
- téléphone ;
- véhicule ou circuit affecté ;
- rôle ;
- statut ;
- observations.

### Règles

- un chauffeur sans permis valide ne doit pas être affecté ;
- un chauffeur inactif ne doit pas être planifié ;
- un accompagnateur peut être obligatoire selon le niveau scolaire ;
- les documents expirés doivent générer une alerte.

---

## 8. Onglet 4 — Itinéraires

### Fonction

Créer et gérer les circuits de transport.

### Champs principaux

- nom de l’itinéraire ;
- code ;
- zone ;
- véhicule affecté ;
- chauffeur ;
- accompagnateur ;
- heure de départ ;
- heure d’arrivée estimée ;
- distance estimée ;
- durée estimée ;
- liste des arrêts ;
- élèves affectés ;
- statut ;
- observations.

### Types d’itinéraires

- matin ;
- midi ;
- soir ;
- aller simple ;
- retour simple ;
- aller-retour ;
- circuit spécial ;
- sortie scolaire.

---

## 9. Onglet 5 — Arrêts & Zones

### Fonction

Gérer les points de ramassage et de dépôt.

### Champs arrêt

- nom de l’arrêt ;
- zone ;
- adresse ;
- repère ;
- heure de passage estimée ;
- ordre dans le circuit ;
- élèves concernés ;
- statut ;
- observations.

### Zones

- quartier ;
- arrondissement ;
- commune ;
- axe routier ;
- zone spéciale ;
- zone à risque ;
- zone hors périmètre.

---

## 10. Onglet 6 — Élèves transportés

### Fonction

Gérer les élèves inscrits au service transport.

### Champs principaux

- élève ;
- classe ;
- parent responsable ;
- téléphone parent ;
- itinéraire ;
- arrêt de ramassage ;
- arrêt de dépôt ;
- type d’abonnement ;
- période ;
- statut paiement ;
- autorisations ;
- consignes particulières ;
- statut transport.

### Statuts

- actif ;
- suspendu ;
- en attente ;
- non payé ;
- désinscrit ;
- archivé.

---

## 11. Onglet 7 — Planning des trajets

### Fonction

Planifier les trajets quotidiens, hebdomadaires ou exceptionnels.

### Fonctionnalités

- planning journalier ;
- planning hebdomadaire ;
- trajets récurrents ;
- trajets exceptionnels ;
- sorties scolaires ;
- remplacement chauffeur ;
- remplacement véhicule ;
- annulation de trajet ;
- report de trajet.

---

## 12. Onglet 8 — Suivi des trajets

### Fonction

Suivre l’exécution réelle des trajets.

### Données suivies

- trajet démarré ;
- trajet terminé ;
- heure réelle de départ ;
- heure réelle d’arrivée ;
- retard ;
- véhicule utilisé ;
- chauffeur ;
- accompagnateur ;
- élèves montés ;
- élèves descendus ;
- incidents ;
- observations.

### Option avancée

Si l’école active le suivi GPS :

- position du véhicule ;
- estimation d’arrivée ;
- historique du trajet ;
- alerte sortie d’itinéraire ;
- notification parent en temps réel.

---

## 13. Onglet 9 — Présences & Retards

### Fonction

Contrôler les élèves réellement présents dans le véhicule.

### Statuts de présence

- monté ;
- absent à l’arrêt ;
- descendu ;
- non récupéré ;
- retard ;
- absent justifié ;
- absent non justifié.

### Notifications parent

Le parent peut être notifié lorsque :

- l’enfant est monté dans le bus ;
- l’enfant est descendu ;
- le bus est en retard ;
- l’enfant est absent à l’arrêt ;
- le trajet est annulé ;
- un incident est déclaré.

---

## 14. Onglet 10 — Incidents & Sécurité

### Types d’incidents

- retard important ;
- panne véhicule ;
- accident ;
- élève non présent à l’arrêt ;
- élève non récupéré ;
- comportement dangereux ;
- problème avec parent ;
- problème de circulation ;
- changement d’itinéraire ;
- incident médical léger ;
- oubli d’objet ;
- conflit entre élèves.

### Champs incident

- date ;
- trajet ;
- véhicule ;
- chauffeur ;
- accompagnateur ;
- élève concerné si applicable ;
- type ;
- gravité ;
- description ;
- action prise ;
- parent informé ;
- direction informée ;
- statut ;
- pièces jointes.

### Gravité

- faible ;
- moyenne ;
- élevée ;
- critique.

---

## 15. Onglet 11 — Maintenance

### Fonction

Gérer l’entretien des véhicules.

### Types de maintenance

- vidange ;
- pneus ;
- freins ;
- batterie ;
- assurance ;
- visite technique ;
- nettoyage ;
- réparation ;
- contrôle sécurité ;
- maintenance préventive ;
- maintenance corrective.

### Alertes

- assurance expirée ;
- visite technique expirée ;
- maintenance proche ;
- panne répétée ;
- véhicule indisponible ;
- coût anormal.

---

## 16. Onglet 12 — Paiements transport

### Fonction

Suivre les frais de transport scolaire.

### Données

- élève ;
- itinéraire ;
- type d’abonnement ;
- montant ;
- période ;
- statut paiement ;
- remise éventuelle ;
- facture ;
- reçu ;
- historique.

### Statuts

- payé ;
- partiellement payé ;
- impayé ;
- en retard ;
- exonéré ;
- annulé.

### Intégration finance

Les frais de transport doivent être reliés au module financier afin d’éviter une double saisie.

---

## 17. Onglet 13 — Rapports & Statistiques

### Rapports

- rapport journalier des trajets ;
- rapport de présence transport ;
- rapport de retard ;
- rapport d’incidents ;
- rapport par véhicule ;
- rapport par chauffeur ;
- rapport par itinéraire ;
- rapport financier transport ;
- rapport de maintenance ;
- rapport annuel.

### Statistiques

- taux de ponctualité ;
- taux d’occupation ;
- coût par véhicule ;
- coût par élève ;
- incidents par itinéraire ;
- élèves les plus souvent absents ;
- véhicules les plus utilisés ;
- chauffeurs les plus ponctuels.

---

## 18. Onglet 14 — Paramètres

Paramètres à prévoir :

- types de véhicules ;
- types d’abonnements ;
- zones ;
- arrêts ;
- règles de notification ;
- règles de retard ;
- seuils d’alerte ;
- documents obligatoires ;
- workflows de validation ;
- permissions ;
- modèles de messages ;
- paramètres GPS si activé.

---

## 19. UI/UX recommandée

Le module doit être très visuel.

### Composants UI

- cartes KPI ;
- carte des itinéraires ;
- planning des trajets ;
- fiche véhicule ;
- fiche chauffeur ;
- liste des élèves transportés ;
- badges de statut ;
- timeline trajet ;
- alertes critiques ;
- tableau des présences ;
- rapport exportable.

### Expérience parent

Le parent doit voir simplement :

- itinéraire de l’enfant ;
- arrêt de ramassage ;
- heure prévue ;
- statut du trajet ;
- notification montée/descente ;
- retard éventuel ;
- contact transport ;
- historique.

---

## 20. Frontend

Pages principales :

- /transport/dashboard
- /transport/vehicles
- /transport/drivers
- /transport/routes
- /transport/stops
- /transport/students
- /transport/schedules
- /transport/trips
- /transport/attendance
- /transport/incidents
- /transport/maintenance
- /transport/payments
- /transport/reports
- /transport/settings

Composants :

- TransportDashboardCards
- VehicleTable
- DriverTable
- RouteBuilder
- StopManager
- TransportStudentList
- TripScheduleCalendar
- TripTrackingTimeline
- TransportAttendanceTable
- TransportIncidentForm
- VehicleMaintenanceTimeline
- TransportPaymentTable
- TransportReportBuilder

---

## 21. Backend

Services principaux :

- TransportService
- VehicleService
- DriverService
- RouteService
- StopService
- TransportStudentService
- TripScheduleService
- TripTrackingService
- TransportAttendanceService
- TransportIncidentService
- VehicleMaintenanceService
- TransportPaymentService
- TransportReportService
- TransportNotificationService

API principales :

- GET /api/transport/dashboard
- GET /api/transport/vehicles
- POST /api/transport/vehicles
- GET /api/transport/drivers
- POST /api/transport/drivers
- GET /api/transport/routes
- POST /api/transport/routes
- GET /api/transport/stops
- POST /api/transport/stops
- POST /api/transport/students
- POST /api/transport/trips
- PATCH /api/transport/trips/:id/status
- POST /api/transport/attendance
- POST /api/transport/incidents
- POST /api/transport/maintenance
- GET /api/transport/reports

---

## 22. Base de données

Tables recommandées :

- transport_vehicles
- transport_vehicle_documents
- transport_drivers
- transport_accompagnators
- transport_routes
- transport_route_stops
- transport_stops
- transport_zones
- transport_students
- transport_subscriptions
- transport_schedules
- transport_trips
- transport_trip_attendance
- transport_trip_events
- transport_incidents
- transport_vehicle_maintenance
- transport_payments
- transport_notifications
- transport_reports
- transport_settings

---

## 23. Permissions

Permissions recommandées :

- TRANSPORT_VIEW
- TRANSPORT_DASHBOARD_VIEW
- TRANSPORT_VEHICLE_CREATE
- TRANSPORT_VEHICLE_UPDATE
- TRANSPORT_VEHICLE_DELETE
- TRANSPORT_DRIVER_MANAGE
- TRANSPORT_ROUTE_MANAGE
- TRANSPORT_STOP_MANAGE
- TRANSPORT_STUDENT_ASSIGN
- TRANSPORT_TRIP_PLAN
- TRANSPORT_TRIP_TRACK
- TRANSPORT_ATTENDANCE_MARK
- TRANSPORT_INCIDENT_REPORT
- TRANSPORT_MAINTENANCE_MANAGE
- TRANSPORT_PAYMENT_VIEW
- TRANSPORT_REPORT_VIEW
- TRANSPORT_SETTINGS_MANAGE

---

## 24. Notifications

Notifications possibles :

- enfant monté dans le bus ;
- enfant descendu du bus ;
- bus en retard ;
- trajet annulé ;
- changement d’itinéraire ;
- changement d’horaire ;
- incident déclaré ;
- paiement transport en retard ;
- véhicule en maintenance ;
- document véhicule expiré ;
- chauffeur remplacé.

Canaux :

- in-app ;
- email ;
- SMS ;
- WhatsApp ;
- push mobile.

---

## 25. Intégrations

### Avec le module Élèves

- affectation élève au transport ;
- historique transport ;
- présence ;
- incidents ;
- autorisations parentales.

### Avec le module Finance

- frais de transport ;
- paiements ;
- factures ;
- reçus ;
- impayés ;
- remises.

### Avec le module Communication

- notifications parents ;
- messages transport ;
- alertes urgentes ;
- rappels.

### Avec le module QHSE

- incidents ;
- sécurité ;
- conformité ;
- plans d’action ;
- risques trajet.

### Avec ORION

ORION peut détecter :

- retards fréquents ;
- itinéraire peu efficace ;
- véhicule trop coûteux ;
- chauffeur souvent en retard ;
- incident répété sur un circuit ;
- taux d’occupation trop faible ;
- élève souvent absent à l’arrêt ;
- paiement transport en retard.

ORION peut recommander :

- optimiser un itinéraire ;
- changer un horaire ;
- planifier une maintenance ;
- alerter la direction ;
- notifier un parent ;
- réaffecter un véhicule ;
- revoir la tarification.

### Avec Sara AI

Sara AI peut aider à :

- rédiger un message de retard ;
- expliquer un changement d’itinéraire ;
- générer un rapport transport ;
- résumer les incidents ;
- produire une note aux parents ;
- créer une procédure de sécurité ;
- préparer une synthèse mensuelle.

### Avec Atlas Knowledge Base

Atlas peut stocker :

- procédures transport ;
- règles de sécurité ;
- modèles de messages ;
- contrats chauffeur ;
- fiches véhicule ;
- documents réglementaires ;
- consignes d’urgence.

---

## 26. Règles métier

- Un véhicule en maintenance ne peut pas être affecté à un trajet.
- Un chauffeur sans permis valide ne peut pas être planifié.
- Un élève non inscrit au transport ne doit pas apparaître sur une feuille de trajet.
- Un trajet ne doit pas dépasser la capacité du véhicule.
- Les parents doivent être notifiés en cas de retard important.
- Les incidents doivent être historisés.
- Les paiements transport doivent être reliés au module financier.
- Les changements d’itinéraire doivent être tracés.
- Les présences dans le bus doivent être conservées.
- Les documents expirés doivent générer une alerte.
- Les données visibles par les parents doivent être limitées à leurs propres enfants.

---

## 27. Conclusion

Le module Transport permet à Academia Helm de couvrir un besoin très concret des établissements : sécuriser, organiser et suivre le transport scolaire.

Il apporte :

1. une meilleure organisation des trajets ;
2. une meilleure communication avec les parents ;
3. une traçabilité des présences ;
4. un suivi des incidents ;
5. une gestion des véhicules ;
6. une maîtrise des coûts ;
7. une intégration avec la finance, les élèves, la communication et ORION.

C’est un module très vendable, surtout pour les écoles privées qui proposent le ramassage scolaire.
