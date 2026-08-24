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
  BarChart3, Download, Pencil, Star, MicOff, Volume2, RefreshCw, VideoOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useChatSocket } from '@/lib/chat/useChatSocket';
import { generateKeyPair, hasPrivateKey, encryptMessage, decryptMessage } from '@/lib/chat/crypto';
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
  // ⭐ Helm Connect V2.4 — Global Search
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  // ⭐ Helm Connect V2.6 — Categorized Attachment Menu (Documents/Images/Videos/Poll/Audio)
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  // ⭐ Helm Connect V2.6 — Poll creation modal
  const [showPollModal, setShowPollModal] = useState(false);
  // ⭐ Helm Connect V2.7 — Format toolbar + reply-to-message + message actions
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<{ id: string; senderName: string; content: string } | null>(null);

  // ⭐ V1.5: Forward modal state + inline edit state
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // ⭐ V1.5: Quick-reaction emoji bar (shown on hover)
  const [showReactionBar, setShowReactionBar] = useState<string | null>(null);
  const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
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
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ringtoneRef = useRef<{ ctx: AudioContext; interval: any } | null>(null);

  // ⭐ V2.5: Ringtone — plays a phone ring pattern using Web Audio API
  const playRingtone = useCallback(() => {
    if (ringtoneRef.current) return; // Already playing
    try {
      const ctx = new AudioContext();
      const interval = setInterval(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 440;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
        // Second tone (higher pitch)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.frequency.value = 550;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0, ctx.currentTime + 0.4);
        gain2.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.45);
        gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.8);
      }, 1500); // Ring every 1.5 seconds
      ringtoneRef.current = { ctx, interval };
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

  // ⭐ V2.5: Play/stop ringtone based on call state
  useEffect(() => {
    if (callState === 'outgoing' || callState === 'incoming') {
      playRingtone();
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
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallState('idle');
    setCallData(null);
    setCallDuration(0);
    setMuted(false);
    setVideoOff(false);
  }, []);

  // ⭐ V2.5: setupPeerConnection is declared AFTER `socket` to avoid TDZ
  //    (useCallback deps array references `socket` — must be initialized first).
  //    See the block after the socket declaration below.

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

    // Remote track → render in video element
    pc.ontrack = (event) => {
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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

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
    const content = text.trim(); // Keep HTML for sending — backend stores HTML
    const replyToId = replyToMessage?.id || undefined;
    setText('');
    setReplyToMessage(null);
    setSending(true);
    try {
      const res = await fetch(`/api/chat/conversations/${activeConvId}/messages/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUserId,
          content,
          ...(replyToId ? { replyToId } : {}),
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
      setMessages(prev => [...prev, newMsg]);
      // Rafraîchir la liste des convs pour updater le preview
      loadConversations();
    } catch (e: any) {
      toast.error("Échec d'envoi du message: " + e.message);
      setText(content); // Restore le texte non envoyé
      if (replyToId) setReplyToMessage({ id: replyToId, senderName: replyToMessage?.senderName || '', content: replyToMessage?.content || '' });
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
      content: msg.content || (msg.type === 'AUDIO' ? '🎤 Message vocal' : msg.type === 'IMAGE' ? '📷 Image' : msg.type === 'DOCUMENT' ? '📎 Document' : 'Message'),
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
    } catch (e: any) {
      toast.error('Échec réaction: ' + e.message);
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'VIDEO',
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // 3. Set up WebRTC peer connection + create offer
      const pc = setupPeerConnection(other.userId, callId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 4. Send offer to callee via Socket.io
      if (socket) {
        socket.emit('call:offer', { toUserId: other.userId, callId, callType, offer });
      }

      setCallData({ callId, callType, otherUserId: other.userId, otherUserName: otherName });
      setCallState('outgoing');
    } catch (e: any) {
      toast.error('Échec appel: ' + e.message);
      cleanupCall();
    }
  };

  // ⭐ V2.5: Accept incoming call
  const acceptCall = async (fromUserId: string, callId: string, callType: string, offer: any) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
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

  // ⭐ V2.5: Socket.io listeners for incoming call events
  useEffect(() => {
    if (!socket) return;
    const onCallOffer = (data: { fromUserId: string; callId: string; callType: string; offer: any }) => {
      if (callState !== 'idle') return; // Already in a call — auto-reject
      const otherName = activeConv?.participants?.find(p => p.userId === data.fromUserId);
      const name = otherName ? `${otherName.firstName || ''} ${otherName.lastName || ''}`.trim() : 'Utilisateur';
      setCallData({ callId: data.callId, callType: data.callType as 'AUDIO' | 'VIDEO', otherUserId: data.fromUserId, otherUserName: name });
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

    return () => {
      socket.off('call:offer', onCallOffer);
      socket.off('call:answer', onCallAnswer);
      socket.off('call:ice-candidate', onIceCandidate);
      socket.off('call:reject', onCallReject);
      socket.off('call:hangup', onCallHangup);
    };
  }, [socket, callState, callData, activeConv, cleanupCall]);

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
    handleSendAttachment(file, type);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
          isActive && 'bg-[#E6F4FF]'
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
            <span className="text-[10px] text-[#0958D9] font-semibold truncate block mt-0.5">
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
        {/* Header — compact, single-line title + actions */}
        <div className="px-3 py-2 border-b border-slate-100 bg-[#E6F4FF]/30">
          <div className="flex items-center justify-between gap-2">
            {/* Title — nowrap to prevent 2-line wrapping */}
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
              <img
                src="/icons/modules/helm-connect.png"
                alt="Helm Connect"
                className="w-4 h-4 object-contain"
              />
              <span className="truncate">Helm Connect</span>
              {/* ⭐ Socket.io connection indicator */}
              <span
                className={cn('w-2 h-2 rounded-full flex-shrink-0', socket.isConnected ? 'bg-green-400' : 'bg-slate-300')}
                title={socket.isConnected ? 'Connecté (temps réel)' : 'Déconnecté (polling)'}
              />
            </h2>
            {/* Actions — only 3 buttons to fit on mobile */}
            {!readOnly && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Primary actions always visible */}
                <button
                  onClick={() => setShowProfile(true)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                  title="Mon profil"
                >
                  <Settings className="w-4 h-4" />
                </button>
                {/* ⭐ New message (primary CTA) */}
                <button
                  onClick={() => setShowNewChat(true)}
                  className="p-1.5 rounded-lg bg-[#1677FF] text-white hover:bg-[#0958D9]"
                  title="Nouveau message"
                >
                  <Plus className="w-4 h-4" />
                </button>
                {/* ⭐ "More" dropdown — groups secondary actions */}
                <DropdownMenu
                  trigger={
                    <button
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                      title="Plus d'options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  }
                  items={[
                    { label: 'Notifications', icon: <BellOff className="w-4 h-4" />, onClick: () => setShowNotifPrefs(true) },
                    { label: 'Nouveau canal', icon: <Megaphone className="w-4 h-4" />, onClick: () => setShowNewChannel(true) },
                    { label: 'Annonces officielles', icon: <Bell className="w-4 h-4" />, onClick: () => setShowAnnouncements(true) },
                    { label: 'Recherche globale', icon: <Search className="w-4 h-4" />, onClick: () => setShowGlobalSearch(true) },
                    { label: 'Nouveau groupe', icon: <Users className="w-4 h-4" />, onClick: () => setShowNewGroup(true) },
                    { label: 'Invitations', icon: <UserPlus className="w-4 h-4" />, onClick: () => setShowInvitations(true) },
                  ]}
                />
              </div>
            )}
          </div>
          {/* ⭐ Helm Connect subtitle */}
          <p className="text-[10px] text-slate-500 italic mt-1 truncate">
            Communiquez. Collaborez. Restez connectés.
          </p>
          {/* Search (filtre local des convs) */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher une conversation..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#3B9EFF]/30"
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
                  className="px-3 py-1.5 bg-[#1677FF] text-white text-xs font-semibold rounded-lg hover:bg-[#0958D9]"
                >
                  + Nouveau message
                </button>
              )}
            </div>
          ) : (
            <>
              {/* ⭐ ROLE-BASED CATEGORY FILTERS (Tout / Enseignants / Parents / Administration) */}
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

              {/* ⭐ CATEGORIZE: Discussions (filtered by role) + Canaux + Groupes */}
              {(() => {
                // ⭐ Filter DIRECT conversations by role category
                const directConvs = conversations.filter(c => {
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
                const groupConvs = conversations.filter(c => c.type === 'GROUP');
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
      </div>

      {/* ═════ RIGHT PANE — Chat View ═════ */}
      {activeConv ? (
        <div className="flex-1 flex flex-col bg-slate-50">
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
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold truncate">
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
              onClick={() => handleStartCall('AUDIO')}
              className="p-1.5 rounded hover:bg-[#0958D9]"
              title="Appel audio"
            >
              <Phone className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleStartCall('VIDEO')}
              className="p-1.5 rounded hover:bg-[#0958D9]"
              title="Appel vidéo"
            >
              <Video className="w-4 h-4" />
            </button>
            {activeConv.type === 'GROUP' && (
              <button
                onClick={handleGenerateInviteLink}
                className="p-1.5 rounded hover:bg-[#0958D9]"
                title="Copier le lien d'invitation"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            )}
            {/* ⭐ Issue A5 FIX: Search button now opens the global search modal (was a no-op) */}
            <button
              onClick={() => setShowGlobalSearch(true)}
              className="p-1.5 rounded hover:bg-[#0958D9]"
              title="Rechercher dans les conversations"
            >
              <Search className="w-4 h-4" />
            </button>
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
                    <div className={cn('flex group', isMine ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm relative',
                        isMine
                          ? 'bg-[#3B9EFF] text-white rounded-br-sm'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                      )}>
                        {/* ⭐ Message actions — hover button (top right of bubble) */}
                        {!isReadOnly && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Show action menu
                              const menu = (e.currentTarget.parentElement?.querySelector('.msg-action-menu') as HTMLElement);
                              if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                            }}
                            className="absolute top-1 right-1 p-1 rounded-full bg-white/20 hover:bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Actions"
                          >
                            <MoreVertical className="w-3 h-3" />
                          </button>
                        )}
                        {/* ⭐ Action dropdown menu */}
                        {!isReadOnly && (
                          <div className="msg-action-menu absolute top-full right-0 mt-1 z-50 min-w-[160px] bg-white border border-slate-200 rounded-lg shadow-xl py-1" style={{ display: 'none' }}>
                            <button
                              onClick={() => handleMessageReply(msg.id)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              <Reply className="w-3.5 h-3.5" /> Répondre
                            </button>
                            {/* ⭐ V1.5: Réagir (emoji picker toggle — works on mobile too) */}
                            <button
                              onClick={() => {
                                setShowReactionBar(showReactionBar === msg.id ? null : msg.id);
                                const menu = document.querySelector('.msg-action-menu') as HTMLElement;
                                if (menu) menu.style.display = 'none';
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              <span className="text-sm">😊</span> Réagir
                            </button>
                            <button
                              onClick={() => {
                                const text = msg.content?.replace(/<[^>]*>/g, '') || '';
                                navigator.clipboard.writeText(text).then(() => toast.success('Message copié'));
                                const menu = document.querySelector('.msg-action-menu') as HTMLElement;
                                if (menu) menu.style.display = 'none';
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              <Copy className="w-3.5 h-3.5" /> Copier
                            </button>
                            <button
                              onClick={() => handleMessagePin(msg.id)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              <Pin className="w-3.5 h-3.5" /> Épingler
                            </button>
                            {/* ⭐ V1.5: Edit (sender only) */}
                            {isMine && msg.type === 'TEXT' && (
                              <button
                                onClick={() => {
                                  setEditingMessageId(msg.id);
                                  setEditContent(msg.content?.replace(/<[^>]*>/g, '') || '');
                                  const menu = document.querySelector('.msg-action-menu') as HTMLElement;
                                  if (menu) menu.style.display = 'none';
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Modifier
                              </button>
                            )}
                            {/* ⭐ V1.5: Forward */}
                            <button
                              onClick={() => handleMessageForward(msg.id)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              <Forward className="w-3.5 h-3.5" /> Transférer
                            </button>
                            {/* ⭐ V1.5: Important toggle */}
                            <button
                              onClick={() => handleToggleImportant(msg.id)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              <Star className="w-3.5 h-3.5" /> {(msg as any).isImportant ? 'Retirer marquage' : 'Marquer important'}
                            </button>
                            <button
                              onClick={() => handleMessageDeleteForMe(msg.id)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Supprimer pour moi
                            </button>
                            {isMine && (
                              <button
                                onClick={() => handleMessageDeleteForEveryone(msg.id)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Supprimer pour tous
                              </button>
                            )}
                          </div>
                        )}
                        {/* Sender name (for group) */}
                        {!isMine && activeConv.type === 'GROUP' && msg.sender && (
                          <div className="text-[10px] font-bold text-[#0958D9] mb-0.5">
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
                            dangerouslySetInnerHTML={{ __html: msg.content }}
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
                          return (
                            <div>
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
                                  dangerouslySetInnerHTML={{ __html: msg.content }}
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
                        {/* ⭐ V1.5: Quick reaction bar (appears on hover) */}
                        {!isReadOnly && (
                          <div className={cn(
                            'absolute -top-7 right-0 flex items-center gap-0.5 bg-white rounded-full shadow-lg border border-slate-200 px-1 py-0.5 transition-opacity',
                            showReactionBar === msg.id ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
                          )}>
                            {QUICK_EMOJIS.map(emoji => (
                              <button
                                key={emoji}
                                onClick={(e) => { e.stopPropagation(); handleToggleReaction(msg.id, emoji); }}
                                className="text-sm hover:scale-125 transition-transform p-0.5"
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
                                  <span>{emoji}</span>
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
                          {replyToMessage.content}
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
                  {/* ⭐ Attach button — opens categorized menu (V2.6) */}
                  <button
                    onClick={() => setShowAttachmentMenu(true)}
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-full flex-shrink-0"
                    title="Joindre un fichier"
                    disabled={readOnly}
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <div className="flex-1 min-w-0 bg-slate-100 rounded-2xl overflow-hidden">
                    <RichTextEditor
                      value={text}
                      onChange={(html) => {
                        setText(html);
                        handleTyping();
                        // Auto-stop typing after 5s of no input
                        if (stopTypingRef.current) clearTimeout(stopTypingRef.current);
                        stopTypingRef.current = setTimeout(() => handleStopTyping(), 5000);
                      }}
                      minHeight="36px"
                      placeholder="Tapez un message..."
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Transférer vers…</h3>
              <button onClick={() => setForwardMessageId(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
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
                        if (!res.ok) throw new Error(`Erreur ${res.status}`);
                        toast.success(`Message transféré vers ${disp.name}`);
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
      <video ref={localVideoRef} autoPlay playsInline muted className="hidden" />
      <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />

      {/* Incoming call — WhatsApp-style full-screen modal */}
      {callState === 'incoming' && callData && (
        <div className="fixed inset-0 bg-gradient-to-b from-slate-800 via-slate-900 to-black z-[60] flex flex-col items-center justify-between p-8">
          {/* Top: incoming label */}
          <div className="pt-8 text-center">
            <p className="text-sm text-emerald-400 font-medium">Appel entrant Helm Connect</p>
          </div>
          {/* Center: avatar + name */}
          <div className="text-center">
            <div className={cn('w-28 h-28 rounded-full mx-auto mb-5 flex items-center justify-center text-white text-4xl font-bold ring-4 ring-white/10', getAvatarColor(callData.otherUserName))}>
              {getInitials(callData.otherUserName)}
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">{callData.otherUserName}</h2>
            <p className="text-slate-400">{callData.callType === 'VIDEO' ? '📹 Appel vidéo' : '📞 Appel audio'}</p>
          </div>
          {/* Bottom: Accept / Reject */}
          <div className="flex justify-center gap-16 pb-10">
            <button onClick={() => rejectCall(callData.otherUserId, callData.callId)} className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg">
                <Phone className="w-7 h-7 rotate-[135deg]" />
              </div>
              <span className="text-xs text-slate-300">Refuser</span>
            </button>
            <button
              onClick={() => { const offer = (window as any)._pendingCallOffer?.offer; if (offer) acceptCall(callData.otherUserId, callData.callId, callData.callType, offer); }}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white shadow-lg animate-pulse">
                <Phone className="w-7 h-7" />
              </div>
              <span className="text-xs text-slate-300">Accepter</span>
            </button>
          </div>
        </div>
      )}

      {/* Outgoing + Active call — WhatsApp-style overlay */}
      {(callState === 'outgoing' || callState === 'active') && callData && (
        <div className="fixed inset-0 bg-gradient-to-b from-slate-800 via-slate-900 to-black z-[60] flex flex-col items-center justify-between">
          {/* Remote video (full screen for VIDEO calls when active) */}
          {callData.callType === 'VIDEO' && callState === 'active' && (
            <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
          )}
          {/* Top bar: name + encrypted indicator */}
          <div className="absolute top-0 left-0 right-0 p-4 pt-6 flex items-center justify-center gap-2 z-10">
            <span className="text-white font-bold text-lg">{callData.otherUserName}</span>
            {callState === 'active' && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                🔒 <span className="hidden sm:inline">Chiffré de bout en bout</span>
              </span>
            )}
          </div>
          {/* Center: avatar (for AUDIO calls or outgoing VIDEO) */}
          {(callData.callType === 'AUDIO' || callState !== 'active') && (
            <div className="text-center z-10 pt-20">
              <div className={cn('w-32 h-32 rounded-full mx-auto mb-5 flex items-center justify-center text-white text-5xl font-bold ring-4 ring-white/10', getAvatarColor(callData.otherUserName))}>
                {getInitials(callData.otherUserName)}
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">{callData.otherUserName}</h2>
              <p className="text-slate-400">
                {callState === 'outgoing' ? 'Appel en cours…' : `${Math.floor(callDuration / 60)}:${(callDuration % 60).toString().padStart(2, '0')}`}
              </p>
              <p className="text-xs text-slate-500 mt-1">{callData.callType === 'VIDEO' ? '📹 Appel vidéo' : '📞 Appel audio'} — Helm Connect</p>
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
              className={cn('absolute bottom-32 right-4 w-28 h-40 rounded-2xl object-cover border-2 border-white/20 z-20', videoOff && 'opacity-30')}
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
          {/* Bottom control bar — WhatsApp-style pill */}
          <div className="w-full pb-10 flex justify-center z-30">
            <div className="flex items-center gap-2 px-6 py-4 rounded-full bg-black/50 backdrop-blur-md">
              {/* Mute */}
              {callState === 'active' && (
                <button onClick={toggleMute} className="flex flex-col items-center gap-1 px-3">
                  <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors', muted ? 'bg-white' : 'bg-white/20')}>
                    {muted ? <MicOff className="w-5 h-5 text-slate-900" /> : <Mic className="w-5 h-5" />}
                  </div>
                  <span className="text-[10px] text-white/80">{muted ? 'Activer' : 'Micro'}</span>
                </button>
              )}
              {/* Video toggle (VIDEO calls only) */}
              {callState === 'active' && callData.callType === 'VIDEO' && (
                <button onClick={toggleVideo} className="flex flex-col items-center gap-1 px-3">
                  <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-white transition-colors', videoOff ? 'bg-white' : 'bg-white/20')}>
                    {videoOff ? <VideoOff className="w-5 h-5 text-slate-900" /> : <Video className="w-5 h-5" />}
                  </div>
                  <span className="text-[10px] text-white/80">{videoOff ? 'Caméra' : 'Vidéo'}</span>
                </button>
              )}
              {/* Speaker (always visible) */}
              {callState === 'active' && (
                <button className="flex flex-col items-center gap-1 px-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] text-white/80">Haut-parleur</span>
                </button>
              )}
              {/* End call — red button */}
              <button onClick={hangup} className="flex flex-col items-center gap-1 px-3">
                <div className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg">
                  <Phone className="w-6 h-6 rotate-[135deg]" />
                </div>
                <span className="text-[10px] text-white/80">Terminer</span>
              </button>
            </div>
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
