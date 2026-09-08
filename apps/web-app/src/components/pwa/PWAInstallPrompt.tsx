'use client';

/**
 * ============================================================================
 * PWA INSTALL PROMPT — Popup d'installation (desktop, tablette, mobile)
 * ============================================================================
 *
 * ⭐ Exigence utilisateur : « un petit popup pour demander d'installer
 *    (desktop, tablette et mobile) avec possibilité de skip ».
 *
 * Le popup s'affiche PROACTIVEMENT (≈ 3,5 s après le chargement) sur tout
 * appareil dont le navigateur permet d'installer la PWA — sans attendre les
 * heuristiques de Chrome (beforeinstallprompt) :
 *
 *   ┌──────────────┬──────────────────────────────────────────────────────┐
 *   │ Appareil     │ Comportement du bouton « Installer »                │
 *   ├──────────────┼──────────────────────────────────────────────────────┤
 *   │ Desktop      │ Chrome/Edge/Brave/Opera → prompt natif (ou menu ⋮)  │
 *   │              │ Safari 17+ (macOS)  → instructions « Ajouter au Dock »│
 *   │              │ Firefox            → AUCUN popup (non installable)   │
 *   ├──────────────┼──────────────────────────────────────────────────────┤
 *   │ Tablette     │ iPad → instructions iOS · Android → prompt natif    │
 *   │              │ (ou menu selon navigateur)                           │
 *   ├──────────────┼──────────────────────────────────────────────────────┤
 *   │ Mobile       │ Android → prompt natif (ou menu) · iPhone →         │
 *   │              │ instructions « Sur l'écran d'accueil »               │
 *   └──────────────┴──────────────────────────────────────────────────────┘
 *
 * SKIP (2 niveaux) :
 *   - « Plus tard » / ✕ / Échap / clic fond → snooze gradué 3j/3j/7j/14j/30j
 *   - « Ne plus demander » → skip PERMANENT (localStorage, jusqu'à
 *     désinstallation des données du site)
 *
 * Garde-fous :
 *   - Déjà installé (standalone) → jamais affiché
 *   - Une seule apparition par session navigateur (sessionStorage)
 *   - beforeinstallprompt écouté en continu : si le prompt natif arrive
 *     pendant que le popup est ouvert, le bouton bascule automatiquement
 *     en installation native.
 *
 * Bilingue FR/EN via useL() — suit la locale du profil (piste anglophone).
 *
 * Props :
 *   - appName : nom affiché (ex: nom de l'école sur son sous-domaine)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Download,
  X,
  Share,
  Smartphone,
  PlusSquare,
  CheckCircle2,
  Monitor,
  Tablet,
  Menu,
  MoreVertical,
  ExternalLink,
} from 'lucide-react';
import { useL } from '@/lib/i18n/bilingual';

const STORAGE_KEY = 'ah_pwa_prompt_v3';
const SESSION_KEY = 'ah_pwa_prompt_shown_v3';

/** Délai avant l'apparition du popup (assez tôt pour être vu, assez tard
 *  pour ne pas perturber la lecture de la page). */
const SHOW_DELAY_MS = 3500;

/** Délais de re-prompt après chaque « Plus tard » (en jours), plafonné au dernier. */
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
  // iPadOS 13+ se présente comme Mac — vérifier le multi-touch
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

/** Type d'appareil — pour l'icône et le wording du popup. */
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

/** Navigateur — pour adapter les instructions d'installation manuelle. */
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
 *  (Firefox desktop ne le permet pas → pas de popup). */
function canInstallPWA(device: DeviceType, browser: BrowserType): boolean {
  if (device === 'mobile' || device === 'tablet') return true; // iOS + Android : toujours un chemin
  // Desktop : tout sauf Firefox (Safari ≥ 17 → « Ajouter au Dock »)
  return browser !== 'firefox';
}

// ─── Composant principal ────────────────────────────────────────────────────

export function PWAInstallPrompt({ appName = 'Academia Helm' }: { appName?: string }) {
  const L = useL();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [ios, setIos] = useState(false);
  const [browser, setBrowser] = useState<BrowserType>('other');
  const primaryBtnRef = useRef<HTMLButtonElement | null>(null);

  // ─── Détection + logique d'apparition ───────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const standalone = isStandalone();
    if (standalone) {
      setInstalled(true);
      writeState({ ...readState(), installed: true });
      return;
    }

    const detectedDevice = detectDevice();
    const detectedBrowser = detectBrowser();
    const onIOS = isIOS();
    setDevice(detectedDevice);
    setBrowser(detectedBrowser);
    setIos(onIOS);

    // Firefox desktop → aucune possibilité d'installation → jamais de popup
    if (!canInstallPWA(detectedDevice, detectedBrowser)) return;

    // Skip permanent (« Ne plus demander »)
    const state = readState();
    if (state.installed || state.skipped) {
      if (state.installed) setInstalled(true);
      return;
    }

    // Snooze gradué (« Plus tard »)
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
    //    même APRÈS l'ouverture du popup : le bouton bascule en natif)
    const handleBeforeInstallPrompt = (e: Event) => {
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleCustomAvailable = (e: Event) => {
      setDeferredPrompt((e as CustomEvent).detail as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('ah-install-available', handleCustomAvailable as EventListener);

    // ⭐ Apparition proactive après SHOW_DELAY_MS (desktop + tablette + mobile)
    const showTimer = setTimeout(() => {
      setShowPopup(true);
      markSessionShown();
    }, SHOW_DELAY_MS);

    // ⭐ Installation effective (marque installed + cache)
    const handleInstalled = () => {
      setInstalled(true);
      setShowPopup(false);
      setShowInstructions(false);
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

  // ─── Focus sur le bouton principal à l'ouverture ────────────────────────
  useEffect(() => {
    if (showPopup && !installed) {
      primaryBtnRef.current?.focus();
    }
  }, [showPopup, installed]);

  // ─── Échap = snooze ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!showPopup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPopup]);

  /** « Plus tard » / ✕ / Échap / clic sur le fond → snooze gradué. */
  const handleDismiss = useCallback(() => {
    setShowPopup(false);
    setShowInstructions(false);
    const state = readState();
    writeState({
      ...state,
      dismissCount: (state.dismissCount || 0) + 1,
      lastDismissedAt: Date.now(),
    });
  }, []);

  /** « Ne plus demander » → skip permanent. */
  const handleSkipForever = useCallback(() => {
    setShowPopup(false);
    setShowInstructions(false);
    writeState({ ...readState(), skipped: true });
  }, []);

  /** « Installer » → prompt natif si dispo, sinon instructions adaptées. */
  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      // Chrome/Edge/Brave/Opera (desktop + Android) → prompt natif
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setInstalled(true);
          writeState({ ...readState(), installed: true });
          setShowPopup(false);
        } else {
          handleDismiss(); // refus dans le dialog natif = snooze
        }
      } catch {
        handleDismiss();
      }
      setDeferredPrompt(null);
      return;
    }
    // iOS / navigateurs sans API programmatique → instructions pas-à-pas
    setShowInstructions(true);
  }, [deferredPrompt, handleDismiss]);

  /** Fin des instructions → snooze (l'utilisateur suit les étapes de son côté). */
  const handleInstructionsDone = useCallback(() => {
    setShowInstructions(false);
    setShowPopup(false);
    const state = readState();
    writeState({
      ...state,
      dismissCount: (state.dismissCount || 0) + 1,
      lastDismissedAt: Date.now(),
    });
  }, []);

  if (installed || !showPopup) return null;

  const DeviceIcon =
    device === 'mobile' ? Smartphone : device === 'tablet' ? Tablet : Monitor;

  // ─── Rendu ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* ═══ Petit popup : carte centrée (desktop) / bottom-sheet (mobile) ═══ */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={L(`Installer ${appName}`, `Install ${appName}`)}
        className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={handleDismiss}
      >
        <div
          className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200/60 overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 sm:slide-in-from-bottom-0 duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Barre de tir (mobile) */}
          <div className="sm:hidden flex justify-center pt-2.5 pb-0.5">
            <span className="w-10 h-1 rounded-full bg-slate-300" />
          </div>

          <div className="relative p-5 sm:p-6">
            {/* ✕ (desktop uniquement — mobile a « Plus tard » + fond cliquable) */}
            <button
              onClick={handleDismiss}
              aria-label={L('Fermer', 'Close')}
              className="absolute hidden sm:block top-3.5 right-3.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full p-1.5 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-4">
              {/* Icône app (icône de l'appareil + badge download) */}
              <div className="relative shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0D1F6E] to-[#1E40AF] flex items-center justify-center shadow-lg shadow-[#0D1F6E]/25">
                  <DeviceIcon className="h-7 w-7 text-white" />
                </div>
                <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                  <Download className="h-3.5 w-3.5 text-[#0D1F6E]" />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                  {L(`Installer ${appName}`, `Install ${appName}`)}
                </h3>
                <p className="text-[13px] leading-relaxed text-slate-500 mt-1">
                  {device === 'mobile'
                    ? L(
                        'Sur votre écran d\u2019accueil, comme une vraie application — rapide, même avec une connexion faible.',
                        'On your home screen, like a real app — fast, even on a weak connection.',
                      )
                    : L(
                        'Comme une vraie application sur votre ordinateur : fenêtre dédiée, lancement rapide, même hors ligne.',
                        'Like a real app on your computer: dedicated window, quick launch, even offline.',
                      )}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 flex flex-col gap-2">
              <button
                ref={primaryBtnRef}
                onClick={handleInstall}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0D1F6E] text-white rounded-xl font-bold text-sm hover:bg-[#0D1F6E]/90 active:scale-[0.99] transition-all shadow-md shadow-[#0D1F6E]/20"
              >
                <Download className="h-4 w-4" />
                {L('Installer maintenant', 'Install now')}
              </button>
              <button
                onClick={handleDismiss}
                className="w-full px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold transition-colors"
              >
                {L('Plus tard', 'Maybe later')}
              </button>
              {/* ⭐ Skip permanent */}
              <button
                onClick={handleSkipForever}
                className="mt-0.5 text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
              >
                {L('Ne plus demander', 'Don\u2019t ask again')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Modal d'instructions (iOS + navigateurs sans prompt natif) ═══ */}
      {showInstructions && (
        <InstallInstructions
          appName={appName}
          device={device}
          browser={browser}
          ios={ios}
          onDone={handleInstructionsDone}
        />
      )}
    </>
  );
}

// ─── Instructions pas-à-pas adaptées au navigateur/appareil ─────────────────

function InstallInstructions({
  appName,
  device,
  browser,
  ios,
  onDone,
}: {
  appName: string;
  device: DeviceType;
  browser: BrowserType;
  ios: boolean;
  onDone: () => void;
}) {
  const L = useL();

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onDone}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-sm w-full p-6 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#0D1F6E]/10 flex items-center justify-center mb-3">
            {ios ? (
              <Smartphone className="h-7 w-7 text-[#0D1F6E]" />
            ) : (
              <Download className="h-7 w-7 text-[#0D1F6E]" />
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {ios
              ? L('Installer sur iPhone / iPad', 'Install on iPhone / iPad')
              : L(`Installer ${appName}`, `Install ${appName}`)}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {L('Suivez ces étapes :', 'Follow these steps:')}
          </p>
        </div>

        {ios ? (
          <ol className="space-y-4 text-left">
            <InstructionStep
              n={1}
              text={L('Appuyez sur le bouton', 'Tap the')}
              icon={<Share className="h-5 w-5 text-[#007AFF] mx-1" />}
              suffix={L('(Partager)', '(Share)')}
            />
            <InstructionStep
              n={2}
              text={L('Faites défiler puis choisissez', 'Scroll down and choose')}
              suffix={L('« Sur l\u2019écran d\u2019accueil »', '"Add to Home Screen"')}
              icon={<PlusSquare className="h-4 w-4 inline-block mx-1 text-[#007AFF]" />}
            />
            <InstructionStep
              n={3}
              text={L('Confirmez avec', 'Confirm with')}
              suffix={L('« Ajouter »', '"Add"')}
            />
          </ol>
        ) : (
          <ol className="space-y-4 text-left">
            {browser === 'safari' && device === 'desktop' ? (
              <>
                <InstructionStep
                  n={1}
                  text={L('Dans la barre de menus, ouvrez', 'In the menu bar, open')}
                  suffix={L('« Fichier »', '"File"')}
                />
                <InstructionStep
                  n={2}
                  text={L('Choisissez', 'Choose')}
                  suffix={L('« Ajouter au Dock »', '"Add to Dock"')}
                />
              </>
            ) : device === 'desktop' ? (
              <>
                <InstructionStep
                  n={1}
                  text={L(
                    'Cliquez sur l\u2019icône d\u2019installation dans la barre d\u2019adresse',
                    'Click the install icon in the address bar',
                  )}
                  icon={<ExternalLink className="h-4 w-4 inline-block mx-1 text-[#0D1F6E] rotate-45" />}
                />
                <InstructionStep
                  n={2}
                  text={L('Ou ouvrez le menu', 'Or open the browser menu')}
                  icon={<MoreVertical className="h-4 w-4 inline-block mx-1 text-slate-600" />}
                  suffix={browser === 'edge'
                    ? L('→ Applications → « Installer ce site comme application »', '→ Apps → "Install this site as an app"')
                    : L(`→ « Installer ${appName} »`, `→ "Install ${appName}"`)}
                />
              </>
            ) : (
              <>
                <InstructionStep
                  n={1}
                  text={L('Ouvrez le menu du navigateur', 'Open the browser menu')}
                  icon={<Menu className="h-4 w-4 inline-block mx-1 text-slate-600" />}
                  suffix={browser === 'firefox' || browser === 'samsung' ? L('(⋮ ou ⋯)', '(⋮ or ⋯)') : '(⋮)'}
                />
                <InstructionStep
                  n={2}
                  text={L('Choisissez', 'Choose')}
                  suffix={
                    browser === 'firefox'
                      ? L('« Ajouter à l\u2019écran d\u2019accueil »', '"Add to Home Screen"')
                      : L('« Installer l\u2019application »', '"Install app"')
                  }
                />
              </>
            )}
          </ol>
        )}

        <button
          onClick={onDone}
          className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0D1F6E] text-white rounded-xl font-bold text-sm hover:bg-[#0D1F6E]/90 transition-colors"
        >
          <CheckCircle2 className="h-4 w-4" />
          {L('C\u2019est fait', 'Done')}
        </button>
      </div>
    </div>
  );
}

function InstructionStep({
  n,
  text,
  suffix,
  icon,
}: {
  n: number;
  text: string;
  suffix?: string;
  icon?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="w-7 h-7 rounded-full bg-[#0D1F6E] text-white flex items-center justify-center text-xs font-bold shrink-0">
        {n}
      </span>
      <div className="flex items-center flex-wrap gap-x-1 text-sm text-slate-700 pt-1">
        <span>{text}</span>
        {icon}
        {suffix && <span className="font-semibold">{suffix}</span>}
      </div>
    </li>
  );
}
