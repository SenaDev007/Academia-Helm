# Academia Helm — Module Supplémentaire 1 : Laboratoire

## 1. Présentation générale

Le module Laboratoire est un module supplémentaire d’Academia Helm destiné à gérer les laboratoires scolaires, les équipements scientifiques, les consommables, les réservations, les séances pratiques, la maintenance, la sécurité et les rapports d’utilisation.

Il concerne principalement les établissements disposant de laboratoires de sciences physiques, chimie, biologie, technologie, informatique, robotique, langues ou tout autre espace pédagogique spécialisé.

Le module ne doit pas être pensé comme une simple liste de matériels. Il doit être conçu comme un véritable système de gestion opérationnelle des espaces pratiques.

---

## 2. Objectif métier

Le module Laboratoire permet à l’école de :

- inventorier les équipements ;
- suivre les consommables ;
- planifier les séances pratiques ;
- gérer les réservations de laboratoire ;
- éviter les conflits d’occupation ;
- suivre les incidents ;
- organiser la maintenance ;
- sécuriser l’usage des produits sensibles ;
- produire des rapports d’utilisation ;
- responsabiliser les enseignants et les responsables de laboratoire ;
- améliorer la traçabilité des activités pratiques.

---

## 3. Utilisateurs concernés

Les utilisateurs concernés sont :

- promoteur / fondateur ;
- direction générale ;
- directeur d’établissement ;
- responsable pédagogique ;
- responsable laboratoire ;
- enseignants de sciences ;
- enseignants de technologie ;
- enseignants d’informatique ;
- surveillant général selon les cas ;
- responsable QHSE ;
- responsable maintenance ;
- responsable stock ;
- comptable / financier pour les coûts ;
- élèves en consultation limitée si l’école l’autorise ;
- parents en consultation indirecte via rapports pédagogiques.

---

## 4. Types de laboratoires gérés

Le module doit pouvoir gérer plusieurs types de laboratoires :

- laboratoire de physique ;
- laboratoire de chimie ;
- laboratoire de biologie ;
- laboratoire SVT ;
- laboratoire informatique ;
- laboratoire de robotique ;
- laboratoire de technologie ;
- laboratoire de langues ;
- salle multimédia ;
- atelier technique ;
- espace STEM ;
- laboratoire mobile ;
- laboratoire virtuel.

---

## 5. Onglets recommandés

Structure recommandée du module :

1. Tableau de bord
2. Laboratoires
3. Équipements
4. Consommables
5. Réservations
6. Séances pratiques
7. Maintenance
8. Sécurité & Incidents
9. Stocks & Approvisionnements
10. Rapports & Statistiques
11. Paramètres

---

## 6. Fonctionnalités par onglet

### 6.1 Tableau de bord

Affiche :

- nombre de laboratoires actifs ;
- réservations du jour ;
- séances pratiques prévues ;
- équipements disponibles ;
- équipements en panne ;
- consommables faibles ;
- incidents récents ;
- maintenances prévues ;
- taux d’occupation ;
- alertes critiques.

KPI recommandés :

- taux d’utilisation des laboratoires ;
- taux de disponibilité des équipements ;
- nombre de séances pratiques réalisées ;
- nombre de séances annulées ;
- nombre d’incidents ;
- valeur estimée du matériel ;
- coût de maintenance ;
- niveau de stock critique.

### 6.2 Laboratoires

Permet de créer et gérer les espaces de laboratoire.

Champs principaux :

- nom du laboratoire ;
- type de laboratoire ;
- code interne ;
- bâtiment ;
- étage ;
- capacité maximale ;
- responsable ;
- horaires disponibles ;
- statut ;
- niveau scolaire concerné ;
- matières concernées ;
- règles d’accès ;
- équipements principaux ;
- consignes de sécurité ;
- photos ;
- observations.

Statuts possibles :

- actif ;
- indisponible ;
- en maintenance ;
- fermé temporairement ;
- réservé ;
- archivé.

### 6.3 Équipements

Gère l’inventaire complet des équipements du laboratoire.

Exemples :

- microscopes ;
- balances ;
- tubes à essai ;
- béchers ;
- éprouvettes ;
- ordinateurs ;
- projecteurs ;
- robots éducatifs ;
- kits électroniques ;
- capteurs ;
- générateurs ;
- maquettes ;
- logiciels scientifiques ;
- imprimantes 3D ;
- matériel de sécurité.

Champs principaux :

- nom de l’équipement ;
- catégorie ;
- laboratoire associé ;
- numéro d’inventaire ;
- marque ;
- modèle ;
- quantité ;
- état ;
- date d’acquisition ;
- fournisseur ;
- coût ;
- garantie ;
- responsable ;
- emplacement ;
- disponibilité ;
- photo ;
- fiche technique ;
- historique d’utilisation ;
- historique de maintenance.

États possibles :

- neuf ;
- bon état ;
- état moyen ;
- à réparer ;
- hors service ;
- perdu ;
- remplacé ;
- archivé.

### 6.4 Consommables

Gère les produits et éléments consommables utilisés pendant les séances pratiques.

Exemples :

- réactifs ;
- papiers filtres ;
- gants ;
- masques ;
- pipettes ;
- piles ;
- câbles ;
- composants électroniques ;
- produits de nettoyage ;
- lames ;
- lamelles ;
- cartouches ;
- supports pédagogiques consommables.

Alertes :

- stock faible ;
- rupture ;
- produit expiré ;
- produit dangereux mal classé ;
- consommation anormale ;
- besoin de réapprovisionnement.

### 6.5 Réservations

Permet aux enseignants de réserver un laboratoire pour une séance pratique.

Champs de réservation :

- enseignant ;
- classe ;
- matière ;
- laboratoire ;
- date ;
- heure de début ;
- heure de fin ;
- objectif de la séance ;
- nombre d’élèves ;
- équipements nécessaires ;
- consommables nécessaires ;
- niveau de risque ;
- besoin d’assistance ;
- statut de validation.

Statuts :

- brouillon ;
- soumis ;
- validé ;
- rejeté ;
- annulé ;
- terminé ;
- reporté.

Règles :

- éviter les conflits d’horaires ;
- empêcher la réservation d’un laboratoire indisponible ;
- vérifier la disponibilité du matériel ;
- vérifier les consommables nécessaires ;
- demander validation si séance sensible ;
- notifier le responsable laboratoire.

### 6.6 Séances pratiques

Suit les séances pratiques réellement effectuées.

Données à renseigner :

- classe ;
- matière ;
- enseignant ;
- laboratoire ;
- thème ;
- objectifs ;
- compétences visées ;
- matériel utilisé ;
- consommables utilisés ;
- élèves présents ;
- élèves absents ;
- déroulement ;
- résultats observés ;
- difficultés rencontrées ;
- incidents éventuels ;
- photos si autorisées ;
- rapport de séance ;
- signature enseignant ;
- validation responsable.

Lien avec pédagogie :

- fiche pédagogique ;
- cahier journal ;
- cahier de textes ;
- progression pédagogique ;
- évaluation ;
- devoir ou exercice ;
- rapport parent si l’école l’autorise.

### 6.7 Maintenance

Gère la maintenance préventive et corrective des équipements.

Types de maintenance :

- maintenance préventive ;
- maintenance corrective ;
- contrôle périodique ;
- nettoyage ;
- calibration ;
- remplacement de pièce ;
- mise à jour logicielle ;
- inspection technique.

Statuts :

- planifiée ;
- en cours ;
- terminée ;
- reportée ;
- annulée ;
- critique.

### 6.8 Sécurité & Incidents

Assure la traçabilité des incidents, risques et mesures de sécurité.

Types d’incidents :

- casse de matériel ;
- blessure légère ;
- produit renversé ;
- panne ;
- mauvaise manipulation ;
- non-respect des consignes ;
- incident électrique ;
- perte de matériel ;
- exposition à un produit sensible.

Niveaux de gravité :

- faible ;
- moyen ;
- élevé ;
- critique.

### 6.9 Stocks & Approvisionnements

Fonctionnalités :

- entrée en stock ;
- sortie de stock ;
- consommation par séance ;
- inventaire périodique ;
- ajustement de stock ;
- demande d’achat ;
- validation de demande ;
- réception fournisseur ;
- suivi des coûts ;
- historique.

Workflow d’approvisionnement :

1. Le responsable constate un stock faible.
2. Le système génère une alerte.
3. Une demande d’achat est créée.
4. La direction ou le financier valide.
5. L’achat est effectué.
6. Le stock est mis à jour.
7. L’historique est conservé.

### 6.10 Rapports & Statistiques

Rapports possibles :

- rapport d’occupation des laboratoires ;
- rapport d’utilisation par enseignant ;
- rapport d’utilisation par classe ;
- rapport d’utilisation par matière ;
- rapport d’incidents ;
- rapport de maintenance ;
- rapport de stock ;
- rapport de consommation ;
- rapport financier ;
- rapport annuel des laboratoires.

Statistiques :

- laboratoires les plus utilisés ;
- équipements les plus utilisés ;
- équipements les plus en panne ;
- matières utilisant le plus le laboratoire ;
- classes ayant réalisé le plus de pratiques ;
- coût moyen par séance ;
- taux d’incident ;
- taux de disponibilité.

### 6.11 Paramètres

Paramètres à prévoir :

- types de laboratoires ;
- catégories d’équipements ;
- catégories de consommables ;
- seuils d’alerte ;
- règles de réservation ;
- horaires disponibles ;
- niveaux de danger ;
- niveaux de gravité ;
- workflows de validation ;
- modèles de rapports ;
- permissions ;
- notifications.

---

## 7. UI/UX recommandée

L’interface doit être claire, opérationnelle et visuelle.

Le responsable laboratoire doit voir rapidement :

- ce qui est disponible ;
- ce qui est réservé ;
- ce qui est en panne ;
- ce qui manque ;
- ce qui est dangereux ;
- ce qui demande une action.

Composants UI :

- cartes KPI ;
- calendrier de réservation ;
- tableau d’inventaire ;
- badges d’état ;
- alertes visuelles ;
- fiche équipement ;
- fiche laboratoire ;
- timeline de maintenance ;
- formulaire de séance ;
- rapports exportables ;
- filtres par laboratoire, matière, classe, période.

---

## 8. Frontend

Pages principales :

- /laboratory/dashboard
- /laboratory/labs
- /laboratory/equipments
- /laboratory/consumables
- /laboratory/reservations
- /laboratory/sessions
- /laboratory/maintenance
- /laboratory/incidents
- /laboratory/stocks
- /laboratory/reports
- /laboratory/settings

Composants :

- LaboratoryDashboardCards
- LaboratoryCalendar
- EquipmentTable
- ConsumableStockTable
- ReservationForm
- PracticalSessionForm
- MaintenanceTimeline
- IncidentReportForm
- StockMovementDrawer
- LaboratoryReportBuilder
- SafetyAlertCard

---

## 9. Backend

Services principaux :

- LaboratoryService
- LaboratoryEquipmentService
- LaboratoryConsumableService
- LaboratoryReservationService
- LaboratorySessionService
- LaboratoryMaintenanceService
- LaboratoryIncidentService
- LaboratoryStockService
- LaboratoryReportService
- LaboratoryNotificationService

API principales :

- GET /api/laboratories
- POST /api/laboratories
- GET /api/laboratory-equipments
- POST /api/laboratory-equipments
- GET /api/laboratory-consumables
- POST /api/laboratory-consumables
- POST /api/laboratory-reservations
- PATCH /api/laboratory-reservations/:id/status
- POST /api/laboratory-sessions
- POST /api/laboratory-maintenance
- POST /api/laboratory-incidents
- GET /api/laboratory-reports

---

## 10. Base de données

Tables recommandées :

- laboratories
- laboratory_types
- laboratory_equipments
- laboratory_equipment_categories
- laboratory_consumables
- laboratory_consumable_categories
- laboratory_reservations
- laboratory_reservation_items
- laboratory_sessions
- laboratory_session_attendance
- laboratory_session_materials
- laboratory_maintenance
- laboratory_incidents
- laboratory_stock_movements
- laboratory_purchase_requests
- laboratory_safety_rules
- laboratory_reports
- laboratory_settings

---

## 11. Permissions

Permissions recommandées :

- LABORATORY_VIEW
- LABORATORY_CREATE
- LABORATORY_UPDATE
- LABORATORY_DELETE
- LABORATORY_EQUIPMENT_VIEW
- LABORATORY_EQUIPMENT_MANAGE
- LABORATORY_CONSUMABLE_VIEW
- LABORATORY_CONSUMABLE_MANAGE
- LABORATORY_RESERVATION_CREATE
- LABORATORY_RESERVATION_APPROVE
- LABORATORY_SESSION_CREATE
- LABORATORY_MAINTENANCE_MANAGE
- LABORATORY_INCIDENT_REPORT
- LABORATORY_STOCK_MANAGE
- LABORATORY_REPORT_VIEW
- LABORATORY_SETTINGS_MANAGE

---

## 12. Notifications

Le système doit notifier :

- nouvelle réservation soumise ;
- réservation validée ;
- réservation rejetée ;
- conflit d’horaire ;
- équipement indisponible ;
- consommable en stock faible ;
- produit expiré ;
- maintenance prévue ;
- incident déclaré ;
- demande d’achat validée ;
- séance pratique terminée ;
- rapport disponible.

Canaux possibles :

- notification in-app ;
- email ;
- SMS ;
- WhatsApp ;
- push mobile.

---

## 13. Intégrations

### Avec le module Pédagogie

- lien avec cahier journal ;
- lien avec fiche pédagogique ;
- lien avec cahier de textes ;
- lien avec progression ;
- lien avec séances pratiques ;
- lien avec devoirs et exercices.

### Avec le module Examen

- création d’évaluations pratiques ;
- travaux pratiques notés ;
- barèmes ;
- notes de TP ;
- rapports de compétences.

### Avec le module Élèves

- présence aux séances ;
- participation ;
- incidents élèves ;
- compétences pratiques ;
- historique pédagogique.

### Avec le module Finance

- coût des consommables ;
- coût de maintenance ;
- demandes d’achat ;
- budget laboratoire ;
- fournisseurs.

### Avec le module Communication

- notification enseignants ;
- notification direction ;
- notification parents si incident important ;
- rappels de séances.

### Avec QHSE

- incidents ;
- inspections ;
- conformité ;
- sécurité ;
- plans d’action.

### Avec ORION

ORION peut détecter :

- laboratoire sous-utilisé ;
- équipement trop souvent en panne ;
- consommation anormale ;
- risque de rupture ;
- incidents répétés ;
- séance pratique non réalisée ;
- coût de maintenance élevé ;
- laboratoire saturé.

ORION peut recommander :

- planifier une maintenance ;
- acheter un équipement ;
- réorganiser les réservations ;
- alerter la direction ;
- renforcer les règles de sécurité ;
- contrôler un laboratoire.

### Avec Sara AI

Sara AI peut aider à :

- générer une fiche de TP ;
- proposer une expérience adaptée ;
- créer une liste de matériel ;
- rédiger une consigne de sécurité ;
- générer un rapport de séance ;
- créer un questionnaire post-TP ;
- proposer une grille d’évaluation pratique ;
- simplifier une expérience selon le niveau.

### Avec Atlas Knowledge Base

Atlas peut stocker :

- fiches techniques ;
- protocoles de TP ;
- consignes de sécurité ;
- fiches produits ;
- guides de maintenance ;
- modèles de rapports ;
- procédures d’urgence.

---

## 14. Règles métier

- Un laboratoire indisponible ne peut pas être réservé.
- Une réservation ne doit pas créer de conflit horaire.
- Un équipement en panne ne doit pas être affecté à une séance.
- Les consommables critiques doivent déclencher une alerte.
- Les produits expirés ne doivent pas être utilisés.
- Les incidents doivent être historisés.
- Les maintenances doivent être traçables.
- Les séances pratiques doivent pouvoir être liées au cahier journal ou cahier de textes.
- Les droits d’accès doivent dépendre du rôle utilisateur.
- Les rapports doivent être exportables.
- Les actions sensibles doivent être journalisées.

---

## 15. Conclusion

Le module Laboratoire doit être conçu comme un centre de pilotage des espaces pratiques de l’école.

Il permet de gérer :

1. les laboratoires ;
2. les équipements ;
3. les consommables ;
4. les réservations ;
5. les séances pratiques ;
6. la maintenance ;
7. la sécurité ;
8. les incidents ;
9. les stocks ;
10. les rapports.

C’est un module à forte valeur, surtout pour les établissements qui veulent professionnaliser les sciences, la technologie, l’informatique, les langues et les activités pratiques.
