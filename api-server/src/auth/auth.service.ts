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
      logoUrl: tenant.schools?.logo ?? null,
      country: tenant.country?.name || null,
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
   * Génère un jeton de réinitialisation de mot de passe et l'envoie (simulation)
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(forgotPasswordDto.email);
    
    // On retourne toujours le même message de succès pour ne pas fuiter l'existence d'emails
    const successMessage = { message: "Si un compte existe avec cet email, un lien de réinitialisation vous a été envoyé." };
    
    if (!user) {
      this.logger.warn(`Tentative de réinitialisation pour un email inexistant: ${forgotPasswordDto.email}`);
      return successMessage;
    }

    // Générer un token temporaire pour la réinitialisation
    const resetToken = this.jwtService.sign(
      { sub: user.id, email: user.email, purpose: 'password-reset' },
      { expiresIn: '30m' } // Le token expire dans 30 minutes
    );

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    
    // Envoi de l'e-mail via EmailService (Nodemailer/SendGrid)
    try {
      await this.emailService.sendEmail({
        to: user.email,
        subject: 'Academia Helm - Réinitialisation de votre mot de passe',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="background-color: #0f172a; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Academia Helm</h1>
            </div>
            <div style="padding: 30px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
              <h2 style="color: #0f172a; margin-top: 0;">Réinitialisation de mot de passe</h2>
              <p>Bonjour ${user.firstName || ''},</p>
              <p>Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte Academia Helm.</p>
              <p>Pour définir un nouveau mot de passe, veuillez cliquer sur le bouton ci-dessous :</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Réinitialiser mon mot de passe</a>
              </div>
              <p style="font-size: 14px; color: #64748b;">Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br/>
              <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a></p>
              <p style="font-size: 14px; color: #64748b; margin-top: 30px;">Ce lien expirera dans 30 minutes.<br/>
              Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet e-mail.</p>
            </div>
          </div>
        `,
        text: `Bonjour ${user.firstName || ''},\n\nNous avons reçu une demande de réinitialisation de mot de passe pour votre compte Academia Helm.\n\nPour définir un nouveau mot de passe, copiez-collez le lien suivant dans votre navigateur :\n${resetUrl}\n\nCe lien expirera dans 30 minutes.\n\nL'équipe Academia Helm`,
      });
      this.logger.log(`Email de réinitialisation envoyé avec succès à ${user.email}`);
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'e-mail de réinitialisation à ${user.email}`, error);
      // On continue pour ne pas fuiter l'erreur au client
    }

    return successMessage;
  }

  /**
   * Réinitialise le mot de passe à l'aide d'un jeton valide
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    try {
      // Vérifier le token
      const payload = this.jwtService.verify(resetPasswordDto.token);
      
      // Vérifier que le token a été généré spécifiquement pour la réinitialisation
      if (payload.purpose !== 'password-reset') {
        throw new ForbiddenException('Jeton invalide pour cette opération.');
      }

      const user = await this.usersService.findOne(payload.sub);
      if (!user) {
        throw new NotFoundException('Utilisateur introuvable.');
      }

      // Hacher le nouveau mot de passe
      const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);

      // Mettre à jour l'utilisateur via Prisma
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: hashedPassword },
      });

      this.logger.log(`Mot de passe réinitialisé avec succès pour l'utilisateur: ${user.email}`);

      // Optionnel: On pourrait révoquer tous les anciens refresh tokens ici
      // en les insérant dans la table revokedToken ou en incrémentant une version de token sur le user.

      return { message: "Votre mot de passe a été réinitialisé avec succès." };
    } catch (error: any) {
      this.logger.error(`Échec de la réinitialisation du mot de passe: ${error.message}`);
      throw new ForbiddenException('Le lien de réinitialisation est invalide ou a expiré.');
    }
  }
}

