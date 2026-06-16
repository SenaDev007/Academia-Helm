/**
 * ============================================================================
 * VOICE BUTTON — Bouton micro pour enregistrer la voix (SARA)
 * ============================================================================
 *
 * Bouton holographique style SaraWidget avec :
 *   - Animation de pulsation pendant l'enregistrement
 *   - Waveform basé sur le niveau audio
 *   - États : idle, recording, processing
 *   - Toast d'erreur si micro non disponible
 *
 * Utilise le hook useVoiceRecorder.
 * ============================================================================
 */

'use client';

import React, { useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

// ─── HOLO COLORS (même palette que SaraWidget) ──────────────────────────

const H = {
  cyan: '#00e5ff',
  cyanDim: 'rgba(0,229,255,0.7)',
  cyanFaint: 'rgba(0,229,255,0.3)',
  cyanGhost: 'rgba(0,229,255,0.1)',
  cyanBorder: 'rgba(0,229,255,0.85)',
  darkBg: 'rgba(0,18,35,0.97)',
  green: '#22c55e',
  greenGlow: '#4ade80',
  red: '#ef4444',
  redGlow: 'rgba(239,68,68,0.4)',
} as const;

interface VoiceButtonProps {
  /** Callback appelé avec le base64 audio quand l'enregistrement est terminé */
  onRecordingComplete: (audioBase64: string) => void;

  /** Callback appelé quand l'enregistrement commence */
  onRecordingStart?: () => void;

  /** Désactiver le bouton (pendant le traitement SARA par ex.) */
  disabled?: boolean;

  /** Taille du bouton */
  size?: 'sm' | 'md' | 'lg';

  /** Classe CSS supplémentaire */
  className?: string;
}

export function VoiceButton({
  onRecordingComplete,
  onRecordingStart,
  disabled = false,
  size = 'md',
  className = '',
}: VoiceButtonProps) {
  const {
    isRecording,
    isInitializing,
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording,
    error,
    duration,
  } = useVoiceRecorder();

  // ─── TAILLES ──────────────────────────────────────────────────────────

  const sizeConfig = {
    sm: { button: 'w-8 h-8', icon: 14, ring: 28 },
    md: { button: 'w-10 h-10', icon: 16, ring: 36 },
    lg: { button: 'w-12 h-12', icon: 20, ring: 44 },
  };

  const config = sizeConfig[size];

  // ─── CLICK HANDLER ────────────────────────────────────────────────────

  const handleClick = useCallback(async () => {
    if (disabled) return;

    if (isRecording) {
      // Arrêter l'enregistrement et envoyer l'audio
      const audioBase64 = await stopRecording();
      if (audioBase64) {
        onRecordingComplete(audioBase64);
      }
    } else {
      // Démarrer l'enregistrement
      onRecordingStart?.();
      await startRecording();
    }
  }, [disabled, isRecording, startRecording, stopRecording, onRecordingComplete, onRecordingStart]);

  // ─── RENDER ───────────────────────────────────────────────────────────

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {/* Waveform rings pendant l'enregistrement */}
      {isRecording && (
        <>
          {/* Ring 1 — pulsation principale */}
          <div
            className="absolute rounded-full animate-ping"
            style={{
              width: config.ring + audioLevel * 30,
              height: config.ring + audioLevel * 30,
              background: `radial-gradient(circle, ${H.redGlow} 0%, transparent 70%)`,
              opacity: 0.4 + audioLevel * 0.4,
              transition: 'all 0.1s ease-out',
            }}
          />
          {/* Ring 2 — pulsation secondaire */}
          <div
            className="absolute rounded-full"
            style={{
              width: config.ring + audioLevel * 50,
              height: config.ring + audioLevel * 50,
              border: `1.5px solid rgba(239,68,68,${0.2 + audioLevel * 0.3})`,
              opacity: 0.5,
              transition: 'all 0.15s ease-out',
            }}
          />
        </>
      )}

      {/* Bouton principal */}
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isInitializing}
        className={`
          ${config.button} rounded-full flex items-center justify-center
          transition-all duration-300 relative z-10
          focus:outline-none focus:ring-2 focus:ring-offset-2
        `}
        style={
          isRecording
            ? {
                background: `linear-gradient(135deg, ${H.red}, #dc2626)`,
                color: '#ffffff',
                boxShadow: `0 0 ${12 + audioLevel * 20}px ${H.redGlow}`,
                animation: 'voice-pulse 1s ease-in-out infinite',
              }
            : disabled
            ? {
                background: H.cyanGhost,
                color: 'rgba(0,229,255,0.3)',
                cursor: 'not-allowed',
              }
            : {
                background: H.cyanGhost,
                border: `1px solid ${H.cyanFaint}`,
                color: H.cyanDim,
              }
        }
        onMouseEnter={(e) => {
          if (!isRecording && !disabled) {
            e.currentTarget.style.background = 'rgba(0,229,255,0.2)';
            e.currentTarget.style.borderColor = H.cyanDim;
            e.currentTarget.style.boxShadow = '0 0 12px rgba(0,229,255,0.25)';
            e.currentTarget.style.color = '#ffffff';
          }
        }}
        onMouseLeave={(e) => {
          if (!isRecording && !disabled) {
            e.currentTarget.style.background = H.cyanGhost;
            e.currentTarget.style.borderColor = H.cyanFaint;
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.color = H.cyanDim;
          }
        }}
        title={
          isRecording
            ? `Arrêter l'enregistrement (${duration}s)`
            : isInitializing
            ? 'Initialisation du micro...'
            : error
            ? error
            : 'Mode vocal'
        }
      >
        {isInitializing ? (
          <Loader2 size={config.icon} className="animate-spin" />
        ) : isRecording ? (
          <MicOff size={config.icon} />
        ) : (
          <Mic size={config.icon} />
        )}
      </button>

      {/* Indicateur de durée pendant l'enregistrement */}
      {isRecording && duration > 0 && (
        <span
          className="absolute -top-5 text-[9px] font-mono font-bold"
          style={{ color: H.red }}
        >
          {duration}s
        </span>
      )}

      {/* Erreur toast */}
      {error && !isRecording && (
        <div
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 rounded text-[9px] z-50"
          style={{
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: H.red,
          }}
        >
          {error}
        </div>
      )}

      {/* Animation CSS */}
      <style jsx>{`
        @keyframes voice-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
