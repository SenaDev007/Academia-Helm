/**
 * Network Detection Service — RÉACTIVÉ
 *
 * Détection réseau robuste utilisant :
 *   1. navigator.onLine (API native du navigateur — immédiat)
 *   2. Ping léger HEAD /api/health (timeout 3s, toutes les 30s)
 *   3. Backoff sur échec pour éviter le spam
 *
 * Distinction "instable" (réessayer) vs "vraiment offline" (bascule offline) :
 *   - Si navigator.onLine = false → vraiment offline immédiatement
 *   - Si navigator.onLine = true mais ping échoue 2 fois de suite → offline
 *   - Si navigator.onLine = true et ping réussit → online
 *   - À la reconnexion (online event), on re-pingue immédiatement
 */

type NetworkStatusCallback = (isOnline: boolean) => void;

class NetworkDetectionService {
  private isOnline: boolean = true;
  private listeners: NetworkStatusCallback[] = [];
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private consecutiveFailures = 0;
  private readonly MAX_FAILURES_BEFORE_OFFLINE = 2; // 2 échecs = offline
  private readonly PING_INTERVAL_MS = 30000; // 30s
  private readonly PING_TIMEOUT_MS = 3000; // 3s timeout

  constructor() {
    if (typeof window === 'undefined') return; // SSR safety

    // ⭐ État initial depuis navigator.onLine
    this.isOnline = navigator.onLine;

    // ⭐ Listeners natifs online/offline
    window.addEventListener('online', () => {
      // Reconnexion → re-pinguer immédiatement pour confirmer
      this.checkConnection();
    });

    window.addEventListener('offline', () => {
      this.setOnline(false);
    });

    // ⭐ Ping périodique léger (seulement si navigator.onLine = true)
    this.startPeriodicPing();
  }

  /**
   * Retourne l'état de connexion actuel
   */
  isConnected(): boolean {
    return this.isOnline;
  }

  /**
   * Enregistre un callback appelé à chaque changement de statut réseau
   */
  onConnectionChange(callback: NetworkStatusCallback): void {
    this.listeners.push(callback);
    callback(this.isOnline); // Notifier immédiatement avec l'état actuel
  }

  onNetworkStatusChange(callback: NetworkStatusCallback): () => void {
    this.listeners.push(callback);
    callback(this.isOnline);
    return () => {
      this.removeListener(callback);
    };
  }

  removeListener(callback: NetworkStatusCallback): void {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  /**
   * Force une vérification de connexion (appelé par le bouton "Sync")
   */
  async checkConnection(): Promise<boolean> {
    if (typeof window === 'undefined' || !navigator.onLine) {
      this.setOnline(false);
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.PING_TIMEOUT_MS);
      const res = await fetch('/api/auth/me', {
        method: 'HEAD',
        signal: controller.signal,
        credentials: 'include',
      });
      clearTimeout(timeoutId);
      // Même un 401 signifie que le serveur répond → on est online
      this.consecutiveFailures = 0;
      this.setOnline(true);
      return true;
    } catch {
      // Ping échoué (timeout ou réseau)
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.MAX_FAILURES_BEFORE_OFFLINE) {
        this.setOnline(false);
      }
      return false;
    }
  }

  private setOnline(online: boolean): void {
    if (this.isOnline === online) return; // Pas de changement
    this.isOnline = online;
    // Notifier tous les listeners
    for (const cb of this.listeners) {
      try { cb(online); } catch { /* silent */ }
    }
  }

  private startPeriodicPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(async () => {
      // Seulement si le navigateur pense être online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        await this.checkConnection();
      } else {
        this.setOnline(false);
      }
    }, this.PING_INTERVAL_MS);
  }

  destroy(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.listeners = [];
  }
}

// Instance singleton
export const networkDetectionService = new NetworkDetectionService();
