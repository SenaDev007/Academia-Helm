'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { saraApi, SaraStreamChunk } from '@/lib/api/sara';
import { cn } from '@/lib/utils';

/**
 * ============================================================================
 * SARAH WIDGET — Holographic Royal AI Assistant
 * ============================================================================
 *
 * "Sarah" en hébreu signifie "Princesse" — le design fusionne cette identité
 * royale avec l'esthétique holographique de la science-fiction.
 *
 * Design System :
 *   - Icône : Couronne royale / Fleur-de-lys animée (symbole de Sarah)
 *   - Palette : Navy Academia Helm (#0b2f73) + Or royal (#f5b335)
 *               + Bleu tech sci-fi (#1C6FE8 / #22d3ee)
 *   - Effets : Hologramme véritable avec scan lines, particules,
 *              bordure lumineuse animée, glassmorphism, shimmer
 *
 * Fonctionnalités :
 *   - Chat conversationnel avec streaming SSE
 *   - Suggestions de questions rapides
 *   - Animation de typing holographique
 *   - CTA de conversion intégrés
 *   - Responsive mobile
 */

// ─── BRAND COLORS ─────────────────────────────────────────────────────────
const BRAND = {
  navy: '#0b2f73',
  navyDeep: '#071d49',
  navyMid: '#103e91',
  navyBright: '#144798',
  gold: '#f5b335',
  goldLight: '#f7c359',
  goldDark: '#C9A84C',
  techBlue: '#1C6FE8',
  cyanGlow: '#22d3ee',
  cyanDeep: '#0891b2',
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
    size: Math.random() * 2.5 + 0.5,
    opacity: Math.random() * 0.4 + 0.05,
    speed: Math.random() * 0.4 + 0.1,
  }));
}

// ─── CROWN SVG ICON ───────────────────────────────────────────────────────
// An elegant royal crown with fleur-de-lys peaks

const CrownIcon = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    className={className}
  >
    {/* Crown base band */}
    <rect x="10" y="42" width="44" height="8" rx="2" fill="url(#crownGold)" opacity="0.9" />
    {/* Crown band jewels */}
    <circle cx="20" cy="46" r="2.5" fill="#fff" opacity="0.7" />
    <circle cx="32" cy="46" r="2.5" fill="#fff" opacity="0.9" />
    <circle cx="44" cy="46" r="2.5" fill="#fff" opacity="0.7" />
    {/* Crown body (5 peaks with fleur-de-lys tops) */}
    <path
      d="M12 42 L12 28 C12 24 16 22 18 26 L20 30 C20 30 22 20 26 18 C28 17 30 18 30 20 L30 28 C30 28 30 16 32 14 C34 16 34 28 34 28 L34 20 C34 18 36 17 38 18 C42 20 44 30 44 30 L46 26 C48 22 52 24 52 28 L52 42 Z"
      fill="url(#crownGold)"
      opacity="0.95"
    />
    {/* Center fleur-de-lys peak highlight */}
    <path
      d="M30 28 C30 28 29 18 32 14 C35 18 34 28 34 28"
      stroke="#fff"
      strokeWidth="0.5"
      opacity="0.5"
      fill="none"
    />
    {/* Crown inner shadow */}
    <path
      d="M16 42 L16 32 C16 30 20 28 22 32 L24 36 L28 30 C30 26 34 26 36 30 L40 36 L42 32 C44 28 48 30 48 32 L48 42 Z"
      fill="url(#crownInner)"
      opacity="0.6"
    />
    {/* Top jewels on each peak */}
    <circle cx="18" cy="26" r="2" fill="#fff" opacity="0.6" />
    <circle cx="32" cy="15" r="2.5" fill="#fff" opacity="0.8" />
    <circle cx="46" cy="26" r="2" fill="#fff" opacity="0.6" />
    {/* Glow effect around crown */}
    <path
      d="M12 42 L12 28 C12 24 16 22 18 26 L20 30 C20 30 22 20 26 18 C28 17 30 18 30 20 L30 28 C30 28 30 16 32 14 C34 16 34 28 34 28 L34 20 C34 18 36 17 38 18 C42 20 44 30 44 30 L46 26 C48 22 52 24 52 28 L52 42 Z"
      stroke="url(#crownGlow)"
      strokeWidth="1.5"
      fill="none"
      opacity="0.4"
    />
    <defs>
      <linearGradient id="crownGold" x1="10" y1="14" x2="54" y2="50" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor={BRAND.goldLight} />
        <stop offset="50%" stopColor={BRAND.gold} />
        <stop offset="100%" stopColor={BRAND.goldDark} />
      </linearGradient>
      <linearGradient id="crownInner" x1="10" y1="14" x2="54" y2="50" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor={BRAND.navyBright} />
        <stop offset="100%" stopColor={BRAND.navyDeep} />
      </linearGradient>
      <linearGradient id="crownGlow" x1="10" y1="14" x2="54" y2="14" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor={BRAND.cyanGlow} />
        <stop offset="50%" stopColor="#fff" />
        <stop offset="100%" stopColor={BRAND.cyanGlow} />
      </linearGradient>
    </defs>
  </svg>
);

// ─── LILY / FLEUR-DE-LYS SVG ICON ─────────────────────────────────────────

const LilyIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 120"
    fill="none"
    className={className}
  >
    {/* Center petal */}
    <path
      d="M50 8 C52 20 58 30 58 45 C58 55 55 62 50 68 C45 62 42 55 42 45 C42 30 48 20 50 8Z"
      fill="url(#lilyGold)"
      opacity="0.95"
    />
    {/* Left petal */}
    <path
      d="M42 25 C30 18 14 22 10 35 C8 42 12 50 20 52 C26 54 34 48 42 38Z"
      fill="url(#lilyGold)"
      opacity="0.9"
    />
    {/* Right petal */}
    <path
      d="M58 25 C70 18 86 22 90 35 C92 42 88 50 80 52 C74 54 66 48 58 38Z"
      fill="url(#lilyGold)"
      opacity="0.9"
    />
    {/* Cross bar */}
    <rect x="8" y="52" width="84" height="5" rx="2.5" fill="url(#lilyGold)" opacity="0.85" />
    {/* Lower left petal */}
    <path
      d="M30 60 C22 65 16 75 20 85 C22 90 28 92 34 88 C38 85 38 75 34 65Z"
      fill="url(#lilyGold)"
      opacity="0.8"
    />
    {/* Lower right petal */}
    <path
      d="M70 60 C78 65 84 75 80 85 C78 90 72 92 66 88 C62 85 62 75 66 65Z"
      fill="url(#lilyGold)"
      opacity="0.8"
    />
    {/* Stem */}
    <rect x="48" y="68" width="4" height="42" rx="2" fill="url(#lilyGold)" opacity="0.7" />
    {/* Center jewel */}
    <circle cx="50" cy="52" r="4" fill="#fff" opacity="0.6" />
    <defs>
      <linearGradient id="lilyGold" x1="0" y1="0" x2="100" y2="120" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor={BRAND.goldLight} />
        <stop offset="40%" stopColor={BRAND.gold} />
        <stop offset="100%" stopColor={BRAND.goldDark} />
      </linearGradient>
    </defs>
  </svg>
);

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
  const [particles] = useState(() => generateParticles(25));
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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, streamingText]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 500);
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

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

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
            // Holographic glassmorphic container — Academia Helm brand
            'bg-gradient-to-b from-[#0b2f73]/95 via-[#071d49]/95 to-[#0b2f73]/95',
            'backdrop-blur-2xl',
            // Animated holographic border
            'border border-[#1C6FE8]/30',
            // Multi-layer holographic glow
            'shadow-[0_0_30px_rgba(28,111,232,0.15),0_0_60px_rgba(11,47,115,0.2),0_0_100px_rgba(245,179,53,0.05),inset_0_1px_0_rgba(255,255,255,0.06)]',
            // Custom scrollbar class
            'sara-holo-scroll',
          )}
        >
          {/* ─── ANIMATED HOLOGRAPHIC BORDER GLOW ──────────────── */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden">
            {/* Rotating border gradient */}
            <div className="absolute inset-0 rounded-2xl animate-[holoBorderSpin_6s_linear_infinite]"
              style={{
                background: 'conic-gradient(from 0deg, transparent, rgba(28,111,232,0.3), transparent, rgba(245,179,53,0.2), transparent, rgba(34,211,238,0.2), transparent)',
                mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                maskComposite: 'exclude',
                WebkitMaskComposite: 'xor',
                padding: '1.5px',
                borderRadius: '1rem',
              }}
            />
          </div>

          {/* ─── SCAN LINE OVERLAY ──────────────────────────────── */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden z-20">
            <div className="absolute w-full h-[2px] animate-[holoScan_4s_linear_infinite]"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.25), rgba(28,111,232,0.15), transparent)',
                boxShadow: '0 0 20px rgba(34,211,238,0.15), 0 0 40px rgba(28,111,232,0.08)',
              }}
            />
            {/* Faint horizontal grid lines (holographic texture) */}
            <div className="absolute inset-0 opacity-[0.02]"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(34,211,238,0.5) 2px, rgba(34,211,238,0.5) 3px)',
              }}
            />
          </div>

          {/* ─── HEADER ──────────────────────────────────────────── */}
          <div className="relative p-4 flex items-center justify-between shrink-0 overflow-hidden">
            {/* Header background gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0b2f73]/80 via-[#103e91]/60 to-[#0b2f73]/80" />
            {/* Gold accent line at bottom of header */}
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#f5b335]/40 to-transparent" />

            <div className="relative flex items-center gap-3">
              {/* Crown Avatar with animated glow */}
              <div className="relative w-11 h-11 flex items-center justify-center">
                {/* Outer animated glow ring */}
                <div className="absolute inset-0 rounded-full animate-[holoPulse_3s_ease-in-out_infinite]"
                  style={{
                    background: `radial-gradient(circle, rgba(245,179,53,0.15) 0%, rgba(28,111,232,0.1) 50%, transparent 70%)`,
                  }}
                />
                {/* Avatar disc */}
                <div className="absolute inset-[3px] rounded-full flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${BRAND.navyDeep}, ${BRAND.navy})`,
                    border: '1px solid rgba(28,111,232,0.3)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 15px rgba(28,111,232,0.15)',
                  }}
                >
                  <CrownIcon size={22} className="drop-shadow-[0_0_4px_rgba(245,179,53,0.5)]" />
                </div>
              </div>

              <div>
                <h4 className="font-bold text-sm"
                  style={{
                    background: `linear-gradient(135deg, #fff 0%, ${BRAND.gold} 50%, ${BRAND.goldLight} 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 0 6px rgba(245,179,53,0.3))',
                  }}
                >
                  Sarah
                </h4>
                <p className="text-[10px] font-medium tracking-[0.12em] uppercase"
                  style={{ color: 'rgba(28,111,232,0.7)' }}
                >
                  Conseillère Academia Helm
                </p>
              </div>
            </div>

            <div className="relative flex items-center gap-2.5">
              {/* Online indicator */}
              <div className="relative flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: BRAND.gold, boxShadow: `0 0 6px ${BRAND.gold}` }}
                />
                <span className="text-[9px] font-medium" style={{ color: 'rgba(245,179,53,0.6)' }}>En ligne</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-white/10 p-1.5 rounded-lg transition-colors"
                style={{ color: 'rgba(28,111,232,0.6)' }}
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
            {/* Floating particles background */}
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
                    background: p.id % 3 === 0 ? BRAND.gold : BRAND.cyanGlow,
                    animation: `holoFloat ${4 + p.speed * 8}s ease-in-out infinite`,
                    animationDelay: `${p.id * 0.15}s`,
                    boxShadow: `0 0 ${p.size * 2}px ${p.id % 3 === 0 ? 'rgba(245,179,53,0.3)' : 'rgba(34,211,238,0.3)'}`,
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
                      ? // User message: tech blue holographic glass
                        'rounded-tr-sm'
                      : // Sarah message: navy glass with gold border
                        'rounded-tl-sm',
                  )}
                  style={m.role === 'user' ? {
                    background: `linear-gradient(135deg, rgba(28,111,232,0.15), rgba(11,47,115,0.25))`,
                    border: '1px solid rgba(28,111,232,0.3)',
                    color: 'rgba(219,234,254,0.95)',
                    boxShadow: '0 0 15px rgba(28,111,232,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
                  } : {
                    background: `linear-gradient(135deg, rgba(11,47,115,0.3), rgba(7,29,73,0.4))`,
                    border: '1px solid rgba(245,179,53,0.15)',
                    color: 'rgba(247,195,89,0.9)',
                    boxShadow: '0 0 15px rgba(245,179,53,0.04), inset 0 1px 0 rgba(255,255,255,0.03)',
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {/* Streaming text display */}
            {isTyping && streamingText && (
              <div className="flex justify-start relative z-10">
                <div
                  className="max-w-[85%] p-3 rounded-2xl rounded-tl-sm text-[13px] leading-relaxed"
                  style={{
                    background: `linear-gradient(135deg, rgba(11,47,115,0.3), rgba(7,29,73,0.4))`,
                    border: '1px solid rgba(245,179,53,0.15)',
                    color: 'rgba(247,195,89,0.9)',
                    boxShadow: '0 0 15px rgba(245,179,53,0.04), inset 0 1px 0 rgba(255,255,255,0.03)',
                  }}
                >
                  {streamingText}
                  <span className="inline-block w-[2px] h-4 ml-0.5 animate-pulse align-middle"
                    style={{ backgroundColor: BRAND.gold, boxShadow: `0 0 6px ${BRAND.gold}` }}
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
                    background: `linear-gradient(135deg, rgba(11,47,115,0.3), rgba(7,29,73,0.4))`,
                    border: '1px solid rgba(245,179,53,0.15)',
                    boxShadow: '0 0 15px rgba(245,179,53,0.04)',
                  }}
                >
                  <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:-0.3s]"
                    style={{ backgroundColor: BRAND.techBlue, boxShadow: `0 0 4px ${BRAND.techBlue}` }} />
                  <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:-0.15s]"
                    style={{ backgroundColor: BRAND.gold, boxShadow: `0 0 4px ${BRAND.gold}` }} />
                  <span className="w-2 h-2 rounded-full animate-bounce"
                    style={{ backgroundColor: BRAND.cyanGlow, boxShadow: `0 0 4px ${BRAND.cyanGlow}` }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ─── QUICK SUGGESTIONS ────────────────────────────────── */}
          {showSuggestions && messages.length <= 1 && (
            <div className="px-4 pb-2 shrink-0 relative">
              <p className="text-[10px] mb-2 font-semibold uppercase tracking-[0.15em]"
                style={{ color: 'rgba(28,111,232,0.5)' }}
              >
                Questions fréquentes
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickSuggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-[11px] px-3 py-1.5 rounded-full transition-all duration-300"
                    style={{
                      background: 'rgba(28,111,232,0.06)',
                      border: '1px solid rgba(28,111,232,0.15)',
                      color: 'rgba(28,111,232,0.7)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(28,111,232,0.12)';
                      e.currentTarget.style.borderColor = 'rgba(28,111,232,0.35)';
                      e.currentTarget.style.color = 'rgba(28,111,232,0.95)';
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(28,111,232,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(28,111,232,0.06)';
                      e.currentTarget.style.borderColor = 'rgba(28,111,232,0.15)';
                      e.currentTarget.style.color = 'rgba(28,111,232,0.7)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
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
            <div className="absolute top-0 left-4 right-4 h-[1px]"
              style={{ background: `linear-gradient(90deg, transparent, rgba(28,111,232,0.2), rgba(245,179,53,0.1), transparent)` }}
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
                  background: 'rgba(28,111,232,0.06)',
                  border: '1px solid rgba(28,111,232,0.15)',
                  color: 'rgba(219,234,254,0.9)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(28,111,232,0.4)';
                  e.currentTarget.style.background = 'rgba(28,111,232,0.1)';
                  e.currentTarget.style.boxShadow = `0 0 20px rgba(28,111,232,0.1)`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(28,111,232,0.15)';
                  e.currentTarget.style.background = 'rgba(28,111,232,0.06)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                disabled={isTyping}
              />
              {/* Placeholder color via CSS */}
              <style>{`
                input::placeholder { color: rgba(28,111,232,0.3) !important; }
              `}</style>
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
                style={input.trim() && !isTyping ? {
                  background: `linear-gradient(135deg, ${BRAND.techBlue}, ${BRAND.navyBright})`,
                  color: '#fff',
                  boxShadow: `0 0 15px rgba(28,111,232,0.3)`,
                } : {
                  background: 'rgba(28,111,232,0.05)',
                  color: 'rgba(28,111,232,0.25)',
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
        // ─── CLOSED STATE — Floating Holographic Crown Button ────
        <button
          onClick={() => setIsOpen(true)}
          className="group relative w-[68px] h-[68px] rounded-full flex items-center justify-center transition-all duration-500 hover:scale-110"
          aria-label="Ouvrir le chat Sarah"
        >
          {/* Outer pulsing glow ring */}
          <div className="absolute inset-0 rounded-full animate-[holoPulse_3s_ease-in-out_infinite]"
            style={{
              background: `radial-gradient(circle, rgba(28,111,232,0.2) 0%, rgba(245,179,53,0.1) 50%, transparent 70%)`,
            }}
          />
          {/* Rotating holographic aura */}
          <div className="absolute inset-[-3px] rounded-full animate-[holoBorderSpin_6s_linear_infinite]"
            style={{
              background: 'conic-gradient(from 0deg, rgba(28,111,232,0.4), transparent 25%, rgba(245,179,53,0.3), transparent 50%, rgba(34,211,238,0.3), transparent 75%, rgba(28,111,232,0.4))',
              mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              maskComposite: 'exclude',
              WebkitMaskComposite: 'xor',
              padding: '2px',
              borderRadius: '50%',
            }}
          />
          {/* Main button disc */}
          <div className="absolute inset-[2px] rounded-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${BRAND.navyDeep}, ${BRAND.navy})`,
              border: '1px solid rgba(28,111,232,0.25)',
              boxShadow: `0 0 30px rgba(28,111,232,0.2), 0 0 60px rgba(11,47,115,0.15), inset 0 1px 0 rgba(255,255,255,0.05)`,
            }}
          >
            {/* Crown icon with animated glow */}
            <div className="relative animate-[crownFloat_3s_ease-in-out_infinite]">
              <CrownIcon size={28} className="drop-shadow-[0_0_8px_rgba(245,179,53,0.4)]" />
            </div>
          </div>

          {/* Ping animation ring */}
          <div className="absolute inset-0 rounded-full animate-ping opacity-15"
            style={{ border: `1.5px solid ${BRAND.techBlue}` }}
          />

          {/* Badge "IA" */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full"
            style={{
              background: `linear-gradient(135deg, ${BRAND.techBlue}, ${BRAND.navyBright})`,
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: `0 0 10px rgba(28,111,232,0.3)`,
            }}
          >
            IA
          </div>

          {/* Gold notification dot */}
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 animate-pulse"
            style={{
              background: `linear-gradient(135deg, ${BRAND.gold}, ${BRAND.goldLight})`,
              borderColor: BRAND.navyDeep,
              boxShadow: `0 0 8px ${BRAND.gold}`,
            }}
          />

          {/* Hover tooltip */}
          <div className="absolute right-full mr-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none px-3 py-2 rounded-lg text-xs font-semibold"
            style={{
              background: `linear-gradient(135deg, ${BRAND.navyDeep}ee, ${BRAND.navy}ee)`,
              border: '1px solid rgba(28,111,232,0.2)',
              color: 'rgba(219,234,254,0.9)',
              boxShadow: '0 0 20px rgba(28,111,232,0.1)',
              backdropFilter: 'blur(12px)',
            }}
          >
            Discutez avec Sarah
          </div>
        </button>
      )}

      {/* ─── GLOBAL HOLOGRAPHIC ANIMATIONS ──────────────────────────── */}
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
            opacity: 0.35;
          }
          50% {
            transform: translateY(-5px) translateX(-5px);
            opacity: 0.15;
          }
          75% {
            transform: translateY(-15px) translateX(3px);
            opacity: 0.3;
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

        @keyframes crownFloat {
          0%, 100% {
            transform: translateY(0);
            filter: drop-shadow(0 0 8px rgba(245,179,53,0.4));
          }
          50% {
            transform: translateY(-2px);
            filter: drop-shadow(0 0 12px rgba(245,179,53,0.6));
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
