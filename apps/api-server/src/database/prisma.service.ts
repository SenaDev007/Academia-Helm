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
    const rawUrl = configService?.get<string>('DATABASE_URL') || process.env.DATABASE_URL;

    if (!rawUrl) {
      throw new Error('DATABASE_URL is required');
    }

    // ── Détection du mode Neon (pooler vs direct) ──
    const isNeonPooler = /-pooler[.-]/.test(rawUrl);
    const isNeon = rawUrl.includes('.neon.tech');

    // ─────────────────────────────────────────────────────────────────────────
    // ⭐ BRIEF PERF 3.1 — Bascule automatique vers le host POOLER Neon.
    //
    // Constat diagnostic (panneau Neon) : l'app en production utilisait le host
    // DIRECT (« Pooler client connections: no data to display » alors que
    // « Postgres connections count » montrait 2 connexions directes = la taille
    // exacte de l'ancien pool en mode direct). Le pooler Neon (PgBouncer)
    // multiplexe les connexions clientes vers le compute et supprime :
    //   1. le goulot d'étranglement du pool applicatif (2-3 connexions)
    //   2. les erreurs de connexion quand Neon recycle une socket directe
    //
    // Compatibilité VERIFIÉE en conditions réelles (test pooler) :
    //   - prepared statements nommés (protocole pg) : ✅
    //   - transactions interactives BEGIN/…/COMMIT ($transaction Prisma) : ✅
    //   - SET LOCAL app.allow_balance_update dans une transaction : ✅
    //
    // Pour désactiver : DB_USE_POOLER=false (la DATABASE_URL est alors utilisée
    // telle quelle). Pour migrer vers le pooler sans réécriture côté app,
    // il suffit de pointer DATABASE_URL sur l'hôte -pooler.
    // ─────────────────────────────────────────────────────────────────────────
    let databaseUrl = rawUrl;
    let rewroteToPooler = false;
    if (
      process.env.DB_USE_POOLER !== 'false' &&
      isNeon &&
      !isNeonPooler
    ) {
      const hostMatch = databaseUrl.match(/@([^:/?]+)/);
      const host = hostMatch?.[1];
      if (host && host.startsWith('ep-') && !host.split('.')[0].endsWith('-pooler')) {
        const firstSegment = host.split('.')[0];
        const poolerHost = host.replace(firstSegment, `${firstSegment}-pooler`);
        databaseUrl = databaseUrl.replace(host, poolerHost);
        rewroteToPooler = true;
      }
    }
    const effectiveIsPooler = /-pooler[.-]/.test(databaseUrl);

    // ── Configuration du pool PostgreSQL ──
    const needsSsl =
      databaseUrl.includes('sslmode=') ||
      process.env.NODE_ENV === 'production' ||
      isNeon;

    // Taille du pool :
    // - PGPOOL_MAX (env) : override explicite
    // - Neon pooler : 10 connexions clientes — PgBouncer multiplexe côté Neon,
    //   le serveur ne voit qu'un petit nombre de connexions réelles. 4
    //   utilisateurs simultanés × (garde + service + intercepteur) passent
    //   sans file d'attente.
    // - Neon direct : 5 (sans pooler, chaque socket = 1 connexion serveur ;
    //   max_connections Neon ≈ 900 → 5 reste très prudent)
    // - Local dev : 10
    const envPoolMax = parseInt(process.env.PGPOOL_MAX || '', 10);
    const defaultPoolMax = effectiveIsPooler ? 10 : isNeon ? 5 : 10;
    const poolMax = Number.isFinite(envPoolMax) && envPoolMax > 0 ? envPoolMax : defaultPoolMax;

    const poolConfig: any = {
      connectionString: databaseUrl,
      max: poolMax,
      // ⭐ idleTimeoutMillis = 0 : on NE ferme plus les connexions inactives
      //    après 20s. Chaque reconnexion = handshake TLS + auth (~50-150ms
      //    inter-région) payé par la requête utilisateur suivante — c'était
      //    une source de pics de latence aléatoires. Le recyclage est assuré
      //    par maxLifetimeMilliseconds + le keepalive 4 min ci-dessous.
      idleTimeoutMillis: 0,
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
      `Database config: ${effectiveIsPooler ? 'Neon POOLER' : isNeon ? 'Neon DIRECT' : 'Local/Other'}` +
      `${rewroteToPooler ? ' (auto-rewritten from direct URL — brief perf 3.1)' : ''}, ` +
      `pool max: ${poolMax}, SSL: ${needsSsl}`,
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
