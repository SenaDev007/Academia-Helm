/**
 * ============================================================================
 * COMMUNITY SERVICE — Canaux, messages, réactions, sondages, présence
 * ============================================================================
 *
 * Espaces thématiques façon Discord/WhatsApp mais orienté business :
 *   - Canaux ANNOUNCEMENT : publication réservée à l'équipe (ADMIN+),
 *     réactions ouvertes aux membres (conseils quotidiens, annonces)
 *   - Canaux TEXT : discussion libre
 *   - Canaux RESTRICTED : publication + affichage modérés (témoignages)
 *
 * Conventions sécurité :
 *   - Édition : auteur uniquement (contenu) ; équipe : épinglage
 *   - Suppression : auteur ou MODERATOR+ (soft delete)
 *   - Messages pollués : jamais renvoyés (is_deleted filtré SQL)
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CommunityRepository } from './community.repository';
import { randomUUID } from 'crypto';

const TEAM_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'];
const isTeam = (role: string) => TEAM_ROLES.includes(role);

/** Canaux v2 : tri salon d'abord, puis groupes, par position */
const GROUP_ORDER: Record<string, number> = { SALON: 0, ADMINS: 1, TEACHERS: 2, CUSTOM: 3 };

@Injectable()
export class CommunityService {
  constructor(private readonly repo: CommunityRepository) {}

  // ─────────────────────────── Canaux ───────────────────────────

  /**
   * ⭐ v2 — Canaux visibles par un membre : espaces GLOBaux + les canaux
   * de SES écoles (salon + groupes autorisés selon son rôle école).
   *
   * RBAC :
   *   - salon école (ANNOUNCEMENT) : lecture = rattachés école ;
     *     publication = admins école + équipe plateforme
   *   - groupe ADMINS : visibilité/publication = rattachés ADMIN école + équipe
   *   - groupe TEACHERS : visibilité/publication = rattachés TEACHER école + équipe
   *   - canaux GLOBAL : règles v1 (annonces réservées équipe)
   */
  async channelsForMember(member: { id: string; role: string }) {
    const allChannels = (await this.repo.listChannels()) as any[];
    const schools = (await this.repo.memberSchools(member.id)) as any[];
    const schoolMap = new Map(schools.map((s) => [s.tenant_id, s]));

    const visible = allChannels.filter((c) => {
      if (c.scope !== 'SCHOOL') return true; // canaux globaux (v1)
      const school = schoolMap.get(c.tenant_id);
      if (!school) return false; // pas rattaché à cette école → invisible
      if (c.group_kind === 'ADMINS') return school.school_role === 'ADMIN';
      if (c.group_kind === 'TEACHERS') return school.school_role === 'TEACHER';
      return true; // salon de l'école + groupes custom
    });

    const ids = visible.map((c) => c.id);
    const activity = (await this.repo.channelLastActivity(ids)) as any[];
    const unread = (await this.repo.unreadCountsScoped(member.id, ids)) as any[];
    const previews = (await this.repo.lastPreviews(ids)) as any[];

    const actMap = new Map(activity.map((a) => [a.channel_id, a]));
    const unreadMap = new Map(unread.map((u) => [u.channel_id, u.unread]));
    const previewMap = previews;

    const channels = visible.map((c) => {
      const school = c.tenant_id ? schoolMap.get(c.tenant_id) : null;
      const isAdminOfSchool = school?.school_role === 'ADMIN';
      const isTeamMember = isTeam(member.role);
      let canPost: boolean;
      if (c.scope === 'SCHOOL') {
        if (c.group_kind === 'SALON') {
          // Annonces générales de l'école : admins de l'école + équipe
          canPost = isTeamMember || isAdminOfSchool;
        } else {
          // Groupes : la visibilité a déjà filtré les non-membres → publication libre
          canPost = true;
        }
      } else {
        canPost = c.type === 'ANNOUNCEMENT' ? isTeamMember : true;
      }
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        icon: c.icon,
        type: c.type,
        position: c.position,
        scope: c.scope ?? 'GLOBAL',
        tenantId: c.tenant_id ?? null,
        tenantName: c.tenant_id
          ? (school?.tenant_name ?? school?.school_name ?? c.name)
          : null,
        groupKind: c.group_kind ?? null,
        parentId: c.parent_id ?? null,
        autoManaged: c.auto_managed ?? false,
        lastMessageAt: actMap.get(c.id)?.last_message_at ?? c.last_message_at ?? null,
        messageCount: actMap.get(c.id)?.message_count ?? 0,
        unread: unreadMap.get(c.id) ?? 0,
        preview: previewMap.find((p) => p.channel_id === c.id)?.preview ?? null,
        canPost,
      };
    });

    // ⭐ v2 — Regroupement structuré : général (toutes les écoles) + écoles
    const globalChannels = channels
      .filter((c) => c.scope === 'GLOBAL')
      .sort((a, b) => a.position - b.position);
    const schoolSections = [] as any[];
    const byTenant = new Map<string, any[]>();
    for (const c of channels.filter((ch) => ch.scope === 'SCHOOL')) {
      if (!byTenant.has(c.tenantId)) byTenant.set(c.tenantId, []);
      byTenant.get(c.tenantId).push(c);
    }
    for (const [tenantId, list] of byTenant) {
      list.sort((a: any, b: any) =>
        (GROUP_ORDER[a.groupKind] ?? 9) - (GROUP_ORDER[b.groupKind] ?? 9) || a.position - b.position);
      const salon = list.find((c: any) => c.groupKind === 'SALON');
      schoolSections.push({
        tenantId,
        tenantName: salon?.tenantName ?? list[0].tenantName,
        channels: list,
      });
    }

    const mySchools = schools.map((s) => ({
      tenantId: s.tenant_id,
      tenantName: s.tenant_name ?? s.school_name,
      tenantSlug: s.tenant_slug,
      schoolRole: s.school_role,
    }));

    return { channels, globalChannels, schoolSections, schools: mySchools };
  }

  private async lastPreviews(channelIds: string[]) {
    if (!channelIds.length) return [];
    return this.repo.lastPreviews(channelIds);
  }

  /**
   * ⭐ v2 — Accès à un canal scolaire : membre rattaché à l'école avec le
   * rôle requis (ADMINS → school_role ADMIN, TEACHERS → TEACHER),
   * l'équipe plateforme voit tout. Renvoie le contexte école du canal.
   */
  private async schoolChannelAccess(
    channel: any,
    member: { id: string; role: string },
  ): Promise<{ allowed: boolean; schoolRole?: string }> {
    if ((channel.scope ?? 'GLOBAL') !== 'SCHOOL') return { allowed: true };
    if (isTeam(member.role)) return { allowed: true };
    const schools = (await this.repo.memberSchools(member.id)) as any[];
    const school = schools.find((s) => s.tenant_id === channel.tenant_id);
    if (!school) return { allowed: false };
    if (channel.group_kind === 'ADMINS' && school.school_role !== 'ADMIN') return { allowed: false };
    if (channel.group_kind === 'TEACHERS' && school.school_role !== 'TEACHER') return { allowed: false };
    return { allowed: true, schoolRole: school.school_role };
  }

  async channelBySlug(slug: string, member: { id: string; role: string }) {
    const channel = await this.repo.findChannelBySlug(slug);
    if (!channel || !channel.is_active) {
      throw new NotFoundException('Canal introuvable');
    }
    const access = await this.schoolChannelAccess(channel, member);
    if (!access.allowed) {
      throw new ForbiddenException('Ce canal est réservé aux membres de cette école');
    }
    const isAdminOfSchool = access.schoolRole === 'ADMIN';
    const pinned = (await this.repo.listPinned(channel.id)) as any[];
    const canPost = (channel.scope ?? 'GLOBAL') === 'SCHOOL'
      ? (channel.group_kind === 'SALON' ? isTeam(member.role) || isAdminOfSchool : true)
      : (channel.type === 'ANNOUNCEMENT' ? isTeam(member.role) : true);
    return {
      id: channel.id,
      slug: channel.slug,
      name: channel.name,
      description: channel.description,
      icon: channel.icon,
      type: channel.type,
      scope: channel.scope ?? 'GLOBAL',
      tenantId: channel.tenant_id ?? null,
      groupKind: channel.group_kind ?? null,
      canPost,
      pinned: pinned.map((p: any) => ({
        id: p.id, content: p.content, type: p.type,
        author: p.member_display_name, createdAt: p.created_at,
      })),
    };
  }

  // ─────────────────────────── Messages ───────────────────────────

  async messages(slug: string, member: { id: string; role: string }, opts: { before?: string; since?: string; limit?: number }) {
    const channel = await this.repo.findChannelBySlug(slug);
    if (!channel) throw new NotFoundException('Canal introuvable');
    const access = await this.schoolChannelAccess(channel, member);
    if (!access.allowed) {
      throw new ForbiddenException('Ce canal est réservé aux membres de cette école');
    }
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const rows = (await this.repo.listMessages(channel.id, { ...opts, limit })) as any[];
    const hydrated = await this.hydrateMessages(rows.reverse(), member.id);
    return { channel: channel.slug, messages: hydrated, hasMore: rows.length === limit };
  }

  private async hydrateMessages(rows: any[], viewerId: string) {
    // Réponses : charger les parents référencés
    const replyIds = rows.map((r) => r.reply_to_id).filter(Boolean);
    const parents = new Map<string, any>();
    if (replyIds.length) {
      const parentRows = await Promise.all(
        [...new Set(replyIds)].map((id: string) => this.repo.findMessage(id)),
      );
      for (const p of parentRows) {
        if (p) parents.set(p.id, p);
      }
    }

    return rows.map((m) => {
      const parent = m.reply_to_id ? parents.get(m.reply_to_id) : null;
      const reactions = (m.reactions ?? []) as { emoji: string; memberId: string }[];
      const grouped: Record<string, { count: number; mine: boolean }> = {};
      for (const r of reactions) {
        grouped[r.emoji] = grouped[r.emoji] ?? { count: 0, mine: false };
        grouped[r.emoji].count += 1;
        if (r.memberId === viewerId) grouped[r.emoji].mine = true;
      }
      const poll = this.hydratePoll(m);
      return {
        id: m.id,
        channelId: m.channel_id,
        type: m.type,
        content: m.content,
        attachment: m.attachment_url
          ? { url: m.attachment_url, name: m.attachment_name, size: m.attachment_size, mime: m.attachment_mime }
          : null,
        replyTo: parent
          ? {
              id: parent.id,
              content: (parent as any).content,
              type: (parent as any).type,
              authorId: (parent as any).member_id,
            }
          : null,
        isPinned: m.is_pinned,
        isEdited: m.is_edited,
        isDeleted: m.is_deleted,
        createdAt: m.created_at,
        author: {
          id: m.member_id,
          displayName: m.member_display_name,
          role: m.member_role,
          memberType: m.member_type,
          avatarUrl: m.member_avatar_url,
        },
        reactions: grouped,
        poll,
        mine: m.member_id === viewerId,
      };
    });
  }

  private hydratePoll(m: any) {
    if (!m.poll) return null;
    const p = m.poll as any;
    return {
      id: p.id,
      question: p.question,
      isMulti: p.is_multi,
      expiresAt: p.expires_at,
      options: p.options ?? [],
    };
  }

  async postMessage(
    slug: string,
    member: { id: string; role: string },
    input: {
      content?: string; type?: string; replyToId?: string;
      attachmentUrl?: string; attachmentName?: string; attachmentSize?: number; attachmentMime?: string;
      poll?: { question: string; isMulti?: boolean; options: string[]; expiresAt?: string };
    },
  ) {
    const channel = await this.repo.findChannelBySlug(slug);
    if (!channel) throw new NotFoundException('Canal introuvable');

    // ⭐ v2 — RBAC scolaire : salon école (annonces) réservé aux admins de
    // l'école + équipe ; canaux globaux ANNOUNCEMENT réservés à l'équipe.
    const access = await this.schoolChannelAccess(channel, member);
    if (!access.allowed) {
      throw new ForbiddenException('Ce canal est réservé aux membres de cette école');
    }
    if ((channel.scope ?? 'GLOBAL') === 'SCHOOL' && channel.group_kind === 'SALON') {
      if (!isTeam(member.role) && access.schoolRole !== 'ADMIN') {
        throw new ForbiddenException('Annonces de l\u2019école : publication réservée aux administrateurs de l\u2019école');
      }
    } else if (channel.type === 'ANNOUNCEMENT' && !isTeam(member.role)) {
      throw new ForbiddenException('Canal d\u2019annonces : publication réservée à l\u2019équipe Academia Helm');
    }

    const isPoll = !!input.poll;
    if (!isPoll && !input.content?.trim() && !input.attachmentUrl) {
      throw new BadRequestException('Message vide');
    }
    if (isPoll) {
      if (!input.poll.question?.trim()) throw new BadRequestException('Question du sondage requise');
      const opts = (input.poll.options ?? []).map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) throw new BadRequestException('Au moins 2 options de réponse');
    }
    if (input.content && input.content.length > 8000) {
      throw new BadRequestException('Message trop long (8000 caractères maximum)');
    }

    if (input.replyToId) {
      const parent = await this.repo.findMessage(input.replyToId);
      if (!parent || parent.channel_id !== channel.id) {
        throw new BadRequestException('Message cible invalide');
      }
    }

    const message = await this.repo.insertMessage({
      channelId: channel.id,
      memberId: member.id,
      type: isPoll ? 'POLL' : input.type ?? (channel.type === 'ANNOUNCEMENT' ? 'ANNOUNCEMENT' : 'TEXT'),
      content: input.content?.trim() ?? null,
      attachmentUrl: input.attachmentUrl,
      attachmentName: input.attachmentName,
      attachmentSize: input.attachmentSize,
      attachmentMime: input.attachmentMime,
      replyToId: input.replyToId,
    });

    if (isPoll) {
      const options = input.poll!.options
        .map((o) => o.trim())
        .filter(Boolean)
        .map((label) => ({ id: randomUUID(), label }));
      await this.repo.insertPoll(
        message.id,
        input.poll!.question.trim(),
        !!input.poll!.isMulti,
        options,
        input.poll!.expiresAt ? new Date(input.poll!.expiresAt) : undefined,
      );
    }

    await this.repo.markRead(member.id, channel.id);
    return (await this.messages(slug, member, { limit: 1 })).messages[0] ?? null;
  }

  async editMessage(messageId: string, member: { id: string; role: string }, content: string) {
    const message = await this.repo.findMessage(messageId);
    if (!message || message.is_deleted) throw new NotFoundException('Message introuvable');
    if (message.member_id !== member.id) {
      throw new ForbiddenException('Seul l\u2019auteur peut modifier son message');
    }
    if (!content?.trim() || content.length > 8000) {
      throw new BadRequestException('Contenu invalide');
    }
    await this.repo.editMessage(messageId, content.trim(), message.content ?? '');
    return { id: messageId, edited: true };
  }

  async deleteMessage(messageId: string, member: { id: string; role: string }) {
    const message = await this.repo.findMessage(messageId);
    if (!message || message.is_deleted) throw new NotFoundException('Message introuvable');
    if (message.member_id !== member.id && !isTeam(member.role)) {
      throw new ForbiddenException('Suppression réservée à l\u2019auteur ou à l\u2019équipe');
    }
    await this.repo.softDeleteMessage(messageId);
    return { id: messageId, deleted: true };
  }

  async setPinned(messageId: string, member: { id: string; role: string }, pinned: boolean) {
    const message = await this.repo.findMessage(messageId);
    if (!message) throw new NotFoundException('Message introuvable');
    if (!isTeam(member.role)) {
      throw new ForbiddenException('Épinglage réservé à l\u2019équipe');
    }
    await this.repo.setPinned(messageId, pinned, member.id);
    return { id: messageId, pinned };
  }

  async toggleReaction(messageId: string, member: { id: string; role: string }, emoji: string) {
    const message = await this.repo.findMessage(messageId);
    if (!message || message.is_deleted) throw new NotFoundException('Message introuvable');
    const clean = (emoji ?? '').trim().slice(0, 12);
    if (!clean) throw new BadRequestException('Emoji requis');
    const added = await this.repo.toggleReaction(messageId, member.id, clean);
    return { id: messageId, emoji: clean, added };
  }

  // ─────────────────────────── Sondages ───────────────────────────

  async vote(messageId: string, member: { id: string; role: string }, optionIds: string[]) {
    const poll = await this.repo.findPollByMessage(messageId);
    if (!poll) throw new NotFoundException('Sondage introuvable');
    if (poll.expires_at && new Date(poll.expires_at) < new Date()) {
      throw new BadRequestException('Sondage expiré');
    }
    const validIds = ((poll.options ?? []) as any[]).map((o) => o.id);
    const requested = [...new Set(optionIds ?? [])].filter((id) => validIds.includes(id));
    if (!requested.length) throw new BadRequestException('Option invalide');
    if (!poll.is_multi && requested.length > 1) {
      throw new BadRequestException('Une seule option autorisée pour ce sondage');
    }
    await this.repo.votePoll(poll.id, requested, member.id, poll.is_multi);

    const results = (await this.repo.pollResults(poll.id)) as any[];
    const mine = (await this.repo.memberPollVotes(poll.id, member.id)) as any[];
    const totalVotes = results.reduce((acc, r) => acc + r.votes, 0);
    return {
      pollId: poll.id,
      totalVotes,
      results: ((poll.options ?? []) as any[]).map((o) => ({
        id: o.id,
        label: o.label,
        votes: results.find((r) => r.option_id === o.id)?.votes ?? 0,
        mine: mine.some((mv) => mv.option_id === o.id),
      })),
    };
  }

  // ─────────────────────────── Divers ───────────────────────────

  async markRead(slug: string, member: { id: string; role: string }) {
    const channel = await this.repo.findChannelBySlug(slug);
    if (!channel) throw new NotFoundException('Canal introuvable');
    await this.repo.markRead(member.id, channel.id);
    return { ok: true };
  }

  // ─────────────────── v2 : événements & lives ───────────────────

  /**
   * Lives / formations / ateliers visibles par le membre — dispatch :
   * GLOBAL (toutes les écoles), SCHOOL (salon de l'école), GROUP
   * (groupe admins/enseignants). Le filtrage suit exactement la
   * visibilité des canaux (donc des groupes) du membre.
   */
  async eventsForMember(member: { id: string; role: string }, opts: { status?: string[]; limit?: number } = {}) {
    const allChannels = (await this.repo.listChannels()) as any[];
    const schools = (await this.repo.memberSchools(member.id)) as any[];
    const schoolMap = new Map(schools.map((s) => [s.tenant_id, s]));
    const visibleChannelIds = allChannels
      .filter((c) => {
        if ((c.scope ?? 'GLOBAL') !== 'SCHOOL') return true;
        if (isTeam(member.role)) return true;
        const school = schoolMap.get(c.tenant_id);
        if (!school) return false;
        if (c.group_kind === 'ADMINS') return school.school_role === 'ADMIN';
        if (c.group_kind === 'TEACHERS') return school.school_role === 'TEACHER';
        return true;
      })
      .map((c) => c.id);
    const rows = (await this.repo.listEvents({
      status: opts.status ?? ['SCHEDULED', 'LIVE'],
      channelIds: visibleChannelIds,
      limit: opts.limit ?? 100,
    })) as any[];
    return rows.map((e) => this.hydrateEvent(e));
  }

  async eventById(id: string, member: { id: string; role: string }) {
    const rows = (await this.repo.listEvents({ channelIds: undefined, limit: 500 })) as any[];
    const e = rows.find((r) => r.id === id);
    if (!e) throw new NotFoundException('Événement introuvable');
    // Contrôle d'accès : canal ciblé visible ?
    if (e.channel_id) {
      const channel = await this.repo.findChannelById(e.channel_id);
      if (channel) {
        const access = await this.schoolChannelAccess(channel, member);
        if (!access.allowed) throw new ForbiddenException('Événement réservé aux membres de cette école');
      }
    }
    return this.hydrateEvent(e);
  }

  private hydrateEvent(e: any) {
    return {
      id: e.id,
      kind: e.kind,
      title: e.title,
      description: e.description,
      audience: e.audience,
      tenantId: e.tenant_id ?? null,
      tenantName: e.tenant_name ?? null,
      groupKind: e.group_kind ?? null,
      channelId: e.channel_id ?? null,
      channelSlug: e.channel_slug ?? null,
      channelName: e.channel_name ?? null,
      hostName: e.host_name ?? null,
      externalUrl: e.external_url ?? null,
      replayUrl: e.replay_url ?? null,
      scheduledAt: e.scheduled_at,
      startedAt: e.started_at ?? null,
      endedAt: e.ended_at ?? null,
      status: e.status,
      isLive: e.status === 'LIVE',
    };
  }

  /** Présence : membres vus dans les 5 dernières minutes */
  async presence() {
    const rows = (await this.repo.listMembers({ limit: 500 })) as any[];
    const now = Date.now();
    return rows
      .filter((m) => m.status === 'ACTIVE' && m.last_seen_at)
      .map((m) => ({
        id: m.id,
        displayName: m.display_name,
        memberType: m.member_type,
        online: now - new Date(m.last_seen_at).getTime() < 5 * 60 * 1000,
        lastSeenAt: m.last_seen_at,
      }))
      .sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || a.displayName.localeCompare(b.displayName))
      .slice(0, 200);
  }

  /** Aperçu public (landing sans auth) : anonymisé — canaux GLOBaux uniquement
   *  (⭐ v2 : les salons/groupes des écoles ne sont JAMAIS exposés publiquement) */
  async publicOverview() {
    const allChannels = (await this.repo.listChannels()) as any[];
    const channels = allChannels.filter((c) => (c.scope ?? 'GLOBAL') === 'GLOBAL');
    const activity = (await this.repo.channelLastActivity(channels.map((c) => c.id))) as any[];
    const counts = await this.repo.countMembers();
    const actMap = new Map(activity.map((a) => [a.channel_id, a]));
    return {
      channels: channels.map((c) => ({
        slug: c.slug, name: c.name, description: c.description, icon: c.icon, type: c.type,
        messageCount: actMap.get(c.id)?.message_count ?? 0,
        lastMessageAt: actMap.get(c.id)?.last_message_at ?? null,
      })),
      stats: {
        members: counts?.active ?? 0,
        clients: counts?.clients ?? 0,
        messages: counts ? activity.reduce((acc, a) => acc + a.message_count, 0) : 0,
        schools: (await this.repo.listActiveTenants() as any[]).length,
      },
    };
  }
}
