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
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { PortalSessionService } from './portal-session.service';
import { SmsService } from '../../communication/services/sms.service';
import { EmailService } from '../../communication/services/email.service';
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
  ) {}

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

    // Trouver l'utilisateur
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
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

    // Vérifier le rôle (Direction/Administration uniquement)
    const allowedRoles = ['DIRECTOR', 'SUPER_DIRECTOR', 'ADMIN', 'ACCOUNTANT'];
    const userRole = user.role || '';
    if (!allowedRoles.includes(userRole)) {
      throw new UnauthorizedException(
        'Accès refusé. Ce portail est réservé à la direction et à l\'administration.',
      );
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
        role: user.role,
        tenantId: user.tenantId,
      },
      token,
      sessionId: session.id,
      portalType: PortalType.SCHOOL,
    };
  }

  /**
   * Authentification Portail Enseignant
   * Identifiant enseignant + Password
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

    // Trouver l'enseignant par matricule
    const teacher = await this.prisma.teacher.findFirst({
      where: {
        tenantId,
        matricule: dto.teacherIdentifier,
        status: 'active',
      },
    });

    if (!teacher) {
      throw new UnauthorizedException('Identifiant enseignant invalide');
    }

    // Trouver l'utilisateur associé par email
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        email: teacher.email || '',
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
      throw new UnauthorizedException('Utilisateur associé non trouvé');
    }

    // Vérifier que l'utilisateur a un profil enseignant (et non juste un rôle)
    // On accepte plusieurs variantes de rôle : TEACHER, ENSEIGNANT, ou tout
    // utilisateur lié à un enregistrement dans la table teachers.
    // Cela permet aux membres de l'administration (COMPTABLE, DIRECTOR, etc.)
    // qui sont aussi habilités à enseigner d'accéder au portail enseignant.
    const allowedTeacherRoles = [
      'TEACHER', 'ENSEIGNANT', 'TEACHER_RESP',
      'COMPTABLE', 'DIRECTOR', 'ADMIN', 'PROMOTER',
      'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT',
      'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'SUPER_DIRECTOR',
    ];
    const isTeacherRole = allowedTeacherRoles.some(
      (r) => user.role?.toUpperCase() === r,
    );

    // Si le rôle n'est pas dans la liste, on vérifie quand même si l'utilisateur
    // a un profil teacher actif (son email correspond à un teacher actif).
    if (!isTeacherRole) {
      const hasTeacherProfile = await this.prisma.teacher.findFirst({
        where: {
          tenantId,
          email: user.email,
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

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
      },
      teacher: {
        id: teacher.id,
        matricule: teacher.matricule,
      },
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
   * Connexion parent par téléphone + OTP SMS (comportement historique).
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
   * Connexion parent par email — deux modes : OTP email ou mot de passe.
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

    // ── Mode 1 : password (connexion directe, 1 étape) ──
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

    // ── Mode 2 : OTP par email ──
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

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
      },
      guardian: {
        id: guardian.id,
        phone: guardian.phone,
        email: guardian.email,
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

