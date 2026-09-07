/**
 * ============================================================================
 * COMMUNITY REPOSITORY — Couche SQL (table `community_*`, raw Prisma)
 * ============================================================================
 *
 * Suit le pattern du module communication (chat.service) : accès SQL
 * paramétré via PrismaService, tables créées par la migration
 * 20260907150000 + bootstrap idempotent. Aucune dépendance au schéma
 * Prisma généré (17k lignes — éviter l'OOM local de prisma generate).
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { randomUUID } from 'crypto';

export interface CommunityChannelRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  type: string;
  position: number;
  is_active: boolean;
  invite_token: string | null;
  last_message_at: Date | null;
}

export interface CommunityMessageRow {
  id: string;
  channel_id: string;
  member_id: string;
  type: string;
  content: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  attachment_mime: string | null;
  reply_to_id: string | null;
  is_pinned: boolean;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: Date;
  member_display_name?: string;
  member_role?: string;
  member_type?: string;
  member_avatar_url?: string | null;
}

@Injectable()
export class CommunityRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────── Membres ───────────────────────────

  async findMemberByEmail(email: string) {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM community_members WHERE lower(email) = lower($1) LIMIT 1`,
      email,
    );
    return (rows as any[])[0] ?? null;
  }

  async findMemberById(id: string) {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM community_members WHERE id = $1 LIMIT 1`,
      id,
    );
    return (rows as any[])[0] ?? null;
  }

  async insertMember(data: {
    email: string; passwordHash: string; displayName: string;
    firstName?: string; lastName?: string; organization?: string;
    country?: string; phone?: string; role?: string; memberType?: string;
    status?: string; source?: string; sourceMeta?: any;
  }) {
    const id = randomUUID();
    await this.prisma.$queryRawUnsafe(
      `INSERT INTO community_members
         (id, email, password_hash, display_name, first_name, last_name, organization,
          country, phone, role, member_type, status, source, source_meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      id, data.email, data.passwordHash, data.displayName,
      data.firstName ?? null, data.lastName ?? null, data.organization ?? null,
      data.country ?? null, data.phone ?? null,
      data.role ?? 'MEMBER', data.memberType ?? 'PROSPECT',
      data.status ?? 'ACTIVE', data.source ?? 'PUBLIC_JOIN',
      data.sourceMeta ? JSON.stringify(data.sourceMeta) : null,
    );
    return this.findMemberById(id);
  }

  async updateMember(id: string, patch: Record<string, any>) {
    const allowed = ['display_name', 'first_name', 'last_name', 'organization', 'country',
      'phone', 'bio', 'avatar_url', 'role', 'member_type', 'status', 'password_hash'];
    const keys = Object.keys(patch).filter((k) => allowed.includes(k));
    if (!keys.length) return this.findMemberById(id);
    const sets = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
    const values = keys.map((k) => patch[k]);
    await this.prisma.$queryRawUnsafe(
      `UPDATE community_members SET ${sets}, updated_at = NOW() WHERE id = $1`,
      id, ...values,
    );
    return this.findMemberById(id);
  }

  async listMembers(opts: { query?: string; memberType?: string; limit?: number; offset?: number }) {
    const conditions: string[] = [];
    const params: any[] = [];
    if (opts.query) {
      params.push(`%${opts.query}%`);
      conditions.push(
        `(display_name ILIKE $1 OR email ILIKE $1 OR organization ILIKE $1)`,
      );
    }
    if (opts.memberType) {
      params.push(opts.memberType);
      conditions.push(`member_type = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(opts.limit ?? 100, opts.offset ?? 0);
    return this.prisma.$queryRawUnsafe(
      `SELECT id, email, display_name, organization, country, phone, role, member_type,
              status, source, bio, last_seen_at, created_at
       FROM community_members ${where}
       ORDER BY created_at ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      ...params,
    );
  }

  async countMembers() {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS n, 
              count(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
              count(*) FILTER (WHERE member_type = 'CLIENT')::int AS clients,
              count(*) FILTER (WHERE member_type = 'PROSPECT')::int AS prospects,
              count(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '7 days')::int AS weekly_active
       FROM community_members`,
    );
    return (rows as any[])[0];
  }

  async bumpLastSeen(memberId: string) {
    await this.prisma.$queryRawUnsafe(
      `UPDATE community_members SET last_seen_at = NOW() WHERE id = $1`, memberId,
    );
  }

  // ─────────────────────────── Canaux ───────────────────────────

  async listChannels() {
    return this.prisma.$queryRawUnsafe(
      `SELECT * FROM community_channels WHERE is_active = true ORDER BY position ASC, created_at ASC`,
    );
  }

  async findChannelBySlug(slug: string) {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM community_channels WHERE slug = $1 LIMIT 1`, slug,
    );
    return (rows as any[])[0] ?? null;
  }

  async findChannelById(id: string) {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM community_channels WHERE id = $1 LIMIT 1`, id,
    );
    return (rows as any[])[0] ?? null;
  }

  async insertChannel(data: {
    slug: string; name: string; description?: string; icon?: string;
    type?: string; position?: number; inviteToken?: string;
  }) {
    const id = randomUUID();
    await this.prisma.$queryRawUnsafe(
      `INSERT INTO community_channels (id, slug, name, description, icon, type, position, invite_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      id, data.slug, data.name, data.description ?? null, data.icon ?? null,
      data.type ?? 'TEXT', data.position ?? 100, data.inviteToken ?? null,
    );
    return this.findChannelById(id);
  }

  async updateChannel(id: string, patch: Record<string, any>) {
    const allowed = ['name', 'description', 'icon', 'type', 'position', 'is_active', 'invite_token'];
    const keys = Object.keys(patch).filter((k) => allowed.includes(k));
    if (!keys.length) return this.findChannelById(id);
    const sets = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
    const values = keys.map((k) => patch[k]);
    await this.prisma.$queryRawUnsafe(
      `UPDATE community_channels SET ${sets}, updated_at = NOW() WHERE id = $1`, id, ...values,
    );
    return this.findChannelById(id);
  }

  async touchChannel(id: string) {
    await this.prisma.$queryRawUnsafe(
      `UPDATE community_channels SET last_message_at = NOW() WHERE id = $1`, id,
    );
  }

  /** ⭐ v2 — Positionnement scope/école/groupe d'un canal (groupes custom) */
  async setChannelScope(
    id: string,
    data: { scope: string; tenantId: string; groupKind: string; parentId: string | null; autoManaged?: boolean },
  ) {
    await this.prisma.$queryRawUnsafe(
      `UPDATE community_channels
       SET scope = $2, tenant_id = $3, group_kind = $4, parent_id = $5, auto_managed = $6, updated_at = NOW()
       WHERE id = $1`,
      id, data.scope, data.tenantId, data.groupKind, data.parentId, data.autoManaged ?? false,
    );
    return this.findChannelById(id);
  }

  // ─────────────────────────── Messages ───────────────────────────

  async listMessages(channelId: string, opts: { before?: string; limit?: number; since?: string }) {
    const params: any[] = [channelId];
    let where = `m.channel_id = $1 AND m.is_deleted = false`;
    if (opts.before) {
      params.push(opts.before);
      where += ` AND m.created_at < (SELECT created_at FROM community_messages WHERE id = $${params.length})`;
    }
    if (opts.since) {
      params.push(new Date(opts.since));
      where += ` AND m.created_at > $${params.length}`;
    }
    params.push(opts.limit ?? 50);
    return this.prisma.$queryRawUnsafe(
      `SELECT m.*, 
              mem.display_name AS member_display_name, mem.role AS member_role,
              mem.member_type AS member_type, mem.avatar_url AS member_avatar_url,
              (SELECT json_agg(json_build_object('emoji', r.emoji, 'memberId', r.member_id))
                 FROM community_reactions r WHERE r.message_id = m.id) AS reactions,
              (SELECT json_build_object('id', p.id, 'question', p.question, 'isMulti', p.is_multi,
                       'options', p.options, 'expiresAt', p.expires_at)
                 FROM community_polls p WHERE p.message_id = m.id) AS poll
       FROM community_messages m
       JOIN community_members mem ON mem.id = m.member_id
       WHERE ${where}
       ORDER BY m.created_at DESC
       LIMIT $${params.length}`,
      ...params,
    );
  }

  async findMessage(id: string) {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM community_messages WHERE id = $1 LIMIT 1`, id,
    );
    return (rows as any[])[0] ?? null;
  }

  async insertMessage(data: {
    channelId: string; memberId: string; type?: string; content?: string;
    attachmentUrl?: string; attachmentName?: string; attachmentSize?: number;
    attachmentMime?: string; replyToId?: string;
  }) {
    const id = randomUUID();
    await this.prisma.$queryRawUnsafe(
      `INSERT INTO community_messages
         (id, channel_id, member_id, type, content, attachment_url, attachment_name,
          attachment_size, attachment_mime, reply_to_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      id, data.channelId, data.memberId, data.type ?? 'TEXT', data.content ?? null,
      data.attachmentUrl ?? null, data.attachmentName ?? null,
      data.attachmentSize ?? null, data.attachmentMime ?? null, data.replyToId ?? null,
    );
    await this.touchChannel(data.channelId);
    return this.findMessage(id);
  }

  async softDeleteMessage(id: string) {
    await this.prisma.$queryRawUnsafe(
      `UPDATE community_messages SET is_deleted = true, deleted_at = NOW(), updated_at = NOW() WHERE id = $1`, id,
    );
  }

  async editMessage(id: string, newContent: string, previousContent: string) {
    // ⭐ $3::text — sans cast explicite, Postgres ne peut pas inférer le type
    //    du paramètre dans json_build_object (erreur 42P18 via Prisma P2010)
    await this.prisma.$queryRawUnsafe(
      `UPDATE community_messages SET content = $2, is_edited = true,
         edited_history = COALESCE(edited_history, '[]'::jsonb) ||
           jsonb_build_array(json_build_object('content', $3::text, 'at', NOW())),
         updated_at = NOW()
       WHERE id = $1`,
      id, newContent, previousContent ?? '',
    );
  }

  async setPinned(id: string, pinned: boolean, pinnedBy?: string) {
    await this.prisma.$queryRawUnsafe(
      `UPDATE community_messages SET is_pinned = $2, pinned_at = $3, pinned_by = $4, updated_at = NOW() WHERE id = $1`,
      id, pinned, pinned ? new Date() : null, pinned ? pinnedBy ?? null : null,
    );
  }

  async listPinned(channelId: string) {
    return this.prisma.$queryRawUnsafe(
      `SELECT m.id, m.content, m.created_at, m.type,
              mem.display_name AS member_display_name
       FROM community_messages m JOIN community_members mem ON mem.id = m.member_id
       WHERE m.channel_id = $1 AND m.is_pinned AND NOT m.is_deleted
       ORDER BY m.created_at DESC LIMIT 5`,
      channelId,
    );
  }

  async channelLastActivity(channelIds: string[]) {
    if (!channelIds.length) return [];
    return this.prisma.$queryRawUnsafe(
      `SELECT channel_id,
              count(*) FILTER (WHERE NOT is_deleted)::int AS message_count,
              max(created_at) AS last_message_at
       FROM community_messages WHERE channel_id = ANY($1::text[])
       GROUP BY channel_id`,
      channelIds,
    );
  }

  /** Aperçu (120 premiers caractères) du dernier message de chaque canal */
  async lastPreviews(channelIds: string[]) {
    if (!channelIds.length) return [];
    return this.prisma.$queryRawUnsafe(
      `SELECT DISTINCT ON (channel_id) channel_id,
              left(COALESCE(content, attachment_name, type), 120) AS preview
       FROM community_messages
       WHERE channel_id = ANY($1::text[]) AND NOT is_deleted
       ORDER BY channel_id, created_at DESC`,
      channelIds,
    );
  }

  // ─────────────────────────── Réactions ───────────────────────────

  async toggleReaction(messageId: string, memberId: string, emoji: string) {
    const existing = await this.prisma.$queryRawUnsafe(
      `SELECT id FROM community_reactions WHERE message_id = $1 AND member_id = $2 AND emoji = $3 LIMIT 1`,
      messageId, memberId, emoji,
    );
    if ((existing as any[]).length) {
      await this.prisma.$queryRawUnsafe(
        `DELETE FROM community_reactions WHERE message_id = $1 AND member_id = $2 AND emoji = $3`,
        messageId, memberId, emoji,
      );
      return false;
    }
    await this.prisma.$queryRawUnsafe(
      `INSERT INTO community_reactions (id, message_id, member_id, emoji) VALUES ($1,$2,$3,$4)`,
      randomUUID(), messageId, memberId, emoji,
    );
    return true;
  }

  // ─────────────────────────── Sondages ───────────────────────────

  async insertPoll(messageId: string, question: string, isMulti: boolean, options: { id: string; label: string }[], expiresAt?: Date) {
    const id = randomUUID();
    await this.prisma.$queryRawUnsafe(
      `INSERT INTO community_polls (id, message_id, question, is_multi, options, expires_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6)`,
      id, messageId, question, isMulti, JSON.stringify(options), expiresAt ?? null,
    );
    return id;
  }

  async findPollByMessage(messageId: string) {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM community_polls WHERE message_id = $1 LIMIT 1`, messageId,
    );
    return (rows as any[])[0] ?? null;
  }

  async votePoll(pollId: string, optionIds: string[], memberId: string, isMulti: boolean) {
    if (!isMulti) {
      await this.prisma.$queryRawUnsafe(
        `DELETE FROM community_poll_votes WHERE poll_id = $1 AND member_id = $2`,
        pollId, memberId,
      );
    }
    for (const optionId of optionIds) {
      await this.prisma.$queryRawUnsafe(
        `INSERT INTO community_poll_votes (id, poll_id, option_id, member_id)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        randomUUID(), pollId, optionId, memberId,
      );
    }
  }

  async pollResults(pollId: string) {
    return this.prisma.$queryRawUnsafe(
      `SELECT option_id, count(*)::int AS votes FROM community_poll_votes
       WHERE poll_id = $1 GROUP BY option_id`,
      pollId,
    );
  }

  async memberPollVotes(pollId: string, memberId: string) {
    return this.prisma.$queryRawUnsafe(
      `SELECT option_id FROM community_poll_votes WHERE poll_id = $1 AND member_id = $2`,
      pollId, memberId,
    );
  }

  // ─────────────────────── Marqueurs de lecture ───────────────────────

  async markRead(memberId: string, channelId: string) {
    await this.prisma.$queryRawUnsafe(
      `INSERT INTO community_channel_reads (member_id, channel_id, last_read_at)
       VALUES ($1,$2, NOW())
       ON CONFLICT (member_id, channel_id) DO UPDATE SET last_read_at = NOW()`,
      memberId, channelId,
    );
  }

  async unreadCounts(memberId: string) {
    return this.prisma.$queryRawUnsafe(
      `SELECT c.id AS channel_id,
              GREATEST(0,
                (SELECT count(*) FROM community_messages m
                 WHERE m.channel_id = c.id AND NOT m.is_deleted
                   AND m.created_at > COALESCE(r.last_read_at, to_timestamp(0))
                   AND m.member_id <> $1))::int AS unread
       FROM community_channels c
       LEFT JOIN community_channel_reads r ON r.channel_id = c.id AND r.member_id = $1
       WHERE c.is_active`,
      memberId,
    );
  }

  // ─────────────────────────── Invitations ───────────────────────────

  async findInviteByToken(token: string) {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM community_invites WHERE token = $1 LIMIT 1`, token,
    );
    return (rows as any[])[0] ?? null;
  }

  async insertInvite(data: { token: string; channelId?: string; memberType?: string; createdBy?: string; note?: string; maxUses?: number; expiresAt?: Date }) {
    const id = randomUUID();
    await this.prisma.$queryRawUnsafe(
      `INSERT INTO community_invites (id, token, channel_id, member_type, created_by, note, max_uses, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      id, data.token, data.channelId ?? null, data.memberType ?? 'PROSPECT',
      data.createdBy ?? null, data.note ?? null, data.maxUses ?? null, data.expiresAt ?? null,
    );
    return this.findInviteByToken(data.token);
  }

  async incrementInviteUses(inviteId: string) {
    await this.prisma.$queryRawUnsafe(
      `UPDATE community_invites SET uses_count = uses_count + 1 WHERE id = $1`, inviteId,
    );
  }

  async listInvites() {
    return this.prisma.$queryRawUnsafe(
      `SELECT i.*, c.name AS channel_name FROM community_invites i
       LEFT JOIN community_channels c ON c.id = i.channel_id
       ORDER BY i.created_at DESC LIMIT 100`,
    );
  }

  async deleteInvite(id: string) {
    await this.prisma.$queryRawUnsafe(`DELETE FROM community_invites WHERE id = $1`, id);
  }

  // ─────────────────────── Posts programmés ───────────────────────

  async insertScheduledPost(data: { channelId: string; authorId: string; type?: string; content: string; scheduledAt: Date }) {
    const id = randomUUID();
    await this.prisma.$queryRawUnsafe(
      `INSERT INTO community_scheduled_posts (id, channel_id, author_id, type, content, scheduled_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      id, data.channelId, data.authorId, data.type ?? 'ANNOUNCEMENT', data.content, data.scheduledAt,
    );
    const rows = (await this.prisma.$queryRawUnsafe(
      `SELECT s.*, c.name AS channel_name FROM community_scheduled_posts s
       JOIN community_channels c ON c.id = s.channel_id WHERE s.id = $1`, id,
    )) as any[];
    return rows[0] ?? null;
  }

  async listScheduledPosts(status?: string) {
    const params: any[] = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE s.status = $1`;
    }
    return this.prisma.$queryRawUnsafe(
      `SELECT s.*, c.name AS channel_name, c.slug AS channel_slug,
              mem.display_name AS author_name
       FROM community_scheduled_posts s
       JOIN community_channels c ON c.id = s.channel_id
       JOIN community_members mem ON mem.id = s.author_id
       ${where}
       ORDER BY s.scheduled_at ASC LIMIT 500`,
      ...params,
    );
  }

  async dueScheduledPosts() {
    return this.prisma.$queryRawUnsafe(
      `SELECT s.*, c.name AS channel_name FROM community_scheduled_posts s
       JOIN community_channels c ON c.id = s.channel_id
       WHERE s.status = 'PENDING' AND s.scheduled_at <= NOW()
       ORDER BY s.scheduled_at ASC LIMIT 10`,
    );
  }

  /** Claim atomique d'un post dû : true si ce worker l'a réservé */
  async claimScheduledPost(id: string): Promise<boolean> {
    const rows = await this.prisma.$queryRawUnsafe(
      `UPDATE community_scheduled_posts
       SET status = 'SENDING', updated_at = NOW()
       WHERE id = $1 AND status = 'PENDING'
       RETURNING id`,
      id,
    );
    return (rows as any[]).length > 0;
  }

  /** Posts 'SENDING' abandonnés (crash worker) depuis > 5 min → re-PENDING */
  async recoverStaleSendingPosts() {
    await this.prisma.$queryRawUnsafe(
      `UPDATE community_scheduled_posts
       SET status = 'PENDING', updated_at = NOW()
       WHERE status = 'SENDING' AND updated_at < NOW() - INTERVAL '5 minutes'`,
    );
  }

  async updateScheduledPost(id: string, patch: Record<string, any>) {
    const allowed = ['content', 'scheduled_at', 'status', 'sent_message_id', 'failure_reason', 'type'];
    const keys = Object.keys(patch).filter((k) => allowed.includes(k));
    if (!keys.length) return;
    const sets = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
    const values = keys.map((k) => patch[k]);
    await this.prisma.$queryRawUnsafe(
      `UPDATE community_scheduled_posts SET ${sets}, updated_at = NOW() WHERE id = $1`, id, ...values,
    );
  }

  // ─────────────────── v2 : écoles & rattachements ───────────────────

  /** Tenants (écoles) actifs — pilotage équipe */
  async listActiveTenants() {
    return this.prisma.$queryRawUnsafe(
      `SELECT id, name, slug FROM tenants WHERE status = 'active' ORDER BY name ASC`,
    );
  }

  async findTenantById(id: string) {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT id, name, slug FROM tenants WHERE id = $1 LIMIT 1`, id,
    );
    return (rows as any[])[0] ?? null;
  }

  /** Rattachements écoles d'un membre (avec infos tenant) */
  async memberSchools(memberId: string) {
    return this.prisma.$queryRawUnsafe(
      `SELECT ms.tenant_id, ms.school_role, ms.school_name, ms.source,
              t.name AS tenant_name, t.slug AS tenant_slug, ms.created_at
       FROM community_member_schools ms
       LEFT JOIN tenants t ON t.id = ms.tenant_id
       WHERE ms.member_id = $1
       ORDER BY COALESCE(t.name, ms.school_name) ASC`,
      memberId,
    );
  }

  /** Rattachement idempotent d'un membre à une école (rôle école) */
  async upsertMemberSchool(
    memberId: string,
    tenant: { id: string; name: string },
    schoolRole: 'ADMIN' | 'TEACHER',
    source: string,
  ) {
    await this.prisma.$queryRawUnsafe(
      `INSERT INTO community_member_schools (id, member_id, tenant_id, school_role, school_name, source)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (member_id, tenant_id) DO UPDATE
         SET school_role = $4, school_name = $5, updated_at = NOW()`,
      randomUUID(), memberId, tenant.id, schoolRole, tenant.name, source,
    );
  }

  async findMemberByLinkedUser(userId: string) {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM community_members WHERE linked_user_id = $1 LIMIT 1`, userId,
    );
    return (rows as any[])[0] ?? null;
  }

  async linkMemberToUser(memberId: string, userId: string) {
    await this.prisma.$queryRawUnsafe(
      `UPDATE community_members SET linked_user_id = $2, linked_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      memberId, userId,
    );
  }

  /** Unread counts bornés aux canaux visibles du membre (v2 : scoping écoles) */
  async unreadCountsScoped(memberId: string, channelIds: string[]) {
    if (!channelIds.length) return [];
    return this.prisma.$queryRawUnsafe(
      `SELECT c.id AS channel_id,
              GREATEST(0,
                (SELECT count(*) FROM community_messages m
                 WHERE m.channel_id = c.id AND NOT m.is_deleted
                   AND m.created_at > COALESCE(r.last_read_at, to_timestamp(0))
                   AND m.member_id <> $1))::int AS unread
       FROM community_channels c
       LEFT JOIN community_channel_reads r ON r.channel_id = c.id AND r.member_id = $1
       WHERE c.is_active AND c.id = ANY($2::text[])`,
      memberId, channelIds,
    );
  }

  /** Membres rattachés à une école (annuaire école côté équipe) */
  async schoolMembers(tenantId: string) {
    return this.prisma.$queryRawUnsafe(
      `SELECT ms.member_id, ms.school_role, ms.source, ms.created_at AS joined_at,
              m.display_name, m.email, m.member_type, m.status, m.last_seen_at
       FROM community_member_schools ms
       JOIN community_members m ON m.id = ms.member_id
       WHERE ms.tenant_id = $1
       ORDER BY m.display_name ASC LIMIT 500`,
      tenantId,
    );
  }

  /** Comptes de rattachés par école (vue synthèse) */
  async memberCountsByTenant() {
    return this.prisma.$queryRawUnsafe(
      `SELECT tenant_id,
              count(*)::int AS members,
              count(*) FILTER (WHERE school_role = 'ADMIN')::int AS admins,
              count(*) FILTER (WHERE school_role = 'TEACHER')::int AS teachers
       FROM community_member_schools GROUP BY tenant_id`,
    );
  }

  // ─────────────────── v2 : événements & lives ───────────────────

  async insertEvent(data: {
    kind: string; title: string; description?: string; audience: string;
    tenantId?: string; groupKind?: string; channelId?: string; hostMemberId: string;
    externalUrl?: string; scheduledAt: Date;
  }) {
    const id = randomUUID();
    await this.prisma.$queryRawUnsafe(
      `INSERT INTO community_events
         (id, kind, title, description, audience, tenant_id, group_kind, channel_id,
          host_member_id, external_url, scheduled_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      id, data.kind, data.title, data.description ?? null, data.audience,
      data.tenantId ?? null, data.groupKind ?? null, data.channelId ?? null,
      data.hostMemberId, data.externalUrl ?? null, data.scheduledAt,
    );
    return this.findEvent(id);
  }

  async findEvent(id: string) {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT e.*, c.slug AS channel_slug, c.name AS channel_name,
              t.name AS tenant_name, t.slug AS tenant_slug,
              m.display_name AS host_name
       FROM community_events e
       LEFT JOIN community_channels c ON c.id = e.channel_id
       LEFT JOIN tenants t ON t.id = e.tenant_id
       LEFT JOIN community_members m ON m.id = e.host_member_id
       WHERE e.id = $1 LIMIT 1`,
      id,
    );
    return (rows as any[])[0] ?? null;
  }

  async updateEvent(id: string, patch: Record<string, any>) {
    const allowed = ['title', 'description', 'status', 'external_url', 'replay_url',
      'scheduled_at', 'started_at', 'ended_at', 'channel_id'];
    const keys = Object.keys(patch).filter((k) => allowed.includes(k));
    if (!keys.length) return;
    const sets = keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
    const values = keys.map((k) => patch[k]);
    await this.prisma.$queryRawUnsafe(
      `UPDATE community_events SET ${sets}, updated_at = NOW() WHERE id = $1`, id, ...values,
    );
    return this.findEvent(id);
  }

  /** Événements visibles (filtre appliqué par le service selon les canaux du membre) */
  async listEvents(opts: { status?: string[]; channelIds?: string[]; limit?: number } = {}) {
    const params: any[] = [];
    const conds: string[] = [];
    if (opts.status?.length) {
      params.push(opts.status);
      conds.push(`e.status = ANY($${params.length}::text[])`);
    }
    if (opts.channelIds) {
      if (!opts.channelIds.length) return [];
      params.push(opts.channelIds);
      // GLOBAL sans canal ciblé OU canal dans la liste visible
      conds.push(`(e.channel_id IS NULL OR e.channel_id = ANY($${params.length}::text[]))`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    params.push(opts.limit ?? 100);
    return this.prisma.$queryRawUnsafe(
      `SELECT e.*, c.slug AS channel_slug, c.name AS channel_name,
              t.name AS tenant_name, t.slug AS tenant_slug,
              m.display_name AS host_name
       FROM community_events e
       LEFT JOIN community_channels c ON c.id = e.channel_id
       LEFT JOIN tenants t ON t.id = e.tenant_id
       LEFT JOIN community_members m ON m.id = e.host_member_id
       ${where}
       ORDER BY e.scheduled_at ASC
       LIMIT $${params.length}`,
      ...params,
    );
  }

  // ─────────────────── Stats ───────────────────

  async engagementStats() {
    const [totals] = (await this.prisma.$queryRawUnsafe(
      `SELECT (SELECT count(*)::int FROM community_messages WHERE NOT is_deleted) AS total_messages,
              (SELECT count(*)::int FROM community_reactions) AS total_reactions,
              (SELECT count(*)::int FROM community_poll_votes) AS total_poll_votes,
              (SELECT count(*)::int FROM community_messages WHERE created_at > NOW() - INTERVAL '7 days' AND NOT is_deleted) AS messages_7d,
              (SELECT count(*)::int FROM community_messages WHERE created_at > NOW() - INTERVAL '24 hours' AND NOT is_deleted) AS messages_24h`,
    )) as any[];
    const perChannel = await this.prisma.$queryRawUnsafe(
      `SELECT c.name, c.slug, c.type,
              count(m.id) FILTER (WHERE NOT m.is_deleted)::int AS messages,
              max(m.created_at) AS last_activity
       FROM community_channels c
       LEFT JOIN community_messages m ON m.channel_id = c.id
       WHERE c.is_active
       GROUP BY c.id, c.name, c.slug, c.type, c.position
       ORDER BY c.position ASC`,
    );
    const topContributors = await this.prisma.$queryRawUnsafe(
      `SELECT mem.display_name, mem.member_type, count(m.id)::int AS messages
       FROM community_messages m JOIN community_members mem ON mem.id = m.member_id
       WHERE NOT m.is_deleted AND m.created_at > NOW() - INTERVAL '30 days'
       GROUP BY mem.id, mem.display_name, mem.member_type
       ORDER BY messages DESC LIMIT 10`,
    );
    return { totals, perChannel, topContributors };
  }
}
