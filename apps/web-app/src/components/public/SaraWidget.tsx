'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { saraApi } from '@/lib/api/sara';
import { cn } from '@/lib/utils';
import {
  loadChatMessages,
  saveChatMessages,
  clearChatMessages,
  type SaraWidgetMessage,
} from '@/lib/sara/chat-storage';

/**
 * ============================================================================
 * SARAH WIDGET — Academia Helm Brand Aligned (Royal Blue + Living Gold)
 * ============================================================================
 *
 * Refonte du widget Sarah pour respecter la palette officielle Academia Helm :
 *   - Royal Blue : #0A2A5E (900) → #0D3B85 (800) → #114FC4 (700) → #1C6FE8 (600)
 *   - Living Gold : #CFA63A (600) → #F2C94C (500) → #FFE08A (400)
 *   - Cloud : #F7F9FC (fond clair)
 *   - Graphite : #0F172A / #334155 / #64748B (textes)
 *
 * Style inspiré de Messenger / WhatsApp :
 *   - Bulles de chat compactes, texte 12px lisible mais dense
 *   - Largeur 360px (vs 400px précédemment)
 *   - Animations discrètes (pas de scanline, pas de particules)
 *   - Header compact avec photo Sarah + indicateur en ligne + bouton fermer
 *   - Suggestions en chips discrets
 *   - Input en barre pill avec bouton envoyer
 *
 * "Sarah" = Princesse en hébreu — la conseillère numéro 1 d'Academia Helm.
 */

// ─── ACADEMIA HELM BRAND PALETTE ─────────────────────────────────────────
const AH = {
  // Royal Blue (primary)
  navy900: '#0A2A5E',
  navy800: '#0D3B85',
  navy700: '#114FC4',
  navy600: '#1C6FE8',
  // Living Gold (accent)
  gold600: '#CFA63A',
  gold500: '#F2C94C',
  gold400: '#FFE08A',
  // Neutrals
  cloud: '#F7F9FC',
  mist: '#EEF2F8',
  graphite900: '#0F172A',
  graphite700: '#334155',
  graphite500: '#64748B',
  graphite300: '#CBD5E1',
  white: '#FFFFFF',
  // Semantic
  online: '#22C55E',
  onlineGlow: 'rgba(34,197,94,0.4)',
} as const;

// ─── FULL MARKDOWN RENDERER ──────────────────────────────────────────────
// Handles paragraphs, bullet lists (-, *, •), numbered lists, **bold**, *italic*, `code`

/** Global key counter for unique React keys */
let _mdKey = 0;
const nextKey = () => ++_mdKey;

/** Apply inline formatting (**bold**, *italic*, `code`) to a string */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(
        <strong key={nextKey()} className="font-bold" style={{ color: AH.navy900 }}>
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      parts.push(
        <em key={nextKey()} className="italic" style={{ color: AH.graphite700 }}>
          {match[4]}
        </em>,
      );
    } else if (match[5]) {
      parts.push(
        <code
          key={nextKey()}
          className="px-1 py-0.5 rounded text-[10.5px] font-mono"
          style={{ background: 'rgba(10,42,94,0.08)', color: AH.navy700 }}
        >
          {match[6]}
        </code>,
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

type BlockType = 'paragraph' | 'bullet' | 'numbered';

interface ParsedBlock {
  type: BlockType;
  items: string[];
}

/** Parse raw text into structured blocks */
function parseBlocks(text: string): ParsedBlock[] {
  const lines = text.split('\n');
  const blocks: ParsedBlock[] = [];
  let currentBlock: ParsedBlock | null = null;

  const bulletRegex = /^\s*[-*•]\s+(.*)$/;
  const numberedRegex = /^\s*(\d+)[.)]\s+(.*)$/;

  for (const line of lines) {
    const trimmed = line.trimEnd();
    const bulletMatch = trimmed.match(bulletRegex);
    const numberedMatch = trimmed.match(numberedRegex);

    if (bulletMatch) {
      if (currentBlock && currentBlock.type !== 'bullet') {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) currentBlock = { type: 'bullet', items: [] };
      currentBlock.items.push(bulletMatch[1]);
    } else if (numberedMatch) {
      if (currentBlock && currentBlock.type !== 'numbered') {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) currentBlock = { type: 'numbered', items: [] };
      currentBlock.items.push(numberedMatch[2]);
    } else if (trimmed === '') {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
    } else {
      if (currentBlock && currentBlock.type !== 'paragraph') {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) {
        currentBlock = { type: 'paragraph', items: [trimmed] };
      } else {
        currentBlock.items[0] += ' ' + trimmed;
      }
    }
  }

  if (currentBlock) blocks.push(currentBlock);
  return blocks;
}

/** Render parsed blocks into React elements */
function renderBlocks(blocks: ParsedBlock[]): React.ReactNode[] {
  const elements: React.ReactNode[] = [];

  for (const block of blocks) {
    if (block.type === 'paragraph') {
      elements.push(
        <p key={nextKey()} className="mb-1.5 last:mb-0">
          {renderInline(block.items[0])}
        </p>,
      );
    } else if (block.type === 'bullet') {
      elements.push(
        <ul key={nextKey()} className="mb-1.5 last:mb-0 space-y-0.5">
          {block.items.map((item) => (
            <li key={nextKey()} className="flex items-start gap-1.5">
              <span
                className="mt-[6px] w-1 h-1 rounded-full shrink-0"
                style={{ backgroundColor: AH.gold600 }}
              />
              <span className="flex-1">{renderInline(item)}</span>
            </li>
          ))}
        </ul>,
      );
    } else if (block.type === 'numbered') {
      elements.push(
        <ol key={nextKey()} className="mb-1.5 last:mb-0 space-y-0.5">
          {block.items.map((item, idx) => (
            <li key={nextKey()} className="flex items-start gap-1.5">
              <span
                className="shrink-0 w-4 text-right font-semibold text-[11px]"
                style={{ color: AH.navy700 }}
              >
                {idx + 1}.
              </span>
              <span className="flex-1">{renderInline(item)}</span>
            </li>
          ))}
        </ol>,
      );
    }
  }

  return elements;
}

/** Main entry point — parse markdown text and render as structured React elements */
function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return [text];
  _mdKey = 0;
  const blocks = parseBlocks(text);
  const rendered = renderBlocks(blocks);
  return rendered.length > 0 ? rendered : [text];
}

// ─── SARAH WIDGET COMPONENT ──────────────────────────────────────────────

export default function SaraWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const WELCOME_MESSAGE: { role: 'user' | 'assistant'; content: string } = {
    role: 'assistant',
    content:
      "Shalom ! Je suis **Sarah**, votre conseillère Academia Helm. Je suis ravie de vous accueillir. Dites-moi ce qui vous amène : vous souhaitez découvrir notre solution, comparer les plans, ou parler de votre école ?",
  };

  // Version du chat — si on change cette version, les anciens messages sont purgés
  const SARA_CHAT_VERSION = 'v3-2025-08';

  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>(() => {
    if (typeof window === 'undefined') return [WELCOME_MESSAGE];

    try {
      const storedVersion = localStorage.getItem('sara_chat_version');
      if (storedVersion !== SARA_CHAT_VERSION) {
        clearChatMessages('sara-widget');
        localStorage.setItem('sara_chat_version', SARA_CHAT_VERSION);
      }
    } catch {
      // Ignore localStorage errors
    }

    const saved = loadChatMessages<SaraWidgetMessage>('sara-widget');
    return saved.length > 0 ? saved : [WELCOME_MESSAGE];
  });
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const quickSuggestions = [
    "Qu'est-ce que Academia Helm ?",
    "Voir les tarifs",
    "Quels modules ?",
    "Je veux une démo",
    "Comment s'inscrire ?",
  ];

  // Persistance
  useEffect(() => {
    saveChatMessages('sara-widget', messages);
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, streamingText]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  // ─── STREAMING SEND ──────────────────────────────────────────────────

  const handleSend = useCallback(
    async (text?: string) => {
      const userMsg = text || input.trim();
      if (!userMsg || isTyping) return;

      setInput('');
      setShowSuggestions(false);
      setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
      setIsTyping(true);
      setStreamingText('');

      let fullText = '';

      try {
        const stream = saraApi.queryStream(userMsg, undefined, messages);

        for await (const chunk of stream) {
          if (chunk.type === 'delta' && chunk.text) {
            fullText += chunk.text;
            setStreamingText(fullText);
          } else if (chunk.type === 'final' && chunk.text) {
            if (!fullText) {
              fullText = chunk.text;
              setStreamingText(fullText);
            }
          } else if (chunk.type === 'error') {
            if (!fullText) {
              fullText =
                "Je suis désolée, une erreur technique s'est produite. Souhaitez-vous qu'un conseiller vous contacte directement ? C'est gratuit et sans engagement.";
            }
            break;
          }
        }

        if (fullText) {
          setMessages((prev) => [...prev, { role: 'assistant', content: fullText }]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content:
                "Je suis temporairement indisponible. Souhaitez-vous qu'un conseiller vous contacte directement ? C'est gratuit et sans engagement.",
            },
          ]);
        }
      } catch (error: any) {
        console.error('[SaraWidget] Error:', error?.message);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              "Je suis désolée, une erreur de connexion s'est produite. Souhaitez-vous qu'un conseiller vous contacte directement ? C'est gratuit et sans engagement.",
          },
        ]);
      } finally {
        setIsTyping(false);
        setStreamingText('');
      }
    },
    [input, isTyping, messages],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    clearChatMessages('sara-widget');
    setMessages([WELCOME_MESSAGE]);
    setShowSuggestions(true);
  };

  // ─── RENDER ──────────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-4 right-4 z-[1000] font-sans">
      {isOpen ? (
        // ─── OPEN STATE — Compact Branded Chat Panel ──
        <div
          className={cn(
            'w-[360px] h-[540px] max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden',
            'animate-in slide-in-from-bottom-3 duration-300',
            'rounded-2xl shadow-2xl',
            'sara-brand-scroll',
          )}
          style={{
            background: AH.white,
            border: `1px solid ${AH.graphite300}`,
            boxShadow: `0 12px 40px rgba(10,42,94,0.18), 0 2px 8px rgba(10,42,94,0.08)`,
          }}
        >
          {/* ─── HEADER — Royal Blue with Gold accent ─────────────────── */}
          <div
            className="relative px-3.5 py-2.5 flex items-center justify-between shrink-0"
            style={{
              background: `linear-gradient(135deg, ${AH.navy900} 0%, ${AH.navy800} 100%)`,
            }}
          >
            {/* Thin gold accent line at top */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{
                background: `linear-gradient(90deg, ${AH.gold600}, ${AH.gold500}, ${AH.gold600})`,
              }}
            />

            <div className="flex items-center gap-2.5">
              {/* Photo de Sarah avec anneau discret */}
              <div className="relative flex items-center justify-center">
                <div className="relative w-8 h-8 rounded-full overflow-hidden ring-2"
                  style={{ '--tw-ring-color': AH.gold500 } as React.CSSProperties}
                >
                  <Image
                    src="/images/SarahAI.webp"
                    alt="Sarah"
                    width={32}
                    height={32}
                    className="object-cover w-full h-full"
                    priority
                  />
                </div>
                {/* Online indicator */}
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                  style={{
                    backgroundColor: AH.online,
                    borderColor: AH.navy900,
                    boxShadow: `0 0 4px ${AH.onlineGlow}`,
                  }}
                />
              </div>

              <div className="flex flex-col leading-tight">
                <h4 className="font-semibold text-[13px] text-white flex items-center gap-1.5">
                  Sarah
                  <span
                    className="text-[9px] px-1 py-0.5 rounded-sm font-medium tracking-wider uppercase"
                    style={{ background: AH.gold600, color: AH.navy900 }}
                  >
                    Conseillère
                  </span>
                </h4>
                <p className="text-[10px] text-white/70 flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ backgroundColor: AH.online }}
                  />
                  Academia Helm · En ligne
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Clear chat button */}
              <button
                onClick={handleClearChat}
                className="p-1.5 rounded-md transition-colors text-white/60 hover:text-white hover:bg-white/10"
                aria-label="Nouvelle conversation"
                title="Nouvelle conversation"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
              {/* Close button */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md transition-colors text-white/60 hover:text-white hover:bg-white/10"
                aria-label="Fermer"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* ─── MESSAGES ─────────────────────────────────────────────── */}
          <div className="relative flex-1 overflow-y-auto px-3 py-3 space-y-2 sara-brand-scroll"
            style={{ background: AH.cloud }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'flex',
                  m.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 mr-1.5 mt-0.5 self-end"
                    style={{ border: `1.5px solid ${AH.gold500}` }}
                  >
                    <Image
                      src="/images/SarahAI.webp"
                      alt="Sarah"
                      width={24}
                      height={24}
                      className="object-cover w-full h-full"
                    />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[78%] px-2.5 py-1.5 rounded-2xl text-[12px] leading-snug',
                    m.role === 'user'
                      ? 'rounded-br-sm text-white'
                      : 'rounded-bl-sm text-graphite-900',
                  )}
                  style={
                    m.role === 'user'
                      ? {
                          background: `linear-gradient(135deg, ${AH.navy700}, ${AH.navy600})`,
                          color: AH.white,
                        }
                      : {
                          background: AH.white,
                          border: `1px solid ${AH.graphite300}`,
                          color: AH.graphite900,
                        }
                  }
                >
                  {m.role === 'assistant' ? renderMarkdown(m.content) : m.content}
                </div>
              </div>
            ))}

            {/* Streaming text */}
            {isTyping && streamingText && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 mr-1.5 mt-0.5 self-end"
                  style={{ border: `1.5px solid ${AH.gold500}` }}
                >
                  <Image
                    src="/images/SarahAI.webp"
                    alt="Sarah"
                    width={24}
                    height={24}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div
                  className="max-w-[78%] px-2.5 py-1.5 rounded-2xl rounded-bl-sm text-[12px] leading-snug"
                  style={{
                    background: AH.white,
                    border: `1px solid ${AH.graphite300}`,
                    color: AH.graphite900,
                  }}
                >
                  {renderMarkdown(streamingText)}
                  <span
                    className="inline-block w-[1.5px] h-3 ml-0.5 animate-pulse align-middle"
                    style={{ backgroundColor: AH.navy700 }}
                  />
                </div>
              </div>
            )}

            {/* Typing indicator (3 dots) */}
            {isTyping && !streamingText && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 mr-1.5 mt-0.5 self-end"
                  style={{ border: `1.5px solid ${AH.gold500}` }}
                >
                  <Image
                    src="/images/SarahAI.webp"
                    alt="Sarah"
                    width={24}
                    height={24}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div
                  className="px-3 py-2.5 rounded-2xl rounded-bl-sm flex gap-1 items-center"
                  style={{
                    background: AH.white,
                    border: `1px solid ${AH.graphite300}`,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.3s]"
                    style={{ backgroundColor: AH.navy600 }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.15s]"
                    style={{ backgroundColor: AH.gold600 }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ backgroundColor: AH.navy600 }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ─── QUICK SUGGESTIONS ────────────────────────────────────── */}
          {showSuggestions && messages.length <= 1 && (
            <div className="px-3 pt-2 pb-1.5 shrink-0" style={{ background: AH.cloud }}>
              <p className="text-[9.5px] mb-1.5 font-semibold uppercase tracking-wider"
                style={{ color: AH.graphite500 }}
              >
                Questions fréquentes
              </p>
              <div className="flex flex-wrap gap-1">
                {quickSuggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(suggestion)}
                    className="text-[10.5px] px-2.5 py-1 rounded-full transition-all duration-200 cursor-pointer font-medium"
                    style={{
                      background: AH.white,
                      border: `1px solid ${AH.navy600}40`,
                      color: AH.navy700,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = AH.navy700;
                      e.currentTarget.style.borderColor = AH.navy700;
                      e.currentTarget.style.color = AH.white;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = AH.white;
                      e.currentTarget.style.borderColor = `${AH.navy600}40`;
                      e.currentTarget.style.color = AH.navy700;
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── INPUT ── Compact pill bar ── */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="px-3 py-2.5 shrink-0 border-t"
            style={{
              background: AH.white,
              borderColor: AH.graphite300,
            }}
          >
            <div className="flex items-center gap-1.5 rounded-full pl-3 pr-1 py-0.5"
              style={{
                background: AH.cloud,
                border: `1px solid ${AH.graphite300}`,
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Écrivez votre message…"
                className="flex-1 bg-transparent border-none outline-none text-[12px] py-1.5"
                style={{ color: AH.graphite900 }}
                disabled={isTyping}
              />
              <style>{`
                input::placeholder {
                  color: ${AH.graphite500} !important;
                }
              `}</style>

              {/* Send button */}
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: input.trim() ? `linear-gradient(135deg, ${AH.navy700}, ${AH.navy600})` : AH.mist,
                  color: input.trim() ? AH.white : AH.graphite500,
                }}
                aria-label="Envoyer"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Footer branding */}
            <div className="flex items-center justify-center gap-1 mt-1.5">
              <span className="text-[8.5px] tracking-wider font-medium" style={{ color: AH.graphite500 }}>
                Propulsé par
              </span>
              <span className="text-[8.5px] tracking-wider font-bold" style={{ color: AH.navy800 }}>
                ACADEMIA HELM
              </span>
              <span className="text-[8.5px]" style={{ color: AH.gold600 }}>●</span>
            </div>
          </form>
        </div>
      ) : (
        // ─── CLOSED STATE — Floating branded button ──
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center justify-center transition-all duration-300 hover:scale-105 cursor-pointer"
          style={{ width: '60px', height: '60px' }}
          aria-label="Discuter avec Sarah"
        >
          {/* Soft glow background — subtle on mobile, visible on desktop */}
          <div
            className="absolute inset-0 rounded-full sara-glow-bg"
            style={{
              background: `radial-gradient(circle, ${AH.navy600}20 0%, ${AH.gold500}10 40%, transparent 65%)`,
              filter: 'blur(4px)',
              animation: 'sarahPulse 3s ease-in-out infinite',
            }}
          />

          {/* Gold ring — thin, low opacity */}
          <div
            className="absolute inset-[-1.5px] rounded-full sara-gold-ring"
            style={{
              background: `conic-gradient(from 0deg, ${AH.gold500}, ${AH.navy600}, ${AH.gold500}, ${AH.navy600}, ${AH.gold500})`,
              animation: 'sarahRingSpin 6s linear infinite',
              opacity: 0.55,
            }}
          />

          {/* Photo Sarah */}
          <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 shadow-lg"
            style={{ '--tw-ring-color': AH.gold500 } as React.CSSProperties}
          >
            <Image
              src="/images/SarahAI.webp"
              alt="Sarah"
              width={48}
              height={48}
              className="object-cover w-full h-full"
              priority
            />
          </div>

          {/* ✅ Green blinking dot (replaces navy "1" badge) */}
          <div
            className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 z-10"
            style={{
              backgroundColor: AH.online,
              borderColor: AH.white,
              boxShadow: `0 0 6px ${AH.onlineGlow}`,
              animation: 'sarahDotBlink 2s ease-in-out infinite',
            }}
          />

          {/* Hover tooltip */}
          <div
            className="absolute right-full mr-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none px-2.5 py-1.5 rounded-md text-[11px] font-medium"
            style={{
              background: AH.navy900,
              color: AH.white,
              boxShadow: '0 4px 12px rgba(10,42,94,0.25)',
            }}
          >
            Discutez avec Sarah
            <span
              className="absolute left-full top-1/2 -translate-y-1/2 border-4"
              style={{
                borderColor: `transparent transparent transparent ${AH.navy900}`,
              }}
            />
          </div>
        </button>
      )}

      {/* ─── ANIMATIONS ──────────────────────────────────────────────────── */}
      <style jsx global>{`
        @keyframes sarahPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.04); }
        }

        @keyframes sarahRingSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Mobile : halo encore plus subtil pour éviter l'effet épais */
        @media (max-width: 768px) {
          .sara-glow-bg {
            filter: blur(2px) !important;
            opacity: 0.6 !important;
          }
          .sara-gold-ring {
            opacity: 0.4 !important;
          }
        }

        /* ✅ Green dot blink animation */
        @keyframes sarahDotBlink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }

        /* Custom scrollbar — minimal, branded */
        .sara-brand-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .sara-brand-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .sara-brand-scroll::-webkit-scrollbar-thumb {
          background: ${AH.navy600}40;
          border-radius: 4px;
        }
        .sara-brand-scroll::-webkit-scrollbar-thumb:hover {
          background: ${AH.navy600}80;
        }
      `}</style>
    </div>
  );
}
