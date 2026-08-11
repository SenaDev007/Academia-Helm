/**
 * ============================================================================
 * NETWORK DETECTION SERVICE — Simplifié et fiable
 * ============================================================================
 *
 * ⭐ PHILOSOPHIE : faire confiance au navigateur (navigator.onLine).
 *    Le navigateur sait mieux que nous si Internet fonctionne.
 *    Il utilise des APIs système (NetworkManager sur Linux, NetListManager
 *    sur Windows, reachability sur macOS/iOS) qui sont fiables.
 *
 *    AVANT : on faisait un ping HEAD vers /api/auth/me toutes les 30s avec
 *    un timeout de 3s. Si 2 pings consécutifs échouaient (timeout 3s),
 *    on déclarait l'app "hors ligne" — même si Internet fonctionnait
 *    parfaitement. Une micro-coupure serveur ou un ping lent suffisait
 *    à basculer en mode offline → lenteurs, données manquantes,
 *    mauvaise UX.
 *
 *    MAINTENANT : on utilise UNIQUEMENT navigator.onLine.
 *    - navigator.onLine = true → online (fetch natif, performance normale)
 *    - navigator.onLine = false → offline (offlineFetch, lecture IndexedDB)
 *
 *    Aucun ping, aucun timeout, aucune bascule intempestive.
 *    Le navigateur gère les events 'online'/'offline' de manière
 *    instantanée et fiable.
 * ============================================================================
 */

type NetworkStatusCallback = (isOnline: boolean) => void;

class NetworkDetectionService {
  private isOnline: boolean = true;
  private listeners: NetworkStatusCallback[] = [];

  constructor() {
    if (typeof window === 'undefined') return; // SSR safety

    // ⭐ État initial depuis navigator.onLine
    this.isOnline = navigator.onLine;

    // ⭐ Listeners natifs online/offline — source de vérité du navigateur
    window.addEventListener('online', () => {
      this.setOnline(true);
    });

    window.addEventListener('offline', () => {
      this.setOnline(false);
    });

    // ⭐ AUCUN ping périodique — on fait confiance au navigateur.
    //    Le navigateur détecte la perte de connexion en ~100-500ms
    //    via les APIs système (bien plus fiable qu'un ping HTTP).
  }

  /**
   * Retourne l'état de connexion actuel.
   * Utilise navigator.onLine qui est l'API standard du navigateur.
   */
  isConnected(): boolean {
    if (typeof navigator === 'undefined') return true; // SSR
    // ⭐ Toujours retourner navigator.onLine (temps réel)
    return navigator.onLine;
  }

  /**
   * Enregistre un callback appelé à chaque changement de statut réseau.
   */
  onConnectionChange(callback: NetworkStatusCallback): void {
    this.listeners.push(callback);
    callback(this.isOnline);
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
   * Force une vérification de connexion.
   * ⭐ Maintenant : retourne simplement navigator.onLine (pas de ping).
   */
  async checkConnection(): Promise<boolean> {
    if (typeof navigator === 'undefined') return true;
    const online = navigator.onLine;
    this.setOnline(online);
    return online;
  }

  private setOnline(online: boolean): void {
    if (this.isOnline === online) return;
    this.isOnline = online;
    for (const cb of this.listeners) {
      try { cb(online); } catch { /* silent */ }
    }
  }

  destroy(): void {
    this.listeners = [];
  }
}

// Instance singleton
export const networkDetectionService = new NetworkDetectionService();
