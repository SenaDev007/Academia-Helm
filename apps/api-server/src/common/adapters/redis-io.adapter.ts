import { INestApplication, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server as HttpServer } from 'http';
import { Server, ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

/**
 * ============================================================================
 * ADAPTER REDIS POUR SOCKET.IO — PRÉPARATION MULTI-RÉPLICAS (100 ÉCOLES)
 * ============================================================================
 *
 * ⭐ CAPACITÉ 20/50/100 ÉCOLES (cf. CAPACITE-20-50-100-ECOLES.md §5) :
 *
 * Aujourd'hui (1 instance Railway), la gateway Helm Connect (`/chat`) garde
 * ses rooms et son état en mémoire — tout fonctionne. Le jour où l'api-server
 * tournera en 2-3 réplicas (palier 100 écoles = 2 000 utilisateurs), chaque
 * réplique aurait SON état isolé : un message émis via la réplique A
 * n'atteindrait JAMAIS les sockets connectés à la réplique B.
 *
 * L'adapter Redis (@socket.io/redis-adapter) résout exactement ça :
 *   - les rooms (`user:<id>`, `conv:<id>`, `tenant:<id>`) sont enregistrées
 *     dans Redis → `server.to(room).emit()` traverse les réplicas ;
 *   - le pub/sub Redis relaie chaque broadcast à toutes les répliques.
 *
 * La gateway est déjà 100 % compatible (tous les émissions passent par des
 * rooms — pattern vérifié) et le client est en `transports: ['websocket']`
 * uniquement → PAS de sticky sessions nécessaires (le handshake polling
 * HTTP de Socket.io est déjà exclu côté client).
 *
 * ⚠️ ACTIVATION TOTALEMENT GRACIEUSE (fail-open) :
 *   - `REDIS_URL` NON défini (situation actuelle) → RIEN ne change :
 *     l'adapter in-memory standard est utilisé, aucune connexion Redis.
 *   - `REDIS_URL` défini → connexion au boot (timeout
 *     REDIS_CONNECT_TIMEOUT_MS, 15 s par défaut) :
 *       • succès → adapter Redis actif (mono-instance ou multi-réplicas) ;
 *       • échec → FALLBACK in-memory + WARN explicite (l'app démarre quand
 *         même — en mono-instance le chat reste 100 % fonctionnel ; en
 *         multi-réplicas le cross-réplica serait dégradé jusqu'au
 *         redéploiement, d'où le log bien visible).
 *   - `REDIS_ADAPTER_STRICT=true` → inverse le fallback : crash au boot si
 *     Redis est indisponible (à activer le jour du multi-réplicas pour ne
 *     jamais servir en mode dégradé silencieux).
 *   - `USE_REDIS_ADAPTER=false` → kill switch (REDIS_URL défini mais
 *     adapter désactivé, pour isoler un diagnostic).
 *
 * Sur Railway : ajouter le plugin Redis au projet → variable REDIS_URL
 * (format `redis://default:<password>@<host>:<port>`) → redéployer.
 */

/** Logger partagé (factory + adapter). */
const logger = new Logger('RedisIoAdapter');

/**
 * Adapter Socket.io branché sur Redis.
 *
 * `createIOServer` est appelé par NestJS pour CHAQUE server de gateway créé
 * (une fois par @WebSocketGateway) — on attache l'adapter Redis à chacun.
 * La factory `adapterFactory()` crée une instance d'adapter par server en
 * réutilisant la même paire de connexions pub/sub (usage documenté du
 * package @socket.io/redis-adapter).
 */
export class RedisIoAdapter extends IoAdapter {
  constructor(
    app: INestApplication | HttpServer,
    private readonly adapterFactory: () => ReturnType<typeof createAdapter>,
  ) {
    super(app);
  }

  createIOServer(
    port: number,
    options?: ServerOptions & { namespace?: string },
  ): any {
    const server: Server = super.createIOServer(port, options);
    try {
      server.adapter(this.adapterFactory());
      logger.log(
        `🔌 Socket.io Redis adapter attaché (server ${port === 0 ? 'http principal' : `port ${port}`}${options?.namespace ? `, ns ${options.namespace}` : ''})`,
      );
    } catch (e: any) {
      // Ne doit jamais bloquer le boot : adapter par défaut (in-memory).
      logger.error(`Attache de l'adapter Redis échouée: ${e?.message}`);
    }
    return server;
  }
}

/**
 * Fabrique l'adapter WebSocket adapté à la configuration :
 * Redis (si REDIS_URL) avec fallback gracieux, sinon in-memory.
 *
 * Appelée une seule fois dans main.ts, AVANT app.listen() — le délai de
 * connexion éventuel (≤ 15 s si Redis est indisponible) reste très en deçà
 * de la grace period du healthcheck Railway (300 s).
 */
export async function createWebSocketAdapter(
  app: INestApplication | HttpServer,
): Promise<IoAdapter> {
  const redisUrl = process.env.REDIS_URL;
  const useRedis =
    !!redisUrl && process.env.USE_REDIS_ADAPTER !== 'false';

  // ── Mode in-memory (situation actuelle : 1 instance, pas de Redis) ──
  if (!useRedis) {
    logger.log(
      `WebSocket adapter: IN-MEMORY${redisUrl ? ' (USE_REDIS_ADAPTER=false)' : ' (REDIS_URL non défini)'} — multi-réplicas chat non supporté (mono-instance: nominal)`,
    );
    return new IoAdapter(app);
  }

  // ── Connexion Redis (pub + sub) avec timeout borné ──
  const connectTimeoutMs = parseInt(
    process.env.REDIS_CONNECT_TIMEOUT_MS || '15000',
    10,
  );

  const baseOptions = {
    lazyConnect: true, // on contrôle la connexion (timeout + fallback)
    // Ne jamais bufferiser indéfiniment : si Redis tombe au runtime, les
    // broadcasts échouent/loggent au lieu de gonfler la mémoire.
    enableOfflineQueue: false,
    // Chaque commande échoue après 1 retry (pas de pile de commandes zombies).
    maxRetriesPerRequest: 1,
    connectTimeout: connectTimeoutMs,
  };

  const pubClient = new Redis(redisUrl, baseOptions);
  const subClient = pubClient.duplicate();

  // Handlers d'erreur posés AVANT connect() : pendant la fenêtre de
  // tentative (Redis down), ioredis émet sinon des « Unhandled error
  // event » bruyants dans les logs — le rejet est déjà capté par la
  // promesse connectWithTimeout ci-dessous, on ne fait que le taire
  // proprement et le tracer côté runtime (reconnexions automatiques).
  pubClient.on('error', (e) =>
    logger.warn(`Redis pub erreur: ${e?.message || e}`),
  );
  subClient.on('error', (e) =>
    logger.warn(`Redis sub erreur: ${e?.message || e}`),
  );

  /** Connecte un client avec timeout externe (ioredis retry indéfiniment sinon). */
  const connectWithTimeout = (client: Redis, label: string): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`${label}: timeout ${connectTimeoutMs} ms`)),
        connectTimeoutMs,
      );
      client
        .connect()
        .then(() => {
          clearTimeout(timer);
          resolve();
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error(String(err)));
        });
    });

  try {
    await Promise.all([
      connectWithTimeout(pubClient, 'pubClient'),
      connectWithTimeout(subClient, 'subClient'),
    ]);

    logger.log(`✅ WebSocket adapter: REDIS (${redisUrl.replace(/:[^:@/]+@/, ':***@')}) — multi-réplicas Helm Connect PRÊT`);

    return new RedisIoAdapter(app, () => createAdapter(pubClient, subClient));
  } catch (err: any) {
    // ── Fallback in-memory (fail-open) ──
    try {
      pubClient.disconnect();
      subClient.disconnect();
    } catch {
      /* déjà morts — ignorer */
    }

    const message = `Redis indisponible (${err?.message || err}) — FALLBACK adapter in-memory`;
    if (process.env.REDIS_ADAPTER_STRICT === 'true') {
      // Mode strict (multi-réplicas) : ne jamais servir en mode dégradé
      // silencieux — on préfère crasher et laisser Railway redémarrer
      // (healthcheck) jusqu'au retour de Redis.
      logger.error(`${message} — REDIS_ADAPTER_STRICT=true → arrêt du démarrage`);
      throw err instanceof Error ? err : new Error(String(err));
    }

    logger.warn(
      `${message} — mono-instance: chat 100 % fonctionnel ; multi-réplicas: cross-réplica dégradé jusqu'au redéploiement. Vérifier REDIS_URL.`,
    );
    return new IoAdapter(app);
  }
}
