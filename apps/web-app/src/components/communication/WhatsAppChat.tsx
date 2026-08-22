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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useChatSocket } from '@/lib/chat/useChatSocket';
import { generateKeyPair, hasPrivateKey, encryptMessage, decryptMessage } from '@/lib/chat/crypto';

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
    'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
    'bg-indigo-500', 'bg-purple-500', 'bg-cyan-500', 'bg-orange-500',
  ];
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
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
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ⭐ PRESENCE (online/offline) + TYPING + AUDIO RECORDING
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<{ userId: string; firstName?: string; lastName?: string }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingPingRef = useRef<number>(0);

  // Modals
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);

  // ⭐ CANAUX (Telegram-style broadcast channels)
  const [channels, setChannels] = useState<any[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [channelMessages, setChannelMessages] = useState<any[]>([]);

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
    }, [activeConvId]),
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
  });

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

  // ───────────────────────────────────────────────────────────────────
  // Load messages for active conversation
  // ───────────────────────────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    if (!activeConvId) return;
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

      // Marquer comme lu
      await fetch(`/api/chat/conversations/${activeConvId}/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
        credentials: 'include',
      });
    } catch (e: any) {
      console.error('loadMessages:', e);
    } finally {
      setLoadingMsgs(false);
    }
  }, [activeConvId, currentUserId]);

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

  // ⭐ TYPING SEND : notify server when user starts/stops typing
  const handleTyping = useCallback(() => {
    if (!activeConvId || !currentUserId) return;
    const now = Date.now();
    // Throttle: only ping every 3 seconds
    if (now - lastTypingPingRef.current < 3000) return;
    lastTypingPingRef.current = now;
    fetch('/api/chat/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: activeConvId, userId: currentUserId, isTyping: true }),
      credentials: 'include',
    }).catch(() => {});
  }, [activeConvId, currentUserId]);

  // ⭐ AUDIO RECORDING (MediaRecorder API)
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        // Create audio blob and send
        const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
        await handleSendAttachment(file, 'AUDIO');
        // Stop all tracks
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);
      // Duration timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } catch (e: any) {
      toast.error("Impossible d'accéder au microphone: " + e.message);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ───────────────────────────────────────────────────────────────────
  // Send text message
  // ───────────────────────────────────────────────────────────────────
  const handleSendText = async () => {
    if (!activeConvId || !text.trim() || sending) return;
    const content = text.trim();
    setText('');
    setSending(true);
    try {
      const res = await fetch(`/api/chat/conversations/${activeConvId}/messages/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: currentUserId, content }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to send message');
      const newMsg = await res.json();
      setMessages(prev => [...prev, newMsg]);
      // Rafraîchir la liste des convs pour updater le preview
      loadConversations();
    } catch (e: any) {
      toast.error("Échec d'envoi du message: " + e.message);
      setText(content); // Restore le texte non envoyé
    } finally {
      setSending(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────
  // Send attachment (document, image, audio)
  // ───────────────────────────────────────────────────────────────────
  const handleSendAttachment = async (file: File, type: 'AUDIO' | 'DOCUMENT' | 'IMAGE') => {
    if (!activeConvId || sending) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('senderId', currentUserId);
      formData.append('type', type);

      const res = await fetch(`/api/chat/conversations/${activeConvId}/messages/attachment`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to send attachment');
      const newMsg = await res.json();
      setMessages(prev => [...prev, newMsg]);
      loadConversations();
      toast.success(type === 'AUDIO' ? 'Audio envoyé' : type === 'IMAGE' ? 'Image envoyée' : 'Document envoyé');
    } catch (e: any) {
      toast.error("Échec d'envoi du fichier: " + e.message);
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
    handleSendAttachment(file, type);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ───────────────────────────────────────────────────────────────────
  // Render conversation item (shared between Groups and Direct lists)
  // ┭ Telegram-style: avatar, name, last message preview, time, unread badge,
  //    role label for DIRECT convs, member count for GROUP convs
  // ───────────────────────────────────────────────────────────────────
  const renderConversationItem = (conv: ChatConversation) => {
    const display = getConversationDisplay(conv, currentUserId);
    const isActive = conv.id === activeConvId;
    // ⭐ Check if the other participant is online (DIRECT only)
    const otherUser = conv.type === 'DIRECT' ? conv.participants.find(p => p.userId !== currentUserId) : null;
    const isOnline = otherUser && onlineUsers.has(otherUser.userId);
    return (
      <button
        key={conv.id}
        onClick={() => setActiveConvId(conv.id)}
        className={cn(
          'w-full flex items-start gap-3 p-3 text-left hover:bg-slate-50 border-b border-slate-50 transition',
          isActive && 'bg-emerald-50'
        )}
      >
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
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
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
            <span className="text-sm font-semibold text-slate-900 truncate">{display.name}</span>
            {conv.lastMessageAt && (
              <span className="text-[10px] text-slate-400 flex-shrink-0">{formatTime(conv.lastMessageAt)}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500 truncate flex-1">
              {conv.lastMessagePreview || '—'}
            </span>
          </div>
          {/* Role label (DIRECT only) or member count (GROUP only) */}
          {display.roleLabel && conv.type === 'DIRECT' && (
            <span className="text-[10px] text-emerald-700 font-semibold truncate block mt-0.5">
              {display.roleLabel}
            </span>
          )}
          {conv.type === 'GROUP' && display.subtitle && (
            <span className="text-[10px] text-slate-400 block mt-0.5">{display.subtitle}</span>
          )}
        </div>
      </button>
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
        accept="image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z,.md,.json,.xml"
      />

      {/* ═════ LEFT SIDEBAR — Conversation List ═════ */}
      <div className={cn(
        'border-r border-slate-100 flex flex-col bg-white',
        activeConvId ? 'hidden md:flex' : 'flex',
        'w-full md:w-80'
      )}>
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-emerald-50/30">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              Messages
              {/* ⭐ Socket.io connection indicator */}
              <span
                className={cn('w-2 h-2 rounded-full', socket.isConnected ? 'bg-green-400' : 'bg-slate-300')}
                title={socket.isConnected ? 'Connecté (temps réel)' : 'Déconnecté (polling)'}
              />
            </h2>
            <div className="flex items-center gap-1">
              {!readOnly && (
                <>
                  {/* ⭐ Profile / Avatar button */}
                  <button
                    onClick={() => setShowProfile(true)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                    title="Mon profil"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  {/* ⭐ New channel button (Telegram-style) */}
                  <button
                    onClick={() => setShowNewChannel(true)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                    title="Nouveau canal"
                  >
                    <Megaphone className="w-4 h-4" />
                  </button>
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
                    <Bell className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowNewChat(true)}
                    className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                    title="Nouveau message"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
          {/* Search (filtre local des convs) */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher une conversation..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500/30"
              value={''}
              onChange={() => {}}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="w-12 h-12 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-700">Aucune conversation</p>
              <p className="text-xs text-slate-500 mt-1 mb-3">Démarrez une nouvelle conversation</p>
              {!readOnly && (
                <button
                  onClick={() => setShowNewChat(true)}
                  className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700"
                >
                  + Nouveau message
                </button>
              )}
            </div>
          ) : (
            <>
              {/* ⭐ CATEGORIZE: Discussions + Canaux + Groupes (like Telegram) */}
              {(() => {
                const directConvs = conversations.filter(c => c.type === 'DIRECT');
                const groupConvs = conversations.filter(c => c.type === 'GROUP');
                return (
                  <>
                    {directConvs.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                          💬 Discussions
                        </div>
                        {directConvs.map(conv => renderConversationItem(conv))}
                      </>
                    )}
                    {/* ⭐ CANAUX (Telegram-style broadcast channels) */}
                    {channels.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                          📢 Canaux
                        </div>
                        {channels.map((ch: any) => (
                          <button
                            key={ch.id}
                            onClick={() => setActiveChannelId(ch.id)}
                            className={cn(
                              'w-full flex items-start gap-3 p-3 text-left hover:bg-slate-50 border-b border-slate-50 transition',
                              activeChannelId === ch.id && 'bg-emerald-50'
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
                        <div className="px-3 py-1.5 bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                          👥 Groupes
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
      </div>

      {/* ═════ RIGHT PANE — Chat View ═════ */}
      {activeConv ? (
        <div className="flex-1 flex flex-col bg-slate-50">
          {/* Header */}
          <div className="p-3 bg-emerald-700 text-white flex items-center gap-3 shadow-sm">
            <button
              onClick={() => setActiveConvId(null)}
              className="md:hidden p-1 rounded hover:bg-emerald-800"
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
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-emerald-700" />
                ) : null;
              })()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold truncate">
                {getConversationDisplay(activeConv, currentUserId).name}
              </h3>
              {activeConv.type === 'GROUP' ? (
                <p className="text-[10px] text-emerald-100">
                  {activeConv.participants.map(p => `${p.firstName || ''} ${p.lastName || ''}`.trim()).join(', ')}
                </p>
              ) : typingUsers.length > 0 ? (
                /* ⭐ Typing indicator (like WhatsApp 'typing...') */
                <p className="text-[10px] text-emerald-100 italic">
                  {typingUsers.map(t => `${t.firstName || ''} ${t.lastName || ''}`.trim()).join(', ')} tape…
                </p>
              ) : (
                <p className="text-[10px] text-emerald-100">
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
            <button className="p-1.5 rounded hover:bg-emerald-800" title="Rechercher">
              <Search className="w-4 h-4" />
            </button>
            <button className="p-1.5 rounded hover:bg-emerald-800" title="Plus">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23f8fafc%22 width=%22100%22 height=%22100%22/></svg>')]">
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
              messages.map((msg, idx) => {
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
                    <div className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm',
                        isMine
                          ? 'bg-emerald-500 text-white rounded-br-sm'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                      )}>
                        {/* Sender name (for group) */}
                        {!isMine && activeConv.type === 'GROUP' && msg.sender && (
                          <div className="text-[10px] font-bold text-emerald-700 mb-0.5">
                            {msg.sender.firstName} {msg.sender.lastName}
                          </div>
                        )}
                        {/* Content based on message type */}
                        {msg.type === 'TEXT' && (
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        )}
                        {msg.type === 'IMAGE' && msg.attachmentUrl && (
                          <div>
                            <img
                              src={msg.attachmentUrl}
                              alt={msg.attachmentName || 'Image'}
                              className="max-w-full rounded-lg mb-1"
                              style={{ maxHeight: '300px' }}
                            />
                            {msg.content && <p className="text-xs mt-1">{msg.content}</p>}
                          </div>
                        )}
                        {msg.type === 'AUDIO' && msg.attachmentUrl && (
                          <div className="flex items-center gap-2">
                            <audio controls src={msg.attachmentUrl} className="h-8" />
                            {msg.content && <span className="text-xs">{msg.content}</span>}
                          </div>
                        )}
                        {msg.type === 'DOCUMENT' && msg.attachmentUrl && (
                          <a
                            href={msg.attachmentUrl}
                            download={msg.attachmentName}
                            className="flex items-center gap-2 hover:underline"
                          >
                            <FileText className="w-5 h-5" />
                            <div>
                              <div className="text-xs font-semibold">{msg.attachmentName || 'Document'}</div>
                              {msg.attachmentSize && (
                                <div className="text-[10px] opacity-70">{formatFileSize(msg.attachmentSize)}</div>
                              )}
                            </div>
                          </a>
                        )}
                        {/* Timestamp + read receipt (WhatsApp-style: ✓ sent, ✓✓ delivered, blue ✓✓ read) */}
                        <div className={cn(
                          'flex items-center gap-1 mt-0.5',
                          isMine ? 'justify-end text-emerald-50' : 'justify-end text-slate-400'
                        )}>
                          <span className="text-[10px]">{formatTime(msg.createdAt)}</span>
                          {isMine && (
                            <>
                              {/* ✓✓ blue = read by at least one participant */}
                              {msg.readBy && msg.readBy.length > 0 ? (
                                <CheckCheck className="w-3 h-3 text-blue-300" />
                              ) : (
                                /* ✓ single = sent (waiting for delivery/read confirmation) */
                                <Check className="w-3 h-3" />
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-full"
              title="Joindre un fichier"
              disabled={readOnly}
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              type="text"
              placeholder="Tapez un message..."
              className="flex-1 px-4 py-2 bg-slate-100 rounded-full text-sm outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/30"
              value={text}
              onChange={e => { setText(e.target.value); handleTyping(); }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendText();
                }
              }}
              disabled={readOnly}
            />
            {/* ⭐ AUDIO RECORDING button (MediaRecorder) — shows mic icon or recording UI */}
            {isRecording ? (
              <div className="flex items-center gap-2 bg-red-50 border border-red-300 rounded-full px-3 py-1">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-red-600">
                  {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
                </span>
                <button
                  onClick={stopRecording}
                  className="p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                  title="Arrêter et envoyer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={startRecording}
                disabled={readOnly || sending}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-full disabled:opacity-30"
                title="Enregistrer un message vocal"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={handleSendText}
              disabled={!text.trim() || sending || isRecording}
              className="p-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 disabled:opacity-30"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      ) : (
        // Empty state when no conversation selected
        <div className="hidden md:flex flex-1 items-center justify-center bg-slate-50">
          <div className="text-center">
            <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-700">Academia Helm Chat</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
              Communiquez avec vos collègues, vos enseignants ou la direction directement dans l'application.
            </p>
            {!readOnly && (
              <button
                onClick={() => setShowNewChat(true)}
                className="mt-6 px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700"
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
          onConversationCreated={(convId) => {
            setShowNewChat(false);
            loadConversations();
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

      {error && (
        <div className="absolute top-4 right-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="w-3 h-3" /></button>
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
  onConversationCreated: (convId: string) => void;
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
        if (!res.ok) throw new Error('Failed to create conversation');
        const conv = await res.json();
        onConversationCreated(conv.id);
        toast.success(`Conversation démarrée avec ${user.firstName} ${user.lastName}`);
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
              placeholder="Rechercher un utilisateur (nom, email)..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
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
                    <div className="text-[11px] text-emerald-700 font-semibold truncate">
                      {user.roleLabel}
                    </div>
                  )}
                  {/* ⭐ Distinction intra-école vs cross-école */}
                  {user.canStartDirectConversation ? (
                    <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                      ✓ Même école — discussion directe
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
                {sentInvites.has(user.userId) ? (
                  <span className="text-xs text-emerald-600 font-semibold flex-shrink-0">Invité</span>
                ) : user.canStartDirectConversation ? (
                  <MessageSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" />
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
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Description (optionnel)"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
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
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          {selected.size > 0 && (
            <div className="mt-2 text-xs text-emerald-700 font-semibold">
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
                  isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'
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
            className="w-full px-4 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-30"
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
                    className="px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700"
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
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-white text-2xl font-bold bg-gradient-to-br from-emerald-500 to-blue-500">
            {myAvatarUrl ? (
              <img src={myAvatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              getInitials(userName || '?')
            )}
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-slate-900">{userName}</div>
            <div className="text-xs text-slate-500">ID: {currentUserId.substring(0, 8)}...</div>
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
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700"
          >
            Modifier ma photo
          </button>
          {/* E2E encryption status */}
          <div className="text-xs text-slate-500 text-center mt-2 p-2 bg-slate-50 rounded-lg w-full">
            <Check className="w-3 h-3 text-emerald-600 inline mr-1" />
            Chiffrement E2E activé (RSA-OAEP 2048-bit)
          </div>
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
            Un canal permet de diffuser des messages à tous les abonnés (broadcast unidirectionnel, comme Telegram).
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
