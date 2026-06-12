/**
 * LoadingScreen Component — v2 Modern Captivating
 *
 * Écran de chargement plein écran avec design premium Academia Helm.
 * Animations fluides, progression branded, ambiance immersive.
 *
 * Palette : Navy (#0b2f73), Blue (#1d4fa5), Gold (#f5b335)
 * Durée : 10s par défaut
 */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { LoadingMessage, LoadingStep } from '@/lib/loading/loading-messages';
import { getMotionDuration } from '@/lib/motion/presets';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import Image from 'next/image';
import { BRAND } from '@/lib/brand';

export interface LoadingScreenProps {
  message?: LoadingMessage;
  step?: LoadingStep;
  progress?: number; // 0-100
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
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const { shouldReduceMotion } = useMotionBudget();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Animation fluide de la barre de progression
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev < progress) return Math.min(prev + 2, progress);
        return prev;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [progress]);

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

        {/* Message principal */}
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

        {/* Barre de progression premium */}
        {showProgress && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0.8 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="mt-8"
          >
            <div className="relative h-1 w-full bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  width: `${displayProgress}%`,
                  background: 'linear-gradient(90deg, #1d4fa5, #f5b335, #1d4fa5)',
                  backgroundSize: '200% 100%',
                  animation: 'academiaShimmerWave 2s ease-in-out infinite',
                }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <p className="text-[10px] text-blue-200/40 uppercase tracking-wider">Progression</p>
              <p className="text-xs text-[#f5b335] font-semibold tabular-nums">{Math.round(displayProgress)}%</p>
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
                i === 0 ? 'h-2 w-2 bg-[#0b2f73]' : i === 1 ? 'h-2.5 w-2.5 bg-[#1d4fa5]' : 'h-2 w-2 bg-[#f5b335]',
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
 * MinimalLoadingScreen — Transition rapide
 * Durée minimale : 10s par défaut
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
        {/* Anneau rotatif minimal */}
        <div className="relative w-14 h-14 mx-auto mb-5">
          <div
            className="absolute inset-0 rounded-full border-2 border-[#f5b335]/15 border-t-[#f5b335]"
            style={{ animation: 'academiaOrbit 1s linear infinite' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-[#f5b335]" style={{ animation: 'academiaPulse 1.5s ease-in-out infinite' }} />
          </div>
        </div>
        {message && <p className="text-sm text-white/70">{message}</p>}
      </div>
    </div>
  );
}

/**
 * LogoutLoadingScreen — Progress bar, responsive
 * Durée minimale : 10s par défaut
 */
export function LogoutLoadingScreen({
  message = 'Déconnexion en cours…',
  minDuration = 10000,
}: {
  message?: string;
  minDuration?: number;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const steps = 100;
    const stepDuration = minDuration / steps;
    let current = 0;
    const interval = setInterval(() => {
      current++;
      setProgress(Math.min((current / steps) * 100, 100));
      if (current >= steps) clearInterval(interval);
    }, stepDuration);
    return () => clearInterval(interval);
  }, [minDuration]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b2f73] safe-area-inset-top safe-area-inset-bottom">
      <div className="w-full max-w-xs px-6 text-center">
        <div className="relative w-12 h-12 mx-auto mb-6">
          <div
            className="absolute inset-0 rounded-full border-2 border-white/10 border-t-[#f5b335]"
            style={{ animation: 'academiaOrbit 0.8s linear infinite' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-[#f5b335]" style={{ animation: 'academiaPulse 1s ease-in-out infinite' }} />
          </div>
        </div>
        <p className="text-sm text-white/80 mb-4">{message}</p>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #1d4fa5, #f5b335)',
            }}
          />
        </div>
        <p className="text-[10px] text-white/30 mt-2 tabular-nums">{Math.round(progress)}%</p>
      </div>
    </div>
  );
}
