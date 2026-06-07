# Academia Helm — Module Supplémentaire 3 : Cantine

## 1. Présentation générale

Le module Cantine d’Academia Helm permet de gérer les repas scolaires, les menus, les inscriptions des élèves, les régimes alimentaires, les présences à la cantine, les paiements, les stocks alimentaires, les fournisseurs, les rapports de fréquentation et les alertes sanitaires.

Ce module doit être conçu comme un système complet de gestion de restauration scolaire, avec une logique de nutrition, de traçabilité, de paiement intégré, de sécurité alimentaire et de communication avec les parents.

---

## 2. Objectif métier

Le module Cantine permet à l’école de :

- organiser les menus ;
- inscrire les élèves à la cantine ;
- suivre les repas servis ;
- gérer les régimes alimentaires ;
- contrôler les présences ;
- suivre les paiements ;
- gérer les stocks alimentaires ;
- suivre les fournisseurs ;
- éviter le gaspillage ;
- produire des rapports ;
- informer les parents ;
- garantir une meilleure sécurité alimentaire.

---

## 3. Utilisateurs concernés

- Promoteur / Fondateur
- Direction générale
- Directeur d’établissement
- Responsable cantine
- Personnel de cuisine
- Économe / Responsable stock
- Comptabilité / Finance
- Parents
- Élèves en consultation limitée
- Responsable QHSE
- ORION Pilotage Direction
- Sara AI

---

## 4. Onglets recommandés

1. Tableau de bord
2. Menus
3. Inscriptions cantine
4. Élèves inscrits
5. Présences & repas servis
6. Régimes alimentaires & allergies
7. Paiements cantine
8. Stocks alimentaires
9. Fournisseurs & achats
10. Incidents & hygiène
11. Rapports & statistiques
12. Paramètres

---

## 5. Onglet 1 — Tableau de bord

### Objectif

Afficher une vue globale de l’activité cantine.

### Informations affichées

- nombre d’élèves inscrits ;
- repas prévus aujourd’hui ;
- repas servis ;
- absents cantine ;
- paiements en attente ;
- menus de la semaine ;
- stocks faibles ;
- allergies signalées ;
- incidents récents ;
- alertes hygiène ;
- coût moyen par repas.

### KPI recommandés

- taux de fréquentation ;
- taux de paiement ;
- coût moyen par repas ;
- taux de gaspillage estimé ;
- nombre de repas servis ;
- nombre de repas non consommés ;
- stock critique ;
- incidents alimentaires ;
- satisfaction parent si activée.

---

## 6. Onglet 2 — Menus

### Fonction

Créer, planifier et publier les menus de la cantine.

### Types de menus

- menu journalier ;
- menu hebdomadaire ;
- menu mensuel ;
- menu spécial ;
- menu maternelle ;
- menu primaire ;
- menu secondaire ;
- menu végétarien ;
- menu adapté aux allergies ;
- menu événementiel.

### Champs principaux

- date ;
- période ;
- niveau scolaire ;
- plat principal ;
- accompagnement ;
- entrée ;
- dessert ;
- boisson ;
- valeur nutritionnelle ;
- allergènes ;
- coût estimé ;
- statut ;
- observation ;
- image du menu si nécessaire.

### Statuts

- brouillon ;
- publié ;
- modifié ;
- annulé ;
- archivé.

### Actions

- créer un menu ;
- dupliquer un menu ;
- publier aux parents ;
- modifier ;
- annuler ;
- exporter ;
- imprimer ;
- générer avec Sara AI.

---

## 7. Onglet 3 — Inscriptions cantine

### Fonction

Gérer les demandes d’inscription à la cantine.

### Données d’inscription

- élève ;
- classe ;
- parent responsable ;
- période d’inscription ;
- type d’abonnement ;
- jours concernés ;
- régime alimentaire ;
- allergies ;
- autorisations ;
- statut de validation ;
- statut paiement ;
- observations.

### Types d’abonnement

- journalier ;
- hebdomadaire ;
- mensuel ;
- trimestriel ;
- annuel ;
- jours fixes ;
- repas occasionnel ;
- repas exceptionnel.

### Statuts

- en attente ;
- validé ;
- rejeté ;
- suspendu ;
- expiré ;
- annulé.

---

## 8. Onglet 4 — Élèves inscrits

### Fonction

Afficher et gérer la liste des élèves bénéficiant du service cantine.

### Informations affichées

- nom de l’élève ;
- classe ;
- niveau ;
- parent ;
- abonnement ;
- jours actifs ;
- statut paiement ;
- régime ;
- allergie ;
- statut cantine ;
- historique.

### Filtres

- niveau ;
- classe ;
- type d’abonnement ;
- statut paiement ;
- régime alimentaire ;
- allergie ;
- période ;
- statut actif/inactif.

---

## 9. Onglet 5 — Présences & repas servis

### Fonction

Contrôler les élèves présents à la cantine et les repas réellement servis.

### Statuts possibles

- présent ;
- absent ;
- repas servi ;
- repas non servi ;
- repas refusé ;
- repas spécial servi ;
- absent justifié ;
- absent non justifié.

### Méthodes de pointage

- pointage manuel ;
- QR code élève ;
- badge ;
- tablette cantine ;
- import depuis présence scolaire ;
- validation par classe.

### Données suivies

- élève ;
- date ;
- menu ;
- repas servi ;
- heure de service ;
- responsable ;
- observation ;
- incident éventuel.

---

## 10. Onglet 6 — Régimes alimentaires & allergies

### Fonction

Centraliser les informations sensibles liées à l’alimentation des élèves.

### Données

- élève ;
- allergie ;
- niveau de gravité ;
- aliments interdits ;
- régime particulier ;
- consignes parentales ;
- document médical si fourni ;
- contact d’urgence ;
- statut ;
- date de mise à jour.

### Types de régimes

- standard ;
- végétarien ;
- sans porc ;
- sans arachide ;
- sans lactose ;
- sans gluten ;
- diabétique ;
- médicalisé ;
- personnalisé.

### Alertes

- élève allergique prévu au repas ;
- menu contenant un allergène ;
- information médicale expirée ;
- absence de consigne parentale ;
- régime non compatible avec le menu du jour.

---

## 11. Onglet 7 — Paiements cantine

### Fonction

Gérer les frais liés à la cantine.

### Données

- élève ;
- abonnement ;
- période ;
- montant ;
- remise ;
- pénalité éventuelle ;
- statut paiement ;
- facture ;
- reçu ;
- historique ;
- mode de paiement.

### Statuts

- payé ;
- partiellement payé ;
- impayé ;
- en retard ;
- exonéré ;
- annulé ;
- remboursé.

### Intégration finance

Les paiements cantine doivent être reliés au module financier afin d’éviter les doubles saisies.

---

## 12. Onglet 8 — Stocks alimentaires

### Fonction

Gérer les stocks de denrées et consommables de cuisine.

### Exemples de stocks

- riz ;
- pâtes ;
- légumes ;
- fruits ;
- viande ;
- poisson ;
- huile ;
- condiments ;
- eau ;
- jus ;
- produits laitiers ;
- emballages ;
- serviettes ;
- produits de nettoyage.

### Champs principaux

- produit ;
- catégorie ;
- quantité ;
- unité ;
- seuil d’alerte ;
- date d’entrée ;
- date d’expiration ;
- fournisseur ;
- coût unitaire ;
- emplacement ;
- statut.

### Alertes

- stock faible ;
- rupture ;
- produit expiré ;
- produit proche expiration ;
- consommation anormale ;
- coût anormal ;
- produit non conforme.

---

## 13. Onglet 9 — Fournisseurs & achats

### Fonction

Gérer les fournisseurs, les commandes et les achats de la cantine.

### Données fournisseur

- nom ;
- contact ;
- téléphone ;
- email ;
- adresse ;
- produits fournis ;
- conditions de paiement ;
- qualité ;
- historique ;
- statut.

### Fonctionnalités

- demande d’achat ;
- bon de commande ;
- réception ;
- contrôle qualité ;
- facture fournisseur ;
- paiement fournisseur ;
- historique des achats ;
- comparaison des prix.

---

## 14. Onglet 10 — Incidents & hygiène

### Fonction

Suivre les incidents alimentaires, sanitaires et opérationnels.

### Types d’incidents

- repas non conforme ;
- allergie signalée ;
- malaise après repas ;
- rupture de stock ;
- retard de service ;
- problème d’hygiène ;
- produit expiré ;
- erreur de régime ;
- plainte parent ;
- gaspillage excessif ;
- panne équipement cuisine.

### Champs incident

- date ;
- élève concerné si applicable ;
- type ;
- gravité ;
- description ;
- action immédiate ;
- responsable informé ;
- parent informé ;
- mesure corrective ;
- statut ;
- pièce jointe.

### Niveaux de gravité

- faible ;
- moyen ;
- élevé ;
- critique.

---

## 15. Onglet 11 — Rapports & statistiques

### Rapports possibles

- rapport journalier des repas ;
- rapport hebdomadaire ;
- rapport mensuel ;
- rapport de fréquentation ;
- rapport des paiements ;
- rapport des impayés ;
- rapport de stock ;
- rapport de consommation ;
- rapport des incidents ;
- rapport fournisseur ;
- rapport de coût ;
- rapport annuel cantine.

### Statistiques

- repas servis par jour ;
- repas servis par niveau ;
- fréquentation par classe ;
- taux d’impayés ;
- coût moyen par repas ;
- menus les plus consommés ;
- gaspillage estimé ;
- incidents par période ;
- allergies par niveau ;
- consommation par produit.

---

## 16. Onglet 12 — Paramètres

Paramètres à prévoir :

- types d’abonnements ;
- tarifs ;
- jours de service ;
- horaires ;
- types de menus ;
- catégories alimentaires ;
- régimes alimentaires ;
- allergènes ;
- seuils de stock ;
- règles de paiement ;
- règles de notification ;
- modèles de menus ;
- workflows de validation ;
- permissions.

---

## 17. UI/UX recommandée

Le module Cantine doit être simple, visuel et rapide.

### Composants UI

- cartes KPI ;
- calendrier des menus ;
- liste des élèves inscrits ;
- tableau de pointage ;
- badges allergie ;
- alertes stock ;
- fiche menu ;
- fiche élève cantine ;
- fiche fournisseur ;
- tableau des paiements ;
- rapport exportable.

### Expérience parent

Le parent doit pouvoir consulter :

- menu du jour ;
- menu de la semaine ;
- statut d’inscription de l’enfant ;
- paiements cantine ;
- allergies/régimes enregistrés ;
- notifications importantes ;
- historique des repas si l’école l’autorise.

---

## 18. Frontend

Pages principales :

- /canteen/dashboard
- /canteen/menus
- /canteen/enrollments
- /canteen/students
- /canteen/attendance
- /canteen/diets-allergies
- /canteen/payments
- /canteen/stocks
- /canteen/suppliers
- /canteen/incidents
- /canteen/reports
- /canteen/settings

Composants :

- CanteenDashboardCards
- MenuCalendar
- MenuForm
- CanteenEnrollmentForm
- CanteenStudentTable
- MealAttendanceTable
- AllergyAlertBadge
- DietProfileCard
- CanteenPaymentTable
- FoodStockTable
- SupplierTable
- CanteenIncidentForm
- CanteenReportBuilder

---

## 19. Backend

Services principaux :

- CanteenService
- MenuService
- CanteenEnrollmentService
- CanteenStudentService
- MealAttendanceService
- DietAllergyService
- CanteenPaymentService
- FoodStockService
- CanteenSupplierService
- CanteenIncidentService
- CanteenReportService
- CanteenNotificationService

API principales :

- GET /api/canteen/dashboard
- GET /api/canteen/menus
- POST /api/canteen/menus
- GET /api/canteen/enrollments
- POST /api/canteen/enrollments
- GET /api/canteen/students
- POST /api/canteen/attendance
- GET /api/canteen/diets-allergies
- POST /api/canteen/diets-allergies
- GET /api/canteen/payments
- GET /api/canteen/stocks
- POST /api/canteen/stocks
- POST /api/canteen/incidents
- GET /api/canteen/reports

---

## 20. Base de données

Tables recommandées :

- canteen_menus
- canteen_menu_items
- canteen_enrollments
- canteen_students
- canteen_subscriptions
- canteen_attendance
- canteen_meal_services
- canteen_diets
- canteen_allergies
- canteen_student_allergies
- canteen_payments
- canteen_food_stocks
- canteen_stock_movements
- canteen_suppliers
- canteen_purchase_orders
- canteen_incidents
- canteen_reports
- canteen_settings

---

## 21. Permissions

Permissions recommandées :

- CANTEEN_VIEW
- CANTEEN_DASHBOARD_VIEW
- CANTEEN_MENU_CREATE
- CANTEEN_MENU_UPDATE
- CANTEEN_MENU_DELETE
- CANTEEN_ENROLLMENT_MANAGE
- CANTEEN_STUDENT_VIEW
- CANTEEN_ATTENDANCE_MARK
- CANTEEN_DIET_ALLERGY_MANAGE
- CANTEEN_PAYMENT_VIEW
- CANTEEN_STOCK_MANAGE
- CANTEEN_SUPPLIER_MANAGE
- CANTEEN_INCIDENT_REPORT
- CANTEEN_REPORT_VIEW
- CANTEEN_SETTINGS_MANAGE

---

## 22. Notifications

Notifications possibles :

- menu publié ;
- menu modifié ;
- inscription cantine validée ;
- paiement cantine en retard ;
- stock faible ;
- produit expiré ;
- allergie détectée dans un menu ;
- incident déclaré ;
- repas spécial prévu ;
- absence cantine répétée.

Canaux :

- in-app ;
- email ;
- SMS ;
- WhatsApp ;
- push mobile.

---

## 23. Intégrations

### Avec le module Élèves

- inscription cantine ;
- classe ;
- niveau ;
- allergies ;
- régime ;
- historique de présence cantine.

### Avec le module Finance

- frais de cantine ;
- paiements ;
- factures ;
- reçus ;
- impayés ;
- remises ;
- remboursements.

### Avec le module Communication

- publication des menus ;
- notifications parents ;
- alertes allergie ;
- messages d’incident ;
- rappels de paiement.

### Avec le module QHSE

- hygiène ;
- incidents alimentaires ;
- conformité ;
- plans d’action ;
- inspections ;
- risques sanitaires.

### Avec ORION

ORION peut détecter :

- impayés fréquents ;
- stock critique ;
- consommation anormale ;
- gaspillage élevé ;
- incident alimentaire répété ;
- menu peu consommé ;
- coût moyen trop élevé ;
- fournisseur problématique ;
- élève avec absence cantine répétée ;
- risque allergène.

ORION peut recommander :

- ajuster les quantités ;
- alerter la direction ;
- notifier les parents ;
- changer un fournisseur ;
- revoir un menu ;
- planifier un contrôle QHSE ;
- créer une demande d’achat ;
- analyser les coûts.

### Avec Sara AI

Sara AI peut aider à :

- générer un menu hebdomadaire équilibré ;
- rédiger un message aux parents ;
- proposer des menus par niveau ;
- analyser un rapport de consommation ;
- créer une note d’hygiène ;
- reformuler une alerte allergie ;
- produire une synthèse mensuelle ;
- suggérer des menus économiques.

### Avec Atlas Knowledge Base

Atlas peut stocker :

- menus types ;
- procédures d’hygiène ;
- fiches allergènes ;
- contrats fournisseurs ;
- modèles de messages ;
- règles de sécurité alimentaire ;
- guides de stockage ;
- procédures d’urgence.

---

## 24. Règles métier

- Un élève non inscrit ne doit pas apparaître automatiquement dans la liste de service.
- Un élève avec allergie doit déclencher une alerte si le menu contient l’allergène.
- Un produit expiré ne doit pas être utilisé.
- Les paiements cantine doivent être reliés au module financier.
- Les stocks doivent diminuer selon les repas servis ou les sorties validées.
- Les menus publiés doivent être visibles par les parents si l’école l’autorise.
- Les incidents alimentaires doivent être historisés.
- Les informations médicales doivent être protégées par permissions strictes.
- Les régimes alimentaires doivent être visibles uniquement aux utilisateurs autorisés.
- Les rapports doivent être exportables.
- Les actions sensibles doivent être journalisées.

---

## 25. Conclusion

Le module Cantine permet à Academia Helm de gérer toute la chaîne de restauration scolaire :

1. menus ;
2. inscriptions ;
3. élèves inscrits ;
4. présences ;
5. repas servis ;
6. régimes et allergies ;
7. paiements ;
8. stocks ;
9. fournisseurs ;
10. incidents ;
11. rapports.

C’est un module très important pour les écoles privées, car il renforce la confiance parentale, professionnalise la restauration scolaire et permet une meilleure maîtrise financière.
