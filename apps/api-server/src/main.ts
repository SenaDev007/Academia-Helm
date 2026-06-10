import { NestFactory } from '@nestjs/core';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { PrismaService } from './database/prisma.service';

/** Défaut Express ~100 ko — insuffisant pour identité + logos base64 (POST /settings/identity).
 *  Réduit de 10mb à 5mb pour limiter la consommation mémoire par requête.
 *  Note: This only applies to JSON/urlencoded bodies, NOT to multipart uploads
 *  which are handled by Multer with their own limits.
 */
const BODY_LIMIT = process.env.JSON_BODY_LIMIT ?? '5mb';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    bodyParser: false,
  });

  app.use(json({ limit: BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: BODY_LIMIT }));

  // ✅ Helmet.js — headers HTTP de sécurité (CDC §16.4.3)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'self'"] },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }));

  // ✅ CORS avec wildcard sous-domaines (CDC §16.4.1)
  const isDev = process.env.NODE_ENV !== 'production';
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Sans origin (appels serveur-serveur, curl, Postman)
      if (!origin) return callback(null, true);
      const allowed =
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        /^https:\/\/(.+\.)?academiahelm\.com$/.test(origin) ||
        /^https:\/\/(.+\.)?academia-hub\.pro$/.test(origin);
      if (allowed || isDev) return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'x-tenant-id', 'Cookie', 'x-school-level-id', 'x-academic-year-id', 'x-module-type'],
  });

  app.useGlobalFilters(new PrismaExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true, // CDC §16.3.3 — rejeter les champs inconnus
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      disableErrorMessages: false, // Always show validation errors for debuggability
    }),
  );

  // Préfixe /api pour le métier ; / et /health restent à la racine (Railway, Fly, load balancers)
  app.setGlobalPrefix('api', {
    exclude: [
      { path: '/', method: RequestMethod.GET },
      { path: 'health', method: RequestMethod.GET },
    ],
  });

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3000);

  // Run pending migrations before starting the server
  try {
    const { execSync } = await import('child_process');
    const appEnv = process.env.APP_ENV || process.env.NODE_ENV || 'production';
    logger.log(`Running database migrations (APP_ENV=${appEnv})...`);
    execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', {
      stdio: 'inherit',
      timeout: 120_000,
    });
    logger.log('Database migrations completed successfully');
  } catch (migrateErr) {
    logger.error(`Migration failed: ${migrateErr.message}`);
    logger.warn('Continuing startup despite migration failure — some features may not work');
  }

  // ─── Ensure recruitment tables exist (idempotent SQL fallback) ──────────
  // Prisma migrate deploy may silently skip migrations that aren't tracked
  // in _prisma_migrations. This fallback guarantees the HR recruitment tables
  // exist on every startup. Uses CREATE TABLE IF NOT EXISTS (idempotent).
  try {
    const prisma = app.get(PrismaService);

    // Execute each CREATE TABLE IF NOT EXISTS statement separately
    // (Prisma $executeRawUnsafe may not handle multi-statement DO $$ blocks)
    const ensureRecruitmentTables = `
      -- hr_candidate_documents (may not exist from earlier migration)
      CREATE TABLE IF NOT EXISTS "hr_candidate_documents" (
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
      CREATE INDEX IF NOT EXISTS "hr_candidate_documents_candidateId_idx" ON "hr_candidate_documents"("candidateId");

      -- hr_teaching_certifications
      CREATE TABLE IF NOT EXISTS "hr_teaching_certifications" (
          "id" TEXT NOT NULL,
          "candidateId" TEXT NOT NULL,
          "certificationName" TEXT NOT NULL,
          "issuer" TEXT NOT NULL,
          CONSTRAINT "hr_teaching_certifications_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "hr_teaching_certifications_candidateId_idx" ON "hr_teaching_certifications"("candidateId");

      -- hr_academic_scores
      CREATE TABLE IF NOT EXISTS "hr_academic_scores" (
          "id" TEXT NOT NULL,
          "candidateId" TEXT NOT NULL,
          "pedagogicalScore" INTEGER NOT NULL,
          "academicScore" INTEGER NOT NULL,
          "globalScore" INTEGER NOT NULL,
          CONSTRAINT "hr_academic_scores_pkey" PRIMARY KEY ("id")
      );

      -- hr_academic_profiles (required by applyJob)
      CREATE TABLE IF NOT EXISTS "hr_academic_profiles" (
          "id" TEXT NOT NULL,
          "candidateId" TEXT NOT NULL,
          "teachingLevel" TEXT NOT NULL,
          "subjects" TEXT[] DEFAULT '{}',
          "pedagogicalExperience" TEXT,
          CONSTRAINT "hr_academic_profiles_pkey" PRIMARY KEY ("id")
      );

      -- hr_ai_reports (required by applyJob)
      CREATE TABLE IF NOT EXISTS "hr_ai_reports" (
          "id" TEXT NOT NULL,
          "candidateId" TEXT NOT NULL,
          "applicationId" TEXT NOT NULL,
          "reportType" TEXT NOT NULL,
          "content" TEXT NOT NULL,
          "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "hr_ai_reports_pkey" PRIMARY KEY ("id")
      );

      -- hr_talent_pool (required by recruitment module)
      CREATE TABLE IF NOT EXISTS "hr_talent_pool" (
          "id" TEXT NOT NULL,
          "candidateId" TEXT NOT NULL,
          "category" TEXT NOT NULL,
          "status" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "hr_talent_pool_pkey" PRIMARY KEY ("id")
      );
    `;

    // Split by semicolons and execute each statement separately
    // to avoid issues with DO $$ blocks and multi-statement execution
    const statements = ensureRecruitmentTables
      .split(';')
      .map(s => s.trim())
      // Remove SQL comments (lines starting with --)
      .map(s => s.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (stmtErr: any) {
        // Ignore "already exists" errors (42P07 = duplicate_table, 42P16 = duplicate_object)
        if (!stmtErr.message?.includes('already exists') && !stmtErr.message?.includes('42P07')) {
          logger.warn(`Recruitment table statement warning: ${stmtErr.message}`);
        }
      }
    }

    // Add foreign keys idempotently
    const fkStatements = [
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_candidate_documents_candidateId_fkey') THEN ALTER TABLE "hr_candidate_documents" ADD CONSTRAINT "hr_candidate_documents_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "hr_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_teaching_certifications_candidateId_fkey') THEN ALTER TABLE "hr_teaching_certifications" ADD CONSTRAINT "hr_teaching_certifications_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "hr_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_academic_scores_candidateId_key') THEN ALTER TABLE "hr_academic_scores" ADD CONSTRAINT "hr_academic_scores_candidateId_key" UNIQUE ("candidateId"); END IF; END $$;`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_academic_scores_candidateId_fkey') THEN ALTER TABLE "hr_academic_scores" ADD CONSTRAINT "hr_academic_scores_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "hr_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`,
      // FK for hr_academic_profiles
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_academic_profiles_candidateId_key') THEN ALTER TABLE "hr_academic_profiles" ADD CONSTRAINT "hr_academic_profiles_candidateId_key" UNIQUE ("candidateId"); END IF; END $$;`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_academic_profiles_candidateId_fkey') THEN ALTER TABLE "hr_academic_profiles" ADD CONSTRAINT "hr_academic_profiles_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "hr_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`,
      // FK for hr_ai_reports
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_ai_reports_candidateId_fkey') THEN ALTER TABLE "hr_ai_reports" ADD CONSTRAINT "hr_ai_reports_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "hr_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_ai_reports_applicationId_fkey') THEN ALTER TABLE "hr_ai_reports" ADD CONSTRAINT "hr_ai_reports_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "hr_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`,
      // FK/UQ for hr_talent_pool
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_talent_pool_candidateId_key') THEN ALTER TABLE "hr_talent_pool" ADD CONSTRAINT "hr_talent_pool_candidateId_key" UNIQUE ("candidateId"); END IF; END $$;`,
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_talent_pool_candidateId_fkey') THEN ALTER TABLE "hr_talent_pool" ADD CONSTRAINT "hr_talent_pool_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "hr_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`,
    ];

    for (const fkStmt of fkStatements) {
      try {
        await prisma.$executeRawUnsafe(fkStmt);
      } catch (fkErr: any) {
        logger.warn(`FK statement warning: ${fkErr.message}`);
      }
    }

    // ─── Ensure missing columns from later migrations (idempotent ALTER) ───
    // These columns may not exist if migrations 20260606180000 or 20260606200000
    // were not applied on the production database.
    const alterStatements = [
      // country, city on hr_candidates (migration 20260606180000)
      `ALTER TABLE "hr_candidates" ADD COLUMN IF NOT EXISTS "country" TEXT`,
      `ALTER TABLE "hr_candidates" ADD COLUMN IF NOT EXISTS "city" TEXT`,
      `CREATE INDEX IF NOT EXISTS "hr_candidates_country_idx" ON "hr_candidates"("country")`,
      `CREATE INDEX IF NOT EXISTS "hr_candidates_city_idx" ON "hr_candidates"("city")`,
      // staffId on hr_applications (migration 20260606200000)
      `ALTER TABLE "hr_applications" ADD COLUMN IF NOT EXISTS "staffId" TEXT`,
      `CREATE INDEX IF NOT EXISTS "hr_applications_staffId_idx" ON "hr_applications"("staffId")`,
      // status, result, feedback on hr_interviews (migration 20260607080000)
      `ALTER TABLE "hr_interviews" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PLANIFIÉ'`,
      `ALTER TABLE "hr_interviews" ADD COLUMN IF NOT EXISTS "result" TEXT`,
      `ALTER TABLE "hr_interviews" ADD COLUMN IF NOT EXISTS "feedback" TEXT`,

      // ─── Staff columns (migration 20260606120000 + later additions) ───
      // These columns are referenced by Prisma Client when including staff in queries
      // (e.g. contract generation, staff list). If the deployed DB doesn't have them,
      // Prisma throws P2022 "column does not exist".
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "globalMatricule" TEXT`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "tenantMatricule" TEXT`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "terminationType" TEXT`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "terminationDetails" JSONB`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "terminatedAt" TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "noticePeriodDays" INTEGER`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "lastWorkingDate" TIMESTAMP WITH TIME ZONE`,
      // Extended staff columns (migration 20260610120000)
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "nationality" TEXT`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "numberOfChildren" INTEGER`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "nationalId" TEXT`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "cnssNumber" TEXT`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "ifuNumber" TEXT`,
      // Schools: city and department columns (referenced by contract generation P2022)
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "city" TEXT`,
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "department" TEXT`,
      // staff indexes for new columns
      `CREATE UNIQUE INDEX IF NOT EXISTS "staff_globalMatricule_key" ON "staff"("globalMatricule")`,
      `CREATE INDEX IF NOT EXISTS "staff_globalMatricule_idx" ON "staff"("globalMatricule")`,
      `CREATE INDEX IF NOT EXISTS "staff_tenantMatricule_idx" ON "staff"("tenantMatricule")`,
      `CREATE INDEX IF NOT EXISTS "staff_status_idx" ON "staff"("status")`,
      `CREATE INDEX IF NOT EXISTS "staff_roleType_idx" ON "staff"("roleType")`,
      `CREATE INDEX IF NOT EXISTS "staff_nationalId_idx" ON "staff"("nationalId")`,
      `CREATE INDEX IF NOT EXISTS "staff_cnssNumber_idx" ON "staff"("cnssNumber")`,

      // ─── staff_documents columns (migration 20260606120000) ───
      `ALTER TABLE "staff_documents" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'GENERAL'`,
      `ALTER TABLE "staff_documents" ADD COLUMN IF NOT EXISTS "description" TEXT`,
      `ALTER TABLE "staff_documents" ADD COLUMN IF NOT EXISTS "validationStatus" TEXT NOT NULL DEFAULT 'PENDING'`,
      `ALTER TABLE "staff_documents" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3)`,
      `ALTER TABLE "staff_documents" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1`,
      `CREATE INDEX IF NOT EXISTS "staff_documents_category_idx" ON "staff_documents"("category")`,
      `CREATE INDEX IF NOT EXISTS "staff_documents_validationStatus_idx" ON "staff_documents"("validationStatus")`,

      // ─── staff_photos table (migration 20260606120000) ───
      // (created via CREATE TABLE IF NOT EXISTS below)

      // ─── employment_contracts columns ───
      // schoolLevelId was added after initial migration
      `ALTER TABLE "employment_contracts" ADD COLUMN IF NOT EXISTS "schoolLevelId" TEXT`,
      `ALTER TABLE "employment_contracts" ADD COLUMN IF NOT EXISTS "templateId" TEXT`,

      // ─── hr_jobs publishedAt (migration 20260609100000) ───
      `ALTER TABLE "hr_jobs" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3)`,
    ];

    for (const alterStmt of alterStatements) {
      try {
        await prisma.$executeRawUnsafe(alterStmt);
      } catch (alterErr: any) {
        if (!alterErr.message?.includes('already exists') && !alterErr.message?.includes('42P07') && !alterErr.message?.includes('42P16')) {
          logger.warn(`ALTER statement warning: ${alterErr.message}`);
        }
      }
    }

    // Add staffId foreign key idempotently (migration 20260606200000)
    try {
      await prisma.$executeRawUnsafe(
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_applications_staffId_fkey') THEN ALTER TABLE "hr_applications" ADD CONSTRAINT "hr_applications_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;`
      );
    } catch (fkErr: any) {
      logger.warn(`staffId FK warning: ${fkErr.message}`);
    }

    // ─── Ensure ALL missing staff columns (migrations 20260606 → 20260609) ──
    // These ALTER statements are idempotent (IF NOT EXISTS) and cover columns
    // from multiple migrations that may not have been applied via prisma migrate.
    const staffAlterStatements = [
      // ── Migration 20260606120000: dual matricule ──
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "globalMatricule" TEXT`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "tenantMatricule" TEXT`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "staff_globalMatricule_key" ON "staff"("globalMatricule") WHERE "globalMatricule" IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS "staff_tenantMatricule_idx" ON "staff"("tenantMatricule")`,

      // ── Migration 20260608120000: termination tracking ──
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "terminationType" TEXT`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "terminationDetails" JSONB`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "terminatedAt" TIMESTAMPTZ`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "noticePeriodDays" INTEGER`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "lastWorkingDate" TIMESTAMPTZ`,
      `CREATE INDEX IF NOT EXISTS "staff_terminationType_idx" ON "staff"("terminationType")`,
      `CREATE INDEX IF NOT EXISTS "staff_terminatedAt_idx" ON "staff"("terminatedAt")`,

      // ── Migration 20260609120000: HR fields (fiche personnel) ──
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "nationality" TEXT`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "numberOfChildren" INTEGER`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "nationalId" TEXT`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "cnssNumber" TEXT`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "ifuNumber" TEXT`,
      `CREATE INDEX IF NOT EXISTS "staff_cnssNumber_idx" ON "staff"("cnssNumber")`,

      // ── Schools: city and department (P2022 fix for contract generation) ──
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "city" TEXT`,
      `ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "department" TEXT`,
    ];
    for (const stmt of staffAlterStatements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (err: any) {
        if (!err.message?.includes('already exists') && !err.message?.includes('42P07') && !err.message?.includes('42P16')) {
          logger.warn(`Staff ALTER warning: ${stmt.substring(0, 80)}… — ${err.message}`);
        }
      }
    }

    // ── Ensure staff_documents extended columns (migration 20260606120000) ──
    const staffDocAlterStatements = [
      `ALTER TABLE "staff_documents" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'GENERAL'`,
      `ALTER TABLE "staff_documents" ADD COLUMN IF NOT EXISTS "description" TEXT`,
      `ALTER TABLE "staff_documents" ADD COLUMN IF NOT EXISTS "validationStatus" TEXT NOT NULL DEFAULT 'PENDING'`,
      `ALTER TABLE "staff_documents" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3)`,
      `ALTER TABLE "staff_documents" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1`,
      `CREATE INDEX IF NOT EXISTS "staff_documents_category_idx" ON "staff_documents"("category")`,
      `CREATE INDEX IF NOT EXISTS "staff_documents_validationStatus_idx" ON "staff_documents"("validationStatus")`,
    ];
    for (const stmt of staffDocAlterStatements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (err: any) {
        if (!err.message?.includes('already exists') && !err.message?.includes('42P07') && !err.message?.includes('42P16')) {
          logger.warn(`StaffDoc ALTER warning: ${err.message}`);
        }
      }
    }

    // ── Ensure staff_photos table (migration 20260606120000) ──
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "staff_photos" (
            "id" TEXT NOT NULL,
            "tenantId" TEXT NOT NULL,
            "staffId" TEXT NOT NULL,
            "originalUrl" TEXT NOT NULL,
            "hdUrl" TEXT NOT NULL,
            "thumbnailUrl" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "staff_photos_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "staff_photos_staffId_key" ON "staff_photos"("staffId")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "staff_photos_tenantId_staffId_idx" ON "staff_photos"("tenantId", "staffId")`
      );
      // FK for staff_photos
      await prisma.$executeRawUnsafe(
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_photos_staffId_fkey') THEN ALTER TABLE "staff_photos" ADD CONSTRAINT "staff_photos_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`
      );
      await prisma.$executeRawUnsafe(
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_photos_tenantId_fkey') THEN ALTER TABLE "staff_photos" ADD CONSTRAINT "staff_photos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`
      );
    } catch (photoErr: any) {
      if (!photoErr.message?.includes('already exists') && !photoErr.message?.includes('42P07') && !photoErr.message?.includes('42P16')) {
        logger.warn(`staff_photos table warning: ${photoErr.message}`);
      }
    }

    // ── Ensure staff_number_sequences table (migration 20260606120000) ──
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "staff_number_sequences" (
            "id" TEXT NOT NULL,
            "tenantId" TEXT NOT NULL,
            "current" INTEGER NOT NULL DEFAULT 0,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "staff_number_sequences_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "staff_number_sequences_tenantId_key" ON "staff_number_sequences"("tenantId")`
      );
      await prisma.$executeRawUnsafe(
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_number_sequences_tenantId_fkey') THEN ALTER TABLE "staff_number_sequences" ADD CONSTRAINT "staff_number_sequences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`
      );
    } catch (seqErr: any) {
      if (!seqErr.message?.includes('already exists') && !seqErr.message?.includes('42P07') && !seqErr.message?.includes('42P16')) {
        logger.warn(`staff_number_sequences table warning: ${seqErr.message}`);
      }
    }

    // ── Ensure contract termination fields (migration 20260608) ──
    const contractTerminationStatements = [
      `ALTER TABLE "contract" ADD COLUMN IF NOT EXISTS "terminatedAt" TIMESTAMPTZ`,
      `ALTER TABLE "contract" ADD COLUMN IF NOT EXISTS "terminationReason" TEXT`,
    ];
    for (const stmt of contractTerminationStatements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (err: any) {
        if (!err.message?.includes('already exists') && !err.message?.includes('42P07') && !err.message?.includes('42P16')) {
          logger.warn(`Contract termination ALTER warning: ${err.message}`);
        }
      }
    }

    // ── Ensure publishedAt on hr_jobs (migration 20260609100000) ──
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "hr_jobs" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3)`);
    } catch (err: any) {
      if (!err.message?.includes('already exists') && !err.message?.includes('42P07') && !err.message?.includes('42P16')) {
        logger.warn(`hr_jobs publishedAt warning: ${err.message}`);
      }
    }

    // ─── Ensure job_number_sequences table (migration 20260606220000) ──────
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "job_number_sequences" (
            "id" TEXT NOT NULL,
            "tenantId" TEXT NOT NULL,
            "current" INTEGER NOT NULL DEFAULT 0,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "job_number_sequences_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "job_number_sequences_tenantId_key" ON "job_number_sequences"("tenantId")`
      );
      await prisma.$executeRawUnsafe(
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_number_sequences_tenantId_fkey') THEN ALTER TABLE "job_number_sequences" ADD CONSTRAINT "job_number_sequences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`
      );
    } catch (seqErr: any) {
      logger.warn(`job_number_sequences table warning: ${seqErr.message}`);
    }

    // ─── Ensure staff_photos table (migration 20260606120000) ──────────────
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "staff_photos" (
            "id" TEXT NOT NULL,
            "tenantId" TEXT NOT NULL,
            "staffId" TEXT NOT NULL,
            "originalUrl" TEXT NOT NULL,
            "hdUrl" TEXT NOT NULL,
            "thumbnailUrl" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "academicYearId" TEXT,
            "schoolLevelId" TEXT,
            CONSTRAINT "staff_photos_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "staff_photos_staffId_key" ON "staff_photos"("staffId")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "staff_photos_tenantId_staffId_idx" ON "staff_photos"("tenantId", "staffId")`
      );
      await prisma.$executeRawUnsafe(
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_photos_staffId_fkey') THEN ALTER TABLE "staff_photos" ADD CONSTRAINT "staff_photos_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`
      );
      await prisma.$executeRawUnsafe(
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_photos_tenantId_fkey') THEN ALTER TABLE "staff_photos" ADD CONSTRAINT "staff_photos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`
      );
    } catch (photoErr: any) {
      logger.warn(`staff_photos table warning: ${photoErr.message}`);
    }

    // ─── Ensure staff_number_sequences table (migration 20260606120000) ───
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "staff_number_sequences" (
            "id" TEXT NOT NULL,
            "tenantId" TEXT NOT NULL UNIQUE,
            "current" INTEGER NOT NULL DEFAULT 0,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "staff_number_sequences_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_number_sequences_tenantId_fkey') THEN ALTER TABLE "staff_number_sequences" ADD CONSTRAINT "staff_number_sequences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`
      );
    } catch (seqErr2: any) {
      logger.warn(`staff_number_sequences table warning: ${seqErr2.message}`);
    }

    // ─── Ensure employee_cnss table ──────────────────────────────────────
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "employee_cnss" (
            "id" TEXT NOT NULL,
            "tenantId" TEXT NOT NULL,
            "staffId" TEXT NOT NULL,
            "cnssNumber" TEXT,
            "affiliationDate" DATE,
            "isActive" BOOLEAN NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "employee_cnss_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "employee_cnss_staffId_key" ON "employee_cnss"("staffId")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "employee_cnss_tenantId_idx" ON "employee_cnss"("tenantId")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "employee_cnss_staffId_idx" ON "employee_cnss"("staffId")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "employee_cnss_cnssNumber_idx" ON "employee_cnss"("cnssNumber")`
      );
      await prisma.$executeRawUnsafe(
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_cnss_staffId_fkey') THEN ALTER TABLE "employee_cnss" ADD CONSTRAINT "employee_cnss_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`
      );
      await prisma.$executeRawUnsafe(
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_cnss_tenantId_fkey') THEN ALTER TABLE "employee_cnss" ADD CONSTRAINT "employee_cnss_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;`
      );
    } catch (cnssErr: any) {
      logger.warn(`employee_cnss table warning: ${cnssErr.message}`);
    }

    logger.log('HR tables & columns ensured successfully');
  } catch (fallbackErr: any) {
    logger.error(`Recruitment tables fallback failed: ${fallbackErr.message}`);
    logger.warn('Some HR recruitment features may not work');
  }

  await app.listen(port, '0.0.0.0');

  // Log memory info on startup
  const memUsage = process.memoryUsage();
  logger.log(`Academia Helm API listening on http://0.0.0.0:${port} (PORT=${process.env.PORT ?? 'unset'})`);
  logger.log(`Memory: heapUsed=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB, rss=${Math.round(memUsage.rss / 1024 / 1024)}MB`);

  // Periodic memory monitoring (every 10 minutes) — v2026.06.09
  // Logs heap usage and triggers GC if heap is above 80% of max
  setInterval(() => {
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
    const rssMB = Math.round(mem.rss / 1024 / 1024);
    const maxHeapMB = parseInt(process.env.MAX_HEAP_MB ?? '3072', 10); // matches --max-old-space-size
    const heapPercent = Math.round((mem.heapUsed / (maxHeapMB * 1024 * 1024)) * 100);

    if (heapPercent > 70) {
      logger.warn(`Memory pressure: heapUsed=${heapUsedMB}MB/${maxHeapMB}MB (${heapPercent}%), rss=${rssMB}MB`);
    }

    // Force GC if heap usage exceeds 80% and --expose-gc is enabled
    if (heapPercent > 80 && global.gc) {
      logger.warn(`Triggering GC due to high heap usage (${heapPercent}%)`);
      global.gc();
      const afterGC = process.memoryUsage();
      logger.log(`After GC: heapUsed=${Math.round(afterGC.heapUsed / 1024 / 1024)}MB, rss=${Math.round(afterGC.rss / 1024 / 1024)}MB`);
    }
  }, 10 * 60 * 1000);
}
bootstrap();

