'use client';

import React, { useState } from 'react';
import {
  Inbox as InboxIcon,
  Search,
  Reply,
  Mail,
  MailOpen,
  Clock,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  Send,
  Paperclip,
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useInboundEmails, useEmailThread, type InboundEmail } from '@/hooks/useInboundEmails';

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getInitials(name: string | null | undefined, email: string) {
  if (name) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
}

function getAvatarColor(seed: string) {
  const colors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-purple-500',
    'bg-amber-500',
    'bg-pink-500',
    'bg-cyan-500',
    'bg-rose-500',
    'bg-indigo-500',
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ─── Composant principal ─────────────────────────────────────────────────

export default function CommunicationInboxPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedInboundId, setSelectedInboundId] = useState<string | null>(null);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, error, refetch } = useInboundEmails({
    initialFilters: {
      page,
      pageSize: 25,
      search: debouncedSearch || undefined,
    },
  });

  const inboundEmails = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 25);

  // Si on a sélectionné un thread, on récupère le thread complet
  const selectedEmail = inboundEmails.find((e) => e.id === selectedInboundId);
  const selectedThreadId = selectedEmail?.threadId || null;
  const { data: threadData, isLoading: isLoadingThread } = useEmailThread(selectedThreadId);

  return (
    <ModuleContentArea>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-6 bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-slate-200">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-3xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <InboxIcon size={32} />
            </div>
            <div>
              <h3 className="text-3xl font-black tracking-tight">Boîte de réception</h3>
              <p className="text-slate-400 font-medium">
                Réponses reçues des candidats, parents et staffs — automatiquement triées et threadées.
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all"
          >
            <Reply size={18} /> Actualiser
          </button>
        </div>

        {/* Layout 2 colonnes : liste + détail */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Liste des inbound emails */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher par expéditeur, sujet..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="p-12 flex items-center justify-center gap-3 text-slate-400">
                <Loader2 className="animate-spin" size={24} />
                <span className="text-sm font-medium">Chargement...</span>
              </div>
            ) : error ? (
              <div className="p-12 text-center text-rose-500">
                <AlertCircle size={32} className="mx-auto mb-2" />
                <p className="text-sm">{error}</p>
              </div>
            ) : inboundEmails.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <InboxIcon size={48} className="mx-auto mb-4 opacity-30" />
                <p className="font-bold mb-1">Aucune réponse reçue</p>
                <p className="text-xs">
                  Quand un candidat répond à un email envoyé par l'établissement,
                  sa réponse apparaîtra ici automatiquement.
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                  {inboundEmails.map((email) => {
                    const isSelected = selectedInboundId === email.id;
                    const initials = getInitials(email.fromName, email.fromEmail);
                    const avatarColor = getAvatarColor(email.fromEmail);
                    return (
                      <button
                        key={email.id}
                        onClick={() => setSelectedInboundId(email.id)}
                        className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${
                          isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
                          >
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-bold text-slate-800 text-xs truncate">
                                {email.fromName || email.fromEmail}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                                {formatDate(email.receivedAt)}
                              </div>
                            </div>
                            <div className="text-xs text-slate-600 font-medium truncate mt-0.5">
                              {email.subject}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate mt-1">
                              {email.textContent?.substring(0, 80) || '(HTML uniquement)'}
                            </div>
                            {email.originalEmail && (
                              <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                                <Reply size={10} />
                                <span className="truncate">
                                  Re: {email.originalEmail.subject}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Pagination */}
                <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    {total > 0
                      ? `${(page - 1) * 25 + 1}-${Math.min(page * 25, total)} sur ${total}`
                      : 'Aucun email'}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="p-2 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-white transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-bold px-3">
                      Page {page} / {Math.max(1, totalPages)}
                    </span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="p-2 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-white transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Panneau de détail / thread */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            {!selectedInboundId ? (
              <div className="p-12 text-center text-slate-400">
                <MailOpen size={48} className="mx-auto mb-4 opacity-30" />
                <p className="font-bold mb-1">Sélectionnez une réponse</p>
                <p className="text-xs">
                  Cliquez sur un email dans la liste pour voir la conversation complète.
                </p>
              </div>
            ) : isLoadingThread ? (
              <div className="p-12 flex items-center justify-center gap-3 text-slate-400">
                <Loader2 className="animate-spin" size={24} />
                <span className="text-sm font-medium">Chargement de la conversation...</span>
              </div>
            ) : threadData ? (
              <ThreadView
                threadData={threadData}
                onClose={() => {
                  setSelectedInboundId(null);
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </ModuleContentArea>
  );
}

// ─── Vue Conversation ────────────────────────────────────────────────────

function ThreadView({
  threadData,
  onClose,
}: {
  threadData: { outbound: any[]; inbound: any[]; chronological: any[] };
  onClose: () => void;
}) {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    setIsSending(true);
    try {
      // TODO: endpoint pour envoyer une réponse manuelle depuis l'UI
      // Pour l'instant, on simule juste
      await new Promise((resolve) => setTimeout(resolve, 800));
      setReplyText('');
      setShowReplyBox(false);
      // TODO: refetch thread
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[800px]">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Reply size={16} className="text-slate-400" />
          <span className="text-xs font-bold text-slate-600">
            Conversation ({threadData.chronological.length} messages)
          </span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
          <X size={16} />
        </button>
      </div>

      {/* Messages chronologiques */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
        {threadData.chronological.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            <p className="text-sm">Aucun message dans ce thread.</p>
          </div>
        ) : (
          threadData.chronological.map((msg: any) => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
      </div>

      {/* Box de réponse */}
      <div className="p-4 border-t border-slate-100 bg-white">
        {showReplyBox ? (
          <div className="space-y-3">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Votre réponse..."
              className="w-full p-3 border border-slate-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              autoFocus
            />
            <div className="flex items-center justify-between">
              <button className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                <Paperclip size={14} /> Joindre un fichier
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowReplyBox(false);
                    setReplyText('');
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || isSending}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Send size={12} />
                  )}
                  Envoyer
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowReplyBox(true)}
            className="w-full text-left p-3 bg-slate-50 rounded-xl text-sm text-slate-400 hover:bg-slate-100 transition-colors flex items-center gap-2"
          >
            <Reply size={14} /> Répondre à cette conversation...
          </button>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: any }) {
  const isOutbound = message._type === 'outbound';
  const date = isOutbound ? message.createdAt : message.receivedAt;
  const senderName = isOutbound
    ? message.fromName || 'Système'
    : message.fromName || message.fromEmail;
  const initials = getInitials(senderName, message.fromEmail || message.recipient || '');
  const avatarColor = getAvatarColor(senderName + (isOutbound ? 'sys' : 'ext'));

  return (
    <div className={`flex gap-3 ${isOutbound ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}
      >
        {initials}
      </div>
      <div className={`flex-1 max-w-[80%] ${isOutbound ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-slate-700">{senderName}</span>
          <span className="text-[10px] text-slate-400 font-mono">{formatDate(date)}</span>
        </div>
        <div
          className={`rounded-2xl p-3 text-sm ${
            isOutbound
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
          }`}
        >
          <div className="font-bold text-xs mb-1 opacity-80">{message.subject}</div>
          {message.textContent ? (
            <div className="whitespace-pre-wrap text-xs">{message.textContent}</div>
          ) : message.htmlContent ? (
            <div
              className="text-xs prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: message.htmlContent }}
            />
          ) : (
            <div className="text-xs opacity-60 italic">(Pas de contenu)</div>
          )}
        </div>
        {isOutbound && message.status && (
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            {message.status === 'SENT' && <CheckCircle2 size={10} />}
            {message.status === 'DELIVERED' && <CheckCircle2 size={10} />}
            {message.status === 'OPENED' && <MailOpen size={10} />}
            {message.status === 'BOUNCED' && <AlertCircle size={10} />}
            {message.status === 'FAILED' && <AlertCircle size={10} />}
            {message.status}
            {message.openCount > 0 && ` · ouvert ${message.openCount}x`}
          </div>
        )}
      </div>
    </div>
  );
}
