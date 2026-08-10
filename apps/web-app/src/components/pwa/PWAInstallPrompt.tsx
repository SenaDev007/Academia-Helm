'use client';

/**
 * ============================================================================
 * PWA INSTALL PROMPT — App authentifiée
 * ============================================================================
 *
 * Composant qui gère l'invitation à installer l'app comme une PWA.
 * Affiché dans l'app authentifiée (layout-client.tsx).
 *
 * Affiche une bannière discrète en bas à droite quand le navigateur
 * déclenche `beforeinstallprompt`. L'utilisateur peut installer ou
 * fermer (re-prompt dans 7 jours).
 * ============================================================================
 */

import { useEffect, useState } from 'react';
import { Download, X, Monitor } from 'lucide-react';

const STORAGE_KEY = 'app_pwa_install_state';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Vérifier si déjà installé ou refusé récemment
    try {
      const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (state.installed) {
        setInstalled(true);
        return;
      }
      // Re-prompt après 7 jours
      if (state.lastDismissedAt) {
        const elapsed = Date.now() - state.lastDismissedAt;
        if (elapsed < 7 * 24 * 60 * 60 * 1000) return; // Pas encore
      }
    } catch {}

    // ⭐ Écouter beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault(); // Empêcher le prompt natif automatique
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // ⭐ Détecter si déjà installé (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    if (isStandalone) {
      setInstalled(true);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ installed: true })); } catch {}
    }

    // ⭐ Écouter appinstalled
    const installedHandler = () => {
      setInstalled(true);
      setShowBanner(false);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ installed: true })); } catch {}
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstalled(true);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ installed: true })); } catch {}
    } else {
      handleDismiss();
    }
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        lastDismissedAt: Date.now(),
      }));
    } catch {}
  };

  if (installed || !showBanner || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9998] bg-white border border-slate-200 rounded-xl shadow-lg p-4 max-w-xs animate-in fade-in slide-in-from-bottom duration-300">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
          <Monitor className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900">Installer Academia Helm</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Accédez à l'app plus rapidement, même hors ligne
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
            >
              <Download className="h-3 w-3" />
              Installer
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 rounded-lg text-xs font-medium"
            >
              Plus tard
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-600 shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
