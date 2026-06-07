import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import express from 'express';
import serverlessExpress from '@codegenie/serverless-express';
import { AppModule } from '../src/app.module';
import { RolesPermissionsBootstrapService } from '../src/settings/services/roles-permissions-bootstrap.service';

/**
 * Vercel Serverless entrypoint.
 *
 * IMPORTANT:
 * - Ne pas faire `app.listen()` en serverless.
 * - Éviter les `execSync prisma migrate` au cold start (non fiable, lent, peut crash).
 * - CORS est géré par `FRONTEND_URL` ou l'en-tête côté Vercel.
 */

let cachedHandler: ReturnType<typeof serverlessExpress> | null = null;
let cachedInit: Promise<ReturnType<typeof serverlessExpress>> | null = null;

async function createHandler(): Promise<ReturnType<typeof serverlessExpress>> {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);

  const logger: ('log' | 'error' | 'warn' | 'debug' | 'verbose')[] =
    process.env.NODE_ENV === 'production'
      ? ['error', 'warn', 'log']
      : ['error', 'warn'];

  const app = await NestFactory.create(AppModule, adapter, {
    logger,
    rawBody: true,
  });

  // Limites body (aligné main.ts)
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS (serverless): garder la config runtime (évite hardcode)
  const frontendUrl = process.env.FRONTEND_URL;
  app.enableCors({
    origin: frontendUrl || '*',
    credentials: true,
  });

  // Bootstrap RBAC (best-effort, non bloquant)
  try {
    const rbacBootstrap = app.get(RolesPermissionsBootstrapService);
    await rbacBootstrap.ensurePermissionsAndRoles();
  } catch {}

  await app.init();

  return serverlessExpress({ app: expressApp });
}

export default async function handler(req: any, res: any) {
  if (cachedHandler) return cachedHandler(req, res);
  cachedInit ??= createHandler();
  cachedHandler = await cachedInit;
  return cachedHandler(req, res);
}

