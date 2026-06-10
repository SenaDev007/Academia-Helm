-- Module 2 — Sous-modules 3 à 8 (Enseignants académiques, Affectations, Espace pédago, Contrôle, ORION)

-- pedagogy_teacher_academic_profiles
CREATE TABLE "pedagogy_teacher_academic_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "maxWeeklyHours" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSemainier" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pedagogy_teacher_academic_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pedagogy_teacher_academic_profiles_tenantId_academicYearId_teacherId_key" ON "pedagogy_teacher_academic_profiles"("tenantId", "academicYearId", "teacherId");
CREATE INDEX "pedagogy_teacher_academic_profiles_tenantId_academicYearId_idx" ON "pedagogy_teacher_academic_profiles"("tenantId", "academicYearId");
CREATE INDEX "pedagogy_teacher_academic_profiles_teacherId_idx" ON "pedagogy_teacher_academic_profiles"("teacherId");
ALTER TABLE "pedagogy_teacher_academic_profiles" ADD CONSTRAINT "pedagogy_teacher_academic_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_teacher_academic_profiles" ADD CONSTRAINT "pedagogy_teacher_academic_profiles_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_teacher_academic_profiles" ADD CONSTRAINT "pedagogy_teacher_academic_profiles_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- pedagogy_teacher_subject_qualifications
CREATE TABLE "pedagogy_teacher_subject_qualifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "certified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pedagogy_teacher_subject_qualifications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pedagogy_teacher_subject_qualifications_profileId_subjectId_key" ON "pedagogy_teacher_subject_qualifications"("profileId", "subjectId");
CREATE INDEX "pedagogy_teacher_subject_qualifications_tenantId_academicYearId_idx" ON "pedagogy_teacher_subject_qualifications"("tenantId", "academicYearId");
ALTER TABLE "pedagogy_teacher_subject_qualifications" ADD CONSTRAINT "pedagogy_teacher_subject_qualifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_teacher_subject_qualifications" ADD CONSTRAINT "pedagogy_teacher_subject_qualifications_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_teacher_subject_qualifications" ADD CONSTRAINT "pedagogy_teacher_subject_qualifications_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "pedagogy_teacher_academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_teacher_subject_qualifications" ADD CONSTRAINT "pedagogy_teacher_subject_qualifications_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- pedagogy_teacher_level_authorizations
CREATE TABLE "pedagogy_teacher_level_authorizations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pedagogy_teacher_level_authorizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pedagogy_teacher_level_authorizations_profileId_levelId_key" ON "pedagogy_teacher_level_authorizations"("profileId", "levelId");
CREATE INDEX "pedagogy_teacher_level_authorizations_tenantId_academicYearId_idx" ON "pedagogy_teacher_level_authorizations"("tenantId", "academicYearId");
ALTER TABLE "pedagogy_teacher_level_authorizations" ADD CONSTRAINT "pedagogy_teacher_level_authorizations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_teacher_level_authorizations" ADD CONSTRAINT "pedagogy_teacher_level_authorizations_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_teacher_level_authorizations" ADD CONSTRAINT "pedagogy_teacher_level_authorizations_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "pedagogy_teacher_academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_teacher_level_authorizations" ADD CONSTRAINT "pedagogy_teacher_level_authorizations_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "pedagogy_academic_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- pedagogy_teacher_availabilities
CREATE TABLE "pedagogy_teacher_availabilities" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pedagogy_teacher_availabilities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pedagogy_teacher_availabilities_tenantId_academicYearId_idx" ON "pedagogy_teacher_availabilities"("tenantId", "academicYearId");
CREATE INDEX "pedagogy_teacher_availabilities_profileId_idx" ON "pedagogy_teacher_availabilities"("profileId");
CREATE INDEX "pedagogy_teacher_availabilities_profileId_dayOfWeek_idx" ON "pedagogy_teacher_availabilities"("profileId", "dayOfWeek");
ALTER TABLE "pedagogy_teacher_availabilities" ADD CONSTRAINT "pedagogy_teacher_availabilities_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_teacher_availabilities" ADD CONSTRAINT "pedagogy_teacher_availabilities_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_teacher_availabilities" ADD CONSTRAINT "pedagogy_teacher_availabilities_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "pedagogy_teacher_academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- pedagogy_teaching_assignments
CREATE TABLE "pedagogy_teaching_assignments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "seriesId" TEXT,
    "weeklyHours" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pedagogy_teaching_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pedagogy_teaching_assignments_tenantId_academicYearId_profileId_classId_subjectId_key" ON "pedagogy_teaching_assignments"("tenantId", "academicYearId", "profileId", "classId", "subjectId");
CREATE INDEX "pedagogy_teaching_assignments_tenantId_academicYearId_idx" ON "pedagogy_teaching_assignments"("tenantId", "academicYearId");
CREATE INDEX "pedagogy_teaching_assignments_profileId_idx" ON "pedagogy_teaching_assignments"("profileId");
CREATE INDEX "pedagogy_teaching_assignments_classId_idx" ON "pedagogy_teaching_assignments"("classId");
ALTER TABLE "pedagogy_teaching_assignments" ADD CONSTRAINT "pedagogy_teaching_assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_teaching_assignments" ADD CONSTRAINT "pedagogy_teaching_assignments_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_teaching_assignments" ADD CONSTRAINT "pedagogy_teaching_assignments_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "pedagogy_teacher_academic_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_teaching_assignments" ADD CONSTRAINT "pedagogy_teaching_assignments_classId_fkey" FOREIGN KEY ("classId") REFERENCES "pedagogy_academic_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedagogy_teaching_assignments" ADD CONSTRAINT "pedagogy_teaching_assignments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedagogy_teaching_assignments" ADD CONSTRAINT "pedagogy_teaching_assignments_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "pedagogy_academic_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- pedagogy_teaching_journals
CREATE TABLE "pedagogy_teaching_journals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pedagogy_teaching_journals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pedagogy_teaching_journals_tenantId_academicYearId_teacherId_weekStartDate_key" ON "pedagogy_teaching_journals"("tenantId", "academicYearId", "teacherId", "weekStartDate");
CREATE INDEX "pedagogy_teaching_journals_tenantId_academicYearId_idx" ON "pedagogy_teaching_journals"("tenantId", "academicYearId");
CREATE INDEX "pedagogy_teaching_journals_teacherId_idx" ON "pedagogy_teaching_journals"("teacherId");
ALTER TABLE "pedagogy_teaching_journals" ADD CONSTRAINT "pedagogy_teaching_journals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_teaching_journals" ADD CONSTRAINT "pedagogy_teaching_journals_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- pedagogy_class_logs
CREATE TABLE "pedagogy_class_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "lessonDate" DATE NOT NULL,
    "topic" TEXT NOT NULL,
    "homework" TEXT,
    "durationHours" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pedagogy_class_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pedagogy_class_logs_tenantId_academicYearId_idx" ON "pedagogy_class_logs"("tenantId", "academicYearId");
CREATE INDEX "pedagogy_class_logs_teacherId_idx" ON "pedagogy_class_logs"("teacherId");
CREATE INDEX "pedagogy_class_logs_classId_idx" ON "pedagogy_class_logs"("classId");
CREATE INDEX "pedagogy_class_logs_lessonDate_idx" ON "pedagogy_class_logs"("lessonDate");
ALTER TABLE "pedagogy_class_logs" ADD CONSTRAINT "pedagogy_class_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_class_logs" ADD CONSTRAINT "pedagogy_class_logs_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- pedagogy_weekly_reports
CREATE TABLE "pedagogy_weekly_reports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "summary" TEXT NOT NULL,
    "issues" TEXT,
    "recommendations" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pedagogy_weekly_reports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pedagogy_weekly_reports_tenantId_academicYearId_teacherId_weekStartDate_key" ON "pedagogy_weekly_reports"("tenantId", "academicYearId", "teacherId", "weekStartDate");
CREATE INDEX "pedagogy_weekly_reports_tenantId_academicYearId_idx" ON "pedagogy_weekly_reports"("tenantId", "academicYearId");
CREATE INDEX "pedagogy_weekly_reports_teacherId_idx" ON "pedagogy_weekly_reports"("teacherId");
ALTER TABLE "pedagogy_weekly_reports" ADD CONSTRAINT "pedagogy_weekly_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_weekly_reports" ADD CONSTRAINT "pedagogy_weekly_reports_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- pedagogy_attachments
CREATE TABLE "pedagogy_attachments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pedagogy_attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pedagogy_attachments_tenantId_idx" ON "pedagogy_attachments"("tenantId");
CREATE INDEX "pedagogy_attachments_entityType_entityId_idx" ON "pedagogy_attachments"("entityType", "entityId");
ALTER TABLE "pedagogy_attachments" ADD CONSTRAINT "pedagogy_attachments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- pedagogy_signatures
CREATE TABLE "pedagogy_signatures" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "signedById" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signatureHash" TEXT NOT NULL,
    CONSTRAINT "pedagogy_signatures_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pedagogy_signatures_tenantId_idx" ON "pedagogy_signatures"("tenantId");
CREATE INDEX "pedagogy_signatures_entityType_entityId_idx" ON "pedagogy_signatures"("entityType", "entityId");
ALTER TABLE "pedagogy_signatures" ADD CONSTRAINT "pedagogy_signatures_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- pedagogy_kpi_snapshots
CREATE TABLE "pedagogy_kpi_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "teacherId" TEXT,
    "classId" TEXT,
    "lessonPlanRate" DOUBLE PRECISION NOT NULL,
    "journalRate" DOUBLE PRECISION NOT NULL,
    "classLogRate" DOUBLE PRECISION NOT NULL,
    "weeklyReportRate" DOUBLE PRECISION NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pedagogy_kpi_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pedagogy_kpi_snapshots_tenantId_academicYearId_idx" ON "pedagogy_kpi_snapshots"("tenantId", "academicYearId");
CREATE INDEX "pedagogy_kpi_snapshots_teacherId_idx" ON "pedagogy_kpi_snapshots"("teacherId");
CREATE INDEX "pedagogy_kpi_snapshots_classId_idx" ON "pedagogy_kpi_snapshots"("classId");
ALTER TABLE "pedagogy_kpi_snapshots" ADD CONSTRAINT "pedagogy_kpi_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_kpi_snapshots" ADD CONSTRAINT "pedagogy_kpi_snapshots_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- orion_pedagogical_insights
CREATE TABLE "orion_pedagogical_insights" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT,
    "insightType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orion_pedagogical_insights_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "orion_pedagogical_insights_tenantId_academicYearId_idx" ON "orion_pedagogical_insights"("tenantId", "academicYearId");
CREATE INDEX "orion_pedagogical_insights_scopeType_idx" ON "orion_pedagogical_insights"("scopeType");
CREATE INDEX "orion_pedagogical_insights_severity_idx" ON "orion_pedagogical_insights"("severity");
ALTER TABLE "orion_pedagogical_insights" ADD CONSTRAINT "orion_pedagogical_insights_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orion_pedagogical_insights" ADD CONSTRAINT "orion_pedagogical_insights_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- orion_risk_flags
CREATE TABLE "orion_risk_flags" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "riskCategory" TEXT NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "level" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orion_risk_flags_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "orion_risk_flags_tenantId_academicYearId_idx" ON "orion_risk_flags"("tenantId", "academicYearId");
CREATE INDEX "orion_risk_flags_entityType_idx" ON "orion_risk_flags"("entityType");
CREATE INDEX "orion_risk_flags_level_idx" ON "orion_risk_flags"("level");
ALTER TABLE "orion_risk_flags" ADD CONSTRAINT "orion_risk_flags_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orion_risk_flags" ADD CONSTRAINT "orion_risk_flags_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- orion_forecasts
CREATE TABLE "orion_forecasts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "predictedAverage" DOUBLE PRECISION NOT NULL,
    "riskProbability" DOUBLE PRECISION NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orion_forecasts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "orion_forecasts_tenantId_academicYearId_idx" ON "orion_forecasts"("tenantId", "academicYearId");
CREATE INDEX "orion_forecasts_entityType_idx" ON "orion_forecasts"("entityType");
ALTER TABLE "orion_forecasts" ADD CONSTRAINT "orion_forecasts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orion_forecasts" ADD CONSTRAINT "orion_forecasts_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
