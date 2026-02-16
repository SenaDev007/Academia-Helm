import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // ✅ Optimisation : Désactiver les logs de démarrage en développement pour accélérer
  const logger = process.env.NODE_ENV === 'production' 
    ? ['error', 'warn', 'log'] 
    : ['error', 'warn'];
  
  const app = await NestFactory.create(AppModule, {
    logger, // ✅ Réduire les logs pour accélérer le démarrage
    rawBody: true, // ✅ Nécessaire pour vérifier la signature des webhooks FedaPay (body brut)
  });

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

  const port = process.env.PORT || 3000;
  // Écouter sur toutes les interfaces (0.0.0.0) pour permettre les connexions depuis Next.js
  await app.listen(port, '0.0.0.0');

  // Logger l'URL sans hardcoder localhost
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const host = process.env.HOST || 'localhost';
  console.log(`🚀 Academia Hub API Server is running on: ${protocol}://${host}:${port}/api`);
}

bootstrap();

