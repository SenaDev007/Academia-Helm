/**
 * Performance Audit Service
 * 
 * Service pour mesurer et logger les temps de chargement réels
 * 
 * INDICATEURS MESURÉS :
 * - Temps post-login jusqu'au dashboard
 * - Temps de chargement des modules lourds
 * - Temps de synchronisation offline
 * - Temps d'initialisation ORION
 */

export type PerformanceMetricType = 
  | 'POST_LOGIN'
  | 'MODULE_LOAD'
  | 'OFFLINE_SYNC'
  | 'ORION_INIT'
  | 'PAGE_LOAD'
  | 'API_CALL';

export interface PerformanceMetric {
  id: string;
  type: PerformanceMetricType;
  tenantId?: string;
  userId?: string;
  device: 'desktop' | 'tablet' | 'mobile';
  connectionType: 'online' | 'offline' | 'slow';
  duration: number; // en millisecondes
  timestamp: string;
  metadata?: Record<string, any>;
}

class PerformanceAuditService {
  private metrics: PerformanceMetric[] = [];
  private timers: Map<string, number> = new Map();

  /**
   * Démarre un timer pour une métrique
   */
  startTimer(metricId: string): void {
    this.timers.set(metricId, performance.now());
  }

  /**
   * Arrête un timer et enregistre la métrique
   */
  endTimer(
    metricId: string,
    type: PerformanceMetricType,
    metadata?: Record<string, any>
  ): number {
    const startTime = this.timers.get(metricId);
    if (!startTime) {
      console.warn(`Timer ${metricId} not found`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(metricId);

    // Enregistrer la métrique
    this.recordMetric({
      id: metricId,
      type,
      duration,
      device: this.detectDevice(),
      connectionType: this.detectConnectionType(),
      timestamp: new Date().toISOString(),
      metadata,
    });

    return duration;
  }

  /**
   * Enregistre une métrique
   */
  recordMetric(metric: PerformanceMetric): void {
    // Ajouter tenantId et userId si disponibles
    if (typeof window !== 'undefined') {
      try {
        const session = localStorage.getItem('session');
        if (session) {
          const parsed = JSON.parse(session);
          metric.tenantId = parsed.tenantId;
          metric.userId = parsed.userId;
        }
      } catch (error) {
        // Ignorer les erreurs de parsing
      }
    }

    this.metrics.push(metric);

    // Envoyer au backend par batch (toutes les 10 métriques ou toutes les 30 secondes)
    if (this.metrics.length >= 10) {
      this.flushMetrics();
    }
  }

  /**
   * Envoie les métriques au backend
   */
  async flushMetrics(): Promise<void> {
    if (this.metrics.length === 0) {
      return;
    }

    const metricsToSend = [...this.metrics];
    this.metrics = [];

    try {
      // Envoyer au backend
      const response = await fetch('/api/performance/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metrics: metricsToSend }),
        keepalive: true, // Important pour ne pas bloquer la navigation
      });

      if (!response.ok) {
        console.warn('Failed to send performance metrics');
        // Remettre les métriques dans la queue en cas d'échec
        this.metrics.unshift(...metricsToSend);
      }
    } catch (error) {
      console.warn('Error sending performance metrics:', error);
      // Remettre les métriques dans la queue en cas d'échec
      this.metrics.unshift(...metricsToSend);
    }
  }

  /**
   * Détecte le type d'appareil
   */
  private detectDevice(): 'desktop' | 'tablet' | 'mobile' {
    if (typeof window === 'undefined') {
      return 'desktop';
    }

    const width = window.innerWidth;
    if (width < 768) {
      return 'mobile';
    } else if (width < 1024) {
      return 'tablet';
    }
    return 'desktop';
  }

  /**
   * Détecte le type de connexion
   */
  private detectConnectionType(): 'online' | 'offline' | 'slow' {
    if (typeof navigator === 'undefined') {
      return 'online';
    }

    if (!navigator.onLine) {
      return 'offline';
    }

    // Détecter une connexion lente (basé sur l'API Network Information si disponible)
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (connection) {
      const effectiveType = connection.effectiveType;
      if (effectiveType === 'slow-2g' || effectiveType === '2g') {
        return 'slow';
      }
    }

    return 'online';
  }

  /**
   * Obtient les métriques enregistrées (pour debug)
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Nettoie les métriques
   */
  clearMetrics(): void {
    this.metrics = [];
    this.timers.clear();
  }
}

// Instance singleton
export const performanceAuditService = new PerformanceAuditService();

// Flush automatique toutes les 30 secondes
if (typeof window !== 'undefined') {
  setInterval(() => {
    performanceAuditService.flushMetrics();
  }, 30000);
}

// Flush avant la fermeture de la page
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    performanceAuditService.flushMetrics();
  });
}
