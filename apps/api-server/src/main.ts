import { NestFactory } from '@nestjs/core';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });

  app.enableCors({
    origin: [
      'https://academiahelm.com',
      'https://www.academiahelm.com',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'x-tenant-id', 'Cookie'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
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

