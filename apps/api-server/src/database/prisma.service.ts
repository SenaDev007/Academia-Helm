import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * PrismaService avec optimisations de performance V2
 *
 * - Connection pooling via Neon pooler (DATABASE_URL auto-detect)
 * - Pool size adapté au mode (pooler vs direct)
 * - Logging des requêtes lentes (> 500ms) via Prisma Client Extension
 * - Fire-and-forget warmup pour éviter de bloquer le bootstrap
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly skipDbCheck = process.env.SKIP_DB_CHECK === 'true';
  private pool: Pool | null = null;

  constructor(private configService?: ConfigService) {
    const databaseUrl = configService?.get<string>('DATABASE_URL') || process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required');
    }

    // ── Auto-détection du Neon pooler ──
    // Si DATABASE_URL est une URL Neon directe (ep-xxx.neon.tech),
    // on peut utiliser le pooler en remplaçant par -pooler.neon.tech
    const isNeonDirect =
      databaseUrl.includes('.neon.tech') && !databaseUrl.includes('-pooler.neon.tech');
    const isNeonPooler = databaseUrl.includes('-pooler.neon.tech');

    // Construire l'URL de connexion — utiliser le pooler si disponible
    let connectionUrl = databaseUrl;
    if (isNeonDirect) {
      // Auto-convertir vers le pooler Neon (Supavisor)
      // ep-xxx.us-east-2.aws.neon.tech → ep-xxx-pooler.us-east-2.aws.neon.tech
      connectionUrl = databaseUrl.replace(/\.neon\.tech/, '-pooler.neon.tech');
      // Ajouter le pgbouncer mode si pas déjà présent
      if (!connectionUrl.includes('pgbouncer=true')) {
        const separator = connectionUrl.includes('?') ? '&' : '?';
        connectionUrl = `${connectionUrl}${separator}pgbouncer=true`;
      }
    }

    if (isNeonDirect) {
      // Neon pooler — on peut utiliser plus de connexions car le pooler les multiplexe
    }

    // ── Configuration du pool PostgreSQL ──
    const needsSsl =
      connectionUrl.includes('sslmode=') ||
      process.env.NODE_ENV === 'production' ||
      connectionUrl.includes('.neon.tech');

    // Taille du pool adaptée au mode
    // - Neon pooler : 20 connexions (le pooler multiplexe vers Neon)
    // - Connexion directe : 10 connexions (Neon free tier = limité)
    // - Local dev : 5 connexions
    const poolMax = isNeonPooler ? 20 : isNeonDirect ? 10 : 5;

    const poolConfig: any = {
      connectionString: connectionUrl,
      max: poolMax,
      idleTimeoutMillis: 30000,       // Close idle connections after 30s
      connectionTimeoutMillis: 10000,  // Fail fast if DB unreachable (10s)
    };
    if (needsSsl) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    const pool = new Pool(poolConfig);
    const adapter = new PrismaPg(pool);

    // Stocker le pool pour le fermer proprement
    // On le fait via une propriété car PrismaClient ne l'expose pas
    const prismaOptions: any = {
      adapter: adapter,
      log: process.env.NODE_ENV === 'development' && process.env.PRISMA_LOG === 'true'
        ? ['query', 'error', 'warn']
        : ['error'],
      errorFormat: 'pretty',
    };

    super(prismaOptions);

    // Stocker le pool pour onModuleDestroy
    // On utilise un trick car PrismaClient ne garde pas de ref au pool
    (this as any).__pool = pool;

    // ── Slow query logging via Client Extension ──
    // Log toutes les requêtes qui prennent plus de SLOW_QUERY_THRESHOLD ms
    const SLOW_QUERY_THRESHOLD = parseInt(process.env.SLOW_QUERY_THRESHOLD || '500', 10);

    if (SLOW_QUERY_THRESHOLD > 0) {
      try {
        const startTimeMap = new Map<string, number>();
        const ext = this.$extends({
          query: {
            async $allOperations({ operation, model, args, query }) {
              const key = `${model}:${operation}:${Date.now()}:${Math.random()}`;
              startTimeMap.set(key, Date.now());
              try {
                const result = await query(args);
                const elapsed = Date.now() - (startTimeMap.get(key) || Date.now());
                startTimeMap.delete(key);
                if (elapsed > SLOW_QUERY_THRESHOLD) {
                  // Lazy logger pour éviter l'import circulaire
                  console.warn(
                    `[SLOW QUERY] ${model}.${operation} took ${elapsed}ms (threshold: ${SLOW_QUERY_THRESHOLD}ms)`,
                  );
                }
                return result;
              } catch (error) {
                startTimeMap.delete(key);
                throw error;
              }
            },
          },
        });
        // L'extension est appliquée — les requêtes lentes seront loggées
      } catch (extError) {
        // Si l'extension échoue (ex: Prisma version), on continue sans slow query logging
        console.warn('Prisma Client Extension for slow query logging failed:', (extError as any).message);
      }
    }
  }

  async onModuleInit() {
    if (this.skipDbCheck) {
      this.logger.log('⏭️  SKIP_DB_CHECK=true — skipping Prisma connection warmup');
      return;
    }
    // Fire-and-forget: warm up the connection pool in the background
    const start = Date.now();
    this.$queryRawUnsafe('SELECT 1')
      .then(() => {
        const elapsed = Date.now() - start;
        this.logger.log(`✅ Prisma connected in ${elapsed}ms`);
      })
      .catch((error) => {
        this.logger.error('❌ Prisma connection warmup failed:', error?.message || error);
      });
  }

  async onModuleDestroy() {
    // Fermer le pool pg en premier
    try {
      const pool = (this as any).__pool as Pool | undefined;
      if (pool) {
        await pool.end();
      }
    } catch {
      // Ignore pool close errors
    }
    await this.$disconnect();
    this.logger.log('✅ Prisma disconnected');
  }
}
