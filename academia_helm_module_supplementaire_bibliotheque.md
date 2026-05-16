# Academia Helm — Module Supplémentaire 6 : Bibliothèque

## 1. Présentation générale

Le module Bibliothèque d’Academia Helm permet de gérer l’ensemble des ressources documentaires de l’établissement : livres physiques, manuels scolaires, documents numériques, emprunts, retours, réservations, pénalités, inventaire, catalogage, abonnements, statistiques de lecture et recommandations pédagogiques.

Ce module doit être conçu comme un véritable centre de ressources pédagogiques, accessible selon les droits des élèves, enseignants, bibliothécaires, parents et membres de l’administration.

---

## 2. Objectif métier

Le module Bibliothèque permet à l’école de :

- centraliser le catalogue des livres et ressources ;
- gérer les emprunts et retours ;
- suivre les livres disponibles, perdus ou abîmés ;
- organiser les réservations ;
- gérer les pénalités ;
- suivre les lecteurs actifs ;
- produire des rapports ;
- valoriser la lecture ;
- soutenir la pédagogie ;
- proposer des recommandations adaptées aux niveaux scolaires ;
- améliorer la traçabilité du patrimoine documentaire.

---

## 3. Utilisateurs concernés

- Promoteur / Fondateur
- Direction générale
- Directeur d’établissement
- Bibliothécaire
- Enseignants
- Élèves
- Parents selon permissions
- Responsable pédagogique
- Comptabilité / Finance pour pénalités
- ORION Pilotage Direction
- Sara AI
- Atlas Knowledge Base
- Super Admin plateforme selon permissions

---

## 4. Onglets recommandés

1. Tableau de bord
2. Catalogue
3. Livres & ressources
4. Emprunts
5. Retours
6. Réservations
7. Lecteurs
8. Inventaire
9. Pénalités & pertes
10. Ressources numériques
11. Recommandations pédagogiques
12. Rapports & statistiques
13. Paramètres

---

## 5. Onglet 1 — Tableau de bord

### Objectif

Afficher une vue globale de l’activité de la bibliothèque.

### Informations affichées

- nombre total de livres ;
- livres disponibles ;
- livres empruntés ;
- livres en retard ;
- livres perdus ;
- livres abîmés ;
- réservations en attente ;
- lecteurs actifs ;
- top livres consultés ;
- alertes inventaire ;
- pénalités en attente ;
- nouveautés.

### KPI recommandés

- taux d’emprunt ;
- taux de retour à temps ;
- nombre d’emprunts par période ;
- nombre de lecteurs actifs ;
- livres les plus empruntés ;
- classes les plus actives ;
- taux de perte ;
- taux de dégradation ;
- valeur estimée du stock documentaire ;
- taux d’utilisation des ressources numériques.

---

## 6. Onglet 2 — Catalogue

### Fonction

Organiser les ressources documentaires par catégories, matières, niveaux et types.

### Catégories possibles

- manuels scolaires ;
- littérature ;
- sciences ;
- mathématiques ;
- langues ;
- histoire-géographie ;
- culture générale ;
- religion / éthique selon l’école ;
- bandes dessinées ;
- encyclopédies ;
- dictionnaires ;
- annales ;
- documents pédagogiques ;
- ressources numériques ;
- archives scolaires.

### Champs principaux

- titre ;
- auteur ;
- catégorie ;
- matière ;
- niveau scolaire ;
- classe recommandée ;
- langue ;
- type de ressource ;
- ISBN si disponible ;
- éditeur ;
- année d’édition ;
- mots-clés ;
- résumé ;
- disponibilité ;
- couverture ;
- emplacement.

### Actions

- rechercher ;
- filtrer ;
- consulter ;
- réserver ;
- ajouter aux favoris ;
- recommander ;
- exporter ;
- imprimer une fiche catalogue.

---

## 7. Onglet 3 — Livres & ressources

### Fonction

Gérer les exemplaires physiques et les ressources documentaires.

### Types de ressources

- livre physique ;
- manuel scolaire ;
- fascicule ;
- document pédagogique ;
- annale ;
- revue ;
- magazine ;
- dictionnaire ;
- encyclopédie ;
- document PDF ;
- audio éducatif ;
- vidéo pédagogique ;
- lien externe ;
- archive.

### Champs principaux

- code interne ;
- titre ;
- auteur ;
- catégorie ;
- type ;
- niveau ;
- classe ;
- matière ;
- langue ;
- nombre d’exemplaires ;
- exemplaires disponibles ;
- état ;
- emplacement ;
- date d’acquisition ;
- prix d’achat ;
- fournisseur ;
- statut.

### États possibles

- neuf ;
- bon ;
- moyen ;
- abîmé ;
- inutilisable ;
- perdu.

### Statuts

- disponible ;
- emprunté ;
- réservé ;
- en réparation ;
- perdu ;
- archivé.

---

## 8. Onglet 4 — Emprunts

### Fonction

Enregistrer et suivre les emprunts de livres ou ressources.

### Données

- lecteur ;
- type de lecteur ;
- classe ou fonction ;
- livre ;
- exemplaire ;
- date d’emprunt ;
- date prévue de retour ;
- responsable de validation ;
- statut ;
- observation.

### Types de lecteurs

- élève ;
- enseignant ;
- personnel administratif ;
- direction ;
- autre selon autorisation.

### Statuts

- actif ;
- en retard ;
- retourné ;
- prolongé ;
- perdu ;
- annulé.

### Règles

- vérifier la disponibilité avant emprunt ;
- bloquer l’emprunt si le lecteur a trop de retards ;
- bloquer ou alerter en cas de pénalité non réglée ;
- définir une durée maximale selon le type de lecteur ;
- journaliser chaque opération.

---

## 9. Onglet 5 — Retours

### Fonction

Gérer les retours de livres et contrôler l’état des ressources retournées.

### Données

- emprunt ;
- lecteur ;
- livre ;
- date réelle de retour ;
- état au retour ;
- retard ;
- pénalité éventuelle ;
- observation ;
- validation du bibliothécaire.

### États au retour

- conforme ;
- légèrement abîmé ;
- abîmé ;
- inutilisable ;
- perdu.

### Actions

- valider retour ;
- appliquer pénalité ;
- signaler livre abîmé ;
- marquer comme perdu ;
- générer reçu de retour ;
- notifier parent si élève concerné.

---

## 10. Onglet 6 — Réservations

### Fonction

Permettre aux lecteurs de réserver des livres ou ressources.

### Données

- lecteur ;
- livre ;
- date de réservation ;
- date limite de retrait ;
- priorité ;
- statut ;
- notification envoyée ;
- observation.

### Statuts

- en attente ;
- disponible pour retrait ;
- retirée ;
- expirée ;
- annulée ;
- refusée.

### Règles

- une réservation expire après un délai défini ;
- un livre déjà réservé doit respecter la file d’attente ;
- le lecteur doit être notifié quand le livre devient disponible ;
- le bibliothécaire peut prioriser certains emprunts pédagogiques.

---

## 11. Onglet 7 — Lecteurs

### Fonction

Gérer les profils des utilisateurs de la bibliothèque.

### Informations affichées

- nom ;
- type de lecteur ;
- classe ou fonction ;
- nombre d’emprunts actifs ;
- retards ;
- pénalités ;
- historique ;
- favoris ;
- recommandations ;
- statut.

### Statuts lecteur

- actif ;
- suspendu ;
- bloqué ;
- archivé.

### Score lecteur recommandé

Le système peut calculer un score de lecture basé sur :

- nombre d’emprunts ;
- retours à temps ;
- diversité des lectures ;
- participation aux activités ;
- absence de pénalités.

---

## 12. Onglet 8 — Inventaire

### Fonction

Réaliser et suivre l’inventaire documentaire.

### Données

- campagne d’inventaire ;
- période ;
- responsable ;
- zone ;
- livres attendus ;
- livres scannés ;
- livres manquants ;
- livres abîmés ;
- écarts ;
- statut ;
- rapport.

### Méthodes

- scan code-barres ;
- QR code ;
- saisie manuelle ;
- import fichier ;
- contrôle par rayon ;
- contrôle par catégorie.

### Statuts

- planifié ;
- en cours ;
- terminé ;
- validé ;
- archivé.

---

## 13. Onglet 9 — Pénalités & pertes

### Fonction

Gérer les pénalités liées aux retards, pertes ou dégradations.

### Types de pénalités

- retard ;
- livre abîmé ;
- livre perdu ;
- remplacement ;
- suspension temporaire ;
- frais administratif.

### Données

- lecteur ;
- livre ;
- motif ;
- montant ;
- statut paiement ;
- date ;
- responsable ;
- observation.

### Statuts

- en attente ;
- payé ;
- annulé ;
- contesté ;
- exonéré ;
- transféré finance.

### Intégration Finance

Les pénalités doivent pouvoir être transférées vers le module financier pour encaissement et suivi comptable.

---

## 14. Onglet 10 — Ressources numériques

### Fonction

Gérer les documents et supports numériques.

### Types

- PDF ;
- document Word ;
- présentation ;
- audio ;
- vidéo ;
- lien web ;
- cours numérique ;
- annale numérique ;
- fiche pédagogique ;
- ressource interactive.

### Données

- titre ;
- type ;
- matière ;
- niveau ;
- classe ;
- auteur ;
- fichier ;
- lien ;
- droits d’accès ;
- date de publication ;
- nombre de consultations ;
- statut.

### Droits d’accès

- public interne ;
- élèves d’une classe ;
- enseignants ;
- administration ;
- parents ;
- accès restreint ;
- archive.

---

## 15. Onglet 11 — Recommandations pédagogiques

### Fonction

Proposer des ressources adaptées aux élèves, classes et enseignants.

### Recommandations possibles

- livres par niveau ;
- livres par matière ;
- lectures obligatoires ;
- lectures complémentaires ;
- ressources pour difficulté scolaire ;
- ressources pour excellence ;
- ressources bilingues ;
- annales d’examen ;
- documents de préparation ;
- ressources pour exposés ;
- livres recommandés par enseignant.

### Intégration avec l’espace pédagogique

Un enseignant peut recommander une ressource à :

- une classe ;
- un groupe d’élèves ;
- un élève spécifique ;
- un niveau scolaire ;
- une matière.

Les parents peuvent être informés des lectures recommandées selon les paramètres de l’école.

---

## 16. Onglet 12 — Rapports & statistiques

### Rapports possibles

- rapport des emprunts ;
- rapport des retours ;
- rapport des retards ;
- rapport des pertes ;
- rapport des pénalités ;
- rapport d’inventaire ;
- rapport par classe ;
- rapport par niveau ;
- rapport par matière ;
- rapport des ressources numériques ;
- rapport annuel bibliothèque.

### Statistiques

- livres les plus empruntés ;
- lecteurs les plus actifs ;
- classes les plus actives ;
- matières les plus consultées ;
- taux de retour à temps ;
- taux de perte ;
- taux de dégradation ;
- consultation numérique ;
- évolution des emprunts ;
- recommandations suivies.

---

## 17. Onglet 13 — Paramètres

Paramètres à prévoir :

- catégories de livres ;
- types de ressources ;
- durées d’emprunt ;
- nombre maximal d’emprunts ;
- règles de pénalité ;
- statuts de livres ;
- emplacements ;
- langues ;
- niveaux scolaires ;
- règles de réservation ;
- droits d’accès numériques ;
- modèles de notifications ;
- workflows de validation ;
- permissions.

---

## 18. UI/UX recommandée

Le module Bibliothèque doit être simple, rapide et orienté recherche.

### Composants UI

- LibraryDashboardCards
- CatalogSearchBar
- BookCard
- BookDetailDrawer
- BorrowingForm
- ReturnValidationModal
- ReservationQueue
- ReaderProfileCard
- InventoryScannerPanel
- DigitalResourceViewer
- RecommendationPanel
- LibraryReportBuilder

### Expérience utilisateur

Le bibliothécaire doit pouvoir :

- rechercher un livre rapidement ;
- enregistrer un emprunt en moins de 30 secondes ;
- valider un retour rapidement ;
- voir les retards ;
- scanner un livre ;
- générer un rapport ;
- suivre l’inventaire.

L’élève doit pouvoir :

- rechercher un livre ;
- voir sa disponibilité ;
- réserver si autorisé ;
- consulter ses emprunts ;
- voir ses retards ;
- accéder aux ressources numériques autorisées.

L’enseignant doit pouvoir :

- recommander des livres ;
- consulter les ressources pédagogiques ;
- partager une ressource avec une classe ;
- suivre les lectures recommandées.

---

## 19. Frontend

Pages principales :

- /library/dashboard
- /library/catalog
- /library/resources
- /library/borrowings
- /library/returns
- /library/reservations
- /library/readers
- /library/inventory
- /library/penalties
- /library/digital-resources
- /library/recommendations
- /library/reports
- /library/settings

---

## 20. Backend

Services principaux :

- LibraryService
- CatalogService
- LibraryResourceService
- BorrowingService
- ReturnService
- ReservationService
- ReaderService
- LibraryInventoryService
- LibraryPenaltyService
- DigitalResourceService
- LibraryRecommendationService
- LibraryReportService
- LibraryNotificationService

API principales :

- GET /api/library/dashboard
- GET /api/library/catalog
- POST /api/library/resources
- GET /api/library/resources
- POST /api/library/borrowings
- GET /api/library/borrowings
- POST /api/library/returns
- POST /api/library/reservations
- GET /api/library/readers
- POST /api/library/inventory
- GET /api/library/penalties
- POST /api/library/penalties
- GET /api/library/digital-resources
- POST /api/library/digital-resources
- GET /api/library/recommendations
- POST /api/library/recommendations
- GET /api/library/reports

---

## 21. Base de données

Tables recommandées :

- library_catalog_items
- library_resources
- library_resource_copies
- library_authors
- library_categories
- library_borrowings
- library_returns
- library_reservations
- library_readers
- library_inventory_campaigns
- library_inventory_items
- library_penalties
- library_digital_resources
- library_recommendations
- library_favorites
- library_notifications
- library_reports
- library_settings

---

## 22. Permissions

Permissions recommandées :

- LIBRARY_VIEW
- LIBRARY_DASHBOARD_VIEW
- LIBRARY_CATALOG_VIEW
- LIBRARY_RESOURCE_CREATE
- LIBRARY_RESOURCE_UPDATE
- LIBRARY_RESOURCE_DELETE
- LIBRARY_BORROWING_CREATE
- LIBRARY_RETURN_VALIDATE
- LIBRARY_RESERVATION_MANAGE
- LIBRARY_READER_VIEW
- LIBRARY_INVENTORY_MANAGE
- LIBRARY_PENALTY_MANAGE
- LIBRARY_DIGITAL_RESOURCE_MANAGE
- LIBRARY_RECOMMENDATION_CREATE
- LIBRARY_REPORT_VIEW
- LIBRARY_SETTINGS_MANAGE

---

## 23. Notifications

Notifications possibles :

- emprunt validé ;
- retour validé ;
- livre en retard ;
- pénalité créée ;
- livre réservé disponible ;
- réservation expirée ;
- nouvelle ressource disponible ;
- recommandation pédagogique ;
- livre perdu ;
- inventaire lancé ;
- rapport disponible.

Canaux :

- in-app ;
- email ;
- SMS ;
- WhatsApp ;
- push mobile.

---

## 24. Intégrations

### Avec le module Élèves

- profil lecteur élève ;
- classe ;
- niveau ;
- historique d’emprunts ;
- retards ;
- pénalités.

### Avec le module Enseignants / Pédagogie

- recommandations de lecture ;
- ressources par matière ;
- ressources pour exposés ;
- supports pédagogiques ;
- fiches de lecture ;
- lectures obligatoires.

### Avec le module Finance

- pénalités ;
- frais de remplacement ;
- paiement des pertes ;
- reçus ;
- suivi comptable.

### Avec le module Communication

- notifications de retard ;
- recommandations aux parents ;
- nouveautés ;
- annonces bibliothèque.

### Avec ORION

ORION peut détecter :

- livres très demandés ;
- livres peu utilisés ;
- classes peu actives ;
- lecteurs en retard fréquent ;
- ressources manquantes ;
- pertes répétées ;
- baisse d’activité ;
- besoins pédagogiques non couverts.

ORION peut recommander :

- acheter de nouveaux exemplaires ;
- relancer les lecteurs en retard ;
- proposer une campagne de lecture ;
- recommander des ressources par niveau ;
- signaler les livres à remplacer ;
- produire un rapport d’usage ;
- informer la direction.

### Avec Sara AI

Sara AI peut aider à :

- générer un résumé de livre ;
- proposer une fiche de lecture ;
- recommander des livres par niveau ;
- créer une liste de lecture ;
- rédiger un message de rappel ;
- produire un rapport bibliothèque ;
- classer automatiquement une ressource ;
- générer des mots-clés.

### Avec Atlas Knowledge Base

Atlas peut stocker :

- fiches de lecture ;
- résumés ;
- guides pédagogiques ;
- catalogues ;
- documents numériques ;
- règles de bibliothèque ;
- modèles de rapports ;
- ressources pédagogiques validées.

---

## 25. Règles métier

- Un livre non disponible ne peut pas être emprunté.
- Un lecteur bloqué ne peut pas emprunter.
- Un emprunt en retard doit générer une alerte.
- Une réservation doit respecter l’ordre de priorité.
- Une pénalité doit pouvoir être reliée au module Finance.
- Un livre perdu doit modifier l’état de l’exemplaire.
- Les ressources numériques doivent respecter les droits d’accès.
- Les élèves ne voient que les ressources autorisées pour leur niveau ou leur classe.
- Les parents ne voient que les informations de leurs enfants.
- Les actions sensibles doivent être journalisées.
- Les rapports doivent être exportables.
- Les documents protégés ne doivent pas être partagés sans permission.

---

## 26. Conclusion

Le module Bibliothèque permet à Academia Helm de transformer la bibliothèque scolaire en véritable centre de ressources pédagogiques.

Il couvre :

1. catalogue ;
2. livres ;
3. emprunts ;
4. retours ;
5. réservations ;
6. lecteurs ;
7. inventaire ;
8. pénalités ;
9. ressources numériques ;
10. recommandations ;
11. rapports.

C’est un module stratégique, car il relie la lecture, la pédagogie, la culture générale, la discipline documentaire et le suivi parental.
