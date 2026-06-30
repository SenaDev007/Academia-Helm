/**
 * ============================================================================
 * useNotifications — Hook React pour la cloche de notifications
 * ============================================================================
 *
 * Fonctionnalités :
 *   - Polling toutes les 30s sur /notifications/unread-count
 *   - Détection des nouvelles notifications (comparaison avec l'ID max connu)
 *   - Déclenchement du son + toast à l'arrivée d'une nouvelle notification
 *   - API pour marquer comme lu / tout marquer comme lu / supprimer
 *   - Chargement paresseux de la liste (au premier clic sur la cloche)
 *
 * Usage :
 *   const { unreadCount, notifications, isOpen, setIsOpen, markAsRead, markAllAsRead } = useNotifications();
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationService, type InAppNotification } from '@/services/notification.service';
import { toast } from '@/components/ui/toast';
import { playNotificationSound } from '@/lib/sound/play-notification-sound';

const POLL_INTERVAL_MS = 30000; // 30 secondes
const LIST_LIMIT = 20;

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Référence vers le dernier ID de notification connu (pour détecter les nouvelles)
  const lastKnownNotifIdRef = useRef<string | null>(null);
  // Évite de déclencher le son au premier chargement (initialisation)
  const isFirstLoadRef = useRef(true);
  // Tracke si on a déjà chargé la liste au moins une fois (évite l'infinite loop
  // quand la liste est vide — sinon le useEffect se redéclencherait indéfiniment)
  const hasLoadedRef = useRef(false);
  // Tracke si un chargement est en cours (évite les appels simultanés)
  const isLoadingRef = useRef(false);

  // ── Polling : compteur non lues toutes les 30s ──
  const refreshUnreadCount = useCallback(async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Erreur réseau — ignore (le backend peut être en cold start)
    }
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  // ── Chargement de la liste ──
  // Appelé au premier clic sur la cloche, ou manuellement via loadNotifications().
  // Utilise hasLoadedRef + isLoadingRef pour éviter les appels en boucle.
  const loadNotifications = useCallback(async () => {
    // Ne pas recharger si déjà chargé OU si un chargement est en cours
    if (hasLoadedRef.current || isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);
    try {
      const list = await notificationService.list({ limit: LIST_LIMIT });
      setNotifications(list);
      hasLoadedRef.current = true; // marquer comme chargé (même si liste vide)
      // Mémoriser l'ID le plus récent pour détecter les nouvelles
      if (list.length > 0) {
        lastKnownNotifIdRef.current = list[0].id;
      }
    } catch {
      // Erreur réseau — ne PAS marquer hasLoadedRef pour permettre une retry au prochain clic
      // mais on sort quand même d'isLoading pour éviter le spinner infini
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // ── Forcer le rechargement (ignore le cache hasLoadedRef) ──
  // Utilisé après markAllAsRead ou quand on veut refresh manuellement.
  const forceReload = useCallback(async () => {
    isLoadingRef.current = true;
    setIsLoading(true);
    try {
      const list = await notificationService.list({ limit: LIST_LIMIT });
      setNotifications(list);
      hasLoadedRef.current = true;
      if (list.length > 0) {
        lastKnownNotifIdRef.current = list[0].id;
      }
    } catch {
      // ignore
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // ── Quand l'utilisateur ouvre la cloche, charger la liste si pas encore fait ──
  useEffect(() => {
    if (isOpen && !hasLoadedRef.current && !isLoadingRef.current) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  // ── Détection des nouvelles notifications via polling ──
  // On compare le compteur non lues : s'il augmente, on recharge la liste
  // et on déclenche le son + toast.
  const prevUnreadCountRef = useRef(0);
  useEffect(() => {
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      prevUnreadCountRef.current = unreadCount;
      return;
    }
    // Le compteur a augmenté → nouvelle notification
    if (unreadCount > prevUnreadCountRef.current) {
      // Recharger la liste pour afficher la nouvelle notif
      notificationService
        .list({ limit: LIST_LIMIT })
        .then((list) => {
          setNotifications(list);
          hasLoadedRef.current = true;
          // Détection de la nouvelle notif (la plus récente)
          if (list.length > 0) {
            const newest = list[0];
            if (newest.id !== lastKnownNotifIdRef.current) {
              lastKnownNotifIdRef.current = newest.id;
              // Jouer le son
              playNotificationSound();
              // Afficher un toast
              toast({
                title: newest.title,
                description: newest.body,
                variant: 'info',
              });
            }
          }
        })
        .catch(() => {
          // Erreur réseau — ignore
        });
    }
    prevUnreadCountRef.current = unreadCount;
  }, [unreadCount]);

  // ── Actions ──

  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      await notificationService.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      // Recalculer le compteur
      refreshUnreadCount();
    } catch {
      // ignore
    }
  }, [refreshUnreadCount]);

  return {
    unreadCount,
    notifications,
    isLoading,
    isOpen,
    setIsOpen,
    loadNotifications,
    forceReload,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshUnreadCount,
  };
}
