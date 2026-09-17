/**
 * ============================================================================
 * usePushSubscription — Hook React pour l'abonnement Web Push
 * ============================================================================
 *
 * Flow :
 *   1. Au montage (si utilisateur connecté), enregistre le service worker /sw.js
 *   2. Récupère la clé publique VAPID via GET /notifications/vapid-public-key
 *   3. Si VAPID configuré et permission notifi granted, appelle
 *      pushManager.subscribe({ applicationServerKey }) et POST /notifications/subscribe
 *   4. Gère la permission Notification.permission (demande si 'default')
 *
 * Le hook est idempotent : si l'abonnement existe déjà, il ne refait rien.
 * Il est conçu pour être appelé une fois au niveau racine (layout admin).
 *
 * Note : les notifications push ne fonctionnent qu'en HTTPS (ou localhost).
 * Vercel est en HTTPS par défaut — OK.
 * ============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api/client';

/** Convertit une clé publique VAPID base64url en Uint8Array pour pushManager.subscribe. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = typeof window !== 'undefined'
    ? window.atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export function usePushSubscription(isAuthenticated: boolean) {
  const [status, setStatus] = useState<'idle' | 'subscribing' | 'subscribed' | 'denied' | 'unsupported' | 'error'>('idle');

  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }

    let cancelled = false;

    /**
     * ⭐ PERF (chantier GTMetrix) — la clé publique VAPID est quasi immuable.
     * AVANT : 1 requête cross-origin (api.academiahelm.com) à CHAQUE montage
     * de vue /app/*. APRÈS : cache localStorage TTL 24 h → 0 requête en
     * usage quotidien. Invalidation : expiry explicite ou clé absente.
     */
    const VAPID_CACHE_KEY = 'helm_vapid_public_key_cache';
    const VAPID_TTL_MS = 24 * 60 * 60 * 1000;

    async function getVapidPublicKey(): Promise<string | null> {
      try {
        const raw = localStorage.getItem(VAPID_CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as { publicKey: string | null; at: number };
          if (Date.now() - cached.at < VAPID_TTL_MS) return cached.publicKey ?? null;
        }
      } catch {
        /* cache corrompu → on passe au fetch */
      }
      const { publicKey } = await apiFetch<{ publicKey: string | null }>('/notifications/vapid-public-key');
      try {
        localStorage.setItem(VAPID_CACHE_KEY, JSON.stringify({ publicKey: publicKey ?? null, at: Date.now() }));
      } catch {
        /* quota localStorage — non bloquant */
      }
      return publicKey;
    }

    async function setup() {
      try {
        // ⭐ PERF : permission refusée → sortie IMMÉDIATE, avant toute requête
        // réseau (la clé VAPID ne servirait à rien).
        if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
          setStatus('denied');
          return;
        }

        // 1. Récupérer la clé publique VAPID (cache local 24 h — voir getVapidPublicKey)
        const publicKey = await getVapidPublicKey();
        if (cancelled) return;
        if (!publicKey) {
          // Web Push non configuré côté backend — on quitte silencieusement
          setStatus('idle');
          return;
        }

        // 2. Enregistrer le service worker (au cas où il ne l'est pas encore)
        const reg = await navigator.serviceWorker.register('/sw.js');
        if (cancelled) return;

        // 3. Vérifier s'il y a déjà un abonnement
        let subscription = await reg.pushManager.getSubscription();
        if (cancelled) return;

        if (!subscription) {
          // 4. Demander la permission si pas encore accordée
          if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (cancelled) return;
            if (permission !== 'granted') {
              setStatus('denied');
              return;
            }
          } else if (Notification.permission === 'denied') {
            setStatus('denied');
            return;
          }

          // 5. Créer l'abonnement
          setStatus('subscribing');
          const applicationServerKey = urlBase64ToUint8Array(publicKey);
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
          if (cancelled) return;
        }

        // 6. Envoyer l'abonnement au backend (si nouveau)
        setStatus('subscribing');
        const subJson = subscription.toJSON();
        await apiFetch('/notifications/subscribe', {
          method: 'POST',
          body: JSON.stringify({
            endpoint: subJson.endpoint,
            keys: subJson.keys,
            expirationTime: subJson.expirationTime,
          }),
        });
        if (cancelled) return;

        setStatus('subscribed');
      } catch (err: any) {
        console.warn('[usePushSubscription] setup failed:', err.message);
        if (!cancelled) setStatus('error');
      }
    }

    // Délai pour laisser le temps aux autres hooks de s'initialiser
    const timer = setTimeout(setup, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isAuthenticated]);

  return { status };
}
