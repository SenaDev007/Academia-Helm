# Cahier technique Offline-First — Academia Helm + Academia Federis

## 0. Objectif du document

Ce document définit l’architecture, les règles métier, les exigences techniques et les consignes d’implémentation de la fonctionnalité **Offline-First** pour :

- **Academia Helm** ;
- **Academia Federis** ;
- les applications web ;
- les applications mobiles ;
- les futures extensions desktop si nécessaire.

L’objectif est clair :

> Permettre à l’utilisateur de continuer à travailler même sans connexion Internet, après une première initialisation obligatoire en ligne, puis synchroniser automatiquement toutes les données locales vers la base principale dès le retour de la connexion.

Ce document doit servir de base d’implémentation pour **Google Antigravity** dans le dossier projet **Academia Helm**.

---

# 1. Décision produit officielle

Academia Helm et Academia Federis doivent fonctionner selon une architecture **Offline-First**.

Cela signifie que l’application ne doit pas seulement afficher quelques pages en cache. Elle doit réellement permettre :

- l’ouverture de l’application hors ligne après une première connexion ;
- la consultation des données déjà synchronisées ;
- la création de données locales ;
- la modification de données autorisées ;
- la mise en file d’attente des actions ;
- la synchronisation automatique au retour Internet ;
- la gestion des conflits ;
- la protection des données locales ;
- la continuité d’usage en connexion instable.

## 1.1 Règle fondamentale

```txt
Première ouverture = Internet obligatoire.
Ouvertures suivantes = fonctionnement hors ligne possible.
Retour Internet = synchronisation automatique.
```

## 1.2 Règle officielle à intégrer

```txt
La première ouverture de l’application web ou mobile nécessite obligatoirement une connexion Internet afin d’initialiser l’environnement local, l’authentification, les permissions, l’année scolaire active, les modules autorisés, les données essentielles et le moteur de synchronisation.

Après cette première initialisation, l’application doit pouvoir se rouvrir et fonctionner hors ligne dans le même navigateur ou sur le même appareil mobile, avec stockage local des actions et synchronisation automatique dès le retour de la connexion.
```

---

# 2. Contexte d’implémentation

## 2.1 État actuel

Le projet dispose déjà de certaines bases offline / PWA / cache / stockage local.

La mission n’est donc pas de tout supprimer pour recommencer.

La mission est de :

```txt
auditer l’existant ;
identifier les manques ;
peaufiner ce qui est déjà fait ;
corriger les faiblesses ;
standardiser l’approche ;
généraliser l’offline-first à tous les modules ;
renforcer la synchronisation ;
sécuriser les données locales ;
documenter les règles techniques.
```

## 2.2 Principe d’intervention

Google Antigravity doit suivre cette stratégie :

```txt
Conserver ce qui fonctionne.
Corriger ce qui est incomplet.
Remplacer uniquement ce qui est fragile.
Unifier les patterns.
Industrialiser l’architecture offline-first.
```

---

# 3. Applications concernées

La fonctionnalité Offline-First concerne :

```txt
Academia Helm Web
Academia Helm Mobile
Academia Federis Web
Academia Federis Mobile
```

Elle doit être pensée comme une couche transversale commune.

---

# 4. Architecture générale Offline-First

## 4.1 Schéma conceptuel

```txt
Application Web / Mobile
        ↓
App Shell Cache
        ↓
Local Database
        ↓
Offline Queue
        ↓
Sync Engine
        ↓
Conflict Resolver
        ↓
API Gateway
        ↓
Main Database
        ↓
Audit Logs / Notifications / File Storage
```

## 4.2 Composants techniques obligatoires

```txt
Service Worker
Cache API
IndexedDB / SQLite
Offline Queue
Sync Engine
Conflict Resolver
Local Permissions Snapshot
Local Academic Context
Local Tenant Context
Network Status Manager
Sync Status UI
Audit Log Sync
Secure Local Storage
```

---

# 5. Première connexion obligatoire

## 5.1 Objectif

La première connexion sert à initialiser l’application localement.

Sans cette première connexion, l’application ne peut pas fonctionner hors ligne, car elle ne connaît pas encore :

- l’utilisateur ;
- son tenant ;
- son école ;
- son patronat ;
- ses rôles ;
- ses permissions ;
- son année scolaire active ;
- ses modules autorisés ;
- ses données essentielles.

## 5.2 Processus de première connexion

Lors de la première ouverture avec Internet, le système doit :

```txt
1. Authentifier l’utilisateur.
2. Vérifier le tenant.
3. Vérifier l’école ou le patronat.
4. Récupérer les rôles.
5. Récupérer les permissions.
6. Récupérer l’année scolaire active.
7. Récupérer le trimestre ou la période active.
8. Récupérer les modules autorisés.
9. Installer le Service Worker.
10. Pré-cacher l’app shell.
11. Initialiser la base locale.
12. Télécharger les données essentielles.
13. Initialiser la file d’attente offline.
14. Initialiser le moteur de synchronisation.
15. Enregistrer le device ou le navigateur si nécessaire.
16. Marquer l’appareil comme offline-ready.
```

## 5.3 Message si première ouverture sans Internet

Si l’utilisateur ouvre l’application pour la toute première fois sans Internet :

```txt
Première ouverture détectée. Une connexion Internet est nécessaire pour initialiser l’application.
```

---

# 6. Ouverture hors ligne après première connexion

Après la première initialisation, l’application doit pouvoir se rouvrir hors ligne dans :

- le même navigateur ;
- la même PWA installée ;
- la même application mobile ;
- le même appareil.

## 6.1 Ce qui doit fonctionner hors ligne

L’application doit pouvoir :

```txt
charger l’interface ;
afficher le dashboard local ;
afficher les modules autorisés ;
consulter les données synchronisées ;
créer des données locales ;
modifier des données autorisées ;
préparer des documents ;
enregistrer les actions en file d’attente ;
afficher les statuts de synchronisation ;
prévenir l’utilisateur des limitations hors ligne.
```

## 6.2 Message hors ligne recommandé

```txt
Vous êtes hors ligne. L’application continue de fonctionner avec les données disponibles localement. Vos modifications seront synchronisées automatiquement dès le retour de la connexion.
```

---

# 7. Technologies recommandées

## 7.1 Application web

Pour l’application web Academia Helm / Federis :

```txt
Service Worker
Cache API
IndexedDB
Dexie.js ou LocalForage
Background Sync si disponible
PWA Manifest
Network Information API si disponible
Broadcast Channel API si nécessaire
```

## 7.2 Application mobile

Pour l’application mobile :

```txt
SQLite local
WatermelonDB ou Realm
Secure Storage
Local File System
Background Sync mobile
Push Notifications
Device Registry
```

## 7.3 Desktop éventuel

Si une version desktop est prévue :

```txt
SQLite local
File System local
Sync Engine partagé
Secure Storage
```

---

# 8. Cache applicatif

## 8.1 Objectif

Le navigateur doit pouvoir rouvrir l’application même sans Internet.

Il faut donc mettre en cache l’app shell.

## 8.2 Ressources à pré-cacher

```txt
layout principal
sidebar
header
routes principales
dashboard minimal
pages des modules autorisés
styles CSS
scripts JS critiques
icônes
logo
manifest PWA
page fallback offline
polices nécessaires
composants UI essentiels
```

## 8.3 Stratégies de cache

### App shell

```txt
Cache First
```

### Données API

```txt
Network First avec fallback local
```

### Assets statiques

```txt
Cache First avec versioning
```

### Données critiques

```txt
Local Database First puis Sync
```

### Documents

```txt
Cache on demand
```

### Vidéos

```txt
No full offline by default
Téléchargement explicite uniquement si autorisé
```

---

# 9. Base locale

## 9.1 Objectif

La base locale doit stocker les données nécessaires à l’utilisateur selon :

- son rôle ;
- son école ;
- son patronat ;
- son année scolaire ;
- ses modules ;
- ses classes ;
- ses matières ;
- ses examens ;
- ses permissions.

## 9.2 Données locales minimales communes

```txt
local_user_profile
local_tenant_context
local_school_context
local_patronat_context
local_roles
local_permissions
local_academic_year
local_academic_terms
local_modules
local_sync_queue
local_sync_logs
local_conflicts
local_files_metadata
```

## 9.3 Champs techniques obligatoires

Toute donnée locale métier doit contenir :

```txt
local_id
server_id
tenant_id
school_id / patronat_id
academic_year_id
academic_term_id
module
entity_type
created_by
updated_by
created_at
updated_at
created_offline
updated_offline
sync_status
version
last_synced_at
deleted_locally
```

## 9.4 Statuts de synchronisation

```txt
pending
syncing
synced
failed
conflict
cancelled
blocked
```

---

# 10. File d’attente offline

## 10.1 Objectif

Toute action réalisée hors ligne doit être enregistrée dans une file locale.

## 10.2 Structure d’un item de queue

```txt
id
local_id
server_id
tenant_id
school_id
patronat_id
academic_year_id
academic_term_id
user_id
module
entity_type
operation
payload
priority
status
retry_count
max_retries
created_at
updated_at
last_attempt_at
error_message
conflict_strategy
```

## 10.3 Opérations possibles

```txt
CREATE
UPDATE
DELETE_SOFT
UPLOAD
SEND_MESSAGE
SEND_NOTIFICATION
SUBMIT
VALIDATE
LOCK_REQUEST
PUBLISH_REQUEST
```

## 10.4 Priorités

```txt
HIGH
MEDIUM
LOW
BACKGROUND
```

### Priorité haute

```txt
présences
notes
incidents
PV
candidats
résultats préparatoires
actions administratives critiques
```

### Priorité moyenne

```txt
messages
documents légers
rapports
observations
devoirs
fiches pédagogiques
```

### Priorité basse

```txt
images
vidéos
fichiers lourds
archives
```

---

# 11. Synchronisation automatique

## 11.1 Déclencheurs

La synchronisation doit se lancer automatiquement :

```txt
au retour de la connexion ;
à l’ouverture de l’application ;
à intervalle régulier en ligne ;
après une action importante ;
après reconnexion utilisateur ;
sur demande manuelle.
```

## 11.2 Bouton manuel

Prévoir un bouton :

```txt
Synchroniser maintenant
```

## 11.3 Étapes de synchronisation

```txt
1. Vérifier l’état réseau.
2. Vérifier la session.
3. Rafraîchir le token si nécessaire.
4. Charger la queue locale.
5. Trier par priorité.
6. Envoyer les actions locales.
7. Recevoir les réponses serveur.
8. Mettre à jour les server_id.
9. Récupérer les mises à jour serveur.
10. Détecter les conflits.
11. Résoudre ou marquer les conflits.
12. Mettre à jour la base locale.
13. Mettre à jour les statuts UI.
14. Journaliser la synchronisation.
```

## 11.4 Synchronisation résiliente

Le moteur doit supporter :

```txt
reprise après échec ;
retry automatique ;
backoff exponentiel ;
synchronisation partielle ;
idempotence ;
détection de doublons ;
verrouillage temporaire des actions en cours ;
journalisation complète.
```

---

# 12. Gestion des conflits

## 12.1 Pourquoi

Un conflit apparaît lorsque :

```txt
une donnée a été modifiée localement hors ligne ;
la même donnée a été modifiée côté serveur ;
les deux versions ne sont pas identiques ;
la synchronisation ne peut pas décider automatiquement.
```

## 12.2 Stratégies possibles

```txt
LAST_WRITE_WINS
SERVER_WINS
CLIENT_WINS
ROLE_PRIORITY
MANUAL_REVIEW
MERGE_FIELDS
BLOCK_AND_NOTIFY
```

## 12.3 Recommandation par type de donnée

### Données simples

Exemples :

```txt
brouillon
commentaire
observation simple
note interne
```

Stratégie possible :

```txt
LAST_WRITE_WINS ou MERGE_FIELDS
```

### Données pédagogiques

Exemples :

```txt
fiche pédagogique
cahier journal
cahier de textes
devoir
exercice
observation élève
```

Stratégie recommandée :

```txt
MERGE_FIELDS si possible
MANUAL_REVIEW si conflit critique
```

### Données sensibles

Exemples :

```txt
note d’élève
résultat d’examen
délibération
dossier scolaire
transfert d’élève
discipline grave
```

Stratégie recommandée :

```txt
MANUAL_REVIEW
BLOCK_AND_NOTIFY
AUDIT_REQUIRED
```

### Données financières

Exemples :

```txt
paiement
encaissement
facture validée
abonnement
transaction
```

Stratégie recommandée :

```txt
SERVER_WINS
ONLINE_REQUIRED
NO_OFFLINE_FINALIZATION
```

---

# 13. Actions autorisées hors ligne

## 13.1 Academia Helm

Les modules suivants doivent fonctionner hors ligne autant que possible :

```txt
Élèves
Présences
Absences
Retards
Notes
Évaluations
Cahier journal
Fiches pédagogiques
Cahier de textes
Cahier de semaine
Discipline
Suivi pédagogique
Devoirs
Exercices
Travaux de maison
Observations enseignant
Rapports préparatoires
QHSE terrain
Inventaire simple
Documents déjà téléchargés
```

## 13.2 Academia Federis

Les modules suivants doivent fonctionner hors ligne autant que possible :

```txt
Écoles membres déjà synchronisées
Listes de candidats
Centres d’examen
Salles
Numéros de table
Présences aux compositions
Absences candidats
Incidents
PV de surveillance
Saisie de notes
Correction locale
Délibération préparatoire
Rapports locaux
Documents d’examen déjà téléchargés
Federis Connect en mode brouillon/local
```

---

# 14. Actions limitées ou interdites hors ligne

Certaines actions nécessitent Internet pour être finalisées.

## 14.1 Actions Internet obligatoire

```txt
paiement officiel
validation définitive de transaction
activation d’abonnement
publication officielle des résultats
notification massive parents
envoi réel SMS
envoi réel email
envoi réel WhatsApp
upload final de vidéos
streaming EduCast
création d’un nouvel utilisateur critique
changement de permissions
suppression définitive sensible
verrouillage final de délibération
synchronisation inter-patronats
```

## 14.2 Actions préparables hors ligne

Même si la finalisation nécessite Internet, l’utilisateur peut préparer :

```txt
brouillon de message
brouillon de communiqué
brouillon de facture
intention de paiement
rapport
PV
document
épreuve
devoir
fiche pédagogique
résultat préparatoire
```

---

# 15. Cas spécifique des paiements

## 15.1 Règle absolue

```txt
Aucun paiement ne devient officiel sans confirmation serveur.
```

## 15.2 Hors ligne, on peut seulement créer :

```txt
brouillon d’encaissement
intention de paiement
facture préparée
reçu provisoire non validé
note de paiement à synchroniser
```

## 15.3 Au retour Internet

Le serveur doit :

```txt
vérifier la transaction ;
confirmer le paiement ;
générer le reçu officiel ;
mettre à jour la comptabilité ;
journaliser l’action ;
notifier l’utilisateur.
```

---

# 16. Cas spécifique des vidéos et fichiers lourds

## 16.1 EduCast et vidéos

Les vidéos ne doivent pas être uploadées comme de simples fichiers.

Il faut prévoir :

```txt
upload différé
upload en morceaux
reprise après interruption
pause/reprise
compression éventuelle
statut d’envoi
priorité Wi-Fi si mobile
file d’attente basse priorité
```

## 16.2 Statuts

```txt
draft
waiting_for_connection
uploading
paused
failed
uploaded
processing
published
```

---

# 17. Cas spécifique de Federis Connect

## 17.1 Fonctionnement hors ligne

Federis Connect doit permettre hors ligne :

```txt
consultation des conversations déjà synchronisées
rédaction de messages
rédaction de communiqués
préparation de réponses
préparation de pièces jointes légères
création de brouillons
lecture des groupes déjà synchronisés
```

## 17.2 Fonctionnement nécessitant Internet

```txt
envoi réel du message
notification des destinataires
communication inter-patronats
mise à jour temps réel
accusé de réception serveur
partage effectif de documents
```

## 17.3 Statut des messages

```txt
draft
pending_sync
sending
sent
failed
conflict
cancelled
```

---

# 18. Cas spécifique d’Academia Federis pendant les examens

## 18.1 Objectif

Les centres d’examen doivent pouvoir travailler même sans connexion.

## 18.2 Actions hors ligne autorisées

```txt
consulter les listes candidats
marquer les présences
marquer les absences
signaler les retards
rédiger les incidents
remplir les PV
saisir les notes
préparer les rapports
consulter les consignes déjà téléchargées
```

## 18.3 Actions Internet obligatoire

```txt
publication officielle des résultats
verrouillage final de délibération
notification massive parents
transmission officielle finale
paiement
```

---

# 19. Année scolaire obligatoire même hors ligne

Academia Helm et Academia Federis appliquent la règle :

```txt
NO ACADEMIC YEAR = NO DATA
```

Même hors ligne, toute donnée métier doit contenir :

```txt
tenant_id
academic_year_id
academic_term_id si nécessaire
user_id
module
sync_status
created_offline
```

Si aucune année scolaire active n’a été synchronisée lors de la première connexion, aucune donnée métier ne doit être créée.

---

# 20. Sécurité hors ligne

## 20.1 Règle

Le mode offline ne doit jamais donner plus de droits à l’utilisateur.

```txt
Un utilisateur hors ligne conserve uniquement les permissions synchronisées lors de sa dernière session valide.
```

## 20.2 Mesures de sécurité

```txt
chiffrement local des données sensibles
Secure Storage pour tokens
expiration locale de session
verrouillage après inactivité
PIN / biométrie sur mobile
permissions locales signées
journalisation locale
synchronisation des logs au retour réseau
interdiction des actions critiques sans serveur
```

## 20.3 Données sensibles

À protéger strictement :

```txt
notes
résultats
paiements
dossiers élèves
documents administratifs
sujets d’examen
corrigés
barèmes
données personnelles
```

---

# 21. Audit logs offline

## 21.1 Actions à journaliser localement

```txt
création
modification
suppression locale
saisie de note
modification de présence
incident
PV
tentative de paiement
préparation de publication
connexion hors ligne
synchronisation
conflit
échec de synchronisation
```

## 21.2 Synchronisation des logs

Les logs locaux doivent être envoyés au serveur dès le retour Internet.

---

# 22. UI/UX Offline-First

## 22.1 États visibles

L’interface doit afficher clairement :

```txt
En ligne
Hors ligne
Connexion instable
Première synchronisation requise
Synchronisation en cours
Synchronisation terminée
Actions en attente
Conflits détectés
Erreur de synchronisation
Données locales uniquement
Données à jour
```

## 22.2 Badges recommandés

```txt
Mode hors ligne
En attente de synchronisation
Synchronisé
Conflit à résoudre
Action bloquée hors ligne
Connexion requise
```

## 22.3 Messages UI recommandés

```txt
Vous êtes hors ligne. Vos modifications sont enregistrées localement.
```

```txt
12 actions sont en attente de synchronisation.
```

```txt
Synchronisation terminée avec succès.
```

```txt
Un conflit a été détecté. Une validation est requise.
```

```txt
Cette action nécessite une connexion Internet.
```

---

# 23. API et backend

## 23.1 Exigences backend

Le backend doit supporter :

```txt
idempotency keys
batch sync
delta sync
versioning
updated_since
soft delete
conflict detection
server timestamps
audit logs
permission revalidation
academic year validation
tenant isolation
```

## 23.2 Routes recommandées

```txt
POST /api/sync/push
GET /api/sync/pull
POST /api/sync/batch
GET /api/sync/status
POST /api/sync/conflicts/resolve
GET /api/sync/bootstrap
POST /api/sync/device/register
POST /api/sync/logs
```

## 23.3 Bootstrap initial

Route recommandée :

```txt
GET /api/sync/bootstrap
```

Elle doit retourner :

```txt
user
tenant
school
patronat
roles
permissions
academic_year
academic_terms
modules
feature_flags
initial_data
sync_config
```

---

# 24. Modèle de données recommandé

## 24.1 Tables locales / collections locales

```txt
local_app_state
local_user_profile
local_tenant_context
local_academic_context
local_permissions
local_modules
local_entities
local_sync_queue
local_sync_logs
local_conflicts
local_file_cache
local_notifications
```

## 24.2 Tables serveur recommandées

```txt
sync_devices
sync_sessions
sync_batches
sync_conflicts
sync_audit_logs
sync_entity_versions
```

## 24.3 Table sync_devices

```txt
id
user_id
tenant_id
device_id
device_type
platform
last_seen_at
offline_ready
last_bootstrap_at
last_sync_at
status
created_at
updated_at
```

## 24.4 Table sync_conflicts

```txt
id
tenant_id
entity_type
entity_id
local_version
server_version
conflict_type
resolution_status
resolved_by
resolved_at
created_at
updated_at
```

---

# 25. Tests obligatoires

## 25.1 Tests première connexion

```txt
première ouverture avec Internet
première ouverture sans Internet
installation PWA
initialisation IndexedDB
bootstrap complet
permissions locales
année scolaire active
```

## 25.2 Tests hors ligne

```txt
ouvrir l’application sans Internet
naviguer entre modules
créer une donnée
modifier une donnée
consulter données locales
afficher les statuts
bloquer action Internet obligatoire
```

## 25.3 Tests synchronisation

```txt
retour Internet
push queue
pull updates
résolution server_id
mise à jour statuts
retry après échec
sync partielle
sync complète
```

## 25.4 Tests conflits

```txt
modification locale + modification serveur
note conflictuelle
présence conflictuelle
document conflictuelle
résolution manuelle
audit du conflit
```

## 25.5 Tests sécurité

```txt
expiration session locale
permissions révoquées
données sensibles locales
utilisateur désactivé
année scolaire verrouillée
tentative action interdite
```

---

# 26. MVP Offline-First recommandé

## 26.1 MVP Web + Mobile

À implémenter ou finaliser en priorité :

```txt
Service Worker fonctionnel
App shell cache
IndexedDB / SQLite
Bootstrap initial
Local permissions snapshot
Local academic context
Offline queue
Sync engine basique
Statuts UI
Sync automatique au retour Internet
Blocage des actions critiques
Audit logs locaux
```

## 26.2 Modules MVP prioritaires

Academia Helm :

```txt
Présences
Élèves
Notes
Cahier journal
Fiches pédagogiques
Devoirs
Discipline
```

Academia Federis :

```txt
Candidats
Centres
Présences examen
Incidents
PV
Notes
Rapports
Federis Connect brouillons
```

---

# 27. Version 2

À ajouter ensuite :

```txt
gestion avancée des conflits
delta sync optimisée
upload différé de fichiers
sync multi-device
chiffrement local renforcé
sync logs avancés
mode connexion instable
background sync avancé
résolution manuelle des conflits
```

---

# 28. Version 3

À ajouter plus tard :

```txt
sync prédictive
préchargement intelligent par rôle
assistant IA de résolution de conflits
résumé automatique des actions offline
analyse des zones à faible connectivité
optimisation réseau faible débit
sync peer-to-peer locale si pertinent
```

---

# 29. Instructions directes pour Google Antigravity

## 29.1 Mission

```txt
Auditer et peaufiner l’architecture offline-first existante dans Academia Helm.
Étendre cette architecture à Academia Federis.
Garantir que la première ouverture nécessite Internet.
Garantir que les ouvertures suivantes fonctionnent hors ligne.
Garantir que les actions locales sont synchronisées automatiquement au retour Internet.
Garantir que tous les modules critiques respectent l’année scolaire active.
Garantir que les actions sensibles sont sécurisées et journalisées.
```

## 29.2 Ne pas faire

```txt
Ne pas supprimer l’existant sans audit.
Ne pas créer un cache cosmétique uniquement.
Ne pas permettre des paiements validés hors ligne.
Ne pas permettre la publication officielle de résultats hors ligne.
Ne pas permettre des données métier sans année scolaire.
Ne pas ignorer les conflits.
Ne pas donner plus de droits hors ligne qu’en ligne.
```

## 29.3 À faire

```txt
Créer ou finaliser le Service Worker.
Créer ou finaliser le bootstrap initial.
Créer ou finaliser IndexedDB / SQLite.
Créer ou finaliser l’offline queue.
Créer ou finaliser le sync engine.
Créer ou finaliser les statuts UI.
Créer ou finaliser la gestion des conflits.
Créer ou finaliser les guards de sécurité.
Créer ou finaliser les tests offline.
Créer ou finaliser la documentation technique.
```

---

# 30. Conclusion

Academia Helm et Academia Federis doivent être conçus pour fonctionner dans des conditions réelles : connexion instable, absence temporaire d’Internet, zones rurales, centres d’examen isolés, écoles avec faible couverture réseau.

La stratégie validée est :

```txt
Première connexion obligatoire.
Initialisation locale complète.
Fonctionnement hors ligne après première ouverture.
Stockage local sécurisé.
File d’attente des actions.
Synchronisation automatique.
Gestion des conflits.
Blocage des actions critiques.
Année scolaire obligatoire.
Audit complet.
```

Cette architecture rend Academia Helm et Academia Federis beaucoup plus robustes, crédibles et adaptés au terrain.
