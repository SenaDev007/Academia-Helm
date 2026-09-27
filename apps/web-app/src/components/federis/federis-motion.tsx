/**
 * ═══════════════════════════════════════════════════════════════════════════
 * federis-motion.tsx — Primitives d'animation & composants visuels Federis
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ADN WinAgro transposé (palette + police Federis conservées) :
 *   - FedFadeIn / FedStagger   : révélations échelonnées au scroll
 *   - FedCountUp               : compteurs animés (KPI dashboard/stats)
 *   - FedSectionTitle          : badge pilule + titre + liseré or animé
 *   - FedCard / FedCardDark    : cartes avec hover lift + shimmer
 *   - FedGoldButton            : CTA or avec pulsation + balayage lumineux
 *   - FedLiveBadge             : indicateur LIVE (pastille ping)
 *   - FedAnimatedUnderline     : soulignement or animé sous un mot clé
 *
 * Toutes les animations respectent prefers-reduced-motion.
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

// ── Révélations échelonnées (pattern WhyUs/Services WinAgro) ────────────────

export const fedContainerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

export const fedCardVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export function FedStagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={fedContainerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function FedStaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={fedCardVariants} className={className}>
      {children}
    </motion.div>
  );
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
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Entrée de page (montage immédiat, sans attendre le scroll). */
export function FedPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Compteur animé (pattern Stats WinAgro — IntersectionObserver) ───────────

export function FedCountUp({
  value,
  duration = 1800,
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
  // framer-motion v12 : option `amount` (équivalent threshold de l'IntersectionObserver)
  const inView = useInView(ref, { once: true, amount: 0.1 });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // easeOutCubic pour une décélération premium
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

// ── Titres de section (badge + liseré or animé — ADN WinAgro) ──────────────

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
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className={cn(
            'inline-block mb-4',
            dark ? 'fed-badge fed-badge-amber' : 'fed-badge',
          )}
        >
          {badge}
        </motion.div>
      )}
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.08 }}
        className={cn(
          'text-2xl sm:text-3xl md:text-4xl font-black leading-tight tracking-tight',
          dark ? 'text-white' : 'text-[#0b1d3a]',
        )}
      >
        {title}
      </motion.h2>
      {/* Liseré or animé — scaleX WinAgro */}
      <motion.div
        animate={{
          scaleX: [0, 1, 1, 0],
          transformOrigin: ['0% 50%', '0% 50%', '100% 50%', '100% 50%'],
        }}
        transition={{ duration: 3.5, repeat: Infinity, times: [0, 0.15, 0.85, 1], ease: 'easeInOut' }}
        className="fed-separator mt-5"
        style={center ? { marginInline: 'auto' } : undefined}
      />
      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.16 }}
          className={cn(
            'mt-5 text-base md:text-lg leading-relaxed',
            dark ? 'text-blue-100/75' : 'text-[#475569]',
          )}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}

// ── Soulignement or animé sous un mot clé ───────────────────────────────────

export function FedAnimatedUnderline({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('relative inline-block', className)}>
      {children}
      <motion.span
        animate={{
          scaleX: [0, 1, 1, 0],
          transformOrigin: ['0% 50%', '0% 50%', '100% 50%', '100% 50%'],
        }}
        transition={{ duration: 3, repeat: Infinity, times: [0, 0.15, 0.85, 1], ease: 'easeInOut' }}
        className="absolute bottom-1 left-0 w-full h-[4px] bg-[#f59e0b] rounded-full"
      />
    </span>
  );
}

// ── Cartes (hover lift + shimmer — ADN WinAgro) ─────────────────────────────

export function FedCard({
  children,
  className,
  hoverLift = true,
}: {
  children: React.ReactNode;
  className?: string;
  hoverLift?: boolean;
}) {
  return (
    <motion.div
      whileHover={
        hoverLift
          ? {
              y: -6,
              borderColor: 'rgba(30, 58, 138, 0.28)',
              boxShadow:
                '0 20px 25px -5px rgba(11, 29, 58, 0.09), 0 8px 10px -6px rgba(11, 29, 58, 0.07)',
            }
          : undefined
      }
      className={cn('fed-card fed-card-shimmer', className)}
    >
      {children}
    </motion.div>
  );
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
  return (
    <motion.div
      whileHover={
        hoverLift
          ? { y: -6, borderColor: 'rgba(251, 191, 36, 0.35)' }
          : undefined
      }
      className={cn('fed-card-dark fed-card-shimmer', className)}
    >
      {children}
    </motion.div>
  );
}

// ── Boutons (pulsation + shimmer — ADN WinAgro) ─────────────────────────────

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
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.04, boxShadow: '0px 12px 28px rgba(245, 158, 11, 0.45)' }}
      whileTap={{ scale: 0.97 }}
      animate={pulse && !disabled ? { scale: [1, 1.02, 1] } : undefined}
      transition={
        pulse && !disabled
          ? { scale: { repeat: Infinity, duration: 2.6, ease: 'easeInOut' } }
          : undefined
      }
      className={cn('fed-btn-gold fed-btn-shimmer', className)}
    >
      {children}
    </motion.button>
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
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={cn('fed-btn-navy', className)}
    >
      {children}
    </motion.button>
  );
}

// ── Indicateur LIVE (pattern backoffice WinAgro) ────────────────────────────

export function FedLiveBadge({ label = 'LIVE' }: { label?: string }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0f2444]/50 border border-blue-400/20"
      title="Données synchronisées en temps réel"
    >
      <span className="fed-live-dot" />
      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300 select-none">
        {label}
      </span>
    </div>
  );
}

// ── Point ping (badges héros — ADN WinAgro) ─────────────────────────────────

export function FedPingDot({ color = 'bg-[#fbbf24]' }: { color?: string }) {
  return (
    <span className="flex h-2 w-2 relative">
      <span
        className={cn(
          'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
          color,
        )}
      />
      <span className={cn('relative inline-flex rounded-full h-2 w-2', color)} />
    </span>
  );
}

// ── KPI card (pattern Stats WinAgro — compteur + liseré or évolutif) ────────

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
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      className={cn(
        'relative p-6 rounded-3xl flex flex-col justify-between h-full group fed-card-shimmer',
        dark
          ? 'fed-card-dark'
          : 'bg-white border border-blue-100 shadow-lg hover:shadow-xl hover:border-blue-300/50 transition-all duration-300',
      )}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline gap-1">
            <span
              className={cn(
                'text-4xl sm:text-5xl font-black tracking-tight',
                dark
                  ? 'text-white group-hover:text-[#fbbf24]'
                  : 'text-[#0b1d3a] group-hover:text-[#1e3a8a]',
                'transition-colors duration-300',
              )}
            >
              <FedCountUp value={value} suffix={suffix} />
            </span>
          </div>
          {icon && (
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                dark ? 'bg-white/10 text-[#fbbf24]' : 'bg-[#eff6ff] text-[#1e3a8a]',
              )}
            >
              {icon}
            </div>
          )}
        </div>
        {/* Liseré or qui s'étend au survol (ADN Stats WinAgro) */}
        <div className="w-12 h-1 bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] rounded-full mb-4 group-hover:w-20 transition-all duration-300" />
        <h3
          className={cn(
            'font-bold text-base tracking-wide mb-1.5',
            dark ? 'text-white' : 'text-[#0b1d3a]',
          )}
        >
          {label}
        </h3>
      </div>
      {subText && (
        <p className={cn('text-xs leading-relaxed mt-2', dark ? 'text-blue-100/60' : 'text-slate-500')}>
          {subText}
        </p>
      )}
    </motion.div>
  );
}
