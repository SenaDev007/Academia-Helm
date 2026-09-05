/**
 * ============================================================================
 * PORTAL SWITCH SERVICE — BASCULE ENTRE PORTAILS (DOUBLE CASQUETTE)
 * ============================================================================
 *
 * Un personnel à double casquette (ex : secrétaire qui est aussi enseignant)
 * possède UN SEUL compte User (même email, même mot de passe). La séparation
 * entre le portail ÉCOLE et le portail ENSEIGNANT est purement sessionnaire :
 * un JWT avec `portalType` + une ligne `portal_sessions`.
 *
 * Aujourd'hui, changer de portail impose déconnexion + reconnexion avec un
 * identifiant différent (email pour l'école, matricule pour l'enseignant).
 * Ce service permet de RE-ÉMETTRE une session de portail sans toucher aux
 * identifiants : bascule instantanée, réversible, sans déconnexion.
 *
 * Règles d'éligibilité — MIROIR EXACT des règles de login (sécurité : la
 * bascule ne doit jamais ouvrir un accès que le login direct refuserait) :
 *   → TEACHER : profil Teacher ACTIF dans le tenant, lié par email
 *               (cf. loginTeacher étape 3c), OU rôle teacher-like (étape 3a).
 *   → SCHOOL  : rôle administratif FR/EN/niveau-spécifique
 *               (cf. loginSchool adminRolePattern), OU affectation admin
 *               ACTIVE dans staff_admin_assignments (double casquette).
 * ============================================================================
 */

import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { PortalSessionService } from './portal-session.service';

/** Rôles teacher-like — même liste que loginTeacher étape 3a */
const TEACHER_LIKE_ROLES = [
  'TEACHER', 'ENSEIGNANT', 'TEACHER_RESP', 'INSTITUTEUR', 'PROFESSEUR',
];

/**
 * Rôles administratifs — même regex que loginSchool / loginTeacher
 * (rôles FR, EN legacy, niveau-spécifiques).
 */
const ADMIN_ROLE_PATTERN =
  /^(PROMOTEUR|PROMOTER|DIRECTEUR|SECRETAIRE_COMPTABLE|SECRETAIRE|COMPTABLE|SURVEILLANT_GENERAL|SURVEILLANT|CENSEUR|DIRECTOR|SUPER_DIRECTOR|ADMIN|ACCOUNTANT|SCHOOL_OWNER|SCHOOL_ADMIN|DIRECTEUR_GENERAL|DIRECTEUR_ETABLISSEMENT)(_(MAT|PRI|SEC|MAT_PRI|MATERNELLE|PRIMAIRE|SECONDAIRE))?$/;

export type SwitchTargetPortal = 'SCHOOL' | 'TEACHER';

export interface SwitchOptionsResult {
  /** Portail de la session courante (issu du JWT) */
  current: SwitchTargetPortal | 'PARENT' | null;
  /** Portails vers lesquels l'utilisateur peut basculer */
  available: SwitchTargetPortal[];
  /** Profil Teacher actif (présent si la casquette enseignant existe) */
  teacher: { id: string; matricule: string } | null;
  /** Rôle DB de l'utilisateur (libellé lisible côté frontend) */
  role: string | null;
}

@Injectable()
export class PortalSwitchService {
  private readonly logger = new Logger(PortalSwitchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly portalSessionService: PortalSessionService,
  ) {}

  /**
   * Profil Teacher ACTIF du tenant lié à l'utilisateur par email
   * (liaison insensible à la casse — cf. loginTeacher étape 1/2).
   */
  private async findActiveTeacherProfile(
    userEmail: string,
    tenantId: string,
  ): Promise<{ id: string; matricule: string } | null> {
    try {
      const teacher = await this.prisma.teacher.findFirst({
        where: {
          tenantId,
          email: { equals: userEmail.trim().toLowerCase(), mode: 'insensitive' },
          status: 'active',
        },
        select: { id: true, matricule: true },
      });
      return teacher ?? null;
    } catch (err: any) {
      this.logger.warn(`findActiveTeacherProfile failed: ${err?.message ?? err}`);
      return null;
    }
  }

  /**
   * Affectation administrative ACTIVE dans staff_admin_assignments
   * (double casquette enseignant + poste admin) — cf. hasActiveAdminAssignment
   * de PortalAuthService.loginSchool.
   */
  private async hasActiveAdminAssignment(
    userEmail: string,
    tenantId: string,
  ): Promise<boolean> {
    try {
      const staff = await this.prisma.staff.findFirst({
        where: {
          tenantId,
          email: { equals: userEmail.trim().toLowerCase(), mode: 'insensitive' },
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      if (!staff) return false;

      const assignment = await this.prisma.staffAdminAssignment.findFirst({
        where: { staffId: staff.id, tenantId, isActive: true },
        select: { id: true },
      });
      return !!assignment;
    } catch (err: any) {
      this.logger.warn(`hasActiveAdminAssignment failed: ${err?.message ?? err}`);
      return false;
    }
  }

  /** La casquette ENSEIGNANT existe-t-elle pour cet utilisateur ? */
  private async canAccessTeacherPortal(user: {
    email: string;
    role?: string | null;
    tenantId: string;
  }): Promise<{ ok: boolean; teacher: { id: string; matricule: string } | null }> {
    const roleUpper = (user.role || '').toUpperCase();
    // a) Rôle teacher-like → casquette directe
    if (TEACHER_LIKE_ROLES.includes(roleUpper)) {
      // Le profil Teacher reste nécessaire pour l'UI enseignant
      // (classes, pédagogie...) — on le cherche sans le exiger.
      const teacher = await this.findActiveTeacherProfile(user.email, user.tenantId);
      return { ok: true, teacher };
    }
    // b) Profil Teacher actif lié par email → double casquette
    const teacher = await this.findActiveTeacherProfile(user.email, user.tenantId);
    return { ok: !!teacher, teacher };
  }

  /** La casquette ÉCOLE (administration) existe-t-elle pour cet utilisateur ? */
  private async canAccessSchoolPortal(user: {
    email: string;
    role?: string | null;
    tenantId: string;
  }): Promise<boolean> {
    const roleUpper = (user.role || '').toUpperCase();
    // a) Rôle administratif explicite
    if (ADMIN_ROLE_PATTERN.test(roleUpper)) return true;
    // b) Affectation admin active (enseignant cumulant un poste admin)
    return this.hasActiveAdminAssignment(user.email, user.tenantId);
  }

  /**
   * GET /portal/auth/switch-options
   * Liste les portails vers lesquels l'utilisateur peut basculer.
   * Sert au frontend à n'afficher le bouton « Basculer » QUE pour les
   * doubles casquettes.
   */
  async getSwitchOptions(user: {
    id: string;
    email: string;
    role?: string | null;
    tenantId?: string | null;
    portalType?: string | null;
  }): Promise<SwitchOptionsResult> {
    const tenantId = user.tenantId || '';
    const current = (user.portalType as SwitchOptionsResult['current']) || null;

    if (!tenantId) {
      return { current, available: [], teacher: null, role: user.role ?? null };
    }

    const available: SwitchTargetPortal[] = [];

    // Casquette enseignant (hors portail courant enseignant)
    if (current !== 'TEACHER') {
      const teacherCheck = await this.canAccessTeacherPortal(user);
      if (teacherCheck.ok) available.push('TEACHER');
    }

    // Casquette école (hors portail courant école)
    if (current !== 'SCHOOL') {
      const schoolOk = await this.canAccessSchoolPortal(user);
      if (schoolOk) available.push('SCHOOL');
    }

    // Profil Teacher (informatif pour l'UI, même si courant = SCHOOL)
    const teacher =
      current === 'TEACHER'
        ? await this.findActiveTeacherProfile(user.email, tenantId)
        : (await this.canAccessTeacherPortal(user)).teacher;

    return { current, available, teacher, role: user.role ?? null };
  }

  /**
   * POST /portal/auth/switch-portal
   * Bascule la session de portail de l'utilisateur authentifié vers
   * `targetPortal` — SANS déconnexion, SANS ressaisie d'identifiants.
   *
   * Retourne le même format de payload que loginSchool / loginTeacher pour
   * que le frontend (BFF + persistClientSession) traite la bascule comme
   * une re-connexion transparente.
   */
  async switchPortal(
    user: {
      id: string;
      email: string;
      firstName?: string | null;
      lastName?: string | null;
      role?: string | null;
      tenantId?: string | null;
      portalType?: string | null;
    },
    targetPortal: SwitchTargetPortal,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const tenantId = user.tenantId || '';
    if (!tenantId) {
      throw new BadRequestException(
        'Session sans tenant — impossible de basculer de portail. Reconnectez-vous.',
      );
    }

    if (targetPortal !== 'SCHOOL' && targetPortal !== 'TEACHER') {
      throw new BadRequestException('Portail cible invalide (SCHOOL ou TEACHER attendu)');
    }

    if (user.portalType === targetPortal) {
      throw new BadRequestException(
        `Vous êtes déjà sur le portail ${targetPortal === 'SCHOOL' ? 'École' : 'Enseignant'}.`,
      );
    }

    // ── Vérifications d'éligibilité (miroir des règles de login) ──
    let teacher: { id: string; matricule: string } | null = null;

    if (targetPortal === 'TEACHER') {
      const check = await this.canAccessTeacherPortal(user);
      if (!check.ok) {
        throw new ForbiddenException(
          'SWITCH_NOT_ALLOWED: Aucun profil enseignant actif ne vous est rattaché dans cet établissement.',
        );
      }
      teacher = check.teacher;
    } else {
      const schoolOk = await this.canAccessSchoolPortal(user);
      if (!schoolOk) {
        throw new ForbiddenException(
          'SWITCH_NOT_ALLOWED: Ce compte ne dispose pas de rôle administratif dans cet établissement.',
        );
      }
    }

    // ── Tenant actif ? ──
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || tenant.status !== 'active') {
      throw new ForbiddenException('Établissement non trouvé ou inactif');
    }

    // ── Charger l'enregistrement complet (prénom/nom absents du payload JWT) ──
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { firstName: true, lastName: true, status: true, role: true, tenantId: true },
    });
    if (!userRecord || userRecord.status !== 'active') {
      throw new ForbiddenException('Compte introuvable ou inactif');
    }

    // ── Nouvelle session de portail (l'ancienne reste valide → bascule
    //    réversible, comme deux onglets ouverts sur deux portails) ──
    const session = await this.portalSessionService.createSession(
      tenantId,
      targetPortal,
      user.id,
      ipAddress,
      userAgent,
    );

    // ── Nouveau JWT avec le nouveau portalType (24h — cf. generatePortalToken) ──
    const token = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        tenantId,
        role: user.role ?? 'USER',
        portalType: targetPortal,
      },
      { expiresIn: '24h' },
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    this.logger.log(
      `🔄 Portal switch: user ${user.email} ${user.portalType || '≤'} → ${targetPortal} (tenant ${tenantId})`,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: userRecord.firstName || '',
        lastName: userRecord.lastName || '',
        role: user.role ?? userRecord.role,
        tenantId,
      },
      ...(teacher ? { teacher: { id: teacher.id, matricule: teacher.matricule } } : {}),
      token,
      sessionId: session.id,
      portalType: targetPortal,
    };
  }
}
