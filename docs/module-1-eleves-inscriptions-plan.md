# Module 1 — Élèves & Inscriptions — Plan d’implémentation

Document de référence pour structurer le Module 1 en ERP éducatif (spécification Dawes 26/02/2026).

---

## 1. Sous-modules cibles

| Sous-module | Périmètre |
|-------------|-----------|
| **A — Admission & cycle de vie** | Pré-inscription, admission, réinscription, matricule, affectation/classe, changement classe, statut, transfert |
| **B — Identité & relations** | Identité légale, photo, documents officiels, parents/tuteurs, contacts urgence, régimes (enfant enseignant) |
| **C — Historique & multi-année** | Historique, traçabilité, changement de classe annuel, dossier académique consolidé |
| **D — Régimes & situation financière** | Régimes spéciaux, arriérés année précédente, liaison module Finance |
| **E — Documents & carte scolaire** | Carte scolaire, QR vérification publique, certificats, export PDF |
| **F — Interopérabilité nationale** | Export EDUCMASTER, format officiel, logs d’export |

---

## 2. Écarts schéma actuel vs spécification

### 2.1 Modèle `Student` (table `students`)

- **Existant :** `tenantId`, `academicYearId`, `schoolLevelId`, `studentCode`, `firstName`, `lastName`, `dateOfBirth`, `gender`, `nationality`, `status`, etc.
- **À ajouter / aligner :**
  - `placeOfBirth` (String?) — lieu de naissance
  - `legalDocumentType` (String?) — type de pièce d’identité
  - `legalDocumentNumber` (String?) — numéro de pièce
  - `regimeType` (String?) — NORMAL \| TEACHER_CHILD \| SCHOLARSHIP \| SPECIAL
  - `isActive` (Boolean) — désactivation logique (complément à `status`)
- **Matricule :** déjà présent via `studentCode` (tenant) et `StudentIdentifier.globalMatricule` (national). Règle cible : `<CODE_TENANT>-<ANNEE>-<AUTO_INCREMENT>` à générer côté backend à l’admission.

### 2.2 Modèle `StudentEnrollment` (table `student_enrollments`)

- **Existant :** `enrollmentType`, `status`, `classId`, `enrollmentDate`, `exitDate`, `exitReason`.
- **À ajouter :**
  - `previousArrears` (Float @default(0)) — arriérés année précédente injectés.
- **Alignement statuts cibles :**  
  `PRE_REGISTERED` \| `ADMITTED` \| `RE_ENROLLED` \| `TRANSFERRED` \| `WITHDRAWN`  
  (mapper depuis les valeurs actuelles `enrollmentType` / `status` si besoin).

### 2.3 Nouveau modèle `NationalExportLog`

- **Champs :** `id`, `tenantId`, `studentId`, `exportType` (ex. EDUCMASTER), `exportedAt`, `status`, métadonnées optionnelles.
- Table dédiée aux logs d’export national (non modifiables après export).

---

## 3. Règles métier à respecter

- **Pré-inscription :** statut = PRE_REGISTERED, dossier incomplet autorisé.
- **Admission :** documents obligatoires validés, classe assignée, matricule généré.
- **Réinscription :** nouvel Enrollment, historique conservé, vérification arriérés.
- **Transfert :** pas de changement de tenant direct ; statut TRANSFERRED ; export PDF dossier ; import validé côté école destination.
- **Régime enfant enseignant :** si `regimeType = TEACHER_CHILD` → réduction automatique + liaison Finance.
- **Arriérés :** calculés depuis année précédente, injectés dans l’enrollment, non supprimables manuellement (triggers si besoin).
- **Carte scolaire + QR :** `student_id`, `tenant_id`, `academic_year`, hash sécurisé ; endpoint public `/verify/student/:hash`.
- **Export EDUCMASTER :** JSON conforme, logs obligatoires, non modifiable après export.

---

## 4. Triggers SQL (PostgreSQL)

Fichier **`apps/api-server/prisma/migrations/module1_students_security_triggers.sql`** — à exécuter **manuellement** après les migrations (ex. `psql $DATABASE_URL -f prisma/migrations/module1_students_security_triggers.sql`).

- Matricule unique par tenant (contrainte ou trigger).
- Interdiction suppression physique élève (BEFORE DELETE → RAISE).
- Interdiction modification `academic_year_id` sur Enrollment.
- Interdiction changement de classe si notes existent (référence table des notes).
- Arriérés verrouillés (politique à préciser selon module Finance).

---

## 5. API cibles

- `POST /students/pre-register`
- `POST /students/admit`
- `POST /students/re-enroll`
- `POST /students/transfer`
- `POST /students/change-class`
- `GET /students/class/:id`
- `GET /students/:id/history`
- `POST /students/:id/generate-card`
- `POST /students/:id/export-educmaster`

(À brancher sur les controllers/services existants dans `src/students`.)

---

## 6. Intégrations

- **Finance :** création compte financier à l’admission ; injection arriérés ; application régime spécial ; recalcul si changement de classe.
- **ORION :** déclenchement analyse à chaque mutation ; KPI élèves ; alertes (surpopulation, parent principal manquant, arriéré critique, dossier incomplet, transfert non validé).

---

## 7. Frontend (wireframe)

- Écran principal : tableau élèves, filtres (année, classe, statut, régime, arriérés), actions (nouvelle inscription, import, export EDUCMASTER).
- Fiche élève : onglets Identité, Scolarité, Parents, Finance, Documents, Historique, Carte scolaire (QR + PDF).
- Formulaire multi-step : Identité → Parents → Documents → Classe & régime → Validation (matricule généré à la validation).

---

## 8. Phasage proposé

1. **Phase 1 (fait / en cours)** — Schéma Prisma (champs manquants + NationalExportLog) + triggers SQL.
2. **Phase 2** — Endpoints pre-register, admit, re-enroll, transfer, change-class + génération matricule.
3. **Phase 3** — Intégration Finance (compte, arriérés, régime) + ORION (hooks, KPI, alertes).
4. **Phase 4** — Export EDUCMASTER + carte scolaire / QR + frontend (tableau, fiche, formulaire multi-step).

Ce document sera mis à jour au fil de l’implémentation.

---

## 9. Audit implémentation (état actuel)

### 9.1 Backend — API spécifiées vs existant

| Endpoint spécifié | Implémenté | Remarque |
|-------------------|------------|----------|
| `POST /students/pre-register` | ❌ Non | — |
| `POST /students/admit` | ❌ Non | Création générique + `enroll` existants, pas de flux admission dédié |
| `POST /students/re-enroll` | ❌ Non | — |
| `POST /students/transfer` | ⚠️ Partiel | `transfers-prisma` : create, approve, reject ; pas d’endpoint unique « transfer » avec export PDF |
| `POST /students/change-class` | ❌ Non | — |
| `GET /students/class/:id` | ❌ Non | Liste élèves par classe possible via filtres, pas d’endpoint dédié |
| `GET /students/:id/history` | ⚠️ Partiel | Dossier académique + historique cartes ; pas d’historique unifié admissions/réinscriptions/transferts |
| `POST /students/:id/generate-card` | ✅ Oui | `student-id-card.controller` : `POST :studentId/generate` |
| `POST /students/:id/export-educmaster` | ❌ Non | — |

**Conclusion backend :** schéma et triggers (Phase 1) sont en place. Les endpoints métier du cycle de vie (pre-register, admit, re-enroll, transfer, change-class) et l’export EDUCMASTER **ne sont pas implémentés** comme dans la spec.

### 9.2 Frontend — Wireframe spec vs existant

| Élément spec | Implémenté | Remarque |
|--------------|------------|----------|
| Tableau principal élèves | ✅ Oui | `StudentsModulePage` |
| Filtres Année, Classe, Statut | ⚠️ Partiel | Année/niveau via contexte ; classe, statut, recherche. **Manquent :** Régime, Arriérés |
| Bouton « Nouvelle inscription » | ✅ Oui | Modal création |
| Import / Export EDUCMASTER | ❌ Non | — |
| Fiche élève — onglet Identité | ✅ Oui | Dans `StudentDossierSection` |
| Fiche élève — onglet Scolarité | ⚠️ Partiel | « Parcours académique » présent |
| Fiche élève — onglet Parents | ⚠️ Partiel | Page guardians dédiée ; pas un onglet dans la fiche |
| Fiche élève — onglet Finance | ❌ Non | Pas d’onglet dédié (arriérés, régime, compte) |
| Fiche élève — onglet Documents | ✅ Oui | Onglet documents |
| Fiche élève — onglet Historique | ⚠️ Partiel | Contenu académique/discipline ; pas d’onglet « Historique » admissions/réinscriptions/transferts |
| Fiche élève — onglet Régimes | ❌ Non | — |
| Fiche élève — onglet Carte scolaire (QR + PDF) | ⚠️ Partiel | Page cartes / id-cards ; pas intégré comme onglet dans la fiche |
| Formulaire multi-step (Identité → Parents → Documents → Classe & régime → Validation) | ⚠️ Partiel | `StudentEnrollmentForm` : steps avec régime tarifaire ; pas les 5 étapes exactes de la spec |
| Vue classe | ✅ Oui | Page `students/classes` |
| Bouton changement de classe | ❌ Non | — |
| Bouton transfert | ⚠️ Partiel | Page transferts ; pas un bouton direct sur la fiche |
| Génération PDF carte / QR visible | ✅ Oui | Carte scolaire avec génération et QR (id-cards) |

**Conclusion frontend :** base solide (liste, dossier, classes, cartes, transferts, formulaire d’inscription). **Manquent** : onglets Finance, Régimes, Historique unifié, Carte scolaire dans la fiche ; filtres Régime/Arriérés ; boutons changement de classe et Export EDUCMASTER ; formulaire multi-step strict (5 étapes).

### 9.3 Synthèse

- **Backend :** Phase 1 (schéma + triggers) faite. **Phase 2 (API cycle de vie + export EDUCMASTER) à faire.**
- **Frontend :** Environ 60–70 % du wireframe est couvert ; **à compléter** : onglets fiche élève, filtres, actions (changement classe, export EDUCMASTER), formulaire multi-step aligné sur la spec.
