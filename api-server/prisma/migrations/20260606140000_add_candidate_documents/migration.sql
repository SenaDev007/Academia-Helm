-- CreateTable
CREATE TABLE "hr_candidate_documents" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_candidate_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hr_candidate_documents_candidateId_idx" ON "hr_candidate_documents"("candidateId");

-- AddForeignKey
ALTER TABLE "hr_candidate_documents" ADD CONSTRAINT "hr_candidate_documents_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "hr_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add missing columns to staff_photos for AcademicYear/SchoolLevel relation
ALTER TABLE "staff_photos" ADD COLUMN IF NOT EXISTS "academicYearId" TEXT;
ALTER TABLE "staff_photos" ADD COLUMN IF NOT EXISTS "schoolLevelId" TEXT;

-- AddForeignKey for staff_photos
ALTER TABLE "staff_photos" DROP CONSTRAINT IF EXISTS "staff_photos_academicYearId_fkey";
ALTER TABLE "staff_photos" DROP CONSTRAINT IF EXISTS "staff_photos_schoolLevelId_fkey";
ALTER TABLE "staff_photos" ADD CONSTRAINT "staff_photos_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "staff_photos" ADD CONSTRAINT "staff_photos_schoolLevelId_fkey" FOREIGN KEY ("schoolLevelId") REFERENCES "school_levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
