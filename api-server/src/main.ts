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

    // ─── Ensure termination fields on staff (migration 20260608) ───────────
    const terminationAlterStatements = [
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "terminationType" TEXT`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "terminationDetails" JSONB`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "terminatedAt" TIMESTAMPTZ`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "noticePeriodDays" INTEGER`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "lastWorkingDate" TIMESTAMPTZ`,
      `CREATE INDEX IF NOT EXISTS "staff_terminationType_idx" ON "staff"("terminationType")`,
      `CREATE INDEX IF NOT EXISTS "staff_terminatedAt_idx" ON "staff"("terminatedAt")`,
    ];
    for (const stmt of terminationAlterStatements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (err: any) {
        if (!err.message?.includes('already exists') && !err.message?.includes('42P07') && !err.message?.includes('42P16')) {
          logger.warn(`Termination ALTER warning: ${err.message}`);
        }
      }
    }

    // ─── Ensure termination fields on contract (migration 20260608) ────────
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

    // ─── Ensure publishedAt on hr_jobs (migration 20260609100000) ──────────
    const publishedAtStatements = [
      `ALTER TABLE "hr_jobs" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3)`,
    ];
    for (const stmt of publishedAtStatements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (err: any) {
        if (!err.message?.includes('already exists') && !err.message?.includes('42P07') && !err.message?.includes('42P16')) {
          logger.warn(`publishedAt ALTER warning: ${err.message}`);
        }
      }
    }
    // Backfill: set publishedAt to createdAt for jobs that are already PUBLIÉE
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "hr_jobs" SET "publishedAt" = "createdAt" WHERE "status" = 'PUBLIÉE' AND "publishedAt" IS NULL`
      );
    } catch (backfillErr: any) {
      logger.warn(`publishedAt backfill warning: ${backfillErr.message}`);
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

    logger.log('Recruitment tables & columns ensured successfully');
  } catch (fallbackErr: any) {
    logger.error(`Recruitment tables fallback failed: ${fallbackErr.message}`);
    logger.warn('Some HR recruitment features may not work');
  }

  await app.listen(port, '0.0.0.0');

  // Log memory info on startup
  const memUsage = process.memoryUsage();
  logger.log(`Academia Helm API listening on http://0.0.0.0:${port} (PORT=${process.env.PORT ?? 'unset'})`);
  logger.log(`Memory: heapUsed=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB, rss=${Math.round(memUsage.rss / 1024 / 1024)}MB`);

  // FIX OOM: Periodic memory monitoring (every 10 minutes)
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

