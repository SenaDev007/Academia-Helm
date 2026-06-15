'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { saraApi, SaraStreamChunk } from '@/lib/api/sara';
import { cn } from '@/lib/utils';
import { Flower2 } from 'lucide-react';

/**
 * ============================================================================
 * SARAH WIDGET — Holographic AI Assistant
 * ============================================================================
 *
 * Widget flottant holographique avec icône Fleur-de-lys.
 * "Sarah" = Princesse en hébreu — la fleur-de-lys est le symbole royal.
 *
 * Design : Couleurs Academia Helm (Navy/Gold) + Bleu tech sci-fi
 * Lisibilité : Texte blanc sur fond navy, contraste élevé
 * Effets : Hologramme avec scan lines, bordure lumineuse, particules
 *
 * Palette :
 *   Navy #0b2f73 / Deep #071d49 / Blue #1d4fa5
 *   Gold #f5b335 / Light #f7c76e
 *   Tech blue #1C6FE8 / Cyan glow #22d3ee
 *   Vert en-ligne #22c55e
 */

// ─── BRAND COLORS ─────────────────────────────────────────────────────────
const C = {
  navy: '#0b2f73',
  navyDeep: '#071d49',
  navyMid: '#103e91',
  navyBright: '#144798',
  blue: '#1d4fa5',
  gold: '#f5b335',
  goldLight: '#f7c76e',
  goldDark: '#C9A84C',
  techBlue: '#1C6FE8',
  cyanGlow: '#22d3ee',
  green: '#22c55e',
  greenGlow: '#4ade80',
} as const;

// ─── PARTICLE SYSTEM ──────────────────────────────────────────────────────

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    opacity: Math.random() * 0.35 + 0.05,
    speed: Math.random() * 0.4 + 0.1,
  }));
}

// ─── FLOWER ICON ────────────────────────────────────────────────────────
// Lucide Flower2 — icône moderne et élégante pour Sarah
// "Sarah" = Princesse en hébreu — la fleur est le symbole de grâce et royauté

// ─── SARAH WIDGET COMPONENT ──────────────────────────────────────────────

export default function SaraWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    {
      role: 'assistant',
      content: "Shalom ! Je suis Sarah, votre conseillère Academia Helm. Je suis là pour vous accompagner et vous montrer comment notre solution peut transformer la gestion de votre école. Que souhaitez-vous savoir ?",
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [streamingText, setStreamingText] = useState('');
  const [particles] = useState(() => generateParticles(20));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const quickSuggestions = [
    "Qu'est-ce que Academia Helm ?",
    "Quels sont les tarifs ?",
    "Quels modules sont inclus ?",
    "Comment fonctionne l'IA ?",
    "Je veux une démo",
    "Comment s'inscrire ?",
  ];

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, streamingText]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 500);
  }, [isOpen]);

  // ─── STREAMING SEND ──────────────────────────────────────────────────

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
          if (!fullText) {
            fullText = "Je suis désolée, une erreur technique s'est produite. Souhaitez-vous qu'un conseiller vous contacte directement ? C'est gratuit et sans engagement.";
          }
          break;
        }
      }

      if (fullText) {
        setMessages(prev => [...prev, { role: 'assistant', content: fullText }]);
      } else {
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── RENDER ──────────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-6 right-6 z-[1000] font-sans">
      {isOpen ? (
        <div
          className={cn(
            'w-[400px] max-h-[600px] flex flex-col overflow-hidden',
            'animate-in slide-in-from-bottom-4 duration-500',
            'rounded-2xl',
            // Holographic container — deep navy base
            'sara-holo-scroll',
          )}
          style={{
            background: `linear-gradient(180deg, ${C.navyDeep}ee 0%, ${C.navy}f2 40%, ${C.navyDeep}f5 100%)`,
            border: '1px solid rgba(28,111,232,0.25)',
            boxShadow: `
              0 0 30px rgba(28,111,232,0.12),
              0 0 60px rgba(11,47,115,0.15),
              0 0 100px rgba(245,179,53,0.04),
              inset 0 1px 0 rgba(255,255,255,0.06)
            `,
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* ─── ANIMATED HOLOGRAPHIC BORDER ─────────────────── */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden">
            <div className="absolute inset-0 rounded-2xl"
              style={{
                background: 'conic-gradient(from 0deg, transparent, rgba(28,111,232,0.25), transparent, rgba(245,179,53,0.15), transparent, rgba(34,211,238,0.15), transparent)',
                mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                maskComposite: 'exclude',
                WebkitMaskComposite: 'xor',
                padding: '1.5px',
                borderRadius: '1rem',
                animation: 'holoBorderSpin 6s linear infinite',
              }}
            />
          </div>

          {/* ─── SCAN LINE ──────────────────────────────────────── */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden z-20">
            <div className="absolute w-full h-[2px]"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.2), rgba(28,111,232,0.1), transparent)',
                boxShadow: '0 0 20px rgba(34,211,238,0.1)',
                animation: 'holoScan 4s linear infinite',
              }}
            />
            {/* Faint grid texture */}
            <div className="absolute inset-0 opacity-[0.015]"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)',
              }}
            />
          </div>

          {/* ─── HEADER ──────────────────────────────────────────── */}
          <div className="relative p-4 flex items-center justify-between shrink-0 overflow-hidden">
            <div className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, ${C.navy}cc, ${C.navyDeep}cc)` }}
            />
            {/* Gold accent line */}
            <div className="absolute bottom-0 left-0 right-0 h-[1px]"
              style={{ background: `linear-gradient(90deg, transparent, ${C.gold}40, transparent)` }}
            />

            <div className="relative flex items-center gap-3">
              {/* Fleur-de-lys Avatar */}
              <div className="relative w-11 h-11 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full"
                  style={{
                    background: `radial-gradient(circle, rgba(245,179,53,0.12) 0%, rgba(28,111,232,0.08) 50%, transparent 70%)`,
                    animation: 'holoPulse 3s ease-in-out infinite',
                  }}
                />
                <div className="absolute inset-[3px] rounded-full flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${C.navyDeep}, ${C.navy})`,
                    border: '1px solid rgba(245,179,53,0.25)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 12px rgba(245,179,53,0.1)',
                  }}
                >
                  <div style={{ animation: 'fleurFloat 3s ease-in-out infinite' }}>
                    <Flower2 size={22} strokeWidth={1.8} className="drop-shadow-[0_0_4px_rgba(245,179,53,0.4)]" style={{ color: C.gold }} />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-sm text-white"
                  style={{
                    textShadow: '0 0 12px rgba(245,179,53,0.25)',
                  }}
                >
                  Sarah
                </h4>
                <p className="text-[10px] font-medium tracking-[0.1em] uppercase"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                >
                  Conseillère Academia Helm
                </p>
              </div>
            </div>

            <div className="relative flex items-center gap-2.5">
              {/* GREEN online indicator */}
              <div className="relative flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: C.green, boxShadow: `0 0 6px ${C.green}` }}
                />
                <span className="text-[9px] font-semibold"
                  style={{ color: C.green }}
                >
                  En ligne
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-white/10 p-1.5 rounded-lg transition-colors text-white/50 hover:text-white/80"
                aria-label="Fermer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* ─── MESSAGES ─────────────────────────────────────────── */}
          <div className="relative flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] sara-holo-scroll">
            {/* Floating particles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {particles.map((p) => (
                <div
                  key={p.id}
                  className="absolute rounded-full"
                  style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    opacity: p.opacity,
                    background: p.id % 3 === 0 ? C.gold : C.cyanGlow,
                    animation: `holoFloat ${4 + p.speed * 8}s ease-in-out infinite`,
                    animationDelay: `${p.id * 0.15}s`,
                    boxShadow: `0 0 ${p.size * 2}px ${p.id % 3 === 0 ? 'rgba(245,179,53,0.2)' : 'rgba(34,211,238,0.2)'}`,
                  }}
                />
              ))}
            </div>

            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start', 'relative z-10')}>
                <div
                  className={cn(
                    'max-w-[85%] p-3 rounded-2xl text-[13px] leading-relaxed',
                    m.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm',
                  )}
                  style={m.role === 'user' ? {
                    background: `linear-gradient(135deg, rgba(28,111,232,0.2), rgba(11,47,115,0.3))`,
                    border: '1px solid rgba(28,111,232,0.3)',
                    color: '#ffffff',
                    boxShadow: '0 0 12px rgba(28,111,232,0.06)',
                  } : {
                    background: `linear-gradient(135deg, rgba(11,47,115,0.35), rgba(7,29,73,0.45))`,
                    border: '1px solid rgba(245,179,53,0.12)',
                    color: '#ffffff',
                    boxShadow: '0 0 12px rgba(245,179,53,0.03)',
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {/* Streaming text */}
            {isTyping && streamingText && (
              <div className="flex justify-start relative z-10">
                <div
                  className="max-w-[85%] p-3 rounded-2xl rounded-tl-sm text-[13px] leading-relaxed"
                  style={{
                    background: `linear-gradient(135deg, rgba(11,47,115,0.35), rgba(7,29,73,0.45))`,
                    border: '1px solid rgba(245,179,53,0.12)',
                    color: '#ffffff',
                    boxShadow: '0 0 12px rgba(245,179,53,0.03)',
                  }}
                >
                  {streamingText}
                  <span className="inline-block w-[2px] h-4 ml-0.5 animate-pulse align-middle"
                    style={{ backgroundColor: C.gold, boxShadow: `0 0 6px ${C.gold}` }}
                  />
                </div>
              </div>
            )}

            {/* Typing indicator */}
            {isTyping && !streamingText && (
              <div className="flex justify-start relative z-10">
                <div
                  className="p-3 rounded-2xl rounded-tl-sm flex gap-2 items-center"
                  style={{
                    background: `linear-gradient(135deg, rgba(11,47,115,0.35), rgba(7,29,73,0.45))`,
                    border: '1px solid rgba(245,179,53,0.12)',
                  }}
                >
                  <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:-0.3s]"
                    style={{ backgroundColor: C.techBlue, boxShadow: `0 0 4px ${C.techBlue}` }} />
                  <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:-0.15s]"
                    style={{ backgroundColor: C.gold, boxShadow: `0 0 4px ${C.gold}` }} />
                  <span className="w-2 h-2 rounded-full animate-bounce"
                    style={{ backgroundColor: C.cyanGlow, boxShadow: `0 0 4px ${C.cyanGlow}` }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ─── QUICK SUGGESTIONS ── VISIBLE, WHITE TEXT ──────────── */}
          {showSuggestions && messages.length <= 1 && (
            <div className="px-4 pb-2 shrink-0 relative">
              <p className="text-[10px] mb-2 font-semibold uppercase tracking-[0.12em]"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                Questions fréquentes
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickSuggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(suggestion)}
                    className="text-[11px] px-3 py-1.5 rounded-full transition-all duration-300 cursor-pointer"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#ffffff',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                      e.currentTarget.style.borderColor = 'rgba(28,111,232,0.5)';
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(28,111,232,0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── INPUT ── WHITE BACKGROUND, HOLOGRAPHIC BORDER ─────── */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 shrink-0 relative"
          >
            {/* Holographic separator */}
            <div className="absolute top-0 left-4 right-4 h-[1px]"
              style={{ background: `linear-gradient(90deg, transparent, ${C.gold}25, ${C.techBlue}20, transparent)` }}
            />

            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Posez votre question..."
                className="w-full py-2.5 pl-4 pr-12 text-sm rounded-full outline-none transition-all duration-300"
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(28,111,232,0.25)',
                  color: C.navyDeep,
                  boxShadow: '0 0 0 0 transparent',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = `${C.techBlue}60`;
                  e.currentTarget.style.boxShadow = `0 0 20px rgba(28,111,232,0.15), 0 0 40px rgba(34,211,238,0.08)`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(28,111,232,0.25)';
                  e.currentTarget.style.boxShadow = '0 0 0 0 transparent';
                }}
                disabled={isTyping}
              />
              <style>{`input::placeholder { color: rgba(11,47,115,0.35) !important; }`}</style>
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
                style={input.trim() && !isTyping ? {
                  background: `linear-gradient(135deg, ${C.techBlue}, ${C.navyBright})`,
                  color: '#fff',
                  boxShadow: `0 0 12px rgba(28,111,232,0.3)`,
                } : {
                  background: 'rgba(28,111,232,0.1)',
                  color: 'rgba(28,111,232,0.3)',
                  cursor: 'not-allowed',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      ) : (
        // ─── CLOSED STATE — Floating Fleur-de-Lys Button ─────────
        <button
          onClick={() => setIsOpen(true)}
          className="group relative w-[68px] h-[68px] rounded-full flex items-center justify-center transition-all duration-500 hover:scale-110"
          aria-label="Ouvrir le chat Sarah"
        >
          {/* Outer pulsing glow */}
          <div className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle, rgba(28,111,232,0.18) 0%, rgba(245,179,53,0.08) 50%, transparent 70%)`,
              animation: 'holoPulse 3s ease-in-out infinite',
            }}
          />
          {/* Rotating holographic aura */}
          <div className="absolute inset-[-3px] rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, rgba(28,111,232,0.35), transparent 25%, rgba(245,179,53,0.25), transparent 50%, rgba(34,211,238,0.25), transparent 75%, rgba(28,111,232,0.35))',
              mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              maskComposite: 'exclude',
              WebkitMaskComposite: 'xor',
              padding: '2px',
              borderRadius: '50%',
              animation: 'holoBorderSpin 6s linear infinite',
            }}
          />
          {/* Main button disc */}
          <div className="absolute inset-[2px] rounded-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${C.navyDeep}, ${C.navy})`,
              border: '1px solid rgba(28,111,232,0.25)',
              boxShadow: `0 0 25px rgba(28,111,232,0.15), 0 0 50px rgba(11,47,115,0.12), inset 0 1px 0 rgba(255,255,255,0.04)`,
            }}
          >
            <div style={{ animation: 'fleurFloat 3s ease-in-out infinite' }}>
              <Flower2 size={30} strokeWidth={1.6} className="drop-shadow-[0_0_8px_rgba(245,179,53,0.4)]" style={{ color: C.gold }} />
            </div>
          </div>

          {/* Ping ring */}
          <div className="absolute inset-0 rounded-full animate-ping opacity-15"
            style={{ border: `1.5px solid ${C.techBlue}` }}
          />

          {/* Badge "IA" */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full"
            style={{
              background: `linear-gradient(135deg, ${C.techBlue}, ${C.navyBright})`,
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: `0 0 8px rgba(28,111,232,0.25)`,
            }}
          >
            IA
          </div>

          {/* Green notification dot */}
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 animate-pulse"
            style={{
              background: `linear-gradient(135deg, ${C.green}, ${C.greenGlow})`,
              borderColor: C.navyDeep,
              boxShadow: `0 0 8px ${C.green}`,
            }}
          />

          {/* Hover tooltip */}
          <div className="absolute right-full mr-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none px-3 py-2 rounded-lg text-xs font-semibold"
            style={{
              background: `${C.navyDeep}ee`,
              border: '1px solid rgba(28,111,232,0.2)',
              color: '#ffffff',
              boxShadow: '0 0 15px rgba(28,111,232,0.08)',
              backdropFilter: 'blur(10px)',
            }}
          >
            Discutez avec Sarah
          </div>
        </button>
      )}

      {/* ─── ANIMATIONS ──────────────────────────────────────────────────── */}
      <style jsx global>{`
        @keyframes holoScan {
          0% { top: -2px; opacity: 1; }
          100% { top: 100%; opacity: 0.3; }
        }

        @keyframes holoFloat {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0.1;
          }
          25% {
            transform: translateY(-10px) translateX(5px);
            opacity: 0.3;
          }
          50% {
            transform: translateY(-5px) translateX(-5px);
            opacity: 0.12;
          }
          75% {
            transform: translateY(-15px) translateX(3px);
            opacity: 0.25;
          }
        }

        @keyframes holoBorderSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes holoPulse {
          0%, 100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
        }

        @keyframes fleurFloat {
          0%, 100% {
            transform: translateY(0);
            filter: drop-shadow(0 0 6px rgba(245,179,53,0.35));
          }
          50% {
            transform: translateY(-2px);
            filter: drop-shadow(0 0 10px rgba(245,179,53,0.55));
          }
        }

        /* Holographic scrollbar */
        .sara-holo-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .sara-holo-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .sara-holo-scroll::-webkit-scrollbar-thumb {
          background: rgba(28,111,232,0.15);
          border-radius: 4px;
        }
        .sara-holo-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(28,111,232,0.3);
        }
      `}</style>
    </div>
  );
}
