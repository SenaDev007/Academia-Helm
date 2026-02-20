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
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { PortalSessionService } from './portal-session.service';
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

    // Vérifier le rôle
    if (user.role !== 'TEACHER') {
      throw new UnauthorizedException(
        'Accès refusé. Ce portail est réservé aux enseignants.',
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
   * Authentification Portail Parent
   * Téléphone + OTP
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
      await this.storeParentOtp(tenantId, dto.phone, otp);
      // TODO: Envoyer OTP via SMS/WhatsApp en production
      this.logger.log(`OTP generated for parent ${guardian.id}: ${otp}`);

      return {
        message: 'Code OTP envoyé',
        phone: dto.phone,
        otp: process.env.NODE_ENV === 'development' ? otp : undefined,
      };
    }

    // Vérifier l'OTP
    const otpValid = await this.verifyParentOtp(tenantId, dto.phone, dto.otp);
    if (!otpValid) {
      throw new UnauthorizedException('Code OTP invalide ou expiré');
    }

    if (!user) {
      throw new UnauthorizedException('Compte parent non configuré');
    }

    const session = await this.portalSessionService.createSession(
      tenantId,
      PortalType.PARENT,
      user.id,
      ipAddress,
      userAgent,
    );

    // Générer le token JWT
    const token = this.generatePortalToken(user, PortalType.PARENT);

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
      },
      token,
      sessionId: session.id,
      portalType: PortalType.PARENT,
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

  private normalizePhoneForOtpKey(phone: string): string {
    return phone.replace(/\D/g, '').trim() || phone;
  }

  private async storeParentOtp(tenantId: string, phone: string, code: string): Promise<void> {
    const key = `${tenantId}:${this.normalizePhoneForOtpKey(phone)}`;
    this.parentOtpStore.set(key, {
      code,
      expiresAt: Date.now() + PortalAuthService.PARENT_OTP_TTL_MS,
    });
  }

  private async verifyParentOtp(tenantId: string, phone: string, code: string): Promise<boolean> {
    const key = `${tenantId}:${this.normalizePhoneForOtpKey(phone)}`;
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

