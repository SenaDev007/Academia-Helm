-- AlterTable: Add missing fields to lesson_plans
ALTER TABLE "lesson_plans" ADD COLUMN "teacherId" TEXT;
ALTER TABLE "lesson_plans" ADD COLUMN "objectives" TEXT;
ALTER TABLE "lesson_plans" ADD COLUMN "methodology" TEXT;
ALTER TABLE "lesson_plans" ADD COLUMN "materials" TEXT;
ALTER TABLE "lesson_plans" ADD COLUMN "evaluation" TEXT;
ALTER TABLE "lesson_plans" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "lesson_plans" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "lesson_plans" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "lesson_plans" ADD COLUMN "validatedAt" TIMESTAMP(3);
ALTER TABLE "lesson_plans" ADD COLUMN "validatedBy" TEXT;
ALTER TABLE "lesson_plans" ADD COLUMN "rejectionReason" TEXT;

-- CreateTable: LessonPlanVersion
CREATE TABLE "lesson_plan_versions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "schoolLevelId" TEXT NOT NULL,
    "lessonPlanId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "changes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_plan_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LessonPlanValidation
CREATE TABLE "lesson_plan_validations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "schoolLevelId" TEXT NOT NULL,
    "lessonPlanId" TEXT NOT NULL,
    "validatorId" TEXT,
    "status" TEXT NOT NULL,
    "comments" TEXT,
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_plan_validations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lesson_plans_status_idx" ON "lesson_plans"("status");
CREATE INDEX "lesson_plans_teacherId_idx" ON "lesson_plans"("teacherId");

-- CreateIndex
CREATE INDEX "lesson_plan_versions_tenant_academic_school_idx" ON "lesson_plan_versions"("tenantId", "academicYearId", "schoolLevelId");
CREATE INDEX "lesson_plan_versions_lessonPlanId_idx" ON "lesson_plan_versions"("lessonPlanId");

-- CreateIndex
CREATE INDEX "lesson_plan_validations_tenant_academic_school_idx" ON "lesson_plan_validations"("tenantId", "academicYearId", "schoolLevelId");
CREATE INDEX "lesson_plan_validations_lessonPlanId_idx" ON "lesson_plan_validations"("lessonPlanId");

-- AddForeignKey
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lesson_plans" ADD CONSTRAINT "lesson_plans_validatedBy_fkey" FOREIGN KEY ("validatedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lesson_plan_versions" ADD CONSTRAINT "lesson_plan_versions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_plan_versions" ADD CONSTRAINT "lesson_plan_versions_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lesson_plan_versions" ADD CONSTRAINT "lesson_plan_versions_schoolLevelId_fkey" FOREIGN KEY ("schoolLevelId") REFERENCES "school_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lesson_plan_versions" ADD CONSTRAINT "lesson_plan_versions_lessonPlanId_fkey" FOREIGN KEY ("lessonPlanId") REFERENCES "lesson_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lesson_plan_validations" ADD CONSTRAINT "lesson_plan_validations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lesson_plan_validations" ADD CONSTRAINT "lesson_plan_validations_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lesson_plan_validations" ADD CONSTRAINT "lesson_plan_validations_schoolLevelId_fkey" FOREIGN KEY ("schoolLevelId") REFERENCES "school_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lesson_plan_validations" ADD CONSTRAINT "lesson_plan_validations_lessonPlanId_fkey" FOREIGN KEY ("lessonPlanId") REFERENCES "lesson_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
