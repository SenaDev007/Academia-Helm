/**
 * ============================================================================
 * VOICE MODE — Mode vocal immersif pour SARA (style ChatGPT Voice)
 * ============================================================================
 *
 * Plein écran avec :
 *   - Orbe animée qui réagit à la voix (audio level visualization)
 *   - Enregistrement automatique : parler → transcrire → SARA → TTS → parler
 *   - Affichage du texte en temps réel (transcription + réponse)
 *   - Bouton pour quitter le mode vocal
 *   - Design holographique cohérent avec SaraWidget
 *
 * Flux :
 *   1. L'utilisateur ouvre le Voice Mode
 *   2. L'orbe est en état "listening" — l'utilisateur parle
 *   3. Quand l'utilisateur clique stop → ASR → SARA → TTS
 *   4. L'orbe passe en mode "speaking" pendant la lecture TTS
 *   5. Retour à l'état "listening" pour la prochaine question
 * ============================================================================
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, Mic, MicOff, Volume2, Loader2, MessageCircle } from 'lucide-react';
import { saraApi, VoiceChatResponse } from '@/lib/api/sara';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useVoicePlayback } from '@/hooks/useVoicePlayback';

// ─── HOLO COLORS ────────────────────────────────────────────────────────────

const H = {
  cyan: '#00e5ff',
  cyanDim: 'rgba(0,229,255,0.7)',
  cyanFaint: 'rgba(0,229,255,0.3)',
  cyanGhost: 'rgba(0,229,255,0.1)',
  cyanBorder: 'rgba(0,229,255,0.85)',
  darkBg: 'rgba(0,12,28,0.98)',
  darkBg90: 'rgba(0,12,28,0.90)',
  gold: '#f5b335',
  green: '#22c55e',
  red: '#ef4444',
  redGlow: 'rgba(239,68,68,0.4)',
} as const;

// ─── TYPES ──────────────────────────────────────────────────────────────────

type VoiceModeState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface VoiceMessage {
  id: string;
  type: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface VoiceModeProps {
  /** Contrôle la visibilité du mode vocal */
  isOpen: boolean;

  /** Callback pour fermer le mode vocal */
  onClose: () => void;

  /** ID visiteur pour le contexte SARA */
  visitorId?: string;
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export function VoiceMode({ isOpen, onClose, visitorId }: VoiceModeProps) {
  // ─── STATE ────────────────────────────────────────────────────────────

  const [state, setState] = useState<VoiceModeState>('idle');
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [currentResponse, setCurrentResponse] = useState('');
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const recorder = useVoiceRecorder();
  const playback = useVoicePlayback();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef(0);

  // ─── HELPERS ──────────────────────────────────────────────────────────

  const nextId = () => `msg-${++lastMessageIdRef.current}`;

  // Scroll vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTranscription, currentResponse]);

  // Reset quand le mode s'ouvre
  useEffect(() => {
    if (isOpen) {
      setState('idle');
      setError(null);
    }
  }, [isOpen]);

  // Arrêter la lecture si on ferme
  useEffect(() => {
    if (!isOpen) {
      playback.stopAudio();
      recorder.cancelRecording();
    }
  }, [isOpen, playback, recorder]);

  // ─── VOICE CHAT PIPELINE ──────────────────────────────────────────────

  const handleVoiceChat = useCallback(async () => {
    if (!recorder.isRecording) return;

    // Arrêter l'enregistrement
    const audioBase64 = await recorder.stopRecording();
    if (!audioBase64) {
      setState('idle');
      return;
    }

    setState('processing');
    setError(null);

    try {
      // Pipeline complet : ASR → SARA → TTS
      const result: VoiceChatResponse = await saraApi.voiceChat(
        audioBase64,
        visitorId,
        conversationHistory,
      );

      if (result.error) {
        setError(result.error);
        setState('error');
        return;
      }

      // Ajouter le message utilisateur
      const userMsg: VoiceMessage = {
        id: nextId(),
        type: 'user',
        text: result.transcribedText,
        timestamp: new Date(),
      };

      // Ajouter la réponse SARA
      const assistantMsg: VoiceMessage = {
        id: nextId(),
        type: 'assistant',
        text: result.saraResponse,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      // Mettre à jour l'historique de conversation
      setConversationHistory((prev) => [
        ...prev,
        { role: 'user', content: result.transcribedText },
        { role: 'assistant', content: result.saraResponse },
      ]);

      // Jouer la réponse audio
      if (result.audioBase64) {
        setState('speaking');
        playback.playAudio(result.audioBase64, result.format);
      } else {
        setState('idle');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du traitement vocal');
      setState('error');
    }
  }, [recorder, visitorId, conversationHistory, playback]);

  // ─── LISTEN FOR PLAYBACK END ──────────────────────────────────────────

  useEffect(() => {
    if (state === 'speaking' && !playback.isPlaying && !playback.isLoading) {
      // La lecture est terminée, retour à l'état d'écoute
      setState('idle');
    }
  }, [state, playback.isPlaying, playback.isLoading]);

  // ─── MIC BUTTON HANDLER ───────────────────────────────────────────────

  const handleMicClick = useCallback(async () => {
    if (state === 'idle' || state === 'error') {
      // Démarrer l'enregistrement
      await recorder.startRecording();
      setState('listening');
      setCurrentTranscription('');
      setCurrentResponse('');
    } else if (state === 'listening') {
      // Arrêter l'enregistrement et lancer le pipeline
      await handleVoiceChat();
    } else if (state === 'speaking') {
      // Interrompre la lecture et réécouter
      playback.stopAudio();
      await recorder.startRecording();
      setState('listening');
    }
  }, [state, recorder, handleVoiceChat, playback]);

  // ─── ORB VISUALIZATION ────────────────────────────────────────────────

  const orbConfig = {
    idle: {
      color: H.cyan,
      glowColor: 'rgba(0,229,255,0.2)',
      size: 120,
      scale: 1,
      label: 'Appuyez pour parler',
      icon: Mic,
    },
    listening: {
      color: H.red,
      glowColor: H.redGlow,
      size: 120 + recorder.audioLevel * 40,
      scale: 1 + recorder.audioLevel * 0.15,
      label: 'Enregistrement en cours...',
      icon: MicOff,
    },
    processing: {
      color: H.gold,
      glowColor: 'rgba(245,179,53,0.3)',
      size: 120,
      scale: 1,
      label: 'Sarah réfléchit...',
      icon: Loader2,
    },
    speaking: {
      color: H.green,
      glowColor: 'rgba(34,197,94,0.3)',
      size: 120 + (playback.isPlaying ? 15 : 0),
      scale: 1 + (playback.isPlaying ? 0.05 : 0),
      label: 'Sarah parle...',
      icon: Volume2,
    },
    error: {
      color: H.red,
      glowColor: H.redGlow,
      size: 120,
      scale: 1,
      label: 'Erreur — Réessayez',
      icon: MessageCircle,
    },
  };

  const currentOrb = orbConfig[state];
  const OrbIcon = currentOrb.icon;

  // ─── NOT OPEN ─────────────────────────────────────────────────────────

  if (!isOpen) return null;

  // ─── RENDER ───────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ background: H.darkBg }}
    >
      {/* ─── HEADER ──────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{
          borderBottom: `1px solid ${H.cyanFaint}`,
          background: H.darkBg90,
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${H.cyan}, #009bb8)`,
              boxShadow: `0 0 12px rgba(0,229,255,0.3)`,
            }}
          >
            <Crown size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ color: '#ffffff' }}>
              Mode Vocal — Sarah
            </h2>
            <p className="text-[10px]" style={{ color: H.cyanDim }}>
              Academia Helm
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{
            background: H.cyanGhost,
            border: `1px solid ${H.cyanFaint}`,
            color: H.cyanDim,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0,229,255,0.2)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = H.cyanGhost;
            e.currentTarget.style.color = H.cyanDim;
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* ─── MESSAGES (scrollable) ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 voice-mode-scroll">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-50">
            <p className="text-sm" style={{ color: H.cyanDim }}>
              Parlez à Sarah — elle vous répondra à voix haute
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className="max-w-[80%] px-3 py-2 rounded-xl text-sm"
              style={
                msg.type === 'user'
                  ? {
                      background: 'rgba(0,229,255,0.15)',
                      border: `1px solid ${H.cyanFaint}`,
                      color: '#ffffff',
                    }
                  : {
                      background: 'rgba(34,197,94,0.1)',
                      border: '1px solid rgba(34,197,94,0.2)',
                      color: '#e0e0e0',
                    }
              }
            >
              <p className="text-[9px] font-semibold mb-1" style={{
                color: msg.type === 'user' ? H.cyan : H.green,
              }}>
                {msg.type === 'user' ? 'Vous' : 'Sarah'}
              </p>
              {msg.text}
            </div>
          </div>
        ))}

        {/* Message en cours de transcription */}
        {state === 'listening' && (
          <div className="flex justify-end">
            <div
              className="max-w-[80%] px-3 py-2 rounded-xl text-sm"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#ffffff',
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: H.red }} />
                <span className="text-[9px]" style={{ color: H.red }}>
                  Enregistrement {recorder.duration}s
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {state === 'processing' && (
          <div className="flex justify-start">
            <div
              className="px-3 py-2 rounded-xl text-sm"
              style={{
                background: 'rgba(245,179,53,0.1)',
                border: '1px solid rgba(245,179,53,0.2)',
                color: H.gold,
              }}
            >
              <div className="flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" />
                <span className="text-[9px]">Sarah réfléchit...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── ORB + CONTROLS ────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex flex-col items-center py-8 px-4"
        style={{
          background: `linear-gradient(to top, ${H.darkBg}, transparent)`,
        }}
      >
        {/* Error message */}
        {error && (
          <div
            className="mb-4 px-4 py-2 rounded-lg text-xs max-w-md text-center"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: H.red,
            }}
          >
            {error}
          </div>
        )}

        {/* ORB */}
        <div className="relative flex items-center justify-center mb-6">
          {/* Outer glow */}
          <div
            className="absolute rounded-full transition-all duration-300"
            style={{
              width: currentOrb.size + 60,
              height: currentOrb.size + 60,
              background: `radial-gradient(circle, ${currentOrb.glowColor} 0%, transparent 70%)`,
              transform: `scale(${currentOrb.scale})`,
            }}
          />

          {/* Middle ring */}
          <div
            className="absolute rounded-full transition-all duration-300"
            style={{
              width: currentOrb.size + 20,
              height: currentOrb.size + 20,
              border: `1.5px solid ${currentOrb.color}`,
              opacity: 0.3,
              transform: `scale(${currentOrb.scale})`,
            }}
          />

          {/* Inner orb */}
          <button
            onClick={handleMicClick}
            className="relative rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer"
            style={{
              width: currentOrb.size,
              height: currentOrb.size,
              background: `radial-gradient(circle at 30% 30%, ${currentOrb.color}, rgba(0,0,0,0.8))`,
              boxShadow: `0 0 ${20 + recorder.audioLevel * 30}px ${currentOrb.glowColor}, inset 0 0 30px rgba(0,0,0,0.5)`,
              transform: `scale(${currentOrb.scale})`,
              animation: state === 'listening' ? 'voice-orb-breathe 1.5s ease-in-out infinite' :
                         state === 'speaking' ? 'voice-orb-speak 2s ease-in-out infinite' :
                         state === 'processing' ? 'voice-orb-think 2s ease-in-out infinite' : 'none',
            }}
          >
            {/* Highlight */}
            <div
              className="absolute top-2 left-3 w-8 h-8 rounded-full opacity-40"
              style={{
                background: `radial-gradient(circle, rgba(255,255,255,0.6), transparent)`,
              }}
            />

            <OrbIcon
              size={32}
              className={state === 'processing' ? 'animate-spin' : ''}
              style={{ color: '#ffffff' }}
            />
          </button>
        </div>

        {/* Label */}
        <p
          className="text-xs font-medium mb-2"
          style={{ color: currentOrb.color }}
        >
          {currentOrb.label}
        </p>

        {/* Duration pendant l'enregistrement */}
        {state === 'listening' && recorder.duration > 0 && (
          <p className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {recorder.duration}s / 60s max
          </p>
        )}
      </div>

      {/* ─── ANIMATIONS ────────────────────────────────────────────────── */}
      <style jsx global>{`
        @keyframes voice-orb-breathe {
          0%, 100% { transform: scale(1); box-shadow: 0 0 20px ${H.redGlow}; }
          50% { transform: scale(1.05); box-shadow: 0 0 40px ${H.redGlow}; }
        }

        @keyframes voice-orb-speak {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.03); }
          50% { transform: scale(0.98); }
          75% { transform: scale(1.02); }
        }

        @keyframes voice-orb-think {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.03); opacity: 1; }
        }

        .voice-mode-scroll::-webkit-scrollbar {
          width: 3px;
        }
        .voice-mode-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .voice-mode-scroll::-webkit-scrollbar-thumb {
          background: rgba(0,229,255,0.15);
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}

// ─── CROWN ICON (inline pour éviter l'import supplémentaire) ────────────────

function Crown({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </svg>
  );
}
