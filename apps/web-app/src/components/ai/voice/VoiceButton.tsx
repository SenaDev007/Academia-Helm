/**
 * ============================================================================
 * VOICE BUTTON — Bouton micro pour enregistrer la voix (SARA)
 * ============================================================================
 *
 * Bouton style ChatGPT :
 *   - Simple icône micro transparente au repos
 *   - Animation de pulsation rouge pendant l'enregistrement
 *   - Indicateur de durée
 *   - Toast d'erreur si micro non disponible
 *
 * Utilise le hook useVoiceRecorder.
 * ============================================================================
 */

'use client';

import React, { useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

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
    sm: { button: 'w-8 h-8', icon: 14 },
    md: { button: 'w-10 h-10', icon: 16 },
    lg: { button: 'w-12 h-12', icon: 20 },
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
      {/* Bouton principal — ChatGPT-style simple */}
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isInitializing}
        className={`
          ${config.button} rounded-full flex items-center justify-center
          transition-all duration-200 relative z-10
          focus:outline-none
        `}
        style={
          isRecording
            ? {
                background: '#EF4444',
                color: '#ffffff',
                boxShadow: `0 0 ${8 + audioLevel * 16}px rgba(239,68,68,0.4)`,
                transform: `scale(${1 + audioLevel * 0.1})`,
              }
            : disabled
            ? {
                color: 'rgba(0,0,0,0.2)',
                cursor: 'not-allowed',
                background: 'transparent',
              }
            : {
                color: 'rgba(0,0,0,0.5)',
                background: 'transparent',
              }
        }
        title={
          isRecording
            ? `Arrêter l'enregistrement (${duration}s)`
            : isInitializing
            ? 'Initialisation du micro...'
            : error
            ? error
            : 'Note vocale'
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
          className="absolute -top-5 text-[9px] font-mono font-bold text-red-500"
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
            color: '#ef4444',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
