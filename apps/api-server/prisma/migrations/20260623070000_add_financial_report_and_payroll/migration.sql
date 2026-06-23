-- CreateTable: FinancialReportHeader
CREATE TABLE IF NOT EXISTS "financial_report_headers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "centreDepot" TEXT,
    "denominationSociale" TEXT,
    "sigleUsuel" TEXT,
    "exerciceClosLe" TEXT,
    "dureeExerciceMois" INTEGER,
    "adresse" TEXT,
    "numeroIF" TEXT,
    "greffe" TEXT,
    "numeroRC" TEXT,
    "numeroCCSS" TEXT,
    "numeroTelephone" TEXT,
    "adresseGeoComplete" TEXT,
    "formeJuridique" TEXT,
    "capitalSocial" TEXT,
    "nombreEmployes" INTEGER,
    "referentielBancaire" TEXT,
    "regimeFiscal" TEXT,
    "paysSiegeSocial" TEXT,
    "nbEtablissementsPays" INTEGER,
    "nbEtablissementsHorsPays" INTEGER,
    "premiereAnneeExercice" TEXT,
    "activiteDesignation" TEXT,
    "activiteLocalisation" TEXT,
    "nbSalaries" INTEGER,
    "chiffreAffaires" DECIMAL(18,2),
    "partsMarcha" TEXT,
    "exportations" TEXT,
    "dirigeants" JSONB,
    "membresConseil" JSONB,
    "commissairesComptes" JSONB,
    "notesApplicables" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "financial_report_headers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "financial_report_headers_tenantId_academicYearId_key" ON "financial_report_headers"("tenantId", "academicYearId");
ALTER TABLE "financial_report_headers" ADD CONSTRAINT "financial_report_headers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: PayrollPeriod
CREATE TABLE IF NOT EXISTS "payroll_periods" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "staffType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalGross" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalNet" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_periods_tenantId_academicYearId_period_staffType_key" ON "payroll_periods"("tenantId", "academicYearId", "period", "staffType");
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Payslip
CREATE TABLE IF NOT EXISTS "payslips" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "salaireBase" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "moinsPercesArriere" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gratificationsEtrennes" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "indemnites" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "primeSalissures" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "salaireBrut" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cnssOuvriere" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "itsNet" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "irppNet" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "avanceAcompte" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "opposition" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxesRadioTele" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalRetenues" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netAPayer" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cnssPatronale" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "vps" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payslips_tenantId_academicYearId_period_idx" ON "payslips"("tenantId", "academicYearId", "period");
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
