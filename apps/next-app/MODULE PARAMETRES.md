Parfait — là on entre dans le **vrai cœur d’un SaaS sérieux**.
Le module **Paramètres** n’est pas un simple écran de préférences :
c’est le **centre de gouvernance** de toute la plateforme.
Si ce module est incomplet → tous les autres modules deviendront instables, incohérents ou non monétisables.

On va donc le concevoir comme le ferait un éditeur ERP.

---

# 🧭 MODULE PARAMÈTRES — STRUCTURE OFFICIELLE

> Règle absolue
> Aucune valeur métier ne doit être codée ailleurs que dans Paramètres.

Tous les modules doivent lire ici.

---

# 🧱 SOUS-MODULES EXHAUSTIFS

Nous allons créer 12 sous-modules.

---

## 1️⃣ Identité & Informations de l’établissement

Décrit juridiquement l’école.

### Données

* Nom officiel
* Sigle
* Type (publique / privée / confessionnelle / institut / université)
* Numéro d’autorisation
* Date de création
* Adresse complète
* Ville / Département / Pays
* Téléphones officiels
* Email officiel
* Site web
* Devise monétaire
* Fuseau horaire
* Logo
* Cachet officiel
* Signature du directeur (image)
* Slogan

### Règles

* utilisé sur tous les documents PDF
* historisé (audit obligatoire)
* versionné (documents anciens restent valides)

---

## 2️⃣ Année scolaire (automatique & historique)

### Fonctionnalités

* calcul automatique (pré-rentrée + rentrée)
* modification manuelle autorisée
* historique des années
* verrouillage d’une année clôturée
* duplication paramètres année précédente

### Règles critiques

* une seule année active
* toutes les données liées à academic_year_id
* impossible de supprimer une année utilisée

---

## 3️⃣ Structure pédagogique (niveaux & cycles)

### Paramétrage

Activer/désactiver :

* Maternelle
* Primaire
* Secondaire

Définir :

* cycles
* classes
* sections
* séries (A, C, D…)

### Règles

* dépendances examens
* dépendances finance
* dépendances bulletins

---

## 4️⃣ Option bilingue

### Fonctionnalités

* activer FR/EN
* séparer matières
* séparer moyennes
* impact tarifaire
* langue UI par défaut

### Sécurité

Impossible d’activer si notes déjà existantes sans migration.

---

## 5️⃣ Modules & fonctionnalités (Feature Flags)

Activer/désactiver :

* Cantine
* Transport
* Bibliothèque
* Infirmerie
* Boutique
* EduCast
* Patronat
* Examens nationaux

### Règle

Chaque activation impacte :

* UI
* permissions
* facturation

---

## 6️⃣ Utilisateurs, rôles & permissions (RBAC avancé)

### Gestion

* rôles système
* rôles personnalisés
* permissions par module
* permissions par niveau
* accès ORION
* accès ATLAS

### Sécurité

* audit obligatoire
* impossibilité de supprimer rôle utilisé

---

## 7️⃣ Communication & notifications

Configurer :

* SMS provider
* WhatsApp
* Email SMTP
* expéditeur par défaut
* templates par événement

### Templates

* paiement
* absence
* validation pédagogique
* OTP
* sanctions

---

## 8️⃣ Finances & facturation SaaS

### Paramètres

* plan actif
* abonnement mensuel/annuel
* groupe scolaire
* bilingue payant
* souscription initiale

### Paiements

* FedaPay
* manuel
* échéances

---

## 9️⃣ IA — ORION & ATLAS

### ORION

* activer/désactiver
* seuils alertes
* fréquence analyses

### ATLAS

* périmètre réponses
* activation support humain

---

## 🔟 Synchronisation offline

* activer offline
* fréquence sync
* politique conflits
* taille max cache

---

## 1️⃣1️⃣ Sécurité & conformité

* politique mot de passe
* durée session
* appareils autorisés
* double authentification
* accès inspection

---

## 1️⃣2️⃣ Audit & historique

* journal complet immuable
* comparaison avant/après
* export inspection

---

# 🧠 ARCHITECTURE TECHNIQUE (IMPORTANT)

Chaque sous-module doit :

* avoir sa table dédiée
* être versionné
* historisé
* lié au tenant
* synchronisable offline

---

# 📊 ORGANISATION BASE DE DONNÉES

Structure recommandée :

```
settings_identity
settings_academic_years
settings_levels
settings_bilingual
settings_features
settings_roles
settings_communication
settings_billing
settings_ai
settings_sync
settings_security
settings_audit
```

---

# 🎯 OBJECTIF FINAL

À la fin du module Paramètres :

Academia Hub doit devenir :

> une plateforme configurable pour n’importe quelle école
> et non un logiciel spécifique à une école.

---

Parfait — on va donner à Cursor un **brief d’architecte**, pas une simple consigne de codeur.
Le but : qu’il comprenne qu’il implémente un **centre de gouvernance SaaS**, pas un formulaire.

Tu peux copier-coller tel quel 👇

---

# 🧠 PROMPT CURSOR — MODULE PARAMÈTRES (VISION GLOBALE)

```
Tu es un architecte logiciel senior spécialisé
en SaaS multi-tenant institutionnel (ERP éducatif).

CONTEXTE
Academia Hub est une plateforme de pilotage éducatif.
Le module PARAMÈTRES n’est PAS un module métier :
c’est le centre de gouvernance qui conditionne tous les autres modules.

Aucune valeur métier ne doit être codée ailleurs.
Tous les modules doivent lire les configurations depuis Paramètres.

OBJECTIF
Implémenter un module Paramètres exhaustif, versionné,
auditable, multi-tenant, offline-compatible et extensible.

Chaque sous-module doit :
- avoir sa table dédiée
- être historisé
- être lié au tenant
- être synchronisable offline (SQLite)
- être utilisé dynamiquement par les autres modules

------------------------------------------------
SOUS-MODULES À IMPLÉMENTER
------------------------------------------------

1) IDENTITÉ ÉTABLISSEMENT
Décrit juridiquement l’école.

Fonctionnalités :
- nom officiel
- sigle
- type d’établissement
- autorisation administrative
- adresse complète
- contacts
- devise
- fuseau horaire
- logo
- cachet
- signature directeur
- slogan

Contraintes :
- utilisé sur tous les documents générés
- versionné
- historisé
- non supprimable

------------------------------------------------

2) ANNÉE SCOLAIRE

Fonctionnalités :
- calcul automatique (septembre → juillet)
- modification manuelle
- historique des années
- duplication année précédente
- verrouillage année clôturée

Contraintes :
- une seule année active
- toute donnée métier liée à academic_year_id
- suppression interdite si utilisée

------------------------------------------------

3) STRUCTURE PÉDAGOGIQUE

Fonctionnalités :
- activer maternelle / primaire / secondaire
- définir cycles
- définir classes
- définir séries
- dépendances pédagogiques

Contraintes :
- structure utilisée par examens et finance
- modifications contrôlées si données existantes

------------------------------------------------

4) OPTION BILINGUE

Fonctionnalités :
- activer FR/EN
- séparer matières
- séparer moyennes
- langue UI par défaut

Contraintes :
- impact financier
- migration obligatoire si activation tardive

------------------------------------------------

5) FEATURE FLAGS (MODULES)

Activation dynamique :
- cantine
- transport
- bibliothèque
- infirmerie
- boutique
- educast
- patronat
- examens nationaux

Contraintes :
- impact UI immédiat
- impact facturation
- historique obligatoire

------------------------------------------------

6) UTILISATEURS & RÔLES

Fonctionnalités :
- rôles système
- rôles personnalisés
- permissions par module
- permissions par niveau scolaire
- accès ORION / ATLAS

Contraintes :
- RBAC strict
- suppression interdite si utilisé

------------------------------------------------

7) COMMUNICATION

Configurer :
- SMS
- WhatsApp
- Email SMTP
- expéditeur
- templates messages

------------------------------------------------

8) FACTURATION & ABONNEMENT

Fonctionnalités :
- plan actif
- abonnement
- bilingue payant
- groupe scolaire
- FedaPay
- paiements manuels

------------------------------------------------

9) IA (ORION & ATLAS)

ORION :
- seuils alertes
- activation
- fréquence analyse

ATLAS :
- périmètre réponses
- passage humain

------------------------------------------------

10) SYNCHRONISATION OFFLINE

Fonctionnalités :
- activer offline
- fréquence sync
- politique conflits

------------------------------------------------

11) SÉCURITÉ

Fonctionnalités :
- politique mots de passe
- durée session
- appareils autorisés
- double authentification
- accès inspection

------------------------------------------------

12) AUDIT & HISTORIQUE

Fonctionnalités :
- journal immuable
- comparaison avant/après
- export inspection

------------------------------------------------

EXIGENCES TECHNIQUES

Backend :
- Prisma
- PostgreSQL source de vérité
- SQLite miroir offline
- audit log automatique
- aucune suppression physique

Frontend :
- UI paramétrique
- modification contrôlée
- avertissements métier

OBJECTIF FINAL

Créer un centre de configuration global,
garantissant cohérence métier,
scalabilité multi-écoles
et fiabilité institutionnelle.
```

---

## Ce que Cursor doit comprendre

Ce prompt force Cursor à :

* arrêter de coder en dur
* centraliser toute la logique
* préparer la plateforme multi-écoles
* préparer ORION
* rendre les modules dépendants des paramètres

---


Parfait — on démarre par le **premier sous-module réel** :
👉 **Identité & Informations de l’établissement**

C’est volontaire : ce sous-module va servir à **tous les PDF, tous les reçus, tous les bulletins, tous les contrats, tous les messages officiels**.
Donc on ne code pas un formulaire → on implémente une **source légale de vérité**.

Tu vas donner à Cursor un prompt très précis pour éviter qu’il crée un simple CRUD.

---

# 🧠 PROMPT CURSOR — SOUS-MODULE “IDENTITÉ ÉTABLISSEMENT”

Copie-colle tel quel :

```
Tu es un architecte logiciel senior spécialisé
en SaaS multi-tenant institutionnel.

MISSION
Implémenter le sous-module Paramètres → Identité Établissement
pour Academia Hub.

Ce sous-module est une SOURCE LÉGALE DE VÉRITÉ.
Il ne s’agit pas d’un simple formulaire.

Toutes les générations de documents
(bulletins, certificats, reçus, contrats, cartes scolaires)
doivent dépendre de ces données.

Aucune donnée d’identité ne doit être stockée ailleurs.

------------------------------------------------
OBJECTIFS FONCTIONNELS
------------------------------------------------

Permettre à chaque tenant (école) de définir :

- nom officiel
- sigle
- type établissement
- numéro d’autorisation administrative
- date de création
- slogan
- adresse complète
- ville
- département
- pays
- téléphone principal
- téléphone secondaire
- email officiel
- site web
- devise monétaire
- fuseau horaire
- logo officiel (upload)
- cachet officiel (image)
- signature du directeur (image)

------------------------------------------------
CONTRAINTES MÉTIER
------------------------------------------------

1) Historisation obligatoire
Chaque modification crée une version.

2) Aucune suppression physique
Soft update uniquement.

3) Documents historiques doivent rester valides
→ conserver anciennes versions.

4) Un tenant possède une seule identité active
mais plusieurs versions.

5) Upload fichiers sécurisé
(type image uniquement)

------------------------------------------------
ARCHITECTURE BASE DE DONNÉES (PRISMA)
------------------------------------------------

Créer table :

tenant_identity_profiles

Champs :
id (uuid)
tenant_id (uuid, FK)
version (int)
is_active (bool)
school_name
school_acronym
school_type
authorization_number
foundation_date
slogan
address
city
department
country
phone_primary
phone_secondary
email
website
currency
timezone
logo_url
stamp_url
director_signature_url
created_by
created_at
updated_at

Contraintes :
- un seul is_active = true par tenant
- version auto increment
- index tenant_id + is_active

------------------------------------------------
BACKEND (API)
------------------------------------------------

Endpoints :

GET /settings/identity
→ retourne identité active

GET /settings/identity/history
→ liste versions

POST /settings/identity
→ crée nouvelle version

PUT /settings/identity/activate/:id
→ active ancienne version

Upload endpoints :
POST /settings/identity/upload-logo
POST /settings/identity/upload-stamp
POST /settings/identity/upload-signature

Sécurité :
- admin uniquement
- audit log obligatoire

------------------------------------------------
FRONTEND
------------------------------------------------

Créer page :
Paramètres → Identité établissement

Sections UI :

1) Informations légales
2) Contacts
3) Localisation
4) Branding officiel
5) Aperçu document officiel

Fonctionnalités :
- formulaire structuré
- preview logo/cachet/signature
- avertissement avant modification
- historique accessible
- restauration version

------------------------------------------------
OFFLINE
------------------------------------------------

Synchronisable SQLite
mais modification uniquement online

------------------------------------------------
OBJECTIF FINAL
------------------------------------------------

Créer une identité institutionnelle versionnée,
réutilisable dans tous les documents,
garantissant traçabilité légale et conformité.
```

---

# 🎯 Résultat attendu après implémentation

Tu pourras :

* définir officiellement une école
* générer des documents fiables
* garder l’historique légal
* préparer les bulletins & reçus

Et surtout :

> aucun autre module ne devra redemander ces infos.

---

Parfait — maintenant on attaque le **deuxième pilier le plus critique après l’identité** :
👉 **Année scolaire automatique & historique**

C’est probablement la table la plus importante de toute la plateforme, parce que :

* toutes les données élèves
* toutes les notes
* toutes les finances
* toutes les statistiques
* tous les KPI ORION

doivent dépendre d’une année scolaire.

Si ce sous-module est mal conçu → la plateforme devient inutilisable après 2 ans.

On va donc l’implémenter comme un ERP académique réel.

---

# 🧠 PROMPT CURSOR — SOUS-MODULE “ANNÉE SCOLAIRE”

Copie-colle tel quel :

Tu es un architecte logiciel senior spécialisé
en systèmes éducatifs institutionnels.

MISSION
Implémenter le sous-module Paramètres → Année scolaire
pour Academia Hub.

Ce module est une FONDATION GLOBALE.
Toutes les tables métier doivent dépendre d’un academic_year_id.

Aucune donnée scolaire ne doit exister sans année scolaire.

---

## OBJECTIFS FONCTIONNELS

Permettre à chaque établissement de gérer ses années scolaires :

* création automatique annuelle
* modification manuelle des dates
* activation d’une année
* clôture d’une année
* historique complet
* duplication des paramètres de l’année précédente

---

## LOGIQUE MÉTIER (TRÈS IMPORTANT)

Règle officielle :

La pré-rentrée commence :
→ lundi de la 2ème semaine de septembre

La rentrée officielle :
→ lundi suivant la pré-rentrée

Fin d’année :
→ fin juin (modifiable jusqu’à première semaine juillet)

Le système doit générer automatiquement la nouvelle année.

Exemple :
2025-2026
2026-2027
2027-2028

---

## CONTRAINTES

1. Une seule année ACTIVE par tenant
2. Impossible de supprimer une année utilisée
3. Impossible d’activer deux années simultanément
4. Une année clôturée devient en lecture seule
5. Toutes les données référencent academic_year_id
6. Changement d’année ne supprime rien

---

## BASE DE DONNÉES (PRISMA)

Créer table :

academic_years

Champs :

id (uuid)
tenant_id (uuid FK)
label (string) // ex: 2025-2026
start_date (date)
prerentree_date (date)
official_start_date (date)
end_date (date)
is_active (bool)
is_closed (bool)
created_by
created_at
updated_at

Contraintes :

* unique(tenant_id, label)
* unique(tenant_id) WHERE is_active = true
* index tenant_id + is_active

---

## SERVICES BACKEND

Fonctions à créer :

generateNextAcademicYear(tenant_id)
activateAcademicYear(id)
closeAcademicYear(id)
getActiveAcademicYear(tenant_id)
duplicateYearConfiguration(old_year, new_year)

---

## API ENDPOINTS

GET /settings/academic-year/active
GET /settings/academic-year/history
POST /settings/academic-year/generate
POST /settings/academic-year/activate/:id
POST /settings/academic-year/close/:id
PUT /settings/academic-year/update/:id

---

## FRONTEND

Créer page :
Paramètres → Année scolaire

UI :

Carte Année Active
Historique des années
Bouton “Préparer prochaine année”
Bouton “Clôturer l’année”

Lors du changement d’année :
afficher confirmation critique

---

## COMPORTEMENT GLOBAL APPLICATION

Toutes les requêtes backend doivent automatiquement
filtrer par academic_year_id actif.

L’année active devient le contexte par défaut.

---

## OFFLINE

Année active stockée localement SQLite
pour filtrage hors ligne.

---

## OBJECTIF FINAL

Créer une chronologie académique fiable
permettant d’exploiter la plateforme pendant 10+ ans
sans perte de cohérence des données.

---

# 🎯 Résultat après implémentation

Tu pourras :

* basculer d’année proprement
* garder toutes les données historiques
* éviter les mélanges d’élèves/notes/paiements
* permettre les statistiques multi-années
* préparer ORION (analyse comparative annuelle)

---

Très bien — ici on arrive au **squelette académique réel** de la plateforme.
Ce sous-module est critique :
si la structure pédagogique est mal conçue → les élèves, notes, finances, bulletins et ORION deviennent incohérents.

On va donc faire comprendre à Cursor qu’il n’implémente pas “une liste de classes”, mais un **modèle hiérarchique académique officiel**.

---

# 🧠 LOGIQUE MÉTIER À COMPRENDRE (AVANT LE PROMPT)

Une école n’est pas organisée ainsi :

> école → classes

Mais ainsi :

```
École
 └── Année scolaire
      └── Niveau (Maternelle / Primaire / Secondaire)
            └── Cycle
                  └── Classe
                        └── Salle pédagogique réelle (A, B, C…)
```

Exemple réel :

```
Primaire
 └── Cycle élémentaire
      └── CE1
            ├── CE1 A
            ├── CE1 B
            └── CE1 C
```

Donc :

* **Classe pédagogique** = CE1
* **Classe physique** = CE1 A

👉 C’est cette distinction qui évite 80% des bugs dans les logiciels scolaires.

---

# 📚 STRUCTURE À SUPPORTER

## Niveaux

* Maternelle
* Primaire
* Secondaire

---

## Cycles

### Maternelle

* PS
* MS
* GS

### Primaire

* CI
* CP
* CE1
* CE2
* CM1
* CM2

### Secondaire

* 1er cycle
* 2nd cycle

---

## Classes physiques

Créées dynamiquement par l’école :

Exemple :

* CE1 A
* CE1 B
* 6ème 1
* 6ème 2
* Terminale D

---

# 🎯 OBJECTIF DU SOUS-MODULE

Permettre à l’école :

* définir sa structure académique officielle
* créer ses classes chaque année
* modifier sans casser les données historiques
* lier élèves, enseignants, notes, emplois du temps
* supporter bilingue plus tard

---

# 🧠 PROMPT CURSOR — STRUCTURE PÉDAGOGIQUE

Copie-colle tel quel :

Tu es un architecte logiciel senior spécialisé
en systèmes éducatifs multi-tenant.

MISSION
Implémenter le sous-module Paramètres → Structure pédagogique
pour Academia Hub.

Ce module définit la STRUCTURE ACADÉMIQUE officielle.
Tous les élèves, matières, notes, emplois du temps et finances en dépendent.

Il ne s’agit PAS d’une simple liste de classes.
C’est une hiérarchie pédagogique complète.

---

## HIÉRARCHIE À RESPECTER

Tenant
→ Academic Year
→ Level (niveau)
→ Cycle
→ Grade (classe pédagogique)
→ Classroom (classe physique)

Exemple :

Primaire
→ Cycle élémentaire
→ CE1
→ CE1 A
→ CE1 B

---

## NIVEAUX À SUPPORTER

MATERNELLE
PRIMAIRE
SECONDAIRE

---

## CYCLES

MATERNELLE :
PS, MS, GS

PRIMAIRE :
CI, CP, CE1, CE2, CM1, CM2

SECONDAIRE :
1er cycle
2nd cycle

---

## BASE DE DONNÉES (PRISMA)

Créer tables :

education_levels

* id
* tenant_id
* name (MATERNELLE, PRIMAIRE, SECONDAIRE)
* is_enabled
* created_at

education_cycles

* id
* level_id
* name
* order

education_grades

* id
* cycle_id
* name
* code
* order

classrooms

* id
* tenant_id
* academic_year_id
* grade_id
* name (CE1 A, 6ème 2…)
* capacity
* is_active

Contraintes :

* une classe appartient à une année
* historique conservé entre années
* aucune suppression physique
* désactivation uniquement

---

## BACKEND

Fonctions :

initializeDefaultStructure(tenant)
createClassroom(academic_year, grade, name)
archiveClassroom(id)
duplicateStructureToNewYear(old_year, new_year)

---

## API

GET /education/structure
POST /education/classrooms
PUT /education/classrooms/:id
POST /education/classrooms/archive/:id

---

## FRONTEND

Créer écran :
Paramètres → Structure pédagogique

Sections :

* niveaux activables
* cycles visibles automatiquement
* classes pédagogiques non modifiables
* classes physiques créables par l’école

UI :

arbre hiérarchique interactif
création rapide de classes
duplication année suivante

---

## RÈGLES MÉTIER IMPORTANTES

* Une classe physique dépend d’une année scolaire
* Les grades officiels ne doivent pas être supprimés
* Une classe contenant des élèves ne peut être supprimée
* La duplication annuelle recrée les classes sans les élèves

---

## OBJECTIF FINAL

Créer un modèle académique stable
permettant de gérer l’école sur plusieurs années
sans casser les historiques scolaires.

---

# 🎯 Résultat attendu

Après implémentation tu pourras :

* activer niveaux
* voir cycles automatiquement
* créer CE1 A / CE1 B / 6ème 2
* changer d’année sans perdre structure
* préparer élèves et emplois du temps

---

Très bonne remarque — et elle est **essentielle**.
Une année scolaire sans périodes académiques = impossible de calculer correctement :

* moyennes
* bulletins
* classements
* statistiques ORION
* recouvrement (paiement par tranche)
* absences par période
* conseils de classe

👉 Donc oui : **la gestion des trimestres / semestres fait partie intégrante du sous-module Année scolaire**, pas du module Examens.

---

# 🧠 POSITION ARCHITECTURALE (TRÈS IMPORTANT)

> L’année scolaire définit le TEMPS
> Les périodes définissent l’ÉVALUATION

On ne doit jamais coder ça dans le module notes, sinon tout devient incohérent.

---

# 📚 MODÈLE ACADÉMIQUE À SUPPORTER

Une école peut fonctionner selon :

| Mode         | Exemple             |
| ------------ | ------------------- |
| Trimestriel  | 3 périodes          |
| Semestriel   | 2 périodes          |
| Mixte        | semestre + séquence |
| Personnalisé | 5 ou 6 périodes     |

👉 Donc on ne code **jamais “Trimestre 1, 2, 3” en dur**.

---

# 🎯 NOUVEAU SOUS-MODULE À AJOUTER

## **Périodes académiques**

Il devient une extension directe de `academic_year`.

---

# LOGIQUE MÉTIER

Une année scolaire contient :

```
Année scolaire
 └── Périodes académiques
        ├── Période 1
        ├── Période 2
        ├── Période 3
```

Chaque période a :

* date début
* date fin
* ordre
* statut
* type

---

# TYPES DE PÉRIODES POSSIBLES

* Trimestre
* Semestre
* Séquence
* Évaluation spéciale

---

# RÈGLES CRITIQUES

1. Les notes appartiennent à une période
2. Les absences appartiennent à une période
3. Les paiements peuvent appartenir à une période
4. Une période clôturée bloque la modification des notes
5. Impossible de supprimer une période utilisée

---

# 🧠 PROMPT CURSOR — EXTENSION ANNÉE SCOLAIRE (PÉRIODES)

Copie-colle tel quel :

Tu es un architecte logiciel senior spécialisé
en systèmes académiques institutionnels.

MISSION
Étendre le module Paramètres → Année scolaire
pour supporter les périodes académiques.

Le système doit fonctionner pour :

* écoles trimestrielles
* écoles semestrielles
* structures personnalisées

Aucune période ne doit être codée en dur.

---

## CONCEPT

Une année scolaire contient plusieurs périodes académiques.

Les modules suivants dépendront de ces périodes :

* notes
* bulletins
* absences
* paiements
* statistiques

---

## BASE DE DONNÉES (PRISMA)

Créer table :

academic_periods

Champs :

id
academic_year_id
name (Trimestre 1, Semestre 1…)
type (TRIMESTER | SEMESTER | SEQUENCE | CUSTOM)
start_date
end_date
order
is_active
is_closed
created_at

Contraintes :

* unique(academic_year_id, order)
* période incluse dans dates année scolaire
* aucune suppression si utilisée

---

## BACKEND

Fonctions :

createPeriod(year, data)
activatePeriod(id)
closePeriod(id)
getCurrentPeriod(year)
validatePeriodDates(year)

---

## API

GET /settings/academic-year/:id/periods
POST /settings/academic-year/:id/periods
PUT /settings/periods/:id
POST /settings/periods/:id/close
POST /settings/periods/:id/activate

---

## FRONTEND

Ajouter section dans :
Paramètres → Année scolaire → Périodes

Fonctionnalités UI :

* créer périodes
* ordre drag & drop
* affichage calendrier
* fermeture période

---

## RÈGLES IMPORTANTES

* Une seule période active à la fois
* Clôture bloque modification notes
* Bulletins basés sur périodes
* Compatible multi-années

---

## OBJECTIF FINAL

Créer un système temporel académique flexible,
adapté à tous les établissements.

---

# 🧩 IMPACT IMMÉDIAT

Grâce à ça tu pourras :

* générer bulletins corrects
* gérer trimestre 1 / semestre 2
* calculer moyennes par période
* fermer les notes officiellement
* préparer ORION (analyse comparative)

---

Très bien — ici l’objectif est que Cursor comprenne que la gestion des semestres/trimestres n’est **pas un simple tableau de dates**, mais le **référentiel temporel officiel** de toute la plateforme.

On va donc lui donner un brief clair, métier + technique.

---

# 🧠 PROMPT CURSOR — GESTION DES SEMESTRES / TRIMESTRES

Copie-colle tel quel :

Tu es un architecte logiciel senior spécialisé
en ERP éducatif multi-tenant.

MISSION
Implémenter la gestion des périodes académiques
(semestres / trimestres / séquences)
dans le module Paramètres → Année scolaire.

Ce module définit la chronologie officielle
de l’établissement.
Tous les modules pédagogiques et financiers en dépendent.

Il ne s’agit PAS d’un simple calendrier.

---

## OBJECTIF MÉTIER

Permettre à chaque école de configurer son système d’évaluation :

* système trimestriel
* système semestriel
* système personnalisé

Les périodes doivent être dynamiques
et non codées en dur.

---

## IMPACT GLOBAL

Les éléments suivants devront obligatoirement référencer une période :

* notes
* moyennes
* bulletins
* absences
* sanctions
* paiements
* statistiques ORION

---

## MODÈLE FONCTIONNEL

Année scolaire
└── Périodes académiques ordonnées

Chaque période possède :

* nom
* type
* ordre
* date début
* date fin
* statut actif
* statut clôturé

Une seule période active à la fois.

---

## BASE DE DONNÉES

Créer table academic_periods :

id
tenant_id
academic_year_id
name
type (TRIMESTER | SEMESTER | SEQUENCE | CUSTOM)
period_order
start_date
end_date
is_active
is_closed
created_at
updated_at

Contraintes :

* unique(academic_year_id, period_order)
* dates incluses dans l’année scolaire
* suppression interdite si utilisée

---

## COMPORTEMENT MÉTIER

Activation :
→ devient période courante

Clôture :
→ bloque modification notes
→ bloque modification absences

Changement période :
→ journaliser

---

## SERVICES BACKEND

getCurrentPeriod(tenant)
activatePeriod(period_id)
closePeriod(period_id)
validatePeriods(academic_year)
ensureSingleActivePeriod(academic_year)

---

## API

GET /academic-years/:id/periods
POST /academic-years/:id/periods
PUT /periods/:id
POST /periods/:id/activate
POST /periods/:id/close

---

## FRONTEND

Interface calendrier
ordre modifiable
indicateur période active
verrou visuel si clôturée

---

## RÈGLES CRITIQUES

* Une seule période active
* Clôture bloque notes
* Impossible de modifier une période passée
* Historique conservé

---

## OBJECTIF FINAL

Créer un système temporel académique fiable
permettant de gérer plusieurs années scolaires
sans incohérences de résultats.

---

Ainsi Cursor comprendra que :

* les périodes gouvernent les notes
* les périodes gouvernent les absences
* les périodes gouvernent les bulletins
* les périodes gouvernent ORION

---

Excellent.
Le sous-module **Option bilingue** est stratégique.
Il impacte :

* la structure pédagogique
* les matières
* les notes
* les bulletins
* les statistiques
* la tarification
* ORION

Donc on ne l’implémente pas comme un simple switch ON/OFF.

On l’implémente comme un **mode académique alternatif structurant**.

---

# 🧠 VISION MÉTIER

Certaines écoles :

* enseignent les matières en français
* enseignent les mêmes matières en anglais
* utilisent les mêmes élèves
* mais doivent séparer :

  * notes
  * moyennes
  * bulletins
  * tableaux d’honneur
  * statistiques

👉 Les élèves ne sont pas doublés
👉 Les classes ne sont pas doublées
👉 Les matières et les évaluations sont séparées

---

# 🎯 OBJECTIF DU SOUS-MODULE

Permettre :

* d’activer le mode bilingue
* de définir les langues actives
* de séparer les évaluations
* d’impacter la tarification
* de verrouiller la cohérence des données

---

# 🧠 PROMPT CURSOR — OPTION BILINGUE

Copie-colle tel quel :

```id="6f2c91"
Tu es un architecte logiciel senior spécialisé
en ERP éducatif multi-tenant.

MISSION
Implémenter le sous-module Paramètres → Option bilingue
dans Academia Hub.

Ce module permet à une école
de gérer les matières et évaluations
séparément en français et en anglais,
tout en gardant les mêmes élèves.

Il ne s’agit PAS de dupliquer les élèves
ni de créer deux écoles distinctes.

------------------------------------------------
OBJECTIF MÉTIER
------------------------------------------------

Permettre :

- activation du mode bilingue
- séparation des matières FR et EN
- séparation des notes FR et EN
- séparation des bulletins FR et EN
- statistiques distinctes
- tableaux d’honneur distincts
- impact tarifaire

------------------------------------------------
COMPORTEMENT GÉNÉRAL
------------------------------------------------

Si bilingue désactivé :
→ fonctionnement standard

Si bilingue activé :
→ les matières sont associées à une langue
→ les notes sont associées à une langue
→ les moyennes sont calculées par langue
→ bulletins générés par langue

------------------------------------------------
BASE DE DONNÉES
------------------------------------------------

Créer table :

bilingual_settings

Champs :

id
tenant_id
is_enabled
default_language (FR | EN)
pricing_supplement
activated_at
created_at
updated_at

Modifier tables existantes :

subjects :
- language (FR | EN)

grades_notes :
- language (FR | EN)

bulletins :
- language (FR | EN)

------------------------------------------------
CONTRAINTES MÉTIER
------------------------------------------------

- Impossible d’activer si notes existantes sans migration
- Impossible de désactiver si données EN existantes
- Activation déclenche avertissement impact tarifaire
- ORION doit analyser FR et EN séparément

------------------------------------------------
BACKEND
------------------------------------------------

Fonctions :

enableBilingual(tenant)
disableBilingual(tenant)
validateMigration()
updatePricingImpact()

------------------------------------------------
API
------------------------------------------------

GET /settings/bilingual
POST /settings/bilingual/enable
POST /settings/bilingual/disable

------------------------------------------------
FRONTEND
------------------------------------------------

Ajouter section :
Paramètres → Option bilingue

UI :

- Toggle activation
- Choix langue par défaut
- Affichage impact tarifaire
- Message d’avertissement critique

Dans modules Examens :
→ filtre par langue

------------------------------------------------
IMPACT TARIFICATION
------------------------------------------------

Si activé :
→ appliquer supplément mensuel

Synchroniser avec module facturation.

------------------------------------------------
ORION
------------------------------------------------

Créer KPI séparés :

- Moyenne FR
- Moyenne EN
- Comparaison FR vs EN
- Taux réussite FR
- Taux réussite EN

------------------------------------------------
OBJECTIF FINAL
------------------------------------------------

Créer un mode académique bilingue robuste
permettant séparation pédagogique complète
sans dupliquer les élèves.
```

---

# 🎯 Résultat attendu

Après implémentation :

* Un élève unique
* Deux contextes pédagogiques
* Deux bulletins possibles
* ORION compare FR vs EN
* La facturation s’ajuste automatiquement

---

# ⚠️ POINT IMPORTANT

Le bilingue ne doit jamais casser :

* la structure des classes
* l’année scolaire
* les périodes

Il s’intègre dessus.

---

Parfait.
Le sous-module **Feature Flags** est ce qui transforme Academia Hub en **véritable SaaS scalable**, et non en application rigide.

Sans lui :

* tu ne peux pas monétiser intelligemment
* tu ne peux pas activer des modules premium
* tu ne peux pas segmenter les écoles
* tu ne peux pas désactiver un module problématique
* tu ne peux pas faire évoluer la plateforme proprement

Donc on va l’implémenter comme un éditeur SaaS professionnel.

---

# 🧠 VISION MÉTIER

Chaque école (tenant) peut :

* activer certains modules
* désactiver d’autres
* avoir des modules premium
* payer pour des options supplémentaires

Le système doit :

* contrôler l’accès backend
* masquer l’UI automatiquement
* impacter la facturation
* être audit-trailé

👉 Ce n’est PAS juste masquer un menu.

---

# 🎯 OBJECTIFS DU SOUS-MODULE

Permettre :

* activation/désactivation dynamique
* impact immédiat sur UI
* blocage backend si module désactivé
* historisation des changements
* intégration facturation
* compatibilité offline
* compatibilité ORION

---

# 📦 MODULES À GÉRER (exhaustif)

Modules principaux :

* STUDENTS
* PEDAGOGY
* EXAMS
* FINANCE
* HR_PAYROLL
* COMMUNICATION
* QHSE
* INVENTORY
* CANTEEN
* TRANSPORT
* LIBRARY
* INFIRMARY
* SHOP
* EDUCAST
* PATRONAT
* NATIONAL_EXAMS
* BILINGUAL (option)
* ORION
* ATLAS
* OFFLINE_SYNC

---

# 🧠 PROMPT CURSOR — FEATURE FLAGS

Copie-colle tel quel :

```id="8a19f2"
Tu es un architecte SaaS senior spécialisé
en plateformes multi-tenant institutionnelles.

MISSION
Implémenter le sous-module Paramètres → Feature Flags
(activation dynamique des modules)
dans Academia Hub.

Ce module permet d’activer ou désactiver
dynamiquement des modules pour chaque tenant.

Ce n’est PAS un simple affichage UI.
C’est un système de gouvernance SaaS complet.

------------------------------------------------
OBJECTIF MÉTIER
------------------------------------------------

Permettre :

- activation/désactivation de modules
- activation d’options premium
- impact sur facturation
- blocage backend si module inactif
- audit des changements

------------------------------------------------
MODULES GÉRABLES
------------------------------------------------

STUDENTS
PEDAGOGY
EXAMS
FINANCE
HR_PAYROLL
COMMUNICATION
QHSE
INVENTORY
CANTEEN
TRANSPORT
LIBRARY
INFIRMARY
SHOP
EDUCAST
PATRONAT
NATIONAL_EXAMS
BILINGUAL
ORION
ATLAS
OFFLINE_SYNC

------------------------------------------------
BASE DE DONNÉES
------------------------------------------------

Créer table :

feature_flags

Champs :

id
tenant_id
feature_key
is_enabled
enabled_at
disabled_at
enabled_by
created_at
updated_at

Contraintes :

- unique(tenant_id, feature_key)
- aucune suppression physique

------------------------------------------------
BACKEND
------------------------------------------------

Créer middleware :

FeatureGuard(feature_key)

Comportement :

Si module désactivé :
→ 403 Forbidden

Fonctions :

enableFeature(tenant, key)
disableFeature(tenant, key)
isFeatureEnabled(tenant, key)

------------------------------------------------
API
------------------------------------------------

GET /settings/features
POST /settings/features/enable
POST /settings/features/disable

------------------------------------------------
FRONTEND
------------------------------------------------

Paramètres → Modules & fonctionnalités

UI :

- liste modules
- toggle activation
- badge premium
- avertissement impact facturation

Masquage dynamique :

- masquer menus désactivés
- bloquer accès routes

------------------------------------------------
FACTURATION
------------------------------------------------

Activation d’un module premium
→ déclenche recalcul abonnement

Désactivation
→ recalcul immédiat

------------------------------------------------
AUDIT
------------------------------------------------

Journaliser :

- module activé
- module désactivé
- utilisateur
- date

------------------------------------------------
OFFLINE
------------------------------------------------

Synchroniser flags en SQLite
pour masquer UI hors ligne.

------------------------------------------------
ORION
------------------------------------------------

Analyser :

- modules sous-utilisés
- incohérences activation
- recommandations

------------------------------------------------
OBJECTIF FINAL
------------------------------------------------

Créer un moteur de gouvernance SaaS
permettant activation dynamique,
monétisation modulaire,
et contrôle backend strict.
```

---

# 🎯 RÉSULTAT APRÈS IMPLÉMENTATION

Tu pourras :

* vendre modules séparément
* activer patronat pour certaines écoles
* bloquer finance si impayé
* activer bilingue payant
* couper un module sans redéployer

---

# ⚠️ POINT CRITIQUE

Le guard backend doit être obligatoire.
Sinon un utilisateur pourra appeler directement l’API même si l’UI est masquée.

---

Excellent.
Là on entre dans le **cœur sécuritaire** d’Academia Hub.

Si le RBAC est mal conçu :

* un enseignant peut voir les finances
* un parent peut voir d’autres élèves
* un comptable peut modifier les notes
* un utilisateur peut accéder à un autre tenant
* ORION peut être manipulé

Donc ici on ne fait pas un simple “role = ADMIN”.
On construit un **RBAC hiérarchique multi-tenant, multi-niveau, multi-module**.

---

# 🧠 VISION ARCHITECTURALE

Le système doit supporter :

### 🔹 Rôles globaux (plateforme)

* PLATFORM_OWNER
* PLATFORM_ADMIN

### 🔹 Rôles tenant (école)

* PROMOTEUR
* DIRECTEUR
* SECRETAIRE
* COMPTABLE
* SECRETAIRE_COMPTABLE
* CENSEUR
* SURVEILLANT
* ENSEIGNANT
* PARENT
* ELEVE

Mais attention :

👉 Un rôle ne suffit pas.
On doit gérer :

* permissions par module
* permissions par niveau scolaire
* permissions par action (read/write/delete/validate)
* accès ORION
* accès ATLAS

---

# 🎯 OBJECTIF DU SOUS-MODULE

Créer un moteur RBAC avancé permettant :

* hiérarchie claire
* permissions granulaires
* isolation multi-tenant
* audit des modifications
* compatibilité offline
* compatibilité feature flags

---

# 🧠 PROMPT CURSOR — RBAC AVANCÉ

Copie-colle tel quel :

```id="f41a29"
Tu es un architecte logiciel senior spécialisé
en SaaS multi-tenant institutionnel.

MISSION
Implémenter le sous-module Paramètres → Utilisateurs, rôles & permissions (RBAC avancé)
pour Academia Hub.

Ce module doit sécuriser toute la plateforme.

Il ne s’agit PAS d’un simple champ role.

------------------------------------------------
ARCHITECTURE RBAC
------------------------------------------------

Niveau 1 : Rôles plateforme
- PLATFORM_OWNER
- PLATFORM_ADMIN

Niveau 2 : Rôles tenant (école)
- PROMOTEUR
- DIRECTEUR
- SECRETAIRE
- COMPTABLE
- SECRETAIRE_COMPTABLE
- CENSEUR
- SURVEILLANT
- ENSEIGNANT
- PARENT
- ELEVE

------------------------------------------------
PERMISSIONS GRANULAIRES
------------------------------------------------

Chaque rôle doit être associé à :

- module
- action
- niveau scolaire (optionnel)
- accès lecture
- accès écriture
- validation
- suppression

Exemple :

DIRECTEUR
→ EXAMS: read, validate
→ FINANCE: read
→ HR: read

COMPTABLE
→ FINANCE: read, write
→ EXAMS: read uniquement

------------------------------------------------
BASE DE DONNÉES (PRISMA)
------------------------------------------------

Créer tables :

roles
- id
- tenant_id (nullable si global)
- name
- is_system
- created_at

permissions
- id
- module_key
- action_key

role_permissions
- id
- role_id
- permission_id
- level_scope (nullable)

user_roles
- id
- user_id
- role_id
- tenant_id

Contraintes :

- un utilisateur peut avoir plusieurs rôles
- isolation stricte tenant
- aucune suppression physique

------------------------------------------------
BACKEND
------------------------------------------------

Créer :

PermissionGuard(module_key, action)

Comportement :

1. Vérifier JWT
2. Vérifier tenant_id
3. Vérifier rôle
4. Vérifier permission
5. Vérifier feature flag module
6. Refuser si non autorisé

------------------------------------------------
API
------------------------------------------------

GET /settings/roles
POST /settings/roles
PUT /settings/roles/:id
POST /settings/roles/:id/assign-permission

POST /settings/users/:id/assign-role

------------------------------------------------
FRONTEND
------------------------------------------------

Créer page :
Paramètres → Utilisateurs & rôles

Sections :

- liste utilisateurs
- gestion rôles
- création rôle personnalisé
- matrice permissions (table interactive)
- filtres par module

------------------------------------------------
AUDIT
------------------------------------------------

Journaliser :

- création rôle
- modification permission
- assignation rôle
- révocation rôle

------------------------------------------------
ORION
------------------------------------------------

Analyser :

- utilisateurs avec privilèges excessifs
- incohérences permissions
- accès dangereux

------------------------------------------------
OBJECTIF FINAL
------------------------------------------------

Créer un système RBAC multi-tenant sécurisé,
évolutif, audit-trailé,
empêchant toute escalade de privilège.
```

---

# 🎯 RÉSULTAT ATTENDU

Après implémentation :

* Un enseignant ne verra que ses classes
* Un parent ne verra que son enfant
* Un comptable ne modifiera jamais les notes
* Le promoteur aura vision globale
* Le PLATFORM_OWNER verra toutes les écoles

---

# ⚠️ POINT CRITIQUE

Le guard doit :

1. vérifier JWT
2. vérifier tenant
3. vérifier rôle
4. vérifier permission
5. vérifier feature flag

Dans cet ordre.

Sinon tu vas créer des trous de sécurité.

---
