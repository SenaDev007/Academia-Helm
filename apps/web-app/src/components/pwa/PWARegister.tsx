'use client';

/**
 * ============================================================================
 * PWA REGISTER — Enregistrement du Service Worker + capture install prompt
 * ============================================================================
 *
 * Monté dans le layout ROOT (toutes les pages : site institutionnel, login,
 * portails, app authentifiée) car le SW a un scope '/' par origine.
 *
 * Responsabilités :
 *   1. Enregistrer /sw.js (SW unifié : push + cache + installabilité)
 *      — production uniquement
 *   2. Vérifier les mises à jour du SW au retour d'onglet (visibilitychange)
 *   3. Capturer `beforeinstallprompt` LE PLUS TÔT POSSIBLE (ce composant est
 *      rendu avant le contenu) et le stocker globalement pour que les
 *      composants PWAInstallPrompt (montés plus tard dans l'arbre React)
 *      puissent le consommer via `window.__ahPwaDeferredPrompt` ou l'événement
 *      custom `ah-install-available`.
 *
 * ⚠️ IMPORTANT : un SEUL SW à la racine. Les anciens SW (sw-chat.js,
 *    sw-offline.js) ne doivent plus être enregistrés — voir WhatsAppChat.tsx
 *    qui utilise désormais /sw.js directement.
 * ============================================================================
 */

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    // ─── 1. Enregistrement du SW unifié ──────────────────────────────────
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        // Vérifier les mises à jour quand l'utilisateur revient sur l'onglet
        // (le SW est re-validé par le navigateur, au max toutes les 24h —
        // ce check manuel accélère la prise en charge des déploiements)
        const onVisible = () => {
          if (document.visibilityState === 'visible') {
            registration.update().catch(() => {});
          }
        };
        document.addEventListener('visibilitychange', onVisible);

        // Un nouveau SW est prêt à s'activer → SKIP_WAITING pour basculer
        // immédiatement (cache v2 propre au prochain chargement)
        registration.addEventListener('waiting', (event) => {
          event.target?.postMessage?.({ type: 'SKIP_WAITING' });
        });

        return () => document.removeEventListener('visibilitychange', onVisible);
      } catch (err) {
        console.warn('[PWA] SW registration failed:', err);
        return undefined;
      }
    };

    const cleanupPromise = registerSW();

    // ─── 2. Capture précoce de beforeinstallprompt ───────────────────────
    // Chrome/Edge déclenchent cet événement selon leurs heuristiques. On le
    // capture ici (composant monté tôt) pour le rendre disponible à tout
    // composant d'installation, même monté après l'événement.
    const handleBeforeInstallPrompt = (e: Event) => {
      // Empêcher le mini-infobar natif de Chrome (notre bannière custom
      // prend le relais — PWAInstallPrompt)
      e.preventDefault();
      (window as any).__ahPwaDeferredPrompt = e;
      // Notifier les composants déjà montés
      window.dispatchEvent(new CustomEvent('ah-install-available', { detail: e }));
    };

    const handleAppInstalled = () => {
      delete (window as any).__ahPwaDeferredPrompt;
      window.dispatchEvent(new CustomEvent('ah-installed'));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      cleanupPromise?.then((cleanup) => cleanup?.());
    };
  }, []);

  return null;
}
