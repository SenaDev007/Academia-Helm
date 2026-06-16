/**
 * ============================================================================
 * VOICE MODE — Mode vocal immersif pour SARA (style ChatGPT Voice)
 * ============================================================================
 *
 * Design identique au mode vocal ChatGPT :
 *   - Fond blanc épuré, minimaliste
 *   - Orbe 2D plate au centre avec dégradé plat (pas de 3D)
 *   - Barre de saisie en bas avec micro + champ texte + fermer
 *   - Conversation live : détecte le silence automatiquement,
 *     traite la voix, répond, puis réécoute automatiquement
 *   - Animations fluides (pulsation, respiration)
 *
 * Flux (live, comme ChatGPT) :
 *   1. L'utilisateur ouvre le Voice Mode → orbe verte au centre
 *   2. L'enregistrement démarre automatiquement (ou clic micro)
 *   3. Quand le silence est détecté → arrêt auto → ASR → SARA → TTS
 *   4. La réponse est lue, puis l'enregistrement redémarre automatiquement
 *   5. L'utilisateur peut parler à tout moment pour interrompre
 * ============================================================================
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, Mic, MicOff, Volume2, Loader2, MessageCircle, Plus, Send } from 'lucide-react';
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

  // Orb (flat 2D, ChatGPT green-teal)
  orbPrimary: '#10A37F',
  orbLight: '#1DB9A0',
  orbDark: '#0D8C6F',
  orbGlow: 'rgba(16,163,127,0.12)',
  orbGlowActive: 'rgba(16,163,127,0.25)',

  // States
  listening: '#EF4444',
  listeningGlow: 'rgba(239,68,68,0.15)',
  processing: '#F59E0B',
  processingGlow: 'rgba(245,158,11,0.12)',
  speaking: '#10A37F',
  speakingGlow: 'rgba(16,163,127,0.15)',
  error: '#EF4444',
  errorGlow: 'rgba(239,68,68,0.10)',

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

// ─── SILENCE DETECTION ────────────────────────────────────────────────────

const SILENCE_THRESHOLD = 0.08; // Audio level below this = silence
const SILENCE_DURATION_MS = 1500; // Silence for this long = stop recording
const MIN_RECORDING_MS = 1500; // Minimum recording time before silence detection
const MAX_RECORDING_MS = 60000; // Maximum recording time

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

  // Silence detection refs
  const silenceStartRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number>(0);
  const silenceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isAutoListeningRef = useRef(false); // Track if we're in auto-listening loop

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
      isAutoListeningRef.current = false;
    }
  }, [isOpen]);

  // Arrêter la lecture si on ferme
  useEffect(() => {
    if (!isOpen) {
      playback.stopAudio();
      recorder.cancelRecording();
      clearSilenceCheck();
      isAutoListeningRef.current = false;
    }
  }, [isOpen, playback, recorder]);

  // ─── SILENCE DETECTION ────────────────────────────────────────────────

  const clearSilenceCheck = useCallback(() => {
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
      silenceCheckIntervalRef.current = null;
    }
    silenceStartRef.current = null;
  }, []);

  // Use a ref for the stop-and-process callback to avoid circular dependencies
  const handleStopAndProcessRef = useRef<() => void>(() => {});

  const startSilenceDetection = useCallback(() => {
    clearSilenceCheck();
    recordingStartRef.current = Date.now();

    silenceCheckIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - recordingStartRef.current;

      // Don't check silence before minimum recording time
      if (elapsed < MIN_RECORDING_MS) return;

      // Auto-stop after max recording time
      if (elapsed >= MAX_RECORDING_MS) {
        clearSilenceCheck();
        handleStopAndProcessRef.current();
        return;
      }

      // Check if audio level is below silence threshold
      if (recorder.audioLevel < SILENCE_THRESHOLD) {
        if (silenceStartRef.current === null) {
          silenceStartRef.current = Date.now();
        } else if (Date.now() - silenceStartRef.current >= SILENCE_DURATION_MS) {
          // Silence detected for long enough — stop recording
          clearSilenceCheck();
          handleStopAndProcessRef.current();
        }
      } else {
        // Sound detected — reset silence timer
        silenceStartRef.current = null;
      }
    }, 200);
  }, [recorder.audioLevel, clearSilenceCheck]);

  // ─── VOICE CHAT PIPELINE ──────────────────────────────────────────────

  const handleStopAndProcess = useCallback(async () => {
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

      // Ajouter les messages
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
        // Auto-restart listening after response
        autoRestartListening();
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du traitement vocal');
      setState('error');
    }
  }, [recorder, visitorId, conversationHistory, playback]);

  // Keep the ref updated so silence detection can call it
  useEffect(() => {
    handleStopAndProcessRef.current = handleStopAndProcess;
  }, [handleStopAndProcess]);

  // ─── AUTO RESTART LISTENING ───────────────────────────────────────────

  const autoRestartListening = useCallback(async () => {
    if (!isOpen) return;
    isAutoListeningRef.current = true;

    try {
      await recorder.startRecording();
      setState('listening');
      setCurrentTranscription('');
      setCurrentResponse('');
      setError(null);
      startSilenceDetection();
    } catch {
      setState('idle');
      isAutoListeningRef.current = false;
    }
  }, [isOpen, recorder, startSilenceDetection]);

  // ─── LISTEN FOR PLAYBACK END → AUTO RESTART ──────────────────────────

  useEffect(() => {
    if (state === 'speaking' && !playback.isPlaying && !playback.isLoading) {
      // Response finished playing — auto restart listening
      autoRestartListening();
    }
  }, [state, playback.isPlaying, playback.isLoading, autoRestartListening]);

  // ─── MIC BUTTON HANDLER ───────────────────────────────────────────────

  const handleMicClick = useCallback(async () => {
    if (state === 'idle' || state === 'error') {
      // Start listening
      isAutoListeningRef.current = true;
      await recorder.startRecording();
      setState('listening');
      setCurrentTranscription('');
      setCurrentResponse('');
      setError(null);
    } else if (state === 'listening') {
      // Manual stop — process now
      clearSilenceCheck();
      await handleStopAndProcess();
    } else if (state === 'speaking') {
      // Interrupt Sarah — stop playback and start listening
      playback.stopAudio();
      await recorder.startRecording();
      setState('listening');
      startSilenceDetection();
    } else if (state === 'processing') {
      // Can't interrupt processing
    }
  }, [state, recorder, handleStopAndProcess, playback, startSilenceDetection, clearSilenceCheck]);

  // ─── TEXT INPUT HANDLER ──────────────────────────────────────────────

  const handleTextSend = useCallback(async () => {
    const text = textInput.trim();
    if (!text) return;

    setTextInput('');
    setState('processing');
    setError(null);
    clearSilenceCheck();

    // Stop any ongoing recording
    if (recorder.isRecording) {
      recorder.cancelRecording();
    }

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
            autoRestartListening();
          }
        } catch {
          setState('idle');
          autoRestartListening();
        }
      } else {
        setState('idle');
        autoRestartListening();
      }
    } catch (err: any) {
      setError('Erreur de connexion. Réessayez.');
      setState('error');
    }
  }, [textInput, visitorId, conversationHistory, playback, recorder, clearSilenceCheck, autoRestartListening]);

  // ─── ORB CONFIG (flat 2D — ChatGPT screenshot) ─────────────────────

  const orbConfig = {
    idle: {
      color: Colors.orbPrimary,
      glowColor: Colors.orbGlow,
      label: 'Appuyez pour parler',
      scale: 1,
    },
    listening: {
      color: Colors.listening,
      glowColor: Colors.listeningGlow,
      label: 'Je vous écoute…',
      scale: 1 + recorder.audioLevel * 0.08,
    },
    processing: {
      color: Colors.processing,
      glowColor: Colors.processingGlow,
      label: 'Sarah réfléchit…',
      scale: 1,
    },
    speaking: {
      color: Colors.speaking,
      glowColor: Colors.speakingGlow,
      label: 'Sarah parle…',
      scale: 1,
    },
    error: {
      color: Colors.error,
      glowColor: Colors.errorGlow,
      label: 'Erreur — Réessayez',
      scale: 1,
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
          onClick={() => {
            isAutoListeningRef.current = false;
            clearSilenceCheck();
            onClose();
          }}
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
                    ? { background: Colors.orbPrimary, color: '#FFFFFF', borderBottomRightRadius: 4 }
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

      {/* ─── ORB AREA (centre de l'écran — 2D flat) ─────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Outer glow (subtle, flat) */}
        <div
          className="absolute rounded-full transition-all duration-500"
          style={{
            width: state === 'listening' ? 200 + recorder.audioLevel * 40 : 180,
            height: state === 'listening' ? 200 + recorder.audioLevel * 40 : 180,
            background: `radial-gradient(circle, ${currentOrb.glowColor} 0%, transparent 70%)`,
          }}
        />

        {/* Main orb — flat 2D circle (ChatGPT screenshot style) */}
        <button
          onClick={handleMicClick}
          className="relative rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 focus:outline-none"
          style={{
            width: 100 * currentOrb.scale,
            height: 100 * currentOrb.scale,
            // Flat 2D gradient — no 3D highlight
            background: currentOrb.color,
            boxShadow: `0 0 ${state === 'listening' ? 20 + recorder.audioLevel * 20 : 15}px ${currentOrb.glowColor}`,
          }}
        >
          {/* Flat concentric circle effect (like ChatGPT screenshot) */}
          <div
            className="absolute rounded-full"
            style={{
              width: '70%',
              height: '70%',
              background: `radial-gradient(circle, rgba(255,255,255,0.15), transparent)`,
            }}
          />

          {/* Icon */}
          {state === 'idle' && <Mic size={28} className="text-white" />}
          {state === 'listening' && <MicOff size={28} className="text-white" />}
          {state === 'processing' && <Loader2 size={28} className="text-white animate-spin" />}
          {state === 'speaking' && <Volume2 size={28} className="text-white" />}
          {state === 'error' && <Mic size={28} className="text-white" />}
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
              background: 'rgba(239,68,68,0.06)',
              color: Colors.error,
              border: '1px solid rgba(239,68,68,0.12)',
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
              background: textInput.trim() ? Colors.orbPrimary : Colors.bgSubtle,
              color: textInput.trim() ? '#FFFFFF' : Colors.textMuted,
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* ─── ANIMATIONS ────────────────────────────────────────────────── */}
      <style jsx global>{`
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
