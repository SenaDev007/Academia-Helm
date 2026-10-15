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
    const loginResponse = await this.buildLoginResponse(
      provisioned.userId,
      provisioned.tenantId,
      provisioned.teacherId,
      ipAddress,
      userAgent,
      { justRegistered: true, levels: provisioned.levels },
    );

    // ⭐ Abonnement non encore activé (compte tout juste créé) : le front
    //    oriente l'enseignant vers le paiement d'activation du compteur.
    return {
      ...loginResponse,
      subscription: { status: 'TRIAL', currentPeriodEnd: null, daysRemaining: null },
    };
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

    // ⭐ État de l'abonnement : compte INACTIF (fin de grâce) → la page de
    //    paiement est proposée à la connexion (spécification Helm Enseignant).
    const subscriptionState = await this.resolveSubscriptionState(tenant.id);

    return {
      ...await this.buildLoginResponse(user.id, tenant.id, teacher.id, ipAddress, userAgent),
      subscription: subscriptionState,
    };
  }

  /**
   * ⭐ État d'abonnement embarqué dans la réponse login/register :
   *    - SUSPENDED/BLOCKED → le front redirige vers /prof/checkout
   *      (page de paiement pour réactiver le compte) ;
   *    - TRIAL/absent → l'inscription vient d'avoir lieu, le front oriente
   *      vers le paiement d'activation (onboarding) ;
   *    - ACTIVE/GRACE_PERIOD → accès normal au tableau de bord.
   */
  private async resolveSubscriptionState(tenantId: string) {
    const subscription = await this.prisma.helmSubscription.findUnique({
      where: { tenantId },
    });
    if (!subscription) {
      return { status: 'TRIAL', currentPeriodEnd: null as string | null, daysRemaining: null as number | null };
    }
    const now = new Date();
    const daysRemaining = subscription.currentPeriodEnd
      ? Math.max(
          0,
          Math.ceil(
            (subscription.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          ),
        )
      : null;
    return {
      status: String(subscription.status),
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      daysRemaining,
    };
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
            plan: 'Helm Enseignant',
            planCode: (helmSubscription as any).plan,
            status: (helmSubscription as any).status,
            billingCycle: (helmSubscription as any).billingCycle,
            monthlyAmount: (helmSubscription as any).monthlyAmount,
            currentPeriodStart: (helmSubscription as any).currentPeriodStart,
            currentPeriodEnd: (helmSubscription as any).currentPeriodEnd,
            gracePeriodEnd: (helmSubscription as any).gracePeriodEnd,
            lastPaymentDate: (helmSubscription as any).lastPaymentDate,
            trialEnd: (helmSubscription as any).trialEnd,
            daysRemaining: (helmSubscription as any).currentPeriodEnd
              ? Math.max(
                  0,
                  Math.ceil(
                    ((helmSubscription as any).currentPeriodEnd.getTime() - Date.now()) /
                      (1000 * 60 * 60 * 24),
                  ),
                )
              : null,
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
