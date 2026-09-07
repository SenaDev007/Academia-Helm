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

@Injectable()
export class CommunityService {
  constructor(private readonly repo: CommunityRepository) {}

  // ─────────────────────────── Canaux ───────────────────────────

  /** Liste des canaux pour un membre actif : métadonnées + aperçu + non-lus */
  async channelsForMember(member: { id: string; role: string }) {
    const channels = (await this.repo.listChannels()) as any[];
    const activity = (await this.repo.channelLastActivity(channels.map((c) => c.id))) as any[];
    const unread = (await this.repo.unreadCounts(member.id)) as any[];
    const previews = await this.lastPreviews(channels.map((c) => c.id));

    const actMap = new Map(activity.map((a) => [a.channel_id, a]));
    const unreadMap = new Map(unread.map((u) => [u.channel_id, u.unread]));
    const previewMap = previews as any[];

    return channels.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      icon: c.icon,
      type: c.type,
      position: c.position,
      lastMessageAt: actMap.get(c.id)?.last_message_at ?? c.last_message_at ?? null,
      messageCount: actMap.get(c.id)?.message_count ?? 0,
      unread: unreadMap.get(c.id) ?? 0,
      preview: previewMap.find((p) => p.channel_id === c.id)?.preview ?? null,
      canPost: c.type === 'ANNOUNCEMENT' ? isTeam(member.role) : true,
    }));
  }

  private async lastPreviews(channelIds: string[]) {
    if (!channelIds.length) return [];
    return this.repo.lastPreviews(channelIds);
  }

  async channelBySlug(slug: string, member: { id: string; role: string }) {
    const channel = await this.repo.findChannelBySlug(slug);
    if (!channel || !channel.is_active) {
      throw new NotFoundException('Canal introuvable');
    }
    const pinned = (await this.repo.listPinned(channel.id)) as any[];
    return {
      id: channel.id,
      slug: channel.slug,
      name: channel.name,
      description: channel.description,
      icon: channel.icon,
      type: channel.type,
      canPost: channel.type === 'ANNOUNCEMENT' ? isTeam(member.role) : true,
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

    if (channel.type === 'ANNOUNCEMENT' && !isTeam(member.role)) {
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

  /** Aperçu public (landing sans auth) : anonymisé */
  async publicOverview() {
    const channels = (await this.repo.listChannels()) as any[];
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
      },
    };
  }
}
