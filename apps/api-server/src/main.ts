import { NestFactory } from '@nestjs/core';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

/** Défaut Express ~100 ko — insuffisant pour identité + logos base64 (POST /settings/identity). */
const BODY_LIMIT = process.env.JSON_BODY_LIMIT ?? '10mb';

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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'x-tenant-id', 'Cookie'],
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
  await app.listen(port, '0.0.0.0');
  logger.log(`Academia Helm API listening on http://0.0.0.0:${port} (PORT=${process.env.PORT ?? 'unset'})`);
}
bootstrap();

