/**
 * ============================================================================
 * COMMUNITY PROVISION SERVICE — Pont User applicatif → membre communauté
 * ============================================================================
 *
 * ⭐ v2 « canal créé de façon dynamique et automatique pour chaque école » :
 *
 * Les administrateurs et enseignants d'une école cliente sont des `users`
 * applicatifs (table users, user_tenants). Pour qu'ils entrent dans la
 * communauté SANS créer un nouveau compte, ce service :
 *
 *   1. Reçoit le JWT APPLICATIF (Authorization: Bearer <token app>) —
 *      vérifié via JwtService (claim typ absent ≠ token communauté).
 *   2. Charge le User + ses écoles (user_tenants actifs + tenant principal).
 *   3. Pour CHAQUE école : ensureSchoolStructure (salon + groupe admins +
 *      groupe enseignants créés s'ils manquent — d'où le « dynamique » :
 *      une école créée ce matin obtient son canal à la première entrée).
 *   4. Crée/lie le membre communauté (email du User) + rattachements
 *      community_member_schools avec school_role ADMIN|TEACHER selon le
 *      rôle applicatif.
 *   5. Re-synchronise à CHAQUE appel (rôle changé, nouvelle école, école
 *      quittée) — le provision est idempotent et vivant.
 *
 * Classification ADMIN vs TEACHER : les rôles d'enseignement → TEACHER ;
 * tout le reste (gouvernance, direction, administration, finance, RH…) →
 * ADMIN (groupe des « administrateurs de l'école » au sens gestion).
 * ============================================================================
 */

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { CommunityRepository } from './community.repository';
import { CommunityAuthService } from './community-auth.service';
import { CommunityBootstrap } from './community.bootstrap';

/** Rôles applicatifs d'ENSEIGNEMENT → groupe enseignants */
const TEACHING_ROLES = new Set([
  'TEACHER', 'HEAD_TEACHER', 'SUBSTITUTE_TEACHER', 'TEACHER_ASSISTANT',
  'TEACHING_ASSISTANT', 'PROFESSEUR', 'ENSEIGNANT', 'INSTRUCTOR',
  'MONITOR', 'GENERAL_MONITOR',
]);

export interface ProvisionedMember {
  member: any;
  token: string | null;
  created: boolean;
  schools: {
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    schoolRole: 'ADMIN' | 'TEACHER';
  }[];
}

@Injectable()
export class CommunityProvisionService {
  private readonly logger = new Logger(CommunityProvisionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly repo: CommunityRepository,
    private readonly auth: CommunityAuthService,
    private readonly bootstrap: CommunityBootstrap,
  ) {}

  /**
   * Provision depuis le JWT APPLICATIF (BFF : utilisateur déjà connecté à
   * l'app clique « Rejoindre la communauté »). Vérifie le token app,
   * synchronise le membre + ses écoles, renvoie le token communauté.
   */
  async linkFromAppToken(appToken: string): Promise<ProvisionedMember> {
    let payload: any;
    try {
      payload = this.jwtService.verify(appToken);
    } catch {
      throw new UnauthorizedException('Session applicative invalide ou expirée');
    }
    // Garde-fou : un token communauté (typ:'community') n'est PAS un token applicatif
    if (payload.typ === 'community' || !payload.sub) {
      throw new UnauthorizedException('Token non applicable au provision');
    }
    return this.provisionUser(payload.sub);
  }

  /**
   * Provision depuis les identifiants APPLICATIFS (login communauté avec un
   * compte école) : si aucun membre communauté n'existe pour cet email mais
   * qu'un User actif existe → vérifier le mot de passe applicatif et
   * provisionner. Les enseignants gardent leurs identifiants habituels.
   */
  async provisionFromAppCredentials(email: string, password: string): Promise<ProvisionedMember | null> {
    const users = (await this.prisma.$queryRawUnsafe(
      `SELECT id, password_hash FROM users WHERE lower(email) = lower($1) AND status = 'active' LIMIT 1`,
      email,
    )) as any[];
    if (!users.length || !users[0].password_hash) return null;
    const bcrypt = await import('bcryptjs');
    const ok = await bcrypt.compare(password, users[0].password_hash);
    if (!ok) return null;
    return this.provisionUser(users[0].id);
  }

  /** Cœur : synchronise un User applicatif vers un membre communauté */
  async provisionUser(userId: string): Promise<ProvisionedMember> {
    const users = (await this.prisma.$queryRawUnsafe(
      `SELECT id, email, first_name, last_name, role, tenant_id, status
       FROM users WHERE id = $1 LIMIT 1`,
      userId,
    )) as any[];
    if (!users.length || users[0].status !== 'active') {
      throw new UnauthorizedException('Compte applicatif introuvable ou inactif');
    }
    const user = users[0];

    // ── Écoles de l'utilisateur : user_tenants actifs ∪ tenant principal ──
    const tenantRows = (await this.prisma.$queryRawUnsafe(
      `SELECT DISTINCT ON (t.id) t.id, t.name, t.slug, t.status, ut.role AS user_tenant_role
       FROM user_tenants ut JOIN tenants t ON t.id = ut.tenant_id
       WHERE ut.user_id = $1 AND ut.is_active = true AND t.status = 'active'
       UNION
       SELECT t.id, t.name, t.slug, t.status, $2 AS user_tenant_role
       FROM tenants t WHERE t.id = $3 AND t.status = 'active'`,
      user.id, user.role ?? 'TEACHER', user.tenant_id,
    )) as any[];

    // ── Structure dynamique : chaque école obtient son canal + ses groupes ──
    for (const t of tenantRows) {
      await this.bootstrap.ensureSchoolStructure(t);
    }

    // ── Membre communauté : créer si absent, lier sinon ──
    let member = await this.repo.findMemberByEmail(user.email);
    const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email;
    if (!member) {
      member = await this.repo.insertMember({
        email: user.email,
        // Mot de passe communauté : inutilisable (compte pont) — hash d'un
        // sel aléatoire ; l'authentification passe par le lien applicatif.
        passwordHash: await this.randomHash(),
        displayName,
        firstName: user.first_name ?? null,
        lastName: user.last_name ?? null,
        organization: tenantRows[0]?.name ?? null,
        role: 'MEMBER',
        memberType: 'CLIENT',
        status: 'ACTIVE',
        source: 'APP_LINK',
        sourceMeta: { linkedUserId: user.id, provisionedAt: new Date().toISOString() },
      });
    }
    if ((member as any).linked_user_id !== user.id) {
      await this.repo.linkMemberToUser(member.id, user.id);
      await this.repo.updateMember(member.id, {
        display_name: displayName,
        first_name: user.first_name ?? null,
        last_name: user.last_name ?? null,
        member_type: (member as any).member_type === 'TEAM' ? 'TEAM' : 'CLIENT',
      });
    }

    // ── Rattachements écoles (re-sync vivant) ──
    const schools: ProvisionedMember['schools'] = [];
    for (const t of tenantRows) {
      const schoolRole = this.classifySchoolRole(t.user_tenant_role);
      await this.repo.upsertMemberSchool(member.id, { id: t.id, name: t.name }, schoolRole, 'APP_LINK');
      schools.push({
        tenantId: t.id,
        tenantName: t.name,
        tenantSlug: t.slug,
        schoolRole,
      });
    }

    this.logger.log(
      `Provision communauté : ${user.email} → ${schools.length} école(s) ` +
      `(${schools.map((s) => `${s.tenantName}:${s.schoolRole}`).join(', ') || 'aucune'})`,
    );

    const fresh = await this.repo.findMemberById(member.id);
    return {
      member: fresh,
      token: this.auth.issueToken(fresh),
      created: !(member as any).linked_user_id,
      schools,
    };
  }

  /** Rôle école : enseignant si rôle d'enseignement, sinon administrateur */
  classifySchoolRole(appRole: string | null | undefined): 'ADMIN' | 'TEACHER' {
    const r = (appRole ?? '').toUpperCase().trim();
    return TEACHING_ROLES.has(r) ? 'TEACHER' : 'ADMIN';
  }

  private async randomHash(): Promise<string> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.hash(`${randomUUID()}-${Date.now()}`, 10);
  }
}
