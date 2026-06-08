-- AlterTable: roles - colonnes RBAC / accès IA (alignement schéma Prisma)
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "canAccessOrion" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "canAccessAtlas" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "allowedLevelIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: user_roles - tenantId pour isolation (alignement schéma Prisma)
ALTER TABLE "user_roles" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- AddForeignKey (si pas déjà présente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_tenantId_fkey'
  ) THEN
    ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Index pour user_roles.tenantId
CREATE INDEX IF NOT EXISTS "user_roles_tenantId_idx" ON "user_roles"("tenantId");
