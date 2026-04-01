import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { execSync } from 'child_process';
import { join } from 'path';
import { AppModule } from './app.module';
import { RolesPermissionsBootstrapService } from './settings/services/roles-permissions-bootstrap.service';

async function bootstrap() {
  // ✅ Migrations dynamiques et automatiques au démarrage : applique les migrations en attente puis génère le client
  const apiRoot = join(__dirname, '..');
  const stdioMode = process.env.NODE_ENV === 'production' ? 'pipe' : 'inherit';
  const prismaSchema = 'prisma/schema.prisma';
  try {
    execSync(`npx prisma migrate deploy --schema=${prismaSchema}`, {
      cwd: apiRoot,
      stdio: stdioMode,
    });
    if (process.env.NODE_ENV === 'production') {
      console.log('✅ Migrations appliquées (dynamique et automatique)');
    }
  } catch (migrateErr) {
    try {
      execSync(`npx prisma db push --schema=${prismaSchema}`, {
        cwd: apiRoot,
        stdio: stdioMode,
      });
    } catch {
      console.warn('⚠️  Migrations / db push (ignorable si BDD indisponible):', (migrateErr as Error)?.message);
    }
  }
  try {
    execSync(`npx prisma generate --schema=${prismaSchema}`, {
      cwd: apiRoot,
      stdio: stdioMode,
    });
  } catch (genErr) {
    console.warn('⚠️  Prisma generate (ignorable):', (genErr as Error)?.message);
  }

  // ✅ Optimisation : Désactiver les logs de démarrage en développement pour accélérer
  const logger: ('log' | 'error' | 'warn' | 'debug' | 'verbose')[] =
    process.env.NODE_ENV === 'production'
      ? ['error', 'warn', 'log']
      : ['error', 'warn'];

  const app = await NestFactory.create(AppModule, {
    logger, // ✅ Réduire les logs pour accélérer le démarrage
    rawBody: true, // ✅ Nécessaire pour vérifier la signature des webhooks FedaPay (body brut)
  });

  // ✅ Augmenter la limite de taille du body pour les uploads d'images en base64
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: ['https://academiahelm.com', 'https://www.academiahelm.com'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // ✅ Bootstrap RBAC avant listen : colonnes roles (allowedLevelIds, canAccessOrion, canAccessAtlas) + permissions/rôles
  try {
    const rbacBootstrap = app.get(RolesPermissionsBootstrapService);
    await rbacBootstrap.ensurePermissionsAndRoles();
  } catch (err) {
    console.warn('⚠️  Bootstrap RBAC en échec (paramètres → rôles peuvent être vides):', (err as Error)?.message);
  }

  // ✅ Triggers SQL Module 1 (élèves) : appliqués automatiquement au démarrage (idempotent)
  try {
    const { DatabaseTriggersBootstrapService } = await import('./database/database-triggers-bootstrap.service');
    const triggersBootstrap = app.get(DatabaseTriggersBootstrapService);
    await triggersBootstrap.runModule1Triggers();
  } catch (err) {
    console.warn('⚠️  Triggers Module 1 (non bloquant):', (err as Error)?.message);
  }

  // ⚠️ CRITIQUE pour Fly.io — ne jamais changer
  await app.listen(process.env.PORT || 3000, '0.0.0.0');
  console.log(`Academia Helm API démarrée sur le port ${process.env.PORT || 3000}`);
}

bootstrap();

