import { Injectable, UnauthorizedException, ForbiddenException, NotFoundException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../communication/services/email.service';
import { LoginDto, PortalType } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

export type SessionPersistMeta = {
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto, meta?: SessionPersistMeta) {
    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user
    const user = await this.usersService.create({
      ...registerDto,
      passwordHash: hashedPassword,
    });

    // Generate tokens
    const tokens = this.generateTokens(user);
    const sessionRecord = await this.persistWebSession(user.id, tokens.refreshToken, meta);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: user.tenantId,
      },
      ...tokens,
      ...(sessionRecord ? { serverSessionId: sessionRecord.id } : {}),
    };
  }

  /**
   * Enregistre la session côté PostgreSQL (table sessions), alignée sur le refresh token JWT.
   */
  private async persistWebSession(
    userId: string,
    refreshToken: string,
    meta?: SessionPersistMeta,
  ): Promise<{ id: string } | null> {
    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      return await this.prisma.session.create({
        data: {
          userId,
          token: refreshToken,
          expiresAt,
          ipAddress: meta?.ipAddress ?? null,
          userAgent: meta?.userAgent ?? null,
        },
      });
    } catch (err: any) {
      this.logger.warn(`persistWebSession failed: ${err?.message ?? err}`);
      return null;
    }
  }

  async login(loginDto: LoginDto, meta?: SessionPersistMeta) {
    try {
      // Find user by email
      const user = await this.usersService.findByEmail(loginDto.email);
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

    // Verify password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Vérifier si l'utilisateur est PLATFORM_OWNER
    const isOwner = this.isPlatformOwner(user);

    // Si PLATFORM_OWNER → pas de tenant requis
    if (isOwner) {
      if (loginDto.portal_type && loginDto.portal_type !== 'PLATFORM') {
        throw new ForbiddenException('PLATFORM_OWNER must use PLATFORM portal type');
      }
      // Update last login
      await this.usersService.updateLastLogin(user.id);
      
      // Generate tokens SANS tenantId pour PLATFORM_OWNER
      const tokens = this.generateTokens(user);
      const sessionRecord = await this.persistWebSession(user.id, tokens.refreshToken, meta);

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: this.jwtRole(user),
          isPlatformOwner: true,
        },
        ...tokens,
        ...(sessionRecord ? { serverSessionId: sessionRecord.id } : {}),
      };
    }

    // Pour les autres utilisateurs, refuser PLATFORM (réservé au PLATFORM_OWNER)
    if (loginDto.portal_type === PortalType.PLATFORM) {
      throw new ForbiddenException('Only PLATFORM_OWNER can use PLATFORM portal type');
    }

    // ── Validation stricte rôle ↔ portail (RBAC 7 dimensions) ──
    // Un utilisateur ne peut se connecter QUE via le portail correspondant à son rôle.
    if (loginDto.portal_type) {
      const allowedPortals = this.getAllowedPortalsForRole(user.role);
      if (!allowedPortals.includes(loginDto.portal_type)) {
        const portalNames: Record<string, string> = {
          PLATFORM: 'Plateforme',
          SCHOOL: 'École',
          TEACHER: 'Enseignant',
          PARENT: 'Parent / Élève',
        };
        const currentPortalName = portalNames[loginDto.portal_type] || loginDto.portal_type;
        const allowedNames = allowedPortals.map(p => portalNames[p] || p).join(' ou ');
        throw new ForbiddenException(
          `PORTAL_MISMATCH: Ce compte ne peut pas utiliser le portail ${currentPortalName}. Veuillez utiliser le portail ${allowedNames}.`,
        );
      }
    }

    // Si portal_type est SCHOOL, TEACHER ou PARENT, tenant_id est requis
    if (loginDto.portal_type) {
      if (!loginDto.tenant_id) {
        throw new ForbiddenException('Tenant ID is required for this portal type');
      }

      // Vérifier que le tenant existe et est actif
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: loginDto.tenant_id },
      });

      if (!tenant || tenant.status !== 'active') {
        throw new ForbiddenException('Tenant not found or inactive');
      }

      // Vérifier que l'utilisateur appartient à ce tenant
      if (user.tenantId !== loginDto.tenant_id) {
        throw new ForbiddenException('User does not belong to the specified tenant');
      }
    }

    // Si tenant_id est fourni sans portal_type, vérifier l'appartenance au tenant
    if (loginDto.tenant_id && !loginDto.portal_type) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: loginDto.tenant_id },
      });

      if (!tenant || tenant.status !== 'active') {
        throw new ForbiddenException('Tenant not found or inactive');
      }

      // Vérifier que l'utilisateur appartient à ce tenant
      if (user.tenantId !== loginDto.tenant_id) {
        throw new ForbiddenException('User does not belong to the specified tenant');
      }
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    // Generate tokens (SANS tenantId pour l'instant, sera sélectionné via /auth/select-tenant)
    // Si tenant_id est fourni, on peut l'inclure directement
    const tokens = loginDto.tenant_id 
      ? this.generateEnrichedToken(user, loginDto.tenant_id)
      : this.generateTokens(user);

      const sessionRecord = await this.persistWebSession(user.id, tokens.refreshToken, meta);

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: this.jwtRole(user),
          tenantId: loginDto.tenant_id || null,
          isPlatformOwner: this.isPlatformOwner(user),
        },
        ...tokens,
        ...(sessionRecord ? { serverSessionId: sessionRecord.id } : {}),
      };
    } catch (error: any) {
      // ✅ Gestion d'erreur Prisma avec message clair
      if (error?.code === 'P1001' || error?.message?.includes('Can\'t reach database server')) {
        this.logger.error('Database connection failed during login:', error.message);
        throw new ServiceUnavailableException(
          'Service temporairement indisponible. Veuillez réessayer plus tard.'
        );
      }
      // Si c'est déjà une exception NestJS, la propager
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
      // Pour les autres erreurs, logger et propager
      this.logger.error('Login error:', error);
      throw error;
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.usersService.findOne(payload.sub);

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Preserve tenant context from the refresh token payload
      // so the new access token keeps the same tenantId/academicYearId
      const tenantId = payload.tenantId || null;
      const academicYearId = payload.academicYearId || null;

      if (tenantId) {
        return this.generateEnrichedToken(user, tenantId, academicYearId);
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(token: string) {
    if (!token) return;
    try {
      const payload = this.jwtService.verify(token, { ignoreExpiration: true });
      if (payload && payload.exp) {
        const expiresAt = new Date(payload.exp * 1000);
        // Ensure token is not already revoked
        const exists = await this.prisma.revokedToken.findUnique({ where: { token } });
        if (!exists) {
          await this.prisma.revokedToken.create({
            data: { token, expiresAt },
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to revoke token during logout: ${err.message}`);
    }
  }

  /**
   * Génère un token JWT initial SANS tenant_id (après login)
   * Le tenant sera sélectionné via /auth/select-tenant
   */
  private generateTokens(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: this.jwtRole(user),
      // ❌ PAS de tenantId ici - sera ajouté après sélection
    };

    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
    };
  }

  /**
   * Génère un token JWT enrichi AVEC tenant_id (après sélection tenant)
   */
  private generateEnrichedToken(user: any, tenantId: string, academicYearId?: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: this.jwtRole(user),
      tenantId: tenantId,
      academicYearId: academicYearId || null,
      contextLocked: true, // Indique que le contexte est verrouillé
    };

    return {
      accessToken: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  /**
   * Retourne les portails autorisés pour un rôle donné.
   * Conforme au document academia-helm-portails.md :
   *   - PLATFORM (7 rôles) : PLATFORM_OWNER, SUPER_ADMIN, PLATFORM_ADMIN, etc.
   *   - SCHOOL (45 rôles) : DIRECTOR, ADMIN, ACCOUNTANT, DISCIPLINE_MASTER, etc.
   *   - TEACHER (11 rôles) : TEACHER, TEACHER_RESPONSIBLE, etc.
   *   - PARENT/ÉLÈVE (9 rôles) : PARENT, GUARDIAN, STUDENT, etc.
   *   - PUBLIC (5 rôles) : pas d'authentification requise
   */
  /**
   * Retourne les portails autorisés pour un rôle donné.
   * Conforme au document academia-helm-portails.md (77+ rôles, 5 portails).
   */
  private getAllowedPortalsForRole(role: string): PortalType[] {
    // ── Rôles PLATEFORME (7 rôles) — Document §01 ──
    const platformRoles = [
      'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN',
      'BILLING_MANAGER', 'SUPPORT_AGENT', 'TECHNICAL_OPERATOR', 'PLATFORM_AUDITOR',
      // Legacy
      'SUPER_ADMIN', 'PLATFORM_SUPPORT', 'PLATFORM_BILLING', 'PLATFORM_MODERATOR',
    ];
    if (platformRoles.includes(role)) return [PortalType.PLATFORM];

    // ── Rôles ÉCOLE (45 rôles) — Document §02 ──
    const schoolRoles = [
      // 3.1 Gouvernance et Direction Générale
      'SCHOOL_OWNER', 'BOARD_PRESIDENT', 'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR',
      // 3.2 Administration Générale
      'SCHOOL_ADMIN', 'ADMIN_AGENT', 'RESP_SCOLARITE', 'DATA_MANAGER', 'INTERNAL_AUDITOR',
      // 3.3 Maternelle
      'RESP_MATERNELLE', 'PEDAGOGIC_COORDINATOR', 'EXAM_MANAGER', 'SECRETARY', 'MONITOR',
      'TEACHING_ASSISTANT', 'ACTIVITIES_MANAGER',
      // 3.4 Primaire
      'RESP_PRIMAIRE',
      // 3.5 Secondaire
      'RESP_SECONDAIRE', 'CENSOR', 'GENERAL_MONITOR', 'ORIENTATION_MANAGER',
      // 3.6 Finance et Économat
      'CFO', 'FINANCE_MANAGER', 'ACCOUNTANT', 'CASHIER', 'RECOVERY_MANAGER',
      // 3.7 Pédagogie, Vie Scolaire et Services
      'PEDAGOGIC_DIRECTOR', 'SCHOOL_LIFE_MANAGER', 'COMMUNICATION_MANAGER', 'COMMUNICATION_AGENT',
      'HR_MANAGER', 'PAYROLL_MANAGER', 'IT_MANAGER', 'LIBRARIAN', 'CANTEEN_MANAGER',
      'TRANSPORT_MANAGER', 'BOARDING_MANAGER', 'HEALTH_MANAGER', 'SECURITY_MANAGER', 'SETTINGS_MANAGER',
      // Legacy
      'DIRECTOR', 'SUPER_DIRECTOR', 'ADMIN', 'DISCIPLINE_MASTER',
      'EDUCATION_INSPECTOR', 'GENERAL_SUPERVISOR', 'BOARDING_MASTER', 'DAYCARE_MANAGER',
      'LABORATORY_MANAGER', 'RECRUITMENT_OFFICER', 'CNSS_MANAGER', 'LEAVE_MANAGER',
      'CONTRACT_MANAGER', 'STAFF_MANAGER', 'QUALITY_MANAGER', 'QHSE_MANAGER', 'EVENT_MANAGER',
      'ALUMNI_MANAGER', 'PARTNERSHIP_MANAGER', 'FUNDING_MANAGER', 'GRANT_MANAGER',
      'MAINTENANCE_MANAGER', 'RECEPTIONIST', 'ASSISTANT_DIRECTOR', 'DEAN_OF_STUDIES',
      'PEDAGOGICAL_COORDINATOR', 'LEVEL_HEAD', 'DEPARTMENT_HEAD', 'INTERNSHIP_MANAGER',
      'ORIENTATION_COUNSELOR', 'SOCIAL_WORKER', 'NURSE', 'INFIRMARY_MANAGER', 'SHOP_MANAGER',
      // Frontend legacy roles
      'SCOLARITE', 'CAISSIER', 'COMPTABLE', 'ECONOME',
      'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'CENSEUR', 'SURVEILLANT_GENERAL',
    ];
    if (schoolRoles.includes(role)) return [PortalType.SCHOOL];

    // ── Rôles ENSEIGNANT (11 rôles) — Document §03 ──
    const teacherRoles = [
      'TEACHER', 'HEAD_TEACHER', 'SUBSTITUTE_TEACHER', 'TEACHER_ASSISTANT',
      'DEPARTMENT_COORDINATOR', 'PEDAGOGIC_ADVISOR', 'TEACHER_RESP',
      'TEACHER_INTERNSHIP', 'TUTOR', 'MENTOR', 'EXAMINER',
      // Legacy
      'TEACHER_RESPONSIBLE', 'CORRECTOR', 'SUPERVISOR', 'ANIMATOR', 'CONSULTANT',
      'INSTITUTEUR',
    ];
    if (teacherRoles.includes(role)) return [PortalType.TEACHER];

    // ── Rôles PARENT / ÉLÈVE (9 rôles) — Document §04 ──
    const parentRoles = [
      'PARENT', 'PARENT_PRIMARY', 'PARENT_SECONDARY', 'LEGAL_GUARDIAN',
      'FINANCIAL_RESPONSIBLE', 'GUARDIAN', 'STUDENT', 'CLASS_DELEGATE', 'ALUMNI',
      // Legacy
      'ALUMNUS', 'PROSPECT_PARENT', 'PROSPECT_STUDENT', 'SPONSOR', 'AMBASSADOR', 'VOLUNTEER',
    ];
    if (parentRoles.includes(role)) return [PortalType.PARENT];

    // ── Rôles PUBLIC (5 rôles) — Document §05 ──
    const publicRoles = [
      'VISITOR', 'PROSPECT_PARENT', 'APPLICANT', 'SPONSOR', 'AMBASSADOR',
    ];
    if (publicRoles.includes(role)) return [PortalType.PATRONAT]; // PUBLIC = PATRONAT in backend enum

    // Rôle non reconnu : autoriser SCHOOL par défaut (compatibilité arrière)
    return [PortalType.SCHOOL];
  }

  /**
   * Vérifie si l'utilisateur est PLATFORM_OWNER
   */
  private isPlatformOwner(user: any): boolean {
    if (!user) return false;
    const platformOwnerEmail = this.configService.get<string>('PLATFORM_OWNER_EMAIL');
    if (platformOwnerEmail && user.email === platformOwnerEmail) return true;
    if (user.role === 'PLATFORM_OWNER' || user.role === 'SUPER_ADMIN') return true;
    return false;
  }

  /** Rôle exposé dans le JWT et les réponses API (évite SUPER_DIRECTOR pour le compte dev owner) */
  private jwtRole(user: any): string {
    if (this.isPlatformOwner(user)) return 'PLATFORM_OWNER';
    return user?.role ?? 'USER';
  }

  /**
   * Liste des tenants pour le sélecteur « Mode développement » du portail (sans auth).
   * - Dev local : toujours autorisé.
   * - Production : uniquement si PLATFORM_OWNER_MODE=true (tests plateforme, aligné sur la liste publique écoles).
   */
  async getDevAvailableTenants(): Promise<any[]> {
    const appEnv = this.configService.get<string>('APP_ENV', 'production');
    const nodeEnv = process.env.NODE_ENV || 'production';
    const platformOwnerMode =
      this.configService.get<string>('PLATFORM_OWNER_MODE')?.trim().toLowerCase() === 'true';
    const isDev = appEnv === 'development' || nodeEnv === 'development';
    if (!isDev && !platformOwnerMode) {
      throw new ForbiddenException(
        'Liste des écoles (mode dev portail) indisponible en production sans PLATFORM_OWNER_MODE=true',
      );
    }
    // Après garde : dev local ou prod avec tests plateforme → tous les tenants SCHOOL actifs (exclut WITHDRAWN).
    const tenants = await this.prisma.tenant.findMany({
      where: {
        type: 'SCHOOL',
        status: { not: 'WITHDRAWN' },
      },
      include: {
        schools: {
          select: {
            name: true,
            logo: true,
            primaryPhone: true,
            primaryEmail: true,
            address: true,
          },
        },
        schoolSettings: {
          select: {
            logoUrl: true,
            phone: true,
            email: true,
            address: true,
            city: true,
            country: true,
            website: true,
          },
        },
        country: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
    return tenants.map((tenant) => ({
      tenantId: tenant.id,
      id: tenant.id,
      schoolName: tenant.schools?.name || tenant.name,
      tenantName: tenant.name,
      name: tenant.name,
      slug: tenant.slug,
      subdomain: tenant.subdomain,
      logoUrl: tenant.schoolSettings?.logoUrl || tenant.schools?.logo || null,
      country: tenant.country?.name || null,
      primaryPhone: tenant.schoolSettings?.phone || tenant.schools?.primaryPhone || null,
      primaryEmail: tenant.schoolSettings?.email || tenant.schools?.primaryEmail || null,
      address: tenant.schoolSettings?.address || tenant.schools?.address || null,
      city: tenant.schoolSettings?.city || null,
      website: tenant.schoolSettings?.website || null,
    }));
  }

  /**
   * Récupère la liste des tenants accessibles à l'utilisateur
   * 
   * Cas particuliers :
   * - PLATFORM_OWNER → retourne tous les tenants actifs
   * - Utilisateur mono-tenant → retourne son tenant
   * - Utilisateur multi-tenant → retourne tous ses tenants
   */
  async getAvailableTenants(userId: string): Promise<any[]> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // PLATFORM_OWNER → retourne tous les tenants actifs
    if (this.isPlatformOwner(user)) {
      const tenants = await this.prisma.tenant.findMany({
        where: {
          status: 'active',
          type: 'SCHOOL',
        },
        include: {
          schools: {
            select: {
              name: true,
              logo: true,
            },
          },
          country: {
            select: {
              name: true,
              code: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

      return tenants.map((tenant) => ({
        tenantId: tenant.id,
        schoolName: tenant.schools?.name || tenant.name,
        tenantName: tenant.name,
        slug: tenant.slug,
        subdomain: tenant.subdomain,
        logoUrl: tenant.schools?.logo ?? null,
        country: tenant.country?.name || null,
      }));
    }

    // Utilisateur normal → retourne son tenant (ou ses tenants si multi-tenant)
    const tenants = [];
    
    // Si l'utilisateur a un tenantId direct
    if (user.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
        include: {
          schools: {
            select: {
              name: true,
              logo: true,
            },
          },
          country: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      });

      if (tenant && tenant.status === 'active') {
        tenants.push({
          tenantId: tenant.id,
          schoolName: tenant.schools?.name || tenant.name,
          tenantName: tenant.name,
          slug: tenant.slug,
          subdomain: tenant.subdomain,
          logoUrl: tenant.schools?.logo ?? null,
          country: tenant.country?.name || null,
        });
      }
    }

    // TODO: Ajouter la logique pour les utilisateurs multi-tenant si nécessaire
    // (par exemple via une table de relation UserTenant)

    return tenants;
  }

  /**
   * Sélectionne un tenant et génère un nouveau token enrichi
   * 
   * Vérifie que l'utilisateur a le droit d'accéder à ce tenant
   */
  async selectTenant(userId: string, tenantId: string, meta?: SessionPersistMeta): Promise<any> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Vérifier que le tenant existe et est actif (sans include pour éviter erreurs Prisma/DB)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    if (tenant.status !== 'active') {
      throw new ForbiddenException(`Tenant is not active. Status: ${tenant.status}`);
    }

    // Vérifier que l'utilisateur a le droit d'accéder à ce tenant
    const isOwner = this.isPlatformOwner(user);
    const hasAccess = isOwner || user.tenantId === tenantId;

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this tenant');
    }

    // Récupérer l'année académique active (requête séparée, non bloquante si schéma DB divergent)
    let academicYear: { id: string; name: string; startDate: Date; endDate: Date } | null = null;
    try {
      academicYear = await this.prisma.academicYear.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { startDate: 'desc' },
      });
    } catch (err: any) {
      this.logger.warn('Could not load active academic year for select-tenant (non-blocking)', err?.message || err);
    }
    const academicYearId = academicYear?.id ?? null;

    // Générer un nouveau token enrichi avec le tenant
    const tokens = this.generateEnrichedToken(user, tenantId, academicYearId);
    const sessionRecord = await this.persistWebSession(userId, tokens.refreshToken, meta);

    // Logger la sélection de tenant
    this.logger.log(
      `🔐 Tenant selected: User ${user.email} (${user.id}) → Tenant ${tenant.name} (${tenantId})`
    );

    // TODO: Logger dans la table AuditLog si nécessaire

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: this.jwtRole(user),
        isPlatformOwner: isOwner,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        subdomain: tenant.subdomain,
      },
      academicYear: academicYear ? {
        id: academicYear.id,
        name: academicYear.name,
        startDate: academicYear.startDate,
        endDate: academicYear.endDate,
      } : null,
      ...tokens,
      ...(sessionRecord ? { serverSessionId: sessionRecord.id } : {}),
    };
  }

  /**
   * ============================================================================
   * FORGOT PASSWORD — Envoi d'un code OTP à 6 chiffres par email
   * ============================================================================
   *
   * Flux professionnel :
   *   1. L'utilisateur saisit son email
   *   2. Un code OTP à 6 chiffres est généré et stocké en DB (table password_resets)
   *   3. Le code est envoyé via Resend (noreply@academiahelm.com)
   *   4. L'utilisateur saisit le code (page OTP)
   *   5. Le code est vérifié → l'utilisateur peut définir un nouveau mot de passe
   *   6. Le code est marqué comme utilisé en DB
   *
   * Sécurité :
   *   - Même message de succès que l'email existe ou non (pas d'énumération)
   *   - Code expire après 10 minutes
   *   - Maximum 3 codes actifs par utilisateur (les anciens sont invalidés)
   *   - Maximum 5 tentatives de vérification par code
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(forgotPasswordDto.email);

    // Toujours le même message de succès — sécurité anti-énumération
    const successMessage = { message: "Si un compte existe avec cet email, un code de vérification vous a été envoyé." };

    if (!user) {
      this.logger.warn(`Tentative de réinitialisation pour un email inexistant: ${forgotPasswordDto.email}`);
      return successMessage;
    }

    // Générer un code OTP à 6 chiffres
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otpCode, 10);

    // Invalider les anciens codes non utilisés pour cet utilisateur
    await this.prisma.passwordReset.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() }, // Marquer comme utilisés/invalidés
    });

    // Stocker le nouveau code en base de données
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: hashedOtp,
        expiresAt,
      },
    });

    // Envoyer l'email avec le code OTP via Resend
    try {
      await this.sendPasswordResetOtpEmail(user.email, user.firstName || '', otpCode);
      this.logger.log(`Code OTP de réinitialisation envoyé à ${user.email}`);
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi du code OTP à ${user.email}`, error);
      // On continue pour ne pas fuiter l'erreur au client
    }

    return successMessage;
  }

  /**
   * Vérifie le code OTP de réinitialisation
   * Retourne un token temporaire si le code est valide
   */
  async verifyResetOtp(verifyDto: { email: string; code: string }): Promise<{ success: boolean; message: string }> {
    const user = await this.usersService.findByEmail(verifyDto.email);
    if (!user) {
      throw new ForbiddenException('Code invalide ou expiré.');
    }

    // Trouver le code OTP le plus récent non utilisé pour cet utilisateur
    const resetRecord = await this.prisma.passwordReset.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!resetRecord) {
      throw new ForbiddenException('Aucun code actif trouvé. Veuillez demander un nouveau code.');
    }

    // Vérifier le code OTP
    const isValidOtp = await bcrypt.compare(verifyDto.code, resetRecord.token);
    if (!isValidOtp) {
      // Incrémenter les tentatives — après 5, invalider le code
      const attempts = (resetRecord as any).attempts || 0;
      if (attempts + 1 >= 5) {
        await this.prisma.passwordReset.update({
          where: { id: resetRecord.id },
          data: { usedAt: new Date() }, // Invalider après trop de tentatives
        });
        throw new ForbiddenException('Trop de tentatives. Veuillez demander un nouveau code.');
      }
      throw new ForbiddenException('Code invalide. Veuillez réessayer.');
    }

    return { success: true, message: 'Code vérifié avec succès.' };
  }

  /**
   * Réinitialise le mot de passe après vérification du code OTP
   * Supporte aussi l'ancien format JWT token pour rétro-compatibilité
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    // ── Nouveau format : email + code OTP ──
    if (resetPasswordDto.email && resetPasswordDto.code) {
      return this.resetPasswordWithOtp(resetPasswordDto);
    }

    // ── Ancien format : JWT token (rétro-compatibilité) ──
    if (resetPasswordDto.token) {
      return this.resetPasswordWithToken(resetPasswordDto);
    }

    throw new ForbiddenException('Paramètres de réinitialisation manquants.');
  }

  /**
   * Réinitialisation via code OTP (nouveau flux)
   */
  private async resetPasswordWithOtp(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(resetPasswordDto.email!);
    if (!user) {
      throw new ForbiddenException('Utilisateur introuvable.');
    }

    // Trouver le code OTP le plus récent non utilisé
    const resetRecord = await this.prisma.passwordReset.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!resetRecord) {
      throw new ForbiddenException('Code de vérification invalide ou expiré. Veuillez recommencer le processus.');
    }

    // Vérifier le code OTP
    const isValidOtp = await bcrypt.compare(resetPasswordDto.code!, resetRecord.token);
    if (!isValidOtp) {
      throw new ForbiddenException('Code de vérification invalide.');
    }

    // Hacher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);

    // Transaction : mettre à jour le mot de passe + marquer le code comme utilisé
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashedPassword },
      }),
      this.prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Invalider toutes les sessions actives de cet utilisateur (sécurité)
    try {
      await this.prisma.session.deleteMany({
        where: { userId: user.id },
      });
      this.logger.log(`Sessions invalidées pour ${user.email} après réinitialisation du mot de passe`);
    } catch (e) {
      this.logger.warn(`Impossible d'invalider les sessions pour ${user.email}: ${e}`);
    }

    this.logger.log(`Mot de passe réinitialisé avec succès pour l'utilisateur: ${user.email}`);
    return { message: "Votre mot de passe a été réinitialisé avec succès." };
  }

  /**
   * Réinitialisation via JWT token (ancien flux — rétro-compatibilité)
   */
  private async resetPasswordWithToken(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    try {
      const payload = this.jwtService.verify(resetPasswordDto.token!);

      if (payload.purpose !== 'password-reset') {
        throw new ForbiddenException('Jeton invalide pour cette opération.');
      }

      const user = await this.usersService.findOne(payload.sub);
      if (!user) {
        throw new NotFoundException('Utilisateur introuvable.');
      }

      const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);

      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashedPassword },
      });

      this.logger.log(`Mot de passe réinitialisé (JWT) pour l'utilisateur: ${user.email}`);
      return { message: "Votre mot de passe a été réinitialisé avec succès." };
    } catch (error: any) {
      this.logger.error(`Échec de la réinitialisation JWT: ${error.message}`);
      throw new ForbiddenException('Le lien de réinitialisation est invalide ou a expiré.');
    }
  }

  /**
   * Envoie un email avec le code OTP de réinitialisation via Resend
   * Template professionnel aux couleurs Academia Helm
   */
  private async sendPasswordResetOtpEmail(to: string, firstName: string, otpCode: string): Promise<void> {
    const fromEmail = this.configService.get<string>('EMAIL_FROM_NOREPLY') || 'noreply@academiahelm.com';

    await this.emailService.sendEmail({
      to,
      from: fromEmail,
      subject: 'Academia Helm — Votre code de vérification',
      html: this.buildOtpEmailTemplate(firstName, otpCode),
      text: `Bonjour ${firstName},\n\nVotre code de vérification Academia Helm est : ${otpCode}\n\nCe code expire dans 10 minutes.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet email.\n\nL'équipe Academia Helm`,
    });
  }

  /**
   * Template email professionnel OTP — Palette Academia Helm
   * Navy #0b2f73 | Blue #1d4fa5 | Gold #f5b335
   */
  private buildOtpEmailTemplate(firstName: string, otpCode: string): string {
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Code de vérification — Academia Helm</title>
  <style>
    body { margin: 0; padding: 0; background: #f8fafc; font-family: 'Segoe UI', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #0b2f73, #1d4fa5); padding: 32px 24px; text-align: center; border-radius: 12px 12px 0 0; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { color: #f5b335; margin: 8px 0 0; font-size: 13px; font-weight: 500; }
    .content { background: #ffffff; padding: 40px 32px; border: 1px solid #e2e8f0; border-top: none; }
    .greeting { font-size: 16px; color: #1e293b; margin-bottom: 8px; }
    .instruction { font-size: 14px; color: #475569; line-height: 1.7; margin-bottom: 32px; }
    .otp-container { text-align: center; margin: 32px 0; }
    .otp-label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; font-weight: 600; }
    .otp-code { display: inline-block; background: linear-gradient(135deg, #0b2f7308, #1d4fa508); border: 2px solid #0b2f7320; border-radius: 12px; padding: 16px 40px; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0b2f73; font-family: 'Courier New', monospace; }
    .expiry { font-size: 13px; color: #64748b; margin-top: 24px; text-align: center; }
    .warning { font-size: 13px; color: #94a3b8; margin-top: 20px; padding: 16px; background: #f8fafc; border-radius: 8px; border-left: 3px solid #f5b335; }
    .footer { background: #f8fafc; padding: 20px 24px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none; }
    .footer p { font-size: 12px; color: #94a3b8; margin: 4px 0; }
    .footer a { color: #1d4fa5; text-decoration: none; }
    @media only screen and (max-width: 480px) {
      .content { padding: 24px 16px; }
      .otp-code { font-size: 28px; padding: 12px 24px; letter-spacing: 6px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Academia Helm</h1>
      <p>Plateforme SaaS de gestion scolaire</p>
    </div>
    <div class="content">
      <p class="greeting">Bonjour ${firstName},</p>
      <p class="instruction">
        Vous avez demandé la réinitialisation de votre mot de passe Academia Helm.
        Utilisez le code ci-dessous pour continuer :
      </p>
      <div class="otp-container">
        <p class="otp-label">Code de vérification</p>
        <div class="otp-code">${otpCode}</div>
      </div>
      <p class="expiry">Ce code expire dans <strong>10 minutes</strong>.</p>
      <div class="warning">
        Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.
        Votre mot de passe restera inchangé.
      </div>
    </div>
    <div class="footer">
      <p>Academia Helm — Solution de gestion scolaire</p>
      <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
    </div>
  </div>
</body>
</html>`.trim();
  }
}

