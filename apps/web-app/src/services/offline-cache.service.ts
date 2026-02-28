/**
 * ============================================================================
 * OFFLINE CACHE SERVICE - SERVICE DE CACHE POUR SUPPORT OFFLINE
 * ============================================================================
 */

import { AppContext } from '../contexts/TenantContext';

const CACHE_PREFIX = 'academia_helm_';
const CACHE_VERSION = '1.0.0';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class OfflineCacheService {
  private readonly contextCacheKey = `${CACHE_PREFIX}context_${CACHE_VERSION}`;
  private readonly contextCacheTTL = 24 * 60 * 60 * 1000; // 24 heures

  /**
   * Vérifie si le navigateur supporte le localStorage
   */
  private isStorageAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cache le contexte tenant
   */
  cacheContext(context: AppContext): void {
    if (!this.isStorageAvailable()) return;

    try {
      const entry: CacheEntry<AppContext> = {
        data: context,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.contextCacheTTL,
      };

      localStorage.setItem(this.contextCacheKey, JSON.stringify(entry));
    } catch (error) {
      console.error('Error caching context:', error);
    }
  }

  /**
   * Récupère le contexte depuis le cache
   */
  getCachedContext(): AppContext | null {
    if (!this.isStorageAvailable()) return null;

    try {
      const cached = localStorage.getItem(this.contextCacheKey);
      if (!cached) return null;

      const entry: CacheEntry<AppContext> = JSON.parse(cached);

      // Vérifier si le cache est expiré
      if (Date.now() > entry.expiresAt) {
        localStorage.removeItem(this.contextCacheKey);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('Error reading cached context:', error);
      return null;
    }
  }

  /**
   * Vide le cache du contexte
   */
  clearContextCache(): void {
    if (!this.isStorageAvailable()) return;

    try {
      localStorage.removeItem(this.contextCacheKey);
    } catch (error) {
      console.error('Error clearing context cache:', error);
    }
  }

  /**
   * Cache des données de dashboard
   */
  cacheDashboardData(role: string, data: any, ttl: number = 5 * 60 * 1000): void {
    if (!this.isStorageAvailable()) return;

    try {
      const key = `${CACHE_PREFIX}dashboard_${role}_${CACHE_VERSION}`;
      const entry: CacheEntry<any> = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + ttl,
      };

      localStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      console.error('Error caching dashboard data:', error);
    }
  }

  /**
   * Récupère les données de dashboard depuis le cache
   */
  getCachedDashboardData(role: string): any | null {
    if (!this.isStorageAvailable()) return null;

    try {
      const key = `${CACHE_PREFIX}dashboard_${role}_${CACHE_VERSION}`;
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const entry: CacheEntry<any> = JSON.parse(cached);

      // Vérifier si le cache est expiré
      if (Date.now() > entry.expiresAt) {
        localStorage.removeItem(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('Error reading cached dashboard data:', error);
      return null;
    }
  }

  /**
   * Vérifie si on est en mode offline
   */
  isOffline(): boolean {
    return !navigator.onLine;
  }

  /**
   * Écoute les changements de statut réseau
   */
  onNetworkStatusChange(callback: (isOnline: boolean) => void): () => void {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Retourner une fonction de nettoyage
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  /**
   * Nettoie tous les caches expirés
   */
  cleanExpiredCaches(): void {
    if (!this.isStorageAvailable()) return;

    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();

      keys.forEach((key) => {
        if (key.startsWith(CACHE_PREFIX)) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const entry: CacheEntry<any> = JSON.parse(cached);
              if (now > entry.expiresAt) {
                localStorage.removeItem(key);
              }
            }
          } catch {
            // Ignorer les erreurs de parsing
          }
        }
      });
    } catch (error) {
      console.error('Error cleaning expired caches:', error);
    }
  }
}

export const offlineCacheService = new OfflineCacheService();

// Nettoyer les caches expirés au démarrage
if (typeof window !== 'undefined') {
  offlineCacheService.cleanExpiredCaches();
}
