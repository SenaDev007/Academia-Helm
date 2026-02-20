# Analyse du module Paramètres

**Date :** 14 février 2025  
**Périmètre :** Page Paramètres (`/app/settings`), sous-pages, composants et APIs associés.

---

## 1. Vue d’ensemble

Le module Paramètres est le **centre de contrôle** de l’application (identité établissement, fonctionnalités, sécurité, IA, cachets, signatures, offline, historique).  
La page principale est une **single-page avec onglets** ; les données sont chargées au montage mais **aucun appel API n’est effectué** côté page (TODO explicite dans le code).

---

## 2. Structure actuelle

### 2.1 Routes et fichiers

| Route / Fichier | Rôle |
|-----------------|------|
| `app/app/settings/page.tsx` | Page principale Paramètres (onglets) |
| `app/app/settings/billing/page.tsx` | Facturation (wrapper vers `BillingHistoryPage`) |
| `components/settings/AdministrativeSealsManagement.tsx` | Gestion des cachets (liste, CRUD, versions, usage) |
| `components/settings/ElectronicSignaturesManagement.tsx` | Gestion des signatures électroniques |
| `components/settings/PedagogicalOptionsSettings.tsx` | Options pédagogiques (ex. BILINGUAL_TRACK) — **non utilisé** dans la page Paramètres |

### 2.2 Onglets de la page Paramètres

| Id | Label | Contenu actuel |
|----|--------|----------------|
| `general` | Général & Identité | Formulaire (nom, timezone, langue, devise) — non branché API, bouton Enregistrer sans handler |
| `features` | Modules & Fonctionnalités | Liste de features (tableau `features` vide par défaut) — toggles sans handlers |
| `security` | Sécurité & Conformité | Longueur mot de passe, durée session — non branché API |
| `seals` | Cachets & Signatures | Sous-onglets Cachets / Signatures ; **bug** : clic « Signatures Électroniques » met `activeTab = 'signatures'` qui n’existe pas → contenu vide |
| `orion` | IA ORION | Toggle Activer ORION — non branché API |
| `atlas` | IA ATLAS | Toggle Activer ATLAS — non branché API |
| `offline` | Synchronisation Offline | Toggle — non branché API |
| `history` | Historique & Audit | Liste `history` (vide) — non branché API |

---

## 3. APIs disponibles

### 3.1 Backend (api-server)

Le contrôleur `settings.controller.ts` expose (tous sous JWT) :

- **General** : `GET/PUT /api/settings/general`
- **Features** : `GET /api/settings/features`, `GET features/billing-impact`, `GET/POST features/:code/enable|disable`
- **Security** : `GET/PUT /api/settings/security`
- **Orion** : `GET/PUT /api/settings/orion`
- **Atlas** : `GET/PUT /api/settings/atlas`
- **Offline-sync** : `GET/PUT /api/settings/offline-sync`
- **History** : `GET /api/settings/history` (query: category, key, startDate, endDate, limit)
- **Administrative seals** : CRUD, versions, usage, activate/deactivate
- **Electronic signatures** : CRUD, sign-document, revoke, verify, documents/history

### 3.2 Proxies Next.js (web-app)

Les routes sous `app/api/settings/` font proxy vers le backend (general, features, security, orion, atlas, offline-sync, history, administrative-seals, electronic-signatures, etc.).  
Les appels côté client utilisent parfois `Authorization: Bearer ${localStorage.getItem('token')}` alors que l’auth est gérée par **cookies** (`/api/auth/me`) — à aligner.

---

## 4. Points bloquants et incohérences

### 4.1 Données jamais chargées ni sauvegardées

- `loadSettings()` dans `settings/page.tsx` est vide (TODO) : aucun `fetch` vers `/api/settings/general`, `features`, `security`, etc.
- Les formulaires utilisent `defaultValue` / `default` avec des états initialement `null` ou `[]`, donc champs vides.
- Les boutons « Enregistrer » n’ont pas d’`onClick` : aucune sauvegarde.

### 4.2 Onglet Cachets & Signatures

- Deux sous-boutons dans l’onglet `seals` : « Cachets Administratifs » et « Signatures Électroniques ».
- Clic sur « Signatures Électroniques » appelle `setActiveTab('signatures')` : l’onglet principal devient `signatures`, qui n’est pas dans la liste des onglets, donc `renderTabContent()` retourne `default` → **null** (contenu vide).
- **Correction recommandée** : gérer un état local pour le sous-onglet (ex. `sealsSubTab: 'cachets' | 'signatures'`) et afficher Cachets vs Signatures selon cet état, sans changer `activeTab`.

### 4.3 Composant PedagogicalOptionsSettings

- Présent dans `components/settings/` et branché au service de features + pricing, mais **jamais importé ni affiché** dans la page Paramètres. À intégrer dans l’onglet « Modules & Fonctionnalités » ou dans un sous-onglet dédié si pertinent.

### 4.4 Authentification des appels API

- `AdministrativeSealsManagement` et `ElectronicSignaturesManagement` envoient `Authorization: Bearer ${localStorage.getItem('token')}`.  
- L’auth applicative repose sur les **cookies** (session) et `fetch('/api/auth/me')`.  
- Les routes Next.js proxy peuvent transmettre les cookies au backend ; il faut **ne pas dépendre du token en localStorage** et utiliser `credentials: 'include'` pour les `fetch` vers `/api/...`.

### 4.5 UX / Design

- Pas de feedback de chargement par onglet (skeleton ou disabled state).
- Pas de message de succès/erreur après sauvegarde.
- Formulaires en champs bruts (input/select) sans composants communs (design system) — à harmoniser si un design system existe.

---

## 5. Recommandations (priorisées)

### P0 – À faire en priorité

1. **Brancher le chargement des paramètres**  
   Dans `loadSettings()`, appeler en parallèle (ou séquentiel) :  
   `GET /api/settings/general`, `features`, `security`, `orion`, `atlas`, `offline-sync`, `history` (avec `limit`), et mettre à jour les états correspondants. Utiliser `credentials: 'include'` et ne pas envoyer de Bearer depuis localStorage.

2. **Corriger l’onglet Cachets & Signatures**  
   Introduire un état `sealsSubTab` (ex. `'cachets' | 'signatures'`) ; dans le case `'seals'`, afficher les deux boutons qui mettent à jour `sealsSubTab` et afficher `AdministrativeSealsManagement` ou `ElectronicSignaturesManagement` selon sa valeur. Ne plus appeler `setActiveTab('signatures')`.

3. **Brancher les boutons Enregistrer**  
   Pour chaque onglet (general, security, orion, atlas, offline) :  
   - Lire les valeurs des champs (état contrôlé ou refs).  
   - Appeler le `PUT` correspondant (`/api/settings/general`, etc.).  
   - Afficher un message de succès/erreur (toast ou inline).

### P1 – Important

4. **Uniformiser l’auth des fetch**  
   Pour tous les appels vers `/api/settings/*` depuis la web-app : utiliser `credentials: 'include'` et supprimer l’envoi de `Authorization: Bearer` depuis localStorage (sauf si le backend exige explicitement un Bearer et que le proxy ajoute le token cookie→Bearer).

5. **Onglet Features**  
   - Afficher la liste retournée par `GET /api/settings/features`.  
   - Brancher les toggles sur `POST .../enable` et `POST .../disable`, avec confirmation si impact facturation (comme dans `PedagogicalOptionsSettings`).  
   - Intégrer `PedagogicalOptionsSettings` dans cet onglet ou dans un sous-onglet « Options pédagogiques ».

6. **Historique**  
   - Afficher les entrées retournées par `GET /api/settings/history`.  
   - Optionnel : filtres (catégorie, période, clé).

### P2 – Amélioration

7. **Design system**  
   Remplacer les `input`/`select` bruts par des composants communs (Input, Select, Button, Card) s’ils existent, pour cohérence et accessibilité.

8. **Loading / erreurs**  
   - État de chargement par section ou onglet.  
   - Messages d’erreur explicites en cas d’échec API.

9. **Lien Facturation**  
   La page `/app/settings/billing` existe ; ajouter si besoin un lien ou un onglet « Facturation » depuis la page Paramètres pour cohérence de navigation.

---

## 6. Résumé

| Élément | État |
|--------|------|
| Structure onglets | OK (8 onglets) |
| Sous-onglets Cachets / Signatures | Bug (signatures affiche vide) |
| Chargement des données | Non implémenté |
| Sauvegarde des formulaires | Non implémentée |
| APIs backend | Complètes et cohérentes |
| Proxies Next.js | Présents |
| Auth des fetch (cookies vs token) | À aligner |
| PedagogicalOptionsSettings | Non intégré |

En appliquant les corrections P0 puis P1, le module Paramètres devient pleinement fonctionnel et cohérent avec le backend et l’auth par session.
