# Academia Helm — Module Supplémentaire 4 : Infirmerie

## 1. Présentation générale

Le module Infirmerie d’Academia Helm permet de gérer le suivi sanitaire des élèves au sein de l’établissement : dossiers médicaux, passages à l’infirmerie, incidents de santé, médicaments disponibles, autorisations parentales, alertes médicales, visites médicales, rapports et notifications.

Ce module doit être conçu comme un espace sécurisé, confidentiel et strictement contrôlé, car il manipule des données sensibles liées à la santé des élèves.

---

## 2. Objectif métier

Le module Infirmerie permet à l’école de :

- centraliser les dossiers médicaux scolaires ;
- suivre les passages à l’infirmerie ;
- gérer les urgences ;
- enregistrer les incidents de santé ;
- suivre les allergies et contre-indications ;
- gérer les médicaments disponibles ;
- notifier les parents si nécessaire ;
- produire des rapports médicaux internes ;
- améliorer la sécurité sanitaire des élèves ;
- fournir à la direction une vision claire des situations sensibles.

---

## 3. Utilisateurs concernés

- Promoteur / Fondateur
- Direction générale
- Directeur d’établissement
- Infirmier / Infirmière scolaire
- Responsable vie scolaire
- Surveillant général
- Enseignants avec accès très limité
- Parents
- Responsable QHSE
- ORION Pilotage Direction
- Sara AI avec accès encadré
- Super Admin plateforme selon permissions

---

## 4. Onglets recommandés

1. Tableau de bord
2. Dossiers médicaux élèves
3. Passages à l’infirmerie
4. Urgences & incidents médicaux
5. Médicaments & consommables
6. Allergies & contre-indications
7. Visites médicales
8. Autorisations parentales
9. Rapports & statistiques
10. Paramètres

---

## 5. Onglet 1 — Tableau de bord

### Objectif

Afficher une vue synthétique de l’activité sanitaire de l’école.

### Informations affichées

- passages du jour ;
- élèves suivis médicalement ;
- urgences récentes ;
- allergies critiques ;
- médicaments en stock faible ;
- incidents ouverts ;
- visites médicales prévues ;
- notifications parents envoyées ;
- cas nécessitant suivi ;
- alertes sensibles.

### KPI recommandés

- nombre de passages à l’infirmerie ;
- fréquence des passages par classe ;
- incidents médicaux par période ;
- médicaments consommés ;
- taux d’urgences ;
- élèves avec allergies ;
- élèves avec contre-indications ;
- taux de dossiers médicaux incomplets.

---

## 6. Onglet 2 — Dossiers médicaux élèves

### Fonction

Centraliser les informations médicales essentielles de chaque élève.

### Champs principaux

- élève ;
- classe ;
- niveau ;
- parent responsable ;
- contact d’urgence ;
- groupe sanguin si fourni ;
- allergies ;
- maladies connues déclarées par les parents ;
- traitements en cours déclarés ;
- contre-indications ;
- médecin traitant si renseigné ;
- assurance santé si renseignée ;
- documents médicaux joints ;
- observations ;
- date de dernière mise à jour ;
- statut du dossier.

### Statuts

- complet ;
- incomplet ;
- à vérifier ;
- sensible ;
- archivé.

### Règle importante

Les informations médicales ne doivent être visibles qu’aux profils autorisés. Un enseignant ne doit pas voir tout le dossier médical d’un élève. Il peut seulement voir les alertes nécessaires à la sécurité pédagogique, par exemple : allergie critique ou interdiction d’activité sportive.

---

## 7. Onglet 3 — Passages à l’infirmerie

### Fonction

Enregistrer chaque passage d’un élève à l’infirmerie.

### Données à renseigner

- élève ;
- classe ;
- date ;
- heure d’arrivée ;
- heure de sortie ;
- motif du passage ;
- symptômes observés ;
- action effectuée ;
- médicament administré si autorisé ;
- repos accordé ;
- retour en classe ;
- parent contacté ;
- direction informée ;
- observation ;
- statut.

### Motifs possibles

- maux de tête ;
- fatigue ;
- douleur abdominale ;
- blessure légère ;
- malaise ;
- fièvre ;
- chute ;
- douleur musculaire ;
- problème respiratoire ;
- allergie ;
- suivi régulier ;
- autre.

### Statuts

- en cours ;
- terminé ;
- parent contacté ;
- retour en classe ;
- retour à domicile ;
- transféré ;
- urgence.

---

## 8. Onglet 4 — Urgences & incidents médicaux

### Fonction

Gérer les situations médicales nécessitant une attention particulière.

### Types d’incidents

- malaise ;
- chute ;
- blessure ;
- réaction allergique ;
- crise respiratoire ;
- fièvre élevée ;
- accident sportif ;
- accident en laboratoire ;
- accident de transport ;
- intoxication alimentaire suspectée ;
- incident cantine ;
- autre urgence.

### Champs principaux

- date ;
- heure ;
- élève ;
- lieu ;
- type d’incident ;
- gravité ;
- description ;
- premiers gestes effectués ;
- parent contacté ;
- direction informée ;
- service médical externe contacté ;
- transfert effectué ;
- rapport joint ;
- statut.

### Niveaux de gravité

- faible ;
- moyen ;
- élevé ;
- critique.

### Règle métier

Toute urgence doit générer automatiquement une notification à la direction et, selon les paramètres, au parent responsable.

---

## 9. Onglet 5 — Médicaments & consommables

### Fonction

Gérer les médicaments, produits de premiers soins et consommables de l’infirmerie.

### Exemples

- pansements ;
- compresses ;
- antiseptiques ;
- gants ;
- thermomètres ;
- masques ;
- coton ;
- bandes ;
- sérum physiologique ;
- produits autorisés par l’école ;
- consommables de soins.

### Champs principaux

- nom ;
- catégorie ;
- quantité ;
- unité ;
- seuil d’alerte ;
- date d’entrée ;
- date d’expiration ;
- fournisseur ;
- emplacement ;
- statut ;
- conditions de stockage ;
- observation.

### Alertes

- stock faible ;
- rupture ;
- produit expiré ;
- produit proche expiration ;
- consommation anormale ;
- produit non autorisé.

### Règle stricte

L’administration d’un médicament à un élève doit dépendre des autorisations parentales et des règles définies par l’établissement.

---

## 10. Onglet 6 — Allergies & contre-indications

### Fonction

Centraliser les alertes sanitaires importantes.

### Données

- élève ;
- type d’allergie ;
- niveau de gravité ;
- aliment ou produit concerné ;
- consigne spécifique ;
- activité interdite ;
- médicament interdit ;
- document justificatif ;
- contact d’urgence ;
- statut.

### Types de contre-indications

- sport ;
- alimentation ;
- médicament ;
- laboratoire ;
- activité physique ;
- sortie scolaire ;
- transport ;
- exposition à certains produits ;
- autre.

### Alertes croisées

Le système doit pouvoir croiser les informations avec :

- Cantine ;
- Transport ;
- Laboratoire ;
- QHSE ;
- Pédagogie ;
- Vie scolaire ;
- Communication.

Exemple : si un menu contient un allergène signalé pour un élève inscrit à la cantine, une alerte doit être générée.

---

## 11. Onglet 7 — Visites médicales

### Fonction

Planifier et suivre les visites médicales scolaires.

### Types de visites

- visite annuelle ;
- contrôle général ;
- contrôle sportif ;
- visite de suivi ;
- campagne de vaccination si applicable ;
- dépistage visuel ;
- dépistage auditif ;
- intervention partenaire santé ;
- autre.

### Données

- date ;
- classe concernée ;
- élèves concernés ;
- professionnel de santé ;
- lieu ;
- objet de la visite ;
- résultats synthétiques ;
- recommandations ;
- documents joints ;
- parents notifiés ;
- statut.

### Statuts

- planifiée ;
- en cours ;
- terminée ;
- reportée ;
- annulée ;
- archivée.

---

## 12. Onglet 8 — Autorisations parentales

### Fonction

Gérer les autorisations liées à la santé de l’élève.

### Types d’autorisations

- autorisation de premiers soins ;
- autorisation d’administration de médicament spécifique ;
- autorisation de contacter un médecin ;
- autorisation de transfert vers un centre de santé ;
- autorisation de participation sportive ;
- autorisation liée aux sorties scolaires ;
- autorisation de partage d’alerte médicale avec l’équipe pédagogique.

### Données

- élève ;
- parent ;
- type d’autorisation ;
- période de validité ;
- document joint ;
- signature ;
- statut ;
- date de validation ;
- observation.

### Statuts

- en attente ;
- validée ;
- refusée ;
- expirée ;
- révoquée.

---

## 13. Onglet 9 — Rapports & statistiques

### Rapports possibles

- rapport journalier des passages ;
- rapport mensuel infirmerie ;
- rapport par classe ;
- rapport par niveau ;
- rapport des urgences ;
- rapport des incidents ;
- rapport des médicaments utilisés ;
- rapport des allergies ;
- rapport des visites médicales ;
- rapport de stock ;
- rapport annuel santé scolaire.

### Statistiques

- passages par classe ;
- passages par motif ;
- élèves les plus suivis ;
- périodes avec plus d’incidents ;
- consommation de médicaments ;
- taux de dossiers incomplets ;
- incidents liés au sport ;
- incidents liés à la cantine ;
- incidents liés au laboratoire.

---

## 14. Onglet 10 — Paramètres

Paramètres à prévoir :

- motifs de passage ;
- types d’incidents ;
- niveaux de gravité ;
- catégories de médicaments ;
- seuils de stock ;
- règles d’autorisation parentale ;
- modèles de notifications ;
- workflows d’urgence ;
- permissions ;
- règles de confidentialité ;
- modèles de rapports ;
- canaux de notification.

---

## 15. UI/UX recommandée

Le module Infirmerie doit être sobre, sécurisé et rapide.

### Principes UI/UX

- accès rapide aux urgences ;
- affichage clair des allergies critiques ;
- badges de gravité ;
- fiche élève médicale synthétique ;
- bouton d’action rapide pour contacter le parent ;
- historique chronologique ;
- confidentialité renforcée ;
- journalisation des consultations de dossier.

### Composants UI

- HealthDashboardCards
- StudentMedicalProfile
- InfirmaryVisitForm
- EmergencyIncidentForm
- MedicationStockTable
- AllergyCriticalBadge
- MedicalAuthorizationPanel
- MedicalVisitCalendar
- HealthReportBuilder
- ConfidentialAccessLog

---

## 16. Frontend

Pages principales :

- /infirmary/dashboard
- /infirmary/medical-records
- /infirmary/visits
- /infirmary/emergencies
- /infirmary/medications
- /infirmary/allergies
- /infirmary/medical-checkups
- /infirmary/authorizations
- /infirmary/reports
- /infirmary/settings

---

## 17. Backend

Services principaux :

- InfirmaryService
- MedicalRecordService
- InfirmaryVisitService
- MedicalEmergencyService
- MedicationStockService
- AllergyContraindicationService
- MedicalCheckupService
- MedicalAuthorizationService
- HealthReportService
- HealthNotificationService
- MedicalAccessLogService

API principales :

- GET /api/infirmary/dashboard
- GET /api/infirmary/medical-records
- POST /api/infirmary/medical-records
- GET /api/infirmary/visits
- POST /api/infirmary/visits
- POST /api/infirmary/emergencies
- GET /api/infirmary/medications
- POST /api/infirmary/medications
- GET /api/infirmary/allergies
- POST /api/infirmary/allergies
- GET /api/infirmary/medical-checkups
- POST /api/infirmary/medical-checkups
- GET /api/infirmary/authorizations
- POST /api/infirmary/authorizations
- GET /api/infirmary/reports

---

## 18. Base de données

Tables recommandées :

- infirmary_medical_records
- infirmary_visits
- infirmary_visit_actions
- infirmary_emergencies
- infirmary_medications
- infirmary_medication_movements
- infirmary_allergies
- infirmary_contraindications
- infirmary_medical_checkups
- infirmary_authorizations
- infirmary_documents
- infirmary_notifications
- infirmary_reports
- infirmary_access_logs
- infirmary_settings

---

## 19. Permissions

Permissions recommandées :

- INFIRMARY_VIEW
- INFIRMARY_DASHBOARD_VIEW
- INFIRMARY_MEDICAL_RECORD_VIEW
- INFIRMARY_MEDICAL_RECORD_MANAGE
- INFIRMARY_VISIT_CREATE
- INFIRMARY_VISIT_UPDATE
- INFIRMARY_EMERGENCY_REPORT
- INFIRMARY_MEDICATION_MANAGE
- INFIRMARY_ALLERGY_MANAGE
- INFIRMARY_AUTHORIZATION_VIEW
- INFIRMARY_CHECKUP_MANAGE
- INFIRMARY_REPORT_VIEW
- INFIRMARY_SETTINGS_MANAGE
- INFIRMARY_ACCESS_LOG_VIEW

---

## 20. Notifications

Notifications possibles :

- passage à l’infirmerie ;
- urgence médicale ;
- parent contacté ;
- médicament administré selon autorisation ;
- allergie critique détectée ;
- visite médicale programmée ;
- dossier médical incomplet ;
- produit médical expiré ;
- stock faible ;
- rapport disponible.

Canaux :

- in-app ;
- email ;
- SMS ;
- WhatsApp ;
- push mobile.

---

## 21. Intégrations

### Avec le module Élèves

- dossier élève ;
- classe ;
- parent responsable ;
- contact d’urgence ;
- historique santé scolaire.

### Avec le module Communication

- notification parent ;
- notification direction ;
- message d’urgence ;
- rappels de documents médicaux.

### Avec le module Cantine

- allergies alimentaires ;
- régimes particuliers ;
- incidents alimentaires ;
- alertes allergènes.

### Avec le module Transport

- incident médical dans le bus ;
- contact parent ;
- autorisation d’urgence ;
- suivi de l’élève transporté.

### Avec le module Laboratoire

- accident de laboratoire ;
- exposition à un produit ;
- contre-indication ;
- rapport d’incident.

### Avec le module QHSE

- incidents sanitaires ;
- risques ;
- plans d’action ;
- conformité ;
- inspections.

### Avec ORION

ORION peut détecter :

- élève avec passages fréquents ;
- classe avec incidents récurrents ;
- stock médical critique ;
- dossier médical incomplet ;
- incident lié à la cantine ;
- incident lié au sport ;
- incident lié au laboratoire ;
- hausse anormale des passages ;
- allergie critique non prise en compte.

ORION peut recommander :

- alerter la direction ;
- demander une mise à jour parentale ;
- planifier une visite médicale ;
- renforcer une procédure QHSE ;
- vérifier un menu ;
- contrôler une activité ;
- suivre un élève sensible ;
- créer un rapport mensuel.

### Avec Sara AI

Sara AI peut aider à :

- rédiger un message neutre aux parents ;
- générer un rapport synthétique ;
- produire une note interne ;
- résumer les passages du mois ;
- créer une procédure d’urgence ;
- reformuler une consigne sanitaire ;
- préparer une check-list infirmerie.

Important : Sara AI ne doit pas poser de diagnostic médical. Elle peut aider à la rédaction, à la synthèse et à l’organisation, mais pas remplacer un professionnel de santé.

### Avec Atlas Knowledge Base

Atlas peut stocker :

- procédures d’urgence ;
- modèles de messages ;
- protocoles internes ;
- consignes sanitaires ;
- règles de confidentialité ;
- fiches de premiers soins ;
- documents de prévention ;
- modèles de rapports.

---

## 22. Règles métier

- Les données médicales doivent être protégées par permissions strictes.
- Un enseignant ne doit pas accéder au dossier médical complet d’un élève.
- Les parents ne voient que les informations concernant leurs propres enfants.
- Toute urgence doit être historisée.
- Toute consultation d’un dossier médical doit être journalisée.
- Un médicament expiré ne doit pas être utilisé.
- L’administration d’un médicament doit dépendre des autorisations parentales.
- Les allergies critiques doivent être visibles sous forme d’alerte aux profils autorisés.
- Les incidents médicaux doivent pouvoir être liés à Cantine, Transport, Laboratoire ou QHSE.
- Les rapports doivent être exportables.
- Les données sensibles ne doivent pas être exposées dans les notifications publiques.
- Les actions critiques doivent être horodatées.

---

## 23. Conclusion

Le module Infirmerie permet à Academia Helm de gérer le suivi sanitaire scolaire avec rigueur, confidentialité et traçabilité.

Il couvre :

1. dossiers médicaux ;
2. passages à l’infirmerie ;
3. urgences ;
4. médicaments ;
5. allergies ;
6. contre-indications ;
7. visites médicales ;
8. autorisations parentales ;
9. rapports ;
10. notifications.

C’est un module à forte valeur pour les écoles modernes, car il renforce la sécurité des élèves et la confiance des parents.
