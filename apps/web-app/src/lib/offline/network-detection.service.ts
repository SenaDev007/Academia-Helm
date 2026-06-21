/**
 * Network Detection Service
 *
 * ⚠️ DÉSACTIVÉ TEMPORAIREMENT — Le mode offline bloquait l'application
 * même quand la connexion était juste instable (ping qui timeout).
 * On désactive la détection réseau en attendant une implémentation
 * plus robuste qui ne bloque QUE quand il n'y a VRAIMENT aucune connexion.
 *
 * Toutes les méthodes retournent "toujours connecté" (true).
 * Les listeners ne sont jamais notifiés d'un changement.
 * Le ping périodique est désactivé.
 */

type NetworkStatusCallback = (isOnline: boolean) => void;

class NetworkDetectionService {
  // Toujours en ligne — mode offline désactivé
  private isOnline: boolean = true;
  private listeners: NetworkStatusCallback[] = [];

  constructor() {
    // Ne rien faire — pas de listeners, pas de ping
  }

  /**
   * ⚠️ DÉSACTIVÉ — Retourne toujours true
   */
  isConnected(): boolean {
    return true;
  }

  /**
   * ⚠️ DÉSACTIVÉ — Enregistre le callback mais ne notifie jamais de déconnexion
   */
  onConnectionChange(callback: NetworkStatusCallback): void {
    this.listeners.push(callback);
    callback(true); // Toujours en ligne
  }

  onNetworkStatusChange(callback: NetworkStatusCallback): () => void {
    this.listeners.push(callback);
    callback(true); // Toujours en ligne
    return () => {
      this.removeListener(callback);
    };
  }

  removeListener(callback: NetworkStatusCallback): void {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  destroy(): void {
    this.listeners = [];
  }
}

// Instance singleton
export const networkDetectionService = new NetworkDetectionService();
