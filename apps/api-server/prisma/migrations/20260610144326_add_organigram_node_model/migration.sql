-- CreateTable
CREATE TABLE "organigram_nodes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'POSITION',
    "level" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "schoolLevelCode" TEXT,
    "staffId" TEXT,
    "parentId" TEXT,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organigram_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organigram_nodes_tenantId_idx" ON "organigram_nodes"("tenantId");

-- CreateIndex
CREATE INDEX "organigram_nodes_parentId_idx" ON "organigram_nodes"("parentId");

-- CreateIndex
CREATE INDEX "organigram_nodes_staffId_idx" ON "organigram_nodes"("staffId");

-- CreateIndex
CREATE INDEX "organigram_nodes_type_idx" ON "organigram_nodes"("type");

-- CreateIndex
CREATE INDEX "organigram_nodes_schoolLevelCode_idx" ON "organigram_nodes"("schoolLevelCode");

-- AddForeignKey
ALTER TABLE "organigram_nodes" ADD CONSTRAINT "organigram_nodes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organigram_nodes" ADD CONSTRAINT "organigram_nodes_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organigram_nodes" ADD CONSTRAINT "organigram_nodes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "organigram_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
