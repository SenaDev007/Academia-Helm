'use client';

/**
 * ============================================================================
 * PWA INSTALL PROMPT — Site institutionnel
 * ============================================================================
 *
 * Composant qui gère l'invitation à installer le site institutionnel
 * comme une PWA sur desktop ou mobile.
 *
 * Stratégie de re-prompt différée (l'utilisateur peut décliner) :
 *   - 1er refus → re-prompt dans 3 jours
 *   - 2ème refus → re-prompt dans 3 jours
 *   - 3ème refus → re-prompt dans 7 jours
 *   - 4ème refus → re-prompt dans 14 jours
 *   - 5ème refus et + → re-prompt dans 30 jours
 *
 * Si l'utilisateur accepte ou installe manuellement, le prompt ne réapparaît
 * plus jamais (affiché `installed` dans localStorage).
 *
 * Le composant :
 *   1. Enregistre le service worker `/sw-site.js`
 *   2. Écoute l'événement `beforeinstallprompt`
 *   3. Affiche une bannière custom (pas le prompt natif) avec boutons
 *      "Installer" / "Plus tard"
 *   4. Si "Installer" → déclenche le prompt natif
 *   5. Si "Plus tard" → incrémente le compteur et planifie le prochain prompt
 *
 * Persistance : localStorage (clé `pwa_install_state`)
 * ============================================================================
 */

import { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

// ─── Constantes ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'pwa_install_state';
const SW_PATH = '/sw-site.js';
const MANIFEST_PATH = '/manifest-site.webmanifest';

// Délais entre chaque refus (en millisecondes)
const RE_PROMPT_DELAYS = [
  3 * 24 * 60 * 60 * 1000,  // 3 jours après le 1er refus
  3 * 24 * 60 * 60 * 1000,  // 3 jours après le 2ème refus
  7 * 24 * 60 * 60 * 1000,  // 7 jours après le 3ème refus
  14 * 24 * 60 * 60 * 1000, // 14 jours après le 4ème refus
  30 * 24 * 60 * 60 * 1000, // 30 jours après le 5ème refus et +
];

// ─── Types ─────────────────────────────────────────────────────────────────

interface PwaInstallState {
  dismissedCount: number;
  lastDismissedAt: number | null;
  installed: boolean;
  installedAt: number | null;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// ─── Helpers localStorage ──────────────────────────────────────────────────

function loadState(): PwaInstallState {
  if (typeof window === 'undefined') {
    return { dismissedCount: 0, lastDismissedAt: null, installed: false, installedAt: null };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { dismissedCount: 0, lastDismissedAt: null, installed: false, installedAt: null };
    }
    const parsed = JSON.parse(raw);
    return {
      dismissedCount: parsed.dismissedCount || 0,
      lastDismissedAt: parsed.lastDismissedAt || null,
      installed: parsed.installed || false,
      installedAt: parsed.installedAt || null,
    };
  } catch {
    return { dismissedCount: 0, lastDismissedAt: null, installed: false, installedAt: null };
  }
}

function saveState(state: PwaInstallState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage indisponible — ignorer
  }
}

function shouldShowPrompt(state: PwaInstallState): boolean {
  if (state.installed) return false;
  if (state.lastDismissedAt === null) return true;
  const delayIndex = Math.min(state.dismissedCount - 1, RE_PROMPT_DELAYS.length - 1);
  const delay = RE_PROMPT_DELAYS[delayIndex];
  const elapsed = Date.now() - state.lastDismissedAt;
  return elapsed >= delay;
}

// ─── Composant ─────────────────────────────────────────────────────────────

export default function PWAInstallPrompt() {
  const [state, setState] = useState<PwaInstallState | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  // 1. Enregistrer le service worker au montage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // ⚠️ N'enregistrer le SW QUE sur les sous-domaines d'école (pas sur
    // le domaine principal academiahelm.com qui est la landing page)
    const host = window.location.host;
    const parts = host.split('.');
    if (parts.length < 3) return; // pas un sous-domaine

    // Injecter le <link rel="manifest"> dynamiquement si pas déjà présent
    if (!document.querySelector('link[rel="manifest"][href*="manifest-site"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = MANIFEST_PATH;
      document.head.appendChild(link);
    }

    // Injecter meta theme-color dynamique
    const existingThemeMeta = document.querySelector('meta[name="theme-color"]');
    if (!existingThemeMeta) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#1A3A8F';
      document.head.appendChild(meta);
    }

    // Enregistrer le SW
    navigator.serviceWorker
      .register(SW_PATH, { scope: '/' })
      .then(() => {
        setIsRegistered(true);
      })
      .catch((err) => {
        console.warn('[PWA] SW registration failed:', err);
      });
  }, []);

  // 2. Charger l'état depuis localStorage au montage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setState(loadState());
  }, []);

  // 3. Écouter beforeinstallprompt
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (e: Event) => {
      // Empêcher le prompt natif de s'afficher tout de suite
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // 4. Écouter appinstalled
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = () => {
      const newState = {
        ...loadState(),
        installed: true,
        installedAt: Date.now(),
      };
      saveState(newState);
      setState(newState);
      setShowBanner(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handler);
    return () => window.removeEventListener('appinstalled', handler);
  }, []);

  // 5. Afficher la bannière si les conditions sont réunies
  useEffect(() => {
    if (!state) return;
    if (!deferredPrompt) return;
    if (!shouldShowPrompt(state)) return;

    // Petit délai pour ne pas perturber le chargement initial
    const timer = setTimeout(() => setShowBanner(true), 3000);
    return () => clearTimeout(timer);
  }, [state, deferredPrompt]);

  // 6. Handlers
  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        const newState = {
          ...loadState(),
          installed: true,
          installedAt: Date.now(),
        };
        saveState(newState);
        setState(newState);
        setShowBanner(false);
      } else {
        // Refus du prompt natif → compter comme un dismiss
        handleDismiss();
      }
    } catch (err) {
      console.warn('[PWA] Install prompt error:', err);
    } finally {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    const currentState = loadState();
    const newState: PwaInstallState = {
      ...currentState,
      dismissedCount: currentState.dismissedCount + 1,
      lastDismissedAt: Date.now(),
    };
    saveState(newState);
    setState(newState);
    setShowBanner(false);
  };

  // Si déjà installé ou pas de prompt disponible → ne rien afficher
  if (!showBanner || !deferredPrompt || state?.installed) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-labelledby="pwa-install-title"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:bottom-4 sm:w-96 z-50 animate-in slide-in-from-bottom-4 duration-300"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Smartphone className="w-5 h-5" />
            <span id="pwa-install-title" className="font-bold text-sm">
              Installer l'application
            </span>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Fermer"
            className="text-white/80 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm text-slate-700 mb-3">
            Installez le site de notre école sur votre appareil pour un accès rapide, même hors ligne.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleInstall}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-2 px-3 rounded-lg transition"
            >
              <Download className="w-4 h-4" />
              Installer
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 text-sm font-medium rounded-lg transition"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
