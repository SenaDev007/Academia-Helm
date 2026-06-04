import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * PrismaService avec optimisations de performance
 * 
 * - Connection pooling configuré via DATABASE_URL
 * - Logging des requêtes lentes en développement
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly skipDbCheck = process.env.SKIP_DB_CHECK === 'true';

  constructor(private configService?: ConfigService) {
    // Prisma 7.3.0: Configuration avec adapter PostgreSQL
    // Les URLs ne sont plus dans le schema.prisma, elles doivent être passées via l'adapter
    const databaseUrl = configService?.get<string>('DATABASE_URL') || process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required');
    }

    // Créer un pool PostgreSQL avec timeouts configurés
    // Neon DB et autres cloud providers exigent SSL — on l'active si le paramètre
    // sslmode est présent dans l'URL ou si NODE_ENV=production.
    const needsSsl = databaseUrl.includes('sslmode=') || process.env.NODE_ENV === 'production';
    const poolConfig: any = {
      connectionString: databaseUrl,
      max: 10,                        // Max 10 connections in pool
      idleTimeoutMillis: 30000,       // Close idle connections after 30s
      connectionTimeoutMillis: 10000, // Fail fast if DB unreachable (10s)
    };
    if (needsSsl) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }
    const pool = new Pool(poolConfig);
    const adapter = new PrismaPg(pool);

    const prismaOptions: any = {
      adapter: adapter,
      log: process.env.NODE_ENV === 'development' && process.env.PRISMA_LOG === 'true'
        ? ['query', 'error', 'warn'] 
        : ['error'], // ✅ Réduire les logs Prisma pour accélérer
      errorFormat: 'pretty',
    };

    super(prismaOptions);

    // Prisma 7: Les middlewares $use n'existent plus
    // Le logging des requêtes lentes est géré via les options de log de Prisma
    // Si besoin de logging personnalisé, utiliser des Client Extensions (voir documentation Prisma 7)

    // ✅ Connection will be warmed up in onModuleInit()
  }

  async onModuleInit() {
    if (this.skipDbCheck) {
      this.logger.log('⏭️  SKIP_DB_CHECK=true — skipping Prisma connection warmup');
      return;
    }
    try {
      const start = Date.now();
      await this.$connect();
      const elapsed = Date.now() - start;
      this.logger.log(`✅ Prisma connected in ${elapsed}ms`);
    } catch (error) {
      this.logger.error('❌ Prisma connection failed on init:', error?.message || error);
      // Don't crash — let requests fail individually with proper error messages
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('✅ Prisma disconnected');
  }
}
