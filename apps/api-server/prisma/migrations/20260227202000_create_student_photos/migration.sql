-- Table d'historique des photos élèves (original + HD + thumbnail)
CREATE TABLE IF NOT EXISTS "student_photos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "hdUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_photos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_student_photos_tenant_student" ON "student_photos"("tenantId", "studentId");

