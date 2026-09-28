/**
 * ═══════════════════════════════════════════════════════════════════════════
 * federis-motion.tsx — Composants visuels Federis (style Academia Helm)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Alignement sur le design system Academia Helm : interfaces simples et
 * professionnelles. Les APIs des composants sont CONSERVÉES (mêmes props)
 * pour ne casser aucun appel existant — seuls les rendus changent :
 *
 *   - FedFadeIn / FedStagger / FedPage : divs simples (plus d'animations
 *     d'entrée échelonnées)
 *   - FedCountUp : compteur conservé (fonctionnel et discret)
 *   - FedSectionTitle : titre sobre (badge discret + trait doré statique)
 *   - FedCard / FedCardDark : cartes blanches à bordure fine (style Helm)
 *   - FedGoldButton : bouton bleu institutionnel plat (style Helm)
 *   - FedLiveBadge : point vert statique (plus de ping)
 *   - FedStatCard : carte KPI simple (pattern StatCard Helm)
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';
import { cn } from '@/lib/utils';

// ── Conteneurs (neutralisés — rendus statiques) ─────────────────────────────

export function FedStagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

export function FedStaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

export function FedFadeIn({
  children,
  className,
  delay = 0,
  y = 24,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return <div className={className}>{children}</div>;
}

/** Entrée de page — div simple. */
export function FedPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

// ── Compteur animé (conservé — discret et fonctionnel) ──────────────────────

export function FedCountUp({
  value,
  duration = 1200,
  suffix = '',
  prefix = '',
  className,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * value));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {count.toLocaleString('fr-FR')}
      {suffix}
    </span>
  );
}

// ── Titres de section (sombres → clairs, style Helm) ────────────────────────

export function FedSectionTitle({
  badge,
  title,
  subtitle,
  dark = false,
  center = true,
  className,
}: {
  badge?: string;
  title: React.ReactNode;
  subtitle?: string;
  dark?: boolean;
  center?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(center && 'text-center', 'max-w-3xl', center && 'mx-auto', className)}>
      {badge && (
        <div className={cn('inline-block mb-3', 'fed-badge')}>{badge}</div>
      )}
      <h2
        className={cn(
          'text-xl sm:text-2xl md:text-3xl font-bold leading-tight',
          dark ? 'text-gray-900' : 'text-gray-900',
        )}
      >
        {title}
      </h2>
      <div
        className="fed-separator mt-3"
        style={center ? { marginInline: 'auto' } : undefined}
      />
      {subtitle && (
        <p className="mt-3 text-sm md:text-base leading-relaxed text-gray-500">
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ── Soulignement — texte simple (plus d'animation) ──────────────────────────

export function FedAnimatedUnderline({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn('inline-block', className)}>{children}</span>;
}

// ── Cartes (style Helm : blanc, bordure fine, pas de hover lift) ────────────

export function FedCard({
  children,
  className,
  hoverLift = true,
}: {
  children: React.ReactNode;
  className?: string;
  hoverLift?: boolean;
}) {
  return <div className={cn('fed-card', className)}>{children}</div>;
}

export function FedCardDark({
  children,
  className,
  hoverLift = true,
}: {
  children: React.ReactNode;
  className?: string;
  hoverLift?: boolean;
}) {
  return <div className={cn('fed-card', className)}>{children}</div>;
}

// ── Boutons (aplatis — pattern Helm) ────────────────────────────────────────

export function FedGoldButton({
  children,
  className,
  pulse = true,
  onClick,
  type = 'button',
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn('fed-btn-gold', className)}
    >
      {children}
    </button>
  );
}

export function FedNavyButton({
  children,
  className,
  onClick,
  type = 'button',
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn('fed-btn-navy', className)}
    >
      {children}
    </button>
  );
}

// ── Indicateur live (point vert statique — pattern Helm « En ligne ») ───────

export function FedLiveBadge({ label = 'LIVE' }: { label?: string }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 border border-gray-200"
      title="Données synchronisées en temps réel"
    >
      <span className="fed-live-dot" />
      <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 select-none">
        {label}
      </span>
    </div>
  );
}

// ── Point statique (plus de ping) ───────────────────────────────────────────

export function FedPingDot({ color = 'bg-emerald-500' }: { color?: string }) {
  return <span className={cn('inline-flex rounded-full h-2 w-2', color)} />;
}

// ── Carte KPI (pattern StatCard Helm : sobre, lisible) ──────────────────────

export function FedStatCard({
  value,
  suffix = '',
  label,
  subText,
  dark = false,
  icon,
}: {
  value: number;
  suffix?: string;
  label: string;
  subText?: string;
  dark?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="fed-card p-5 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-bold text-gray-900">
              <FedCountUp value={value} suffix={suffix} />
            </span>
          </div>
          {icon && (
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-50 text-blue-800">
              {icon}
            </div>
          )}
        </div>
        <h3 className="font-medium text-sm text-gray-600 mb-1">{label}</h3>
      </div>
      {subText && <p className="text-xs leading-relaxed mt-1 text-gray-400">{subText}</p>}
    </div>
  );
}
