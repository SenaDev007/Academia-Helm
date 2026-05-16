# Academia Helm — Module Supplémentaire 7 : Boutique scolaire

## 1. Présentation générale

Le module Boutique d’Academia Helm permet de gérer la vente des articles scolaires et services annexes proposés par l’établissement : uniformes, fournitures, manuels, cahiers, badges, tenues de sport, kits pédagogiques, accessoires, articles personnalisés, commandes, paiements, stocks, fournisseurs, remises, livraisons internes et rapports de vente.

Ce module doit être conçu comme un mini système e-commerce interne, connecté au module Élèves, Finance, Stock, Communication, Parent/Élève et ORION Pilotage Direction.

---

## 2. Objectif métier

Le module Boutique permet à l’école de :

- vendre des articles scolaires ;
- gérer les stocks ;
- suivre les commandes ;
- encaisser les paiements ;
- générer des factures et reçus ;
- gérer les remises ;
- informer les parents ;
- suivre les articles obligatoires par niveau ;
- éviter les ruptures ;
- analyser les ventes ;
- contrôler les marges ;
- centraliser les achats scolaires dans un canal officiel.

---

## 3. Utilisateurs concernés

- Promoteur / Fondateur
- Direction générale
- Directeur d’établissement
- Responsable boutique
- Caissier / Comptabilité
- Économe / Responsable stock
- Parents
- Élèves selon permissions
- Enseignants pour demandes pédagogiques
- ORION Pilotage Direction
- Sara AI
- Super Admin plateforme selon permissions

---

## 4. Onglets recommandés

1. Tableau de bord
2. Catalogue articles
3. Articles & variantes
4. Commandes
5. Ventes directes
6. Paiements
7. Stocks boutique
8. Fournisseurs & achats
9. Remises & promotions
10. Kits scolaires
11. Livraisons & retraits
12. Retours & échanges
13. Rapports & statistiques
14. Paramètres

---

## 5. Onglet 1 — Tableau de bord

### Objectif

Afficher une vue globale de l’activité commerciale de la boutique.

### Informations affichées

- chiffre d’affaires du jour ;
- chiffre d’affaires du mois ;
- commandes en attente ;
- commandes payées ;
- commandes non payées ;
- articles en rupture ;
- articles en stock faible ;
- meilleures ventes ;
- ventes par niveau ;
- paiements en attente ;
- retours récents ;
- alertes fournisseurs.

### KPI recommandés

- chiffre d’affaires ;
- marge brute estimée ;
- panier moyen ;
- nombre de commandes ;
- taux de paiement ;
- taux de rupture ;
- articles les plus vendus ;
- ventes par classe ;
- ventes par niveau ;
- taux de retour ;
- valeur du stock.

---

## 6. Onglet 2 — Catalogue articles

### Fonction

Organiser les articles vendus par la boutique.

### Catégories possibles

- uniformes ;
- tenues de sport ;
- fournitures scolaires ;
- cahiers ;
- manuels ;
- livres ;
- badges ;
- sacs ;
- chaussures si applicable ;
- accessoires ;
- kits pédagogiques ;
- documents administratifs ;
- articles événementiels ;
- produits numériques si applicable.

### Champs principaux

- nom de l’article ;
- catégorie ;
- niveau concerné ;
- classe concernée ;
- genre si applicable ;
- taille si applicable ;
- couleur ;
- prix ;
- image ;
- description ;
- statut ;
- disponibilité.

### Actions

- ajouter un article ;
- modifier ;
- désactiver ;
- publier ;
- masquer ;
- dupliquer ;
- exporter ;
- associer à un niveau ;
- associer à un kit.

---

## 7. Onglet 3 — Articles & variantes

### Fonction

Gérer les détails des articles et leurs variantes.

### Exemples de variantes

- taille ;
- couleur ;
- niveau scolaire ;
- classe ;
- genre ;
- édition ;
- format ;
- pack ;
- matière ;
- année scolaire.

### Champs principaux

- article parent ;
- variante ;
- SKU / code interne ;
- code-barres ;
- prix de vente ;
- coût d’achat ;
- marge ;
- stock disponible ;
- seuil d’alerte ;
- image ;
- statut.

### Statuts

- actif ;
- inactif ;
- rupture ;
- bientôt disponible ;
- archivé.

---

## 8. Onglet 4 — Commandes

### Fonction

Gérer les commandes passées par les parents ou créées par l’administration.

### Données

- numéro de commande ;
- parent ;
- élève ;
- classe ;
- articles commandés ;
- quantités ;
- montant total ;
- remise ;
- statut paiement ;
- statut commande ;
- mode de retrait ;
- date ;
- observation.

### Statuts commande

- brouillon ;
- en attente ;
- confirmée ;
- payée ;
- préparée ;
- prête pour retrait ;
- livrée ;
- annulée ;
- remboursée.

### Règles

- une commande peut être liée à un élève ;
- une commande peut contenir plusieurs articles ;
- une commande non payée peut être réservée selon délai défini ;
- une commande payée doit générer un reçu ;
- une commande livrée doit diminuer le stock.

---

## 9. Onglet 5 — Ventes directes

### Fonction

Permettre à la boutique d’effectuer une vente rapide au comptoir.

### Données

- client ;
- élève lié si applicable ;
- articles ;
- quantités ;
- remise ;
- montant total ;
- mode de paiement ;
- reçu ;
- caissier ;
- date.

### Fonctionnalités

- scan code-barres ;
- recherche rapide article ;
- ajout panier ;
- remise autorisée ;
- paiement immédiat ;
- impression reçu ;
- envoi reçu parent ;
- mise à jour stock.

---

## 10. Onglet 6 — Paiements

### Fonction

Suivre les paiements liés aux commandes et ventes.

### Données

- commande ;
- parent ;
- élève ;
- montant ;
- statut ;
- mode de paiement ;
- référence transaction ;
- reçu ;
- date ;
- caissier ;
- observation.

### Statuts

- payé ;
- partiellement payé ;
- impayé ;
- en attente ;
- annulé ;
- remboursé ;
- échoué.

### Modes de paiement

- espèces ;
- mobile money ;
- carte bancaire ;
- virement ;
- paiement en ligne ;
- avoir ;
- prise en charge.

### Intégration Finance

Tous les paiements boutique doivent remonter automatiquement dans le module Finance pour la comptabilité, les reçus, les rapports d’encaissement et le rapprochement.

---

## 11. Onglet 7 — Stocks boutique

### Fonction

Gérer les stocks des articles vendus.

### Données

- article ;
- variante ;
- stock initial ;
- entrées ;
- sorties ;
- stock disponible ;
- stock réservé ;
- seuil d’alerte ;
- emplacement ;
- date dernière entrée ;
- date dernier mouvement ;
- statut.

### Types de mouvements

- entrée stock ;
- vente ;
- retour ;
- échange ;
- ajustement ;
- perte ;
- article abîmé ;
- transfert ;
- inventaire.

### Alertes

- stock faible ;
- rupture ;
- surstock ;
- article dormant ;
- écart inventaire ;
- forte demande.

---

## 12. Onglet 8 — Fournisseurs & achats

### Fonction

Gérer les fournisseurs et les approvisionnements.

### Données fournisseur

- nom ;
- contact ;
- téléphone ;
- email ;
- adresse ;
- articles fournis ;
- délai de livraison ;
- conditions de paiement ;
- qualité ;
- historique ;
- statut.

### Fonctionnalités

- demande d’achat ;
- bon de commande ;
- réception ;
- contrôle quantité ;
- contrôle qualité ;
- facture fournisseur ;
- paiement fournisseur ;
- comparaison des prix ;
- historique des achats.

---

## 13. Onglet 9 — Remises & promotions

### Fonction

Gérer les remises commerciales et promotions internes.

### Types de remises

- remise individuelle ;
- remise fratrie ;
- remise personnel ;
- remise exceptionnelle ;
- promotion rentrée scolaire ;
- promotion pack ;
- coupon ;
- avoir ;
- prise en charge.

### Données

- nom ;
- type ;
- montant ou pourcentage ;
- articles concernés ;
- période ;
- conditions ;
- approbateur ;
- statut.

### Règle importante

Les remises sensibles doivent être contrôlées par permissions et journalisées pour éviter les abus.

---

## 14. Onglet 10 — Kits scolaires

### Fonction

Créer des packs d’articles obligatoires ou recommandés par niveau, classe ou filière.

### Exemples

- kit rentrée maternelle ;
- kit rentrée primaire ;
- kit CI ;
- kit CM2 ;
- kit 6ème ;
- kit secondaire ;
- kit sport ;
- kit bilingue ;
- kit examen ;
- kit laboratoire.

### Données

- nom du kit ;
- niveau ;
- classe ;
- articles inclus ;
- quantités ;
- prix total ;
- remise pack ;
- caractère obligatoire ou recommandé ;
- période ;
- statut.

### Intégration Parent

Le parent peut voir les kits recommandés ou obligatoires pour son enfant et commander directement depuis son portail.

---

## 15. Onglet 11 — Livraisons & retraits

### Fonction

Gérer la remise des articles aux parents ou élèves.

### Modes

- retrait à la boutique ;
- retrait par parent ;
- retrait par élève autorisé ;
- livraison interne en classe ;
- livraison événementielle ;
- retrait groupé.

### Données

- commande ;
- bénéficiaire ;
- personne ayant retiré ;
- pièce ou signature si nécessaire ;
- date ;
- statut ;
- observation.

### Statuts

- à préparer ;
- prêt ;
- retiré ;
- livré ;
- partiellement livré ;
- non retiré ;
- annulé.

---

## 16. Onglet 12 — Retours & échanges

### Fonction

Gérer les retours, échanges et remboursements.

### Motifs

- mauvaise taille ;
- article défectueux ;
- erreur de commande ;
- article abîmé ;
- doublon ;
- annulation ;
- autre.

### Données

- commande ;
- article ;
- motif ;
- état de l’article ;
- décision ;
- remboursement ;
- échange ;
- avoir ;
- responsable ;
- statut.

### Statuts

- demandé ;
- accepté ;
- refusé ;
- échangé ;
- remboursé ;
- avoir émis ;
- clôturé.

---

## 17. Onglet 13 — Rapports & statistiques

### Rapports possibles

- rapport journalier des ventes ;
- rapport mensuel ;
- rapport par article ;
- rapport par catégorie ;
- rapport par niveau ;
- rapport par classe ;
- rapport des paiements ;
- rapport des impayés ;
- rapport de stock ;
- rapport des ruptures ;
- rapport fournisseur ;
- rapport des remises ;
- rapport annuel boutique.

### Statistiques

- chiffre d’affaires ;
- marge brute ;
- panier moyen ;
- ventes par article ;
- ventes par niveau ;
- ventes par période ;
- articles dormants ;
- taux de rupture ;
- taux de retour ;
- stock valorisé ;
- commandes non retirées.

---

## 18. Onglet 14 — Paramètres

Paramètres à prévoir :

- catégories d’articles ;
- types de variantes ;
- tailles ;
- couleurs ;
- niveaux scolaires ;
- classes ;
- règles de stock ;
- règles de commande ;
- règles de réservation ;
- règles de remise ;
- règles de retour ;
- modes de paiement ;
- modèles de reçus ;
- modèles de factures ;
- règles de notification ;
- permissions.

---

## 19. UI/UX recommandée

Le module Boutique doit être rapide, commercial et orienté caisse.

### Composants UI

- ShopDashboardCards
- ProductCatalogGrid
- ProductVariantTable
- OrderManagementTable
- QuickSalePOS
- PaymentStatusBadge
- StockAlertPanel
- SupplierPurchaseTable
- DiscountRuleBuilder
- SchoolKitBuilder
- PickupDeliveryPanel
- ReturnExchangeModal
- ShopReportBuilder

### Expérience responsable boutique

Le responsable boutique doit pouvoir :

- vendre rapidement ;
- scanner un article ;
- consulter le stock ;
- préparer une commande ;
- valider un retrait ;
- suivre les paiements ;
- générer un rapport.

### Expérience parent

Le parent doit pouvoir :

- voir les articles liés à son enfant ;
- consulter les kits obligatoires ;
- commander ;
- payer ;
- suivre le statut ;
- recevoir un reçu ;
- être notifié quand la commande est prête.

---

## 20. Frontend

Pages principales :

- /shop/dashboard
- /shop/catalog
- /shop/products
- /shop/orders
- /shop/pos
- /shop/payments
- /shop/stocks
- /shop/suppliers
- /shop/discounts
- /shop/kits
- /shop/pickups
- /shop/returns
- /shop/reports
- /shop/settings

---

## 21. Backend

Services principaux :

- ShopService
- ShopCatalogService
- ShopProductService
- ShopVariantService
- ShopOrderService
- ShopPOSService
- ShopPaymentService
- ShopStockService
- ShopSupplierService
- ShopDiscountService
- SchoolKitService
- ShopDeliveryService
- ShopReturnService
- ShopReportService
- ShopNotificationService

API principales :

- GET /api/shop/dashboard
- GET /api/shop/catalog
- POST /api/shop/products
- GET /api/shop/products
- POST /api/shop/orders
- GET /api/shop/orders
- POST /api/shop/pos/sales
- GET /api/shop/payments
- POST /api/shop/payments
- GET /api/shop/stocks
- POST /api/shop/stocks/movements
- GET /api/shop/suppliers
- POST /api/shop/suppliers
- GET /api/shop/discounts
- POST /api/shop/discounts
- GET /api/shop/kits
- POST /api/shop/kits
- POST /api/shop/pickups
- POST /api/shop/returns
- GET /api/shop/reports

---

## 22. Base de données

Tables recommandées :

- shop_categories
- shop_products
- shop_product_variants
- shop_product_images
- shop_orders
- shop_order_items
- shop_sales
- shop_sale_items
- shop_payments
- shop_stock_items
- shop_stock_movements
- shop_suppliers
- shop_purchase_orders
- shop_purchase_order_items
- shop_discounts
- shop_discount_rules
- shop_school_kits
- shop_school_kit_items
- shop_pickups_deliveries
- shop_returns
- shop_return_items
- shop_notifications
- shop_reports
- shop_settings

---

## 23. Permissions

Permissions recommandées :

- SHOP_VIEW
- SHOP_DASHBOARD_VIEW
- SHOP_CATALOG_VIEW
- SHOP_PRODUCT_CREATE
- SHOP_PRODUCT_UPDATE
- SHOP_PRODUCT_DELETE
- SHOP_ORDER_MANAGE
- SHOP_POS_SELL
- SHOP_PAYMENT_VIEW
- SHOP_PAYMENT_MANAGE
- SHOP_STOCK_MANAGE
- SHOP_SUPPLIER_MANAGE
- SHOP_DISCOUNT_MANAGE
- SHOP_KIT_MANAGE
- SHOP_PICKUP_VALIDATE
- SHOP_RETURN_MANAGE
- SHOP_REPORT_VIEW
- SHOP_SETTINGS_MANAGE

---

## 24. Notifications

Notifications possibles :

- commande créée ;
- commande confirmée ;
- paiement reçu ;
- paiement échoué ;
- commande prête ;
- commande retirée ;
- article en rupture ;
- stock faible ;
- retour accepté ;
- remboursement effectué ;
- kit scolaire disponible ;
- reçu disponible.

Canaux :

- in-app ;
- email ;
- SMS ;
- WhatsApp ;
- push mobile.

---

## 25. Intégrations

### Avec le module Élèves

- association commande-élève ;
- articles recommandés par niveau ;
- kits par classe ;
- historique des achats par élève.

### Avec le module Finance

- encaissements ;
- factures ;
- reçus ;
- remboursements ;
- remises ;
- rapports de caisse ;
- rapprochement comptable.

### Avec le module Communication

- notifications parents ;
- rappels de commande ;
- alertes stock ;
- annonces de kits disponibles.

### Avec le module Bibliothèque

- vente de manuels ;
- remplacement de livres perdus ;
- pénalités converties en achat/remplacement ;
- ressources pédagogiques imprimées.

### Avec ORION

ORION peut détecter :

- articles les plus demandés ;
- risque de rupture ;
- surstock ;
- articles dormants ;
- baisse des ventes ;
- commandes non retirées ;
- remises anormales ;
- écarts de stock ;
- marge insuffisante ;
- forte demande par niveau.

ORION peut recommander :

- réapprovisionner un article ;
- ajuster les quantités ;
- créer un kit ;
- alerter la direction ;
- analyser les marges ;
- bloquer une remise suspecte ;
- relancer les parents ;
- préparer un rapport de rentrée.

### Avec Sara AI

Sara AI peut aider à :

- rédiger une annonce de disponibilité ;
- générer une description produit ;
- proposer un kit scolaire ;
- analyser les ventes ;
- produire un rapport synthétique ;
- créer un message de relance ;
- suggérer des promotions ;
- classer les articles automatiquement.

### Avec Atlas Knowledge Base

Atlas peut stocker :

- catalogues produits ;
- règles de vente ;
- modèles de reçus ;
- politiques de retour ;
- descriptions produits ;
- guides de tailles ;
- procédures de caisse ;
- modèles de rapports.

---

## 26. Règles métier

- Un article en rupture ne doit pas être vendu sauf autorisation spéciale.
- Une commande payée doit générer un reçu.
- Une vente doit diminuer le stock.
- Un retour accepté doit créer un mouvement de stock.
- Une remise sensible doit être journalisée.
- Une commande liée à un élève doit respecter son niveau et sa classe.
- Un kit scolaire peut être obligatoire ou recommandé.
- Les paiements doivent être synchronisés avec Finance.
- Les parents ne voient que les commandes liées à leurs enfants.
- Les actions de caisse doivent être historisées.
- Les rapports doivent être exportables.
- Les écarts de stock doivent déclencher une alerte.

---

## 27. Conclusion

Le module Boutique permet à Academia Helm de gérer toute la chaîne commerciale scolaire :

1. catalogue ;
2. articles ;
3. variantes ;
4. commandes ;
5. ventes directes ;
6. paiements ;
7. stocks ;
8. fournisseurs ;
9. remises ;
10. kits scolaires ;
11. retraits ;
12. retours ;
13. rapports.

Ce module transforme la boutique scolaire en un véritable point de vente numérique, connecté à la finance, aux élèves, aux parents et à la direction.
