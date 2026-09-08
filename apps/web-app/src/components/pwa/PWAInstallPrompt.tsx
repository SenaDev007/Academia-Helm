'use client';

/**
 * ============================================================================
 * PWA INSTALL PROMPT — Bannière d'installation (site + app)
 * ============================================================================
 *
 * Affiche une bannière discrète en bas à droite permettant d'installer la
 * PWA (site institutionnel ou application, selon le manifest lié à la page).
 *
 * Compatibilité :
 *   - Chrome / Edge / Brave (desktop + Android) : beforeinstallprompt →
 *     bouton "Installer" natif via prompt()
 *   - iOS Safari (iPhone/iPad) : pas d'API programmatique → bannière qui
 *     ouvre un modal d'instructions (Partager → "Sur l'écran d'accueil")
 *   - Firefox / desktop Safari : pas d'installation PWA → aucune bannière
 *
 * Re-prompt gradué après refus : 3j, 3j, 7j, 14j, 30j (puis 30j max).
 *
 * Props :
 *   - appName : nom affiché dans la bannière (ex: nom de l'école)
 * ============================================================================
 */

import { useEffect, useState, useCallback } from 'react';
import { Download, X, Monitor, Share, Iphone, PlusSquare, CheckCircle2, Smartphone } from 'lucide-react';

const STORAGE_KEY = 'ah_pwa_prompt_v2';

/** Délais de re-prompt après chaque refus (en jours), plafonné au dernier. */
const RE_PROMPT_DAYS = [3, 3, 7, 14, 30];

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PromptState {
  dismissCount?: number;
  lastDismissedAt?: number;
  installed?: boolean;
}

function readState(): PromptState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeState(state: PromptState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

/** Détecte iOS (iPhone/iPad, Safari et Chrome iOS inclus). */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ se présente comme Mac — vérifier le multi-touch
  const isIpad = /iPad/.test(ua) || (/Macintosh/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1);
  return /iPhone|iPod/.test(ua) || isIpad;
}

/** Déjà installé / affiché en standalone ? */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (navigator as any).standalone === true
  );
}

export function PWAInstallPrompt({ appName = 'Academia Helm' }: { appName?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const standalone = isStandalone();
    const onIOS = isIOS();

    if (standalone) {
      setInstalled(true);
      writeState({ ...readState(), installed: true });
      return;
    }

    setIos(onIOS);

    // Respecter le délai de re-prompt gradué
    const state = readState();
    if (state.installed) {
      setInstalled(true);
      return;
    }
    if (state.lastDismissedAt) {
      const dismissCount = state.dismissCount || 0;
      const delayDays = RE_PROMPT_DAYS[Math.min(dismissCount - 1, RE_PROMPT_DAYS.length - 1)] ?? 7;
      const elapsed = Date.now() - state.lastDismissedAt;
      if (elapsed < delayDays * 24 * 60 * 60 * 1000) return; // Pas encore
    }

    // ⭐ Récupérer un prompt déjà capturé par PWARegister (monté plus tôt)
    const globalPrompt = (window as any).__ahPwaDeferredPrompt as BeforeInstallPromptEvent | undefined;
    if (globalPrompt) {
      setDeferredPrompt(globalPrompt);
      setShowBanner(true);
    }

    // ⭐ Écouter les nouveaux prompts + l'événement custom de PWARegister
    const handleBeforeInstallPrompt = (e: Event) => {
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };
    const handleCustomAvailable = (e: Event) => {
      setDeferredPrompt((e as CustomEvent).detail as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('ah-install-available', handleCustomAvailable as EventListener);

    // ⭐ iOS : pas de beforeinstallprompt — afficher la bannière d'instructions
    // (avec un léger délai pour ne pas perturber la première lecture)
    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (onIOS) {
      iosTimer = setTimeout(() => setShowBanner(true), 2500);
    }

    // ⭐ Détecter l'installation effective
    const handleInstalled = () => {
      setInstalled(true);
      setShowBanner(false);
      writeState({ ...readState(), installed: true });
    };
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('ah-installed', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('ah-install-available', handleCustomAvailable as EventListener);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('ah-installed', handleInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    const state = readState();
    writeState({
      ...state,
      dismissCount: (state.dismissCount || 0) + 1,
      lastDismissedAt: Date.now(),
    });
  }, []);

  const handleInstall = useCallback(async () => {
    // Chrome/Edge/Android → prompt natif
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstalled(true);
          writeState({ ...readState(), installed: true });
        } else {
          handleDismiss();
        }
      } catch {
        handleDismiss();
      }
      setDeferredPrompt(null);
      setShowBanner(false);
      return;
    }
    // iOS → modal d'instructions
    if (ios) {
      setShowIOSModal(true);
    }
  }, [deferredPrompt, ios, handleDismiss]);

  const handleIOSDone = useCallback(() => {
    setShowIOSModal(false);
    setShowBanner(false);
    const state = readState();
    writeState({
      ...state,
      dismissCount: (state.dismissCount || 0) + 1,
      lastDismissedAt: Date.now(),
    });
  }, []);

  if (installed || !showBanner) return null;

  return (
    <>
      {/* ─── Bannière discrète en bas à droite ───────────────────────────── */}
      <div className="fixed bottom-4 right-4 z-[9998] bg-white border border-slate-200 rounded-xl shadow-lg p-4 max-w-xs animate-in fade-in slide-in-from-bottom duration-300">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#0D1F6E]/10 flex items-center justify-center shrink-0">
            {ios ? (
              <Iphone className="h-5 w-5 text-[#0D1F6E]" />
            ) : (
              <Monitor className="h-5 w-5 text-[#0D1F6E]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">
              {ios ? `Installer ${appName}` : `Installer ${appName}`}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {ios
                ? 'Ajoutez l\'application à votre écran d\'accueil'
                : 'Accédez plus rapidement, comme une vraie application'}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleInstall}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0D1F6E] text-white rounded-lg text-xs font-bold hover:bg-[#0D1F6E]/90 transition-colors"
              >
                {ios ? <Smartphone className="h-3 w-3" /> : <Download className="h-3 w-3" />}
                {ios ? 'Comment installer' : 'Installer'}
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
            aria-label="Fermer"
            className="text-slate-400 hover:text-slate-600 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ─── Modal instructions iOS (Partager → Sur l'écran d'accueil) ──── */}
      {showIOSModal && (
        <div
          className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={handleIOSDone}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#0D1F6E]/10 flex items-center justify-center mb-3">
                <Iphone className="h-7 w-7 text-[#0D1F6E]" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Installer sur iPhone / iPad</h3>
              <p className="text-sm text-slate-500 mt-1">
                Suivez ces 3 étapes dans Safari :
              </p>
            </div>

            <ol className="space-y-4 text-left">
              <li className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-[#0D1F6E] text-white flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <div className="flex items-center gap-2 text-sm text-slate-700 pt-0.5">
                  <span>Appuyez sur le bouton</span>
                  <Share className="h-5 w-5 text-[#007AFF] mx-1" />
                  <span>(Partager)</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-[#0D1F6E] text-white flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <div className="text-sm text-slate-700 pt-0.5">
                  Faites défiler puis choisissez
                  <span className="font-semibold"> « Sur l’écran d’accueil »</span>
                  <PlusSquare className="h-4 w-4 inline-block mx-1 text-[#007AFF]" />
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-[#0D1F6E] text-white flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <div className="text-sm text-slate-700 pt-0.5">
                  Confirmez avec <span className="font-semibold">« Ajouter »</span>
                </div>
              </li>
            </ol>

            <button
              onClick={handleIOSDone}
              className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0D1F6E] text-white rounded-xl font-bold text-sm hover:bg-[#0D1F6E]/90 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
              C’est fait
            </button>
          </div>
        </div>
      )}
    </>
  );
}
