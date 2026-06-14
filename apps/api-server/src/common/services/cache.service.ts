/**
 * ============================================================================
 * REDIS CACHE SERVICE - CACHE DISTRIBUÉ VIA UPSTASH REDIS
 * ============================================================================
 *
 * Remplace l'ancien CacheService (in-memory) par un cache distribué Redis.
 *
 * Avantages :
 *   - Partagé entre toutes les instances (multi-pod Railway)
 *   - Survit aux redémarrages de l'application
 *   - Invalidation inter-processus possible
 *   - TTL natif Redis (pas de cleanup manuel)
 *
 * Fallback automatique :
 *   - Si UPSTASH_REDIS_REST_URL n'est pas configuré → utilise le cache en mémoire
 *   - Si Redis est temporairement indisponible → fallback en mémoire
 *
 * API compatible avec l'ancien CacheService (get/set/invalidate/invalidatePattern/clear)
 * ============================================================================
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// ── Interface commune pour les deux backends ──
interface CacheBackend {
  get<T>(key: string): Promise<T | null>;
  set(key: string, data: any, ttlMs: number): Promise<void>;
  invalidate(key: string): Promise<void>;
  invalidatePattern(pattern: string): Promise<void>;
  clear(): Promise<void>;
  size(): Promise<number>;
}

// ============================================================================
// BACKEND : Upstash Redis (production)
// ============================================================================
class RedisBackend implements CacheBackend {
  private readonly logger = new Logger('RedisBackend');
  private redis: any;

  constructor(redisUrl: string, redisToken: string) {
    // Import dynamique pour éviter les erreurs si @upstash/redis n'est pas installé
    try {
      const { Redis } = require('@upstash/redis');
      this.redis = new Redis({
        url: redisUrl,
        token: redisToken,
      });
      this.logger.log('✅ Redis backend initialized');
    } catch (error: any) {
      throw new Error(`Failed to initialize Redis: ${error.message}`);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      return data as T | null;
    } catch (error: any) {
      this.logger.warn(`Redis GET failed for key "${key}": ${error.message}`);
      return null;
    }
  }

  async set(key: string, data: any, ttlMs: number): Promise<void> {
    try {
      // Upstash Redis attend le TTL en secondes
      const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
      await this.redis.set(key, JSON.stringify(data), { ex: ttlSec });
    } catch (error: any) {
      this.logger.warn(`Redis SET failed for key "${key}": ${error.message}`);
    }
  }

  async invalidate(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error: any) {
      this.logger.warn(`Redis DEL failed for key "${key}": ${error.message}`);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // Convertir un pattern regex simple en pattern Redis KEYS
      // Ex: "user:roles:.*" → "user:roles:*"
      const redisPattern = pattern
        .replace(/\.\*/g, '*')
        .replace(/\./g, '?');

      // Utiliser SCAN au lieu de KEYS pour la production (non-bloquant)
      let cursor = '0';
      let deleted = 0;
      do {
        const result = await this.redis.scan(cursor, { match: redisPattern, count: 100 });
        cursor = result[0];
        const keys = result[1];
        if (keys.length > 0) {
          await this.redis.del(...keys);
          deleted += keys.length;
        }
      } while (cursor !== '0');

      if (deleted > 0) {
        this.logger.debug(`Invalidated ${deleted} keys matching pattern "${pattern}"`);
      }
    } catch (error: any) {
      this.logger.warn(`Redis invalidation pattern "${pattern}" failed: ${error.message}`);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushdb();
    } catch (error: any) {
      this.logger.warn(`Redis FLUSHDB failed: ${error.message}`);
    }
  }

  async size(): Promise<number> {
    try {
      return await this.redis.dbsize();
    } catch {
      return -1;
    }
  }
}

// ============================================================================
// BACKEND : In-memory (fallback / développement)
// ============================================================================
class InMemoryBackend implements CacheBackend {
  private cache = new Map<string, { data: any; expiresAt: number }>();
  private readonly MAX_SIZE = 500;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly logger = new Logger('InMemoryBackend');

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    this.logger.log('📦 In-memory cache backend initialized (fallback)');
  }

  async get<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return cached.data as T;
  }

  async set(key: string, data: any, ttlMs: number): Promise<void> {
    if (!this.cache.has(key) && this.cache.size >= this.MAX_SIZE) {
      this.evictOldest();
    }
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async invalidate(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  private evictOldest(): void {
    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// ============================================================================
// SERVICE PRINCIPAL — Sélectionne le backend automatiquement
// ============================================================================
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private backend: CacheBackend;
  private inMemoryFallback: InMemoryBackend | null = null;

  /** TTL par défaut : 5 minutes */
  private readonly DEFAULT_TTL = 5 * 60 * 1000;

  constructor(private configService: ConfigService) {
    const redisUrl = configService.get<string>('UPSTASH_REDIS_REST_URL');
    const redisToken = configService.get<string>('UPSTASH_REDIS_REST_TOKEN');

    if (redisUrl && redisToken) {
      try {
        this.backend = new RedisBackend(redisUrl, redisToken);
        // Garder un fallback en mémoire en cas de problème Redis
        this.inMemoryFallback = new InMemoryBackend();
        this.logger.log('✅ Using Redis as primary cache backend');
      } catch (error: any) {
        this.logger.warn(`Redis init failed, falling back to in-memory: ${error.message}`);
        this.backend = new InMemoryBackend();
      }
    } else {
      this.logger.log('📦 UPSTASH_REDIS not configured — using in-memory cache');
      this.backend = new InMemoryBackend();
    }
  }

  /**
   * Récupère une valeur du cache.
   * Si Redis échoue, tente le fallback en mémoire.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await this.backend.get<T>(key);
      // Si Redis ne trouve pas et qu'on a un fallback mémoire, vérifier aussi
      if (result === null && this.inMemoryFallback) {
        return await this.inMemoryFallback.get<T>(key);
      }
      return result;
    } catch {
      if (this.inMemoryFallback) {
        return await this.inMemoryFallback.get<T>(key);
      }
      return null;
    }
  }

  /**
   * Stocke une valeur dans le cache.
   * Écrit dans Redis ET dans le fallback mémoire (double-write).
   */
  async set(key: string, data: any, ttl: number = this.DEFAULT_TTL): Promise<void> {
    const promises = [this.backend.set(key, data, ttl)];
    if (this.inMemoryFallback) {
      promises.push(this.inMemoryFallback.set(key, data, ttl));
    }
    await Promise.allSettled(promises);
  }

  /**
   * Invalide une clé du cache.
   */
  async invalidate(key: string): Promise<void> {
    const promises = [this.backend.invalidate(key)];
    if (this.inMemoryFallback) {
      promises.push(this.inMemoryFallback.invalidate(key));
    }
    await Promise.allSettled(promises);
  }

  /**
   * Invalide toutes les clés correspondant à un pattern regex.
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const promises = [this.backend.invalidatePattern(pattern)];
    if (this.inMemoryFallback) {
      promises.push(this.inMemoryFallback.invalidatePattern(pattern));
    }
    await Promise.allSettled(promises);
  }

  /**
   * Vide complètement le cache.
   */
  async clear(): Promise<void> {
    const promises = [this.backend.clear()];
    if (this.inMemoryFallback) {
      promises.push(this.inMemoryFallback.clear());
    }
    await Promise.allSettled(promises);
  }

  /**
   * Retourne la taille du cache.
   */
  async size(): Promise<number> {
    return await this.backend.size();
  }

  onModuleDestroy(): void {
    if (this.inMemoryFallback) {
      this.inMemoryFallback.destroy();
    }
  }
}
