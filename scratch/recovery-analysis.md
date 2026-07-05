# Analyse Backend du Module Recouvrement — Academia Helm

**Task ID**: `recovery-analysis`
**Date**: 2025
**Scope**: Module Finance > sous-module Recouvrement — refactorisation frontend en outil fintech de recouvrement & arriérés.

---

## Synthèse Exécutive

Le backend du module Recouvrement contient **deux systèmes parallèles** partiellement câblés :

| Système | Modèle Prisma | Controller | Service | Frontend l'utilise ? |
|---|---|---|---|---|
| **OLD** (`RecoveryReminder`) | `RecoveryReminder` + enums `ReminderLevel` / `ReminderChannel` | `RecoveryReminderController` (`/api/finance/recovery-reminders`) | `RecoveryReminderService` | ✅ Oui (avec bugs) |
| **NEW** (`Collection`/`CollectionCase`) | `FeeArrear`, `CollectionReminder`, `PaymentPromise`, `CollectionAction`, `CollectionCase` | `CollectionPrismaController` (`/api/finance/collection`) + `CollectionCaseController` (`/api/collection`) | `CollectionPrismaService` + `CollectionCaseService` | ❌ Non (front appelle uniquement `getArrears` qui n'est même pas branché) |

**Conclusion**: Le backend **NEW** est complet (6 endpoints de créés + 4 endpoints de cas), mais le frontend continue d'appeler l'ancien système via `RecoveryRemindersContent.tsx` qui, en plus, référence des méthodes inexistantes du `financeService` (`sendManualRecoveryReminder`, `runNightlyRecoveryReminders`). Le refactor frontend doit abandonner l'ancien système et câbler le nouveau.

---

## 1. Modèles Prisma (avec tous les champs)

### 1.1 `RecoveryReminder` (système OLD)

```prisma
model RecoveryReminder {
  id               String          @id @default(uuid())
  tenantId         String
  academicYearId   String
  studentAccountId String
  reminderLevel    ReminderLevel
  amountDue        Decimal         @db.Decimal(10, 2)
  sentVia          ReminderChannel
  sentAt           DateTime        @default(now())
  createdBySystem  Boolean         @default(true)
  academicYear     AcademicYear    @relation(fields: [academicYearId], references: [id], onDelete: Cascade)
  studentAccount   StudentAccount  @relation(fields: [studentAccountId], references: [id], onDelete: Cascade)
  tenant           Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, academicYearId])
  @@index([studentAccountId])
  @@index([reminderLevel])
  @@index([sentAt])
  @@map("recovery_reminders")
}
```

**Table SQL**: `recovery_reminders`
**Relations**: `AcademicYear`, `StudentAccount`, `Tenant`
**Index**: 4 index composites/simple — aucun `@@unique`.

### 1.2 `FeeArrear` (système NEW — impayés par fee)

```prisma
model FeeArrear {
  id              String               @id @default(uuid())
  tenantId        String
  academicYearId  String
  studentId       String
  studentFeeId    String
  totalDue        Decimal              @db.Decimal(10, 2)
  totalPaid       Decimal              @default(0) @db.Decimal(10, 2)
  balanceDue      Decimal              @db.Decimal(10, 2)
  arrearsLevel    String               @default("LOW")   // LOW | MEDIUM | HIGH | CRITICAL
  lastPaymentDate DateTime?
  createdAt       DateTime             @default(now())
  updatedAt       DateTime             @updatedAt
  actions         CollectionAction[]
  reminders       CollectionReminder[]
  academicYear    AcademicYear         @relation(fields: [academicYearId], references: [id])
  studentFee      StudentFee           @relation(fields: [studentFeeId], references: [id], onDelete: Cascade)
  student         Student              @relation(fields: [studentId], references: [id], onDelete: Cascade)
  tenant          Tenant               @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  promises        PaymentPromise[]

  @@unique([studentId, studentFeeId, academicYearId])
  @@index([tenantId, academicYearId])
  @@index([studentId])
  @@index([arrearsLevel])
  @@map("fee_arrears")
}
```

**Table SQL**: `fee_arrears`
**Unique**: `(studentId, studentFeeId, academicYearId)` — un impayé par élève × fee × année.
**Relations**: `AcademicYear`, `StudentFee`, `Student`, `Tenant`, `CollectionAction[]`, `CollectionReminder[]`, `PaymentPromise[]`.
**Note**: `arrearsLevel` est un `String` (pas un enum) — valeurs gérées en code : `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.

### 1.3 `CollectionReminder` (système NEW — relances par impayé)

```prisma
model CollectionReminder {
  id            String    @id @default(uuid())
  feeArrearId   String
  channel       String                      // SMS | EMAIL | WHATSAPP | PUSH
  reminderStage String                      // J3 | J7 | J15 | J30
  sentAt        DateTime  @default(now())
  status        String    @default("SENT")
  message       String?
  metadata      Json?
  createdAt     DateTime  @default(now())
  feeArrear     FeeArrear @relation(fields: [feeArrearId], references: [id], onDelete: Cascade)

  @@index([feeArrearId])
  @@index([status])
  @@index([sentAt])
  @@map("collection_reminders")
}
```

**Table SQL**: `collection_reminders`
**Relations**: `FeeArrear` (parent).
**Aucune relation `Tenant`** directe (le tenant se déduit via `feeArrear.tenantId`) — limitation à corriger pour le multi-tenant filtering.

### 1.4 `PaymentPromise` (promesses de paiement)

```prisma
model PaymentPromise {
  id             String    @id @default(uuid())
  feeArrearId    String
  promisedAmount Decimal   @db.Decimal(10, 2)
  promisedDate   DateTime  @db.Date
  status         String    @default("PENDING")    // PENDING | HONOURED | BROKEN
  notes          String?
  createdBy      String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  creator        User?     @relation("PaymentPromiseCreator", fields: [createdBy], references: [id])
  feeArrear      FeeArrear @relation(fields: [feeArrearId], references: [id], onDelete: Cascade)

  @@index([feeArrearId])
  @@index([status])
  @@index([promisedDate])
  @@map("payment_promises")
}
```

**Table SQL**: `payment_promises`
**Note**: Pas d'endpoint de marquage `HONOURED` / `BROKEN` — limitation backend.

### 1.5 `CollectionAction` (historique d'actions)

```prisma
model CollectionAction {
  id               String          @id @default(uuid())
  feeArrearId      String?                                   // nullable — peut être lié à un cas
  collectionCaseId String?                                   // nullable — peut être lié à un arrear
  actionType       String                                    // CALL | MEETING | SUSPENSION | REMINDER | WARNING | BLOCK | OTHER
  channel          String?                                   // INTERNAL | SMS | WHATSAPP | EMAIL
  message          String?
  notes            String?
  performedBy      String?
  performedAt      DateTime        @default(now())
  createdAt        DateTime        @default(now())
  collectionCase   CollectionCase? @relation(fields: [collectionCaseId], references: [id], onDelete: Cascade)
  feeArrear        FeeArrear?      @relation(fields: [feeArrearId], references: [id], onDelete: Cascade)
  performer        User?           @relation("CollectionActionPerformer", fields: [performedBy], references: [id])

  @@index([feeArrearId])
  @@index([collectionCaseId])
  @@index([actionType])
  @@index([performedAt])
  @@map("collection_actions")
}
```

**Table SQL**: `collection_actions`
**Important**: `feeArrearId` et `collectionCaseId` sont **mutuellement exclusifs** (l'un ou l'autre, pas les deux). Permet de tracer toutes les actions, manuelles ou automatiques.

### 1.6 `CollectionCase` (dossier consolidé élève × année)

```prasma
model CollectionCase {
  id                String             @id @default(uuid())
  tenantId          String
  studentId         String
  academicYearId    String
  totalDue          Decimal            @db.Decimal(10, 2)
  totalPaid         Decimal            @default(0) @db.Decimal(10, 2)
  outstandingAmount Decimal            @db.Decimal(10, 2)
  status            String             @default("ON_TIME")   // ON_TIME | LATE | CRITICAL | BLOCKED
  escalationLevel   Int                @default(0)            // 0 → 4
  lastActionAt      DateTime?
  blockedUntil      DateTime?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
  actions           CollectionAction[]
  academicYear      AcademicYear       @relation("CollectionCaseAcademicYear", fields: [academicYearId], references: [id])
  student           Student            @relation("StudentCollectionCase", fields: [studentId], references: [id], onDelete: Cascade)
  tenant            Tenant             @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([studentId, academicYearId])
  @@index([tenantId, academicYearId])
  @@index([studentId])
  @@index([status])
  @@map("collection_cases")
}
```

**Table SQL**: `collection_cases`
**Unique**: `(studentId, academicYearId)` — un seul dossier par élève × année.
**Statuts workflow**: `ON_TIME` → `LATE` → `CRITICAL` → `BLOCKED` (+ `escalationLevel` 0-4).

---

## 2. Enums

### `ReminderLevel` (utilisé par `RecoveryReminder` — système OLD)

```prisma
enum ReminderLevel {
  WARNING
  URGENT
  FINAL_NOTICE
}
```

### `ReminderChannel` (utilisé par `RecoveryReminder` — système OLD)

```prisma
enum ReminderChannel {
  SMS
  WHATSAPP
  EMAIL
}
```

> **Note importante**: Le système NEW (`FeeArrear`, `CollectionReminder`, `CollectionAction`, `CollectionCase`) **n'utilise pas d'enums** — les valeurs sont stockées en `String` et contrôlées par convention applicative. C'est plus souple mais plus fragile.

---

## 3. Endpoints REST existants

### 3.1 Système OLD — `RecoveryReminderController` (chemin: `/api/finance/recovery-reminders`)

| Méthode | Chemin | Rôles | Body/Params | Retour | Rôle |
|---|---|---|---|---|---|
| `GET` | `/api/finance/recovery-reminders` | JWT only | `?academicYearId&studentAccountId&reminderLevel` | `RecoveryReminder[]` (max 200) | Liste les relances du tenant |
| `POST` | `/api/finance/recovery-reminders/manual` | JWT only | `{studentAccountId, level, channel?}` | `RecoveryReminder` | Envoie un rappel manuel + email parent |
| `POST` | `/api/finance/recovery-reminders/run-nightly` | JWT only | aucun | `{processed, created[]}` | Lance la détection nightly (normalement cron) |

**Aucun `@Roles`** sur ces endpoints — seul `JwtAuthGuard` protège.

### 3.2 Système NEW — `CollectionPrismaController` (chemin: `/api/finance/collection`)

| Méthode | Chemin | Rôles | Body/Params | Retour | Rôle |
|---|---|---|---|---|---|
| `POST` | `/api/finance/collection/detect-arrears` | JWT only | `{academicYearId}` | `FeeArrear[]` (tous créés/upsertés) | Détecte et crée les impayés depuis `PaymentSummary` (batch 200, OOM-safe) |
| `GET` | `/api/finance/collection/arrears` | JWT only | `?academicYearId&arrearsLevel&studentId&search` (+ `schoolLevelId` via décorator) | `FeeArrear[]` avec `student`, `studentFee.feeDefinition.feeCategory`, `reminders` (5 derniers), `promises` (PENDING), `actions` (10 derniers) — limit 500 | Liste les impayés filtrables |
| `POST` | `/api/finance/collection/reminders` | JWT only | `CreateCollectionReminderDto {arrearId, level (WARNING/URGENT/FINAL_NOTICE), channel (SMS/WHATSAPP/EMAIL), message?}` | `CollectionReminder` (avec `feeArrear.student`) | Crée une relance sur un impayé |
| `POST` | `/api/finance/collection/promises` | JWT only | `CreatePaymentPromiseDto {arrearId, promisedAmount, promiseDate, notes?}` | `PaymentPromise` (avec `feeArrear.student`) | Crée une promesse de paiement (validation : `promisedAmount ≤ balanceDue`) |
| `POST` | `/api/finance/collection/actions` | JWT only | `CreateCollectionActionDto {arrearId, actionType, description?}` | `CollectionAction` (avec `feeArrear.student` + `performer`) | Enregistre une action de recouvrement manuelle |
| `GET` | `/api/finance/collection/statistics` | JWT only | `?academicYearId` | `{totalArrears, byLevel[{arrearsLevel,_count,_sum.balanceDue}], totals:{expected,paid,balanceDue,collectionRate}}` | KPIs de recouvrement agrégés |

**DTOs validés** (cf. `apps/api-server/src/finance/dto/index.ts` lignes 373-413):
- `CreateCollectionReminderDto`: `level` ∈ {`WARNING`, `URGENT`, `FINAL_NOTICE`}, `channel` ∈ {`SMS`, `WHATSAPP`, `EMAIL`}
- `CreatePaymentPromiseDto`: `promisedAmount` number, `promiseDate` string ISO
- `CreateCollectionActionDto`: `actionType` string libre (mais en pratique: `CALL`, `MEETING`, `SUSPENSION`, `REMINDER`, `WARNING`, `BLOCK`, `OTHER`)

**Aucun `@Roles`** sur ces endpoints non plus — limitation de sécurité à corriger.

### 3.3 Système NEW — `CollectionCaseController` (chemin: `/api/collection`)

> ⚠️ Attention au chemin : pas de préfixe `/finance/` ici — le controller est monté sur `/api/collection` tout court.

| Méthode | Chemin | Rôles | Body/Params | Retour | Rôle |
|---|---|---|---|---|---|
| `GET` | `/api/collection/cases` | `DIRECTOR`, `ADMIN`, `ACCOUNTANT` | `?academicYearId&status&minOutstanding` | `CollectionCase[]` (avec `student.identifier`, `academicYear`) triés par `outstandingAmount desc` | Liste les dossiers |
| `GET` | `/api/collection/cases/:studentId/:academicYearId` | `DIRECTOR`, `ADMIN`, `ACCOUNTANT`, `TEACHER`, `PARENT`, `STUDENT` | 2 path params | `CollectionCase` (avec `student.identifier`, `actions` 20 derniers) ou upsert auto si inexistant | Détail d'un dossier |
| `POST` | `/api/collection/cases/:studentId/:academicYearId/sync` | `DIRECTOR`, `ADMIN`, `ACCOUNTANT` | 2 path params | `CollectionCase` upserté | Recalcule `totalDue`, `totalPaid`, `outstandingAmount`, `status` |
| `POST` | `/api/collection/cases/:studentId/:academicYearId/trigger-reminders` | `DIRECTOR`, `ADMIN`, `ACCOUNTANT` | 2 path params | `{triggered, escalationLevel, reminders[]}` | Déclenche l'escalade automatique (level 1→4) |

**Sécurité correcte** via `@Roles` sur ce controller — c'est le seul des trois à bien appliquer le RBAC.

---

## 4. Méthodes service existantes

### 4.1 `CollectionPrismaService` (385 lignes)

| Méthode | Signature | Rôle | Limitations |
|---|---|---|---|
| `detectArrears(tenantId, academicYearId)` | `Promise<FeeArrear[]>` | Scanne `PaymentSummary` où `balance > 0` par batches de 200 (anti-OOM) ; upsert chaque `FeeArrear` avec calcul `arrearsLevel`. | Aucun contrôle RBAC. Aucune idempotence garantie côté cron — peut être appelé manuellement seulement. |
| `calculateArrearsLevel(balance, lastPaymentDate)` *(privé)* | `→ 'LOW'\|'MEDIUM'\|'HIGH'\|'CRITICAL'` | Règle : `null` → CRITICAL ; > 30j → CRITICAL ; > 15j → HIGH ; > 7j → MEDIUM ; sinon LOW. | Se base uniquement sur `lastPaymentDate`, ignore `balance` (le paramètre est inutilisé — bug potentiel). |
| `findAllArrears(tenantId, filters)` | `Promise<FeeArrear[]>` | Liste avec filtres `academicYearId`, `schoolLevelId`, `arrearsLevel`, `studentId`, `search` (prénom/nom insensible casse). Tri `arrearsLevel desc, balanceDue desc`. Limit 500. | Pas de pagination (`take: 500` hardcodé) — ne scale pas. Pas de filtre par `feeCategoryId` ni par tranche de montant. |
| `createReminder(data)` | `Promise<CollectionReminder>` | Vérifie l'existence du `FeeArrear`, crée un `CollectionReminder` avec `status='SENT'` forcé. | **N'envoie aucun message réel** (pas de SMS/WhatsApp/Email) — juste un enregistrement DB. Incohérent avec le `status='SENT'`. |
| `createPaymentPromise(data)` | `Promise<PaymentPromise>` | Vérifie l'arrear, contrôle `promisedAmount ≤ balanceDue` (sinon `BadRequestException`), crée la promesse. | Aucun mécanisme de marquage `HONOURED` / `BROKEN` — la promesse reste `PENDING` indéfiniment. |
| `createCollectionAction(data)` | `Promise<CollectionAction>` | Vérifie l'arrear, crée l'action avec `performedAt=now()`. | `actionType` libre — pas de validation enum. |
| `getCollectionStatistics(tenantId, academicYearId?)` | `Promise<{totalArrears, byLevel, totals}>` | 4 requêtes parallèles : count, groupBy `arrearsLevel` avec `_count` + `_sum.balanceDue`, aggregate `_sum.balanceDue`, aggregate `_sum.totalPaid`. Calcul `collectionRate = paid / (paid + balanceDue) * 100`. | Pas de breakdown par `feeCategory` ni par `schoolLevel`. Pas de tendance temporelle. |

### 4.2 `CollectionCaseService` (385 lignes)

| Méthode | Signature | Rôle | Limitations |
|---|---|---|---|
| `upsertCollectionCase(tenantId, studentId, academicYearId)` | `Promise<CollectionCase\|null>` | Charge tous les `StudentFee` de l'élève pour l'année (avec `paymentSummary` + `feeDefinition.installments`) ; calcule `totalDue`/`totalPaid`/`outstandingAmount` ; détermine `status` via `checkOverdueInstallments` ; upsert sur `(studentId, academicYearId)`. | Retourne `null` si l'élève n'a aucun `StudentFee` — silencieux, peu diagnostic. |
| `checkOverdueInstallments(studentFees)` *(privé)* | `→ {late, critical}` | Pour chaque fee non soldée, inspecte les installments ; `late` si une échéance < today, `critical` si > 30j de retard. | Bug potentiel : ne tient pas compte du prorata payé entre installments — si la 1ère échéance est payée mais pas la 2nde, on regarde toutes les échéances passées. |
| `getCollectionCase(tenantId, studentId, academicYearId)` | `Promise<CollectionCase>` | Charge le cas avec `student.identifier` + `actions` (20 derniers). Si introuvable, **upsert auto** (effet de bord). | L'upsert auto peut masquer des erreurs 404 ; un GET ne devrait pas muter. |
| `triggerAutomaticReminders(tenantId, studentId, academicYearId)` | `Promise<{triggered, escalationLevel, reminders}>` | Calcule l'`escalationLevel` (1-4) selon `status` ; déclenche `sendReminders` ; met à jour `escalationLevel` + `lastActionAt` sur le cas. | Si `status === 'ON_TIME'`, retourne `{triggered:false}` sans rien faire. |
| `calculateEscalationLevel(collectionCase)` *(privé)* | `→ number (1-4)` | `BLOCKED→4`, `CRITICAL→3`, `LATE→max(2, escalationLevel+1)`, sinon 1. | L'escalade `LATE` ne fait que croître (jamais de reset) — bug pour un élève qui régularise puis re-retarde. |
| `sendReminders(collectionCase, level)` *(privé)* | `→ CollectionAction[]` | Niveau 1: 1 action `REMINDER/INTERNAL`. Niveau 2: 2 actions `WARNING/SMS` + `WARNING/WHATSAPP`. Niveau 3: 1 action `WARNING/INTERNAL` (notif direction). Niveau 4: 1 action `BLOCK/INTERNAL` + `applyAdministrativeBlock`. | Comme pour `createReminder`, **aucun envoi réel** de SMS/WhatsApp — juste DB. |
| `createReminderAction(collectionCaseId, actionType, channel, message)` *(privé)* | `→ CollectionAction` | Crée une `CollectionAction` liée au cas. | Méthode interne, pas exposée par endpoint direct. |
| `applyAdministrativeBlock(collectionCaseId)` *(privé)* | `→ void` | Met `status='BLOCKED'` et `blockedUntil = today + 30 jours`. | Ne bloque pas réellement le `StudentAccount.isBlocked` (champ séparé). Incohérence avec le système de blocage `StudentAccount`. |
| `findAllCollectionCases(tenantId, filters)` | `Promise<CollectionCase[]>` | Filtres : `academicYearId`, `status`, `minOutstanding`. Tri `outstandingAmount desc`. | Pas de pagination, pas de filtre `schoolLevelId` ou `search`. |

### 4.3 `RecoveryReminderService` (système OLD — 221 lignes)

| Méthode | Signature | Rôle |
|---|---|---|
| `runNightlyDetection()` | `Promise<void>` | `@Cron('0 2 * * *')` — chaque nuit à 2h, parcourt les tenants actifs par batchs de 5 (anti-OOM). |
| `processTenantReminders(tenantId)` | `Promise<{processed, created[]}>` | Pour chaque `StudentAccount` où `balance > 0` et `isBlocked=false`, calcule les jours depuis le début de l'année scolaire et crée un `RecoveryReminder` (WARNING J+3, URGENT J+7, FINAL_NOTICE J+15) si non déjà créé. Auto-bloque si `balance ≥ RECOVERY_BLOCK_THRESHOLD` (env var). |
| `createReminder(tenantId, studentAccountId, academicYearId, reminderLevel, amountDue, sentVia)` | `Promise<RecoveryReminder>` | Crée le rappel en DB + **envoie un email au parent** via `RecoveryReminderEmailService` (fire-and-forget). |
| `sendManualReminder(tenantId, studentAccountId, level, channel)` | `Promise<RecoveryReminder>` | Valide les enums, puis délègue à `createReminder`. |
| `findAll(tenantId, filters)` | `Promise<RecoveryReminder[]>` | Filtres `academicYearId`, `studentAccountId`, `reminderLevel`. Tri `sentAt desc`. Limit 200. |

---

## 5. État du frontend actuel

### 5.1 `RecoveryRemindersContent.tsx` (189 lignes — fichier `/apps/web-app/src/components/finance/RecoveryRemindersContent.tsx`)

**Implémenté**:
- Tableau simple listant les `RecoveryReminder` (élève, solde dû, niveau, canal, date)
- Bouton "Envoyer rappel manuel" → ouvre un modal avec sélection `studentAccount` + niveau (`WARNING`/`URGENT`/`FINAL_NOTICE`)
- Bouton "Lancer détection" → déclenche le cron nightly manuellement
- Badge de couleur par niveau (FINAL_NOTICE = destructive)
- Filtre automatique des comptes avec `balance > 0` dans le modal

**Bugs identifiés**:
- ⚠️ **Lignes 56 & 68** : appelle `financeService.sendManualRecoveryReminder(...)` et `financeService.runNightlyRecoveryReminders(...)` — **ces méthodes n'existent pas** dans `financeService`. Les vraies méthodes sont `sendManualReminder(data)` et `runNightlyDetection()`. Le composant est donc cassé à l'exécution (à moins qu'un patch runtime ne les ajoute dynamiquement — à vérifier).
- Aucune gestion d'erreur distinguant 401/403/404
- Pas de pagination
- Pas de filtre par niveau sur la liste
- Pas de recherche texte

**Manquant par rapport au backend NEW**:
- ❌ Aucun affichage des **Arriérés** (`FeeArrear`) alors que `GET /api/finance/collection/arrears` existe
- ❌ Aucun affichage des **Promesses de paiement** (`PaymentPromise`)
- ❌ Aucun affichage des **Actions de recouvrement** (`CollectionAction`)
- ❌ Aucun affichage des **Cas / Dossiers** (`CollectionCase`) avec timeline
- ❌ Aucun dashboard KPI (utilise l'ancien système qui n'a pas de `getStatistics`)
- ❌ Aucune gestion d'escalade automatique (le bouton "trigger-reminders" du Cas n'est pas exposé)
- ❌ Aucun workflow "promesse honorée/rompue"

### 5.2 `financeService.*` disponibles côté frontend (extrait pertinent)

```ts
// Lignes 122-134 du fichier /apps/web-app/src/services/finance.service.ts
async getRecoveryReminders(params?: Record<string, string>): Promise<any>
async sendManualReminder(data: any): Promise<any>              // ← correspond à /api/finance/recovery-reminders/manual
async runNightlyDetection(): Promise<any>                       // ← correspond à /api/finance/recovery-reminders/run-nightly

// Ligne 194
async getArrears(params?: Record<string, string>): Promise<any> // ← correspond à /api/finance/collection/arrears
```

**Manquants** (à ajouter dans `financeService` pour le nouveau front):
- `detectArrears(academicYearId)` → `POST /api/finance/collection/detect-arrears`
- `createCollectionReminder(data)` → `POST /api/finance/collection/reminders`
- `createPaymentPromise(data)` → `POST /api/finance/collection/promises`
- `createCollectionAction(data)` → `POST /api/finance/collection/actions`
- `getCollectionStatistics(academicYearId?)` → `GET /api/finance/collection/statistics`
- `getCollectionCases(params)` → `GET /api/collection/cases`
- `getCollectionCase(studentId, academicYearId)` → `GET /api/collection/cases/:studentId/:academicYearId`
- `syncCollectionCase(studentId, academicYearId)` → `POST /api/collection/cases/:studentId/:academicYearId/sync`
- `triggerCaseReminders(studentId, academicYearId)` → `POST /api/collection/cases/:studentId/:academicYearId/trigger-reminders`

> ⚠️ Attention au préfixe différent : les endpoints "collection/arrears" sont sous `/api/finance/collection/*` alors que les endpoints "cases" sont sous `/api/collection/*` (sans `finance/`). Le service frontend devra gérer cette dualité.

---

## 6. Configuration recouvrement (`FinancialSettings`)

Le modèle `FinancialSettings` (table `financial_settings`, voir `schema.prisma` lignes 5014-5038) contient :

| Champ | Type | Défaut | Utilisation actuelle |
|---|---|---|---|
| `blockingThreshold` | `Decimal(12,2)` | `0` | ✅ Utilisé dans `student-account.service.ts:338` — si `balance > blockingThreshold`, l'account passe `isBlocked=true`. |
| `allowPartialPayment` | `Boolean` | `true` | (Non pertinent pour le recouvrement) |
| `minimumInstallmentAmount` | `Decimal?` | null | (Non pertinent) |
| `autoClosureEnabled` | `Boolean` | `true` | (Clôture trésorerie) |
| `autoClosureTime` | `String` | `"23:59"` | (Clôture trésorerie) |
| `reminderWarningDays` | `Int` | `3` | ❌ **Stocké mais non consommé** dans le code backend. Le `RecoveryReminderService` hardcode J+3/J+7/J+15. |
| `reminderUrgentDays` | `Int` | `7` | ❌ Idem — non consommé. |
| `reminderFinalDays` | `Int` | `15` | ❌ Idem — non consommé. |
| `cancellationDelayHours` | `Int` | `24` | (Annulation paiement) |
| `budgetAlertThreshold` | `Int` | `85` | (Alerte budget dépenses) |
| `expenseReceiptThreshold` | `Decimal?` | null | (Reçu dépense) |
| `fedapayEnabled` | `Boolean` | `false` | (Paiement Fedapay) |
| `fedapayPublicKey` / `fedapaySecretKey` | `String?` | null | (Chiffré AES-256-GCM) |

**Audit & historique**: `FinancialAuditLog` (table `financial_audit_logs`) trace toutes les modifications avec `oldValue`/`newValue` et `performedBy`. Le service expose `getHistory()` et `getSettingsOrionAlerts()` qui détecte les changements critiques (réduction de seuil ≥ 50% → 🔴 CRITICAL).

**Incohérence majeure**:
- `blockingThreshold` (DB) → utilisé par `student-account.service`
- `RECOVERY_BLOCK_THRESHOLD` (env var) → utilisé par `recovery-reminder.service`

Ces deux seuils font doublon et ne sont pas synchronisés. Pour le refactor, il faut unifier sur `FinancialSettings.blockingThreshold` et supprimer l'env var.

---

## 7. Analyse des gaps pour un outil fintech

| Domaine | État actuel | Gap pour outil fintech pro |
|---|---|---|
| **Dashboard KPIs** | `getCollectionStatistics` existe (NEW) — non appelé par le front | Ajouter : tendances temporelles (évolution du taux de recouvrement), breakdown par `feeCategory`, top 10 débiteurs, projection trésorerie sur promesses |
| **Vue Arriérés** | `GET /api/finance/collection/arrears` existe — non appelé par le front | Manque : filtres avancés (montant min/max, catégorie de fee, niveau scolaire, tranche de jours de retard), tri multi-colonnes, export CSV/Excel, actions bulk (relancer X élèves d'un coup) |
| **Vue Promesses** | Endpoint POST create seul — pas de GET list, pas de marquage honored/broken | Manque : GET list avec filtres (status, date range, élève), endpoint PATCH pour marquer HONOURED/BROKEN, alerte auto si promesse non honorée à la date |
| **Vue Actions** | Endpoint POST create seul — pas de GET list | Manque : GET list avec filtres (type, date range, performer), distinction actions manuelles vs automatiques |
| **Vue Cas** | 4 endpoints complets (list, get, sync, trigger-reminders) | Manque : timeline unifiée (reminders + actions + promises dans le cas), changement de statut manuel (close case, reopen), notes libres |
| **Workflow escalade** | `triggerAutomaticReminders` implémente niveaux 1-4 mais n'est pas cron-schédule | Manque : cron quotidien pour scanner tous les cas et escalader automatiquement, règles configurables via `FinancialSettings.reminderWarningDays` etc., audit trail complet |
| **Envoi réel messages** | `RecoveryReminderEmailService` envoie des emails (OLD) — le système NEW ne fait que DB | Manque : intégration SMS (Gupshup/Twilio), WhatsApp Business API, templates personnalisables, anti-harcèlement (max 1 rappel/24h) |
| **Renommage onglet** | Label "Recouvrement" partout | Devient "Recouvrement & Arriérés" (3 emplacements à modifier) |
| **Sécurité RBAC** | `CollectionCaseController` correct ; `CollectionPrismaController` & `RecoveryReminderController` non | Ajouter `@Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')` sur tous les endpoints mutating |

---

## 8. Recommandation d'architecture frontend

### 8.1 Structure de composants proposée

```
apps/web-app/src/components/finance/recovery/
├── RecoveryContent.tsx          (shell + onglets internes + state partagé)
├── RecoveryDashboard.tsx        (KPIs + graphiques)
├── ArrearsTab.tsx               (tableau arriérés filtrable)
├── RemindersTab.tsx             (relances envoyées)
├── PromisesTab.tsx              (promesses de paiement)
├── ActionsTab.tsx               (actions de recouvrement)
├── CasesTab.tsx                 (dossiers de recouvrement)
├── CaseDetailDrawer.tsx         (timeline d'un cas — drawer latéral)
├── ArrearDetailDrawer.tsx       (détail d'un impayé — drawer latéral)
└── shared/
    ├── ArrearsFilters.tsx       (barre de filtres réutilisable)
    ├── LevelBadge.tsx           (badge LOW/MEDIUM/HIGH/CRITICAL)
    └── StatusBadge.tsx          (badge ON_TIME/LATE/CRITICAL/BLOCKED)
```

### 8.2 Spécifications par composant

#### `RecoveryContent.tsx` (shell)
- **Rôle**: wrapper qui affiche les onglets internes (Dashboard, Arriérés, Relances, Promesses, Actions, Dossiers) et gère le state partagé (`academicYearId`, `schoolLevelId`, recherche globale).
- **Données**: `useModuleContext()` pour `academicYear`, `schoolLevel`.
- **Onglets**: 6 onglets internes (Tabs de shadcn/ui).
- **Endpoints**: aucun appel direct — délègue aux sous-composants.

#### `RecoveryDashboard.tsx`
- **Données**: `getCollectionStatistics(academicYearId)` + `getCollectionCases({academicYearId})` pour les top débiteurs + `getArrears({arrearsLevel:'CRITICAL'})` pour les top impayés.
- **KPIs**:
  - Total impayés (count + montant)
  - Taux de recouvrement (%)
  - Montant des promesses en cours
  - Nombre de cas bloqués / critiques
  - Top 5 débiteurs
  - Répartition par niveau (donut chart)
  - Évolution mensuelle (line chart — nécessite un nouvel endpoint backend)
- **Filtres**: `academicYearId`, `schoolLevelId`.
- **Actions**: bouton "Lancer détection" (`detectArrears(academicYearId)`).

#### `ArrearsTab.tsx`
- **Données**: `getArrears({academicYearId, schoolLevelId, arrearsLevel, studentId, search})`.
- **Colonnes**: Élève (nom + code), Classe, Frais (catégorie + libellé), Total dû, Total payé, Solde, Niveau, Dernier paiement, Actions (badge count), Promesses (badge count).
- **Filtres**: `arrearsLevel` (LOW/MEDIUM/HIGH/CRITICAL), `search` (texte), `feeCategoryId` (à ajouter backend), `minBalance` (à ajouter backend).
- **Actions**:
  - Clic ligne → `ArrearDetailDrawer`
  - Bouton "Relancer" (ouvre modal `CreateReminderModal`)
  - Bouton "Nouvelle promesse" (ouvre modal `CreatePromiseModal`)
  - Bouton "Nouvelle action" (ouvre modal `CreateActionModal`)
- **Endpoints**: `GET /api/finance/collection/arrears`, `POST /api/finance/collection/reminders`, `POST /api/finance/collection/promises`, `POST /api/finance/collection/actions`.

#### `RemindersTab.tsx`
- **Données**: actuellement **aucun endpoint GET** pour lister les `CollectionReminder` — **gap backend à combler**. Solutions temporaires : (a) réutiliser `getArrears` qui inclut `reminders` (5 derniers par arrear), ou (b) ajouter `GET /api/finance/collection/reminders` au backend.
- **Colonnes**: Élève, Frais, Niveau (stage), Canal, Message, Date d'envoi, Statut.
- **Filtres**: `reminderStage` (J3/J7/J15/J30), `channel` (SMS/EMAIL/WHATSAPP), `dateRange`, `studentId`.
- **Actions**: recréer une relance similaire.

#### `PromisesTab.tsx`
- **Données**: actuellement **aucun endpoint GET** pour lister les `PaymentPromise` — **gap backend**. À ajouter : `GET /api/finance/collection/promises`.
- **Colonnes**: Élève, Frais, Montant promis, Date promise, Statut, Notes, Créé par, Créé le.
- **Filtres**: `status` (PENDING/HONOURED/BROKEN), `dateRange`, `studentId`, `overdueOnly` (promises dont la date < today et statut PENDING).
- **Actions**:
  - Marquer "Honorée" (PATCH — **gap backend**: ajouter `PATCH /api/finance/collection/promises/:id/status`)
  - Marquer "Rompue" (même endpoint)
  - Éditer notes

#### `ActionsTab.tsx`
- **Données**: aucun endpoint GET direct — **gap backend**: ajouter `GET /api/finance/collection/actions`. Alternative temporaire : `getArrears` (inclut 10 dernières actions par arrear) + `getCollectionCase` (inclut 20 dernières actions par cas).
- **Colonnes**: Élève, Type d'action, Canal, Message/Notes, Effectué par, Date.
- **Filttres**: `actionType` (CALL/MEETING/SUSPENSION/REMINDER/WARNING/BLOCK/OTHER), `dateRange`, `performerId`, `studentId`.
- **Actions**: créer une nouvelle action (modal).

#### `CasesTab.tsx`
- **Données**: `getCollectionCases({academicYearId, status, minOutstanding})`.
- **Colonnes**: Élève, Année, Total dû, Total payé, Solde, Statut, Niveau escalade, Dernière action, Bloqué jusqu'à.
- **Filtres**: `status` (ON_TIME/LATE/CRITICAL/BLOCKED), `minOutstanding`, `schoolLevelId` (à ajouter backend).
- **Actions**:
  - Clic ligne → `CaseDetailDrawer`
  - Bouton "Synchroniser" (`syncCollectionCase(studentId, academicYearId)`)
  - Bouton "Déclencher relances" (`triggerCaseReminders(studentId, academicYearId)`)
- **Endpoints**: `GET /api/collection/cases`, `POST /api/collection/cases/:studentId/:academicYearId/sync`, `POST /api/collection/cases/:studentId/:academicYearId/trigger-reminders`.

#### `CaseDetailDrawer.tsx`
- **Données**: `getCollectionCase(studentId, academicYearId)` — inclut déjà `student.identifier` + `actions` (20 derniers).
- **Affichage**:
  - En-tête : élève, classe, statut (badge), niveau escalade, montants
  - Timeline chronologique : actions + reminders + promises (nécessite 3 appels ou un endpoint agrégé à créer)
  - Section "Promesses" avec actions honorée/rompue
  - Boutons d'action rapide : nouvelle relance, nouvelle action, sync, trigger

#### `ArrearDetailDrawer.tsx`
- **Données**: déjà incluses dans la réponse `getArrears` (avec `reminders`, `promises`, `actions`).
- **Affichage**:
  - En-tête : élève, fee, montant dû/payé/solde, niveau (badge), dernier paiement
  - Onglets internes : Relances | Promesses | Actions
  - Boutons d'action contextuels

### 8.3 Évolution `financeService` (à ajouter)

```ts
// --- Collection (NEW system) ---
async detectArrears(academicYearId: string): Promise<any> {
  return financeFetch('/api/finance/collection/detect-arrears', { method: 'POST', body: { academicYearId } });
}

async createCollectionReminder(data: { arrearId: string; level: string; channel: string; message?: string }): Promise<any> {
  return financeFetch('/api/finance/collection/reminders', { method: 'POST', body: data });
}

async createPaymentPromise(data: { arrearId: string; promisedAmount: number; promiseDate: string; notes?: string }): Promise<any> {
  return financeFetch('/api/finance/collection/promises', { method: 'POST', body: data });
}

async createCollectionAction(data: { arrearId: string; actionType: string; description?: string }): Promise<any> {
  return financeFetch('/api/finance/collection/actions', { method: 'POST', body: data });
}

async getCollectionStatistics(academicYearId?: string): Promise<any> {
  const qs = academicYearId ? `?academicYearId=${academicYearId}` : '';
  return financeFetch(`/api/finance/collection/statistics${qs}`);
}

// --- Collection Cases ---
async getCollectionCases(params?: Record<string, string>): Promise<any> {
  const qs = params ? new URLSearchParams(params).toString() : '';
  return financeFetch(`/api/collection/cases${qs ? `?${qs}` : ''}`);
}

async getCollectionCase(studentId: string, academicYearId: string): Promise<any> {
  return financeFetch(`/api/collection/cases/${encodeURIComponent(studentId)}/${encodeURIComponent(academicYearId)}`);
}

async syncCollectionCase(studentId: string, academicYearId: string): Promise<any> {
  return financeFetch(`/api/collection/cases/${encodeURIComponent(studentId)}/${encodeURIComponent(academicYearId)}/sync`, { method: 'POST' });
}

async triggerCaseReminders(studentId: string, academicYearId: string): Promise<any> {
  return financeFetch(`/api/collection/cases/${encodeURIComponent(studentId)}/${encodeURIComponent(academicYearId)}/trigger-reminders`, { method: 'POST' });
}
```

### 8.4 Gaps backend à combler (préalables au front)

1. `GET /api/finance/collection/reminders` (filtres `feeArrearId`, `channel`, `reminderStage`, `dateRange`)
2. `GET /api/finance/collection/promises` (filtres `status`, `feeArrearId`, `dateRange`, `overdueOnly`)
3. `PATCH /api/finance/collection/promises/:id` (body `{status: 'HONOURED'|'BROKEN'}`)
4. `GET /api/finance/collection/actions` (filtres `actionType`, `performerId`, `dateRange`)
5. `PATCH /api/finance/collection/cases/:id` (changement manuel de statut)
6. `@Roles` sur `CollectionPrismaController` (sécurité)
7. Cron quotidien `@Cron('0 3 * * *')` sur `CollectionCaseService.triggerAutomaticReminders` pour tous les cas (équivalent du cron nightly du système OLD)
8. Consommation effective de `FinancialSettings.reminderWarningDays` / `reminderUrgentDays` / `reminderFinalDays` à la place des hardcodages J+3/J+7/J+15
9. Unification `blockingThreshold` (DB) vs `RECOVERY_BLOCK_THRESHOLD` (env var)

---

## 9. Renommage de l'onglet "Recouvrement" → "Recouvrement & Arriérés"

Le label "Recouvrement" est défini dans **3 emplacements frontend** qu'il faudra modifier :

### 9.1 Layout principal (Next.js App Router)

**Fichier**: `/home/z/my-project/apps/web-app/src/app/app/finance/layout.tsx`
**Ligne 50**:
```tsx
{ id: 'collection', label: 'Recouvrement', path: '/app/finance/collection', icon: AlertCircle },
```
→ Remplacer `label: 'Recouvrement'` par `label: 'Recouvrement & Arriérés'`.
→ Optionnel : changer l'icône de `AlertCircle` à `BellRing` ou `FileWarning` pour mieux refléter un outil fintech.

### 9.2 Config des onglets partagée

**Fichier**: `/home/z/my-project/apps/web-app/src/components/finance/finance-tabs.tsx`
**Ligne 23**:
```tsx
{ id: 'collection', label: 'Recouvrement', path: '/app/finance/collection', icon: AlertCircle },
```
→ Même modification. (Ce fichier est probablement doublonnnaire du layout — à vérifier s'il est encore utilisé.)

### 9.3 Page Pilote (alternative — peut être legacy)

**Fichier**: `/home/z/my-project/apps/web-app/src/components/pilotage/modules/FinanceModulePage.tsx`
**Ligne 136**:
```tsx
{ id: 'recovery', label: 'Recouvrement', icon: <AlertCircle className="w-4 h-4" /> },
```
→ Même modification. ⚠️ Notez que l'`id` ici est `'recovery'` alors qu'ailleurs c'est `'collection'` — incohérence à harmoniser lors du refactor.

### 9.4 Page rendue

**Fichier**: `/home/z/my-project/apps/web-app/src/app/app/finance/collection/page.tsx`
**Contenu actuel**:
```tsx
'use client';
import RecoveryRemindersContent from '@/components/finance/RecoveryRemindersContent';

export default function CollectionPage() {
  return <RecoveryRemindersContent />;
}
```
→ À remplacer par `<RecoveryContent />` (nouveau composant shell) après refactor.

### 9.5 Autres occurrences de "Recouvrement" (i18n, descriptions, etc.)

Le mot "Recouvrement" apparaît dans 21 fichiers (cf. grep). Les principaux à mettre à jour pour le label d'onglet sont les 3 ci-dessus. Les autres (i18n `fr.json`, descriptions dans `ModuleHeader`, libellés landing page publique) sont des mentions textuelles qui peuvent rester "Recouvrement" seul dans le contexte marketing.

---

## 10. Plan d'action recommandé

| Priorité | Action | Effort |
|---|---|---|
| **P0** | Corriger le bug frontend : `RecoveryRemindersContent` appelle des méthodes inexistantes | XS |
| **P0** | Renommer l'onglet en "Recouvrement & Arriérés" dans les 3 fichiers | XS |
| **P1** | Créer le dossier `components/finance/recovery/` + `RecoveryContent.tsx` (shell) + `RecoveryDashboard.tsx` (KPIs) | M |
| **P1** | Étendre `financeService` avec les 9 nouvelles méthodes (cf. §8.3) | S |
| **P1** | Implémenter `ArrearsTab.tsx` + `ArrearDetailDrawer.tsx` | M |
| **P1** | Implémenter `CasesTab.tsx` + `CaseDetailDrawer.tsx` | M |
| **P2** | Combler les gaps backend : GET /promises, GET /actions, GET /reminders, PATCH /promises/:id, PATCH /cases/:id | M |
| **P2** | Implémenter `PromisesTab.tsx`, `ActionsTab.tsx`, `RemindersTab.tsx` | M |
| **P2** | Ajouter `@Roles` sur `CollectionPrismaController` | XS |
| **P3** | Cron quotidien sur `CollectionCaseService.triggerAutomaticReminders` | S |
| **P3** | Consommer `FinancialSettings.reminderWarningDays/urgentDays/finalDays` au lieu des hardcodages | S |
| **P3** | Unifier `blockingThreshold` (DB) et supprimer `RECOVERY_BLOCK_THRESHOLD` (env) | S |
| **P3** | Intégration envoi réel SMS/WhatsApp (Gupshup/Twilio) sur `CollectionPrismaService.createReminder` | L |

---

## 11. Points de vigilance techniques

1. **Préfixe d'API dual**: `/api/finance/collection/*` pour les arrears/reminders/promises/actions/stats vs `/api/collection/*` pour les cases — probablement une erreur de routage. À corriger côté backend (tout sous `/api/finance/collection/`) ou à documenter pour le front.
2. **Systèmes parallèles OLD/NEW**: ne pas supprimer `RecoveryReminderController`/`Service` tout de suite — le cron `@Cron('0 2 * * *')` tourne encore dessus et envoie des emails réels aux parents. Migration progressive requise.
3. **`CollectionCase.getCollectionCase` mutateur**: un GET peut déclencher un upsert — à corriger (séparer `getOr404` et `upsert`).
4. **`calculateArrearsLevel` ignore `balance`**: le paramètre est passé mais non utilisé — le niveau ne dépend que de `lastPaymentDate`. Si l'élève a payé 99% mais il y a 31 jours, il passe CRITICAL. Bug à corriger.
5. **Pas de pagination**: tous les `findMany` sont en `take: 500` (arrears) ou sans limite (cases). À passer en `cursor`/`skip+take` paginé.
6. **`CollectionReminder` non lié au tenant directement**: le filtre multi-tenant doit toujours passer par `feeArrear.tenantId` — plus lent, à optimiser en ajoutant `tenantId` sur le modèle.

---

## 12. Conclusion

Le backend du module Recouvrement est **fonctionnellement complet** (modèles + endpoints + services + cron nightly + envoi email parent) mais souffre de **deux systèmes parallèles** (OLD `RecoveryReminder` vs NEW `Collection`) avec le frontend câblé sur le mauvais (OLD, et en plus cassé).

Le refactor frontend doit :
1. **Abandonner** le composant `RecoveryRemindersContent.tsx` et le système OLD côté front
2. **Câbler** le nouveau système `Collection` / `CollectionCase` via 9 nouvelles méthodes `financeService`
3. **Structurer** en 6 onglets internes (Dashboard, Arriérés, Relances, Promesses, Actions, Dossiers) sous `RecoveryContent.tsx`
4. **Compléter** le backend avec 5 endpoints GET/PATCH manquants + cron + RBAC

Cette refonte transformera un onglet de listing passif en **outil fintech de recouvrement actif**, aligné sur les standards des ERP SaaS éducatifs modernes (Sage, Cegid, Yurbi).
