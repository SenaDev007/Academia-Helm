/**
 * ============================================================================
 * COMMUNITY AUTH SERVICE — Comptes membres, inscription, login, JWT
 * ============================================================================
 *
 * Flux marketing (funnel e-commerce) :
 *   Prospect/Client → /community/join (éventuellement ?invite=TOKEN) →
 *   compte membre → conseils quotidiens, annonces produits, support.
 *
 * - Mots de passe bcrypt (même politique que les users applicatifs)
 * - JWT dédié { sub: memberId, role, typ: 'community' } — validé par
 *   CommunityAuthGuard, jamais accepté par le JwtAuthGuard applicatif
 *   (claim typ différent + recherche table users qui échouera)
 * - Approbation : auto par défaut (COMMUNITY_AUTO_APPROVE=true) ;
 *   modérée sinon (statut PENDING → validée par l'équipe via l'admin)
 * - Rôles : TEAM (ADMIN/SUPER_ADMIN) crée les canaux et programme les posts
 * ============================================================================
 */

import { Injectable, BadRequestException, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { CommunityRepository } from './community.repository';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

@Injectable()
export class CommunityAuthService {
  private readonly logger = new Logger(CommunityAuthService.name);

  constructor(
    private readonly repo: CommunityRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private autoApprove(): boolean {
    return (this.config.get<string>('COMMUNITY_AUTO_APPROVE') ?? 'true') !== 'false';
  }

  /** Clé de contact équipe : email de l'admin bootstrap (ou défaut produit) */
  teamContact(): string {
    return this.config.get<string>('COMMUNITY_ADMIN_EMAIL') ?? 'contact@academiahelm.com';
  }

  validateRegistration(input: { email: string; password: string; displayName: string }) {
    if (!EMAIL_RE.test(input.email)) {
      throw new BadRequestException('Adresse email invalide');
    }
    if (input.password.length < 8) {
      throw new BadRequestException('Mot de passe trop court (8 caractères minimum)');
    }
    if (!input.displayName?.trim() || input.displayName.trim().length < 2) {
      throw new BadRequestException('Nom d\u2019affichage requis (2 caractères minimum)');
    }
  }

  async register(input: {
    email: string; password: string; displayName: string;
    firstName?: string; lastName?: string; organization?: string;
    country?: string; phone?: string; inviteToken?: string;
  }) {
    this.validateRegistration(input);

    const existing = await this.repo.findMemberByEmail(input.email);
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email — connectez-vous');
    }

    // ⭐ Invitation : pré-taggage du membre (PROSPECT/CLIENT/PARTNER) +
    //    traçabilité source. Les invitations expirées/épuisées sont ignorées
    //    silencieusement (l'inscription publique reste possible).
    let memberType = 'PROSPECT';
    let source = 'PUBLIC_JOIN';
    let sourceMeta: any = null;
    if (input.inviteToken) {
      const invite = await this.repo.findInviteByToken(input.inviteToken);
      const expired = invite?.expires_at ? new Date(invite.expires_at) < new Date() : false;
      const exhausted = invite?.max_uses != null && invite.uses_count >= invite.max_uses;
      if (invite && !expired && !exhausted) {
        memberType = invite.member_type ?? 'PROSPECT';
        source = 'INVITE';
        sourceMeta = { inviteId: invite.id, inviteNote: invite.note ?? null };
      }
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const status = this.autoApprove() ? 'ACTIVE' : 'PENDING';

    const member = await this.repo.insertMember({
      email: input.email.toLowerCase().trim(),
      passwordHash,
      displayName: input.displayName.trim(),
      firstName: input.firstName?.trim(),
      lastName: input.lastName?.trim(),
      organization: input.organization?.trim(),
      country: input.country?.trim(),
      phone: input.phone?.trim(),
      memberType,
      status,
      source,
      sourceMeta,
    });

    if (source === 'INVITE' && input.inviteToken) {
      const invite = await this.repo.findInviteByToken(input.inviteToken);
      if (invite) await this.repo.incrementInviteUses(invite.id);
    }

    this.logger.log(`Nouveau membre communauté : ${member.email} (${memberType}, ${source}, ${status})`);

    if (member.status !== 'ACTIVE') {
      return { member: this.sanitize(member), token: null, pending: true };
    }
    return { member: this.sanitize(member), token: this.issueToken(member), pending: false };
  }

  async login(email: string, password: string) {
    const member = await this.repo.findMemberByEmail(email);
    if (!member || !member.password_hash) {
      throw new UnauthorizedException('Identifiants incorrects');
    }
    const ok = await bcrypt.compare(password, member.password_hash);
    if (!ok) {
      throw new UnauthorizedException('Identifiants incorrects');
    }
    if (member.status === 'BANNED') {
      throw new UnauthorizedException('Compte suspendu — contactez l\u2019équipe Academia Helm');
    }
    await this.repo.bumpLastSeen(member.id);
    return { member: this.sanitize(member), token: this.issueToken(member) };
  }

  issueToken(member: any): string {
    return this.jwtService.sign({
      sub: member.id,
      email: member.email,
      role: member.role,
      typ: 'community',
    });
  }

  sanitize(member: any) {
    return {
      id: member.id,
      email: member.email,
      displayName: member.display_name,
      firstName: member.first_name ?? null,
      lastName: member.last_name ?? null,
      organization: member.organization ?? null,
      country: member.country ?? null,
      phone: member.phone ?? null,
      avatarUrl: member.avatar_url ?? null,
      bio: member.bio ?? null,
      role: member.role,
      memberType: member.member_type,
      status: member.status,
      createdAt: member.created_at,
      lastSeenAt: member.last_seen_at ?? null,
    };
  }
}
