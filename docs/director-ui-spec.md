# Spécification UI Directeur — Academia Helm

> **Objectif** : Définir proprement l'interface utilisateur des directeurs (par niveau scolaire et par piste linguistique) en la distinguant du promoteur qui a accès à tout.

## 1. Rôles directeur et leur portée

### 1.1. Rôles directeur existants

| Code Rôle | Label | Niveaux gérés | Pistes linguistiques |
|-----------|-------|---------------|----------------------|
| `DIRECTEUR_MATERNELLE` | Directeur Maternelle | Maternelle | FR et/ou EN (selon config) |
| `DIRECTEUR_PRIMAIRE` | Directeur Primaire | Primaire | FR et/ou EN |
| `DIRECTEUR_SECONDAIRE` | Directeur Secondaire | Secondaire | FR et/ou EN |
| `DIRECTEUR_MAT_PRI` | Directeur Maternelle + Primaire | Maternelle + Primaire | FR et/ou EN |
| `DIRECTEUR_GENERAL` | Directeur Général | Tous niveaux | FR + EN |
| `DIRECTEUR_ETABLISSEMENT` | Directeur d'Établissement | Tous niveaux | FR + EN |
| `DEPUTY_DIRECTOR` | Directeur Adjoint | Selon accreditation | Selon config |

### 1.2. Cas d'usage typiques

- **Cas 1** : Une école a un directeur Maternelle + Primaire (même personne), et un directeur Secondaire distinct.
  - Le `DIRECTEUR_MAT_PRI` voit les données de Maternelle + Primaire, pas Secondaire.
  - Le `DIRECTEUR_SECONDAIRE` ne voit que Secondaire.
- **Cas 2** : École bilingue avec directeurs séparés par piste linguistique.
  - Un directeur `DIRECTEUR_PRIMAIRE` avec langue `FR` ne voit que la piste francophone du Primaire.
  - Un directeur `DIRECTEUR_PRIMAIRE` avec langue `EN` ne voit que la piste anglophone du Primaire.
- **Cas 3** : Un `DIRECTEUR_GENERAL` a accès à tous les niveaux et toutes les pistes (équivalent au promoteur pour la consultation, mais sans les fonctions financières/billing).

### 1.3. Stockage des accreditations

- `user.accreditations` : tableau de codes (`'MATERNELLE'`, `'PRIMAIRE'`, `'SECONDAIRE'`) — détermine les niveaux visibles.
- `user.levelScopes` : tableau d'UUIDs de `school_levels` — alternative aux accreditations.
- `staff_admin_assignments` (backend) : table authoritative qui mappe `staffId` → `schoolLevelCode` + `adminRole` + `academicYearId`.
- `school_directors` : table des profils directeur (nom, signature, fonction) — **pas** l'autorisation d'accès.

---

## 2. Mécanisme de filtrage côté frontend

### 2.1. SchoolLevelSelector (lock par niveau)

Le `SchoolLevelSelector` doit filtrer les niveaux disponibles selon `user.accreditations` :

```tsx
const allowedLevels = availableLevels.filter(lvl => {
  // Si l'utilisateur a un rôle FULL_ACCESS, tout est visible
  if (FULL_ACCESS_ROLES.includes(user.role)) return true;
  // Sinon, filtrer par accreditations
  if (user.accreditations?.length > 0) {
    return user.accreditations.includes(lvl.code);
  }
  // Fallback : levelScopes (UUIDs)
  if (user.levelScopes?.length > 0) {
    return user.levelScopes.includes(lvl.id);
  }
  return false;
});
```

**Comportement** :
- Un `DIRECTEUR_MAT_PRI` ne voit que Maternelle + Primaire dans le dropdown.
- Un `DIRECTEUR_SECONDAIRE` ne voit que Secondaire.
- Le dropdown est **locké** (non modifiable) si le directeur n'a qu'un seul niveau.
- Si le directeur a plusieurs niveaux, il peut basculer entre eux (mais jamais vers un niveau non autorisé).

### 2.2. AcademicTrackSelector (lock par piste linguistique)

Si le bilingue est activé, le `AcademicTrackSelector` doit restreindre les options selon la langue du directeur :

```tsx
const directorLanguage = await fetchDirectorLanguage(user.id); // 'FR' | 'EN' | null
const allowedTracks = directorLanguage
  ? [directorLanguage] // Lock à une seule piste
  : ['FR', 'EN']; // Full access (DIRECTEUR_GENERAL)
```

**Comportement** :
- Un directeur `FR` ne voit que la piste Francophone (le sélecteur est masqué ou locké sur FR).
- Un directeur `EN` ne voit que la piste Anglophone.
- Un `DIRECTEUR_GENERAL` peut basculer entre FR et EN.

### 2.3. Headers API injectés

Le `lib/api/client.ts` injecte déjà `x-school-level-id` et `x-academic-year-id` sur toutes les requêtes. Il faut aussi injecter `x-language-track` (FR/EN) quand le bilingue est activé, pour que le backend filtre côté serveur.

---

## 3. Matrice d'accès par module — Directeur vs Promoteur

### Légende
- ✅ **VISIBLE** : le directeur voit ce module (avec filtrage par niveau/piste).
- ❌ **HIDDEN** : le directeur ne voit pas ce module (réservé promoteur/admin plateforme).
- ⚠️ **VISIBLE restreint** : visible mais certaines sous-fonctions sont masquées.

### 3.1. Tableau de pilotage (`/app`)

| Section | Directeur | Promoteur |
|---------|----------|-----------|
| KPI Effectifs, Assiduité, Recettes, Alertes | ✅ filtré par niveau + piste | ✅ tout |
| Mini-KPIs (Recette jour, Impayés, Moyenne, Recettes encaissées) | ✅ filtré | ✅ tout |
| Vue d'ensemble effectifs (total / actifs / abandons) | ✅ filtré par niveau | ✅ tout |
| Personnalisations de frais | ❌ masqué (réservé promoteur/COMPTABLE) | ✅ |
| Personnel (admin + enseignants par niveau) | ✅ filtré par niveau | ✅ tout |
| Évolution des moyennes par niveau + piste | ✅ filtré sur son niveau + sa piste | ✅ tout |
| Effectifs par classe | ✅ filtré | ✅ tout |
| Répartition par sexe | ✅ filtré | ✅ tout |
| Alertes ORION | ✅ filtré | ✅ tout |

### 3.2. Organisation Pédagogique (`/app/pedagogy/*`)

| Sous-onglet | Directeur | Promoteur |
|-------------|----------|-----------|
| Dashboard | ✅ filtré | ✅ |
| Structure académique | ✅ filtré par niveau + piste | ✅ |
| Matières & programmes | ✅ filtré | ✅ |
| Enseignants & Affectations | ✅ filtré | ✅ |
| Emploi du temps | ✅ filtré | ✅ |
| Espace Pédagogie (cahier de texte, devoirs) | ✅ filtré | ✅ |
| Validation Direction (cahier journal, fiches) | ✅ filtré sur son niveau | ✅ |
| Analytique ORION pédagogie | ✅ filtré | ✅ |
| Travaux & Suivi | ✅ filtré | ✅ |
| Sarah Compose (IA) | ✅ | ✅ |
| Cahiers de textes | ✅ filtré | ✅ |

### 3.3. Élèves & Scolarité (`/app/students/*`)

| Sous-onglet | Directeur | Promoteur |
|-------------|----------|-----------|
| Liste élèves | ✅ filtré par niveau + piste | ✅ |
| Admissions / Inscriptions | ✅ filtré | ✅ |
| Effectifs par classe | ✅ filtré | ✅ |
| Transferts inter-écoles | ✅ filtré | ✅ |
| Assiduité / Présence | ✅ filtré | ✅ |
| Discipline / Incidents | ✅ filtré | ✅ |
| Cartes d'identité / Matricules | ✅ filtré | ✅ |
| Parents / Tuteurs | ✅ filtré | ✅ |
| Documents | ✅ filtré | ✅ |
| Agrégation & Bilan Global | ❌ masqué (réservé promoteur/SUPER_DIRECTOR) | ✅ |

### 3.4. Finances & Économat (`/app/finance/*`)

| Sous-onglet | Directeur | Promoteur |
|-------------|----------|-----------|
| Dashboard finance | ✅ filtré par niveau | ✅ |
| Frais de scolarité (structures) | ✅ consultation filtrée | ✅ édition |
| Personnalisations (overrides) | ❌ masqué (réservé COMPTABLE/promoteur) | ✅ |
| Comptes élèves / Soldes | ✅ consultation filtrée | ✅ |
| Paiements / Encaissements | ✅ filtré | ✅ |
| Recettes / Recouvrement | ✅ filtré | ✅ |
| Dépenses | ⚠️ visible mais création limitée | ✅ |
| Trésorerie | ⚠️ visible en lecture seule | ✅ |
| Caisses / Espèces | ✅ filtré | ✅ |
| Rapports financiers | ✅ filtré par niveau | ✅ tout |
| Audit financier | ❌ masqué (réservé promoteur) | ✅ |
| Agrégation & Bilan Global | ❌ masqué (réservé promoteur) | ✅ |
| Paramètres finance | ❌ masqué (réservé promoteur) | ✅ |

### 3.5. Examens, Notes & Bulletins (`/app/exams/*`)

| Sous-onglet | Directeur | Promoteur |
|-------------|----------|-----------|
| Dashboard examens | ✅ filtré par niveau + piste | ✅ |
| Évaluations / Compositions | ✅ filtré | ✅ |
| Sessions d'examen | ✅ filtré | ✅ |
| Saisie des notes | ✅ filtré | ✅ |
| Bulletins (génération PDF) | ✅ filtré + signature auto directeur | ✅ |
| Validation / Délibérations | ✅ filtré sur son niveau | ✅ |
| Demandes de déverrouillage | ✅ filtré | ✅ |
| Registre des examens | ✅ filtré | ✅ |
| Conseils de classe | ✅ filtré | ✅ |
| Analytics / Statistiques | ⚠️ scoped au niveau du directeur | ✅ tout |
| Audit examens | ❌ masqué (réservé promoteur) | ✅ |
| Paramètres examens | ❌ masqué (réservé promoteur) | ✅ |

### 3.6. Personnel, RH & Paie (`/app/hr/*`)

| Sous-onglet | Directeur | Promoteur |
|-------------|----------|-----------|
| Vue d'ensemble RH | ✅ filtré par niveau | ✅ tout |
| Personnel (staff) | ✅ consultation filtrée | ✅ |
| Directeurs (configuration) | ❌ masqué (réservé promoteur) | ✅ |
| Recrutement | ⚠️ visible mais création limitée | ✅ |
| Embauche | ⚠️ visible mais validation promoteur requise | ✅ |
| Contrats | ✅ consultation filtrée | ✅ édition |
| Collaborateurs | ✅ filtré | ✅ |
| Congés / Leaves | ✅ filtré | ✅ |
| Présence staff | ✅ filtré | ✅ |
| Planning | ✅ filtré | ✅ |
| Reporting | ✅ filtré par niveau | ✅ tout |
| IA RH | ✅ filtré | ✅ |
| Indemnités / Allowances | ❌ masqué (réservé COMPTABLE/promoteur) | ✅ |
| Paie / Payroll | ❌ masqué (réservé PAYROLL_MANAGER/promoteur) | ✅ |
| CNSS / Impôts | ❌ masqué (réservé COMPTABLE) | ✅ |
| Configuration contrats | ❌ masqué | ✅ |
| Paramètres RH | ❌ masqué | ✅ |

### 3.7. Communication (`/app/communication/*`)

| Sous-onglet | Directeur | Promoteur |
|-------------|----------|-----------|
| Dashboard communication | ✅ filtré par niveau | ✅ |
| Messages / Messagerie | ✅ filtré (destinataires = son niveau) | ✅ |
| Annonces | ✅ filtré | ✅ |
| Modèles de messages | ✅ consultation | ✅ édition |
| Campagnes | ✅ filtré | ✅ |
| Emails programmés | ✅ filtré | ✅ |
| Rapports / Historique | ✅ filtré | ✅ |
| Boîte de réception | ✅ filtré | ✅ |
| Parents / Enseignants / Élèves (annuaires) | ✅ filtré | ✅ |
| Administration | ✅ filtré | ✅ |
| Canaux (SMTP/SMS/WhatsApp config) | ❌ masqué (réservé IT_MANAGER) | ✅ |
| Notifications automatisées | ❌ masqué | ✅ |
| Paramètres communication | ❌ masqué | ✅ |

### 3.8. Paramètres (`/app/settings`)

❌ **Masqué entièrement** pour les directeurs. Réservé à `PROMOTER`, `SCHOOL_OWNER`, `SCHOOL_ADMIN`, `IT_MANAGER`, `SETTINGS_MANAGER`.

### 3.9. Modules supplémentaires

| Module | Directeur | Promoteur |
|--------|----------|-----------|
| Cantine | ✅ filtré par niveau | ✅ |
| EduCast | ✅ filtré | ✅ |
| Bibliothèque | ✅ filtré | ✅ |
| Transport | ✅ filtré | ✅ |
| Infirmerie | ✅ filtré | ✅ |
| QHSE | ✅ filtré | ✅ |
| Boutique / Shop | ❌ masqué (implications financières) | ✅ |
| Laboratoire | ✅ filtré | ✅ |
| CMS (Site Institutionnel) | ❌ masqué (réservé COMMUNICATION_MANAGER) | ✅ |

### 3.10. Modules plateforme (Academia Helm back-office)

❌ **Masqués entièrement** pour les directeurs. Réservés à `PLATFORM_OWNER`, `PLATFORM_SUPER_ADMIN`, `PLATFORM_ADMIN`.

---

## 4. Implémentation technique recommandée

### 4.1. Priorité 1 — Lock du SchoolLevelSelector

**Fichier** : `src/components/pilotage/SchoolLevelSelector.tsx`

```tsx
const allowedLevels = useMemo(() => {
  // FULL_ACCESS : tous les niveaux
  if (FULL_ACCESS_ROLES.includes(user.role)) return availableLevels;
  // Directeurs : filtrer par accreditations
  if (user.accreditations?.length > 0) {
    return availableLevels.filter(lvl => user.accreditations.includes(lvl.code));
  }
  return availableLevels;
}, [availableLevels, user.role, user.accreditations]);

// Si un seul niveau autorisé, auto-sélectionner et locker
useEffect(() => {
  if (allowedLevels.length === 1 && currentLevel?.id !== allowedLevels[0].id) {
    setCurrentLevel(allowedLevels[0].id);
  }
}, [allowedLevels]);
```

### 4.2. Priorité 2 — Lock du AcademicTrackSelector

**Fichier** : `src/components/pilotage/AcademicTrackSelector.tsx`

```tsx
const directorLanguage = useDirectorLanguage(user.id); // 'FR' | 'EN' | null
const allowedTracks = directorLanguage ? [directorLanguage] : ['FR', 'EN'];

// Si un seul track autorisé, masquer le sélecteur (pas besoin de choix)
if (allowedTracks.length === 1) {
  return null; // Sélecteur masqué
}
```

### 4.3. Priorité 3 — Compléter les rôles directeur dans la sidebar

**Fichier** : `src/components/pilotage/PilotageSidebar.tsx`

Ajouter les codes manquants dans les `roles[]` de `MAIN_MODULES[2..6]` :
```ts
'DIRECTEUR_MATERNELLE',
'DIRECTEUR_PRIMAIRE',
'DIRECTEUR_SECONDAIRE',
'DIRECTEUR_MAT_PRI',
```

### 4.4. Priorité 4 — Filtrage backend (sécurité)

Le filtrage frontend est de l'UX. La sécurité doit être enforceée côté backend :

```ts
// Dans chaque endpoint qui accepte schoolLevelId
if (user.role.startsWith('DIRECTEUR_') && user.role !== 'DIRECTEUR_GENERAL') {
  const allowedLevels = await resolveUserLevels(user.id);
  if (!allowedLevels.includes(requestedSchoolLevelId)) {
    throw new ForbiddenException('You do not have access to this school level');
  }
}
```

### 4.5. Priorité 5 — Sub-tab gating dans Finance/HR/Communication

Pour les sous-onglets qui doivent être masqués (ex: `finance/aggregation`, `hr/payroll`, `communication/channels`), ajouter un `roles[]` array dans les tabs config et filtrer :

```ts
// finance-tabs.ts
{ path: 'aggregation', label: 'Agrégation', roles: ['PROMOTER', 'SCHOOL_OWNER', 'SUPER_DIRECTOR', ...] }
{ path: 'settings', label: 'Paramètres', roles: ['PROMOTER', 'SCHOOL_OWNER', ...] }
```

---

## 5. Différences clés entre Directeur et Promoteur

| Aspect | Promoteur | Directeur |
|--------|-----------|----------|
| Portée des données | Tous niveaux, toutes pistes | Limité à son niveau + sa piste |
| Configuration (Settings) | ✅ Tout | ❌ Aucun |
| Finances (paramètres, audit, agrégation) | ✅ Tout | ❌ Masqué |
| RH (paie, CNSS, allowances, config) | ✅ Tout | ❌ Masqué |
| Boutique / Shop | ✅ | ❌ Masqué |
| Communication (canaux, automation, settings) | ✅ Tout | ❌ Masqué |
| Modules plateforme | ✅ Tout | ❌ Masqué |
| Signature bulletins | ✅ Manuelle | ✅ Automatique (récupérée depuis `school_directors`) |
| Validation pédagogie | ✅ Tout | ✅ Limité à son niveau |
| Personnalisations de frais | ✅ | ❌ Masqué |

---

## 6. Cas particulier — Directeur Général (`DIRECTEUR_GENERAL`)

Le `DIRECTEUR_GENERAL` a accès à tous les niveaux et toutes les pistes linguistiques. Il est équivalent au promoteur pour la consultation, mais reste exclu des fonctions financières/billing/paramètres.

**Comportement attendu** :
- `SchoolLevelSelector` : tous les niveaux disponibles + option "Tous les niveaux".
- `AcademicTrackSelector` : FR et EN disponibles.
- Accès à tous les modules sauf : `settings`, `finance/aggregation`, `finance/audit`, `finance/settings`, `hr/payroll`, `hr/cnss`, `hr/allowances`, `hr/settings`, `hr/directors`, `communication/channels`, `communication/automated-notifications`, `communication/settings`, `shop`, `cms`, `platform/*`.

---

## 7. Migration et déploiement

1. **Phase 1** (immédiat) : appliquer le lock du `SchoolLevelSelector` pour les directeurs (filtrage frontend).
2. **Phase 2** (court terme) : appliquer le lock du `AcademicTrackSelector` pour les directeurs bilingues.
3. **Phase 3** (court terme) : compléter les `roles[]` dans la sidebar pour les codes `DIRECTEUR_*` manquants.
4. **Phase 4** (moyen terme) : ajouter le sub-tab gating dans Finance/HR/Communication.
5. **Phase 5** (moyen terme) : implémenter le filtrage backend (sécurité) sur tous les endpoints qui acceptent `schoolLevelId`.
6. **Phase 6** (long terme) : unifier la source de vérité pour les accreditations (actuellement dispersée entre `user.accreditations`, `staff_admin_assignments`, `school_directors`).
