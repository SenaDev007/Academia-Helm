# MODULE PARAMÈTRES — ARCHITECTURE COMPLÈTE

**Date :** 20 février 2026  
**Version :** 1.0  
**Statut :** Architecture validée, prêt pour implémentation

---

## 1. VISION

Le module Paramètres est le **centre de gouvernance** de la plateforme Academia Hub.

> **Règle absolue** : Aucune valeur métier ne doit être codée ailleurs que dans Paramètres.  
> Tous les modules doivent lire leurs configurations depuis ce module.

---

## 2. ANALYSE DE L'EXISTANT

### 2.1 Tables Prisma déjà en place

| Sous-module | Tables existantes | Statut |
|-------------|-------------------|--------|
| Identité | `School`, `SchoolSettings` | ⚠️ Partiel |
| Année scolaire | `AcademicYear` | ✅ OK |
| Structure pédagogique | `SchoolLevel`, `AcademicTrack` | ⚠️ Partiel |
| Option bilingue | `TenantFeature`, `Subscription.bilingualEnabled` | ⚠️ Partiel |
| Feature Flags | `TenantFeature` | ✅ OK |
| Rôles & Permissions | `Role`, `Permission`, `UserRole`, `RolePermission` | ⚠️ Partiel |
| Communication | `CommunicationChannel`, `MessageTemplate`, logs | ⚠️ Partiel |
| Facturation SaaS | `Subscription`, `SubscriptionPlan`, `BillingEvent` | ✅ OK |
| IA ORION | `OrionSettings` | ✅ OK |
| IA ATLAS | `AtlasSettings` | ✅ OK |
| Offline | `OfflineSyncSettings` | ✅ OK |
| Sécurité | `SecuritySettings` | ✅ OK |
| Audit | `AuditLog`, `AuthAuditLog`, `SettingsHistory` | ✅ OK |

### 2.2 Services Backend existants

```
apps/api-server/src/settings/
├── settings.module.ts
├── settings.controller.ts
└── services/
    ├── general-settings.service.ts
    ├── feature-flags.service.ts
    ├── security-settings.service.ts
    ├── orion-settings.service.ts
    ├── atlas-settings.service.ts
    ├── offline-sync-settings.service.ts
    ├── settings-history.service.ts
    ├── administrative-seals.service.ts
    └── electronic-signatures.service.ts
```

---

## 3. GAPS À COMBLER

### 3.1 Identité & Informations établissement

**Champs manquants dans `School` / `SchoolSettings` :**
- `establishmentType` (PUBLIQUE, PRIVEE, CONFESSIONNELLE, INSTITUT, UNIVERSITE)
- `authorizationNumber` (numéro d'autorisation administrative)
- `authorizationDate` (date d'autorisation)
- `foundingDate` (date de création)
- `slogan` (présent dans School mais pas SchoolSettings)
- `secondaryPhone`, `fax`
- `socialMediaLinks` (JSON)
- `version` (pour versioning des infos)

**Action :** Enrichir `SchoolSettings` ou créer `SettingsIdentity`

### 3.2 Structure pédagogique

**Manque :**
- `SettingsPedagogicalStructure` pour activer/désactiver maternelle/primaire/secondaire
- Notion de `Cycle` (ex: Cycle 1, Cycle 2...)
- Liaison explicite niveau ↔ cycle

### 3.3 Option bilingue

**Manque :**
- Table dédiée `SettingsBilingual` avec :
  - `isEnabled`
  - `separateSubjects` (séparer les matières FR/EN)
  - `separateGrades` (séparer les moyennes)
  - `defaultUILanguage`
  - `migrationRequired` (si activation tardive)
  - `migrationStatus`

### 3.4 Communication

**Manque :**
- `SettingsCommunication` pour centraliser :
  - Provider SMS actif + credentials
  - Provider WhatsApp + credentials
  - Config SMTP (host, port, user, pass, from)
  - Expéditeur par défaut
  - Templates par événement

### 3.5 Rôles & Permissions avancés

**Manque :**
- `schoolLevelId` sur `RolePermission` (permission par niveau)
- `canAccessOrion`, `canAccessAtlas` sur `Role`

---

## 4. SCHÉMA PRISMA PROPOSÉ

### 4.1 Enrichissement de SchoolSettings

```prisma
model SchoolSettings {
  id                   String   @id @default(uuid())
  tenantId             String   @unique
  
  // Identité juridique
  schoolName           String
  abbreviation         String?
  establishmentType    String   @default("PRIVEE") // PUBLIQUE, PRIVEE, CONFESSIONNELLE, INSTITUT, UNIVERSITE
  authorizationNumber  String?
  authorizationDate    DateTime?
  foundingDate         DateTime?
  
  // Visuels
  logoUrl              String?
  sealUrl              String?
  signatureUrl         String?
  
  // Localisation
  address              String?
  city                 String?
  department           String?
  country              String   @default("BJ")
  postalCode           String?
  gpsCoordinates       Json?    // { lat, lng }
  
  // Contacts
  primaryPhone         String?
  secondaryPhone       String?
  fax                  String?
  email                String?
  website              String?
  socialMediaLinks     Json?    // { facebook, twitter, linkedin, instagram }
  
  // Paramètres régionaux
  timezone             String   @default("Africa/Porto-Novo")
  defaultLanguage      String   @default("FR")
  currency             String   @default("XOF")
  currencySymbol       String   @default("FCFA")
  
  // Branding
  slogan               String?
  primaryColor         String   @default("#3b82f6")
  secondaryColor       String   @default("#10b981")
  
  // Versioning
  version              Int      @default(1)
  
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  tenant               Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@map("school_settings")
}
```

### 4.2 Nouvelle table SettingsPedagogicalStructure

```prisma
model SettingsPedagogicalStructure {
  id                    String   @id @default(uuid())
  tenantId              String   @unique
  
  // Niveaux actifs
  maternelleEnabled     Boolean  @default(false)
  primaireEnabled       Boolean  @default(true)
  secondaireEnabled     Boolean  @default(true)
  
  // Configuration cycles (JSON flexible)
  cyclesConfiguration   Json?    // [{ code: "CYCLE1", name: "Cycle 1", levels: ["CI", "CP"] }]
  
  // Séries actives (secondaire)
  activeSeries          String[] @default(["A", "C", "D"])
  
  // Contraintes
  allowLevelModification Boolean @default(true)
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  tenant                Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@map("settings_pedagogical_structure")
}
```

### 4.3 Nouvelle table SettingsBilingual

```prisma
model SettingsBilingual {
  id                    String   @id @default(uuid())
  tenantId              String   @unique
  
  isEnabled             Boolean  @default(false)
  separateSubjects      Boolean  @default(true)  // Matières séparées FR/EN
  separateGrades        Boolean  @default(true)  // Moyennes séparées
  defaultUILanguage     String   @default("FR")
  
  // Migration
  migrationRequired     Boolean  @default(false)
  migrationStatus       String?  // PENDING, IN_PROGRESS, COMPLETED, FAILED
  migratedAt            DateTime?
  
  // Impact facturation (lié à Subscription)
  billingImpactAcknowledged Boolean @default(false)
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  tenant                Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@map("settings_bilingual")
}
```

### 4.4 Nouvelle table SettingsCommunication

```prisma
model SettingsCommunication {
  id                    String   @id @default(uuid())
  tenantId              String   @unique
  
  // SMS Provider
  smsProvider           String?  // TWILIO, AFRICAS_TALKING, CUSTOM
  smsCredentials        Json?    // { apiKey, apiSecret, senderId }
  smsEnabled            Boolean  @default(false)
  
  // WhatsApp
  whatsappProvider      String?  // META, TWILIO
  whatsappCredentials   Json?
  whatsappEnabled       Boolean  @default(false)
  
  // Email SMTP
  smtpHost              String?
  smtpPort              Int?     @default(587)
  smtpUser              String?
  smtpPassword          String?  // Encrypted
  smtpFromEmail         String?
  smtpFromName          String?
  smtpSecure            Boolean  @default(true)
  emailEnabled          Boolean  @default(false)
  
  // Expéditeur par défaut
  defaultSenderName     String?
  defaultSenderPhone    String?
  
  // Limites
  dailySmsLimit         Int?
  dailyEmailLimit       Int?
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  tenant                Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@map("settings_communication")
}
```

### 4.5 Enrichissement de Role

```prisma
model Role {
  id              String           @id @default(uuid())
  tenantId        String?
  name            String
  description     String?
  isSystemRole    Boolean          @default(false)
  
  // Accès IA
  canAccessOrion  Boolean          @default(false)
  canAccessAtlas  Boolean          @default(false)
  
  // Niveaux autorisés (vide = tous)
  allowedLevelIds String[]         @default([])
  
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt
  rolePermissions RolePermission[]
  tenant          Tenant?          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  userRoles       UserRole[]

  @@index([tenantId])
  @@map("roles")
}
```

---

## 5. STRUCTURE FRONTEND

### 5.1 Arborescence des pages

```
apps/web-app/src/app/app/settings/
├── page.tsx                          # Page principale avec navigation
├── layout.tsx                        # Layout avec sidebar sous-modules
├── identity/
│   └── page.tsx                      # Identité établissement
├── academic-year/
│   └── page.tsx                      # Année scolaire
├── pedagogical-structure/
│   └── page.tsx                      # Structure pédagogique
├── bilingual/
│   └── page.tsx                      # Option bilingue
├── features/
│   └── page.tsx                      # Feature flags
├── roles/
│   └── page.tsx                      # Rôles & permissions
├── communication/
│   └── page.tsx                      # Communication & notifications
├── billing/
│   └── page.tsx                      # (existant) Facturation
├── ai/
│   └── page.tsx                      # ORION & ATLAS
├── offline/
│   └── page.tsx                      # Synchronisation offline
├── security/
│   └── page.tsx                      # Sécurité & conformité
└── audit/
    └── page.tsx                      # Audit & historique
```

### 5.2 Composants Settings

```
apps/web-app/src/components/settings/
├── SettingsSidebar.tsx               # Navigation sous-modules
├── SettingsHeader.tsx                # En-tête avec breadcrumb
├── SettingsCard.tsx                  # Card de paramètre
├── SettingsToggle.tsx                # Toggle avec confirmation
├── SettingsForm.tsx                  # Formulaire générique
├── SettingsHistory.tsx               # Affichage historique
│
├── identity/
│   ├── IdentityForm.tsx
│   └── LogoUpload.tsx
│
├── academic-year/
│   ├── AcademicYearList.tsx
│   ├── AcademicYearForm.tsx
│   └── AcademicYearDuplicate.tsx
│
├── pedagogical/
│   ├── LevelToggle.tsx
│   ├── CycleConfiguration.tsx
│   └── SeriesConfiguration.tsx
│
├── bilingual/
│   ├── BilingualToggle.tsx
│   └── BilingualMigration.tsx
│
├── features/
│   ├── FeatureCard.tsx
│   └── FeatureBillingImpact.tsx
│
├── roles/
│   ├── RoleList.tsx
│   ├── RoleForm.tsx
│   └── PermissionMatrix.tsx
│
├── communication/
│   ├── SmsProviderConfig.tsx
│   ├── EmailSmtpConfig.tsx
│   ├── WhatsappConfig.tsx
│   └── TemplateEditor.tsx
│
└── (existants)
    ├── AdministrativeSealsManagement.tsx
    ├── ElectronicSignaturesManagement.tsx
    └── PedagogicalOptionsSettings.tsx
```

---

## 6. SERVICES BACKEND À CRÉER

### 6.1 Nouveaux services

```
apps/api-server/src/settings/services/
├── (existants)
│   ├── general-settings.service.ts    → renommer en identity-settings.service.ts
│   ├── feature-flags.service.ts
│   ├── security-settings.service.ts
│   ├── orion-settings.service.ts
│   ├── atlas-settings.service.ts
│   ├── offline-sync-settings.service.ts
│   ├── settings-history.service.ts
│   ├── administrative-seals.service.ts
│   └── electronic-signatures.service.ts
│
└── (à créer)
    ├── academic-year-settings.service.ts
    ├── pedagogical-structure.service.ts
    ├── bilingual-settings.service.ts
    ├── communication-settings.service.ts
    └── roles-permissions.service.ts
```

### 6.2 Endpoints API à ajouter

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/settings/identity` | GET, PUT | Identité établissement |
| `/api/settings/academic-years` | GET, POST, PUT, DELETE | Années scolaires |
| `/api/settings/academic-years/:id/activate` | POST | Activer une année |
| `/api/settings/academic-years/:id/lock` | POST | Verrouiller une année |
| `/api/settings/academic-years/:id/duplicate` | POST | Dupliquer paramètres |
| `/api/settings/pedagogical-structure` | GET, PUT | Structure pédagogique |
| `/api/settings/bilingual` | GET, PUT | Option bilingue |
| `/api/settings/bilingual/check-migration` | GET | Vérifier besoin migration |
| `/api/settings/bilingual/migrate` | POST | Lancer migration |
| `/api/settings/communication` | GET, PUT | Config communication |
| `/api/settings/communication/test-sms` | POST | Tester SMS |
| `/api/settings/communication/test-email` | POST | Tester Email |
| `/api/settings/roles` | GET, POST, PUT, DELETE | Gestion rôles |
| `/api/settings/permissions` | GET | Liste permissions |
| `/api/settings/roles/:id/permissions` | GET, PUT | Permissions d'un rôle |

---

## 7. PLAN D'IMPLÉMENTATION

### Phase 1 : Fondations (Priorité Critique)

1. **Migration Prisma** : Enrichir `SchoolSettings`, créer nouvelles tables
2. **Identity Settings** : Compléter formulaire identité + versioning
3. **Academic Year** : Ajouter verrouillage, duplication
4. **Correction bugs actuels** : Sous-onglet Cachets/Signatures, chargement données

### Phase 2 : Structure & Features

5. **Pedagogical Structure** : Table + UI activation niveaux
6. **Bilingual** : Table + UI + vérification migration
7. **Feature Flags** : Compléter UI avec impact facturation

### Phase 3 : Sécurité & Communication

8. **Roles & Permissions** : UI complète + permissions par niveau
9. **Communication** : Config providers + templates

### Phase 4 : IA & Finalisation

10. **ORION & ATLAS** : Compléter UI existante
11. **Offline & Security** : Compléter UI existante
12. **Audit** : Journal complet + export inspection

---

## 8. RÈGLES TECHNIQUES

### 8.1 Historisation

Chaque modification de paramètre DOIT :
1. Créer une entrée dans `SettingsHistory`
2. Inclure : `oldValue`, `newValue`, `changedBy`, `ipAddress`, `userAgent`
3. Ne jamais supprimer physiquement (soft delete ou archive)

### 8.2 Versioning

Pour les données critiques (identité, cachets) :
1. Incrémenter `version` à chaque modification
2. Les documents générés référencent la version utilisée
3. Permettre de consulter les versions précédentes

### 8.3 Synchronisation Offline

Chaque table settings doit :
1. Avoir un champ `updatedAt` indexé
2. Être réplicable vers SQLite local
3. Gérer les conflits selon la politique configurée

### 8.4 Multi-tenant

Toutes les tables settings :
1. Ont un champ `tenantId` obligatoire (sauf système)
2. Sont filtrées par tenant dans toutes les requêtes
3. Ont RLS activé si PostgreSQL RLS est utilisé

---

## 9. CHECKLIST VALIDATION

Avant de considérer le module terminé :

- [ ] Toutes les valeurs métier lues depuis Paramètres (pas hardcodées)
- [ ] Historique complet et immuable
- [ ] Versioning identité fonctionnel
- [ ] Une seule année scolaire active
- [ ] Feature flags impactent UI et facturation
- [ ] Permissions par niveau fonctionnelles
- [ ] Tests providers communication
- [ ] Export inspection disponible
- [ ] Synchronisation offline opérationnelle

---

## 10. PROCHAINE ÉTAPE

Commencer par la **Phase 1** :
1. Créer la migration Prisma pour enrichir le schéma
2. Corriger les bugs de la page Paramètres actuelle
3. Implémenter le chargement et la sauvegarde des données

Voulez-vous que je commence par la migration Prisma ou par la correction de la page frontend ?
