import { NestFactory } from '@nestjs/core';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { json, urlencoded, static as expressStatic } from 'express';
import { join } from 'path';
import helmet from 'helmet';
import { createWebSocketAdapter } from './common/adapters/redis-io.adapter';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { PrismaService } from './database/prisma.service';
import { CommunityBootstrap } from './community/community.bootstrap';

/**
 * ⭐ Polyfill global : permet à JSON.stringify de sérialiser les BigInt.
 *
 * Problème : Prisma retourne des BigInt pour certaines colonnes Postgres
 * (BIGINT, SERIAL). JSON.stringify() ne sait pas les sérialiser nativement
 * → erreur "Do not know how to serialize a BigInt" → HTTP 500 sur toutes
 * les routes qui retournent des données contenant un BigInt.
 *
 * Solution : on ajoute un toJSON() au prototype BigInt qui retourne la
 * valeur en string (pour ne pas perdre de précision). Cela affecte toutes
 * les réponses JSON du backend, pas seulement sync.service.ts.
 *
 * Note : on retourne une string pour préserver la précision (un BigInt
 * peut dépasser Number.MAX_SAFE_INTEGER). Le frontend devra faire
 * BigInt(value) ou Number(value) selon le cas.
 */
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

/** Défaut Express ~100 ko — insuffisant pour identité + logos base64 (POST /settings/identity).
 *  Réduit de 10mb à 5mb pour limiter la consommation mémoire par requête.
 *  Note: This only applies to JSON/urlencoded bodies, NOT to multipart uploads
 *  which are handled by Multer with their own limits.
 */
const BODY_LIMIT = process.env.JSON_BODY_LIMIT ?? '5mb';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // ⭐ 2026-10-16 — FIX RATE LIMIT LOGGING RAILWAY (boot) :
  //    « Railway rate limit reached for deployment… Messages dropped: 82 ».
  //    Le mappage des routes (RouterExplorer ~600 routes) + l'init des modules
  //    (InstanceLoader ~200 lignes) généraient des milliers de lignes en
  //    quelques secondes au boot → dépassement du rate limit de logging
  //    Railway (perte des VRAIS logs de diagnostic) + pression mémoire des
  //    buffers. En production, ces contextes verbeux sont silencieux ; les
  //    logs applicatifs (Bootstrap, erreurs, warnings) passent normalement.
  const isProdEnv =
    process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
  const BOOT_NOISY_CONTEXTS = [
    'RouterExplorer',
    'RoutesResolver',
    'RouterMethodExplorer',
    'InstanceLoader',
    'InstanceWrapper',
    'DependenciesMap',
  ];
  const isBootNoise = (...args: unknown[]): boolean => {
    if (!isProdEnv) return false;
    // Le contexte peut arriver en paramètre séparé (« RouterExplorer ») ou
    // déjà formaté dans le message (« [RouterExplorer] Mapped … ») — on teste
    // la simple présence du nom de contexte dans la concaténation.
    const flat = args
      .map((a) => (typeof a === 'string' ? a : a != null ? String((a as any).message ?? a) : ''))
      .join(' ');
    return BOOT_NOISY_CONTEXTS.some((ctx) => flat.includes(ctx));
  };

  const app = await NestFactory.create(AppModule, {
    logger: isProdEnv
      ? {
          log: (message: any, ...optionalParams: any[]) => {
            if (isBootNoise(message, ...optionalParams)) return;
            console.log(message, ...(optionalParams ?? []));
          },
          error: (message: any, ...optionalParams: any[]) => {
            console.error(message, ...(optionalParams ?? []));
          },
          warn: (message: any, ...optionalParams: any[]) => {
            console.warn(message, ...(optionalParams ?? []));
          },
          debug: () => undefined,
          verbose: () => undefined,
          fatal: (message: any, ...optionalParams: any[]) => {
            console.error(message, ...(optionalParams ?? []));
          },
          setLogLevels: () => undefined,
        }
      : (['error', 'warn', 'log'] as const),
    bodyParser: false,
  });

  // ⭐ PERFORMANCE CONCURRENCE — trust proxy :
  //    Derrière le proxy Railway/Vercel, req.ip vaut l'IP du PROXY sans ce
  //    réglage → TOUS les utilisateurs partageaient un seul bucket de rate
  //    limit (300 req/min) → dès que ~8 utilisateurs se connectaient en même
  //    temps, le throttler rejetait les suivants en 429 (« le site buguait »).
  //    Avec trust proxy, req.ip = l'IP réelle du client (X-Forwarded-For).
  app.set('trust proxy', true);

  // ⭐ PERFORMANCE CONCURRENCE — compression gzip des réponses JSON :
  //    les dashboards/listes renvoient souvent 100 Ko+ de JSON ; sur les
  //    connexions mobiles (3G/4G écoles), le transfert domine la latence.
  //    gzip divise le payload par 5-10×. Seuil 1 Ko pour ne pas compresser
  //    les micro-réponses. Niveau 6 (défaut) : ~5 ms CPU / 100 Ko.
  try {
    const compression = require('compression');
    app.use(compression({ threshold: 1024 }));
  } catch (e: any) {
    logger.warn(`compression middleware indisponible: ${e?.message || e}`);
  }

  // ⭐ raw-body middleware — obligatoire pour la vérification de signature
  // des webhooks FedaPay. Sans req.rawBody, le fallback JSON.stringify(body)
  // peut produire des bytes différents de l'original → HMAC mismatch.
  app.use(json({
    limit: BODY_LIMIT,
    verify: (req: any, res: any, buf: Buffer) => {
      req.rawBody = buf;
    },
  }));
  app.use(urlencoded({ extended: true, limit: BODY_LIMIT }));

  // ✅ Helmet.js — headers HTTP de sécurité (CDC §16.4.3)
  // ⚠️ crossOriginResourcePolicy et crossOriginEmbedderPolicy désactivés pour les API routes
  // car ils provoquent des erreurs 403 sur les requêtes cross-origin (BFF Next.js → NestJS)
  // et les réponses API JSON n'ont pas besoin de ces politiques de sécurité navigateur.
  app.use(helmet({
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'self'"] },
    },
    // ❌ Désactivé : provoque 403 sur les réponses API cross-origin
    // Les API JSON n'ont pas de politique de ressources cross-origin
    crossOriginResourcePolicy: false,
    // ❌ Désactivé : pas nécessaire pour une API JSON
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }));

  // ✅ CORS avec wildcard sous-domaines (CDC §16.4.1)
  // ⚠️ Le callback CORS ne doit JAMAIS appeler callback(new Error(...)) car cela
  // provoque un 403 Forbidden dans le middleware cors. On utilise callback(null, false)
  // pour les origines non autorisées (retourne 200 sans header Access-Control-Allow-Origin).
  const isDev = process.env.NODE_ENV !== 'production';
  const allowedOrigins = [
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,          // Dev local
    /^https:\/\/(.+\.)?academiahelm\.com$/,                   // Production principale
    /^https:\/\/(.+\.)?academia-hub\.pro$/,                   // Domaine alternatif
    /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?$/,             // IPs directes (VPS, tests)
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/,                    // Vercel preview deployments
  ];

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Sans origin (appels serveur-serveur du BFF Next.js, curl, Postman)
      if (!origin) return callback(null, true);

      const isAllowed = allowedOrigins.some(regex => regex.test(origin));
      if (isAllowed || isDev) return callback(null, true);

      // ⚠️ Ne PAS utiliser callback(new Error(...)) → provoque 403
      // Utiliser callback(null, false) → le navigateur bloquera silencieusement
      logger.warn(`CORS: origin ${origin} not allowed (returning false, not error)`);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'x-tenant-id', 'Cookie', 'x-school-level-id', 'x-academic-year-id', 'x-module-type'],
  });

  app.useGlobalFilters(new PrismaExceptionFilter());

  // ⭐ CRITICAL: Socket.io adapter — required for @WebSocketGateway to work.
  //    Without this, NestJS defaults to the WsAdapter (raw `ws` package) which
  //    is INCOMPATIBLE with Socket.io gateways. The ChatGateway (Helm Connect
  //    real-time messaging) would silently fail — clients would fall back to
  //    HTTP polling (every 5s) and never receive push events.
  //    This is what powers: message:new, typing:start/stop, user:online/offline,
  //    call:offer/answer/ice-candidate/reject/hangup, group-call:invite/leave.
  //
  // ⭐ CAPACITÉ 100 ÉCOLES — adapter REDIS (multi-réplicas) :
  //    si REDIS_URL est défini, l'adapter Socket.io passe sur Redis
  //    (rooms partagées + pub/sub cross-réplicas) — sinon IN-MEMORY comme
  //    avant (fail-open : Redis indisponible au boot → fallback in-memory
  //    + WARN, jamais de crash, cf. common/adapters/redis-io.adapter.ts).
  //    Le jour du multi-réplicas : provisionner le plugin Redis Railway
  //    (REDIS_URL) puis activer REDIS_ADAPTER_STRICT=true.
  app.useWebSocketAdapter(await createWebSocketAdapter(app));

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

  // ⭐ Serve static files from the 'public' directory — required for chat attachments
  //    StorageService saves uploaded files (audio, images, documents) to
  //    process.cwd()/public/chat/audio/uuid-file.webm etc.
  //    Without this, attachment URLs like /chat/audio/xxx.webm return 404.
  app.use(expressStatic(join(process.cwd(), 'public')));

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3000);

  // Run pending migrations before starting the server
  // ⚠️ SKIP_MIGRATIONS=true par défaut — toutes les migrations sont déjà appliquées
  // sur Neon (vérifié via _prisma_migrations : 108 entrées, 0 pending).
  // Lancer prisma migrate deploy à chaque démarrage bloque l'event loop pendant
  // 60-120s (execSync), ce qui fait crasher le healthcheck Railway.
  // Pour lancer les migrations : railway run npx prisma migrate deploy
  if (process.env.SKIP_MIGRATIONS !== 'false') {
    logger.log('⏭️  SKIP_MIGRATIONS=true (default) — skipping prisma migrate deploy');
  } else {
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
  }

  // ⭐ CRITICAL: Start listening FIRST so healthcheck passes immediately.
  // All ensure-tables SQL runs in the background (non-blocking) after listen.
  // This prevents Railway healthcheck timeout (which was crashing the API every morning).
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 API listening on port ${port}`);

  // ⭐ T55 — MULTI-CONNEXION : tuning keep-alive du serveur HTTP.
  //    Node ferme une connexion inactivée après 5 s par défaut
  //    (keepAliveTimeout=5000) alors que le proxy Railway/Vercel garde ses
  //    connexions ouvertes bien plus longtemps : sous charge soutenue (des
  //    centaines d'utilisateurs simultanés en période de saisie des notes),
  //    chaque réouverture = handshake TCP+TLS complet → pics de latence et
  //    resets de connexion sporadiques (502 intermittents). On aligne le
  //    keep-alive applicatif AU-DESSUS de la fenêtre du proxy :
  //      - keepAliveTimeout 65 s (proxy ≈ 60 s) ;
  //      - headersTimeout 66 s (TOUJOURS > keepAliveTimeout) ;
  //    Node ≥ 18 active aussi maxRequestsPerSocket=0 (illimité) par défaut.
  const httpServer = app.getHttpServer() as import('http').Server;
  (httpServer as any).keepAliveTimeout = 65_000;
  (httpServer as any).headersTimeout = 66_000;
  logger.log('[T55] Tune-up concurrence : keepAliveTimeout=65s, headersTimeout=66s');

  // ─── Ensure-tables SQL runs in background (non-blocking) ───────────────
  // Previously this ran BEFORE app.listen(), blocking the healthcheck for 60-120s
  // and causing Railway to kill the container. Now it runs after listen.
  setTimeout(async () => {
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
        // ⭐ 2026-11-15 : ignorer aussi les « already exists » (42P07/42710) —
        //    p.ex. l'index UNIQUE créé par le DO-block peut déjà exister sous le
        //    même nom (message « relation … already exists ») à chaque boot.
        if (!fkErr.message?.includes('already exists')
          && !fkErr.message?.includes('42P07')
          && !fkErr.message?.includes('42710')) {
          logger.warn(`FK statement warning: ${fkErr.message}`);
        }
      }
    }

    // ─── Ensure tax module tables exist (idempotent SQL fallback) ──────────
    // These tables may not be created by prisma migrate deploy if migrations
    // aren't tracked properly. CREATE TABLE IF NOT EXISTS is idempotent.
    const taxTableStatements = [
      `CREATE TABLE IF NOT EXISTS "tax_settings" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "academicYearId" TEXT, "cnssFamilialesRate" DOUBLE PRECISION NOT NULL DEFAULT 9.0, "cnssRisquesRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0, "cnssVieillesseRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0, "cnssPatronaleRate" DOUBLE PRECISION NOT NULL DEFAULT 6.4, "cnssOuvriereRate" DOUBLE PRECISION NOT NULL DEFAULT 3.6, "istVpsRate" DOUBLE PRECISION NOT NULL DEFAULT 4.0, "istIrppRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0, "aibAchatsRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0, "aibPrestationsRate" DOUBLE PRECISION NOT NULL DEFAULT 5.0, "istFrequency" TEXT NOT NULL DEFAULT 'MONTHLY', "cnssFrequency" TEXT NOT NULL DEFAULT 'QUARTERLY', "aibFrequency" TEXT NOT NULL DEFAULT 'MONTHLY', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "tax_settings_pkey" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "tax_settings_tenantId_key" ON "tax_settings"("tenantId")`,
      `CREATE TABLE IF NOT EXISTS "financial_statements" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL, "type" TEXT NOT NULL, "lineCode" TEXT NOT NULL, "lineLabel" TEXT NOT NULL, "note" TEXT, "amountN" DECIMAL(18,2) NOT NULL DEFAULT 0, "amountN1" DECIMAL(18,2), "category" TEXT, "isSubtotal" BOOLEAN NOT NULL DEFAULT false, "isTotal" BOOLEAN NOT NULL DEFAULT false, "sortOrder" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "financial_statements_pkey" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "financial_statements_tenantId_academicYearId_type_lineCode_key" ON "financial_statements"("tenantId", "academicYearId", "type", "lineCode")`,
      `CREATE INDEX IF NOT EXISTS "financial_statements_tenantId_academicYearId_type_idx" ON "financial_statements"("tenantId", "academicYearId", "type")`,
      `CREATE TABLE IF NOT EXISTS "financial_notes" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL, "noteCode" TEXT NOT NULL, "noteTitle" TEXT NOT NULL, "lineLabel" TEXT NOT NULL, "amountN" DECIMAL(18,2) NOT NULL DEFAULT 0, "amountN1" DECIMAL(18,2), "metadata" JSONB, "sortOrder" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "financial_notes_pkey" PRIMARY KEY ("id"))`,
      `CREATE INDEX IF NOT EXISTS "financial_notes_tenantId_academicYearId_noteCode_idx" ON "financial_notes"("tenantId", "academicYearId", "noteCode")`,
      `CREATE TABLE IF NOT EXISTS "tax_declarations" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL, "type" TEXT NOT NULL, "period" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT', "data" JSONB NOT NULL, "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0, "submittedAt" TIMESTAMP(3), "paidAt" TIMESTAMP(3), "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "tax_declarations_pkey" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "tax_declarations_tenantId_academicYearId_type_period_key" ON "tax_declarations"("tenantId", "academicYearId", "type", "period")`,
      `CREATE INDEX IF NOT EXISTS "tax_declarations_tenantId_academicYearId_type_idx" ON "tax_declarations"("tenantId", "academicYearId", "type")`,
      `CREATE TABLE IF NOT EXISTS "financial_report_headers" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL, "centreDepot" TEXT, "denominationSociale" TEXT, "sigleUsuel" TEXT, "exerciceClosLe" TEXT, "dureeExerciceMois" INTEGER, "adresse" TEXT, "numeroIF" TEXT, "greffe" TEXT, "numeroRC" TEXT, "numeroCCSS" TEXT, "numeroTelephone" TEXT, "adresseGeoComplete" TEXT, "formeJuridique" TEXT, "capitalSocial" TEXT, "nombreEmployes" INTEGER, "referentielBancaire" TEXT, "regimeFiscal" TEXT, "paysSiegeSocial" TEXT, "nbEtablissementsPays" INTEGER, "nbEtablissementsHorsPays" INTEGER, "premiereAnneeExercice" TEXT, "activiteDesignation" TEXT, "activiteLocalisation" TEXT, "nbSalaries" INTEGER, "chiffreAffaires" DECIMAL(18,2), "partsMarcha" TEXT, "exportations" TEXT, "dirigeants" JSONB, "membresConseil" JSONB, "commissairesComptes" JSONB, "notesApplicables" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "financial_report_headers_pkey" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "financial_report_headers_tenantId_academicYearId_key" ON "financial_report_headers"("tenantId", "academicYearId")`,
      `CREATE TABLE IF NOT EXISTS "tax_payroll_periods" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL, "period" TEXT NOT NULL, "staffType" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT', "totalGross" DECIMAL(18,2) NOT NULL DEFAULT 0, "totalDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0, "totalNet" DECIMAL(18,2) NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "tax_payroll_periods_pkey" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "tax_payroll_periods_tenantId_academicYearId_period_staffType_key" ON "tax_payroll_periods"("tenantId", "academicYearId", "period", "staffType")`,
      `CREATE TABLE IF NOT EXISTS "tax_payslips" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL, "staffId" TEXT NOT NULL, "payrollPeriodId" TEXT NOT NULL, "period" TEXT NOT NULL, "salaireBase" DECIMAL(18,2) NOT NULL DEFAULT 0, "moinsPercesArriere" DECIMAL(18,2) NOT NULL DEFAULT 0, "gratificationsEtrennes" DECIMAL(18,2) NOT NULL DEFAULT 0, "indemnites" DECIMAL(18,2) NOT NULL DEFAULT 0, "primeSalissures" DECIMAL(18,2) NOT NULL DEFAULT 0, "salaireBrut" DECIMAL(18,2) NOT NULL DEFAULT 0, "cnssOuvriere" DECIMAL(18,2) NOT NULL DEFAULT 0, "itsNet" DECIMAL(18,2) NOT NULL DEFAULT 0, "irppNet" DECIMAL(18,2) NOT NULL DEFAULT 0, "avanceAcompte" DECIMAL(18,2) NOT NULL DEFAULT 0, "opposition" DECIMAL(18,2) NOT NULL DEFAULT 0, "taxesRadioTele" DECIMAL(18,2) NOT NULL DEFAULT 0, "totalRetenues" DECIMAL(18,2) NOT NULL DEFAULT 0, "netAPayer" DECIMAL(18,2) NOT NULL DEFAULT 0, "cnssPatronale" DECIMAL(18,2) NOT NULL DEFAULT 0, "vps" DECIMAL(18,2) NOT NULL DEFAULT 0, "status" TEXT NOT NULL DEFAULT 'DRAFT', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "tax_payslips_pkey" PRIMARY KEY ("id"))`,
      `CREATE INDEX IF NOT EXISTS "tax_payslips_tenantId_academicYearId_period_idx" ON "tax_payslips"("tenantId", "academicYearId", "period")`,
    ];

    for (const stmt of taxTableStatements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (e: any) {
        if (!e.message?.includes('already exists') && !e.message?.includes('42P07')) {
          logger.warn(`Tax table statement warning: ${e.message}`);
        }
      }
    }
    logger.log('Tax module tables ensured');

    // ─── Ensure pedagogy + discipline + risk-score tables exist (idempotent) ──
    // These tables may not be created by prisma migrate deploy if migrations
    // weren't applied. CREATE TABLE IF NOT EXISTS is idempotent.
    const pedagogyTableStatements = [
      // ── weekly_seminar_config (Cahier du Semainier — migration 20260722100000) ──
      `CREATE TABLE IF NOT EXISTS "weekly_seminar_config" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL, "weekNumber" INTEGER NOT NULL, "trimester" INTEGER NOT NULL DEFAULT 1, "weekStartDate" DATE NOT NULL, "weekEndDate" DATE NOT NULL, "teacherId" TEXT, "classIds" JSONB NOT NULL DEFAULT '[]'::jsonb, "status" TEXT NOT NULL DEFAULT 'PENDING', "teacherSignature" TEXT, "directorSignature" TEXT, "teacherSignedAt" TIMESTAMPTZ, "directorSignedAt" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL, CONSTRAINT "weekly_seminar_config_pkey" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "weekly_seminar_config_tenantId_academicYearId_weekNumber_key" ON "weekly_seminar_config"("tenantId", "academicYearId", "weekNumber")`,
      `CREATE INDEX IF NOT EXISTS "weekly_seminar_config_tenantId_academicYearId_idx" ON "weekly_seminar_config"("tenantId", "academicYearId")`,
      // ── weekly_seminar_daily_report (migration 20260722100000) ──
      `CREATE TABLE IF NOT EXISTS "weekly_seminar_daily_report" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL, "seminarConfigId" TEXT NOT NULL, "dayOfWeek" INTEGER NOT NULL, "date" DATE NOT NULL, "teacherAttendance" JSONB, "studentAttendance" JSONB, "pedagogyNotes" TEXT, "disciplineNotes" TEXT, "hygieneNotes" TEXT, "visitNotes" TEXT, "communicationNotes" TEXT, "dailySummary" TEXT, "status" TEXT NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL, CONSTRAINT "weekly_seminar_daily_report_pkey" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "weekly_seminar_daily_report_seminarConfigId_dayOfWeek_key" ON "weekly_seminar_daily_report"("seminarConfigId", "dayOfWeek")`,
      `CREATE INDEX IF NOT EXISTS "weekly_seminar_daily_report_tenantId_academicYearId_idx" ON "weekly_seminar_daily_report"("tenantId", "academicYearId")`,

      // ── discipline_rules (migration 20260815130000) ──
      `CREATE TABLE IF NOT EXISTS "discipline_rules" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "hours_penalty" DOUBLE PRECISION NOT NULL DEFAULT 0, "points_deducted" DOUBLE PRECISION NOT NULL DEFAULT 0, "severity" TEXT NOT NULL DEFAULT 'MINOR', "schoolLevelId" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL, CONSTRAINT "discipline_rules_pkey" PRIMARY KEY ("id"))`,
      `CREATE INDEX IF NOT EXISTS "discipline_rules_tenantId_idx" ON "discipline_rules"("tenantId")`,
      // ── conduct_settings (migration 20260815130000) ──
      `CREATE TABLE IF NOT EXISTS "conduct_settings" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL, "schoolLevelId" TEXT, "conduct_reference" DOUBLE PRECISION NOT NULL DEFAULT 20, "critical_threshold" DOUBLE PRECISION NOT NULL DEFAULT 5, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL, CONSTRAINT "conduct_settings_pkey" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "conduct_settings_tenantId_academicYearId_schoolLevelId_key" ON "conduct_settings"("tenantId", "academicYearId", "schoolLevelId")`,
      // ── sanctions (migration 20260815130000 + 20260816120000 notification columns) ──
      `CREATE TABLE IF NOT EXISTS "sanctions" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "ruleId" TEXT, "schoolLevelId" TEXT, "quarterId" TEXT, "fault_name" TEXT NOT NULL, "hours_attributed" DOUBLE PRECISION NOT NULL DEFAULT 0, "points_deducted" DOUBLE PRECISION NOT NULL DEFAULT 0, "sanction_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "supervisorId" TEXT, "comment" TEXT, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "cancelled_by" TEXT, "cancelled_reason" TEXT, "cancelled_at" TIMESTAMPTZ, "parentNotifiedAt" TIMESTAMPTZ, "notificationStatus" TEXT DEFAULT 'PENDING', "notificationChannels" JSONB, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL, CONSTRAINT "sanctions_pkey" PRIMARY KEY ("id"))`,
      `CREATE INDEX IF NOT EXISTS "sanctions_tenantId_academicYearId_idx" ON "sanctions"("tenantId", "academicYearId")`,
      `CREATE INDEX IF NOT EXISTS "sanctions_studentId_idx" ON "sanctions"("studentId")`,
      `CREATE INDEX IF NOT EXISTS "sanctions_notificationStatus_idx" ON "sanctions"("notificationStatus")`,
      // ── conduct_ledger (migration 20260815130000) ──
      `CREATE TABLE IF NOT EXISTS "conduct_ledger" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "quarterId" TEXT NOT NULL, "conduct_reference" DOUBLE PRECISION NOT NULL DEFAULT 20, "total_points_deducted" DOUBLE PRECISION NOT NULL DEFAULT 0, "conduct_final" DOUBLE PRECISION NOT NULL DEFAULT 20, "calculated_at" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL, CONSTRAINT "conduct_ledger_pkey" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "conduct_ledger_tenantId_studentId_quarterId_key" ON "conduct_ledger"("tenantId", "studentId", "quarterId")`,

      // ── staff_accreditations (migration 20260815140000) ──
      `CREATE TABLE IF NOT EXISTS "staff_accreditations" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "staffId" TEXT NOT NULL, "module" TEXT NOT NULL, "grantedBy" TEXT, "grantedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "reason" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL, CONSTRAINT "staff_accreditations_pkey" PRIMARY KEY ("id"))`,
      `CREATE INDEX IF NOT EXISTS "staff_accreditations_tenantId_staffId_idx" ON "staff_accreditations"("tenantId", "staffId")`,

      // ── student_risk_scores (migration 20260816130000) ──
      `CREATE TABLE IF NOT EXISTS "student_risk_scores" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL, "quarterId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "conductScore" DOUBLE PRECISION NOT NULL DEFAULT 0, "pedagogyScore" DOUBLE PRECISION NOT NULL DEFAULT 0, "attendanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0, "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0, "riskLevel" TEXT NOT NULL DEFAULT 'LOW', "dropoutRiskFlag" BOOLEAN NOT NULL DEFAULT false, "sourceData" JSONB, "previousQuarterScore" DOUBLE PRECISION, "scoreDelta" DOUBLE PRECISION, "calculatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL, CONSTRAINT "student_risk_scores_pkey" PRIMARY KEY ("id"))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "student_risk_scores_unique_idx" ON "student_risk_scores"("tenantId", "studentId", "quarterId")`,
      `CREATE INDEX IF NOT EXISTS "student_risk_scores_tenant_year_quarter_idx" ON "student_risk_scores"("tenantId", "academicYearId", "quarterId")`,
      `CREATE INDEX IF NOT EXISTS "student_risk_scores_riskLevel_idx" ON "student_risk_scores"("riskLevel")`,
      `CREATE INDEX IF NOT EXISTS "student_risk_scores_dropout_idx" ON "student_risk_scores"("dropoutRiskFlag") WHERE "dropoutRiskFlag" = true`,
      // ── risk_score_settings (migration 20260816130000) ──
      `CREATE TABLE IF NOT EXISTS "risk_score_settings" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL UNIQUE, "conductWeight" INTEGER NOT NULL DEFAULT 40, "pedagogyWeight" INTEGER NOT NULL DEFAULT 40, "attendanceWeight" INTEGER NOT NULL DEFAULT 20, "lowThreshold" INTEGER NOT NULL DEFAULT 20, "moderateThreshold" INTEGER NOT NULL DEFAULT 40, "highThreshold" INTEGER NOT NULL DEFAULT 70, "dropoutScoreDeltaThreshold" DOUBLE PRECISION NOT NULL DEFAULT 10, "dropoutAbsenceRateThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.15, "dropoutConductDropThreshold" DOUBLE PRECISION NOT NULL DEFAULT 5, "pedagogyReferenceAverage" DOUBLE PRECISION NOT NULL DEFAULT 10, "isEnabled" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL, CONSTRAINT "risk_score_settings_pkey" PRIMARY KEY ("id"))`,

      // ── exam_frauds (migration 20260816150000) ──
      `CREATE TABLE IF NOT EXISTS "exam_frauds" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "evaluationId" TEXT, "examId" TEXT, "classId" TEXT, "subjectId" TEXT, "quarterId" TEXT, "fraudType" TEXT NOT NULL, "description" TEXT NOT NULL, "witnesses" TEXT, "evidencePhotoUrl" TEXT, "severity" TEXT NOT NULL DEFAULT 'MAJOR', "status" TEXT NOT NULL DEFAULT 'REPORTED', "reportedById" TEXT NOT NULL, "reportedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "investigatedById" TEXT, "investigationNotes" TEXT, "investigatedAt" TIMESTAMPTZ, "sanctionId" TEXT, "incidentDate" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL, CONSTRAINT "exam_frauds_pkey" PRIMARY KEY ("id"))`,
      `CREATE INDEX IF NOT EXISTS "exam_frauds_tenant_year_idx" ON "exam_frauds"("tenantId", "academicYearId")`,
      `CREATE INDEX IF NOT EXISTS "exam_frauds_status_idx" ON "exam_frauds"("status")`,
      // ── exam_fraud_sanctions (migration 20260816150000) ──
      `CREATE TABLE IF NOT EXISTS "exam_fraud_sanctions" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "examFraudId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "sanctionType" TEXT NOT NULL, "description" TEXT, "newExamDate" TIMESTAMPTZ, "nullifiedGrade" DOUBLE PRECISION, "decidedById" TEXT NOT NULL, "decidedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "approvedById" TEXT, "approvedAt" TIMESTAMPTZ, "status" TEXT NOT NULL DEFAULT 'PENDING', "executedAt" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL, CONSTRAINT "exam_fraud_sanctions_pkey" PRIMARY KEY ("id"))`,
      `CREATE INDEX IF NOT EXISTS "exam_fraud_sanctions_fraud_idx" ON "exam_fraud_sanctions"("examFraudId")`,

      // ── attendance_records : colonnes amStatus/pmStatus/eveningStatus/late (migration 20260816160000) ──
      `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "amStatus" TEXT NOT NULL DEFAULT 'PRESENT'`,
      `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "pmStatus" TEXT NOT NULL DEFAULT 'PRESENT'`,
      `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "eveningStatus" TEXT DEFAULT 'PRESENT'`,
      `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "late" BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "lateMinutes" INTEGER`,
      `CREATE INDEX IF NOT EXISTS "attendance_records_class_date_idx" ON "attendance_records"("classId", "date") WHERE "classId" IS NOT NULL`,

      // ── timetable_entries : indexes pour détection conflits (migration 20260816140000) ──
      `CREATE INDEX IF NOT EXISTS "timetable_entries_tenant_class_day_idx" ON "timetable_entries"("tenantId", "classId", "dayOfWeek") WHERE "classId" IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS "timetable_entries_tenant_teacher_day_idx" ON "timetable_entries"("tenantId", "teacherId", "dayOfWeek") WHERE "teacherId" IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS "timetable_entries_tenant_room_day_idx" ON "timetable_entries"("tenantId", "roomId", "dayOfWeek") WHERE "roomId" IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS "timetable_entries_day_start_end_idx" ON "timetable_entries"("dayOfWeek", "startTime", "endTime")`,

      // ── pedagogical_sheets : colonnes teacherId + originalSheetId (cross-year reuse) ──
      `ALTER TABLE "pedagogical_sheets" ADD COLUMN IF NOT EXISTS "teacherId" TEXT`,
      `ALTER TABLE "pedagogical_sheets" ADD COLUMN IF NOT EXISTS "originalSheetId" TEXT`,
      `CREATE INDEX IF NOT EXISTS "pedagogical_sheets_tenant_class_subject_idx" ON "pedagogical_sheets"("tenantId", "classId", "subjectId")`,
      `CREATE INDEX IF NOT EXISTS "pedagogical_sheets_teacherId_idx" ON "pedagogical_sheets"("teacherId")`,
      `CREATE INDEX IF NOT EXISTS "pedagogical_sheets_originalSheetId_idx" ON "pedagogical_sheets"("originalSheetId")`,

      // ── primary_pedagogical_fiches : colonne originalSheetId (cross-year reuse) ──
      //    La table primary_pedagogical_fiches est utilisée par le frontend (PedagogicalSheetsTab).
      //    On ajoute originalSheetId pour tracer les duplications d'une année à l'autre.
      `ALTER TABLE "primary_pedagogical_fiches" ADD COLUMN IF NOT EXISTS "originalSheetId" TEXT`,
      `CREATE INDEX IF NOT EXISTS "primary_pedagogical_fiches_originalSheetId_idx" ON "primary_pedagogical_fiches"("originalSheetId") WHERE "originalSheetId" IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS "primary_pedagogical_fiches_tenant_class_subject_idx" ON "primary_pedagogical_fiches"("tenantId", "classId", "subjectId")`,
      // ⭐ cahierJournalId : lien structurel fiche → cahier journal (crucial pour le director validation)
      `ALTER TABLE "primary_pedagogical_fiches" ADD COLUMN IF NOT EXISTS "cahierJournalId" TEXT`,
      `CREATE INDEX IF NOT EXISTS "primary_pedagogical_fiches_cahierJournalId_idx" ON "primary_pedagogical_fiches"("cahierJournalId") WHERE "cahierJournalId" IS NOT NULL`,
    ];

    for (const stmt of pedagogyTableStatements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (e: any) {
        if (!e.message?.includes('already exists') && !e.message?.includes('42P07')) {
          logger.warn(`Pedagogy/discipline/risk-score table statement warning: ${e.message}`);
        }
      }
    }
    logger.log('Pedagogy + discipline + risk-score + exam-fraud tables ensured');

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
      // meetingLink, phoneNumber on hr_interviews (migration 20260619100000)
      `ALTER TABLE "hr_interviews" ADD COLUMN IF NOT EXISTS "meetingLink" TEXT`,
      `ALTER TABLE "hr_interviews" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT`,

      // ─── email_logs : extension catégorisation + threading + reply-to + tracking ───
      // (migration 20260619140000_extend_email_log_and_inbound_emails)
      // Idempotent : peut être exécuté sans risque même si la migration a déjà été appliquée.
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "category" TEXT`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "subCategory" TEXT`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "module" TEXT`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "fromEmail" TEXT`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "fromName" TEXT`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "recipientName" TEXT`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "recipientType" TEXT`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "recipientId" TEXT`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "cc" TEXT`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "bcc" TEXT`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "textContent" TEXT`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "threadId" TEXT`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "inReplyTo" TEXT`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "references" TEXT`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "replyTo" TEXT`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "replyToToken" TEXT`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3)`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "clickedAt" TIMESTAMP(3)`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "openCount" INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "clickCount" INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "triggeredBy" TEXT`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "triggeredByUserId" TEXT`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "templateId" TEXT`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "relatedEntityId" TEXT`,
      `ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "relatedEntityType" TEXT`,
      `CREATE INDEX IF NOT EXISTS "email_logs_tenantId_category_idx" ON "email_logs"("tenantId", "category")`,
      `CREATE INDEX IF NOT EXISTS "email_logs_tenantId_status_idx" ON "email_logs"("tenantId", "status")`,
      `CREATE INDEX IF NOT EXISTS "email_logs_tenantId_recipient_idx" ON "email_logs"("tenantId", "recipient")`,
      `CREATE INDEX IF NOT EXISTS "email_logs_threadId_idx" ON "email_logs"("threadId")`,
      `CREATE INDEX IF NOT EXISTS "email_logs_replyToToken_idx" ON "email_logs"("replyToToken")`,
      `CREATE INDEX IF NOT EXISTS "email_logs_tenantId_createdAt_idx" ON "email_logs"("tenantId", "createdAt")`,

      // ─── inbound_emails table (migration 20260619140000) ───
      `CREATE TABLE IF NOT EXISTS "inbound_emails" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "originalEmailId" TEXT,
        "threadId" TEXT,
        "fromEmail" TEXT NOT NULL,
        "fromName" TEXT,
        "toEmail" TEXT NOT NULL,
        "subject" TEXT NOT NULL,
        "textContent" TEXT,
        "htmlContent" TEXT,
        "attachments" TEXT,
        "providerId" TEXT,
        "rawHeaders" TEXT,
        "status" TEXT NOT NULL DEFAULT 'RECEIVED',
        "errorMessage" TEXT,
        "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "processedAt" TIMESTAMP(3),
        CONSTRAINT "inbound_emails_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE INDEX IF NOT EXISTS "inbound_emails_tenantId_idx" ON "inbound_emails"("tenantId")`,
      `CREATE INDEX IF NOT EXISTS "inbound_emails_originalEmailId_idx" ON "inbound_emails"("originalEmailId")`,
      `CREATE INDEX IF NOT EXISTS "inbound_emails_fromEmail_idx" ON "inbound_emails"("fromEmail")`,
      `CREATE INDEX IF NOT EXISTS "inbound_emails_threadId_idx" ON "inbound_emails"("threadId")`,
      `CREATE INDEX IF NOT EXISTS "inbound_emails_tenantId_receivedAt_idx" ON "inbound_emails"("tenantId", "receivedAt")`,

      // ─── contract_sign_tokens table (migration 20260619160000) ───
      // Tokens pour signature électronique de contrat par lien magique (email).
      `CREATE TABLE IF NOT EXISTS "contract_sign_tokens" (
        "id" TEXT NOT NULL,
        "contractId" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "token" TEXT NOT NULL,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "usedAt" TIMESTAMP(3),
        "signedByIp" TEXT,
        "signedByUserAgent" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "contract_sign_tokens_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "contract_sign_tokens_token_key" ON "contract_sign_tokens"("token")`,
      `CREATE INDEX IF NOT EXISTS "contract_sign_tokens_contractId_idx" ON "contract_sign_tokens"("contractId")`,
      `CREATE INDEX IF NOT EXISTS "contract_sign_tokens_tenantId_idx" ON "contract_sign_tokens"("tenantId")`,
      `CREATE INDEX IF NOT EXISTS "contract_sign_tokens_expiresAt_idx" ON "contract_sign_tokens"("expiresAt")`,

      // ─── pricing_plans table (migration 20260620080000) ───
      `CREATE TABLE IF NOT EXISTS "pricing_plans" (
        "id" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "tagline" TEXT,
        "description" TEXT,
        "studentMin" INTEGER NOT NULL DEFAULT 0,
        "studentMax" INTEGER,
        "initialFee" INTEGER NOT NULL DEFAULT 0,
        "monthlyAmount" INTEGER,
        "yearlyAmount" INTEGER,
        "bilingualMonthly" INTEGER,
        "bilingualYearly" INTEGER,
        "features" TEXT,
        "isPopular" BOOLEAN NOT NULL DEFAULT false,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "pricing_plans_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "pricing_plans_code_key" ON "pricing_plans"("code")`,
      `CREATE INDEX IF NOT EXISTS "pricing_plans_isActive_idx" ON "pricing_plans"("isActive")`,
      `CREATE INDEX IF NOT EXISTS "pricing_plans_sortOrder_idx" ON "pricing_plans"("sortOrder")`,

      // ─── Seed pricing_plans (idempotent — WHERE NOT EXISTS) ───
      // ⭐ Contrat Article 4 — facturation ANNUELLE uniquement (monthlyAmount NULL)
      //    + frais d'activation UNIFORMES 500 000 FCFA : 
      //    SEED 50 000/an · GROW 75 000/an · LEAD 100 000/an · NETWORK 150 000/an
      //    (totaux Année 1 : 550 000 / 575 000 / 600 000 / 650 000 FCFA).
      `INSERT INTO "pricing_plans" ("id", "code", "name", "tagline", "description", "studentMin", "studentMax", "initialFee", "monthlyAmount", "yearlyAmount", "bilingualMonthly", "bilingualYearly", "features", "isPopular", "isActive", "sortOrder", "createdAt", "updatedAt")
       SELECT gen_random_uuid(), 'SEED', 'Helm Essentiel', 'L''essentiel pour bien démarrer', 'Idéal pour les petites écoles qui démarrent leur transformation numérique.', 1, 50, 500000, NULL, 50000, 10000, 100000, '["Tous les modules inclus sans restriction","Jusqu''à 50 élèves","Abonnement de 30 jours offert","Support par email","Sauvegarde automatique (restauration 24h)"]', false, true, 1, NOW(), NOW()
       WHERE NOT EXISTS (SELECT 1 FROM "pricing_plans" WHERE "code" = 'SEED')`,
      `INSERT INTO "pricing_plans" ("id", "code", "name", "tagline", "description", "studentMin", "studentMax", "initialFee", "monthlyAmount", "yearlyAmount", "bilingualMonthly", "bilingualYearly", "features", "isPopular", "isActive", "sortOrder", "createdAt", "updatedAt")
       SELECT gen_random_uuid(), 'GROW', 'Helm Croissance', 'Pilotez votre croissance', 'Pour les écoles en pleine expansion qui ont besoin d''outils avancés.', 51, 150, 500000, NULL, 75000, 10000, 100000, '["Tous les modules inclus sans restriction","51 à 150 élèves","Abonnement de 30 jours offert","Support prioritaire email + WhatsApp","Sauvegarde automatique (restauration 24h)","Tableaux de bord ORION"]', true, true, 2, NOW(), NOW()
       WHERE NOT EXISTS (SELECT 1 FROM "pricing_plans" WHERE "code" = 'GROW')`,
      `INSERT INTO "pricing_plans" ("id", "code", "name", "tagline", "description", "studentMin", "studentMax", "initialFee", "monthlyAmount", "yearlyAmount", "bilingualMonthly", "bilingualYearly", "features", "isPopular", "isActive", "sortOrder", "createdAt", "updatedAt")
       SELECT gen_random_uuid(), 'LEAD', 'Helm Performance', 'Dominez votre marché', 'Pour les grandes écoles qui veulent un pilotage avancé et l''analytics.', 151, 400, 500000, NULL, 100000, 10000, 100000, '["Tous les modules inclus sans restriction","151 à 400 élèves","Abonnement de 30 jours offert","Support dédié 7j/7","Sauvegarde automatique (restauration 1h)","Tableaux de bord ORION + alertes intelligentes"]', false, true, 3, NOW(), NOW()
       WHERE NOT EXISTS (SELECT 1 FROM "pricing_plans" WHERE "code" = 'LEAD')`,
      `INSERT INTO "pricing_plans" ("id", "code", "name", "tagline", "description", "studentMin", "studentMax", "initialFee", "monthlyAmount", "yearlyAmount", "bilingualMonthly", "bilingualYearly", "features", "isPopular", "isActive", "sortOrder", "createdAt", "updatedAt")
       SELECT gen_random_uuid(), 'NETWORK', 'Helm Institution', 'La catégorie multi-école', 'Pour les réseaux d''écoles et les établissements multi-école.', 401, NULL, 500000, NULL, 150000, 10000, 100000, '["Tous les modules inclus sans restriction","Plus de 400 élèves","Abonnement de 30 jours offert","Account manager dédié","Sauvegarde temps réel + réplication","Tableaux de bord ORION + alertes intelligentes","Gestion multi-écoles","Formation sur site"]', false, true, 4, NOW(), NOW()
       WHERE NOT EXISTS (SELECT 1 FROM "pricing_plans" WHERE "code" = 'NETWORK')`,
      // ⭐ Option bilingue (add-on) — plan BILINGUAL : SOURCE DE VÉRITÉ du tarif
      //    bilingue, éditable depuis le back-office /platform/subscriptions
      //    (carte « Option bilingue FR/EN », champs Bilingue mensuel/annuel).
      //    Tarif : 10 000 F CFA/mois de référence → 100 000 F CFA/an (2 mois offerts).
      //    Exclu de la liste publique des plans (affiché à part comme add-on).
      `INSERT INTO "pricing_plans" ("id", "code", "name", "tagline", "description", "studentMin", "studentMax", "initialFee", "monthlyAmount", "yearlyAmount", "bilingualMonthly", "bilingualYearly", "features", "isPopular", "isActive", "sortOrder", "createdAt", "updatedAt")
       SELECT gen_random_uuid(), 'BILINGUAL', 'Option bilingue FR/EN', 'Supplément option bilingue', 'Option bilingue FR/EN — en supplément de n''importe quel plan. Facturée annuellement (contrat Article 4) : 10 000 F CFA/mois de référence, 100 000 F CFA/an (2 mois offerts).', 0, NULL, 0, NULL, NULL, 10000, 100000, '["Classes, matières, examens et bulletins en français ET en anglais","Structure EN miroir (Nursery 1/2, Primary 1-6) créée automatiquement","Espace Pédagogique EN dédié (Scheme of Work, Attendance)","Facturation annuelle — tarif piloté depuis le back-office"]', false, true, 5, NOW(), NOW()
       WHERE NOT EXISTS (SELECT 1 FROM "pricing_plans" WHERE "code" = 'BILINGUAL')`,
      // Sécurité : ne remplir les tarifs add-on que s'ils sont NULL (ne JAMAIS
      // écraser une valeur modifiée depuis le back-office au redémarrage).
      `UPDATE "pricing_plans" SET "bilingualMonthly" = 10000, "bilingualYearly" = 100000, "updatedAt" = NOW() WHERE "code" = 'BILINGUAL' AND "bilingualMonthly" IS NULL AND "bilingualYearly" IS NULL`,

      // ─── Révision tarifaire bilingue (contrat Article 4) : 50 000 → 100 000 FCFA/an ───
      // ⭐ CONDITIONNELLE sur l'ancien tarif officiel (mensuel 5 000 / annuel
      //    50 000) afin de ne JAMAIS écraser un tarif personnalisé modifié
      //    depuis le back-office. La référence mensuelle passe à 10 000 F CFA
      //    (12 × 10 000 = 120 000 → 100 000 en annuel = 2 mois offerts,
      //    réduction inchangée). S'applique au plan BILINGUAL ET aux colonnes
      //    bilingues tamponnées sur chaque plan (SEED/GROW/LEAD/NETWORK —
      //    lues par PricingService.calculateBilingualPrice). Les textes
      //    (description/features) sont rafraîchis uniquement s'ils portent
      //    encore l'ancien montant.
      `UPDATE "pricing_plans" SET "bilingualMonthly" = 10000, "bilingualYearly" = 100000, "updatedAt" = NOW() WHERE "bilingualYearly" = 50000 AND ("bilingualMonthly" = 5000 OR "bilingualMonthly" IS NULL)`,
      `UPDATE "pricing_plans" SET "yearlyAmount" = 100000, "updatedAt" = NOW() WHERE "code" = 'BILINGUAL' AND "yearlyAmount" = 50000`,
      `UPDATE "pricing_plans" SET "description" = 'Option bilingue FR/EN — en supplément de n''importe quel plan. Facturée annuellement (contrat Article 4) : 10 000 F CFA/mois de référence, 100 000 F CFA/an (2 mois offerts).', "updatedAt" = NOW() WHERE "code" = 'BILINGUAL' AND "description" LIKE '%50 000%'`,
      `UPDATE "pricing_plans" SET "features" = '["Classes, matières, examens et bulletins en français ET en anglais","Structure EN miroir (Nursery 1/2, Primary 1-6) créée automatiquement","Espace Pédagogique EN dédié (Scheme of Work, Attendance)","Facturation annuelle — tarif piloté depuis le back-office"]', "updatedAt" = NOW() WHERE "code" = 'BILINGUAL' AND "features" LIKE '%50 000%'`,
      // pricing_configs (fallback versionné — colonnes SNAKE_CASE) : idem,
      //    conditionnel sur l'ancien tarif officiel.
      `UPDATE "pricing_configs" SET "bilingual_monthly_addon" = 10000, "bilingual_yearly_addon" = 100000 WHERE "is_active" = true AND "bilingual_yearly_addon" = 50000 AND ("bilingual_monthly_addon" = 5000 OR "bilingual_monthly_addon" IS NULL)`,

      // ─── Migration tarifaire conditionnelle (contrat Article 4) ───
      // ⭐ Révision tarifaire complète : activation UNIFORME 500 000 FCFA +
      //    frais annuels 50 000/75 000/100 000/150 000 selon le plan (totaux
      //    Année 1 : 550/575/600/650 k) + facturation annuelle uniquement
      //    (monthlyAmount NULL).
      //    CONDITIONNELLE sur les anciennes valeurs connues (100 000/150 000/
      //    250 000/500 000 annuels, mensuels 10 000-50 000, activation 300 000)
      //    afin de ne JAMAIS écraser un tarif personnalisé modifié depuis le
      //    back-office au redémarrage.
      `UPDATE "pricing_plans" SET "initialFee" = 500000, "monthlyAmount" = NULL, "yearlyAmount" = 50000, "updatedAt" = NOW() WHERE "code" = 'SEED' AND ("initialFee" = 300000 OR "monthlyAmount" = 10000 OR "yearlyAmount" = 100000)`,
      `UPDATE "pricing_plans" SET "initialFee" = 500000, "monthlyAmount" = NULL, "yearlyAmount" = 75000, "updatedAt" = NOW() WHERE "code" = 'GROW' AND ("initialFee" = 300000 OR "monthlyAmount" = 15000 OR "yearlyAmount" = 150000)`,
      `UPDATE "pricing_plans" SET "initialFee" = 500000, "monthlyAmount" = NULL, "yearlyAmount" = 100000, "updatedAt" = NOW() WHERE "code" = 'LEAD' AND ("initialFee" = 300000 OR "monthlyAmount" = 25000 OR "yearlyAmount" = 250000)`,
      `UPDATE "pricing_plans" SET "initialFee" = 500000, "monthlyAmount" = NULL, "yearlyAmount" = 150000, "updatedAt" = NOW() WHERE "code" = 'NETWORK' AND ("initialFee" = 300000 OR "monthlyAmount" = 50000 OR "yearlyAmount" = 500000)`,

      // ─── Révision tarifaire (contrat Article 4) : pricing_configs de secours ───
      // Migre la pricing_configs active existante (fallback de
      // PricingService.calculateInitialPaymentPrice / calculateTenantPrice).
      // ⭐ ATTENTION : cette table utilise des colonnes SNAKE_CASE (créée par
      //    une migration Prisma, contrairement à pricing_plans en camelCase) —
      //    l'ancienne UPDATE en camelCase échouait silencieusement (warning
      //    « column does not exist » avalé par le try/catch de alterStatements).
      //    Pas de colonne updated_at non plus (created_at seulement).
      // ⭐ Conditionnel sur les ANCIENNES valeurs connues (100 000 = config de
      //    test, 300 000 = pré-révision) pour ne pas écraser un tarif
      //    personnalisé modifié depuis le back-office. Aligné contrat :
      //    activation 500 000 uniforme (0% multi-écoles), base annuelle 50 000,
      //    annuel seul (base mensuelle 0, remise annuelle 0).
      `UPDATE "pricing_configs" SET "initial_subscription_fee" = 500000, "monthly_base_price" = 0, "yearly_base_price" = 50000, "yearly_discount_percent" = 0, "school_additional_price" = 0, "multi_school_initial_discount_percent" = 0, "metadata" = jsonb_set(COALESCE("metadata", '{}'::jsonb), '{activationFeeRevision}', '"contract-article4-500000"') WHERE "is_active" = true AND ("initial_subscription_fee" IN (100000, 300000) OR "yearly_base_price" = 150000)`,

      // ─── HelmSubscription: champs cycle de vie (migration 20260620100000) ───
      // Pas de @@map sur ce modèle → nom de table = "HelmSubscription" (casse Prisma)
      `ALTER TABLE "HelmSubscription" ADD COLUMN IF NOT EXISTS "notified7DaysBefore" TIMESTAMP(3)`,
      `ALTER TABLE "HelmSubscription" ADD COLUMN IF NOT EXISTS "notified3DaysBefore" TIMESTAMP(3)`,
      `ALTER TABLE "HelmSubscription" ADD COLUMN IF NOT EXISTS "notified1DayBefore" TIMESTAMP(3)`,
      `ALTER TABLE "HelmSubscription" ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP(3)`,
      `ALTER TABLE "HelmSubscription" ADD COLUMN IF NOT EXISTS "gracePeriodEnd" TIMESTAMP(3)`,
      `ALTER TABLE "HelmSubscription" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3)`,
      `ALTER TABLE "HelmSubscription" ADD COLUMN IF NOT EXISTS "blockedAt" TIMESTAMP(3)`,
      `ALTER TABLE "HelmSubscription" ADD COLUMN IF NOT EXISTS "notifiedBlockWarning" TIMESTAMP(3)`,
      `ALTER TABLE "HelmSubscription" ADD COLUMN IF NOT EXISTS "reactivationFee" INTEGER NOT NULL DEFAULT 5000`,

      // ─── Helm Enseignant — draft d'inscription « paiement d'abord » (2026-10-16) ───
      // Pattern OnboardingDraft (patronat) : identité + hash du mot de passe + niveaux
      // persistés AVANT paiement ; le compte n'est créé qu'à la confirmation FedaPay.
      `CREATE TABLE IF NOT EXISTS "TeacherOnboardingDraft" (
          "id" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "firstName" TEXT NOT NULL,
          "lastName" TEXT NOT NULL,
          "phone" TEXT,
          "passwordHash" TEXT NOT NULL,
          "levels" JSONB NOT NULL DEFAULT '[]',
          "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
          "transactionId" TEXT,
          "amountXOF" INTEGER NOT NULL DEFAULT 2000,
          "tenantId" TEXT,
          "userId" TEXT,
          "completedAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "TeacherOnboardingDraft_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "TeacherOnboardingDraft_email_key" ON "TeacherOnboardingDraft"("email")`,
      `CREATE INDEX IF NOT EXISTS "TeacherOnboardingDraft_status_idx" ON "TeacherOnboardingDraft"("status")`,
      `CREATE INDEX IF NOT EXISTS "TeacherOnboardingDraft_transactionId_idx" ON "TeacherOnboardingDraft"("transactionId")`,

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
      // ─── hr_jobs slug (for public job URL sharing) ───
      `ALTER TABLE "hr_jobs" ADD COLUMN IF NOT EXISTS "slug" TEXT`,

      // ─── ⭐ HELM CONNECT V6 (spec §4/§6) — canaux officiels auto + groupes enrichis ───
      // chat_auto_groups.levelId : groupes « Parents – {niveau} » (dynamiques)
      `ALTER TABLE "chat_auto_groups" ADD COLUMN IF NOT EXISTS "levelId" TEXT`,
      // Index de filtrage des Communautés par catégorie (groupType) côté frontend
      `CREATE INDEX IF NOT EXISTS "idx_chat_auto_groups_tenant_groupType" ON "chat_auto_groups"("tenantId", "groupType")`,
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

    // ── Ensure staff termination fields (migration 20260608120000) ──
    // ⭐ 2026-11-15 fix 42P01 « relation "contract" does not exist » : la table
    //    réelle est "staff" (migration 20260608120000_add_staff_termination_fields)
    //    et les vraies colonnes sont terminationType / terminationDetails /
    //    terminatedAt / noticePeriodDays / lastWorkingDate (pas « terminationReason »).
    const contractTerminationStatements = [
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "terminationType" TEXT`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "terminationDetails" JSONB`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "terminatedAt" TIMESTAMPTZ`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "noticePeriodDays" INTEGER`,
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "lastWorkingDate" TIMESTAMPTZ`,
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

    // ── Ensure slug on hr_jobs and backfill existing rows ──
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "hr_jobs" ADD COLUMN IF NOT EXISTS "slug" TEXT`);
    } catch (err: any) {
      if (!err.message?.includes('already exists') && !err.message?.includes('42P07') && !err.message?.includes('42P16')) {
        logger.warn(`hr_jobs slug column warning: ${err.message}`);
      }
    }
    try {
      // Backfill slug for existing rows that have NULL slug — generate from title + ref suffix
      const slugPrefix = `lower(regexp_replace(regexp_replace(regexp_replace(title, '[^a-zA-Z0-9\\s]', '', 'g'), '\\s+', '-', 'g'), '^(-+)|(-+)$', '', 'g'))`;
      await prisma.$executeRawUnsafe(`
        UPDATE "hr_jobs" SET slug = CONCAT(${slugPrefix}, '-', SUBSTRING(ref FROM POSITION('-' IN reverse(ref)) + 1))
        WHERE slug IS NULL AND title IS NOT NULL AND ref IS NOT NULL
      `);
    } catch (err: any) {
      logger.warn(`hr_jobs slug backfill warning: ${err.message}`);
    }
    try {
      // Add unique constraint on slug if not already present
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "hr_jobs_slug_key" ON "hr_jobs"("slug")`);
    } catch (err: any) {
      if (!err.message?.includes('already exists') && !err.message?.includes('42P07') && !err.message?.includes('42P16')) {
        logger.warn(`hr_jobs slug unique index warning: ${err.message}`);
      }
    }

    // ─── Ensure hr_tests missing columns (duration, instructions, maxScore, passingScore, status, updatedAt) ───
    const hrTestsAlterStatements = [
      `ALTER TABLE "hr_tests" ADD COLUMN IF NOT EXISTS "duration" INTEGER`,
      `ALTER TABLE "hr_tests" ADD COLUMN IF NOT EXISTS "instructions" TEXT`,
      `ALTER TABLE "hr_tests" ADD COLUMN IF NOT EXISTS "maxScore" INTEGER NOT NULL DEFAULT 100`,
      `ALTER TABLE "hr_tests" ADD COLUMN IF NOT EXISTS "passingScore" INTEGER NOT NULL DEFAULT 50`,
      `ALTER TABLE "hr_tests" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIF'`,
      `ALTER TABLE "hr_tests" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    ];
    for (const stmt of hrTestsAlterStatements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (err: any) {
        if (!err.message?.includes('already exists') && !err.message?.includes('42P07') && !err.message?.includes('42P16')) {
          logger.warn(`hr_tests ALTER warning: ${err.message}`);
        }
      }
    }

    // ─── Ensure hr_test_results missing columns (notes, evaluatedAt) ───
    const hrTestResultsAlterStatements = [
      `ALTER TABLE "hr_test_results" ADD COLUMN IF NOT EXISTS "notes" TEXT`,
      `ALTER TABLE "hr_test_results" ADD COLUMN IF NOT EXISTS "evaluatedAt" TIMESTAMP(3)`,
    ];
    for (const stmt of hrTestResultsAlterStatements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (err: any) {
        if (!err.message?.includes('already exists') && !err.message?.includes('42P07') && !err.message?.includes('42P16')) {
          logger.warn(`hr_test_results ALTER warning: ${err.message}`);
        }
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

    // ─── Ensure RH Bénin — statut contractuel + payroll_fiscal_rates ──────
    // (migration 20260905140000 — idempotent, rejouée à chaque boot)
    try {
      for (const col of ['statutContractuel', 'cnssDeclarationDate', 'documentPaieType', 'prestationPaymentMode', 'prestationAmount', 'statutContractuelLockedAt']) {
        const colType = col === 'prestationAmount' ? 'DECIMAL(12,2)' : (col === 'cnssDeclarationDate' || col === 'statutContractuelLockedAt') ? 'TIMESTAMP(3)' : 'TEXT';
        await prisma.$executeRawUnsafe(`ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "${col}" ${colType}`);
      }
      for (const col of ['statutContractuel', 'documentPaieType', 'prestationPaymentMode', 'prestationAmount']) {
        const colType = col === 'prestationAmount' ? 'DECIMAL(12,2)' : 'TEXT';
        await prisma.$executeRawUnsafe(`ALTER TABLE "employment_contracts" ADD COLUMN IF NOT EXISTS "${col}" ${colType}`);
      }
      await prisma.$executeRawUnsafe(`ALTER TABLE "hr_jobs" ADD COLUMN IF NOT EXISTS "statutContractuel" TEXT`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "staff_statutContractuel_idx" ON "staff"("statutContractuel")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "employment_contracts_statutContractuel_idx" ON "employment_contracts"("statutContractuel")`);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "staff_statut_changes" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "tenantId" TEXT NOT NULL,
            "staffId" TEXT NOT NULL,
            "previousStatut" TEXT,
            "newStatut" TEXT NOT NULL,
            "effectiveDate" DATE NOT NULL,
            "justification" TEXT NOT NULL,
            "performedBy" TEXT,
            "performedByEmail" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "fk_ssc_staff" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "fk_ssc_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "staff_statut_changes_tenantId_staffId_idx" ON "staff_statut_changes"("tenantId", "staffId")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "staff_statut_changes_tenantId_effectiveDate_idx" ON "staff_statut_changes"("tenantId", "effectiveDate")`);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "payroll_fiscal_rates" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "countryCode" TEXT NOT NULL DEFAULT 'BJ',
            "fiscalYear" INTEGER NOT NULL,
            "cnssSalarial" DECIMAL(5,2) NOT NULL DEFAULT 3.6,
            "cnssPrestationsFamiliales" DECIMAL(5,2) NOT NULL DEFAULT 9.0,
            "cnssRisquesProMin" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
            "cnssRisquesProMax" DECIMAL(5,2) NOT NULL DEFAULT 4.0,
            "cnssVieillesse" DECIMAL(5,2) NOT NULL DEFAULT 16.0,
            "cnssPatronalGlobal" DECIMAL(5,2) NOT NULL DEFAULT 15.4,
            "itsBrackets" JSONB NOT NULL,
            "aibAvecIfu" DECIMAL(5,2) NOT NULL DEFAULT 3.0,
            "aibSansIfu" DECIMAL(5,2) NOT NULL DEFAULT 5.0,
            "smig" DECIMAL(12,2) NOT NULL DEFAULT 52000,
            "cnssMensuelSeuil" INTEGER NOT NULL DEFAULT 20,
            "categoryRules" JSONB,
            "effectiveFrom" DATE NOT NULL,
            "sourceNotes" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "payroll_fiscal_rates_countryCode_fiscalYear_key" ON "payroll_fiscal_rates"("countryCode", "fiscalYear")`
      );
      // Seed idempotent du barème 2026 (taux À CONFIRMER : cnss.bj / impots.finances.bj)
      await prisma.$executeRawUnsafe(`
        INSERT INTO "payroll_fiscal_rates" (
          "id", "countryCode", "fiscalYear", "cnssSalarial", "cnssPrestationsFamiliales",
          "cnssRisquesProMin", "cnssRisquesProMax", "cnssVieillesse", "cnssPatronalGlobal",
          "itsBrackets", "aibAvecIfu", "aibSansIfu", "smig", "cnssMensuelSeuil",
          "categoryRules", "effectiveFrom", "sourceNotes"
        ) VALUES (
          gen_random_uuid(), 'BJ', 2026, 3.6, 9.0, 1.0, 4.0, 16.0, 15.4,
          '[{"min":0,"max":60000,"rate":0},{"min":60000,"max":150000,"rate":10},{"min":150000,"max":250000,"rate":15},{"min":250000,"max":500000,"rate":19},{"min":500000,"max":1000000,"rate":25},{"min":1000000,"max":3000000,"rate":30},{"min":3000000,"max":null,"rate":35}]'::jsonb,
          3.0, 5.0, 52000.0, 20,
          '{"OUVRIER_EMPLOYE":{"essai":"un (1) mois","renouvellement":"une (1) fois","preavis":"quinze (15) jours"},"AGENT_MAITRISE":{"essai":"deux (2) mois","renouvellement":"une (1) fois","preavis":"un (1) mois"},"CADRE":{"essai":"trois (3) mois","renouvellement":"une (1) fois","preavis":"trois (3) mois"},"ENSEIGNANT":{"essai":"deux (2) mois","renouvellement":"une (1) fois","preavis":"un (1) mois"}}'::jsonb,
          '2026-01-01',
          'CNSS (cnss.bj) : salarial 3,6 % - prestations familiales patronales 9 % (à CONFIRMER, certains guides indiquent 12 %) - patronal global ~15,4 %. ITS : barème annuel DGI 2026 (720k/1,8M/3M/6M/12M/36M FCFA - 0/10/15/19/25/30/35 %) ramené en mensuel, À CONFIRMER sur impots.finances.bj. AIB : 3 % avec IFU / 5 % sans IFU. SMIG : 52 000 FCFA/mois. Barèmes essai/préavis : chiffres généraux Bénin, à faire confirmer par un juriste (convention collective enseignement privé).'
        ) ON CONFLICT ("countryCode", "fiscalYear") DO NOTHING
      `);
      logger.log('✅ RH Bénin : statut contractuel (staff/contrats/offres) + staff_statut_changes + payroll_fiscal_rates ensured');
    } catch (statutErr: any) {
      logger.warn(`RH statut contractuel bootstrap warning: ${statutErr.message}`);
    }

    // ─── Ensure RH Bénin — documents de paie FP/EP (migration 20260906140000) ──
    // payroll_documents : snapshot figé + hash SHA-256 + numérotation séquentielle annuelle.
    // Idempotent, rejoué à chaque boot (même pattern que le bloc RH statut ci-dessus).
    try {
      // Congés payés par mois (barème — 1,5 à confirmer vs 2) sur payroll_fiscal_rates
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "payroll_fiscal_rates" ADD COLUMN IF NOT EXISTS "joursCongesParMois" DECIMAL(4,2) NOT NULL DEFAULT 1.5`,
      );
      await prisma.$executeRawUnsafe(
        `UPDATE "payroll_fiscal_rates" SET "joursCongesParMois" = 1.5 WHERE "joursCongesParMois" IS NULL`,
      );

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "payroll_documents" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "tenantId" TEXT NOT NULL,
            "academicYearId" TEXT,
            "staffId" TEXT NOT NULL,
            "payrollItemId" TEXT,
            "documentType" TEXT NOT NULL,
            "documentNumber" TEXT NOT NULL,
            "periodYear" INTEGER NOT NULL,
            "periodMonth" INTEGER NOT NULL,
            "fiscalYear" INTEGER NOT NULL,
            "periodLabel" TEXT NOT NULL,
            "statutContractuel" TEXT,
            "snapshot" JSONB NOT NULL,
            "contentHash" TEXT NOT NULL,
            "filePath" TEXT,
            "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "issuedBy" TEXT,
            "issuedByName" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "fk_pd_staff" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "fk_pd_payroll_item" FOREIGN KEY ("payrollItemId") REFERENCES "payroll_items"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "fk_pd_academic_year" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE,
            CONSTRAINT "fk_pd_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "payroll_documents_documentNumber_key" ON "payroll_documents"("documentNumber")`);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "payroll_documents_payrollItemId_key" ON "payroll_documents"("payrollItemId")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "payroll_documents_tenantId_fiscalYear_documentType_idx" ON "payroll_documents"("tenantId", "fiscalYear", "documentType")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "payroll_documents_tenantId_periodYear_periodMonth_idx" ON "payroll_documents"("tenantId", "periodYear", "periodMonth")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "payroll_documents_staffId_idx" ON "payroll_documents"("staffId")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "payroll_documents_documentType_idx" ON "payroll_documents"("documentType")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "payroll_documents_issuedAt_idx" ON "payroll_documents"("issuedAt")`);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "payroll_document_sequences" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "tenantId" TEXT NOT NULL,
            "documentType" TEXT NOT NULL,
            "fiscalYear" INTEGER NOT NULL,
            "lastNumber" INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "fk_pds_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "payroll_document_sequences_tenantId_documentType_fiscalYear_key" ON "payroll_document_sequences"("tenantId", "documentType", "fiscalYear")`);
      logger.log('✅ RH Bénin : payroll_documents (FP/EP) + payroll_document_sequences + joursCongesParMois ensured');
    } catch (payrollDocsErr: any) {
      logger.warn(`RH payroll documents bootstrap warning: ${payrollDocsErr.message}`);
    }

    // ─── Ensure RH — Refonte CDC « étape Contrat » (migration 20260906180000) ──
    // Champs CDD (motif/renouvellements/chaîne/essai CDI), justification du statut,
    // paramétrage par école (hr_contract_settings), flux stage séparé (hr_internships)
    // + migration §10 : badge « à requalifier » sur les dossiers VACATAIRE existants.
    try {
      for (const col of [
        ['cddMotif', 'TEXT'], ['cddChainId', 'TEXT'], ['justificationStatut', 'TEXT'],
        ['requalifieDepuis', 'TEXT'], ['periodeEssaiMois', 'INTEGER'],
      ] as const) {
        await prisma.$executeRawUnsafe(`ALTER TABLE "employment_contracts" ADD COLUMN IF NOT EXISTS "${col[0]}" ${col[1]}`);
      }
      await prisma.$executeRawUnsafe(`ALTER TABLE "employment_contracts" ADD COLUMN IF NOT EXISTS "cddRenouvellements" INTEGER NOT NULL DEFAULT 0`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "employment_contracts" ADD COLUMN IF NOT EXISTS "needsRequalification" BOOLEAN NOT NULL DEFAULT false`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "employment_contracts_cddChainId_idx" ON "employment_contracts"("cddChainId")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "employment_contracts_needsRequalification_idx" ON "employment_contracts"("needsRequalification")`);

      await prisma.$executeRawUnsafe(`ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "justificationStatut" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "needsRequalification" BOOLEAN NOT NULL DEFAULT false`);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "hr_contract_settings" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "tenantId" TEXT NOT NULL,
            "cddMotifs" JSONB,
            "stageTypes" JSONB,
            "cddDureeMaxMois" INTEGER NOT NULL DEFAULT 24,
            "cddRenouvellementsMax" INTEGER NOT NULL DEFAULT 1,
            "indemniteFinContratPct" DECIMAL(5,2) NOT NULL DEFAULT 6,
            "testQualificationEnabled" BOOLEAN NOT NULL DEFAULT true,
            "testQuestions" JSONB,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "hr_contract_settings_tenantId_key" UNIQUE ("tenantId"),
            CONSTRAINT "fk_hcs_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "hr_internships" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "tenantId" TEXT NOT NULL,
            "firstName" TEXT NOT NULL,
            "lastName" TEXT NOT NULL,
            "email" TEXT,
            "phone" TEXT,
            "nationalId" TEXT,
            "birthDate" DATE,
            "position" TEXT,
            "typeStage" TEXT,
            "startDate" DATE NOT NULL,
            "endDate" DATE NOT NULL,
            "gratificationAmount" DECIMAL(12,2),
            "gratificationPeriodicite" TEXT,
            "etablissementOrigine" TEXT,
            "tuteurNom" TEXT,
            "tuteurStaffId" TEXT,
            "assuranceSouscrite" BOOLEAN NOT NULL DEFAULT false,
            "assurancePoliceRef" TEXT,
            "assuranceCompagnie" TEXT,
            "status" TEXT NOT NULL DEFAULT 'DRAFT',
            "terms" JSONB,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "fk_hi_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "fk_hi_tuteur" FOREIGN KEY ("tuteurStaffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE
        )
      `);
      for (const idx of [
        ['hr_internships_tenantId_idx', '"hr_internships"("tenantId")'],
        ['hr_internships_status_idx', '"hr_internships"("status")'],
        ['hr_internships_tenantId_status_idx', '"hr_internships"("tenantId", "status")'],
      ] as const) {
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "${idx[0]}" ON ${idx[1]}`);
      }

      // §10 — badge « à requalifier » sur les dossiers VACATAIRE existants
      // (jamais de suppression/réécriture : requalification manuelle par l'école)
      const markedContracts = await prisma.$executeRawUnsafe(
        `UPDATE "employment_contracts" SET "needsRequalification" = true, "requalifieDepuis" = "contractType"
          WHERE "contractType" = 'VACATAIRE' AND "needsRequalification" = false`,
      );
      const markedStaff = await prisma.$executeRawUnsafe(
        `UPDATE "staff" SET "needsRequalification" = true
          WHERE "contractType" = 'VACATAIRE' AND "needsRequalification" = false`,
      );
      if (markedContracts > 0 || markedStaff > 0) {
        logger.log(`✅ CDC Contrat : ${markedContracts} contrat(s) + ${markedStaff} fiche(s) « Vacataire » marqués à requalifier`);
      }
      logger.log('✅ CDC Contrat : champs CDD/justification/requalification + hr_contract_settings + hr_internships ensured');
    } catch (contratRefonteErr: any) {
      logger.warn(`CDC Contrat bootstrap warning: ${contratRefonteErr.message}`);
    }

    // ============================================================================
    // ⭐ REÇUS / FACTURES AUTOMATIQUES + EFFECTIF ESTIMÉ (onboarding — 20260906200000)
    // ============================================================================
    // - onboarding_drafts.estimated_student_count : effectif estimé (élèves)
    //   persisté pour le contrat (Article 1), l'email et la signature différée.
    // - billing_documents : reçus (REC-AH-AAAA-NNNNN) et factures
    //   (FAC-AH-AAAA-NNNNN) générés automatiquement à l'encaissement /
    //   signature — snapshot figé, PDF Puppeteer, pièce jointe email promoteur.
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "onboarding_drafts" ADD COLUMN IF NOT EXISTS "estimated_student_count" INTEGER NOT NULL DEFAULT 0`,
      );
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "billing_documents" (
            "id" TEXT NOT NULL,
            "kind" TEXT NOT NULL DEFAULT 'RECEIPT',
            "document_number" TEXT NOT NULL,
            "sequence_year" INTEGER NOT NULL,
            "transaction_type" TEXT NOT NULL DEFAULT 'FULL_SUBSCRIPTION',
            "draft_id" TEXT,
            "tenant_id" TEXT,
            "issued_by_name" TEXT,
            "issued_by_email" TEXT,
            "payer_name" TEXT,
            "payer_email" TEXT,
            "payment_method" TEXT NOT NULL DEFAULT 'CASH',
            "paid_at" TIMESTAMPTZ,
            "amount" INTEGER NOT NULL DEFAULT 0,
            "snapshot" JSONB,
            "file_path" TEXT,
            "file_name" TEXT,
            "status" TEXT NOT NULL DEFAULT 'EMITTED',
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "billing_documents_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "billing_documents_document_number_key" ON "billing_documents"("document_number")`,
      );
      for (const idx of [
        ['billing_documents_draft_id_idx', '"billing_documents"("draft_id")'],
        ['billing_documents_kind_year_idx', '"billing_documents"("kind", "sequence_year")'],
        ['billing_documents_tenant_id_idx', '"billing_documents"("tenant_id")'],
      ] as const) {
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "${idx[0]}" ON ${idx[1]}`);
      }
      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_documents_draft_id_fkey') THEN
                ALTER TABLE "billing_documents" ADD CONSTRAINT "billing_documents_draft_id_fkey"
                FOREIGN KEY ("draft_id") REFERENCES "onboarding_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
            END IF;
        END $$;
      `);
      logger.log('✅ Onboarding : estimated_student_count + billing_documents (reçus/factures) ensured');
    } catch (billingDdlErr: any) {
      logger.warn(`Onboarding receipts bootstrap warning: ${billingDdlErr.message}`);
    }

    logger.log('HR tables & columns ensured successfully');
  } catch (fallbackErr: any) {
    logger.error(`Recruitment tables fallback failed: ${fallbackErr.message}`);
    logger.warn('Some HR recruitment features may not work');
  }

  // ⚒️ RE-FETCH prisma : la const ci-dessus est block-scopée au try/catch
  // précédent — sans ceci, tous les fallbacks suivants levait
  // "ReferenceError: prisma is not defined" (avalié par leurs try/catch,
  // donc les migrations DDL de secours échouaient silencieusement au boot).
  const prisma = app.get(PrismaService);

  // ============================================================================
  // FALLBACK: Migration studentEnrollmentBlocked sur tenants
  // ============================================================================
  // Cette colonne est nécessaire pour StudentCountVerifierService qui bloque
  // l'ajout d'élèves quand le plan d'abonnement est dépassé. La migration
  // Prisma 20260621160000 peut échouer à s'appliquer proprement (déjà
  // marquée comme appliquée dans _prisma_migrations suite à un précédent
  // échec silencieux). Ce fallback garantit que la colonne existe.
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "studentEnrollmentBlocked" BOOLEAN NOT NULL DEFAULT false`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "tenants_studentEnrollmentBlocked_idx" ON "tenants"("studentEnrollmentBlocked")`
    );
    logger.log('✅ Column tenants.studentEnrollmentBlocked ensured successfully');
  } catch (studentColErr: any) {
    logger.warn(`tenantEnrollmentBlocked column warning: ${studentColErr.message}`);
  }

  // ============================================================================
  // FALLBACK: Migration logoUrl sur onboarding_drafts
  // ============================================================================
  // Cette colonne stocke le chemin du logo uploadé pendant l'onboarding.
  // Migration 20260621170000_add_logo_url_to_onboarding_draft.
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "onboarding_drafts" ADD COLUMN IF NOT EXISTS "logo_url" TEXT`
    );
    logger.log('✅ Column onboarding_drafts.logo_url ensured successfully');
  } catch (logoColErr: any) {
    logger.warn(`onboarding_drafts.logo_url column warning: ${logoColErr.message}`);
  }

  // ============================================================================
  // FALLBACK: Migration bilingualEnabled sur HelmSubscription
  // ============================================================================
  // Cette colonne stocke l'état de l'option bilingue (FR + EN) activable
  // depuis le module paramètres avec paiement FedaPay.
  // Migration 20260621190000_add_bilingual_to_helm_subscription.
  // Note: la table s'appelle "HelmSubscription" (PascalCase, pas de @@map)
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "HelmSubscription" ADD COLUMN IF NOT EXISTS "bilingualEnabled" BOOLEAN NOT NULL DEFAULT false`
    );
    logger.log('✅ Column HelmSubscription.bilingualEnabled ensured successfully');
  } catch (bilingualColErr: any) {
    logger.warn(`HelmSubscription.bilingualEnabled column warning: ${bilingualColErr.message}`);
  }

  // ============================================================================
  // FALLBACK: CMS tables for Site Public administration
  // ============================================================================
  // Migration 20260622080000_add_cms_tables — crée idempotemment les 5 tables
  // utilisées par le CMS du site public (blog_articles, cms_pages, legal_pages,
  // seo_meta, media_assets). Si la migration a déjà été appliquée par
  // `prisma migrate deploy`, ces statements sont des no-ops.
  // ----------------------------------------------------------------------------
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "blog_articles" (
          "id" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "slug" TEXT NOT NULL,
          "excerpt" TEXT,
          "content" TEXT,
          "coverImageUrl" TEXT,
          "category" TEXT,
          "tags" TEXT,
          "seoTitle" TEXT,
          "seoDescription" TEXT,
          "status" TEXT NOT NULL DEFAULT 'DRAFT',
          "publishedAt" TIMESTAMP(3),
          "authorId" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "blog_articles_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "blog_articles_slug_key" ON "blog_articles"("slug")`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "blog_articles_status_idx" ON "blog_articles"("status")`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "blog_articles_category_idx" ON "blog_articles"("category")`,
    );

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "cms_pages" (
          "id" TEXT NOT NULL,
          "slug" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "content" JSON,
          "seoTitle" TEXT,
          "seoDescription" TEXT,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "cms_pages_slug_key" ON "cms_pages"("slug")`,
    );

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "legal_pages" (
          "id" TEXT NOT NULL,
          "code" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "content" TEXT,
          "version" INTEGER NOT NULL DEFAULT 1,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "legal_pages_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "legal_pages_code_key" ON "legal_pages"("code")`,
    );

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "seo_meta" (
          "id" TEXT NOT NULL,
          "pagePath" TEXT NOT NULL,
          "title" TEXT,
          "description" TEXT,
          "ogTitle" TEXT,
          "ogDescription" TEXT,
          "ogImageUrl" TEXT,
          "keywords" TEXT,
          "canonicalUrl" TEXT,
          "noIndex" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "seo_meta_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "seo_meta_pagePath_key" ON "seo_meta"("pagePath")`,
    );

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "media_assets" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "url" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "size" INTEGER,
          "alt" TEXT,
          "tags" TEXT,
          "uploadedBy" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "media_assets_type_idx" ON "media_assets"("type")`,
    );

    logger.log('✅ CMS tables (blog_articles, cms_pages, legal_pages, seo_meta, media_assets) ensured successfully');
  } catch (cmsTablesErr: any) {
    logger.warn(`CMS tables fallback warning: ${cmsTablesErr.message}`);
  }

  // ─── Department managerId FK migration: Teacher → Staff + remove @unique ──
  // The Department.managerId originally referenced Teacher.id with @unique,
  // but the frontend sends Staff IDs. We change the FK to reference Staff.id
  // and remove the unique constraint so one person can manage multiple departments
  // (context: in Africa, one person can hold multiple positions).
  // This is idempotent — safe to run multiple times.
  try {
    const prisma = app.get(PrismaService);
    // Drop old FK constraint (departments_managerId_fkey → teachers.id)
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "departments_managerId_fkey"`,
    ).catch(() => {});
    // Drop unique constraint on managerId (allows one person → multiple departments)
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "departments_managerId_key"`,
    ).catch(() => {});
    // Add new FK constraint → staff.id with ON DELETE SET NULL
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "departments" ADD CONSTRAINT "departments_managerId_fkey"
       FOREIGN KEY ("managerId") REFERENCES "staff"("id") ON DELETE SET NULL`,
    ).catch(() => {});
    logger.log('✅ Department.managerId FK migrated: Teacher → Staff (unique constraint removed)');
  } catch (deptFkErr: any) {
    logger.warn(`Department FK migration warning: ${deptFkErr.message}`);
  }

  // ─── Rooms table — add missing columns + ensure related tables exist (idempotent) ──
  // The Room model and related tables may not have all columns in the production DB
  // if migrations weren't applied. This adds them safely.
  try {
    const prisma = app.get(PrismaService);

    // 1. Ensure rooms table columns
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "schoolLevelId" TEXT`,
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "equipment" JSONB NOT NULL DEFAULT '[]'::jsonb`,
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE'`,
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "description" TEXT`,
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "createdBy" TEXT`,
    ).catch(() => {});
    // Tenant website — customColors for palette personnalisation
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "tenant_websites" ADD COLUMN IF NOT EXISTS "customColors" JSONB`,
    ).catch(() => {});

    // 2. Ensure room_allocations table exists
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "room_allocations" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "academicYearId" TEXT NOT NULL,
        "roomId" TEXT NOT NULL,
        "allocationType" TEXT NOT NULL,
        "referenceId" TEXT,
        "startTime" TIMESTAMP(3) NOT NULL,
        "endTime" TIMESTAMP(3) NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "room_allocations_pkey" PRIMARY KEY ("id")
      )`,
    ).catch(() => {});

    // 3. Ensure room_maintenances table exists
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "room_maintenances" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "roomId" TEXT NOT NULL,
        "startDate" TIMESTAMP(3) NOT NULL,
        "endDate" TIMESTAMP(3),
        "reason" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "room_maintenances_pkey" PRIMARY KEY ("id")
      )`,
    ).catch(() => {});

    // 4. Ensure room_schedules table exists
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "room_schedules" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "academicYearId" TEXT NOT NULL,
        "roomId" TEXT NOT NULL,
        "dayOfWeek" INTEGER NOT NULL,
        "startTime" TEXT NOT NULL,
        "endTime" TEXT NOT NULL,
        "classId" TEXT,
        "subjectId" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "room_schedules_pkey" PRIMARY KEY ("id")
      )`,
    ).catch(() => {});

    // 5. Ensure room_reservations table exists
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "room_reservations" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "academicYearId" TEXT NOT NULL,
        "roomId" TEXT NOT NULL,
        "requestedBy" TEXT,
        "purpose" TEXT,
        "startTime" TIMESTAMP(3) NOT NULL,
        "endTime" TIMESTAMP(3) NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "room_reservations_pkey" PRIMARY KEY ("id")
      )`,
    ).catch(() => {});

    // 6. Ensure timetable_entries has roomId column (for room detach on delete)
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "timetable_entries" ADD COLUMN IF NOT EXISTS "roomId" TEXT`,
    ).catch(() => {});

    logger.log('✅ Rooms table columns + related tables ensured (room_allocations, room_maintenances, room_schedules, room_reservations, timetable_entries.roomId)');
  } catch (roomsColsErr: any) {
    logger.warn(`Rooms columns migration warning: ${roomsColsErr.message}`);
  }

  // ─── Contract PDF — ensure missing columns in employment_contracts, school_settings, staff ──
  // The contract PDF generation loads Contract + Staff + SchoolSettings + TenantIdentityProfile.
  // If any column is missing in the production DB, Prisma throws "colonne inconnue".
  // This adds all potentially missing columns idempotently.
  try {
    const prisma = app.get(PrismaService);

    // 1. employment_contracts — schoolLevelId column (added to schema but may not be in DB)
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "employment_contracts" ADD COLUMN IF NOT EXISTS "schoolLevelId" TEXT`,
    ).catch(() => {});

    // 2. school_settings — fedapayShopId, fedapayApiKey (added for FedaPay integration)
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "school_settings" ADD COLUMN IF NOT EXISTS "fedapayShopId" TEXT`,
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "school_settings" ADD COLUMN IF NOT EXISTS "fedapayApiKey" TEXT`,
    ).catch(() => {});

    // 3. staff — ensure all columns referenced by contract PDF exist
    // (bankDetails, mobileMoneyNumber, mobileMoneyOperator, etc.)
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "bankDetails" JSONB`,
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "mobileMoneyNumber" TEXT`,
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "mobileMoneyOperator" TEXT`,
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "contractType" TEXT`,
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "cnssNumber" TEXT`,
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "ifNumber" TEXT`,
    ).catch(() => {});

    // 4. Ensure employee_cnss table exists
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "employee_cnss" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "staffId" TEXT NOT NULL,
        "cnssNumber" TEXT,
        "affiliationDate" DATE,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "employee_cnss_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "employee_cnss_staffId_key" UNIQUE ("staffId")
      )`,
    ).catch(() => {});

    logger.log('✅ Contract PDF columns ensured (employment_contracts.schoolLevelId, school_settings.fedapay*, staff.bankDetails/mobileMoney*, employee_cnss)');
  } catch (contractColsErr: any) {
    logger.warn(`Contract PDF columns migration warning: ${contractColsErr.message}`);
  }

  // ─── Tenant Website tables — create if not exist (idempotent) ──
  // CMS for the institutional website of each school.
  try {
    const prisma = app.get(PrismaService);

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "tenant_websites" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "heroTitle" TEXT,
        "heroSubtitle" TEXT,
        "heroImageUrl" TEXT,
        "heroCtaText" TEXT DEFAULT 'Pré-inscription',
        "heroCtaUrl" TEXT DEFAULT '/public/pre-enrollment',
        "heroIsActive" BOOLEAN NOT NULL DEFAULT true,
        "keyFigures" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "promoterWord" TEXT,
        "promoterName" TEXT,
        "promoterPhotoUrl" TEXT,
        "promoterIsActive" BOOLEAN NOT NULL DEFAULT true,
        "directorWord" TEXT,
        "directorName" TEXT,
        "directorPhotoUrl" TEXT,
        "directorIsActive" BOOLEAN NOT NULL DEFAULT true,
        "presentationTitle" TEXT,
        "presentationContent" TEXT,
        "presentationImageUrl" TEXT,
        "presentationIsActive" BOOLEAN NOT NULL DEFAULT true,
        "admissionsTitle" TEXT,
        "admissionsContent" TEXT,
        "admissionsIsActive" BOOLEAN NOT NULL DEFAULT true,
        "schoolLifeTitle" TEXT,
        "schoolLifeContent" TEXT,
        "schoolLifeIsActive" BOOLEAN NOT NULL DEFAULT true,
        "footerAboutText" TEXT,
        "footerCopyrightText" TEXT,
        "footerIsActive" BOOLEAN NOT NULL DEFAULT true,
        "socialLinks" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "seoMetaTitle" TEXT,
        "seoMetaDescription" TEXT,
        "seoKeywords" TEXT,
        "seoOgImageUrl" TEXT,
        "contactEmail" TEXT,
        "contactPhone" TEXT,
        "contactAddress" TEXT,
        "contactMapUrl" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
        "aiWelcomeMessage" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "tenant_websites_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "tenant_websites_tenantId_key" UNIQUE ("tenantId")
      )`,
    ).catch(() => {});

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "tenant_news_articles" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "websiteId" TEXT,
        "title" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "excerpt" TEXT,
        "content" TEXT NOT NULL,
        "coverImageUrl" TEXT,
        "category" TEXT,
        "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
        "status" TEXT NOT NULL DEFAULT 'DRAFT',
        "publishedAt" TIMESTAMP(3),
        "isFeatured" BOOLEAN NOT NULL DEFAULT false,
        "viewCount" INTEGER NOT NULL DEFAULT 0,
        "seoTitle" TEXT,
        "seoDescription" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "tenant_news_articles_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "tenant_news_articles_tenantId_slug_key" UNIQUE ("tenantId", "slug")
      )`,
    ).catch(() => {});

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "tenant_events" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "websiteId" TEXT,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "startDate" TIMESTAMP(3) NOT NULL,
        "endDate" TIMESTAMP(3),
        "location" TEXT,
        "imageUrl" TEXT,
        "category" TEXT,
        "status" TEXT NOT NULL DEFAULT 'UPCOMING',
        "isFeatured" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "tenant_events_pkey" PRIMARY KEY ("id")
      )`,
    ).catch(() => {});

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "tenant_gallery_items" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "websiteId" TEXT,
        "imageUrl" TEXT NOT NULL,
        "thumbnailUrl" TEXT,
        "caption" TEXT,
        "category" TEXT,
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "tenant_gallery_items_pkey" PRIMARY KEY ("id")
      )`,
    ).catch(() => {});

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "tenant_testimonials" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "websiteId" TEXT,
        "authorName" TEXT NOT NULL,
        "authorRole" TEXT,
        "authorPhotoUrl" TEXT,
        "content" TEXT NOT NULL,
        "rating" INTEGER,
        "isFeatured" BOOLEAN NOT NULL DEFAULT false,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "tenant_testimonials_pkey" PRIMARY KEY ("id")
      )`,
    ).catch(() => {});

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "tenant_faq_items" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "websiteId" TEXT,
        "question" TEXT NOT NULL,
        "answer" TEXT NOT NULL,
        "category" TEXT,
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "tenant_faq_items_pkey" PRIMARY KEY ("id")
      )`,
    ).catch(() => {});

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "tenant_contact_messages" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "websiteId" TEXT,
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "phone" TEXT,
        "subject" TEXT,
        "message" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'NEW',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "tenant_contact_messages_pkey" PRIMARY KEY ("id")
      )`,
    ).catch(() => {});

    logger.log('✅ Tenant Website tables ensured (tenant_websites, tenant_news_articles, tenant_events, tenant_gallery_items, tenant_testimonials, tenant_faq_items, tenant_contact_messages)');
  } catch (twErr: any) {
    logger.warn(`Tenant Website tables migration warning: ${twErr.message}`);
  }
  }, 1000); // ⭐ Run ensure-tables 1s after listen (non-blocking)

  // ─── IDENTITÉ PAR NIVEAU (secondaire ≠ maternelle/primaire) — 2026-11-13 ───
  // Écoles combinées dont le secondaire porte un nom/contacts/logo distincts.
  // Miroir idempotent de la migration 20261113100000_tenant_level_identity_profiles :
  // garantit la table au boot même si `prisma migrate deploy` n'a pas été joué
  // (SKIP_MIGRATIONS=true par défaut en prod).
  setTimeout(async () => {
    try {
      const prisma = app.get(PrismaService);
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "tenant_level_identity_profiles" (
          "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          "tenantId" TEXT NOT NULL,
          "educationLevelId" TEXT NOT NULL,
          "schoolName" TEXT NOT NULL,
          "schoolAcronym" TEXT,
          "slogan" TEXT,
          "phonePrimary" TEXT,
          "phoneSecondary" TEXT,
          "whatsapp" TEXT,
          "email" TEXT,
          "website" TEXT,
          "address" TEXT,
          "city" TEXT,
          "department" TEXT,
          "country" TEXT DEFAULT 'BJ',
          "postalCode" TEXT,
          "logoUrl" TEXT,
          "createdBy" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL
        )`,
      ).catch(() => {});
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "tenant_level_identity_profiles_tenantId_educationLevelId_key" ON "tenant_level_identity_profiles"("tenantId", "educationLevelId")`,
      ).catch(() => {});
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "tenant_level_identity_profiles_tenantId_idx" ON "tenant_level_identity_profiles"("tenantId")`,
      ).catch(() => {});
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "tenant_level_identity_profiles_educationLevelId_idx" ON "tenant_level_identity_profiles"("educationLevelId")`,
      ).catch(() => {});
      logger.log('✅ Table tenant_level_identity_profiles ensured (identité du niveau secondaire)');
    } catch (e: any) {
      logger.warn(`Level identity tables ensure warning: ${e?.message}`);
    }
  }, 1200);

  // ─── DOUBLE IDENTITÉ E-MAIL PAR NIVEAU — 2026-11-26 (retour promoteur) ────
  // Miroir idempotent de la migration 20261126120000_school_email_level_category :
  // colonne levelCategory sur school_email_settings + unicité (tenant, niveau).
  // Garantit le schéma au boot même si `prisma migrate deploy` n'a pas été joué
  // (SKIP_MIGRATIONS=true par défaut en prod). Les lignes existantes restent
  // MATERNAL_PRIMARY (défaut) — aucune perte de configuration Google/SMTP.
  setTimeout(async () => {
    try {
      const prisma = app.get(PrismaService);
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "school_email_settings"
           ADD COLUMN IF NOT EXISTS "levelCategory" TEXT NOT NULL DEFAULT 'MATERNAL_PRIMARY'`,
      ).catch(() => {});
      await prisma.$executeRawUnsafe(
        `UPDATE "school_email_settings" SET "levelCategory" = 'MATERNAL_PRIMARY'
          WHERE "levelCategory" IS NULL OR "levelCategory" NOT IN ('MATERNAL_PRIMARY', 'SECONDARY')`,
      ).catch(() => {});
      await prisma.$executeRawUnsafe(
        `DROP INDEX IF EXISTS "school_email_settings_tenantId_key"`,
      ).catch(() => {});
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "school_email_settings_tenantId_levelCategory_key"
           ON "school_email_settings"("tenantId", "levelCategory")`,
      ).catch(() => {});
      logger.log('✅ school_email_settings : colonne levelCategory + unicité (tenant, niveau) ensured (double identité e-mail)');
    } catch (e: any) {
      logger.warn(`School email level category ensure warning: ${e?.message}`);
    }
  }, 1300);

  // ─── ACADEMIA COMMUNITY — bootstrap idempotent (tables + canaux + admin) ───
  // Espace clients/prospects du produit : tables community_*, 7 canaux par
  // défaut (annonces, conseils quotidiens, discussion, formation, support,
  // témoignages, sondages) + SUPER_ADMIN depuis COMMUNITY_ADMIN_EMAIL/PASSWORD.
  // Non-bloquant (3s après listen), même politique que le reste du bootstrap.
  setTimeout(async () => {
    try {
      const communityBootstrap = app.get(CommunityBootstrap);
      await communityBootstrap.run();
    } catch (e: any) {
      logger.warn(`Bootstrap communauté ignoré : ${e?.message}`);
    }
  }, 3000);

  // ─── Neon DB Keep-Alive — SUPPRIMÉ (audit coût Neon, 2026-11-03) ───
  // Ce SELECT 1 toutes les 4 min neutralisait TOTALEMENT le scale-to-zero :
  // un ping sous le seuil d'autosuspend (5 min) = compute éveillé 24/7
  // (~0.25 CU facturées en continu, ~$19/mois de CU sans trafic réel).
  // La résilience cold-start est déjà assurée par ailleurs :
  //   - PrismaService : connectionTimeoutMillis 30 s + retry auto ($extends)
  //   - /health : liveness SANS ping DB (le healthcheck Railway toutes les
  //     30 s ne réveillait plus Neon — cf. health.controller.ts)
  //   - LoginPage : warm-up de la lambda pendant la saisie utilisateur
  // Neon se rendort désormais ≤ 5 min après la dernière vraie requête et se
  // réveille en ~500 ms sur la requête suivante.

  // ─── PERF 2026-09-07 : index + ANALYZE pour la pagination transactions ───
  // Index composite (tenantId, academicYearId, createdAt DESC) : la requête
  // la plus chaude du module Finance (liste transactions paginée, ORDER BY
  // createdAt DESC) faisait un tri en mémoire après lecture ; avec cet index,
  // Postgres sert directement les lignes dans l'ordre → O(limit) au lieu de
  // O(n log n) par page. ANALYZE : les stats de planificateur n'avaient JAMAIS
  // été calculées (pg_class.reltuples = -1 sur la plupart des tables, détecté
  // lors de l'audit du 2026-09-07) → plans sous-optimaux garantis à mesure
  // que les écoles accumulent des données. Idempotent, non-bloquant.
  setTimeout(async () => {
    try {
      const prisma = app.get(PrismaService);
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "finance_transactions_tenant_year_created_idx" ON "finance_transactions"("tenantId", "academicYearId", "createdAt" DESC)`,
      );
      await prisma.$executeRawUnsafe(`ANALYZE "finance_transactions"`);
      await prisma.$executeRawUnsafe(`ANALYZE "student_accounts"`);
      await prisma.$executeRawUnsafe(`ANALYZE "students"`);
      await prisma.$executeRawUnsafe(`ANALYZE "account_breakdowns"`);
      await prisma.$executeRawUnsafe(`ANALYZE "student_enrollments"`);
      await prisma.$executeRawUnsafe(`ANALYZE "fee_arrears"`);
      await prisma.$executeRawUnsafe(`ANALYZE "sessions"`);
      await prisma.$executeRawUnsafe(`ANALYZE "users"`);
      logger.log('✅ PERF: index transactions (tenant,year,createdAt) + ANALYZE des tables chaudes');
    } catch (err: any) {
      logger.warn(`PERF index/analyze skipped: ${err.message}`);
    }
  }, 15_000); // 15s après le boot (après le warmup DB)

  // ─── Auto-sync HR teachers → Pedagogy on startup ──
  // One-time backfill: for each tenant, sync existing Staff TEACHER records
  // to the Pedagogy Teacher table so they appear in class assignments.
  // Run in background (non-blocking) to avoid slowing startup.
  setTimeout(async () => {
    try {
      const { PrismaService } = await import('./database/prisma.service');
      const { StaffPrismaService } = await import('./hr/staff-prisma.service');
      const prisma = app.get(PrismaService);
      const staffService = app.get(StaffPrismaService);
      if (staffService && typeof staffService.syncTeachersToPedagogy === 'function') {
        const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
        logger.log(`Auto-syncing ${tenants.length} tenant(s) teachers to pedagogy...`);
        for (const t of tenants) {
          try {
            const result = await staffService.syncTeachersToPedagogy(t.id);
            if (result.created > 0 || result.updated > 0) {
              logger.log(`[${t.name}] Teacher sync: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`);
            }
          } catch (err: any) {
            logger.warn(`[${t.name}] Teacher sync failed: ${err.message}`);
          }
        }
      }
    } catch (err: any) {
      logger.warn(`Teacher auto-sync skipped: ${err.message}`);
    }
  }, 5000); // 5 second delay to let the app fully start

  // ─── Cleanup test data from pedagogy module ──
  // DISABLED in production — was deleting ALL subjects (no "test" filter) on every startup.
  // Root cause of "subjects auto-deleted on every Fly.io redeploy" bug.
  // If cleanup is needed in the future, use an explicit admin HTTP endpoint with audit log,
  // never an unconditional startup script. See: subjects-prisma.controller / academic-structure-prisma.controller.
  // To re-enable for local dev only, set ENABLE_DEV_CLEANUP=true in your .env.
  if (process.env.ENABLE_DEV_CLEANUP === 'true' && process.env.NODE_ENV !== 'production') {
    setTimeout(async () => {
      try {
        const { PrismaService } = await import('./database/prisma.service');
        const prisma = app.get(PrismaService);
        const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
        for (const t of tenants) {
          try {
            // Delete test levels (name contains 'test')
            const testLevels = await prisma.academicLevel.findMany({
              where: { tenantId: t.id, name: { contains: 'test', mode: 'insensitive' } },
              select: { id: true, name: true },
            });
            for (const l of testLevels) {
              await prisma.academicLevel.delete({ where: { id: l.id } }).catch(() => {});
            }

            // Delete test cycles (name contains 'test')
            const testCycles = await prisma.academicCycle.findMany({
              where: { tenantId: t.id, name: { contains: 'test', mode: 'insensitive' } },
              select: { id: true, name: true },
            });
            for (const c of testCycles) {
              await prisma.academicCycle.delete({ where: { id: c.id } }).catch(() => {});
            }

            // Delete test classes (name or code contains 'test')
            const testClasses = await prisma.academicClass.findMany({
              where: {
                tenantId: t.id,
                OR: [
                  { name: { contains: 'test', mode: 'insensitive' } },
                  { code: { contains: 'test', mode: 'insensitive' } },
                ],
              },
              select: { id: true, name: true },
            });
            for (const c of testClasses) {
              await prisma.academicClass.delete({ where: { id: c.id } }).catch(() => {});
            }

            // Delete ONLY test subjects (name or code contains 'test') — NEVER all subjects
            const testSubjects = await prisma.subject.findMany({
              where: {
                tenantId: t.id,
                OR: [
                  { name: { contains: 'test', mode: 'insensitive' } },
                  { code: { contains: 'test', mode: 'insensitive' } },
                ],
              },
              select: { id: true },
            });
            const deletedSubjects = testSubjects.length > 0
              ? await prisma.subject.deleteMany({ where: { id: { in: testSubjects.map(s => s.id) } } })
              : { count: 0 };

            // Delete test rooms (roomName or roomCode contains 'test')
            const testRooms = await prisma.room.findMany({
              where: {
                tenantId: t.id,
                OR: [
                  { roomName: { contains: 'test', mode: 'insensitive' } },
                  { roomCode: { contains: 'test', mode: 'insensitive' } },
                ],
              },
              select: { id: true, roomName: true },
            });
            for (const r of testRooms) {
              await prisma.room.delete({ where: { id: r.id } }).catch(() => {});
            }

            const total = testLevels.length + testCycles.length + testClasses.length + deletedSubjects.count + testRooms.length;
            if (total > 0) {
              logger.log(`[${t.name}] DEV cleanup: ${testLevels.length} levels, ${testCycles.length} cycles, ${testClasses.length} classes, ${deletedSubjects.count} subjects, ${testRooms.length} rooms deleted`);
            }
          } catch (err: any) {
            logger.warn(`[${t.name}] DEV cleanup failed: ${err.message}`);
          }
        }
      } catch (err: any) {
        logger.warn(`DEV cleanup skipped: ${err.message}`);
      }
    }, 8000); // 8 second delay (after teacher sync)
  } else {
    logger.log('DEV cleanup disabled (production-safe mode). Set ENABLE_DEV_CLEANUP=true & NODE_ENV!=production to enable.');
  }

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
    const maxHeapMB = parseInt(process.env.MAX_HEAP_MB ?? '1536', 10); // matches --max-old-space-size
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

