/**
 * FederisPublicResultsClient — ⭐ T26 (2026-10-01)
 * Portail PUBLIC PROVISOIRE de consultation des résultats (parents)
 * ═══════════════════════════════════════════════════════════════════════════
 * Page servie sur /federis/resultats/:token (sans compte, sans connexion) —
 * le token fait foi (généré par le patronat à la publication des résultats,
 * durée de vie paramétrable, révocable à tout moment).
 *
 *   1. Écran d'accueil  : examen, session, patronat, stats, expiration du lien ;
 *   2. Recherche        : UN champ unique — nom de l'élève, matricule OU
 *                         numéro de table (insensible casse/accents) ;
 *   3. Fiche résultat   : état civil utile, notes par matière, moyenne, rang,
 *                         mention, DÉCISION FINALE (Admis / Ajourné) et, pour
 *                         le CEP, les décisions « Admis au CEP » + « Admis en
 *                         6ème » (moyenne des matières étoilées ≥ 10/20).
 *
 * ⭐ T31 — en-têtes + animations de succès :
 *   - le bandeau patronat (header du patronat, sous le header Academia de la
 *     page) affiche le LOGO RÉEL du patronat (API → Patronat.logo, repli logo
 *     Academia) — plus d'icône générique lucide ;
 *   - le hero « Consultation des résultats » est refondu : badge succès animé
 *     « Résultats officiellement publiés », entrées en cascade, soulignement
 *     doré animé (shimmer), statistiques en compteur animé (count-up) ;
 *   - la fiche résultat célèbre la réussite : coché dessinée + confettis CSS
 *     quand le candidat est ADMIS.
 *
 * Mobile-first (les parents consultent depuis un téléphone) — aux couleurs
 * institutionnelles Federis (navy / or).
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search,
  Loader2,
  ShieldOff,
  Clock,
  Award,
  Users,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Info,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { fmtNote } from '@/lib/federis/grade-computations';

// ─── Types (réponses API publiques) ─────────────────────────────────────────

interface PublicInfo {
  link: { expiresAt: string; durationHours: number | null };
  exam: {
    code: string;
    name: string;
    examType: string;
    level: string;
    session: string | null;
    academicYearLabel: string | null;
  };
  patronat: {
    name: string;
    abbreviation: string | null;
    /** ⭐ T31 — logo public du patronat (data URL ou https) — null si non configuré. */
    logo: string | null;
    territoryName: string | null;
    country: string | null;
  };
  stats: { totalCandidates: number; admitted: number; failed: number; successRate: number | null };
}

interface ResultLine {
  code: string;
  name: string;
  score: number | null;
  isAbsent: boolean;
  coefficient: number;
  maxScore: number;
  cm: number | null;
  cp: number | null;
  perfectionnement: boolean;
}

interface LookupCandidate {
  matricule: string;
  tableNumber: string | null;
  fullName: string;
  gender: string | null;
  school: string;
  centerName: string | null;
  average: number | null;
  rank: number | null;
  nbEval: number;
  mention: string | null;
  decision: 'ADMIS' | 'AJOURNE' | null;
  decisionLabel: string | null;
  cepAdmission: {
    admisCep: boolean;
    admisSixieme: boolean;
    moyenneEtoiles: number | null;
    matieresEtoiles: number;
  } | null;
  lines: ResultLine[];
}

interface LookupResponse {
  exam: { code: string; name: string; examType: string; session: string | null };
  total: number;
  truncated: boolean;
  results: LookupCandidate[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDateFr(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function extractApiError(err: any, fallback: string): string {
  const msg = err?.response?.data?.message;
  return (Array.isArray(msg) ? msg.join(' ') : msg) ?? fallback;
}

// ─── ⭐ T31 — Animations de succès ───────────────────────────────────────────

/** Compteur animé (easeOutCubic) — démarre à 0 et monte vers `target`. */
function useCountUp(target: number | null | undefined, duration = 1300): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target == null || !Number.isFinite(target) || target <= 0) {
      setValue(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/** Statistique affichée en compteur animé (montée 0 → valeur). */
function CountUpStat({
  value,
  decimals = 0,
  suffix = '',
  className,
}: {
  value: number | null;
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  const v = useCountUp(value);
  const display =
    value == null ? '—' : v.toLocaleString('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  return (
    <span className={className}>
      {display}
      {value != null ? suffix : ''}
    </span>
  );
}

/** Coche de succès DESSINÉE (stroke-dashoffset animé) dans un anneau pulsant. */
function AnimatedSuccessCheck({ className }: { className?: string }) {
  return (
    <span className={cn('relative inline-flex items-center justify-center', className)}>
      {/* Anneau pulsant (aura de succès) */}
      <span className="fed-ring-pulse absolute inset-0 rounded-full" aria-hidden />
      <svg viewBox="0 0 52 52" className="relative w-full h-full" aria-hidden>
        <circle
          cx="26" cy="26" r="24" fill="none"
          stroke="currentColor" strokeWidth="3" opacity="0.25"
        />
        <path
          className="fed-check-draw"
          d="M15 27 L23 35 L38 18"
          fill="none" stroke="currentColor" strokeWidth="4.5"
          strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

// ─── ⭐ T38 — Feux d'artifice (particules canvas) ────────────────────────────

/** Palette institutionnelle des feux d'artifice (or / émeraude / blanc / bleu clair). */
const FIREWORK_COLORS = ['#f5b335', '#fde68a', '#ffffff', '#34d399', '#93c5fd'];

interface FwParticle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
}

interface FwRocket {
  x: number; y: number; vy: number; targetY: number;
  color: string; exploded: boolean;
}

/**
 * Système de feux d'artifice en canvas (aucune dépendance) — utilisé :
 *   • en AMBIANCE continue dans le bandeau hero de la consultation ;
 *   • en SALVE célébration dans l'en-tête du modal quand le candidat est
 *     ADMIS (mode `bursts` : explosions rapprochées pendant ~4 s).
 * Respecte prefers-reduced-motion (canvas inerte) et se met en pause quand
 * l'onglet est masqué.
 */
function FireworksCanvas({
  mode = 'ambient',
  className,
}: {
  mode?: 'ambient' | 'bursts';
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return; // accessibilité : aucune animation
    }

    let width = 0;
    let height = 0;
    let raf = 0;
    let disposed = false;
    const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    const rockets: FwRocket[] = [];
    const particles: FwParticle[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    const spawnExplosion = (x: number, y: number, count: number, power: number) => {
      const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
      const color2 = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
        const speed = power * (0.55 + Math.random() * 0.65);
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 55 + Math.random() * 40,
          color: Math.random() < 0.5 ? color : color2,
          size: 1.4 + Math.random() * 2,
        });
      }
    };

    const spawnRocket = () => {
      rockets.push({
        x: width * (0.12 + Math.random() * 0.76),
        y: height + 6,
        vy: -(height * 0.012) - Math.random() * 2.2,
        targetY: height * (0.16 + Math.random() * 0.42),
        color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
        exploded: false,
      });
    };

    let nextAmbient = 350;
    let elapsed = 0;
    let lastT = performance.now();

    const tick = (now: number) => {
      if (disposed) return;
      const dt = Math.min(50, now - lastT);
      lastT = now;
      elapsed += dt;

      // Programmateurs : ambiance = 1 fusée toutes les ~1,1 s ; salve (waouh)
      // = 3 fusées simultanées toutes les ~650 ms pendant 4 s, puis silence.
      if (mode === 'ambient') {
        nextAmbient -= dt;
        if (nextAmbient <= 0) {
          spawnRocket();
          nextAmbient = 900 + Math.random() * 700;
        }
      } else if (elapsed < 4000) {
        nextAmbient -= dt;
        if (nextAmbient <= 0) {
          spawnRocket();
          spawnRocket();
          if (Math.random() < 0.6) spawnRocket();
          nextAmbient = 520 + Math.random() * 380;
        }
      }

      ctx.clearRect(0, 0, width, height);

      // Fusées montant vers leur cible
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.y += r.vy * (dt / 16.7);
        // Traînée de la fusée
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.28;
        ctx.fillRect(r.x - 0.6, r.y, 1.2, 10);
        if (r.y <= r.targetY) {
          spawnExplosion(r.x, r.y, 26 + Math.floor(Math.random() * 16), 2.6 + Math.random() * 1.4);
          rockets.splice(i, 1);
        }
      }

      // Particules des explosions (gravité + fondu)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt / 16.7;
        if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
        p.x += p.vx * (dt / 16.7);
        p.y += p.vy * (dt / 16.7);
        p.vy += 0.045 * (dt / 16.7); // gravité douce
        p.vx *= 0.985;
        const fade = 1 - p.life / p.maxLife;
        ctx.globalAlpha = Math.max(0, fade) * 0.95;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.6 + 0.4 * fade), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [mode]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}

/** Pluie de confettis CSS (retombée depuis le haut du modal — effet waouh). */
function ConfettiRain() {
  const pieces = Array.from({ length: 26 }, (_, i) => ({
    left: `${(i * 3.8 + Math.random() * 3) % 100}%`,
    delay: `${Math.random() * 900}ms`,
    duration: `${1400 + Math.random() * 1300}ms`,
    size: `${6 + Math.random() * 6}px`,
    color: FIREWORK_COLORS[i % FIREWORK_COLORS.length],
    round: Math.random() < 0.5,
  }));
  return (
    <span className="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden z-20" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="fed-confetti-fall absolute -top-3"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.round ? '9999px' : '2px',
            animationDelay: p.delay,
            animationDuration: p.duration,
          } as React.CSSProperties}
        />
      ))}
    </span>
  );
}

// ─── Composant ──────────────────────────────────────────────────────────────

export default function FederisPublicResultsClient({ token }: { token: string }) {
  const [info, setInfo] = useState<PublicInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  const [term, setTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<LookupResponse | null>(null);
  const [selected, setSelected] = useState<LookupCandidate | null>(null);

  // ── 1. Chargement des infos du lien ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get(`/federis/public/results/${token}`, {
          timeout: 30000,
        });
        if (!cancelled) setInfo(res.data);
      } catch (err: any) {
        if (!cancelled) setLoadError(extractApiError(err, 'Lien de consultation introuvable.'));
      } finally {
        if (!cancelled) setLoadingInfo(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // ── 2. Recherche d'un élève ──────────────────────────────────────────────
  const runSearch = useCallback(async () => {
    const q = term.trim();
    if (q.length < 2) {
      setSearchError('Indiquez au moins 2 caractères : nom, matricule ou numéro de table.');
      return;
    }
    setSearching(true);
    setSearchError(null);
    setSelected(null);
    try {
      const res = await apiClient.get(`/federis/public/results/${token}/lookup`, {
        params: { q },
        timeout: 30000,
      });
      setLookup(res.data);
      // ⭐ T38 — résultat unique → le modal s'ouvre DIRECTEMENT (le parent
      // n'a pas à cliquer une seconde fois sur l'unique candidat trouvé).
      const found = res.data?.results;
      if (Array.isArray(found) && found.length === 1) {
        setSelected(found[0]);
      }
    } catch (err: any) {
      setLookup(null);
      setSearchError(extractApiError(err, 'Recherche impossible — réessayez.'));
    } finally {
      setSearching(false);
    }
  }, [term, token]);

  // ── Écrans d'état ────────────────────────────────────────────────────────

  if (loadingInfo) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-900" />
        <p className="text-sm font-bold text-slate-500">
          Vérification du lien de consultation…
        </p>
      </div>
    );
  }

  if (loadError || !info) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-5 px-4 py-16">
        <span className="w-20 h-20 rounded-3xl bg-red-50 border border-red-100 flex items-center justify-center">
          <ShieldOff className="w-10 h-10 text-red-500" />
        </span>
        <div className="text-center max-w-md space-y-2">
          <h1 className="text-xl font-black text-slate-900">Lien indisponible</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            {loadError ??
              'Ce lien de consultation est introuvable. Vérifiez l’adresse saisie ou contactez le patronat organisateur.'}
          </p>
          <p className="text-[11px] text-slate-400">
            Academia Federis — consultation officielle des résultats d’examens
          </p>
        </div>
      </div>
    );
  }

  const isCep = info.exam.examType === 'CEP';
  // ⭐ T31 — logo du patronat (API) avec repli logo Academia (jamais d'icône
  // générique : l'identité du patronat organisateur reste visible).
  const patronatLogoUrl = info.patronat.logo || '/images/logo-Academia Hub.webp';

  // ── Écran principal ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-white pb-16">
      {/* ⭐ T31 — styles des animations de succès (portée page, préfixe fed-) */}
      <style jsx>{`
        /* Entrées en cascade (logo → badge → titre → chips → stats) */
        @keyframes fedRise {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fed-rise {
          animation: fedRise 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: var(--d, 0ms);
        }
        /* Logo patronat : léger flottement institutionnel */
        @keyframes fedLogoFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .fed-logo-float { animation: fedLogoFloat 5s ease-in-out infinite; }
        /* Halo doré du bandeau : respiration douce */
        @keyframes fedGlowPulse {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.1); }
        }
        .fed-hero-glow { animation: fedGlowPulse 7s ease-in-out infinite; }
        /* Soulignement doré animé du titre (shimmer) */
        @keyframes fedShimmer {
          0% { background-position: -180% 0; }
          100% { background-position: 280% 0; }
        }
        .fed-underline-shimmer {
          background: linear-gradient(
            100deg,
            #f5b335 0%, #fde68a 28%, #ffffff 50%, #fde68a 72%, #f5b335 100%
          );
          background-size: 220% 100%;
          animation: fedShimmer 3.2s linear infinite;
        }
        /* Coche de succès dessinée */
        @keyframes fedCheckDraw {
          from { stroke-dashoffset: 64; }
          to { stroke-dashoffset: 0; }
        }
        .fed-check-draw {
          stroke-dasharray: 64;
          animation: fedCheckDraw 0.55s cubic-bezier(0.65, 0, 0.35, 1) 0.25s both;
        }
        /* Anneau pulsant autour de la coche */
        @keyframes fedRingPulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.55); }
          70% { box-shadow: 0 0 0 14px rgba(255, 255, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
        }
        .fed-ring-pulse { animation: fedRingPulse 1.8s ease-out infinite; }
        /* Confettis (succès — candidat admis) — voyage net : opacité pleine
           pendant 60 % du vol puis fondu, particules 8-13 px avec halo */
        @keyframes fedConfetti {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1) rotate(0deg);
          }
          60% { opacity: 1; }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + var(--cx)), calc(-50% + var(--cy)))
              scale(0.45) rotate(220deg);
          }
        }
        .fed-confetti {
          animation: fedConfetti 1.5s cubic-bezier(0.12, 0.75, 0.35, 1) both;
        }
        /* Cartes : entrée douce + élévation au survol */
        @keyframes fedCardIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fed-card-in { animation: fedCardIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .fed-stat-lift { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .fed-stat-lift:hover { transform: translateY(-3px); box-shadow: 0 12px 28px -12px rgba(11, 47, 115, 0.28); }
        /* ⭐ T38 — MODAL DE RÉSULTAT : entrée de la carte + du fond, pluie de
           confettis, emoji triste (échec) — chute avec rebond puis léger
           balancement en boucle, pulsation du titre « Félicitations ». */
        @keyframes fedModalIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .fed-modal-in { animation: fedModalIn 0.38s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes fedBackdropIn { from { opacity: 0; } to { opacity: 1; } }
        .fed-backdrop-in { animation: fedBackdropIn 0.25s ease-out both; }
        @keyframes fedConfettiFall {
          0% { opacity: 1; transform: translateY(-12px) rotate(0deg); }
          85% { opacity: 1; }
          100% { opacity: 0; transform: translateY(180px) rotate(320deg); }
        }
        .fed-confetti-fall { animation: fedConfettiFall 1.9s cubic-bezier(0.3, 0.6, 0.6, 1) both; }
        @keyframes fedSadDrop {
          0% { opacity: 0; transform: translateY(-30px) scale(0.55); }
          60% { opacity: 1; transform: translateY(5px) scale(1.12); }
          80% { transform: translateY(-3px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fedSadWobble {
          0%, 100% { transform: rotate(-4deg); }
          50% { transform: rotate(4deg); }
        }
        .fed-sad-drop {
          animation: fedSadDrop 1s cubic-bezier(0.34, 1.4, 0.5, 1) both,
                     fedSadWobble 3.2s ease-in-out 1s infinite;
        }
        @keyframes fedCelebratePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .fed-celebrate-pulse { animation: fedCelebratePulse 1.6s ease-in-out 0.6s infinite; transform-origin: center; }
        /* Respect des préférences d'accessibilité */
        @media (prefers-reduced-motion: reduce) {
          .fed-rise, .fed-logo-float, .fed-hero-glow, .fed-underline-shimmer,
          .fed-check-draw, .fed-ring-pulse, .fed-confetti, .fed-card-in,
          .fed-modal-in, .fed-backdrop-in, .fed-confetti-fall, .fed-sad-drop,
          .fed-celebrate-pulse {
            animation: none !important;
          }
          .fed-underline-shimmer { background: #f5b335; }
        }
      `}</style>

      {/* ── ⭐ T31 — Bandeau institutionnel (HEADER DU PATRONAT, conservé et
             refondu : logo réel + animations de succès) ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 text-white">
        {/* ⭐ T38 — FEUX D'ARTIFICE en ambiance continue (particules canvas
            dorées/émeraude/blanches : fusées + explosions) dans le bandeau
            « Consultation des résultats ». */}
        <FireworksCanvas mode="ambient" className="pointer-events-none absolute inset-0 w-full h-full z-[1]" />
        {/* Décor : halos dorés + trame institutionnelle */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="fed-hero-glow absolute -top-24 -right-16 w-72 h-72 rounded-full bg-amber-400/15 blur-3xl" />
          <div className="absolute -bottom-28 left-1/4 w-80 h-80 rounded-full bg-blue-400/10 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />
        </div>

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-10 sm:pb-12 space-y-5 z-10">
          {/* Rangée 1 — LOGO DU PATRONAT (remplace l'icône générique) + identité */}
          <div
            className="fed-rise flex items-center gap-4"
            style={{ '--d': '0ms' } as React.CSSProperties}
          >
            <span className="fed-logo-float relative w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl bg-white shadow-xl ring-1 ring-amber-300/70 flex items-center justify-center shrink-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={patronatLogoUrl}
                alt={`Logo ${info.patronat.name}`}
                className="w-full h-full object-contain p-1.5"
              />
              {/* Éclat doré en coin du logo */}
              <span
                className="pointer-events-none absolute -top-5 -right-5 w-10 h-10 rounded-full bg-amber-300/40 blur-md"
                aria-hidden
              />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
                Academia Federis
              </p>
              <p className="text-sm sm:text-base font-bold leading-snug truncate">
                {info.patronat.name}
                {info.patronat.territoryName ? ` — ${info.patronat.territoryName}` : ''}
              </p>
              {info.patronat.country && (
                <p className="text-[11px] text-blue-200/80 font-medium">{info.patronat.country}</p>
              )}
            </div>
          </div>

          {/* Rangée 2 — Badge succès animé « publiés » */}
          <div
            className="fed-rise"
            style={{ '--d': '120ms' } as React.CSSProperties}
          >
            <span className="inline-flex items-center gap-2.5 rounded-full bg-emerald-400/15 border border-emerald-300/30 px-4 py-1.5 backdrop-blur-sm">
              <span className="relative flex w-2 h-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-400" />
              </span>
              <span className="text-[11px] font-black uppercase tracking-wide text-emerald-200">
                Résultats officiellement publiés
              </span>
            </span>
          </div>

          {/* Rangée 3 — Titre + examen + soulignement doré */}
          <div
            className="fed-rise space-y-3"
            style={{ '--d': '240ms' } as React.CSSProperties}
          >
            <h1 className="text-[27px] sm:text-4xl font-black leading-[1.12] tracking-tight">
              Consultation des résultats
            </h1>
            <div className="fed-underline-shimmer h-[3px] w-44 rounded-full" aria-hidden />
            <p className="text-sm sm:text-[15px] text-blue-100 font-semibold leading-snug">
              {/* ⭐ T38 — rendu DÉFENSIF : n'insérer que de vraies chaînes
                  (l'API renvoyait autrefois un objet session → « [object
                  Object] » ; le fix serveur est fait, ce garde-fou empêche
                  toute régression d'affichage). */}
              {typeof info.exam.name === 'string' ? info.exam.name : ''}
              {typeof info.exam.session === 'string' && info.exam.session ? ` · ${info.exam.session}` : ''}
              {typeof info.exam.academicYearLabel === 'string' && info.exam.academicYearLabel ? ` · ${info.exam.academicYearLabel}` : ''}
            </p>
          </div>

          {/* Rangée 4 — Validité du lien (chip) */}
          <div
            className="fed-rise"
            style={{ '--d': '360ms' } as React.CSSProperties}
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-1.5 backdrop-blur-sm">
              <Clock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="text-[11px] text-blue-100/95 font-semibold">
                Lien de consultation valable jusqu’au{' '}
                <b className="text-white">{fmtDateFr(info.link.expiresAt)}</b>
              </span>
            </span>
          </div>
        </div>

        {/* Liseré doré institutionnel en bas du bandeau */}
        <div
          className="h-1 w-full"
          style={{
            background:
              'linear-gradient(to right, transparent, #f5b335 25%, #fde68a 50%, #f5b335 75%, transparent)',
          }}
          aria-hidden
        />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-5 space-y-6">
        {/* ── ⭐ T31 — Statistiques de la session (compteurs animés) ── */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          <div className="fed-card-in fed-stat-lift bg-white rounded-2xl border border-slate-200 shadow-md px-3 py-3.5 text-center relative overflow-hidden">
            <Users className="w-4 h-4 text-slate-400 mx-auto mb-1.5" />
            <p className="text-lg sm:text-xl font-black text-slate-900 tabular-nums">
              <CountUpStat value={info.stats.totalCandidates} />
            </p>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase">
              Candidats
            </p>
          </div>
          <div
            className="fed-card-in fed-stat-lift bg-white rounded-2xl border border-emerald-100 shadow-md px-3 py-3.5 text-center relative overflow-hidden"
            style={{ animationDelay: '90ms' }}
          >
            <span className="absolute top-0 left-0 right-0 h-[3px] fed-underline-shimmer" aria-hidden />
            <Award className="w-4 h-4 text-emerald-500 mx-auto mb-1.5" />
            <p className="text-lg sm:text-xl font-black text-emerald-700 tabular-nums">
              <CountUpStat value={info.stats.admitted} />
            </p>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase">
              Admis(e)s
            </p>
          </div>
          <div
            className="fed-card-in fed-stat-lift bg-white rounded-2xl border border-amber-100 shadow-md px-3 py-3.5 text-center relative overflow-hidden"
            style={{ animationDelay: '180ms' }}
          >
            <TrendingUp className="w-4 h-4 text-amber-500 mx-auto mb-1.5" />
            <p className="text-lg sm:text-xl font-black text-blue-900 tabular-nums">
              <CountUpStat value={info.stats.successRate} decimals={1} suffix=" %" />
            </p>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase">
              Taux de réussite
            </p>
          </div>
        </div>

        {/* ── Formulaire de recherche (⭐ T38 — TOUJOURS visible : le résultat
            d'un candidat s'affiche désormais dans un MODAL centré, superposé) ── */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-5 sm:p-7 space-y-4">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Vérifier le résultat d’un candidat
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Saisissez le <b>nom de l’élève</b>, son <b>matricule</b> ou son{' '}
                  <b>numéro de table</b> — la recherche ignore la casse et les accents.
                </p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void runSearch();
                }}
                className="flex flex-col sm:flex-row gap-2.5"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="ex. KORA Aline, 26C0001234 ou 045"
                    autoFocus
                    maxLength={120}
                    className="w-full rounded-xl border border-slate-300 pl-10 pr-3.5 py-3 text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="rounded-xl bg-blue-900 px-6 py-3 text-xs font-black uppercase tracking-wide text-white hover:bg-blue-800 disabled:opacity-50 inline-flex items-center justify-center gap-2 shrink-0 transition-colors"
                >
                  {searching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  {searching ? 'Recherche…' : 'Rechercher'}
                </button>
              </form>
              {searchError && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs font-semibold text-amber-800">
                  {searchError}
                </div>
              )}
            </div>

            {/* ── Résultats de recherche ── */}
            {lookup && (
              <div className="space-y-3">
                {lookup.results.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm px-6 py-10 text-center">
                    <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-700">
                      Aucun candidat ne correspond à cette recherche.
                    </p>
                    <p className="text-xs text-slate-500 mt-1.5">
                      Vérifiez l’orthographe du nom, ou essayez le matricule / numéro de
                      table figurant sur la convocation.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      {lookup.total} candidat(s) trouvé(s)
                      {lookup.truncated ? ' — affichage limité aux 20 premiers, précisez la recherche' : ''}
                    </p>
                    {lookup.results.map((c) => (
                      <button
                        key={c.matricule}
                        onClick={() => setSelected(c)}
                        className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-blue-900/40 hover:shadow-md transition-all px-4 sm:px-5 py-4 flex items-center gap-4"
                      >
                        <span
                          className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                            c.decision === 'ADMIS'
                              ? 'bg-emerald-50 text-emerald-600'
                              : c.decision === 'AJOURNE'
                                ? 'bg-red-50 text-red-500'
                                : 'bg-slate-100 text-slate-400',
                          )}
                        >
                          {c.decision === 'ADMIS' ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : c.decision === 'AJOURNE' ? (
                            <XCircle className="w-5 h-5" />
                          ) : (
                            <Info className="w-5 h-5" />
                          )}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-black text-slate-900 truncate">
                            {c.fullName}
                          </span>
                          <span className="block text-[11px] text-slate-500 font-semibold truncate">
                            Matricule {c.matricule}
                            {c.tableNumber ? ` · Table ${c.tableNumber}` : ''}
                            {c.school && c.school !== '—' ? ` · ${c.school}` : ''}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'px-3 py-1.5 rounded-full text-[9px] font-black uppercase shrink-0',
                            c.decision === 'ADMIS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : c.decision === 'AJOURNE'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {c.decision === 'ADMIS'
                            ? 'Admis(e)'
                            : c.decision === 'AJOURNE'
                              ? 'Ajourné(e)'
                              : 'À préciser'}
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

        {/* ── ⭐ T38 — MODAL DE RÉSULTAT : centré à l'écran, par-dessus la page.
            Admis → effets waouh (feux d'artifice + pluie de confettis + coche
            animée + « Félicitations ! ») ; Ajourné → emoji triste animé, tons
            rouges. Toutes les infos clés y sont structurées. ── */}
        {selected && (
          <ResultModal
            key={selected.matricule}
            candidate={selected}
            isCep={isCep}
            onClose={() => setSelected(null)}
          />
        )}

        {/* ── Pied institutionnel ── */}
        <p className="text-center text-[10px] text-slate-400 leading-relaxed pt-2">
          Résultats officiels publiés par {info.patronat.name} — consultation fournie par
          Academia Federis (Academia Helm). En cas d’écart, seul le relevé officiel délivré
          par le patronat fait foi.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ T38 — Modal de résultat d'un candidat (centré à l'écran)
// ═══════════════════════════════════════════════════════════════════════════
// Admis(e)  → effets « waouh » : salves de feux d'artifice (canvas), pluie de
//             confettis, coche dessinée dans un anneau pulsant, « Félicitations ! »
//             en pulsation douce — tout le protocole de célébration.
// Ajourné(e) → effet contrasté et sobre : emoji triste 😞 qui tombe avec un
//             rebond puis se balance doucement, tons rouges, AUCUNE fête.
// Toutes les informations clés y sont structurées : nom et prénoms, école de
// provenance, centre d'examen, numéro de table, matricule, moyenne, rang,
// mention, décisions CEP le cas échéant, notes par matière.
// Fermeture : Escape, clic sur le fond assombri, bouton croix.
// ═══════════════════════════════════════════════════════════════════════════

function ResultModal({
  candidate,
  isCep,
  onClose,
}: {
  candidate: LookupCandidate;
  isCep: boolean;
  onClose: () => void;
}) {
  const admitted = candidate.decision === 'ADMIS';

  // Escape ferme le modal ; le scroll de la page est verrouillé tant que le
  // modal est ouvert (restauration de l'état antérieur au démontage).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Résultat de ${candidate.fullName}`}
    >
      {/* Fond assombri — le clic ferme le modal */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Fermer la fenêtre de résultat"
        onClick={onClose}
        className="fed-backdrop-in absolute inset-0 w-full h-full cursor-default bg-slate-950/70 backdrop-blur-sm"
      />

      {/* Carte centrée (scrollable si l'écran est petit) */}
      <div className="fed-modal-in relative w-full max-w-lg max-h-[92dvh] overflow-y-auto overscroll-contain bg-white rounded-3xl shadow-2xl ring-1 ring-black/10">

        {/* Bouton croix (contraste sur les deux dégradés d'en-tête) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-3 right-3 z-30 w-9 h-9 rounded-full bg-white/25 hover:bg-white/45 backdrop-blur-sm text-white flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ═══ EN-TÊTE : célébration (admis) / compassion (ajourné) ═══ */}
        <div
          className={cn(
            'relative overflow-hidden px-5 sm:px-7 pt-7 pb-6 text-white',
            admitted
              ? 'bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-500'
              : 'bg-gradient-to-br from-red-700 via-red-600 to-red-500',
          )}
        >
          {admitted && (
            <>
              {/* Salves de feux d'artifice + pluie de confettis — le « waouh » */}
              <FireworksCanvas mode="bursts" className="pointer-events-none absolute inset-0 w-full h-full" />
              <ConfettiRain />
            </>
          )}
          <div
            className="pointer-events-none absolute -top-16 -right-10 w-48 h-48 rounded-full bg-white/10 blur-2xl"
            aria-hidden
          />
          <div className="relative flex flex-col items-center text-center gap-1.5 z-10">
            {admitted ? (
              <>
                <span className="relative w-16 h-16 text-white shrink-0">
                  <AnimatedSuccessCheck className="w-16 h-16" />
                </span>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/80 mt-1">
                  Décision du jury
                </p>
                <h2 className="fed-celebrate-pulse text-2xl sm:text-3xl font-black leading-tight">
                  Félicitations !
                </h2>
                <p className="text-base sm:text-lg font-black text-white/95 leading-snug">
                  {candidate.fullName} est admis(e)
                </p>
                {candidate.decisionLabel && (
                  <p className="text-xs text-white/90 font-semibold">{candidate.decisionLabel}</p>
                )}
              </>
            ) : (
              <>
                <span className="fed-sad-drop text-6xl leading-none select-none" aria-hidden>
                  😞
                </span>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/80 mt-1">
                  Décision du jury
                </p>
                <h2 className="text-2xl sm:text-3xl font-black leading-tight">Ajourné(e)</h2>
                <p className="text-sm font-black text-white/95">{candidate.fullName}</p>
                {candidate.decisionLabel && (
                  <p className="text-xs text-white/80 font-semibold">{candidate.decisionLabel}</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* ═══ CORPS : informations clés structurées ═══ */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Identité du candidat */}
          <section className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
              Informations du candidat
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SheetField label="Nom et prénoms" value={candidate.fullName} wide />
              <SheetField label="Matricule" value={candidate.matricule} mono />
              <SheetField label="N° de table" value={candidate.tableNumber ?? '—'} mono />
              <SheetField label="École de provenance" value={candidate.school} wide />
              {candidate.centerName && (
                <SheetField label="Centre d’examen" value={candidate.centerName} wide />
              )}
            </div>
          </section>

          {/* Résumé chiffré */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl bg-slate-50 border border-slate-200 px-3 py-3 text-center">
              <p className="text-xl font-black text-blue-900">
                {candidate.average != null ? fmtNote(candidate.average) : '—'}
              </p>
              <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">
                Moyenne /20
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 px-3 py-3 text-center">
              <p className="text-xl font-black text-blue-900">
                {candidate.rank ?? '—'}
                <span className="text-xs font-bold text-slate-400">
                  {candidate.rank ? 'ᵉ' : ''}
                </span>
              </p>
              <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Rang</p>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 px-3 py-3 text-center">
              <p className="text-[13px] font-black text-blue-900 leading-tight mt-1">
                {candidate.mention ?? '—'}
              </p>
              <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Mention</p>
            </div>
          </div>

          {/* ⭐ CEP — décisions officielles (admission CEP + entrée en 6ème) */}
          {isCep && candidate.cepAdmission && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 space-y-2.5">
              <p className="text-[10px] font-black uppercase tracking-wide text-blue-900">
                Décisions officielles du CEP
              </p>
              <div className="flex flex-wrap gap-2">
                <DecisionPill
                  ok={candidate.cepAdmission.admisCep}
                  labelOk="Admis(e) au CEP"
                  labelKo="Non admis(e) au CEP"
                />
                <DecisionPill
                  ok={candidate.cepAdmission.admisSixieme}
                  labelOk="Admis(e) en 6ème"
                  labelKo="Non admis(e) en 6ème"
                />
              </div>
              {candidate.cepAdmission.moyenneEtoiles != null && (
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Moyenne des matières marquées d’un astérisque (*) :{' '}
                  <b className="text-blue-900">
                    {fmtNote(candidate.cepAdmission.moyenneEtoiles)}/20
                  </b>{' '}
                  — admission en 6ème si cette moyenne est au moins égale à 10/20.
                </p>
              )}
            </div>
          )}

          {/* Notes par matière */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-2">
              Notes par matière
            </p>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3.5 py-2.5 text-left text-[9px] font-black text-slate-400 uppercase">
                      Matière
                    </th>
                    <th className="px-3 py-2.5 text-center text-[9px] font-black text-slate-400 uppercase">
                      {isCep ? 'Note /20' : 'Coef.'}
                    </th>
                    <th className="px-3 py-2.5 text-center text-[9px] font-black text-slate-400 uppercase">
                      {isCep ? 'Détail' : 'Note /20'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {candidate.lines.map((l) => (
                    <tr key={l.code} className={l.isAbsent ? 'bg-slate-50/60' : ''}>
                      <td className="px-3.5 py-2.5">
                        <span className="text-xs font-bold text-slate-800">
                          {l.name}
                          {l.perfectionnement ? ' *' : ''}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {isCep ? (
                          <span
                            className={cn(
                              'text-xs font-black',
                              l.isAbsent ? 'text-slate-400' : 'text-slate-800',
                            )}
                          >
                            {l.isAbsent ? 'ABS' : fmtNote(l.score)}
                          </span>
                        ) : (
                          <span className="text-xs font-black text-slate-500">
                            ×{fmtNote(l.coefficient)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {isCep ? (
                          <span className="text-[10px] font-semibold text-slate-500">
                            {l.isAbsent
                              ? '—'
                              : `${fmtNote(l.cm)} + ${fmtNote(l.cp)} (perf.)`}
                          </span>
                        ) : (
                          <span
                            className={cn(
                              'text-xs font-black',
                              l.isAbsent ? 'text-slate-400' : 'text-slate-800',
                            )}
                          >
                            {l.isAbsent ? 'ABS' : fmtNote(l.score)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isCep && (
              <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                Au CEP, la note /20 d’une matière se décompose en note obtenue (CM /18) et
                note de perfectionnement (CP /2) ; les matières marquées d’un astérisque (*)
                déterminent l’admission en 6ème.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl bg-blue-900 px-5 py-3 text-xs font-black uppercase tracking-wide text-white hover:bg-blue-800 inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Search className="w-4 h-4" />
              Nouvelle recherche
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SheetField({
  label,
  value,
  mono,
  wide,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={cn('min-w-0', wide && 'col-span-2')}>
      <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          'text-sm font-bold text-slate-900 mt-0.5 truncate',
          mono && 'font-mono text-xs',
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function DecisionPill({ ok, labelOk, labelKo }: { ok: boolean; labelOk: string; labelKo: string }) {
  return (
    <span
      className={cn(
        'px-3 py-1.5 rounded-full text-[10px] font-black uppercase inline-flex items-center gap-1.5',
        ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700',
      )}
    >
      {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {ok ? labelOk : labelKo}
    </span>
  );
}
