/**
 * ============================================================================
 * PORTAL AUTH SERVICE - AUTHENTIFICATION MULTI-PORTAILS
 * ============================================================================
 * 
 * Service pour gérer l'authentification spécifique à chaque portail
 * 
 * ============================================================================
 */

import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { PortalSessionService } from './portal-session.service';
import { SmsService } from '../../communication/services/sms.service';
import { EmailService } from '../../communication/services/email.service';
import { AccessScopeService } from '../../common/context/access-scope.service';
import {
  SchoolPortalLoginDto,
  TeacherPortalLoginDto,
  ParentPortalLoginDto,
  PortalType,
} from '../dto/portal-login.dto';

/** UUID v4 regex (simplifié) pour distinguer id vs slug */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class PortalAuthService {
  private readonly logger = new Logger(PortalAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly portalSessionService: PortalSessionService,
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  /**
   * Indique si l'authentification parent exige un code OTP.
   *
   * Comportement actuel (par défaut, pour la première version — réalité
   * africaine / béninoise) : OTP DÉSACTIVÉ.
   * Le parent saisit juste son numéro de téléphone ou son email — s'il est
   * trouvé dans la table guardians (avec un User actif associé), le système
   * donne l'accès immédiatement sans demander de code OTP.
   *
   * Pour réactiver l'OTP dans une prochaine mise à jour :
   *   - mettre la variable d'environnement PARENT_OTP_ENABLED=true
   *   - OU modifier la valeur par défaut ci-dessous à `true`
   *
   * Le code OTP (génération, envoi SMS/email, vérification) reste implémenté
   * dans loginParentByPhone / loginParentByEmail — il sera réactivé
   * automatiquement quand ce flag passera à true.
   */
  private isParentOtpEnabled(): boolean {
    return this.configService.get<string>('PARENT_OTP_ENABLED', 'false').toLowerCase() === 'true';
  }

  /**
   * Résout le tenant par id (UUID) ou par slug.
   * Permet au frontend d'envoyer soit l'id (depuis l'URL) soit le slug (compatibilité).
   */
  private async resolveTenant(tenantIdOrSlug: string) {
    const isUuid = UUID_REGEX.test(tenantIdOrSlug.trim());
    const tenant = isUuid
      ? await this.prisma.tenant.findUnique({ where: { id: tenantIdOrSlug } })
      : await this.prisma.tenant.findUnique({ where: { slug: tenantIdOrSlug } });
    return tenant;
  }

  /**
   * Authentification Portail École
   * Email + Password pour Direction/Administration
   *
   * ⭐ Règle métier « double casquette » :
   *    Le personnel administratif se connecte au Portail École avec son
   *    ADRESSE EMAIL. Un enseignant qui cumule un poste administratif
   *    (affectation active dans staff_admin_assignments) peut aussi se
   *    connecter ici avec son email — le rôle de son compte User reflète
   *    alors son poste administratif (ex : DIRECTEUR_MAT_PRI).
   *    Un enseignant SANS poste administratif est refusé et orienté vers
   *    le Portail Enseignant (connexion par matricule).
   */
  async loginSchool(
    dto: SchoolPortalLoginDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const tenant = await this.resolveTenant(dto.tenantId);
    if (!tenant || tenant.status !== 'active') {
      throw new UnauthorizedException('Établissement non trouvé ou inactif');
    }
    const tenantId = tenant.id;

    // Trouver l'utilisateur (insensible à la casse)
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: (dto.email || '').trim().toLowerCase(), mode: 'insensitive' },
        tenantId,
        status: 'active',
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // ── Vérifier le rôle (Direction/Administration) ──
    //    ⭐ FIX : l'ancienne liste ['DIRECTOR', 'SUPER_DIRECTOR', 'ADMIN',
    //    'ACCOUNTANT'] (rôles anglais) ne matchait AUCUN des rôles réellement
    //    générés (français : DIRECTEUR, SECRETAIRE, COMPTABLE, CENSEUR... et
    //    niveau-spécifiques : DIRECTEUR_MAT_PRI, SECRETAIRE_COMPTABLE_SEC...)
    //    → aucun personnel administratif ne pouvait se connecter ici.
    //    On accepte désormais : rôles FR, rôles EN legacy, et rôles
    //    niveau-spécifiques. Les enseignants ne passent QUE s'ils ont un
    //    poste administratif actif (double casquette).
    const roleUpper = (user.role || '').toUpperCase();

    // Rôles enseignant / parent / élève → jamais le portail école par défaut
    const teacherLikeRoles = [
      'TEACHER', 'ENSEIGNANT', 'TEACHER_RESP', 'INSTITUTEUR', 'PROFESSEUR',
    ];
    const familyLikeRoles = [
      'PARENT', 'ELEVE', 'STUDENT', 'GUARDIAN', 'PARENT_PRIMARY', 'PARENT_SECONDARY',
    ];

    // Rôles administratifs : FR (UserRole enum), EN legacy, niveau-spécifiques
    const adminRolePattern =
      /^(PROMOTEUR|PROMOTER|DIRECTEUR|SECRETAIRE_COMPTABLE|SECRETAIRE|COMPTABLE|SURVEILLANT_GENERAL|SURVEILLANT|CENSEUR|DIRECTOR|SUPER_DIRECTOR|ADMIN|ACCOUNTANT|SCHOOL_OWNER|SCHOOL_ADMIN|DIRECTEUR_GENERAL|DIRECTEUR_ETABLISSEMENT)(_(MAT|PRI|SEC|MAT_PRI|MATERNELLE|PRIMAIRE|SECONDAIRE))?$/;
    const isAdminRole = adminRolePattern.test(roleUpper);

    if (!isAdminRole) {
      if (familyLikeRoles.includes(roleUpper)) {
        throw new UnauthorizedException(
          'Accès refusé. Ce portail est réservé à la direction et à l\'administration.',
        );
      }
      // Enseignant OU rôle inconnu : autorisé uniquement avec un poste
      // administratif actif dans ce tenant (double casquette).
      const hasAdminPosition = await this.hasActiveAdminAssignment(
        user.email,
        tenantId,
      );
      if (!hasAdminPosition) {
        if (teacherLikeRoles.includes(roleUpper)) {
          throw new UnauthorizedException(
            'Accès refusé. Ce portail est réservé à la direction et à l\'administration. Enseignant : connectez-vous via le Portail Enseignant avec votre matricule.',
          );
        }
        throw new UnauthorizedException(
          'Accès refusé. Ce portail est réservé à la direction et à l\'administration.',
        );
      }
    }

    // Vérifier le mot de passe
    if (!user.passwordHash) {
      throw new UnauthorizedException('Mot de passe non configuré');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Créer une session de portail
    const session = await this.portalSessionService.createSession(
      tenantId,
      PortalType.SCHOOL,
      user.id,
      ipAddress,
      userAgent,
    );

    // Générer le token JWT
    const token = this.generatePortalToken(user, PortalType.SCHOOL);

    // Mettre à jour le dernier login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: (user as any).avatarUrl ?? null,
        role: user.role,
        tenantId: user.tenantId,
      },
      token,
      sessionId: session.id,
      portalType: PortalType.SCHOOL,
    };
  }

  /**
   * Vérifie si l'utilisateur (par email) occupe un poste administratif ACTIF
   * dans ce tenant — c'est-à-dire une affectation active dans
   * staff_admin_assignments (rôle DIRECTEUR, SECRETAIRE, CENSEUR, ...).
   *
   * Utilisé par loginSchool pour la règle « double casquette » :
   * un enseignant qui cumule un poste administratif peut se connecter au
   * portail école avec son email.
   */
  private async hasActiveAdminAssignment(
    userEmail: string,
    tenantId: string,
  ): Promise<boolean> {
    try {
      const staff = await this.prisma.staff.findFirst({
        where: {
          tenantId,
          email: { equals: (userEmail || '').trim().toLowerCase(), mode: 'insensitive' },
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      if (!staff) return false;

      const assignment = await this.prisma.staffAdminAssignment.findFirst({
        where: {
          staffId: staff.id,
          tenantId,
          isActive: true,
        },
        select: { id: true, adminRole: true },
      });
      return !!assignment;
    } catch (err: any) {
      this.logger.warn(
        `hasActiveAdminAssignment failed for ${userEmail}: ${err?.message || err}`,
      );
      return false;
    }
  }

  /**
   * Authentification Portail Enseignant
   * Matricule enseignant + Password
   *
   * ⭐ Règle métier « double casquette » :
   *    Un personnel peut cumuler un poste ENSEIGNANT et un poste
   *    ADMINISTRATIF (ex : un instituteur qui est aussi Directeur de niveau).
   *    Dans ce cas :
   *      - Portail Enseignant → connexion par MATRICULE (ex : CSPEBE-26-00008)
   *      - Portail École      → connexion par EMAIL (rôle User = poste admin)
   *    loginTeacher accepte donc tout compte User lié à un Teacher actif du
   *    tenant, quel que soit son rôle (ENSEIGNANT, DIRECTEUR_*, SECRETAIRE_*,
   *    COMPTABLE_*, CENSEUR_*, ...). Un enseignant SANS profil Teacher actif
   *    est refusé.
   */
  async loginTeacher(
    dto: TeacherPortalLoginDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const tenant = await this.resolveTenant(dto.tenantId);
    if (!tenant || tenant.status !== 'active') {
      throw new UnauthorizedException('Établissement non trouvé ou inactif');
    }
    const tenantId = tenant.id;

    const identifier = (dto.teacherIdentifier || '').trim();
    if (!identifier) {
      throw new BadRequestException('Matricule enseignant requis');
    }

    // ── Étape 1 : Trouver l'enseignant par matricule (insensible à la casse) ──
    let teacher = await this.prisma.teacher.findFirst({
      where: {
        tenantId,
        matricule: { equals: identifier, mode: 'insensitive' },
        status: 'active',
      },
    });

    // ── Fallback : matricule RH du Staff (tenantMatricule / globalMatricule /
    //    employeeNumber) si le matricule du Teacher pédagogique diverge ──
    let staffEmail: string | null = null;
    if (!teacher) {
      const staff = await this.prisma.staff.findFirst({
        where: {
          tenantId,
          OR: [
            { tenantMatricule: { equals: identifier, mode: 'insensitive' } },
            { globalMatricule: { equals: identifier, mode: 'insensitive' } },
            { employeeNumber: { equals: identifier, mode: 'insensitive' } },
          ],
        },
        select: { email: true },
      });
      if (staff?.email) {
        staffEmail = staff.email.trim().toLowerCase();
        teacher = await this.prisma.teacher.findFirst({
          where: {
            tenantId,
            email: { equals: staffEmail, mode: 'insensitive' },
            status: 'active',
          },
        });
      }
    }

    if (!teacher) {
      throw new UnauthorizedException(
        'Matricule enseignant introuvable dans cet établissement. Vérifiez le matricule communiqué par votre école (ex : CSPEBE-26-00001).',
      );
    }

    // ── Étape 2 : Trouver le compte User associé ──
    //    Candidats email : email du Teacher, puis email du Staff (fallback).
    //    Recherche insensible à la casse (évite « Utilisateur associé non
    //    trouvé » si la casse diffère entre teachers.email et users.email).
    const candidateEmails = [
      ...new Set(
        [teacher.email, staffEmail]
          .filter((e): e is string => !!e && !!e.trim())
          .map((e) => e.trim().toLowerCase()),
      ),
    ];

    let user = null;
    for (const email of candidateEmails) {
      user = await this.prisma.user.findFirst({
        where: {
          tenantId,
          email: { equals: email, mode: 'insensitive' },
          status: 'active',
        },
        include: {
          userRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (user) break;
    }

    if (!user) {
      throw new UnauthorizedException(
        'Compte utilisateur non configuré pour cet enseignant. Contactez l\'administration de votre école pour générer vos identifiants.',
      );
    }

    // ── Étape 3 : Vérifier l'accès au portail enseignant ──
    //    Accepté si :
    //      a) rôle enseignant (TEACHER, ENSEIGNANT, ...), OU
    //      b) rôle administratif/direction FR, EN ou niveau-spécifique —
    //         cas « double casquette » : l'utilisateur cumule enseignement
    //         et administration, OU
    //      c) l'utilisateur possède un profil Teacher actif dans ce tenant
    //         (liaison par email, insensible à la casse).
    const roleUpper = (user.role || '').toUpperCase();
    const teacherLikeRoles = [
      'TEACHER', 'ENSEIGNANT', 'TEACHER_RESP', 'INSTITUTEUR', 'PROFESSEUR',
    ];
    const adminLikeRolePattern =
      /^(PROMOTEUR|PROMOTER|DIRECTEUR|SECRETAIRE_COMPTABLE|SECRETAIRE|COMPTABLE|SURVEILLANT_GENERAL|SURVEILLANT|CENSEUR|DIRECTOR|SUPER_DIRECTOR|ADMIN|ACCOUNTANT|SCHOOL_OWNER|SCHOOL_ADMIN|DIRECTEUR_GENERAL|DIRECTEUR_ETABLISSEMENT)(_(MAT|PRI|SEC|MAT_PRI|MATERNELLE|PRIMAIRE|SECONDAIRE))?$/;
    const isAllowedRole =
      teacherLikeRoles.includes(roleUpper) || adminLikeRolePattern.test(roleUpper);

    if (!isAllowedRole) {
      const hasTeacherProfile = await this.prisma.teacher.findFirst({
        where: {
          tenantId,
          email: { equals: user.email, mode: 'insensitive' },
          status: 'active',
        },
      });
      if (!hasTeacherProfile) {
        throw new UnauthorizedException(
          'Accès refusé. Ce portail est réservé aux enseignants.',
        );
      }
    }

    // Vérifier le mot de passe
    if (!user.passwordHash) {
      throw new UnauthorizedException('Mot de passe non configuré');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Créer une session de portail
    const session = await this.portalSessionService.createSession(
      tenantId,
      PortalType.TEACHER,
      user.id,
      ipAddress,
      userAgent,
    );

    // Générer le token JWT
    const token = this.generatePortalToken(user, PortalType.TEACHER);

    // Mettre à jour le dernier login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // ⭐ Filtre Rôles × Pistes × Niveaux — périmètre serveur dans la réponse
    //    login : le frontend initialise sa langue UI et ses sélecteurs depuis
    //    ces données (plus d'heuristique côté client).
    let scopeSummary: any = null;
    try {
      const scope = await this.accessScopeService.resolveUserScope({
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
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
        tenantId: user.tenantId,
      },
      teacher: {
        id: teacher.id,
        matricule: teacher.matricule,
      },
      scope: scopeSummary,
      token,
      sessionId: session.id,
      portalType: PortalType.TEACHER,
    };
  }

  /**
   * Authentification Portail Parent — multi-canal
   *
   * Deux identifiants acceptés (au choix du parent) :
   *   - Téléphone (mode historique, OTP par SMS)
   *   - Email     (mode pour parents lettrés, OTP par email OU mot de passe)
   *
   * Si l'identifiant ressemble à un email (contient '@'), on bascule en mode EMAIL.
   * Sinon, on reste en mode PHONE (rétro-compatibilité).
   *
   * Trois flux possibles :
   *   1. PHONE → OTP SMS (envoi + vérification)
   *   2. EMAIL → OTP email (envoi + vérification)
   *   3. EMAIL → password ( connexion directe en une étape)
   */
  async loginParent(
    dto: ParentPortalLoginDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const tenant = await this.resolveTenant(dto.tenantId);
    if (!tenant || tenant.status !== 'active') {
      throw new UnauthorizedException('Établissement non trouvé ou inactif');
    }
    const tenantId = tenant.id;

    // ── Déterminer le mode d'authentification ──
    // identifierType explicite → on l'utilise.
    // Sinon : email fourni OU phone contient '@' → mode EMAIL ; sinon mode PHONE.
    const identifierType: 'PHONE' | 'EMAIL' =
      dto.identifierType ||
      (dto.email || (dto.phone && dto.phone.includes('@')) ? 'EMAIL' : 'PHONE');

    if (identifierType === 'EMAIL') {
      return this.loginParentByEmail(dto, tenantId, ipAddress, userAgent);
    }
    return this.loginParentByPhone(dto, tenantId, ipAddress, userAgent);
  }

  /**
   * Connexion parent par téléphone — sans OTP si PARENT_OTP_ENABLED=false (défaut).
   *
   * Si OTP désactivé (par défaut, réalité béninoise) :
   *   - Si le guardian est trouvé par téléphone ET a un User actif → connexion immédiate
   *   - Sinon → erreur "Numéro non trouvé" ou "Compte non configuré"
   *
   * Si OTP activé (PARENT_OTP_ENABLED=true) :
   *   - Comportement historique : génération + envoi SMS + vérification
   */
  private async loginParentByPhone(
    dto: ParentPortalLoginDto,
    tenantId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (!dto.phone) {
      throw new BadRequestException('Numéro de téléphone requis');
    }

    // Trouver le parent par téléphone
    const guardian = await this.prisma.guardian.findFirst({
      where: {
        tenantId,
        phone: dto.phone,
      },
    });

    if (!guardian) {
      throw new UnauthorizedException('Numéro de téléphone non trouvé');
    }

    // Trouver l'utilisateur associé par email
    const user = guardian.email ? await this.prisma.user.findFirst({
      where: {
        tenantId,
        email: guardian.email,
        status: 'active',
      },
    }) : null;

    // ── Mode OTP désactivé (défaut, première version) ──
    // On connecte directement le parent si son téléphone est dans la DB
    // et qu'un User actif lui est associé.
    if (!this.isParentOtpEnabled()) {
      if (!user) {
        throw new UnauthorizedException(
          'Compte parent non configuré. Contactez l\'administration de l\'école pour activer votre compte.',
        );
      }
      this.logger.log(`Connexion parent (sans OTP) — guardian ${guardian.id}, user ${user.id}, phone ${dto.phone}`);
      return this.finalizeParentLogin(user, guardian, tenantId, PortalType.PARENT, ipAddress, userAgent);
    }

    // ── Mode OTP activé (PARENT_OTP_ENABLED=true) ──
    // Comportement historique avec envoi + vérification OTP.

    // Si pas d'OTP fourni, générer et envoyer
    if (!dto.otp) {
      const otp = this.generateOTP();
      await this.storeParentOtp(tenantId, `phone:${dto.phone}`, otp);

      // Envoyer OTP via SMS
      try {
        const smsMessage = `Academia Helm - Votre code de connexion est : ${otp}. Valable 5 minutes.`;
        await this.smsService.sendSMS(dto.phone, smsMessage);
        this.logger.log(`OTP envoyé par SMS au parent ${guardian.id} (${dto.phone})`);
      } catch (smsError: any) {
        this.logger.error(`ÉCHEC ENVOI SMS OTP au parent ${guardian.id} (${dto.phone}): ${smsError?.message || smsError}`);
        // On continue même si l'envoi SMS échoue — le code OTP reste disponible en dev
      }

      return {
        message: 'Code OTP envoyé par SMS',
        phone: dto.phone,
        otp: process.env.NODE_ENV === 'development' ? otp : undefined,
      };
    }

    // Vérifier l'OTP
    const otpValid = await this.verifyParentOtp(tenantId, `phone:${dto.phone}`, dto.otp);
    if (!otpValid) {
      throw new UnauthorizedException('Code OTP invalide ou expiré');
    }

    if (!user) {
      throw new UnauthorizedException('Compte parent non configuré');
    }

    return this.finalizeParentLogin(user, guardian, tenantId, PortalType.PARENT, ipAddress, userAgent);
  }

  /**
   * Connexion parent par email — sans OTP si PARENT_OTP_ENABLED=false (défaut).
   *
   * Si OTP désactivé :
   *   - Si le guardian est trouvé par email ET a un User actif → connexion immédiate
   *   - Si un mot de passe est fourni, on le vérifie (couche supplémentaire
   *     pour les parents lettrés qui ont configuré un mot de passe)
   *
   * Si OTP activé :
   *   - Mode 1 : EMAIL + password (1 étape)
   *   - Mode 2 : EMAIL + OTP par email
   */
  private async loginParentByEmail(
    dto: ParentPortalLoginDto,
    tenantId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const email = dto.email || (dto.phone && dto.phone.includes('@') ? dto.phone : '');
    if (!email) {
      throw new BadRequestException('Adresse email requise');
    }
    const normalizedEmail = email.trim().toLowerCase();

    // Trouver le guardian par email
    const guardian = await this.prisma.guardian.findFirst({
      where: {
        tenantId,
        email: normalizedEmail,
      },
    });

    if (!guardian) {
      throw new UnauthorizedException('Adresse email non trouvée');
    }

    // Trouver l'utilisateur associé par email
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        email: normalizedEmail,
        status: 'active',
      },
    });

    if (!user) {
      throw new UnauthorizedException('Compte parent non configuré pour cet email');
    }

    // ── Mode OTP désactivé (défaut) ──
    // Connexion directe, éventuellement sécurisée par mot de passe si fourni.
    if (!this.isParentOtpEnabled()) {
      // Si un mot de passe est fourni, on le vérifie (couche supplémentaire
      // de sécurité optionnelle pour les parents qui en ont configuré un).
      if (dto.password) {
        if (!user.passwordHash) {
          throw new UnauthorizedException('Mot de passe non configuré. Laissez le champ vide pour vous connecter sans mot de passe.');
        }
        const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isPasswordValid) {
          throw new UnauthorizedException('Identifiants invalides');
        }
      }
      // Si pas de mot de passe fourni → connexion directe (comme pour le téléphone)
      this.logger.log(`Connexion parent (sans OTP) — guardian ${guardian.id}, user ${user.id}, email ${normalizedEmail}`);
      return this.finalizeParentLogin(user, guardian, tenantId, PortalType.PARENT, ipAddress, userAgent);
    }

    // ── Mode OTP activé (PARENT_OTP_ENABLED=true) ──

    // Mode 1 : password (connexion directe, 1 étape)
    if (dto.password) {
      if (!user.passwordHash) {
        throw new UnauthorizedException('Mot de passe non configuré. Utilisez plutôt le code OTP.');
      }
      const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Identifiants invalides');
      }
      return this.finalizeParentLogin(user, guardian, tenantId, PortalType.PARENT, ipAddress, userAgent);
    }

    // Mode 2 : OTP par email
    if (!dto.otp) {
      const otp = this.generateOTP();
      await this.storeParentOtp(tenantId, `email:${normalizedEmail}`, otp);

      // Envoyer OTP par email
      try {
        const parentName = `${guardian.firstName || ''} ${guardian.lastName || ''}`.trim() || 'Cher parent';
        await this.emailService.sendEmail({
          to: normalizedEmail,
          subject: 'Academia Helm — Votre code de connexion',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #0d7c66;">Bonjour ${parentName},</h2>
              <p>Vous avez demandé à vous connecter au portail parent Academia Helm.</p>
              <p>Votre code de connexion à usage unique est :</p>
              <div style="text-align: center; margin: 24px 0;">
                <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0d7c66; background: #ecfdf5; padding: 12px 24px; border-radius: 12px;">${otp}</span>
              </div>
              <p style="color: #6b7280; font-size: 13px;">Ce code est valable 5 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
              <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px;">Academia Helm — Portail Parent</p>
            </div>
          `,
          text: `Bonjour ${parentName}, votre code de connexion Academia Helm est : ${otp}. Valable 5 minutes.`,
        });
        this.logger.log(`OTP envoyé par EMAIL au parent ${guardian.id} (${normalizedEmail})`);
      } catch (emailError: any) {
        this.logger.error(`ÉCHEC ENVOI EMAIL OTP au parent ${guardian.id} (${normalizedEmail}): ${emailError?.message || emailError}`);
      }

      return {
        message: 'Code OTP envoyé par email',
        email: normalizedEmail,
        otp: process.env.NODE_ENV === 'development' ? otp : undefined,
      };
    }

    // Vérifier l'OTP
    const otpValid = await this.verifyParentOtp(tenantId, `email:${normalizedEmail}`, dto.otp);
    if (!otpValid) {
      throw new UnauthorizedException('Code OTP invalide ou expiré');
    }

    return this.finalizeParentLogin(user, guardian, tenantId, PortalType.PARENT, ipAddress, userAgent);
  }

  /**
   * Étape commune finale : créer la session, générer le JWT, mettre à jour lastLogin.
   *
   * ⚠️ IMPORTANT — Affichage du nom du parent :
   * On utilise guardian.firstName / guardian.lastName (le vrai nom du parent
   * tel qu'enregistré lors de l'inscription de l'enfant) et NON user.firstName /
   * user.lastName (qui peut être le nom d'un enseignant si l'utilisateur est
   * à la fois enseignant et parent, et que son compte User a été créé pour
   * l'enseignant avec le même email).
   *
   * Cas concret : M. Saliou Akpaki est enseignant ET parent d'élève.
   * Son compte User (role=TEACHER) a email=saliou@example.com.
   * Son Guardian (parent de l'élève) a aussi email=saliou@example.com.
   * Quand il se connecte via le portail PARENT, on doit afficher son nom
   * de PARENT (Guardian), pas son nom d'enseignant (User).
   * → On override user.firstName/lastName avec guardian.firstName/lastName.
   */
  private async finalizeParentLogin(
    user: any,
    guardian: any,
    tenantId: string,
    portalType: PortalType,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const session = await this.portalSessionService.createSession(
      tenantId,
      portalType,
      user.id,
      ipAddress,
      userAgent,
    );

    // Générer le token JWT
    const token = this.generatePortalToken(user, portalType);

    // Mettre à jour le dernier login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // ⭐ Override du nom : utiliser le nom du Guardian (parent) et non du User
    // (qui peut être un enseignant partageant le même email).
    // Si le Guardian n'a pas de firstName/lastName, on garde le nom du User.
    const displayName = {
      firstName: guardian.firstName || user.firstName || '',
      lastName: guardian.lastName || user.lastName || '',
    };

    return {
      user: {
        id: user.id,
        email: user.email,
        // ⭐ Nom du parent (Guardian) prioritaire sur le nom du User
        firstName: displayName.firstName,
        lastName: displayName.lastName,
        avatarUrl: (user as any).avatarUrl ?? null,
        role: user.role,
        tenantId: user.tenantId,
      },
      guardian: {
        id: guardian.id,
        phone: guardian.phone,
        email: guardian.email,
        // Inclure aussi le nom du guardian pour le frontend
        firstName: guardian.firstName || '',
        lastName: guardian.lastName || '',
      },
      token,
      sessionId: session.id,
      portalType,
    };
  }

  /**
   * Génère un token JWT pour le portail
   */
  private generatePortalToken(user: any, portalType: PortalType): string {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
      portalType,
    };

    return this.jwtService.sign(payload, {
      expiresIn: '24h',
    });
  }

  /**
   * Génère un code OTP à 6 chiffres
   */
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /** Stockage OTP temporaire (en mémoire, TTL 5 min). En production préférer Redis ou table dédiée. */
  private readonly parentOtpStore = new Map<string, { code: string; expiresAt: number }>();
  private static readonly PARENT_OTP_TTL_MS = 5 * 60 * 1000;

  /**
   * Normalise la clé OTP pour qu'elle soit stable entre envoi et vérification.
   *   - Préfixe "phone:" → ne garder que les chiffres
   *   - Préfixe "email:" → lower-case + trim
   *   - Sinon (legacy, numéro de tel brut) → ne garder que les chiffres
   */
  private normalizeOtpKey(rawKey: string): string {
    if (rawKey.startsWith('email:')) {
      return `email:${rawKey.slice('email:'.length).trim().toLowerCase()}`;
    }
    if (rawKey.startsWith('phone:')) {
      const phone = rawKey.slice('phone:'.length);
      return `phone:${phone.replace(/\D/g, '').trim() || phone}`;
    }
    // Legacy: numéro de téléphone brut sans préfixe
    return rawKey.replace(/\D/g, '').trim() || rawKey;
  }

  private async storeParentOtp(tenantId: string, rawKey: string, code: string): Promise<void> {
    const normalized = this.normalizeOtpKey(rawKey);
    const key = `${tenantId}:${normalized}`;
    this.parentOtpStore.set(key, {
      code,
      expiresAt: Date.now() + PortalAuthService.PARENT_OTP_TTL_MS,
    });
  }

  private async verifyParentOtp(tenantId: string, rawKey: string, code: string): Promise<boolean> {
    const normalized = this.normalizeOtpKey(rawKey);
    const key = `${tenantId}:${normalized}`;
    const entry = this.parentOtpStore.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.parentOtpStore.delete(key);
      return false;
    }
    const valid = entry.code === code.trim();
    if (valid) this.parentOtpStore.delete(key);
    return valid;
  }
}

