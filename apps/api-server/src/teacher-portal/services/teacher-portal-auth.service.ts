/**
 * ============================================================================
 * HELM ENSEIGNANT — AUTHENTIFICATION DU PORTAIL ENSEIGNANT AUTONOME
 * ============================================================================
 *
 * Pattern répliqué de PortalAuthService.loginTeacher, mais :
 *   - Login par EMAIL + mot de passe (pas de matricule, pas de tenant en entrée)
 *   - Le tenant est le tenant personnel de l'enseignant (type: 'TEACHER')
 *   - L'inscription (register) provisionne tout l'univers puis renvoie
 *     directement une session connectée.
 */

import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { PortalSessionService } from '../../portal/services/portal-session.service';
import { AccessScopeService } from '../../common/context/access-scope.service';
import { TeacherProvisioningService } from './teacher-provisioning.service';
import {
  RegisterTeacherDto,
  TeacherStandaloneLoginDto,
  TeacherLevelCode,
} from '../dto/teacher-portal.dto';

const PORTAL_TEACHER = 'TEACHER' as const;

@Injectable()
export class TeacherPortalAuthService {
  private readonly logger = new Logger(TeacherPortalAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly portalSessionService: PortalSessionService,
    private readonly accessScopeService: AccessScopeService,
    private readonly provisioningService: TeacherProvisioningService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  //  INSCRIPTION
  // ─────────────────────────────────────────────────────────────────────────

  async register(
    dto: RegisterTeacherDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const email = dto.email.trim().toLowerCase();

    const provisioned = await this.provisioningService.provisionStandaloneTeacher({
      email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      levels: dto.levels,
    });

    // Connexion immédiate après inscription
    return this.buildLoginResponse(
      provisioned.userId,
      provisioned.tenantId,
      provisioned.teacherId,
      ipAddress,
      userAgent,
      { justRegistered: true, levels: provisioned.levels },
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  CONNEXION (email + mot de passe, sans tenant)
  // ─────────────────────────────────────────────────────────────────────────

  async login(dto: TeacherStandaloneLoginDto, ipAddress?: string, userAgent?: string) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: { email, status: 'active' },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // ⭐ Le portail Helm Enseignant n'accepte QUE les tenants TEACHER.
    //    Un enseignant d'école cliente doit passer par le portail école
    //    (matricule + établissement) — s'il veut malgré tout un espace
    //    séparé, il crée un compte avec une autre adresse email.
    if (!user.tenantId) {
      throw new UnauthorizedException(
        'Ce compte n’est pas rattaché à un espace enseignant. Inscrivez-vous depuis la page d’inscription.',
      );
    }
    const tenant = await this.prisma.tenant.findUnique({ where: { id: user.tenantId } });
    if (!tenant || (tenant as any).type !== 'TEACHER') {
      throw new UnauthorizedException(
        'Ce compte est rattaché à un établissement. Utilisez le portail de votre école (matricule + établissement).',
      );
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Mot de passe non configuré');
    }
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Teacher du tenant personnel (liaison par email)
    const teacher = await this.prisma.teacher.findFirst({
      where: { tenantId: tenant.id, email: { equals: user.email, mode: 'insensitive' } },
    });
    if (!teacher) {
      throw new UnauthorizedException(
        'Profil enseignant introuvable pour ce compte. Contactez le support.',
      );
    }

    return this.buildLoginResponse(user.id, tenant.id, teacher.id, ipAddress, userAgent);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PROFIL — état de l'espace (niveaux, abonnement, identité documentaire)
  // ─────────────────────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.tenantId) throw new UnauthorizedException('Session invalide');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: user.tenantId } });
    if (!tenant || (tenant as any).type !== 'TEACHER') {
      throw new UnauthorizedException('Ce portail est réservé aux enseignants autonomes');
    }

    const teacher = await this.prisma.teacher.findFirst({
      where: { tenantId: tenant.id, email: { equals: user.email, mode: 'insensitive' } },
    });

    const schoolLevels = await this.prisma.schoolLevel.findMany({
      where: { tenantId: tenant.id },
      orderBy: { order: 'asc' },
      select: { id: true, code: true, name: true, label: true, isActive: true },
    });

    const academicYear = await this.prisma.academicYear.findFirst({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    // Identité documentaire (en-têtes / pieds de page des documents)
    const identityProfile = await this.prisma.tenantIdentityProfile.findUnique({
      where: { tenantId: tenant.id },
    });

    // Abonnement Helm Enseignant
    const helmSubscription = await this.prisma.helmSubscription.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
    });

    // Comptes de contenu
    const [classesCount, subjectsCount, studentsCount] = await Promise.all([
      this.prisma.academicClass.count({
        where: { tenantId: tenant.id, academicYearId: academicYear?.id ?? undefined, isActive: true },
      }),
      this.prisma.subject.count({
        where: { tenantId: tenant.id, academicYearId: academicYear?.id ?? undefined },
      }),
      this.prisma.student.count({ where: { tenantId: tenant.id } }),
    ]);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: (user as any).avatarUrl ?? null,
        role: user.role,
      },
      teacher: teacher
        ? { id: teacher.id, matricule: teacher.matricule, phone: teacher.phone }
        : null,
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      levels: schoolLevels.map((l) => ({
        code: l.code,
        name: l.name,
        label: l.label,
        isActive: l.isActive,
      })),
      academicYear: academicYear
        ? { id: academicYear.id, name: academicYear.name, label: academicYear.label }
        : null,
      identity: identityProfile
        ? {
            schoolName: identityProfile.schoolName,
            logoUrl: identityProfile.logoUrl,
            address: identityProfile.address,
            phonePrimary: identityProfile.phonePrimary,
            email: identityProfile.email,
            slogan: identityProfile.slogan,
          }
        : null,
      subscription: helmSubscription
        ? {
            plan: (helmSubscription as any).plan,
            status: (helmSubscription as any).status,
            billingCycle: (helmSubscription as any).billingCycle,
            currentPeriodEnd: (helmSubscription as any).currentPeriodEnd,
            trialEnd: (helmSubscription as any).trialEnd,
          }
        : null,
      stats: { classes: classesCount, subjects: subjectsCount, students: studentsCount },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  INVITATION DU PROMOTEUR — boucle de croissance B2B
  // ─────────────────────────────────────────────────────────────────────────

  async invitePromoter(userId: string, dto: InviteInput) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.tenantId) throw new UnauthorizedException('Session invalide');

    // Trace l'invitation (analytics produit — non bloquant)
    try {
      await this.prisma.inAppNotification.create({
        data: {
          tenantId: user.tenantId,
          recipientId: user.id,
          type: 'PROMOTER_INVITE',
          title: 'Invitation promoteur envoyée',
          body: `Invitation envoyée à ${dto.promoterEmail}${dto.schoolName ? ` (${dto.schoolName})` : ''}`,
          priority: 'MEDIUM',
          data: { promoterEmail: dto.promoterEmail, schoolName: dto.schoolName ?? null },
        },
      });
    } catch (e: any) {
      this.logger.warn(`⚠️ Invite notification: ${e.message}`);
    }

    // ⭐ L'envoi email réel est branché sur le service de communication
    //    existant (EmailService) dans un second temps ; le MVP retourne la
    //    confirmation + un lien d'invitation partageable.
    const inviteLink = `${process.env.APP_URL || 'https://academiahelm.com'}/promoteur?ref=${user.tenantId.slice(0, 8)}`;

    return {
      success: true,
      promoterEmail: dto.promoterEmail,
      inviteLink,
      message:
        'Votre promoteur recevra une présentation d’Academia Helm. Vous pouvez aussi lui partager le lien directement.',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PRIVÉ
  // ─────────────────────────────────────────────────────────────────────────

  private async buildLoginResponse(
    userId: string,
    tenantId: string,
    teacherId: string,
    ipAddress?: string,
    userAgent?: string,
    extra?: { justRegistered?: boolean; levels?: TeacherLevelCode[] },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Utilisateur introuvable');
    const teacher = await this.prisma.teacher.findUnique({ where: { id: teacherId } });

    const session = await this.portalSessionService.createSession(
      tenantId,
      PORTAL_TEACHER,
      user.id,
      ipAddress,
      userAgent,
    );

    const token = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        tenantId,
        role: user.role,
        portalType: PORTAL_TEACHER,
      },
      { expiresIn: '24h' },
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Périmètre serveur (Rôles × Pistes × Niveaux) — même contrat que loginTeacher
    let scopeSummary: any = null;
    try {
      const scope = await this.accessScopeService.resolveUserScope({
        id: user.id,
        email: user.email,
        tenantId,
        role: user.role,
        isSuperAdmin: false,
      });
      scopeSummary = {
        levelCodes: scope.levelCodes,
        allLevels: scope.allLevels,
        trackCodes: scope.trackCodes,
        allTracks: scope.allTracks,
        locale: scope.locale,
        teacherId: scope.teacherId,
        isTeacher: scope.isTeacher,
        classIds: scope.classIds,
      };
    } catch {
      scopeSummary = null;
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: (user as any).avatarUrl ?? null,
        role: user.role,
        tenantId,
      },
      teacher: teacher ? { id: teacher.id, matricule: teacher.matricule } : null,
      scope: scopeSummary,
      token,
      sessionId: session.id,
      portalType: PORTAL_TEACHER,
      ...(extra?.justRegistered ? { justRegistered: true } : {}),
      ...(extra?.levels ? { levels: extra.levels } : {}),
    };
  }
}

interface InviteInput {
  promoterEmail: string;
  schoolName?: string;
  message?: string;
}
