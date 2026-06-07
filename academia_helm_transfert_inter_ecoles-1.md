# Academia Helm — Extension avancée du module Élèves : Transfert inter-écoles intelligent

## 1. Vision générale

Academia Helm doit permettre de gérer le transfert numérique complet d’un élève d’une école A vers une école B, lorsque les deux établissements utilisent la plateforme.

Ce transfert ne doit pas être un simple changement manuel d’établissement. Il doit être un workflow institutionnel sécurisé, traçable, validé, documenté et intelligent.

L’école A initie une demande de transfert vers l’école B.  
L’école B reçoit la demande via messagerie interne et notification email.  
Le dossier scolaire numérique de l’élève est joint à la demande selon les permissions et les règles de confidentialité.  
Après étude, approbation et validation par l’école B, l’élève est transféré digitalement vers l’école B.  
À partir de ce moment, l’élève dépend des règles, standards, classes, frais, cycles, permissions et processus de l’école B.

---

## 2. Positionnement fonctionnel

Cette fonctionnalité doit être rattachée au module Élèves, dans l’onglet déjà prévu pour les transferts, mais enrichie avec une couche inter-écoles.

Nom recommandé de l’onglet :

**Transferts & Mobilité scolaire**

Sous-sections recommandées :

1. Transferts internes
2. Transferts sortants
3. Transferts entrants
4. Demandes reçues
5. Dossiers transférés
6. Historique des transferts
7. Paramètres de transfert

---

## 3. Types de transferts à gérer

### 3.1 Transfert interne

Transfert d’un élève au sein de la même école :

- changement de classe ;
- changement de niveau ;
- changement de section ;
- changement de site/campus si l’école en possède plusieurs.

### 3.2 Transfert inter-écoles Academia Helm

Transfert d’un élève d’une école A vers une école B, les deux écoles étant présentes sur Academia Helm.

### 3.3 Transfert externe sortant

L’élève quitte une école Academia Helm vers une école qui n’utilise pas la plateforme.

Dans ce cas, le système génère un dossier de sortie exportable.

### 3.4 Transfert externe entrant

Un élève vient d’une école hors Academia Helm.

Dans ce cas, l’école d’accueil crée ou importe manuellement son dossier.

---

## 4. Workflow complet du transfert inter-écoles

## Étape 1 — Sélection de l’élève par l’école A

L’école A ouvre le module Élèves, onglet Transferts & Mobilité scolaire, puis sélectionne l’élève à transférer.

Le système affiche :

- identité de l’élève ;
- matricule actuel ;
- niveau ;
- classe ;
- cycle ;
- année scolaire ;
- statut scolaire ;
- situation financière ;
- situation disciplinaire ;
- situation pédagogique ;
- documents disponibles ;
- éventuelles restrictions.

## Étape 2 — Choix de l’école B

L’école A recherche l’école B dans l’annuaire sécurisé des établissements Academia Helm.

Filtres possibles :

- nom de l’école ;
- ville ;
- pays ;
- niveau scolaire disponible ;
- type d’établissement ;
- code établissement ;
- statut actif sur Academia Helm.

## Étape 3 — Préparation du dossier de transfert

Le système génère un dossier numérique de transfert comprenant, selon permissions :

- fiche d’identité de l’élève ;
- informations parent/tuteur ;
- historique scolaire ;
- bulletins ;
- notes ;
- absences ;
- retards ;
- sanctions ;
- appréciations ;
- documents administratifs ;
- certificat de scolarité ;
- certificat de radiation ou sortie ;
- situation financière ;
- observations pédagogiques ;
- historique médical scolaire autorisé ;
- documents joints ;
- recommandations de l’école A.

Certaines données sensibles doivent être masquées ou soumises à consentement.

## Étape 4 — Envoi de la demande

L’école A envoie la demande à l’école B.

Canaux :

- messagerie interne Academia Helm ;
- notification email ;
- notification in-app ;
- notification au responsable admissions de l’école B ;
- notification au directeur de l’école B selon configuration.

La demande doit contenir :

- objet ;
- message d’accompagnement ;
- identité de l’élève ;
- école d’origine ;
- niveau demandé ;
- classe souhaitée ;
- année scolaire ;
- motif du transfert ;
- dossier joint ;
- date limite de réponse souhaitée.

## Étape 5 — Réception par l’école B

L’école B reçoit la demande dans son espace :

- Transferts entrants ;
- Messagerie interne ;
- Centre de notifications ;
- Email institutionnel.

L’école B peut :

- consulter le dossier ;
- demander des informations complémentaires ;
- accepter la demande ;
- refuser la demande ;
- mettre en attente ;
- demander une validation parentale ;
- demander un entretien ;
- demander des pièces complémentaires.

## Étape 6 — Analyse intelligente par Academia Helm

Avant validation, le système peut analyser :

- correspondance du niveau ;
- disponibilité de classe ;
- capacité d’accueil ;
- conformité des documents ;
- cohérence de l’âge ;
- situation financière ;
- historique disciplinaire ;
- historique pédagogique ;
- compatibilité avec les règles de l’école B ;
- frais applicables ;
- documents manquants ;
- risques administratifs.

Le système peut afficher une recommandation :

- transfert recommandé ;
- transfert possible avec conditions ;
- transfert à examiner ;
- transfert bloqué pour documents manquants ;
- transfert non conforme.

## Étape 7 — Approbation par l’école B

L’école B valide la demande.

La validation peut être faite par :

- directeur ;
- responsable admissions ;
- secrétaire académique ;
- promoteur/fondateur ;
- administrateur école ;
- comité d’admission selon configuration.

Une fois validée, le système prépare la migration du dossier.

## Étape 8 — Confirmation finale de l’école A

Selon les règles, l’école A peut devoir confirmer la sortie définitive de l’élève.

Cette étape évite qu’un élève soit transféré sans clôture administrative.

L’école A confirme :

- sortie validée ;
- situation financière clôturée ou transférée ;
- certificat de radiation généré ;
- dossier libéré ;
- statut de l’élève changé en transféré sortant.

## Étape 9 — Transfert digital intelligent

Le système effectue le transfert :

- création ou rattachement du profil élève dans l’école B ;
- attribution d’un nouveau matricule selon la règle de l’école B ;
- affectation au niveau/classe ;
- application des frais de l’école B ;
- application du règlement de l’école B ;
- application des standards pédagogiques de l’école B ;
- activation dans les portails de l’école B ;
- rattachement des parents/tuteurs ;
- import contrôlé de l’historique scolaire ;
- archivage du dossier dans l’école A ;
- journalisation complète de l’opération.

## Étape 10 — Notifications finales

Le système notifie :

- école A ;
- école B ;
- parent/tuteur ;
- élève si autorisé ;
- administration concernée ;
- finance si frais à générer ;
- direction ;
- ORION pour suivi directionnel.

---

## 5. Statuts d’une demande de transfert

Statuts recommandés :

- brouillon ;
- préparée ;
- envoyée ;
- reçue ;
- en étude ;
- informations complémentaires demandées ;
- en attente parent ;
- en attente validation direction ;
- acceptée ;
- refusée ;
- annulée ;
- expirée ;
- confirmée par école A ;
- transfert exécuté ;
- archivée.

---

## 6. Données du transfert

Table fonctionnelle d’une demande de transfert :

- identifiant transfert ;
- élève ;
- école source ;
- école destination ;
- année scolaire ;
- niveau actuel ;
- classe actuelle ;
- niveau demandé ;
- classe souhaitée ;
- motif ;
- message ;
- statut ;
- date d’envoi ;
- date de réception ;
- date de décision ;
- décision ;
- décideur ;
- observations école A ;
- observations école B ;
- pièces jointes ;
- dossier scolaire lié ;
- consentement parent si requis ;
- journal d’activité.

---

## 7. Dossier scolaire transférable

Le dossier scolaire transférable doit être structuré par catégories.

### 7.1 Identité

- nom ;
- prénoms ;
- sexe ;
- date de naissance ;
- lieu de naissance ;
- nationalité ;
- photo ;
- matricule d’origine ;
- identifiant global Academia Helm.

### 7.2 Parents / tuteurs

- parent principal ;
- contacts ;
- lien de parenté ;
- autorisations ;
- personnes à contacter en urgence.

### 7.3 Parcours scolaire

- écoles précédentes ;
- niveaux fréquentés ;
- classes ;
- années scolaires ;
- décisions de passage ;
- redoublements ;
- mentions ;
- observations générales.

### 7.4 Résultats scolaires

- bulletins ;
- moyennes ;
- notes ;
- rangs ;
- appréciations ;
- compétences ;
- évaluations ;
- examens.

### 7.5 Discipline et vie scolaire

- absences ;
- retards ;
- sanctions ;
- encouragements ;
- observations ;
- comportement général.

### 7.6 Documents administratifs

- acte de naissance ;
- certificat de scolarité ;
- certificat de radiation ;
- photos ;
- documents d’inscription ;
- autorisations parentales ;
- pièces complémentaires.

### 7.7 Finance

- frais payés ;
- frais impayés ;
- solde ;
- échéancier ;
- remise ;
- bourse ;
- situation de clôture.

### 7.8 Santé scolaire

À traiter avec prudence.

- allergies signalées ;
- informations médicales autorisées ;
- passages infirmerie importants ;
- restrictions connues ;
- contacts urgence.

Ces données doivent être transférées uniquement selon permission, consentement et politique de confidentialité.

---

## 8. Règles métier essentielles

- Une école ne peut pas transférer un élève vers une autre école sans demande formelle.
- L’école B doit valider avant que l’élève ne soit activé chez elle.
- L’école A doit conserver une archive du dossier transféré.
- L’école B applique ses propres règles après transfert.
- Le matricule de l’école A ne doit pas forcément devenir le matricule de l’école B.
- L’élève doit garder un identifiant global Academia Helm.
- Les données sensibles doivent être protégées.
- Les parents doivent être informés du transfert.
- Une demande peut être refusée.
- Une demande peut être mise en attente.
- Un transfert exécuté ne doit pas être supprimé, mais archivé.
- Toute action doit être journalisée.
- Les frais de l’école B doivent être recalculés automatiquement.
- Les anciennes dettes de l’école A ne doivent pas être imposées à l’école B, sauf accord explicite.
- Les documents doivent être versionnés.
- L’école B peut demander des pièces complémentaires.
- L’école A peut annuler une demande tant qu’elle n’est pas acceptée.
- Après exécution, l’élève devient inactif ou transféré sortant dans l’école A.
- Après exécution, l’élève devient actif ou préinscrit dans l’école B selon configuration.

---

## 9. Gestion des règles de l’école B

Après transfert, l’élève doit être soumis aux règles de l’école B :

- structure des niveaux ;
- classes disponibles ;
- frais scolaires ;
- échéanciers ;
- règlement intérieur ;
- calendrier scolaire ;
- horaires ;
- matières ;
- coefficients ;
- système d’évaluation ;
- exigences documentaires ;
- politiques disciplinaires ;
- règles de communication ;
- accès portail parent/élève ;
- permissions ;
- standards pédagogiques.

Le système doit donc faire une conversion intelligente du dossier, au lieu de copier brutalement les données.

---

## 10. Intelligence de transfert

Academia Helm doit prévoir un moteur de transfert intelligent.

### Fonctions du moteur

- vérifier la compatibilité du niveau ;
- proposer une classe d’accueil ;
- détecter les documents manquants ;
- vérifier l’âge par rapport au niveau ;
- comparer les programmes ;
- vérifier les frais à générer ;
- détecter les impayés de l’école A ;
- vérifier les autorisations parentales ;
- générer une checklist d’admission ;
- proposer un statut d’entrée ;
- préparer le dossier pour validation ;
- générer un résumé directionnel.

### Résultat possible

- prêt pour transfert ;
- transfert possible avec conditions ;
- documents manquants ;
- validation direction requise ;
- situation financière à clarifier ;
- classe d’accueil indisponible ;
- transfert déconseillé.

---

## 11. Messagerie interne et email

### Message interne école A vers école B

La demande doit être envoyée dans la messagerie interne avec :

- objet ;
- message ;
- dossier attaché ;
- bouton consulter ;
- bouton accepter ;
- bouton refuser ;
- bouton demander complément ;
- historique de discussion.

### Email institutionnel

Un email doit aussi être envoyé à l’école B pour signaler la demande.

L’email ne doit pas contenir toutes les données sensibles. Il doit contenir un lien sécurisé vers Academia Helm.

---

## 12. Portail école A

L’école A doit voir :

- demandes envoyées ;
- demandes en attente ;
- demandes acceptées ;
- demandes refusées ;
- élèves transférés sortants ;
- dossiers archivés ;
- certificats générés ;
- historique des échanges.

Actions disponibles :

- créer demande ;
- joindre dossier ;
- envoyer ;
- annuler ;
- répondre à une demande de complément ;
- confirmer sortie ;
- télécharger certificat ;
- consulter historique.

---

## 13. Portail école B

L’école B doit voir :

- demandes reçues ;
- dossiers à étudier ;
- demandes en attente ;
- demandes acceptées ;
- demandes refusées ;
- élèves transférés entrants ;
- admissions à finaliser ;
- documents manquants ;
- décisions prises.

Actions disponibles :

- consulter dossier ;
- demander complément ;
- accepter ;
- refuser ;
- affecter classe ;
- générer frais ;
- créer compte parent ;
- finaliser admission ;
- activer élève.

---

## 14. Portail parent

Le parent doit être informé :

- demande de transfert initiée ;
- dossier envoyé ;
- demande reçue par l’école B ;
- complément demandé ;
- transfert accepté ;
- transfert refusé ;
- transfert finalisé ;
- nouvel accès école B disponible.

Selon configuration, le parent peut :

- donner son consentement ;
- ajouter des documents ;
- suivre le statut ;
- recevoir les instructions de l’école B ;
- payer les frais d’admission ;
- accéder au nouveau portail.

---

## 15. ORION — Pilotage direction

ORION doit suivre :

- nombre de transferts sortants ;
- nombre de transferts entrants ;
- motifs de départ ;
- écoles de destination ;
- écoles d’origine ;
- taux d’acceptation ;
- délais moyens de traitement ;
- niveaux les plus concernés ;
- classes les plus touchées ;
- impact financier ;
- risque de perte d’effectif ;
- attractivité de l’école ;
- transferts refusés ;
- transferts bloqués.

ORION peut recommander :

- analyser les causes de départ ;
- contacter les parents ;
- renforcer la fidélisation ;
- revoir les frais ;
- améliorer la qualité pédagogique ;
- ouvrir une nouvelle classe ;
- alerter la direction ;
- identifier une fuite d’effectifs ;
- détecter une opportunité de croissance.

---

## 16. Sara AI — Assistance intelligente

Sara AI peut aider à :

- rédiger la demande de transfert ;
- résumer le dossier de l’élève ;
- générer une lettre de transfert ;
- générer un certificat de radiation ;
- analyser les pièces manquantes ;
- préparer une checklist d’admission ;
- rédiger une réponse de l’école B ;
- produire une synthèse pour la direction ;
- expliquer les motifs de refus ;
- proposer une classe d’accueil ;
- générer un message au parent.

---

## 17. Backend recommandé

### Services

- StudentTransferService
- InterSchoolTransferService
- TransferRequestService
- TransferApprovalService
- TransferDocumentService
- TransferMessagingService
- TransferEligibilityService
- TransferExecutionService
- TransferAuditService
- TransferNotificationService

### API

- POST /api/students/transfers
- GET /api/students/transfers
- GET /api/students/transfers/:id
- PATCH /api/students/transfers/:id
- POST /api/students/transfers/:id/send
- POST /api/students/transfers/:id/request-complement
- POST /api/students/transfers/:id/approve
- POST /api/students/transfers/:id/reject
- POST /api/students/transfers/:id/confirm-source-exit
- POST /api/students/transfers/:id/execute
- GET /api/students/transfers/:id/dossier
- POST /api/students/transfers/:id/documents
- GET /api/schools/directory
- GET /api/students/transfers/incoming
- GET /api/students/transfers/outgoing

---

## 18. Base de données recommandée

Tables :

- student_transfers
- student_transfer_requests
- student_transfer_documents
- student_transfer_messages
- student_transfer_status_history
- student_transfer_approvals
- student_transfer_rejections
- student_transfer_complements
- student_transfer_execution_logs
- student_transfer_audit_logs
- student_global_profiles
- student_school_enrollments
- student_school_archives
- school_transfer_policies
- school_transfer_required_documents

---

## 19. Permissions

Permissions recommandées :

- STUDENT_TRANSFER_VIEW
- STUDENT_TRANSFER_CREATE
- STUDENT_TRANSFER_SEND
- STUDENT_TRANSFER_CANCEL
- STUDENT_TRANSFER_INCOMING_VIEW
- STUDENT_TRANSFER_OUTGOING_VIEW
- STUDENT_TRANSFER_APPROVE
- STUDENT_TRANSFER_REJECT
- STUDENT_TRANSFER_REQUEST_COMPLEMENT
- STUDENT_TRANSFER_EXECUTE
- STUDENT_TRANSFER_ARCHIVE_VIEW
- STUDENT_TRANSFER_DOCUMENT_VIEW
- STUDENT_TRANSFER_DOCUMENT_MANAGE
- STUDENT_TRANSFER_SETTINGS_MANAGE

---

## 20. Notifications

Notifications à prévoir :

- demande de transfert créée ;
- demande envoyée ;
- demande reçue ;
- complément demandé ;
- complément envoyé ;
- demande acceptée ;
- demande refusée ;
- sortie confirmée ;
- transfert exécuté ;
- élève activé dans l’école B ;
- parent notifié ;
- frais générés ;
- dossier archivé.

Canaux :

- in-app ;
- email ;
- SMS ;
- WhatsApp selon configuration.

---

## 21. Sécurité et confidentialité

Mesures obligatoires :

- contrôle d’accès strict ;
- journalisation complète ;
- chiffrement des documents sensibles ;
- lien email sécurisé ;
- expiration des liens ;
- consentement parent si requis ;
- masquage des données médicales sensibles ;
- séparation des données par tenant ;
- vérification que les deux écoles sont bien autorisées ;
- impossibilité de modifier l’historique transféré sans trace ;
- archivage légal côté école A ;
- traçabilité complète côté école B.

---

## 22. UI/UX recommandée

### Côté école A

Interface en étapes :

1. Choisir élève
2. Choisir école destination
3. Préparer dossier
4. Vérifier pièces
5. Rédiger message
6. Envoyer demande
7. Suivre statut
8. Confirmer sortie

### Côté école B

Interface en étapes :

1. Demandes reçues
2. Consultation dossier
3. Analyse automatique
4. Demande complément si besoin
5. Décision
6. Affectation classe
7. Génération frais
8. Activation élève

### Composants UI

- TransferWizard
- SchoolDirectorySelector
- StudentTransferDossierPreview
- TransferStatusTimeline
- TransferMessagingThread
- TransferDecisionPanel
- TransferEligibilityChecklist
- TransferExecutionSummary
- TransferAuditTrail
- IncomingTransfersTable
- OutgoingTransfersTable

---

## 23. Statut de l’élève après transfert

### Dans l’école A

L’élève passe au statut :

- transféré sortant ;
- dossier archivé ;
- accès désactivé selon règle ;
- historique conservé ;
- certificat disponible.

### Dans l’école B

L’élève passe au statut :

- préinscrit ;
- admis ;
- actif ;
- en attente de paiement ;
- en attente de pièces ;
- affecté à une classe.

Le statut dépend de la politique de l’école B.

---

## 24. Cas particuliers

### Élève avec impayés dans l’école A

Options possibles :

- bloquer le transfert ;
- autoriser avec mention ;
- demander accord direction ;
- transférer uniquement le dossier pédagogique ;
- conserver dette côté école A.

### Élève avec dossier incomplet

Options :

- demander complément ;
- accepter sous réserve ;
- refuser ;
- mettre en attente.

### Élève refusé par l’école B

Le système conserve :

- motif ;
- date ;
- décideur ;
- message ;
- historique ;
- notification à l’école A.

### Transfert annulé

Possible tant que le transfert n’est pas exécuté.

### Erreur après transfert

Prévoir une procédure d’annulation contrôlée, réservée aux administrateurs autorisés.

---

## 25. Conclusion

Cette extension transforme l’onglet Transfert du module Élèves en un vrai système de mobilité scolaire numérique.

Academia Helm ne gère plus seulement l’inscription d’un élève dans une école. La plateforme gère désormais son parcours entre plusieurs établissements, avec traçabilité, validation, sécurité, intelligence métier et continuité administrative.

C’est une fonctionnalité différenciante majeure, car elle crée un réseau scolaire interconnecté à l’intérieur d’Academia Helm.
