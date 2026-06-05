-- ============================================================================
-- Migration: Staff Photo, Dual Matricule, Document Structuring
-- Date: 2026-06-06
-- ============================================================================

-- 1. Add dual matricule columns to staff table
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "globalMatricule" TEXT;
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "tenantMatricule" TEXT;

-- Create unique index on globalMatricule (nullable, so partial index)
CREATE UNIQUE INDEX IF NOT EXISTS "staff_globalMatricule_key" ON "staff"("globalMatricule") WHERE "globalMatricule" IS NOT NULL;

-- Create index on tenantMatricule
CREATE INDEX IF NOT EXISTS "staff_tenantMatricule_idx" ON "staff"("tenantMatricule");

-- 2. Add structured document management columns to staff_documents
ALTER TABLE "staff_documents" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "staff_documents" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "staff_documents" ADD COLUMN IF NOT EXISTS "validationStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "staff_documents" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "staff_documents" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

-- Create indexes for document categorization
CREATE INDEX IF NOT EXISTS "staff_documents_category_idx" ON "staff_documents"("category");
CREATE INDEX IF NOT EXISTS "staff_documents_validationStatus_idx" ON "staff_documents"("validationStatus");

-- 3. Create staff_photos table
CREATE TABLE IF NOT EXISTS "staff_photos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "hdUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_photos_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint on staffId (one photo per staff)
CREATE UNIQUE INDEX IF NOT EXISTS "staff_photos_staffId_key" ON "staff_photos"("staffId");

-- Create index for tenant+staff lookup
CREATE INDEX IF NOT EXISTS "staff_photos_tenantId_staffId_idx" ON "staff_photos"("tenantId", "staffId");

-- Add foreign key constraints
ALTER TABLE "staff_photos" ADD CONSTRAINT "staff_photos_staffId_fkey" 
    FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_photos" ADD CONSTRAINT "staff_photos_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Create staff_number_sequences table
CREATE TABLE IF NOT EXISTS "staff_number_sequences" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_number_sequences_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on tenantId
CREATE UNIQUE INDEX IF NOT EXISTS "staff_number_sequences_tenantId_key" ON "staff_number_sequences"("tenantId");

-- Add foreign key constraint
ALTER TABLE "staff_number_sequences" ADD CONSTRAINT "staff_number_sequences_tenantId_fkey" 
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Add staff relation to staff_photos in tenant
-- (Prisma will handle this via the schema, no need for additional FK on tenants table)
