import { Injectable, Logger } from '@nestjs/common';

/**
 * Service de cache simple en mémoire (LRU-like) avec limites de taille
 *
 * Pour données stables : années scolaires, niveaux, paramètres
 *
 * - MAX_SIZE: limite le nombre d'entrées (évite la croissance infinie)
 * - Cleanup automatique toutes les 5 minutes via setInterval
 * - LRU eviction: supprime les entrées les plus anciennes quand la limite est atteinte
 *
 * TODO: Migrer vers Redis en production si nécessaire
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private cache = new Map<string, { data: any; expiresAt: number }>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_SIZE = 500; // Maximum 500 entrées (évite OOM)
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup automatique toutes les 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Récupère une valeur du cache
   */
  get<T>(key: string): T | null {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Stocke une valeur dans le cache
   * Si la taille max est atteinte, supprime les entrées les plus anciennes
   */
  set(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    // Si la clé existe déjà, on la met à jour sans vérifier la taille
    if (!this.cache.has(key) && this.cache.size >= this.MAX_SIZE) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Invalide une clé du cache
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalide toutes les clés correspondant à un pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Nettoie le cache expiré
   */
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired cache entries (${this.cache.size} remaining)`);
    }
  }

  /**
   * Vide complètement le cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Retourne la taille du cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Supprime l'entrée la plus ancienne (LRU eviction)
   */
  private evictOldest(): void {
    // Map preserves insertion order, so the first entry is the oldest
    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
    }
  }

  /**
   * Nettoyage à la destruction du service
   */
  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}
