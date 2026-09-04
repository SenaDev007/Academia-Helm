'use client';

/**
 * ============================================================================
 * HELM CONNECT V2.4 — Global Search Modal
 * ============================================================================
 *
 * Recherche transversale dans Helm Connect :
 *   - Messages (contenu de mes conversations)
 *   - Personnes (users + guardians)
 *   - Groupes (mes groupes)
 *   - Fichiers (messages avec attachments)
 *   - Annonces (publiées)
 *
 * ⭐ Endpoints utilisés :
 *   GET /api/chat/v2/search?q=...&types=...&dateFrom=...&dateTo=...
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, X, Search, MessageSquare, User, Users, FileText, Megaphone,
  ExternalLink, ImageIcon, File as FileIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type SearchType = 'message' | 'person' | 'group' | 'file' | 'announcement';

interface SearchResult {
  messages: Array<{
    id: string;
    conversationId: string;
    conversationName?: string;
    senderName: string;
    content: string;
    type: string;
    createdAt: string;
    attachmentUrl?: string;
    attachmentName?: string;
  }>;
  people: Array<{
    userId: string;
    firstName: string;
    lastName: string;
    email?: string;
    role: string;
    roleLabel: string;
    isSameTenant: boolean;
  }>;
  groups: Array<{
    id: string;
    name: string;
    description?: string;
    participantCount: number;
    lastMessageAt?: string;
    lastMessagePreview?: string;
  }>;
  files: Array<{
    messageId: string;
    conversationId: string;
    conversationName?: string;
    senderName: string;
    attachmentUrl: string;
    attachmentName: string;
    attachmentMime: string;
    attachmentSize?: number;
    type: string;
    createdAt: string;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    body: string;
    priority: string;
    targetType: string;
    authorName: string;
    publishedAt: string;
    readCount: number;
    totalRecipients: number;
  }>;
  total: number;
}

const TAB_CONFIG: Array<{ key: SearchType; label: string; icon: React.ReactNode; color: string }> = [
  { key: 'message', label: 'Messages', icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'text-blue-600' },
  { key: 'person', label: 'Personnes', icon: <User className="w-3.5 h-3.5" />, color: 'text-violet-600' },
  { key: 'group', label: 'Groupes', icon: <Users className="w-3.5 h-3.5" />, color: 'text-emerald-600' },
  { key: 'file', label: 'Fichiers', icon: <FileText className="w-3.5 h-3.5" />, color: 'text-amber-600' },
  { key: 'announcement', label: 'Annonces', icon: <Megaphone className="w-3.5 h-3.5" />, color: 'text-rose-600' },
];

const PRIORITY_BADGES: Record<string, { bg: string; text: string; label: string; emoji: string }> = {
  URGENT: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'URGENT', emoji: '🔴' },
  HIGH: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'IMPORTANT', emoji: '⚠️' },
  NORMAL: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'ANNONCE', emoji: '📢' },
  LOW: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'INFO', emoji: 'ℹ️' },
};

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days}j`;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export default function GlobalSearchModal({
  currentUserId,
  onClose,
  onOpenConversation,
  onOpenAnnouncement,
}: {
  currentUserId: string;
  onClose: () => void;
  onOpenConversation?: (conversationId: string) => void;
  onOpenAnnouncement?: (announcementId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchType | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<SearchResult | null>(null);

  const search = useCallback(async () => {
    if (query.trim().length < 2) {
      setResult(null);
      return;
    }
    setLoading(true);
    try {
      const types = activeTab === 'all' ? undefined : activeTab;
      const url = `/api/chat/v2/search?userId=${currentUserId}&q=${encodeURIComponent(query)}${types ? `&types=${types}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.backendError?.message || (err as any)?.message || `Erreur ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      toast.error('Échec : ' + e.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [query, activeTab, currentUserId]);

  useEffect(() => {
    const timeout = setTimeout(search, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const getInitials = (name: string) =>
    name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const renderMessage = (m: SearchResult['messages'][0]) => (
    <button
      key={`msg-${m.id}`}
      onClick={() => onOpenConversation?.(m.conversationId)}
      className="w-full p-3 hover:bg-slate-50 text-left border-b border-slate-100"
    >
      <div className="flex items-start gap-2">
        <MessageSquare className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-0.5">
            <span className="font-semibold truncate">{m.senderName}</span>
            <span>{formatRelative(m.createdAt)}</span>
          </div>
          <div className="text-sm text-slate-900 line-clamp-2">{m.content}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">↪ {m.conversationName || 'Conversation'}</div>
        </div>
      </div>
    </button>
  );

  const renderPerson = (p: SearchResult['people'][0]) => (
    <div
      key={`ppl-${p.userId}`}
      className="p-3 hover:bg-slate-50 border-b border-slate-100 cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
          {getInitials(`${p.firstName} ${p.lastName}`)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">
            {p.firstName} {p.lastName}
          </div>
          <div className="text-xs text-slate-500 truncate">{p.email}</div>
          <div className="text-[11px] text-cyan-700 font-semibold">{p.roleLabel}</div>
        </div>
        {p.isSameTenant ? (
          <span className="text-[10px] text-emerald-600 font-semibold">✓ Même école</span>
        ) : (
          <span className="text-[10px] text-amber-600 font-semibold">Autre école</span>
        )}
      </div>
    </div>
  );

  const renderGroup = (g: SearchResult['groups'][0]) => (
    <button
      key={`grp-${g.id}`}
      onClick={() => onOpenConversation?.(g.id)}
      className="w-full p-3 hover:bg-slate-50 text-left border-b border-slate-100"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white">
          <Users className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">{g.name}</div>
          {g.description && (
            <div className="text-xs text-slate-500 truncate">{g.description}</div>
          )}
          <div className="text-[10px] text-slate-400 mt-0.5">
            {g.participantCount} participant(s)
            {g.lastMessagePreview && ` • ${g.lastMessagePreview.substring(0, 30)}...`}
          </div>
        </div>
      </div>
    </button>
  );

  const renderFile = (f: SearchResult['files'][0]) => (
    <a
      key={`file-${f.messageId}`}
      href={f.attachmentUrl}
      target="_blank"
      rel="noreferrer"
      className="block p-3 hover:bg-slate-50 border-b border-slate-100"
    >
      <div className="flex items-start gap-2">
        {f.type === 'IMAGE' ? (
          <ImageIcon className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        ) : (
          <FileIcon className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">
            {f.attachmentName}
          </div>
          <div className="text-xs text-slate-500">
            {formatBytes(f.attachmentSize)} · {f.attachmentMime}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            ↪ {f.conversationName} · par {f.senderName} · {formatRelative(f.createdAt)}
          </div>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
      </div>
    </a>
  );

  const renderAnnouncement = (a: SearchResult['announcements'][0]) => (
    <button
      key={`ann-${a.id}`}
      onClick={() => onOpenAnnouncement?.(a.id)}
      className="w-full p-3 hover:bg-slate-50 text-left border-b border-slate-100"
    >
      <div className="flex items-start gap-2">
        <Megaphone className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', (PRIORITY_BADGES[a.priority] || PRIORITY_BADGES.NORMAL).bg, (PRIORITY_BADGES[a.priority] || PRIORITY_BADGES.NORMAL).text)}>
              {(PRIORITY_BADGES[a.priority] || PRIORITY_BADGES.NORMAL).emoji} {(PRIORITY_BADGES[a.priority] || PRIORITY_BADGES.NORMAL).label}
            </span>
            <span className="text-[10px] text-slate-400">{formatRelative(a.publishedAt)}</span>
          </div>
          <div className="text-sm font-bold text-slate-900 truncate">{a.title}</div>
          <div className="text-xs text-slate-700 line-clamp-2">{a.body}</div>
          {a.totalRecipients > 0 && (
            <div className="text-[10px] text-slate-400 mt-0.5">
              👁️ {a.readCount}/{a.totalRecipients} lus
            </div>
          )}
        </div>
      </div>
    </button>
  );

  const tabCount = (type: SearchType) => {
    if (!result) return 0;
    const key = `${type}s` as keyof SearchResult;
    const arr = result[key] as unknown as Array<any> | undefined;
    return arr?.length || 0;
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-[#E6F4FF]">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-[#1677FF]" />
              Recherche globale
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Messages · Personnes · Groupes · Fichiers · Annonces
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Search input */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              autoFocus
              type="text"
              placeholder="Rechercher dans Helm Connect..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1677FF]/30"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="px-3 pt-2 flex items-center gap-1 border-b border-slate-100 overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              'px-3 py-2 text-xs font-semibold rounded-t border-b-2 whitespace-nowrap',
              activeTab === 'all'
                ? 'border-[#1677FF] text-[#1677FF]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
          >
            Tout {!result ? '' : `(${result.total})`}
          </button>
          {TAB_CONFIG.map(tab => {
            const count = tabCount(tab.key);
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-3 py-2 text-xs font-semibold rounded-t border-b-2 flex items-center gap-1.5 whitespace-nowrap',
                  isActive
                    ? 'border-[#1677FF] text-[#1677FF]'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                )}
              >
                {tab.icon}
                {tab.label}
                {count > 0 && (
                  <span className={cn('px-1.5 py-0.5 rounded-full text-[9px] bg-slate-100', tab.color)}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : !result || result.total === 0 ? (
            <div className="py-12 text-center">
              <Search className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                {query.trim().length < 2
                  ? 'Tapez au moins 2 caractères'
                  : 'Aucun résultat'}
              </p>
            </div>
          ) : (
            <div>
              {activeTab === 'all' || activeTab === 'message' ? (
                <>
                  {activeTab === 'all' && result.messages.length > 0 && (
                    <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase bg-slate-50">Messages</div>
                  )}
                  {(activeTab === 'all' ? result.messages.slice(0, 5) : result.messages).map(renderMessage)}
                </>
              ) : null}
              {activeTab === 'all' || activeTab === 'person' ? (
                <>
                  {activeTab === 'all' && result.people.length > 0 && (
                    <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase bg-slate-50">Personnes</div>
                  )}
                  {(activeTab === 'all' ? result.people.slice(0, 5) : result.people).map(renderPerson)}
                </>
              ) : null}
              {activeTab === 'all' || activeTab === 'group' ? (
                <>
                  {activeTab === 'all' && result.groups.length > 0 && (
                    <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase bg-slate-50">Groupes</div>
                  )}
                  {(activeTab === 'all' ? result.groups.slice(0, 5) : result.groups).map(renderGroup)}
                </>
              ) : null}
              {activeTab === 'all' || activeTab === 'file' ? (
                <>
                  {activeTab === 'all' && result.files.length > 0 && (
                    <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase bg-slate-50">Fichiers</div>
                  )}
                  {(activeTab === 'all' ? result.files.slice(0, 5) : result.files).map(renderFile)}
                </>
              ) : null}
              {activeTab === 'all' || activeTab === 'announcement' ? (
                <>
                  {activeTab === 'all' && result.announcements.length > 0 && (
                    <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase bg-slate-50">Annonces</div>
                  )}
                  {(activeTab === 'all' ? result.announcements.slice(0, 5) : result.announcements).map(renderAnnouncement)}
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
