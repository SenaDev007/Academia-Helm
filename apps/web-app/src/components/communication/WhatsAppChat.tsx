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
  ChevronUp, Monitor, Smile,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useChatSocket } from '@/lib/chat/useChatSocket';
import { generateKeyPair, hasPrivateKey, encryptMessage, decryptMessage } from '@/lib/chat/crypto';
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
  type: 'TEXT' | 'AUDIO' | 'DOCUMENT' | 'IMAGE';
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

function formatDateSeparator(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
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
  //    Discord-style: gray background, monospace, preserved whitespace, optional language label.
  if (hasCodeBlock) {
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
      const langLabel = lang ? `<span style="font-size:0.7em;color:#94a3b8;display:block;margin-bottom:4px;">${lang}</span>` : '';
      const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
      return `<pre style="background-color:#0f172a;color:#f1f5f9;border-radius:6px;padding:10px 12px;margin:6px 0;overflow-x:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:0.85em;line-height:1.5;">${langLabel}<code>${escapedCode}</code></pre>`;
    });
  }

  // Split into HTML tags and text content
  const parts = html.split(/(<[^>]+>)/);
  return parts.map(part => {
    // Skip HTML tags (start with <) — but allow <pre><code> blocks we just inserted
    if (part.startsWith('<pre')) return part;
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
    return { name: conv.name || 'Groupe sans nom', subtitle: `${conv.participants.length} membres` };
  }
  // DIRECT: l'autre participant
  const other = conv.participants.find(p => p.userId !== currentUserId);
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
  const [showNewChannel, setShowNewChannel] = useState(false);
  // ⭐ Helm Connect — Annonces officielles V1
  const [showAnnouncements, setShowAnnouncements] = useState(false);
  // ⭐ Helm Connect V2.3 — Notification Preferences
  const [showNotifPrefs, setShowNotifPrefs] = useState(false);
  // ⭐ DISCORD PARITY: Member list sidebar (right panel for GROUP conversations)
  const [showMemberList, setShowMemberList] = useState(false);
  const [conversationMembers, setConversationMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  // ⭐ DISCORD PARITY: Audit log modal
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  // ⭐ DISCORD PARITY: Slow mode modal
  const [showSlowModeModal, setShowSlowModeModal] = useState(false);
  const [slowModeSeconds, setSlowModeSeconds] = useState(0);
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
  const ringtoneRef = useRef<{ ctx: AudioContext; interval: any } | null>(null);

  // ⭐ FIX: Ringtone — softer volume + different patterns for outgoing vs incoming
  //    Outgoing (caller): single soft "calling" tone every 2s (gentle beep)
  //    Incoming (callee): classic double-ring pattern every 3s (ring ring... ring ring)
  const playRingtone = useCallback((mode: 'outgoing' | 'incoming' = 'outgoing') => {
    if (ringtoneRef.current) return; // Already playing
    try {
      const ctx = new AudioContext();
      const playTone = (freq: number, startTime: number, duration: number, volume: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        // Soft sine wave with gentle attack/release for a warm, professional tone
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
        gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + startTime + 0.04);
        gain.gain.linearRampToValueAtTime(volume * 0.7, ctx.currentTime + startTime + duration * 0.6);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
      };

      let intervalMs: number;
      if (mode === 'incoming') {
        // Incoming: classic phone ring — two short rings, then pause (3s loop)
        // Uses a pleasant middle-C + G chord (softer than the old 440/550Hz)
        intervalMs = 3000;
        const interval = setInterval(() => {
          // First ring (0.4s)
          playTone(523.25, 0, 0.4, 0.06);    // C5
          playTone(659.25, 0, 0.4, 0.04);    // E5 (chord)
          // Second ring (0.4s, starting at 0.6s)
          playTone(523.25, 0.6, 0.4, 0.06);
          playTone(659.25, 0.6, 0.4, 0.04);
        }, intervalMs);
        ringtoneRef.current = { ctx, interval };
      } else {
        // Outgoing: gentle single beep every 2s ("calling... calling...")
        // Lower pitch, very soft — doesn't assault the ears like the old 440Hz
        intervalMs = 2000;
        const interval = setInterval(() => {
          playTone(392.00, 0, 0.5, 0.05);    // G4 — soft, warm tone
        }, intervalMs);
        ringtoneRef.current = { ctx, interval };
      }
      // Play the first tone immediately (don't wait for the first interval)
      if (mode === 'incoming') {
        playTone(523.25, 0, 0.4, 0.06);
        playTone(659.25, 0, 0.4, 0.04);
        playTone(523.25, 0.6, 0.4, 0.06);
        playTone(659.25, 0.6, 0.4, 0.04);
      } else {
        playTone(392.00, 0, 0.5, 0.05);
      }
    } catch (e) {
      console.warn('Ringtone playback failed:', e);
    }
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneRef.current) {
      clearInterval(ringtoneRef.current.interval);
      try { ringtoneRef.current.ctx.close(); } catch {}
      ringtoneRef.current = null;
    }
  }, []);

  // ⭐ FIX: Play/stop ringtone based on call state — different sounds for caller vs callee
  useEffect(() => {
    if (callState === 'outgoing') {
      playRingtone('outgoing');
    } else if (callState === 'incoming') {
      playRingtone('incoming');
    } else {
      stopRingtone();
    }
    return () => stopRingtone();
  }, [callState, playRingtone, stopRingtone]);

  // ⭐ V2.5: Cleanup call resources
  const cleanupCall = useCallback(() => {
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

  // ⭐ CANAUX (Telegram-style broadcast channels)
  const [channels, setChannels] = useState<any[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [channelMessages, setChannelMessages] = useState<any[]>([]);

  // ⭐ V3-11: Annonces (official announcements list — fetched lazily when the
  //   user switches to the Annonces section, kept in state to avoid refetching)
  const [annonces, setAnnonces] = useState<any[]>([]);
  const [annoncesLoading, setAnnoncesLoading] = useState(false);
  const [annoncesLoaded, setAnnoncesLoaded] = useState(false);

  // ⭐ V3-11: Communautés auto-group sync state
  const [communautesSyncing, setCommunautesSyncing] = useState(false);
  const [communautesSyncMessage, setCommunautesSyncMessage] = useState<string | null>(null);

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
      // Also refresh conversation list (for lastMessage preview + unread count)
      loadConversations();
      // ⭐ DISCORD PARITY: Notification sound on new message.
      //    Plays a short beep using the Web Audio API (no external file needed).
      //    Only plays if the message is NOT from the current user (don't beep
      //    for our own messages) and the conversation is not the active one
      //    (to avoid beeping for messages the user is already reading).
      try {
        if (data?.message?.senderId && data.message.senderId !== currentUserId) {
          // Only beep for messages in OTHER conversations (not the one currently open)
          if (data?.conversationId !== activeConvId) {
            playNotificationSound();
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
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
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
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw-chat.js').catch(() => {});
    }
  }, []);

  // ⭐ Load channels
  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/channels?userId=${currentUserId}`, { credentials: 'include' });
      if (res.ok) setChannels(await res.json());
    } catch {}
  }, [currentUserId]);

  useEffect(() => { loadChannels(); }, [loadChannels]);

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
      toast.success('Photo de profil mise à jour');
    } catch (e: any) {
      toast.error('Échec upload: ' + e.message);
    }
  }, [currentUserId]);

  const activeConv = useMemo(
    () => conversations.find(c => c.id === activeConvId) || null,
    [conversations, activeConvId]
  );

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
      const uploadRes = await fetch(`https://api.academiahelm.com/api/chat/conversations/${activeConvId}/messages/attachment`, {
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

  // ⭐ DISCORD PARITY: Join a voice channel.
  //    Requests a LiveKit token from the backend. If LiveKit is configured,
  //    dynamically imports `livekit-client` and connects to the SFU room.
  //    If LiveKit is NOT configured (fallbackToMesh: true), falls back to
  //    the existing mesh WebRTC approach (≤5 participants).
  const joinVoiceChannel = useCallback(async (channelId: string) => {
    try {
      // 1. Request a LiveKit access token from the backend
      const tokenRes = await fetch(`/api/chat/voice-channels/${channelId}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
        credentials: 'include',
      });
      if (!tokenRes.ok) throw new Error('Token request failed');
      const tokenData = await tokenRes.json();

      // 2. Join the voice channel via the REST endpoint (records voice state)
      const joinRes = await fetch(`/api/chat/voice-channels/${channelId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, socketId: socket?.emit ? 'connected' : undefined }),
        credentials: 'include',
      });
      if (!joinRes.ok) throw new Error('Join failed');
      const joinData = await joinRes.json();
      setActiveVoiceChannel(channelId);
      setVoiceChannelUsers(joinData.activeUsers || []);

      // 3. Connect to LiveKit if configured, otherwise fall back to mesh
      if (tokenData.configured && tokenData.token) {
        try {
          // Dynamic import — avoids bundling livekit-client if not installed.
          // If the package is missing, this throws and we fall back to mesh.
          const { Room, Track } = await import('livekit-client');
          const room = new Room({ adaptiveStream: true, dynacast: true });
          await room.connect(tokenData.url, tokenData.token);

          // Publish microphone audio
          try {
            await room.localParticipant.setMicrophoneEnabled(true);
          } catch (micErr: any) {
            console.warn('Microphone publish failed:', micErr);
          }

          // Store the room reference for cleanup on leave
          (window as any)._livekitRoom = room;

          // Listen for participant events to update the UI
          room.on('participant-connected', () => {
            setVoiceChannelUsers(prev => [...prev]); // trigger re-render
          });
          room.on('participant-disconnected', () => {
            setVoiceChannelUsers(prev => [...prev]);
          });

          toast.success(`Rejoint le canal vocal : ${joinData.channel?.name || 'Voix'} (LiveKit SFU)`);
        } catch (livekitErr: any) {
          console.warn('LiveKit client not available, falling back to mesh:', livekitErr);
          toast.info(`Rejoint le canal vocal : ${joinData.channel?.name || 'Voix'} (mesh WebRTC)`);
        }
      } else {
        toast.info(`Rejoint le canal vocal : ${joinData.channel?.name || 'Voix'} (mesh WebRTC)`);
      }
    } catch (e: any) {
      toast.error("Échec de l'audio : " + e.message);
    }
  }, [currentUserId, socket]);

  // ⭐ DISCORD PARITY: Leave the active voice channel.
  //    Disconnects the LiveKit room (if connected) and calls the REST leave endpoint.
  const leaveVoiceChannel = useCallback(async () => {
    if (!activeVoiceChannel) return;
    // Disconnect LiveKit room
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
    setActiveVoiceChannel(null);
    setVoiceChannelUsers([]);
  }, [activeVoiceChannel, currentUserId]);

  // ───────────────────────────────────────────────────────────────────
  // Load messages for active conversation
  // ───────────────────────────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    if (!activeConvId) return;

    // ⭐ PAGINATION: reset hasMore on every fresh load (switching conv or refresh)
    setHasMoreMessages(true);

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
      setMessages(unique);
      // ⭐ PAGINATION: if backend returned fewer than 100 messages,
      //    we've reached the beginning of the conversation history.
      setHasMoreMessages(unique.length >= 100);

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

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (activeConvId) {
      setLoadingMsgs(true);
      loadMessages();
    }
  }, [activeConvId, loadMessages]);

  // ⭐ Polling : rafraîchir les messages toutes les 5s
  useEffect(() => {
    if (!activeConvId) return;
    const interval = setInterval(() => {
      loadMessages();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeConvId, loadMessages]);

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
            const res = await fetch(
              `/api/chat/conversations/${p.conversationId}/messages/text`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  senderId: p.senderId,
                  content: p.content,
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

  // ⭐ TYPING POLLING : check who is typing in the active conversation every 3s
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
    const interval = setInterval(checkTyping, 3000);
    return () => clearInterval(interval);
  }, [activeConvId, currentUserId]);

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
      socket.startTyping(activeConvId); // Reuse typing channel — shows "typing" to others
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

  // ⭐ V3-11: Smart scroll-to-bottom — uses container.scrollTop directly
  //    (NOT scrollIntoView, which scrolls ALL scrollable ancestors including the
  //    page itself — causing the chat to get stuck at the top of the viewport on
  //    teacher/parent pages where the page is taller than the viewport).
  //    Only auto-scrolls if the user is near the bottom OR on first load.
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const userIsNearBottomRef = useRef(true); // true if user is within 200px of bottom
  const isFirstLoadRef = useRef(true);
  // Track previous messages length to detect new message arrivals
  const prevMessagesLengthRef = useRef(0);
  // Track the last scrollHeight we scrolled to — used by the ResizeObserver to
  // detect when new content (images loading, new messages) increases the
  // scrollHeight, so we can re-scroll to the bottom.
  const lastScrolledHeightRef = useRef(0);
  // If the user has manually scrolled up (away from bottom), we stop auto-
  // scrolling until they scroll back near the bottom.
  const userScrolledAwayRef = useRef(false);

  // Reset scroll-following when switching conversations
  useEffect(() => {
    isFirstLoadRef.current = true;
    userIsNearBottomRef.current = true;
    prevMessagesLengthRef.current = 0;
    lastScrolledHeightRef.current = 0;
    userScrolledAwayRef.current = false;
    // ⭐ Reset mention popover when switching conversations
    setMentionQuery(null);
    setMentionStartPos(-1);
  }, [activeConvId]);

  // ⭐ V3-11: Scroll the messages container to the bottom (NOT the page).
  //   Polls for the container up to 500ms in case the ref isn't attached yet
  //   (the messages div is conditionally rendered when activeConv is set).
  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'smooth') => {
    const tryScroll = (attempts = 0) => {
      const container = messagesContainerRef.current;
      if (!container) {
        // Ref not attached yet — retry up to 10 times (500ms total)
        if (attempts < 10) {
          requestAnimationFrame(() => tryScroll(attempts + 1));
        }
        return;
      }
      const targetScroll = container.scrollHeight - container.clientHeight;
      if (behavior === 'auto') {
        container.scrollTop = targetScroll;
      } else {
        container.scrollTo({ top: targetScroll, behavior: 'smooth' });
      }
      lastScrolledHeightRef.current = container.scrollHeight;
      userIsNearBottomRef.current = true;
    };
    tryScroll();
  }, []);

  // Track user scroll position via passive listener on the messages container.
  // ⭐ V3-11: This is the KEY fix — we track whether the user has manually
  //   scrolled away from the bottom. If they did, we NEVER auto-scroll (even
  //   when scrollHeight changes from images loading). This prevents the
  //   "yank back to bottom" feeling while reading history.
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      userIsNearBottomRef.current = distanceFromBottom < 100;
      if (distanceFromBottom > 100) {
        userScrolledAwayRef.current = true;
      } else {
        userScrolledAwayRef.current = false;
      }
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeConvId]);

  // ⭐ V3-11: ResizeObserver — watches the messages container for scrollHeight
  //   changes (caused by images loading, new messages, polls). When the height
  //   grows AND the user hasn't scrolled away, we re-scroll to the bottom.
  //   This is the robust fix for the oscillation bug (scrollHeight going
  //   2554 → 2062 → 2554 as images load).
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newHeight = entry.contentRect.height;
        // Only auto-scroll if:
        // 1. The container grew (new content appeared), AND
        // 2. The user hasn't manually scrolled away from the bottom
        if (newHeight > lastScrolledHeightRef.current && !userScrolledAwayRef.current) {
          // Use a microtask to ensure the DOM has settled before scrolling
          queueMicrotask(() => {
            const c = messagesContainerRef.current;
            if (c) {
              c.scrollTop = c.scrollHeight - c.clientHeight;
              lastScrolledHeightRef.current = c.scrollHeight;
            }
          });
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [activeConvId]);

  // ⭐ V3-11: Auto-scroll on first load / conversation switch
  useEffect(() => {
    if (messages.length === 0) return;
    if (isFirstLoadRef.current) {
      // First load → instant jump to bottom. Use multiple rAF passes + a
      // setTimeout to catch slow-loading images.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollToBottom('auto');
            setTimeout(() => scrollToBottom('auto'), 300);
            setTimeout(() => scrollToBottom('auto'), 800);
            setTimeout(() => scrollToBottom('auto'), 1500);
          });
        });
      });
      isFirstLoadRef.current = false;
      prevMessagesLengthRef.current = messages.length;
      return;
    }
    // New messages arrived (length increased)
    const isNewMessage = messages.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;
    if (isNewMessage && !userScrolledAwayRef.current) {
      scrollToBottom('smooth');
    }
  }, [messages.length, scrollToBottom]);

  // ⭐ V3-11: Also scroll to bottom when loadingMsgs transitions from true→false
  useEffect(() => {
    if (!loadingMsgs && messages.length > 0 && isFirstLoadRef.current) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom('auto');
        });
      });
      isFirstLoadRef.current = false;
    }
  }, [loadingMsgs, messages.length, scrollToBottom]);

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
      const res = await fetch(`/api/chat/conversations/${activeConvId}/messages/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUserId,
          content,
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
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deletedAt: new Date().toISOString() } : m));
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
      return `https://api.academiahelm.com${path}`;
    }
    return `https://api.academiahelm.com/api/chat/files${path}`;
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

  // ⭐ V2.5: Start a call (audio/video) — full WebRTC flow
  const handleStartCall = async (callType: 'AUDIO' | 'VIDEO') => {
    if (!activeConvId || callState !== 'idle') return;
    const other = activeConv?.participants?.find(p => p.userId !== currentUserId);
    if (!other) return;
    const otherName = `${other.firstName || ''} ${other.lastName || ''}`.trim() || other.email || 'Utilisateur';
    // ⭐ FIX: Include the caller's own name + avatar in the call:offer payload so the
    //    recipient sees the real name (not "Utilisateur") without a DB lookup.
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

  // ⭐ V3-6: Start a GROUP call (mesh topology) — invite selected participants
  const handleStartGroupCall = async (callType: 'AUDIO' | 'VIDEO') => {
    if (!activeConvId || !activeConv || activeConv.type !== 'GROUP') return;
    const invitees = activeConv.participants.filter(
      (p) => p.userId !== currentUserId && groupCallParticipants.has(p.userId)
    );
    if (invitees.length === 0) {
      toast.error('Sélectionnez au moins un participant à appeler');
      return;
    }
    setShowGroupCallModal(false);

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
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
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

  // ⭐ V2.5: Toggle mute
  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMuted(!audioTrack.enabled);
    }
  };

  // ⭐ V2.5: Toggle video
  const toggleVideo = () => {
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
        video: { cursor: 'always' },
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

  // ⭐ V2.5: Socket.io listeners for incoming call events
  useEffect(() => {
    if (!socket) return;
    const onCallOffer = (data: { fromUserId: string; callId: string; callType: string; offer: any; callerName?: string; callerAvatarUrl?: string }) => {
      if (callState !== 'idle') return; // Already in a call — auto-reject
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

    socket.on('call:offer', onCallOffer);
    socket.on('call:answer', onCallAnswer);
    socket.on('call:ice-candidate', onIceCandidate);
    socket.on('call:reject', onCallReject);
    socket.on('call:hangup', onCallHangup);

    // ⭐ V3-6: Group call listeners
    const onGroupCallInvite = async (data: { fromUserId: string; callId: string; callType: string; conversationId: string; callerName?: string; callerAvatarUrl?: string; participantNames?: Record<string, string> }) => {
      if (groupCallActive || callState !== 'idle') return; // Already in a call

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
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
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

      const res = await fetch(`https://api.academiahelm.com/api/chat/conversations/${activeConvId}/messages/attachment`, {
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mime = file.type;
    let type: 'AUDIO' | 'DOCUMENT' | 'IMAGE' = 'DOCUMENT';
    if (mime.startsWith('audio/')) type = 'AUDIO';
    else if (mime.startsWith('image/')) type = 'IMAGE';
    // ⭐ DISCORD PARITY: Videos are sent as DOCUMENT (the backend stores them
    //    via StorageService and the message type 'DOCUMENT' handles any file).
    //    The frontend renders video attachments inline with a <video> element.
    else if (mime.startsWith('video/')) type = 'DOCUMENT';
    handleSendAttachment(file, type);
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
    files.forEach(file => {
      const mime = file.type;
      let type: 'AUDIO' | 'DOCUMENT' | 'IMAGE' = 'DOCUMENT';
      if (mime.startsWith('audio/')) type = 'AUDIO';
      else if (mime.startsWith('image/')) type = 'IMAGE';
      // ⭐ Videos sent as DOCUMENT (backend stores them; frontend renders inline <video>).
      else if (mime.startsWith('video/')) type = 'DOCUMENT';
      handleSendAttachment(file, type);
    });
  }, [activeConvId, isReadOnly, handleSendAttachment]);

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
    imageItems.forEach(item => {
      const file = item.getAsFile();
      if (file) {
        handleSendAttachment(file, 'IMAGE');
      }
    });
  }, [activeConvId, isReadOnly, handleSendAttachment]);

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
                )}>{formatTime(conv.lastMessageAt)}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className={cn(
              'text-xs truncate flex-1',
              (conv as any).unreadCount && (conv as any).unreadCount > 0
                ? 'text-slate-700 font-medium'
                : 'text-slate-500'
            )}>
              {conv.lastMessagePreview || '—'}
            </span>
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
            logo image larger (was 24px in a 40x40 box, now 40px standalone). */}
        <img
          src="/icons/modules/helm-connect.png"
          alt="Helm Connect"
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

      {/* ═════ LEFT SIDEBAR — Conversation List ═════ */}
      <div className={cn(
        'border-r border-slate-100 flex flex-col bg-white',
        activeConvId ? 'hidden md:flex' : 'flex',
        'w-full md:w-80'
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
                value={''}
                onChange={() => {}}
              />
            </div>
          )}
        </div>

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
            <VocauxSection conversations={conversations} currentUserId={currentUserId} onOpenConversation={(convId) => { setActiveConvId(convId); }} />
          ) : activeHelmSection === 'appels' ? (
            <AppelsSection conversations={conversations} currentUserId={currentUserId} onOpenConversation={(convId) => { setActiveConvId(convId); }} />
          ) : activeHelmSection === 'annonces' ? (
            <AnnoncesSection
              currentUserId={currentUserId}
              annonces={annonces}
              loading={annoncesLoading}
              onNew={() => setShowAnnouncements(true)}
            />
          ) : activeHelmSection === 'moderation' ? (
            <ModerationSection conversations={conversations} currentUserId={currentUserId} onOpenConversation={(convId) => { setActiveConvId(convId); }} />
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
              {/* ⭐ ROLE-BASED CATEGORY FILTERS (Tout / Enseignants / Parents / Administration)
                  — only shown on the 'discussions' section */}
              {activeHelmSection === 'discussions' && (
                <div className="flex gap-1 px-3 py-2 border-b border-slate-100 overflow-x-auto">
                  {(['all', 'enseignants', 'parents', 'admin'] as const).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition',
                        categoryFilter === cat
                          ? 'bg-[#1677FF] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      )}
                    >
                      {cat === 'all' ? 'Tout' : cat === 'enseignants' ? 'Enseignants' : cat === 'parents' ? 'Parents' : 'Administration'}
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
                  const groupConvs = visibleConversations.filter(c => c.type === 'GROUP');
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
                      {groupConvs.map(conv => renderConversationItem(conv))}
                    </>
                  );
                }
                if (activeHelmSection === 'canaux') {
                  if (channels.length === 0) {
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
                        <Megaphone className="w-3 h-3" /> Canaux ({channels.length})
                      </div>
                      {channels.map((ch: any) => (
                        <button
                          key={ch.id}
                          onClick={() => setActiveChannelId(ch.id)}
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
                  );
                }
                // Default: 'discussions' section
                // ⭐ Filter DIRECT conversations by role category
                const directConvs = visibleConversations.filter(c => {
                  if (c.type !== 'DIRECT') return false;
                  if (categoryFilter === 'all') return true;
                  // Find the other participant
                  const other = c.participants.find(p => p.userId !== currentUserId);
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
                  return true;
                });
                const groupConvs = visibleConversations.filter(c => c.type === 'GROUP');
                return (
                  <>
                    {directConvs.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 flex items-center gap-1.5">
                          <MessageSquare className="w-3 h-3" /> Discussions
                        </div>
                        {directConvs.map(conv => renderConversationItem(conv))}
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
                            onClick={() => setActiveChannelId(ch.id)}
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
                    {groupConvs.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 flex items-center gap-1.5">
                          <Users className="w-3 h-3" /> Groupes
                        </div>
                        {groupConvs.map(conv => renderConversationItem(conv))}
                      </>
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
              onClick={() => setActiveConvId(null)}
              className="md:hidden p-1 rounded hover:bg-[#0958D9]"
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
                <p className="text-[10px] text-[#BAE0FF]">
                  {(() => {
                    const other = activeConv.participants.find(p => p.userId !== currentUserId);
                    const isOnline = other && onlineUsers.has(other.userId);
                    const roleLabel = getConversationDisplay(activeConv, currentUserId).roleLabel;
                    if (isOnline) return roleLabel ? `${roleLabel} — en ligne` : 'en ligne';
                    return roleLabel || getConversationDisplay(activeConv, currentUserId).subtitle || 'hors ligne';
                  })()}
                </p>
              )}
            </div>
            {/* ⭐ V2: Call buttons (audio + video) + invite link (groups only) */}
            <button
              onClick={() => activeConv.type === 'GROUP' ? setShowGroupCallModal(true) : handleStartCall('AUDIO')}
              className="p-1.5 rounded hover:bg-[#0958D9]"
              title={activeConv.type === 'GROUP' ? 'Appel audio de groupe' : 'Appel audio'}
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              onClick={() => activeConv.type === 'GROUP' ? setShowGroupCallModal(true) : handleStartCall('VIDEO')}
              className="p-1.5 rounded hover:bg-[#0958D9]"
              title={activeConv.type === 'GROUP' ? 'Appel vidéo de groupe' : 'Appel vidéo'}
            >
              <Video className="w-4 h-4" />
            </button>
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

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-2 relative"
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
                    <div className={cn('flex group', isMine ? 'justify-end' : 'justify-start')}>
                      <div
                        data-msg-id={msg.id}
                        className={cn(
                          'max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm relative',
                          isMine
                            ? 'bg-[#3B9EFF] text-white rounded-br-sm'
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
                            {isMine && (
                              <button
                                onClick={() => { handleMessageDeleteForEveryone(msg.id); setActiveMenuMsgId(null); }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Supprimer pour tous
                              </button>
                            )}
                          </div>
                        )}
                        {/* Sender name (for group) — ⭐ DISCORD PARITY: role-colored username */}
                        {!isMine && activeConv.type === 'GROUP' && msg.sender && (
                          <div
                            className="text-[10px] font-bold mb-0.5"
                            style={{ color: getRoleColor((msg.sender as any).roleLabel || (msg.sender as any).role) }}
                          >
                            {msg.sender.firstName} {msg.sender.lastName}
                          </div>
                        )}
                        {/* Content based on message type */}
                        {msg.type === 'TEXT' && editingMessageId === msg.id ? (
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
                            dangerouslySetInnerHTML={{ __html: highlightMentions(msg.content) }}
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
                                loading="lazy"
                              />
                            </a>
                            {msg.content && <p className="text-xs mt-1">{msg.content}</p>}
                          </div>
                        )}
                        {msg.type === 'AUDIO' && msg.attachmentUrl && (
                          <div className="flex items-center gap-2">
                            <audio
                              controls
                              src={getAttachmentUrl(msg.attachmentUrl)}
                              className="h-9 max-w-[240px]"
                              preload="metadata"
                            />
                            <a
                              href={getAttachmentUrl(msg.attachmentUrl)}
                              download={msg.attachmentName || 'audio'}
                              className="p-1 rounded hover:bg-slate-200"
                              title="Télécharger"
                            >
                              <Download className="w-4 h-4" />
                            </a>
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
                                  dangerouslySetInnerHTML={{ __html: renderRichContent(msg.content) }}
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
                                            await fetch(`/api/chat/v2/polls/${msg.id}/vote`, {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ userId: currentUserId, optionIds: [opt.id] }),
                                              credentials: 'include',
                                            });
                                            if (activeConvId) loadMessages();
                                          } catch (e) {
                                            toast.error('Échec du vote');
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
                                  {count > 1 && <span>{count}</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
              }
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar — fully responsive (mobile-friendly) */}
          <div className="p-2 sm:p-3 bg-white border-t border-slate-200">
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
                <div className="flex items-end gap-1.5 sm:gap-2">
                  {/* ⭐ DISCORD PARITY: Emoji picker — opens a popover with categorized
                      common emojis. Clicking an emoji inserts it into the message. */}
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
                      as an IMAGE message. */}
                  <div className="relative flex-shrink-0">
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
                  {/* ⭐ DISCORD PARITY: Sticker picker — shows sticker packs + stickers. */}
                  <div className="relative flex-shrink-0">
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
                    {/* ⭐ MENTIONS: Autocomplete popover — appears when the user types @
                        followed by letters. Shows matching conversation participants.
                        Clicking a participant inserts @FirstName into the message. */}
                    {mentionQuery !== null && activeConv && (() => {
                      const query = mentionQuery.toLowerCase();
                      const matches = (activeConv.participants || [])
                        .filter(p => p.userId !== currentUserId)
                        .filter(p => {
                          const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim().toLowerCase();
                          return !query || fullName.includes(query);
                        })
                        .slice(0, 5);
                      if (matches.length === 0) return null;
                      return (
                        <div className="absolute bottom-full left-0 right-0 mb-1 sm:right-auto sm:w-64 max-w-[calc(100vw-1rem)] bg-white rounded-lg shadow-xl border border-slate-200 z-30 max-h-60 overflow-y-auto">
                          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                            Mentionner un participant
                          </div>
                          {matches.map(p => (
                            <button
                              key={p.userId}
                              onClick={() => {
                                // Insert @FirstName at the current cursor position
                                const firstName = p.firstName || p.lastName || 'utilisateur';
                                const mentionText = `@${firstName} `;
                                // Append the mention to the current text (simple approach)
                                // For contentEditable, we append HTML to the end
                                const mentionHtml = `<span style="background-color:rgba(22,119,255,0.15);color:#0958D9;font-weight:600;border-radius:3px;padding:0 2px;">${mentionText}</span>`;
                                setText(prev => prev + mentionHtml);
                                setMentionQuery(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-left transition"
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
                      onChange={(html) => {
                        setText(html);
                        handleTyping();
                        // ⭐ MENTIONS: detect @ followed by letters to show autocomplete
                        const textContent = html.replace(/<[^>]*>/g, '');
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
                      placeholder="Tapez un message... @mention, /commande, ||spoiler||, ou `code`"
                    />
                  </div>
                  {/* Mic button (idle state — only when text is empty) */}
                  {!text.replace(/<[^>]*>/g, '').trim() && (
                    <button
                      onClick={startRecording}
                      disabled={readOnly || sending}
                      className="p-2 text-slate-500 hover:bg-slate-100 rounded-full disabled:opacity-30 flex-shrink-0"
                      title="Enregistrer un message vocal"
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                  )}
                  {/* Send button — always visible */}
                  <button
                    onClick={handleSendText}
                    disabled={!text.replace(/<[^>]*>/g, '').trim() || sending}
                    className="p-2 bg-[#1677FF] text-white rounded-full hover:bg-[#0958D9] disabled:opacity-30 flex-shrink-0"
                    title="Envoyer le message"
                  >
                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                  {/* ⭐ V2: Schedule message button */}
                  <button
                    onClick={() => { setScheduleText(text.replace(/<[^>]*>/g, '')); setShowScheduleModal(true); }}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full flex-shrink-0"
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
              <h3 className="text-sm font-bold text-slate-900">Membres</h3>
              <button
                onClick={() => setShowMemberList(false)}
                className="p-1 hover:bg-slate-100 rounded"
                title="Fermer"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingMembers ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : (
                <>
                  {/* Online members */}
                  {conversationMembers.filter(m => m.isOnline).length > 0 && (
                    <div className="px-3 pt-3 pb-1">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-400 rounded-full" />
                        En ligne — {conversationMembers.filter(m => m.isOnline).length}
                      </div>
                    </div>
                  )}
                  {conversationMembers.filter(m => m.isOnline).map((m: any) => (
                    <div key={m.userId} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer" onClick={() => { setShowProfile(true); }}>
                      <div className="relative flex-shrink-0">
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold', m.avatarUrl ? 'bg-slate-200' : getAvatarColor(`${m.firstName || ''} ${m.lastName || ''}`))}>
                          {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" /> : getInitials(`${m.firstName || ''} ${m.lastName || ''}`)}
                        </div>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate" style={{ color: getRoleColor(m.userRole) }}>
                          {m.firstName} {m.lastName}
                          {m.role === 'ADMIN' && <span className="ml-1 text-[9px] text-amber-600">(Admin)</span>}
                        </div>
                        {m.customStatus && <div className="text-[10px] text-slate-500 truncate">{m.customStatus}</div>}
                        {!m.customStatus && m.activityStatus && <div className="text-[10px] text-slate-400 truncate">{m.activityStatus}</div>}
                      </div>
                    </div>
                  ))}
                  {/* Offline members */}
                  {conversationMembers.filter(m => !m.isOnline).length > 0 && (
                    <div className="px-3 pt-3 pb-1 mt-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <span className="w-2 h-2 bg-slate-300 rounded-full" />
                        Hors ligne — {conversationMembers.filter(m => !m.isOnline).length}
                      </div>
                    </div>
                  )}
                  {conversationMembers.filter(m => !m.isOnline).map((m: any) => (
                    <div key={m.userId} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 opacity-60 cursor-pointer" onClick={() => { setShowProfile(true); }}>
                      <div className="relative flex-shrink-0">
                        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold grayscale', m.avatarUrl ? 'bg-slate-200' : getAvatarColor(`${m.firstName || ''} ${m.lastName || ''}`))}>
                          {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" /> : getInitials(`${m.firstName || ''} ${m.lastName || ''}`)}
                        </div>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-slate-300 rounded-full border-2 border-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate text-slate-500" style={{ color: getRoleColor(m.userRole) }}>
                          {m.firstName} {m.lastName}
                          {m.role === 'ADMIN' && <span className="ml-1 text-[9px] text-amber-600">(Admin)</span>}
                        </div>
                        {m.customStatus && <div className="text-[10px] text-slate-400 truncate">{m.customStatus}</div>}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
        </>
      ) : (
        // Empty state when no conversation selected — uses Helm watermark background + Helm Connect icon
        // ⭐ Per user feedback: KEEP the watermark theme (asked for) but DO NOT replace
        //    the Helm Connect icon with the AH SVG logo (was not asked for).
        <div
          className="hidden md:flex flex-1 items-center justify-center relative"
          style={getHelmWatermarkStyle({ opacity: 0.08 })}
        >
          <div className="text-center relative z-10">
            <img
              src="/icons/modules/helm-connect.png"
              alt="Helm Connect"
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
          onClose={() => setShowNotifPrefs(false)}
        />
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
      {/* ⭐ V3-6 — Group call overlay (branded, multi-participant grid) */}
      {groupCallActive && groupCallData && (
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
          onSendFile={handleSendAttachment}
          onOpenPoll={() => setShowPollModal(true)}
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
      {callState === 'incoming' && callData && (
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

      {/* Outgoing + Active call — Helm Connect branded overlay */}
      {(callState === 'outgoing' || callState === 'active') && callData && (
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
                <div key={r.id} className="p-2 text-xs hover:bg-slate-50 rounded cursor-pointer" onClick={() => setShowConvSearch(false)}>
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
              <h3 className="text-lg font-bold text-slate-900">{profileUser.name}</h3>
              <p className="text-sm text-slate-500">{profileData?.role || '—'}</p>
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
        const res = await fetch(
          `/api/chat/search-users?userId=${currentUserId}&q=${encodeURIComponent(query)}&includeOtherTenants=true`,
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
  avatarInputRef: React.RefObject<HTMLInputElement>;
}) {
  // ⭐ Get absolute URL for avatar (same logic as attachments)
  const avatarUrl = myAvatarUrl
    ? (myAvatarUrl.startsWith('http') ? myAvatarUrl : `https://api.academiahelm.com${myAvatarUrl.startsWith('/') ? myAvatarUrl : `/${myAvatarUrl}`}`)
    : null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Mon profil</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
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
      </div>
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
function FichiersSection({ conversations, currentUserId, onOpenConversation }: SectionSharedProps) {
  const [filter, setFilter] = useState<'all' | 'image' | 'document' | 'audio'>('all');
  const allFiles = conversations
    .filter(c => c.lastMessagePreview && (c.lastMessagePreview.startsWith('[Image]') || c.lastMessagePreview.startsWith('[Document]') || c.lastMessagePreview.startsWith('[Audio]')))
    .slice(0, 50);
  const files = allFiles.filter(c => {
    if (filter === 'all') return true;
    if (filter === 'image') return c.lastMessagePreview!.startsWith('[Image]');
    if (filter === 'document') return c.lastMessagePreview!.startsWith('[Document]');
    if (filter === 'audio') return c.lastMessagePreview!.startsWith('[Audio]');
    return true;
  });
  return (
    <div className="p-3">
      <div className="flex items-center gap-1.5 px-1 py-1 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        <FileText className="w-3 h-3" /> Fichiers partagés ({files.length})
      </div>
      {/* ⭐ V3-11: Type filter chips */}
      <div className="flex gap-1 mb-3">
        {([
          { id: 'all', label: 'Tous', icon: <FileText className="w-3 h-3" /> },
          { id: 'image', label: 'Images', icon: <ImageIcon className="w-3 h-3" /> },
          { id: 'document', label: 'Documents', icon: <FileText className="w-3 h-3" /> },
          { id: 'audio', label: 'Audio', icon: <Mic className="w-3 h-3" /> },
        ] as const).map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition flex items-center gap-1',
              filter === f.id
                ? 'bg-[#1677FF] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            {f.icon} {f.label}
          </button>
        ))}
      </div>
      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <FileText className="w-12 h-12 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-700">
            {filter === 'all' ? 'Aucun fichier partagé' : `Aucun ${filter === 'image' ? 'image' : filter === 'document' ? 'document' : 'fichier audio'}`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Les fichiers envoyés dans vos conversations apparaîtront ici.</p>
        </div>
      ) : (
        files.map(c => {
          const display = _getConvDisplay(c, currentUserId);
          const isImage = c.lastMessagePreview!.startsWith('[Image]');
          const isAudio = c.lastMessagePreview!.startsWith('[Audio]');
          const Icon = isImage ? ImageIcon : isAudio ? Mic : FileText;
          const color = isImage ? 'text-emerald-600 bg-emerald-50' : isAudio ? 'text-pink-600 bg-pink-50' : 'text-blue-600 bg-blue-50';
          return (
            <button
              key={c.id}
              onClick={() => onOpenConversation(c.id)}
              className="w-full flex items-start gap-3 p-3 text-left hover:bg-slate-50 border-b border-slate-50 transition"
            >
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {c.lastMessagePreview!.replace(/^\[(Image|Document|Audio)\]\s*/, '')}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {display.name} • {c.lastMessageAt ? formatTime(c.lastMessageAt) : ''}
                </div>
              </div>
              <Download className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </button>
          );
        })
      )}
    </div>
  );
}

// ─── 1b. ANNONCES — official announcements list (with create button) ──────
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
function VocauxSection({ conversations, currentUserId, onOpenConversation }: SectionSharedProps) {
  const voiceConvs = conversations.filter(c => c.lastMessagePreview && c.lastMessagePreview.startsWith('[Audio]'));
  return (
    <div className="p-3">
      <div className="flex items-center gap-1.5 px-1 py-1 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        <Mic className="w-3 h-3" /> Messages vocaux ({voiceConvs.length})
      </div>
      {voiceConvs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <Mic className="w-12 h-12 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-700">Aucun message vocal</p>
          <p className="text-xs text-slate-500 mt-1">Les messages vocaux échangés apparaîtront ici, avec transcription Whisper.</p>
        </div>
      ) : (
        voiceConvs.map(c => {
          const display = _getConvDisplay(c, currentUserId);
          return (
            <button
              key={c.id}
              onClick={() => onOpenConversation(c.id)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 border-b border-slate-50 transition"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#CFA63A] to-[#FFE08A] flex items-center justify-center text-white flex-shrink-0">
                <Mic className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">{display.name}</div>
                <div className="text-xs text-slate-500 truncate">Message vocal • {c.lastMessageAt ? formatTime(c.lastMessageAt) : ''}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onOpenConversation(c.id); }}
                className="w-8 h-8 rounded-full bg-[#1677FF] text-white flex items-center justify-center flex-shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
              </button>
            </button>
          );
        })
      )}
    </div>
  );
}

// ─── 3. APPELS — call history ─────────────────────────────────────────────
function AppelsSection({ conversations, currentUserId, onOpenConversation }: SectionSharedProps) {
  const callConvs = conversations
    .filter(c => c.type === 'DIRECT')
    .sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''))
    .slice(0, 30);
  return (
    <div className="p-3">
      <div className="flex items-center gap-1.5 px-1 py-1 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        <Phone className="w-3 h-3" /> Historique d'appels ({callConvs.length})
      </div>
      {callConvs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <Phone className="w-12 h-12 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-700">Aucun appel</p>
          <p className="text-xs text-slate-500 mt-1">Votre historique d'appels audio et vidéo apparaîtra ici.</p>
        </div>
      ) : (
        callConvs.map(c => {
          const display = _getConvDisplay(c, currentUserId);
          return (
            <button
              key={c.id}
              onClick={() => onOpenConversation(c.id)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 border-b border-slate-50 transition"
            >
              <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0', getAvatarColor(display.name))}>
                {getInitials(display.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">{display.name}</div>
                <div className="text-xs text-slate-500 truncate flex items-center gap-1">
                  <Phone className="w-3 h-3 text-blue-500 rotate-180" />
                  Appel récent • {c.lastMessageAt ? formatTime(c.lastMessageAt) : ''}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onOpenConversation(c.id); }}
                className="w-8 h-8 rounded-full bg-[#1677FF] text-white flex items-center justify-center flex-shrink-0"
                title="Rappeler"
              >
                <Phone className="w-3.5 h-3.5" />
              </button>
            </button>
          );
        })
      )}
    </div>
  );
}

// ─── 4. MODÉRATION — flagged content ──────────────────────────────────────
function ModerationSection({ conversations, currentUserId, onOpenConversation }: SectionSharedProps) {
  const groupConvs = conversations.filter(c => c.type === 'GROUP');
  return (
    <div className="p-3">
      <div className="flex items-center gap-1.5 px-1 py-1 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        <Flag className="w-3 h-3" /> Modération ({groupConvs.length})
      </div>
      {groupConvs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <Flag className="w-12 h-12 text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-700">Aucun contenu à modérer</p>
          <p className="text-xs text-slate-500 mt-1">Les messages signalés ou épinglés par les administrateurs apparaîtront ici.</p>
        </div>
      ) : (
        groupConvs.map(c => {
          const display = _getConvDisplay(c, currentUserId);
          return (
            <div
              key={c.id}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 border-b border-slate-50 transition"
            >
              <div className="w-9 h-9 rounded-full bg-slate-400 flex items-center justify-center text-white flex-shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">{display.name}</div>
                <div className="text-xs text-slate-500 truncate">{c.participants.length} membres • {c.lastMessagePreview || 'Aucun message'}</div>
              </div>
              <button
                onClick={() => onOpenConversation(c.id)}
                className="px-2 py-1 text-[10px] font-bold rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                Examiner
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── 5. ANALYTICS — KPI dashboard ──────────────────────────────────────────
function AnalyticsSection({ conversations, currentUserId }: { conversations: ChatConversation[]; currentUserId: string }) {
  const total = conversations.length;
  const direct = conversations.filter(c => c.type === 'DIRECT').length;
  const group = conversations.filter(c => c.type === 'GROUP').length;
  const unread = conversations.reduce((sum, c) => {
    const me = c.participants.find(p => p.userId === currentUserId);
    return sum + (me?.lastReadAt && c.lastMessageAt && me.lastReadAt < c.lastMessageAt ? 1 : 0);
  }, 0);
  const totalParticipants = conversations.reduce((sum, c) => sum + c.participants.length, 0);

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-1.5 px-1 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        <BarChart3 className="w-3 h-3" /> Tableau de bord
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-lg bg-gradient-to-br from-[#0A2A5E] to-[#1C6FE8] text-white">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-4 h-4 text-[#FFE08A]" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#FFE08A]">Conversations</span>
          </div>
          <div className="text-2xl font-bold">{total}</div>
        </div>
        <div className="p-3 rounded-lg bg-white border border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-4 h-4 text-red-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Non lus</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{unread}</div>
        </div>
        <div className="p-3 rounded-lg bg-white border border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Directs</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">{direct}</div>
        </div>
        <div className="p-3 rounded-lg bg-white border border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Groupes</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600">{group}</div>
        </div>
      </div>
      <div className="p-3 rounded-lg bg-white border border-slate-200">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-[#CFA63A]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Participants totaux</span>
        </div>
        <div className="text-2xl font-bold text-[#CFA63A]">{totalParticipants}</div>
      </div>
      <div className="p-3 rounded-lg bg-gradient-to-br from-[#0A2A5E] to-[#1C6FE8] text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#FFE08A]" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold">Helm Connect Analytics</div>
            <div className="text-[10px] text-[#FFE08A]">Statistiques de communication en temps réel.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
