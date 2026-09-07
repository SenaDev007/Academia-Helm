'use client';

/**
 * ============================================================================
 * ADMIN PANEL — Cockpit marketing de la communauté (équipe)
 * ============================================================================
 *
 * 4 onglets :
 *   📅 Posts programmés : planifier les conseils quotidiens (le cœur de la
 *      stratégie — contenu éducatif régulier = autorité + confiance)
 *   👥 Membres : annuaire, tags PROSPECT/CLIENT/PARTNER, rôles, bannissement
 *   📊 Stats : croissance, engagement, top contributeurs, activité/canal
 *   🔗 Invitations : liens trackés par campagne (funnel e-commerce)
 * ============================================================================
 */

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock, Users, BarChart3, Link2, X, Plus, Trash2, Copy, Check,
  Loader2, RefreshCw, UserCheck, UserX,
} from 'lucide-react';
import {
  communityApi,
  type CommunityChannel, type CommunityMember, type ScheduledPost,
} from '@/lib/community/client';

type Tab = 'scheduled' | 'members' | 'stats' | 'invites';

interface AdminPanelProps {
  member: CommunityMember;
  channels: CommunityChannel[];
  onClose: () => void;
}

export function AdminPanel({ member, channels, onClose }: AdminPanelProps) {
  const [tab, setTab] = useState<Tab>('scheduled');

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'scheduled', label: 'Posts programmés', icon: CalendarClock },
    { id: 'members', label: 'Membres', icon: Users },
    { id: 'stats', label: 'Statistiques', icon: BarChart3 },
    { id: 'invites', label: 'Invitations', icon: Link2 },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-50">
      {/* Barre d'outils */}
      <div className="h-12 shrink-0 bg-white border-b border-slate-200 flex items-center gap-2 px-4">
        <BarChart3 size={15} className="text-navy" />
        <span className="font-bold text-[14px] text-slate-800">Pilotage communauté</span>
        <button onClick={onClose} className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Fermer">
          <X size={16} />
        </button>
      </div>

      {/* Onglets */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-4 flex gap-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-[12.5px] font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === t.id ? 'border-navy text-navy' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'scheduled' && <ScheduledTab channels={channels} member={member} />}
        {tab === 'members' && <MembersTab />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'invites' && <InvitesTab channels={channels} />}
      </div>
    </div>
  );
}

// ═══════════════════════ POSTS PROGRAMMÉS ═══════════════════════

function ScheduledTab({ channels, member }: { channels: CommunityChannel[]; member: CommunityMember }) {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelId, setChannelId] = useState('');
  const [content, setContent] = useState('');
  const [when, setWhen] = useState('');
  const [type, setType] = useState('ANNOUNCEMENT');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPosts(await communityApi.scheduledPosts());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!channelId && channels.length) {
      const conseils = channels.find((c) => c.slug === 'conseils-quotidiens') ?? channels[0];
      setChannelId(conseils.id);
    }
  }, [channels, channelId]);

  const schedule = async () => {
    if (!content.trim() || !when || !channelId) return;
    setBusy(true);
    setErr(null);
    try {
      // scheduledAt en ISO local
      await communityApi.schedulePost({
        channelId,
        content: content.trim(),
        type,
        scheduledAt: new Date(when).toISOString(),
      });
      setContent('');
      setWhen('');
      await load();
    } catch (e: any) {
      setErr(e?.message ?? 'Échec de la programmation');
    } finally {
      setBusy(false);
    }
  };

  const statusChip = (s: string) => {
    switch (s) {
      case 'PENDING': return 'bg-amber-100 text-amber-800';
      case 'SENT': return 'bg-emerald-100 text-emerald-800';
      case 'CANCELLED': return 'bg-slate-200 text-slate-600';
      case 'FAILED': return 'bg-red-100 text-red-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Création */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarClock size={15} className="text-navy" />
          <h3 className="font-bold text-[14px] text-slate-800">Programmer un post</h3>
          <span className="text-[11px] text-slate-400 ml-auto">Publié automatiquement à l\u2019heure choisie</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className="rounded-lg border border-slate-300 px-2.5 py-2 text-[12.5px] outline-none focus:border-navy">
            {channels.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-slate-300 px-2.5 py-2 text-[12.5px] outline-none focus:border-navy">
            <option value="ANNOUNCEMENT">Annonce (mis en avant)</option>
            <option value="TEXT">Message simple</option>
          </select>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="rounded-lg border border-slate-300 px-2.5 py-2 text-[12.5px] outline-none focus:border-navy" />
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder={'Conseil du jour…\n\n## Titre\n**Point clé** — détail\n- étape 1\n- étape 2'}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] outline-none focus:border-navy"
        />
        {err && <p className="text-[11px] text-red-600">{err}</p>}
        <div className="flex items-center justify-between">
          <p className="text-[10.5px] text-slate-400">Markdown léger : **gras**, ## titre, listes -, liens</p>
          <button
            onClick={schedule}
            disabled={busy || !content.trim() || !when}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-navy text-white text-[12.5px] font-medium disabled:opacity-40"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Programmer
          </button>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-navy" /></div>
      ) : posts.length === 0 ? (
        <p className="text-center text-[12px] text-slate-400 py-10">
          Aucun post programmé — planifiez le premier conseil quotidien ({member.displayName.split(' ')[0]} 😊).
        </p>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <div key={p.id} className="p-3.5 rounded-xl bg-white border border-slate-200 flex gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusChip(p.status)}`}>
                    {p.status === 'PENDING' ? 'À venir' : p.status === 'SENT' ? 'Publié' : p.status === 'FAILED' ? 'Échec' : p.status}
                  </span>
                  <span className="text-[11px] text-slate-500">📍 {p.channel_name}</span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(p.scheduled_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[12.5px] text-slate-700 line-clamp-3 whitespace-pre-wrap">{p.content}</p>
                {p.failure_reason && <p className="text-[10.5px] text-red-600 mt-1">{p.failure_reason}</p>}
              </div>
              {p.status === 'PENDING' && (
                <button
                  onClick={async () => {
                    await communityApi.updateScheduledPost(p.id, { status: 'CANCELLED' });
                    load();
                  }}
                  className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                  title="Annuler"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════ MEMBRES ═══════════════════════

function MembersTab() {
  const [members, setMembers] = useState<(CommunityMember & { lastSeenAt?: string | null; source?: string | null })[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      setMembers(await communityApi.adminMembers(q || undefined));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (id: string, p: { role?: string; memberType?: string; status?: string }) => {
    try {
      await communityApi.updateMember(id, p);
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...p } as any : m)));
    } catch (e: any) {
      alert(e?.message ?? 'Échec');
    }
  };

  return (
    <div className="space-y-3 max-w-3xl">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(query)}
          placeholder="Rechercher (nom, email, organisation)…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-[12.5px] outline-none focus:border-navy"
        />
        <button onClick={() => load(query)} className="px-3 rounded-lg border border-slate-300 text-slate-600 hover:border-navy">
          <RefreshCw size={13} />
        </button>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-navy" /></div>
      ) : (
        <div className="rounded-xl bg-white border border-slate-200 divide-y divide-slate-100">
          {members.map((m) => (
            <div key={m.id} className="p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-800 truncate">
                  {m.displayName}
                  {m.status === 'PENDING' && <span className="ml-2 text-[10px] text-amber-600">en attente</span>}
                  {m.status === 'BANNED' && <span className="ml-2 text-[10px] text-red-600">suspendu</span>}
                </p>
                <p className="text-[11px] text-slate-400 truncate">{m.email} {m.organization ? `· ${m.organization}` : ''}</p>
              </div>
              <select
                value={m.memberType}
                onChange={(e) => patch(m.id, { memberType: e.target.value })}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-[11.5px] outline-none focus:border-navy"
                title="Tag business"
              >
                <option value="PROSPECT">Prospect</option>
                <option value="CLIENT">Client</option>
                <option value="PARTNER">Partenaire</option>
                <option value="TEAM">Équipe</option>
              </select>
              <select
                value={m.role}
                onChange={(e) => patch(m.id, { role: e.target.value })}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-[11.5px] outline-none focus:border-navy"
                title="Rôle"
              >
                <option value="MEMBER">Membre</option>
                <option value="MODERATOR">Modérateur</option>
                <option value="ADMIN">Admin</option>
                {m.role === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">Super admin</option>}
              </select>
              {m.status === 'ACTIVE' ? (
                <button onClick={() => patch(m.id, { status: 'BANNED' })} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Suspendre">
                  <UserX size={14} />
                </button>
              ) : (
                <button onClick={() => patch(m.id, { status: 'ACTIVE' })} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" title="Réactiver">
                  <UserCheck size={14} />
                </button>
              )}
            </div>
          ))}
          {members.length === 0 && <p className="p-8 text-center text-[12px] text-slate-400">Aucun membre</p>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════ STATISTIQUES ═══════════════════════

function StatsTab() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    communityApi.stats().then(setStats).catch(() => undefined);
  }, []);

  if (!stats) return <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-navy" /></div>;

  const m = stats.members ?? {};
  const t = stats.engagement?.totals ?? {};

  const kpis = [
    { label: 'Membres actifs', value: m.active ?? 0, hint: `${m.n ?? 0} inscrits` },
    { label: 'Clients', value: m.clients ?? 0, hint: `${m.prospects ?? 0} prospects` },
    { label: 'Actifs 7 j', value: m.weekly_active ?? 0, hint: 'présence' },
    { label: 'Messages 24 h', value: t.messages_24h ?? 0, hint: `${t.messages_7d ?? 0} sur 7 j` },
  ];

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {kpis.map((k) => (
          <div key={k.label} className="p-3.5 rounded-xl bg-white border border-slate-200">
            <p className="text-[10.5px] uppercase tracking-wide text-slate-400 font-bold">{k.label}</p>
            <p className="text-2xl font-black text-navy mt-1">{k.value}</p>
            <p className="text-[10px] text-slate-400">{k.hint}</p>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl bg-white border border-slate-200">
        <h4 className="text-[13px] font-bold text-slate-800 mb-3">Activité par canal</h4>
        <div className="space-y-2">
          {(stats.engagement?.perChannel ?? []).map((c: any) => {
            const max = Math.max(...(stats.engagement?.perChannel ?? []).map((x: any) => x.messages), 1);
            return (
              <div key={c.slug}>
                <div className="flex justify-between text-[11.5px] mb-0.5">
                  <span className="text-slate-600">{c.name}</span>
                  <span className="text-slate-400">{c.messages} msg</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-navy" style={{ width: `${(c.messages / max) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-white border border-slate-200">
        <h4 className="text-[13px] font-bold text-slate-800 mb-3">Top contributeurs (30 j)</h4>
        {(stats.engagement?.topContributors ?? []).length === 0 ? (
          <p className="text-[11.5px] text-slate-400">Pas encore de contribution sur 30 jours.</p>
        ) : (
          <div className="space-y-1.5">
            {(stats.engagement?.topContributors ?? []).map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-2.5 text-[12px]">
                <span className="w-5 h-5 rounded-full bg-navy text-white text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
                <span className="flex-1 text-slate-700 truncate">{c.display_name}</span>
                <span className="text-slate-400">{c.messages} msg</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════ INVITATIONS ═══════════════════════

function InvitesTab({ channels }: { channels: CommunityChannel[] }) {
  const [invites, setInvites] = useState<any[]>([]);
  const [memberType, setMemberType] = useState('CLIENT');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setInvites(await communityApi.listInvites());
    } catch {
      /* silencieux */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      await communityApi.createInvite({ memberType, note: note || undefined });
      setNote('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const copy = (url: string) => {
    const full = `${window.location.origin}${url}`;
    navigator.clipboard?.writeText(full).then(() => {
      setCopied(url);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2.5">
        <div className="flex items-center gap-2">
          <Link2 size={15} className="text-navy" />
          <h3 className="font-bold text-[14px] text-slate-800">Lien d\u2019invitation tracké</h3>
        </div>
        <p className="text-[11.5px] text-slate-500">
          Chaque lien taggue automatiquement les inscrits (prospect / client / partenaire) —
          placez-le sur la page tarification, dans l\u2019email post-achat ou en signature.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-2">
          <select value={memberType} onChange={(e) => setMemberType(e.target.value)} className="rounded-lg border border-slate-300 px-2.5 py-2 text-[12.5px] outline-none focus:border-navy">
            <option value="PROSPECT">Tag Prospect</option>
            <option value="CLIENT">Tag Client</option>
            <option value="PARTNER">Tag Partenaire</option>
          </select>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Campagne (ex : page-tarification)" className="rounded-lg border border-slate-300 px-2.5 py-2 text-[12.5px] outline-none focus:border-navy" />
          <button onClick={create} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-navy text-white text-[12.5px] font-medium disabled:opacity-40">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Créer
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {invites.map((i) => (
          <div key={i.id} className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold text-slate-800">
                {i.url}
              </p>
              <p className="text-[10.5px] text-slate-400">
                tag {i.member_type} · {i.uses_count} inscription{i.uses_count > 1 ? 's' : ''}
                {i.note ? ` · ${i.note}` : ''}
              </p>
            </div>
            <button onClick={() => copy(i.url)} className="p-1.5 rounded-lg text-slate-500 hover:text-navy hover:bg-slate-50" title="Copier le lien complet">
              {copied === i.url ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            </button>
            <button
              onClick={async () => {
                if (!confirm('Supprimer cette invitation ?')) return;
                await communityApi.deleteInvite(i.id);
                load();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
              title="Supprimer"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {invites.length === 0 && (
          <p className="text-center text-[12px] text-slate-400 py-8">Aucune invitation — créez le premier lien.</p>
        )}
      </div>
    </div>
  );
}
