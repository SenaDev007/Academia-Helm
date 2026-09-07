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
  Loader2, RefreshCw, UserCheck, UserX, School, Radio,
} from 'lucide-react';
import {
  communityApi,
  type CommunityChannel, type CommunityMember, type ScheduledPost,
  type AdminSchoolSummary, type CommunityEvent,
} from '@/lib/community/client';

type Tab = 'scheduled' | 'lives' | 'schools' | 'members' | 'stats' | 'invites';

interface AdminPanelProps {
  member: CommunityMember;
  channels: CommunityChannel[];
  onClose: () => void;
}

export function AdminPanel({ member, channels, onClose }: AdminPanelProps) {
  const [tab, setTab] = useState<Tab>('scheduled');

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'scheduled', label: 'Posts programmés', icon: CalendarClock },
    { id: 'lives', label: 'Lives & formations', icon: Radio },
    { id: 'schools', label: 'Écoles', icon: School },
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
        {tab === 'lives' && <LivesTab />}
        {tab === 'schools' && <SchoolsTab />}
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
            <optgroup label="Toutes les écoles (général)">
              {channels.filter((c) => (c.scope ?? 'GLOBAL') === 'GLOBAL').map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </optgroup>
            {Array.from(new Set(channels.filter((c) => c.scope === 'SCHOOL').map((c) => c.tenantName))).map((tenantName) => (
              <optgroup key={tenantName} label={`École : ${tenantName}`}>
                {channels.filter((c) => c.scope === 'SCHOOL' && c.tenantName === tenantName).map((c) => (
                  <option key={c.id} value={c.id}>{c.groupKind === 'ADMINS' ? '🛡️' : c.groupKind === 'TEACHERS' ? '👨‍🏫' : c.icon} {c.name}</option>
                ))}
              </optgroup>
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

// ═══════════════════════ LIVES & FORMATIONS (v2) ═══════════════════════

/**
 * Planification des lives/formations/ateliers avec ciblage d'audience :
 *   GLOBAL → salon de toutes les écoles · SCHOOL → salon de l'école ·
 *   GROUP → groupe administrateurs/enseignants de l'école.
 * Le canal ciblé est résolu automatiquement + annonce postée dedans.
 */
function LivesTab() {
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<AdminSchoolSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    kind: 'LIVE',
    title: '',
    description: '',
    audience: 'GLOBAL',
    tenantId: '',
    groupKind: 'TEACHERS',
    externalUrl: '',
    scheduledAt: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ev, sc] = await Promise.all([
        communityApi.adminListEvents(),
        communityApi.adminSchools().catch(() => []),
      ]);
      setEvents(ev as any[]);
      setSchools(sc);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const create = async () => {
    if (!form.title.trim() || !form.scheduledAt) return;
    setBusy(true);
    setErr(null);
    try {
      await communityApi.adminCreateEvent({
        kind: form.kind as any,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        audience: form.audience as any,
        tenantId: form.audience !== 'GLOBAL' ? form.tenantId || undefined : undefined,
        groupKind: form.audience === 'GROUP' ? (form.groupKind as any) : undefined,
        externalUrl: form.externalUrl.trim() || undefined,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
      });
      setForm((f) => ({ ...f, title: '', description: '', externalUrl: '' }));
      await load();
    } catch (e: any) {
      setErr(e?.message ?? 'Échec de la création');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: 'LIVE' | 'ENDED' | 'CANCELLED', replayUrl?: string) => {
    try {
      await communityApi.adminUpdateEvent(id, { status, ...(replayUrl ? { replayUrl } : {}) });
      await load();
    } catch (e: any) {
      setErr(e?.message ?? 'Échec de la mise à jour');
    }
  };

  const audienceLabel = (e: CommunityEvent) => {
    if (e.audience === 'GLOBAL') return '🌍 Toutes les écoles';
    if (e.audience === 'SCHOOL') return `🏫 ${e.tenantName ?? ''}`;
    return `${e.groupKind === 'ADMINS' ? '🛡️' : '👨‍🏫'} ${e.groupKind === 'ADMINS' ? 'Admins' : 'Enseignants'} · ${e.tenantName ?? ''}`;
  };

  const statusChip: Record<string, string> = {
    SCHEDULED: 'bg-amber-100 text-amber-800',
    LIVE: 'bg-red-100 text-red-700',
    ENDED: 'bg-slate-200 text-slate-600',
    CANCELLED: 'bg-slate-200 text-slate-400',
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Création */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
        <div className="flex items-center gap-2">
          <Radio size={15} className="text-red-600" />
          <h3 className="font-bold text-[14px] text-slate-800">Planifier un live / une formation</h3>
          <span className="text-[11px] text-slate-400 ml-auto">Dispatché vers l&apos;audience choisie</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))} className="rounded-lg border border-slate-300 px-2.5 py-2 text-[12.5px]">
            <option value="LIVE">🔴 Live</option>
            <option value="FORMATION">🎓 Formation</option>
            <option value="ATELIER">🛠️ Atelier</option>
          </select>
          <select value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))} className="rounded-lg border border-slate-300 px-2.5 py-2 text-[12.5px]">
            <option value="GLOBAL">🌍 Toutes les écoles (général)</option>
            <option value="SCHOOL">🏫 Une école (salon de l&apos;école)</option>
            <option value="GROUP">👥 Un groupe d&apos;une école</option>
          </select>
          {form.audience !== 'GLOBAL' && (
            <select value={form.tenantId} onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))} className="rounded-lg border border-slate-300 px-2.5 py-2 text-[12.5px]">
              <option value="">— Choisir l&apos;école —</option>
              {schools.map((s) => (
                <option key={s.tenantId} value={s.tenantId}>{s.name}</option>
              ))}
            </select>
          )}
          {form.audience === 'GROUP' && (
            <select value={form.groupKind} onChange={(e) => setForm((f) => ({ ...f, groupKind: e.target.value }))} className="rounded-lg border border-slate-300 px-2.5 py-2 text-[12.5px]">
              <option value="TEACHERS">👨‍🏫 Groupe des enseignants</option>
              <option value="ADMINS">🛡️ Groupe des administrateurs</option>
            </select>
          )}
          <input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
            className="rounded-lg border border-slate-300 px-2.5 py-2 text-[12.5px]"
          />
        </div>
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Titre (ex : Formation — maîtriser la trésorerie scolaire)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] focus:border-navy outline-none"
        />
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Description (au programme…)"
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[12.5px] focus:border-navy outline-none"
        />
        <input
          value={form.externalUrl}
          onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value }))}
          placeholder="Lien du live (YouTube Live, Meet, Zoom…)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[12.5px] focus:border-navy outline-none"
        />
        {err && <p className="text-[11px] text-red-600">{err}</p>}
        <button
          onClick={create}
          disabled={busy || !form.title.trim() || !form.scheduledAt || (form.audience !== 'GLOBAL' && !form.tenantId)}
          className="px-4 py-2 rounded-lg bg-red-600 text-white text-[12.5px] font-semibold hover:bg-red-700 disabled:opacity-40 flex items-center gap-1.5"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Planifier + annoncer
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-navy" /></div>
      ) : events.length === 0 ? (
        <div className="p-8 rounded-xl bg-white border border-slate-200 text-center">
          <Radio className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm text-slate-500 font-medium mt-2">Aucun événement</p>
          <p className="text-xs text-slate-400 mt-1">Planifiez votre premier live — les formations et conseils restent généralisés dans les canaux.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <div key={e.id} className="p-3 rounded-xl bg-white border border-slate-200 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${statusChip[e.status]}`}>{e.status}</span>
                  <span className="text-[10.5px] text-slate-400">{audienceLabel(e)}</span>
                  <span className="text-[10.5px] text-slate-400">
                    · {new Date(e.scheduledAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="font-semibold text-[13px] text-slate-800 mt-0.5 truncate">{e.title}</p>
                {e.channelName && <p className="text-[10.5px] text-slate-400">→ {e.channelName}</p>}
              </div>
              <div className="flex gap-1.5 shrink-0">
                {e.status === 'SCHEDULED' && (
                  <button onClick={() => setStatus(e.id, 'LIVE')} className="px-2 py-1 rounded-lg bg-red-600 text-white text-[10.5px] font-bold hover:bg-red-700">
                    Démarrer
                  </button>
                )}
                {e.status === 'LIVE' && (
                  <button onClick={() => setStatus(e.id, 'ENDED', e.externalUrl ?? undefined)} className="px-2 py-1 rounded-lg bg-slate-700 text-white text-[10.5px] font-bold hover:bg-slate-800">
                    Terminer
                  </button>
                )}
                {e.status !== 'ENDED' && e.status !== 'CANCELLED' && (
                  <button onClick={() => setStatus(e.id, 'CANCELLED')} className="px-2 py-1 rounded-lg border border-slate-300 text-slate-500 text-[10.5px] hover:border-red-400 hover:text-red-500">
                    Annuler
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════ ÉCOLES (v2) ═══════════════════════

/**
 * Cockpit des canaux dynamiques par école : synchronisation (provisionne
 * salon + groupes pour toutes les écoles actives), vue synthèse et
 * annuaire des rattachés par école.
 */
function SchoolsTab() {
  const [schools, setSchools] = useState<AdminSchoolSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [schoolMembers, setSchoolMembers] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSchools(await communityApi.adminSchools());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    setErr(null);
    try {
      await communityApi.adminSyncSchools();
      await load();
    } catch (e: any) {
      setErr(e?.message ?? 'Échec de la synchronisation');
    } finally {
      setSyncing(false);
    }
  };

  const openSchool = async (tenantId: string) => {
    if (expanded === tenantId) {
      setExpanded(null);
      return;
    }
    setExpanded(tenantId);
    try {
      const res = await communityApi.adminSchoolMembers(tenantId);
      setSchoolMembers(res.members);
    } catch {
      setSchoolMembers([]);
    }
  };

  const groupIcon = (kind: string | null) =>
    kind === 'ADMINS' ? '🛡️' : kind === 'TEACHERS' ? '👨‍🏫' : kind === 'SALON' ? '🏫' : '👥';

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="p-4 rounded-xl bg-white border border-slate-200">
        <div className="flex items-center gap-2 flex-wrap">
          <School size={15} className="text-navy" />
          <h3 className="font-bold text-[14px] text-slate-800">Canaux dynamiques par école</h3>
          <button
            onClick={sync}
            disabled={syncing}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy text-white text-[11.5px] font-semibold hover:bg-navyl disabled:opacity-40"
          >
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Synchroniser les écoles
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
          Chaque école obtient automatiquement son salon (annonces générales de l&apos;établissement),
          son groupe <strong>administrateurs</strong> et son groupe <strong>enseignants</strong>. Les
          administrateurs/enseignants qui entrent dans la communauté depuis leur compte Academia Helm
          y sont rattachés automatiquement.
        </p>
        {err && <p className="text-[11px] text-red-600 mt-2">{err}</p>}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-navy" /></div>
      ) : (
        <div className="space-y-2">
          {schools.map((s) => (
            <div key={s.tenantId} className="rounded-xl bg-white border border-slate-200 overflow-hidden">
              <button onClick={() => openSchool(s.tenantId)} className="w-full p-3.5 flex items-center gap-3 hover:bg-slate-50 text-left">
                <div className="w-9 h-9 rounded-lg bg-navy text-white flex items-center justify-center text-sm">🏫</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[13.5px] text-slate-800 truncate">{s.name}</p>
                  <p className="text-[10.5px] text-slate-400">
                    {s.channels.length} canal{aposAux(s.channels.length)} · {s.members} membre{aposAux(s.members)} rattaché{aposAux(s.members)}
                    {' · '}{s.admins} admin{aposAux(s.admins)} · {s.teachers} enseignant{aposAux(s.teachers, 2)}
                  </p>
                </div>
                <span className="text-slate-300 text-xs">{expanded === s.tenantId ? '▾' : '▸'}</span>
              </button>
              {expanded === s.tenantId && (
                <div className="border-t border-slate-100 p-3 space-y-2 bg-slate-50">
                  <div className="flex flex-wrap gap-1.5">
                    {s.channels.map((c) => (
                      <span key={c.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600">
                        {groupIcon(c.groupKind)} {c.name}
                      </span>
                    ))}
                  </div>
                  <div className="space-y-1 max-h-56 overflow-y-auto">
                    {schoolMembers.length === 0 ? (
                      <p className="text-[11px] text-slate-400 text-center py-3">
                        Aucun membre rattaché — ils arrivent dès qu&apos;un admin/enseignant de cette école rejoint la communauté.
                      </p>
                    ) : (
                      schoolMembers.map((m: any) => (
                        <div key={m.memberId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white">
                          <span className="text-[11px]">{m.schoolRole === 'ADMIN' ? '🛡️' : '👨‍🏫'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-slate-700 truncate">{m.displayName}</p>
                            <p className="text-[10px] text-slate-400 truncate">{m.email}</p>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {m.lastSeenAt ? `vu ${new Date(m.lastSeenAt).toLocaleDateString('fr-FR')}` : 'jamais vu'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Accord pluriel léger : '' | 's' (n=2 → « enseignants » sans 's' final redondant) */
function aposAux(n: number, mode = 1): string {
  return n > 1 ? (mode === 2 ? 's' : 's') : '';
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
