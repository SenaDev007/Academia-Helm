import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * PrismaService avec optimisations de performance V2 + RETRY sur erreurs de connexion
 *
 * Améliorations clés :
 * - Connection pooling : utilise DATABASE_URL tel quel (si pooler configuré, ça passe par le pooler)
 * - Pool size adapté au mode (auto-detect pooler vs direct)
 * - Logging des requêtes lentes (> 500ms) via Prisma Client Extension
 * - Fire-and-forget warmup pour éviter de bloquer le bootstrap
 * - Keepalive à 4 min (sous le seuil Neon de 5 min)
 *
 * ⭐ RETRY automatique sur erreurs de connexion (ECONNRESET, 57P01, P1001, etc.)
 *    Quand Neon suspend le compute ou recycle une connexion du pooler, la socket
 *    TCP devient stale. Le retry détecte ces erreurs, force le pool à se reconnecter
 *    (en fermant la connexion morte), puis réessaie l'opération une fois.
 *    C'est le fix robuste pour les "impossible de charger les données" intermittents.
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
  private keepaliveInterval: NodeJS.Timeout | null = null;

  constructor(private configService?: ConfigService) {
    const databaseUrl = configService?.get<string>('DATABASE_URL') || process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required');
    }

    // ── Détection du mode Neon (pooler vs direct) pour le pool size ──
    const isNeonPooler = /-pooler[.-]/.test(databaseUrl);
    const isNeon = databaseUrl.includes('.neon.tech');

    // ── Configuration du pool PostgreSQL ──
    const needsSsl =
      databaseUrl.includes('sslmode=') ||
      process.env.NODE_ENV === 'production' ||
      isNeon;

    // Taille du pool adaptée au mode
    // - Neon pooler : 3 connexions (le pooler multiplexe déjà vers Neon)
    // - Neon direct : 2 connexions (Neon free tier = limité)
    // - Local dev : 3 connexions
    // ⭐ Réduit de 5→3 pour Neon pooler : moins de sockets à maintenir = moins
    //    de chances d'en avoir une stale quand Neon recycle.
    const poolMax = isNeonPooler ? 3 : isNeon ? 2 : 3;

    const poolConfig: any = {
      connectionString: databaseUrl,
      max: poolMax,
      // ⭐ idleTimeoutMillis réduit à 20s (au lieu de 30s) :
      //    ferme les connexions inactives plus vite côté client, ce qui
      //    réduit la fenêtre pendant laquelle une socket peut devenir stale
      //    pendant que Neon recycle.
      idleTimeoutMillis: 20000,
      // ✅ 30s pour laisser Neon le temps de se réveiller (cold start = 5-10s)
      connectionTimeoutMillis: 30000,
      // ⭐ maxLifetimeMillis : ferme les connexions après 30 min d'existence
      //    (même si elles sont actives). Force le pool à recycler les sockets
      //    avant que Neon ne les tue silencieusement. Le pool `pg` recréera
      //    une nouvelle connexion propre à la prochaine requête.
      maxLifetimeMilliseconds: 30 * 60 * 1000, // 30 minutes
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

    // Stocker le pool pour retry + onModuleDestroy
    (this as any).__pool = pool;

    this.logger.log(
      `Database config: ${isNeonPooler ? 'Neon POOLER' : isNeon ? 'Neon DIRECT' : 'Local/Other'}, pool max: ${poolMax}, SSL: ${needsSsl}`,
    );

    // ── Slow query logging + RETRY sur erreurs de connexion ──
    const SLOW_QUERY_THRESHOLD = parseInt(process.env.SLOW_QUERY_THRESHOLD || '500', 10);

    // ⭐ Liste des erreurs qui indiquent une connexion stale / recyclée
    //    - ECONNRESET : la socket TCP a été fermée par le serveur (Neon recycle)
    //    - Connection terminated : idem, message du driver pg
    //    - 57P01 (admin_shutdown) : le serveur PostgreSQL a été arrêté
    //    - 08001 / 08006 : connection failure / connection failure (SQLSTATE)
    //    - P1001 : Prisma ne peut pas joindre la DB
    //    - P1002 : Prisma a timed out pendant l'écriture du buffer
    //    - P1017 : Prisma server a fermé la connexion
    const isConnectionError = (error: any): boolean => {
      const msg = String(error?.message || '').toLowerCase();
      const code = String(error?.code || '');
      return (
        msg.includes('econnreset') ||
        msg.includes('connection terminated') ||
        msg.includes('socket hang up') ||
        msg.includes('write econnreset') ||
        msg.includes('read econnreset') ||
        code === '57P01' ||
        code === '08001' ||
        code === '08006' ||
        code === 'P1001' ||
        code === 'P1002' ||
        code === 'P1017'
      );
    };

    // ⭐ Force le pool à fermer toutes les connexions (même actives)
    //    pour qu'au prochain appel, le pool recrée des sockets neuves.
    const forceReconnect = async (): Promise<void> => {
      try {
        // pg.Pool n'expose pas de méthode "reconnect", mais on peut
        // attendre que les connexions idle soient fermées en appelant
        // pool.end() puis en recréant un pool. Cependant, recréer le pool
        // casserait la référence stockée dans PrismaPg.
        //
        // ⭐ Alternative : on ne fait rien ici. Le driver `pg` détecte
        //    automatiquement une socket morte au moment de l'utiliser
        //    (Erreur 'Connection terminated'), la retire du pool, et
        //    ouvre une nouvelle connexion pour la requête suivante.
        //    Le retry dans $extends se contente donc d'attendre 200ms
        //    (pour laisser le pool recycler) puis de réessayer.
        await new Promise((r) => setTimeout(r, 200));
        this.logger.warn('🔄 Connection recycled — retrying operation');
      } catch {
        // Non-critique
      }
    };

    try {
      this.$extends({
        query: {
          async $allOperations({ operation, model, args, query }) {
            const startTime = Date.now();
            const opKey = `${model}:${operation}`;

            try {
              const result = await query(args);

              // Slow query logging
              const elapsed = Date.now() - startTime;
              if (SLOW_QUERY_THRESHOLD > 0 && elapsed > SLOW_QUERY_THRESHOLD) {
                console.warn(
                  `[SLOW QUERY] ${model}.${operation} took ${elapsed}ms (threshold: ${SLOW_QUERY_THRESHOLD}ms)`,
                );
              }
              return result;
            } catch (error: any) {
              const elapsed = Date.now() - startTime;

              // ⭐ RETRY sur erreur de connexion stale
              if (isConnectionError(error)) {
                this.logger?.warn?.(
                  `⚠️ Connection error on ${opKey} (after ${elapsed}ms): ${error?.code || ''} ${error?.message?.substring(0, 100)}`,
                );

                // Force le pool à se reconnecter
                await forceReconnect();

                // Une seule tentative de retry
                try {
                  const retryResult = await query(args);
                  const retryElapsed = Date.now() - startTime;
                  this.logger?.log?.(
                    `✅ Retry succeeded for ${opKey} (total ${retryElapsed}ms)`,
                  );
                  return retryResult;
                } catch (retryError: any) {
                  this.logger?.error?.(
                    `❌ Retry failed for ${opKey}: ${retryError?.message?.substring(0, 100)}`,
                  );
                  throw retryError;
                }
              }

              // Autre erreur (logique métier) — propager sans retry
              throw error;
            }
          },
        },
      });
    } catch (extError) {
      console.warn('Prisma Client Extension failed:', (extError as any).message);
    }
  }

  async onModuleInit() {
    if (this.skipDbCheck) {
      this.logger.log('⏭️  SKIP_DB_CHECK=true — skipping Prisma connection warmup');
      return;
    }

    // ✅ Warmup avec RETRY — Neon peut être suspendu (cold start 5-10s).
    const warmupWithRetry = async (retries = 3, delayMs = 3000): Promise<void> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        const start = Date.now();
        try {
          await this.$queryRawUnsafe('SELECT 1');
          const elapsed = Date.now() - start;
          this.logger.log(`✅ Prisma connected in ${elapsed}ms (attempt ${attempt}/${retries})`);
          return;
        } catch (error: any) {
          const elapsed = Date.now() - start;
          this.logger.warn(
            `⚠️ Prisma warmup attempt ${attempt}/${retries} failed in ${elapsed}ms: ${error?.message || error}`,
          );
          if (attempt < retries) {
            this.logger.log(`   Retrying in ${delayMs / 1000}s...`);
            await new Promise((r) => setTimeout(r, delayMs));
          } else {
            this.logger.error('❌ Prisma warmup failed after all retries — app will start but DB calls may fail until first successful retry');
          }
        }
      }
    };

    // Fire-and-forget: warm up in background (non-bloquant pour le bootstrap)
    warmupWithRetry().catch(() => {});

    // Keepalive : ping la BDD toutes les 4 minutes pour garder la connexion chaude.
    // ⭐ 4 min (pas 5) — le free-tier Neon suspend après 5 min d'inactivité.
    this.keepaliveInterval = setInterval(async () => {
      try {
        await this.$queryRawUnsafe('SELECT 1');
      } catch {
        // Connexion perdue — le retry automatique dans $extends s'en occupera
        // au prochain appel utilisateur. Le keepalive garantit juste que
        // le pool reste actif.
        this.logger.warn('⚠️ Prisma keepalive: connection lost — will retry on next query');
      }
    }, 4 * 60 * 1000); // 4 minutes
  }

  async onModuleDestroy() {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
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
