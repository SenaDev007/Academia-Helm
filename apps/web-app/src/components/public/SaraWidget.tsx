'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { saraApi, SaraStreamChunk } from '@/lib/api/sara';
import { cn } from '@/lib/utils';
import { Crown, Mic, Volume2 } from 'lucide-react';
import { VoiceButton } from '@/components/ai/voice/VoiceButton';
import { VoiceMode } from '@/components/ai/voice/VoiceMode';
import {
  loadChatMessages,
  saveChatMessages,
  type SaraWidgetMessage,
} from '@/lib/sara/chat-storage';

/**
 * ============================================================================
 * SARAH WIDGET — Holographic AI Assistant (Style Carte du Bénin)
 * ============================================================================
 *
 * Widget flottant holographique avec couronne animée.
 * Style holographique identique à la carte du Bénin sur /portal :
 *   - Cyan #00e5ff comme couleur principale
 *   - Fond rgba(0,18,35,0.97) noir-bleu profond
 *   - Scanline animée, corner brackets, energy lines
 *   - Bordure cyan lumineuse, triple box-shadow
 *
 * "Sarah" = Princesse en hébreu — la couronne est le symbole de royauté.
 */

// ─── HOLO COLORS (Carte du Bénin palette) ─────────────────────────────────
const H = {
  cyan: '#00e5ff',
  cyanDim: 'rgba(0,229,255,0.7)',
  cyanFaint: 'rgba(0,229,255,0.3)',
  cyanGhost: 'rgba(0,229,255,0.1)',
  cyanBorder: 'rgba(0,229,255,0.85)',
  darkBg: 'rgba(0,18,35,0.97)',
  darkBg95: 'rgba(0,18,35,0.95)',
  gold: '#f5b335',
  goldLight: '#f7c76e',
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

// ─── FULL MARKDOWN RENDERER ──────────────────────────────────────────
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
      parts.push(<strong key={nextKey()} className="font-bold text-white">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={nextKey()} className="italic text-white/90">{match[4]}</em>);
    } else if (match[5]) {
      parts.push(
        <code key={nextKey()} className="px-1 py-0.5 rounded text-[11px] font-mono"
          style={{ background: 'rgba(0,229,255,0.12)', color: H.cyan }}>
          {match[6]}
        </code>
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
  items: string[];         // for lists: each item text; for paragraph: single element
}

/** Parse raw text into structured blocks (paragraphs, bullet lists, numbered lists) */
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
      // If current block is not a bullet list, flush it
      if (currentBlock && currentBlock.type !== 'bullet') {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) currentBlock = { type: 'bullet', items: [] };
      currentBlock.items.push(bulletMatch[1]);
    } else if (numberedMatch) {
      // If current block is not a numbered list, flush it
      if (currentBlock && currentBlock.type !== 'numbered') {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) currentBlock = { type: 'numbered', items: [] };
      currentBlock.items.push(numberedMatch[2]);
    } else if (trimmed === '') {
      // Blank line = paragraph break, flush current block
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
    } else {
      // Regular text line
      if (currentBlock && currentBlock.type !== 'paragraph') {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) {
        currentBlock = { type: 'paragraph', items: [trimmed] };
      } else {
        // Merge consecutive text lines with a space
        currentBlock.items[0] += ' ' + trimmed;
      }
    }
  }

  // Flush last block
  if (currentBlock) blocks.push(currentBlock);

  return blocks;
}

/** Render parsed blocks into React elements */
function renderBlocks(blocks: ParsedBlock[]): React.ReactNode[] {
  const elements: React.ReactNode[] = [];

  for (const block of blocks) {
    if (block.type === 'paragraph') {
      elements.push(
        <p key={nextKey()} className="mb-2 last:mb-0">
          {renderInline(block.items[0])}
        </p>
      );
    } else if (block.type === 'bullet') {
      elements.push(
        <ul key={nextKey()} className="mb-2 last:mb-0 ml-1 space-y-1">
          {block.items.map((item) => (
            <li key={nextKey()} className="flex items-start gap-2">
              <span className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: H.cyan, boxShadow: `0 0 4px ${H.cyan}` }} />
              <span className="flex-1">{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
    } else if (block.type === 'numbered') {
      elements.push(
        <ol key={nextKey()} className="mb-2 last:mb-0 ml-1 space-y-1">
          {block.items.map((item, idx) => (
            <li key={nextKey()} className="flex items-start gap-2">
              <span className="shrink-0 w-5 text-right font-semibold text-[12px]"
                style={{ color: H.cyan }}>
                {idx + 1}.
              </span>
              <span className="flex-1">{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
    }
  }

  return elements;
}

/** Main entry point — parse markdown text and render as structured React elements */
function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return [text];
  _mdKey = 0; // reset key counter per render
  const blocks = parseBlocks(text);
  const rendered = renderBlocks(blocks);
  return rendered.length > 0 ? rendered : [text];
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

// ─── SARAH WIDGET COMPONENT ──────────────────────────────────────────────

export default function SaraWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isVoiceModeOpen, setIsVoiceModeOpen] = useState(false);
  // Message d'accueil par défaut
  const WELCOME_MESSAGE: { role: 'user' | 'assistant'; content: string } = {
    role: 'assistant',
    content: "Shalom ! Je suis Sarah, votre conseillère Academia Helm. Je suis là pour vous accompagner et vous montrer comment notre solution peut transformer la gestion de votre école. Que souhaitez-vous savoir ?",
  };

  // Charger les messages sauvegardés ou utiliser le message d'accueil
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>(() => {
    if (typeof window === 'undefined') return [WELCOME_MESSAGE];
    const saved = loadChatMessages<SaraWidgetMessage>('sara-widget');
    return saved.length > 0 ? saved : [WELCOME_MESSAGE];
  });
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

  // Persistance : sauvegarder les messages à chaque modification
  useEffect(() => {
    saveChatMessages('sara-widget', messages);
  }, [messages]);

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

  // ─── VOICE INPUT HANDLER ──────────────────────────────────────────────

  const handleVoiceInput = useCallback(async (audioBase64: string) => {
    setIsTyping(true);
    setStreamingText('');

    try {
      // Transcrire l'audio
      const { text } = await saraApi.voiceTranscribe(audioBase64);

      if (!text.trim()) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "Je n'ai pas bien compris. Pouvez-vous répéter ?",
        }]);
        setIsTyping(false);
        return;
      }

      // Afficher le message utilisateur
      setInput('');
      setShowSuggestions(false);
      setMessages(prev => [...prev, { role: 'user', content: text }]);

      // Envoyer à SARA (streaming)
      let fullText = '';
      const stream = saraApi.queryStream(text, undefined, messages);

      for await (const chunk of stream) {
        if (chunk.type === 'delta' && chunk.text) {
          fullText += chunk.text;
          setStreamingText(fullText);
        } else if (chunk.type === 'error') {
          if (!fullText) {
            fullText = "Je suis désolée, une erreur technique s'est produite.";
          }
          break;
        }
      }

      if (fullText) {
        setMessages(prev => [...prev, { role: 'assistant', content: fullText }]);
      }
    } catch (error: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Erreur vocale. Essayez de taper votre question.",
      }]);
    } finally {
      setIsTyping(false);
      setStreamingText('');
    }
  }, [messages]);

  // ─── RENDER ──────────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-6 right-6 z-[1000] font-sans">
      {isOpen ? (
        // ─── OPEN STATE — Holographic Chat Panel (Carte du Bénin style) ──
        <div
          className={cn(
            'w-[400px] max-h-[600px] flex flex-col overflow-hidden',
            'animate-in slide-in-from-bottom-4 duration-500',
            'rounded-xl',
            'sara-holo-scroll',
          )}
          style={{
            background: H.darkBg,
            border: `2px solid ${H.cyanBorder}`,
            boxShadow: `0 0 40px rgba(0,229,255,0.3), 0 0 80px rgba(0,229,255,0.1), inset 0 0 40px rgba(0,229,255,0.06)`,
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* ─── OUTER GLOW PULSE ─────────────────────────────── */}
          <div
            className="absolute -inset-2 rounded-xl border-2 pointer-events-none"
            style={{
              borderColor: H.cyan,
              animation: 'holo-halo-pulse 2.5s ease-in-out infinite',
              boxShadow: '0 0 20px rgba(0,229,255,0.25), 0 0 40px rgba(0,229,255,0.1)',
            }}
          />

          {/* ─── TOP ENERGY LINE ──────────────────────────────── */}
          <div
            className="relative h-[2.5px] mx-3 mt-2 rounded-full shrink-0"
            style={{
              background: `linear-gradient(90deg, transparent, ${H.cyan}, transparent)`,
              animation: 'holo-pulse 1.8s ease-in-out infinite',
              boxShadow: '0 0 8px rgba(0,229,255,0.5)',
            }}
          />

          {/* ─── SCANLINE ──────────────────────────────────────── */}
          <div className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden z-20">
            <div
              className="absolute left-0 right-0 h-[2px]"
              style={{
                background: `linear-gradient(90deg, transparent, rgba(0,229,255,0.7), transparent)`,
                boxShadow: '0 0 6px rgba(0,229,255,0.4)',
                animation: 'holo-scan 3s linear infinite',
                top: 0,
              }}
            />
          </div>

          {/* ─── CORNER BRACKETS ──────────────────────────────── */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 400 600" fill="none">
            <path d="M2,16 L2,2 L16,2" stroke={H.cyan} strokeWidth="1.5" opacity="0.6" />
            <path d="M384,2 L398,2 L398,16" stroke={H.cyan} strokeWidth="1.5" opacity="0.6" />
            <path d="M2,584 L2,598 L16,598" stroke={H.cyan} strokeWidth="1.5" opacity="0.6" />
            <path d="M384,598 L398,598 L398,584" stroke={H.cyan} strokeWidth="1.5" opacity="0.6" />
          </svg>

          {/* ─── HEADER ──────────────────────────────────────────── */}
          <div className="relative p-4 flex items-center justify-between shrink-0">
            {/* Separator line under header */}
            <div className="absolute bottom-0 left-0 right-0 h-[1px]"
              style={{ background: `linear-gradient(90deg, transparent, ${H.cyanFaint}, transparent)` }}
            />

            <div className="relative flex items-center gap-3">
              {/* Photo de Sarah avec anneau holographique */}
              <div className="relative flex items-center justify-center" style={{ animation: 'crownFloat 3s ease-in-out infinite' }}>
                <div className="absolute inset-[-3px] rounded-full"
                  style={{
                    background: 'conic-gradient(from 0deg, rgba(0,229,255,0.5), transparent 25%, rgba(245,179,53,0.3), transparent 50%, rgba(0,229,255,0.4), transparent 75%, rgba(245,179,53,0.2), rgba(0,229,255,0.5))',
                    animation: 'holoBorderSpin 4s linear infinite',
                    borderRadius: '50%',
                  }}
                />
                <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2" style={{ ringColor: H.cyan }}>
                  <Image
                    src="/images/SarahAI.png"
                    alt="Sarah"
                    width={40}
                    height={40}
                    className="object-cover w-full h-full"
                    priority
                  />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 animate-pulse"
                  style={{
                    background: `linear-gradient(135deg, ${H.green}, ${H.greenGlow})`,
                    borderColor: 'transparent',
                    boxShadow: `0 0 6px ${H.green}`,
                  }}
                />
              </div>

              <div>
                <h4 className="font-bold text-sm text-white"
                  style={{
                    textShadow: '0 0 6px rgba(0,229,255,0.3)',
                  }}
                >
                  Sarah
                </h4>
                <p className="text-[10px] font-medium tracking-[0.1em] uppercase"
                  style={{ color: H.cyanDim }}
                >
                  Conseillère Academia Helm
                </p>
              </div>
            </div>

            <div className="relative flex items-center gap-2.5">
              {/* GREEN online indicator */}
              <div className="relative flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: H.green, boxShadow: `0 0 6px ${H.green}` }}
                />
                <span className="text-[9px] font-semibold"
                  style={{ color: H.green }}
                >
                  En ligne
                </span>
              </div>
              {/* Voice Mode button */}
              <button
                onClick={() => setIsVoiceModeOpen(true)}
                className="p-1.5 rounded-lg transition-all"
                style={{
                  background: H.cyanGhost,
                  border: `1px solid ${H.cyanFaint}`,
                  color: H.cyanDim,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0,229,255,0.2)';
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.boxShadow = '0 0 8px rgba(0,229,255,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = H.cyanGhost;
                  e.currentTarget.style.color = H.cyanDim;
                  e.currentTarget.style.boxShadow = 'none';
                }}
                title="Mode vocal"
              >
                <Mic size={12} />
              </button>
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
                    background: p.id % 3 === 0 ? H.gold : H.cyan,
                    animation: `holoFloat ${4 + p.speed * 8}s ease-in-out infinite`,
                    animationDelay: `${p.id * 0.15}s`,
                    boxShadow: `0 0 ${p.size * 2}px ${p.id % 3 === 0 ? 'rgba(245,179,53,0.2)' : 'rgba(0,229,255,0.2)'}`,
                  }}
                />
              ))}
            </div>

            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start', 'relative z-10')}>
                <div
                  className={cn(
                    'max-w-[85%] p-3 rounded-xl text-[13px] leading-relaxed',
                    m.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm',
                  )}
                  style={m.role === 'user' ? {
                    background: `linear-gradient(135deg, rgba(0,229,255,0.12), rgba(0,18,35,0.6))`,
                    border: `1px solid rgba(0,229,255,0.3)`,
                    color: '#ffffff',
                    boxShadow: '0 0 12px rgba(0,229,255,0.08)',
                  } : {
                    background: `linear-gradient(135deg, rgba(0,18,35,0.6), rgba(0,18,35,0.8))`,
                    border: `1px solid ${H.cyanFaint}`,
                    color: '#ffffff',
                    boxShadow: '0 0 12px rgba(0,229,255,0.04)',
                  }}
                >
                  {m.role === 'assistant' ? renderMarkdown(m.content) : m.content}
                </div>
              </div>
            ))}

            {/* Streaming text */}
            {isTyping && streamingText && (
              <div className="flex justify-start relative z-10">
                <div
                  className="max-w-[85%] p-3 rounded-xl rounded-tl-sm text-[13px] leading-relaxed"
                  style={{
                    background: `linear-gradient(135deg, rgba(0,18,35,0.6), rgba(0,18,35,0.8))`,
                    border: `1px solid ${H.cyanFaint}`,
                    color: '#ffffff',
                    boxShadow: '0 0 12px rgba(0,229,255,0.04)',
                  }}
                >
                  {renderMarkdown(streamingText)}
                  <span className="inline-block w-[2px] h-4 ml-0.5 animate-pulse align-middle"
                    style={{ backgroundColor: H.cyan, boxShadow: `0 0 6px ${H.cyan}` }}
                  />
                </div>
              </div>
            )}

            {/* Typing indicator */}
            {isTyping && !streamingText && (
              <div className="flex justify-start relative z-10">
                <div
                  className="p-3 rounded-xl rounded-tl-sm flex gap-2 items-center"
                  style={{
                    background: `linear-gradient(135deg, rgba(0,18,35,0.6), rgba(0,18,35,0.8))`,
                    border: `1px solid ${H.cyanFaint}`,
                  }}
                >
                  <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:-0.3s]"
                    style={{ backgroundColor: H.cyan, boxShadow: `0 0 4px ${H.cyan}` }} />
                  <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:-0.15s]"
                    style={{ backgroundColor: H.gold, boxShadow: `0 0 4px ${H.gold}` }} />
                  <span className="w-2 h-2 rounded-full animate-bounce"
                    style={{ backgroundColor: H.cyan, boxShadow: `0 0 4px ${H.cyan}` }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ─── QUICK SUGGESTIONS ── CYAN STYLE ──────────── */}
          {showSuggestions && messages.length <= 1 && (
            <div className="px-4 pb-2 shrink-0 relative">
              <p className="text-[10px] mb-2 font-semibold uppercase tracking-[0.12em]"
                style={{ color: H.cyanFaint }}
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
                      background: H.cyanGhost,
                      border: `1px solid ${H.cyanFaint}`,
                      color: H.cyanDim,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(0,229,255,0.2)';
                      e.currentTarget.style.borderColor = H.cyanDim;
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(0,229,255,0.25)';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = H.cyanGhost;
                      e.currentTarget.style.borderColor = H.cyanFaint;
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.color = H.cyanDim;
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── SEPARATOR ──────────────────────────────────────── */}
          <div className="mx-4 h-[1px] shrink-0"
            style={{ background: `linear-gradient(90deg, transparent, ${H.cyanFaint}, transparent)` }}
          />

          {/* ─── INPUT ── WHITE BACKGROUND, CYAN HOLOGRAPHIC BORDER ── */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 shrink-0 relative"
          >
            <div className="relative flex items-center gap-2">
              {/* Voice Button (left of input) */}
              <VoiceButton
                onRecordingComplete={handleVoiceInput}
                disabled={isTyping}
                size="sm"
              />

              {/* Text Input */}
              <div className="relative flex-1">
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
                    border: `1px solid ${H.cyanFaint}`,
                    color: '#001223',
                    boxShadow: '0 0 0 0 transparent',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = H.cyan;
                    e.currentTarget.style.boxShadow = `0 0 20px rgba(0,229,255,0.2), 0 0 40px rgba(0,229,255,0.08)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = H.cyanFaint;
                    e.currentTarget.style.boxShadow = '0 0 0 0 transparent';
                  }}
                  disabled={isTyping}
                />
                <style>{`input::placeholder { color: rgba(0,18,35,0.35) !important; }`}</style>
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300"
                  style={input.trim() && !isTyping ? {
                    background: `linear-gradient(135deg, ${H.cyan}, #009bb8)`,
                    color: '#fff',
                    boxShadow: `0 0 12px rgba(0,229,255,0.4)`,
                  } : {
                    background: 'rgba(0,229,255,0.1)',
                    color: 'rgba(0,229,255,0.3)',
                    cursor: 'not-allowed',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </form>

          {/* ─── BOTTOM ENERGY LINE ──────────────────────────── */}
          <div
            className="h-[2px] mx-3 mb-2 rounded-full shrink-0"
            style={{
              background: `linear-gradient(90deg, transparent, ${H.cyan}, transparent)`,
              animation: 'holo-pulse 2.2s ease-in-out infinite',
              boxShadow: '0 0 6px rgba(0,229,255,0.3)',
            }}
          />

          {/* ─── ACADEMIA HELM LABEL ─────────────────────────── */}
          <p className="text-center text-[7px] tracking-[0.15em] pb-2" style={{ color: 'rgba(0,229,255,0.2)' }}>
            ACADEMIA HELM
          </p>
        </div>
      ) : (
        // ─── CLOSED STATE — Couronne animée flottante (pas de cercle) ──
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center justify-center transition-all duration-500 hover:scale-110 cursor-pointer"
          style={{ width: '72px', height: '72px' }}
          aria-label="Ouvrir le chat Sarah"
        >
          {/* Fond glow diffus derrière la couronne */}
          <div className="absolute inset-0"
            style={{
              background: `radial-gradient(circle, rgba(0,229,255,0.12) 0%, rgba(245,179,53,0.06) 35%, transparent 65%)`,
              filter: 'blur(8px)',
              animation: 'crownGlow 3s ease-in-out infinite',
            }}
          />

          {/* Anneau holographique tournant — aura subtile autour */}
          <div className="absolute inset-[-2px] rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, rgba(0,229,255,0.35), transparent 20%, rgba(245,179,53,0.2), transparent 40%, rgba(0,229,255,0.25), transparent 60%, rgba(245,179,53,0.15), transparent 80%, rgba(0,229,255,0.35))',
              mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              maskComposite: 'exclude',
              WebkitMaskComposite: 'xor',
              padding: '1.5px',
              borderRadius: '50%',
              animation: 'holoBorderSpin 6s linear infinite',
              opacity: 0.7,
            }}
          />

          {/* Photo de Sarah avec anneau holographique */}
          <div className="relative" style={{ animation: 'crownFloat 3s ease-in-out infinite' }}>
            <div className="absolute inset-[-4px] rounded-full"
              style={{
                background: 'conic-gradient(from 0deg, rgba(0,229,255,0.6), transparent 20%, rgba(245,179,53,0.35), transparent 40%, rgba(0,229,255,0.45), transparent 60%, rgba(245,179,53,0.25), transparent 80%, rgba(0,229,255,0.6))',
                animation: 'holoBorderSpin 5s linear infinite',
                borderRadius: '50%',
                boxShadow: `0 0 20px rgba(0,229,255,0.2)`,
              }}
            />
            <div className="relative w-14 h-14 rounded-full overflow-hidden ring-2 shadow-xl" style={{ ringColor: H.cyan }}>
              <Image
                src="/images/SarahAI.png"
                alt="Sarah"
                width={56}
                height={56}
                className="object-cover w-full h-full"
                priority
              />
            </div>
          </div>

          {/* Ping subtil — anneau diffus */}
          <div className="absolute inset-0 rounded-full animate-ping opacity-10"
            style={{ border: `1.5px solid ${H.cyan}` }}
          />

          {/* Green notification dot */}
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 animate-pulse"
            style={{
              background: `linear-gradient(135deg, ${H.green}, ${H.greenGlow})`,
              borderColor: 'transparent',
              boxShadow: `0 0 8px ${H.green}`,
            }}
          />

          {/* Hover tooltip */}
          <div className="absolute right-full mr-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none px-3 py-2 rounded-lg text-xs font-semibold"
            style={{
              background: H.darkBg,
              border: `1px solid ${H.cyanFaint}`,
              color: '#ffffff',
              boxShadow: `0 0 15px rgba(0,229,255,0.1)`,
              backdropFilter: 'blur(10px)',
            }}
          >
            Discutez avec Sarah
          </div>
        </button>
      )}

      {/* ─── ANIMATIONS ──────────────────────────────────────────────────── */}
      <style jsx global>{`
        /* ── Carte du Bénin keyframes ── */
        @keyframes holo-pulse {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 0.5; }
        }

        @keyframes holo-scan {
          0% { top: 0; opacity: 0.7; }
          50% { opacity: 0.25; }
          100% { top: 100%; opacity: 0.7; }
        }

        @keyframes holo-halo-pulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.02); }
        }

        /* ── Floating particles ── */
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

        /* ── Rotating border ── */
        @keyframes holoBorderSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* ── Crown animations ── */
        @keyframes crownFloat {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }

        @keyframes crownGlow {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.08);
          }
        }

        @keyframes crownShimmer {
          0%, 100% {
            filter: drop-shadow(0 0 6px rgba(0,229,255,0.4));
            color: #f5b335;
          }
          33% {
            filter: drop-shadow(0 0 14px rgba(0,229,255,0.6)) drop-shadow(0 0 20px rgba(245,179,53,0.3));
            color: #f7c76e;
          }
          66% {
            filter: drop-shadow(0 0 10px rgba(245,179,53,0.4)) drop-shadow(0 0 16px rgba(0,229,255,0.2));
            color: #f5b335;
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
          background: rgba(0,229,255,0.15);
          border-radius: 4px;
        }
        .sara-holo-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0,229,255,0.3);
        }
      `}</style>

      {/* ─── VOICE MODE (Full-screen immersive) ──────────────────────── */}
      <VoiceMode
        isOpen={isVoiceModeOpen}
        onClose={() => setIsVoiceModeOpen(false)}
        visitorId={undefined}
      />
    </div>
  );
}
