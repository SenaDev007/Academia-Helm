/**
 * ============================================================================
 * NOTIFICATION SERVICE — Frontend API client
 * ============================================================================
 *
 * Client HTTP pour les endpoints /notifications du backend NestJS.
 * Utilisé par le dropdown cloche + le polling temps réel.
 *
 * Endpoints :
 *   GET    /notifications                — liste
 *   GET    /notifications/unread-count   — compteur non lues
 *   PATCH  /notifications/:id/read       — marquer comme lue
 *   PATCH  /notifications/read-all       — tout marquer comme lu
 *   DELETE /notifications/:id            — supprimer
 * ============================================================================
 */

import { apiFetch } from '@/lib/api/client';

export interface InAppNotification {
  id: string;
  tenantId: string;
  recipientId: string;
  type: string; // ADMISSION_SUBMITTED | CANDIDATURE_SUBMITTED | SYSTEM | ...
  title: string;
  body: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  data?: any;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

class NotificationService {
  /**
   * Liste les notifications de l'utilisateur courant.
   */
  async list(options?: { onlyUnread?: boolean; limit?: number; offset?: number }): Promise<InAppNotification[]> {
    const params = new URLSearchParams();
    if (options?.onlyUnread) params.set('unread', 'true');
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    const qs = params.toString();
    return apiFetch(`/notifications${qs ? `?${qs}` : ''}`);
  }

  /**
   * Récupère le nombre de notifications non lues.
   */
  async getUnreadCount(): Promise<number> {
    const res = await apiFetch<{ count: number }>('/notifications/unread-count');
    return res?.count ?? 0;
  }

  /**
   * Marque une notification comme lue.
   */
  async markAsRead(id: string): Promise<void> {
    await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  /**
   * Marque toutes les notifications comme lues.
   */
  async markAllAsRead(): Promise<void> {
    await apiFetch('/notifications/read-all', { method: 'PATCH' });
  }

  /**
   * Supprime une notification.
   */
  async delete(id: string): Promise<void> {
    await apiFetch(`/notifications/${id}`, { method: 'DELETE' });
  }
}

export const notificationService = new NotificationService();
