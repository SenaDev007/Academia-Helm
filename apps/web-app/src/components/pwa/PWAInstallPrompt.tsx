'use client';

/**
 * ============================================================================
 * PWA INSTALL PROMPT — Petite bannière d'installation (coin bas droit)
 * ============================================================================
 *
 * ⭐ Exigence utilisateur (2026-09) : « Pas de modal avec instructions qui
 *    n'installe rien. Une PETITE BANNIÈRE en bas dans le coin droit sur PC,
 *    pareil sur téléphone. Quand on clique sur "Installer", que ça installe
 *    DIRECTEMENT. »
 *
 * Comportement :
 *   - Bannière compacte (pas de fond bloquant, pas de modal) :
 *       • PC/tablette large → coin bas droit (max-w-[360px])
 *       • Mobile → barre pleine largeur ancrée en bas
 *   - Bouton « Installer » :
 *       • Chromium (Chrome/Edge/Brave/Opera, desktop + Android) → déclenche
 *         le prompt natif via beforeinstallprompt → installation DIRECTE
 *       • iOS Safari (pas d'API programmatique) → la bannière se déplie en
 *         3 mini-étapes intégrées (Partager → Sur l'écran d'accueil →
 *         Ajouter) — jamais de modal séparé
 *       • Chromium sans prompt capté (heuristiques pas encore déclenchées)
 *         → même dépliage compact (icône ⊕ barre d'adresse / menu ⋮)
 *
 * DISMISS (2 niveaux) :
 *   - ✕ / Échap → snooze gradué 3j/3j/7j/14j/30j
 *   - « Ne plus demander » (lien discret) → skip PERMANENT (localStorage)
 *
 * Garde-fous :
 *   - Déjà installé (standalone) → jamais affiché
 *   - ⭐ Coquille native Capacitor (app Android) → jamais affiché (l'app est
 *     DÉJÀ installée — la bannière serait absurde dans le WebView)
 *   - Firefox desktop (non installable) → jamais affiché
 *   - Une seule apparition par session navigateur (sessionStorage)
 *   - beforeinstallprompt écouté en continu (PWARegister capture tôt et
 *     expose window.__ahPwaDeferredPrompt + événement ah-install-available)
 *
 * Bilingue FR/EN via useL().
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Download,
  X,
  Share,
  Smartphone,
  PlusSquare,
  Monitor,
  Tablet,
  ExternalLink,
  MoreVertical,
} from 'lucide-react';
import { useL } from '@/lib/i18n/bilingual';
import { isNativeApp } from '@/lib/pwa/is-native-app';

const STORAGE_KEY = 'ah_pwa_prompt_v3';
const SESSION_KEY = 'ah_pwa_prompt_shown_v3';

/** Délai avant l'apparition de la bannière (après le chargement). */
const SHOW_DELAY_MS = 3500;

/** Délais de re-prompt après chaque fermeture (en jours), plafonné au dernier. */
const RE_PROMPT_DAYS = [3, 3, 7, 14, 30];

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PromptState {
  dismissCount?: number;
  lastDismissedAt?: number;
  installed?: boolean;
  skipped?: boolean;
}

type DeviceType = 'mobile' | 'tablet' | 'desktop';
type BrowserType = 'chrome' | 'edge' | 'firefox' | 'safari' | 'samsung' | 'other';

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

function readSessionShown(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function markSessionShown() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {}
}

/** Détecte iOS (iPhone/iPad, Safari et Chrome iOS inclus). */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIpad =
    /iPad/.test(ua) ||
    (/Macintosh/.test(ua) &&
      typeof navigator.maxTouchPoints === 'number' &&
      navigator.maxTouchPoints > 1);
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

/** Type d'appareil — pour l'icône et le wording de la bannière. */
function detectDevice(): DeviceType {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  const isTablet =
    /iPad|Tablet|PlayBook|Silk/i.test(ua) ||
    (/Android/i.test(ua) && !/Mobile/i.test(ua));
  if (isTablet) return 'tablet';
  if (/iPhone|iPod|(Android.*Mobile)|BlackBerry|Opera Mini|IEMobile/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

/** Navigateur — pour adapter les mini-étapes de secours. */
function detectBrowser(): BrowserType {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/Firefox\//i.test(ua) && !/Seamonkey/i.test(ua)) return 'firefox';
  if (/SamsungBrowser\//i.test(ua)) return 'samsung';
  if (/Edg\//i.test(ua)) return 'edge';
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return 'chrome'; // Opera = Chromium
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return 'chrome';
  if (/Safari\//i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg/i.test(ua)) {
    return 'safari';
  }
  return 'other';
}

/** Le navigateur permet-il D'INSTALLER une PWA sur cet appareil ?
 *  (Firefox desktop ne le permet pas → pas de bannière). */
function canInstallPWA(device: DeviceType, browser: BrowserType): boolean {
  if (device === 'mobile' || device === 'tablet') return true; // iOS + Android : toujours un chemin
  // Desktop : tout sauf Firefox (Safari ≥ 17 → « Ajouter au Dock »)
  return browser !== 'firefox';
}

// ─── Composant principal ────────────────────────────────────────────────────

export function PWAInstallPrompt({ appName = 'Academia Helm' }: { appName?: string }) {
  const L = useL();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [installed, setInstalled] = useState(false);
  // Bannière dépliée : mini-étapes d'installation intégrées (iOS / prompt
  // natif non encore disponible) — JAMAIS un modal séparé.
  const [expanded, setExpanded] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [ios, setIos] = useState(false);
  const [browser, setBrowser] = useState<BrowserType>('other');

  // ─── Détection + logique d'apparition ───────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // ⭐ COQUILLE NATIVE Capacitor (app Android) : l'application est déjà
    //    installée — aucune bannière d'installation, jamais, sur aucune page.
    if (isNativeApp()) return;

    const standalone = isStandalone();
    if (standalone) {
      setInstalled(true);
      writeState({ ...readState(), installed: true });
      return;
    }

    const detectedDevice = detectDevice();
    const detectedBrowser = detectBrowser();
    setDevice(detectedDevice);
    setBrowser(detectedBrowser);
    setIos(isIOS());

    // Firefox desktop → aucune possibilité d'installation → jamais de bannière
    if (!canInstallPWA(detectedDevice, detectedBrowser)) return;

    // Skip permanent (« Ne plus demander »)
    const state = readState();
    if (state.installed || state.skipped) {
      if (state.installed) setInstalled(true);
      return;
    }

    // Snooze gradué (fermeture simple)
    if (state.lastDismissedAt) {
      const dismissCount = state.dismissCount || 0;
      const delayDays =
        RE_PROMPT_DAYS[Math.min(dismissCount - 1, RE_PROMPT_DAYS.length - 1)] ?? 7;
      const elapsed = Date.now() - state.lastDismissedAt;
      if (elapsed < delayDays * 24 * 60 * 60 * 1000) return; // Pas encore
    }

    // Une seule apparition par session
    if (readSessionShown()) return;

    // ⭐ Prompt déjà capturé par PWARegister (monté plus tôt dans l'arbre) ?
    const globalPrompt = (window as any).__ahPwaDeferredPrompt as
      | BeforeInstallPromptEvent
      | undefined;
    if (globalPrompt) setDeferredPrompt(globalPrompt);

    // ⭐ Nouveaux prompts natifs (arrivent selon les heuristiques Chrome —
    //    même APRÈS l'affichage de la bannière : le bouton devient direct)
    const handleBeforeInstallPrompt = (e: Event) => {
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleCustomAvailable = (e: Event) => {
      setDeferredPrompt((e as CustomEvent).detail as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('ah-install-available', handleCustomAvailable as EventListener);

    // ⭐ Apparition de la bannière après SHOW_DELAY_MS (desktop + mobile)
    const showTimer = setTimeout(() => {
      setShowBanner(true);
      markSessionShown();
    }, SHOW_DELAY_MS);

    // ⭐ Installation effective (marque installed + cache)
    const handleInstalled = () => {
      setInstalled(true);
      setShowBanner(false);
      setExpanded(false);
      writeState({ ...readState(), installed: true });
    };
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('ah-installed', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('ah-install-available', handleCustomAvailable as EventListener);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('ah-installed', handleInstalled);
      clearTimeout(showTimer);
    };
  }, []);

  // ─── Échap = fermer la bannière ─────────────────────────────────────────
  useEffect(() => {
    if (!showBanner) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBanner]);

  /** ✕ / Échap → snooze gradué. */
  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    setExpanded(false);
    const state = readState();
    writeState({
      ...state,
      dismissCount: (state.dismissCount || 0) + 1,
      lastDismissedAt: Date.now(),
    });
  }, []);

  /** « Ne plus demander » → skip permanent. */
  const handleSkipForever = useCallback(() => {
    setShowBanner(false);
    setExpanded(false);
    writeState({ ...readState(), skipped: true });
  }, []);

  /** « Installer » → installation DIRECTE via le prompt natif si dispo.
   *  Sinon : dépliage compact des mini-étapes (iOS, prompt non capté). */
  const handleInstall = useCallback(async () => {
    // Re-vérifier le prompt global (peut être arrivé entre-temps)
    const prompt =
      deferredPrompt ||
      ((window as any).__ahPwaDeferredPrompt as BeforeInstallPromptEvent | undefined) ||
      null;

    if (prompt) {
      try {
        setInstalling(true);
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstalled(true);
          writeState({ ...readState(), installed: true });
          setShowBanner(false);
        } else {
          handleDismiss(); // refus dans le dialog natif = snooze
        }
      } catch {
        handleDismiss();
      } finally {
        setInstalling(false);
        setDeferredPrompt(null);
        if ((window as any).__ahPwaDeferredPrompt) {
          delete (window as any).__ahPwaDeferredPrompt;
        }
      }
      return;
    }
    // iOS / prompt natif pas encore disponible → mini-étapes intégrées
    setExpanded((prev) => !prev);
  }, [deferredPrompt, handleDismiss]);

  if (installed || !showBanner) return null;

  const DeviceIcon =
    device === 'mobile' ? Smartphone : device === 'tablet' ? Tablet : Monitor;

  const title = L(`Installer ${appName}`, `Install ${appName}`);
  const benefit =
    device === 'mobile'
      ? L(
          'Application sur votre écran d\u2019accueil — rapide, même hors connexion.',
          'App on your home screen — fast, even offline.',
        )
      : L(
          'Fenêtre dédiée, lancement rapide — comme une vraie application.',
          'Dedicated window, quick launch — like a real app.',
        );

  return (
    <div
      role="region"
      aria-label={title}
      // ─── Petite bannière : coin bas droit (PC) / bas pleine largeur (mobile)
      className="fixed z-[9998] bottom-3 right-3 left-3 sm:left-auto sm:bottom-4 sm:right-4 animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      <div className="bg-white sm:max-w-[360px] rounded-2xl shadow-2xl border border-slate-200/70 overflow-hidden">
        <div className="relative p-3.5 sm:p-4">
          {/* ✕ fermeture */}
          <button
            onClick={handleDismiss}
            aria-label={L('Fermer', 'Close')}
            className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full p-1.5 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-center gap-3 pr-6">
            {/* Icône app */}
            <div className="relative shrink-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-[#0D1F6E] to-[#1E40AF] flex items-center justify-center shadow-md shadow-[#0D1F6E]/25">
                <DeviceIcon className="h-5 w-5 text-white" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                <Download className="h-3 w-3 text-[#0D1F6E]" />
              </span>
            </div>

            {/* Titre + bénéfice — bénéfice masqué < sm : bannière mobile
                ultra-compacte (~64px) pour ne pas recouvrir le contenu */}
            <div className="min-w-0 flex-1">
              <h3
                title={title}
                className="text-sm font-bold text-slate-900 leading-snug line-clamp-1"
              >
                {title}
              </h3>
              <p className="hidden sm:block text-[11px] sm:text-xs leading-snug text-slate-500 mt-0.5 line-clamp-2">
                {benefit}
              </p>
            </div>

            {/* Bouton Installer — installation DIRECTE (prompt natif) */}
            <button
              onClick={handleInstall}
              disabled={installing}
              className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#0D1F6E] text-white rounded-xl font-bold text-xs sm:text-sm hover:bg-[#0D1F6E]/90 active:scale-[0.98] transition-all shadow-md shadow-[#0D1F6E]/20 disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5" />
              {installing
                ? L('Installation…', 'Installing…')
                : L('Installer', 'Install')}
            </button>
          </div>

          {/* ─── Mini-étapes intégrées (iOS / prompt non capté) — PAS de modal ─── */}
          {expanded && (
            <div className="mt-3 pt-3 border-t border-slate-100 animate-in fade-in slide-in-from-top-1 duration-200">
              <p className="text-[11px] font-semibold text-slate-600 mb-2">
                {ios
                  ? L('Sur iPhone / iPad :', 'On iPhone / iPad:')
                  : L(
                      'Installation manuelle (le navigateur n\u2019a pas encore proposé l\u2019installation directe) :',
                      'Manual install (your browser has not offered direct install yet):',
                    )}
              </p>
              <ol className="space-y-1.5 text-left">
                {ios ? (
                  <>
                    <MiniStep
                      text={L('Appuyez sur', 'Tap')}
                      icon={<Share className="h-3.5 w-3.5 mx-0.5 text-[#007AFF]" />}
                      suffix={L('(Partager)', '(Share)')}
                    />
                    <MiniStep
                      text={L('Puis', 'Then')}
                      icon={<PlusSquare className="h-3.5 w-3.5 mx-0.5 text-[#007AFF]" />}
                      suffix={L('« Sur l\u2019écran d\u2019accueil »', '"Add to Home Screen"')}
                    />
                  </>
                ) : (
                  <>
                    <MiniStep
                      text={L(
                        'Cliquez sur l\u2019icône d\u2019installation dans la barre d\u2019adresse',
                        'Click the install icon in the address bar',
                      )}
                      icon={<ExternalLink className="h-3.5 w-3.5 mx-0.5 text-[#0D1F6E] rotate-45" />}
                    />
                    <MiniStep
                      text={L('Ou menu', 'Or menu')}
                      icon={<MoreVertical className="h-3.5 w-3.5 mx-0.5 text-slate-500" />}
                      suffix={
                        browser === 'edge'
                          ? L('→ Applications → Installer', '→ Apps → Install')
                          : L(`→ « Installer ${appName} »`, `→ "Install ${appName}"`)
                      }
                    />
                  </>
                )}
              </ol>
              {/* Lien discret skip permanent */}
              <button
                onClick={handleSkipForever}
                className="mt-2.5 text-[10px] text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
              >
                {L('Ne plus proposer l\u2019installation', 'Don\u2019t ask again')}
              </button>
            </div>
          )}

          {/* Skip permanent (bannière compacte, non dépliée) — sm+ uniquement :
              la bannière mobile compacte n'a pas la place (dispo dépliée) */}
          {!expanded && (
            <button
              onClick={handleSkipForever}
              className="hidden sm:block absolute bottom-1 right-2 text-[10px] text-slate-300 hover:text-slate-500 transition-colors"
              aria-label={L('Ne plus demander', 'Don\u2019t ask again')}
            >
              {L('Ne plus demander', 'Don\u2019t ask again')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Mini-étape compacte intégrée à la bannière (remplace l'ancien modal). */
function MiniStep({
  text,
  icon,
  suffix,
}: {
  text: string;
  icon?: React.ReactNode;
  suffix?: string;
}) {
  return (
    <li className="flex items-center flex-wrap gap-x-0.5 text-[11px] text-slate-600">
      <span>{text}</span>
      {icon}
      {suffix && <span className="font-semibold">{suffix}</span>}
    </li>
  );
}
