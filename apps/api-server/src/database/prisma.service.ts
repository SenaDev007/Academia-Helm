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
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly skipDbCheck = process.env.SKIP_DB_CHECK === 'true';

  constructor(private configService?: ConfigService) {
    // Prisma 7.3.0: Configuration avec adapter PostgreSQL
    // Les URLs ne sont plus dans le schema.prisma, elles doivent être passées via l'adapter
    const databaseUrl = configService?.get<string>('DATABASE_URL') || process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required');
    }

    // Créer un pool PostgreSQL
    const pool = new Pool({ connectionString: databaseUrl });
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

    // ✅ En mode SKIP_DB_CHECK, on ne fait RIEN au démarrage (vraiment lazy)
    // Prisma se connectera automatiquement à la première requête
    // Pas de log, pas d'initialisation, rien du tout
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('✅ Prisma disconnected');
  }
}
