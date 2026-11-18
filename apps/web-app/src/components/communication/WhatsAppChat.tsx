'use client';

/**
 * ============================================================================
 * WHATSAPP CHAT — Composant de messagerie interne type WhatsApp/Telegram
 * ============================================================================
 *
 * Fonctionnalités :
 *   - Liste des conversations (sidebar gauche) avec catégories:
 *     • Discussions (1-à-1)
 *     • Groupes
 *     • Canaux (broadcast Telegram-style)
 *   - Vue conversation (pane droite) avec bulles de messages
 *   - Messages texte, fichiers (images, audio, documents)
 *   - Enregistrement vocal (MediaRecorder API)
 *   - Statut de lecture (✓ envoyé, ✓✓ bleu lu)
 *   - Recherche d'utilisateurs (intra + inter-écoles) + invitations
 *   - Socket.io temps réel (instant delivery + typing + presence)
 *   - Chiffrement E2E (Web Crypto API, RSA-OAEP)
 *   - Notifications push (Service Worker)
 *   - Upload d'avatar de profil
 * ============================================================================
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Loader2, Send, Search, Plus, Users, Paperclip, X, Check, CheckCheck,
  ArrowLeft, MoreVertical, Mic, FileText, Image as ImageIcon, Bell,
  UserPlus, MessageSquare, Phone, Video, Clock, Settings, Megaphone,
  BellOff, Play, Pause, CheckCircle2, Reply, Forward, Copy, Pin, Trash2,
  BarChart3, Download, Pencil, Star, MicOff, Volume2, RefreshCw, VideoOff, Flag, User as UserIcon,
  Sparkles, ListChecks, ClipboardList, AudioLines, Rss,
  ChevronUp, ChevronDown, Monitor, Smile,
  PhoneMissed, PhoneOff, Radio, FileAudio, FileVideo, MessageCircle, Ban, Lock,
  Menu, ShieldAlert, Gauge, ScrollText, XCircle, Shield, VolumeX, UserMinus,
  Link2, ExternalLink, CalendarClock, ChevronRight, ShieldCheck, ShieldX, KeyRound, LogOut,
  GraduationCap, BookOpen, Heart, UserCheck, Building2, CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useChatSocket } from '@/lib/chat/useChatSocket';
// ⭐ V4 (porté de Yeshua Connect) : chaîne média des appels + overlay unifié
import {
  createMediaSession, fetchMediaJoin, fetchMediaFailover,
  withTimeout, ChainExhaustedError,
  type MediaSessionHandle, type MediaProviderName, type HcRemoteParticipant,
} from '@/lib/chat/media-chain';
import CallSessionOverlay, { type CallSessionInfo } from './call/CallSessionOverlay';
import VoiceChannelPanel from './call/VoiceChannelPanel';
// ⭐ V4 Phase 2 — Rendu chat enrichi (porté de Yeshua Connect)
import LinkEmbed from './LinkEmbed';
import MediaGalleryModal from './MediaGalleryModal';
import { generateKeyPair, hasPrivateKey, encryptMessage, decryptMessage, isEncrypted } from '@/lib/chat/crypto';
// ⭐ V3-1: Offline-first chat — IndexedDB cache + send queue + retry on reconnect
import {
  getMessages as getOfflineMessages,
  saveMessagesBulk,
  saveMessage as saveOfflineMessage,
  addPendingMessage,
  getPendingMessages,
  removePendingMessage,
  incrementPendingAttempts,
  markMessageSent,
  markMessageFailed,
  setLastSyncedAt,
  generateLocalId,
  isOfflineStoreAvailable,
  type OfflineChatMessage,
  type PendingMessage,
} from '@/lib/chat/chat-offline-store';
import AnnouncementsModal from './AnnouncementsModal';
import NotificationPreferencesModal from './NotificationPreferencesModal';
import GlobalSearchModal from './GlobalSearchModal';
import CategorizedAttachmentMenu from './CategorizedAttachmentMenu';
import PollModal from './PollModal';
import DropdownMenu from './DropdownMenu';
import { getHelmWatermarkStyle } from './HelmWatermark';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import DocumentPreviewModal from '@/components/students/DocumentPreviewModal';
// ⭐ 2026-10-14 — Ports Yeshua Connect (audit Helm Connect vs Yeshua Connect) :
//   - SlashCommandsPopover : navigation clavier ↑↓/Enter/Échap au-dessus du composer
//   - flagFromCountryCode + COUNTRIES : drapeaux de pays sur profils membres
//   - useP2PCall : fallback WebRTC 1-à-1 quand la chaîne média LiveKit/Agora/Daily échoue
//   - highlightCode : syntax highlight maison (sans dépendance Prism) pour les blocs de code
import { SlashCommandsPopover, HELM_COMMANDS } from './SlashCommandsPopover';
import { flagFromCountryCode } from '@/lib/data/flags';
import { COUNTRIES } from '@/lib/data/countries';
import { useP2PCall } from '@/hooks/use-p2p-call';
import { highlightCode } from '@/lib/chat/syntax-highlighter';

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────

interface ChatParticipant {
  userId: string;
  role: 'ADMIN' | 'MEMBER';
  joinedAt: string;
  lastReadAt?: string;
  muted: boolean;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
  role_label?: string;
  roleLabel?: string;          // ex: "Collègue enseignant", "Parent de Awa Dupont", "Directeur"
  childrenNames?: string[];   // pour les parents : noms des enfants
}

interface ChatConversation {
  id: string;
  type: 'DIRECT' | 'GROUP';
  name?: string;
  description?: string;
  avatarUrl?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastMessageSenderId?: string;
  participants: ChatParticipant[];
  // ⭐ DISCORD PARITY: Unread message count (computed by backend in listConversations).
  //    Used to render a blue badge on the conversation list item.
  unreadCount?: number;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  // ⭐ V6 — types étendus : CALL_LOG (journaux d'appels V4), POLL,
  // STICKER, GIF, VIDEO — le backend et le rendu les produisent déjà.
  type: 'TEXT' | 'AUDIO' | 'DOCUMENT' | 'IMAGE' | 'VIDEO' | 'CALL_LOG' | 'POLL' | 'STICKER' | 'GIF' | string;
  content?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
  attachmentMime?: string;
  duration?: number;
  replyToId?: string;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
  // ⭐ V4/V5 — champs réels renvoyés par le backend (bulles riches)
  senderFirstName?: string;
  senderLastName?: string;
  deliveredAt?: string | null;
  pinned?: boolean;
  important?: boolean;
  reactions?: { emoji: string; userId: string }[];
  meta?: any;
  sender?: {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    role?: string;
  };
  readBy?: { userId: string; readAt: string }[];
}

interface ChatUser {
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
  role?: string;
  roleLabel?: string;          // ex: "Collègue enseignant", "Parent de Awa Dupont", "Directeur"
  tenantName?: string;
  isSameTenant: boolean;
  canStartDirectConversation: boolean;  // true = same tenant (no invitation required)
  childrenNames?: string[];    // for parents: their children's names
  source?: 'users' | 'guardians';      // ⭐ Whether entry comes from users table or guardians table
  phone?: string;                       // ⭐ For guardians without account — to send SMS invitation
  guardianId?: string;                 // ⭐ V6 — parents sans compte (table guardians)
}

interface WhatsAppChatProps {
  currentUserId: string;
  /** Mode lecture-seule (ex: parent ne peut pas créer de groupe) */
  readOnly?: boolean;
  /** Hauteur personnalisée (par défaut calc(100vh - 200px)) */
  heightClass?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** ⭐ V5 (parité Yeshua) — Heure de la sidebar intelligente :
 *  aujourd'hui → HH:MM · hier → « Hier » · < 7 j → jour abrégé (mar.) ·
 *  sinon → jj/mm/aa. */
function formatConvTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diffDays <= 0) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatDateSeparator(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** ⭐ V5 (parité Yeshua + spec #12) — LECTEUR VOCAL façon WhatsApp :
 *    bouton play/pause rond, waveform de 28 barres DÉTERMINISTES (seed =
 *    longueur de l'URL — stable d'un rendu à l'autre), barres colorées
 *    jusqu'à la position de lecture, seek au CLIC sur la waveform, temps
 *    courant/total tabular-nums, téléchargement, et VITESSE DE LECTURE
 *    (0,5× / 1× / 1,5× / 2×) via audio.playbackRate — exigée par la spec. */
function VoiceNotePlayer({ src, name, isMine }: { src: string; name?: string; isMine: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  // Waveform déterministe : 28 barres, hauteurs 0.25..1
  const bars = useMemo(() => {
    let h = 5381 + src.length * 2654435761;
    const arr: number[] = [];
    for (let i = 0; i < 28; i++) {
      h = (h * 1103515245 + 12345) & 0x7fffffff;
      arr.push(0.25 + ((h % 1000) / 1000) * 0.75);
    }
    return arr;
  }, [src]);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play().catch(() => {}); } else { a.pause(); }
  };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * a.duration;
    setProgress(ratio);
  };
  const cycleRate = () => {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : rate === 2 ? 0.5 : 1;
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };
  const playedBars = Math.round(progress * bars.length);
  return (
    <div className="flex items-center gap-2 py-0.5 min-w-[210px]">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); setCurrent(0); }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          setCurrent(a.currentTime);
          if (a.duration) setProgress(a.currentTime / a.duration);
        }}
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (isFinite(d)) setDuration(d); }}
      />
      <button
        onClick={toggle}
        className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm transition-transform hover:scale-105',
          isMine ? 'bg-white/25 text-white' : 'bg-[#1677FF] text-white')}
        title={playing ? 'Pause' : 'Lecture'}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      {/* Waveform cliquable (seek) */}
      <div
        onClick={seek}
        className="flex items-center gap-[2px] h-8 cursor-pointer flex-1 min-w-[90px] select-none"
        title="Cliquer pour avancer/reculer"
      >
        {bars.map((b, i) => (
          <span
            key={i}
            className={cn('flex-1 rounded-full transition-colors',
              i < playedBars
                ? (isMine ? 'bg-white' : 'bg-[#1677FF]')
                : (isMine ? 'bg-white/40' : 'bg-slate-300'))}
            style={{ height: `${Math.round(b * 100)}%` }}
          />
        ))}
      </div>
      <div className={cn('text-[10px] font-mono tabular-nums flex-shrink-0', isMine ? 'text-white/90' : 'text-slate-500')}>
        {fmt(current)}{duration > 0 ? ` / ${fmt(duration)}` : ''}
      </div>
      <button
        onClick={cycleRate}
        className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 tabular-nums',
          isMine ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
        title="Vitesse de lecture"
      >
        {rate === 0.5 ? '0,5×' : rate === 1 ? '1×' : rate === 1.5 ? '1,5×' : '2×'}
      </button>
      <a
        href={src}
        download={name || 'message-vocal'}
        className={cn('p-1 rounded flex-shrink-0', isMine ? 'text-white/80 hover:bg-white/20' : 'text-slate-400 hover:bg-slate-200')}
        title="Télécharger"
      >
        <Download className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

/**
 * ⭐ RICH CONTENT RENDERER — Discord-style markdown formatting.
 *    Transforms @mentions, ||spoilers||, `inline code`, ~~strikethrough~~,
 *    and > blockquotes in message HTML content.
 *
 * The message content is stored as HTML (from RichTextEditor). We need to
 * transform patterns WITHOUT breaking existing HTML tags. Approach:
 *   1. Split the HTML into tag and text segments using a regex that matches
 *      either an HTML tag OR plain text.
 *   2. Only transform patterns in TEXT segments (not inside tags).
 *
 * Supported patterns (Discord-compatible):
 *   - @username    → highlighted mention badge (blue background)
 *   - ||spoiler||  → click-to-reveal spoiler (dark background, reveals on click)
 *   - `inline code` → monospace code with gray background
 *   - ~~strikethrough~~ → line-through text
 *   - > blockquote → left border + gray background blockquote
 *
 * This is safe because we never modify the actual HTML structure — we only
 * inject <span>/<code>/<blockquote> elements around text patterns.
 *
 * @param html The message content as HTML
 * @returns HTML with rich content patterns transformed
 */
function renderRichContent(html: string): string {
  if (!html) return html;
  let hasMentions = html.includes('@');
  let hasSpoilers = html.includes('||');
  let hasCode = html.includes('`');
  let hasStrike = html.includes('~~');
  let hasQuote = html.includes('&gt; ') || html.includes('> ');
  let hasCodeBlock = html.includes('```');
  if (!hasMentions && !hasSpoilers && !hasCode && !hasStrike && !hasQuote && !hasCodeBlock) return html;

  // ⭐ DISCORD PARITY: Multi-line code blocks ```language\ncode\n```
  //    Must be processed BEFORE inline code (backticks) to avoid double-processing.
  //    ⭐ V5 (parité Yeshua) : header avec label du langage + bouton COPIER
  //    (copie via délégation d'événement — voir effet dédié dans le composant).
  //    ⭐ 2026-10-14 — Syntax highlight maison (sans dépendance Prism) :
  //    highlightCode() prend le code BRUT (non échappé) et renvoie le HTML
  //    coloré avec des <span style="color:...">. Échappement HTML fait en
  //    interne. Langages supportés : JS/TS, Python, SQL, JSON, bash, HTML,
  //    CSS, Markdown. Sinon fallback plain text coloré uniformément.
  if (hasCodeBlock) {
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
      const raw = String(code).trim();
      // ⭐ 2026-10-14 — Syntax highlight (highlighter maison sans dépendance Prism)
      //    highlightCode échappe le HTML en interne et renvoie des spans colorés.
      const highlighted = highlightCode(raw, lang);
      // Attribut sûr : encodeURIComponent échappe < > & " — aucune fermeture de tag possible
      const attr = encodeURIComponent(raw);
      return `<div class="code-block" style="position:relative;margin:6px 0;border-radius:8px;overflow:hidden;border:1px solid #1e293b;">` +
        `<div style="display:flex;align-items:center;justify-content:space-between;background-color:#0b1322;padding:4px 10px;">` +
        `<span style="font-size:0.7em;color:#94a3b8;font-family:ui-monospace,monospace;">${lang || 'code'}</span>` +
        `<button class="code-copy-btn" type="button" data-code="${attr}" style="font-size:0.7em;color:#94a3b8;background:transparent;border:0;cursor:pointer;font-family:inherit;padding:2px 6px;border-radius:4px;">Copier</button>` +
        `</div>` +
        `<pre style="background-color:#0f172a;color:#f1f5f9;padding:10px 12px;margin:0;overflow-x:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:0.85em;line-height:1.5;"><code>${highlighted}</code></pre>` +
        `</div>`;
    });
  }

  // Split into HTML tags and text content
  const parts = html.split(/(<[^>]+>)/);
  let inCodeBlock = false;
  return parts.map(part => {
    // ⭐ V5 — ne JAMAIS transformer le CONTENU d'un bloc de code (les @, ~~,
    //    || et ` du code doivent rester du texte brut affiché).
    if (part.startsWith('<pre')) { inCodeBlock = true; return part; }
    if (part.startsWith('</pre')) { inCodeBlock = false; return part; }
    if (inCodeBlock) return part;
    if (part.startsWith('<')) return part;

    let result = part;

    // ⭐ ||spoiler|| → click-to-reveal
    if (hasSpoilers) {
      result = result.replace(
        /\|\|([^|]+)\|\|/g,
        '<span class="spoiler-tag" style="background-color:#1e293b;color:#1e293b;border-radius:3px;padding:0 3px;cursor:pointer;transition:color 0.2s;" onclick="this.style.color=\'#f1f5f9\';this.style.backgroundColor=\'#334155\';">$1</span>'
      );
    }

    // ⭐ ~~strikethrough~~ → line-through
    if (hasStrike) {
      result = result.replace(
        /~~([^~]+)~~/g,
        '<span style="text-decoration:line-through;">$1</span>'
      );
    }

    // ⭐ `inline code` → monospace with gray background
    if (hasCode) {
      result = result.replace(
        /`([^`]+)`/g,
        '<code style="background-color:#f1f5f9;color:#0f172a;border-radius:3px;padding:1px 4px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:0.875em;">$1</code>'
      );
    }

    // ⭐ > blockquote → left border + gray background (Discord-style)
    if (hasQuote) {
      result = result.replace(
        /(?:^|\n)(?:&gt;|>)\s(.+)/g,
        (match, p1) => {
          const prefix = match.startsWith('\n') ? '\n' : '';
          return `${prefix}<blockquote style="border-left:3px solid #cbd5e1;background-color:#f8fafc;padding:2px 8px;margin:2px 0;color:#475569;border-radius:0 4px 4px 0;">${p1}</blockquote>`;
        }
      );
    }

    // ⭐ @mentions + @here + @everyone → highlighted badge
    if (hasMentions) {
      // @here and @everyone → amber/yellow badge (Discord style)
      result = result.replace(
        /@(here|everyone|tous)\b/gi,
        '<span style="background-color:rgba(245,158,11,0.2);color:#B45309;font-weight:600;border-radius:3px;padding:0 2px;">@$1</span>'
      );
      // @username → blue badge
      result = result.replace(
        /@([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9_\-']{1,29})/g,
        (match, name) => {
          // Skip if it's @here/@everyone (already processed)
          if (/^(here|everyone|tous)$/i.test(name)) return match;
          return `<span style="background-color:rgba(22,119,255,0.15);color:#0958D9;font-weight:600;border-radius:3px;padding:0 2px;">@${name}</span>`;
        }
      );
    }

    return result;
  }).join('');
}

/** ⭐ Backward-compatible alias for the old name (used elsewhere in the file). */
const highlightMentions = renderRichContent;

/**
 * ⭐ MENTIONS — Extract mentioned user IDs from message content.
 *
 * Given the message HTML and the conversation participants, find which
 * participants are mentioned (their firstName or lastName appears after @).
 * Returns an array of userIds for push notification targeting.
 */
function extractMentionedUserIds(html: string, participants: { userId: string; firstName?: string; lastName?: string }[], currentUserId: string): string[] {
  if (!html || !html.includes('@')) return [];
  const text = html.replace(/<[^>]*>/g, ''); // strip HTML tags
  const mentioned = new Set<string>();
  // ⭐ DISCORD PARITY: @here / @everyone / @tous → mention ALL participants
  const isMassMention = /@(here|everyone|tous)\b/i.test(text);
  if (isMassMention) {
    for (const p of participants) {
      if (p.userId && p.userId !== currentUserId) mentioned.add(p.userId);
    }
    return Array.from(mentioned);
  }
  // Per-user @FirstName / @LastName mentions
  for (const p of participants) {
    if (!p.userId || p.userId === currentUserId) continue;
    const firstName = (p.firstName || '').trim();
    const lastName = (p.lastName || '').trim();
    if (firstName && text.includes(`@${firstName}`)) {
      mentioned.add(p.userId);
    } else if (lastName && text.includes(`@${lastName}`)) {
      mentioned.add(p.userId);
    }
  }
  return Array.from(mentioned);
}

/**
 * ⭐ DISCORD PARITY — Notification sound on new message.
 *
 * Plays a short, pleasant two-tone beep using the Web Audio API.
 * No external audio file is needed — the sound is synthesized on the fly.
 * This works on all modern browsers (Chrome, Firefox, Safari, Edge) and on
 * mobile (after a user interaction — the first user click/tap unlocks audio).
 *
 * The beep is a 880 Hz sine wave for 150 ms, followed by a 1320 Hz tone for
 * 100 ms (a pleasant "ding-dong" pattern similar to Discord's notification).
 */
let _audioContext: AudioContext | null = null;
function playNotificationSound(): void {
  try {
    if (typeof window === 'undefined') return;
    // Lazily create the AudioContext (must be created after a user gesture
    // on mobile browsers — the first click anywhere in the app unlocks it)
    if (!_audioContext) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      _audioContext = new AudioCtx();
    }
    // Resume if the context was suspended (mobile browsers suspend audio
    // until a user gesture is detected)
    if (_audioContext.state === 'suspended') {
      _audioContext.resume().catch(() => {});
    }

    const now = _audioContext.currentTime;
    // First tone (880 Hz, 150 ms)
    const osc1 = _audioContext.createOscillator();
    const gain1 = _audioContext.createGain();
    osc1.frequency.value = 880;
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1).connect(_audioContext.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second tone (1320 Hz, 100 ms — starts at 150 ms)
    const osc2 = _audioContext.createOscillator();
    const gain2 = _audioContext.createGain();
    osc2.frequency.value = 1320;
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0, now + 0.15);
    gain2.gain.linearRampToValueAtTime(0.15, now + 0.17);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc2.connect(gain2).connect(_audioContext.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.25);
  } catch {
    // Silent fallback — audio is non-critical
  }
}

function getConversationDisplay(conv: ChatConversation, currentUserId: string): {
  name: string;
  subtitle?: string;
  roleLabel?: string;  // ex: "Collègue enseignant", "Parent de Awa Dupont"
  avatarUrl?: string;
} {
  if (conv.type === 'GROUP') {
    return { name: conv.name || 'Groupe sans nom', subtitle: `${conv.participants?.length ?? 0} membres` };
  }
  // DIRECT: l'autre participant
  // ⭐ v3.8.0 — optional chaining : hors ligne, certaines conversations en
  //    cache local n'ont pas encore `participants` (réponse partielle) →
  //    `conv.participants.find` faisait crasher TOUT le module Helm Connect
  //    (« Erreur du module » — TypeError: reading 'userId').
  const other = conv.participants?.find(p => p.userId !== currentUserId);
  if (!other) return { name: 'Inconnu' };
  // ⭐ Utiliser le roleLabel (ex: "Parent de Awa Dupont", "Collègue enseignant", "Directeur")
  //    c'est plus informatif que juste le role brut
  return {
    name: `${other.firstName || ''} ${other.lastName || ''}`.trim() || other.email || 'Inconnu',
    subtitle: other.email,
    roleLabel: other.roleLabel,
    avatarUrl: other.avatarUrl,
  };
}

function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500', 'bg-[#3B9EFF]', 'bg-amber-500', 'bg-rose-500',
    'bg-indigo-500', 'bg-purple-500', 'bg-cyan-500', 'bg-orange-500',
  ];
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

// ⭐ FIX (sept. 2026 — retour utilisateur) : le rôle du profil Helm Connect
//    s'affichait en IDENTIFIANT BRUT (« SECRETAIRE_COMPTABLE ») au lieu du
//    libellé métier. Le backend renvoie désormais roleLabel — ce helper est
//    le filet de sécurité frontend (libellé manquant → formatage propre :
//    suffixe de niveau retiré, underscores → espaces, capitalisation).
function formatChatRoleLabel(role?: string | null): string {
  if (!role) return '';
  const raw = String(role).trim();
  if (!raw) return '';
  const base = raw.toUpperCase().replace(/_(MAT_PRI|MAT|PRI|SEC|GEN|EN)$/i, '');
  const known: Record<string, string> = {
    SECRETAIRE_COMPTABLE: 'Secrétaire comptable',
    SECRETAIRE: 'Secrétaire',
    SURVEILLANT: 'Surveillant',
    SURVEILLANT_GENERAL: 'Surveillant général',
    CENSEUR: 'Censeur',
    COMPTABLE: 'Comptable',
    ENSEIGNANT: 'Enseignant',
    PROMOTEUR: 'Promoteur',
    PROMOTER: 'Promoteur',
    DIRECTEUR: 'Directeur',
    DIRECTEUR_ETABLISSEMENT: 'Directeur',
    DIRECTEUR_GENERAL: 'Directeur général',
    DIRECTEUR_PEDAGOGIQUE: 'Directeur pédagogique',
    PARENT: "Parent d'élève",
    ELEVE: 'Élève',
    STUDENT: 'Élève',
  };
  if (known[base]) return known[base];
  // Formatage générique : SECRETARY_GENERAL → « Secretary general »
  return base
    .toLowerCase()
    .split('_')
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// ⭐ FIX: Strip HTML tags from content for previews (reply quote, forward modal, notifications)
//    Converts <div>/<br> to newlines, removes other tags, decodes entities.
function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<div[^>]*>/g, '\n')
    .replace(/<\/div>/g, '')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * ⭐ DISCORD PARITY — Slash commands parser.
 *
 * Discord supports /me, /shrug, /tableflip, /tts, /poll, /announce, etc.
 * Helm Connect implements a subset:
 *   /me <action>         → *<action>* (italic, like IRC/Discord /me)
 *   /shrug [text]        → text ¯\_(ツ)_/¯
 *   /tableflip [text]    → text (╯°□°)╯︵ ┻━┻
 *   /unflip [text]       → text ┬─┬ ノ( ゜-゜ノ)
 *   /lenny [text]        → text ( ͡° ͜ʖ ͡°)
 *   /poll <question>     → opens the poll modal (returns null, special signal)
 *   /announce <text>     → opens the announcement modal (returns null, special signal)
 *   /spoiler <text>      → ||text||
 *   /code <text>         → `text`
 *   /clear               → clears the messages (special signal, returns '__CLEAR__')
 *
 * Returns:
 *   - { content: string, isCommand: true } if a slash command was parsed
 *   - { content: original, isCommand: false } if not a slash command
 *   - { special: 'poll' | 'announce' | 'clear' } for special-handling commands
 */
function parseSlashCommand(input: string): { content?: string; isCommand: boolean; special?: 'poll' | 'announce' | 'clear' } {
  const text = input.replace(/<[^>]*>/g, '').trim();
  if (!text.startsWith('/')) return { isCommand: false };

  const spaceIdx = text.indexOf(' ');
  const cmd = (spaceIdx === -1 ? text : text.substring(0, spaceIdx)).toLowerCase();
  const arg = spaceIdx === -1 ? '' : text.substring(spaceIdx + 1).trim();

  switch (cmd) {
    case '/me':
      if (!arg) return { isCommand: true, content: '<i>fait quelque chose</i>' };
      return { isCommand: true, content: `<i>${escapeHtml(arg)}</i>` };
    case '/shrug':
      return { isCommand: true, content: arg ? `${escapeHtml(arg)} ¯\\_(ツ)_/¯` : '¯\\_(ツ)_/¯' };
    case '/tableflip':
      return { isCommand: true, content: arg ? `${escapeHtml(arg)} (╯°□°)╯︵ ┻━┻` : '(╯°□°)╯︵ ┻━┻' };
    case '/unflip':
      return { isCommand: true, content: arg ? `${escapeHtml(arg)} ┬─┬ ノ( ゜-゜ノ)` : '┬─┬ ノ( ゜-゜ノ)' };
    case '/lenny':
      return { isCommand: true, content: arg ? `${escapeHtml(arg)} ( ͡° ͜ʖ ͡°)` : '( ͡° ͜ʖ ͡°)' };
    case '/spoiler':
      return { isCommand: true, content: `||${escapeHtml(arg)}||` };
    case '/code':
      return { isCommand: true, content: `\`${escapeHtml(arg)}\`` };
    case '/poll':
      return { isCommand: true, special: 'poll' };
    case '/announce':
      return { isCommand: true, special: 'announce' };
    case '/clear':
      return { isCommand: true, special: 'clear' };
    case '/help': {
      // ⭐ 2026-10-14 — /help (porté de Yeshua Connect) — affiche l'aide des commandes.
      //    On génère la liste à partir de HELM_COMMANDS pour rester synchro avec le popover.
      const helpText = HELM_COMMANDS
        .map((c) => `${c.icon} /${c.name}${c.usage.replace('/' + c.name, '') ? ' ' + c.usage.replace('/' + c.name, '').trim() : ''} — ${c.description}`)
        .join('\n');
      return { isCommand: true, content: helpText };
    }
    default:
      // Unknown slash command — send as regular text (Discord does the same)
      return { isCommand: false };
  }
}

/** Minimal HTML escaper for slash command output safety. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * ⭐ DISCORD PARITY — Role-based color on usernames in group messages.
 *
 * Discord assigns a color to each role (e.g. "Admin" = red, "Moderator" = green).
 * Helm Connect applies the same concept: the sender's role (raw DB role string
 * like 'DIRECTOR', 'TEACHER', 'PARENT', or a roleLabel like "Directeur",
 * "Enseignant", "Parent", "Secrétaire-Comptable") is mapped to a color that
 * is applied to the sender's name in group conversations.
 *
 * The backend `chat.service.ts` populates `sender.role` (raw DB role) but NOT
 * `sender.roleLabel`. So this function must handle BOTH formats:
 *   - Raw role: 'DIRECTOR', 'TEACHER', 'PARENT', 'SECRETARY', etc.
 *   - Label: 'Directeur', 'Enseignant', 'Parent', 'Secrétaire-Comptable', etc.
 *
 * Colors are chosen to be readable on white message bubbles.
 */
// ⭐ V4 Phase 2 (porté de Yeshua Connect) — Couleur de bulle STABLE par
//    utilisateur (hash djb2 + palette 8 teintes). Dans les conversations de
//    groupe, chaque membre a sa teinte de fond — identification visuelle
//    instantanée façon Discord/WhatsApp. Palette accordée à Helm (fond
//    légèrement coloré pour les messages des AUTRES, le mien reste bleu).
const USER_BUBBLE_COLORS = [
  'bg-[#EFF6FF] border-[#DBEAFE]',     // bleu clair
  'bg-[#F0FDF4] border-[#DCFCE7]',     // vert clair
  'bg-[#FFF7ED] border-[#FFEDD5]',     // orange clair
  'bg-[#FDF4FF] border-[#FAE8FF]',     // violet clair
  'bg-[#ECFEFF] border-[#CFFAFE]',     // cyan clair
  'bg-[#FEF9C3] border-[#FEF08A]',     // jaune clair
  'bg-[#FDF2F8] border-[#FBCFE8]',     // rose clair
  'bg-[#F5F5F4] border-[#E7E5E4]',     // pierre clair
];

/** ⭐ V5 (parité Yeshua) — couleurs SIGNATURE (texte/avatar) : teintes franches
 *    associées au même hash djb2 que les bulles — nom + avatar identifiés
 *    instantanément, façon Discord/Telegram. Palette accordée à Helm. */
const USER_TEXT_COLORS = [
  '#0958D9', // bleu Helm
  '#059669', // vert
  '#D97706', // ambre
  '#7C3AED', // violet
  '#0891B2', // cyan
  '#CA8A04', // jaune doré
  '#DB2777', // rose
  '#57534E', // pierre
];

/** Hash djb2 → index stable dans la palette (même logique que Yeshua). */
function hashUserId(userId: string): number {
  let h = 5381;
  for (let i = 0; i < userId.length; i++) {
    h = ((h << 5) + h + userId.charCodeAt(i)) >>> 0;
  }
  return h % USER_BUBBLE_COLORS.length;
}

/** ⭐ V5 (parité Yeshua) — Durée d'appel lisible façon WhatsApp :
 *  45 s → « 45 s » · 192 s → « 3 min 12 s » · 7 200 s → « 2 h 0 min ». */
function formatCallDurationFr(sec?: number | null): string {
  if (!sec || sec <= 0) return '';
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s > 0 ? `${m} min ${s} s` : `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

/** ⭐ V5 (parité Yeshua — Plan C des grands appels de groupe) — room Jitsi
 *    DÉTERMINISTE (même room pour tous les participants d'un même appel,
 *    sans configuration serveur) quand la chaîne LiveKit→Agora→Daily est
 *    épuisée ET que le mesh WebRTC (≤ 5) est dépassé. */
function jitsiRoomFor(kind: 'call' | 'voice', id: string): string {
  return `helm-connect-${kind}-${id}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}
function jitsiUrlFor(room: string, displayName: string): string {
  return `https://meet.jit.si/${room}#config.prejoinPageEnabled=false&userInfo.displayName=%22${encodeURIComponent(displayName)}%22`;
}

/** ⭐ V5 (parité Yeshua — indispensable derrière les CGNAT des réseaux
 *  mobiles) — serveurs ICE pour le mesh WebRTC : STUN Google ×3 + TURN
 *  public Open Relay, surchargeables via NEXT_PUBLIC_TURN_*. */
function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    {
      urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ];
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME || undefined,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || undefined,
    });
  }
  return servers;
}

/** ⭐ V4 Phase 3 — URL absolue du backend (fini les URLS en dur
 *  https://api.academiahelm.com éparpillées) : une seule source de vérité. */
function getBackendBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  // ⭐ V5 — FIX auto-récursion (stack overflow) : valeur de repli explicite
  //    plutôt qu'un appel récursif infini quand la variable d'env est absente.
  return 'https://api.academiahelm.com';
}

function getRoleColor(roleOrLabel: string | undefined): string {
  if (!roleOrLabel) return '#0958D9'; // default Helm blue
  const v = roleOrLabel.toLowerCase();
  // School administration — warm/red tones
  if (v.includes('directeur') || v.includes('directrice') || v.includes('director') || v.includes('promoteur') || v.includes('promoter')) return '#DC2626'; // red-600
  if (v.includes('censeur') || v.includes('surveillant') || v.includes('surveillance')) return '#D97706'; // amber-600
  if (v.includes('comptable') || v.includes('compt') || v.includes('économ') || v.includes('econome') || v.includes('intendant')) return '#059669'; // emerald-600
  if (v.includes('secrétaire') || v.includes('secretaire') || v.includes('secretary')) return '#0891B2'; // cyan-600
  if (v.includes('scolarit')) return '#7C3AED'; // violet-600
  // Teachers — blue tones
  if (v.includes('enseignant') || v.includes('professeur') || v.includes('maître') || v.includes('maitre') || v.includes('teacher')) return '#2563EB'; // blue-600
  // Parents — green tones
  if (v.includes('parent') || v.includes('tuteur') || v.includes('guardian')) return '#16A34A'; // green-600
  // Students — purple
  if (v.includes('élève') || v.includes('eleve') || v.includes('étudiant') || v.includes('etudiant') || v.includes('student')) return '#9333EA'; // purple-600
  // Platform roles — slate
  if (v.includes('platform') || v.includes('super') || v.includes('admin') && !v.includes('administration')) return '#475569'; // slate-600
  return '#0958D9'; // default Helm blue
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────

export default function WhatsAppChat({ currentUserId, readOnly = false, heightClass }: WhatsAppChatProps) {
  const isReadOnly = readOnly; // ⭐ Alias for message action rendering
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ⭐ PAGINATION — "Load more" older messages (Discord-like)
  //    Backend supports ?before=<messageId>&limit=50 cursor pagination.
  //    hasMore=false when the backend returns fewer than `limit` messages
  //    (meaning we've reached the beginning of the conversation).
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // ⭐ DRAG & DROP — file upload by dragging files onto the chat area
  const [isDragOver, setIsDragOver] = useState(false);

  // ⭐ MENTIONS — @user autocomplete state
  //    When the user types @, we show a popover with matching participants.
  //    Selecting a participant inserts @FirstName into the message and
  //    records the mention so the backend can send a push notification.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStartPos, setMentionStartPos] = useState<number>(-1);
  // ⭐ V5 (parité Yeshua) — index sélectionné pour la navigation clavier (↑/↓/Tab/Entrée/Échap)
  const [mentionSelectedIdx, setMentionSelectedIdx] = useState(0);
  useEffect(() => { setMentionSelectedIdx(0); }, [mentionQuery]);

  // ⭐ ROLE-BASED CATEGORY FILTER (Tout / Enseignants / Parents / Administration)
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // ⭐ PRESENCE (online/offline) + TYPING + AUDIO RECORDING
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<{ userId: string; firstName?: string; lastName?: string }[]>([]);
  // ⭐ AUDIO RECORDING — state machine: IDLE → RECORDING → PAUSED → PREVIEW
  //    - RECORDING: timer running, user can pause OR stop & preview
  //    - PAUSED: timer paused, user can resume OR stop & preview
  //    - PREVIEW: shows audio player + send/cancel buttons
  type RecordingState = 'idle' | 'recording' | 'paused' | 'preview';
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);  // seconds recorded
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingPingRef = useRef<number>(0);
  // ⭐ Compat: keep isRecording boolean for old code that checks it
  const isRecording = recordingState === 'recording' || recordingState === 'paused';

  // ⭐ V3-11: Discord-like 12-section navigation state.
  //   The far-left icon rail switches between sections. Each section
  //   changes the conversation list content (Discussions/Communautés/Canaux/...)
  //   or opens a modal (Annonces/Recherche/Notifications/Paramètres).
  type HelmSection =
    | 'discussions' | 'communautes' | 'annonces' | 'canaux' | 'fichiers'
    | 'vocaux' | 'appels' | 'notifications' | 'recherche' | 'moderation'
    | 'analytics' | 'parametres';
  const [activeHelmSection, setActiveHelmSection] = useState<HelmSection>('discussions');

  // ⭐ V3-11: Multi-select conversations for bulk deletion.
  //   - selectionMode: true when the user has entered selection mode (long-press
  //     or shift+click on a conversation, or via a toolbar button)
  //   - selectedConvIds: set of conversation IDs that are currently selected
  //   - When in selection mode, clicking a conversation toggles its selection
  //     instead of opening it. A floating action bar at the bottom of the
  //     sidebar lets the user delete the selected conversations (delete-for-me
  //     hides them locally; delete-all calls the backend to archive them).
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());

  const toggleConversationSelection = useCallback((convId: string) => {
    setSelectedConvIds(prev => {
      const next = new Set(prev);
      if (next.has(convId)) {
        next.delete(convId);
      } else {
        next.add(convId);
      }
      // If we just deselected the last one, exit selection mode
      if (next.size === 0) {
        setSelectionMode(false);
      }
      return next;
    });
  }, []);

  const enterSelectionMode = useCallback((convId: string) => {
    setSelectionMode(true);
    setSelectedConvIds(new Set([convId]));
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedConvIds(new Set());
  }, []);

  const selectAllConversations = useCallback(() => {
    setSelectedConvIds(new Set(conversations.map(c => c.id)));
  }, [conversations]);

  // ⭐ V3-11: Delete selected conversations (delete-for-me = hide locally).
  //   We hide them from the conversations array in local state + persist the
  //   hidden IDs in localStorage so they stay hidden on reload.
  const hiddenConversationsKey = `helm_connect_hidden_conv_${currentUserId}`;
  const [hiddenConvIds, setHiddenConvIds] = useState<Set<string>>(new Set());

  // Load hidden conversation IDs from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(hiddenConversationsKey);
      if (stored) {
        setHiddenConvIds(new Set(JSON.parse(stored)));
      }
    } catch { /* silent */ }
  }, [hiddenConversationsKey]);

  const deleteSelectedConversations = useCallback(async (mode: 'me' | 'all') => {
    if (selectedConvIds.size === 0) return;
    const idsToDelete = Array.from(selectedConvIds);
    if (mode === 'me') {
      // Hide locally — add to hiddenConvIds + persist to localStorage
      const newHidden = new Set([...hiddenConvIds, ...idsToDelete]);
      setHiddenConvIds(newHidden);
      try {
        localStorage.setItem(hiddenConversationsKey, JSON.stringify(Array.from(newHidden)));
      } catch { /* silent */ }
      toast.success(`${idsToDelete.length} conversation(s) supprimée(s) pour vous`);
    } else {
      // 'all' — try to archive via backend (best effort)
      try {
        await Promise.all(idsToDelete.map(id =>
          fetch(`/api/chat/conversations/${id}`, { method: 'DELETE', credentials: 'include' }).catch(() => {})
        ));
        toast.success(`${idsToDelete.length} conversation(s) supprimée(s) pour tous`);
      } catch {
        toast.error('Échec de la suppression pour tous');
      }
    }
    // Clear selection + reload conversations
    exitSelectionMode();
    // Remove from local state immediately
    setConversations(prev => prev.filter(c => !idsToDelete.includes(c.id)));
  }, [selectedConvIds, hiddenConvIds, hiddenConversationsKey, exitSelectionMode]);

  // ⭐ V3-11: visibleConversations — conversations with hidden ones filtered out.
  //   Used everywhere we render the conversation list. The `conversations` state
  //   still holds the full list (so we can restore hidden ones if needed), but
  //   the UI only shows the non-hidden subset.
  const visibleConversations = useMemo(
    () => conversations.filter(c => !hiddenConvIds.has(c.id)),
    [conversations, hiddenConvIds]
  );

  // Modals
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  // ⭐ V5 — quit du groupe courant (endpoint conversations/:id/leave)
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  // ⭐ Helm Connect — Annonces officielles V1
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  // ⭐ Helm Connect V2.3 — Notification Preferences
  const [showNotifPrefs, setShowNotifPrefs] = useState(false);
  // ⭐ DISCORD PARITY: Member list sidebar (right panel for GROUP conversations)
  const [showMemberList, setShowMemberList] = useState(false);
  const [conversationMembers, setConversationMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  // ⭐ V5 (parité Yeshua) — fiche membre (clic sur un membre) + blocages +
  //    onglet Inviter du panneau des membres
  const [memberProfile, setMemberProfile] = useState<any | null>(null);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [memberPanelTab, setMemberPanelTab] = useState<'members' | 'invite' | 'gestion'>('members');
  const [invitableUsers, setInvitableUsers] = useState<any[]>([]);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  // ⭐ DISCORD PARITY: Audit log modal
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  // ⭐ DISCORD PARITY: Slow mode modal
  const [showSlowModeModal, setShowSlowModeModal] = useState(false);
  const [slowModeSeconds, setSlowModeSeconds] = useState(0);
  // ⭐ V6 (spec §3/§17) — GESTION DES MEMBRES par les admins de conversation :
  //    menu d'actions par membre (rôle, exclure, bannir, muet) + onglet Gestion
  //    (mode lent + journal d'audit). Le backend existait, l'UI était absente.
  const [memberActionUserId, setMemberActionUserId] = useState<string | null>(null);
  // ⭐ DISCORD PARITY: Emoji picker popover
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // ⭐ DISCORD PARITY: GIF picker (Tenor API)
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearchQuery, setGifSearchQuery] = useState('');
  const [gifResults, setGifResults] = useState<any[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  // ⭐ DISCORD PARITY: Sticker picker
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [stickerPacks, setStickerPacks] = useState<any[]>([]);
  const [activeStickerPack, setActiveStickerPack] = useState<string | null>(null);
  const [stickers, setStickers] = useState<any[]>([]);
  // ⭐ DISCORD PARITY: Voice channels panel
  const [voiceChannels, setVoiceChannels] = useState<any[]>([]);
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<string | null>(null);
  const [voiceChannelUsers, setVoiceChannelUsers] = useState<any[]>([]);
  // ⭐ Helm Connect V2.4 — Global Search
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  // ⭐ Helm Connect V2.6 — Categorized Attachment Menu (Documents/Images/Videos/Poll/Audio)
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  // ⭐ V3-3 — ORION-powered conversation summary
  const [showSummary, setShowSummary] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);
  // ⭐ V3-2 — Whisper transcription state
  const [transcribingMsgId, setTranscribingMsgId] = useState<string | null>(null);
  const [transcriptions, setTranscriptions] = useState<Record<string, string>>({});
  // ⭐ V3-6 — Group call state
  const [showGroupCallModal, setShowGroupCallModal] = useState(false);
  const [groupCallParticipants, setGroupCallParticipants] = useState<Set<string>>(new Set());
  // Peer connections for group calls — Map<userId, RTCPeerConnection>
  const groupPeerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const groupRemoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const [groupCallActive, setGroupCallActive] = useState(false);
  const [groupCallData, setGroupCallData] = useState<{ callId: string; callType: 'AUDIO' | 'VIDEO'; conversationId: string; isInitiator: boolean; participants: Map<string, { name: string; stream?: MediaStream }> } | null>(null);
  // ⭐ Helm Connect V2.6 — Poll creation modal
  const [showPollModal, setShowPollModal] = useState(false);
  // ⭐ 2026-10-14 — Slash commands popover (porté de Yeshua Connect)
  //    Affiché au-dessus du RichTextEditor quand l'utilisateur tape "/". Navigation
  //    clavier ↑↓/Enter/Échap via le composant SlashCommandsPopover.
  const [showSlashPopover, setShowSlashPopover] = useState(false);
  // ⭐ 2026-10-14 — Fallback WebRTC P2P 1-à-1 (porté de Yeshua Connect)
  //    Activé quand la chaîne média LiveKit/Agora/Daily échoue (CFNAT, key
  //    expirée, etc.). Le hook gère la signalisation via /api/chat/calls/webrtc.
  const p2pCall = useP2PCall();
  // ⭐ 2026-10-14 — P2P fallback activé pour l'appel courant (pour affichage UI)
  const [p2pFallbackActive, setP2pFallbackActive] = useState(false);
  // ⭐ Helm Connect V2.7 — Format toolbar + reply-to-message + message actions
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<{ id: string; senderName: string; content: string } | null>(null);

  // ⭐ V1.5: Forward modal state + inline edit state
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // ⭐ V1.5: Quick-reaction emoji bar (shown on LONG-PRESS or right-click — WhatsApp style)
  const [showReactionBar, setShowReactionBar] = useState<string | null>(null);
  const [reactionBarPos, setReactionBarPos] = useState<{ x: number; y: number } | null>(null);
  // ⭐ V3-11: Reactions — keep real emojis for chat reactions (essential for chat UX).
  //   Lucide icons are used for UI menus/navigation only, NOT for chat reactions.
  //   The emoji string is the reaction ID stored in the backend.
  const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  /// ⭐ V3-11: Render a reaction emoji (used by both the quick bar and the bubble display).
  /// Always renders the original emoji — emojis are essential in chat contexts.
  const renderReactionIcon = (emoji: string, size: number = 14) => {
    return <span style={{ fontSize: size }}>{emoji}</span>;
  };
  // ⭐ FIX: Action menu state — React-driven instead of display:none toggle (so click-outside closes it)
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<string | null>(null);
  // ⭐ FIX: Long-press timer for mobile reaction bar
  const longPressTimerRef = useRef<any>(null);

  // ⭐ GAP FILL: In-conversation search
  const [showConvSearch, setShowConvSearch] = useState(false);
  const [convSearchQuery, setConvSearchQuery] = useState('');
  const [convSearchResults, setConvSearchResults] = useState<any[]>([]);
  // ⭐ V5 (parité Yeshua) — bannière des messages épinglés + liste déroulante
  const [showPinnedList, setShowPinnedList] = useState(false);
  const pinnedMessages = useMemo(
    () => messages.filter((m: any) => m.isPinned),
    [messages]
  );
  // ⭐ V5 (parité Yeshua — THREADS) — fil de discussion latéral sur un
  //    message : panneau droit listant les réponses (replyToId = parent) +
  //    saisie dédiée + badge « N réponses » sur la bulle parent.
  const [threadParentId, setThreadParentId] = useState<string | null>(null);
  const [threadDraft, setThreadDraft] = useState('');
  const threadParent = useMemo(
    () => messages.find(m => m.id === threadParentId) || null,
    [messages, threadParentId]
  );
  const threadReplies = useMemo(
    () => messages.filter((m: any) => m.replyToId === threadParentId),
    [messages, threadParentId]
  );
  const replyCountByParent = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of messages as any[]) {
      if (m.replyToId) counts[m.replyToId] = (counts[m.replyToId] || 0) + 1;
    }
    return counts;
  }, [messages]);
  // ⭐ V5 — aperçu compact d'un message épinglé (texte strippé ou type média)
  const pinnedPreview = (m: any): string => {
    const t = String(m.type || 'TEXT');
    if (t === 'AUDIO') return '🎤 Message vocal';
    if (t === 'IMAGE') return '📷 Photo';
    if (t === 'VIDEO') return '🎥 Vidéo';
    if (t === 'DOCUMENT') return `📎 ${m.attachmentName || 'Document'}`;
    if (t === 'POLL') return '📊 Sondage';
    if (t === 'CALL_LOG') return '📞 Appel';
    if (t === 'STICKER') return '🏷️ Sticker';
    const txt = stripHtml(m.content || '').trim();
    return txt ? txt.substring(0, 60) + (txt.length > 60 ? '…' : '') : 'Message';
  };
  const handleConvSearch = async (q: string) => {
    setConvSearchQuery(q);
    if (q.trim().length < 2) { setConvSearchResults([]); return; }
    try {
      const res = await fetch(`/api/chat/conversations/${activeConvId}/search?userId=${currentUserId}&q=${encodeURIComponent(q)}`, { credentials: 'include' });
      if (res.ok) setConvSearchResults(await res.json());
    } catch {}
  };

  // ⭐ GAP FILL: User profile modal + status selector
  const [profileUser, setProfileUser] = useState<{ userId: string; name: string } | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [myStatus, setMyStatus] = useState<string>('online');

  const handleOpenProfile = async (userId: string, name: string) => {
    setProfileUser({ userId, name });
    try {
      const res = await fetch(`/api/chat/profile/${userId}`, { credentials: 'include' });
      if (res.ok) setProfileData(await res.json());
    } catch {}
  };

  const handleUpdateMyStatus = async (status: string) => {
    setMyStatus(status);
    try {
      await fetch('/api/chat/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, availabilityStatus: status }),
        credentials: 'include',
      });
      toast.success(`Statut: ${status === 'online' ? 'En ligne' : status === 'away' ? 'Absent' : status === 'dnd' ? 'Ne pas déranger' : 'Hors ligne'}`);
    } catch {}
  };

  const handleReportMessage = async (messageId: string) => {
    try {
      await fetch(`/api/chat/messages/${messageId}/report`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reporterId: currentUserId, reason: 'Message inapproprié' }),
        credentials: 'include',
      });
      toast.success('Message signalé à l\'administration');
    } catch (e: any) { toast.error('Échec: ' + e.message); }
  };

  // ⭐ V3-3: ORION-powered conversation summary — call POST /chat/conversations/:id/summarize
  const handleSummarizeConversation = async () => {
    if (!activeConvId) return;
    setShowSummary(true);
    setSummaryLoading(true);
    setSummaryData(null);
    try {
      const res = await fetch(`/api/chat/conversations/${activeConvId}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, maxMessages: 50 }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to summarize conversation');
      const data = await res.json();
      setSummaryData(data);
    } catch (e: any) {
      toast.error('Échec du résumé: ' + e.message);
      setShowSummary(false);
    } finally {
      setSummaryLoading(false);
    }
  };

  // ⭐ V3-2: Whisper transcription — call POST /chat/messages/:id/transcribe
  const handleTranscribeMessage = async (messageId: string) => {
    // Si déjà transcrit dans le state → ne pas re-demander
    if (transcriptions[messageId]) {
      toast.success('Transcription déjà disponible', { description: transcriptions[messageId].substring(0, 200) + (transcriptions[messageId].length > 200 ? '...' : '') });
      return;
    }
    setTranscribingMsgId(messageId);
    try {
      const res = await fetch(`/api/chat/messages/${messageId}/transcribe`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to transcribe audio');
      const data = await res.json();
      if (data.transcription) {
        setTranscriptions(prev => ({ ...prev, [messageId]: data.transcription }));
        toast.success('Transcription disponible', {
          description: data.transcription.substring(0, 300) + (data.transcription.length > 300 ? '...' : ''),
        });
      } else {
        toast.error('Aucune transcription disponible');
      }
    } catch (e: any) {
      toast.error('Échec de la transcription: ' + e.message);
    } finally {
      setTranscribingMsgId(null);
    }
  };

  // ⭐ GAP FILL: Delivered receipt — 3 states (✓ sent, ✓✓ gray delivered, ✓✓ blue read)
  const getReceiptIcon = (msg: any, isMine: boolean) => {
    if (!isMine) return null;
    if (msg.readBy && msg.readBy.length > 0) {
      return <CheckCheck className="w-3 h-3 text-blue-300" />; // ✓✓ blue = read
    }
    if (msg.deliveredAt) {
      return <CheckCheck className="w-3 h-3 text-slate-400" />; // ✓✓ gray = delivered
    }
    return <Check className="w-3 h-3" />; // ✓ single = sent
  };
  // ⭐ Issue 1 — Custom confirmation modal (replaces native confirm())
  const { danger, warning, dialog: confirmDialogEl } = useConfirmDialog();
  // ⭐ Issue 3 — Document/image preview modal (Telegram/WhatsApp style)
  const [previewDoc, setPreviewDoc] = useState<{ filePath: string; fileName: string; mimeType: string } | null>(null);

  // ⭐ V2.5: WebRTC call state
  const [callState, setCallState] = useState<'idle' | 'outgoing' | 'incoming' | 'active'>('idle');
  const [callData, setCallData] = useState<{ callId: string; callType: 'AUDIO' | 'VIDEO'; otherUserId: string; otherUserName: string } | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  // ⭐ DISCORD PARITY: Screen sharing state
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  // ⭐ V6 — repli JITSI (Plan C des grands appels de groupe) : déclaré TÔT
  //    (avant l'effet sonnerie qui l'utilise pour couper la sonnerie en
  //    mode secours — parité Yeshua !jitsiRoom).
  const [jitsiFallback, setJitsiFallback] = useState<{ room: string; title: string } | null>(null);
  const ringtoneRef = useRef<{
    ctx: AudioContext | null;
    interval: ReturnType<typeof setInterval> | null;
    audioEl: HTMLAudioElement | null;
  } | null>(null);
  // ⭐ V5 (parité Yeshua) — vibration mobile en boucle pendant la sonnerie
  const vibrateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ⭐ V4 (porté de Yeshua Connect) — CHAÎNE MÉDIA LiveKit → Agora → Daily :
  //    mediaSessionRef détient la session SFU courante, les participants
  //    normalisés alimentent la grille de l'overlay unifié, activeSpeakers
  //    pilote l'anneau doré, mediaProvider le badge « Réseau : … ».
  const mediaSessionRef = useRef<MediaSessionHandle | null>(null);
  const [mediaParticipants, setMediaParticipants] = useState<HcRemoteParticipant[]>([]);
  const [activeSpeakers, setActiveSpeakers] = useState<Set<string>>(new Set());
  const [mediaProvider, setMediaProvider] = useState<MediaProviderName | 'mesh' | null>(null);
  const [mediaSwitching, setMediaSwitching] = useState(false);
  // Signalisation V4 (chat_call_signals) — source de vérité des appels :
  // signalCallId = l'appel courant que J'ai lancé, incomingSignal = l'appel
  // qui sonne chez moi (socket call:incoming + polling 3 s de secours).
  const [v4CallInfo, setV4CallInfo] = useState<CallSessionInfo | null>(null);
  const [signalCallId, setSignalCallId] = useState<string | null>(null);
  const [incomingSignal, setIncomingSignal] = useState<any | null>(null);
  // ⭐ V5 (parité Yeshua) — issue d'appel affichée 2 s dans l'overlay AVANT la
  //    fermeture (« Appel refusé / Pas de réponse / Appel annulé / Appel
  //    terminé · 3 min 12 s ») au lieu d'un simple toast.
  const [callEndStatus, setCallEndStatus] = useState<{ status: string; durationSec?: number } | null>(null);
  // ⭐ V5 (parité Yeshua) — appels de groupe refusés localement : ne jamais
  //    re-sonner pour ces callId (le signal continue pour les autres membres).
  const declinedCallIdsRef = useRef<Set<string>>(new Set());
  // ⭐ V5 (parité Yeshua) — bascule chaude de fournisseur par convergence du
  //    polling statut : si le serveur a failoveré l'appel, on bascule aussi.
  const mediaProviderRef = useRef<MediaProviderName | 'mesh' | null>(null);
  mediaProviderRef.current = mediaProvider;
  const mediaFailoverInFlightRef = useRef(false);
  // Refs stables pour les callbacks de session média (évitent les re-créations)
  const callStateRef = useRef(callState);
  callStateRef.current = callState;
  const failoverAttemptsRef = useRef(0);
  // ⭐ V4 Phase 3 — ref stable de la conversation ouverte (listeners socket)
  const activeConvIdRef = useRef<string | null>(null);
  activeConvIdRef.current = activeConvId;
  // ⭐ V5 — ref stable des conversations (titre des notifications natives)
  const conversationsRef = useRef<any[]>([]);
  conversationsRef.current = conversations;

  // ⭐ V6 — RINGTONES IDENTIQUES À YESHUA CONNECT (demande explicite) :
  //    Sonnerie ENTRANTE (audio ET vidéo) = bi-bip WebAudio synthétisé de
  //      Yeshua (IncomingCallOverlay) : deux bursts sinusoïdaux 880 Hz puis
  //      660 Hz (offset 0 / 0,45 s), enveloppe exponentielle 0,001 → 0,25 →
  //      0,001 sur 0,4 s, répétés toutes les 2 s. Vibration 400 ms / 2 s.
  //    Sonnerie SORTANTE (audio ET vidéo) = le FICHIER ringback.wav de Yeshua
  //      (public/sounds/ringback.wav, copie octet-octet) joué en boucle à
  //      volume 0,5 — exactement <audio src="/sounds/ringback.wav" loop>.
  //    Comme dans Yeshua : même son pour l'audio et la vidéo ; pas de sonnerie
  //    en repli Jitsi (Plan C — la visio prend le relais).
  const playRingtone = useCallback((mode: 'outgoing' | 'incoming' = 'outgoing') => {
    if (ringtoneRef.current) return; // Already playing
    try {
      if (mode === 'incoming') {
        // ── Yeshua : bi-bip façon téléphone (880/660 Hz), boucle 2 s ──
        const AC: typeof AudioContext | undefined =
          typeof window !== 'undefined'
            ? (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
            : undefined;
        if (!AC) return; // WebAudio indisponible → sonnerie visuelle
        const ctx = new AC();
        const playBurst = () => {
          try {
            const t0 = ctx.currentTime;
            [0, 0.45].forEach((offset) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.value = offset === 0 ? 880 : 660;
              gain.gain.setValueAtTime(0.001, t0 + offset);
              gain.gain.exponentialRampToValueAtTime(0.25, t0 + offset + 0.03);
              gain.gain.exponentialRampToValueAtTime(0.001, t0 + offset + 0.38);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start(t0 + offset);
              osc.stop(t0 + offset + 0.4);
            });
          } catch { /* contexte fermé */ }
        };
        ctx.resume().then(() => playBurst()).catch(() => { /* autoplay bloqué → tap pour activer */ });
        const interval = setInterval(playBurst, 2000);
        ringtoneRef.current = { ctx, interval, audioEl: null };
      } else {
        // ── Yeshua : ringback.wav (ringback télécom réel), boucle, volume 0,5 ──
        const audioEl = new Audio('/sounds/ringback.wav');
        audioEl.preload = 'auto';
        audioEl.loop = true;
        audioEl.volume = 0.5;
        audioEl.play().catch(() => { /* ignore autoplay-blocked */ });
        ringtoneRef.current = { ctx: null, interval: null, audioEl };
      }
    } catch (e) {
      console.warn('Ringtone playback failed:', e);
    }
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneRef.current) {
      if (ringtoneRef.current.interval) clearInterval(ringtoneRef.current.interval);
      if (ringtoneRef.current.audioEl) {
        try { ringtoneRef.current.audioEl.pause(); } catch {}
        try { ringtoneRef.current.audioEl.currentTime = 0; } catch {}
      }
      try { ringtoneRef.current.ctx?.close(); } catch {}
      ringtoneRef.current = null;
    }
  }, []);

  // ⭐ FIX: Play/stop ringtone based on call state — different sounds for caller vs callee
  // ⭐ V5 — couvre AUSSI les appels entrants V4 (chat_call_signals) : callState
  //    reste 'idle' dans ce flux, donc la sonnerie doit se déclencher sur
  //    incomingSignal. Remplace le composant <IncomingSignalRingtone /> qui
  //    n'existait pas (→ ReferenceError → écran blanc à chaque appel entrant).
  //    + vibration en boucle (400 ms / 2 s) + notification navigateur si la
  //    page est en arrière-plan + reprise audio au premier tap (autoplay).
  useEffect(() => {
    const resumeAudio = () => {
      try { ringtoneRef.current?.ctx?.resume(); } catch {}
      try { ringtoneRef.current?.audioEl?.play().catch(() => {}); } catch {}
    };
    // ⭐ V6 (parité Yeshua) : PAS de sonnerie sortante en repli Jitsi (Plan C —
    //    la visio prend le relais, la musique se changerait en cacophonie).
    if (callState === 'outgoing' && !jitsiFallback) {
      playRingtone('outgoing');
    } else if (callState === 'incoming' || incomingSignal) {
      playRingtone('incoming');
      try { navigator.vibrate?.(400); } catch {}
      if (vibrateIntervalRef.current) clearInterval(vibrateIntervalRef.current);
      vibrateIntervalRef.current = setInterval(() => {
        try { navigator.vibrate?.(400); } catch {}
      }, 2000);
      // Notification navigateur quand la page est cachée (parité Yeshua)
      if (typeof document !== 'undefined' && document.hidden &&
          typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const who = incomingSignal?.initiatorName || incomingSignal?.convName || 'Quelqu\u2019un';
          new Notification(`${who} vous appelle`, {
            body: `${incomingSignal?.callType === 'video' ? 'Appel vidéo' : 'Appel audio'}${incomingSignal?.convName ? ` · ${incomingSignal.convName}` : ''}`,
            tag: `helm-call-${incomingSignal?.callId || 'x'}`,
          });
        } catch { /* ignore */ }
      }
      // Reprise audio au premier tap (autoplay bloqué sur mobile)
      document.addEventListener('pointerdown', resumeAudio, { once: true });
    } else {
      stopRingtone();
    }
    return () => {
      stopRingtone();
      document.removeEventListener('pointerdown', resumeAudio);
      if (vibrateIntervalRef.current) {
        clearInterval(vibrateIntervalRef.current);
        vibrateIntervalRef.current = null;
      }
      try { navigator.vibrate?.(0); } catch {}
    };
  }, [callState, incomingSignal, jitsiFallback, playRingtone, stopRingtone]);

  // ⭐ V5 (parité Yeshua) — demander la permission de notification au 1er
  //    chargement (pour les notifications d'appels et de messages en arrière-plan)
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // ⭐ V5 (parité Yeshua) — BOUTON COPIER des blocs de code : les blocs sont
  //    rendus via innerHTML → délégation d'événement globale sur .code-copy-btn.
  //    Copie le code (data-code encodé URI), affiche « Copié ✓ » 2 s.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement | null)?.closest?.('.code-copy-btn') as HTMLButtonElement | null;
      if (!btn) return;
      const encoded = btn.getAttribute('data-code');
      if (!encoded) return;
      try {
        const text = decodeURIComponent(encoded);
        navigator.clipboard?.writeText(text).then(() => {
          btn.textContent = 'Copié ✓';
          setTimeout(() => { btn.textContent = 'Copier'; }, 2000);
        }).catch(() => toast.error('Copie impossible'));
      } catch { /* ignore */ }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // ⭐ V2.5: Cleanup call resources
  const cleanupCall = useCallback(() => {
    // ⭐ V4 — déconnecter la session média (SFU) + reset de la chaîne
    try { mediaSessionRef.current?.disconnect(); } catch {}
    mediaSessionRef.current = null;
    setMediaParticipants([]);
    setActiveSpeakers(new Set());
    setMediaProvider(null);
    setMediaSwitching(false);
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    // ⭐ FIX: Clear the remote stream ref + detach from video element
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach(t => t.stop());
      remoteStreamRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallState('idle');
    setCallData(null);
    setCallDuration(0);
    setMuted(false);
    setVideoOff(false);
    // ⭐ FIX: Reset speaker to default on
    setSpeakerOn(true);
  }, []);

  // ⭐ V2.5: setupPeerConnection is declared AFTER `socket` to avoid TDZ
  //    (useCallback deps array references `socket` — must be initialized first).
  //    See the block after the socket declaration below.

  // ⭐ V4 Phase 2 — Galerie de médias (porté de Yeshua) + recherche sidebar
  const [showGallery, setShowGallery] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  // ⭐ V5 (parité Yeshua) — sidebar en OVERLAY sur mobile : le bouton retour
  //    DÉPLIE la liste des conversations au lieu de vider le chat.
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // ⭐ V4 — Session média des CANAUX VOCAUX (référence DISTINCTE de celle
  //    des appels : on peut être en canal vocal ET recevoir un appel)
  const voiceSessionRef = useRef<MediaSessionHandle | null>(null);
  const [voiceActiveSpeakers, setVoiceActiveSpeakers] = useState<Set<string>>(new Set());
  const [voiceProvider, setVoiceProvider] = useState<MediaProviderName | 'mesh' | 'jitsi' | null>(null);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceVideoMode, setVoiceVideoMode] = useState(false);
  // ⭐ V5 — participants MÉDIA du canal vocal (grille vidéo en mode vidéo)
  const [voiceMediaParticipants, setVoiceMediaParticipants] = useState<HcRemoteParticipant[]>([]);

  // ⭐ CANAUX (Telegram-style broadcast channels)
  const [channels, setChannels] = useState<any[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [channelMessages, setChannelMessages] = useState<any[]>([]);
  // ⭐ V6 — vue CANAL fonctionnelle (parité Yeshua/spec §6) : les canaux
  //    s'ouvrent comme des conversations — messages + diffusion + abonnement.
  //    (fonctions openChannel/broadcastToChannel/toggleChannelSubscription
  //    définies après loadChannels ci-dessous)
  const [channelInput, setChannelInput] = useState('');
  const [channelSending, setChannelSending] = useState(false);
  const channelMessagesEndRef = useRef<HTMLDivElement>(null);
  const activeChannel = channels.find((ch: any) => ch.id === activeChannelId) || null;
  // ⭐ V6.1 — refs pour les callbacks de canal (le hook socket est mémoïsé
  //    AVANT les déclarations de loadChannels/openChannel ; les refs
  //    évitent les closures périmées et les erreurs TDZ).
  const activeChannelIdRef = useRef<string | null>(null);
  activeChannelIdRef.current = activeChannelId;
  const loadChannelsRef = useRef<(() => void) | null>(null);

  // ⭐ V6 — MUET PAR CONVERSATION (spec §10, parité Yeshua) : 1h/8h/24h/∞.
  //    Backend : POST /chat/v2/notifications/conversations/:id/mute,
  //    /unmute, GET /muted-conversations (déjà implémentés — il manquait l'UI).
  const [mutedConvs, setMutedConvs] = useState<Record<string, { mutedUntil: string | null }>>({});
  const mutedConvsRef = useRef<Record<string, { mutedUntil: string | null }>>({});
  mutedConvsRef.current = mutedConvs;
  const [showMuteMenu, setShowMuteMenu] = useState(false);

  // ⭐ V3-11: Annonces (official announcements list — fetched lazily when the
  //   user switches to the Annonces section, kept in state to avoid refetching)
  const [annonces, setAnnonces] = useState<any[]>([]);
  const [annoncesLoading, setAnnoncesLoading] = useState(false);
  const [annoncesLoaded, setAnnoncesLoaded] = useState(false);

  // ⭐ V3-11: Communautés auto-group sync state
  const [communautesSyncing, setCommunautesSyncing] = useState(false);
  const [communautesSyncMessage, setCommunautesSyncMessage] = useState<string | null>(null);
  // ⭐ V6 (spec — Communautés) : métadonnées des auto-groups (groupType/roleType
  //    par conversation) pour les sous-catégories Classes | Matières |
  //    Enseignants | Parents | Administration | Autres
  const [autoGroupMeta, setAutoGroupMeta] = useState<Record<string, { groupType: string; roleType?: string }>>({});
  const [communauteFilter, setCommunauteFilter] = useState<string>('all');

  // ⭐ V6 — charge les métadonnées auto-groups (avec les nouveaux types
  //    LEVEL « Parents – niveau », TEACHER_SUBJECT « Enseignants de matière »,
  //    COUNCIL « Conseil pédagogique »)
  useEffect(() => {
    if (activeHelmSection !== 'communautes') return;
    let cancelled = false;
    fetch('/api/chat/auto-groups', { credentials: 'include' })
      .then(res => res.ok ? res.json() : [])
      .then((rows: any[]) => {
        if (cancelled) return;
        const map: Record<string, { groupType: string; roleType?: string }> = {};
        for (const r of (Array.isArray(rows) ? rows : [])) {
          if (r.conversationId) map[r.conversationId] = { groupType: r.groupType, roleType: r.roleType };
        }
        setAutoGroupMeta(map);
      })
      .catch(() => { /* silencieux */ });
    return () => { cancelled = true; };
  }, [activeHelmSection, communautesSyncing]);

  /** ⭐ V6 — catégorie d'affichage d'une conversation GROUP (spec Communautés).
   *    ⭐ 2026-10-15 — Extension : lit aussi metadata.category (défini par
   *    AutoChannelByTrackService) pour les nouveaux canaux par piste FR/EN
   *    (administration-fr, administration-en, pedagogique-fr, pedagogique-en,
   *    conseil-general, conseil-classe).
   */
  const getCommunauteCategory = (conv: any): string => {
    // ⭐ 2026-10-15 — D'abord lire metadata.category (priorité haute)
    //    pour les nouveaux canaux par piste créés par AutoChannelByTrackService.
    //    conv.metadata peut être un objet (si Prisma parse le JSONB) ou une
    //    string (si raw SQL). On gère les deux cas.
    try {
      const rawMeta = (conv as any).metadata;
      const metaObj = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
      if (metaObj?.category) {
        switch (metaObj.category) {
          case 'administration':       return 'administration-fr'; // ou -en selon trackCode
          case 'pedagogique':          return 'pedagogique-fr';    // ou -en
          case 'conseil-general':      return 'conseil-general';
          case 'conseil-classe':       return 'conseil-classe';
          default: break; // fallback vers la logique existante ci-dessous
        }
        // Affinage par trackCode dans le metadata
        if (metaObj.category === 'administration') return metaObj.trackCode === 'EN' ? 'administration-en' : 'administration-fr';
        if (metaObj.category === 'pedagogique') return metaObj.trackCode === 'EN' ? 'pedagogique-en' : 'pedagogique-fr';
      }
    } catch { /* ignore parse error */ }

    // Logique existante (auto-groups classiques via autoGroupMeta)
    const meta = autoGroupMeta[conv.id];
    if (!meta) return 'autres';
    switch (meta.groupType) {
      case 'CLASS': return 'classes';
      case 'SUBJECT': return 'matieres';
      case 'TEACHER_SUBJECT': return 'enseignants';
      case 'LEVEL': return 'parents';
      case 'COUNCIL': return 'administration';
      case 'ROLE':
      case 'STAFF':
        if (meta.roleType === 'TEACHERS') return 'enseignants';
        if (meta.roleType === 'PARENTS') return 'parents';
        if (meta.roleType === 'PEDAGOGICAL_COUNCIL') return 'administration';
        return 'administration'; // ADMINISTRATION / ALL_STAFF
      // ⭐ 2026-10-15 — Nouveaux types par piste (AutoChannelByTrackService)
      case 'ADMIN_TRACK':
        return meta.academicTrackId ? 'administration-en' : 'administration-fr';
      case 'PEDAGOGIC_TRACK':
        return meta.academicTrackId ? 'pedagogique-en' : 'pedagogique-fr';
      case 'GENERAL_COUNCIL':
        return 'conseil-general';
      case 'COUNCIL_BY_TRACK_LEVEL':
        return 'conseil-classe';
      default: return 'autres';
    }
  };

  // ⭐ AVATAR
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // ⭐ Get JWT token from session for Socket.io auth
  const { user } = useAppSession();
  const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : '';

  // ⭐ SOCKET.IO real-time hook (replaces polling for instant delivery)
  const socket = useChatSocket({
    token: sessionToken || null,
    userId: currentUserId,
    onNewMessage: useCallback((data: any) => {
      // Instant message delivery — append to messages list
      if (data?.conversationId === activeConvId) {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m.id === data.message?.id)) return prev;
          return [...prev, data.message];
        });
      }
      // ⭐ V6.1 (fix broadcast canal) — message d'un CANAL ouvert : le
      //    backend insère maintenant avec le VRAI conversationId (= id du
      //    canal) et le broadcaste sur la room conv:<channelId> (rejointe
      //    par openChannel) → arrivée instantanée dans le fil du canal.
      //    (ref : le callback est mémoïsé avant la déclaration de
      //    activeChannelId → ref pour éviter le closure périmé)
      if (data?.conversationId && data.conversationId === activeChannelIdRef.current) {
        setChannelMessages(prev => {
          if (prev.some(m => m.id === data.message?.id)) return prev;
          return [...prev, data.message];
        });
        setTimeout(() => channelMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
      }
      // ⭐ V6.1 — badge/aperçu de la sidebar Canaux pour toute diffusion
      //    de canal (même non ouverte). Ref : loadChannels déclaré plus bas.
      if (data?.isChannel && loadChannelsRef.current) {
        loadChannelsRef.current();
      }
      // ⭐ V6 (spec §1) — ACCUSÉ DE RÉCEPTION « DISTRIBUÉ » (✓✓ gris) :
      //    tout message reçu d'un AUTRE utilisateur est marqué distribué
      //    côté serveur (POST /chat/messages/:id/deliver) — l'état intermédiaire
      //    entre ✓ envoyé et ✓✓ bleu lu. Si la conversation est ouverte, le
      //    mark-read habituel passe directement à « lu ».
      if (data?.message?.id && data.message.senderId !== currentUserId) {
        fetch(`/api/chat/messages/${data.message.id}/deliver`, { method: 'POST', credentials: 'include' }).catch(() => {});
      }
      // Also refresh conversation list (for lastMessage preview + unread count)
      // ⭐ V6.1 — les conversations de type canal ne sont PAS dans la liste
      //    des conversations (pas de participants) → pas de refresh inutile.
      if (!data?.isChannel) {
        loadConversations();
      }
      // ⭐ DISCORD PARITY: Notification sound on new message.
      //    Plays a short beep using the Web Audio API (no external file needed).
      //    Only plays if the message is NOT from the current user (don't beep
      //    for our own messages) and the conversation is not the active one
      //    (to avoid beeping for messages the user is already reading).
      try {
        if (data?.message?.senderId && data.message.senderId !== currentUserId) {
          // ⭐ V6 (spec §10) — conversations en MUET : ni son ni notification
          //    native tant que le muet est actif (1h/8h/24h/∞).
          const mutedInfo = mutedConvsRef.current[data?.conversationId || ''];
          const isMuted = !!mutedInfo && (!mutedInfo.mutedUntil || new Date(mutedInfo.mutedUntil) > new Date());
          // Only beep for messages in OTHER conversations (not the one currently open)
          if (data?.conversationId !== activeConvId && !isMuted) {
            playNotificationSound();
          }
          // ⭐ V5 (parité Yeshua) — NOTIFICATION NATIVE quand la page est en
          //    arrière-plan : titre = nom de la conversation, body =
          //    « auteur : aperçu », tag = id du message (déduplication).
          //    Aucune notification pour la conversation ouverte ou en muet.
          if (
            typeof document !== 'undefined' && document.hidden &&
            data?.conversationId !== activeConvId && !isMuted &&
            typeof Notification !== 'undefined' && Notification.permission === 'granted'
          ) {
            try {
              const m: any = data.message || {};
              const senderName = `${m.senderFirstName || m.sender?.firstName || ''} ${m.senderLastName || m.sender?.lastName || ''}`.trim() || 'Nouveau message';
              const conv = conversationsRef.current.find(c => c.id === data.conversationId);
              const title = conv?.name || senderName;
              let preview = String(m.content || '');
              if (m.type === 'AUDIO') preview = '🎤 Message vocal';
              else if (m.type === 'IMAGE') preview = '📷 Image';
              else if (m.type === 'DOCUMENT') preview = `📎 ${m.attachmentName || 'Document'}`;
              else preview = preview.replace(/<[^>]*>/g, '');
              preview = preview.substring(0, 80);
              new Notification(title, {
                body: `${senderName} : ${preview}${String(m.content || '').length > 80 ? '…' : ''}`,
                tag: m.id,
              });
            } catch { /* ignore */ }
          }
        }
      } catch { /* ignore audio errors */ }
    }, [activeConvId, currentUserId]),
    onTypingStart: useCallback((convId: string, userId: string) => {
      if (convId === activeConvId) {
        setTypingUsers(prev => prev.some(t => t.userId === userId) ? prev : [...prev, { userId }]);
      }
    }, [activeConvId]),
    onTypingStop: useCallback((convId: string, userId: string) => {
      if (convId === activeConvId) {
        setTypingUsers(prev => prev.filter(t => t.userId !== userId));
      }
    }, [activeConvId]),
    onUserOnline: useCallback((userId: string) => {
      setOnlineUsers(prev => new Set(prev).add(userId));
    }, []),
    onUserOffline: useCallback((userId: string) => {
      setOnlineUsers(prev => { const n = new Set(prev); n.delete(userId); return n; });
    }, []),
    // ⭐ MENTIONS: show a toast when the current user is @mentioned
    onMention: useCallback((data: { conversationId: string; messageId: string; senderId: string; content: string }) => {
      // Strip HTML for the toast preview
      const textPreview = (data.content || '').replace(/<[^>]*>/g, '').substring(0, 60);
      toast.info(`Vous avez été mentionné : ${textPreview}${data.content.length > 60 ? '…' : ''}`, {
        action: data.conversationId !== activeConvId ? {
          label: 'Ouvrir',
          onClick: () => setActiveConvId(data.conversationId),
        } : undefined,
      });
    }, [activeConvId]),
    // ⭐ MESSAGE EDIT: update the message in the UI in real-time
    onMessageEdited: useCallback((data: { messageId: string; content: string; editedAt: string }) => {
      setMessages(prev => prev.map(m =>
        m.id === data.messageId
          ? { ...m, content: data.content, editedAt: data.editedAt } as any
          : m
      ));
    }, []),
    // ⭐ MESSAGE DELETE: remove the message from the UI in real-time
    onMessageDeleted: useCallback((data: { messageId: string }) => {
      setMessages(prev => prev.filter(m => m.id !== data.messageId));
    }, []),
    // ⭐ REACTION: update the reactions on a message in real-time
    onReaction: useCallback((data: { messageId: string; emoji: string; userId: string; action: 'added' | 'removed'; count: number }) => {
      setMessages(prev => prev.map(m => {
        if (m.id !== data.messageId) return m;
        const reactions = Array.isArray((m as any).reactions) ? [...(m as any).reactions] : [];
        if (data.action === 'added') {
          // Add if not already present
          if (!reactions.some(r => r.emoji === data.emoji && r.userId === data.userId)) {
            reactions.push({ emoji: data.emoji, userId: data.userId });
          }
        } else {
          // Remove
          return { ...m, reactions: reactions.filter(r => !(r.emoji === data.emoji && r.userId === data.userId)) } as any;
        }
        return { ...m, reactions } as any;
      }));
    }, []),
  });

  // ⭐ FIX: Remote stream ref — stores the remote MediaStream so we can re-attach it
  //    to the video element whenever the call state changes (e.g., when the active
  //    overlay renders a NEW <video> element, the old srcObject was lost).
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // ⭐ FIX: Speaker toggle state (default on) — wired to the speaker button
  const [speakerOn, setSpeakerOn] = useState(true);

  // ⭐ V2.5: WebRTC peer connection setup (shared by caller + callee)
  //    Declared AFTER `socket` to avoid TDZ — useCallback deps reference `socket`.
  const setupPeerConnection = useCallback((otherUserId: string, callId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: getIceServers(), // ⭐ V5 — STUN ×3 + TURN (CGNAT/4G)
    });

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // ICE candidate → send to remote peer via Socket.io
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('call:ice-candidate', { toUserId: otherUserId, callId, candidate: event.candidate });
      }
    };

    // ⭐ FIX: Remote track → store stream in ref AND attach to video element.
    //    The stream is stored in remoteStreamRef so that when the active call overlay
    //    renders a NEW <video> element (with the same remoteVideoRef), we can re-attach
    //    the stream via the useEffect below.
    pc.ontrack = (event) => {
      remoteStreamRef.current = event.streams[0];
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        cleanupCall();
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [socket, cleanupCall]);

  // ⭐ FIX: Re-attach the remote stream to the video element whenever the call
  //    state changes. When callState goes from 'outgoing' → 'active', the active
  //    overlay renders a NEW <video ref={remoteVideoRef}> element. The old element
  //    (hidden, at the top of the JSX) had the srcObject set by pc.ontrack. The new
  //    element starts with srcObject=null, so the remote video doesn't show.
  //    This useEffect copies the stream from remoteStreamRef to the new element.
  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
  }, [callState]);

  // ⭐ FIX: Re-attach the LOCAL stream to the video element whenever the call
  //    state changes — same root cause as the remote stream issue. When the active
  //    overlay renders the PiP <video ref={localVideoRef}>, it's a NEW element
  //    (the sr-only one at the top of the JSX is a different element). The new
  //    PiP starts with srcObject=null, so the local camera preview is black.
  //    This useEffect copies the stream from localStreamRef to the new element.
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [callState]);

  // ⭐ FIX: Apply speaker state to the remote video element's volume.
  //    When speaker is off, mute the remote audio (volume = 0). When on, restore.
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = speakerOn ? 1 : 0;
      remoteVideoRef.current.muted = !speakerOn;
    }
  }, [speakerOn, callState]);

  // ⭐ E2E ENCRYPTION: auto-generate key pair on mount + publish public key
  useEffect(() => {
    if (!currentUserId) return;
    (async () => {
      try {
        const hasKey = await hasPrivateKey();
        if (!hasKey) {
          const { publicKeyBase64 } = await generateKeyPair();
          // Publish public key to server
          await fetch('/api/chat/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId, publicKey: publicKeyBase64 }),
            credentials: 'include',
          });
          console.log('[E2E] Key pair generated and published');
        }
      } catch (e) {
        console.warn('[E2E] Key generation failed:', e);
      }
    })();
  }, [currentUserId]);

  // ⭐ SERVICE WORKER registration for push notifications
  // ⚠️ PWA : /sw.js est le SW UNIFIÉ (push + cache + installabilité).
  // L'ancien /sw-chat.js ne doit PLUS être enregistré : deux scripts SW
  // différents sur le même scope '/' se remplacent mutuellement en
  // ping-pong. /sw.js gère désormais les notifications push du chat
  // (handlers push + notificationclick identiques).
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }
  }, []);

  // ⭐ Load channels
  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/channels?userId=${currentUserId}`, { credentials: 'include' });
      if (res.ok) setChannels(await res.json());
    } catch {}
  }, [currentUserId]);
  // ⭐ V6.1 — exposé via ref aux callbacks mémoïsés plus haut (socket).
  loadChannelsRef.current = loadChannels;

  // ⭐ V6.1 (fix broadcast canal) — LISTENER TEMPS RÉEL DES CANAUX :
  //    le backend émet 'channel:message' sur la room personnelle de
  //    chaque abonné (gateway broadcastChannelMessage). Si le canal est
  //    ouvert → append au fil (dédup par id) ; sinon → refresh de la
  //    sidebar Canaux (preview + tri + badge). Notification native +
  //    son si la page est en arrière-plan (parité Yeshua).
  useEffect(() => {
    const listener = (data: { channelId: string; message: any }) => {
      if (!data?.channelId || !data?.message) return;
      const m = data.message;
      if (activeChannelIdRef.current === data.channelId) {
        setChannelMessages(prev => {
          if (prev.some(x => x.id === m.id)) return prev;
          return [...prev, m];
        });
        setTimeout(() => channelMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
      }
      if (loadChannelsRef.current) loadChannelsRef.current();
      // Son + notification native (page en arrière-plan), sauf si le
      // canal est ouvert (on est en train de le lire).
      try {
        if (m.senderId && m.senderId !== currentUserId && activeChannelIdRef.current !== data.channelId) {
          playNotificationSound();
          if (typeof document !== 'undefined' && document.hidden &&
              typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const senderName = `${m.senderFirstName || m.sender?.firstName || ''} ${m.senderLastName || m.sender?.lastName || ''}`.trim() || 'Canal';
            const ch = channels.find((c: any) => c.id === data.channelId);
            let preview = String(m.content || '').replace(/<[^>]*>/g, '');
            if (m.type === 'SYSTEM') preview = m.content || 'Événement du canal';
            new Notification(ch?.name || 'Canal', {
              body: `${senderName} : ${preview.substring(0, 80)}${preview.length > 80 ? '…' : ''}`,
              tag: m.id,
            });
          }
        }
      } catch { /* ignore */ }
    };
    socket.on('channel:message', listener);
    return () => { socket.off('channel:message', listener); };
  }, [socket, currentUserId, channels]);

  // ⭐ Task 77 — AUTO-SYNC DES CANAUX OFFICIELS : à la première ouverture
  //    de la section Canaux (une fois par session), on appelle
  //    POST /chat/auto-channels/sync qui garantit les canaux officiels LIÉS
  //    AUX MODULES ACTIVÉS (Direction, Vie scolaire, Finance si actif,
  //    Transport seulement quand le module sera livré) + l'abonnement
  //    automatique de l'utilisateur + le retrait des canaux obsolètes vides.
  //    Côté serveur, la même sync tourne au démarrage puis toutes les 6 h.
  const [canauxSyncing, setCanauxSyncing] = useState(false);
  const [canauxSyncMessage, setCanauxSyncMessage] = useState<string | null>(null);
  const syncAutoChannels = useCallback(async () => {
    setCanauxSyncing(true);
    try {
      const res = await fetch('/api/chat/auto-channels/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // ⭐ Task 77 — POST sans body → 400 BFF
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setCanauxSyncMessage(data?.message || 'Canaux officiels synchronisés.');
        await loadChannels();
      } else {
        setCanauxSyncMessage('Synchronisation impossible — réessayez plus tard.');
      }
    } catch {
      setCanauxSyncMessage('Erreur réseau — réessayez plus tard.');
    } finally {
      setCanauxSyncing(false);
    }
  }, [loadChannels]);

  // Auto-sync à la première ouverture de la section Canaux (une fois par session)
  useEffect(() => {
    if (activeHelmSection !== 'canaux' || canauxSyncing || canauxSyncMessage) return;
    syncAutoChannels();
  }, [activeHelmSection]); // eslint-disable-line react-hooks/exhaustive-deps

  // ⭐ V6 (parité Yeshua — Direct du canal / Go Live) : directs en cours,
  //    indexés par canal (GET /chat/live-streams, polling 15 s).
  //    (startChannelDirect/stopChannelDirect sont définis après joinVoiceChannel)
  const [channelDirects, setChannelDirects] = useState<Record<string, { by: string; streamId: string; hostId: string; startedAt?: string }>>({});
  const [liveSwitching, setLiveSwitching] = useState(false);

  // Polling des directs du tenant (15 s) — comme Yeshua (polling /direct).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/chat/live-streams', { credentials: 'include' });
        if (res.ok) {
          const list = await res.json();
          if (!cancelled && Array.isArray(list)) {
            const map: Record<string, { by: string; streamId: string; hostId: string; startedAt?: string }> = {};
            for (const s of list) {
              if (s.channelId) {
                map[s.channelId] = {
                  by: s.hostName || s.startedByName || 'Un diffuseur',
                  streamId: s.id,
                  hostId: s.hostId || s.userId || '',
                  startedAt: s.startedAt || s.createdAt,
                };
              }
            }
            setChannelDirects(map);
          }
        }
      } catch { /* silencieux */ }
    };
    load();
    const t = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  // ⭐ V6 — charger la liste des conversations mises en muet (+ après chaque
  //    (dé)mutation). mutedUntil NULL = muet pour toujours.
  const loadMutedConversations = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch(`/api/chat/v2/notifications/muted-conversations?userId=${currentUserId}`, { credentials: 'include' });
      if (res.ok) {
        const list = await res.json();
        const map: Record<string, { mutedUntil: string | null }> = {};
        for (const m of (Array.isArray(list) ? list : [])) {
          map[m.conversationId] = { mutedUntil: m.mutedUntil || null };
        }
        setMutedConvs(map);
      }
    } catch { /* ignore */ }
  }, [currentUserId]);

  useEffect(() => { loadMutedConversations(); }, [loadMutedConversations]);

  // ⭐ V6 — mettre en muet une conversation (durée 1H/8H/24H/FOREVER)
  const muteConversationFor = useCallback(async (convId: string, duration: '1H' | '8H' | '24H' | 'FOREVER') => {
    try {
      const res = await fetch(`/api/chat/v2/notifications/conversations/${convId}/mute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, duration }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Échec');
      const data = await res.json();
      setMutedConvs(prev => ({ ...prev, [convId]: { mutedUntil: data.mutedUntil || null } }));
      const labels: Record<string, string> = { '1H': '1 heure', '8H': '8 heures', '24H': '24 heures', 'FOREVER': 'toujours' };
      toast.success(`Notifications coupées pendant ${labels[duration]}`);
    } catch (e: any) {
      toast.error('Impossible de mettre en muet : ' + e.message);
    }
  }, [currentUserId]);

  // ⭐ V6 — réactiver les notifications d'une conversation
  const unmuteConversationFor = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/chat/v2/notifications/conversations/${convId}/unmute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Échec');
      setMutedConvs(prev => {
        const next = { ...prev };
        delete next[convId];
        return next;
      });
      toast.success('Notifications réactivées');
    } catch (e: any) {
      toast.error('Impossible de réactiver : ' + e.message);
    }
  }, [currentUserId]);

  // ⭐ V6 — ouvrir un canal : charge les messages et affiche le panneau
  //    (parité Yeshua : les canaux sont des conversations de diffusion).
  const openChannel = useCallback((ch: any) => {
    setActiveConvId(null);
    setActiveChannelId(ch.id);
    setChannelMessages([]);
    setChannelInput('');
    setMobileSidebarOpen(false);
    // ⭐ V6.1 (temps réel) — rejoindre la room socket du canal : le backend
    //    broadcaste les diffusions sur conv:<channelId> (message:new), comme
    //    pour une conversation classique → arrivée instantanée dans le fil.
    socket.joinConversation(ch.id);
    // Charger les messages du canal (GET /chat/channels/:id/messages)
    fetch(`/api/chat/channels/${ch.id}/messages?limit=100`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : []))
      .then((msgs: any[]) => {
        setChannelMessages(Array.isArray(msgs) ? msgs : []);
        setTimeout(() => channelMessagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
      })
      .catch(() => setChannelMessages([]));
    // Auto-abonnement silencieux à la première ouverture (comme Yeshua où
    // l'utilisateur rejoint le canal pour le voir)
    if (!ch.isSubscribed) {
      fetch(`/api/chat/channels/${ch.id}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
        credentials: 'include',
      }).then(() => loadChannels()).catch(() => {});
    }
  }, [currentUserId, loadChannels, socket]);

  // ⭐ V6 — publier une diffusion dans le canal (POST broadcast)
  const handleBroadcast = useCallback(async () => {
    const content = channelInput.trim();
    if (!content || !activeChannelId || channelSending) return;
    setChannelSending(true);
    try {
      const res = await fetch(`/api/chat/channels/${activeChannelId}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: currentUserId, content }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Diffusion échouée');
      const msg = await res.json();
      setChannelMessages(prev => [...prev, {
        ...msg,
        senderFirstName: user?.firstName,
        senderLastName: user?.lastName,
      }]);
      setChannelInput('');
      setTimeout(() => channelMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
      loadChannels(); // rafraîchir l'aperçu de la sidebar
    } catch (e: any) {
      toast.error('Diffusion impossible : ' + e.message);
    } finally {
      setChannelSending(false);
    }
  }, [channelInput, activeChannelId, channelSending, currentUserId, user, loadChannels]);

  // ⭐ V6 — (dé)abonnement manuel au canal
  //    ⭐ V6.1 (parité Yeshua) — notify:true sur l'abonnement explicite →
  //    message système « X a rejoint le canal » pour tous les abonnés.
  const toggleChannelSubscription = useCallback(async (ch: any) => {
    try {
      const res = await fetch(`/api/chat/channels/${ch.id}/${ch.isSubscribed ? 'unsubscribe' : 'subscribe'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, notify: !ch.isSubscribed }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Opération échouée');
      toast.success(ch.isSubscribed ? 'Désabonné du canal' : 'Abonné au canal');
      loadChannels();
    } catch (e: any) {
      toast.error('Impossible : ' + e.message);
    }
  }, [currentUserId, loadChannels]);

  // ⭐ Load my avatar
  useEffect(() => {
    if (!currentUserId) return;
    // Avatar is included in the user session — but also fetch it separately
    // since the users table now has avatarUrl column
    (async () => {
      try {
        const res = await fetch(`/api/chat/presence?userIds=${currentUserId}`, { credentials: 'include' });
        // We don't have a dedicated endpoint for avatar yet — the search endpoint
        // returns avatarUrl. For now, set to null and let the profile modal handle upload.
      } catch {}
    })();
  }, [currentUserId]);

  // ⭐ Avatar upload handler
  const handleAvatarUpload = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', currentUserId);
    try {
      const res = await fetch('/api/chat/avatar', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setMyAvatarUrl(data.avatarUrl);
      // ⭐ « Mon profil » partagé : propage l'avatar aux topbars/sidebars de
      //    tous les portails (store + événement écouté par les composants).
      try {
        const { useUserProfileStore } = await import('@/stores/user-profile-store');
        useUserProfileStore.getState().setAvatar(data.avatarUrl || null);
      } catch {}
      toast.success('Photo de profil mise à jour');
    } catch (e: any) {
      toast.error('Échec upload: ' + e.message);
    }
  }, [currentUserId]);

  const activeConv = useMemo(
    () => conversations.find(c => c.id === activeConvId) || null,
    [conversations, activeConvId]
  );

  // ⭐ V5 — correspondances de mentions calculées UNE fois (popover + clavier).
  //    Déclarées APRÈS activeConv (ordre TDZ).
  const mentionMatches = useMemo(() => {
    if (mentionQuery === null || !activeConv) return [] as any[];
    const query = mentionQuery.toLowerCase();
    return (activeConv.participants || [])
      .filter((p: any) => p.userId !== currentUserId)
      .filter((p: any) => {
        const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim().toLowerCase();
        return !query || fullName.includes(query);
      })
      .slice(0, 5);
  }, [mentionQuery, activeConv, currentUserId]);
  // ⭐ V5 — insère la mention à la place du « @requête » tapé (au lieu de
  //    l'ajouter en fin de texte) : position réelle du jeton, pas un append.
  const selectMention = useCallback((p: any) => {
    const firstName = p.firstName || p.lastName || 'utilisateur';
    const mentionText = `@${firstName} `;
    const mentionHtml = `<span style="background-color:rgba(22,119,255,0.15);color:#0958D9;font-weight:600;border-radius:3px;padding:0 2px;">${mentionText}</span>`;
    setText(prev => {
      const query = mentionQuery || '';
      const token = '@' + query;
      const idx = query ? prev.lastIndexOf(token) : prev.lastIndexOf('@');
      if (idx !== -1) {
        const after = query ? idx + token.length : idx + 1;
        return prev.slice(0, idx) + mentionHtml + prev.slice(after);
      }
      return prev + mentionHtml;
    });
    setMentionQuery(null);
  }, [mentionQuery]);

  // ⭐ V5 — ACTIVATION E2EE (les helpers étaient importés mais JAMAIS appelés) :
  //    en conversation DIRECTE, si les DEUX parties ont publié une clé, les
  //    messages texte sont chiffrés (RSA-OAEP) pour le destinataire. La copie
  //    locale de l'expéditeur (optimiste + cache offline) reste en clair.
  const [e2eAvailable, setE2eAvailable] = useState(false);
  const [otherPublicKey, setOtherPublicKey] = useState<string | null>(null);
  const otherPublicKeyRef = useRef<string | null>(null);
  otherPublicKeyRef.current = otherPublicKey;
  useEffect(() => {
    setOtherPublicKey(null);
    setE2eAvailable(false);
    if (!activeConvId || !activeConv || activeConv.type !== 'DIRECT') return;
    const other = activeConv.participants?.find((p: any) => p.userId !== currentUserId);
    if (!other) return;
    (async () => {
      try {
        const mine = await hasPrivateKey();
        const res = await fetch(`/api/chat/keys?userIds=${other.userId}`, { credentials: 'include' });
        if (res.ok) {
          const keys = await res.json();
          const k = Array.isArray(keys) ? keys[0]?.publicKey : null;
          setOtherPublicKey(k || null);
          setE2eAvailable(!!mine && !!k);
        }
      } catch { /* silencieux — E2E reste désactivé */ }
    })();
  }, [activeConvId, activeConv, currentUserId]);

  // ⭐ V5 — DÉCHIFFREMENT à l'affichage : messages « E2E: » → déchiffrement par
  //    clé privée. Pour MES PROPRES messages (chiffrés pour le destinataire,
  //    indéchiffrables par moi), repli sur la copie en clair du cache offline.
  const [decryptedContents, setDecryptedContents] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const encrypted = messages.filter((m: any) => isEncrypted(m.content || ''));
      if (encrypted.length === 0) return;
      let offlineMine: Record<string, string> = {};
      if (isOfflineStoreAvailable() && activeConvId) {
        try {
          const cached = await getOfflineMessages(activeConvId);
          offlineMine = Object.fromEntries(cached.map((c: any) => [c.id, String(c.content || '')]));
        } catch { /* ignore */ }
      }
      const updates: Record<string, string> = {};
      for (const m of encrypted as any[]) {
        if (m.senderId === currentUserId && offlineMine[m.id] && !isEncrypted(offlineMine[m.id])) {
          updates[m.id] = offlineMine[m.id];
        } else {
          const dec = await decryptMessage(m.content);
          if (dec !== m.content) updates[m.id] = dec;
        }
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setDecryptedContents(prev => ({ ...prev, ...updates }));
      }
    })();
    return () => { cancelled = true; };
  }, [messages, activeConvId, currentUserId]);

  // ───────────────────────────────────────────────────────────────────
  // Load conversations
  // ───────────────────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/conversations?userId=${currentUserId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load conversations');
      const data = await res.json();
      setConversations(data);
    } catch (e: any) {
      console.error('loadConversations:', e);
      setError(e.message);
    } finally {
      setLoadingConvs(false);
    }
  }, [currentUserId]);

  // ⭐ DISCORD PARITY: Load conversation members with online status + custom status.
  //    Called when the user opens the member list sidebar.
  const loadConversationMembers = useCallback(async (convId: string) => {
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/chat/conversations/${convId}/members?userId=${currentUserId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load members');
      const data = await res.json();
      setConversationMembers(data);
    } catch (e: any) {
      console.error('loadConversationMembers:', e);
      // Fallback: use participants already in the conversation object
      if (activeConv) {
        setConversationMembers((activeConv as any).participants || []);
      }
    } finally {
      setLoadingMembers(false);
    }
  }, [currentUserId, activeConv]);

  // ⭐ DISCORD PARITY: Toggle the member list sidebar.
  const toggleMemberList = useCallback(() => {
    if (!showMemberList && activeConvId) {
      loadConversationMembers(activeConvId);
    }
    setShowMemberList(prev => !prev);
  }, [showMemberList, activeConvId, loadConversationMembers]);

  // ═══ V6 (spec §3/§17) — ACTIONS D'ADMINISTRATION DE CONVERSATION ═══
  //    Le backend était COMPLET (rôle/permissions/approve/reject/ban/kick/
  //    mute/slow-mode/audit-logs) mais aucune UI ne l'appelait.
  //    Toutes les actions vérifient côté serveur que l'appelant est ADMIN.
  const memberAdminAction = useCallback(async (path: string, method: 'PUT' | 'POST' | 'DELETE', body: any, okMsg: string) => {
    if (!activeConvId) return;
    try {
      const res = await fetch(`/api/chat/conversations/${activeConvId}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: currentUserId, ...body }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.message || `Erreur ${res.status}`);
      }
      toast.success(okMsg);
      loadConversationMembers(activeConvId); // rafraîchir la liste
    } catch (e: any) {
      toast.error('Action impossible : ' + e.message);
    }
  }, [activeConvId, currentUserId, loadConversationMembers]);

  const setMemberRoleAction = useCallback((targetUserId: string, role: 'ADMIN' | 'MODERATOR' | 'MEMBER') =>
    memberAdminAction(`/members/${targetUserId}/role`, 'PUT', { role },
      role === 'ADMIN' ? 'Membre promu administrateur' : role === 'MODERATOR' ? 'Membre promu modérateur' : 'Rôle réinitialisé en membre'),
    [memberAdminAction]);

  const kickMemberAction = useCallback((targetUserId: string) =>
    memberAdminAction(`/kick/${targetUserId}`, 'POST', { reason: 'Exclusion depuis Helm Connect' }, 'Membre exclu du groupe'),
    [memberAdminAction]);

  const banMemberAction = useCallback((targetUserId: string, ban: boolean) =>
    memberAdminAction(`/ban/${targetUserId}`, ban ? 'POST' : 'DELETE', { reason: 'Bannissement depuis Helm Connect' },
      ban ? 'Membre banni du groupe' : 'Membre débanni'),
    [memberAdminAction]);

  const chatMuteMemberAction = useCallback((targetUserId: string, mute: boolean) =>
    memberAdminAction(`/mute/${targetUserId}`, mute ? 'POST' : 'DELETE', { reason: 'Mise en sourdine (modération)' },
      mute ? 'Membre mis en sourdine' : 'Membre autorisé à parler'),
    [memberAdminAction]);

  const approveMemberAction = useCallback((targetUserId: string, approve: boolean) =>
    memberAdminAction(`/members/${targetUserId}/${approve ? 'approve' : 'reject'}`, 'POST', {},
      approve ? 'Membre approuvé' : 'Demande refusée'),
    [memberAdminAction]);

  const applySlowModeAction = useCallback(async (seconds: number) => {
    if (!activeConvId) return;
    try {
      const res = await fetch(`/api/chat/conversations/${activeConvId}/slow-mode`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, seconds }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      toast.success(seconds > 0 ? `Mode lent actif : ${seconds}s entre messages` : 'Mode lent désactivé');
      setShowSlowModeModal(false);
    } catch (e: any) {
      toast.error('Mode lent impossible : ' + e.message);
    }
  }, [activeConvId, currentUserId]);

  const loadAuditLogsAction = useCallback(async () => {
    if (!activeConvId) return;
    setAuditLogsLoading(true);
    try {
      const res = await fetch(`/api/chat/conversations/${activeConvId}/audit-logs?userId=${currentUserId}&limit=60`, { credentials: 'include' });
      if (res.ok) setAuditLogs(await res.json());
    } catch { /* ignore */ } finally { setAuditLogsLoading(false); }
  }, [activeConvId, currentUserId]);

  // ⭐ DISCORD PARITY: Search GIFs via the Tenor API proxy endpoint.
  const searchGifs = useCallback(async (query: string) => {
    if (!query.trim()) { setGifResults([]); return; }
    setGifLoading(true);
    try {
      const res = await fetch(`/api/chat/gifs/search?q=${encodeURIComponent(query)}&limit=20`, { credentials: 'include' });
      if (!res.ok) throw new Error('GIF search failed');
      const data = await res.json();
      setGifResults(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('searchGifs:', e);
      setGifResults([]);
    } finally {
      setGifLoading(false);
    }
  }, []);

  // ⭐ DISCORD PARITY: Send a GIF as an IMAGE message (uses the GIF URL directly).
  const sendGif = useCallback(async (gif: { url: string; id?: string }) => {
    if (!activeConvId || sending) return;
    setSending(true);
    try {
      // Download the GIF and re-upload it as an attachment (so we control the URL
      // and avoid hot-linking issues with Tenor's CDN which may rate-limit).
      // For simplicity, we send the Tenor URL directly via a custom endpoint.
      // The backend stores it as an IMAGE message with the external URL.
      const formData = new FormData();
      formData.append('senderId', currentUserId);
      formData.append('type', 'IMAGE');
      formData.append('content', gif.url);
      formData.append('tenorGifId', gif.id || '');
      // Fetch the GIF as a blob and upload it as a file attachment
      const gifRes = await fetch(gif.url);
      const blob = await gifRes.blob();
      const fileName = `gif-${Date.now()}.gif`;
      const file = new File([blob], fileName, { type: 'image/gif' });
      formData.append('file', file);
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : '';
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('x-tenant-id') || document.cookie.match(/x-tenant-id=([^;]+)/)?.[1] || '' : '';
      const uploadRes = await fetch(`${getBackendBaseUrl()}/api/chat/conversations/${activeConvId}/messages/attachment`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
        },
        body: formData,
        credentials: 'include',
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const newMsg = await uploadRes.json();
      setMessages(prev => [...prev, newMsg]);
      loadConversations();
      setShowGifPicker(false);
      toast.success('GIF envoyé');
    } catch (e: any) {
      toast.error("Échec d'envoi du GIF : " + e.message);
    } finally {
      setSending(false);
    }
  }, [activeConvId, currentUserId, sending, loadConversations]);

  // ⭐ DISCORD PARITY: Load sticker packs.
  const loadStickerPacks = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/stickers/packs', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setStickerPacks(Array.isArray(data) ? data : []);
      if (data.length > 0 && !activeStickerPack) {
        setActiveStickerPack(data[0].id);
      }
    } catch (e: any) { console.error('loadStickerPacks:', e); }
  }, [activeStickerPack]);

  // ⭐ DISCORD PARITY: Load stickers in a pack.
  const loadStickers = useCallback(async (packId: string) => {
    try {
      const res = await fetch(`/api/chat/stickers/${packId}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setStickers(Array.isArray(data) ? data : []);
    } catch (e: any) { console.error('loadStickers:', e); }
  }, []);

  // ⭐ DISCORD PARITY: Send a sticker.
  const sendSticker = useCallback(async (stickerId: string) => {
    if (!activeConvId || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/chat/conversations/${activeConvId}/sticker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: currentUserId, stickerId }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Sticker send failed');
      const newMsg = await res.json();
      setMessages(prev => [...prev, newMsg]);
      loadConversations();
      setShowStickerPicker(false);
    } catch (e: any) {
      toast.error("Échec d'envoi du sticker : " + e.message);
    } finally {
      setSending(false);
    }
  }, [activeConvId, currentUserId, sending, loadConversations]);

  // ⭐ DISCORD PARITY: Load voice channels.
  const loadVoiceChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/voice-channels', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setVoiceChannels(Array.isArray(data) ? data : []);
    } catch (e: any) { console.error('loadVoiceChannels:', e); }
  }, []);

  // ⭐ V4 FIX (rendu) : les canaux vocaux n'étaient JAMAIS chargés — le
  //    loadVoiceChannels ci-dessus n'était appelé nulle part. Chargement au
  //    mount + rafraîchissement 30 s (la liste inclut activeUsers + videoMode).
  useEffect(() => {
    if (readOnly) return;
    loadVoiceChannels();
    const interval = setInterval(loadVoiceChannels, 30000);
    return () => clearInterval(interval);
  }, [readOnly, loadVoiceChannels]);

  /** Déconnecte la session média du canal vocal courant. */
  const disconnectVoiceSession = useCallback(() => {
    try { voiceSessionRef.current?.disconnect(); } catch {}
    voiceSessionRef.current = null;
    setVoiceActiveSpeakers(new Set());
    setVoiceProvider(null);
    setVoiceMuted(false);
  }, []);

  /** Micro du canal vocal. */
  const toggleVoiceMute = useCallback(() => {
    const session = voiceSessionRef.current;
    if (session) {
      session.setMicEnabled(voiceMuted).catch(() => {});
    }
    setVoiceMuted(!voiceMuted);
  }, [voiceMuted]);

  /** Caméra du canal vocal (mode vidéo activé par l'admin) — bascule personnelle. */
  const [voiceCameraOn, setVoiceCameraOn] = useState(false);
  const toggleVoiceVideo = useCallback(() => {
    const session = voiceSessionRef.current;
    const next = !voiceCameraOn;
    if (session) {
      session.setCameraEnabled(next).catch(() => {});
    }
    setVoiceCameraOn(next);
  }, [voiceCameraOn]);

  /** ⭐ V5 (parité Yeshua) — BASCULE AUDIO↔VIDÉO DU CANAL : CONTRÔLE ADMIN
   *    COLLECTIF. PUT /voice-channels/:id/video-mode — le serveur diffuse
   *    voice:video-mode à tous les membres et les caméras suivent. Avant V5 :
   *    n'activait que SA propre caméra et l'événement socket était écrit dans
   *    window._voiceVideoMode SANS JAMAIS être consommé. */
  const toggleVoiceVideoMode = useCallback(async () => {
    if (!activeVoiceChannel) return;
    const next = !voiceVideoMode;
    try {
      const res = await fetch(`/api/chat/voice-channels/${activeVoiceChannel}/video-mode`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoMode: next }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.message || `Erreur ${res.status}`);
      }
      setVoiceVideoMode(next);
      voiceSessionRef.current?.setCameraEnabled(next).catch(() => {});
      toast.success(next ? 'Mode vidéo activé pour tout le canal' : 'Mode audio activé pour tout le canal');
    } catch (e: any) {
      toast.error('Bascule impossible : ' + e.message);
    }
  }, [activeVoiceChannel, voiceVideoMode]);

  // ⭐ V5 (parité Yeshua) — autoplay bloqué par le navigateur : bandeau
  //    « Le son est coupé — cliquez ici » dans le panneau vocal.
  const [voiceAutoplayBlocked, setVoiceAutoplayBlocked] = useState(false);
  const unlockAudioPlayback = useCallback(async () => {
    try {
      const ctx = new AudioContext();
      await ctx.resume();
      ctx.close().catch(() => {});
    } catch { /* ignore */ }
    // Relancer la lecture des <audio> distants cachés des adaptateurs
    document.querySelectorAll('audio[data-hc]').forEach((el) => {
      (el as HTMLAudioElement).play().catch(() => {});
    });
    setVoiceAutoplayBlocked(false);
  }, []);

    // ⭐ V4 (porté de Yeshua Connect) : Join a voice channel via la CHAÎNE
  //    MÉDIA — join-voice (arbitrage serveur LiveKit → Agora → Daily) qui
  //    fournit : micro + vidéo (mode admin) + locuteurs actifs + participants
  //    normalisés. Repli mesh si la chaîne est épuisée.
  const joinVoiceChannel = useCallback(async (channelId: string) => {
    try {
      // 1. Join via REST (enregistre l'état vocal + liste des présents)
      const joinRes = await fetch(`/api/chat/voice-channels/${channelId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, socketId: socket ? 'connected' : undefined }),
        credentials: 'include',
      });
      if (!joinRes.ok) throw new Error('Join failed');
      const joinData = await joinRes.json();
      setActiveVoiceChannel(channelId);
      setVoiceChannelUsers(joinData.activeUsers || []);
      const channel: any = joinData.channel || {};
      setVoiceVideoMode(!!channel.videoMode);

      // 2. Chaîne média (LiveKit → Agora → Daily)
      try {
        const bundle = await withTimeout(fetchMediaJoin('voice', channelId), 12000, 'voice-join');
        if (bundle.exhausted) {
          // ⭐ V7 (parité Yeshua — Plan C VOIX) : la chaîne est épuisée ET il
          //    n'existe AUCUNE session mesh pour les canaux vocaux (le mesh
          //    n'est câblé que pour les appels) → l'utilisateur se retrouvait
          //    « dans » le canal SANS AUDIO. On ouvre le MODE SECOURS JITSI
          //    déterministe (même mécanique que Yeshua startVoiceJitsi).
          setVoiceProvider('jitsi');
          setJitsiFallback({
            room: jitsiRoomFor('voice', channelId),
            title: `Canal vocal — ${channel.name || 'Voix'}`,
          });
          return;
        }
        const session = await withTimeout(
          createMediaSession(
            bundle,
            {
              video: !!channel.videoMode,
              participantName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Utilisateur',
            },
            {
              onParticipants: (participants) => {
                // ⭐ V5 — stocker les participants média (grille vidéo du canal)
                setVoiceMediaParticipants(participants);
                // Rafraîchir la liste des présents (source REST = vérité)
                fetch(`/api/chat/voice-channels/${channelId}/users`, { credentials: 'include' })
                  .then((r) => (r.ok ? r.json() : null))
                  .then((users) => { if (Array.isArray(users)) setVoiceChannelUsers(users); })
                  .catch(() => {});
              },
              onActiveSpeakers: (ids) => setVoiceActiveSpeakers(ids),
              onDisconnected: () => {
                // Défaillance du canal vocal : on ne bascule PAS
                // automatiquement (rooms persistantes) — on nettoie et
                // l'utilisateur peut rejoindre à nouveau.
                disconnectVoiceSession();
              },
            },
          ),
          12000,
          'voice-session',
        );
        voiceSessionRef.current = session;
        setVoiceProvider(bundle.provider);
        toast.success(`Rejoint : ${channel.name || 'Voix'} (${bundle.provider === 'livekit' ? 'LiveKit SFU' : bundle.provider})`);
        // ⭐ V5 — détection autoplay bloqué (AudioContext suspendu = le
        //    navigateur refusera de jouer l'audio distant sans interaction)
        try {
          const probe = new AudioContext();
          setVoiceAutoplayBlocked(probe.state === 'suspended');
          probe.close().catch(() => {});
        } catch { /* ignore */ }
        // ⭐ V5 — auto-rejoin après refresh (clé localStorage)
        try { localStorage.setItem(`helm-voice-${currentUserId}`, channelId); } catch {}
      } catch (e: any) {
        // ⭐ V7 — chaîne média indisponible → MODE SECOURS JITSI (pas de
        //    mesh pour la voix — voir plus haut).
        setVoiceProvider('jitsi');
        setJitsiFallback({
          room: jitsiRoomFor('voice', channelId),
          title: `Canal vocal — ${channel.name || 'Voix'}`,
        });
        console.warn('Voice media chain failed:', e.message);
      }
    } catch (e: any) {
      toast.error("Échec de l'audio : " + e.message);
    }
  }, [currentUserId, socket, user, disconnectVoiceSession]);

  // ═══ V6 (parité Yeshua — Direct du canal / Go Live) ═══
  // Lancer un direct dans un canal vocal (admin) — POST /chat/live-streams
  const startChannelDirect = useCallback(async (channelId: string) => {
    if (liveSwitching) return;
    setLiveSwitching(true);
    try {
      const res = await fetch('/api/chat/live-streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, channelId }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const stream = await res.json();
      const myName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Vous';
      setChannelDirects(prev => ({
        ...prev,
        [channelId]: { by: myName, streamId: stream.id, hostId: currentUserId, startedAt: new Date().toISOString() },
      }));
      toast.success('Direct lancé — vous diffusez');
      // Comme Yeshua : on n'était pas connecté ? On rejoint pour diffuser.
      if (!activeVoiceChannel) {
        await joinVoiceChannel(channelId);
      }
    } catch (e: any) {
      toast.error('Impossible de lancer le direct : ' + e.message);
    } finally {
      setLiveSwitching(false);
    }
  }, [liveSwitching, currentUserId, user, activeVoiceChannel, joinVoiceChannel]);

  // Arrêter un direct (diffuseur) — DELETE /chat/live-streams/:id
  const stopChannelDirect = useCallback(async () => {
    const channelId = activeVoiceChannel;
    const info = channelId ? channelDirects[channelId] : null;
    if (!info || liveSwitching) return;
    setLiveSwitching(true);
    try {
      const res = await fetch(`/api/chat/live-streams/${info.streamId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setChannelDirects(prev => {
        const next = { ...prev };
        if (channelId) delete next[channelId];
        return next;
      });
      toast.success('Direct arrêté');
    } catch (e: any) {
      toast.error('Impossible d’arrêter le direct : ' + e.message);
    } finally {
      setLiveSwitching(false);
    }
  }, [activeVoiceChannel, channelDirects, liveSwitching, currentUserId]);

  // ⭐ V4: Leave the active voice channel — déconnecte la session média
  //    (chaîne LiveKit → Agora → Daily) et l'état REST.
  const leaveVoiceChannel = useCallback(async () => {
    if (!activeVoiceChannel) return;
    // Déconnecter la session média V4
    disconnectVoiceSession();
    // Legacy : ancienne room LiveKit brute (au cas où)
    try {
      const room = (window as any)._livekitRoom;
      if (room) {
        await room.disconnect();
        (window as any)._livekitRoom = null;
      }
    } catch { /* ignore */ }
    // Call REST leave endpoint
    try {
      await fetch(`/api/chat/voice-channels/${activeVoiceChannel}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
        credentials: 'include',
      });
    } catch { /* ignore */ }
    // ⭐ V5 — quitter explicitement EFFACE la clé d'auto-rejoin (sinon un
    //    simple refresh nous reconnecterait — comportement Telegram/Yeshua)
    try { localStorage.removeItem(`helm-voice-${currentUserId}`); } catch {}
    setVoiceCameraOn(false);
    setActiveVoiceChannel(null);
    setVoiceChannelUsers([]);
    setVoiceMediaParticipants([]);
  }, [activeVoiceChannel, currentUserId]);

  // ⭐ V5 (parité Yeshua) — AUTO-REJOIN après refresh : la clé localStorage
  //    helm-voice-<uid> est posée au join ; au montage, si le canal existe
  //    encore, on s'y reconnecte automatiquement (UNE tentative par chargement).
  const voiceAutoRejoinRef = useRef(false);
  useEffect(() => {
    if (voiceAutoRejoinRef.current || activeVoiceChannel || !currentUserId) return;
    const saved = typeof window !== 'undefined' ? localStorage.getItem(`helm-voice-${currentUserId}`) : null;
    if (!saved || voiceChannels.length === 0) return;
    voiceAutoRejoinRef.current = true;
    if (voiceChannels.some((c: any) => c.id === saved)) {
      joinVoiceChannel(saved).catch(() => {
        try { localStorage.removeItem(`helm-voice-${currentUserId}`); } catch {}
      });
    }
  }, [voiceChannels, activeVoiceChannel, currentUserId, joinVoiceChannel]);

  // ───────────────────────────────────────────────────────────────────
  // Load messages for active conversation
  // ───────────────────────────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    if (!activeConvId) return;

    // ⭐ V3-1: Lire le cache IndexedDB d'abord (affichage instantané)
    if (isOfflineStoreAvailable()) {
      try {
        const cached = await getOfflineMessages(activeConvId);
        if (cached.length > 0) {
          // Afficher immédiatement les messages cache (avant le fetch backend)
          setMessages(cached as any);
        }
      } catch (e) {
        // silent — IndexedDB may be unavailable (private browsing)
      }
    }

    try {
      const res = await fetch(
        `/api/chat/conversations/${activeConvId}/messages?userId=${currentUserId}&limit=100`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to load messages');
      const data = await res.json();
      // Dédoubler (au cas où le polling récupère les mêmes)
      const seen = new Set<string>();
      const unique = data.filter((m: ChatMessage) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      // ⭐ V5 — Fusion à signature (remplace le setMessages intégral).
      //    Ne JAMAIS remplacer tout le tableau : on garde les pages plus
      //    anciennes chargées par pagination + les messages locaux pending,
      //    on adopte les versions serveur de la fenêtre fraîche, on retire
      //    les supprimés. Si la signature (contenu+statuts) est inchangée →
      //    on retourne l'identité précédente → AUCUN re-render → le scroll
      //    n'est jamais perturbé par le polling de secours.
      setMessages(prev => {
        if (prev.length === 0) return unique;
        const serverIds = new Set<string>(unique.map((m: ChatMessage) => m.id));
        const oldestTime = new Date(unique[0]?.createdAt || 0).getTime();
        const olderPages: ChatMessage[] = [];
        const tailPending: ChatMessage[] = [];
        for (const m of prev) {
          if (serverIds.has(m.id)) continue; // la version serveur remplace
          if ((m as any).status === 'pending' || (m as any).localId) {
            tailPending.push(m); // message optimiste local (le plus récent) → en fin
          } else if (new Date(m.createdAt || 0).getTime() < oldestTime) {
            olderPages.push(m); // page de pagination plus ancienne → en tête
          }
          // sinon : message récent absent du serveur (supprimé) → retiré
        }
        const merged: ChatMessage[] = [...olderPages, ...unique, ...tailPending];
        const sig = (list: ChatMessage[]) => list.map((m: any) =>
          `${m.id}:${m.updatedAt || m.editedAt || ''}:${(m.reactions || []).length}:${m.isPinned ? 1 : 0}:${m.status || ''}:${m.readAt || ''}:${m.deliveredAt || ''}`
        ).join('|');
        return sig(merged) === sig(prev) ? prev : merged;
      });
      // ⭐ V5 : hasMore n'est calculé que sur un chargement FRAIS de conversation
      //    (sinon le bouton « Charger les messages précédents » réapparaissait
      //    à chaque poll après avoir atteint le début de l'historique).
      if (freshLoadRef.current) {
        setHasMoreMessages(unique.length >= 100);
        freshLoadRef.current = false;
      }

      // ⭐ V3-1: Sauvegarder dans le cache offline (bulk)
      if (isOfflineStoreAvailable() && unique.length > 0) {
        const offlineMsgs: OfflineChatMessage[] = unique.map((m: any) => ({
          id: m.id,
          conversationId: activeConvId,
          senderId: m.senderId,
          type: m.type || 'TEXT',
          content: m.content,
          replyToId: m.replyToId || null,
          createdAt: m.createdAt,
          status: 'sent' as const,
        }));
        saveMessagesBulk(offlineMsgs).catch(() => {});
        setLastSyncedAt(activeConvId, new Date().toISOString()).catch(() => {});
      }

      // Marquer comme lu
      await fetch(`/api/chat/conversations/${activeConvId}/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
        credentials: 'include',
      });
      // ⭐ V6 (spec §1) — historique : marquer « distribué » (✓✓ gris) les
      //    messages d'autrui encore non livrés (reprise offline/reconnexion).
      unique
        .filter((m: any) => m.senderId !== currentUserId && !m.deliveredAt)
        .slice(-30)
        .forEach((m: any) => {
          fetch(`/api/chat/messages/${m.id}/deliver`, { method: 'POST', credentials: 'include' }).catch(() => {});
        });
    } catch (e: any) {
      console.error('loadMessages:', e);
      // ⭐ V3-1: En cas d'échec réseau, on garde le cache offline affiché
    } finally {
      setLoadingMsgs(false);
    }
  }, [activeConvId, currentUserId]);

  // ⭐ PAGINATION — Load older messages (Discord-like "Load more" button at top)
  //    Uses the backend's ?before=<messageId> cursor to fetch messages older
  //    than the current oldest one. Preserves scroll position so the user
  //    doesn't get yanked to a different position.
  const loadOlderMessages = useCallback(async () => {
    if (!activeConvId || loadingMore || !hasMoreMessages) return;
    const oldestMessage = messages[0];
    if (!oldestMessage) return;

    setLoadingMore(true);
    // Save current scroll height to restore position after prepending
    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;

    try {
      const res = await fetch(
        `/api/chat/conversations/${activeConvId}/messages?userId=${currentUserId}&limit=50&before=${oldestMessage.id}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to load older messages');
      const older = await res.json();
      if (Array.isArray(older) && older.length > 0) {
        // Deduplicate against current messages
        const existingIds = new Set(messages.map(m => m.id));
        const newOnes = older.filter((m: ChatMessage) => !existingIds.has(m.id));
        if (newOnes.length > 0) {
          setMessages(prev => [...newOnes, ...prev]);
        }
        // If backend returned fewer than 50, we've reached the beginning
        setHasMoreMessages(older.length >= 50);
      } else {
        // No older messages — we've reached the beginning
        setHasMoreMessages(false);
      }
      // Restore scroll position (after React re-renders)
      requestAnimationFrame(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = newScrollHeight - prevScrollHeight;
        }
      });
    } catch (e: any) {
      console.error('loadOlderMessages:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [activeConvId, currentUserId, messages, loadingMore, hasMoreMessages]);

  // ⭐ V5 — sauter à un message (bannière épinglés / citations) : scroll dans le
  //    CONTENEUR de messages (pas la page) + halo bleu 1,5 s. Si le message est
  //    hors fenêtre (pagination), on charge une page plus ancienne puis réessaie.
  const jumpToMessage = useCallback((messageId: string) => {
    const doJump = (el: HTMLElement, container: HTMLElement) => {
      const targetScroll = el.offsetTop - (container.clientHeight - el.offsetHeight) / 2;
      container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
      el.classList.add('ring-2', 'ring-blue-400');
      setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400'), 1500);
    };
    const el = document.querySelector(`[data-msg-id="${messageId}"]`) as HTMLElement | null;
    const container = messagesContainerRef.current;
    if (el && container) {
      doJump(el, container);
      setShowPinnedList(false);
    } else {
      toast.info('Message plus ancien — chargement…');
      loadOlderMessages().finally(() => {
        setTimeout(() => {
          const el2 = document.querySelector(`[data-msg-id="${messageId}"]`) as HTMLElement | null;
          const c = messagesContainerRef.current;
          if (el2 && c) doJump(el2, c);
          setShowPinnedList(false);
        }, 400);
      });
    }
  }, [loadOlderMessages]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ⭐ V5 (parité Yeshua) — au FOCUS de la fenêtre : rafraîchir l'avatar + les
  //    conversations (rattrapage après un onglet en veille). L'événement custom
  //    « profile-updated » (émis ailleurs dans l'app) y est aussi écouté pour
  //    resynchroniser la photo partout sans rechargement.
  useEffect(() => {
    const refreshProfileAndConvs = () => {
      loadConversations();
      if (!currentUserId) return;
      fetch(`/api/chat/profile/${currentUserId}`, { credentials: 'include' })
        .then(r => (r.ok ? r.json() : null))
        .then((p: any) => { if (p?.avatarUrl) setMyAvatarUrl(p.avatarUrl); })
        .catch(() => {});
    };
    window.addEventListener('focus', refreshProfileAndConvs);
    window.addEventListener('profile-updated', refreshProfileAndConvs as EventListener);
    return () => {
      window.removeEventListener('focus', refreshProfileAndConvs);
      window.removeEventListener('profile-updated', refreshProfileAndConvs as EventListener);
    };
  }, [loadConversations, currentUserId]);

  // ⭐ V6 — messages programmés PENDING de la conversation active :
  //    chargés à l'ouverture (bandeau ⏰ au-dessus du composer) + après
  //    chaque programmation, avec annulation possible.
  //    (Défini AVANT l'effet qui l'utilise — ordre d'exécution du render.)
  const [scheduledMessages, setScheduledMessages] = useState<any[]>([]);
  const loadScheduledMessages = useCallback(async () => {
    if (!activeConvId) { setScheduledMessages([]); return; }
    try {
      const res = await fetch(`/api/chat/conversations/${activeConvId}/scheduled?userId=${encodeURIComponent(currentUserId)}`, { credentials: 'include' });
      if (res.ok) {
        const rows = await res.json();
        setScheduledMessages(Array.isArray(rows) ? rows.filter((r: any) => r.status === 'PENDING') : []);
      }
    } catch { /* silencieux */ }
  }, [activeConvId, currentUserId]);

  const cancelScheduledMessage = async (schedId: string) => {
    try {
      const res = await fetch(`/api/chat/scheduled/${schedId}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setScheduledMessages(prev => prev.filter(m => m.id !== schedId));
      toast.success('Message programmé annulé');
    } catch (e: any) { toast.error('Échec de l\'annulation : ' + e.message); }
  };

  useEffect(() => {
    if (activeConvId) {
      setLoadingMsgs(true);
      // ⭐ V5 : reset de pagination UNE fois par changement de conversation
      //    (auparavant à chaque poll — le bouton revenait après pagination).
      freshLoadRef.current = true;
      setHasMoreMessages(true);
      loadMessages();
      // ⭐ V6 — charge aussi les messages programmés en attente de cette
      //    conversation (bandeau ⏰ au-dessus du composer + annulation)
      loadScheduledMessages();
    }
  }, [activeConvId, loadMessages, loadScheduledMessages]);

  // ⭐ V5 : le polling n'est plus qu'un filet de secours — rapide (5 s) quand
  //    le socket est déconnecté, lent (30 s) quand il est actif (le temps réel
  //    suffit). La fusion à signature dans loadMessages garantit zéro re-render
  //    quand rien n'a changé → aucune perturbation du scroll.
  useEffect(() => {
    if (!activeConvId) return;
    const interval = setInterval(() => {
      loadMessages();
    }, socket.isConnected ? 30000 : 5000);
    return () => clearInterval(interval);
  }, [activeConvId, loadMessages, socket.isConnected]);

  // ⭐ Polling : rafraîchir les conversations toutes les 15s
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  // ⭐ V3-1: Flush la queue offline au (re)connect.
  //    Quand le socket se reconnecte, on tente de renvoyer tous les messages
  //    en attente. Au montage, on tente aussi (au cas où il y en a de la session
  //    précédente, même si le socket n'est pas encore connecté on essaie en HTTP).
  const flushPendingRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    // Build the flush function once
    flushPendingRef.current = async () => {
      if (!isOfflineStoreAvailable() || !currentUserId) return;
      let pending: PendingMessage[] = [];
      try {
        pending = await getPendingMessages();
      } catch {
        return;
      }
      if (pending.length === 0) return;

      // Tentative de renvoi de chaque message en parallèle (max 5 à la fois pour éviter le flood)
      const chunks = [];
      for (let i = 0; i < pending.length; i += 5) chunks.push(pending.slice(i, i + 5));
      for (const chunk of chunks) {
        await Promise.all(chunk.map(async (p) => {
          try {
            // ⭐ V5 — E2EE au re-flush : chiffrer comme l'envoi principal quand
            //    la clé du destinataire de la conversation courante est connue.
            let contentOut = p.content;
            try {
              const otherKey = otherPublicKeyRef.current;
              if (otherKey && p.conversationId === activeConvIdRef.current && p.content.length < 400 && !isEncrypted(p.content)) {
                contentOut = await encryptMessage(p.content, otherKey);
              }
            } catch { /* repli : envoi en clair */ }
            const res = await fetch(
              `/api/chat/conversations/${p.conversationId}/messages/text`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  senderId: p.senderId,
                  content: contentOut,
                  ...(p.replyToId ? { replyToId: p.replyToId } : {}),
                }),
                credentials: 'include',
              },
            );
            if (res.ok) {
              const newMsg = await res.json();
              await markMessageSent(p.localId, newMsg.id, newMsg.createdAt).catch(() => {});
              await removePendingMessage(p.localId).catch(() => {});
              // Mettre à jour le state en remplaçant le message pending par le serveur
              setMessages(prev => prev.map(m =>
                (m as any).localId === p.localId ? newMsg : m
              ));
            } else {
              await incrementPendingAttempts(p.localId, `HTTP ${res.status}`).catch(() => {});
            }
          } catch (e: any) {
            await incrementPendingAttempts(p.localId, e.message).catch(() => {});
          }
        }));
      }
      // Rafraîchir la liste des convs si on a réussi à envoyer quelque chose
      loadConversations();
    };
  }, [currentUserId, loadConversations]);

  // Trigger flush au montage + au reconnect
  useEffect(() => {
    // Initial flush (au montage)
    if (flushPendingRef.current) flushPendingRef.current();
    // Flush au reconnect
    if (socket.isConnected && flushPendingRef.current) {
      // petite debounce pour laisser le socket se stabiliser
      const t = setTimeout(() => flushPendingRef.current?.(), 1000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [socket.isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // ⭐ V3-11: Lazy-fetch annonces when the user switches to the Annonces section.
  //   Keeps the fetched list in state so subsequent visits don't refetch.
  useEffect(() => {
    if (activeHelmSection !== 'annonces' || annoncesLoaded) return;
    setAnnoncesLoading(true);
    fetch('/api/chat/announcements?userId=' + encodeURIComponent(currentUserId) + '&limit=50')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const items = Array.isArray(data) ? data : (data?.items || data?.announcements || []);
        setAnnonces(items);
        setAnnoncesLoaded(true);
      })
      .catch(() => {
        // silent — the section shows an empty state
        setAnnoncesLoaded(true);
      })
      .finally(() => setAnnoncesLoading(false));
  }, [activeHelmSection, currentUserId, annoncesLoaded]);

  // ⭐ V3-11: Sync auto-groups (Communautés) when the user opens the Communautés section.
  //   This calls the backend's AutoGroupService.syncAutoGroups() to create
  //   CLASS/SUBJECT/ROLE/STAFF groups for the current academic year (archiving
  //   the previous year's groups). The backend dedupes — safe to call every time.
  const syncAutoGroups = useCallback(async () => {
    if (communautesSyncing) return;
    setCommunautesSyncing(true);
    setCommunautesSyncMessage(null);
    try {
      const res = await fetch('/api/chat/auto-groups/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // ⭐ Task 77 — POST sans body → 400 BFF
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setCommunautesSyncMessage(data?.message || 'Communautés synchronisées pour l\'année scolaire.');
        // Refresh conversations to show the newly created groups
        loadConversations();
      } else {
        setCommunautesSyncMessage('Synchronisation échouée — réessayez plus tard.');
      }
    } catch (e) {
      setCommunautesSyncMessage('Erreur réseau — réessayez plus tard.');
    } finally {
      setCommunautesSyncing(false);
    }
  }, [communautesSyncing, loadConversations]);

  useEffect(() => {
    // Auto-sync when the user first opens the Communautés section (once per session)
    if (activeHelmSection === 'communautes' && !communautesSyncing && !communautesSyncMessage) {
      syncAutoGroups();
    }
  }, [activeHelmSection]); // eslint-disable-line react-hooks/exhaustive-deps

  // ⭐ PRESENCE HEARTBEAT : met à jour lastActiveAt toutes les 30s
  useEffect(() => {
    if (!currentUserId) return;
    // Envoyer le premier heartbeat immédiatement
    fetch('/api/chat/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId }),
      credentials: 'include',
    }).catch(() => {});
    const interval = setInterval(() => {
      fetch('/api/chat/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
        credentials: 'include',
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [currentUserId]);

  // ⭐ PRESENCE POLLING : check online status of conversation participants every 30s
  useEffect(() => {
    if (conversations.length === 0) return;
    const allParticipantIds = new Set<string>();
    for (const conv of conversations) {
      for (const p of conv.participants) {
        if (p.userId !== currentUserId) allParticipantIds.add(p.userId);
      }
    }
    const ids = Array.from(allParticipantIds);
    if (ids.length === 0) return;
    const checkPresence = async () => {
      try {
        const res = await fetch(`/api/chat/presence?userIds=${ids.join(',')}`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        const onlineSet = new Set<string>();
        for (const item of data) {
          if (item.isOnline) onlineSet.add(item.userId);
        }
        setOnlineUsers(onlineSet);
      } catch {}
    };
    checkPresence();
    const interval = setInterval(checkPresence, 30000);
    return () => clearInterval(interval);
  }, [conversations, currentUserId]);

  // ⭐ TYPING POLLING — check who is typing in the active conversation.
  //    ⭐ FIX PERFORMANCE CONCURRENCE : le socket temps réel transmet déjà
  //    typing:start/typing:stop → quand il est CONNECTÉ, le poll HTTP n'est
  //    plus qu'un filet de sécurité lâche (30 s). Poll rapide (3 s) UNIQUEMENT
  //    quand le socket est déconnecté (réseau école instable). Avant : 2
  //    polls 3 s fixes par utilisateur (typing + appels) = 40 req/min/onglet
  //    × 20 enseignants sur le chat, pour des événements déjà reçus en
  //    temps réel.
  useEffect(() => {
    if (!activeConvId) return;
    const checkTyping = async () => {
      try {
        const res = await fetch(`/api/chat/typing?conversationId=${activeConvId}`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        // Filter out current user
        setTypingUsers((data || []).filter((t: any) => t.userId !== currentUserId));
      } catch {}
    };
    checkTyping();
    const interval = setInterval(checkTyping, socket.isConnected ? 30000 : 3000);
    return () => clearInterval(interval);
  }, [activeConvId, currentUserId, socket.isConnected]);

  // ⭐ TYPING SEND : notify server via BOTH Socket.io (real-time) AND HTTP (fallback)
  const handleTyping = useCallback(() => {
    if (!activeConvId || !currentUserId) return;
    const now = Date.now();
    // Throttle: only ping every 3 seconds
    if (now - lastTypingPingRef.current < 3000) return;
    lastTypingPingRef.current = now;
    // ⭐ Socket.io real-time (instant delivery to other participants)
    socket.startTyping(activeConvId);
    // ⭐ HTTP fallback (for when Socket.io is not connected)
    fetch('/api/chat/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: activeConvId, userId: currentUserId, isTyping: true }),
      credentials: 'include',
    }).catch(() => {});
  }, [activeConvId, currentUserId, socket]);

  // ⭐ Stop typing when user stops typing (after 5s of no input)
  const stopTypingRef = useRef<NodeJS.Timeout | null>(null);
  const handleStopTyping = useCallback(() => {
    if (!activeConvId) return;
    socket.stopTyping(activeConvId);
    if (stopTypingRef.current) clearTimeout(stopTypingRef.current);
    stopTypingRef.current = setTimeout(() => {
      socket.stopTyping(activeConvId);
      fetch('/api/chat/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeConvId, userId: currentUserId, isTyping: false }),
        credentials: 'include',
      }).catch(() => {});
    }, 5000);
  }, [activeConvId, currentUserId, socket]);

  // ⭐ AUDIO RECORDING — Full state machine with pause/resume + preview before send
  //    States: idle → recording → paused → preview → idle
  //
  //    ⭐ Why the previous code "did nothing":
  //       The MediaRecorder.onstop fired ASYNC, but at that point recordingChunksRef was empty
  //       (some browsers only fire ondataavailable AFTER stop), so the blob was empty and
  //       the upload silently failed or hit the same ur."role" backend bug.
  //
  //    ⭐ Fix:
  //       - Use recorder.start(1000) to request data every 1s (chunks accumulate reliably)
  //       - Pause/resume supported via MediaRecorder.pause()/resume()
  //       - After stop: show PREVIEW state with audio player + send/cancel buttons
  //       - Send only when user explicitly clicks "Envoyer" in preview mode

  // Reset all state — used internally (declared first to avoid TDZ)
  const cleanupRecording = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setAudioBlob(prev => {
      if (prev) setAudioBlobUrl(prevUrl => {
        if (prevUrl) URL.revokeObjectURL(prevUrl);
        return null;
      });
      return null;
    });
    setRecordingDuration(0);
    setRecordingState('idle');
    // ⭐ Stop typing indicator (was showing "typing" during recording)
    socket.stopTyping(activeConvId || '');
  }, [activeConvId, socket]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      // Pick a mimeType the browser supports — webm/opus on Chrome, mp4 on Safari
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordingChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        // Build the audio blob and create an object URL for preview
        const chunks = recordingChunksRef.current;
        if (chunks.length === 0) {
          toast.error("Enregistrement vide — aucun audio capturé. Vérifiez votre microphone.");
          cleanupRecording();
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioBlobUrl(url);
        setRecordingState('preview');
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        stream.getTracks().forEach(t => t.stop());
      };
      // ⭐ Request data every 1s — ensures chunks are collected reliably
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setRecordingState('recording');
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
      // ⭐ Broadcast "recording audio" via Socket.io
      socket.startTyping(activeConvId || ''); // Reuse typing channel — shows "typing" to others
    } catch (e: any) {
      toast.error("Impossible d'accéder au microphone : " + (e?.message || 'Permission refusée'));
      cleanupRecording();
    }
  }, [cleanupRecording]);

  const pauseRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state === 'recording') {
      rec.pause();
      setRecordingState('paused');
      // Stop the timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  }, []);

  const resumeRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state === 'paused') {
      rec.resume();
      setRecordingState('recording');
      // Restart the timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    }
  }, []);

  // Stop the recorder (without sending) → triggers onstop → PREVIEW state
  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.stop();  // Triggers onstop → builds blob → PREVIEW state
    } else {
      cleanupRecording();
    }
  }, [cleanupRecording]);

  // Cancel everything — used by the "x" cancel button
  const cancelRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      // Detach onstop so it doesn't trigger the preview state
      rec.onstop = null;
      try { rec.stop(); } catch {}
    }
    cleanupRecording();
  }, [cleanupRecording]);

  // ⭐ NOTE: sendRecordedAudio is declared AFTER handleSendAttachment
  //    to avoid a Temporal Dead Zone (TDZ) ReferenceError — useCallback's
  //    deps array is evaluated eagerly, so it would throw "Cannot access
  //    'X' before initialization" if sendRecordedAudio appeared before
  //    handleSendAttachment in the source.

  // ⭐ V5 — Moteur de scroll UNIQUE (façon Yeshua Connect — stabilité).
  //    Un seul déclencheur : un effet sur [messages, activeConvId] qui ne
  //    scrolle QUE si l'utilisateur est près du bas (isNearBottomRef, 120 px).
  //    Les anciens mécanismes concurrents (cascade setTimeout 300/800/1500 ms,
  //    ResizeObserver + queueMicrotask, effet loadingMsgs, retries rAF ×10,
  //    reset forcé de userIsNearBottom) ont été SUPPRIMÉS : ce sont eux qui
  //    créaient les allers-retours de scroll en entrant dans une conversation.
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true); // l'utilisateur est-il à moins de 120 px du bas ?
  const firstPaintRef = useRef(true);   // premier rendu de la conv → saut instantané
  const freshLoadRef = useRef(true);    // chargement frais (reset par changement de conv)

  // Réinitialiser le suivi du scroll quand on change de conversation
  useEffect(() => {
    isNearBottomRef.current = true;
    firstPaintRef.current = true;
    // ⭐ Reset mention popover when switching conversations
    setMentionQuery(null);
    setMentionStartPos(-1);
    // ⭐ V5 — vider la file d'attente de pièces jointes (les URLs d'aperçu
    //    sont révoquées pour éviter les fuites mémoire)
    clearPendingFiles();
  }, [activeConvId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ⭐ V5: Scroll le conteneur de messages (PAS la page) vers le bas.
  //    Simple et déterministe : pas de retry, pas de timers.
  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'smooth') => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const targetScroll = container.scrollHeight - container.clientHeight;
    container.scrollTo({ top: targetScroll, behavior });
  }, []);

  // Suivi passif de la position : « près du bas » = à moins de 120 px.
  //    Si l'utilisateur remonte, on n'ESSAIE JAMAIS de le rattraper (sauf
  //    s'il revient lui-même près du bas).
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 120;
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeConvId]);

  // ⭐ V5 — LE déclencheur unique : à chaque changement de messages (nouveau
  //    message, édition, réaction, polling de secours), si et seulement si
  //    l'utilisateur est près du bas → scroll.
  //
  //    ⭐ V5.1 — CORRECTIF DU « SAUT MOBILE » (bug rapporté : la barre de
  //    défilement monte/descend en boucle à l'ouverture d'un chat) :
  //    le déclencheur re-testait `loadingMsgs` dans ses deps → la transition
  //    cache→serveur relançait le scroll en 'smooth' PENDANT que les hauteurs
  //    se stabilisent (images/citations en chargement) → la cible bougeait
  //    sous l'animation → oscillation visible.
  //    Désormais le comportement 'smooth' est réservé à l'arrivée d'un
  //    VRAI nouveau message (même page + longueur croissante) ; tout le
  //    reste (premier rendu, swap cache→serveur, accusés de lecture,
  //    rafraîchissements de polling) scrolle en 'auto' INVISIBLE.
  const lastMsgCountRef = useRef(0);
  const lastTopMsgIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (messages.length === 0) {
      lastMsgCountRef.current = 0;
      lastTopMsgIdRef.current = null;
      return;
    }
    if (!isNearBottomRef.current) return;
    const topId = (messages[0] as any)?.id ?? null;
    // « Vrai nouveau message » = la liste s'allonge SANS que la page
    // change (même message le plus ancien) → c'est un ajout en bas.
    const isNewMessage =
      lastTopMsgIdRef.current === topId &&
      messages.length > lastMsgCountRef.current &&
      lastMsgCountRef.current > 0;
    const instant = firstPaintRef.current || loadingMsgs || !isNewMessage;
    requestAnimationFrame(() => scrollToBottom(instant ? 'auto' : 'smooth'));
    firstPaintRef.current = false;
    lastMsgCountRef.current = messages.length;
    lastTopMsgIdRef.current = topId;
  }, [messages, activeConvId, loadingMsgs, scrollToBottom]);

  // ⭐ FIX: Click-outside listener to auto-close the action menu and reaction bar
  useEffect(() => {
    if (!activeMenuMsgId && !showReactionBar) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Close action menu if click is outside any .msg-action-menu
      if (activeMenuMsgId && !target.closest('.msg-action-menu') && !target.closest('[data-msg-action-trigger]')) {
        setActiveMenuMsgId(null);
      }
      // Close reaction bar if click is outside
      if (showReactionBar && !target.closest('.msg-reaction-bar')) {
        setShowReactionBar(null);
        setReactionBarPos(null);
      }
    };
    // Use a tiny delay so the same click that opened the menu doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeMenuMsgId, showReactionBar]);

  // ⭐ FIX: Reply quote cache — fetch parent message preview for messages with replyToId
  const [replyQuoteCache, setReplyQuoteCache] = useState<Record<string, { senderName: string; content: string }>>({});
  useEffect(() => {
    // For any message with replyToId that's not yet in cache, find it in the current messages list
    const toFetch = messages.filter((m: any) => m.replyToId && !replyQuoteCache[m.replyToId]);
    if (toFetch.length === 0) return;
    // Look in the current messages list first (most parent messages are already loaded)
    const msgById = new Map(messages.map((m: any) => [m.id, m]));
    const newEntries: Record<string, { senderName: string; content: string }> = {};
    for (const m of toFetch) {
      const parent = msgById.get((m as any).replyToId);
      if (parent) {
        newEntries[(m as any).replyToId] = {
          senderName: `${parent.senderFirstName || parent.sender?.firstName || ''} ${parent.senderLastName || parent.sender?.lastName || ''}`.trim() || 'Utilisateur',
          content: stripHtml(parent.content) || (parent.type === 'AUDIO' ? '🎤 Message vocal' : parent.type === 'IMAGE' ? '📷 Image' : parent.type === 'DOCUMENT' ? '📎 Document' : 'Message'),
        };
      }
    }
    if (Object.keys(newEntries).length > 0) {
      setReplyQuoteCache(prev => ({ ...prev, ...newEntries }));
    }
  }, [messages, replyQuoteCache]);

  // ───────────────────────────────────────────────────────────────────
  // ⭐ 2026-10-14 — Slash command selection (porté de Yeshua Connect)
  //    Appelé quand l'utilisateur clique/valide une commande dans le popover.
  //    Pour les commandes sans args (/poll, /announce, /clear, /help) on déclenche
  //    l'action immédiatement ; pour les autres (/me, /shrug, etc.) on insère le
  //    squelette dans l'éditeur (l'utilisateur complète les args puis appuie sur Entrée).
  // ───────────────────────────────────────────────────────────────────
  const handleSlashCommandSelect = useCallback((cmdName: string, _args: string) => {
    // Commandes spéciales (sans args) : déclenchement immédiat
    if (cmdName === 'poll') {
      setText('');
      setReplyToMessage(null);
      setShowPollModal(true);
      setShowSlashPopover(false);
      return;
    }
    if (cmdName === 'announce') {
      setText('');
      setReplyToMessage(null);
      setShowAnnouncements(true);
      setShowSlashPopover(false);
      return;
    }
    if (cmdName === 'clear') {
      setText('');
      setReplyToMessage(null);
      setMessages([]);
      setShowSlashPopover(false);
      toast.success('Messages effacés');
      return;
    }
    if (cmdName === 'help') {
      // /help → on envoie directement le texte d'aide
      const helpText = HELM_COMMANDS
        .map((c) => `${c.icon} /${c.name}${c.usage.replace('/' + c.name, '') ? ' ' + c.usage.replace('/' + c.name, '').trim() : ''} — ${c.description}`)
        .join('\n');
      setText(helpText);
      setShowSlashPopover(false);
      // L'utilisateur appuie sur Entrée pour envoyer, ou on peut auto-send :
      // on laisse l'utilisateur relire puis valider.
      return;
    }
    // Commandes avec args (/me, /shrug, /tableflip, /unflip, /lenny, /spoiler, /code) :
    // on insère le squelette "/cmd " dans l'éditeur pour que l'utilisateur
    // complète les args puis envoie avec Entrée (le parseSlashCommand existant
    // fera la transformation au send).
    setText(`/${cmdName} `);
    setShowSlashPopover(false);
    // Focus back to editor
    setTimeout(() => {
      const textarea = document.querySelector('textarea[placeholder^="Tapez un message"]') as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.focus();
        // Place cursor at end
        const len = textarea.value.length;
        textarea.setSelectionRange(len, len);
      }
    }, 50);
  }, [setShowPollModal, setShowAnnouncements, setShowSlashPopover, setText, setReplyToMessage, setMessages]);

  // ───────────────────────────────────────────────────────────────────
  // Send text message (with optional reply-to + formatting preserved)
  // ───────────────────────────────────────────────────────────────────
  const handleSendText = async () => {
    // ⭐ Strip HTML tags to check if there's actual text content
    const textContent = text.replace(/<[^>]*>/g, '').trim();
    if (!activeConvId || !textContent || sending) return;
    // ⭐ If user has a pending audio preview, cancel it first (don't lose the text)
    if (recordingState === 'preview') {
      cancelRecording();
    }

    // ⭐ DISCORD PARITY: Slash commands (/me, /shrug, /tableflip, /poll, /announce, etc.)
    const parsed = parseSlashCommand(text);
    if (parsed.isCommand) {
      if (parsed.special === 'poll') {
        setText('');
        setReplyToMessage(null);
        setShowPollModal(true);
        return;
      }
      if (parsed.special === 'announce') {
        setText('');
        setReplyToMessage(null);
        setShowAnnouncements(true);
        return;
      }
      if (parsed.special === 'clear') {
        setText('');
        setReplyToMessage(null);
        setMessages([]);
        toast.success('Messages effacés');
        return;
      }
      // For regular slash commands (/me, /shrug, etc.), replace the content
      // with the command output and continue with the normal send flow.
      if (parsed.content) {
        setText(parsed.content);
        // The send continues below with the new content.
      }
    }

    const content = (parsed.isCommand && parsed.content) ? parsed.content : text.trim();
    const replyToId = replyToMessage?.id || undefined;
    setText('');
    setReplyToMessage(null);
    setSending(true);

    // ⭐ V3-1: Créer un message local "pending" pour affichage immédiat
    const localId = generateLocalId();
    const now = new Date().toISOString();
    const localMessage: any = {
      id: localId, // temporaire — remplacé par l'id serveur après envoi
      conversationId: activeConvId,
      senderId: currentUserId,
      type: 'TEXT',
      content,
      replyToId: replyToId || null,
      createdAt: now,
      localId,
      status: 'pending',
    };

    // Afficher immédiatement dans l'UI + sauvegarder dans le cache offline + queue
    setMessages(prev => [...prev, localMessage]);
    if (isOfflineStoreAvailable()) {
      saveOfflineMessage(localMessage as OfflineChatMessage).catch(() => {});
      addPendingMessage({
        localId,
        conversationId: activeConvId,
        senderId: currentUserId,
        content,
        replyToId: replyToId || null,
        queuedAt: now,
        attempts: 0,
      }).catch(() => {});
    }

    try {
      // ⭐ MENTIONS: extract mentioned user IDs from the message content
      //    so the backend can send push notifications to mentioned users.
      const mentionedUserIds = activeConv
        ? extractMentionedUserIds(content, activeConv.participants as any, currentUserId)
        : [];
      // ⭐ V5 — E2EE : chiffrement DESTINATAIRE en conversation DIRECTE (clés
      //    des deux côtés). La copie locale (optimiste + cache offline) reste
      //    en clair pour l'affichage côté expéditeur.
      let contentToSend = content;
      if (e2eAvailable && otherPublicKey && content.length < 400) {
        try { contentToSend = await encryptMessage(content, otherPublicKey); } catch { /* repli clair */ }
      }
      const res = await fetch(`/api/chat/conversations/${activeConvId}/messages/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUserId,
          content: contentToSend,
          ...(replyToId ? { replyToId } : {}),
          ...(mentionedUserIds.length > 0 ? { mentionedUserIds } : {}),
        }),
        credentials: 'include',
      });
      if (!res.ok) {
        // ⭐ Get verbose backend error message for diagnostics
        const errData = await res.json().catch(() => ({}));
        const msg = (errData as any)?.backendError?.message
          || (errData as any)?.message
          || (errData as any)?.error
          || `Erreur ${res.status}`;
        throw new Error(msg);
      }
      const newMsg = await res.json();

      // ⭐ V3-1: Marquer comme envoyé dans le cache offline + retirer de la queue
      if (isOfflineStoreAvailable()) {
        markMessageSent(localId, newMsg.id, newMsg.createdAt).catch(() => {});
        removePendingMessage(localId).catch(() => {});
      }

      // Remplacer le message local par le message serveur dans l'UI
      setMessages(prev => prev.map(m => (m as any).localId === localId ? newMsg : m));
      // Rafraîchir la liste des convs pour updater le preview
      loadConversations();
    } catch (e: any) {
      toast.error("Échec d'envoi du message: " + e.message);
      // ⭐ V3-1: Garder le message dans la queue offline pour retry au reconnect.
      //    On le laisse affiché avec status "pending" (pas "failed") pour indiquer
      //    que le retry est en cours. On ne restaure PAS le texte dans l'input car
      //    le message est déjà affiché dans la conversation.
      if (isOfflineStoreAvailable()) {
        incrementPendingAttempts(localId, e.message).catch(() => {});
      }
    } finally {
      setSending(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────
  // Insert Markdown format around selection or at cursor
  // ───────────────────────────────────────────────────────────────────
  const insertFormat = (marker: string) => {
    const textarea = document.querySelector('textarea[placeholder="Tapez un message..."]') as HTMLTextAreaElement;
    if (!textarea) {
      // Fallback: just append the marker
      setText(prev => prev + marker + marker);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + marker + (selectedText || 'texte') + marker + after;
    setText(newText);
    // Set cursor position after the inserted text
    setTimeout(() => {
      textarea.focus();
      const newPos = start + marker.length + (selectedText || 'texte').length + marker.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // ───────────────────────────────────────────────────────────────────
  // Message actions (reply/forward/delete/pin/copy)
  // ───────────────────────────────────────────────────────────────────
  // ⭐ V5 — Envoyer une réponse DANS LE FIL (replyToId = parent). Logique
  //    AUTONOME (le composer principal lit l'état `text` ; le fil a son
  //    propre champ) : optimisme + queue offline + mentions, comme
  //    handleSendText mais avec paramètres explicites (pas de closure périmée).
  const sendThreadReply = async () => {
    const content = threadDraft.trim();
    if (!content || !threadParentId || !activeConvId || sending) return;
    setThreadDraft('');
    setSending(true);
    const localId = generateLocalId();
    const now = new Date().toISOString();
    const localMessage: any = {
      id: localId,
      conversationId: activeConvId,
      senderId: currentUserId,
      type: 'TEXT',
      content,
      replyToId: threadParentId,
      createdAt: now,
      localId,
      status: 'pending',
    };
    setMessages(prev => [...prev, localMessage]);
    if (isOfflineStoreAvailable()) {
      saveOfflineMessage(localMessage as OfflineChatMessage).catch(() => {});
      addPendingMessage({
        localId,
        conversationId: activeConvId,
        senderId: currentUserId,
        content,
        replyToId: threadParentId,
        queuedAt: now,
        attempts: 0,
      }).catch(() => {});
    }
    try {
      const mentionedUserIds = activeConv
        ? extractMentionedUserIds(content, activeConv.participants as any, currentUserId)
        : [];
      // ⭐ V5 — E2EE (même logique que handleSendText)
      let contentToSend = content;
      if (e2eAvailable && otherPublicKey && content.length < 400) {
        try { contentToSend = await encryptMessage(content, otherPublicKey); } catch { /* repli clair */ }
      }
      const res = await fetch(`/api/chat/conversations/${activeConvId}/messages/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUserId,
          content: contentToSend,
          replyToId: threadParentId,
          ...(mentionedUserIds.length > 0 ? { mentionedUserIds } : {}),
        }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const newMsg = await res.json();
      if (isOfflineStoreAvailable()) {
        markMessageSent(localId, newMsg.id, newMsg.createdAt).catch(() => {});
        removePendingMessage(localId).catch(() => {});
      }
      setMessages(prev => prev.map(m => (m as any).localId === localId ? newMsg : m));
      loadConversations();
    } catch (e: any) {
      toast.error("Échec d'envoi : " + e.message);
      if (isOfflineStoreAvailable()) incrementPendingAttempts(localId, e.message).catch(() => {});
    } finally {
      setSending(false);
    }
  };

  const handleMessageReply = (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    setReplyToMessage({
      id: messageId,
      senderName: `${msg.senderFirstName || ''} ${msg.senderLastName || ''}`.trim() || 'Utilisateur',
      content: stripHtml(msg.content) || (msg.type === 'AUDIO' ? '🎤 Message vocal' : msg.type === 'IMAGE' ? '📷 Image' : msg.type === 'DOCUMENT' ? '📎 Document' : 'Message'),
    });
    // Focus the text input
    setTimeout(() => {
      const textarea = document.querySelector('textarea[placeholder="Tapez un message..."]') as HTMLTextAreaElement;
      textarea?.focus();
    }, 100);
  };

  const handleMessageForward = async (messageId: string) => {
    // ⭐ V1.5: implemented forward — opens a conversation picker modal
    //    The modal lists the user's conversations and lets them pick one.
    //    The backend POST /api/chat/messages/:id/forward copies the message.
    setForwardMessageId(messageId);
  };

  // ⭐ V1.5: Message reactions
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      await fetch(`/api/chat/messages/${messageId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, emoji }),
        credentials: 'include',
      });
      // Optimistic update — toggle the reaction locally
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        const existing = (m as any).reactions || [];
        const alreadyReacted = existing.some((r: any) => r.userId === currentUserId && r.emoji === emoji);
        const updatedReactions = alreadyReacted
          ? existing.filter((r: any) => !(r.userId === currentUserId && r.emoji === emoji))
          : [...existing, { emoji, userId: currentUserId, firstName: user?.firstName, lastName: user?.lastName }];
        return { ...m, reactions: updatedReactions };
      }));
      // ⭐ V3-11: Don't close the reaction bar after applying — keep it visible
      //   so the user can react with multiple emojis. The bar closes via the
      //   click-outside listener (defined below) when the user clicks elsewhere.
    } catch (e: any) {
      toast.error('Échec réaction: ' + e.message);
    }
  };

  // ⭐ FIX: Long-press handler for mobile reaction bar (WhatsApp style)
  const handleMessageLongPress = (msg: any, e: React.MouseEvent | React.TouchEvent) => {
    if (isReadOnly) return;
    // ⭐ MOBILE: Haptic feedback (vibration) when long-pressing a message.
    //    navigator.vibrate is supported on Android Chrome; ignored on iOS Safari
    //    (which doesn't support the Vibration API). Wrapped in try/catch so it
    //    never throws on unsupported browsers.
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(20);
      }
    } catch { /* ignore — not supported on all browsers */ }
    // Get position from event
    let x = 0, y = 0;
    if ('clientX' in e) {
      x = e.clientX;
      y = e.clientY;
    } else if ('touches' in e && e.touches.length > 0) {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    }
    // Position the reaction bar above the message, centered on the click point
    setReactionBarPos({ x, y });
    setShowReactionBar(msg.id);
    // Also open the action menu
    setActiveMenuMsgId(null);
  };

  // ⭐ FIX: Start long-press timer on touch start
  const handleTouchStart = (msg: any, e: React.TouchEvent) => {
    if (isReadOnly) return;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      handleMessageLongPress(msg, e);
    }, 500); // 500ms long-press
  };

  // ⭐ FIX: Cancel long-press on touch end / move
  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // ⭐ V1.5: Message edit
  const handleMessageEdit = async (messageId: string, newContent: string) => {
    try {
      const res = await fetch(`/api/chat/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, content: newContent }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent, editedAt: new Date().toISOString() } : m));
      toast.success('Message modifié');
    } catch (e: any) {
      toast.error('Échec: ' + e.message);
    }
  };

  // ⭐ V1.5: Mark message as important
  const handleToggleImportant = async (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    const isImportant = !!(msg as any).isImportant;
    try {
      await fetch(`/api/chat/messages/${messageId}/important`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, isImportant: !isImportant }),
        credentials: 'include',
      });
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isImportant: !isImportant } : m));
      toast.success(isImportant ? 'Message marqué comme normal' : 'Message marqué comme important');
    } catch (e: any) {
      toast.error('Échec: ' + e.message);
    }
  };

  const handleMessageDeleteForMe = async (messageId: string) => {
    // ⭐ Issue 1: custom confirmation modal (warning style — amber)
    const ok = await warning(
      'Ce message sera supprimé uniquement pour vous. Les autres participants le verront encore.',
      'Supprimer pour moi ?',
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/chat/conversations/${activeConvId}/messages/${messageId}/delete-for-me`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      // Remove from local state
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast.success('Message supprimé pour vous');
    } catch (e: any) {
      toast.error('Échec : ' + e.message);
    }
  };

  const handleMessageDeleteForEveryone = async (messageId: string) => {
    // ⭐ Issue 1: custom confirmation modal (danger style — red, destructive)
    const ok = await danger(
      'Ce message sera supprimé pour TOUS les participants. Cette action est irréversible.',
      'Supprimer pour tout le monde ?',
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/chat/conversations/${activeConvId}/messages/${messageId}/delete-for-everyone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      // ⭐ V5 (parité Yeshua) — retrait IMMÉDIAT de la bulle (comme Yeshua) :
      //    avant, on marquait seulement deletedAt SANS aucune logique de rendu
      //    → le message restait affiché jusqu'au prochain polling.
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast.success('Message supprimé pour tous');
    } catch (e: any) {
      toast.error('Échec : ' + e.message);
    }
  };

  const handleMessagePin = async (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;
    const isPinned = !!(msg as any).isPinned;
    try {
      const endpoint = isPinned ? 'unpin' : 'pin';
      const res = await fetch(`/api/chat/v2/messages/${messageId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isPinned: !isPinned } : m));
      toast.success(isPinned ? 'Message désépinglé' : 'Message épinglé');
    } catch (e: any) {
      toast.error('Échec : ' + e.message);
    }
  };

  // ───────────────────────────────────────────────────────────────────
  // Send attachment (document, image, audio)
  // ───────────────────────────────────────────────────────────────────
  // ⭐ Helper: get absolute URL for attachment (prepend backend URL if relative)
  // ⭐ Issue 2 + 5 FIX: backend serves files under /api/chat/files/* via a dedicated
  //    NestJS controller (FileServingController) that streams files from the
  //    public/ folder. This bypasses the express.static middleware that wasn't
  //    being invoked (NestJS router was intercepting and returning 404 first).
  //    Format expected: '/chat/audio/uuid-file.webm' (relative path stored in DB)
  //    → 'https://api.academiahelm.com/api/chat/files/chat/audio/uuid-file.webm'
  const getAttachmentUrl = (url?: string): string => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url; // Absolute (R2/S3)
    // Relative path from backend (local storage) — prepend /api/chat/files/
    // to route through the NestJS FileServingController endpoint.
    const path = url.startsWith('/') ? url : `/${url}`;
    // Avoid double-prefixing if the path already starts with /api/chat/files/
    if (path.startsWith('/api/chat/files/')) {
      return `${getBackendBaseUrl()}${path}`;
    }
    return `${getBackendBaseUrl()}/api/chat/files${path}`;
  };

  // ⭐ Helper: get file-type icon based on MIME or filename
  const getFileTypeIcon = (mime?: string, name?: string) => {
    const ext = (name?.split('.').pop() || '').toLowerCase();
    const m = (mime || '').toLowerCase();
    // ⭐ Official-style colored badges with label text (like Telegram/WhatsApp)
    //    Uses background color + white text for file-type chips
    if (m.includes('pdf') || ext === 'pdf') return {
      icon: <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">PDF</div>,
      label: 'PDF Document'
    };
    if (m.includes('word') || ext === 'doc' || ext === 'docx') return {
      icon: <div className="w-10 h-10 rounded-lg bg-blue-700 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">DOC</div>,
      label: 'Word Document'
    };
    if (m.includes('sheet') || m.includes('excel') || ext === 'xls' || ext === 'xlsx') return {
      icon: <div className="w-10 h-10 rounded-lg bg-green-700 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">XLS</div>,
      label: 'Excel Spreadsheet'
    };
    if (m.includes('presentation') || ext === 'ppt' || ext === 'pptx') return {
      icon: <div className="w-10 h-10 rounded-lg bg-orange-600 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">PPT</div>,
      label: 'PowerPoint'
    };
    if (m.includes('zip') || m.includes('compressed') || ext === 'zip' || ext === 'rar' || ext === '7z') return {
      icon: <div className="w-10 h-10 rounded-lg bg-amber-600 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">ZIP</div>,
      label: 'Archive'
    };
    if (m.includes('image/') || ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'webp') return {
      icon: <ImageIcon className="w-5 h-5 text-purple-600 flex-shrink-0" />,
      label: 'Image'
    };
    if (m.includes('audio/') || ext === 'mp3' || ext === 'wav' || ext === 'ogg' || ext === 'webm' || ext === 'm4a') return {
      icon: <Mic className="w-5 h-5 text-pink-600 flex-shrink-0" />,
      label: 'Audio'
    };
    if (m.includes('video/') || ext === 'mp4' || ext === 'avi' || ext === 'mov') return {
      icon: <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">MP4</div>,
      label: 'Vidéo'
    };
    return {
      icon: <FileText className="w-5 h-5 text-slate-600 flex-shrink-0" />,
      label: 'Fichier'
    };
  };

  // ⭐ V2: Image compression — resize images >2MB before upload (saves R2 storage + bandwidth)
  const compressImage = async (file: File): Promise<File> => {
    if (file.size < 2 * 1024 * 1024) return file;
    return new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = e => {
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxSize = 1920;
          let { width, height } = img;
          if (width > height && width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
          else if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(blob => {
            resolve(blob ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }) : file);
          }, 'image/jpeg', 0.85);
        };
      };
      reader.readAsDataURL(file);
    });
  };

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V4 — ORCHESTRATION DE LA CHAÎNE MÉDIA (porté de Yeshua Connect)
  // ═════════════════════════════════════════════════════════════════

  /** Déconnecte la session média courante (fin d'appel / failover). */
  const disconnectMediaSession = useCallback(() => {
    try { mediaSessionRef.current?.disconnect(); } catch {}
    mediaSessionRef.current = null;
    setMediaParticipants([]);
    setActiveSpeakers(new Set());
    setMediaProvider(null);
    setMediaSwitching(false);
  }, []);

  /**
   * Connecte la chaîne média d'un appel : join bundle (arbitrage serveur
   * LiveKit → Agora → Daily) → création de session bornée 12 s → câblage
   * des events (participants, locuteurs actifs, déconnexion → failover).
   * ⚠️ JETTE ChainExhaustedError quand la chaîne est épuisée → l'appelant
   * retombe sur le mesh WebRTC existant (Plan C).
   */
  const connectMediaChain = useCallback(async (opts: {
    kind: 'call' | 'voice';
    conversationId: string;
    callId?: string;
    video: boolean;
    onConnected?: () => void;
    onRemoteJoined?: () => void;
    onEnded?: (reason: string) => void;
  }): Promise<void> => {
    // 1. Join bundle — le serveur arbitre le fournisseur pour TOUT le monde
    const bundle = await withTimeout(
      fetchMediaJoin(opts.kind, opts.conversationId, opts.callId),
      12000,
      'join-bundle',
    );
    if (bundle.exhausted) {
      throw new ChainExhaustedError(bundle.reason || 'Chaîne multimédia épuisée');
    }

    // 2. Création de session (bornée — un fournisseur muet = échec = failover)
    const createSession = async (b: typeof bundle): Promise<MediaSessionHandle> => {
      const session = await withTimeout(
        createMediaSession(
          b,
          {
            video: opts.video,
            participantName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Utilisateur',
            resolveUser: (identity: string) => {
              const p = activeConv?.participants?.find((pp: any) => pp.userId === identity);
              return p ? { name: `${p.firstName || ''} ${p.lastName || ''}`.trim() } : undefined;
            },
          },
          {
            onParticipants: (participants) => {
              setMediaParticipants(participants);
              if (participants.length > 0 && callStateRef.current === 'outgoing') {
                opts.onRemoteJoined?.();
              }
            },
            onActiveSpeakers: (ids) => setActiveSpeakers(ids),
            onDisconnected: async (reason) => {
              // Failover serveur : l'appel avance au fournisseur SUIVANT —
              // max 3 tentatives puis repli mesh (géré par le caller via
              // ChainExhaustedError).
              if (failoverAttemptsRef.current >= 3) {
                opts.onEnded?.(reason);
                return;
              }
              failoverAttemptsRef.current += 1;
              setMediaSwitching(true);
              try {
                disconnectMediaSession();
                const next = await withTimeout(
                  fetchMediaFailover(opts.kind, opts.conversationId, opts.callId, b.provider, reason),
                  12000,
                  'failover',
                );
                if (next.exhausted) {
                  setMediaSwitching(false);
                  opts.onEnded?.('Chaîne multimédia épuisée');
                  return;
                }
                const session2 = await createSession(next);
                mediaSessionRef.current = session2;
                setMediaProvider(next.provider);
                opts.onConnected?.();
              } catch {
                setMediaSwitching(false);
                opts.onEnded?.(reason);
              } finally {
                setMediaSwitching(false);
              }
            },
          },
        ),
        12000,
        'media-session',
      );
      return session;
    };

    const session = await createSession(bundle);
    mediaSessionRef.current = session;
    setMediaProvider(bundle.provider);
    opts.onConnected?.();
  }, [activeConv, user, disconnectMediaSession]);

  /**
   * ⭐ V4 — Lancer un appel (web) : signalisation serveur (ringing, missed
   * sweep, journaux CALL_LOG, push) PUIS chaîne média. Si la chaîne est
   * épuisée (aucun fournisseur configuré), repli sur le mesh WebRTC
   * historique (compatible mobile Flutter).
   */
  const handleStartCall = async (callType: 'AUDIO' | 'VIDEO') => {
    if (!activeConvId || callState !== 'idle') {
      // ⭐ V5 (parité Yeshua) — feedback visible quand un appel est déjà en cours
      if (callState !== 'idle' || incomingSignal) toast.info('Un appel est déjà en cours');
      return;
    }
    const other = activeConv?.participants?.find(p => p.userId !== currentUserId);
    if (!other) return;
    const otherName = `${other.firstName || ''} ${other.lastName || ''}`.trim() || other.email || 'Utilisateur';
    const myName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Utilisateur';
    const myAvatarUrl = (user as any)?.avatarUrl || (user as any)?.photoUrl || null;

    // 1. Créer le signal d'appel (source de vérité côté serveur)
    let sigId: string | null = null;
    try {
      const res = await fetch('/api/chat/calls/signal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', conversationId: activeConvId, type: callType === 'VIDEO' ? 'video' : 'audio' }),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        sigId = data.callId || null;
      }
    } catch (e: any) {
      console.warn('Signal start failed (continuing en mesh):', e.message);
    }

    // 2. Tenter la chaîne média (LiveKit → Agora → Daily)
    if (sigId) {
      failoverAttemptsRef.current = 0;
      setSignalCallId(sigId);
      setV4CallInfo({
        callId: sigId,
        callType,
        title: otherName,
        subtitle: activeConv?.type === 'GROUP' ? activeConv.name : undefined,
        avatarUrl: (other as any).avatarUrl || null,
        isGroup: activeConv?.type === 'GROUP',
        isInitiator: true,
        conversationId: activeConvId,
      });
      setCallData({ callId: sigId, callType, otherUserId: other.userId, otherUserName: otherName });
      setCallState('outgoing');
      try {
        await connectMediaChain({
          kind: 'call',
          conversationId: activeConvId,
          callId: sigId,
          video: callType === 'VIDEO',
          onRemoteJoined: () => {
            if (callStateRef.current !== 'active') {
              setCallState('active');
              if (!callTimerRef.current) {
                callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
              }
            }
          },
          onEnded: (reason) => {
            toast.info(`Appel interrompu (${reason}) — passage en réseau direct`);
            // La chaîne est morte → repli mesh : l'offre part via le socket
            handleStartCallMesh(callType);
          },
        });
        return; // ⭐ Chaîne connectée : l'appel vit sur le SFU
      } catch (e: any) {
        if (e instanceof ChainExhaustedError) {
          toast.info('Réseau direct navigateur-à-navigateur (mesh WebRTC)');
        } else {
          console.warn('Media chain failed, falling back to mesh:', e.message);
        }
        // Nettoyer l'état V4 avant le repli mesh
        setSignalCallId(null);
        setV4CallInfo(null);
        setCallState('idle');
        setCallData(null);
        disconnectMediaSession();
      }
    }

    // 3. Repli mesh WebRTC (flux historique — compatible mobile Flutter)
    await handleStartCallMesh(callType);
  };

  /**
   * ⭐ V2.5 (historique) : Start a call via mesh WebRTC navigateur-à-navigateur.
   * Conservé comme Plan C (chaîne épuisée / appelant mobile).
   */
  const handleStartCallMesh = async (callType: 'AUDIO' | 'VIDEO') => {
    if (!activeConvId || callState !== 'idle') return;
    const other = activeConv?.participants?.find(p => p.userId !== currentUserId);
    if (!other) return;
    const otherName = `${other.firstName || ''} ${other.lastName || ''}`.trim() || other.email || 'Utilisateur';
    const myName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Utilisateur';
    const myAvatarUrl = (user as any)?.avatarUrl || (user as any)?.photoUrl || null;

    try {
      // 1. Create call record in DB
      const res = await fetch(`/api/chat/conversations/${activeConvId}/call`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callerId: currentUserId, callType }),
        credentials: 'include',
      });
      const data = await res.json();
      const callId = data.callId;

      // 2. Get local media stream
      //    ⭐ DISCORD PARITY: Noise suppression — request the browser to apply
      //    echoCancellation, noiseSuppression, and autoGainControl for cleaner
      //    audio (similar to Discord's Krisp noise suppression, but using the
      //    browser's built-in WebRTC audio processing).
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: callType === 'VIDEO',
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // 3. Set up WebRTC peer connection + create offer
      const pc = setupPeerConnection(other.userId, callId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 4. Send offer to callee via Socket.io — include callerName + callerAvatarUrl
      if (socket) {
        socket.emit('call:offer', {
          toUserId: other.userId, callId, callType, offer,
          callerName: myName,
          callerAvatarUrl: myAvatarUrl,
        });
      }

      setCallData({ callId, callType, otherUserId: other.userId, otherUserName: otherName });
      setCallState('outgoing');
    } catch (e: any) {
      toast.error('Échec appel: ' + e.message);
      cleanupCall();
    }
  };

  /**
   * ⭐ V4 — Appel de GROUPE via la chaîne média (LiveKit SFU passe à
   * l'échelle au-delà de 5 participants). Signalisation serveur (sonnerie
   * chez tous les membres + overlay Accepter/Refuser) puis room partagée
   * helm-call-<convId>. Repli mesh si la chaîne est épuisée.
   */
  const handleStartGroupCall = async (callType: 'AUDIO' | 'VIDEO') => {
    if (!activeConvId || !activeConv || activeConv.type !== 'GROUP') return;
    setShowGroupCallModal(false);

    // 1. Signal serveur — sonne pour TOUS les membres (pas seulement les
    //    sélectionnés : quiconque décroche rejoint la room partagée)
    let sigId: string | null = null;
    try {
      const res = await fetch('/api/chat/calls/signal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', conversationId: activeConvId, type: callType === 'VIDEO' ? 'video' : 'audio' }),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        sigId = data.callId || null;
      }
    } catch (e: any) {
      console.warn('Signal start (group) failed:', e.message);
    }

    if (sigId) {
      failoverAttemptsRef.current = 0;
      setSignalCallId(sigId);
      setV4CallInfo({
        callId: sigId,
        callType,
        title: activeConv.name || 'Appel de groupe',
        subtitle: `${(activeConv.participants || []).length} participants`,
        avatarUrl: (activeConv as any).avatarUrl || null,
        isGroup: true,
        isInitiator: true,
        conversationId: activeConvId,
      });
      setCallData({ callId: sigId, callType, otherUserId: '', otherUserName: activeConv.name || 'Appel de groupe' });
      setCallState('outgoing');
      try {
        await connectMediaChain({
          kind: 'call',
          conversationId: activeConvId,
          callId: sigId,
          video: callType === 'VIDEO',
          onRemoteJoined: () => {
            if (callStateRef.current !== 'active') {
              setCallState('active');
              if (!callTimerRef.current) {
                callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
              }
            }
          },
          onEnded: (reason) => {
            toast.info(`Appel interrompu (${reason}) — passage en réseau direct`);
            setSignalCallId(null);
            setV4CallInfo(null);
            setCallState('idle');
            setCallData(null);
            disconnectMediaSession();
            handleStartGroupCallMesh(callType);
          },
        });
        return; // ⭐ SFU connecté
      } catch (e: any) {
        if (e instanceof ChainExhaustedError) {
          toast.info('Réseau direct navigateur-à-navigateur (mesh WebRTC)');
        } else {
          console.warn('Media chain (group) failed, falling back to mesh:', e.message);
        }
        setSignalCallId(null);
        setV4CallInfo(null);
        setCallState('idle');
        setCallData(null);
        disconnectMediaSession();
      }
    }

    // ⭐ V5 — PLAN C (parité Yeshua) : appel de GROUPE au-delà de la limite
    //    mesh (5 participants) avec chaîne épuisée → room Jitsi déterministe
    //    (« Mode secours ») au lieu d'un échec silencieux.
    const totalCallSize = (groupCallParticipants.size || 0) + 1;
    if (totalCallSize > 5) {
      setSignalCallId(null);
      setV4CallInfo(null);
      setCallState('idle');
      setCallData(null);
      disconnectMediaSession();
      setJitsiFallback({
        room: jitsiRoomFor('call', activeConvId),
        title: activeConv.name || 'Appel de groupe',
      });
      toast.info('Réseau de secours Jitsi (grand groupe)');
      return;
    }

    await handleStartGroupCallMesh(callType);
  };

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V5 (parité Yeshua) — ACTIONS MEMBRE : DM / appel / blocage depuis
  //  la fiche membre du panneau latéral
  // ═════════════════════════════════════════════════════════════════

  /** Ouvrir/créer le DM avec un membre croisé dans un groupe (fiche membre). */
  const openDirectMessage = useCallback(async (userId: string) => {
    try {
      const res = await fetch('/api/chat/conversations/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUserId, otherUserId: userId }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.message || (err as any)?.error || `Erreur ${res.status}`);
      }
      const conv = await res.json();
      setMemberProfile(null);
      setActiveConvId(conv.id);
      await loadConversations();
    } catch (e: any) {
      toast.error("Impossible d'ouvrir la conversation : " + e.message);
    }
  }, [currentUserId, loadConversations]);

  /** Appeler un membre croisé : crée/ouvre le DM PUIS lance l'appel dessus. */
  const callMemberDirect = useCallback((userId: string, callType: 'AUDIO' | 'VIDEO') => {
    setMemberProfile(null);
    openDirectMessage(userId).then(() => {
      setTimeout(() => handleStartCall(callType), 300);
    });
  }, [openDirectMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Bloquer/débloquer un membre (POST/DELETE /api/chat/blocks/:userId). */
  const toggleBlockMember = useCallback(async (userId: string) => {
    const wasBlocked = blockedUserIds.has(userId);
    try {
      const res = await fetch(`/api/chat/blocks/${userId}`, {
        method: wasBlocked ? 'DELETE' : 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setBlockedUserIds(prev => {
        const n = new Set(prev);
        if (wasBlocked) n.delete(userId); else n.add(userId);
        return n;
      });
      toast.success(wasBlocked ? 'Membre débloqué' : 'Membre bloqué — il ne peut plus vous contacter');
    } catch (e: any) {
      toast.error('Échec : ' + e.message);
    }
  }, [blockedUserIds]);

  // Charger la liste des blocages à l'ouverture d'une fiche membre
  useEffect(() => {
    if (!memberProfile) return;
    fetch('/api/chat/blocks', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then((data: any) => {
        if (!data) return;
        const ids = Array.isArray(data.blocked)
          ? data.blocked.map((b: any) => b.blockedId || b.userId || b.id)
          : [];
        setBlockedUserIds(new Set(ids));
      })
      .catch(() => {});
  }, [memberProfile]);

  // Invitable (onglet Inviter) — recherche debouncée 250 ms
  useEffect(() => {
    if (memberPanelTab !== 'invite' || !activeConvId) return;
    const timeout = setTimeout(async () => {
      setInviteLoading(true);
      try {
        const res = await fetch(`/api/chat/conversations/${activeConvId}/invitable?q=${encodeURIComponent(inviteQuery)}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setInvitableUsers(Array.isArray(data) ? data : (data?.users || []));
        }
      } catch { /* silencieux */ }
      finally { setInviteLoading(false); }
    }, 250);
    return () => clearTimeout(timeout);
  }, [memberPanelTab, activeConvId, inviteQuery]);

  /** Inviter un membre dans le groupe (add-members, idempotent). */
  const inviteMember = useCallback(async (userId: string) => {
    if (!activeConvId) return;
    try {
      const res = await fetch(`/api/chat/conversations/${activeConvId}/add-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [userId] }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.message || (err as any)?.error || `Erreur ${res.status}`);
      }
      setInvitedIds(prev => new Set(prev).add(userId));
      loadConversationMembers(activeConvId);
      loadConversations();
    } catch (e: any) {
      toast.error("Échec de l'invitation : " + e.message);
    }
  }, [activeConvId, loadConversationMembers, loadConversations]);

  // ⭐ V3-6 (historique) : GROUP call mesh — invite selected participants
  const handleStartGroupCallMesh = async (callType: 'AUDIO' | 'VIDEO') => {
    if (!activeConvId || !activeConv || activeConv.type !== 'GROUP') return;
    const invitees = activeConv.participants.filter(
      (p) => p.userId !== currentUserId && groupCallParticipants.has(p.userId)
    );
    if (invitees.length === 0) {
      toast.error('Sélectionnez au moins un participant à appeler');
      return;
    }

    try {
      // 1. Get local media
      //    ⭐ DISCORD PARITY: Noise suppression for incoming call acceptance too.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: callType === 'VIDEO',
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // 2. Generate a callId
      const callId = `group-${Date.now()}`;
      const myName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Utilisateur';

      // 3. Build the participant names map
      const participantNames: Record<string, string> = { [currentUserId]: myName };
      for (const p of invitees) {
        participantNames[p.userId] = `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.email || 'Utilisateur';
      }

      // 4. Initialize the group call state
      const participantsMap = new Map();
      participantsMap.set(currentUserId, { name: myName, stream });
      for (const p of invitees) {
        participantsMap.set(p.userId, { name: participantNames[p.userId] });
      }
      setGroupCallData({
        callId,
        callType,
        conversationId: activeConvId,
        isInitiator: true,
        participants: participantsMap,
      });
      setGroupCallActive(true);

      // 5. Emit group-call:invite to all selected participants
      if (socket) {
        socket.emit('group-call:invite', {
          toUserIds: invitees.map((p) => p.userId),
          callId,
          callType,
          conversationId: activeConvId,
          callerName: myName,
          callerAvatarUrl: (user as any)?.avatarUrl || null,
          participantNames,
        });
      }

      // 6. For each invitee, create a peer connection + send a call:offer
      for (const invitee of invitees) {
        const pc = new RTCPeerConnection({
          iceServers: getIceServers(), // ⭐ V5 — STUN ×3 + TURN (CGNAT/4G)
        });
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        pc.onicecandidate = (event) => {
          if (event.candidate && socket) {
            socket.emit('call:ice-candidate', {
              toUserId: invitee.userId,
              callId,
              candidate: event.candidate,
            });
          }
        };
        pc.ontrack = (event) => {
          if (event.streams[0]) {
            groupRemoteStreamsRef.current.set(invitee.userId, event.streams[0]);
            setGroupCallData((prev) => {
              if (!prev) return prev;
              const newParticipants = new Map(prev.participants);
              newParticipants.set(invitee.userId, {
                ...newParticipants.get(invitee.userId)!,
                stream: event.streams[0],
              });
              return { ...prev, participants: newParticipants };
            });
          }
        };
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            groupPeerConnectionsRef.current.delete(invitee.userId);
            groupRemoteStreamsRef.current.delete(invitee.userId);
            setGroupCallData((prev) => {
              if (!prev) return prev;
              const newParticipants = new Map(prev.participants);
              newParticipants.delete(invitee.userId);
              return { ...prev, participants: newParticipants };
            });
          }
        };
        groupPeerConnectionsRef.current.set(invitee.userId, pc);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (socket) {
          socket.emit('call:offer', {
            toUserId: invitee.userId,
            callId,
            callType,
            offer,
            callerName: myName,
            callerAvatarUrl: (user as any)?.avatarUrl || null,
          });
        }
      }
      toast.success(`Appel ${callType === 'VIDEO' ? 'vidéo' : 'audio'} de groupe lancé avec ${invitees.length} participant(s)`);
    } catch (e: any) {
      toast.error('Échec appel de groupe: ' + e.message);
      cleanupGroupCall();
    }
  };

  // ⭐ V3-6: Cleanup group call resources
  const cleanupGroupCall = useCallback(() => {
    groupPeerConnectionsRef.current.forEach((pc) => pc.close());
    groupPeerConnectionsRef.current.clear();
    groupRemoteStreamsRef.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setGroupCallActive(false);
    setGroupCallData(null);
    setGroupCallParticipants(new Set());
  }, []);

  // ⭐ V3-6: Hang up a group call
  const hangupGroupCall = () => {
    if (groupCallData && socket) {
      const otherIds = Array.from(groupCallData.participants.keys()).filter((id) => id !== currentUserId);
      for (const id of otherIds) {
        socket.emit('group-call:leave', { toUserIds: [id], callId: groupCallData.callId });
      }
    }
    cleanupGroupCall();
  };

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V4 — ACCEPTER / REFUSER / TERMINER un appel signalisé
  // ═════════════════════════════════════════════════════════════════

  /** Décrocher un appel signalisé (overlay entrant) : accept serveur + chaîne média. */
  const [acceptingCall, setAcceptingCall] = useState(false);
  const acceptSignalCall = async () => {
    const sig = incomingSignal;
    if (!sig || acceptingCall) return;
    setAcceptingCall(true); // ⭐ V5 — spinner « Connexion… » sur le bouton Accepter
    const finishAccepting = () => setAcceptingCall(false);
    setIncomingSignal(null);
    failoverAttemptsRef.current = 0;
    const callType: 'AUDIO' | 'VIDEO' = sig.callType === 'video' ? 'VIDEO' : 'AUDIO';
    const isGroup = !!sig.isGroupCall;
    const title = isGroup ? (sig.convName || 'Appel de groupe') : (sig.initiatorName || 'Appel');
    const subtitle = isGroup ? 'Appel de groupe' : (sig.convName && sig.convName !== title ? sig.convName : undefined);

    setSignalCallId(sig.callId);
    setV4CallInfo({
      callId: sig.callId,
      callType,
      title,
      subtitle,
      avatarUrl: isGroup ? (sig.convAvatarUrl || null) : (sig.initiatorAvatarUrl || null),
      isGroup,
      isInitiator: false,
      conversationId: sig.conversationId,
    });
    setCallData({ callId: sig.callId, callType, otherUserId: sig.initiatorId, otherUserName: title });
    setCallState('active');
    if (!callTimerRef.current) {
      callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    }

    // 1. Accepter côté serveur (statut accepted + acceptedAt)
    fetch('/api/chat/calls/signal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept', callId: sig.callId }),
      credentials: 'include',
    }).catch(() => {});

    // 2. Rejoindre la chaîne média (même room + même fournisseur que l'appelant)
    try {
      await connectMediaChain({
        kind: 'call',
        conversationId: sig.conversationId,
        callId: sig.callId,
        video: callType === 'VIDEO',
      });
      finishAccepting();
      return; // ⭐ SFU connecté
    } catch (e: any) {
      finishAccepting();
      // Chaîne épuisée ou en échec :
      //  - si l'appelant est retombé en mesh, une offre brute est en attente
      //    (window._pendingCallOffer) → on y répond en mesh ;
      //  - sinon on raccroche proprement.
      const pending = (window as any)._pendingCallOffer;
      if (pending && pending.callId === sig.callId && pending.offer) {
        toast.info('Réseau direct navigateur-à-navigateur (mesh WebRTC)');
        setSignalCallId(null);
        setV4CallInfo(null);
        setCallState('idle');
        setCallData(null);
        if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
        acceptCall(pending.fromUserId, pending.callId, pending.callType, pending.offer);
        return;
      }
      // ⭐ V5 — Plan C (parité Yeshua) : appel de GROUPE avec chaîne épuisée
      //    et sans offre mesh en attente → room Jitsi déterministe (même room
      //    que l'appelant) au lieu de raccrocher immédiatement.
      if (isGroup && sig.conversationId) {
        setSignalCallId(null);
        setV4CallInfo(null);
        setCallState('idle');
        setCallData(null);
        if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
        setJitsiFallback({
          room: jitsiRoomFor('call', sig.conversationId),
          title: sig.convName || 'Appel de groupe',
        });
        toast.info('Réseau de secours Jitsi (grand groupe)');
        return;
      }
      toast.error("Impossible de rejoindre l'appel : " + (e.message || 'réseau indisponible'));
      endSignalCall();
    } finally {
      // ⭐ V5 — toujours relâcher l'état « accepting » (anti-blocage du bouton)
      finishAccepting();
    }
  };

  /** Refuser un appel signalisé (overlay entrant). */
  const declineSignalCall = () => {
    const sig = incomingSignal;
    if (!sig) return;
    // ⭐ V5 — mémoriser le refus : un appel de GROUPE continue de sonner pour
    //    les autres membres, mais ne doit plus jamais re-sonner chez moi
    //    (le polling 3 s le re-détecterait sinon toutes les 3 s).
    declinedCallIdsRef.current.add(sig.callId);
    setIncomingSignal(null);
    fetch('/api/chat/calls/signal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'decline', callId: sig.callId }),
      credentials: 'include',
    }).catch(() => {});
  };

  /** ⭐ V5 (parité Yeshua) — Terminer avec affichage de l'issue : l'overlay
   *    montre le motif (refusé / manqué / annulé / terminé · durée) pendant
   *    2 s AVANT la fermeture complète. */
  const endSignalCallWithStatus = (status: string, durationSec?: number) => {
    setCallEndStatus({ status, durationSec });
    setTimeout(() => {
      setCallEndStatus(null);
      endSignalCall();
    }, 2000);
  };

  /** Terminer l'appel V4 courant (raccrocher) — journal CALL_LOG côté serveur. */
  const endSignalCall = () => {
    const cid = signalCallId || v4CallInfo?.callId;
    if (cid) {
      fetch('/api/chat/calls/signal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end', callId: cid }),
        credentials: 'include',
      }).catch(() => {});
    }
    // Compat : notifier l'autre partie en mesh si l'appel y vit aussi
    if (callData?.otherUserId && socket && !mediaSessionRef.current) {
      socket.emit('call:hangup', { toUserId: callData.otherUserId, callId: callData.callId });
    }
    disconnectMediaSession();
    setSignalCallId(null);
    setV4CallInfo(null);
    setIncomingSignal(null);
    cleanupCall();
    // Rafraîchir la conversation pour afficher le journal CALL_LOG
    if (activeConvId) { loadMessages(); loadConversations(); }
  };

  // ⭐ V2.5: Accept incoming call
  const acceptCall = async (fromUserId: string, callId: string, callType: string, offer: any) => {
    try {
      // ⭐ DISCORD PARITY: Noise suppression on incoming call acceptance.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: callType === 'VIDEO',
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = setupPeerConnection(fromUserId, callId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (socket) {
        socket.emit('call:answer', { toUserId: fromUserId, callId, answer });
      }

      setCallData({ callId, callType: callType as 'AUDIO' | 'VIDEO', otherUserId: fromUserId, otherUserName: callData?.otherUserName || 'Appel' });
      setCallState('active');
      // Start duration timer
      callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } catch (e: any) {
      toast.error('Échec acceptation: ' + e.message);
      cleanupCall();
    }
  };

  // ⭐ V2.5: Reject incoming call
  const rejectCall = (fromUserId: string, callId: string) => {
    if (socket) socket.emit('call:reject', { toUserId: fromUserId, callId });
    fetch(`/api/chat/calls/${callId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DECLINED' }),
      credentials: 'include',
    }).catch(() => {});
    cleanupCall();
  };

  // ⭐ V2.5: Hang up (either side)
  const hangup = () => {
    if (callData) {
      if (socket) socket.emit('call:hangup', { toUserId: callData.otherUserId, callId: callData.callId });
      fetch(`/api/chat/calls/${callData.callId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
        credentials: 'include',
      }).catch(() => {});
    }
    cleanupCall();
  };

  // ⭐ V2.5: Toggle mute (mesh) + ⭐ V4 : session média SFU
  const toggleMute = () => {
    if (mediaSessionRef.current) {
      mediaSessionRef.current.setMicEnabled(!muted).catch(() => {});
      setMuted(!muted);
      return;
    }
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMuted(!audioTrack.enabled);
    }
  };

  // ⭐ V2.5: Toggle video (mesh) + ⭐ V4 : session média SFU
  const toggleVideo = () => {
    if (mediaSessionRef.current) {
      mediaSessionRef.current.setCameraEnabled(!!videoOff).catch(() => {});
      setVideoOff(!videoOff);
      return;
    }
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setVideoOff(!videoTrack.enabled);
    }
  };

  // ⭐ DISCORD PARITY: Screen sharing (getDisplayMedia).
  //    Replaces the video track in the peer connection with the screen share
  //    stream. The remote peer sees the shared screen instead of the webcam.
  //    Clicking again stops the screen share and restores the webcam.
  const toggleScreenShare = async () => {
    if (!peerConnectionRef.current) return;

    if (isSharingScreen) {
      // Stop screen sharing — restore the original webcam video track
      const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
      if (sender && originalVideoTrackRef.current) {
        await sender.replaceTrack(originalVideoTrackRef.current);
      }
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      originalVideoTrackRef.current = null;
      setIsSharingScreen(false);
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      return;
    }

    try {
      // Request screen share (display media)
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: false, // no system audio for now — would need additional track
      });
      screenStreamRef.current = displayStream;
      const screenTrack = displayStream.getVideoTracks()[0];

      // Save the original webcam track so we can restore it later
      const originalVideoTrack = localStreamRef.current?.getVideoTracks()[0];
      if (originalVideoTrack) originalVideoTrackRef.current = originalVideoTrack;

      // Replace the video track in the peer connection
      const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(screenTrack);
      }

      // Show the screen share in the local PiP video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = displayStream;
      }

      // When the user stops sharing via the browser UI, auto-revert
      screenTrack.onended = () => {
        toggleScreenShare(); // toggle back to webcam
      };

      setIsSharingScreen(true);
    } catch (e: any) {
      console.error('Screen share failed:', e);
      toast.error('Échec du partage d\'écran : ' + e.message);
    }
  };

  // ═════════════════════════════════════════════════════════════════
  //  ⭐ V4 (porté de Yeshua Connect) — POLLING DE SÉCURITÉ
  //    Incoming 3 s : attrape les appels que le socket manquerait (reconnexion,
  //    multi-onglets, gateway absente). Statut 2 s pendant l'appel sortant :
  //    reflète refusé / manqué / annulé / terminé à distance.
  // ═════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      if (callStateRef.current === 'idle' && !groupCallActive && !incomingSignal) {
        try {
          const res = await fetch('/api/chat/calls/signal?incoming=1', { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            // ⭐ V5 — filtrer les appels de groupe que J'ai déjà refusés :
            //    le signal continue de sonner pour les autres membres, mais ne
            //    doit plus jamais re-sonner chez moi (parité Yeshua).
            const next = Array.isArray(data?.incoming)
              ? data.incoming.find((c: any) => !declinedCallIdsRef.current.has(c.callId))
              : undefined;
            if (!cancelled && next && callStateRef.current === 'idle' && !groupCallActive && !incomingSignal) {
              setIncomingSignal(next);
            }
          }
        } catch { /* silencieux */ }
      }
    };
    poll();
    // ⭐ FIX PERFORMANCE CONCURRENCE — 15 s quand le socket est connecté (les
    //    appels arrivent alors via l'event temps réel call:offer — le poll
    //    n'est qu'un filet de sécurité), 3 s seulement si le socket est mort.
    const interval = setInterval(poll, socket.isConnected ? 15000 : 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [readOnly, groupCallActive, incomingSignal, socket.isConnected]);

  // Statut de l'appel V4 (2 s) — ⭐ V5 : pour les DEUX parties et pendant
  //    outgoing ET active (l'appel distant raccroché doit nous fermer aussi).
  //    + bascule chaude : si le serveur a failoveré (data.mediaProvider ≠ le
  //    nôtre), on rejoint le NOUVEAU réseau — sinon les deux parties se
  //    retrouvent sur des rooms différentes (bug de convergence).
  useEffect(() => {
    if (!signalCallId) return;
    if (callState !== 'outgoing' && callState !== 'active') return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/chat/calls/signal?callId=${signalCallId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
          if (data.status === 'declined') {
            endSignalCallWithStatus('declined');
          } else if (data.status === 'missed') {
            endSignalCallWithStatus('missed');
          } else if (data.status === 'cancelled') {
            endSignalCallWithStatus('cancelled');
          } else if (data.status === 'ended') {
            endSignalCallWithStatus('ended', data.durationSec);
          } else if (data.status === 'accepted' && callStateRef.current === 'outgoing') {
            setCallState('active');
            if (!callTimerRef.current) {
              callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
            }
          }
          // ⭐ V5 — convergence de fournisseur (bascule chaude, garde anti-boucle)
          if (
            data.mediaProvider &&
            mediaSessionRef.current &&
            data.mediaProvider !== mediaProviderRef.current &&
            !mediaFailoverInFlightRef.current &&
            v4CallInfo?.conversationId
          ) {
            mediaFailoverInFlightRef.current = true;
            (async () => {
              try {
                disconnectMediaSession();
                await connectMediaChain({
                  kind: 'call',
                  conversationId: v4CallInfo.conversationId,
                  callId: signalCallId,
                  video: v4CallInfo.callType === 'VIDEO',
                });
              } catch { /* la prochaine itération réessayera */ }
              finally { mediaFailoverInFlightRef.current = false; }
            })();
          }
        }
      } catch { /* silencieux */ }
    };
    const interval = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [signalCallId, callState, v4CallInfo, connectMediaChain, disconnectMediaSession]);

  // ⭐ V4 Phase 3 — ACCUSÉS DE LECTURE TEMPS RÉEL (message:read) : le
  //    serveur broadcaste maintenant (broadcastReadReceipt) quand un
  //    destinataire marque la conversation comme lue → ✓✓ bleu instantané
  //    au lieu d'attendre le polling 5 s.
  useEffect(() => {
    if (!socket) return;
    const onMessageRead = (data: { conversationId: string; userId: string; messageIds: string[] }) => {
      if (!data?.messageIds?.length) return;
      const ids = new Set(data.messageIds);
      setMessages(prev => prev.map((m: any) => {
        if (ids.has(m.id)) {
          const readBy = Array.isArray(m.readBy) ? m.readBy : [];
          if (!readBy.includes(data.userId)) {
            return { ...m, readBy: [...readBy, data.userId] };
          }
        }
        return m;
      }));
    };
    // ⭐ V4 Phase 3 — INBOX:NEW : badge non-lus + preview rafraîchis
    //    instantanément quand un message arrive hors conversation ouverte.
    const onInboxNew = (data: { conversationId: string; preview?: string; senderName?: string }) => {
      loadConversations();
      if (data?.conversationId !== activeConvIdRef.current && data?.senderName) {
        playNotificationSound();
      }
    };
    socket.on('message:read', onMessageRead);
    socket.on('inbox:new', onInboxNew);
    // ⭐ V5 (parité Yeshua — le serveur émet message:pinned/message:unpinned
    //    via chat.service.ts:2870 mais PERSONNE ne l'écoutait) : bannière
    //    d'épinglés mise à jour en TEMPS RÉEL chez tous les membres.
    const onMessagePinned = (data: { conversationId: string; messageId: string }) => {
      setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, isPinned: true } as any : m));
    };
    const onMessageUnpinned = (data: { conversationId: string; messageId: string }) => {
      setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, isPinned: false } as any : m));
    };
    socket.on('message:pinned', onMessagePinned);
    socket.on('message:unpinned', onMessageUnpinned);
    return () => {
      socket.off('message:read', onMessageRead);
      socket.off('inbox:new', onInboxNew);
      socket.off('message:pinned', onMessagePinned);
      socket.off('message:unpinned', onMessageUnpinned);
    };
  }, [socket, loadConversations]);

  // ⭐ V2.5: Socket.io listeners for incoming call events
  useEffect(() => {
    if (!socket) return;
    const onCallOffer = (data: { fromUserId: string; callId: string; callType: string; offer: any; callerName?: string; callerAvatarUrl?: string }) => {
      if (callState !== 'idle') return; // Already in a call — auto-reject
      // ⭐ V5 — ANTI-DUEL D'OVERLAYS : si un signal V4 sonne déjà (overlay
      //    Accepter/Refuser affiché), l'offre mesh brute est mise en attente
      //    (elle servira de repli dans acceptSignalCall) mais ne DOIT PAS
      //    ouvrir le second overlay ni écraser l'état.
      if (incomingSignal) {
        (window as any)._pendingCallOffer = data;
        return;
      }
      // ⭐ FIX: Use callerName from the payload (sent by the caller) instead of
      //    looking up from activeConv.participants (which may be empty for a
      //    newly opened conversation). Fallback to participants lookup, then 'Utilisateur'.
      const participant = activeConv?.participants?.find(p => p.userId === data.fromUserId);
      const name = data.callerName
        || (participant ? `${participant.firstName || ''} ${participant.lastName || ''}`.trim() : '')
        || 'Utilisateur';
      const avatarUrl = data.callerAvatarUrl || (participant as any)?.avatarUrl || null;
      setCallData({
        callId: data.callId,
        callType: data.callType as 'AUDIO' | 'VIDEO',
        otherUserId: data.fromUserId,
        otherUserName: name,
        // Store avatar for the incoming call UI
        ...(avatarUrl ? { otherUserAvatarUrl: avatarUrl } : {}),
      } as any);
      setCallState('incoming');
      // Store offer for acceptCall — we'll need it when user clicks Accept
      (window as any)._pendingCallOffer = data;
    };
    const onCallAnswer = async (data: { fromUserId: string; callId: string; answer: any }) => {
      if (peerConnectionRef.current && callData?.callId === data.callId) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
        setCallState('active');
        callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
      }
    };
    const onIceCandidate = async (data: { fromUserId: string; callId: string; candidate: any }) => {
      if (peerConnectionRef.current && callData?.callId === data.callId) {
        try { await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
      }
    };
    const onCallReject = () => { toast.info('Appel refusé'); cleanupCall(); };
    const onCallHangup = () => { toast.info('Appel terminé par l\'interlocuteur'); cleanupCall(); };

    // ⭐ V4 (porté de Yeshua Connect) : signal d'appel entrant — diffusé
    //    instantanément par la gateway (broadcastCallIncoming). Plus rapide
    //    que le polling 3 s qui reste le filet de sécurité (voir effet dédié).
    const onCallIncoming = (payload: any) => {
      if (callStateRef.current !== 'idle' || groupCallActive || incomingSignal) return;
      // ⭐ V5 — ne jamais re-sonner un appel de groupe déjà refusé localement
      if (payload?.callId && declinedCallIdsRef.current.has(payload.callId)) return;
      setIncomingSignal(payload);
    };
    socket.on('call:incoming', onCallIncoming);
    // ⭐ V4 : la bascule audio↔vidéo d'un canal vocal (contrôle admin)
    socket.on('voice:video-mode', (payload: any) => {
      // ⭐ V5 — la bascule collective EST CONSOMMÉE (avant : écrite dans
      //    window._voiceVideoMode sans jamais être lue) : l'état + la caméra
      //    de TOUS les participants suivent le mode diffusé par l'admin.
      if (activeVoiceChannel && (payload?.conversationId === activeVoiceChannel || payload?.channelId === activeVoiceChannel)) {
        setVoiceVideoMode(!!payload.videoMode);
        voiceSessionRef.current?.setCameraEnabled(!!payload.videoMode).catch(() => {});
      }
    });

    socket.on('call:offer', onCallOffer);
    socket.on('call:answer', onCallAnswer);
    socket.on('call:ice-candidate', onIceCandidate);
    socket.on('call:reject', onCallReject);
    socket.on('call:hangup', onCallHangup);

    // ⭐ V3-6: Group call listeners
    const onGroupCallInvite = async (data: { fromUserId: string; callId: string; callType: string; conversationId: string; callerName?: string; callerAvatarUrl?: string; participantNames?: Record<string, string> }) => {
      if (groupCallActive || callState !== 'idle') return; // Already in a call
      // ⭐ V4 : si un SIGNAL gère déjà cet appel (appelant web), l'overlay
      //    entrant Accepter/Refuser est déjà affiché — on n'auto-accepte PAS
      //    (fin du TODO V3-6 « production version would show an incoming-call
      //    modal »). L'auto-accept ne reste que pour les appelants mobiles
      //    (mesh, sans signalisation).
      if (incomingSignal || (window as any)._pendingCallSignal) return;

      // For V3-6, we auto-accept the group call (the user can hang up if they don't want to join).
      // A production version would show an incoming-call modal with Accept/Decline buttons.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: data.callType === 'VIDEO',
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const participantsMap = new Map<string, { name: string; stream?: MediaStream }>();
        participantsMap.set(currentUserId, { name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Moi', stream });
        if (data.participantNames) {
          for (const [uid, name] of Object.entries(data.participantNames)) {
            if (uid !== currentUserId) {
              participantsMap.set(uid, { name });
            }
          }
        }

        setGroupCallData({
          callId: data.callId,
          callType: data.callType as 'AUDIO' | 'VIDEO',
          conversationId: data.conversationId,
          isInitiator: false,
          participants: participantsMap,
        });
        setGroupCallActive(true);

        // Establish a peer connection back to the initiator
        const pc = new RTCPeerConnection({
          iceServers: getIceServers(), // ⭐ V5 — STUN ×3 + TURN (CGNAT/4G)
        });
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        pc.onicecandidate = (event) => {
          if (event.candidate && socket) {
            socket.emit('call:ice-candidate', {
              toUserId: data.fromUserId,
              callId: data.callId,
              candidate: event.candidate,
            });
          }
        };
        pc.ontrack = (event) => {
          if (event.streams[0]) {
            groupRemoteStreamsRef.current.set(data.fromUserId, event.streams[0]);
            setGroupCallData((prev) => {
              if (!prev) return prev;
              const newParticipants = new Map(prev.participants);
              newParticipants.set(data.fromUserId, {
                ...newParticipants.get(data.fromUserId)!,
                stream: event.streams[0],
              });
              return { ...prev, participants: newParticipants };
            });
          }
        };
        groupPeerConnectionsRef.current.set(data.fromUserId, pc);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call:offer', {
          toUserId: data.fromUserId,
          callId: data.callId,
          callType: data.callType,
          offer,
          callerName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Utilisateur',
        });
        toast.info(`Appel de groupe entrant de ${data.callerName || 'Utilisateur'}`);
      } catch (e: any) {
        toast.error('Échec acceptation appel de groupe: ' + e.message);
        cleanupGroupCall();
      }
    };

    const onGroupCallLeave = (data: { fromUserId: string; callId: string }) => {
      if (!groupCallData || data.callId !== groupCallData.callId) return;
      const pc = groupPeerConnectionsRef.current.get(data.fromUserId);
      if (pc) pc.close();
      groupPeerConnectionsRef.current.delete(data.fromUserId);
      groupRemoteStreamsRef.current.delete(data.fromUserId);
      setGroupCallData((prev) => {
        if (!prev) return prev;
        const newParticipants = new Map(prev.participants);
        newParticipants.delete(data.fromUserId);
        if (newParticipants.size <= 1) {
          // Only us left — end the call
          cleanupGroupCall();
          return null;
        }
        return { ...prev, participants: newParticipants };
      });
    };

    socket.on('group-call:invite', onGroupCallInvite);
    socket.on('group-call:leave', onGroupCallLeave);

    return () => {
      socket.off('call:incoming', onCallIncoming);
      socket.off('call:offer', onCallOffer);
      socket.off('call:answer', onCallAnswer);
      socket.off('call:ice-candidate', onIceCandidate);
      socket.off('call:reject', onCallReject);
      socket.off('call:hangup', onCallHangup);
      socket.off('group-call:invite', onGroupCallInvite);
      socket.off('group-call:leave', onGroupCallLeave);
    };
  }, [socket, callState, callData, activeConv, cleanupCall, groupCallActive, groupCallData, currentUserId, user]);

  // ⭐ V2: Generate group invite link (copies to clipboard)
  const handleGenerateInviteLink = async () => {
    if (!activeConvId) return;
    try {
      const res = await fetch(`/api/chat/conversations/${activeConvId}/invite-link`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      navigator.clipboard.writeText(data.inviteLink).then(() => {
        toast.success('Lien d\'invitation copié dans le presse-papiers');
      });
    } catch (e: any) { toast.error('Échec: ' + e.message); }
  };

  // ⭐ V2: Schedule a message for later
  //    (scheduledMessages / loadScheduledMessages / cancelScheduledMessage
  //     sont définis plus haut, avant l'effet d'ouverture de conversation)
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleText, setScheduleText] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');

  const handleScheduleMessage = async () => {
    if (!activeConvId || !scheduleText.trim() || !scheduleDate) return;
    try {
      const res = await fetch(`/api/chat/conversations/${activeConvId}/schedule`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: currentUserId, content: scheduleText, scheduledFor: scheduleDate }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      toast.success('Message programmé pour ' + new Date(scheduleDate).toLocaleString('fr-FR'));
      setShowScheduleModal(false); setScheduleText(''); setScheduleDate('');
      loadScheduledMessages(); // ⭐ V6 — rafraîchit le bandeau immédiatement
    } catch (e: any) { toast.error('Échec: ' + e.message); }
  };

  const handleSendAttachment = async (file: File, type: 'AUDIO' | 'DOCUMENT' | 'IMAGE') => {
    if (!activeConvId || sending) return;
    setSending(true);
    try {
      // ⭐ V2: compress images >2MB before upload
      const fileToSend = type === 'IMAGE' ? await compressImage(file) : file;
      const formData = new FormData();
      formData.append('file', fileToSend);
      formData.append('senderId', currentUserId);
      formData.append('type', type);

      // ⭐ Upload DIRECTLY to backend — bypass Vercel BFF to avoid 413 (4.5MB limit)
      //    The backend has CORS enabled for *.academiahelm.com
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : '';
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('x-tenant-id') || document.cookie.match(/x-tenant-id=([^;]+)/)?.[1] || '' : '';

      const res = await fetch(`${getBackendBaseUrl()}/api/chat/conversations/${activeConvId}/messages/attachment`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
        },
        body: formData,
        credentials: 'include',
      });

      const responseText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(responseText);
      } catch {
        if (!res.ok) {
          throw new Error(`Réponse non-JSON (status ${res.status}) : ${responseText.substring(0, 200)}`);
        }
        data = {};
      }
      if (!res.ok) {
        const msg = data?.message || data?.error || `Erreur ${res.status}`;
        throw new Error(msg);
      }
      const newMsg = data;
      setMessages(prev => [...prev, newMsg]);
      loadConversations();
      toast.success(type === 'AUDIO' ? 'Message vocal envoyé' : type === 'IMAGE' ? 'Image envoyée' : 'Document envoyé');
    } catch (e: any) {
      toast.error("Échec d'envoi du fichier : " + e.message);
    } finally {
      setSending(false);
    }
  };

  // ⭐ V5 (parité Yeshua) — FILE D'ATTENTE MULTI-FICHIERS AVANT ENVOI : les
  //    fichiers sélectionnés / collés / déposés passent dans une file visuelle
  //    (vignettes, suppression individuelle, « Tout annuler ») et ne partent
  //    QU'AU CLIC ENVOYER, la légende (texte saisi) partant en premier.
  //    Avant V5 : envoi immédiat à la sélection — impossible d'annuler ni de
  //    légender, pas de multi-sélection.
  const [pendingFiles, setPendingFiles] = useState<{ file: File; type: 'AUDIO' | 'DOCUMENT' | 'IMAGE'; previewUrl?: string }[]>([]);
  const [sendingFiles, setSendingFiles] = useState(false);
  const fileTypeOf = (file: File): 'AUDIO' | 'DOCUMENT' | 'IMAGE' => {
    const mime = file.type;
    if (mime.startsWith('audio/')) return 'AUDIO';
    if (mime.startsWith('image/')) return 'IMAGE';
    return 'DOCUMENT'; // vidéos incluses (rendu <video> inline côté messages)
  };
  const addPendingFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setPendingFiles(prev => [...prev, ...files.map(file => ({
      file,
      type: fileTypeOf(file),
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }))]);
  }, []);
  const removePendingFile = useCallback((idx: number) => {
    setPendingFiles(prev => {
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return copy;
    });
  }, []);
  const clearPendingFiles = useCallback(() => {
    setPendingFiles(prev => {
      prev.forEach(p => { if (p.previewUrl) URL.revokeObjectURL(p.previewUrl); });
      return [];
    });
  }, []);
  /** ⭐ V5 — Envoyer la file : légende d'abord (message texte), puis les
   *    fichiers un à un dans l'ordre de sélection. */
  const sendPendingFiles = useCallback(async () => {
    if (pendingFiles.length === 0 || sendingFiles || sending) return;
    setSendingFiles(true);
    try {
      const caption = text.replace(/<[^>]*>/g, '').trim();
      if (caption && activeConvId) {
        await handleSendText();
      }
      for (const p of pendingFiles) {
        await handleSendAttachment(p.file, p.type);
      }
      clearPendingFiles();
    } finally {
      setSendingFiles(false);
    }
  }, [pendingFiles, sendingFiles, sending, text, activeConvId, handleSendText, handleSendAttachment, clearPendingFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    // ⭐ V5 — multi-sélection + file d'attente visuelle (plus d'envoi immédiat)
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    addPendingFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ⭐ DRAG & DROP — Upload files dropped onto the chat area (Discord-like)
  //    Supports images, audio, video, and documents. Auto-detects the type from
  //    the file's MIME type. Multiple files are uploaded sequentially.
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!activeConvId || isReadOnly) return;
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    // ⭐ V5 — les fichiers déposés passent dans la file d'attente visuelle
    //    (plus d'upload immédiat) : vignettes + annulation + légende possibles.
    addPendingFiles(files);
  }, [activeConvId, isReadOnly, addPendingFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types?.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only hide the overlay if we're leaving the container entirely
    // (not entering a child element). relatedTarget is null when leaving
    // the browser window, and is a child element when moving between
    // children. We check if the relatedTarget is still inside the container.
    const container = e.currentTarget as HTMLElement;
    if (e.relatedTarget && container.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsDragOver(false);
  }, []);

  // ⭐ PASTE IMAGE — Upload images pasted from clipboard (Ctrl+V / Cmd+V)
  //    Supports pasted screenshots (image/png) and copied image files.
  //    Attached to the main chat container so it works regardless of focus.
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (!activeConvId || isReadOnly) return;
    const items = Array.from(e.clipboardData?.items || []);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    if (imageItems.length === 0) return; // Let normal paste happen for text
    e.preventDefault();
    // ⭐ V5 — les images collées passent dans la file d'attente visuelle
    const files = imageItems.map(item => item.getAsFile()).filter(Boolean) as File[];
    addPendingFiles(files);
  }, [activeConvId, isReadOnly, addPendingFiles]);

  // ⭐ SEND the audio from preview state (declared AFTER handleSendAttachment to avoid TDZ)
  const sendRecordedAudio = useCallback(async () => {
    if (!audioBlob || !activeConvId) return;
    const mime = audioBlob.type || 'audio/webm';
    const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([audioBlob], `vocal-${Date.now()}.${ext}`, { type: mime });
    // Reset state BEFORE sending so the UI goes back to idle immediately
    cleanupRecording();
    await handleSendAttachment(file, 'AUDIO');
  }, [audioBlob, activeConvId, cleanupRecording, handleSendAttachment]);

  // ───────────────────────────────────────────────────────────────────
  // Render conversation item (shared between Groups and Direct lists)
  // ┭ Telegram-style: avatar, name, last message preview, time, unread badge,
  //    role label for DIRECT convs, member count for GROUP convs
  //    ⭐ V3-11: supports multi-select mode (checkbox overlay) — when the user
  //    long-presses (mobile) or shift-clicks (desktop) a conversation, it enters
  //    selection mode; further clicks toggle selection. A floating action bar
  //    appears at the bottom to delete the selected conversations.
  // ───────────────────────────────────────────────────────────────────
  const renderConversationItem = (conv: ChatConversation) => {
    const display = getConversationDisplay(conv, currentUserId);
    const isActive = conv.id === activeConvId;
    const isSelected = selectedConvIds.has(conv.id);
    // ⭐ Check if the other participant is online (DIRECT only)
    const otherUser = conv.type === 'DIRECT' ? conv.participants.find(p => p.userId !== currentUserId) : null;
    const isOnline = otherUser && onlineUsers.has(otherUser.userId);
    return (
      <div
        key={conv.id}
        className={cn(
          'w-full flex items-start gap-3 p-3 text-left hover:bg-slate-50 border-b border-slate-50 transition cursor-pointer',
          isActive && !selectionMode && 'bg-[#E6F4FF]',
          isSelected && 'bg-blue-50 border-l-4 border-l-blue-500'
        )}
        onClick={(e) => {
          if (selectionMode) {
            // In selection mode, toggle selection
            e.stopPropagation();
            toggleConversationSelection(conv.id);
          } else if (e.shiftKey) {
            // Shift+click → enter selection mode with this conv
            e.preventDefault();
            enterSelectionMode(conv.id);
          } else {
            // Normal click → open conversation
            setActiveConvId(conv.id);
            // ⭐ V6 — fermer un éventuel canal ouvert (exclusivité du panneau droit)
            setActiveChannelId(null);
            // ⭐ V5 — repli automatique de la sidebar overlay mobile
            setMobileSidebarOpen(false);
          }
        }}
        onContextMenu={(e) => {
          // Right-click on a conversation → enter selection mode (mobile long-press)
          e.preventDefault();
          enterSelectionMode(conv.id);
        }}
      >
        {/* ⭐ V3-11: Selection checkbox (only shown in selection mode) */}
        {selectionMode && (
          <div className={cn(
            'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-1',
            isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300'
          )}>
            {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
          </div>
        )}
        {/* Avatar */}
        <div className={cn(
          'w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 relative',
          display.avatarUrl ? 'bg-slate-200' : getAvatarColor(display.name)
        )}>
          {display.avatarUrl ? (
            <img src={display.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            getInitials(display.name)
          )}
          {/* Group icon badge */}
          {conv.type === 'GROUP' && (
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#3B9EFF] rounded-full border-2 border-white flex items-center justify-center">
              <Users className="w-2 h-2 text-white" />
            </span>
          )}
          {/* ⭐ Online dot (DIRECT only) */}
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
          )}
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className={cn(
              'text-sm truncate',
              (conv as any).unreadCount && (conv as any).unreadCount > 0
                ? 'font-bold text-slate-900'
                : 'font-semibold text-slate-900'
            )}>{display.name}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* ⭐ DISCORD PARITY: Unread badge — blue circle with white count.
                  Shown when the conversation has unread messages and is NOT
                  the currently active one. */}
              {(conv as any).unreadCount && (conv as any).unreadCount > 0 && conv.id !== activeConvId && (
                <span className="min-w-[18px] h-[18px] px-1 bg-[#1677FF] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {(conv as any).unreadCount > 99 ? '99+' : (conv as any).unreadCount}
                </span>
              )}
              {conv.lastMessageAt && (
                <span className={cn(
                  'text-[10px]',
                  (conv as any).unreadCount && (conv as any).unreadCount > 0 ? 'text-[#1677FF] font-semibold' : 'text-slate-400'
                )}>{formatConvTime(conv.lastMessageAt)}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* ⭐ V6 (spec §10) — icône « muet » sur les conversations en muet */}
            {mutedConvs[conv.id] && (
              <BellOff className="w-3 h-3 text-slate-400 flex-shrink-0" aria-label="Notifications en muet" />
            )}
            {/* ⭐ V6.1 (parité Yeshua) — BADGE D'APPEL dans la liste : quand le
                dernier message est un journal d'appel (CALL_LOG), on affiche
                l'icône téléphone colorée par statut au lieu du texte brut :
                rouge = manqué (entrant), ambre = refusé, gris = sortant sans
                réponse/annulé, vert = terminé. */}
            {(conv as any).lastMessageType === 'CALL_LOG' ? (() => {
              const cs = String((conv as any).lastMessageCallStatus || '').toLowerCase();
              const ct = (conv as any).lastMessageCallType === 'video';
              const mine = (conv as any).lastMessageSentByMe;
              const CallIcon = cs === 'missed' ? PhoneMissed : ct ? Video : Phone;
              const color =
                cs === 'missed' ? 'text-red-500' :
                cs === 'declined' || cs === 'rejected' ? 'text-amber-500' :
                cs === 'cancelled' ? 'text-slate-400' :
                'text-emerald-500';
              return (
                <>
                  <CallIcon className={cn('w-3.5 h-3.5 flex-shrink-0', color)} />
                  <span className={cn('text-xs truncate flex-1', color,
                    cs === 'missed' && 'font-semibold')}>
                    {cs === 'missed'
                      ? (mine ? 'Appel manqué (sortant)' : 'Appel manqué')
                      : cs === 'declined' || cs === 'rejected'
                        ? 'Appel refusé'
                        : cs === 'cancelled'
                          ? (mine ? 'Appel annulé' : 'Appel sans réponse')
                          : (conv.lastMessagePreview || 'Appel terminé')}
                  </span>
                </>
              );
            })() : (
              <span className={cn(
                'text-xs truncate flex-1',
                (conv as any).unreadCount && (conv as any).unreadCount > 0
                  ? 'text-slate-700 font-medium'
                  : 'text-slate-500'
              )}>
                {isEncrypted(conv.lastMessagePreview || '') ? '🔒 Message chiffré' : (conv.lastMessagePreview || '—')}
              </span>
            )}
          </div>
          {/* Role label (DIRECT only) or member count (GROUP only) */}
          {display.roleLabel && conv.type === 'DIRECT' && (
            <span className="text-[10px] text-[#0958D9] font-semibold truncate block mt-0.5">
              {display.roleLabel}
            </span>
          )}
          {conv.type === 'GROUP' && display.subtitle && (
            <span className="text-[10px] text-slate-400 block mt-0.5">{display.subtitle}</span>
          )}
        </div>
      </div>
    );
  };

  // ───────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────

  const height = heightClass || 'h-[calc(100vh-200px)]';

  return (
    <div className={cn('flex bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden', height)}>
      {/* Hidden file input — accept ALL file types (images, audio, documents, archives)
          ⭐ Videos will be added in V2 (currently too large for the 50MB limit) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.md,.json,.xml"
      />

      {/* ═════ DISCORD-LIKE LEFT ICON RAIL — 12 sections ═════ */}
      {/* ⭐ V3-11: Far-left vertical icon rail (72px) — switches between the 12
          Helm Connect sections. Branded with Royal Blue + gold accents.
          ⭐ MOBILE FIX: On mobile (<md) the vertical rail is hidden, and a
          HORIZONTAL scrollable section bar is shown at the top of the sidebar
          instead (see below, before the conversation list). This ensures all
          12 sections are accessible on touch devices. */}
      <div className="hidden md:flex flex-col items-center gap-1 py-3 w-[72px] flex-shrink-0 bg-gradient-to-b from-[#0A2A5E] to-[#114FC4] border-r border-[#1C6FE8]/30">
        {/* ⭐ V3-11: Helm Connect logo at top — NO square container, just the
            logo image larger (was 24px in a 40x40 box, now 40px standalone).
            ⭐ PERF (GTMetrix) : webp 128px 5,9 Ko au lieu du PNG 728 Ko (÷123). */}
        <img
          src="/icons/modules/helm-connect-128.webp"
          alt="Helm Connect"
          width={40}
          height={40}
          className="w-10 h-10 object-contain mb-3 drop-shadow-[0_0_8px_rgba(255,224,138,0.4)]"
        />
        <div className="w-8 h-px bg-[#1C6FE8]/40 mb-1" />

        {/* 12 section icons */}
        {([
          { id: 'discussions', icon: <MessageSquare className="w-5 h-5" />, label: 'Discussions' },
          { id: 'communautes', icon: <Users className="w-5 h-5" />, label: 'Communautés' },
          { id: 'annonces', icon: <Bell className="w-5 h-5" />, label: 'Annonces' },
          { id: 'canaux', icon: <Rss className="w-5 h-5" />, label: 'Canaux' },
          { id: 'fichiers', icon: <FileText className="w-5 h-5" />, label: 'Fichiers' },
          { id: 'vocaux', icon: <Mic className="w-5 h-5" />, label: 'Vocaux' },
          { id: 'appels', icon: <Phone className="w-5 h-5" />, label: 'Appels' },
          { id: 'notifications', icon: <BellOff className="w-5 h-5" />, label: 'Notifs' },
          { id: 'recherche', icon: <Search className="w-5 h-5" />, label: 'Recherche' },
          { id: 'moderation', icon: <Flag className="w-5 h-5" />, label: 'Modération' },
          { id: 'analytics', icon: <BarChart3 className="w-5 h-5" />, label: 'Analytics' },
          { id: 'parametres', icon: <Settings className="w-5 h-5" />, label: 'Profil' },
        ] as const).map((section) => {
          const isActive = activeHelmSection === section.id;
          // Sections that open a modal instead of changing the list content
          const opensModal = ['recherche', 'notifications', 'parametres'].includes(section.id);
          return (
            <button
              key={section.id}
              onClick={() => {
                if (section.id === 'recherche') setShowGlobalSearch(true);
                else if (section.id === 'notifications') setShowNotifPrefs(true);
                else if (section.id === 'parametres') setShowProfile(true);
                else setActiveHelmSection(section.id as HelmSection);
              }}
              title={section.label}
              className={cn(
                'relative w-11 h-11 rounded-xl flex items-center justify-center transition-all group',
                isActive
                  ? 'bg-[#FFE08A] text-[#0A2A5E] shadow-lg shadow-[#FFE08A]/30'
                  : opensModal
                    ? 'text-white/70 hover:bg-white/10 hover:text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              {/* Active indicator bar (left side, gold) */}
              {isActive && (
                <span className="absolute -left-[12px] top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-[#FFE08A]" />
              )}
              {section.icon}
              {/* Tooltip on hover */}
              <span className="absolute left-full ml-3 px-2 py-1 bg-slate-900 text-white text-[11px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                {section.label}
              </span>
            </button>
          );
        })}

        {/* Spacer + user avatar at bottom */}
        <div className="flex-1" />
        <div className="w-8 h-px bg-[#1C6FE8]/40 my-1" />
        <button
          onClick={() => setShowProfile(true)}
          className="w-10 h-10 rounded-full bg-[#1C6FE8] flex items-center justify-center text-white text-xs font-bold border-2 border-[#FFE08A]/40 hover:border-[#FFE08A] transition-colors"
          title="Mon profil"
        >
          {(() => {
            const me = conversations.flatMap(c => c.participants).find(p => p.userId === currentUserId);
            return me ? getInitials(`${me.firstName || ''} ${me.lastName || ''}`) : '?';
          })()}
        </button>
      </div>

      {/* ═════ V5 (parité Yeshua) — RAIL MOBILE D'AVATARS ═════ */}
      {/* Vertical, 56px, visible <md quand une conversation est ouverte :
          bouton déployer (ouvre la sidebar en overlay) + avatars des 8
          dernières conversations (badge non-lus, point présence, sélection). */}
      {activeConvId || activeChannelId ? (
        <div className="md:hidden w-14 flex flex-col items-center gap-1 py-2 bg-white border-r border-slate-100 overflow-y-auto no-scrollbar">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="w-10 h-10 rounded-lg bg-[#0958D9] text-white flex items-center justify-center flex-shrink-0 mb-1"
            title="Afficher les conversations"
          >
            <Menu className="w-5 h-5" />
          </button>
          {visibleConversations.slice(0, 8).map(conv => {
            const railDisplay = getConversationDisplay(conv, currentUserId);
            const isActive = conv.id === activeConvId;
            const unread = (conv as any).unreadCount || 0;
            const other = conv.type === 'DIRECT' ? conv.participants.find((p: any) => p.userId !== currentUserId) : null;
            const online = !!(other && onlineUsers.has(other.userId));
            return (
              <button key={conv.id} onClick={() => setActiveConvId(conv.id)} className="relative flex-shrink-0" title={railDisplay.name}>
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 overflow-hidden',
                  isActive ? 'border-[#1677FF]' : 'border-transparent',
                  railDisplay.avatarUrl ? 'bg-slate-200' : getAvatarColor(railDisplay.name)
                )}>
                  {railDisplay.avatarUrl
                    ? <img src={railDisplay.avatarUrl} alt="" className="w-full h-full object-cover" />
                    : getInitials(railDisplay.name)}
                </div>
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-[#1677FF] text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
                {online && <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* ═════ LEFT SIDEBAR — Conversation List ═════ */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}
      <div className={cn(
        'border-r border-slate-100 flex-col bg-white',
        (activeConvId || activeChannelId) && !mobileSidebarOpen ? 'hidden md:flex' : 'flex',
        mobileSidebarOpen && 'fixed inset-y-0 left-0 z-50 w-[85vw] max-w-sm shadow-2xl md:static md:w-80 md:shadow-none',
        !mobileSidebarOpen && 'w-full md:w-80'
      )}>
        {/* ⭐ MOBILE: Horizontal scrollable section bar — replaces the vertical
            icon rail on touch devices. Shows the same 12 sections as a
            horizontally scrollable row of icon buttons. Hidden on md+ where
            the vertical rail takes over. */}
        <div className="md:hidden flex items-center gap-1 px-2 py-2 overflow-x-auto border-b border-slate-100 bg-gradient-to-r from-[#0A2A5E] to-[#114FC4] no-scrollbar">
          {([
            { id: 'discussions', icon: <MessageSquare className="w-4 h-4" />, label: 'Discussions' },
            { id: 'communautes', icon: <Users className="w-4 h-4" />, label: 'Communautés' },
            { id: 'annonces', icon: <Bell className="w-4 h-4" />, label: 'Annonces' },
            { id: 'canaux', icon: <Rss className="w-4 h-4" />, label: 'Canaux' },
            { id: 'fichiers', icon: <FileText className="w-4 h-4" />, label: 'Fichiers' },
            { id: 'vocaux', icon: <Mic className="w-4 h-4" />, label: 'Vocaux' },
            { id: 'appels', icon: <Phone className="w-4 h-4" />, label: 'Appels' },
            { id: 'notifications', icon: <BellOff className="w-4 h-4" />, label: 'Notifs' },
            { id: 'recherche', icon: <Search className="w-4 h-4" />, label: 'Recherche' },
            { id: 'moderation', icon: <Flag className="w-4 h-4" />, label: 'Modération' },
            { id: 'analytics', icon: <BarChart3 className="w-4 h-4" />, label: 'Analytics' },
            { id: 'parametres', icon: <Settings className="w-4 h-4" />, label: 'Profil' },
          ] as const).map((section) => {
            const isActive = activeHelmSection === section.id;
            const opensModal = ['recherche', 'notifications', 'parametres'].includes(section.id);
            return (
              <button
                key={section.id}
                onClick={() => {
                  if (section.id === 'recherche') setShowGlobalSearch(true);
                  else if (section.id === 'notifications') setShowNotifPrefs(true);
                  else if (section.id === 'parametres') setShowProfile(true);
                  else setActiveHelmSection(section.id as HelmSection);
                }}
                className={cn(
                  'flex-shrink-0 flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-xl transition-all touch-manipulation',
                  isActive
                    ? 'bg-[#FFE08A] text-[#0A2A5E]'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}
                aria-label={section.label}
              >
                {section.icon}
                <span className="text-[8px] font-medium leading-none truncate max-w-[3rem]">{section.label}</span>
              </button>
            );
          })}
        </div>
        {/* Header — shows the active section name (Discord-like) + actions */}
        <div className="px-3 py-2 border-b border-slate-100 bg-gradient-to-r from-[#E6F4FF]/50 to-white">
          <div className="flex items-center justify-between gap-2">
            {/* Title — shows the active section name (no logo — the Discord
                icon rail on the far left already shows the Helm Connect logo) */}
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
              <span className="truncate">
                {activeHelmSection === 'discussions' ? 'Discussions'
                  : activeHelmSection === 'communautes' ? 'Communautés'
                  : activeHelmSection === 'canaux' ? 'Canaux'
                  : activeHelmSection === 'fichiers' ? 'Fichiers'
                  : activeHelmSection === 'vocaux' ? 'Vocaux'
                  : activeHelmSection === 'appels' ? 'Appels'
                  : activeHelmSection === 'moderation' ? 'Modération'
                  : activeHelmSection === 'analytics' ? 'Analytics'
                  : 'Helm Connect'}
              </span>
              {/* ⭐ Socket.io connection indicator */}
              <span
                className={cn('w-2 h-2 rounded-full flex-shrink-0', socket.isConnected ? 'bg-green-400' : 'bg-slate-300')}
                title={socket.isConnected ? 'Connecté (temps réel)' : 'Déconnecté (polling)'}
              />
            </h2>
            {/* ⭐ V3-11: Context-aware actions — changes per active section.
                Removed the redundant "More options" dropdown (3-dot) since the
                Discord icon rail now handles navigation to all 12 sections.
                Kept only: Profile + 2 contextual action buttons (Nouveau groupe +
                Invitations for Discussions; specific CTA per section). */}
            {!readOnly && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Profile (always visible) */}
                <button
                  onClick={() => setShowProfile(true)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                  title="Mon profil"
                >
                  <Settings className="w-4 h-4" />
                </button>

                {/* ⭐ V3-11: Multi-select toggle button (only on discussions/communautes/canaux) */}
                {['discussions', 'communautes', 'canaux'].includes(activeHelmSection) && (
                  <button
                    onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors',
                      selectionMode
                        ? 'bg-blue-500 text-white'
                        : 'hover:bg-slate-100 text-slate-500'
                    )}
                    title={selectionMode ? 'Quitter la sélection' : 'Sélection multiple'}
                  >
                    <ListChecks className="w-4 h-4" />
                  </button>
                )}

                {/* ⭐ Context-aware primary CTA — changes per active section */}
                {activeHelmSection === 'discussions' && (
                  <>
                    <button
                      onClick={() => setShowNewGroup(true)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                      title="Nouveau groupe"
                    >
                      <Users className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowInvitations(true)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                      title="Invitations"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowNewChat(true)}
                      className="p-1.5 rounded-lg bg-[#1677FF] text-white hover:bg-[#0958D9]"
                      title="Nouvelle conversation"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </>
                )}
                {activeHelmSection === 'communautes' && (
                  <button
                    onClick={() => setShowNewGroup(true)}
                    className="p-1.5 rounded-lg bg-[#10B981] text-white hover:bg-[#059669]"
                    title="Nouvelle communauté"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
                {activeHelmSection === 'canaux' && (
                  <button
                    onClick={() => setShowNewChannel(true)}
                    className="p-1.5 rounded-lg bg-[#8B5CF6] text-white hover:bg-[#7C3AED]"
                    title="Nouveau canal"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
                {activeHelmSection === 'annonces' && (
                  <button
                    onClick={() => setShowAnnouncements(true)}
                    className="p-1.5 rounded-lg bg-[#F59E0B] text-white hover:bg-[#D97706]"
                    title="Nouvelle annonce"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
                {/* Fichiers / Vocaux / Appels / Modération / Analytics — no primary CTA */}
              </div>
            )}
          </div>
          {/* ⭐ Helm Connect subtitle — adapts to the active section */}
          <p className="text-[10px] text-slate-500 italic mt-1 truncate">
            {activeHelmSection === 'discussions' ? 'Communiquez. Collaborez. Restez connectés.'
              : activeHelmSection === 'communautes' ? 'Groupes automatiques par classe, matière, rôle et personnel.'
              : activeHelmSection === 'canaux' ? 'Canaux de diffusion (broadcast unidirectionnel).'
              : activeHelmSection === 'fichiers' ? 'Centre documentaire partagé.'
              : activeHelmSection === 'vocaux' ? 'Messages vocaux avec transcription Whisper.'
              : activeHelmSection === 'appels' ? 'Historique des appels audio et vidéo.'
              : activeHelmSection === 'annonces' ? 'Communications officielles de l\'établissement.'
              : activeHelmSection === 'moderation' ? 'Messages épinglés, importants et signalés.'
              : activeHelmSection === 'analytics' ? 'Tableau de bord de la communication.'
              : 'Communiquez. Collaborez. Restez connectés.'}
          </p>
          {/* Search — only shown on sections that have a list to filter (Discussions, Communautés, Canaux) */}
          {['discussions', 'communautes', 'canaux'].includes(activeHelmSection) && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder={
                  activeHelmSection === 'discussions' ? 'Rechercher une conversation...'
                  : activeHelmSection === 'communautes' ? 'Rechercher une communauté...'
                  : 'Rechercher un canal...'
                }
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#3B9EFF]/30"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
              />
              {sidebarSearch && (
                <button
                  onClick={() => setSidebarSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-100 text-slate-400"
                  title="Effacer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* ⭐ V5 (parité Yeshua) — BANNIÈRE D'ERREUR de chargement des
            conversations : état d'erreur distinct de l'état vide, distinction
            session expirée / erreur serveur, bouton Réessayer. */}
        {error && !loadingConvs && (
          <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-700 flex items-center justify-between gap-2">
            <span className="truncate flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
              {/401|session|unauthor/i.test(error)
                ? 'Session expirée — reconnectez-vous.'
                : 'Impossible de charger les conversations.'}
            </span>
            <button
              onClick={() => { setError(null); loadConversations(); }}
              className="font-bold text-red-600 hover:underline flex-shrink-0"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {/* ⭐ V3-11: Discord-like section content — switches based on activeHelmSection.
              - 'discussions' (default) → existing conversation list with role filters
              - 'communautes' → only GROUP conversations (auto-groups: classes/matieres/roles)
              - 'canaux' → only broadcast channels
              - 'fichiers' → shared files across conversations (placeholder: shows pinned/file attachments)
              - 'vocaux' → audio messages (placeholder)
              - 'appels' → call history (placeholder)
              - 'moderation' → flagged messages (placeholder)
              - 'analytics' → KPIs (placeholder)
              - 'annonces', 'recherche', 'notifications', 'parametres' → open modals (handled by icon rail)
          */}
          {loadingConvs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : activeHelmSection === 'fichiers' ? (
            <FichiersSection conversations={conversations} currentUserId={currentUserId} onOpenConversation={(convId) => { setActiveConvId(convId); }} />
          ) : activeHelmSection === 'vocaux' ? (
            <VocauxSection
              conversations={conversations}
              currentUserId={currentUserId}
              onOpenConversation={(convId) => { setActiveConvId(convId); }}
              voiceChannels={voiceChannels}
              activeVoiceChannel={activeVoiceChannel}
              onJoinVoice={joinVoiceChannel}
              onLeaveVoice={() => { leaveVoiceChannel(); }}
              channelDirects={channelDirects}
              onStartLive={(channelId) => startChannelDirect(channelId)}
              canStartLive={currentUserId}
            />
          ) : activeHelmSection === 'appels' ? (
            <AppelsSection
              conversations={conversations}
              currentUserId={currentUserId}
              onOpenConversation={(convId) => { setActiveConvId(convId); }}
              onCallBack={(convId, callType) => {
                setActiveConvId(convId);
                setTimeout(() => handleStartCall(callType), 300);
              }}
            />
          ) : activeHelmSection === 'annonces' ? (
            <AnnoncesSection
              currentUserId={currentUserId}
              annonces={annonces}
              loading={annoncesLoading}
              onNew={() => setShowAnnouncements(true)}
            />
          ) : activeHelmSection === 'moderation' ? (
            <ModerationSection
              conversations={conversations}
              currentUserId={currentUserId}
              onOpenConversation={(convId) => { setActiveConvId(convId); }}
              onResolveReport={(reportId) => {
                fetch(`/api/chat/reports/${reportId}/resolve`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ resolvedBy: currentUserId }),
                  credentials: 'include',
                }).then(() => toast.success('Signalement résolu'))
                  .catch(() => toast.error('Échec de la résolution'));
              }}
            />
          ) : activeHelmSection === 'analytics' ? (
            <AnalyticsSection conversations={conversations} currentUserId={currentUserId} />
          ) : conversations.length === 0 && activeHelmSection === 'discussions' ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="w-12 h-12 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-700">Aucune conversation</p>
              <p className="text-xs text-slate-500 mt-1 mb-3">Démarrez une nouvelle conversation</p>
              {!readOnly && (
                <button
                  onClick={() => setShowNewChat(true)}
                  className="px-3 py-1.5 bg-[#1677FF] text-white text-xs font-semibold rounded-lg hover:bg-[#0958D9]"
                >
                  + Nouveau message
                </button>
              )}
            </div>
          ) : (
            <>
              {/* ⭐ V6 (spec — structure Discussions) — SOUS-CATÉGORIES :
                  Privées | Groupes | Conversations scolaires + filtres rôles.
                  « Dans discussion, on doit avoir privé, groupe,
                    conversation scolaire. » */}
              {activeHelmSection === 'discussions' && (
                <div className="flex gap-1 px-3 py-2 border-b border-slate-100 overflow-x-auto no-scrollbar">
                  {([
                    { id: 'all', label: 'Tout' },
                    { id: 'privees', label: 'Privées' },
                    { id: 'groupes', label: 'Groupes' },
                    { id: 'scolaires', label: 'Scolaires' },
                    { id: 'enseignants', label: 'Enseignants' },
                    { id: 'parents', label: 'Parents' },
                    { id: 'admin', label: 'Administration' },
                  ] as const).map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setCategoryFilter(cat.id)}
                      className={cn(
                        'flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition',
                        categoryFilter === cat.id
                          ? 'bg-[#1677FF] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              )}

              {/* ⭐ CATEGORIZE: section-specific content */}
              {(() => {
                // ⭐ V3-11: Filter conversations based on activeHelmSection.
                //   - 'discussions' → DIRECT convs (with role category filter)
                //   - 'communautes' → GROUP convs only (auto-groups)
                //   - 'canaux' → broadcast channels only
                if (activeHelmSection === 'communautes') {
                  // ⭐ V5 — la recherche de la sidebar filtre aussi les communautés
                  const sidebarQ = sidebarSearch.trim().toLowerCase();
                  const groupConvs = visibleConversations.filter(c => c.type === 'GROUP')
                    .filter(c => !sidebarQ || (c.name || '').toLowerCase().includes(sidebarQ));
                  // ⭐ V6 (spec — Communautés) : sous-catégories Classes |
                  //    Matières | Enseignants | Parents | Administration | Autres
                  //    ⭐ 2026-10-15 — Extension : ajout des nouvelles catégories
                  //    par piste FR/EN et conseil des classes (définies par
                  //    AutoChannelByTrackService via metadata.category).
                  const COMMUNAUTE_CATS = [
                    { id: 'all', label: 'Tout' },
                    { id: 'classes', label: 'Classes' },
                    { id: 'matieres', label: 'Matières' },
                    { id: 'enseignants', label: 'Enseignants' },
                    { id: 'parents', label: 'Parents' },
                    { id: 'administration', label: 'Administration' },
                    // ⭐ 2026-10-15 — Nouvelles catégories par piste FR/EN
                    { id: 'administration-fr', label: 'Administration (FR)' },
                    { id: 'administration-en', label: 'Administration (EN)' },
                    { id: 'pedagogique-fr', label: 'Pédagogique (FR)' },
                    { id: 'pedagogique-en', label: 'Pédagogique (EN)' },
                    { id: 'conseil-general', label: 'Conseil des classes' },
                    { id: 'conseil-classe', label: 'Conseils par niveau' },
                    { id: 'autres', label: 'Autres' },
                  ] as const;
                  const catCount = (cat: string) =>
                    cat === 'all' ? groupConvs.length : groupConvs.filter(c => getCommunauteCategory(c) === cat).length;
                  const filteredGroupConvs = communauteFilter === 'all'
                    ? groupConvs
                    : groupConvs.filter(c => getCommunauteCategory(c) === communauteFilter);
                  if (groupConvs.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                        <Users className="w-12 h-12 text-slate-300 mb-2" />
                        <p className="text-sm font-medium text-slate-700">Aucune communauté</p>
                        <p className="text-xs text-slate-500 mt-1 mb-3">
                          Les groupes automatiques (Classes, Matières, Rôles, Personnel) seront créés pour l'année scolaire en cours.
                        </p>
                        {communautesSyncMessage && (
                          <p className="text-[11px] text-slate-600 mb-3 italic">{communautesSyncMessage}</p>
                        )}
                        {!readOnly && (
                          <div className="flex gap-2">
                            <button
                              onClick={syncAutoGroups}
                              disabled={communautesSyncing}
                              className="px-3 py-1.5 bg-[#10B981] text-white text-xs font-semibold rounded-lg hover:bg-[#059669] disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {communautesSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                              Synchroniser
                            </button>
                            <button
                              onClick={() => setShowNewGroup(true)}
                              className="px-3 py-1.5 bg-[#1677FF] text-white text-xs font-semibold rounded-lg hover:bg-[#0958D9]"
                            >
                              + Nouvelle communauté
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return (
                    <>
                      <div className="px-3 py-1.5 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 flex items-center gap-1.5">
                        <Users className="w-3 h-3" /> Communautés ({groupConvs.length})
                      </div>
                      {/* ⭐ V6 (spec — Communautés) : SOUS-CATÉGORIES
                          Classes | Matières | Enseignants | Parents | Administration */}
                      <div className="flex gap-1 px-3 py-2 border-b border-slate-100 overflow-x-auto no-scrollbar bg-white">
                        {COMMUNAUTE_CATS.map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => setCommunauteFilter(cat.id)}
                            className={cn(
                              'flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition',
                              communauteFilter === cat.id
                                ? 'bg-[#1677FF] text-white'
                                : catCount(cat.id) === 0
                                  ? 'bg-slate-50 text-slate-400 cursor-default'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            )}
                          >
                            {cat.label}{cat.id !== 'all' ? ` · ${catCount(cat.id)}` : ''}
                          </button>
                        ))}
                      </div>
                      {/* ⭐ V3-11: Sync status banner (shown during/after auto-group sync) */}
                      {(communautesSyncing || communautesSyncMessage) && (
                        <div className={cn(
                          'px-3 py-2 text-[11px] flex items-center gap-2 border-b',
                          communautesSyncing ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        )}>
                          {communautesSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          <span className="flex-1 truncate">
                            {communautesSyncing ? 'Synchronisation des communautés pour l\'année scolaire…' : communautesSyncMessage}
                          </span>
                          {!communautesSyncing && (
                            <button onClick={syncAutoGroups} className="text-blue-600 hover:underline font-semibold">
                              Re-sync
                            </button>
                          )}
                        </div>
                      )}
                      {/* ⭐ V6 — liste (filtrée par sous-catégorie) + regroupements visuels */}
                      {communauteFilter === 'all' ? (
                        COMMUNAUTE_CATS.filter(c => c.id !== 'all' && catCount(c.id) > 0).map(cat => (
                          <div key={cat.id}>
                            <div className="px-3 py-1.5 bg-blue-50/60 text-[10px] font-bold text-[#0958D9] uppercase tracking-wider sticky top-0 z-10 flex items-center gap-1.5">
                              {cat.id === 'classes' ? <GraduationCap className="w-3 h-3" />
                                : cat.id === 'matieres' ? <BookOpen className="w-3 h-3" />
                                : cat.id === 'enseignants' ? <UserCheck className="w-3 h-3" />
                                : cat.id === 'parents' ? <Heart className="w-3 h-3" />
                                : cat.id === 'administration' ? <Building2 className="w-3 h-3" />
                                : <Users className="w-3 h-3" />}
                              {cat.label} ({catCount(cat.id)})
                            </div>
                            {groupConvs.filter(c => getCommunauteCategory(c) === cat.id).map(conv => renderConversationItem(conv))}
                          </div>
                        ))
                      ) : filteredGroupConvs.length > 0 ? (
                        filteredGroupConvs.map(conv => renderConversationItem(conv))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                          <Users className="w-10 h-10 text-slate-300 mb-2" />
                          <p className="text-sm font-medium text-slate-700">Aucune communauté dans cette catégorie</p>
                          <p className="text-xs text-slate-500 mt-1">Synchronisez ou changez de catégorie.</p>
                        </div>
                      )}
                    </>
                  );
                }
                if (activeHelmSection === 'canaux') {
                  // ⭐ V5 — la recherche de la sidebar filtre aussi les canaux
                  const sidebarQ = sidebarSearch.trim().toLowerCase();
                  const listChannels = channels.filter((ch: any) => !sidebarQ || (ch.name || '').toLowerCase().includes(sidebarQ));
                  if (listChannels.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                        <Megaphone className="w-12 h-12 text-slate-300 mb-2" />
                        <p className="text-sm font-medium text-slate-700">Aucun canal</p>
                        <p className="text-xs text-slate-500 mt-1 mb-3">Créez un canal de diffusion (broadcast unidirectionnel).</p>
                        {!readOnly && (
                          <button
                            onClick={() => setShowNewChannel(true)}
                            className="px-3 py-1.5 bg-[#1677FF] text-white text-xs font-semibold rounded-lg hover:bg-[#0958D9]"
                          >
                            + Nouveau canal
                          </button>
                        )}
                      </div>
                    );
                  }
                  return (
                    <>
                      <div className="px-3 py-1.5 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 flex items-center gap-1.5">
                        <Megaphone className="w-3 h-3" /> Canaux ({listChannels.length})
                      </div>
                      {/* ⭐ V6 (spec §6) — bandeau de sync des canaux officiels */}
                      {(canauxSyncing || canauxSyncMessage) && (
                        <div className={cn(
                          'px-3 py-2 text-[11px] flex items-center gap-2 border-b',
                          canauxSyncing ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        )}>
                          {canauxSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          <span className="flex-1 truncate">
                            {canauxSyncing ? 'Synchronisation des canaux officiels…' : canauxSyncMessage}
                          </span>
                          {!canauxSyncing && (
                            <button onClick={syncAutoChannels} className="text-blue-600 hover:underline font-semibold">
                              Re-sync
                            </button>
                          )}
                        </div>
                      )}
                      {listChannels.map((ch: any) => (
                        <button
                          key={ch.id}
                          onClick={() => openChannel(ch)}
                          className={cn(
                            'w-full flex items-start gap-3 p-3 text-left hover:bg-slate-50 border-b border-slate-50 transition',
                            activeChannelId === ch.id && 'bg-[#E6F4FF]'
                          )}
                        >
                          <div className={cn(
                            'w-11 h-11 rounded-full flex items-center justify-center text-white flex-shrink-0',
                            ch.isOfficial
                              ? 'bg-gradient-to-br from-[#CFA63A] to-[#FFE08A]'
                              : 'bg-gradient-to-br from-blue-500 to-purple-600'
                          )}>
                            <Megaphone className={cn('w-5 h-5', ch.isOfficial && 'text-[#0A2A5E]')} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-sm font-semibold text-slate-900 truncate flex items-center gap-1.5">
                                <span className="truncate">{ch.name}</span>
                                {/* ⭐ V6 — badge canal OFFICIEL (créé automatiquement pour l'école) */}
                                {ch.isOfficial && (
                                  <span className="flex-shrink-0 text-[8px] font-bold px-1.5 py-px rounded bg-gradient-to-r from-[#CFA63A] to-[#FFE08A] text-[#0A2A5E] uppercase tracking-wide" title="Canal officiel de l'établissement">
                                    Officiel
                                  </span>
                                )}
                              </span>
                              {ch.lastMessageAt && (
                                <span className="text-[10px] text-slate-400">{formatTime(ch.lastMessageAt)}</span>
                              )}
                            </div>
                            <span className="text-xs text-slate-500 truncate block">
                              {ch.lastMessagePreview || `${ch.subscriberCount || 0} abonné(s)`}
                            </span>
                          </div>
                        </button>
                      ))}
                    </>
                  );
                }
                // Default: 'discussions' section
                // ⭐ V6 (spec — Discussions) : sous-catégories
                //    Privées (DIRECT) | Groupes (GROUP hors contexte scolaire) |
                //    Scolaires (pedagogicalType — classe/matière/devoir/activité/cours)
                //    + filtres rôles (Enseignants/Parents/Administration sur les DIRECT)
                const sidebarQ2 = sidebarSearch.trim().toLowerCase();
                const matchesSidebarSearch = (c: any) => {
                  if (!sidebarQ2) return true;
                  const other = c.participants?.find((p: any) => p.userId !== currentUserId);
                  const otherName = other ? `${other.firstName || ''} ${other.lastName || ''}`.trim().toLowerCase() : '';
                  return (c.name || '').toLowerCase().includes(sidebarQ2) || otherName.includes(sidebarQ2);
                };
                const isScolaire = (c: any) => !!(c as any).pedagogicalType;
                const allConvs = visibleConversations.filter(matchesSidebarSearch);
                const directConvs = allConvs.filter(c => {
                  if (c.type !== 'DIRECT') return false;
                  const other = c.participants.find(p => p.userId !== currentUserId);
                  if (categoryFilter === 'enseignants' || categoryFilter === 'parents' || categoryFilter === 'admin') {
                    if (!other) return false;
                    const role = (other.role_label || '').toUpperCase();
                    if (categoryFilter === 'enseignants') {
                      return role === 'ENSEIGNANT' || role === 'TEACHER' || role === 'TEACHER_RESP';
                    }
                    if (categoryFilter === 'parents') {
                      return role === 'PARENT' || role === 'GUARDIAN';
                    }
                    if (categoryFilter === 'admin') {
                      return role === 'PROMOTER' || role === 'SCHOOL_OWNER' || role === 'SCHOOL_ADMIN' ||
                           role === 'DIRECTOR_GENERAL' || role === 'DIRECTEUR_GENERAL' ||
                           role === 'SCHOOL_DIRECTOR' || role === 'DIRECTEUR_ETABLISSEMENT' ||
                           role === 'ADMIN' || role === 'COMPTABLE' || role === 'CAISSIER' ||
                           role === 'SUPER_ADMIN' || role === 'PLATFORM_OWNER';
                    }
                  }
                  return true; // 'all' et 'privees' → toutes les DIRECT
                });
                const scolairesConvs = allConvs.filter(c => isScolaire(c));
                const groupConvs = allConvs.filter(c => c.type === 'GROUP' && !isScolaire(c));
                return (
                  <>
                    {(categoryFilter === 'all' || categoryFilter === 'privees' || categoryFilter === 'enseignants' || categoryFilter === 'parents' || categoryFilter === 'admin') && directConvs.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 flex items-center gap-1.5">
                          <MessageSquare className="w-3 h-3" /> Discussions privées
                        </div>
                        {directConvs.map(conv => renderConversationItem(conv))}
                      </>
                    )}
                    {/* ⭐ V6 (spec §8) — CONVERSATIONS SCOLAIRES (pédagogiques) :
                        conversations liées à une classe, matière, devoir, activité, cours */}
                    {(categoryFilter === 'all' || categoryFilter === 'scolaires') && scolairesConvs.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-blue-50 text-[10px] font-bold text-[#0958D9] uppercase tracking-wider sticky top-0 z-10 flex items-center gap-1.5">
                          <GraduationCap className="w-3 h-3" /> Conversations scolaires
                        </div>
                        {scolairesConvs.map(conv => renderConversationItem(conv))}
                      </>
                    )}
                    {/* ⭐ CANAUX (Telegram-style broadcast channels) */}
                    {channels.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 flex items-center gap-1.5">
                          <Megaphone className="w-3 h-3" /> Canaux
                        </div>
                        {channels.map((ch: any) => (
                          <button
                            key={ch.id}
                            onClick={() => openChannel(ch)}
                            className={cn(
                              'w-full flex items-start gap-3 p-3 text-left hover:bg-slate-50 border-b border-slate-50 transition',
                              activeChannelId === ch.id && 'bg-[#E6F4FF]'
                            )}
                          >
                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0">
                              <Megaphone className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-sm font-semibold text-slate-900 truncate">{ch.name}</span>
                                {ch.lastMessageAt && (
                                  <span className="text-[10px] text-slate-400">{formatTime(ch.lastMessageAt)}</span>
                                )}
                              </div>
                              <span className="text-xs text-slate-500 truncate block">
                                {ch.lastMessagePreview || `${ch.subscriberCount || 0} abonné(s)`}
                              </span>
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                    {groupConvs.length > 0 && (categoryFilter === 'all' || categoryFilter === 'groupes') && (
                      <>
                        <div className="px-3 py-1.5 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 flex items-center gap-1.5">
                          <Users className="w-3 h-3" /> Groupes
                        </div>
                        {groupConvs.map(conv => renderConversationItem(conv))}
                      </>
                    )}
                    {/* ⭐ V6 — états vides ciblés par sous-catégorie */}
                    {categoryFilter !== 'all' &&
                      directConvs.length === 0 && groupConvs.length === 0 && scolairesConvs.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                        <MessageSquare className="w-10 h-10 text-slate-300 mb-2" />
                        <p className="text-sm font-medium text-slate-700">
                          {categoryFilter === 'privees' ? 'Aucune conversation privée'
                            : categoryFilter === 'groupes' ? 'Aucun groupe'
                            : categoryFilter === 'scolaires' ? 'Aucune conversation scolaire'
                            : 'Aucune conversation dans cette catégorie'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {categoryFilter === 'scolaires'
                            ? 'Les enseignants peuvent créer des conversations liées à une classe, une matière ou un devoir.'
                            : 'Démarrez une nouvelle conversation ou créez un groupe.'}
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </div>

        {/* ⭐ V3-11: Floating action bar for multi-select deletion.
            Shown at the bottom of the sidebar when selectionMode is active. */}
        {selectionMode && (
          <div className="bg-gradient-to-r from-[#0A2A5E] to-[#114FC4] text-white p-3 border-t border-[#1C6FE8]/30 flex items-center justify-between gap-2 shadow-lg">
            <div className="flex items-center gap-2 text-sm">
              <span className="bg-[#FFE08A] text-[#0A2A5E] px-2 py-0.5 rounded-full text-xs font-bold">
                {selectedConvIds.size} sélectionnée(s)
              </span>
              <button
                onClick={selectAllConversations}
                className="text-[11px] text-white/80 hover:text-white underline"
              >
                Tout sélectionner
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => deleteSelectedConversations('me')}
                disabled={selectedConvIds.size === 0}
                className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 flex items-center gap-1.5"
                title="Supprimer pour moi (masque localement)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Pour moi
              </button>
              <button
                onClick={() => deleteSelectedConversations('all')}
                disabled={selectedConvIds.size === 0}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg disabled:opacity-40 flex items-center gap-1.5"
                title="Supprimer pour tous (archive côté backend)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Pour tous
              </button>
              <button
                onClick={exitSelectionMode}
                className="px-2 py-1.5 text-white/80 hover:text-white text-xs"
                title="Annuler"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═════ RIGHT PANE — Chat View ═════ */}
      {activeConv ? (
        <>
        <div
          className="flex-1 flex flex-col bg-slate-50 relative"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onPaste={handlePaste}
        >
          {/* ⭐ DRAG & DROP overlay — shown when files are dragged over the chat */}
          {isDragOver && (
            <div className="absolute inset-0 z-50 bg-blue-500/10 border-4 border-dashed border-blue-500 rounded-lg flex items-center justify-center pointer-events-none">
              <div className="bg-white rounded-xl px-6 py-4 shadow-lg flex items-center gap-3">
                <Paperclip className="w-6 h-6 text-blue-600" />
                <span className="text-sm font-semibold text-slate-700">
                  Déposez les fichiers pour les envoyer
                </span>
              </div>
            </div>
          )}
          {/* Header */}
          <div className="p-3 bg-[#0958D9] text-white flex items-center gap-3 shadow-sm">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1 rounded hover:bg-[#0958D9]"
              title="Afficher les conversations"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 relative',
              getAvatarColor(getConversationDisplay(activeConv, currentUserId).name)
            )}>
              {getInitials(getConversationDisplay(activeConv, currentUserId).name)}
              {/* ⭐ Online dot (DIRECT only) */}
              {activeConv.type === 'DIRECT' && (() => {
                const other = activeConv.participants.find(p => p.userId !== currentUserId);
                return other && onlineUsers.has(other.userId) ? (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-[#0958D9]" />
                ) : null;
              })()}
            </div>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { const other = activeConv.participants.find(p => p.userId !== currentUserId); if (other) handleOpenProfile(other.userId, `${other.firstName || ''} ${other.lastName || ''}`.trim()); }}>
              <h3 className="text-sm font-bold truncate hover:underline">
                {getConversationDisplay(activeConv, currentUserId).name}
              </h3>
              {activeConv.type === 'GROUP' ? (
                <p className="text-[10px] text-[#BAE0FF]">
                  {activeConv.participants.map(p => `${p.firstName || ''} ${p.lastName || ''}`.trim()).join(', ')}
                </p>
              ) : typingUsers.length > 0 ? (
                /* ⭐ Typing indicator (like WhatsApp 'typing...') */
                <p className="text-[10px] text-[#BAE0FF] italic">
                  {typingUsers.map(t => `${t.firstName || ''} ${t.lastName || ''}`.trim()).join(', ')} tape…
                </p>
              ) : (
                <p className="text-[10px] text-[#BAE0FF] flex items-center gap-1">
                  {/* ⭐ V5 — badge E2E (parité Yeshua) : cadenas quand le
                      chiffrement de bout en bout est actif sur le direct. */}
                  {e2eAvailable && (
                    <Lock className="w-2.5 h-2.5 flex-shrink-0" aria-label="Chiffré de bout en bout" />
                  )}
                  <span className="truncate">{(() => {
                    const other = activeConv.participants.find(p => p.userId !== currentUserId);
                    const isOnline = other && onlineUsers.has(other.userId);
                    const roleLabel = getConversationDisplay(activeConv, currentUserId).roleLabel;
                    if (isOnline) return roleLabel ? `${roleLabel} — en ligne` : 'en ligne';
                    return roleLabel || getConversationDisplay(activeConv, currentUserId).subtitle || 'hors ligne';
                  })()}</span>
                </p>
              )}
            </div>
            {/* ⭐ V2: Call buttons (audio + video) + invite link (groups only).
                ⭐ V5 (parité Yeshua) : désactivés pendant un appel en cours. */}
            <button
              onClick={() => activeConv.type === 'GROUP' ? setShowGroupCallModal(true) : handleStartCall('AUDIO')}
              disabled={callState !== 'idle' || !!incomingSignal}
              className="p-1.5 rounded hover:bg-[#0958D9] disabled:opacity-40 disabled:pointer-events-none"
              title={activeConv.type === 'GROUP' ? 'Appel audio de groupe' : 'Appel audio'}
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              onClick={() => activeConv.type === 'GROUP' ? setShowGroupCallModal(true) : handleStartCall('VIDEO')}
              disabled={callState !== 'idle' || !!incomingSignal}
              className="p-1.5 rounded hover:bg-[#0958D9] disabled:opacity-40 disabled:pointer-events-none"
              title={activeConv.type === 'GROUP' ? 'Appel vidéo de groupe' : 'Appel vidéo'}
            >
              <Video className="w-4 h-4" />
            </button>
            {/* ⭐ V6 (spec §10, parité Yeshua) — MUET par conversation :
                cloche barrée si muet, cloche sinon ; menu 1h/8h/24h/∞. */}
            <div className="relative">
              <button
                onClick={() => setShowMuteMenu(!showMuteMenu)}
                className="p-1.5 rounded hover:bg-[#0958D9]"
                title={mutedConvs[activeConv.id] ? 'Notifications en muet — cliquez pour réactiver' : 'Mettre en muet (notifications)'}
              >
                {mutedConvs[activeConv.id]
                  ? <BellOff className="w-4 h-4 text-[#FFE08A]" />
                  : <Bell className="w-4 h-4" />}
              </button>
              {showMuteMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMuteMenu(false)} />
                  <div className="absolute right-0 top-9 z-50 bg-white rounded-xl shadow-2xl border border-slate-100 py-1.5 w-44 text-slate-700">
                    <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Couper les notifications
                    </p>
                    {([
                      { d: '1H', label: 'Pendant 1 heure' },
                      { d: '8H', label: 'Pendant 8 heures' },
                      { d: '24H', label: 'Pendant 24 heures' },
                      { d: 'FOREVER', label: 'Jusqu’à réactivation' },
                    ] as const).map(({ d, label }) => (
                      <button
                        key={d}
                        onClick={() => { muteConversationFor(activeConv.id, d); setShowMuteMenu(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50"
                      >
                        {label}
                      </button>
                    ))}
                    {mutedConvs[activeConv.id] && (
                      <>
                        <div className="h-px bg-slate-100 my-1" />
                        <button
                          onClick={() => { unmuteConversationFor(activeConv.id); setShowMuteMenu(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs font-semibold text-[#1677FF] hover:bg-slate-50 flex items-center gap-1.5"
                        >
                          <Bell className="w-3.5 h-3.5" /> Réactiver les notifications
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
            {mutedConvs[activeConv.id] && (
              <span className="text-[9px] font-semibold text-[#FFE08A] hidden sm:inline">Muet</span>
            )}
            {activeConv.type === 'GROUP' && (
              <button
                onClick={handleGenerateInviteLink}
                className="p-1.5 rounded hover:bg-[#0958D9] hidden sm:inline-flex"
                title="Copier le lien d'invitation"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            )}
            {/* ⭐ GAP FILL: In-conversation search toggle — hidden on mobile (<sm)
                to prevent header overflow. Use the global search (Search icon in
                the section rail) or the in-conversation search via keyboard. */}
            <button
              onClick={() => setShowConvSearch(!showConvSearch)}
              className="p-1.5 rounded hover:bg-[#0958D9] hidden sm:inline-flex"
              title="Rechercher dans la conversation"
            >
              <Search className="w-4 h-4" />
            </button>
            {/* ⭐ V4 Phase 2 (porté de Yeshua) : Galerie de médias de la
                conversation — grille + lightbox plein écran. */}
            <button
              onClick={() => setShowGallery(true)}
              className="p-1.5 rounded hover:bg-[#0958D9] hidden sm:inline-flex"
              title="Galerie de médias"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            {/* ⭐ V3-3: ORION-powered conversation summary button (Sparkles icon)
                — hidden on mobile to save space. */}
            <button
              onClick={handleSummarizeConversation}
              className="p-1.5 rounded hover:bg-[#0958D9] hidden md:inline-flex"
              title="Résumer la conversation (ORION IA)"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            {/* ⭐ DISCORD PARITY: Member list sidebar toggle (GROUP only).
                Opens a right-side panel showing all conversation members
                with online status, custom status, and role colors. */}
            {activeConv?.type === 'GROUP' && (
              <button
                onClick={toggleMemberList}
                className={cn('p-1.5 rounded hover:bg-[#0958D9]', showMemberList && 'bg-[#0958D9]/30')}
                title="Membres de la conversation"
              >
                <Users className="w-4 h-4" />
              </button>
            )}
            {/* ⭐ Issue A5 FIX: MoreVertical button now opens notification preferences for this conversation (was a no-op) */}
            <button
              onClick={() => setShowNotifPrefs(true)}
              className="p-1.5 rounded hover:bg-[#0958D9]"
              title="Préférences de notification"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* ⭐ V5 (parité Yeshua) — BANNIÈRE DES MESSAGES ÉPINGLÉS : barre sous
              le header avec aperçu du dernier épinglé + chevron ouvrant la liste
              complète → clic = saut vers le message + désépinglage direct. */}
          {pinnedMessages.length > 0 && (
            <div className="relative bg-[#EFF6FF] border-b border-[#DBEAFE] px-3 py-1.5 flex items-center gap-2">
              <Pin className="w-3.5 h-3.5 text-[#0958D9] flex-shrink-0 fill-[#0958D9]/20" />
              <button
                onClick={() => jumpToMessage(pinnedMessages[pinnedMessages.length - 1].id)}
                className="flex-1 min-w-0 text-left"
                title="Aller au message épinglé"
              >
                <span className="text-[11px] font-semibold text-[#0958D9]">
                  {pinnedMessages.length === 1 ? 'Message épinglé' : `${pinnedMessages.length} messages épinglés`}
                </span>
                <span className="text-[11px] text-slate-600 truncate block">
                  {(() => {
                    const last = pinnedMessages[pinnedMessages.length - 1] as any;
                    const who = last.sender?.firstName || last.senderFirstName || '';
                    return `${who ? who + ' : ' : ''}${pinnedPreview(last)}`;
                  })()}
                </span>
              </button>
              <button
                onClick={() => setShowPinnedList(v => !v)}
                className="p-1 rounded hover:bg-[#DBEAFE] text-[#0958D9] flex-shrink-0"
                title={showPinnedList ? 'Masquer la liste' : 'Voir tous les épinglés'}
              >
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showPinnedList && 'rotate-180')} />
              </button>
              {showPinnedList && (
                <div className="absolute top-full left-0 right-0 z-30 bg-white border-b border-slate-200 shadow-lg max-h-56 overflow-y-auto">
                  {pinnedMessages.slice().reverse().map((m: any) => (
                    <div key={m.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-0">
                      <button onClick={() => jumpToMessage(m.id)} className="flex-1 min-w-0 text-left">
                        <div className="text-[11px] font-semibold text-slate-800 truncate">
                          {m.sender?.firstName || m.senderFirstName || 'Message'} · {formatTime(m.createdAt)}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">{pinnedPreview(m)}</div>
                      </button>
                      <button
                        onClick={() => handleMessagePin(m.id)}
                        className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 flex-shrink-0"
                        title="Désépingler"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-1 relative [overflow-anchor:auto]"
            style={getHelmWatermarkStyle({ opacity: 0.05 })}
          >
            {loadingMsgs ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="w-12 h-12 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">Aucun message — démarrez la conversation</p>
              </div>
            ) : (
              <>
                {/* ⭐ PAGINATION — "Load more" button at the top of the messages list.
                    Discord-like: shows a spinner while loading and hides when
                    we've reached the beginning of the conversation. */}
                {hasMoreMessages && (
                  <div className="flex justify-center py-2">
                    <button
                      onClick={loadOlderMessages}
                      disabled={loadingMore}
                      className="px-4 py-1.5 text-xs font-semibold text-[#0958D9] bg-white border border-slate-200 rounded-full hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Chargement…
                        </>
                      ) : (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          Charger les messages précédents
                        </>
                      )}
                    </button>
                  </div>
                )}
                {messages.map((msg, idx) => {
                const isMine = msg.senderId === currentUserId;
                // ⭐ V5 — les messages SYSTÈME (« X a rejoint ») et journaux
                //    d'appels se rendent en pastille CENTRÉE sans bulle, sans
                //    avatar, sans actions (parité Yeshua MEMBER_LOG/CALL_LOG).
                const isSystemRow = msg.type === 'SYSTEM';
                if (isSystemRow) {
                  const smeta = (msg as any).callMeta || {};
                  const isJoin = smeta.kind === 'member_join';
                  const SysIcon = isJoin ? UserPlus : UserMinus;
                  return (
                    <React.Fragment key={msg.id}>
                      {(idx === 0 || new Date(messages[idx - 1].createdAt).toDateString() !== new Date(msg.createdAt).toDateString()) && (
                        <div className="flex items-center justify-center my-2">
                          <span className="px-3 py-1 bg-slate-200/70 text-slate-600 text-[10px] font-semibold rounded-full">
                            {formatDateSeparator(msg.createdAt)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-center my-1" data-msg-id={msg.id}>
                        <div
                          title={msg.content || 'Événement'}
                          className={cn(
                            'flex items-center justify-center gap-1.5 py-1.5 px-3.5 rounded-full border text-[11px] font-medium max-w-[85%]',
                            isJoin
                              ? 'bg-blue-50 text-blue-700 border-blue-100'
                              : 'bg-stone-100 text-stone-600 border-stone-200',
                          )}
                        >
                          <SysIcon className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{msg.content || 'Événement de groupe'}</span>
                          {smeta.byName && smeta.byName !== smeta.name ? (
                            <span className="opacity-70">· invité par {smeta.byName}</span>
                          ) : null}
                          <span className="opacity-50">· {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                }
                // ⭐ V5 (parité Yeshua) — infos d'expéditeur pour CHAQUE message
                //    d'autrui : avatar (photo ou initiales SUR la couleur
                //    signature) + nom au-dessus de la bulle dans la même couleur.
                const senderParticipant = !isMine
                  ? activeConv?.participants?.find((p: any) => p.userId === msg.senderId)
                  : null;
                const senderName = !isMine
                  ? `${(msg as any).senderFirstName || (msg as any).sender?.firstName || senderParticipant?.firstName || ''} ${(msg as any).senderLastName || (msg as any).sender?.lastName || senderParticipant?.lastName || ''}`.trim() || 'Utilisateur'
                  : '';
                const senderColorIdx = !isMine ? hashUserId(msg.senderId || 'x') : 0;
                const senderAvatar = !isMine
                  ? ((msg as any).sender?.avatarUrl || (msg as any).sender?.photoUrl || (senderParticipant as any)?.avatarUrl || null)
                  : null;
                const senderIsAdmin = !isMine && /ADMIN|DIRECTEUR|DIRECTOR|SUPER/i
                  .test(String(senderParticipant?.roleLabel || (senderParticipant as any)?.role_label || (msg as any).sender?.role || ''));
                // ⭐ V6 (parité Yeshua — AUDIT_PRIVILEGED_ROLES + spec §3/§17) :
                //    l'ADMIN/MODÉRATEUR de la conversation (ou un membre staff
                //    de l'établissement) peut supprimer N'IMPORTE QUEL message
                //    « pour tous » — le backend l'autorise déjà, l'UI cachait
                //    l'action (isMine uniquement).
                const myConvMember: any = conversationMembers.find((m: any) => m.userId === currentUserId) ||
                  activeConv?.participants?.find((p: any) => p.userId === currentUserId);
                const myConvRole = String(myConvMember?.role || '').toUpperCase();
                const amConvPrivileged = myConvRole === 'ADMIN' || myConvRole === 'MODERATOR' ||
                  /SCHOOL_ADMIN|SCHOOL_OWNER|DIRECTOR|DIRECTEUR|SUPER_ADMIN|PLATFORM_OWNER|PROMOTER|ADMIN/i
                    .test(String(user?.roleLabel || ''));
                const showDateSeparator = idx === 0 ||
                  new Date(messages[idx - 1].createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
                return (
                  <React.Fragment key={msg.id}>
                    {showDateSeparator && (
                      <div className="flex items-center justify-center my-2">
                        <span className="px-3 py-1 bg-slate-200/70 text-slate-600 text-[10px] font-semibold rounded-full">
                          {formatDateSeparator(msg.createdAt)}
                        </span>
                      </div>
                    )}
                    <div className={cn('flex group gap-1.5', isMine ? 'justify-end' : 'justify-start')}>
                      {/* ⭐ V5 (parité Yeshua) — avatar de l'expéditeur sur chaque
                          message d'autrui (photo réelle ou initiales sur fond de
                          la couleur signature). */}
                      {!isMine && (
                        <div
                          className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 self-end flex items-center justify-center text-white text-[11px] font-bold shadow-sm"
                          style={{ backgroundColor: USER_TEXT_COLORS[senderColorIdx] }}
                        >
                          {senderAvatar
                            ? <img src={senderAvatar} alt="" className="w-full h-full object-cover" />
                            : getInitials(senderName)}
                        </div>
                      )}
                      <div className="min-w-0 flex flex-col max-w-full">
                        {/* ⭐ V5 (parité Yeshua) — nom « signature » au-dessus de
                            la bulle, couleur stable par expéditeur + ★ admin. */}
                        {!isMine && (
                          <div className="flex items-center gap-1 px-1 mb-0.5">
                            <span className="text-[11px] font-bold truncate" style={{ color: USER_TEXT_COLORS[senderColorIdx] }}>
                              {senderName}
                            </span>
                            {senderIsAdmin && (
                              <span className="text-[9px] text-amber-500 font-bold" title="Administrateur">★</span>
                            )}
                          </div>
                        )}
                      <div
                        data-msg-id={msg.id}
                        className={cn(
                          'max-w-[min(82%,640px)] rounded-2xl px-3 py-2 text-sm shadow-sm relative',
                          isMine
                            ? 'bg-[#3B9EFF] text-white rounded-br-sm'
                            : activeConv?.type === 'GROUP' && (msg as any).senderId
                              // ⭐ V4 (porté de Yeshua) — couleur de bulle STABLE
                              //    par expéditeur dans les groupes (hash djb2 +
                              //    palette 8) : identification visuelle instantanée.
                              ? cn('border rounded-bl-sm', USER_BUBBLE_COLORS[hashUserId((msg as any).senderId)])
                              : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                        )}
                        // ⭐ V3-11: LEFT click on the message toggles the quick
                        //   reaction bar (no more hover — was too cluttered).
                        //   Right-click + long-press still work for context menu.
                        onClick={(e) => {
                          if (isReadOnly) return;
                          e.stopPropagation();
                          setShowReactionBar(prev => prev === msg.id ? null : msg.id);
                        }}
                        // ⭐ FIX: Long-press (mobile) + right-click (desktop) → show reaction bar (WhatsApp style)
                        onContextMenu={(e) => {
                          if (isReadOnly) return;
                          e.preventDefault();
                          handleMessageLongPress(msg, e);
                        }}
                        onTouchStart={(e) => handleTouchStart(msg, e)}
                        onTouchEnd={handleTouchEnd}
                        onTouchMove={handleTouchEnd}
                      >
                        {/* ⭐ FIX: Reply quote inside bubble — WhatsApp style */}
                        {(msg as any).replyToId && replyQuoteCache[(msg as any).replyToId] && (
                          <div className={cn(
                            'mb-1.5 px-2 py-1 rounded-md text-[11px] border-l-2 cursor-pointer',
                            isMine
                              ? 'bg-white/10 border-white/40 text-white/80'
                              : 'bg-slate-100 border-[#1677FF] text-slate-600'
                          )}
                          onClick={() => {
                            // ⭐ V3-11: Scroll to the parent message WITHIN the messages
                            //   container (not the page — scrollIntoView would also scroll
                            //   the parent page, pushing the chat to the top on teacher/parent
                            //   pages). We compute the target offset and use container.scrollTo.
                            const el = document.querySelector(`[data-msg-id="${(msg as any).replyToId}"]`) as HTMLElement;
                            const container = messagesContainerRef.current;
                            if (el && container) {
                              const elTop = el.offsetTop;
                              const elHeight = el.offsetHeight;
                              const containerHeight = container.clientHeight;
                              const targetScroll = elTop - (containerHeight - elHeight) / 2;
                              container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
                              el.classList.add('ring-2', 'ring-blue-400');
                              setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400'), 1500);
                            }
                          }}
                        >
                          <div className="font-bold truncate">{replyQuoteCache[(msg as any).replyToId].senderName}</div>
                          <div className="truncate opacity-80">{replyQuoteCache[(msg as any).replyToId].content}</div>
                        </div>
                        )}
                        {/* ⭐ Message actions — button (top right of bubble)
                            On desktop: appears on hover (opacity-0 → group-hover:opacity-100).
                            On mobile: always visible (no hover on touch devices — the button
                            must be tappable to open the Reply/Edit/Forward/Pin/Delete menu).
                            We use `opacity-100 md:opacity-0 md:group-hover:opacity-100`
                            so it's always shown on small screens and hover-revealed on md+. */}
                        {!isReadOnly && (
                          <button
                            data-msg-action-trigger
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuMsgId(activeMenuMsgId === msg.id ? null : msg.id);
                            }}
                            className="absolute top-1 right-1 p-1.5 rounded-full bg-white/20 hover:bg-white/40 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity touch-manipulation"
                            title="Actions"
                            aria-label="Actions du message"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {/* ⭐ FIX: Action dropdown menu — positioned ABOVE the bubble + state-driven (auto-closes on outside click) */}
                        {!isReadOnly && activeMenuMsgId === msg.id && (
                          <div className="msg-action-menu absolute bottom-full right-0 mb-1 z-50 min-w-[160px] bg-white border border-slate-200 rounded-lg shadow-xl py-1">
                            <button
                              onClick={() => { handleMessageReply(msg.id); setActiveMenuMsgId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              <Reply className="w-3.5 h-3.5" /> Répondre
                            </button>
                            {/* ⭐ V5 (parité Yeshua) — ouvrir le FIL de discussion */}
                            <button
                              onClick={() => { setThreadParentId(msg.id); setActiveMenuMsgId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              <MessageCircle className="w-3.5 h-3.5" /> Fil de discussion
                              {(replyCountByParent[msg.id] || 0) > 0 && (
                                <span className="ml-auto bg-slate-100 text-slate-600 text-[9px] font-bold px-1.5 py-px rounded-full">
                                  {replyCountByParent[msg.id]}
                                </span>
                              )}
                            </button>
                            {/* ⭐ FIX: Réagir — opens the floating reaction bar above the bubble */}
                            <button
                              onClick={(e) => {
                                handleMessageLongPress(msg, e);
                                setActiveMenuMsgId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              <span className="text-sm">😊</span> Réagir
                            </button>
                            <button
                              onClick={() => {
                                const textContent = stripHtml(msg.content);
                                navigator.clipboard.writeText(textContent).then(() => toast.success('Message copié'));
                                setActiveMenuMsgId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              <Copy className="w-3.5 h-3.5" /> Copier
                            </button>
                            <button
                              onClick={() => { handleMessagePin(msg.id); setActiveMenuMsgId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              <Pin className="w-3.5 h-3.5" /> Épingler
                            </button>
                            {/* ⭐ V1.5: Edit (sender only) */}
                            {isMine && msg.type === 'TEXT' && (
                              <button
                                onClick={() => {
                                  setEditingMessageId(msg.id);
                                  setEditContent(stripHtml(msg.content));
                                  setActiveMenuMsgId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Modifier
                              </button>
                            )}
                            {/* ⭐ V1.5: Forward */}
                            <button
                              onClick={() => { handleMessageForward(msg.id); setActiveMenuMsgId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              <Forward className="w-3.5 h-3.5" /> Transférer
                            </button>
                            {/* ⭐ V1.5: Important toggle */}
                            <button
                              onClick={() => { handleToggleImportant(msg.id); setActiveMenuMsgId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              <Star className="w-3.5 h-3.5" /> {(msg as any).isImportant ? 'Retirer marquage' : 'Marquer important'}
                            </button>
                            <button
                              onClick={() => { handleMessageDeleteForMe(msg.id); setActiveMenuMsgId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Supprimer pour moi
                            </button>
                            {/* ⭐ GAP FILL: Signaler (moderation) */}
                            <button
                              onClick={() => { handleReportMessage(msg.id); setActiveMenuMsgId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-amber-600 hover:bg-amber-50"
                            >
                              <Flag className="w-3.5 h-3.5" /> Signaler
                            </button>
                            {/* ⭐ V4 Phase 2 — Copier le texte du message
                                (l'action n'existait que pour les blocs de code). */}
                            {msg.content && (
                              <button
                                onClick={() => {
                                  navigator.clipboard?.writeText(stripHtml(msg.content) || '').then(
                                    () => toast.success('Message copié'),
                                    () => toast.error('Copie impossible'),
                                  );
                                  setActiveMenuMsgId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                              >
                                <Copy className="w-3.5 h-3.5" /> Copier le texte
                              </button>
                            )}
                            {/* ⭐ V3-2: Transcrire (audio messages only) */}
                            {msg.type === 'AUDIO' && (
                              <button
                                onClick={() => { handleTranscribeMessage(msg.id); setActiveMenuMsgId(null); }}
                                disabled={transcribingMsgId === msg.id}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                              >
                                {transcribingMsgId === msg.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <AudioLines className="w-3.5 h-3.5" />
                                )}
                                {transcribingMsgId === msg.id ? 'Transcription en cours...' : 'Transcrire (Whisper)'}
                              </button>
                            )}
                            {(isMine || amConvPrivileged) && (
                              <button
                                onClick={() => { handleMessageDeleteForEveryone(msg.id); setActiveMenuMsgId(null); }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Supprimer pour tous
                                {!isMine && <span className="text-[9px] text-rose-400">(modération)</span>}
                              </button>
                            )}
                          </div>
                        )}
                        {/* Sender name (for group) — ⭐ V5 : SUPPRIMÉ (doublon) — le nom
                            « signature » coloré est désormais affiché au-dessus de
                            CHAQUE bulle d'autrui (voir wrapper V5 ci-dessus). */}
                        {/* Content based on message type */}
                        {/* ⭐ V5 — JOURNAL D'APPEL RICHE (parité Yeshua) :
                            pastille centrée avec couleur par statut (rouge =
                            manqué, ambre = refusé, gris = annulé, vert =
                            terminé), auteur de l'appel, durée lisible, heure,
                            icône audio/vidéo et tooltip du texte complet.
                            (Les messages SYSTEM sont rendus AVANT la bulle —
                            voir le retour anticipé isSystemRow ci-dessus.) */}
                        {msg.type === 'CALL_LOG' ? (() => {
                          const meta = (msg as any).callMeta || {};
                          const status = String(meta.status || '').toLowerCase();
                          const isVideo = meta.callType === 'video';
                          const style =
                            status === 'missed' ? 'bg-red-50 text-red-700 border-red-100' :
                            status === 'declined' || status === 'rejected' ? 'bg-amber-50 text-amber-800 border-amber-100' :
                            status === 'cancelled' ? 'bg-stone-100 text-stone-600 border-stone-200' :
                            'bg-emerald-50 text-emerald-700 border-emerald-100';
                          const CallIcon = status === 'missed' ? PhoneMissed : isVideo ? Video : Phone;
                          return (
                          <div
                            title={msg.content || 'Appel'}
                            className={cn('mx-auto flex items-center justify-center gap-1.5 py-1.5 px-3.5 rounded-full border text-[11px] font-medium max-w-[85%]', style)}
                          >
                            <CallIcon className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{msg.content || 'Appel'}</span>
                            {meta.byName ? <span className="opacity-70">· {meta.byName}</span> : null}
                            <span className="opacity-50">· {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          );
                        })() : msg.type === 'TEXT' && editingMessageId === msg.id ? (
                          // ⭐ V1.5: Inline edit mode
                          <div className="flex flex-col gap-1">
                            <textarea
                              autoFocus
                              value={editContent}
                              onChange={e => setEditContent(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  if (editContent.trim()) {
                                    handleMessageEdit(msg.id, editContent.trim());
                                  }
                                  setEditingMessageId(null);
                                } else if (e.key === 'Escape') {
                                  setEditingMessageId(null);
                                }
                              }}
                              className={cn(
                                'w-full text-sm bg-transparent border rounded-lg p-1.5 outline-none resize-none',
                                isMine ? 'border-white/30 text-white' : 'border-slate-300 text-slate-800'
                              )}
                              rows={Math.min(5, Math.max(1, editContent.split('\n').length))}
                            />
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => setEditingMessageId(null)}
                                className={cn('text-[10px] px-2 py-0.5 rounded', isMine ? 'text-white/70 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100')}
                              >Annuler</button>
                              <button
                                onClick={() => {
                                  if (editContent.trim()) handleMessageEdit(msg.id, editContent.trim());
                                  setEditingMessageId(null);
                                }}
                                className="text-[10px] px-2 py-0.5 rounded bg-blue-500 text-white hover:bg-blue-600"
                              >Enregistrer</button>
                            </div>
                          </div>
                        ) : msg.type === 'TEXT' && (
                          <div
                            className="whitespace-pre-wrap break-words"
                            dangerouslySetInnerHTML={{ __html: highlightMentions(msg.content || '') }}
                          />
                        )}
                        {msg.type === 'IMAGE' && msg.attachmentUrl && (
                          <div>
                            <a
                              href={getAttachmentUrl(msg.attachmentUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="block"
                              onClick={(e) => { e.preventDefault(); setPreviewDoc({ filePath: getAttachmentUrl(msg.attachmentUrl), fileName: msg.attachmentName || 'Image', mimeType: msg.attachmentMime || 'image/*' }); }}
                            >
                              <img
                                src={getAttachmentUrl(msg.attachmentUrl)}
                                alt={msg.attachmentName || 'Image'}
                                className="max-w-full rounded-lg mb-1 cursor-pointer hover:opacity-90 transition-opacity"
                                style={{ maxHeight: '300px' }}
                                decoding="async"
                              />
                            </a>
                            {msg.content && <p className="text-xs mt-1">{msg.content}</p>}
                          </div>
                        )}
                        {/* ⭐ V4 Phase 2 (porté de Yeshua) — Aperçu de liens
                            (OpenGraph) sous les messages texte contenant une URL. */}
                        {msg.type === 'TEXT' && msg.content && /https?:\/\//i.test(stripHtml(msg.content) || '') && (
                          <LinkEmbed text={stripHtml(msg.content) || ''} />
                        )}
                        {msg.type === 'AUDIO' && msg.attachmentUrl && (
                          <div className="flex flex-col gap-0.5 min-w-0">
                            {/* ⭐ V5 — lecteur vocal waveform + vitesse (spec #12) */}
                            <VoiceNotePlayer
                              src={getAttachmentUrl(msg.attachmentUrl)}
                              name={msg.attachmentName}
                              isMine={isMine}
                            />
                            {msg.content && <span className="text-xs">{msg.content}</span>}
                          </div>
                        )}
                        {msg.type === 'DOCUMENT' && msg.attachmentUrl && (() => {
                          const ft = getFileTypeIcon(msg.attachmentMime, msg.attachmentName);
                          const isVideo = (msg.attachmentMime || '').startsWith('video/') || /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(msg.attachmentName || '');
                          return (
                            <div>
                              {/* ⭐ DISCORD PARITY: Inline video player for video attachments.
                                  If the attachment MIME is video/* (or the extension is a known
                                  video format), render a <video> element instead of a file chip.
                                  The video is loaded from the attachment URL and has native
                                  controls (play, pause, seek, volume, fullscreen). */}
                              {isVideo ? (
                                <video
                                  controls
                                  src={getAttachmentUrl(msg.attachmentUrl)}
                                  className="w-full max-w-[280px] rounded-lg"
                                  style={{ maxHeight: '300px' }}
                                  preload="metadata"
                                />
                              ) : (
                              <a
                                href={getAttachmentUrl(msg.attachmentUrl)}
                                download={msg.attachmentName}
                                target="_blank"
                                rel="noreferrer"
                                className={cn(
                                  'flex items-center gap-2 p-2 rounded-lg transition-colors',
                                  isMine ? 'hover:bg-white/10' : 'hover:bg-slate-100',
                                )}
                                onClick={(e) => { e.preventDefault(); setPreviewDoc({ filePath: getAttachmentUrl(msg.attachmentUrl), fileName: msg.attachmentName || ft.label, mimeType: msg.attachmentMime || '' }); }}
                              >
                                {ft.icon}
                                <div className="min-w-0">
                                  <div className={cn('text-xs font-semibold truncate', isMine ? 'text-white' : 'text-slate-900')}>{msg.attachmentName || ft.label}</div>
                                  <div className={cn('text-[10px]', isMine ? 'text-white/80' : 'text-slate-500')}>{ft.label}{msg.attachmentSize ? ` · ${formatFileSize(msg.attachmentSize)}` : ''}</div>
                                </div>
                              </a>
                              )}
                              {/* ⭐ Issue B FIX: render the caption text below the file chip.
                                  The backend sends a formatted message (same wording as the WhatsApp
                                  template 'recu_paiement') as msg.content. Previously this was NOT
                                  rendered for DOCUMENT messages — only the file chip was shown.
                                  Now we render it with dangerouslySetInnerHTML (same as TEXT branch)
                                  because the caption uses HTML formatting (<b>, <i>, \n). */}
                              {msg.content && (
                                <div
                                  className={cn(
                                    'whitespace-pre-wrap break-words text-xs mt-1',
                                    isMine ? 'text-white/90' : 'text-slate-700',
                                  )}
                                  dangerouslySetInnerHTML={{ __html: renderRichContent(decryptedContents[msg.id] ?? msg.content) }}
                                />
                              )}
                            </div>
                          );
                        })()}
                        {/* ⭐ POLL — Telegram-style poll display with WHITE background for readability */}
                        {msg.type === 'POLL' && msg.content && (() => {
                          try {
                            const poll = JSON.parse(msg.content);
                            const totalVotes = poll.options?.reduce((sum: number, o: any) => sum + (o.voteCount || 0), 0) || 0;
                            return (
                              <div className="min-w-[200px] bg-white rounded-lg p-3 shadow-sm">
                                {/* Poll icon + question — DARK text on WHITE background */}
                                <div className="flex items-center gap-1.5 mb-3">
                                  <BarChart3 className="w-4 h-4 text-[#1677FF] flex-shrink-0" />
                                  <span className="text-sm font-bold text-slate-900">{poll.question}</span>
                                </div>
                                {/* Options — each option is a clearly visible button */}
                                <div className="space-y-1.5">
                                  {poll.options?.map((opt: any, idx: number) => {
                                    const pct = totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;
                                    return (
                                      <button
                                        key={idx}
                                        onClick={async () => {
                                          try {
                                            // ⭐ V5 (parité Yeshua) — mise à jour OPTIMISTE du sondage :
                                            //    avant, le vote rechargeait TOUTE la conversation
                                            //    (loadMessages complet → re-render + saut de scroll).
                                            setMessages(prev => prev.map(m => {
                                              if (m.id !== msg.id) return m;
                                              try {
                                                const p = JSON.parse(m.content || '{}');
                                                const opts = (p.options || []).map((o: any) =>
                                                  o.id === opt.id ? { ...o, voteCount: (o.voteCount || 0) + 1 } : o);
                                                return { ...m, content: JSON.stringify({ ...p, options: opts }) } as any;
                                              } catch { return m; }
                                            }));
                                            await fetch(`/api/chat/v2/polls/${msg.id}/vote`, {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ userId: currentUserId, optionIds: [opt.id] }),
                                              credentials: 'include',
                                            });
                                            // Réconciliation silencieuse (fusion à signature → zéro
                                            // perturbation de scroll si rien d'autre n'a changé)
                                            if (activeConvId) loadMessages();
                                          } catch (e) {
                                            toast.error('Échec du vote');
                                            // Rollback : relire la vérité serveur
                                            if (activeConvId) loadMessages();
                                          }
                                        }}
                                        className="w-full text-left p-2 rounded-lg bg-slate-50 hover:bg-[#E6F4FF] transition-colors relative overflow-hidden border border-slate-200"
                                      >
                                        {/* Progress bar background */}
                                        {pct > 0 && (
                                          <div
                                            className="absolute inset-y-0 left-0 bg-[#1677FF]/15 rounded-lg transition-all"
                                            style={{ width: `${pct}%` }}
                                          />
                                        )}
                                        <div className="relative flex items-center justify-between gap-2">
                                          <span className="text-xs text-slate-700 font-medium">{opt.text}</span>
                                          <span className="text-[10px] font-bold text-[#0958D9]">
                                            {opt.voteCount > 0 ? `${pct}% (${opt.voteCount})` : ''}
                                          </span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                                {/* Footer — DARK text on WHITE background */}
                                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                                  <span className="font-medium">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
                                  {poll.multipleChoice && <span>· Choix multiple</span>}
                                  {poll.anonymous && <span>· Anonyme</span>}
                                  {poll.closed && <span className="text-rose-500 font-bold">· Fermé</span>}
                                </div>
                              </div>
                            );
                          } catch {
                            return <span className={cn('text-xs', isMine ? 'text-white/80' : 'text-slate-500')}>Sondage</span>;
                          }
                        })()}
                        {/* Timestamp + read receipt (WhatsApp-style: ✓ sent, ✓✓ delivered, blue ✓✓ read) */}
                        <div className={cn(
                          'flex items-center gap-1 mt-0.5',
                          isMine ? 'justify-end text-white/80' : 'justify-end text-slate-500'
                        )}>
                          {/* ⭐ V1.5: Important badge */}
                          {(msg as any).isImportant && (
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          )}
                          {/* ⭐ V1.5: Edited indicator */}
                          {msg.editedAt && (
                            <span className="text-[9px] italic opacity-70">modifié</span>
                          )}
                          <span className="text-[10px]">{formatTime(msg.createdAt)}</span>
                          {isMine && getReceiptIcon(msg, true)}
                        </div>
                        {/* ⭐ V3-11: Quick reaction bar — only shown on EXPLICIT click
                            (no longer on hover, which was too cluttered). The bar stays
                            visible until the user clicks elsewhere, so they can react
                            with multiple emojis without re-opening it. */}
                        {!isReadOnly && (
                          <div className={cn(
                            'absolute -top-7 right-0 flex items-center gap-0.5 bg-white rounded-full shadow-lg border border-slate-200 px-1 py-0.5 transition-opacity',
                            showReactionBar === msg.id
                              ? 'opacity-100 pointer-events-auto'
                              : 'opacity-0 pointer-events-none'
                          )}>
                            {QUICK_EMOJIS.map(emoji => (
                              <button
                                key={emoji}
                                onClick={(e) => { e.stopPropagation(); handleToggleReaction(msg.id, emoji); }}
                                className="text-sm hover:scale-125 transition-transform p-1 rounded-full hover:bg-slate-100"
                                title={`Réagir avec ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                        {/* ⭐ V1.5: Reactions display (grouped by emoji with count) */}
                        {(msg as any).reactions && (msg as any).reactions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(
                              (msg as any).reactions.reduce((acc: Record<string, number>, r: any) => {
                                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                return acc;
                              }, {})
                            ).map(([emoji, count]) => {
                              const reactionCount = Number(count) || 0;
                              const myReaction = (msg as any).reactions.some((r: any) => r.userId === currentUserId && r.emoji === emoji);
                              return (
                                <button
                                  key={emoji}
                                  onClick={() => handleToggleReaction(msg.id, emoji)}
                                  className={cn(
                                    'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-colors',
                                    myReaction
                                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                                  )}
                                  title={myReaction ? 'Cliquez pour retirer' : 'Cliquez pour réagir'}
                                >
                                  {renderReactionIcon(emoji, 12)}
                                  {reactionCount > 1 && <span>{reactionCount}</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {/* ⭐ V5 (parité Yeshua — Threads) — badge « N réponses »
                            sur la bulle parent : clic = ouvrir le fil. */}
                        {(replyCountByParent[msg.id] || 0) > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setThreadParentId(msg.id); }}
                            className={cn('mt-1 flex items-center gap-1 text-[10px] font-semibold hover:underline',
                              isMine ? 'text-white/85' : 'text-[#0958D9]')}
                            title="Ouvrir le fil de discussion"
                          >
                            <MessageCircle className="w-3 h-3" />
                            {replyCountByParent[msg.id]} réponse{(replyCountByParent[msg.id] || 0) > 1 ? 's' : ''}
                          </button>
                        )}
                      </div>
                    </div>
                    </div>
                  </React.Fragment>
                );
              })
              }
              {/* ⭐ V5 (parité Yeshua) — bulle « tape… » en BAS de la liste :
                  3 points animés (délais 0/150/300 ms) + libellé pluriel
                  « X et Y écrivent… / X et N autres » — au lieu d'un simple
                  libellé dans le header. */}
              {typingUsers.length > 0 && !loadingMsgs && (
                <div className="flex items-end gap-1.5 mt-1">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center gap-[3px] flex-shrink-0">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1 h-1 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-1.5 shadow-sm">
                    <span className="text-xs text-slate-500">
                      {typingUsers.length === 1
                        ? `${(typingUsers[0].firstName || typingUsers[0].lastName || 'Quelqu\u2019un').trim()} tape…`
                        : typingUsers.length === 2
                          ? `${(typingUsers[0].firstName || '').trim()} et ${(typingUsers[1].firstName || '').trim()} écrivent…`
                          : `${(typingUsers[0].firstName || '').trim()} et ${typingUsers.length - 1} autres écrivent…`}
                    </span>
                  </div>
                </div>
              )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar — fully responsive (mobile-friendly) */}
          <div className="p-2 sm:p-3 bg-white border-t border-slate-200">
            {/* ⭐ V6 — BANDEAU DES MESSAGES PROGRAMMÉS EN ATTENTE :
                affiche chaque message PENDING avec sa date/heure d'envoi
                prévue + bouton d'annulation. Le dispatch serveur tourne
                toutes les 60 s (fix tenantId appliqué). */}
            {scheduledMessages.length > 0 && (
              <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50/70 p-2">
                <div className="flex items-center gap-1.5 px-1 mb-1.5 text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                  <Clock className="w-3 h-3" />
                  {scheduledMessages.length} message{scheduledMessages.length > 1 ? 's' : ''} programmé{scheduledMessages.length > 1 ? 's' : ''}
                </div>
                <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto">
                  {scheduledMessages.map((sm: any) => (
                    <div key={sm.id} className="flex items-center gap-2 px-2 py-1.5 bg-white rounded-lg border border-amber-100">
                      <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold text-slate-800 truncate">
                          {String(sm.content || '').replace(/<[^>]*>/g, '') || '—'}
                        </div>
                        <div className="text-[10px] text-amber-700 font-medium">
                          {sm.scheduledFor ? new Date(sm.scheduledFor).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                          <span className="text-slate-400"> · envoi automatique</span>
                        </div>
                      </div>
                      <button
                        onClick={() => cancelScheduledMessage(sm.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded flex-shrink-0"
                        title="Annuler ce message programmé"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* ⭐ State machine: idle | recording | paused | preview
                Compact and aesthetic recording UI — small width, clear actions. */}
            {recordingState === 'recording' || recordingState === 'paused' ? (
              // Compact recording UI — single bar with timer + 3 small buttons
              <div className="flex items-center gap-2 justify-between">
                {/* Left: indicator + timer */}
                <div className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-full border flex-shrink-0',
                  recordingState === 'recording'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-amber-50 border-amber-200'
                )}>
                  {recordingState === 'recording' ? (
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  ) : (
                    <Pause className="w-3 h-3 text-amber-600" />
                  )}
                  <span className={cn(
                    'text-xs font-mono font-bold tabular-nums',
                    recordingState === 'recording' ? 'text-red-600' : 'text-amber-700'
                  )}>
                    {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                {/* Right: 3 compact action buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {recordingState === 'recording' ? (
                    <button
                      onClick={pauseRecording}
                      className="p-2 bg-amber-500 text-white rounded-full hover:bg-amber-600"
                      title="Pause"
                    >
                      <Pause className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={resumeRecording}
                      className="p-2 bg-emerald-500 text-white rounded-full hover:bg-emerald-600"
                      title="Reprendre"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={stopRecording}
                    className="p-2 bg-[#1677FF] text-white rounded-full hover:bg-[#0958D9]"
                    title="Arrêter et écouter"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={cancelRecording}
                    className="p-2 bg-rose-500 text-white rounded-full hover:bg-rose-600"
                    title="Annuler"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : recordingState === 'preview' && audioBlobUrl ? (
              // Compact preview UI — audio player + send + cancel
              <div className="flex items-center gap-2 bg-[#E6F4FF] border border-[#BAE0FF] rounded-full pl-2 pr-1 py-1">
                <audio
                  controls
                  src={audioBlobUrl}
                  className="h-7 flex-1 min-w-0"
                  style={{ maxWidth: '100%' }}
                />
                <button
                  onClick={sendRecordedAudio}
                  disabled={sending || !activeConvId}
                  className="p-2 bg-[#1677FF] text-white rounded-full hover:bg-[#0958D9] disabled:opacity-30 flex-shrink-0"
                  title="Envoyer"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={cancelRecording}
                  disabled={sending}
                  className="p-2 bg-rose-500 text-white rounded-full hover:bg-rose-600 disabled:opacity-30 flex-shrink-0"
                  title="Annuler"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              // IDLE state — normal text input + attach + mic + send
              // Layout: vertical stack — toolbar (format buttons + reply preview) on top,
              // then horizontal row: attach + textarea + mic + send
              <>
                {/* ⭐ Reply preview (if replying to a message) */}
                {replyToMessage && (
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <div className="flex items-center gap-2 flex-1 px-3 py-1.5 bg-slate-100 rounded-lg border-l-2 border-[#1677FF]">
                      <Reply className="w-3.5 h-3.5 text-[#1677FF] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-slate-700">
                          {replyToMessage.senderName}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {stripHtml(replyToMessage.content)}
                        </div>
                      </div>
                      <button
                        onClick={() => setReplyToMessage(null)}
                        className="p-1 hover:bg-slate-200 rounded"
                        title="Annuler la réponse"
                      >
                        <X className="w-3 h-3 text-slate-500" />
                      </button>
                    </div>
                  </div>
                )}
                {/* ⭐ V5 (parité Yeshua) — FILE D'ATTENTE DES PIÈCES JOINTES AVANT
                    ENVOI : vignettes 96×96 (aperçu image ou icône + nom + taille),
                    suppression individuelle, « Tout annuler », spinner d'envoi. */}
                {pendingFiles.length > 0 && (
                  <div className="mb-2 rounded-xl border border-[#BAE0FF] bg-[#E6F4FF]/60 p-2">
                    <div className="flex items-center justify-between mb-1.5 px-1">
                      <span className="text-[10px] font-bold text-[#0958D9] uppercase tracking-wider">
                        {pendingFiles.length} pièce{pendingFiles.length > 1 ? 's' : ''} jointe{pendingFiles.length > 1 ? 's' : ''} prête{pendingFiles.length > 1 ? 's' : ''}
                      </span>
                      <button onClick={clearPendingFiles} className="text-[10px] font-semibold text-red-500 hover:underline">
                        Tout annuler
                      </button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {pendingFiles.map((p, idx) => (
                        <div key={idx} className="relative flex-shrink-0 w-24">
                          <div className="w-24 h-24 rounded-lg border border-slate-200 bg-white overflow-hidden flex items-center justify-center">
                            {p.previewUrl ? (
                              <img src={p.previewUrl} alt={p.file.name} className="w-full h-full object-cover" />
                            ) : p.file.type.startsWith('video/') ? (
                              <div className="flex flex-col items-center gap-1 text-slate-400">
                                <FileVideo className="w-6 h-6" />
                                <span className="text-[9px] text-slate-500 max-w-full px-1 truncate">{p.file.name}</span>
                              </div>
                            ) : p.type === 'AUDIO' ? (
                              <div className="flex flex-col items-center gap-1 text-slate-400">
                                <FileAudio className="w-6 h-6" />
                                <span className="text-[9px] text-slate-500 max-w-full px-1 truncate">{p.file.name}</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1 p-2 text-center">
                                <FileText className="w-6 h-6 text-slate-400" />
                                <span className="text-[9px] text-slate-600 max-w-full truncate">{p.file.name}</span>
                                <span className="text-[9px] text-slate-400">{(p.file.size / 1048576).toFixed(1)} Mo</span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => removePendingFile(idx)}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow hover:bg-red-600"
                            title="Retirer ce fichier"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {sendingFiles && (
                      <div className="flex items-center gap-1.5 px-1 pt-1 text-[10px] text-[#0958D9] font-medium">
                        <Loader2 className="w-3 h-3 animate-spin" /> Envoi en cours…
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-end gap-1.5 sm:gap-2">
                  {/* ⭐ DISCORD PARITY: Emoji picker — opens a popover with categorized
                      common emojis. Clicking an emoji inserts it into the message.
                      ⭐ V6 MOBILE FIX : le composer était écrasé en « carré restreint »
                      sur mobile (7 boutons × 40px ≈ 280px + rail 56px > écran).
                      GIF/sticker/programme sont masqués < sm ; seuls attach +
                      emoji + micro/envoyer restent (parité WhatsApp mobile). */}
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setShowEmojiPicker(prev => !prev)}
                      className="p-2 text-slate-500 hover:bg-slate-100 rounded-full"
                      title="Emoji"
                      disabled={readOnly}
                    >
                      <Smile className="w-5 h-5" />
                    </button>
                    {showEmojiPicker && (
                      <>
                        {/* Click-away overlay */}
                        <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                        {/* Emoji popover */}
                        <div className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-3 max-h-72 overflow-y-auto no-scrollbar">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Emoji</div>
                          {[
                            { label: '😊 Sourire', emojis: ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😴','🤤','😪'] },
                            { label: '👍 Gestes', emojis: ['👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👋','🤚','🖐','✋','🖖','👏','🙌','🤝','🙏','✍️','💪','🦾','🦵','🦿','🤲','🤳','💅','👀','👁','👄','💋','🦷','👅','👂','🦻','👃','🧠','🦴','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟'] },
                            { label: '🎉 Objets', emojis: ['🎉','🎊','🎈','🎂','🎁','🎀','🏆','🥇','🥈','🥉','⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🥅','🏒','🏑','🥍','🎯','🎮','🎲','🧩','♟','♠️','♥️','♦️','♣️','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🥙','🧆','🥚','🍳','🥘','🍲','🥣','🥗','🍿','🧈','🧂','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟'] },
                          ].map((category, catIdx) => (
                            <div key={catIdx} className="mb-2">
                              <div className="text-[9px] font-bold text-slate-400 mb-1">{category.label}</div>
                              <div className="grid grid-cols-8 gap-0.5">
                                {category.emojis.map((emoji, i) => (
                                  <button
                                    key={`${catIdx}-${i}`}
                                    onClick={() => {
                                      setText(prev => prev + emoji);
                                      setShowEmojiPicker(false);
                                    }}
                                    className="w-8 h-8 flex items-center justify-center text-lg hover:bg-slate-100 rounded transition-colors"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  {/* ⭐ DISCORD PARITY: GIF picker — Tenor API search. Opens a popover
                      with a search bar + grid of GIF results. Clicking a GIF sends it
                      as an IMAGE message.
                      ⭐ V6 MOBILE FIX : masqué sur mobile (libère la largeur du composer). */}
                  <div className="relative flex-shrink-0 hidden sm:block">
                    <button
                      onClick={() => setShowGifPicker(prev => !prev)}
                      className="p-2 text-slate-500 hover:bg-slate-100 rounded-full"
                      title="Rechercher un GIF"
                      disabled={readOnly}
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>
                    {showGifPicker && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowGifPicker(false)} />
                        <div className="absolute bottom-full left-0 mb-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-3 max-h-80 overflow-y-auto no-scrollbar">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Recherche GIF (Tenor)</div>
                          <input
                            type="text"
                            value={gifSearchQuery}
                            onChange={e => { setGifSearchQuery(e.target.value); }}
                            onKeyDown={e => { if (e.key === 'Enter') searchGifs(gifSearchQuery); }}
                            placeholder="Rechercher un GIF..."
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/30 mb-2"
                            autoFocus
                          />
                          {gifLoading && (
                            <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                          )}
                          {!gifLoading && gifResults.length === 0 && gifSearchQuery && (
                            <div className="text-center py-6 text-xs text-slate-500">
                              Aucun GIF trouvé. {process.env.NEXT_PUBLIC_TENOR_DISABLED ? '' : 'Tapez une recherche et appuyez sur Entrée.'}
                            </div>
                          )}
                          {!gifLoading && gifResults.length === 0 && !gifSearchQuery && (
                            <div className="text-center py-6 text-xs text-slate-500">Tapez un mot-clé pour rechercher un GIF.</div>
                          )}
                          <div className="grid grid-cols-2 gap-1">
                            {gifResults.map((gif, i) => (
                              <button
                                key={i}
                                onClick={() => sendGif(gif)}
                                className="relative rounded-lg overflow-hidden hover:opacity-80 transition-opacity aspect-square bg-slate-100"
                                title={gif.description || 'GIF'}
                              >
                                <img src={gif.preview || gif.url} alt={gif.description || 'GIF'} className="w-full h-full object-cover" loading="lazy" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {/* ⭐ DISCORD PARITY: Sticker picker — shows sticker packs + stickers.
                      ⭐ V6 MOBILE FIX : masqué sur mobile (libère la largeur du composer). */}
                  <div className="relative flex-shrink-0 hidden sm:block">
                    <button
                      onClick={() => {
                        if (!showStickerPicker) loadStickerPacks();
                        setShowStickerPicker(prev => !prev);
                      }}
                      className="p-2 text-slate-500 hover:bg-slate-100 rounded-full"
                      title="Stickers"
                      disabled={readOnly}
                    >
                      <span className="text-lg leading-none">🎨</span>
                    </button>
                    {showStickerPicker && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowStickerPicker(false)} />
                        <div className="absolute bottom-full left-0 mb-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-3 max-h-80 overflow-y-auto no-scrollbar">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Stickers</div>
                          {stickerPacks.length === 0 && (
                            <div className="text-center py-6 text-xs text-slate-500">
                              Aucun pack de stickers. Les packs sont créés par l'administration.
                            </div>
                          )}
                          {/* Pack selector */}
                          {stickerPacks.length > 0 && (
                            <div className="flex gap-1 mb-2 overflow-x-auto no-scrollbar">
                              {stickerPacks.map(pack => (
                                <button
                                  key={pack.id}
                                  onClick={() => {
                                    setActiveStickerPack(pack.id);
                                    loadStickers(pack.id);
                                  }}
                                  className={cn(
                                    'px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition',
                                    activeStickerPack === pack.id ? 'bg-[#1677FF] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  )}
                                >
                                  {pack.name} ({pack.stickerCount || 0})
                                </button>
                              ))}
                            </div>
                          )}
                          {/* Stickers grid */}
                          {activeStickerPack && (
                            <div className="grid grid-cols-4 gap-1">
                              {stickers.length === 0 && (
                                <div className="col-span-4 text-center py-4 text-xs text-slate-500">Sélectionnez un pack ci-dessus.</div>
                              )}
                              {stickers.map(sticker => (
                                <button
                                  key={sticker.id}
                                  onClick={() => sendSticker(sticker.id)}
                                  className="rounded-lg overflow-hidden hover:bg-slate-100 p-1 transition"
                                  title={sticker.name || 'Sticker'}
                                >
                                  <img src={sticker.url} alt={sticker.name || 'Sticker'} className="w-full h-full object-contain" loading="lazy" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  {/* ⭐ Attach button — opens categorized menu (V2.6) */}
                  <button
                    onClick={() => setShowAttachmentMenu(true)}
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-full flex-shrink-0"
                    title="Joindre un fichier"
                    disabled={readOnly}
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <div className="flex-1 min-w-0 bg-slate-100 rounded-2xl overflow-hidden relative">
                    {/* ⭐ 2026-10-14 — SlashCommands popover (porté de Yeshua Connect) :
                        affiché au-dessus du RichTextEditor quand l'utilisateur tape "/". */}
                    {showSlashPopover && (
                      <SlashCommandsPopover
                        input={text}
                        onCommand={handleSlashCommandSelect}
                        onDismiss={() => setShowSlashPopover(false)}
                      />
                    )}
                    {/* ⭐ MENTIONS: Autocomplete popover — appears when the user types @
                        followed by letters. Shows matching conversation participants.
                        Clicking a participant inserts @FirstName into the message. */}
                    {mentionQuery !== null && activeConv && (() => {
                      const matches = mentionMatches;
                      if (matches.length === 0) return null;
                      return (
                        <div className="absolute bottom-full left-0 right-0 mb-1 sm:right-auto sm:w-64 max-w-[calc(100vw-1rem)] bg-white rounded-lg shadow-xl border border-slate-200 z-30 max-h-60 overflow-y-auto">
                          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                            Mentionner un participant
                          </div>
                          {matches.map((p, idx) => (
                            <button
                              key={p.userId}
                              onMouseEnter={() => setMentionSelectedIdx(idx)}
                              onClick={() => selectMention(p)}
                              className={cn(
                                'w-full flex items-center gap-2 px-3 py-2 text-left transition',
                                idx === mentionSelectedIdx ? 'bg-blue-50' : 'hover:bg-blue-50'
                              )}
                            >
                              <div className={cn(
                                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                                getAvatarColor(`${p.firstName || ''} ${p.lastName || ''}`)
                              )}>
                                {getInitials(`${p.firstName || ''} ${p.lastName || ''}`)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-slate-900 truncate">
                                  {p.firstName} {p.lastName}
                                </div>
                                {p.roleLabel && (
                                  <div className="text-[10px] text-slate-500 truncate">{p.roleLabel}</div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                    <RichTextEditor
                      value={text}
                      onKeyDown={(e) => {
                        // ⭐ V5 (parité Yeshua) — ENTER = ENVOYER (Shift+Enter =
                        //    nouvelle ligne). Avant : impossible d'envoyer au
                        //    clavier depuis le composer contentEditable.
                        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                          // Popover mentions ouvert → Entrée sélectionne la mention surlignée
                          if (mentionQuery !== null && mentionMatches.length > 0) {
                            e.preventDefault();
                            selectMention(mentionMatches[mentionSelectedIdx] || mentionMatches[0]);
                            return;
                          }
                          if (mentionQuery !== null) setMentionQuery(null);
                          e.preventDefault();
                          // ⭐ V5 — pièces jointes en attente → légende + fichiers
                          if (pendingFiles.length > 0) { sendPendingFiles(); return; }
                          handleSendText();
                          return;
                        }
                        // ⭐ V5 — navigation clavier du popover mentions
                        if (mentionQuery !== null && mentionMatches.length > 0) {
                          if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
                            e.preventDefault();
                            setMentionSelectedIdx(i => (i + 1) % mentionMatches.length);
                          } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
                            e.preventDefault();
                            setMentionSelectedIdx(i => (i - 1 + mentionMatches.length) % mentionMatches.length);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setMentionQuery(null);
                          }
                        }
                      }}
                      onChange={(html) => {
                        setText(html);
                        handleTyping();
                        // ⭐ MENTIONS: detect @ followed by letters to show autocomplete
                        const textContent = html.replace(/<[^>]*>/g, '');
                        // ⭐ 2026-10-14 — Slash commands: detect "/" at start to show popover
                        //    (porté de Yeshua Connect). Le popover filtre par préfixe
                        //    cmdName automatiquement (voir SlashCommandsPopover).
                        const trimmed = textContent.trimStart();
                        setShowSlashPopover(trimmed.startsWith('/'));
                        const lastAtIndex = textContent.lastIndexOf('@');
                        if (lastAtIndex !== -1) {
                          const afterAt = textContent.substring(lastAtIndex + 1);
                          // If there's a space, the mention is "complete" (user finished typing)
                          if (afterAt.includes(' ') || afterAt.length === 0) {
                            // @ at the very end or followed by space — show all participants
                            if (afterAt.length === 0) {
                              setMentionQuery('');
                              setMentionStartPos(lastAtIndex);
                            } else {
                              setMentionQuery(null);
                            }
                          } else if (/^[A-Za-zÀ-ÿ0-9_\-']+$/.test(afterAt)) {
                            // Letters after @ — filter participants
                            setMentionQuery(afterAt);
                            setMentionStartPos(lastAtIndex);
                          } else {
                            setMentionQuery(null);
                          }
                        } else {
                          setMentionQuery(null);
                        }
                        // Auto-stop typing after 5s of no input
                        if (stopTypingRef.current) clearTimeout(stopTypingRef.current);
                        stopTypingRef.current = setTimeout(() => handleStopTyping(), 5000);
                      }}
                      minHeight="36px"
                      showToolbar={false}
                      editorClassName="text-[15px] sm:text-sm leading-snug py-2"
                      placeholder="Tapez un message... @mention, /commande, ||spoiler||, ou `code`"
                    />
                  </div>
                  {/* Mic button (idle state — only when text is empty and no pending files) */}
                  {!text.replace(/<[^>]*>/g, '').trim() && pendingFiles.length === 0 && (
                    <button
                      onClick={startRecording}
                      disabled={readOnly || sending}
                      className="p-2 text-slate-500 hover:bg-slate-100 rounded-full disabled:opacity-30 flex-shrink-0"
                      title="Enregistrer un message vocal"
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                  )}
                  {/* Send button — always visible.
                      ⭐ V5 : avec des pièces jointes en attente, Envoyer envoie
                      la légende PUIS les fichiers (file d'attente visuelle). */}
                  <button
                    onClick={() => pendingFiles.length > 0 ? sendPendingFiles() : handleSendText()}
                    disabled={sending || sendingFiles || (!text.replace(/<[^>]*>/g, '').trim() && pendingFiles.length === 0)}
                    className="p-2 bg-[#1677FF] text-white rounded-full hover:bg-[#0958D9] disabled:opacity-30 flex-shrink-0"
                    title={pendingFiles.length > 0 ? 'Envoyer la légende et les fichiers' : 'Envoyer le message'}
                  >
                    {sending || sendingFiles ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                  {/* ⭐ V2: Schedule message button
                      ⭐ V6 MOBILE FIX : masqué sur mobile (accessible via le menu
                      d'action du message ou en desktop). */}
                  <button
                    onClick={() => { setScheduleText(text.replace(/<[^>]*>/g, '')); setShowScheduleModal(true); }}
                    className="hidden sm:flex p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full flex-shrink-0"
                    title="Programmer l'envoi"
                  >
                    <Clock className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ⭐ DISCORD PARITY: Member list sidebar (right panel for GROUP conversations).
            Shows all conversation members grouped by online/offline status,
            with their custom status, activity, and role-colored names.
            Hidden by default; toggled via the Users button in the chat header. */}
        {showMemberList && activeConv?.type === 'GROUP' && (
          <div className="hidden md:flex flex-col w-64 bg-white border-l border-slate-200 flex-shrink-0">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Membres — {conversationMembers.length}
                {conversationMembers.filter(m => m.isOnline).length > 0 && (
                  <span className="text-[10px] font-semibold text-green-600 ml-1">
                    · {conversationMembers.filter(m => m.isOnline).length} en ligne
                  </span>
                )}
              </h3>
              <button
                onClick={() => setShowMemberList(false)}
                className="p-1 hover:bg-slate-100 rounded"
                title="Fermer"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            {/* ⭐ V5 (parité Yeshua) — onglets Membres / Inviter / Gestion */}
            <div className="flex border-b border-slate-100">
              <button
                onClick={() => setMemberPanelTab('members')}
                className={cn('flex-1 px-3 py-2 text-[11px] font-bold transition',
                  memberPanelTab === 'members' ? 'text-[#0958D9] border-b-2 border-[#0958D9]' : 'text-slate-500 hover:text-slate-700')}
              >
                Membres
              </button>
              {/* ⭐ V6 — onglet GESTION (admins de conversation uniquement) :
                  mode lent + journal d'audit (spec §3/§17). */}
              {(() => {
                const me = conversationMembers.find((m: any) => m.userId === currentUserId);
                const iAmConvAdmin = me?.role === 'ADMIN' ||
                  /SCHOOL_ADMIN|SCHOOL_OWNER|DIRECTOR|DIRECTEUR|SUPER_ADMIN|PLATFORM_OWNER|PROMOTER|ADMIN/i.test(String(user?.roleLabel || ''));
                if (!iAmConvAdmin || readOnly) return null;
                return (
                  <button
                    onClick={() => setMemberPanelTab('gestion')}
                    className={cn('flex-1 px-3 py-2 text-[11px] font-bold transition',
                      memberPanelTab === 'gestion' ? 'text-[#0958D9] border-b-2 border-[#0958D9]' : 'text-slate-500 hover:text-slate-700')}
                  >
                    Gestion
                  </button>
                );
              })()}
              {!readOnly && (
                <button
                  onClick={() => setMemberPanelTab('invite')}
                  className={cn('flex-1 px-3 py-2 text-[11px] font-bold transition',
                    memberPanelTab === 'invite' ? 'text-[#0958D9] border-b-2 border-[#0958D9]' : 'text-slate-500 hover:text-slate-700')}
                >
                  Inviter
                </button>
              )}
            </div>
            {memberPanelTab === 'invite' ? (
              /* ⭐ V5 — ONGLET INVITER : membres du tenant absents du groupe */
              <div className="flex-1 overflow-y-auto">
                <div className="p-2">
                  <input
                    value={inviteQuery}
                    onChange={(e) => setInviteQuery(e.target.value)}
                    placeholder="Rechercher à inviter…"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#3B9EFF]/30"
                  />
                </div>
                {inviteLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  </div>
                ) : invitableUsers.length === 0 ? (
                  <div className="px-3 py-6 text-center text-[11px] text-slate-400">
                    Aucun membre invitable{inviteQuery ? ' pour cette recherche' : ' — tout le monde est déjà dans le groupe'}.
                  </div>
                ) : (
                  invitableUsers.map((u: any) => {
                    const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Membre';
                    const invited = invitedIds.has(u.userId || u.id);
                    return (
                      <div key={u.userId || u.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50">
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0', u.avatarUrl ? 'bg-slate-200' : getAvatarColor(name))}>
                          {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" /> : getInitials(name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate text-slate-800">{name}</div>
                          {u.roleLabel && <div className="text-[10px] text-slate-500 truncate">{u.roleLabel}</div>}
                        </div>
                        <button
                          onClick={() => inviteMember(u.userId || u.id)}
                          disabled={invited}
                          className={cn('px-2 py-1 rounded-lg text-[10px] font-bold flex-shrink-0 transition',
                            invited ? 'bg-emerald-50 text-emerald-600' : 'bg-[#1677FF] text-white hover:bg-[#0958D9]')}
                        >
                          {invited ? 'Invité ✓' : 'Inviter'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            ) : memberPanelTab === 'gestion' ? (
              /* ⭐ V6 (spec §3/§17) — ONGLET GESTION (admins) : mode lent +
                  journal d'audit de la conversation. Backend complet, l'UI
                  n'existait pas (showAuditLog/showSlowModeModal étaient morts). */
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {/* Mode lent */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-[#0958D9]" /> Mode lent
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Intervalle minimum entre deux messages de chaque membre (anti-spam de groupe).
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[0, 5, 10, 15, 30, 60, 300].map(sec => (
                      <button
                        key={sec}
                        onClick={() => { setSlowModeSeconds(sec); applySlowModeAction(sec); }}
                        className={cn('px-2.5 py-1 rounded-lg text-[10px] font-bold border transition',
                          slowModeSeconds === sec
                            ? 'bg-[#E6F4FF] border-[#1677FF] text-[#0958D9]'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')}
                      >
                        {sec === 0 ? 'Désactivé' : sec < 60 ? `${sec}s` : `${sec / 60} min`}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Journal d'audit */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <ScrollText className="w-3.5 h-3.5 text-amber-600" /> Journal d'audit
                    </h4>
                    <button
                      onClick={() => { setShowAuditLog(true); loadAuditLogsAction(); }}
                      className="text-[10px] px-2 py-1 bg-[#E6F4FF] text-[#0958D9] rounded font-semibold hover:bg-[#D0E8FF]"
                    >
                      Voir tout
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Actions d'administration tracées : rôles, exclusions, bannissements, sourdine, approbations.
                  </p>
                </div>
              </div>
            ) : (
              /* ⭐ V5 — ONGLET MEMBRES : recherche + admins d'abord (Yeshua),
                  clic = FICHE DU MEMBRE (avant : ça ouvrait SON PROPRE profil). */
              <div className="flex-1 overflow-y-auto">
                <div className="p-2">
                  <input
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Rechercher un membre…"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#3B9EFF]/30"
                  />
                </div>
                {loadingMembers ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                  </div>
                ) : (() => {
                  const q = memberSearchQuery.trim().toLowerCase();
                  const filtered = conversationMembers.filter(m => {
                    if (m.userId === currentUserId) return true; // toujours visible
                    const name = `${m.firstName || ''} ${m.lastName || ''}`.trim().toLowerCase();
                    return !q || name.includes(q);
                  });
                  // Admins/modérateurs d'abord, en ligne avant hors ligne, puis alpha
                  const rank = (m: any) => (m.role === 'ADMIN' ? 0 : m.role === 'MODERATOR' ? 1 : 2) * 10 + (m.isOnline ? 0 : 1);
                  const sorted = [...filtered].sort((a, b) => rank(a) - rank(b) ||
                    `${a.firstName || ''}${a.lastName || ''}`.localeCompare(`${b.firstName || ''}${b.lastName || ''}`));
                  const admins = sorted.filter(m => m.role === 'ADMIN' || m.role === 'MODERATOR');
                  const others = sorted.filter(m => m.role !== 'ADMIN' && m.role !== 'MODERATOR');
                  const renderMemberRow = (m: any) => {
                    // ⭐ V6 (spec §3/§17) — actions d'admin visibles pour les
                    //    admins/modérateurs de conversation et le staff.
                    const meMember: any = conversationMembers.find((x: any) => x.userId === currentUserId);
                    const iAmConvAdmin = meMember?.role === 'ADMIN' ||
                      /SCHOOL_ADMIN|SCHOOL_OWNER|DIRECTOR|DIRECTEUR|SUPER_ADMIN|PLATFORM_OWNER|PROMOTER|ADMIN/i.test(String(user?.roleLabel || ''));
                    const canManageMember = iAmConvAdmin && m.userId !== currentUserId && !readOnly;
                    return (
                    <div
                      key={m.userId}
                      className={cn('flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer', !m.isOnline && 'opacity-60')}
                      onClick={() => setMemberProfile(m)}
                      title="Voir le profil"
                    >
                      <div className="relative flex-shrink-0">
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold', m.avatarUrl ? 'bg-slate-200' : getAvatarColor(`${m.firstName || ''} ${m.lastName || ''}`), !m.isOnline && 'grayscale')}>
                          {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" /> : getInitials(`${m.firstName || ''} ${m.lastName || ''}`)}
                        </div>
                        <span className={cn('absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white', m.isOnline ? 'bg-green-400' : 'bg-slate-300')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate flex items-center gap-1" style={{ color: m.userId === currentUserId ? '#64748b' : getRoleColor(m.userRole) }}>
                          <span className="truncate">{m.userId === currentUserId ? 'Vous' : `${m.firstName} ${m.lastName}`}</span>
                          {m.role === 'ADMIN' && <span className="text-[9px] text-amber-600 flex-shrink-0">★</span>}
                          {m.role === 'MODERATOR' && <span className="text-[9px] text-slate-500 flex-shrink-0" title="Modérateur">M</span>}
                          {(m as any).isMuted && <span className="text-[9px] text-red-500 flex-shrink-0" title="En sourdine">🔇</span>}
                          {(m as any).isBanned && <span className="text-[9px] text-red-600 flex-shrink-0" title="Banni">⛔</span>}
                          {(m as any).pendingApproval && <span className="text-[8px] px-1 rounded bg-amber-100 text-amber-700 font-bold uppercase flex-shrink-0">à approuver</span>}
                          {blockedUserIds.has(m.userId) && <Ban className="w-2.5 h-2.5 text-red-500 flex-shrink-0" />}
                        </div>
                        {m.customStatus && <div className="text-[10px] text-slate-500 truncate">{m.customStatus}</div>}
                        {!m.customStatus && m.activityStatus && <div className="text-[10px] text-slate-400 truncate">{m.activityStatus}</div>}
                      </div>
                      {/* ⭐ V6 — menu d'actions d'administration (rôle/kick/ban/muet) */}
                      {canManageMember && (
                        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setMemberActionUserId(memberActionUserId === m.userId ? null : m.userId)}
                            className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                            title="Actions d'administration"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                          {memberActionUserId === m.userId && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setMemberActionUserId(null)} />
                              <div className="absolute right-0 top-7 z-50 bg-white rounded-xl shadow-2xl border border-slate-100 py-1.5 w-52 text-slate-700">
                                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  {`${m.firstName || ''} ${m.lastName || ''}`.trim() || 'Membre'}
                                </p>
                                {(m as any).pendingApproval && (
                                  <>
                                    <button onClick={() => { approveMemberAction(m.userId, true); setMemberActionUserId(null); }} className="w-full text-left px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 flex items-center gap-1.5">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Approuver l'entrée
                                    </button>
                                    <button onClick={() => { approveMemberAction(m.userId, false); setMemberActionUserId(null); }} className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-1.5">
                                      <XCircle className="w-3.5 h-3.5" /> Refuser
                                    </button>
                                    <div className="h-px bg-slate-100 my-1" />
                                  </>
                                )}
                                {m.role !== 'ADMIN' && (
                                  <button onClick={() => { setMemberRoleAction(m.userId, 'ADMIN'); setMemberActionUserId(null); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5 text-amber-500" /> Promouvoir administrateur
                                  </button>
                                )}
                                {m.role !== 'MODERATOR' && (
                                  <button onClick={() => { setMemberRoleAction(m.userId, 'MODERATOR'); setMemberActionUserId(null); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5 text-slate-500" /> Promouvoir modérateur
                                  </button>
                                )}
                                {m.role !== 'MEMBER' && (
                                  <button onClick={() => { setMemberRoleAction(m.userId, 'MEMBER'); setMemberActionUserId(null); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center gap-1.5">
                                    <UserIcon className="w-3.5 h-3.5" /> Rétrograder en membre
                                  </button>
                                )}
                                <div className="h-px bg-slate-100 my-1" />
                                <button
                                  onClick={() => { chatMuteMemberAction(m.userId, !(m as any).isMuted); setMemberActionUserId(null); }}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center gap-1.5"
                                >
                                  <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                                  {(m as any).isMuted ? 'Autoriser à parler' : 'Mettre en sourdine'}
                                </button>
                                <button
                                  onClick={() => { banMemberAction(m.userId, !(m as any).isBanned); setMemberActionUserId(null); }}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center gap-1.5"
                                >
                                  <Ban className="w-3.5 h-3.5 text-orange-500" />
                                  {(m as any).isBanned ? 'Débannir' : 'Bannir du groupe'}
                                </button>
                                <button
                                  onClick={() => { kickMemberAction(m.userId); setMemberActionUserId(null); }}
                                  className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-1.5"
                                >
                                  <UserMinus className="w-3.5 h-3.5" /> Exclure du groupe
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    );
                  };
                  return (
                    <>
                      {admins.length > 0 && (
                        <div className="px-3 pt-2 pb-1">
                          <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                            Administration — {admins.length}
                          </div>
                        </div>
                      )}
                      {admins.map(renderMemberRow)}
                      {others.length > 0 && (
                        <div className="px-3 pt-3 pb-1">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <span className={cn('w-2 h-2 rounded-full', conversationMembers.some(m => m.isOnline) ? 'bg-green-400' : 'bg-slate-300')} />
                            Membres — {others.length}
                          </div>
                        </div>
                      )}
                      {others.map(renderMemberRow)}
                      {sorted.length === 0 && (
                        <div className="px-3 py-6 text-center text-[11px] text-slate-400">Aucun membre trouvé.</div>
                      )}
                      {/* ⭐ V5 — QUITTER LE GROUPE (endpoint conversations/:id/leave
                          + message système « X a quitté le groupe » côté serveur). */}
                      <div className="mt-2 px-3 pb-3 border-t border-slate-100 pt-3">
                        <button
                          onClick={async () => {
                            if (!activeConvId || leavingGroup) return;
                            const ok = window.confirm(`Quitter « ${activeConv?.name || 'ce groupe'} » ? Vous ne recevrez plus ses messages.`);
                            if (!ok) return;
                            setLeavingGroup(true);
                            try {
                              const res = await fetch(`/api/chat/conversations/${activeConvId}/leave`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: currentUserId }),
                                credentials: 'include',
                              });
                              if (!res.ok) {
                                const err = await res.json().catch(() => ({}));
                                throw new Error(err?.backendError?.message || err?.message || `Erreur ${res.status}`);
                              }
                              toast.success('Vous avez quitté le groupe');
                              setActiveConvId(null);
                              await loadConversations();
                              await loadMessages();
                            } catch (e: any) {
                              toast.error('Échec : ' + e.message);
                            } finally {
                              setLeavingGroup(false);
                            }
                          }}
                          disabled={leavingGroup}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 disabled:opacity-50"
                        >
                          {leavingGroup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                          Quitter le groupe
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
        {/* ⭐ V5 (parité Yeshua — THREADS) — panneau latéral du fil de
            discussion : message parent en citation + liste des réponses +
            champ de saisie dédié (envoi avec replyToId = parent). */}
        {threadParent && (
          <div className="fixed inset-y-0 right-0 w-80 z-40 md:static md:inset-auto md:w-72 flex flex-col bg-white border-l border-slate-200 flex-shrink-0 shadow-2xl md:shadow-none">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-[#0958D9]" />
                Fil · {threadReplies.length} réponse{threadReplies.length > 1 ? 's' : ''}
              </h3>
              <button
                onClick={() => { setThreadParentId(null); setThreadDraft(''); }}
                className="p-1 hover:bg-slate-100 rounded"
                title="Fermer le fil"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            {/* Message parent en citation */}
            <div className="mx-3 mt-2 px-3 py-2 bg-slate-100 rounded-lg border-l-2 border-[#1677FF]">
              <div className="text-[10px] font-bold text-slate-700">
                {`${(threadParent as any).senderFirstName || (threadParent as any).sender?.firstName || ''} ${(threadParent as any).senderLastName || (threadParent as any).sender?.lastName || ''}`.trim() || 'Message'}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {stripHtml((threadParent as any).content) || 'Message d\u2019origine'}
              </div>
            </div>
            {/* Réponses */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
              {threadReplies.length === 0 ? (
                <div className="py-6 text-center text-[11px] text-slate-400">
                  Aucune réponse pour le moment — démarrez le fil !
                </div>
              ) : threadReplies.map((m: any) => {
                const mine = m.senderId === currentUserId;
                const name = `${m.senderFirstName || m.sender?.firstName || ''} ${m.senderLastName || m.sender?.lastName || ''}`.trim() || 'Membre';
                return (
                  <div key={m.id} className={cn('flex gap-1.5', mine ? 'justify-end' : 'justify-start')}>
                    {!mine && (
                      <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 self-end', getAvatarColor(name))}>
                        {getInitials(name)}
                      </div>
                    )}
                    <div className={cn('max-w-[80%] rounded-2xl px-2.5 py-1.5 text-xs shadow-sm',
                      mine ? 'bg-[#3B9EFF] text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm')}>
                      {!mine && <div className="text-[9px] font-bold text-slate-600 mb-0.5">{name}</div>}
                      <div dangerouslySetInnerHTML={{ __html: renderRichContent(m.content || '') }} />
                      <div className={cn('text-[9px] mt-0.5 flex items-center gap-1 justify-end', mine ? 'text-white/70' : 'text-slate-400')}>
                        {formatTime(m.createdAt)}
                        {mine && (m as any).status === 'pending' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Saisie dédiée du fil */}
            {!isReadOnly && (
              <div className="p-2 border-t border-slate-100 flex items-center gap-1.5">
                <input
                  value={threadDraft}
                  onChange={(e) => setThreadDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendThreadReply();
                    }
                  }}
                  placeholder="Répondre dans le fil…"
                  className="flex-1 px-3 py-1.5 bg-slate-100 rounded-full text-xs outline-none focus:ring-2 focus:ring-[#3B9EFF]/30"
                />
                <button
                  onClick={sendThreadReply}
                  disabled={!threadDraft.trim() || sending}
                  className="p-2 bg-[#1677FF] text-white rounded-full hover:bg-[#0958D9] disabled:opacity-30 flex-shrink-0"
                  title="Envoyer dans le fil"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>
        )}
        </>
      ) : activeChannel ? (
        // ═══ V6 — VUE CANAL (parité Yeshua / spec §6) : messages de diffusion
        //     + composer + abonnement. Les canaux s'ouvrent comme des
        //     conversations depuis la section Canaux OU la liste Discussions.
        <div className="flex-1 flex flex-col bg-slate-50 relative">
          {/* Header canal */}
          <div className="p-3 bg-[#0958D9] text-white flex items-center gap-3 shadow-sm">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1 rounded hover:bg-[#0958D9]"
              title="Afficher les conversations"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white flex-shrink-0">
              <Megaphone className="w-4.5 h-4.5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold truncate">{activeChannel.name}</h3>
              <p className="text-[10px] text-[#BAE0FF] flex items-center gap-1 truncate">
                <Rss className="w-2.5 h-2.5 flex-shrink-0" />
                Canal · {activeChannel.subscriberCount || 0} abonné(s)
                {activeChannel.description ? ` · ${activeChannel.description}` : ''}
              </p>
            </div>
            {/* (Dés)abonnement */}
            <button
              onClick={() => toggleChannelSubscription(activeChannel)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 flex-shrink-0',
                activeChannel.isSubscribed
                  ? 'bg-white/15 hover:bg-white/25 text-white'
                  : 'bg-white text-[#0958D9] hover:bg-slate-100'
              )}
              title={activeChannel.isSubscribed ? 'Se désabonner' : "S'abonner"}
            >
              {activeChannel.isSubscribed ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{activeChannel.isSubscribed ? 'Abonné' : 'S’abonner'}</span>
            </button>
          </div>

          {/* Messages du canal — style diffusion Telegram */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
            {channelMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Megaphone className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-600">Aucune diffusion pour le moment</p>
                <p className="text-xs text-slate-400 mt-1">
                  Les publications de ce canal apparaîtront ici.
                </p>
              </div>
            ) : (
              channelMessages.map((m: any) => {
                // ⭐ V6.1 — messages SYSTEM (« X a rejoint le canal ») :
                // pastille centrée (comme le fil principal), pas une bulle.
                if (m.type === 'SYSTEM' || m.senderId === 'system') {
                  return (
                    <div key={m.id} className="flex justify-center">
                      <div className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200 text-[11px] font-medium max-w-[85%]">
                        <UserPlus className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{m.content || 'Événement du canal'}</span>
                        <span className="opacity-50">· {new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  );
                }
                const mine = m.senderId === currentUserId;
                const senderName = `${m.senderFirstName || m.sender?.firstName || ''} ${m.senderLastName || m.sender?.lastName || ''}`.trim() || 'Diffusion';
                const senderColorIdx = !mine ? hashUserId(m.senderId || 'x') : 0;
                return (
                  <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-sm',
                      mine
                        ? 'bg-[#1677FF] text-white rounded-br-md'
                        : 'bg-white text-slate-800 border border-slate-100 rounded-bl-md'
                    )}>
                      {!mine && (
                        <p className="text-[11px] font-bold mb-0.5 truncate" style={{ color: USER_TEXT_COLORS[senderColorIdx] }}>
                          {senderName}
                          {activeChannel.createdBy === m.senderId && (
                            <span className="ml-1 font-normal opacity-70">· admin</span>
                          )}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                      <p className={cn(
                        'text-[10px] mt-1 text-right',
                        mine ? 'text-[#BAE0FF]' : 'text-slate-400'
                      )}>
                        {new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={channelMessagesEndRef} />
          </div>

          {/* Composer de diffusion */}
          <div className="p-3 bg-white border-t border-slate-100 flex items-end gap-2">
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2">
              <input
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleBroadcast(); } }}
                placeholder="Diffuser un message dans le canal…"
                className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
                maxLength={2000}
              />
            </div>
            <button
              onClick={handleBroadcast}
              disabled={channelSending || !channelInput.trim()}
              className="p-2.5 bg-[#1677FF] text-white rounded-full hover:bg-[#0958D9] disabled:opacity-30 flex-shrink-0"
              title="Diffuser"
            >
              {channelSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      ) : (
        // Empty state when no conversation selected — uses Helm watermark background + Helm Connect icon
        // ⭐ Per user feedback: KEEP the watermark theme (asked for) but DO NOT replace
        //    the Helm Connect icon with the AH SVG logo (was not asked for).
        <div
          className="hidden md:flex flex-1 items-center justify-center relative"
          style={getHelmWatermarkStyle({ opacity: 0.08 })}
        >
          <div className="text-center relative z-10">
            {/* ⭐ PERF (GTMetrix) : webp 128px (5,9 Ko) au lieu du PNG 728 Ko */}
            <img
              src="/icons/modules/helm-connect-128.webp"
              alt="Helm Connect"
              width={64}
              height={64}
              className="w-16 h-16 mx-auto mb-4 object-contain opacity-80"
            />
            <h3 className="text-lg font-bold text-slate-700">Helm Connect</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              Communiquez. Collaborez. Restez connectés.
            </p>
            {!readOnly && (
              <button
                onClick={() => setShowNewChat(true)}
                className="mt-6 px-5 py-2.5 bg-[#1677FF] text-white text-sm font-bold rounded-lg hover:bg-[#0958D9]"
              >
                + Nouvelle conversation
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═════ MODALS ═════ */}
      {/* ⭐ V5 (parité Yeshua) — FICHE D'UN MEMBRE (clic dans le panneau) */}
      {memberProfile && (
        <MemberProfileModal
          member={memberProfile}
          currentUserId={currentUserId}
          onClose={() => setMemberProfile(null)}
          onDirectMessage={openDirectMessage}
          onCall={callMemberDirect}
          isBlocked={blockedUserIds.has(memberProfile.userId)}
          onToggleBlock={toggleBlockMember}
        />
      )}
      {showNewChat && (
        <NewChatModal
          currentUserId={currentUserId}
          onClose={() => setShowNewChat(false)}
          onConversationCreated={async (convId) => {
            setShowNewChat(false);
            // ⭐ FIX race condition: await loadConversations() BEFORE setActiveConvId
            //    so the conversation is in the conversations[] array when the chat
            //    header tries to find it via getConversationDisplay().
            //    Previously, setActiveConvId ran before loadConversations finished,
            //    causing activeConv to be null briefly → header showed wrong/no name.
            await loadConversations();
            setActiveConvId(convId);
          }}
        />
      )}
      {showNewGroup && (
        <NewGroupModal
          currentUserId={currentUserId}
          onClose={() => setShowNewGroup(false)}
          onGroupCreated={(convId) => {
            setShowNewGroup(false);
            loadConversations();
            setActiveConvId(convId);
          }}
        />
      )}
      {showInvitations && (
        <InvitationsModal
          currentUserId={currentUserId}
          onClose={() => setShowInvitations(false)}
          onInvitationResponded={() => {
            loadConversations();
          }}
        />
      )}
      {/* ⭐ Profile / Avatar modal */}
      {showProfile && (
        <ProfileModal
          currentUserId={currentUserId}
          myAvatarUrl={myAvatarUrl}
          userName={user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : ''}
          onClose={() => setShowProfile(false)}
          onAvatarUpload={handleAvatarUpload}
          avatarInputRef={avatarInputRef}
        />
      )}
      {/* ⭐ New Channel modal (Telegram-style) */}
      {showNewChannel && (
        <NewChannelModal
          currentUserId={currentUserId}
          onClose={() => setShowNewChannel(false)}
          onChannelCreated={() => {
            setShowNewChannel(false);
            loadChannels();
          }}
        />
      )}
      {/* ⭐ Helm Connect — Announcements modal (V1) */}
      {showAnnouncements && (
        <AnnouncementsModal
          currentUserId={currentUserId}
          onClose={() => setShowAnnouncements(false)}
        />
      )}
      {/* ⭐ Helm Connect V2.3 — Notification Preferences modal */}
      {showNotifPrefs && (
        <NotificationPreferencesModal
          currentUserId={currentUserId}
          conversations={conversations}
          onUnmuted={loadMutedConversations}
          onClose={() => setShowNotifPrefs(false)}
        />
      )}
      {/* ⭐ V6 (spec §3/§17) — JOURNAL D'AUDIT de la conversation (modération) :
          l'état showAuditLog existait mais n'était JAMAIS rendu (code mort).
          GET /chat/conversations/:id/audit-logs — actions tracées serveur. */}
      {showAuditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAuditLog(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <ScrollText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Journal d'audit</h3>
                  <p className="text-[10px] text-slate-500">{activeConv ? getConversationDisplay(activeConv, currentUserId).name : 'Conversation'}</p>
                </div>
              </div>
              <button onClick={() => setShowAuditLog(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {auditLogsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  Aucune action d'administration enregistrée pour cette conversation.
                </p>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log: any, i: number) => (
                    <div key={log.id || i} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-700">{log.action || 'action'}</span>
                        <span className="text-[10px] text-slate-400">{log.createdAt ? new Date(log.createdAt).toLocaleString('fr-FR') : ''}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {log.adminName || log.adminId || '—'}
                        {log.targetName || log.targetId ? ` → ${log.targetName || log.targetId}` : ''}
                        {log.reason ? ` · ${log.reason}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ⭐ V3-6 — Group call participant picker modal */}
      {showGroupCallModal && activeConv?.type === 'GROUP' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowGroupCallModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Appel de groupe</h3>
              <button onClick={() => setShowGroupCallModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="px-5 py-3 border-b border-slate-100">
              <p className="text-xs text-slate-500">Sélectionnez les participants à appeler :</p>
            </div>
            <div className="overflow-y-auto p-2 flex-1">
              {activeConv.participants.filter((p) => p.userId !== currentUserId).length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">Aucun autre participant dans ce groupe</div>
              ) : (
                activeConv.participants.filter((p) => p.userId !== currentUserId).map((p) => {
                  const isSelected = groupCallParticipants.has(p.userId);
                  const name = `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.email || 'Utilisateur';
                  return (
                    <button
                      key={p.userId}
                      onClick={() => {
                        const newSet = new Set(groupCallParticipants);
                        if (isSelected) newSet.delete(p.userId);
                        else newSet.add(p.userId);
                        setGroupCallParticipants(newSet);
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 p-2.5 rounded-lg transition text-left mb-1',
                        isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'
                      )}
                    >
                      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0', getAvatarColor(name))}>
                        {getInitials(name)}
                      </div>
                      <span className="text-sm font-medium text-slate-700 flex-1 truncate">{name}</span>
                      {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                    </button>
                  );
                })
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => handleStartGroupCall('AUDIO')}
                disabled={groupCallParticipants.size === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0A2A5E] text-white rounded-xl text-sm font-bold disabled:opacity-30 hover:bg-[#114FC4]"
              >
                <Phone className="w-4 h-4" /> Audio
              </button>
              <button
                onClick={() => handleStartGroupCall('VIDEO')}
                disabled={groupCallParticipants.size === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1C6FE8] text-white rounded-xl text-sm font-bold disabled:opacity-30 hover:bg-[#114FC4]"
              >
                <Video className="w-4 h-4" /> Vidéo
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ⭐ V3-6 — Group call overlay mesh (Plan C) */}
      {!v4CallInfo && groupCallActive && groupCallData && (
        <div className="fixed inset-0 bg-gradient-to-br from-[#0A2A5E] via-[#114FC4] to-[#1C6FE8] z-[60] flex flex-col">
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 p-4 pt-6 flex items-center justify-center gap-2 z-10">
            <span className="text-white font-bold text-lg">Appel de groupe</span>
            <span className="text-[#FFE08A] text-sm">({groupCallData.participants.size} participant(s))</span>
          </div>
          {/* Duration */}
          <div className="absolute top-14 left-0 right-0 text-center z-10">
            <p className="text-[#FFE08A] text-base font-semibold">
              {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, '0')}
            </p>
          </div>
          {/* Participant grid — 2 columns */}
          <div className="flex-1 flex items-center justify-center p-4 pt-20">
            <div className="grid grid-cols-2 gap-3 max-w-3xl w-full">
              {Array.from(groupCallData.participants.entries()).map(([userId, info]) => (
                <div key={userId} className="relative aspect-video rounded-2xl overflow-hidden bg-[#0A2A5E]/50 border border-[#FFE08A]/20 flex items-center justify-center">
                  {groupCallData.callType === 'VIDEO' && info.stream ? (
                    <video
                      autoPlay
                      playsInline
                      muted={userId === currentUserId}
                      ref={(el) => {
                        if (el && info.stream) {
                          el.srcObject = info.stream;
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className={cn('w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold ring-4 ring-[#FFE08A]/60', getAvatarColor(info.name))}>
                        {getInitials(info.name)}
                      </div>
                      <span className="text-white text-sm font-medium">{userId === currentUserId ? 'Vous' : info.name}</span>
                    </div>
                  )}
                  {/* Name badge */}
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/50 text-white text-xs font-medium">
                    {userId === currentUserId ? 'Vous' : info.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Bottom control bar */}
          <div className="w-full pb-10 flex justify-center z-30">
            <div className="flex items-center gap-2 px-6 py-4 rounded-full bg-[#0A2A5E]/70 backdrop-blur-md border border-[#FFE08A]/20">
              <button onClick={toggleMute} className="flex flex-col items-center gap-1 px-3">
                <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors', muted ? 'bg-[#FFE08A]' : 'bg-white/20')}>
                  {muted ? <MicOff className="w-5 h-5 text-[#0A2A5E]" /> : <Mic className="w-5 h-5" />}
                </div>
                <span className="text-[10px] text-white/80">{muted ? 'Activer' : 'Micro'}</span>
              </button>
              {groupCallData.callType === 'VIDEO' && (
                <button onClick={toggleVideo} className="flex flex-col items-center gap-1 px-3">
                  <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors', videoOff ? 'bg-[#FFE08A]' : 'bg-white/20')}>
                    {videoOff ? <VideoOff className="w-5 h-5 text-[#0A2A5E]" /> : <Video className="w-5 h-5" />}
                  </div>
                  <span className="text-[10px] text-white/80">{videoOff ? 'Caméra' : 'Vidéo'}</span>
                </button>
              )}
              <button onClick={hangupGroupCall} className="flex flex-col items-center gap-1 px-3">
                <div className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110">
                  <Phone className="w-6 h-6 rotate-[135deg]" />
                </div>
                <span className="text-[10px] text-white/80">Quitter</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ⭐ V3-3 — ORION-powered conversation summary modal */}
      {showSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !summaryLoading && setShowSummary(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Résumé ORION</h3>
                  <p className="text-[10px] text-slate-500">Synthèse intelligente de la conversation</p>
                </div>
              </div>
              <button
                onClick={() => !summaryLoading && setShowSummary(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                disabled={summaryLoading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              {summaryLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
                  <p className="text-sm font-medium">Analyse de la conversation par ORION...</p>
                  <p className="text-xs text-slate-400 mt-1">Cela peut prendre 5 à 10 secondes</p>
                </div>
              ) : summaryData ? (
                <>
                  {/* Synthèse */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Synthèse</h4>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{summaryData.summary}</p>
                  </div>

                  {/* Points clés */}
                  {summaryData.keyPoints?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <ListChecks className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Points clés</h4>
                      </div>
                      <ul className="space-y-1.5">
                        {summaryData.keyPoints.map((point: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                            <span className="text-emerald-500 mt-1.5">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action items */}
                  {summaryData.actionItems?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <ClipboardList className="w-4 h-4 text-amber-600" />
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Actions & décisions</h4>
                      </div>
                      <ul className="space-y-1.5">
                        {summaryData.actionItems.map((item: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                            <span className="text-amber-500 mt-1.5">→</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Suggested title */}
                  {summaryData.suggestedTitle && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Titre suggéré</p>
                      <p className="text-sm font-medium text-slate-800">{summaryData.suggestedTitle}</p>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-4 pt-2 border-t border-slate-100 text-xs text-slate-500">
                    <span>{summaryData.messageCount} messages analysés</span>
                    <span>•</span>
                    <span>{summaryData.participantCount} participants</span>
                    <span>•</span>
                    <span className={summaryData.usingLLM ? 'text-emerald-600' : 'text-amber-600'}>
                      {summaryData.usingLLM ? 'ORION IA' : 'Résumé basique (fallback)'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-sm">Aucun résumé disponible</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ⭐ FIX: Floating reaction bar — WhatsApp style. Shown on long-press / right-click.
          Positioned at the click point, floats ABOVE the message. */}
      {showReactionBar && reactionBarPos && (
        <div
          className="msg-reaction-bar fixed z-[100] flex items-center gap-0.5 bg-white rounded-full shadow-xl border border-slate-200 px-1.5 py-1"
          style={{
            left: `${Math.min(reactionBarPos.x - 100, window.innerWidth - 220)}px`,
            top: `${Math.max(reactionBarPos.y - 50, 10)}px`,
          }}
        >
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleToggleReaction(showReactionBar, emoji)}
              className="text-xl hover:scale-125 transition-transform p-1.5 rounded-full hover:bg-slate-100"
              title={`Réagir avec ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      {/* ⭐ Helm Connect V2.4 — Global Search modal */}
      {showGlobalSearch && (
        <GlobalSearchModal
          currentUserId={currentUserId}
          onClose={() => setShowGlobalSearch(false)}
          onOpenConversation={(convId) => {
            setShowGlobalSearch(false);
            setActiveConvId(convId);
          }}
        />
      )}
      {/* ⭐ Helm Connect V2.6 — Categorized Attachment Menu */}
      {showAttachmentMenu && (
        <CategorizedAttachmentMenu
          currentUserId={currentUserId}
          conversationId={activeConvId}
          onClose={() => setShowAttachmentMenu(false)}
          onSendFile={async (file) => { addPendingFiles([file]); }}
          onOpenPoll={() => setShowPollModal(true)}
          onOpenSchedule={() => {
            setScheduleText(text.replace(/<[^>]*>/g, ''));
            setShowScheduleModal(true);
          }}
        />
      )}
      {/* ⭐ Helm Connect V2.6 — Poll creation modal */}
      {showPollModal && (
        <PollModal
          currentUserId={currentUserId}
          conversationId={activeConvId}
          onClose={() => setShowPollModal(false)}
          onPollCreated={() => {
            // Reload messages to show the new poll
            if (activeConvId) loadMessages();
          }}
        />
      )}

      {error && (
        <div className="absolute top-4 right-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* ⭐ Issue 1 — Custom confirmation modal (replaces native confirm()) */}
      {confirmDialogEl}
      {/* ⭐ Issue 3 — Document/image preview modal (Telegram/WhatsApp style) */}
      {previewDoc && (
        <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}
      {/* ⭐ V1.5: Forward modal — pick a conversation to forward the message to */}
      {forwardMessageId && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setForwardMessageId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Transférer vers…</h3>
              <button onClick={() => setForwardMessageId(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            {/* ⭐ FIX: Show preview of the message being forwarded */}
            {(() => {
              const fwdMsg = messages.find(m => m.id === forwardMessageId);
              if (!fwdMsg) return null;
              const preview = stripHtml(fwdMsg.content) || (fwdMsg.type === 'AUDIO' ? '🎤 Message vocal' : fwdMsg.type === 'IMAGE' ? '📷 Image' : fwdMsg.type === 'DOCUMENT' ? '📎 Document' : 'Message');
              return (
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Message à transférer</p>
                  <p className="text-xs text-slate-600 truncate">{preview}</p>
                </div>
              );
            })()}
            <div className="overflow-y-auto p-2">
              {conversations.filter(c => c.id !== activeConvId).map(conv => {
                const disp = getConversationDisplay(conv, currentUserId);
                return (
                  <button
                    key={conv.id}
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/chat/messages/${forwardMessageId}/forward`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ userId: currentUserId, targetConversationId: conv.id }),
                          credentials: 'include',
                        });
                        if (!res.ok) {
                          const errData = await res.json().catch(() => ({}));
                          throw new Error((errData as any)?.backendError?.message || (errData as any)?.message || `Erreur ${res.status}`);
                        }
                        toast.success(`Message transféré vers ${disp.name}`);
                        // ⭐ FIX: Refresh conversations so the target conv's lastMessage preview updates
                        loadConversations();
                      } catch (e: any) {
                        toast.error('Échec: ' + e.message);
                      }
                      setForwardMessageId(null);
                    }}
                    className="w-full flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-lg transition text-left"
                  >
                    <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0', getAvatarColor(disp.name))}>
                      {getInitials(disp.name)}
                    </div>
                    <span className="text-sm font-medium text-slate-700 truncate">{disp.name}</span>
                  </button>
                );
              })}
              {conversations.filter(c => c.id !== activeConvId).length === 0 && (
                <div className="text-center py-8 text-sm text-slate-400">Aucune autre conversation disponible</div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ⭐ V2: Schedule message modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Programmer le message</h3>
              <button onClick={() => setShowScheduleModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <textarea value={scheduleText} onChange={e => setScheduleText(e.target.value)} placeholder="Votre message..." className="w-full p-3 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/30 mb-3" rows={3} />
            <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="w-full p-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/30 mb-4" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowScheduleModal(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
              <button onClick={handleScheduleMessage} disabled={!scheduleText.trim() || !scheduleDate} className="px-4 py-2 text-sm font-bold text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-30">Programmer</button>
            </div>
          </div>
        </div>
      )}
      {/* ⭐ V2.5: WebRTC call overlay — WhatsApp-style design */}
      {/* Hidden video elements for local + remote streams */}
      {/* ⭐ FIX: Hidden video elements — use sr-only instead of 'hidden' (display:none)
          because some browsers refuse to play audio on a display:none video element.
          sr-only keeps the element in the layout (1px, opacity 0) so audio plays. */}
      <video ref={localVideoRef} autoPlay playsInline muted className="sr-only" aria-hidden />
      <video ref={remoteVideoRef} autoPlay playsInline className="sr-only" aria-hidden />

      {/* Incoming call — Helm Connect branded full-screen modal */}
      {/* ⭐ V4 Phase 2 — Galerie de médias (porté de Yeshua : grille +
          lightbox + téléchargements) */}
      {showGallery && (
        <MediaGalleryModal
          onClose={() => setShowGallery(false)}
          onOpenConversation={(convId) => { setActiveConvId(convId); setShowGallery(false); }}
        />
      )}

      {/* ⭐ V4 — Panneau flottant du canal vocal rejoint (porté de Yeshua
          VoiceChannelView) : participants, locuteurs actifs, contrôles. */}
      {activeVoiceChannel && !v4CallInfo && callState === 'idle' && (
        <VoiceChannelPanel
          channelName={(voiceChannels.find((c: any) => c.id === activeVoiceChannel)?.name) || 'Canal vocal'}
          channelType={voiceChannels.find((c: any) => c.id === activeVoiceChannel)?.type}
          provider={voiceProvider}
          users={(voiceChannelUsers || []).map((u: any) => ({
            userId: u.userId || u.id,
            name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || 'Membre',
            muted: !!u.muted,
            speaking: !!u.speaking,
            avatarUrl: u.avatarUrl || null,
          }))}
          participants={voiceMediaParticipants}
          activeSpeakers={voiceActiveSpeakers}
          meMuted={voiceMuted}
          videoMode={voiceVideoMode}
          isStage={voiceChannels.find((c: any) => c.id === activeVoiceChannel)?.type === 'STAGE'}
          isAdmin={voiceChannels.find((c: any) => c.id === activeVoiceChannel)?.createdBy === currentUserId}
          autoplayBlocked={voiceAutoplayBlocked}
          liveInfo={activeVoiceChannel ? channelDirects[activeVoiceChannel] || null : null}
          iAmLiveHost={!!(activeVoiceChannel && channelDirects[activeVoiceChannel]?.hostId === currentUserId)}
          joined={!!activeVoiceChannel}
          onStartLive={activeVoiceChannel ? () => startChannelDirect(activeVoiceChannel) : undefined}
          onStopLive={stopChannelDirect}
          onJoinLive={() => { if (activeVoiceChannel) joinVoiceChannel(activeVoiceChannel); }}
          liveSwitching={liveSwitching}
          onToggleMute={toggleVoiceMute}
          onToggleVideo={toggleVoiceVideo}
          onToggleVideoMode={toggleVoiceVideoMode}
          onUnlockAudio={unlockAudioPlayback}
          resolveName={(identity: string) => {
            const u = (voiceChannelUsers || []).find((x: any) => (x.userId || x.id) === identity);
            return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name : undefined;
          }}
          localVideoAttacher={(el: HTMLVideoElement) => voiceSessionRef.current?.attachLocalVideo(el) ?? false}
          onLeave={() => { leaveVoiceChannel(); }}
        />
      )}

      {/* ⭐ V5 (parité Yeshua — Plan C) — MODE SECOURS JITSI : iframe plein
          écran avec room déterministe quand la chaîne média est épuisée sur un
          appel de groupe trop grand pour le mesh (≤ 5). ⭐ V7 : couvre AUSSI
          les CANAUX VOCAUX (aucun mesh n'existe pour la voix). */}
      {jitsiFallback && (
        <div className="fixed inset-0 z-[70] bg-[#0A2A5E] flex flex-col">
          <div className="bg-[#CFA63A] text-[#0A2A5E] text-center py-2 px-3 flex items-center justify-center gap-2 text-xs font-semibold">
            <Radio className="w-4 h-4" />
            <span className="truncate">Mode secours Jitsi — {jitsiFallback.title}</span>
            <button
              onClick={() => { setJitsiFallback(null); toast.info('Appel de secours quitté'); }}
              className="ml-3 px-3 py-1 rounded-lg bg-[#0A2A5E] text-white text-[10px] font-bold hover:bg-[#114FC4]"
            >
              Quitter
            </button>
          </div>
          <iframe
            src={jitsiUrlFor(jitsiFallback.room, `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Utilisateur')}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="flex-1 w-full border-0"
            title="Appel de groupe (secours Jitsi)"
          />
        </div>
      )}

      {/* ⭐ V4 (porté de Yeshua Connect) — OVERLAY UNIFIÉ : signalisation
          serveur + chaîne média LiveKit → Agora → Daily. Remplace les 3
          overlays historiques QUAND l'appel est signalisé (v4CallInfo).
          Les overlays mesh historiques restent pour le Plan C (mobile Flutter). */}
      {v4CallInfo && callState !== 'idle' && (
        <CallSessionOverlay
          state={callState as 'incoming' | 'outgoing' | 'active'}
          info={v4CallInfo}
          participants={mediaParticipants}
          activeSpeakers={activeSpeakers}
          duration={callDuration}
          provider={mediaProvider}
          mediaSwitching={mediaSwitching}
          endStatus={callEndStatus}
          muted={muted}
          videoOff={videoOff}
          isSharingScreen={isSharingScreen}
          speakerOn={speakerOn}
          myName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Moi'}
          currentUserId={currentUserId}
          onAccept={acceptSignalCall}
          onDecline={declineSignalCall}
          onHangup={endSignalCall}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onToggleScreenShare={() => {
            if (mediaSessionRef.current) {
              mediaSessionRef.current.setScreenShareEnabled(!isSharingScreen).then(() => {
                setIsSharingScreen(!isSharingScreen);
              }).catch(() => toast.error('Partage d\'écran indisponible sur ce réseau'));
            } else {
              toggleScreenShare();
            }
          }}
          onToggleSpeaker={() => {
            if (mediaSessionRef.current) {
              mediaSessionRef.current.setSpeakerEnabled(!speakerOn);
            }
            setSpeakerOn(!speakerOn);
          }}
          resolveName={(identity) => {
            const p = activeConv?.participants?.find((pp: any) => pp.userId === identity);
            return p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : undefined;
          }}
          localVideoAttacher={(el) => mediaSessionRef.current?.attachLocalVideo(el) ?? false}
        />
      )}

      {/* ⭐ V4 — Signal entrant (overlay unifié géré ci-dessus via callState) :
          quand un appel sonne et que callState est encore 'idle', on force
          l'affichage de l'état incoming de l'overlay unifié. */}
      {incomingSignal && callState === 'idle' && !groupCallActive && (
        <CallSessionOverlay
          state={'incoming'}
          info={{
            callId: incomingSignal.callId,
            callType: incomingSignal.callType === 'video' ? 'VIDEO' : 'AUDIO',
            title: incomingSignal.isGroupCall
              ? (incomingSignal.convName || 'Appel de groupe')
              : (incomingSignal.initiatorName || 'Appel'),
            subtitle: incomingSignal.isGroupCall ? 'Appel de groupe' : undefined,
            avatarUrl: incomingSignal.isGroupCall
              ? (incomingSignal.convAvatarUrl || null)
              : (incomingSignal.initiatorAvatarUrl || null),
            isGroup: !!incomingSignal.isGroupCall,
            isInitiator: false,
            conversationId: incomingSignal.conversationId,
          }}
          participants={[]}
          activeSpeakers={new Set()}
          duration={0}
          provider={null}
          mediaSwitching={false}
          accepting={acceptingCall}
          muted={false}
          videoOff={false}
          isSharingScreen={false}
          speakerOn
          myName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Moi'}
          currentUserId={currentUserId}
          onAccept={acceptSignalCall}
          onDecline={declineSignalCall}
          onHangup={declineSignalCall}
          onToggleMute={() => {}}
          onToggleVideo={() => {}}
          onToggleScreenShare={() => {}}
          onToggleSpeaker={() => {}}
        />
      )}

      {/* Sonnerie de l'appel entrant V4 (l'effet callState ne gère pas
          incomingSignal seul) */}
          {/* ⭐ V5 — La sonnerie/vibration des appels entrants V4 est gérée par
              l'effet ringtone ci-dessus (couvre callState ET incomingSignal) —
              le composant <IncomingSignalRingtone /> d'origine n'existait pas
              (crash ReferenceError à chaque appel entrant). */}

      {/* Anciens overlays mesh — uniquement quand l'appel n'est PAS signalisé */}
      {!v4CallInfo && callState === 'incoming' && callData && (
        <div className="fixed inset-0 bg-gradient-to-br from-[#0A2A5E] via-[#114FC4] to-[#1C6FE8] z-[60] flex flex-col items-center justify-between p-8">
          {/* Top: incoming label */}
          <div className="pt-8 text-center">
            <p className="text-sm text-[#FFE08A] font-medium tracking-wider uppercase">Appel entrant Helm Connect</p>
          </div>
          {/* Center: avatar + name */}
          <div className="text-center">
            <div className="relative w-28 h-28 mx-auto mb-5">
              {/* ⭐ V3-6: Pulsing gold halo (outer) — Academia Helm living gold */}
              <div className="absolute -inset-3 rounded-full bg-[#CFA63A] opacity-30 animate-ping" style={{ animationDuration: '1.8s' }}></div>
              {/* ⭐ V3-6: Pulsing royal-blue halo (middle) — Helm Connect azure */}
              <div className="absolute -inset-1 rounded-full bg-[#FFE08A] opacity-50 animate-pulse" style={{ animationDuration: '1.2s' }}></div>
              {/* Avatar with gold ring */}
              <div className={cn('relative w-28 h-28 rounded-full flex items-center justify-center text-white text-4xl font-bold ring-4 ring-[#FFE08A]/80 shadow-2xl', getAvatarColor(callData.otherUserName))}>
                {getInitials(callData.otherUserName)}
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{callData.otherUserName}</h2>
            {/* ⭐ V3-4: Professional animated icon badge (replaces 📞/📹 emoji) */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-[#FFE08A]/30">
              <span className="relative flex h-7 w-7">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFE08A] opacity-50"></span>
                <span className="relative inline-flex rounded-full h-7 w-7 bg-[#FFE08A] items-center justify-center">
                  {callData.callType === 'VIDEO' ? <Video className="w-4 h-4 text-[#0A2A5E]" /> : <Phone className="w-4 h-4 text-[#0A2A5E]" />}
                </span>
              </span>
              <span className="text-sm font-semibold text-white">{callData.callType === 'VIDEO' ? 'Appel vidéo' : 'Appel audio'}</span>
            </div>
          </div>
          {/* Bottom: Accept / Reject */}
          <div className="flex justify-center gap-16 pb-10">
            <button onClick={() => rejectCall(callData.otherUserId, callData.callId)} className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110">
                <Phone className="w-7 h-7 rotate-[135deg]" />
              </div>
              <span className="text-xs text-white/80">Refuser</span>
            </button>
            <button
              onClick={() => { const offer = (window as any)._pendingCallOffer?.offer; if (offer) acceptCall(callData.otherUserId, callData.callId, callData.callType, offer); }}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-16 h-16 rounded-full bg-[#FFE08A] hover:bg-[#CFA63A] flex items-center justify-center text-[#0A2A5E] shadow-lg animate-pulse">
                <Phone className="w-7 h-7" />
              </div>
              <span className="text-xs text-white/80">Accepter</span>
            </button>
          </div>
        </div>
      )}

      {/* Outgoing + Active call — Helm Connect branded overlay (mesh) */}
      {!v4CallInfo && (callState === 'outgoing' || callState === 'active') && callData && (
        <div className="fixed inset-0 bg-gradient-to-br from-[#0A2A5E] via-[#114FC4] to-[#1C6FE8] z-[60] flex flex-col items-center justify-between">
          {/* Remote video (full screen for VIDEO calls when active) */}
          {callData.callType === 'VIDEO' && callState === 'active' && (
            <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
          )}
          {/* Top bar: name + encrypted indicator */}
          <div className="absolute top-0 left-0 right-0 p-4 pt-6 flex items-center justify-center gap-2 z-10">
            <span className="text-white font-bold text-lg">{callData.otherUserName}</span>
            {callState === 'active' && (
              <span className="flex items-center gap-1 text-xs text-[#FFE08A]">
                🔒 <span className="hidden sm:inline">Chiffré de bout en bout</span>
              </span>
            )}
            {/* ⭐ 2026-10-14 — P2P fallback indicator (porté de Yeshua Connect) :
                affiche un badge "P2P" quand le fallback WebRTC direct est actif
                (chaîne média LiveKit/Agora/Daily échouée). */}
            {p2pFallbackActive && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/30 border border-amber-300/50 text-[10px] font-bold text-amber-100" title="Mode peer-to-peer de secours — la chaîne média LiveKit/Agora/Daily est indisponible, le média voyage directement entre les deux navigateurs via WebRTC.">
                P2P
              </span>
            )}
          </div>
          {/* Center: avatar (for AUDIO calls or outgoing VIDEO) */}
          {(callData.callType === 'AUDIO' || callState !== 'active') && (
            <div className="text-center z-10 pt-20">
              <div className="relative w-32 h-32 mx-auto mb-5">
                {/* ⭐ V3-6: Pulsing gold halo (outer) — Academia Helm living gold */}
                <div className="absolute -inset-4 rounded-full bg-[#CFA63A] opacity-30 animate-ping" style={{ animationDuration: '1.8s' }}></div>
                {/* ⭐ V3-6: Pulsing royal-blue halo (middle) — Helm Connect azure */}
                <div className="absolute -inset-2 rounded-full bg-[#FFE08A] opacity-50 animate-pulse" style={{ animationDuration: '1.2s' }}></div>
                {/* Avatar with gold ring */}
                <div className={cn('relative w-32 h-32 rounded-full flex items-center justify-center text-white text-5xl font-bold ring-4 ring-[#FFE08A]/80 shadow-2xl', getAvatarColor(callData.otherUserName))}>
                  {getInitials(callData.otherUserName)}
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">{callData.otherUserName}</h2>
              <p className="text-[#FFE08A]/90">
                {callState === 'outgoing' ? 'Appel en cours…' : `${Math.floor(callDuration / 60)}:${(callDuration % 60).toString().padStart(2, '0')}`}
              </p>
              {/* ⭐ V3-4: Professional animated icon badge (replaces 📞/📹 emoji) */}
              <div className="inline-flex items-center gap-2 px-4 py-2 mt-2 rounded-full bg-white/10 backdrop-blur-sm border border-[#FFE08A]/30">
                <span className="relative flex h-7 w-7">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFE08A] opacity-50"></span>
                  <span className="relative inline-flex rounded-full h-7 w-7 bg-[#FFE08A] items-center justify-center">
                    {callData.callType === 'VIDEO' ? <Video className="w-4 h-4 text-[#0A2A5E]" /> : <Phone className="w-4 h-4 text-[#0A2A5E]" />}
                  </span>
                </span>
                <span className="text-sm font-semibold text-white">{callData.callType === 'VIDEO' ? 'Appel vidéo' : 'Appel audio'}</span>
                <span className="text-xs text-[#FFE08A]/70 ml-1">— Helm Connect</span>
              </div>
            </div>
          )}
          {/* Active call timer (for VIDEO when active — no avatar shown) */}
          {callData.callType === 'VIDEO' && callState === 'active' && (
            <div className="absolute top-14 left-0 right-0 text-center z-10">
              <p className="text-white text-lg font-semibold">{Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, '0')}</p>
            </div>
          )}
          {/* Local video PiP (for VIDEO calls when active) */}
          {callData.callType === 'VIDEO' && callState === 'active' && (
            <video
              ref={localVideoRef} autoPlay playsInline muted
              className={cn('absolute bottom-32 right-4 w-32 h-48 rounded-2xl object-cover border-2 border-[#FFE08A]/40 z-20', videoOff && 'opacity-30')}
            />
          )}
          {/* Right-side controls (for VIDEO calls) */}
          {callData.callType === 'VIDEO' && callState === 'active' && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20">
              <button onClick={toggleVideo} className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white" title="Basculer caméra">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}
          {/* Bottom control bar — Helm Connect branded pill */}
          <div className="w-full pb-10 flex justify-center z-30">
            <div className="flex items-center gap-2 px-6 py-4 rounded-full bg-[#0A2A5E]/70 backdrop-blur-md border border-[#FFE08A]/20">
              {/* Mute */}
              {callState === 'active' && (
                <button onClick={toggleMute} className="flex flex-col items-center gap-1 px-3">
                  <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors', muted ? 'bg-[#FFE08A]' : 'bg-white/20')}>
                    {muted ? <MicOff className="w-5 h-5 text-[#0A2A5E]" /> : <Mic className="w-5 h-5" />}
                  </div>
                  <span className="text-[10px] text-white/80">{muted ? 'Activer' : 'Micro'}</span>
                </button>
              )}
              {/* Video toggle (VIDEO calls only) */}
              {callState === 'active' && callData.callType === 'VIDEO' && (
                <button onClick={toggleVideo} className="flex flex-col items-center gap-1 px-3">
                  <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors', videoOff ? 'bg-[#FFE08A]' : 'bg-white/20')}>
                    {videoOff ? <VideoOff className="w-5 h-5 text-[#0A2A5E]" /> : <Video className="w-5 h-5" />}
                  </div>
                  <span className="text-[10px] text-white/80">{videoOff ? 'Caméra' : 'Vidéo'}</span>
                </button>
              )}
              {/* ⭐ DISCORD PARITY: Screen sharing toggle — replaces webcam with
                  screen share. Available in both AUDIO and VIDEO calls (the
                  screen share adds a video track if needed). */}
              {callState === 'active' && (
                <button onClick={toggleScreenShare} className="flex flex-col items-center gap-1 px-3" title={isSharingScreen ? 'Arrêter le partage' : 'Partager votre écran'}>
                  <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors', isSharingScreen ? 'bg-[#FFE08A]' : 'bg-white/20')}>
                    <Monitor className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] text-white/80">{isSharingScreen ? 'Arrêter' : 'Écran'}</span>
                </button>
              )}
              {/* ⭐ FIX: Speaker toggle (wired) — mutes/unmutes the remote audio */}
              {callState === 'active' && (
                <button onClick={() => setSpeakerOn(!speakerOn)} className="flex flex-col items-center gap-1 px-3">
                  <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors', speakerOn ? 'bg-white/20' : 'bg-[#FFE08A]')}>
                    {speakerOn ? <Volume2 className="w-5 h-5" /> : <Volume2 className="w-5 h-5 text-[#0A2A5E] opacity-40" />}
                  </div>
                  <span className="text-[10px] text-white/80">{speakerOn ? 'Haut-parleur' : 'Muet'}</span>
                </button>
              )}
              {/* End call — red button */}
              <button onClick={hangup} className="flex flex-col items-center gap-1 px-3">
                <div className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110">
                  <Phone className="w-6 h-6 rotate-[135deg]" />
                </div>
                <span className="text-[10px] text-white/80">Terminer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ GAP FILL: In-conversation search bar */}
      {showConvSearch && activeConvId && (
        <div className="absolute top-14 left-0 right-0 z-50 bg-white border-b border-slate-200 p-2">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input autoFocus type="text" value={convSearchQuery} onChange={e => handleConvSearch(e.target.value)} placeholder="Rechercher dans cette conversation..." className="flex-1 text-sm outline-none" />
            <button onClick={() => { setShowConvSearch(false); setConvSearchQuery(''); setConvSearchResults([]); }} className="p-1 hover:bg-slate-100 rounded"><X className="w-4 h-4 text-slate-500" /></button>
          </div>
          {convSearchResults.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
              {convSearchResults.map((r: any) => (
                <div key={r.id} className="p-2 text-xs hover:bg-slate-50 rounded cursor-pointer" onClick={() => {
                  // ⭐ V6 — sauter au message trouvé (comme les épinglés) au
                  //    lieu de fermer la barre sans rien faire.
                  setShowConvSearch(false);
                  jumpToMessage(r.id);
                }}>
                  <p className="text-slate-700 line-clamp-2">{r.content || r.attachmentName || '—'}</p>
                  <p className="text-[10px] text-slate-400">{new Date(r.createdAt).toLocaleString('fr-FR')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ⭐ GAP FILL: User profile modal + status selector */}
      {profileUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 text-center border-b border-slate-100">
              <div className={cn('w-20 h-20 rounded-full mx-auto mb-3 flex items-center justify-center text-white text-2xl font-bold', getAvatarColor(profileUser.name))}>{getInitials(profileUser.name)}</div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center justify-center gap-1.5">
                {/* ⭐ 2026-10-14 — Country flag (porté de Yeshua Connect) — affiche le
                    drapeau du pays du membre à côté de son nom. profileData.country
                    peut être un code ISO 2 lettres (BJ, FR, US) ou un nom (Bénin, France). */}
                {profileData?.country && (() => {
                  const c = String(profileData.country).trim();
                  if (/^[a-zA-Z]{2}$/.test(c)) return <span title={c.toUpperCase()}>{flagFromCountryCode(c.toUpperCase())}</span>;
                  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                  const hit = COUNTRIES.find(co => norm(co.name) === norm(c));
                  return hit ? <span title={hit.name}>{flagFromCountryCode(hit.code)}</span> : null;
                })()}
                {profileUser.name}
              </h3>
              <p className="text-sm text-slate-500">
                {formatChatRoleLabel(profileData?.roleLabel || profileData?.role) || '—'}
              </p>
              <p className="text-xs text-slate-400">{profileData?.email || ''}</p>
              <div className="mt-2"><span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold', profileData?.availabilityStatus === 'online' ? 'bg-green-100 text-green-700' : profileData?.availabilityStatus === 'away' ? 'bg-amber-100 text-amber-700' : profileData?.availabilityStatus === 'dnd' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500')}>{profileData?.availabilityStatus === 'online' ? '🟢 En ligne' : profileData?.availabilityStatus === 'away' ? '🟡 Absent' : profileData?.availabilityStatus === 'dnd' ? '🔴 Ne pas déranger' : '⚫ Hors ligne'}</span></div>
            </div>
            {profileData?.bio && <div className="p-4 border-b border-slate-100"><p className="text-xs font-semibold text-slate-500 uppercase mb-1">Bio</p><p className="text-sm text-slate-700">{profileData.bio}</p></div>}
            {profileUser.userId === currentUserId && (
              <div className="p-4 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Mon statut</p>
                <div className="flex gap-2">
                  {[{value:'online',label:'🟢 En ligne'},{value:'away',label:'🟡 Absent'},{value:'dnd',label:'🔴 DND'},{value:'offline',label:'⚫ Hors ligne'}].map(s => (
                    <button key={s.value} onClick={() => handleUpdateMyStatus(s.value)} className={cn('px-2 py-1 rounded-full text-[10px] font-semibold border', myStatus === s.value ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-500')}>{s.label}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="p-4 flex justify-end"><button onClick={() => { setProfileUser(null); setProfileData(null); }} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Fermer</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
//  MODAL : Nouvelle conversation 1-à-1
// ═════════════════════════════════════════════════════════════════

/** ⭐ V5 (parité Yeshua — MemberProfileModal) — Fiche d'un MEMBRE au clic :
 *    grande photo + présence, badge de rôle, bio/-statut (fetch lazy
 *    /api/chat/profile/:userId), actions Message privé / Appel audio / Appel
 *    vidéo / Bloquer-Débloquer. Remplace l'ancien comportement qui ouvrait
 *    SON PROPRE profil au clic sur un membre. */
function MemberProfileModal({
  member, currentUserId, onClose, onDirectMessage, onCall, isBlocked, onToggleBlock,
}: {
  member: any;
  currentUserId: string;
  onClose: () => void;
  onDirectMessage: (userId: string) => void;
  onCall: (userId: string, callType: 'AUDIO' | 'VIDEO') => void;
  isBlocked: boolean;
  onToggleBlock: (userId: string) => void;
}) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // ⭐ V5 — créneaux de disponibilité publiés par le membre
  const [slots, setSlots] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat/profile/${member.userId}`, { credentials: 'include' });
        if (res.ok && !cancelled) setProfile(await res.json());
      } catch { /* silencieux */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    (async () => {
      try {
        const res = await fetch(`/api/chat/availability/user/${encodeURIComponent(member.userId)}`, { credentials: 'include' });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setSlots(Array.isArray(data) ? data : (data?.slots || []));
        }
      } catch { /* silencieux */ }
    })();
    return () => { cancelled = true; };
  }, [member.userId]);

  const fullName = `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Membre';
  const isOnline = !!member.isOnline;
  const roleLabel = formatChatRoleLabel(
    member.roleLabel || member.userRole || profile?.roleLabel || profile?.role,
  );
  const bio = profile?.bio || member.bio || '';
  const availability = profile?.availabilityStatus || member.activityStatus || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Bandeau + avatar */}
        <div className="bg-gradient-to-br from-[#0A2A5E] via-[#114FC4] to-[#1C6FE8] px-5 pt-5 pb-4 relative">
          <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded hover:bg-white/20 text-white">
            <X className="w-4 h-4" />
          </button>
          <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white/60 shadow-lg mx-auto bg-slate-200 flex items-center justify-center text-white text-2xl font-bold">
            {member.avatarUrl || profile?.avatarUrl
              ? <img src={member.avatarUrl || profile?.avatarUrl} alt={fullName} className="w-full h-full object-cover" />
              : getInitials(fullName)}
          </div>
          <h3 className="text-lg font-bold text-white text-center mt-2 truncate flex items-center justify-center gap-1.5">
            {/* ⭐ 2026-10-14 — Country flag (porté de Yeshua Connect) — affiche le
                drapeau du pays du membre. profile.country peut être un code ISO 2
                lettres (BJ, FR, US) ou un nom (Bénin, France). */}
            {(profile?.country || member.country) && (() => {
              const c = String(profile?.country || member.country).trim();
              if (/^[a-zA-Z]{2}$/.test(c)) return <span title={c.toUpperCase()}>{flagFromCountryCode(c.toUpperCase())}</span>;
              const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              const hit = COUNTRIES.find(co => norm(co.name) === norm(c));
              return hit ? <span title={hit.name}>{flagFromCountryCode(hit.code)}</span> : null;
            })()}
            {fullName}
          </h3>
          <p className="text-xs text-white/80 text-center flex items-center justify-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full inline-block', isOnline ? 'bg-green-400' : 'bg-slate-400')} />
            {isOnline ? 'En ligne' : 'Hors ligne'}
            {roleLabel ? ` · ${roleLabel}` : ''}
          </p>
        </div>
        {/* Détails */}
        <div className="p-4 space-y-2 max-h-48 overflow-y-auto">
          {loading && <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>}
          {availability && (
            <div className="flex items-start gap-2 text-xs text-slate-600">
              <Clock className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
              <span>{availability === 'away' ? 'Absent' : availability === 'dnd' ? 'Ne pas déranger' : 'Disponible'}</span>
            </div>
          )}
          {bio && (
            <div className="flex items-start gap-2 text-xs text-slate-600">
              <UserIcon className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-3">{bio}</span>
            </div>
          )}
          {/* ⭐ V5 — créneaux de disponibilité publiés par ce membre */}
          {slots.length > 0 && (
            <div className="mt-1 border-t border-slate-100 pt-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mb-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-[#1677FF]" />
                Créneaux de disponibilité
              </div>
              <div className="flex flex-col gap-1">
                {slots.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-2 text-[11px] bg-blue-50/60 border border-blue-100 rounded-lg px-2 py-1">
                    <span className="font-semibold text-slate-700 w-14 flex-shrink-0">{s.dayLabel || `J${s.dayOfWeek}`}</span>
                    <span className="text-slate-600 tabular-nums">{s.startTime} – {s.endTime}</span>
                    {s.label && <span className="text-slate-400 truncate">· {s.label}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {isBlocked && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
              <Ban className="w-3.5 h-3.5" /> Membre bloqué — il ne peut plus vous contacter
            </div>
          )}
        </div>
        {/* Actions */}
        <div className="p-4 pt-0 grid grid-cols-2 gap-2">
          {member.userId !== currentUserId && (
            <>
              <button
                onClick={() => onDirectMessage(member.userId)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1677FF] text-white text-xs font-semibold rounded-lg hover:bg-[#0958D9]"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Message privé
              </button>
              <button
                onClick={() => onCall(member.userId, 'AUDIO')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200"
              >
                <Phone className="w-3.5 h-3.5" /> Appel audio
              </button>
              <button
                onClick={() => onCall(member.userId, 'VIDEO')}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200"
              >
                <Video className="w-3.5 h-3.5" /> Appel vidéo
              </button>
              <button
                onClick={() => onToggleBlock(member.userId)}
                className={cn(
                  'flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg',
                  isBlocked ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-red-50 text-red-600 hover:bg-red-100'
                )}
              >
                {isBlocked ? <><CheckCircle2 className="w-3.5 h-3.5" /> Débloquer</> : <><Ban className="w-3.5 h-3.5" /> Bloquer</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NewChatModal({
  currentUserId,
  onClose,
  onConversationCreated,
}: {
  currentUserId: string;
  onClose: () => void;
  onConversationCreated: (convId: string) => void | Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [sentInvites, setSentInvites] = useState<Set<string>>(new Set());

  // Search users
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        // ⭐ (sept. 2026 — isolation multi-tenant stricte, spéc. §20) : plus
        //    de includeOtherTenants=true — le sélecteur « nouvelle
        //    conversation » ne doit lister QUE les membres de l'école
        //    courante (retour promoteur : un personnel d'une autre école
        //    apparaissait chez CSPEB). L'API ignore désormais ce paramètre,
        //    on ne l'envoie plus.
        const res = await fetch(
          `/api/chat/search-users?userId=${currentUserId}&q=${encodeURIComponent(query)}&includeOtherTenants=false`,
          { credentials: 'include' }
        );
        if (res.ok) setResults(await res.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, currentUserId]);

  const startConversation = async (user: ChatUser) => {
    if (user.canStartDirectConversation) {
      // ⭐ INTRA-ÉCOLE : conversation directe, pas d'invitation requise
      //    (collègue enseignant, parent d'élève de la même école, directeur, etc.)
      try {
        const res = await fetch('/api/chat/conversations/direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentUserId, otherUserId: user.userId }),
          credentials: 'include',
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error((errData as any)?.message || (errData as any)?.error || `Erreur ${res.status}`);
        }
        const conv = await res.json();
        await onConversationCreated(conv.id);
        toast.success(`Conversation démarrée avec ${user.firstName} ${user.lastName}`);
      } catch (e: any) {
        toast.error("Échec: " + e.message);
      }
    } else if (user.source === 'guardians' && user.guardianId) {
      // ⭐ Issue #?: NO MORE INVITATION FLOW — direct chat with the parent.
      //    Per user feedback: "On n'a pas besoin d'envoyer d'invitation à un
      //    parent. Le parent qui a inscrit, lorsqu'un élève est inscrit dans
      //    l'école, on a déjà les informations de son parent. Le parent peut
      //    se connecter à l'espace parent avec son numéro de téléphone."
      //
      //    The backend's POST /api/chat/conversations/guardian-direct endpoint
      //    auto-creates a User account (role=PARENT) for the guardian if they
      //    don't have one yet, then creates/gets the direct conversation.
      //    The parent can login to the parent portal with their phone (OTP).
      const guardianId = user.guardianId!;
      try {
        const res = await fetch('/api/chat/conversations/guardian-direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentUserId,
            guardianId,
          }),
          credentials: 'include',
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as any)?.message || `Erreur ${res.status}`);
        }
        const data = await res.json();
        await onConversationCreated(data.conversationId);
        toast.success(
          `Conversation démarrée avec ${user.firstName} ${user.lastName}` +
          (data.userCreated ? ' (compte parent créé automatiquement)' : '')
        );
      } catch (e: any) {
        toast.error("Échec: " + e.message);
      }
    } else {
      // ⭐ CROSS-ÉCOLE : envoi d'invitation (inter-écoles)
      try {
        const res = await fetch('/api/chat/invitations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderId: currentUserId,
            recipientId: user.userId,
            recipientName: `${user.firstName} ${user.lastName}`.trim(),
            message: 'Souhaite vous ajouter à ses contacts Academia Helm',
          }),
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to send invitation');
        setSentInvites(prev => new Set(prev).add(user.userId));
        toast.success(`Invitation envoyée à ${user.firstName} ${user.lastName} (autre école)`);
      } catch (e: any) {
        toast.error("Échec: " + e.message);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Nouvelle conversation</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              autoFocus
              type="text"
              placeholder="Rechercher par nom, email ou téléphone..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#3B9EFF]/30"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              {query.trim().length < 2
                ? 'Tapez au moins 2 caractères pour rechercher'
                : 'Aucun utilisateur trouvé'}
            </div>
          ) : (
            results.map(user => (
              <button
                key={user.userId}
                onClick={() => startConversation(user)}
                className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 text-left border-b border-slate-50"
              >
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
                  getAvatarColor(`${user.firstName || ''} ${user.lastName || ''}`)
                )}>
                  {getInitials(`${user.firstName || ''} ${user.lastName || ''}`)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {user.email}
                  </div>
                  {/* ⭐ Role label (ex: "Collègue enseignant", "Parent de Awa Dupont", "Directeur") */}
                  {user.roleLabel && (
                    <div className="text-[11px] text-[#0958D9] font-semibold truncate">
                      {user.roleLabel}
                    </div>
                  )}
                  {/* ⭐ Distinction intra-école vs cross-école vs guardian-without-account */}
                  {user.canStartDirectConversation ? (
                    <div className="text-[10px] text-[#1677FF] font-semibold mt-0.5">
                      ✓ Même école — discussion directe
                    </div>
                  ) : user.source === 'guardians' && user.guardianId ? (
                    <div className="text-[10px] text-[#1677FF] font-semibold mt-0.5">
                      ✓ Parent d'élève — cliquez pour démarrer la conversation
                    </div>
                  ) : user.tenantName ? (
                    <div className="text-[10px] text-amber-600 font-semibold mt-0.5">
                      ⚠ Autre école : {user.tenantName} — invitation requise
                    </div>
                  ) : (
                    <div className="text-[10px] text-amber-600 font-semibold mt-0.5">
                      ⚠ Autre école — invitation requise
                    </div>
                  )}
                </div>
                {sentInvites.has(user.userId || user.guardianId || '') ? (
                  <span className="text-xs text-[#1677FF] font-semibold flex-shrink-0">Invité</span>
                ) : user.canStartDirectConversation ? (
                  <MessageSquare className="w-4 h-4 text-[#1677FF] flex-shrink-0" />
                ) : (
                  <UserPlus className="w-4 h-4 text-amber-600 flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
//  MODAL : Nouveau groupe
// ═════════════════════════════════════════════════════════════════

function NewGroupModal({
  currentUserId,
  onClose,
  onGroupCreated,
}: {
  currentUserId: string;
  onClose: () => void;
  onGroupCreated: (convId: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/chat/search-users?userId=${currentUserId}&q=${encodeURIComponent(query)}&includeOtherTenants=false`,
          { credentials: 'include' }
        );
        if (res.ok) setResults(await res.json());
      } catch (e) {}
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, currentUserId]);

  const toggleSelect = (userId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const createGroup = async () => {
    if (!name.trim()) {
      toast.error('Le nom du groupe est requis');
      return;
    }
    if (selected.size === 0) {
      toast.error('Sélectionnez au moins 1 participant');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/chat/conversations/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: currentUserId,
          name: name.trim(),
          description: description.trim() || undefined,
          participantIds: Array.from(selected),
        }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to create group');
      const conv = await res.json();
      onGroupCreated(conv.id);
      toast.success('Groupe créé');
    } catch (e: any) {
      toast.error('Échec: ' + e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Nouveau groupe</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="p-4 space-y-3 border-b border-slate-100">
          <input
            type="text"
            placeholder="Nom du groupe *"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#3B9EFF]/30"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Description (optionnel)"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#3B9EFF]/30"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher des utilisateurs à ajouter..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#3B9EFF]/30"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          {selected.size > 0 && (
            <div className="mt-2 text-xs text-[#0958D9] font-semibold">
              {selected.size} participant(s) sélectionné(s)
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {results.map(user => {
            const isSelected = selected.has(user.userId);
            return (
              <button
                key={user.userId}
                onClick={() => toggleSelect(user.userId)}
                className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 text-left border-b border-slate-50"
              >
                <div className={cn(
                  'w-5 h-5 rounded border flex items-center justify-center flex-shrink-0',
                  isSelected ? 'bg-[#1677FF] border-[#1677FF] text-white' : 'border-slate-300'
                )}>
                  {isSelected && <Check className="w-3 h-3" />}
                </div>
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0',
                  getAvatarColor(`${user.firstName || ''} ${user.lastName || ''}`)
                )}>
                  {getInitials(`${user.firstName || ''} ${user.lastName || ''}`)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{user.email}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={createGroup}
            disabled={creating || !name.trim() || selected.size === 0}
            className="w-full px-4 py-2.5 bg-[#1677FF] text-white text-sm font-bold rounded-lg hover:bg-[#0958D9] disabled:opacity-30"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Créer le groupe'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
//  MODAL : Invitations reçues
// ═════════════════════════════════════════════════════════════════

function InvitationsModal({
  currentUserId,
  onClose,
  onInvitationResponded,
}: {
  currentUserId: string;
  onClose: () => void;
  onInvitationResponded: () => void;
}) {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/invitations/pending?userId=${currentUserId}`, { credentials: 'include' });
      if (res.ok) setInvitations(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [currentUserId]);

  useEffect(() => { load(); }, [load]);

  const accept = async (invId: string) => {
    try {
      const res = await fetch(`/api/chat/invitations/${invId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUserId }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to accept');
      toast.success('Invitation acceptée — conversation créée');
      onInvitationResponded();
      load();
    } catch (e: any) {
      toast.error('Échec: ' + e.message);
    }
  };

  const decline = async (invId: string) => {
    try {
      const res = await fetch(`/api/chat/invitations/${invId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUserId }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to decline');
      toast.success('Invitation refusée');
      load();
    } catch (e: any) {
      toast.error('Échec: ' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Invitations reçues</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Aucune invitation en attente</p>
            </div>
          ) : (
            invitations.map(inv => (
              <div key={inv.id} className="p-3 border-b border-slate-50 flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
                  getAvatarColor(`${inv.senderFirstName || ''} ${inv.senderLastName || ''}`)
                )}>
                  {getInitials(`${inv.senderFirstName || ''} ${inv.senderLastName || ''}`)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {inv.senderFirstName} {inv.senderLastName}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {inv.senderTenantName || 'École'}
                    {inv.senderRole && ` · ${inv.senderRole}`}
                  </div>
                  {inv.message && <div className="text-xs text-slate-600 italic mt-1">"{inv.message}"</div>}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => accept(inv.id)}
                    className="px-3 py-1 bg-[#1677FF] text-white text-xs font-semibold rounded-lg hover:bg-[#0958D9]"
                  >
                    Accepter
                  </button>
                  <button
                    onClick={() => decline(inv.id)}
                    className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200"
                  >
                    Refuser
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
//  MODAL: Profil + Avatar Upload
// ═════════════════════════════════════════════════════════════════

function ProfileModal({
  currentUserId, myAvatarUrl, userName, onClose, onAvatarUpload, avatarInputRef,
}: {
  currentUserId: string;
  myAvatarUrl: string | null;
  userName: string;
  onClose: () => void;
  onAvatarUpload: (file: File) => void;
  avatarInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  // ⭐ Get absolute URL for avatar (same logic as attachments)
  const avatarUrl = myAvatarUrl
    ? (myAvatarUrl.startsWith('http') ? myAvatarUrl : `${getBackendBaseUrl()}${myAvatarUrl.startsWith('/') ? myAvatarUrl : `/${myAvatarUrl}`}`)
    : null;

  // ⭐ V5 — sections repliables : disponibilités + sécurité 2FA
  const [openSection, setOpenSection] = useState<'availability' | 'security' | null>(null);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Mon profil</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="overflow-y-auto">
          <div className="p-6 flex flex-col items-center gap-4">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-bold bg-gradient-to-br from-[#3B9EFF] to-blue-500 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={userName} className="w-full h-full rounded-full object-cover" />
              ) : (
                getInitials(userName || '?')
              )}
            </div>
            {/* ⭐ Show user name ONLY — no ID, no encryption info (security) */}
            <div className="text-center">
              <div className="text-sm font-bold text-slate-900">{userName || 'Utilisateur'}</div>
            </div>
            {/* Upload button */}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onAvatarUpload(file);
                if (avatarInputRef.current) avatarInputRef.current.value = '';
              }}
            />
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="px-4 py-2 bg-[#1677FF] text-white text-sm font-bold rounded-lg hover:bg-[#0958D9]"
            >
              Modifier ma photo
            </button>
          </div>

          {/* ══════════════════════════════════════════════════════════
              ⭐ V5 — CRÉNEAUX DE DISPONIBILITÉ (parité web demandée)
              ══════════════════════════════════════════════════════════ */}
          <div className="border-t border-slate-100">
            <button
              onClick={() => setOpenSection(openSection === 'availability' ? null : 'availability')}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <CalendarClock className="w-4 h-4 text-[#1677FF]" />
                Créneaux de disponibilité
              </span>
              {openSection === 'availability'
                ? <ChevronDown className="w-4 h-4 text-slate-400" />
                : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>
            {openSection === 'availability' && (
              <AvailabilitySection currentUserId={currentUserId} />
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════
              ⭐ V5 — SÉCURITÉ : double authentification (TOTP)
              ══════════════════════════════════════════════════════════ */}
          <div className="border-t border-slate-100">
            <button
              onClick={() => setOpenSection(openSection === 'security' ? null : 'security')}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Sécurité — double authentification
              </span>
              {openSection === 'security'
                ? <ChevronDown className="w-4 h-4 text-slate-400" />
                : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>
            {openSection === 'security' && (
              <TwoFactorSection />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ⭐ V5 — SECTION CRÉNEAUX DE DISPONIBILITÉ (mon profil).
 *    Créneaux hebdomadaires récurrents (jour + HH:MM→HH:MM + libellé),
 *    visibles par les membres dans la fiche membre. API /api/chat/availability.
 */
function AvailabilitySection({ currentUserId }: { currentUserId: string }) {
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [day, setDay] = useState('1');
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('12:00');
  const [label, setLabel] = useState('');
  const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/availability?userId=${encodeURIComponent(currentUserId)}`, { credentials: 'include' });
      const data = await res.json().catch(() => []);
      setSlots(Array.isArray(data) ? data : (data?.slots || []));
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, [currentUserId]);

  useEffect(() => { load(); }, [load]);

  const addSlot = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/chat/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, dayOfWeek: Number(day), startTime: start, endTime: end, label: label.trim() || undefined }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.backendError?.message || `Erreur ${res.status}`);
      setAdding(false);
      setLabel('');
      load();
      toast.success('Créneau ajouté');
    } catch (e: any) {
      toast.error('Échec : ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeSlot = async (slotId: string) => {
    try {
      const res = await fetch(`/api/chat/availability/${encodeURIComponent(slotId)}?userId=${encodeURIComponent(currentUserId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || data?.backendError?.message || `Erreur ${res.status}`);
      }
      setSlots(prev => prev.filter(s => s.id !== slotId));
      toast.success('Créneau supprimé');
    } catch (e: any) {
      toast.error('Échec : ' + e.message);
    }
  };

  return (
    <div className="px-5 pb-5 pt-1">
      <p className="text-xs text-slate-500 mb-3 leading-relaxed">
        Publiez vos créneaux récurrents (permanences, heures de réception) — ils apparaissent
        dans votre fiche membre pour vos interlocuteurs.
      </p>
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-[#1677FF]" /></div>
      ) : slots.length === 0 && !adding ? (
        <div className="text-center py-3 text-xs text-slate-400">Aucun créneau publié</div>
      ) : (
        <div className="flex flex-col gap-1.5 mb-3">
          {slots.map((s) => (
            <div key={s.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <CalendarClock className="w-3.5 h-3.5 text-[#1677FF] flex-shrink-0" />
              <span className="text-xs font-semibold text-slate-700 w-16 flex-shrink-0">{s.dayLabel || DAYS[(s.dayOfWeek || 1) - 1]}</span>
              <span className="text-xs text-slate-600 tabular-nums">{s.startTime} – {s.endTime}</span>
              {s.label && <span className="text-[11px] text-slate-400 truncate">· {s.label}</span>}
              <button
                onClick={() => removeSlot(s.id)}
                className="ml-auto p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-500"
                title="Supprimer ce créneau"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {adding ? (
        <div className="flex flex-col gap-2 bg-blue-50/50 border border-blue-100 rounded-xl p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <select value={day} onChange={e => setDay(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
              {DAYS.map((d, i) => <option key={i} value={String(i + 1)}>{d}</option>)}
            </select>
            <input type="time" value={start} onChange={e => setStart(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white" />
            <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white" />
          </div>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Libellé (optionnel) — ex. Permanence pédagogique"
            maxLength={100}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="text-xs px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100">Annuler</button>
            <button
              onClick={addSlot}
              disabled={saving}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#1677FF] text-white font-semibold hover:bg-[#0958D9] disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Ajouter
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-[#1677FF] border border-dashed border-[#1677FF]/40 rounded-lg py-2 hover:bg-blue-50/50 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter un créneau
        </button>
      )}
    </div>
  );
}

/**
 * ⭐ V5 — SECTION 2FA TOTP (mon profil).
 *    Activation : setup (QR + secret) → saisie du code → codes de secours.
 *    Désactivation : code TOTP ou mot de passe. API /api/auth/2fa/*.
 */
function TwoFactorSection() {
  const [status, setStatus] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState<any | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disableMode, setDisableMode] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/status', { credentials: 'include' });
      if (res.ok) setStatus(await res.json());
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const startSetup = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Erreur ${res.status}`);
      setSetupData(data);
    } catch (e: any) {
      toast.error('Échec du setup : ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const enable = async () => {
    if (busy) return;
    const digits = code.replace(/\D/g, '');
    if (digits.length !== 6) {
      toast.error('Saisissez les 6 chiffres générés par votre application.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: digits }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Erreur ${res.status}`);
      setBackupCodes(data.backupCodes || []);
      setSetupData(null);
      setCode('');
      loadStatus();
      toast.success('Double authentification activée');
    } catch (e: any) {
      toast.error('Code invalide : ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (busy) return;
    if (!disableCode.trim() && !disablePassword) {
      toast.error('Saisissez votre code TOTP ou votre mot de passe pour désactiver.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: disableCode.trim() || undefined, password: disablePassword || undefined }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Erreur ${res.status}`);
      setDisableMode(false);
      setDisableCode('');
      setDisablePassword('');
      loadStatus();
      toast.success('Double authentification désactivée');
    } catch (e: any) {
      toast.error('Échec : ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-emerald-600" /></div>;
  }

  // ── Codes de secours affichés UNE SEULE FOIS après activation ──
  if (backupCodes) {
    return (
      <div className="px-5 pb-5 pt-1">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-bold text-amber-800">Codes de secours</span>
          </div>
          <p className="text-[11px] text-amber-700 leading-relaxed mb-3">
            Conservez ces 10 codes en lieu sûr — chaque code est à usage unique et permet
            de vous connecter si vous perdez votre appareil d'authentification.
            Ils ne seront plus jamais affichés.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {backupCodes.map((c) => (
              <code key={c} className="text-[11px] font-mono bg-white/70 border border-amber-200 rounded px-2 py-1 text-amber-900 text-center">{c}</code>
            ))}
          </div>
          <button
            onClick={() => { navigator.clipboard?.writeText(backupCodes.join('\n')).then(() => toast.success('Codes copiés'), () => {}); }}
            className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700"
          >
            Copier les codes
          </button>
          <button
            onClick={() => setBackupCodes(null)}
            className="mt-3 ml-2 text-xs px-3 py-1.5 rounded-lg text-amber-700 hover:bg-amber-100 font-semibold"
          >
            J'ai sauvegardé
          </button>
        </div>
      </div>
    );
  }

  // ── 2FA ACTIVE ──
  if (status?.enabled) {
    return (
      <div className="px-5 pb-5 pt-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Activée
          </span>
          {status.enabledAt && (
            <span className="text-[11px] text-slate-400">depuis le {new Date(status.enabledAt).toLocaleDateString('fr-FR')}</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Un code à 6 chiffres est exigé à chaque connexion.
          {typeof status.remainingBackupCodes === 'number' && (
            <> Codes de secours restants : <strong>{status.remainingBackupCodes}/10</strong>.</>
          )}
        </p>
        {disableMode ? (
          <div className="flex flex-col gap-2 bg-rose-50/60 border border-rose-100 rounded-xl p-3">
            <input
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              placeholder="Code TOTP actuel (optionnel)"
              inputMode="numeric"
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
            />
            <input
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder="… ou mot de passe"
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDisableMode(false)} className="text-xs px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100">Annuler</button>
              <button
                onClick={disable}
                disabled={busy}
                className="text-xs px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                Désactiver la 2FA
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setDisableMode(true)}
            className="text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"
          >
            Désactiver la double authentification
          </button>
        )}
      </div>
    );
  }

  // ── 2FA inactive : setup en cours ? ──
  if (setupData) {
    return (
      <div className="px-5 pb-5 pt-1 flex flex-col items-center">
        <p className="text-xs text-slate-500 mb-3 text-center leading-relaxed">
          1. Scannez ce QR avec votre application d'authentification
          (Google Authenticator, Aegis, Authy…)<br />
          2. Saisissez le code à 6 chiffres généré.
        </p>
        <img src={setupData.qrDataUrl} alt="QR code 2FA" className="w-48 h-48 border border-slate-200 rounded-xl mb-2" />
        <details className="w-full mb-3">
          <summary className="text-[11px] text-slate-400 cursor-pointer">Saisie manuelle du secret</summary>
          <code className="block mt-1 text-[10px] font-mono bg-slate-50 border border-slate-200 rounded px-2 py-1.5 break-all select-all">{setupData.secret}</code>
        </details>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => { if (e.key === 'Enter') enable(); }}
          placeholder="••••••"
          inputMode="numeric"
          className="w-32 text-center text-lg font-bold tracking-[0.3em] border-2 border-slate-200 rounded-xl py-2 outline-none focus:border-[#1677FF]"
        />
        <div className="flex gap-2 mt-3">
          <button onClick={() => setSetupData(null)} className="text-xs px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100">Annuler</button>
          <button
            onClick={enable}
            disabled={busy || code.replace(/\D/g, '').length !== 6}
            className="text-xs px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {busy && <Loader2 className="w-3 h-3 animate-spin" />}
            Activer
          </button>
        </div>
      </div>
    );
  }

  // ── 2FA inactive : proposition d'activation ──
  return (
    <div className="px-5 pb-5 pt-1">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1">
          <ShieldX className="w-3.5 h-3.5" /> Non activée
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-3 leading-relaxed">
        Sécurisez votre compte avec un code à 6 chiffres généré par une application
        d'authentification (TOTP). À chaque connexion, le code vous sera demandé en
        plus du mot de passe — même si celui-ci fuite, votre compte reste protégé.
      </p>
      <button
        onClick={startSetup}
        disabled={busy}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg py-2.5 hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
        Activer la double authentification
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
//  MODAL: Nouveau Canal (Telegram-style broadcast)
// ═════════════════════════════════════════════════════════════════

function NewChannelModal({
  currentUserId, onClose, onChannelCreated,
}: {
  currentUserId: string;
  onClose: () => void;
  onChannelCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Nom du canal requis'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/chat/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId: currentUserId, name: name.trim(), description: description.trim() || undefined }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Échec création canal');
      toast.success('Canal créé');
      onChannelCreated();
    } catch (e: any) {
      toast.error('Échec: ' + e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-blue-600" />
            Nouveau canal
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500">
            Un canal permet de diffuser des messages à tous les abonnés (broadcast unidirectionnel).
          </p>
          <input
            type="text"
            placeholder="Nom du canal *"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
          <textarea
            placeholder="Description (optionnel)"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
        <div className="p-4 border-t border-slate-100 flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-200">
            Annuler
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Créer le canal'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ⭐ V3-11: Discord-like section components (Fichiers / Vocaux / Appels / Modération / Analytics)
//   These replace the conversation list when the user clicks the corresponding
//   icon in the far-left rail. They use the Helm Connect Royal Blue + gold theme.
//   Each is a read-only view that lists data derived from the already-loaded
//   conversations (no extra API calls — they derive their data from what was
//   fetched for the Discussions section).
// ============================================================================

interface SectionSharedProps {
  conversations: ChatConversation[];
  currentUserId: string;
  onOpenConversation: (convId: string) => void;
}

function _getConvDisplay(conv: ChatConversation, currentUserId: string) {
  if (conv.type === 'GROUP') {
    return { name: conv.name || 'Groupe', subtitle: `${conv.participants.length} membres` };
  }
  const other = conv.participants.find(p => p.userId !== currentUserId);
  const name = other ? `${other.firstName || ''} ${other.lastName || ''}`.trim() || 'Utilisateur' : 'Utilisateur';
  return { name, subtitle: other?.role_label || '' };
}

// ─── 1. FICHIERS — shared files across conversations, with type filters ────
function FichiersSection({ currentUserId, onOpenConversation }: SectionSharedProps) {
  // ⭐ V4 Phase 2 — données RÉELLES : centre documentaire global (toutes
  //    conversations) via GET /chat/v2/files?type=document (FilesCenterService).
  // ⭐ V6 (spec §22) — onglets Documents | Liens | Épinglés : les endpoints
  //    transverses GET /chat/v2/links et GET /chat/v2/pinned viennent d'être
  //    ajoutés (backend complet, l'UI n'existait pas).
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [docTab, setDocTab] = useState<'documents' | 'liens' | 'epingles'>('documents');
  const [links, setLinks] = useState<any[]>([]);
  const [pinned, setPinned] = useState<any[]>([]);
  const [secondaryLoading, setSecondaryLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/chat/v2/files?type=document&limit=100', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setFiles(Array.isArray(data.files) ? data.files : []);
            setStats(data.stats);
          }
        }
      } catch { /* silencieux */ } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // ⭐ V6 — charger Liens/Épinglés au premier passage sur l'onglet
  useEffect(() => {
    if (docTab === 'documents') return;
    if (docTab === 'liens' && links.length > 0) return;
    if (docTab === 'epingles' && pinned.length > 0) return;
    let cancelled = false;
    setSecondaryLoading(true);
    (async () => {
      try {
        const endpoint = docTab === 'liens'
          ? '/api/chat/v2/links?limit=100'
          : '/api/chat/v2/pinned?limit=100';
        const res = await fetch(endpoint, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            const list = Array.isArray(data) ? data : [];
            if (docTab === 'liens') setLinks(list); else setPinned(list);
          }
        }
      } catch { /* silencieux */ } finally { if (!cancelled) setSecondaryLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [docTab, links.length, pinned.length]);

  const fileMeta = (mime: string | null, name: string | null): { label: string; color: string } => {
    const m = (mime || name || '').toLowerCase();
    if (m.includes('pdf')) return { label: 'PDF', color: 'bg-red-500' };
    if (m.includes('doc')) return { label: 'DOC', color: 'bg-blue-600' };
    if (m.includes('xls') || m.includes('csv')) return { label: 'XLS', color: 'bg-emerald-600' };
    if (m.includes('ppt')) return { label: 'PPT', color: 'bg-orange-500' };
    if (m.includes('zip') || m.includes('rar') || m.includes('7z')) return { label: 'ZIP', color: 'bg-amber-600' };
    return { label: 'FICHIER', color: 'bg-slate-500' };
  };

  const absUrl = (u: string) => u.startsWith('http') ? u : `${getBackendBaseUrl()}${u.startsWith('/') ? u : '/' + u}`;

  return (
    <div className="p-3">
      <div className="flex items-center gap-1.5 px-1 py-1 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        <FileText className="w-3 h-3" /> Centre documentaire {stats ? `(${stats.documents || 0})` : ''}
      </div>
      {/* ⭐ V6 (spec §22) — onglets Documents / Liens / Épinglés */}
      <div className="flex gap-1 mb-2 px-1">
        {([
          { id: 'documents', label: 'Documents', icon: <FileText className="w-3 h-3" /> },
          { id: 'liens', label: 'Liens', icon: <Link2 className="w-3 h-3" /> },
          { id: 'epingles', label: 'Épinglés', icon: <Pin className="w-3 h-3" /> },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setDocTab(tab.id)}
            className={cn('px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition',
              docTab === tab.id ? 'bg-[#E6F4FF] text-[#0958D9]' : 'text-slate-500 hover:bg-slate-100')}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>
      {docTab === 'liens' ? (
        // ⭐ V6 — LIENS partagés (URLs extraites des messages, toutes conversations)
        secondaryLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : links.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Link2 className="w-12 h-12 text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-700">Aucun lien partagé</p>
            <p className="text-xs text-slate-500 mt-1">Les liens envoyés dans les conversations apparaîtront ici.</p>
          </div>
        ) : (
          links.map(l => (
            <button
              key={l.id}
              onClick={() => onOpenConversation(l.conversationId)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 border-b border-slate-50 transition"
            >
              <div className="w-9 h-9 rounded-lg bg-[#E6F4FF] text-[#0958D9] flex items-center justify-center flex-shrink-0">
                <Link2 className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">{l.url}</div>
                <div className="text-xs text-slate-500 truncate">
                  {l.convName || 'Conversation'} · {l.senderName} · {l.createdAt ? formatTime(l.createdAt) : ''}
                </div>
                {l.context && l.context !== l.url && (
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">{l.context}</div>
                )}
              </div>
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0 hover:bg-slate-200"
                title="Ouvrir le lien"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </button>
          ))
        )
      ) : docTab === 'epingles' ? (
        // ⭐ V6 — MESSAGES ÉPINGLÉS (toutes conversations)
        secondaryLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : pinned.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Pin className="w-12 h-12 text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-700">Aucun message épinglé</p>
            <p className="text-xs text-slate-500 mt-1">Épinglez un message pour le retrouver ici.</p>
          </div>
        ) : (
          pinned.map(p => (
            <button
              key={p.id}
              onClick={() => onOpenConversation(p.conversationId)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 border-b border-slate-50 transition"
            >
              <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <Pin className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800 line-clamp-2">
                  {p.content || p.attachmentName || 'Message épinglé'}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {p.convName || 'Conversation'} · {p.senderName} · {p.pinnedAt ? formatTime(p.pinnedAt) : ''}
                </div>
              </div>
            </button>
          ))
        )
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <FileText className="w-12 h-12 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-700">Aucun document partagé</p>
          <p className="text-xs text-slate-500 mt-1">Les documents des conversations apparaîtront ici.</p>
        </div>
      ) : (
        files.map(f => {
          const meta = fileMeta(f.mime, f.name);
          return (
            <button
              key={f.id}
              onClick={() => onOpenConversation(f.conversationId)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 border-b border-slate-50 transition"
            >
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0', meta.color)}>
                {meta.label}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">{f.name || 'Document'}</div>
                <div className="text-xs text-slate-500 truncate">
                  {f.convName || 'Conversation'} · {f.senderName} · {f.createdAt ? formatTime(f.createdAt) : ''}
                </div>
              </div>
              <a
                href={absUrl(f.url)}
                download={f.name || undefined}
                onClick={(e) => e.stopPropagation()}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0 hover:bg-slate-200"
                title="Télécharger"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </button>
          );
        })
      )}
    </div>
  );
}

function AnnoncesSection({ currentUserId, annonces, loading, onNew }: {
  currentUserId: string;
  annonces: any[];
  loading: boolean;
  onNew: () => void;
}) {
  return (
    <div className="p-3">
      <div className="flex items-center gap-1.5 px-1 py-1 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        <Bell className="w-3 h-3" /> Annonces officielles ({annonces.length})
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : annonces.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <Bell className="w-12 h-12 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-700">Aucune annonce pour le moment</p>
          <p className="text-xs text-slate-500 mt-1 mb-3">Publiez une annonce officielle à destination de toute l'école.</p>
          <button
            onClick={onNew}
            className="px-3 py-1.5 bg-[#F59E0B] text-white text-xs font-semibold rounded-lg hover:bg-[#D97706] flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Nouvelle annonce
          </button>
        </div>
      ) : (
        <>
          {annonces.map(a => {
            const priority = a.priority || 'NORMAL';
            const isUrgent = priority === 'URGENT';
            const isHigh = priority === 'HIGH';
            const color = isUrgent ? 'bg-red-100 text-red-700 border-red-200' : isHigh ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200';
            return (
              <div key={a.id} className={cn('p-3 rounded-lg border mb-2', color)}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider',
                        isUrgent ? 'bg-red-600 text-white' : isHigh ? 'bg-amber-500 text-white' : 'bg-slate-400 text-white'
                      )}>
                        {priority}
                      </span>
                      <span className="text-sm font-bold text-slate-900 truncate">{a.title}</span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2">{a.body || a.preview || ''}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                      <span>de {a.authorName || a.author || 'Administration'}</span>
                      {a.publishedAt && <span>• {formatTime(a.publishedAt)}</span>}
                      {a.requiresConfirmation && (
                        <span className="text-amber-600 font-semibold">• confirmation requise</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {/* New announcement button at the bottom of the list */}
          <button
            onClick={onNew}
            className="w-full mt-3 py-2 bg-[#F59E0B] text-white text-xs font-semibold rounded-lg hover:bg-[#D97706] flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Nouvelle annonce
          </button>
        </>
      )}
    </div>
  );
}

// ─── 2. VOCAUX — audio messages ────────────────────────────────────────────
function VocauxSection({
  currentUserId, onOpenConversation,
  voiceChannels, activeVoiceChannel, onJoinVoice, onLeaveVoice,
  channelDirects = {}, onStartLive, canStartLive,
}: SectionSharedProps & {
  voiceChannels: any[];
  activeVoiceChannel: string | null;
  onJoinVoice: (channelId: string) => void;
  onLeaveVoice: () => void;
  /** ⭐ V6 — directs en cours par canal (Go Live, parité Yeshua). */
  channelDirects?: Record<string, { by: string; streamId: string; hostId: string; startedAt?: string }>;
  onStartLive?: (channelId: string) => void;
  canStartLive?: string;
}) {
  // ⭐ V4 — CANAUX VOCAUX Discord-style (porté de Yeshua) : rejoignables en un
  //    clic, micro + locuteurs actifs + participants via la chaîne média.
  //    Avant le V4, la liste des canaux n'était même pas affichée (le
  //    loadVoiceChannels n'était jamais appelé). + messages vocaux réels
  //    (GET /chat/v2/files?type=audio).
  const [audioFiles, setAudioFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // ⭐ V6 — lecteur audio FONCTIONNEL des messages vocaux (le bouton Lecture
  //    ne faisait rien — e.stopPropagation() seul). Un élément <audio> unique
  //    réutilisé : lecture/pause, retour à l'icône Lecture à la fin.
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const togglePlayAudio = (id: string, url: string) => {
    if (playingId === id) {
      audioElRef.current?.pause();
      setPlayingId(null);
      return;
    }
    try {
      if (!audioElRef.current) audioElRef.current = new Audio();
      const el = audioElRef.current;
      el.src = url;
      el.onended = () => setPlayingId(null);
      el.onerror = () => { setPlayingId(null); toast.error('Lecture du vocal impossible'); };
      el.play().catch(() => setPlayingId(null));
      setPlayingId(id);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/chat/v2/files?type=audio&limit=50', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setAudioFiles(Array.isArray(data.files) ? data.files : []);
        }
      } catch { /* silencieux */ } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="p-3">
      {/* Canaux vocaux */}
      <div className="flex items-center gap-1.5 px-1 py-1 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        <Volume2 className="w-3 h-3" /> Canaux vocaux ({voiceChannels.length})
      </div>
      {voiceChannels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center px-4 mb-3">
          <Volume2 className="w-8 h-8 text-slate-300 mb-1" />
          <p className="text-xs font-medium text-slate-700">Aucun canal vocal</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Créez un canal vocal pour parler en direct avec votre équipe.</p>
        </div>
      ) : (
        voiceChannels.map(vc => {
          const joined = activeVoiceChannel === vc.id;
          const isStage = vc.type === 'STAGE';
          const direct = channelDirects[vc.id];
          return (
            <div key={vc.id} className={cn(
              'flex items-center gap-2.5 p-2.5 rounded-xl mb-1 transition-colors border',
              joined ? 'bg-[#E6F4FF] border-[#3B9EFF]/30' : direct ? 'bg-emerald-50/60 border-emerald-200' : 'border-transparent hover:bg-slate-50',
            )}>
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                joined ? 'bg-[#FFE08A]' : direct ? 'bg-emerald-500' : isStage ? 'bg-purple-100' : 'bg-gradient-to-br from-[#CFA63A] to-[#FFE08A]',
              )}>
                <Radio className={cn('w-4 h-4', joined ? 'text-[#0A2A5E]' : 'text-white')} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate flex items-center gap-1.5">
                  {vc.name || 'Canal'}
                  {isStage && <span className="text-[8px] px-1 rounded bg-purple-100 text-purple-700 font-bold uppercase">Scène</span>}
                  {/* ⭐ V6 — badge DIRECT EN COURS (parité Yeshua : pastille verte) */}
                  {direct && (
                    <span className="relative flex items-center gap-1 text-[8px] px-1.5 py-px rounded bg-emerald-500 text-white font-bold uppercase flex-shrink-0">
                      <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                      Live
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500">
                  {direct
                    ? `${direct.by} diffuse en direct`
                    : `${vc.activeUsers || 0} connecté${(vc.activeUsers || 0) > 1 ? 's' : ''}`}
                  {vc.videoMode ? ' · vidéo' : ''}
                </div>
              </div>
              {/* ⭐ V6 — Rejoindre le direct / Lancer un direct */}
              {direct ? (
                joined ? (
                  <button
                    onClick={onLeaveVoice}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-red-50 text-red-600 hover:bg-red-100 flex-shrink-0"
                  >
                    Quitter
                  </button>
                ) : (
                  <button
                    onClick={() => onJoinVoice(vc.id)}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-500 text-white hover:bg-emerald-600 flex-shrink-0"
                    title={`Rejoindre le direct de ${direct.by}`}
                  >
                    Rejoindre
                  </button>
                )
              ) : joined ? (
                <button
                  onClick={onLeaveVoice}
                  className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-red-50 text-red-600 hover:bg-red-100 flex-shrink-0"
                >
                  Quitter
                </button>
              ) : (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {onStartLive && vc.createdBy === canStartLive && (
                    <button
                      onClick={() => onStartLive(vc.id)}
                      className="px-2 py-1 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100"
                      title="Lancer un direct dans ce canal"
                    >
                      Direct
                    </button>
                  )}
                  <button
                    onClick={() => onJoinVoice(vc.id)}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-full bg-[#E6F4FF] text-[#1677FF] hover:bg-[#D0E8FF] flex-shrink-0"
                  >
                    Rejoindre
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Messages vocaux */}
      <div className="flex items-center gap-1.5 px-1 py-1 mt-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        <Mic className="w-3 h-3" /> Messages vocaux ({audioFiles.length})
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : audioFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center px-4">
          <Mic className="w-10 h-10 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-700">Aucun message vocal</p>
          <p className="text-xs text-slate-500 mt-1">Les messages vocaux échangés apparaîtront ici, avec transcription Whisper.</p>
        </div>
      ) : (
        audioFiles.map(f => {
          const abs = f.url?.startsWith('http') ? f.url : `${getBackendBaseUrl()}${f.url?.startsWith('/') ? f.url : '/' + f.url}`;
          return (
            <button
              key={f.id}
              onClick={() => onOpenConversation(f.conversationId)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 border-b border-slate-50 transition"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#CFA63A] to-[#FFE08A] flex items-center justify-center text-white flex-shrink-0">
                <Mic className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">{f.convName || 'Conversation'}</div>
                <div className="text-xs text-slate-500 truncate">{f.senderName} · {f.createdAt ? formatTime(f.createdAt) : ''}</div>
              </div>
              <span
                onClick={(e) => { e.stopPropagation(); togglePlayAudio(f.id, abs); }}
                className={cn('w-8 h-8 rounded-full text-white flex items-center justify-center flex-shrink-0',
                  playingId === f.id ? 'bg-[#0958D9] animate-pulse' : 'bg-[#1677FF]')}
                title={playingId === f.id ? 'Pause' : 'Écouter'}
              >
                {playingId === f.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}

// ─── 3. APPELS — call history ─────────────────────────────────────────────
function AppelsSection({ currentUserId, onOpenConversation, onCallBack }: SectionSharedProps & { onCallBack?: (conversationId: string, callType: 'AUDIO' | 'VIDEO') => void }) {
  // ⭐ V4 Phase 2 — historique d'appels RÉEL (journaux CALL_LOG + chat_call_history,
  //    toutes conversations) via GET /chat/v2/call-history.
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/chat/v2/call-history?limit=60', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setCalls(Array.isArray(data) ? data : []);
        }
      } catch { /* silencieux */ } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const statusMeta = (call: any): { label: string; icon: any; color: string } => {
    const status = call.callMeta?.status || call.status || '';
    switch (String(status).toLowerCase()) {
      case 'missed': return { label: 'Appel manqué', icon: PhoneMissed, color: 'text-red-500' };
      case 'declined': case 'rejected': return { label: 'Appel refusé', icon: PhoneOff, color: 'text-amber-500' };
      case 'cancelled': return { label: 'Appel annulé', icon: PhoneOff, color: 'text-slate-400' };
      case 'ended': case 'completed': return { label: 'Appel terminé', icon: Phone, color: 'text-emerald-500' };
      default: return { label: 'Appel', icon: Phone, color: 'text-slate-400' };
    }
  };

  const formatCallDuration = (sec?: number | null): string => {
    if (!sec || sec <= 0) return '';
    if (sec < 60) return `${sec} s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m < 60) return s > 0 ? `${m} min ${s} s` : `${m} min`;
    const h = Math.floor(m / 60);
    return `${h} h ${m % 60} min`;
  };

  return (
    <div className="p-3">
      <div className="flex items-center gap-1.5 px-1 py-1 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        <Phone className="w-3 h-3" /> Historique d'appels ({calls.length})
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : calls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <Phone className="w-12 h-12 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-700">Aucun appel</p>
          <p className="text-xs text-slate-500 mt-1">Votre historique d'appels audio et vidéo apparaîtra ici.</p>
        </div>
      ) : (
        calls.map(call => {
          const isVideo = (call.callMeta?.callType === 'video') || call.callType === 'VIDEO';
          const meta = statusMeta(call);
          const durationSec = call.callMeta?.durationSec ?? call.duration;
          const title = (call.initiatorName || '').trim() || 'Membre';
          return (
            <div
              key={call.id}
              className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 border-b border-slate-50 transition"
            >
              <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0', getAvatarColor(title))}>
                {getInitials(title)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">{title}</div>
                <div className="text-xs text-slate-500 truncate flex items-center gap-1.5">
                  <meta.icon className={cn('w-3 h-3', meta.color)} />
                  <span>
                    {isVideo ? 'Vidéo' : 'Audio'} · {meta.label}
                    {durationSec ? ` · ${formatCallDuration(durationSec)}` : ''}
                  </span>
                  <span className="text-slate-400">· {call.createdAt ? formatTime(call.createdAt) : call.startedAt ? formatTime(call.startedAt) : ''}</span>
                </div>
              </div>
              {onCallBack && (
                <button
                  onClick={() => onCallBack(call.conversationId, isVideo ? 'VIDEO' : 'AUDIO')}
                  className="w-8 h-8 rounded-full bg-[#1677FF] text-white flex items-center justify-center flex-shrink-0"
                  title="Rappeler"
                >
                  <Phone className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── 4. MODÉRATION — flagged content ──────────────────────────────────────
function ModerationSection({ currentUserId, onOpenConversation, onResolveReport }: SectionSharedProps & { onResolveReport?: (reportId: string) => void }) {
  // ⭐ V4 Phase 2 — signalements RÉELS (GET /chat/reports — modération :
  //    messages signalés avec motif + statut de résolution).
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/chat/reports', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setReports(Array.isArray(data) ? data : (data?.reports || []));
        }
      } catch { /* silencieux */ } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="p-3">
      <div className="flex items-center gap-1.5 px-1 py-1 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        <Flag className="w-3 h-3" /> Signalements ({reports.length})
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <Flag className="w-12 h-12 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-700">Aucun contenu signalé</p>
          <p className="text-xs text-slate-500 mt-1">Les messages signalés par les utilisateurs apparaîtront ici.</p>
        </div>
      ) : (
        reports.map(r => {
          const reporter = `${r.reporterFirstName || ''} ${r.reporterLastName || ''}`.trim() || 'Membre';
          return (
            <div
              key={r.id}
              className="w-full p-3 border-b border-slate-50 hover:bg-slate-50 transition"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <Flag className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    Signalé par {reporter}
                    {r.resolvedAt && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold uppercase">Résolu</span>}
                  </div>
                  {r.reason && <div className="text-xs text-slate-600 italic truncate mt-0.5">« {r.reason} »</div>}
                  {r.messagePreview && <div className="text-[11px] text-slate-500 truncate mt-0.5">{r.messagePreview}</div>}
                </div>
                {!r.resolvedAt && onResolveReport && (
                  <button
                    onClick={() => onResolveReport(r.id)}
                    className="px-2 py-1 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex-shrink-0"
                  >
                    Résoudre
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── 5. ANALYTICS — KPI dashboard ──────────────────────────────────────────
function AnalyticsSection({ currentUserId }: { conversations?: ChatConversation[]; currentUserId: string }) {
  // ⭐ V4 Phase 2 — KPIs RÉELS via GET /chat/v2/analytics (l'endpoint existait,
  //    l'UI affichait des compteurs locaux). Vue d'ensemble de la communication
  //    de l'établissement + carte d'administration e-mail (journaux, envois
  //    programmés, templates).
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/chat/v2/analytics', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setStats(data);
        }
      } catch { /* silencieux */ } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const kpis: Array<{ label: string; value: string | number; icon: any; tone: string }> = stats ? [
    { label: 'Conversations', value: stats.totalConversations ?? '—', icon: MessageSquare, tone: 'helm' },
    { label: 'Messages échangés', value: stats.totalMessages ?? '—', icon: MessageSquare, tone: 'light' },
    { label: 'Groupes actifs', value: stats.totalGroups ?? stats.groupConversations ?? '—', icon: Users, tone: 'light' },
    { label: 'Messages non lus', value: stats.totalUnread ?? '—', icon: Bell, tone: 'warn' },
    { label: 'Annonces publiées', value: stats.totalAnnouncements ?? '—', icon: Megaphone, tone: 'helm' },
    { label: 'Fichiers partagés', value: stats.totalFiles ?? stats.totalAttachments ?? '—', icon: FileText, tone: 'light' },
    { label: 'Utilisateurs actifs', value: stats.activeUsers ?? '—', icon: UserIcon, tone: 'light' },
    { label: 'Appels', value: stats.totalCalls ?? '—', icon: Phone, tone: 'helm' },
  ] : [];

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-1.5 px-1 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        <BarChart3 className="w-3 h-3" /> Tableau de bord de la communication
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {kpis.map((kpi) => (
              <div key={kpi.label} className={cn(
                'p-3 rounded-lg',
                kpi.tone === 'helm' ? 'bg-gradient-to-br from-[#0A2A5E] to-[#1C6FE8] text-white' : 'bg-white border border-slate-200',
              )}>
                <div className="flex items-center gap-2 mb-1">
                  <kpi.icon className={cn('w-4 h-4', kpi.tone === 'helm' ? 'text-[#FFE08A]' : 'text-slate-400')} />
                  <span className={cn('text-[10px] font-bold uppercase tracking-wider', kpi.tone === 'helm' ? 'text-[#FFE08A]' : 'text-slate-500')}>{kpi.label}</span>
                </div>
                <div className={cn('text-2xl font-bold', kpi.tone === 'helm' ? 'text-white' : 'text-slate-900')}>{kpi.value}</div>
              </div>
            ))}
          </div>
          {/* ⭐ V4 Phase 4 — Point d'entrée « Administration e-mail » : les
              pages réelles (journaux d'emails, envois programmés, templates)
              n'avaient AUCUN accès UI. */}
          <div className="p-3 rounded-lg bg-white border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Megaphone className="w-4 h-4 text-[#1677FF]" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Administration e-mail</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <a href="/app/communication/dashboard" className="px-2 py-1.5 text-[11px] font-medium text-[#1677FF] hover:bg-[#E6F4FF] rounded-lg flex items-center gap-1.5">
                <BarChart3 className="w-3 h-3" /> Tableau de bord
              </a>
              <a href="/app/communication/history" className="px-2 py-1.5 text-[11px] font-medium text-[#1677FF] hover:bg-[#E6F4FF] rounded-lg flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Historique
              </a>
              <a href="/app/communication/scheduled-emails" className="px-2 py-1.5 text-[11px] font-medium text-[#1677FF] hover:bg-[#E6F4FF] rounded-lg flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Envois programmés
              </a>
              <a href="/app/communication/templates" className="px-2 py-1.5 text-[11px] font-medium text-[#1677FF] hover:bg-[#E6F4FF] rounded-lg flex items-center gap-1.5">
                <FileText className="w-3 h-3" /> Modèles
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

