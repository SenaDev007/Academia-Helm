/**
 * ============================================================================
 * MIGRATION V2 — school_directors : ajout colonne staffId
 * ============================================================================
 *
 * Avant : les directeurs étaient saisis manuellement (fullName, email, phone).
 * Maintenant : on sélectionne un directeur parmi le personnel existant (Staff).
 * On ajoute la colonne `staffId` pour faire le lien.
 *
 * ⭐ Idempotent : peut être exécuté plusieurs fois sans erreur grâce à
 *    `ADD COLUMN IF NOT EXISTS` (PostgreSQL 9.6+).
 *
 * ============================================================================
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Migration school_directors V2 — ajout colonne staffId');

  // Vérifier si la table school_directors existe
  const tableExists = await prisma.$queryRawUnsafe(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'school_directors'
    );
  `);

  if (!tableExists[0]?.exists) {
    console.log('⚠️  Table school_directors n\'existe pas encore — création initiale...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "school_directors" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "schoolLevelId" TEXT NOT NULL,
        "language" TEXT DEFAULT 'FR',
        "fullName" TEXT NOT NULL,
        "functionLabel" TEXT,
        "email" TEXT,
        "phone" TEXT,
        "signatureDataUrl" TEXT,
        "signatureUploadedUrl" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdById" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "school_directors_tenant_level_language_idx"
        ON "school_directors"("tenantId", "schoolLevelId", "language");
    `);
    console.log('✅ Table school_directors créée');
  }

  // ⭐ Ajouter la colonne staffId si elle n'existe pas déjà
  console.log('➕ Ajout de la colonne staffId...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "school_directors"
    ADD COLUMN IF NOT EXISTS "staffId" TEXT;
  `);
  console.log('✅ Colonne staffId ajoutée (ou déjà présente)');

  // Vérifier que la colonne existe
  const columnCheck = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'school_directors' AND column_name = 'staffId';
  `);

  if (columnCheck.length > 0) {
    console.log('✅ Vérification : la colonne staffId existe bien');
  } else {
    throw new Error('❌ La colonne staffId n\'a pas pu être ajoutée');
  }

  console.log('🎉 Migration terminée avec succès');
}

main()
  .catch((e) => {
    console.error('❌ Erreur migration :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
