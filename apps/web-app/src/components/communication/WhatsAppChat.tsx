'use client';

/**
 * ============================================================================
 * WHATSAPP CHAT — Composant de messagerie interne type WhatsApp
 * ============================================================================
 *
 * Fonctionnalités :
 *   - Liste des conversations (sidebar gauche)
 *   - Vue conversation (pane droite) avec bulles de messages
 *   - Envoi de messages texte
 *   - Envoi de fichiers (documents, images, audio)
 *   - Création de conversation 1-à-1 (recherche d'utilisateur)
 *   - Création de groupe (multi-sélection)
 *   - Statut de lecture (whatsapp blue ticks)
 *   - Recherche d'utilisateurs (intra + inter-écoles) + invitations
 *   - Polling pour nouveaux messages (toutes les 5s)
 *   - Socket.io sera ajouté en V2 pour le temps réel strict
 *
 * Sécurité :
 *   - Toutes les opérations passent par le BFF /api/chat/* (auth via cookies)
 *   - L'utilisateur doit être participant pour lire/écrire dans une conv
 * ============================================================================
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Loader2, Send, Search, Plus, Users, Paperclip, X, Check, CheckCheck,
  ArrowLeft, MoreVertical, Mic, FileText, Image as ImageIcon, Bell,
  UserPlus, MessageSquare, Phone, Video, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  tenantName?: string;
  isSameTenant: boolean;
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
  avatarUrl?: string;
} {
  if (conv.type === 'GROUP') {
    return { name: conv.name || 'Groupe sans nom', subtitle: `${conv.participants.length} membres` };
  }
  // DIRECT: l'autre participant
  const other = conv.participants.find(p => p.userId !== currentUserId);
  if (!other) return { name: 'Inconnu' };
  return {
    name: `${other.firstName || ''} ${other.lastName || ''}`.trim() || other.email || 'Inconnu',
    subtitle: other.role_label || other.email,
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

  // Modals
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  // Render
  // ───────────────────────────────────────────────────────────────────

  const height = heightClass || 'h-[calc(100vh-200px)]';

  return (
    <div className={cn('flex bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden', height)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        accept="image/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
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
            </h2>
            <div className="flex items-center gap-1">
              {!readOnly && (
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
            conversations.map(conv => {
              const display = getConversationDisplay(conv, currentUserId);
              const isActive = conv.id === activeConvId;
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
                    'w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0',
                    display.avatarUrl ? 'bg-slate-200' : getAvatarColor(display.name)
                  )}>
                    {display.avatarUrl ? (
                      <img src={display.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      getInitials(display.name)
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
                      {/* Badge non lus (placeholder) */}
                      <span className="text-[10px] text-emerald-600 font-bold">·</span>
                    </div>
                    {display.subtitle && conv.type === 'DIRECT' && (
                      <span className="text-[10px] text-slate-400">{display.subtitle}</span>
                    )}
                  </div>
                </button>
              );
            })
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
              'w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
              getAvatarColor(getConversationDisplay(activeConv, currentUserId).name)
            )}>
              {getInitials(getConversationDisplay(activeConv, currentUserId).name)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold truncate">
                {getConversationDisplay(activeConv, currentUserId).name}
              </h3>
              {activeConv.type === 'GROUP' ? (
                <p className="text-[10px] text-emerald-100">
                  {activeConv.participants.map(p => `${p.firstName || ''} ${p.lastName || ''}`.trim()).join(', ')}
                </p>
              ) : (
                <p className="text-[10px] text-emerald-100">
                  {getConversationDisplay(activeConv, currentUserId).subtitle || 'En ligne'}
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
                        {/* Timestamp + read receipt */}
                        <div className={cn(
                          'flex items-center gap-1 mt-0.5',
                          isMine ? 'justify-end text-emerald-50' : 'justify-end text-slate-400'
                        )}>
                          <span className="text-[10px]">{formatTime(msg.createdAt)}</span>
                          {isMine && (
                            msg.readBy && msg.readBy.length > 0
                              ? <CheckCheck className="w-3 h-3" />
                              : <Check className="w-3 h-3" />
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
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendText();
                }
              }}
              disabled={readOnly}
            />
            <button
              onClick={handleSendText}
              disabled={!text.trim() || sending}
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
    if (user.isSameTenant) {
      // Créer directement une conversation
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
      } catch (e: any) {
        toast.error("Échec: " + e.message);
      }
    } else {
      // Envoyer une invitation (cross-tenant)
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
        toast.success(`Invitation envoyée à ${user.firstName} ${user.lastName}`);
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
                    {user.role && ` · ${user.role}`}
                  </div>
                  {!user.isSameTenant && user.tenantName && (
                    <div className="text-[10px] text-amber-600 font-semibold">
                      Autre école : {user.tenantName}
                    </div>
                  )}
                </div>
                {sentInvites.has(user.userId) ? (
                  <span className="text-xs text-emerald-600 font-semibold">Invité</span>
                ) : user.isSameTenant ? (
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                ) : (
                  <UserPlus className="w-4 h-4 text-amber-600" />
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
