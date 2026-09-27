import { Injectable, UnauthorizedException, ForbiddenException, NotFoundException, BadRequestException, ConflictException, Logger, ServiceUnavailableException } from '@nestjs/common';
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
import { AccessRequestsService } from '../access-requests/access-requests.service';
import { isSchoolTenantType } from '../common/constants/school-tenant-types';

export type SessionPersistMeta = {
  ipAddress?: string;
  userAgent?: string;
};

/** UUID v4 regex (simplifié) pour distinguer id vs slug */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Résout un tenant par id (UUID) ou par slug.
   * Permet au frontend d'envoyer soit l'id soit le slug comme tenant_id.
   * @returns L'UUID du tenant ou null si non trouvé
   */
  private async resolveTenantId(tenantIdOrSlug: string): Promise<string | null> {
    const trimmed = tenantIdOrSlug.trim();
    const isUuid = UUID_REGEX.test(trimmed);
    if (isUuid) {
      return trimmed;
    }
    // C'est un slug → chercher l'UUID correspondant
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: trimmed } });
    return tenant?.id || null;
  }

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private configService: ConfigService,
    private emailService: EmailService,
    private accessRequestsService: AccessRequestsService,
  ) {}

  async register(registerDto: RegisterDto, meta?: SessionPersistMeta) {
    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user — exclude `password` from DTO spread (Prisma expects `passwordHash`, not `password`)
    const { password: _password, ...userData } = registerDto;
    const user = await this.usersService.create({
      ...userData,
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
        avatarUrl: (user as any).avatarUrl ?? null,
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
      // ⭐ Recherche unifiée : accepte EMAIL ou MATRICULE comme identifiant.
      //    - Si l'identifiant contient '@' → recherche directe par email dans User
      //    - Sinon → recherche par matricule dans Staff, puis Teacher, puis User (email).
      //    ⭐ FIX: Le promoteur n'a pas de ligne Staff — on étend la recherche à
      //    Teacher (matricule) et User (email) pour qu'il puisse se connecter.
      const identifier = (loginDto.email || '').trim();
      let userEmail: string | null = null;

      if (identifier.includes('@')) {
        // C'est un email → recherche directe
        userEmail = identifier.toLowerCase();
      } else {
        // 1. Chercher dans Staff par matricule
        const staff = await this.prisma.staff.findFirst({
          where: {
            OR: [
              { tenantMatricule: { equals: identifier, mode: 'insensitive' } },
              { globalMatricule: { equals: identifier, mode: 'insensitive' } },
              { employeeNumber: { equals: identifier, mode: 'insensitive' } },
            ],
          },
          select: { email: true },
        });
        if (staff?.email) {
          userEmail = staff.email.trim().toLowerCase();
        }

        // 2. Chercher dans Teacher par matricule
        //    ⭐ FIX : le modèle Teacher n'a PAS de champ userId (liaison par email).
        //    L'ancien `select: { userId: true }` provoquait une erreur de validation
        //    Prisma (champ inconnu) → crash 500 quand un identifiant matricule
        //    matchait un Teacher sans ligne Staff. On résout désormais par email.
        if (!userEmail) {
          const teacher = await this.prisma.teacher.findFirst({
            where: { matricule: { equals: identifier, mode: 'insensitive' } },
            select: { email: true },
          });
          if (teacher?.email) {
            userEmail = teacher.email.trim().toLowerCase();
          }
        }

        // 3. ⭐ FIX PROMOTER: Chercher dans User par email (fallback)
        if (!userEmail) {
          const userByEmail = await this.prisma.user.findFirst({
            where: { email: { equals: identifier, mode: 'insensitive' } },
            select: { email: true },
          });
          if (userByEmail?.email) {
            userEmail = userByEmail.email.trim().toLowerCase();
          }
        }

        if (!userEmail) {
          throw new UnauthorizedException('Identifiant invalide');
        }
      }

      // Find user by email (résolu depuis l'identifiant direct ou via Staff)
      // userEmail est garanti non-null ici (les branches ci-dessus throw si null)
      const user = await this.usersService.findByEmail(userEmail!);
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

    // Si PLATFORM_OWNER → accès universel à TOUS les portails
    if (isOwner) {
      // ⭐ 2FA TOTP — porte pour le chemin propriétaire (accès universel,
      //    pas de validation de portail) : jeton temporaire 5 min.
      const ownerTwoFactor = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { twoFactorEnabled: true },
      });
      if (ownerTwoFactor?.twoFactorEnabled) {
        return {
          requires2fa: true as const,
          twoFactorTempToken: this.jwtService.sign(
            { sub: user.id, purpose: '2fa_login', tenant_id: loginDto.tenant_id || undefined, portal_type: loginDto.portal_type || undefined },
            { expiresIn: '5m' },
          ),
          email: user.email,
        };
      }

      // Update last login
      await this.usersService.updateLastLogin(user.id);
      
      // Si un tenant_id est fourni, on l'utilise (pour accéder à une école spécifique)
      const targetTenantId = loginDto.tenant_id || user.tenantId;
      
      // Generate tokens
      const tokens = this.generateTokens(user, targetTenantId);
      const sessionRecord = await this.persistWebSession(user.id, tokens.refreshToken, meta);

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatarUrl: (user as any).avatarUrl ?? null,
          role: this.jwtRole(user),
          isPlatformOwner: true,
          tenantId: targetTenantId,
        },
        tenant: targetTenantId ? await this.loadTenantInfo(targetTenantId) : undefined,
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

    // ── PORTAIL PATRONAT (Academia Federis) ─────────────────────────────
    // Pattern dédié, aligné sur le flux Helm mais adapté à la réalité Federis :
    // contrairement aux écoles (un sous-domaine par établissement → tenant_id
    // fourni par l'URL), un patronat n'a PAS de sous-domaine propre. Le tenant
    // PATRONAT est donc AUTO-RÉSOLU depuis le compte :
    //   1. tenant_id explicite (UUID ou slug) s'il est fourni (multi-patronats)
    //   2. sinon user.tenantId (posé par POST /federis/public/register)
    //   3. sinon le premier lien PatronatUser actif de l'utilisateur
    // Le tenant résolu DOIT être actif ET de type PATRONAT, et l'utilisateur
    // doit y appartenir (tenant direct, lien PatronatUser ou PLATFORM_OWNER).
    if (loginDto.portal_type === PortalType.PATRONAT) {
      let resolvedTenantId: string | null = loginDto.tenant_id
        ? await this.resolveTenantId(loginDto.tenant_id)
        : user.tenantId || null;

      // Compte sans tenant direct → premier lien PatronatUser actif
      if (!resolvedTenantId) {
        const link = await this.prisma.patronatUser.findFirst({
          where: { userId: user.id, isActive: true },
          orderBy: { createdAt: 'asc' },
          select: { tenantId: true },
        });
        resolvedTenantId = link?.tenantId ?? null;
      }

      if (!resolvedTenantId) {
        throw new ForbiddenException(
          'PATRONAT_NO_SPACE: Aucun espace patronat est associé à ce compte. Utilisez le portail correspondant à votre rôle.',
        );
      }

      const patronatTenant = await this.prisma.tenant.findUnique({
        where: { id: resolvedTenantId },
        select: { id: true, type: true, status: true },
      });
      if (!patronatTenant || patronatTenant.status !== 'active') {
        throw new ForbiddenException('Tenant not found or inactive');
      }
      if (patronatTenant.type !== 'PATRONAT') {
        throw new ForbiddenException(
          'PORTAL_MISMATCH: Le portail Patronat est réservé aux organisations de type PATRONAT (Academia Federis).',
        );
      }

      // Appartenance : tenant direct, lien PatronatUser actif, ou PLATFORM_OWNER
      if (!this.isPlatformOwner(user) && user.tenantId !== resolvedTenantId) {
        const membership = await this.prisma.patronatUser.findFirst({
          where: { userId: user.id, tenantId: resolvedTenantId, isActive: true },
          select: { id: true },
        });
        if (!membership) {
          throw new ForbiddenException('User does not belong to the specified tenant');
        }
      }

      // Le tenant résolu alimente le JWT enrichi (req.user.tenantId) —
      // utilisé par /federis/patronat/profile & co. pour résoudre le patronat.
      loginDto.tenant_id = resolvedTenantId;
    }

    // Si portal_type est SCHOOL, TEACHER ou PARENT, tenant_id est requis
    // (PATRONAT est exclu : le tenant est auto-résolu ci-dessus)
    if (loginDto.portal_type && loginDto.portal_type !== PortalType.PATRONAT) {
      if (!loginDto.tenant_id) {
        throw new ForbiddenException('Tenant ID is required for this portal type');
      }

      // Résoudre le tenant par id (UUID) ou par slug (compatibilité frontend)
      const resolvedTenantId = await this.resolveTenantId(loginDto.tenant_id);
      if (!resolvedTenantId) {
        throw new ForbiddenException('Tenant not found or inactive');
      }

      // Vérifier que le tenant existe et est actif
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: resolvedTenantId },
      });

      if (!tenant || tenant.status !== 'active') {
        throw new ForbiddenException('Tenant not found or inactive');
      }

      // Vérifier que l'utilisateur appartient à ce tenant
      // SAUF si c'est un PLATFORM_OWNER → il peut demander un accès
      const isPlatformOwner = this.isPlatformOwner(user);

      if (!isPlatformOwner && user.tenantId !== resolvedTenantId) {
        throw new ForbiddenException('User does not belong to the specified tenant');
      }

      // ── PLATFORM_OWNER : vérifier l'accès approuvé ──
      if (isPlatformOwner && user.tenantId !== resolvedTenantId) {
        await this.accessRequestsService.checkOrCreateAccessRequest({
          platformOwnerId: user.id,
          tenantId: resolvedTenantId,
          portalType: loginDto.portal_type,
          platformOwnerEmail: user.email,
          platformOwnerName: `${user.firstName} ${user.lastName}`.trim() || user.email,
        });
        // Si on arrive ici, l'accès est APPROVED → continuer
      }

      // Remplacer le tenant_id par l'UUID résolu pour la suite du traitement
      loginDto.tenant_id = resolvedTenantId;
    }

    // Si tenant_id est fourni sans portal_type, vérifier l'appartenance au tenant
    if (loginDto.tenant_id && !loginDto.portal_type) {
      // Résoudre le tenant par id (UUID) ou par slug
      const resolvedTenantId = await this.resolveTenantId(loginDto.tenant_id);
      if (!resolvedTenantId) {
        throw new ForbiddenException('Tenant not found or inactive');
      }

      const tenant = await this.prisma.tenant.findUnique({
        where: { id: resolvedTenantId },
      });

      if (!tenant || tenant.status !== 'active') {
        throw new ForbiddenException('Tenant not found or inactive');
      }

      // Vérifier que l'utilisateur appartient à ce tenant
      if (user.tenantId !== resolvedTenantId) {
        throw new ForbiddenException('User does not belong to the specified tenant');
      }

      // Remplacer le tenant_id par l'UUID résolu
      loginDto.tenant_id = resolvedTenantId;
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    // ⭐ 2FA TOTP — porte du chemin standard : APRÈS toutes les validations
    //    de portail/tenant (pas de contournement RBAC), AVANT les tokens.
    //    Jeton temporaire 5 min échangé contre un code TOTP via
    //    POST /auth/2fa/verify-login.
    const twoFactorState = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true },
    });
    if (twoFactorState?.twoFactorEnabled) {
      return {
        requires2fa: true as const,
        twoFactorTempToken: this.jwtService.sign(
          { sub: user.id, purpose: '2fa_login', tenant_id: loginDto.tenant_id || undefined, portal_type: loginDto.portal_type || undefined },
          { expiresIn: '5m' },
        ),
        email: user.email,
      };
    }

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
          avatarUrl: (user as any).avatarUrl ?? null,
          role: this.jwtRole(user),
          tenantId: loginDto.tenant_id || user.tenantId || null,
          isPlatformOwner: this.isPlatformOwner(user),
        },
        // ⭐ PATRONAT (Academia Federis) : infos du tenant patronat pour la
        //    session BFF (nom du patronat dans le cookie academia_session au
        //    lieu du fallback générique « Mon École », + cookie x-tenant-id).
        ...(loginDto.portal_type === PortalType.PATRONAT && loginDto.tenant_id
          ? { tenant: await this.loadTenantInfo(loginDto.tenant_id) }
          : {}),
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

  /**
   * ⭐ 2FA TOTP — Compléter la connexion APRÈS vérification du code.
   *    Appelé par TwoFactorService.verifyLogin : régénère les tokens,
   *    persiste la session et renvoie le même payload que /auth/login.
   *    (Les validations de portail/tenant ont déjà été passées AVANT la
   *    porte 2FA — le jeton temporaire signé le prouve.)
   */
  async completeLoginAfter2fa(
    userId: string,
    tenantId?: string,
    meta?: { ipAddress?: string; userAgent?: string },
    portalType?: string,
  ): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true,
        tenantId: true, status: true,
      },
    });
    if (!user) throw new UnauthorizedException('Utilisateur introuvable');
    if (user.status !== 'active') throw new ForbiddenException('Compte inactif');

    await this.usersService.updateLastLogin(user.id);

    const tokens = tenantId
      ? this.generateEnrichedToken(user as any, tenantId)
      : this.generateTokens(user as any);
    const sessionRecord = await this.persistWebSession(user.id, tokens.refreshToken, meta);

    const isOwner = this.isPlatformOwner(user as any);
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: (user as any).avatarUrl ?? null,
        role: this.jwtRole(user as any),
        tenantId: tenantId || user.tenantId || null,
        isPlatformOwner: isOwner,
      },
      ...(isOwner && tenantId ? { tenant: await this.loadTenantInfo(tenantId) } : {}),
      // ⭐ PATRONAT (Academia Federis) : même payload que /auth/login — infos
      //    du tenant patronat pour la session BFF (2FA déjà complétée).
      ...(portalType === PortalType.PATRONAT && tenantId && !isOwner
        ? { tenant: await this.loadTenantInfo(tenantId) }
        : {}),
      ...tokens,
      ...(sessionRecord ? { serverSessionId: sessionRecord.id } : {}),
    };
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
      // ✅ Inclure le tenantId si l'utilisateur en a un (évite le select-tenant obligatoire)
      ...(user.tenantId ? { tenantId: user.tenantId } : {}),
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
    // ⭐ Recherche unifiée : accepte EMAIL ou MATRICULE.
    //    - Si l'identifiant contient '@' → recherche directe par email dans User.
    //    - Sinon → recherche par matricule dans Staff (tenantMatricule / globalMatricule /
    //      employeeNumber), puis dans Teacher (matricule), puis dans User (email).
    //    ⭐ FIX: Le promoteur (PROMOTER/PROMOTEUR) n'a pas de ligne Staff — il est créé
    //      comme User lors de l'onboarding. On étend donc la recherche à User par email
    //      en dernier recours, pour que le promoteur puisse se connecter avec son email
    //      même s'il ne contient pas '@' (ou avec n'importe quel identifiant de fallback).
    const identifier = (email || '').trim();
    let userEmail: string | null = null;

    if (identifier.includes('@')) {
      userEmail = identifier.toLowerCase();
    } else {
      // 1. Chercher dans Staff par matricule (RH module staff)
      const staff = await this.prisma.staff.findFirst({
        where: {
          OR: [
            { tenantMatricule: { equals: identifier, mode: 'insensitive' } },
            { globalMatricule: { equals: identifier, mode: 'insensitive' } },
            { employeeNumber: { equals: identifier, mode: 'insensitive' } },
          ],
        },
        select: { email: true },
      });
      if (staff?.email) {
        userEmail = staff.email.trim().toLowerCase();
      }

      // 2. Chercher dans Teacher par matricule (enseignants)
      if (!userEmail) {
        const teacher = await this.prisma.teacher.findFirst({
          where: { matricule: { equals: identifier, mode: 'insensitive' } },
          select: { userId: true },
        });
        if (teacher?.userId) {
          const teacherUser = await this.prisma.user.findUnique({
            where: { id: teacher.userId },
            select: { email: true },
          });
          if (teacherUser?.email) {
            userEmail = teacherUser.email.trim().toLowerCase();
          }
        }
      }

      // 3. ⭐ FIX PROMOTER: Chercher dans User directement par email
      //    (le promoteur n'a ni Staff ni Teacher — il est créé comme User lors de
      //    l'onboarding. Si l'identifiant ressemble à un email partiel, ou si le
      //    promoteur tape son email sans '@' par erreur, on le trouve quand même.)
      if (!userEmail) {
        const userByEmail = await this.prisma.user.findFirst({
          where: { email: { equals: identifier, mode: 'insensitive' } },
          select: { email: true },
        });
        if (userByEmail?.email) {
          userEmail = userByEmail.email.trim().toLowerCase();
        }
      }

      // 4. ⭐ Dernier recours: chercher dans User par matricule si on a ajouté
      //    une colonne matricule à User (futur). Pour l'instant, return null.
      if (!userEmail) return null;
    }

    const user = await this.usersService.findByEmail(userEmail!);
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
      // ⭐ Promoteur (créé lors de l'onboarding — User uniquement, pas de Staff)
      'PROMOTER', 'PROMOTEUR',
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
      // ⭐ Rôles FR du UserRole enum (générés par staff-credential.service via
      //    refineUserRole / ADMIN_ROLE_TO_USER_ROLE) — sans eux, ces rôles
      //    tombaient dans le DÉFAUT SCHOOL par accident au lieu d'être listés.
      'DIRECTEUR', 'SECRETAIRE', 'SECRETAIRE_COMPTABLE', 'SURVEILLANT',
    ];
    if (schoolRoles.includes(role)) return [PortalType.SCHOOL];

    // ⭐ Rôles niveau-spécifiques (générés par resolveUserRoleWithLevel) :
    //    DIRECTEUR_MAT_PRI, SECRETAIRE_COMPTABLE_SEC, COMPTABLE_PRI, CENSEUR_SEC,
    //    SURVEILLANT_GENERAL_SEC, SURVEILLANT_MAT, etc.
    //    Suffixes acceptés : MAT, PRI, SEC, MAT_PRI (+ variantes longues).
    if (/^(PROMOTEUR|DIRECTEUR|SECRETAIRE_COMPTABLE|SECRETAIRE|COMPTABLE|SURVEILLANT_GENERAL|SURVEILLANT|CENSEUR)_(MAT|PRI|SEC|MAT_PRI|MATERNELLE|PRIMAIRE|SECONDAIRE)$/.test(role)) {
      return [PortalType.SCHOOL];
    }

    // ── Rôles ENSEIGNANT (11 rôles) — Document §03 ──
    const teacherRoles = [
      'TEACHER', 'HEAD_TEACHER', 'SUBSTITUTE_TEACHER', 'TEACHER_ASSISTANT',
      'DEPARTMENT_COORDINATOR', 'PEDAGOGIC_ADVISOR', 'TEACHER_RESP',
      'TEACHER_INTERNSHIP', 'TUTOR', 'MENTOR', 'EXAMINER',
      // Legacy
      'TEACHER_RESPONSIBLE', 'CORRECTOR', 'SUPERVISOR', 'ANIMATOR', 'CONSULTANT',
      'INSTITUTEUR',
      // ⭐ Rôle FR généré par staff-credential.service pour roleType=TEACHER.
      //    ⚠️ AVANT ce fix, ENSEIGNANT n'était dans AUCUNE liste et tombait sur
      //    le DÉFAUT SCHOOL → un enseignant PUR pouvait se connecter au
      //    portail ÉCOLE avec son email, au lieu du portail enseignant (matricule).
      'ENSEIGNANT', 'PROFESSEUR',
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

    // ── Rôles PATRONAT (Academia Federis — application satellite) ──
    // Comptes créés par POST /federis/public/register (User.role = PATRONAT_ADMIN)
    // ou par le coordonnateur (federis-users.service) et liés à un patronat via
    // PatronatUser. Ils se connectent UNIQUEMENT via le portail PATRONAT
    // (academiafederis.academiahelm.com/federis/login).
    //   - PATRONAT_COORDONNATEUR : coordonnateur — responsable du patronat (tout)
    //   - PATRONAT_SECRETAIRE    : secrétariat (registres, candidats, documents)
    //   - PATRONAT_TRESORIER     : finances (abonnement, factures)
    //   - PATRONAT_ORGANISATEUR  : organisation (examens, centres, salles)
    //   - PATRONAT_CHARGE_MISSION: suivi & reporting (lecture)
    //   - PATRONAT_ADMIN (legacy) : alias coordonnateur (comptes /register)
    //   - PATRONAT_OPERATOR      : opérateur (examens, candidats, centres)
    //   - EXAM_SUPERVISOR        : surveillant (lecture élargie)
    //   - EXAM_VIEWER            : inspecteur (lecture seule)
    // ⭐ Avant ce mapping, ces rôles tombaient dans le DÉFAUT SCHOOL → le login
    //    Federis avec portal_type=PATRONAT renvoyait 403 PORTAL_MISMATCH.
    const patronatRoles = [
      'PATRONAT_ADMIN', 'PATRONAT_OPERATOR', 'PATRONAT_USER',
      'EXAM_SUPERVISOR', 'EXAM_VIEWER',
      // ⭐ Fonctions patronat (création de comptes par le coordonnateur)
      'PATRONAT_COORDONNATEUR', 'PATRONAT_SECRETAIRE', 'PATRONAT_TRESORIER',
      'PATRONAT_ORGANISATEUR', 'PATRONAT_CHARGE_MISSION',
    ];
    if (patronatRoles.includes(role)) return [PortalType.PATRONAT];

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
   * Charge les infos d'un tenant pour la réponse de login.
   * Utilisé par PLATFORM_OWNER quand il se connecte à une école spécifique.
   */
  private async loadTenantInfo(tenantId: string) {
    try {
      const tenant = await this.prisma.tenant.findFirst({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true, subdomain: true },
      });
      return tenant || undefined;
    } catch {
      return undefined;
    }
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
    const seenTenantIds = new Set<string>();
    
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
        seenTenantIds.add(tenant.id);
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

    // ⭐ MULTI-ÉCOLES : un promoteur peut gérer plusieurs établissements.
    // Les relations UserTenant (créées par l'onboarding lorsqu'un promoteur
    // existant fonde une nouvelle école) étendent son périmètre au-delà du
    // tenant par défaut. Résilient : si la table user_tenants n'existe pas
    // encore en base (migration non appliquée), on retombe sur le tenant direct.
    try {
      const userTenants = await this.prisma.userTenant.findMany({
        where: { userId, isActive: true },
        include: {
          tenant: {
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
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      for (const ut of userTenants) {
        const tenant = ut.tenant;
        // ⭐ Type école au sens large : l'onboarding crée les tenants avec le type
        //    d'établissement (MATERNELLE/PRIMAIRE/SECONDAIRE/MIXTE) — une
        //    comparaison stricte à 'SCHOOL' masquerait les écoles réelles.
        if (!tenant || tenant.status !== 'active' || !isSchoolTenantType(tenant.type)) {
          continue;
        }
        if (seenTenantIds.has(tenant.id)) {
          continue;
        }
        seenTenantIds.add(tenant.id);
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
    } catch (err: any) {
      this.logger.warn(
        `⚠️ UserTenant indisponible (fallback tenant direct) : ${err?.message || err}`,
      );
    }

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
    let hasAccess = isOwner || user.tenantId === tenantId;

    // ⭐ MULTI-ÉCOLES : le promoteur peut basculer vers n'importe lequel de ses
    // établissements (relation UserTenant active — même périmètre que
    // getAvailableTenants). Résilient si la table n'existe pas encore en base.
    if (!hasAccess && user.id) {
      try {
        const userTenant = await this.prisma.userTenant.findUnique({
          where: { userId_tenantId: { userId: user.id, tenantId } },
        });
        hasAccess = !!userTenant && userTenant.isActive;
      } catch (err: any) {
        this.logger.warn(
          `⚠️ UserTenant indisponible (contrôle d'accès limité au tenant direct) : ${err?.message || err}`,
        );
      }
    }

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
        avatarUrl: (user as any).avatarUrl ?? null,
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
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string; emailSent?: boolean; emailError?: string }> {
    const user = await this.usersService.findByEmail(forgotPasswordDto.email);

    // Toujours le même message de succès — sécurité anti-énumération
    const successMessage = { message: "Si un compte existe avec cet email, un code de vérification vous a été envoyé.", emailSent: false as boolean | undefined };

    if (!user) {
      this.logger.warn(`Tentative de réinitialisation pour un email inexistant: ${forgotPasswordDto.email}`);
      // emailSent=false ne sera pas transmis au client final (le BFF filtre)
      return { ...successMessage, emailSent: false };
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

    // Envoyer l'email avec le code OTP
    try {
      const result = await this.sendPasswordResetOtpEmail(
        user.email,
        user.firstName || '',
        otpCode,
        user.tenantId || undefined,
        user.id,
      );
      this.logger.log(`Code OTP de réinitialisation envoyé à ${user.email} (provider: ${this.configService.get<string>('EMAIL_PROVIDER', 'mock')}, success: ${result?.success}, messageId: ${result?.messageId || 'N/A'})`);
      return { ...successMessage, emailSent: true };
    } catch (error: any) {
      const provider = this.configService.get<string>('EMAIL_PROVIDER', 'mock');
      const resendKey = this.configService.get<string>('RESEND_API_KEY');
      this.logger.error(`❌ ÉCHEC ENVOI OTP à ${user.email} | provider=${provider} | RESEND_API_KEY=${resendKey ? 'configuré (' + resendKey.substring(0, 6) + '...)' : 'MANQUANT'} | EMAIL_FROM_NOREPLY=${this.configService.get<string>('EMAIL_FROM_NOREPLY', '(non défini)')} | erreur: ${error?.message || error}`);
      // On continue pour ne pas fuiter l'erreur au client (anti-énumération)
      // emailError sera utilisé par le BFF pour le logging uniquement
      return { ...successMessage, emailSent: false, emailError: error?.message };
    }
  }

  /**
   * ⭐ Changement de mot de passe self-service DEPUIS l'application (connecté).
   *
   * EXACTEMENT le même processus que « mot de passe oublié » (page login) :
   *   1. Code OTP à 6 chiffres envoyé par email (cette méthode) — l'email est
   *      tiré du JWT de l'utilisateur connecté, pas saisi.
   *   2. Vérification du code : POST /auth/verify-reset-otp { email, code }
   *   3. Nouveau mot de passe   : POST /auth/reset-password { email, code, newPassword }
   *      → bcrypt + invalidation de TOUTES les sessions actives (reconnexion requise).
   *
   * Mêmes internals que forgotPassword : table password_resets, code hashé
   * bcrypt, expiration 10 min, invalidation des anciens codes, même email OTP.
   * Différence : utilisateur authentifié → messages d'erreur réels (pas
   * d'anti-énumération nécessaire) + aucun captcha requis.
   */
  async requestPasswordChange(jwtUser: { id: string; email: string }): Promise<{ success: boolean; message: string; emailSent?: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: jwtUser.id },
      select: { id: true, email: true, firstName: true, tenantId: true, status: true },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }
    if (user.status && user.status !== 'active') {
      throw new ForbiddenException('Compte inactif — impossible de changer le mot de passe.');
    }

    // Générer un code OTP à 6 chiffres (identique au flux forgot-password)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otpCode, 10);

    // Invalider les anciens codes non utilisés pour cet utilisateur
    await this.prisma.passwordReset.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    // Stocker le nouveau code — même table, même expiration (10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: hashedOtp,
        expiresAt,
      },
    });

    // Envoyer l'email OTP — même template que « mot de passe oublié »
    try {
      const result = await this.sendPasswordResetOtpEmail(
        user.email,
        user.firstName || '',
        otpCode,
        user.tenantId || undefined,
        user.id,
      );
      this.logger.log(`Code OTP de changement de mot de passe envoyé à ${user.email} (provider: ${this.configService.get<string>('EMAIL_PROVIDER', 'mock')}, success: ${result?.success})`);
      return {
        success: true,
        message: `Un code de vérification a été envoyé à ${user.email}. Il expire dans 10 minutes.`,
        emailSent: result?.success ?? true,
      };
    } catch (error: any) {
      this.logger.error(`❌ ÉCHEC ENVOI OTP changement de mot de passe à ${user.email} | erreur: ${error?.message || error}`);
      return {
        success: false,
        message: "Impossible d'envoyer le code de vérification pour le moment. Veuillez réessayer plus tard.",
        emailSent: false,
      };
    }
  }

  /**
   * ⭐ Changement d'adresse email self-service DEPUIS l'application (connecté) — ÉTAPE 1.
   *
   * Même mécanique OTP que « mot de passe oublié » (table password_resets,
   * code 6 chiffres hashé bcrypt, expiration 10 minutes, anciens codes
   * invalidés) — mais le code est envoyé à la NOUVELLE adresse : seule la
   * personne qui CONTRÔLE la nouvelle boîte peut confirmer le changement
   * (pas d'usurpation d'adresse tierce, pas de faute de frappe qui verrouille
   * le compte). Le code est LIÉ à la demande via la colonne pendingEmail.
   *
   *   1. POST /auth/request-email-change { newEmail }   (cette méthode, JWT)
   *   2. POST /auth/confirm-email-change { code, newEmail } → users.email
   *      mis à jour + TOUTES les sessions invalidées (reconnexion requise)
   */
  async requestEmailChange(
    jwtUser: { id: string; email: string },
    newEmailRaw: string,
  ): Promise<{ success: boolean; message: string; emailSent?: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: jwtUser.id },
      select: { id: true, email: true, firstName: true, tenantId: true, status: true },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }
    if (user.status && user.status !== 'active') {
      throw new ForbiddenException('Compte inactif — impossible de changer l\'adresse email.');
    }

    // ── Validation de la nouvelle adresse ──
    const newEmail = (newEmailRaw || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(newEmail)) {
      throw new BadRequestException('Veuillez saisir une adresse email valide.');
    }
    if (newEmail === user.email.trim().toLowerCase()) {
      throw new BadRequestException('La nouvelle adresse est identique à votre adresse actuelle.');
    }
    const existing = await this.prisma.user.findFirst({
      where: { email: newEmail },
      select: { id: true },
    });
    if (existing && existing.id !== user.id) {
      throw new ConflictException('Cette adresse email est déjà utilisée par un autre compte.');
    }

    // ── OTP : mêmes internals que forgotPassword / requestPasswordChange ──
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otpCode, 10);

    // Invalider les anciens codes non utilisés pour cet utilisateur
    await this.prisma.passwordReset.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    // Code LIÉ à la nouvelle adresse en attente (pendingEmail)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: hashedOtp,
        expiresAt,
        pendingEmail: newEmail,
      },
    });

    // Envoyer le code à la NOUVELLE adresse (template dédié)
    try {
      const result = await this.sendEmailChangeOtpEmail(
        newEmail,
        user.firstName || '',
        otpCode,
        user.email,
        user.tenantId || undefined,
        user.id,
      );
      this.logger.log(`Code OTP de changement d'email envoyé à ${newEmail} (pour le compte ${user.email}) (provider: ${this.configService.get<string>('EMAIL_PROVIDER', 'mock')}, success: ${result?.success})`);
      return {
        success: true,
        message: `Un code de vérification a été envoyé à ${newEmail}. Saisissez-le pour confirmer votre nouvelle adresse. Le code expire dans 10 minutes.`,
        emailSent: result?.success ?? true,
      };
    } catch (error: any) {
      this.logger.error(`❌ ÉCHEC ENVOI OTP changement d'email à ${newEmail} | erreur: ${error?.message || error}`);
      return {
        success: false,
        message: "Impossible d'envoyer le code de vérification pour le moment. Vérifiez la nouvelle adresse et réessayez.",
        emailSent: false,
      };
    }
  }

  /**
   * ⭐ Changement d'adresse email self-service — ÉTAPE 2 : confirmation.
   *
   * Vérifie le code OTP (lié à la demande via pendingEmail), met à jour
   * users.email, invalide TOUTES les sessions (l'email est l'identifiant de
   * connexion → reconnexion obligatoire) et notifie l'ANCIENNE adresse
   * (alerte de sécurité standard, best-effort).
   */
  async confirmEmailChange(
    jwtUser: { id: string; email: string },
    dto: { code: string; newEmail?: string },
  ): Promise<{ success: boolean; message: string; email: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: jwtUser.id },
      select: { id: true, email: true, firstName: true, tenantId: true, status: true },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }
    if (user.status && user.status !== 'active') {
      throw new ForbiddenException('Compte inactif — impossible de changer l\'adresse email.');
    }

    if (!dto?.code || !/^\d{6}$/.test(dto.code.trim())) {
      throw new BadRequestException('Veuillez saisir les 6 chiffres du code de vérification.');
    }

    // Code le plus récent non utilisé POUR UNE DEMANDE DE CHANGEMENT D'EMAIL
    const resetRecord = await this.prisma.passwordReset.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
        pendingEmail: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!resetRecord) {
      throw new ForbiddenException('Aucun changement d\'email en attente. Veuillez demander un nouveau code.');
    }

    // L'adresse confirmée doit être EXACTEMENT celle qui a reçu le code
    const pendingEmail = (resetRecord as any).pendingEmail as string;
    if (dto.newEmail && dto.newEmail.trim().toLowerCase() !== pendingEmail) {
      throw new ForbiddenException('L\'adresse à confirmer ne correspond pas à la demande. Veuillez recommencer.');
    }

    // Vérifier le code OTP (bcrypt — même mécanique que reset-password)
    const isValidOtp = await bcrypt.compare(dto.code.trim(), resetRecord.token);
    if (!isValidOtp) {
      // Après trop de tentatives, invalider le code (comme verifyResetOtp)
      const attempts = (resetRecord as any).attempts || 0;
      if (attempts + 1 >= 5) {
        await this.prisma.passwordReset.update({
          where: { id: resetRecord.id },
          data: { usedAt: new Date() },
        });
        throw new ForbiddenException('Trop de tentatives. Veuillez demander un nouveau code.');
      }
      throw new ForbiddenException('Code invalide. Veuillez réessayer.');
    }

    // Le code est valide → l'utilisateur contrôle bien la nouvelle adresse.
    // Ré-exclure une prise de compte entre-temps (course) :
    const taken = await this.prisma.user.findFirst({
      where: { email: pendingEmail },
      select: { id: true },
    });
    if (taken && taken.id !== user.id) {
      await this.prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      });
      throw new ConflictException('Cette adresse email est déjà utilisée par un autre compte.');
    }

    // Transaction : email mis à jour + code consommé
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { email: pendingEmail },
      }),
      this.prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Invalider TOUTES les sessions actives (l'email = identifiant de connexion)
    try {
      await this.prisma.session.deleteMany({ where: { userId: user.id } });
      this.logger.log(`Sessions invalidées pour ${user.email} après changement d'adresse email`);
    } catch (e) {
      this.logger.warn(`Impossible d'invalider les sessions pour ${user.email}: ${e}`);
    }

    // Notifier l'ANCIENNE adresse (alerte de sécurité — best-effort)
    try {
      await this.sendEmailChangedNotification(user.email, user.firstName || '', pendingEmail, user.tenantId || undefined, user.id);
    } catch (e: any) {
      this.logger.warn(`Notification changement email non envoyée à ${user.email}: ${e?.message || e}`);
    }

    this.logger.log(`Adresse email modifiée pour l'utilisateur ${user.id} : ${user.email} → ${pendingEmail}`);
    return {
      success: true,
      message: `Votre adresse email est désormais ${pendingEmail}. Toutes vos sessions ont été fermées — reconnectez-vous avec votre nouvelle adresse.`,
      email: pendingEmail,
    };
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
   * Envoie un email de test pour diagnostiquer les problèmes de configuration.
   * Retourne les détails du provider et le résultat de l'envoi.
   */
  async sendTestEmail(to: string): Promise<{ success: boolean; provider: string; messageId?: string; error?: string }> {
    const fromEmail = this.configService.get<string>('EMAIL_FROM_NOREPLY') || 'noreply@academiahelm.com';

    try {
      const result = await this.emailService.sendEmail({
        to,
        from: fromEmail,
        fromName: 'Academia Helm — Test',
        subject: 'Academia Helm — Test de configuration email',
        html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;padding:24px;background:#f0f4f8;">
  <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
    <h2 style="color:#0b2f73;margin:0 0 12px;">Test email — Academia Helm</h2>
    <p style="color:#475569;font-size:14px;line-height:1.7;">
      Si vous recevez cet email, la configuration email fonctionne correctement.
    </p>
    <p style="color:#64748b;font-size:12px;">
      Envoyé le ${new Date().toISOString()} depuis ${fromEmail}
    </p>
  </div>
</body>
</html>`,
        text: `Test email — Academia Helm\n\nSi vous recevez cet email, la configuration email fonctionne correctement.\n\nEnvoyé le ${new Date().toISOString()} depuis ${fromEmail}`,
      });

      return {
        success: result.success,
        provider: this.configService.get<string>('EMAIL_PROVIDER', 'mock'),
        messageId: result.messageId,
      };
    } catch (error: any) {
      return {
        success: false,
        provider: this.configService.get<string>('EMAIL_PROVIDER', 'mock'),
        error: error?.message || String(error),
      };
    }
  }

  /**
   * Envoie un email avec le code OTP de réinitialisation
   * Template professionnel aux couleurs Academia Helm avec logo
   */
  private async sendPasswordResetOtpEmail(
    to: string,
    firstName: string,
    otpCode: string,
    tenantId?: string,
    userId?: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    const fromEmail = this.configService.get<string>('EMAIL_FROM_NOREPLY') || 'noreply@academiahelm.com';

    // Si on a un tenantId, on catégorise l'email (traçabilité + reply-to)
    if (tenantId) {
      const result = await this.emailService.sendCategorized({
        tenantId,
        category: 'SYSTEM',
        subCategory: 'reinitialisation_mot_de_passe_otp',
        module: 'auth',
        to,
        toName: firstName || undefined,
        fromEmail,
        fromName: 'Academia Helm',
        subject: 'Academia Helm — Votre code de vérification',
        html: this.buildOtpEmailTemplate(firstName, otpCode),
        text: `Bonjour ${firstName},\n\nVotre code de vérification Academia Helm est : ${otpCode}\n\nCe code expire dans 10 minutes.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet email.\n\nCordialement,\nL'équipe Academia Helm\nhttps://academiahelm.com`,
        recipientType: 'STAFF',
        recipientId: userId,
        triggeredBy: 'SYSTEM',
        relatedEntityId: userId,
        relatedEntityType: 'User',
      });
      return { success: result.success, messageId: result.providerId };
    }

    // Fallback legacy (pas de tenantId — utilisateur sans tenant, ex: super admin)
    return await this.emailService.sendEmail({
      to,
      from: fromEmail,
      fromName: 'Academia Helm',
      subject: 'Academia Helm — Votre code de vérification',
      html: this.buildOtpEmailTemplate(firstName, otpCode),
      text: `Bonjour ${firstName},\n\nVotre code de vérification Academia Helm est : ${otpCode}\n\nCe code expire dans 10 minutes.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet email.\n\nCordialement,\nL'équipe Academia Helm\nhttps://academiahelm.com`,
    });
  }

  /**
   * Template email professionnel OTP — Palette Academia Helm
   * Navy #0b2f73 | Blue #1d4fa5 | Gold #f5b335
   * Avec logo, signature complète et design responsive
   */
  private buildOtpEmailTemplate(firstName: string, otpCode: string): string {
    // ⭐ FIX 2026-09-18 (retour promoteur) : l'ancien logo d'en-tête
    //    n'était PAS le vrai logo Academia Helm. Le fichier
    //    /images/logo-academia-helm-email.png a été REMPLACÉ par le vrai
    //    logo (logo-Academia Hub.png, redimensionné 128×128, PNG
    //    transparent) : URL propre (pas d'espace), fichier léger (18 Ko)
    //    pour les clients mail — et les ANCIENS emails déjà envoyés qui
    //    référencent cette URL affichent désormais le vrai logo aussi.
    //    La signature « Cordialement, l'équipe Academia Helm » utilise le
    //    même fichier (cohérence totale header ↔ signature).
    const logoUrl = this.configService.get<string>('APP_PUBLIC_URL', 'https://academiahelm.com') + '/images/logo-academia-helm-email.png';
    const signatureLogoUrl = logoUrl;
    const currentYear = new Date().getFullYear();

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Code de vérification — Academia Helm</title>
  <style>
    /* Reset */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: #f0f4f8; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif; }

    /* Container */
    .email-wrapper { width: 100%; background-color: #f0f4f8; padding: 32px 16px; }
    .email-container { max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(11, 47, 115, 0.08); }

    /* Header */
    .header { background: linear-gradient(135deg, #0b2f73 0%, #1d4fa5 100%); padding: 36px 32px 28px; text-align: center; position: relative; }
    .header::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #f5b335, #e09915, #f5b335); }
    .header-logo { max-width: 56px; margin-bottom: 12px; border-radius: 12px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
    .header .tagline { color: #f5b335; margin: 6px 0 0; font-size: 12px; font-weight: 500; letter-spacing: 0.3px; text-transform: uppercase; }

    /* Content */
    .content { padding: 40px 36px; }
    .greeting { font-size: 17px; color: #1e293b; margin: 0 0 6px; font-weight: 600; }
    .instruction { font-size: 14px; color: #475569; line-height: 1.8; margin: 0 0 28px; }

    /* OTP Box */
    .otp-section { text-align: center; margin: 28px 0; }
    .otp-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 14px; font-weight: 700; }
    .otp-box { display: inline-block; background: linear-gradient(135deg, #0b2f7306, #1d4fa506); border: 2px dashed #1d4fa530; border-radius: 14px; padding: 20px 48px; }
    .otp-code { font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #0b2f73; font-family: 'Courier New', 'Consolas', monospace; margin: 0; }

    /* Expiry */
    .expiry-notice { text-align: center; margin: 20px 0 0; }
    .expiry-notice p { font-size: 13px; color: #64748b; margin: 0; display: inline-block; background: #fef3c7; padding: 6px 16px; border-radius: 20px; font-weight: 500; }
    .expiry-notice strong { color: #92400e; }

    /* Divider */
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 28px 0; }

    /* Warning */
    .warning-box { font-size: 13px; color: #64748b; padding: 16px 20px; background: #f8fafc; border-radius: 10px; border-left: 4px solid #f5b335; line-height: 1.6; margin: 0; }

    /* Signature */
    .signature { margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
    .signature-row { display: flex; align-items: center; gap: 12px; }
    .signature-logo { width: 36px; height: 36px; border-radius: 8px; }
    .signature-text p { margin: 0; font-size: 13px; color: #475569; line-height: 1.5; }
    .signature-text .team-name { font-weight: 600; color: #0b2f73; }
    .signature-text .website { color: #1d4fa5; text-decoration: none; font-weight: 500; }

    /* Footer */
    .footer { background: #0b2f73; padding: 20px 32px; text-align: center; }
    .footer p { font-size: 11px; color: #94a3b8; margin: 4px 0; line-height: 1.5; }
    .footer a { color: #f5b335; text-decoration: none; font-weight: 500; }
    .footer .brand { color: #f5b335; font-weight: 600; font-size: 12px; }

    /* Responsive */
    @media only screen and (max-width: 480px) {
      .email-wrapper { padding: 16px 8px; }
      .content { padding: 28px 20px; }
      .otp-box { padding: 16px 28px; }
      .otp-code { font-size: 28px; letter-spacing: 6px; }
      .header { padding: 28px 20px 22px; }
      .signature-row { flex-direction: column; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <!-- Header -->
      <div class="header">
        <img src="${logoUrl}" alt="Academia Helm" class="header-logo" />
        <h1>Academia Helm</h1>
        <p class="tagline">Plateforme SaaS de gestion scolaire</p>
      </div>

      <!-- Content -->
      <div class="content">
        <p class="greeting">Bonjour ${firstName},</p>
        <p class="instruction">
          Vous avez demandé la réinitialisation de votre mot de passe sur <strong>Academia Helm</strong>.
          Veuillez utiliser le code de vérification ci-dessous pour poursuivre la démarche :
        </p>

        <!-- OTP Code -->
        <div class="otp-section">
          <p class="otp-label">Code de vérification</p>
          <div class="otp-box">
            <p class="otp-code">${otpCode}</p>
          </div>
        </div>

        <!-- Expiry Notice -->
        <div class="expiry-notice">
          <p>Ce code expire dans <strong>10 minutes</strong></p>
        </div>

        <hr class="divider" />

        <!-- Security Warning -->
        <div class="warning-box">
          Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.
          Votre mot de passe restera inchangé et aucune action ne sera effectuée sur votre compte.
        </div>

        <!-- Signature -->
        <div class="signature">
          <div class="signature-row">
            <img src="${signatureLogoUrl}" alt="" class="signature-logo" />
            <div class="signature-text">
              <p>Cordialement,</p>
              <p class="team-name">L'équipe Academia Helm</p>
              <p><a href="https://academiahelm.com" class="website">academiahelm.com</a></p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p class="brand">Academia Helm</p>
        <p>Solution de gestion scolaire nouvelle génération</p>
        <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
        <p>&copy; ${currentYear} Academia Helm. Tous droits réservés.</p>
      </div>
    </div>
  </div>
</body>
</html>`.trim();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  CHANGEMENT D'ADRESSE EMAIL — ENVOIS (même pattern que l'OTP reset)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Envoie le code OTP de confirmation à la NOUVELLE adresse email
   * (mêmes internals que sendPasswordResetOtpEmail : sendCategorized si
   * tenant, fallback sendEmail sinon — never throws côté EmailService).
   */
  private async sendEmailChangeOtpEmail(
    to: string,
    firstName: string,
    otpCode: string,
    oldEmail: string,
    tenantId?: string,
    userId?: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    const fromEmail = this.configService.get<string>('EMAIL_FROM_NOREPLY') || 'noreply@academiahelm.com';
    const subject = 'Academia Helm — Confirmez votre nouvelle adresse email';
    const html = this.buildEmailChangeOtpTemplate(firstName, otpCode, oldEmail, to);
    const text = `Bonjour ${firstName},\n\nVous avez demandé le remplacement de l'adresse ${oldEmail} par ${to} sur votre compte Academia Helm.\nCode de confirmation : ${otpCode}\nCe code expire dans 10 minutes.\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre adresse restera inchangée.\n\nCordialement,\nL'équipe Academia Helm\nhttps://academiahelm.com`;

    if (tenantId) {
      const result = await this.emailService.sendCategorized({
        tenantId,
        category: 'SYSTEM',
        subCategory: 'changement_email_otp',
        module: 'auth',
        to,
        toName: firstName || undefined,
        fromEmail,
        fromName: 'Academia Helm',
        subject,
        html,
        text,
        recipientType: 'USER',
        recipientId: userId,
        triggeredBy: userId || 'SYSTEM',
        relatedEntityId: userId,
        relatedEntityType: 'User',
      });
      return { success: result.success, messageId: result.providerId };
    }

    const result = await this.emailService.sendEmail({
      to,
      from: fromEmail,
      fromName: 'Academia Helm',
      subject,
      html,
      text,
    });
    return { success: true, ...(result as any) };
  }

  /**
   * Notification envoyée à l'ANCIENNE adresse après un changement effectif
   * (alerte de sécurité standard — best-effort, ne bloque jamais le flux).
   */
  private async sendEmailChangedNotification(
    oldEmail: string,
    firstName: string,
    newEmail: string,
    tenantId?: string,
    userId?: string,
  ): Promise<void> {
    const fromEmail = this.configService.get<string>('EMAIL_FROM_NOREPLY') || 'noreply@academiahelm.com';
    const subject = 'Academia Helm — Votre adresse email a été modifiée';
    const html = this.buildEmailChangedTemplate(firstName, oldEmail, newEmail);
    const text = `Bonjour ${firstName},\n\nL'adresse email de votre compte Academia Helm a été modifiée : ${oldEmail} → ${newEmail}.\nSi vous n'êtes pas à l'origine de ce changement, contactez immédiatement votre administration.\n\nCordialement,\nL'équipe Academia Helm\nhttps://academiahelm.com`;

    if (tenantId) {
      await this.emailService.sendCategorized({
        tenantId,
        category: 'SYSTEM',
        subCategory: 'changement_email_effectue',
        module: 'auth',
        to: oldEmail,
        toName: firstName || undefined,
        fromEmail,
        fromName: 'Academia Helm',
        subject,
        html,
        text,
        recipientType: 'USER',
        recipientId: userId,
        triggeredBy: userId || 'SYSTEM',
        relatedEntityId: userId,
        relatedEntityType: 'User',
      });
      return;
    }

    await this.emailService.sendEmail({
      to: oldEmail,
      from: fromEmail,
      fromName: 'Academia Helm',
      subject,
      html,
      text,
    });
  }

  /**
   * Template OTP « confirmez votre nouvelle adresse email » — même charte
   * que l'OTP reset (navy/blue/gold, logo, signature responsive).
   */
  private buildEmailChangeOtpTemplate(firstName: string, otpCode: string, oldEmail: string, newEmail: string): string {
    const logoUrl = this.configService.get<string>('APP_PUBLIC_URL', 'https://academiahelm.com') + '/images/logo-academia-helm-email.png';
    const signatureLogoUrl = logoUrl;
    const currentYear = new Date().getFullYear();

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Confirmez votre nouvelle adresse — Academia Helm</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: #f0f4f8; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif; }
    .email-wrapper { width: 100%; background-color: #f0f4f8; padding: 32px 16px; }
    .email-container { max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(11, 47, 115, 0.08); }
    .header { background: linear-gradient(135deg, #0b2f73 0%, #1d4fa5 100%); padding: 36px 32px 28px; text-align: center; position: relative; }
    .header::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #f5b335, #e09915, #f5b335); }
    .header-logo { max-width: 56px; margin-bottom: 12px; border-radius: 12px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
    .header .tagline { color: #f5b335; margin: 6px 0 0; font-size: 12px; font-weight: 500; letter-spacing: 0.3px; text-transform: uppercase; }
    .content { padding: 40px 36px; }
    .greeting { font-size: 17px; color: #1e293b; margin: 0 0 6px; font-weight: 600; }
    .instruction { font-size: 14px; color: #475569; line-height: 1.8; margin: 0 0 28px; }
    .email-change-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin: 0 0 24px; text-align: center; }
    .email-change-row { font-size: 14px; color: #475569; margin: 4px 0; }
    .email-old { color: #64748b; text-decoration: line-through; }
    .email-new { color: #0b2f73; font-weight: 700; }
    .email-arrow { color: #f5b335; font-weight: 800; margin: 0 8px; }
    .otp-section { text-align: center; margin: 28px 0; }
    .otp-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 14px; font-weight: 700; }
    .otp-box { display: inline-block; background: linear-gradient(135deg, #0b2f7306, #1d4fa506); border: 2px dashed #1d4fa530; border-radius: 14px; padding: 20px 48px; }
    .otp-code { font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #0b2f73; font-family: 'Courier New', 'Consolas', monospace; margin: 0; }
    .expiry-notice { text-align: center; margin: 20px 0 0; }
    .expiry-notice p { font-size: 13px; color: #64748b; margin: 0; display: inline-block; background: #fef3c7; padding: 6px 16px; border-radius: 20px; font-weight: 500; }
    .expiry-notice strong { color: #92400e; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 28px 0; }
    .warning-box { font-size: 13px; color: #64748b; padding: 16px 20px; background: #f8fafc; border-radius: 10px; border-left: 4px solid #f5b335; line-height: 1.6; margin: 0; }
    .signature { margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
    .signature-row { display: flex; align-items: center; gap: 12px; }
    .signature-logo { width: 36px; height: 36px; border-radius: 8px; }
    .signature-text p { margin: 0; font-size: 13px; color: #475569; line-height: 1.5; }
    .signature-text .team-name { font-weight: 600; color: #0b2f73; }
    .signature-text .website { color: #1d4fa5; text-decoration: none; font-weight: 500; }
    .footer { background: #0b2f73; padding: 20px 32px; text-align: center; }
    .footer p { font-size: 11px; color: #94a3b8; margin: 4px 0; line-height: 1.5; }
    .footer a { color: #f5b335; text-decoration: none; font-weight: 500; }
    .footer .brand { color: #f5b335; font-weight: 600; font-size: 12px; }
    @media only screen and (max-width: 480px) {
      .email-wrapper { padding: 16px 8px; }
      .content { padding: 28px 20px; }
      .otp-box { padding: 16px 28px; }
      .otp-code { font-size: 28px; letter-spacing: 6px; }
      .header { padding: 28px 20px 22px; }
      .signature-row { flex-direction: column; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <img src="${logoUrl}" alt="Academia Helm" class="header-logo" />
        <h1>Academia Helm</h1>
        <p class="tagline">Confirmation de votre nouvelle adresse</p>
      </div>
      <div class="content">
        <p class="greeting">Bonjour ${firstName},</p>
        <p class="instruction">
          Vous avez demandé le remplacement de l'adresse email de votre compte
          <strong>Academia Helm</strong> :
        </p>
        <div class="email-change-box">
          <p class="email-change-row"><span class="email-old">${oldEmail}</span><span class="email-arrow">→</span><span class="email-new">${newEmail}</span></p>
          <p class="email-change-row" style="font-size:12px;color:#94a3b8;">Vous recevez ce code sur la nouvelle adresse — seul son propriétaire peut confirmer le changement.</p>
        </div>
        <div class="otp-section">
          <p class="otp-label">Code de confirmation</p>
          <div class="otp-box">
            <p class="otp-code">${otpCode}</p>
          </div>
        </div>
        <div class="expiry-notice">
          <p>Ce code expire dans <strong>10 minutes</strong></p>
        </div>
        <hr class="divider" />
        <div class="warning-box">
          Si vous n'êtes pas à l'origine de cette demande, ignorez cet email :
          votre adresse actuelle (${oldEmail}) restera inchangée et aucune
          action ne sera effectuée sur votre compte.
        </div>
        <div class="signature">
          <div class="signature-row">
            <img src="${signatureLogoUrl}" alt="" class="signature-logo" />
            <div class="signature-text">
              <p>Cordialement,</p>
              <p class="team-name">L'équipe Academia Helm</p>
              <p><a href="https://academiahelm.com" class="website">academiahelm.com</a></p>
            </div>
          </div>
        </div>
      </div>
      <div class="footer">
        <p class="brand">Academia Helm</p>
        <p>Solution de gestion scolaire nouvelle génération</p>
        <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
        <p>&copy; ${currentYear} Academia Helm. Tous droits réservés.</p>
      </div>
    </div>
  </div>
</body>
</html>`.trim();
  }

  /**
   * Template « votre adresse email a été modifiée » (notification à
   * l'ANCIENNE adresse après changement effectif).
   */
  private buildEmailChangedTemplate(firstName: string, oldEmail: string, newEmail: string): string {
    const logoUrl = this.configService.get<string>('APP_PUBLIC_URL', 'https://academiahelm.com') + '/images/logo-academia-helm-email.png';
    const signatureLogoUrl = logoUrl;
    const currentYear = new Date().getFullYear();

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Adresse email modifiée — Academia Helm</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #f0f4f8; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif; }
    .email-wrapper { width: 100%; background-color: #f0f4f8; padding: 32px 16px; }
    .email-container { max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(11, 47, 115, 0.08); }
    .header { background: linear-gradient(135deg, #0b2f73 0%, #1d4fa5 100%); padding: 36px 32px 28px; text-align: center; position: relative; }
    .header::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #f5b335, #e09915, #f5b335); }
    .header-logo { max-width: 56px; margin-bottom: 12px; border-radius: 12px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
    .header .tagline { color: #f5b335; margin: 6px 0 0; font-size: 12px; font-weight: 500; letter-spacing: 0.3px; text-transform: uppercase; }
    .content { padding: 40px 36px; }
    .greeting { font-size: 17px; color: #1e293b; margin: 0 0 6px; font-weight: 600; }
    .instruction { font-size: 14px; color: #475569; line-height: 1.8; margin: 0 0 24px; }
    .email-change-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; text-align: center; }
    .email-change-row { font-size: 14px; color: #475569; margin: 4px 0; }
    .email-old { color: #64748b; }
    .email-new { color: #0b2f73; font-weight: 700; }
    .email-arrow { color: #f5b335; font-weight: 800; margin: 0 8px; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 28px 0; }
    .warning-box { font-size: 13px; color: #64748b; padding: 16px 20px; background: #fef2f2; border-radius: 10px; border-left: 4px solid #ef4444; line-height: 1.6; margin: 0; }
    .warning-box strong { color: #b91c1c; }
    .signature { margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
    .signature-row { display: flex; align-items: center; gap: 12px; }
    .signature-logo { width: 36px; height: 36px; border-radius: 8px; }
    .signature-text p { margin: 0; font-size: 13px; color: #475569; line-height: 1.5; }
    .signature-text .team-name { font-weight: 600; color: #0b2f73; }
    .signature-text .website { color: #1d4fa5; text-decoration: none; font-weight: 500; }
    .footer { background: #0b2f73; padding: 20px 32px; text-align: center; }
    .footer p { font-size: 11px; color: #94a3b8; margin: 4px 0; line-height: 1.5; }
    .footer .brand { color: #f5b335; font-weight: 600; font-size: 12px; }
    @media only screen and (max-width: 480px) {
      .email-wrapper { padding: 16px 8px; }
      .content { padding: 28px 20px; }
      .header { padding: 28px 20px 22px; }
      .signature-row { flex-direction: column; text-align: center; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <div class="header">
        <img src="${logoUrl}" alt="Academia Helm" class="header-logo" />
        <h1>Academia Helm</h1>
        <p class="tagline">Sécurité du compte</p>
      </div>
      <div class="content">
        <p class="greeting">Bonjour ${firstName},</p>
        <p class="instruction">
          L'adresse email de votre compte <strong>Academia Helm</strong> vient
          d'être modifiée. À partir de maintenant, elle sert d'identifiant de
          connexion :
        </p>
        <div class="email-change-box">
          <p class="email-change-row"><span class="email-old">${oldEmail}</span><span class="email-arrow">→</span><span class="email-new">${newEmail}</span></p>
        </div>
        <hr class="divider" />
        <div class="warning-box">
          <strong>Si vous n'êtes pas à l'origine de ce changement,</strong>
          contactez immédiatement l'administration de votre établissement afin
          de sécuriser votre compte.
        </div>
        <div class="signature">
          <div class="signature-row">
            <img src="${signatureLogoUrl}" alt="" class="signature-logo" />
            <div class="signature-text">
              <p>Cordialement,</p>
              <p class="team-name">L'équipe Academia Helm</p>
              <p><a href="https://academiahelm.com" class="website">academiahelm.com</a></p>
            </div>
          </div>
        </div>
      </div>
      <div class="footer">
        <p class="brand">Academia Helm</p>
        <p>Solution de gestion scolaire nouvelle génération</p>
        <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
        <p>&copy; ${currentYear} Academia Helm. Tous droits réservés.</p>
      </div>
    </div>
  </div>
</body>
</html>`.trim();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  GOOGLE OAUTH — PORTAIL ÉCOLE (SCHOOL)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Vérifie qu'un utilisateur avec cet email existe dans le tenant donné
   * et qu'il a un rôle compatible avec le portail SCHOOL.
   *
   * Utilisé par le frontend Next.js après Google OAuth pour valider que
   * l'email Google correspond à un compte existant dans l'établissement.
   *
   * @returns { userId } si l'utilisateur existe, lève une exception sinon.
   */
  async checkSchoolUser(dto: { email: string; tenant_id: string }): Promise<{ userId: string }> {
    const resolvedTenantId = await this.resolveTenantId(dto.tenant_id);
    if (!resolvedTenantId) {
      throw new NotFoundException('Établissement non trouvé');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email.toLowerCase(),
        tenantId: resolvedTenantId,
      },
      select: { id: true, role: true, status: true },
    });

    if (!user) {
      throw new ForbiddenException(
        "Votre email Google n'est pas associé à un compte établissement. Contactez votre administration.",
      );
    }

    // Vérifier que l'utilisateur est actif
    if (user.status === 'SUSPENDED' || user.status === 'TERMINATED') {
      throw new ForbiddenException('Votre compte est suspendu. Contactez votre administration.');
    }

    return { userId: user.id };
  }

  /**
   * Crée une session SCHOOL pour l'utilisateur sans vérifier le mot de passe.
   *
   * L'identité a déjà été prouvée via Google OAuth + OTP email (vérifié par
   * le frontend Next.js via /api/school-auth/verify-otp).
   *
   * @returns { user, tenant, accessToken, refreshToken, serverSessionId }
   */
  async googleLogin(
    dto: { email: string; tenant_id: string; portal_type: 'SCHOOL' },
    meta?: SessionPersistMeta,
  ) {
    const resolvedTenantId = await this.resolveTenantId(dto.tenant_id);
    if (!resolvedTenantId) {
      throw new NotFoundException('Établissement non trouvé');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email.toLowerCase(),
        tenantId: resolvedTenantId,
      },
    });

    if (!user) {
      throw new ForbiddenException(
        "Votre email Google n'est pas associé à un compte établissement.",
      );
    }

    // Vérifier que l'utilisateur est actif
    if (user.status === 'SUSPENDED' || user.status === 'TERMINATED') {
      throw new ForbiddenException('Votre compte est suspendu. Contactez votre administration.');
    }

    // Récupérer le tenant complet
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: resolvedTenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Établissement non trouvé');
    }

    // Générer les tokens JWT enrichis AVEC tenantId (l'utilisateur SCHOOL
    // est déjà rattaché à un tenant — pas besoin de sélection ultérieure)
    const accessToken = this.generateEnrichedToken(user, resolvedTenantId).accessToken;
    const refreshToken = this.generateEnrichedToken(user, resolvedTenantId).refreshToken;

    // Persister la session en DB
    const sessionRecord = await this.persistWebSession(user.id, refreshToken, meta);

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
        tenantId: resolvedTenantId,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        subdomain: tenant.subdomain || tenant.slug,
      },
      accessToken,
      refreshToken,
      ...(sessionRecord ? { serverSessionId: sessionRecord.id } : {}),
    };
  }
}

