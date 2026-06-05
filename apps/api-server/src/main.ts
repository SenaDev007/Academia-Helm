import { NestFactory } from '@nestjs/core';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { PrismaService } from './database/prisma.service';

/** Défaut Express ~100 ko — insuffisant pour identité + logos base64 (POST /settings/identity).
 *  Réduit de 10mb à 5mb pour limiter la consommation mémoire par requête.
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
      disableErrorMessages: process.env.NODE_ENV === 'production',
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

