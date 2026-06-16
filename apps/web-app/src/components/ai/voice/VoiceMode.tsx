/**
 * ============================================================================
 * VOICE MODE — Mode vocal immersif pour SARA (style ChatGPT Voice)
 * ============================================================================
 *
 * Design identique au mode vocal ChatGPT :
 *   - Fond blanc épuré, minimaliste
 *   - Orbe bleue au centre avec dégradé et animations
 *   - Barre de saisie en bas avec micro + champ texte + fermer
 *   - Messages affichés en overlay discret
 *   - Animations fluides (pulsation, respiration)
 *
 * Flux :
 *   1. L'utilisateur ouvre le Voice Mode → orbe bleue au centre
 *   2. Clic sur l'orbe ou le micro → enregistrement commence
 *   3. L'orbe devient animée avec le niveau audio
 *   4. Clic stop → ASR → SARA → TTS → lecture
 *   5. L'orbe pulse verte pendant la lecture
 *   6. Retour à l'état initial
 * ============================================================================
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, Mic, MicOff, Volume2, Loader2, MessageCircle, Plus, Send, Pause } from 'lucide-react';
import { saraApi, VoiceChatResponse } from '@/lib/api/sara';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useVoicePlayback } from '@/hooks/useVoicePlayback';

// ─── CHATGPT-STYLE PALETTE ────────────────────────────────────────────────

const Colors = {
  // Background
  bg: '#FFFFFF',
  bgSubtle: '#F7F7F8',

  // Text
  textPrimary: '#1A1A2E',
  textSecondary: '#6B6B80',
  textMuted: '#9999AA',

  // Orb
  orbBlue: '#10A37F',       // ChatGPT green-teal
  orbBlueLight: '#1DB9A0',
  orbBlueDark: '#0D8C6F',
  orbGlow: 'rgba(16,163,127,0.15)',
  orbGlowActive: 'rgba(16,163,127,0.30)',

  // States
  listening: '#EF4444',
  listeningGlow: 'rgba(239,68,68,0.25)',
  processing: '#F59E0B',
  processingGlow: 'rgba(245,158,11,0.20)',
  speaking: '#10A37F',
  speakingGlow: 'rgba(16,163,127,0.25)',
  error: '#EF4444',
  errorGlow: 'rgba(239,68,68,0.15)',

  // Borders
  border: '#E5E5EA',
  borderFocus: '#10A37F',

  // Input
  inputBg: '#F7F7F8',
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
  const [textInput, setTextInput] = useState('');
  const [showMessages, setShowMessages] = useState(false);

  const recorder = useVoiceRecorder();
  const playback = useVoicePlayback();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── HELPERS ──────────────────────────────────────────────────────────

  const nextId = () => `msg-${++lastMessageIdRef.current}`;

  // Scroll vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset quand le mode s'ouvre
  useEffect(() => {
    if (isOpen) {
      setState('idle');
      setError(null);
      setShowMessages(false);
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
        // Erreur partielle — afficher ce qu'on a pu obtenir
        if (result.transcribedText || result.saraResponse) {
          if (result.transcribedText) {
            const userMsg: VoiceMessage = { id: nextId(), type: 'user', text: result.transcribedText, timestamp: new Date() };
            setMessages((prev) => [...prev, userMsg]);
            setConversationHistory((prev) => [...prev, { role: 'user', content: result.transcribedText }]);
          }
          if (result.saraResponse) {
            const assistantMsg: VoiceMessage = { id: nextId(), type: 'assistant', text: result.saraResponse, timestamp: new Date() };
            setMessages((prev) => [...prev, assistantMsg]);
            setConversationHistory((prev) => [...prev, { role: 'assistant', content: result.saraResponse }]);
          }
        }
        setError(result.error);
        setState('error');
        return;
      }

      // Ajouter le message utilisateur
      const userMsg: VoiceMessage = { id: nextId(), type: 'user', text: result.transcribedText, timestamp: new Date() };
      const assistantMsg: VoiceMessage = { id: nextId(), type: 'assistant', text: result.saraResponse, timestamp: new Date() };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
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
      setState('idle');
    }
  }, [state, playback.isPlaying, playback.isLoading]);

  // ─── MIC BUTTON HANDLER ───────────────────────────────────────────────

  const handleMicClick = useCallback(async () => {
    if (state === 'idle' || state === 'error') {
      await recorder.startRecording();
      setState('listening');
      setCurrentTranscription('');
      setCurrentResponse('');
      setError(null);
    } else if (state === 'listening') {
      await handleVoiceChat();
    } else if (state === 'speaking') {
      playback.stopAudio();
      await recorder.startRecording();
      setState('listening');
    }
  }, [state, recorder, handleVoiceChat, playback]);

  // ─── TEXT INPUT HANDLER ──────────────────────────────────────────────

  const handleTextSend = useCallback(async () => {
    const text = textInput.trim();
    if (!text) return;

    setTextInput('');
    setState('processing');
    setError(null);

    // Ajouter le message utilisateur
    const userMsg: VoiceMessage = { id: nextId(), type: 'user', text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const result = await saraApi.query(text, visitorId, conversationHistory);
      const responseText = result?.reply || result?.content || '';

      const assistantMsg: VoiceMessage = { id: nextId(), type: 'assistant', text: responseText, timestamp: new Date() };
      setMessages((prev) => [...prev, assistantMsg]);
      setConversationHistory((prev) => [
        ...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: responseText },
      ]);

      // TTS pour lire la réponse
      if (responseText) {
        try {
          const speakResult = await saraApi.voiceSpeak(responseText);
          if (speakResult.audioBase64) {
            setState('speaking');
            playback.playAudio(speakResult.audioBase64, speakResult.format);
          } else {
            setState('idle');
          }
        } catch {
          setState('idle');
        }
      } else {
        setState('idle');
      }
    } catch (err: any) {
      setError('Erreur de connexion. Réessayez.');
      setState('error');
    }
  }, [textInput, visitorId, conversationHistory, playback]);

  // ─── ORB CONFIG ──────────────────────────────────────────────────────

  const orbConfig = {
    idle: {
      color: Colors.orbBlue,
      glowColor: Colors.orbGlow,
      label: 'Appuyez pour parler',
      animation: 'orb-breathe 3s ease-in-out infinite',
    },
    listening: {
      color: Colors.listening,
      glowColor: Colors.listeningGlow,
      label: 'Enregistrement en cours…',
      animation: `orb-listen 1.2s ease-in-out infinite`,
    },
    processing: {
      color: Colors.processing,
      glowColor: Colors.processingGlow,
      label: 'Sarah réfléchit…',
      animation: 'orb-think 2s ease-in-out infinite',
    },
    speaking: {
      color: Colors.speaking,
      glowColor: Colors.speakingGlow,
      label: 'Sarah parle…',
      animation: 'orb-speak 2.5s ease-in-out infinite',
    },
    error: {
      color: Colors.error,
      glowColor: Colors.errorGlow,
      label: 'Erreur — Réessayez',
      animation: 'none',
    },
  };

  const currentOrb = orbConfig[state];

  // ─── NOT OPEN ─────────────────────────────────────────────────────────

  if (!isOpen) return null;

  // ─── RENDER ───────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: Colors.bg }}>
      {/* ─── HEADER (ChatGPT-style) ──────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b"
        style={{ borderColor: Colors.border, background: Colors.bg }}
      >
        <div className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: Colors.bgSubtle }}
        >
          <Plus size={18} style={{ color: Colors.textSecondary }} />
        </div>

        <h2 className="text-sm font-semibold" style={{ color: Colors.textPrimary }}>
          Sarah Mode vocal
        </h2>

        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
          style={{ background: Colors.textPrimary }}
        >
          <X size={16} style={{ color: '#FFFFFF' }} />
        </button>
      </div>

      {/* ─── MESSAGES OVERLAY (discret, en haut) ──────────────────────── */}
      {messages.length > 0 && (
        <div className="px-4 pt-2">
          <button
            onClick={() => setShowMessages(!showMessages)}
            className="text-xs font-medium flex items-center gap-1 transition-colors"
            style={{ color: Colors.textMuted }}
          >
            <MessageCircle size={12} />
            {messages.length} message{messages.length > 1 ? 's' : ''}
            <span style={{ fontSize: 10 }}>{showMessages ? '▲' : '▼'}</span>
          </button>
        </div>
      )}

      {showMessages && (
        <div className="px-4 max-h-[30vh] overflow-y-auto space-y-2 voice-mode-scroll">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="max-w-[80%] px-3 py-2 rounded-2xl text-sm"
                style={
                  msg.type === 'user'
                    ? { background: Colors.orbBlue, color: '#FFFFFF', borderBottomRightRadius: 4 }
                    : { background: Colors.bgSubtle, color: Colors.textPrimary, borderBottomLeftRadius: 4 }
                }
              >
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* ─── ORB AREA (centre de l'écran) ────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Outer glow ring */}
        <div
          className="absolute rounded-full transition-all duration-500"
          style={{
            width: state === 'listening' ? 200 + recorder.audioLevel * 60 : 180,
            height: state === 'listening' ? 200 + recorder.audioLevel * 60 : 180,
            background: `radial-gradient(circle, ${currentOrb.glowColor} 0%, transparent 70%)`,
            animation: currentOrb.animation,
          }}
        />

        {/* Middle ring */}
        <div
          className="absolute rounded-full transition-all duration-500"
          style={{
            width: state === 'listening' ? 160 + recorder.audioLevel * 30 : 140,
            height: state === 'listening' ? 160 + recorder.audioLevel * 30 : 140,
            border: `2px solid ${currentOrb.color}`,
            opacity: 0.2,
            animation: currentOrb.animation,
          }}
        />

        {/* Main orb button */}
        <button
          onClick={handleMicClick}
          className="relative rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 focus:outline-none"
          style={{
            width: state === 'listening' ? 110 + recorder.audioLevel * 20 : 100,
            height: state === 'listening' ? 110 + recorder.audioLevel * 20 : 100,
            background: `radial-gradient(circle at 35% 35%, ${currentOrb.color}, ${Colors.orbBlueDark})`,
            boxShadow: `0 0 ${state === 'listening' ? 30 + recorder.audioLevel * 30 : 20}px ${currentOrb.glowColor}`,
            animation: currentOrb.animation,
          }}
        >
          {/* Highlight */}
          <div
            className="absolute top-3 left-4 w-10 h-10 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.35), transparent)',
            }}
          />

          {/* Icon */}
          {state === 'idle' && <Mic size={32} className="text-white" />}
          {state === 'listening' && <MicOff size={32} className="text-white" />}
          {state === 'processing' && <Loader2 size={32} className="text-white animate-spin" />}
          {state === 'speaking' && <Volume2 size={32} className="text-white" />}
          {state === 'error' && <Mic size={32} className="text-white" />}
        </button>

        {/* State label */}
        <p
          className="mt-6 text-sm font-medium transition-all duration-300"
          style={{ color: currentOrb.color }}
        >
          {currentOrb.label}
        </p>

        {/* Duration pendant l'enregistrement */}
        {state === 'listening' && recorder.duration > 0 && (
          <p className="mt-1 text-xs font-mono" style={{ color: Colors.textMuted }}>
            {recorder.duration}s
          </p>
        )}

        {/* Error message */}
        {error && (
          <div
            className="mt-4 px-4 py-2 rounded-xl text-xs max-w-sm text-center"
            style={{
              background: 'rgba(239,68,68,0.08)',
              color: Colors.error,
              border: '1px solid rgba(239,68,68,0.15)',
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* ─── BOTTOM INPUT BAR (ChatGPT-style) ────────────────────────── */}
      <div className="shrink-0 px-3 pb-6 pt-2">
        <div
          className="flex items-center gap-2 rounded-full px-4 py-2.5 transition-all"
          style={{
            background: Colors.inputBg,
            border: `1.5px solid ${state === 'listening' ? Colors.listening : Colors.border}`,
            boxShadow: state === 'listening' ? `0 0 0 3px ${Colors.listeningGlow}` : 'none',
          }}
        >
          {/* Mic button (ChatGPT-style, à gauche) */}
          <button
            onClick={handleMicClick}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all"
            style={{
              background: state === 'listening' ? Colors.listening : 'transparent',
              color: state === 'listening' ? '#FFFFFF' : Colors.textSecondary,
            }}
            title={state === 'listening' ? 'Arrêter' : 'Mode vocal'}
          >
            {state === 'listening' ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          {/* Text input */}
          <input
            ref={inputRef}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleTextSend()}
            placeholder="Écrire un message…"
            className="flex-1 bg-transparent border-none outline-none text-sm"
            style={{ color: Colors.textPrimary }}
            disabled={state === 'processing' || state === 'speaking'}
          />

          {/* Send button (ChatGPT-style, à droite) */}
          <button
            onClick={handleTextSend}
            disabled={!textInput.trim() || state === 'processing' || state === 'speaking'}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
            style={{
              background: textInput.trim() ? Colors.orbBlue : Colors.bgSubtle,
              color: textInput.trim() ? '#FFFFFF' : Colors.textMuted,
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* ─── ANIMATIONS ────────────────────────────────────────────────── */}
      <style jsx global>{`
        @keyframes orb-breathe {
          0%, 100% { transform: scale(1); box-shadow: 0 0 20px ${Colors.orbGlow}; }
          50% { transform: scale(1.04); box-shadow: 0 0 35px ${Colors.orbGlowActive}; }
        }

        @keyframes orb-listen {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }

        @keyframes orb-think {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.03); opacity: 1; }
        }

        @keyframes orb-speak {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.03); }
          50% { transform: scale(0.98); }
          75% { transform: scale(1.02); }
        }

        .voice-mode-scroll::-webkit-scrollbar {
          width: 3px;
        }
        .voice-mode-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .voice-mode-scroll::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.1);
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}
