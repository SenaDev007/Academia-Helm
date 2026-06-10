-- AlterTable: role_permissions - levelScope pour le scope niveau scolaire (alignement schéma Prisma)
ALTER TABLE "role_permissions" ADD COLUMN IF NOT EXISTS "levelScope" TEXT;
