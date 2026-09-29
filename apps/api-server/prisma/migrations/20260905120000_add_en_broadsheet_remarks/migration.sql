-- ⭐ V10f — Head Teacher's Report (page 2 du broadsheet anglophone)
-- Table des commentaires du Head Teacher par matière, une ligne par fiche
-- (classe × période × type d'évaluation). remarks = JSONB :
--   { "<subjectId>": "comment", "__extra__": { "name": "...", "comment": "..." } }
CREATE TABLE "en_broadsheet_remarks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "evaluationTypeId" TEXT NOT NULL,
    "remarks" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "en_broadsheet_remarks_pkey" PRIMARY KEY ("id")
);

-- Une seule ligne par fiche (tenant + classe + période + type d'évaluation)
CREATE UNIQUE INDEX "en_broadsheet_remarks_tenantId_classId_periodId_evaluationT_key"
    ON "en_broadsheet_remarks"("tenantId", "classId", "periodId", "evaluationTypeId");

CREATE INDEX "en_broadsheet_remarks_tenantId_classId_idx"
    ON "en_broadsheet_remarks"("tenantId", "classId");
