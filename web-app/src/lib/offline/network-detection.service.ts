/**
 * Network Detection Service
 * 
 * Service pour détecter l'état de la connexion réseau
 * et déclencher la synchronisation automatique
 */

type NetworkStatusCallback = (isOnline: boolean) => void;

class NetworkDetectionService {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private listeners: NetworkStatusCallback[] = [];
  private pingInterval: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  /**
   * Initialise les listeners réseau
   */
  private initialize(): void {
    // Écouter les événements online/offline
    window.addEventListener('online', () => {
      this.setOnline(true);
    });

    window.addEventListener('offline', () => {
      this.setOnline(false);
    });

    // Vérification périodique (ping serveur)
    this.startPingInterval();
  }

  /**
   * Démarre la vérification périodique
   */
  private startPingInterval(): void {
    // Ping toutes les 30 secondes
    this.pingInterval = window.setInterval(() => {
      this.checkConnection();
    }, 30000);
  }

  /**
   * Vérifie la connexion réelle (ping serveur)
   */
  private async checkConnection(): Promise<void> {
    try {
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000), // Timeout 5s
      });
      this.setOnline(response.ok);
    } catch {
      this.setOnline(false);
    }
  }

  /**
   * Définit l'état online/offline
   */
  private setOnline(online: boolean): void {
    if (this.isOnline !== online) {
      this.isOnline = online;
      this.notifyListeners(online);
    }
  }

  /**
   * Vérifie si l'application est en ligne
   */
  isConnected(): boolean {
    return this.isOnline;
  }

  /**
   * Ajoute un listener pour les changements de connexion
   */
  onConnectionChange(callback: NetworkStatusCallback): void {
    this.listeners.push(callback);
    // Notifier immédiatement avec l'état actuel
    callback(this.isOnline);
  }

  onNetworkStatusChange(callback: NetworkStatusCallback): () => void {
    this.listeners.push(callback);
    callback(this.isOnline);
    return () => {
      this.removeListener(callback);
    };
  }

  /**
   * Retire un listener
   */
  removeListener(callback: NetworkStatusCallback): void {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  /**
   * Notifie tous les listeners
   */
  private notifyListeners(online: boolean): void {
    this.listeners.forEach(callback => {
      try {
        callback(online);
      } catch (error) {
        console.error('Error in network status callback:', error);
      }
    });
  }

  /**
   * Nettoie les ressources
   */
  destroy(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.listeners = [];
  }
}

// Instance singleton
export const networkDetectionService = new NetworkDetectionService();

