/**
 * LoadingScreen Component — v3 Real Progress
 *
 * Écran de chargement plein écran avec design premium Academia Helm.
 * La progression est RÉELLE, fournie par le parent.
 * Aucune animation de pourcentage fictif.
 *
 * Palette : Navy (#0b2f73), Blue (#1d4fa5), Gold (#f5b335)
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { LoadingMessage, LoadingStep } from '@/lib/loading/loading-messages';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import Image from 'next/image';
import { BRAND } from '@/lib/brand';

export interface LoadingScreenProps {
  message?: LoadingMessage;
  step?: LoadingStep;
  /** Progression RÉELLE 0-100 (fournie par le parent) */
  progress?: number;
  showProgress?: boolean;
  variant?: 'default' | 'minimal' | 'orion';
  className?: string;
}

export function LoadingScreen({
  message,
  step,
  progress = 0,
  showProgress = true,
  variant = 'default',
  className,
}: LoadingScreenProps) {
  const { shouldReduceMotion } = useMotionBudget();

  const variants = {
    default: 'bg-[#0b2f73]',
    minimal: 'bg-[#0D1F6E]',
    orion: 'bg-gradient-to-br from-[#0b2f73] via-[#0D1F6E] to-[#1A3490]',
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center overflow-hidden safe-area-inset-top safe-area-inset-bottom',
        variants[variant],
        className
      )}
    >
      {/* Ambiance — orbes lumineux */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={shouldReduceMotion ? { opacity: 0.15 } : { opacity: [0.15, 0.3, 0.15] }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="absolute -top-32 -left-16 w-96 h-96 bg-[#f5b335]/10 rounded-full blur-[100px]" />
        <div className="absolute -bottom-40 -right-20 w-[500px] h-[500px] bg-[#1d4fa5]/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-[#f5b335]/5 rounded-full blur-[80px]" />
      </motion.div>

      {/* Contenu central */}
      <div className="w-full max-w-md px-8 text-center relative z-10">
        {/* Logo avec halo premium */}
        <div className="mb-10 flex justify-center">
          <motion.div
            className="relative"
            animate={shouldReduceMotion ? { scale: 1 } : { scale: [1, 1.04, 1] }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* Halo doré pulsant */}
            <div className="absolute inset-0 -m-5 rounded-full bg-[#f5b335]/8 blur-xl" style={{ animation: 'academiaPulse 2.5s ease-in-out infinite' }} />
            {/* Anneau rotatif */}
            <div className="absolute inset-0 -m-3 rounded-full border-2 border-[#f5b335]/20 border-t-[#f5b335]" style={{ animation: 'academiaOrbit 1.2s linear infinite' }} />
            {/* Logo */}
            <Image
              src={BRAND.logoPath}
              alt={BRAND.name}
              width={72}
              height={72}
              className="relative z-10 rounded-2xl"
              style={{ animation: 'academiaPulse 3s ease-in-out infinite' }}
              priority
            />
          </motion.div>
        </div>

        {/* Nom de marque */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">
            {BRAND.name.split(' ')[0]}
            <span className="text-[#f5b335] ml-1.5">{BRAND.name.split(' ')[1]}</span>
          </h1>
          <p className="text-[11px] text-blue-200/50 tracking-[0.2em] uppercase font-medium">
            {BRAND.subtitle}
          </p>
        </motion.div>

        {/* Message de l'étape réelle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-8"
        >
          <h2 className="text-base font-medium text-white/90 mb-1">
            {message?.title || 'Chargement…'}
          </h2>
          {message?.subtitle && (
            <p className="text-xs text-blue-200/60">{message.subtitle}</p>
          )}
        </motion.div>

        {/* Barre de progression RÉELLE */}
        {showProgress && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0.8 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="mt-8"
          >
            <div className="relative h-1 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.max(2, progress)}%`,
                  background: 'linear-gradient(90deg, #1d4fa5, #f5b335)',
                }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <p className="text-[10px] text-blue-200/40 uppercase tracking-wider">Progression</p>
              <p className="text-xs text-[#f5b335] font-semibold tabular-nums">{Math.round(progress)}%</p>
            </div>
          </motion.div>
        )}

        {/* Dots animés branded */}
        <div className="flex justify-center items-center space-x-2 mt-8">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className={cn(
                'rounded-full',
                i === 0 ? 'h-2 w-2 bg-[#1d4fa5]/60' : i === 1 ? 'h-2.5 w-2.5 bg-[#1d4fa5]' : 'h-2 w-2 bg-[#f5b335]',
              )}
              animate={shouldReduceMotion ? { y: 0 } : { y: [0, -8, 0] }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * MinimalLoadingScreen — Transition rapide avec durée minimale
 */
export function MinimalLoadingScreen({
  message,
  minDuration = 10000,
  children,
}: {
  message?: string;
  minDuration?: number;
  children?: React.ReactNode;
}) {
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    if (minDuration <= 0) {
      setMinElapsed(true);
      return;
    }
    const timer = setTimeout(() => setMinElapsed(true), minDuration);
    return () => clearTimeout(timer);
  }, [minDuration]);

  if (minElapsed && children) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b2f73] safe-area-inset-top safe-area-inset-bottom">
      <div className="text-center">
        <div className="relative w-14 h-14 mx-auto mb-5">
          <div
            className="absolute inset-0 rounded-full border-2 border-[#f5b335]/15 border-t-[#f5b335]"
            style={{ animation: 'academiaOrbit 1s linear infinite' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Image src={BRAND.logoPath} alt={BRAND.name} width={24} height={24} className="relative z-10 rounded" style={{ animation: 'academiaPulse 2s ease-in-out infinite' }} priority />
          </div>
        </div>
        {message && <p className="text-sm text-white/70">{message}</p>}
      </div>
    </div>
  );
}
