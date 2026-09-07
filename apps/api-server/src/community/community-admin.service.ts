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
import { CommunityBootstrap } from './community.bootstrap';
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
    private readonly bootstrap: CommunityBootstrap,
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

  // ─────────────────── v2 : Écoles (canaux dynamiques) ───────────────────

  /**
   * Synchronisation : provisionne la structure (salon + groupes) pour
   * TOUTES les écoles actives — idempotent. Couvre les écoles créées
   * depuis le dernier démarrage (le bootstrap ne tourne qu'au boot).
   */
  async syncSchools(actor: { role: string }) {
    if (!isManager(actor.role)) throw new ForbiddenException('Synchronisation réservée aux ADMIN+');
    const tenants = (await this.repo.listActiveTenants()) as any[];
    let created = 0;
    for (const t of tenants) {
      created += await this.bootstrap.ensureSchoolStructure(t);
    }
    return { tenants: tenants.length, channelsCreated: created };
  }

  /** Vue synthèse : écoles + canaux + effectifs rattachés */
  async schools(actor: { role: string }) {
    if (!isTeam(actor.role)) throw new ForbiddenException('Réservé à l\u2019équipe');
    const [tenants, counts] = await Promise.all([
      this.repo.listActiveTenants(),
      this.repo.memberCountsByTenant(),
    ]);
    const countMap = new Map((counts as any[]).map((c) => [c.tenant_id, c]));
    const channels = (await this.repo.listChannels()) as any[];
    return (tenants as any[]).map((t) => {
      const schoolChannels = channels
        .filter((c) => c.scope === 'SCHOOL' && c.tenant_id === t.id)
        .sort((a: any, b: any) => a.position - b.position)
        .map((c: any) => ({
          id: c.id, slug: c.slug, name: c.name, icon: c.icon,
          type: c.type, groupKind: c.group_kind, autoManaged: c.auto_managed,
          lastMessageAt: c.last_message_at,
        }));
      const cnt = countMap.get(t.id);
      return {
        tenantId: t.id,
        name: t.name,
        slug: t.slug,
        channels: schoolChannels,
        members: cnt?.members ?? 0,
        admins: cnt?.admins ?? 0,
        teachers: cnt?.teachers ?? 0,
      };
    });
  }

  /** Annuaire des membres rattachés à une école */
  async schoolMembers(actor: { role: string }, tenantId: string) {
    if (!isTeam(actor.role)) throw new ForbiddenException('Réservé à l\u2019équipe');
    const tenant = await this.repo.findTenantById(tenantId);
    if (!tenant) throw new NotFoundException('École introuvable');
    const rows = (await this.repo.schoolMembers(tenantId)) as any[];
    return {
      tenantId,
      name: tenant.name,
      members: rows.map((m) => ({
        memberId: m.member_id,
        displayName: m.display_name,
        email: m.email,
        memberType: m.member_type,
        status: m.status,
        schoolRole: m.school_role,
        source: m.source,
        joinedAt: m.joined_at,
        lastSeenAt: m.last_seen_at,
      })),
    };
  }

  /** Groupe custom au sein du canal d'une école (au-delà admins/enseignants) */
  async createSchoolGroup(
    actor: { role: string },
    input: { tenantId: string; name: string; description?: string; icon?: string; memberRole?: string },
  ) {
    if (!isManager(actor.role)) throw new ForbiddenException('Création de groupe réservée aux ADMIN+');
    const tenant = await this.repo.findTenantById(input.tenantId);
    if (!tenant) throw new NotFoundException('École introuvable');
    if (!input.name?.trim() || input.name.trim().length < 2) {
      throw new BadRequestException('Nom du groupe requis');
    }
    // Structure parente assurée (salon existant)
    await this.bootstrap.ensureSchoolStructure(tenant);
    const base = (tenant.slug ?? 'ecole').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
    const kind = (input.memberRole === 'ADMINS' || input.memberRole === 'TEACHERS') ? input.memberRole : 'CUSTOM';
    const slug = `grp-${kind === 'CUSTOM' ? 'libre' : kind.toLowerCase()}-${base}-${randomUUID().slice(0, 6)}`;
    const salon = (await this.repo.listChannels() as any[]).find(
      (c) => c.scope === 'SCHOOL' && c.tenant_id === tenant.id && c.group_kind === 'SALON',
    );
    const channel = await this.repo.insertChannel({
      slug,
      name: input.name.trim(),
      description: input.description?.trim() ?? `Groupe de ${tenant.name}`,
      icon: input.icon ?? '👥',
      type: 'TEXT',
      position: 1030,
    });
    // Colonnes v2 (scope/école/groupe/parent)
    return this.repo.setChannelScope(channel.id, {
      scope: 'SCHOOL', tenantId: tenant.id, groupKind: kind,
      parentId: salon?.id ?? null, autoManaged: false,
    });
  }

  // ─────────────────── v2 : Lives & événements ───────────────────

  /**
   * Planifier un live/formation/atelier avec ciblage d'audience :
   *   GLOBAL → salon global annonces (toutes les écoles)
   *   SCHOOL → salon de l'école ciblée
   *   GROUP  → groupe ADMINS/TEACHERS de l'école ciblée
   * Le canal ciblé est auto-résolu (structure assurée à la volée).
   */
  async createEvent(
    actor: { id: string; role: string },
    input: { kind: string; title: string; description?: string; audience: string;
             tenantId?: string; groupKind?: string; externalUrl?: string; scheduledAt: string },
  ) {
    if (!isTeam(actor.role)) throw new ForbiddenException('Réservé à l\u2019équipe');
    if (!['LIVE', 'FORMATION', 'ATELIER'].includes(input.kind)) {
      throw new BadRequestException('Type d\u2019événement invalide');
    }
    if (!input.title?.trim() || input.title.trim().length < 3) {
      throw new BadRequestException('Titre requis (3 caractères minimum)');
    }
    if (!['GLOBAL', 'SCHOOL', 'GROUP'].includes(input.audience)) {
      throw new BadRequestException('Audience invalide');
    }
    const when = new Date(input.scheduledAt);
    if (isNaN(when.getTime())) throw new BadRequestException('Date invalide');

    // Résolution du canal ciblé (dispatch)
    let tenant: any = null;
    let groupKind: string | null = null;
    let channelId: string | null = null;
    if (input.audience === 'GLOBAL') {
      const annonces = (await this.repo.listChannels() as any[]).find(
        (c) => (c.scope ?? 'GLOBAL') === 'GLOBAL' && c.slug === 'annonces',
      );
      channelId = annonces?.id ?? null;
    } else {
      if (!input.tenantId) throw new BadRequestException('École cible requise');
      tenant = await this.repo.findTenantById(input.tenantId);
      if (!tenant) throw new NotFoundException('École introuvable');
      await this.bootstrap.ensureSchoolStructure(tenant);
      const schoolChannels = (await this.repo.listChannels() as any[]).filter(
        (c) => c.scope === 'SCHOOL' && c.tenant_id === tenant.id,
      );
      if (input.audience === 'GROUP') {
        groupKind = input.groupKind ?? 'TEACHERS';
        if (!['ADMINS', 'TEACHERS'].includes(groupKind)) {
          throw new BadRequestException('Groupe cible invalide (ADMINS ou TEACHERS)');
        }
        channelId = schoolChannels.find((c) => c.group_kind === groupKind)?.id ?? null;
      } else {
        channelId = schoolChannels.find((c) => c.group_kind === 'SALON')?.id ?? null;
      }
    }

    const event = await this.repo.insertEvent({
      kind: input.kind,
      title: input.title.trim(),
      description: input.description?.trim(),
      audience: input.audience,
      tenantId: tenant?.id ?? null,
      groupKind,
      channelId,
      hostMemberId: actor.id,
      externalUrl: input.externalUrl?.trim(),
      scheduledAt: when,
    });

    // Message d'annonce automatique dans le canal ciblé (dispatch visible)
    if (channelId) {
      const kindLabel = input.kind === 'LIVE' ? '🔴 LIVE' : input.kind === 'FORMATION' ? '🎓 Formation' : '🛠️ Atelier';
      const target = input.audience === 'GLOBAL'
        ? '**pour toutes les écoles**'
        : input.audience === 'SCHOOL'
          ? `pour **${tenant.name}**`
          : `pour les **${groupKind === 'ADMINS' ? 'administrateurs' : 'enseignants'} de ${tenant.name}**`;
      await this.repo.insertMessage({
        channelId,
        memberId: actor.id,
        type: 'ANNOUNCEMENT',
        content: `${kindLabel} · **${input.title.trim()}** ${target}\n\n📅 ${when.toLocaleString('fr-FR')}\n${input.externalUrl ? `🔗 ${input.externalUrl}` : ''}\n\n_Retrouvez ce live dans l\u2019onglet Lives & événements._`,
      });
    }

    return event;
  }

  async updateEvent(
    actor: { role: string },
    eventId: string,
    patch: { title?: string; description?: string; status?: string; externalUrl?: string; replayUrl?: string; scheduledAt?: string },
  ) {
    if (!isTeam(actor.role)) throw new ForbiddenException('Réservé à l\u2019équipe');
    const event = await this.repo.findEvent(eventId);
    if (!event) throw new NotFoundException('Événement introuvable');
    const clean: Record<string, any> = {};
    if (patch.title?.trim()) clean.title = patch.title.trim();
    if (patch.description !== undefined) clean.description = patch.description?.trim() || null;
    if (patch.externalUrl !== undefined) clean.external_url = patch.externalUrl?.trim() || null;
    if (patch.replayUrl !== undefined) clean.replay_url = patch.replayUrl?.trim() || null;
    if (patch.scheduledAt) {
      const when = new Date(patch.scheduledAt);
      if (isNaN(when.getTime())) throw new BadRequestException('Date invalide');
      clean.scheduled_at = when;
    }
    if (patch.status) {
      if (!['SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED'].includes(patch.status)) {
        throw new BadRequestException('Statut invalide');
      }
      clean.status = patch.status;
      if (patch.status === 'LIVE') clean.started_at = new Date();
      if (patch.status === 'ENDED') clean.ended_at = new Date();
    }
    if (!Object.keys(clean).length) throw new BadRequestException('Rien à mettre à jour');
    return this.repo.updateEvent(eventId, clean);
  }

  async listEvents(actor: { role: string }, status?: string) {
    if (!isTeam(actor.role)) throw new ForbiddenException('Réservé à l\u2019équipe');
    return this.repo.listEvents({ status: status ? [status] : undefined, limit: 200 });
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
