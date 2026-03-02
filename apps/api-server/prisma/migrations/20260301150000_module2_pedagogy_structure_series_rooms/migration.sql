-- Module 2: Structure académique, Matières & séries, Salles (maintenance + planning)

-- pedagogy_academic_levels
CREATE TABLE "pedagogy_academic_levels" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedagogy_academic_levels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pedagogy_academic_levels_tenantId_academicYearId_name_key" ON "pedagogy_academic_levels"("tenantId", "academicYearId", "name");
CREATE INDEX "pedagogy_academic_levels_tenantId_academicYearId_idx" ON "pedagogy_academic_levels"("tenantId", "academicYearId");
ALTER TABLE "pedagogy_academic_levels" ADD CONSTRAINT "pedagogy_academic_levels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_academic_levels" ADD CONSTRAINT "pedagogy_academic_levels_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- pedagogy_academic_cycles
CREATE TABLE "pedagogy_academic_cycles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedagogy_academic_cycles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pedagogy_academic_cycles_tenantId_academicYearId_levelId_name_key" ON "pedagogy_academic_cycles"("tenantId", "academicYearId", "levelId", "name");
CREATE INDEX "pedagogy_academic_cycles_tenantId_academicYearId_idx" ON "pedagogy_academic_cycles"("tenantId", "academicYearId");
CREATE INDEX "pedagogy_academic_cycles_levelId_idx" ON "pedagogy_academic_cycles"("levelId");
ALTER TABLE "pedagogy_academic_cycles" ADD CONSTRAINT "pedagogy_academic_cycles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_academic_cycles" ADD CONSTRAINT "pedagogy_academic_cycles_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_academic_cycles" ADD CONSTRAINT "pedagogy_academic_cycles_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "pedagogy_academic_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- pedagogy_academic_classes
CREATE TABLE "pedagogy_academic_classes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "capacity" INTEGER,
    "roomId" TEXT,
    "mainTeacherId" TEXT,
    "languageTrack" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedagogy_academic_classes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pedagogy_academic_classes_tenantId_academicYearId_code_key" ON "pedagogy_academic_classes"("tenantId", "academicYearId", "code");
CREATE INDEX "pedagogy_academic_classes_tenantId_academicYearId_idx" ON "pedagogy_academic_classes"("tenantId", "academicYearId");
CREATE INDEX "pedagogy_academic_classes_levelId_idx" ON "pedagogy_academic_classes"("levelId");
CREATE INDEX "pedagogy_academic_classes_cycleId_idx" ON "pedagogy_academic_classes"("cycleId");
CREATE INDEX "pedagogy_academic_classes_roomId_idx" ON "pedagogy_academic_classes"("roomId");
ALTER TABLE "pedagogy_academic_classes" ADD CONSTRAINT "pedagogy_academic_classes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_academic_classes" ADD CONSTRAINT "pedagogy_academic_classes_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_academic_classes" ADD CONSTRAINT "pedagogy_academic_classes_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "pedagogy_academic_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedagogy_academic_classes" ADD CONSTRAINT "pedagogy_academic_classes_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "pedagogy_academic_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedagogy_academic_classes" ADD CONSTRAINT "pedagogy_academic_classes_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pedagogy_academic_classes" ADD CONSTRAINT "pedagogy_academic_classes_mainTeacherId_fkey" FOREIGN KEY ("mainTeacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- pedagogy_academic_series
CREATE TABLE "pedagogy_academic_series" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedagogy_academic_series_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pedagogy_academic_series_tenantId_academicYearId_levelId_name_key" ON "pedagogy_academic_series"("tenantId", "academicYearId", "levelId", "name");
CREATE INDEX "pedagogy_academic_series_tenantId_academicYearId_idx" ON "pedagogy_academic_series"("tenantId", "academicYearId");
CREATE INDEX "pedagogy_academic_series_levelId_idx" ON "pedagogy_academic_series"("levelId");
ALTER TABLE "pedagogy_academic_series" ADD CONSTRAINT "pedagogy_academic_series_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_academic_series" ADD CONSTRAINT "pedagogy_academic_series_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_academic_series" ADD CONSTRAINT "pedagogy_academic_series_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "pedagogy_academic_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- pedagogy_series_subjects
CREATE TABLE "pedagogy_series_subjects" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "coefficient" INTEGER NOT NULL,
    "weeklyHours" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedagogy_series_subjects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pedagogy_series_subjects_seriesId_subjectId_key" ON "pedagogy_series_subjects"("seriesId", "subjectId");
CREATE INDEX "pedagogy_series_subjects_tenantId_academicYearId_idx" ON "pedagogy_series_subjects"("tenantId", "academicYearId");
CREATE INDEX "pedagogy_series_subjects_seriesId_idx" ON "pedagogy_series_subjects"("seriesId");
CREATE INDEX "pedagogy_series_subjects_subjectId_idx" ON "pedagogy_series_subjects"("subjectId");
ALTER TABLE "pedagogy_series_subjects" ADD CONSTRAINT "pedagogy_series_subjects_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_series_subjects" ADD CONSTRAINT "pedagogy_series_subjects_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_series_subjects" ADD CONSTRAINT "pedagogy_series_subjects_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "pedagogy_academic_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_series_subjects" ADD CONSTRAINT "pedagogy_series_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- pedagogy_subject_programs
CREATE TABLE "pedagogy_subject_programs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedagogy_subject_programs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pedagogy_subject_programs_tenantId_academicYearId_idx" ON "pedagogy_subject_programs"("tenantId", "academicYearId");
CREATE INDEX "pedagogy_subject_programs_subjectId_idx" ON "pedagogy_subject_programs"("subjectId");
ALTER TABLE "pedagogy_subject_programs" ADD CONSTRAINT "pedagogy_subject_programs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_subject_programs" ADD CONSTRAINT "pedagogy_subject_programs_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_subject_programs" ADD CONSTRAINT "pedagogy_subject_programs_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- pedagogy_room_maintenances
CREATE TABLE "pedagogy_room_maintenances" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedagogy_room_maintenances_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pedagogy_room_maintenances_tenantId_idx" ON "pedagogy_room_maintenances"("tenantId");
CREATE INDEX "pedagogy_room_maintenances_roomId_idx" ON "pedagogy_room_maintenances"("roomId");
ALTER TABLE "pedagogy_room_maintenances" ADD CONSTRAINT "pedagogy_room_maintenances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_room_maintenances" ADD CONSTRAINT "pedagogy_room_maintenances_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- pedagogy_room_schedules
CREATE TABLE "pedagogy_room_schedules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "classId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedagogy_room_schedules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pedagogy_room_schedules_tenantId_academicYearId_idx" ON "pedagogy_room_schedules"("tenantId", "academicYearId");
CREATE INDEX "pedagogy_room_schedules_roomId_idx" ON "pedagogy_room_schedules"("roomId");
CREATE INDEX "pedagogy_room_schedules_roomId_dayOfWeek_startTime_idx" ON "pedagogy_room_schedules"("roomId", "dayOfWeek", "startTime");
ALTER TABLE "pedagogy_room_schedules" ADD CONSTRAINT "pedagogy_room_schedules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_room_schedules" ADD CONSTRAINT "pedagogy_room_schedules_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedagogy_room_schedules" ADD CONSTRAINT "pedagogy_room_schedules_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
