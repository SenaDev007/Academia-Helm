-- CreateTable
CREATE TABLE "tenant_stamps" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "educationLevelId" TEXT,
    "circularStampUrl" TEXT,
    "rectangularStampUrl" TEXT,
    "ovalStampUrl" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_stamps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_signatures" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "educationLevelId" TEXT,
    "role" TEXT NOT NULL,
    "holderFirstName" TEXT NOT NULL,
    "holderLastName" TEXT NOT NULL,
    "signatureUrl" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_stamps_tenantId_educationLevelId_key" ON "tenant_stamps"("tenantId", "educationLevelId");

-- CreateIndex
CREATE INDEX "tenant_stamps_tenantId_idx" ON "tenant_stamps"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_stamps_educationLevelId_idx" ON "tenant_stamps"("educationLevelId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_signatures_tenantId_educationLevelId_role_key" ON "tenant_signatures"("tenantId", "educationLevelId", "role");

-- CreateIndex
CREATE INDEX "tenant_signatures_tenantId_idx" ON "tenant_signatures"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_signatures_educationLevelId_idx" ON "tenant_signatures"("educationLevelId");

-- AddForeignKey
ALTER TABLE "tenant_stamps" ADD CONSTRAINT "tenant_stamps_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_stamps" ADD CONSTRAINT "tenant_stamps_educationLevelId_fkey" FOREIGN KEY ("educationLevelId") REFERENCES "education_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_signatures" ADD CONSTRAINT "tenant_signatures_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_signatures" ADD CONSTRAINT "tenant_signatures_educationLevelId_fkey" FOREIGN KEY ("educationLevelId") REFERENCES "education_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
