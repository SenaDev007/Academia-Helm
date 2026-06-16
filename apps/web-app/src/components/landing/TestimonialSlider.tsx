'use client';

/**
 * ============================================================================
 * TestimonialSlider — slider de témoignages animé (palette Academia Helm)
 * ============================================================================
 *
 * Refonte du slider de témoignages : remplace l'ancienne grille statique de
 * cartes par un slider horizontal animé (framer-motion AnimatePresence).
 *
 * Structure :
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │  [01/05]                  ┌──────────┐  Affiliation           │
 *   │   Témoignages             │          │  Nom                   │
 *   │                           │  Image   │  ★★★★★                 │
 *   │   [thumb][thumb][thumb]   │          │  "Quote"               │
 *   │                           └──────────┘  [←] [→]               │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * Palette : Navy + Or Academia Helm — cohérence avec le reste de la landing.
 * Compatible shadcn Button + cn utility déjà présents dans le projet.
 * ============================================================================
 */

import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  HELM_GOLD,
  HELM_GOLD_LIGHT,
  HELM_NAVY,
  HELM_NAVY_MID,
  HELM_STAR_EMPTY,
  HELM_TEXT_MUTED,
} from '@/lib/helm-colors';

const NAVY = HELM_NAVY;
const NAVY_MID = HELM_NAVY_MID;
const GOLD = HELM_GOLD;
const GOLD_LIGHT = HELM_GOLD_LIGHT;

/** Type attendu par le slider — mappé depuis PublishedReview côté ReviewsSection. */
export type SliderReview = {
  id: string | number;
  name: string;
  affiliation: string;
  quote: string;
  /** Note 1-5 — affichée en étoiles dorées. */
  rating?: number;
  /** Image principale (photo, logo école, ou avatar SVG généré). */
  imageSrc: string;
  /** Vignette — peut être identique à imageSrc. */
  thumbnailSrc: string;
  /** Badge optionnel ("École vérifiée" / "Avis vérifié"). */
  badge?: { label: string; variant: 'school' | 'public' };
};

interface TestimonialSliderProps {
  reviews: SliderReview[];
  className?: string;
  /** Autoplay interval en ms (0 = désactivé). Défaut : 7000ms. */
  autoPlayInterval?: number;
  /** Active la navigation clavier (flèches gauche/droite). Défaut : true. */
  enableKeyboard?: boolean;
  /** Active le swipe tactile sur mobile. Défaut : true. */
  enableSwipe?: boolean;
  /** Active le lazy-load des images non visibles. Défaut : true. */
  enableLazyLoad?: boolean;
}

// ----------------------------------------------------------------------------
//  Utilitaires : avatar SVG inline quand pas d'image réelle
// ----------------------------------------------------------------------------

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hashHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

/**
 * Génère un avatar SVG (data URL) avec initiales colorées — utilisé quand
 * l'avis n'a ni photo ni logo école. Permet à motion.img d'avoir toujours
 * une src valide pour les animations crossfade.
 */
export function buildAvatarDataUrl(name: string, size = 600): string {
  const initials = initialsFromName(name);
  const hue = hashHue(name);
  const fontSize = Math.round(size * 0.36);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue}, 55%, 42%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 40) % 360}, 50%, 35%)"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <text x="50%" y="50%" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" fill="white" text-anchor="middle" dominant-baseline="central">${initials}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ----------------------------------------------------------------------------
//  Sous-composants
// ----------------------------------------------------------------------------

function StarRow({
  rating,
  size = 16,
}: {
  rating: number;
  size?: number;
}) {
  return (
    <div className="flex gap-0.5" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={i < rating ? GOLD : 'none'}
          stroke={i < rating ? GOLD : HELM_STAR_EMPTY}
          strokeWidth="1.5"
          className="shrink-0"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Composant principal : TestimonialSlider
// ----------------------------------------------------------------------------

export function TestimonialSlider({
  reviews,
  className,
  autoPlayInterval = 7000,
  enableKeyboard = true,
  enableSwipe = true,
  enableLazyLoad = true,
}: TestimonialSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Garde-fou : si pas d'avis, on ne rend rien (cas géré par le parent).
  if (reviews.length === 0) return null;

  // Si un seul avis, pas de slider — on l'affiche statiquement.
  const isSingle = reviews.length === 1;

  const activeReview = reviews[currentIndex];

  const goNext = useCallback(() => {
    if (isSingle) return;
    setDirection('right');
    setCurrentIndex((prev) => (prev + 1) % reviews.length);
  }, [isSingle]);

  const goPrev = useCallback(() => {
    if (isSingle) return;
    setDirection('left');
    setCurrentIndex((prev) => (prev - 1 + reviews.length) % reviews.length);
  }, [isSingle]);

  const goTo = useCallback(
    (index: number) => {
      if (isSingle || index === currentIndex) return;
      setDirection(index > currentIndex ? 'right' : 'left');
      setCurrentIndex(index);
    },
    [isSingle, currentIndex],
  );

  const handleNext = goNext;
  const handlePrev = goPrev;
  const handleThumbnailClick = goTo;

  // --- Autoplay avec pause au hover ---
  useEffect(() => {
    if (isSingle || !autoPlayInterval || autoPlayInterval <= 0) return;
    if (isPaused) return;
    const id = window.setInterval(() => {
      goNext();
    }, autoPlayInterval);
    return () => window.clearInterval(id);
  }, [isSingle, autoPlayInterval, isPaused, goNext]);

  // --- Navigation clavier (flèches gauche/droite) ---
  useEffect(() => {
    if (!enableKeyboard || isSingle) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore si l'utilisateur est dans un champ de saisie.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      // Ignore si le slider n'est pas au moins partiellement visible.
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const isVisible =
        rect.top < window.innerHeight && rect.bottom > 0;
      if (!isVisible) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard, isSingle, goPrev, goNext]);

  // --- Swipe tactile sur mobile ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!enableSwipe || isSingle) return;
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!enableSwipe || isSingle) return;
    if (touchStartX.current === null || touchStartY.current === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;
    const SWIPE_THRESHOLD = 40; // px minimum pour déclencher
    // Ne déclencher que si le swipe est majoritairement horizontal
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx < 0) {
        // Swipe gauche → next
        goNext();
      } else {
        // Swipe droite → prev
        goPrev();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Les 3 prochaines vignettes (en excluant l'avis courant).
  // Si moins de 4 avis au total, on prend ce qui est disponible.
  const thumbnailReviews = reviews
    .map((r, i) => ({ r, i }))
    .filter(({ i }) => i !== currentIndex)
    .slice(0, 3);

  // Note sur le lazy-load :
  // - L'image principale (AnimatePresence) ne rend que l'index courant → `loading="eager"`.
  // - Les vignettes sont chargées en `loading="lazy"` via le prop `enableLazyLoad`.
  // - Les data URLs SVG (avatars générés) sont quasi instantanées (pas de fetch réseau).

  // Variantes d'animation image (slide vertical)
  const imageVariants = {
    enter: (dir: 'left' | 'right') => ({
      y: dir === 'right' ? '100%' : '-100%',
      opacity: 0,
    }),
    center: { y: 0, opacity: 1 },
    exit: (dir: 'left' | 'right') => ({
      y: dir === 'right' ? '-100%' : '100%',
      opacity: 0,
    }),
  };

  // Variantes d'animation texte (slide horizontal)
  const textVariants = {
    enter: (dir: 'left' | 'right') => ({
      x: dir === 'right' ? 50 : -50,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: 'left' | 'right') => ({
      x: dir === 'right' ? -50 : 50,
      opacity: 0,
    }),
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full overflow-hidden rounded-2xl bg-white p-6 md:p-10',
        enableSwipe && !isSingle ? 'touch-pan-y' : '',
        className,
      )}
      style={{
        boxShadow: '0 10px 36px rgba(30, 58, 95, 0.10)',
        border: '1px solid #E2E8F0',
      }}
      // --- Pause autoplay au hover/focus ---
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      // --- Swipe tactile ---
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      // ARIA : indique que c'est un carrousel
      role="region"
      aria-roledescription="carousel"
      aria-label="Témoignages clients"
      tabIndex={0}
    >
      {/* Décor doré subtil en arrière-plan */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-[0.06]"
        style={{
          background: `radial-gradient(circle, ${GOLD} 0%, transparent 70%)`,
        }}
      />

      <div className="relative grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
        {/* === Colonne gauche : pagination + label vertical + vignettes === */}
        <div className="order-2 flex flex-col justify-between md:order-1 md:col-span-3">
          <div className="flex flex-row justify-between md:flex-col md:space-x-0 md:space-y-4">
            {/* Pagination */}
            <span
              className="font-mono text-sm font-medium"
              style={{ color: HELM_TEXT_MUTED }}
            >
              {String(currentIndex + 1).padStart(2, '0')} /{' '}
              {String(reviews.length).padStart(2, '0')}
            </span>

            {/* Label vertical "Témoignages" */}
            <h2
              className="hidden text-sm font-medium uppercase tracking-widest md:block [writing-mode:vertical-rl] md:rotate-180"
              style={{ color: NAVY }}
            >
              Témoignages
            </h2>
          </div>

          {/* Vignettes de navigation */}
          {!isSingle && (
            <div className="mt-6 flex space-x-2 md:mt-0">
              {thumbnailReviews.map(({ r, i }) => (
                <button
                  key={r.id}
                  onClick={() => handleThumbnailClick(i)}
                  className="focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white transition-all duration-300 hover:opacity-100 focus:ring-[color:var(--ring)]"
                  style={{
                    opacity: 0.65,
                    borderRadius: '8px',
                    overflow: 'hidden',
                    width: 'clamp(56px, 18%, 80px)',
                    height: 'clamp(72px, 22%, 96px)',
                    boxShadow: '0 2px 8px rgba(30, 58, 95, 0.08)',
                  }}
                  aria-label={`Voir le témoignage de ${r.name}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.thumbnailSrc}
                    alt={r.name}
                    loading={enableLazyLoad ? 'lazy' : 'eager'}
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* === Colonne centre : image principale === */}
        <div className="relative order-1 h-72 min-h-[300px] md:order-2 md:col-span-4 md:h-auto md:min-h-[440px]">
          <AnimatePresence initial={false} custom={direction}>
            <motion.img
              key={currentIndex}
              src={activeReview.imageSrc}
              alt={activeReview.name}
              // Image courante = eager (doit s'afficher immédiatement).
              loading="eager"
              decoding="async"
              custom={direction}
              variants={imageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-0 h-full w-full rounded-xl object-cover"
              style={{
                boxShadow: `0 18px 50px rgba(30, 58, 95, 0.18)`,
              }}
            />
          </AnimatePresence>

          {/* Halo doré derrière l'image */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-3 -z-10 rounded-2xl opacity-20 blur-2xl"
            style={{
              background: `linear-gradient(135deg, ${GOLD}, ${NAVY})`,
            }}
          />
        </div>

        {/* === Colonne droite : affiliation + nom + note + citation + CTA === */}
        <div className="order-3 flex flex-col justify-between md:col-span-5 md:pl-4">
          {/* Contenu textuel animé */}
          <div className="relative min-h-[220px] overflow-hidden pt-2 md:pt-12">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={textVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
              >
                {/* Badge "École vérifiée" / "Avis vérifié" */}
                {activeReview.badge && (
                  <span
                    className="mb-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
                    style={
                      activeReview.badge.variant === 'school'
                        ? { background: '#dcfce7', color: '#15803d' }
                        : { background: '#fef3c7', color: '#92400e' }
                    }
                  >
                    {activeReview.badge.variant === 'school' ? '👑' : '✓'}
                    {activeReview.badge.label}
                  </span>
                )}

                {/* Affiliation (rôle · école · ville) */}
                <p
                  className="text-sm font-medium"
                  style={{ color: HELM_TEXT_MUTED }}
                >
                  {activeReview.affiliation}
                </p>

                {/* Nom */}
                <h3
                  className="mt-1 text-xl font-bold md:text-2xl"
                  style={{ color: NAVY }}
                >
                  {activeReview.name}
                </h3>

                {/* Note en étoiles */}
                {typeof activeReview.rating === 'number' && (
                  <div className="mt-2.5">
                    <StarRow rating={activeReview.rating} size={16} />
                  </div>
                )}

                {/* Citation */}
                <blockquote
                  className="mt-5 text-lg font-medium leading-snug md:text-xl"
                  style={{
                    color: NAVY,
                    fontFamily: 'Georgia, serif',
                  }}
                >
                  &laquo;{activeReview.quote}&raquo;
                </blockquote>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Boutons de navigation */}
          {!isSingle && (
            <div className="mt-6 flex items-center space-x-2 md:mt-0">
              <button
                onClick={handlePrev}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all hover:scale-105 active:scale-95"
                style={{
                  borderColor: `rgba(${0x1e}, ${0x3a}, ${0x5f}, 0.35)`,
                  color: NAVY,
                  background: 'transparent',
                }}
                aria-label="Témoignage précédent"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <button
                onClick={handleNext}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full transition-all hover:scale-105 active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
                  color: NAVY,
                  boxShadow: `0 6px 18px ${GOLD}55`,
                }}
                aria-label="Témoignage suivant"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TestimonialSlider;
