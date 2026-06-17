import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * PrismaService avec optimisations de performance V2
 *
 * - Connection pooling : utilise DATABASE_URL tel quel (si pooler configuré, ça passe par le pooler)
 * - Pool size adapté au mode (auto-detect pooler vs direct)
 * - Logging des requêtes lentes (> 500ms) via Prisma Client Extension
 * - Fire-and-forget warmup pour éviter de bloquer le bootstrap
 *
 * ⚠️ Pour utiliser le Neon pooler, configurez DATABASE_URL directement
 *     vers l'URL du pooler (ex: ep-xxx-pooler.region.aws.neon.tech).
 *     N'ajoutez PAS pgbouncer=true — Prisma avec @prisma/adapter-pg
 *     utilise des connexions directes, pas le mode transaction PgBouncer.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly skipDbCheck = process.env.SKIP_DB_CHECK === 'true';

  constructor(private configService?: ConfigService) {
    const databaseUrl = configService?.get<string>('DATABASE_URL') || process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required');
    }

    // ── Détection du mode Neon (pooler vs direct) pour le pool size ──
    // On NE MODIFIE PAS l'URL — l'utilisateur la configure comme il veut.
    // On détecte juste si c'est un pooler pour ajuster le pool size.
    const isNeonPooler = /-pooler[.-]/.test(databaseUrl);
    const isNeon = databaseUrl.includes('.neon.tech');

    // ── Configuration du pool PostgreSQL ──
    const needsSsl =
      databaseUrl.includes('sslmode=') ||
      process.env.NODE_ENV === 'production' ||
      isNeon;

    // Taille du pool adaptée au mode
    // - Neon pooler : 3 connexions (suffisant, le pooler multiplexe vers Neon)
    // - Neon direct : 3 connexions (Neon free tier = limité)
    // - Local dev : 3 connexions
    // ⚠️ Réduit à 3 pour limiter la consommation mémoire sur Fly.io 512MB.
    //    Chaque connexion PostgreSQL consomme ~5-10MB de RAM.
    //    3 connexions × ~7MB = ~21MB (au lieu de 70MB avec 10 connexions).
    const poolMax = isNeonPooler ? 3 : isNeon ? 3 : 3;

    const poolConfig: any = {
      connectionString: databaseUrl,
      max: poolMax,
      idleTimeoutMillis: 30000,       // Close idle connections after 30s
      connectionTimeoutMillis: 10000,  // Fail fast if DB unreachable (10s)
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
        : ['error'],
      errorFormat: 'pretty',
    };

    super(prismaOptions);

    // Stocker le pool pour onModuleDestroy
    (this as any).__pool = pool;

    this.logger.log(
      `Database config: ${isNeonPooler ? 'Neon POOLER' : isNeon ? 'Neon DIRECT' : 'Local/Other'}, pool max: ${poolMax}, SSL: ${needsSsl}`,
    );

    // ── Slow query logging via Client Extension ──
    const SLOW_QUERY_THRESHOLD = parseInt(process.env.SLOW_QUERY_THRESHOLD || '500', 10);

    if (SLOW_QUERY_THRESHOLD > 0) {
      try {
        const startTimeMap = new Map<string, number>();
        this.$extends({
          query: {
            async $allOperations({ operation, model, args, query }) {
              const key = `${model}:${operation}:${Date.now()}:${Math.random()}`;
              startTimeMap.set(key, Date.now());
              try {
                const result = await query(args);
                const elapsed = Date.now() - (startTimeMap.get(key) || Date.now());
                startTimeMap.delete(key);
                if (elapsed > SLOW_QUERY_THRESHOLD) {
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
      } catch (extError) {
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
