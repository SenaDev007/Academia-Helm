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
  const logger = process.env.NODE_ENV === 'production'
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
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS configuration
  // ⚠️ IMPORTANT : Ne jamais utiliser localhost en dur
  // FRONTEND_URL doit être défini dans les variables d'environnement
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    console.warn('⚠️  FRONTEND_URL not set. CORS may not work correctly in production.');
  }

  app.enableCors({
    origin: frontendUrl || '*', // En développement uniquement, utiliser * si non défini
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

  const port = process.env.PORT || 3000;
  // Écouter sur toutes les interfaces (0.0.0.0) pour permettre les connexions depuis Next.js
  await app.listen(port, '0.0.0.0');

  // Logger l'URL sans hardcoder localhost
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const host = process.env.HOST || 'localhost';
  console.log(`🚀 Academia Helm API Server is running on: ${protocol}://${host}:${port}/api`);
}

bootstrap();

