/**
 * Script pour générer une migration initiale même avec des erreurs de relations
 * 
 * OBJECTIF : Créer une migration SQL brute pour toutes les tables
 * même si certaines relations ne sont pas parfaitement définies
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const migrationsDir = join(__dirname, '../prisma/migrations');
const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0].replace('T', '');
const migrationName = `${timestamp}_init_complete_schema`;
const migrationPath = join(migrationsDir, migrationName);

console.log('🔄 Génération d\'une migration initiale complète...\n');

// Créer le répertoire de migration
if (!existsSync(migrationsDir)) {
  mkdirSync(migrationsDir, { recursive: true });
}

if (!existsSync(migrationPath)) {
  mkdirSync(migrationPath, { recursive: true });
}

// Générer le SQL de migration basique
const migrationSQL = `-- Migration: ${migrationName}
-- Description: Migration initiale complète pour Academia Hub
-- Date: ${new Date().toISOString()}
-- 
-- ATTENTION: Cette migration crée toutes les tables de base.
-- Certaines relations peuvent nécessiter des migrations supplémentaires.

-- Activer les extensions PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Countries
CREATE TABLE IF NOT EXISTS "countries" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code3" TEXT,
  "numericCode" TEXT,
  "currencyCode" TEXT,
  "currencySymbol" TEXT,
  "phonePrefix" TEXT,
  "flagEmoji" TEXT,
  "isDefault" BOOLEAN DEFAULT false,
  "isActive" BOOLEAN DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "countries_code_key" ON "countries"("code");

-- Tenants
CREATE TABLE IF NOT EXISTS "tenants" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "subdomain" TEXT,
  "slug" TEXT NOT NULL,
  "schemaName" TEXT,
  "countryId" TEXT NOT NULL,
  "subscriptionStatus" TEXT NOT NULL DEFAULT 'TRIAL',
  "status" TEXT NOT NULL DEFAULT 'active',
  "subscriptionPlan" TEXT NOT NULL DEFAULT 'free',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "trialEndsAt" TIMESTAMP(3),
  "nextPaymentDueAt" TIMESTAMP(3),

  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenants_subdomain_key" ON "tenants"("subdomain");
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON "tenants"("slug");
CREATE INDEX IF NOT EXISTS "tenants_countryId_idx" ON "tenants"("countryId");

-- Academic Years
CREATE TABLE IF NOT EXISTS "academic_years" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "academic_years_tenantId_label_key" ON "academic_years"("tenantId", "label");
CREATE INDEX IF NOT EXISTS "academic_years_tenantId_idx" ON "academic_years"("tenantId");

-- School Levels
CREATE TABLE IF NOT EXISTS "school_levels" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "school_levels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "school_levels_tenantId_code_key" ON "school_levels"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "school_levels_tenantId_idx" ON "school_levels"("tenantId");

-- Academic Tracks
CREATE TABLE IF NOT EXISTS "academic_tracks" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "academic_tracks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "academic_tracks_tenantId_code_key" ON "academic_tracks"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "academic_tracks_tenantId_idx" ON "academic_tracks"("tenantId");

-- Users
CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'active',
  "lastLogin" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_tenantId_idx" ON "users"("tenantId");
CREATE INDEX IF NOT EXISTS "users_tenantId_role_idx" ON "users"("tenantId", "role");

-- ============================================================================
-- NOTE: Cette migration crée uniquement les tables de base.
-- Les autres tables seront créées via des migrations supplémentaires
-- après correction des relations dans le schéma Prisma.
-- ============================================================================

-- Ajouter les contraintes FK de base
ALTER TABLE "tenants" ADD CONSTRAINT IF NOT EXISTS "tenants_countryId_fkey" 
  FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "academic_years" ADD CONSTRAINT IF NOT EXISTS "academic_years_tenantId_fkey" 
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "school_levels" ADD CONSTRAINT IF NOT EXISTS "school_levels_tenantId_fkey" 
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "academic_tracks" ADD CONSTRAINT IF NOT EXISTS "academic_tracks_tenantId_fkey" 
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users" ADD CONSTRAINT IF NOT EXISTS "users_tenantId_fkey" 
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
`;

// Écrire le fichier de migration
writeFileSync(join(migrationPath, 'migration.sql'), migrationSQL, 'utf-8');

// Créer la documentation
const documentation = `# Migration: ${migrationName}

## 📋 Description

Migration initiale complète pour Academia Hub - Tables de base uniquement.

## 📊 Tables Créées

- \`countries\` - Pays
- \`tenants\` - Tenants (écoles)
- \`academic_years\` - Années scolaires
- \`school_levels\` - Niveaux scolaires (Maternelle, Primaire, Secondaire)
- \`academic_tracks\` - Tracks académiques (FR, EN)
- \`users\` - Utilisateurs

## ⚠️  Informations Importantes

- **Destructive** : NON ✅
- **Backup requis** : NON
- **Temps estimé** : 1-2 minutes

## 🔄 Application

\`\`\`bash
# Vérifier la migration
npx prisma migrate status

# Appliquer la migration
npx prisma migrate deploy

# En développement
npx prisma migrate dev
\`\`\`

## 📝 Notes

- Cette migration crée uniquement les tables de base.
- Les autres tables seront créées via des migrations supplémentaires.
- Certaines relations peuvent nécessiter des corrections dans le schéma Prisma.
`;

writeFileSync(join(migrationPath, 'MIGRATION.md'), documentation, 'utf-8');

console.log(`✅ Migration créée: ${migrationName}`);
console.log(`📁 Répertoire: ${migrationPath}`);
console.log(`📄 Fichiers:`);
console.log(`   - migration.sql`);
console.log(`   - MIGRATION.md`);
console.log(`\n💡 Pour appliquer cette migration:`);
console.log(`   npx prisma migrate deploy --schema=prisma/schema.prisma`);
console.log(`\n⚠️  NOTE: Cette migration crée uniquement les tables de base.`);
console.log(`   Les autres tables nécessiteront des migrations supplémentaires`);
console.log(`   après correction des relations dans le schéma Prisma.`);

