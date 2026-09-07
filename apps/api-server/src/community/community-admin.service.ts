/**
 * ============================================================================
 * COMMUNITY ADMIN SERVICE — Gestion équipe (MODERATOR+ / ADMIN+)
 * ============================================================================
 *
 * Le cockpit marketing de la communauté :
 *   - Membres : rôles, tags (PROSPECT/CLIENT/PARTNER/TEAM), statut, recherche
 *   - Canaux : création/édition (slug, type, icône)
 *   - Posts programmés : le cœur du « conseil quotidien » — planifier une
 *     série de contenus éducatifs, le dispatcher les publie à l'heure
 *   - Invitations trackées : liens dédiés par campagne (page tarification,
 *     email post-achat, salon…) → tags automatiques des inscrits
 *   - Broadcast : publication simultanée multi-canaux
 *   - Stats : croissance, engagement, top contributeurs
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CommunityRepository } from './community.repository';
import { CommunityAuthService } from './community-auth.service';
import { randomUUID } from 'crypto';

const TEAM_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR'];
const isTeam = (role: string) => TEAM_ROLES.includes(role);
const isManager = (role: string) => ['ADMIN', 'SUPER_ADMIN'].includes(role);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@Injectable()
export class CommunityAdminService {
  constructor(
    private readonly repo: CommunityRepository,
    private readonly authService: CommunityAuthService,
  ) {}

  // ─────────────────────────── Membres ───────────────────────────

  async members(actor: { role: string }, opts: { query?: string; memberType?: string }) {
    if (!isTeam(actor.role)) throw new ForbiddenException('Réservé à l\u2019équipe');
    const rows = (await this.repo.listMembers(opts)) as any[];
    return rows.map((m) => this.authService.sanitize(m));
  }

  async updateMember(actor: { id: string; role: string }, memberId: string, patch: { role?: string; memberType?: string; status?: string }) {
    if (!isTeam(actor.role)) throw new ForbiddenException('Réservé à l\u2019équipe');
    const target = await this.repo.findMemberById(memberId);
    if (!target) throw new NotFoundException('Membre introuvable');

    const clean: Record<string, any> = {};
    if (patch.role) {
      if (!isManager(actor.role)) throw new ForbiddenException('Changement de rôle réservé aux ADMIN+');
      if (!['MEMBER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(patch.role)) {
        throw new BadRequestException('Rôle invalide');
      }
      if (target.role === 'SUPER_ADMIN' && patch.role !== 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
        throw new ForbiddenException('Un SUPER_ADMIN ne peut être rétrogradé que par un SUPER_ADMIN');
      }
      clean.role = patch.role;
    }
    if (patch.memberType) {
      if (!['PROSPECT', 'CLIENT', 'PARTNER', 'TEAM'].includes(patch.memberType)) {
        throw new BadRequestException('Type de membre invalide');
      }
      clean.member_type = patch.memberType;
    }
    if (patch.status) {
      if (!['PENDING', 'ACTIVE', 'BANNED'].includes(patch.status)) {
        throw new BadRequestException('Statut invalide');
      }
      if (target.id === actor.id) {
        throw new BadRequestException('Impossible de modifier son propre statut');
      }
      clean.status = patch.status;
    }
    const updated = await this.repo.updateMember(memberId, clean);
    return this.authService.sanitize(updated);
  }

  // ─────────────────────────── Canaux ───────────────────────────

  async createChannel(actor: { role: string }, input: { slug: string; name: string; description?: string; icon?: string; type?: string; position?: number }) {
    if (!isManager(actor.role)) throw new ForbiddenException('Création de canal réservée aux ADMIN+');
    if (!SLUG_RE.test(input.slug)) {
      throw new BadRequestException('Slug invalide (minuscules, chiffres, tirets)');
    }
    if (!input.name?.trim()) throw new BadRequestException('Nom du canal requis');
    if (input.type && !['TEXT', 'ANNOUNCEMENT', 'RESTRICTED'].includes(input.type)) {
      throw new BadRequestException('Type de canal invalide');
    }
    if (await this.repo.findChannelBySlug(input.slug)) {
      throw new BadRequestException('Un canal avec ce slug existe déjà');
    }
    const channel = await this.repo.insertChannel({
      slug: input.slug,
      name: input.name.trim(),
      description: input.description?.trim(),
      icon: input.icon,
      type: input.type ?? 'TEXT',
      position: input.position ?? 100,
      inviteToken: randomUUID().replace(/-/g, '').slice(0, 12),
    });
    return channel;
  }

  async updateChannel(actor: { role: string }, channelId: string, patch: { name?: string; description?: string; icon?: string; type?: string; position?: number; isActive?: boolean }) {
    if (!isManager(actor.role)) throw new ForbiddenException('Réservé aux ADMIN+');
    if (patch.type && !['TEXT', 'ANNOUNCEMENT', 'RESTRICTED'].includes(patch.type)) {
      throw new BadRequestException('Type invalide');
    }
    const clean: Record<string, any> = {};
    if (patch.name?.trim()) clean.name = patch.name.trim();
    if (patch.description !== undefined) clean.description = patch.description?.trim() || null;
    if (patch.icon !== undefined) clean.icon = patch.icon;
    if (patch.type) clean.type = patch.type;
    if (patch.position !== undefined) clean.position = patch.position;
    if (patch.isActive !== undefined) clean.is_active = patch.isActive;
    const updated = await this.repo.updateChannel(channelId, clean);
    if (!updated) throw new NotFoundException('Canal introuvable');
    return updated;
  }

  // ─────────────────────── Posts programmés ───────────────────────

  async listScheduled(actor: { role: string }, status?: string) {
    if (!isTeam(actor.role)) throw new ForbiddenException('Réservé à l\u2019équipe');
    return this.repo.listScheduledPosts(status);
  }

  async schedulePost(actor: { id: string; role: string }, input: { channelId: string; content: string; type?: string; scheduledAt: string }) {
    if (!isTeam(actor.role)) throw new ForbiddenException('Réservé à l\u2019équipe');
    const channel = await this.repo.findChannelById(input.channelId);
    if (!channel) throw new NotFoundException('Canal introuvable');
    if (!input.content?.trim() || input.content.length > 8000) {
      throw new BadRequestException('Contenu requis (8000 caractères max)');
    }
    const when = new Date(input.scheduledAt);
    if (isNaN(when.getTime())) throw new BadRequestException('Date de programmation invalide');
    if (when.getTime() < Date.now() - 60000) {
      throw new BadRequestException('La date de programmation doit être dans le futur');
    }
    if (input.type && !['ANNOUNCEMENT', 'TEXT'].includes(input.type)) {
      throw new BadRequestException('Type de post invalide');
    }
    return this.repo.insertScheduledPost({
      channelId: input.channelId,
      authorId: actor.id,
      type: input.type ?? (channel.type === 'ANNOUNCEMENT' ? 'ANNOUNCEMENT' : 'TEXT'),
      content: input.content.trim(),
      scheduledAt: when,
    });
  }

  async updateScheduled(actor: { role: string }, postId: string, patch: { content?: string; scheduledAt?: string; status?: string }) {
    if (!isTeam(actor.role)) throw new ForbiddenException('Réservé à l\u2019équipe');
    const clean: Record<string, any> = {};
    if (patch.content?.trim()) clean.content = patch.content.trim();
    if (patch.scheduledAt) {
      const when = new Date(patch.scheduledAt);
      if (isNaN(when.getTime())) throw new BadRequestException('Date invalide');
      clean.scheduled_at = when;
    }
    if (patch.status) {
      if (!['PENDING', 'SENT', 'CANCELLED', 'FAILED'].includes(patch.status)) {
        throw new BadRequestException('Statut invalide');
      }
      clean.status = patch.status;
    }
    if (!Object.keys(clean).length) throw new BadRequestException('Rien à mettre à jour');
    await this.repo.updateScheduledPost(postId, clean);
    return this.repo.listScheduledPosts().then((rows: any[]) => rows.find((r) => r.id === postId) ?? null);
  }

  // ─────────────────────── Broadcast multi-canal ───────────────────────

  async broadcast(actor: { id: string; role: string }, input: { channelIds: string[]; content: string; type?: string }) {
    if (!isManager(actor.role)) throw new ForbiddenException('Broadcast réservé aux ADMIN+');
    const ids = [...new Set(input.channelIds ?? [])].filter(Boolean);
    if (!ids.length) throw new BadRequestException('Au moins un canal requis');
    if (!input.content?.trim()) throw new BadRequestException('Contenu requis');
    const posted: string[] = [];
    const failed: { channelId: string; reason: string }[] = [];
    for (const channelId of ids) {
      const channel = await this.repo.findChannelById(channelId);
      if (!channel) {
        failed.push({ channelId, reason: 'canal introuvable' });
        continue;
      }
      const message = await this.repo.insertMessage({
        channelId,
        memberId: actor.id,
        type: input.type ?? 'ANNOUNCEMENT',
        content: input.content.trim(),
      });
      posted.push(message.id);
    }
    return { posted, failed };
  }

  // ─────────────────────────── Invitations ───────────────────────────

  async createInvite(actor: { id: string; role: string }, input: { channelId?: string; memberType?: string; note?: string; maxUses?: number; expiresInDays?: number }) {
    if (!isTeam(actor.role)) throw new ForbiddenException('Réservé à l\u2019équipe');
    if (input.memberType && !['PROSPECT', 'CLIENT', 'PARTNER', 'TEAM'].includes(input.memberType)) {
      throw new BadRequestException('Type invalide');
    }
    if (input.channelId) {
      const channel = await this.repo.findChannelById(input.channelId);
      if (!channel) throw new NotFoundException('Canal introuvable');
    }
    const token = randomUUID().replace(/-/g, '').slice(0, 14);
    const invite = await this.repo.insertInvite({
      token,
      channelId: input.channelId,
      memberType: input.memberType ?? 'PROSPECT',
      createdBy: actor.id,
      note: input.note,
      maxUses: input.maxUses,
      expiresAt: input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 3600 * 1000)
        : undefined,
    });
    return { ...invite, url: `/community/join?invite=${token}` };
  }

  async listInvites(actor: { role: string }) {
    if (!isTeam(actor.role)) throw new ForbiddenException('Réservé à l\u2019équipe');
    const rows = (await this.repo.listInvites()) as any[];
    return rows.map((i) => ({ ...i, url: `/community/join?invite=${i.token}` }));
  }

  async deleteInvite(actor: { role: string }, inviteId: string) {
    if (!isTeam(actor.role)) throw new ForbiddenException('Réservé à l\u2019équipe');
    await this.repo.deleteInvite(inviteId);
    return { deleted: true };
  }

  // ─────────────────────────── Stats ───────────────────────────

  async stats(actor: { role: string }) {
    if (!isTeam(actor.role)) throw new ForbiddenException('Réservé à l\u2019équipe');
    const [members, engagement] = await Promise.all([
      this.repo.countMembers(),
      this.repo.engagementStats(),
    ]);
    return { members, engagement };
  }
}
