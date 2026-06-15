'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { saraApi, SaraStreamChunk } from '@/lib/api/sara';
import { cn } from '@/lib/utils';

/**
 * ============================================================================
 * SARA WIDGET — Holographic Princess AI Assistant
 * ============================================================================
 *
 * Widget flottant holographique sur la landing page.
 * "Sarah" en hébreu signifie "Princesse" — le design reflète cette
 * identité : élégant, royal, captivant, avec des effets holographiques
 * qui évoquent la lumière, la sagesse et la noblesse.
 *
 * Design : Glassmorphism + Holographic glow + Hebrew princess theme
 * Palette : Cyan royal / Or / Violet profond / Bleu nuit
 *
 * Fonctionnalités :
 *   - Chat conversationnel avec streaming SSE
 *   - Suggestions de questions rapides
 *   - Animation de typing holographique
 *   - Effets de particules lumineuses
 *   - CTA de conversion intégrés
 *   - Responsive mobile
 */

// ─── PARTICLE SYSTEM ──────────────────────────────────────────────────────

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  angle: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    opacity: Math.random() * 0.5 + 0.1,
    speed: Math.random() * 0.3 + 0.1,
    angle: Math.random() * 360,
  }));
}

// ─── SARAH WIDGET COMPONENT ──────────────────────────────────────────────

export default function SaraWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    {
      role: 'assistant',
      content: "Shalom ! Je suis Sarah, votre princesse digitale Academia Helm. Je suis là pour vous guider et vous montrer comment notre solution peut transformer la gestion de votre école. Que souhaitez-vous savoir ?",
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [streamingText, setStreamingText] = useState('');
  const [particles] = useState(() => generateParticles(20));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const quickSuggestions = [
    "Qu'est-ce que Academia Helm ?",
    "Quels sont les tarifs ?",
    "Quels modules sont inclus ?",
    "Comment fonctionne l'IA ?",
    "Je veux une démo",
    "Comment s'inscrire ?",
  ];

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, streamingText]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [isOpen]);

  // ─── STREAMING SEND HANDLER ──────────────────────────────────────────

  const handleSend = useCallback(async (text?: string) => {
    const userMsg = text || input.trim();
    if (!userMsg || isTyping) return;

    setInput('');
    setShowSuggestions(false);
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);
    setStreamingText('');

    let fullText = '';

    try {
      const stream = saraApi.queryStream(userMsg, undefined, messages);

      for await (const chunk of stream) {
        if (chunk.type === 'delta' && chunk.text) {
          fullText += chunk.text;
          setStreamingText(fullText);
        } else if (chunk.type === 'error') {
          // If stream error, show error message
          if (!fullText) {
            fullText = "Je suis désolée, une erreur technique s'est produite. Souhaitez-vous qu'un conseiller vous contacte directement ? C'est gratuit et sans engagement.";
          }
          break;
        }
      }

      // Finalize message
      if (fullText) {
        setMessages(prev => [...prev, { role: 'assistant', content: fullText }]);
      } else {
        // Empty response fallback
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "Je suis temporairement indisponible. Souhaitez-vous qu'un conseiller vous contacte directement ? C'est gratuit et sans engagement.",
        }]);
      }
    } catch (error: any) {
      console.error('[SaraWidget] Error:', error?.message);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Je suis désolée, une erreur de connexion s'est produite. Souhaitez-vous qu'un conseiller vous contacte directement ? C'est gratuit et sans engagement.",
      }]);
    } finally {
      setIsTyping(false);
      setStreamingText('');
    }
  }, [input, isTyping, messages]);

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── HOLOGRAPHIC AVATAR ──────────────────────────────────────────────

  const SarahAvatar = () => (
    <div className="relative w-11 h-11 flex items-center justify-center">
      {/* Outer glow ring */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400/40 via-purple-400/30 to-amber-400/20 animate-[spin_8s_linear_infinite]" />
      {/* Inner holographic disc */}
      <div className="absolute inset-[2px] rounded-full bg-gradient-to-br from-slate-900 via-blue-950 to-purple-950 backdrop-blur-xl border border-cyan-400/30 flex items-center justify-center">
        {/* Hebrew Shin (ש) for Sarah */}
        <span className="text-lg font-bold bg-gradient-to-r from-cyan-300 via-purple-300 to-amber-300 bg-clip-text text-transparent select-none">
          ש
        </span>
        {/* Animated glow pulse */}
        <div className="absolute inset-0 rounded-full bg-cyan-400/10 animate-pulse" />
      </div>
    </div>
  );

  // ─── RENDER ──────────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-6 right-6 z-[1000] font-sans">
      {isOpen ? (
        <div
          className={cn(
            'w-[400px] max-h-[600px] flex flex-col overflow-hidden',
            'animate-in slide-in-from-bottom-4 duration-500',
            // Holographic glassmorphic container
            'rounded-2xl',
            'bg-gradient-to-b from-slate-950/95 via-blue-950/90 to-purple-950/95',
            'backdrop-blur-2xl',
            'border border-cyan-400/20',
            'shadow-[0_0_40px_rgba(34,211,238,0.15),0_0_80px_rgba(139,92,246,0.1),inset_0_1px_0_rgba(255,255,255,0.05)]',
          )}
        >
          {/* ─── HEADER ──────────────────────────────────────────── */}
          <div className="relative p-4 flex items-center justify-between shrink-0 overflow-hidden">
            {/* Holographic header gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-amber-500/10" />
            {/* Animated scan line */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent animate-[scan_4s_linear_infinite]" />
            </div>

            <div className="relative flex items-center gap-3">
              <SarahAvatar />
              <div>
                <h4 className="font-bold text-sm bg-gradient-to-r from-cyan-300 via-purple-300 to-amber-300 bg-clip-text text-transparent">
                  Sarah
                </h4>
                <p className="text-[10px] text-cyan-300/70 font-medium tracking-wider uppercase">
                  Princesse Digitale — Academia Helm
                </p>
              </div>
            </div>

            <div className="relative flex items-center gap-2">
              {/* Online indicator with holographic glow */}
              <div className="relative">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <div className="absolute inset-0 w-2 h-2 bg-emerald-400 rounded-full animate-ping opacity-30" />
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-white/10 p-1.5 rounded-lg transition-colors text-cyan-300/70 hover:text-cyan-300"
                aria-label="Fermer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* ─── MESSAGES ─────────────────────────────────────────── */}
          <div className="relative flex-1 overflow-y-auto p-4 space-y-3 min-h-[320px]">
            {/* Floating particles background */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {particles.map((p) => (
                <div
                  key={p.id}
                  className="absolute rounded-full bg-cyan-400"
                  style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    opacity: p.opacity,
                    animation: `float ${3 + p.speed * 10}s ease-in-out infinite`,
                    animationDelay: `${p.id * 0.2}s`,
                  }}
                />
              ))}
            </div>

            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start', 'relative z-10')}>
                <div
                  className={cn(
                    'max-w-[85%] p-3 rounded-2xl text-[13px] leading-relaxed',
                    m.role === 'user'
                      ? // User message: holographic cyan glow
                        cn(
                          'bg-gradient-to-r from-cyan-500/20 to-blue-500/20',
                          'border border-cyan-400/30',
                          'text-cyan-100 rounded-tr-sm',
                          'shadow-[0_0_15px_rgba(34,211,238,0.1)]',
                        )
                      : // Sarah message: holographic purple glass
                        cn(
                          'bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-cyan-500/10',
                          'border border-purple-400/20',
                          'text-purple-100 rounded-tl-sm',
                          'shadow-[0_0_15px_rgba(139,92,246,0.08)]',
                        ),
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {/* Streaming text display */}
            {isTyping && streamingText && (
              <div className="flex justify-start relative z-10">
                <div className={cn(
                  'max-w-[85%] p-3 rounded-2xl rounded-tl-sm text-[13px] leading-relaxed',
                  'bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-cyan-500/10',
                  'border border-purple-400/20',
                  'text-purple-100',
                  'shadow-[0_0_15px_rgba(139,92,246,0.08)]',
                )}>
                  {streamingText}
                  <span className="inline-block w-[2px] h-4 bg-cyan-400 ml-0.5 animate-pulse align-middle" />
                </div>
              </div>
            )}

            {/* Typing indicator (when waiting for first token) */}
            {isTyping && !streamingText && (
              <div className="flex justify-start relative z-10">
                <div className={cn(
                  'p-3 rounded-2xl rounded-tl-sm',
                  'bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-cyan-500/10',
                  'border border-purple-400/20',
                  'shadow-[0_0_15px_rgba(139,92,246,0.08)]',
                  'flex gap-2 items-center',
                )}>
                  <span className="w-2 h-2 bg-cyan-400/80 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-purple-400/80 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-amber-400/80 rounded-full animate-bounce" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ─── QUICK SUGGESTIONS ────────────────────────────────── */}
          {showSuggestions && messages.length <= 1 && (
            <div className="px-4 pb-2 shrink-0 relative">
              <p className="text-[10px] text-cyan-400/50 mb-2 font-semibold uppercase tracking-[0.15em]">
                Questions fréquentes
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickSuggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={cn(
                      'text-[11px] px-3 py-1.5 rounded-full transition-all duration-300',
                      'bg-white/[0.03] border border-cyan-400/15',
                      'text-cyan-200/70',
                      'hover:bg-cyan-400/10 hover:border-cyan-400/40 hover:text-cyan-200',
                      'hover:shadow-[0_0_12px_rgba(34,211,238,0.15)]',
                    )}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── INPUT ────────────────────────────────────────────── */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 shrink-0 relative"
          >
            {/* Holographic separator line */}
            <div className="absolute top-0 left-4 right-4 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />

            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Posez votre question..."
                className={cn(
                  'w-full py-2.5 pl-4 pr-12 text-sm rounded-full outline-none transition-all duration-300',
                  'bg-white/[0.04] border border-cyan-400/15',
                  'text-cyan-100 placeholder:text-cyan-400/30',
                  'focus:border-cyan-400/40 focus:bg-white/[0.06]',
                  'focus:shadow-[0_0_20px_rgba(34,211,238,0.1)]',
                )}
                disabled={isTyping}
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className={cn(
                  'absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full',
                  'flex items-center justify-center transition-all duration-300',
                  input.trim() && !isTyping
                    ? cn(
                        'bg-gradient-to-r from-cyan-500 to-purple-500',
                        'text-white hover:from-cyan-400 hover:to-purple-400',
                        'shadow-[0_0_15px_rgba(34,211,238,0.3)]',
                        'scale-100',
                      )
                    : 'bg-white/5 text-cyan-400/30 scale-95 cursor-not-allowed',
                )}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      ) : (
        // ─── CLOSED STATE — Floating Holographic Button ──────────
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            'group relative w-16 h-16 rounded-full',
            'flex items-center justify-center',
            'transition-all duration-500',
            'hover:scale-110',
          )}
          aria-label="Ouvrir le chat Sarah"
        >
          {/* Outer holographic glow rings */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 via-purple-500 to-amber-400 opacity-30 animate-pulse" />
          <div className="absolute inset-[2px] rounded-full bg-gradient-to-br from-slate-950 via-blue-950 to-purple-950 border border-cyan-400/30" />

          {/* Inner content */}
          <div className="relative flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cyan-300">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Pulse animation ring */}
          <div className="absolute inset-0 rounded-full border border-cyan-400/40 animate-ping opacity-20" />

          {/* Badge "IA" */}
          <div className={cn(
            'absolute -top-2 left-1/2 -translate-x-1/2',
            'bg-gradient-to-r from-cyan-500 to-purple-500',
            'text-white text-[9px] font-bold px-2 py-0.5 rounded-full',
            'border border-white/20',
            'shadow-[0_0_10px_rgba(34,211,238,0.3)]',
          )}>
            IA
          </div>

          {/* Notification dot */}
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full border-2 border-slate-950 animate-pulse" />

          {/* Tooltip */}
          <div className={cn(
            'absolute right-full mr-3',
            'bg-gradient-to-r from-slate-950/95 to-blue-950/95',
            'backdrop-blur-xl border border-cyan-400/20',
            'text-cyan-200 text-xs font-semibold py-2 px-3 rounded-lg',
            'shadow-[0_0_20px_rgba(34,211,238,0.1)]',
            'whitespace-nowrap',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-300',
            'pointer-events-none',
          )}>
            Discutez avec Sarah
          </div>
        </button>
      )}

      {/* ─── GLOBAL HOLOGRAPHIC ANIMATIONS ──────────────────────────── */}
      <style jsx global>{`
        @keyframes scan {
          0% { top: -2px; }
          100% { top: 100%; }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0.15;
          }
          25% {
            transform: translateY(-8px) translateX(4px);
            opacity: 0.35;
          }
          50% {
            transform: translateY(-4px) translateX(-4px);
            opacity: 0.2;
          }
          75% {
            transform: translateY(-12px) translateX(2px);
            opacity: 0.3;
          }
        }

        /* Custom scrollbar for holographic chat */
        .SaraWidget-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .SaraWidget-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .SaraWidget-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(34, 211, 238, 0.15);
          border-radius: 4px;
        }
        .SaraWidget-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(34, 211, 238, 0.3);
        }
      `}</style>
    </div>
  );
}
