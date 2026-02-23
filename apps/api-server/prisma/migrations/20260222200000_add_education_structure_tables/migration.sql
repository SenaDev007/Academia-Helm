-- Structure pédagogique : education_levels, education_cycles, education_grades, classrooms

-- CreateTable
CREATE TABLE "education_levels" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "education_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education_cycles" (
    "id" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "education_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education_grades" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "education_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classrooms" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "education_levels_tenantId_name_key" ON "education_levels"("tenantId", "name");
CREATE UNIQUE INDEX "education_cycles_levelId_name_key" ON "education_cycles"("levelId", "name");
CREATE UNIQUE INDEX "education_grades_cycleId_code_key" ON "education_grades"("cycleId", "code");
CREATE UNIQUE INDEX "classrooms_tenantId_academicYearId_name_key" ON "classrooms"("tenantId", "academicYearId", "name");

-- Indexes
CREATE INDEX "education_cycles_levelId_idx" ON "education_cycles"("levelId");
CREATE INDEX "education_grades_cycleId_idx" ON "education_grades"("cycleId");
CREATE INDEX "classrooms_tenantId_academicYearId_idx" ON "classrooms"("tenantId", "academicYearId");
CREATE INDEX "classrooms_gradeId_idx" ON "classrooms"("gradeId");

-- Foreign keys
ALTER TABLE "education_levels" ADD CONSTRAINT "education_levels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "education_cycles" ADD CONSTRAINT "education_cycles_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "education_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "education_grades" ADD CONSTRAINT "education_grades_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "education_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "education_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
