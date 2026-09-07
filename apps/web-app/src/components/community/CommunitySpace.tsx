'use client';

/**
 * ============================================================================
 * COMMUNITY SPACE — Espace communautaire Academia Helm (authentifié)
 * ============================================================================
 *
 * Layout 3 colonnes (responsive) façon Discord professionnel :
 *   ┌──────────┬───────────────────────┬──────────┐
 *   │ Canaux   │ Messages              │ Membres  │
 *   │ + profil │ (bulles, réactions,   │ (présence│
 *   │          │  sondages, épingles)  │  + pins) │
 *   └──────────┴───────────────────────┴──────────┘
 *
 * - Polling 10 s sur le canal ouvert (since=) + 20 s canaux/présence
 * - Réactions emoji, réponses, édition, épinglage (équipe), sondages
 *   (équipe), panneau admin intégré (posts programmés = marketing)
 * - Mobile : sidebar = drawer, membres masqués
 * ============================================================================
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare, Users, Megaphone, Pin, Reply, Pencil, Trash2, Smile,
  Send, LogOut, Hash, Star, Check, Loader2,
  BarChart3, X, Home, Crown, ShieldCheck,
} from 'lucide-react';
import {
  communityApi, CommunityError,
  type CommunityChannel, type CommunityMember, type CommunityMessage, type PresenceMember,
} from '@/lib/community/client';
import { PollCard } from './PollCard';
import { AdminPanel } from './AdminPanel';

const REACTION_SET = ['👍', '❤️', '🎉', '👏', '💡', '🔥', '🙏', '😊'];

const TYPE_BADGE: Record<string, { label: string; icon: any; cls: string }> = {
  PROSPECT: { label: 'Prospect', icon: Star, cls: 'bg-amber-100 text-amber-700' },
  CLIENT: { label: 'Client', icon: ShieldCheck, cls: 'bg-emerald-100 text-emerald-700' },
  PARTNER: { label: 'Partenaire', icon: Users, cls: 'bg-sky-100 text-sky-700' },
  TEAM: { label: 'Équipe', icon: Crown, cls: 'bg-navy text-white' },
};

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'à l\u2019instant';
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 604800) return `il y a ${Math.floor(s / 86400)} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function avatarColor(seed: string): string {
  const palette = ['bg-blue-600', 'bg-emerald-600', 'bg-violet-600', 'bg-rose-600', 'bg-amber-600', 'bg-cyan-600', 'bg-indigo-600'];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 997;
  return palette[h % palette.length];
}

/** Rendu léger markdown-ish : **gras**, titres ##, listes -, liens */
function RichContent({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const heading = line.match(/^#{1,3}\s+(.*)$/);
        if (heading) {
          return (
            <div key={i} className="font-bold text-[15px] text-navy pt-1">
              {heading[1]}
            </div>
          );
        }
        const bullet = line.match(/^[-•]\s+(.*)$/);
        const html = (bullet ? bullet[1] : line)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="underline text-blue-600 hover:text-blue-800">$1</a>');
        if (bullet) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-goldd mt-0.5">•</span>
              <span dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          );
        }
        return <div key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

interface MessageItemProps {
  message: CommunityMessage;
  member: CommunityMember;
  onReply: (m: CommunityMessage) => void;
  onReact: (id: string, emoji: string) => void;
  onEdit: (m: CommunityMessage) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
}

function MessageItem({ message: m, member, onReply, onReact, onEdit, onDelete, onPin }: MessageItemProps) {
  const [showReactions, setShowReactions] = useState(false);
  const isTeam = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'].includes(member.role);
  const isAnnouncement = m.type === 'ANNOUNCEMENT';

  return (
    <div
      className={`group flex gap-3 px-4 py-2.5 hover:bg-slate-50/80 transition-colors ${
        isAnnouncement ? 'bg-amber-50/40 border-l-4 border-gold' : ''
      } ${m.mine ? 'bg-blue-50/30' : ''}`}
    >
      {/* Avatar */}
      <div className={`shrink-0 w-9 h-9 rounded-xl ${avatarColor(m.author.displayName)} text-white flex items-center justify-center text-sm font-bold shadow-sm`}>
        {initials(m.author.displayName)}
      </div>

      {/* Corps */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-semibold text-[13.5px] text-slate-800">
            {m.author.displayName}
            {m.mine && <span className="ml-1 text-[10px] font-normal text-slate-400">(vous)</span>}
          </span>
          {m.author.memberType === 'TEAM' && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-navy text-white font-medium">
              <Crown size={9} /> Équipe
            </span>
          )}
          {isAnnouncement && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
              <Megaphone size={9} /> Annonce
            </span>
          )}
          <span className="text-[11px] text-slate-400">{timeAgo(m.createdAt)}</span>
          {m.isEdited && <span className="text-[10px] text-slate-400 italic">(modifié)</span>}
          {m.isPinned && <Pin size={11} className="text-goldd" />}
        </div>

        {/* Réponse à */}
        {m.replyTo && (
          <div className="mt-1 mb-1 pl-2 border-l-2 border-slate-200 text-[11.5px] text-slate-500">
            <Reply size={10} className="inline mr-1" />
            {m.replyTo.content?.slice(0, 120) ?? '(pièce jointe)'}
          </div>
        )}

        {/* Contenu */}
        {m.content && (
          <div className="text-[13.5px] text-slate-700 leading-relaxed break-words">
            <RichContent text={m.content} />
          </div>
        )}

        {/* Sondage */}
        {m.poll && <PollCard message={m} />}

        {/* Réactions existantes */}
        {Object.keys(m.reactions ?? {}).length > 0 && (
          <div className="mt-1.5 flex gap-1.5 flex-wrap">
            {Object.entries(m.reactions).map(([emoji, info]) => (
              <button
                key={emoji}
                onClick={() => onReact(m.id, emoji)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-all ${
                  info.mine
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span>{emoji}</span>
                <span className="font-medium">{info.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Actions au survol */}
        <div className="hidden group-hover:flex items-center gap-0.5 mt-1 -ml-1">
          <button
            onClick={() => setShowReactions((v) => !v)}
            title="Réagir"
            className="p-1.5 rounded-lg text-slate-400 hover:text-navy hover:bg-white"
          >
            <Smile size={14} />
          </button>
          <button onClick={() => onReply(m)} title="Répondre" className="p-1.5 rounded-lg text-slate-400 hover:text-navy hover:bg-white">
            <Reply size={14} />
          </button>
          {m.mine && m.content && (
            <button onClick={() => onEdit(m)} title="Modifier" className="p-1.5 rounded-lg text-slate-400 hover:text-navy hover:bg-white">
              <Pencil size={14} />
            </button>
          )}
          {(m.mine || isTeam) && (
            <button onClick={() => onDelete(m.id)} title="Supprimer" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-white">
              <Trash2 size={14} />
            </button>
          )}
          {isTeam && (
            <button onClick={() => onPin(m.id, !m.isPinned)} title={m.isPinned ? 'Désépingler' : 'Épingler'} className="p-1.5 rounded-lg text-slate-400 hover:text-goldd hover:bg-white">
              <Pin size={14} className={m.isPinned ? 'text-goldd' : ''} />
            </button>
          )}
        </div>

        {/* Palette réactions */}
        {showReactions && (
          <div className="mt-1 mb-1 p-1.5 bg-white rounded-xl border shadow-lg flex gap-1 flex-wrap w-fit">
            {REACTION_SET.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onReact(m.id, emoji);
                  setShowReactions(false);
                }}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-lg flex items-center justify-center transition-transform hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════ COMPOSANT PRINCIPAL ═══════════════════════

interface CommunitySpaceProps {
  initialSlug?: string;
}

export function CommunitySpace({ initialSlug }: CommunitySpaceProps) {
  const router = useRouter();
  const [member, setMember] = useState<CommunityMember | null>(null);
  const [authState, setAuthState] = useState<'loading' | 'ok' | 'anon'>('loading');
  const [channels, setChannels] = useState<CommunityChannel[]>([]);
  const [activeSlug, setActiveSlug] = useState<string>(initialSlug ?? '');
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [channelInfo, setChannelInfo] = useState<{ name: string; description: string | null; icon: string | null; type: string; canPost: boolean; pinned: any[] } | null>(null);
  const [presence, setPresence] = useState<PresenceMember[]>([]);
  const [composer, setComposer] = useState('');
  const [replyTo, setReplyTo] = useState<CommunityMessage | null>(null);
  const [editing, setEditing] = useState<CommunityMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'channels' | 'messages' | 'members'>('messages');
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPollComposer, setShowPollComposer] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const latestAtRef = useRef<string | null>(null);
  const stickToBottomRef = useRef(true);

  // ── Session ──
  useEffect(() => {
    communityApi
      .me()
      .then((m) => {
        setMember(m);
        setAuthState('ok');
      })
      .catch((e) => {
        setAuthState(e instanceof CommunityError && e.status === 401 ? 'anon' : 'anon');
      });
  }, []);

  // ── Canaux ──
  const refreshChannels = useCallback(async () => {
    try {
      const list = await communityApi.channels();
      setChannels(list);
      if (!activeSlug && list.length) {
        setActiveSlug(list[0].slug);
      }
    } catch {
      /* silencieux (polling) */
    }
  }, [activeSlug]);

  useEffect(() => {
    if (authState !== 'ok') return;
    refreshChannels();
    const id = setInterval(refreshChannels, 20000);
    return () => clearInterval(id);
  }, [authState, refreshChannels]);

  // ── Messages du canal actif ──
  const loadMessages = useCallback(async (slug: string, mode: 'full' | 'since') => {
    try {
      const res = await communityApi.messages(slug, mode === 'since' && latestAtRef.current ? { since: latestAtRef.current, limit: 50 } : { limit: 50 });
      if (mode === 'full') {
        setMessages(res.messages);
        latestAtRef.current = res.messages.at(-1)?.createdAt ?? null;
        stickToBottomRef.current = true;
      } else if (res.messages.length) {
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...res.messages.filter((m) => !seen.has(m.id))];
        });
        latestAtRef.current = res.messages.at(-1)!.createdAt;
      }
      // unread → 0 sur ce canal
      setChannels((prev) => prev.map((c) => (c.slug === slug ? { ...c, unread: 0 } : c)));
    } catch {
      /* silencieux */
    }
  }, []);

  useEffect(() => {
    if (authState !== 'ok' || !activeSlug) return;
    setLoadingMessages(true);
    latestAtRef.current = null;
    communityApi
      .channel(activeSlug)
      .then((info) => setChannelInfo(info))
      .catch(() => setChannelInfo(null));
    loadMessages(activeSlug, 'full').finally(() => setLoadingMessages(false));
    communityApi.markRead(activeSlug).catch(() => undefined);
    const id = setInterval(() => loadMessages(activeSlug, 'since'), 10000);
    return () => clearInterval(id);
  }, [authState, activeSlug, loadMessages]);

  // ── Présence ──
  useEffect(() => {
    if (authState !== 'ok') return;
    communityApi.presence().then(setPresence).catch(() => undefined);
    const id = setInterval(() => {
      communityApi.presence().then(setPresence).catch(() => undefined);
    }, 20000);
    return () => clearInterval(id);
  }, [authState]);

  // ── Scroll collant ──
  useEffect(() => {
    if (stickToBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Actions ──
  const send = async () => {
    const content = composer.trim();
    if ((!content && !editing) || sending) return;
    setSending(true);
    setError(null);
    try {
      if (editing) {
        await communityApi.editMessage(editing.id, content);
        setEditing(null);
      } else {
        await communityApi.postMessage(activeSlug, { content, replyToId: replyTo?.id });
        setReplyTo(null);
      }
      setComposer('');
      stickToBottomRef.current = true;
      await loadMessages(activeSlug, 'full');
      refreshChannels();
    } catch (e: any) {
      setError(e?.message ?? 'Envoi impossible');
    } finally {
      setSending(false);
    }
  };

  const react = async (id: string, emoji: string) => {
    try {
      await communityApi.react(id, emoji);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          const next = { ...m.reactions };
          const info = next[emoji];
          if (info) {
            if (info.mine) {
              if (info.count <= 1) delete next[emoji];
              else next[emoji] = { count: info.count - 1, mine: false };
            } else {
              next[emoji] = { count: info.count + 1, mine: true };
            }
          } else {
            next[emoji] = { count: 1, mine: true };
          }
          return { ...m, reactions: next };
        }),
      );
    } catch {
      /* silencieux */
    }
  };

  const del = async (id: string) => {
    if (!confirm('Supprimer ce message ?')) return;
    try {
      await communityApi.deleteMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (e: any) {
      setError(e?.message);
    }
  };

  const pin = async (id: string, pinned: boolean) => {
    try {
      await communityApi.pinMessage(id, pinned);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, isPinned: pinned } : m)));
    } catch (e: any) {
      setError(e?.message);
    }
  };

  const isTeam = member ? ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'].includes(member.role) : false;
  const canPost = channelInfo?.canPost ?? false;

  // ── Rendu ──
  if (authState === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-navy" />
          <p className="text-sm text-slate-500">Ouverture d\u2019Academia Community…</p>
        </div>
      </div>
    );
  }

  if (authState === 'anon') {
    router.replace('/community/login');
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* ═══ Top bar ═══ */}
      <header className="h-12 shrink-0 bg-navy text-white flex items-center gap-3 px-3 md:px-4 shadow-lg">
        <button onClick={() => setMobilePanel('channels')} className="md:hidden p-1.5 rounded-lg hover:bg-navyl lg:hidden">
          <Hash size={18} />
        </button>
        <a href="/" className="hidden md:flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 rounded-lg bg-gold flex items-center justify-center text-navy font-black text-sm">A</div>
          <span className="font-bold text-sm">Academia <span className="text-gold">Community</span></span>
        </a>
        <div className="flex-1" />
        {isTeam && (
          <button
            onClick={() => setShowAdmin((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showAdmin ? 'bg-gold text-navy' : 'hover:bg-navyl text-white'
            }`}
            title="Pilotage marketing (posts programmés, membres, stats)"
          >
            <BarChart3 size={14} />
            <span className="hidden sm:inline">Pilotage</span>
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg ${avatarColor(member!.displayName)} flex items-center justify-center text-[10px] font-bold`}>
            {initials(member!.displayName)}
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-[11px] font-semibold">{member!.displayName}</p>
            <p className="text-[9px] text-blue-200">
              {TYPE_BADGE[member!.memberType]?.label ?? member!.memberType}
            </p>
          </div>
          <button
            onClick={async () => {
              await fetch('/api/community/auth/logout', { method: 'POST' }).catch(() => undefined);
              router.replace('/community/login');
            }}
            className="p-1.5 rounded-lg hover:bg-navyl"
            title="Se déconnecter"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 relative">
        {/* ═══ Sidebar canaux ═══ */}
        <aside
          className={`${mobilePanel === 'channels' ? 'flex' : 'hidden'} md:flex absolute md:relative inset-0 md:inset-auto z-20 md:z-auto w-full md:w-64 shrink-0 flex-col bg-white border-r border-slate-200`}
        >
          <div className="p-3 border-b border-slate-100">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 px-2 pb-1">Canaux</p>
            <nav className="space-y-0.5">
              {channels.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveSlug(c.slug);
                    setMobilePanel('messages');
                    setShowAdmin(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                    c.slug === activeSlug ? 'bg-navy text-white shadow-sm' : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span className="text-base leading-none">{c.icon ?? '💬'}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-medium truncate">{c.name}</span>
                    {c.preview && c.slug !== activeSlug && (
                      <span className={`block text-[10px] truncate ${c.slug === activeSlug ? 'text-blue-200' : 'text-slate-400'}`}>
                        {c.preview}
                      </span>
                    )}
                  </span>
                  {c.unread > 0 && c.slug !== activeSlug && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-navy text-[10px] font-bold flex items-center justify-center">
                      {c.unread > 99 ? '99+' : c.unread}
                    </span>
                  )}
                  {c.type === 'ANNOUNCEMENT' && (
                    <Megaphone size={11} className={c.slug === activeSlug ? 'text-gold' : 'text-goldd shrink-0'} />
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-3 mt-auto border-t border-slate-100">
            <button
              onClick={() => setMobilePanel('members')}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100 text-[12px]"
            >
              <Users size={14} /> Membres & présence
            </button>
            <a href="/" className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100 text-[12px]">
              <Home size={14} /> Retour au site
            </a>
          </div>
        </aside>

        {/* ═══ Zone messages ═══ */}
        <main className={`${mobilePanel === 'messages' ? 'flex' : 'hidden'} md:flex flex-1 min-w-0 flex-col`}>
          {/* En-tête canal */}
          {showAdmin && isTeam ? (
            <AdminPanel member={member!} channels={channels} onClose={() => setShowAdmin(false)} />
          ) : (
            <>
              <div className="h-12 shrink-0 bg-white border-b border-slate-200 flex items-center gap-2.5 px-4">
                <span className="text-lg">{channelInfo?.icon ?? '💬'}</span>
                <div className="min-w-0">
                  <h1 className="font-bold text-[14px] text-slate-800 truncate">{channelInfo?.name ?? 'Chargement…'}</h1>
                  {channelInfo?.description && (
                    <p className="text-[11px] text-slate-400 truncate hidden sm:block">{channelInfo.description}</p>
                  )}
                </div>
                <div className="flex-1" />
                {channelInfo && channelInfo.pinned.length > 0 && (
                  <div className="hidden md:flex items-center gap-1 text-[11px] text-goldd">
                    <Pin size={12} /> {channelInfo.pinned.length} épinglé{channelInfo.pinned.length > 1 ? 's' : ''}
                  </div>
                )}
                <button onClick={() => setMobilePanel('members')} className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                  <Users size={16} />
                </button>
              </div>

              {/* Liste messages */}
              <div
                ref={scrollRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                }}
                className="flex-1 overflow-y-auto py-2"
              >
                {loadingMessages ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-navy" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-8 gap-2">
                    <MessageSquare className="w-10 h-10 text-slate-300" />
                    <p className="font-semibold text-slate-500 text-sm">Canal silencieux pour l\u2019instant</p>
                    <p className="text-xs text-slate-400 max-w-xs">
                      {canPost
                        ? 'Lancez la discussion — un conseil, une question, un retour d\u2019expérience.'
                        : 'Les publications de l\u2019équipe arriveront ici. Réagissez dès qu\u2019elles tombent !'}
                    </p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <MessageItem
                      key={m.id}
                      message={m}
                      member={member!}
                      onReply={setReplyTo}
                      onReact={react}
                      onEdit={setEditing}
                      onDelete={del}
                      onPin={pin}
                    />
                  ))
                )}
              </div>

              {/* Composer */}
              <div className="shrink-0 bg-white border-t border-slate-200 p-3">
                {error && <p className="text-[11px] text-red-600 mb-2 px-1">{error}</p>}
                {replyTo && (
                  <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-500 px-2 py-1.5 bg-slate-50 rounded-lg">
                    <Reply size={11} />
                    <span className="flex-1 truncate">Réponse à : {replyTo.content?.slice(0, 80) ?? '(sondage)'}</span>
                    <button onClick={() => setReplyTo(null)} className="p-1 hover:text-slate-700">
                      <X size={12} />
                    </button>
                  </div>
                )}
                {editing && (
                  <div className="mb-2 flex items-center gap-2 text-[11px] text-blue-700 px-2 py-1.5 bg-blue-50 rounded-lg">
                    <Pencil size={11} />
                    <span className="flex-1">Modification de votre message</span>
                    <button onClick={() => { setEditing(null); setComposer(''); }} className="p-1">
                      <X size={12} />
                    </button>
                  </div>
                )}

                {canPost ? (
                  <div className="flex items-end gap-2">
                    <textarea
                      value={composer}
                      onChange={(e) => setComposer(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      rows={Math.min(4, Math.max(1, composer.split('\n').length))}
                      placeholder={`Message dans ${channelInfo?.name ?? ''}… (Entrée pour envoyer)`}
                      className="flex-1 resize-none rounded-xl border border-slate-300 focus:border-navy focus:ring-2 focus:ring-navy/10 px-3.5 py-2.5 text-[13.5px] outline-none transition-colors"
                    />
                    {isTeam && !editing && (
                      <button
                        onClick={() => setShowPollComposer((v) => !v)}
                        title="Créer un sondage"
                        className="p-2.5 rounded-xl border border-slate-300 text-slate-500 hover:border-navy hover:text-navy"
                      >
                        <BarChart3 size={17} />
                      </button>
                    )}
                    <button
                      onClick={send}
                      disabled={sending || (!composer.trim() && !editing)}
                      className="p-2.5 rounded-xl bg-navy text-white hover:bg-navyl disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                      title={editing ? 'Enregistrer' : 'Envoyer'}
                    >
                      {sending ? <Loader2 size={17} className="animate-spin" /> : editing ? <Check size={17} /> : <Send size={17} />}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 justify-center py-2.5 rounded-xl bg-amber-50 border border-amber-100">
                    <Megaphone size={14} className="text-amber-600" />
                    <p className="text-[12px] text-amber-800">
                      Canal d\u2019annonces — réagissez aux publications de l\u2019équipe
                    </p>
                  </div>
                )}

                {showPollComposer && isTeam && (
                  <PollComposer
                    onDone={async (poll) => {
                      await communityApi
                        .postMessage(activeSlug, { poll })
                        .catch((e) => setError(e?.message));
                      setShowPollComposer(false);
                      stickToBottomRef.current = true;
                      await loadMessages(activeSlug, 'full');
                    }}
                    onCancel={() => setShowPollComposer(false)}
                  />
                )}
              </div>
            </>
          )}
        </main>

        {/* ═══ Panneau membres ═══ */}
        <aside
          className={`${mobilePanel === 'members' ? 'flex' : 'hidden'} lg:flex absolute lg:relative inset-0 lg:inset-auto z-20 lg:z-auto w-full lg:w-60 shrink-0 flex-col bg-white border-l border-slate-200`}
        >
          <div className="h-12 flex items-center gap-2 px-4 border-b border-slate-100">
            <Users size={15} className="text-slate-400" />
            <span className="text-[12px] font-bold text-slate-600">Communauté</span>
            <span className="ml-auto lg:hidden">
              <button onClick={() => setMobilePanel('messages')} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                <X size={15} />
              </button>
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {presence
              .filter((p) => p.online)
              .slice(0, 50)
              .map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50">
                  <div className="relative">
                    <div className={`w-7 h-7 rounded-lg ${avatarColor(p.displayName)} text-white flex items-center justify-center text-[9px] font-bold`}>
                      {initials(p.displayName)}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-slate-700 truncate">{p.displayName}</p>
                    <p className="text-[9.5px] text-slate-400">{TYPE_BADGE[p.memberType]?.label ?? p.memberType}</p>
                  </div>
                </div>
              ))}
            {presence.filter((p) => p.online).length === 0 && (
              <p className="text-[11px] text-slate-400 text-center py-6 px-4">
                Personne en ligne — revenez plus tard, l\u2019équipe publie tous les jours.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ═══════════════════════ CRÉATEUR DE SONDAGE ═══════════════════════

function PollComposer({ onDone, onCancel }: { onDone: (poll: { question: string; options: string[]; isMulti?: boolean }) => void; onCancel: () => void }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isMulti, setIsMulti] = useState(false);

  const valid = question.trim().length > 3 && options.filter((o) => o.trim()).length >= 2;

  return (
    <div className="mt-3 p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
      <div className="flex items-center gap-2">
        <BarChart3 size={14} className="text-navy" />
        <span className="text-[12px] font-bold text-slate-700">Nouveau sondage</span>
        <button onClick={onCancel} className="ml-auto p-1 rounded text-slate-400 hover:text-slate-700">
          <X size={13} />
        </button>
      </div>
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Question (ex : quelle fonctionnalité ensuite ?)"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] focus:border-navy outline-none"
      />
      {options.map((o, i) => (
        <input
          key={i}
          value={o}
          onChange={(e) => setOptions((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
          placeholder={`Option ${i + 1}`}
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] focus:border-navy outline-none"
        />
      ))}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
          <input type="checkbox" checked={isMulti} onChange={(e) => setIsMulti(e.target.checked)} className="accent-navy" />
          Choix multiple
        </label>
        <button
          onClick={() => options.length < 8 && setOptions((p) => [...p, ''])}
          className="text-[11px] text-navy font-medium hover:underline"
        >
          + option
        </button>
        <button
          disabled={!valid}
          onClick={() => onDone({ question: question.trim(), options: options.filter((o) => o.trim()), isMulti })}
          className="px-3 py-1.5 rounded-lg bg-navy text-white text-[12px] font-medium disabled:opacity-40"
        >
          Publier
        </button>
      </div>
    </div>
  );
}
