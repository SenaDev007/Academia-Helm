/**
 * LoadingScreen Component — v4 Clean Premium
 *
 * Écran de chargement plein écran avec design épuré Academia Helm.
 * Logo circulaire, barre de progression épaisse, pourcentage, dots animés.
 *
 * Palette : Royal Blue (#1A237E→#283593), Gold (#f5b335)
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
    default: 'bg-[#1A237E]',
    minimal: 'bg-[#1A237E]',
    orion: 'bg-gradient-to-br from-[#1A237E] via-[#1E2A8A] to-[#283593]',
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center overflow-hidden safe-area-inset-top safe-area-inset-bottom',
        variants[variant],
        className
      )}
    >
      {/* Orbes d'ambiance subtiles */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={shouldReduceMotion ? { opacity: 0.1 } : { opacity: [0.1, 0.2, 0.1] }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="absolute -top-32 -left-16 w-96 h-96 bg-[#f5b335]/6 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-20 w-[500px] h-[500px] bg-[#3F51B5]/10 rounded-full blur-[140px]" />
      </motion.div>

      {/* Contenu central */}
      <div className="w-full max-w-sm px-8 text-center relative z-10">
        {/* Logo circulaire avec bordure */}
        <motion.div
          className="mb-8 flex justify-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div className="relative">
            {/* Halo doré pulsant */}
            <div
              className="absolute inset-0 -m-6 rounded-full bg-[#f5b335]/8 blur-xl"
              style={{ animation: 'academiaPulse 3s ease-in-out infinite' }}
            />
            {/* Anneau rotatif doré */}
            <div
              className="absolute inset-0 -m-3 rounded-full border-2 border-white/10 border-t-[#f5b335]"
              style={{ animation: 'academiaOrbit 1.2s linear infinite' }}
            />
            {/* Conteneur circulaire blanc pour le logo */}
            <div className="relative z-10 w-20 h-20 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center backdrop-blur-sm">
              <Image
                src={BRAND.logoPath}
                alt={BRAND.name}
                width={52}
                height={52}
                className="rounded-full"
                style={{ animation: 'academiaPulse 3s ease-in-out infinite' }}
                priority
              />
            </div>
          </div>
        </motion.div>

        {/* Nom de marque */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <h1 className="text-2xl font-bold text-white tracking-tight mb-0.5">
            {BRAND.name.split(' ')[0]}
            <span className="text-[#f5b335] ml-1.5">{BRAND.name.split(' ')[1]}</span>
          </h1>
          <p className="text-[11px] text-blue-200/50 tracking-[0.2em] uppercase font-medium">
            {BRAND.subtitle}
          </p>
        </motion.div>

        {/* Message de chargement */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="mt-6"
        >
          <h2 className="text-base font-medium text-white/90 mb-0.5">
            {message?.title || 'Chargement…'}
          </h2>
          {message?.subtitle && (
            <p className="text-xs text-blue-200/50">{message.subtitle}</p>
          )}
        </motion.div>

        {/* Barre de progression épaisse */}
        {showProgress && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0.8 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-7"
          >
            {/* Piste de progression */}
            <div className="relative h-2 w-full bg-white/12 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.max(3, progress)}%`,
                  background: 'linear-gradient(90deg, #3F51B5, #f5b335)',
                }}
              />
            </div>
            {/* Label + pourcentage */}
            <div className="flex justify-between mt-2">
              <p className="text-[10px] text-blue-200/40 uppercase tracking-wider font-medium">Progression</p>
              <p className="text-sm text-[#f5b335] font-bold tabular-nums">{Math.round(progress)}%</p>
            </div>
          </motion.div>
        )}

        {/* Dots animés branded */}
        <div className="flex justify-center items-center space-x-2.5 mt-7">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className={cn(
                'rounded-full',
                i === 0 ? 'h-2 w-2 bg-[#3F51B5]/70' : i === 1 ? 'h-2.5 w-2.5 bg-[#3F51B5]' : 'h-2 w-2 bg-[#f5b335]',
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
  minDuration = 6000,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A237E] safe-area-inset-top safe-area-inset-bottom">
      <div className="text-center">
        <div className="relative w-14 h-14 mx-auto mb-5">
          <div
            className="absolute inset-0 rounded-full border-2 border-white/10 border-t-[#f5b335]"
            style={{ animation: 'academiaOrbit 1s linear infinite' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Image src={BRAND.logoPath} alt={BRAND.name} width={24} height={24} className="relative z-10 rounded-full" style={{ animation: 'academiaPulse 2s ease-in-out infinite' }} priority />
          </div>
        </div>
        {message && <p className="text-sm text-white/70">{message}</p>}
      </div>
    </div>
  );
}
