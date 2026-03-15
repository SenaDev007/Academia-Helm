import { Injectable, UnauthorizedException, ForbiddenException, NotFoundException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { LoginDto, PortalType } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user
    const user = await this.usersService.create({
      ...registerDto,
      passwordHash: hashedPassword,
    });

    // Generate tokens
    const tokens = this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: user.tenantId,
      },
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
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
      
      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isPlatformOwner: true,
        },
        ...tokens,
      };
    }

    // Pour les autres utilisateurs, vérifier l'appartenance au tenant
    if (loginDto.portal_type === PortalType.PLATFORM) {
      throw new ForbiddenException('Only PLATFORM_OWNER can use PLATFORM portal type');
    }

    // Si portal_type est SCHOOL, TEACHER ou PARENT, tenant_id est requis
    if (loginDto.portal_type && loginDto.portal_type !== PortalType.PLATFORM) {
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

    // Si tenant_id est fourni (même sans portal_type), vérifier l'appartenance
    // Cela permet de sécuriser le login standard avec tenant_id
    if (loginDto.tenant_id && (!loginDto.portal_type || loginDto.portal_type === PortalType.PLATFORM)) {
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

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: loginDto.tenant_id || null,
          isPlatformOwner: false,
        },
        ...tokens,
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

  /**
   * Génère un token JWT initial SANS tenant_id (après login)
   * Le tenant sera sélectionné via /auth/select-tenant
   */
  private generateTokens(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
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
      role: user.role,
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

  /**
   * Liste des tenants pour le mode développement (sans authentification).
   * Uniquement en NODE_ENV=development / APP_ENV=development.
   */
  async getDevAvailableTenants(): Promise<any[]> {
    const appEnv = this.configService.get<string>('APP_ENV', 'production');
    const nodeEnv = process.env.NODE_ENV || 'production';
    if (appEnv !== 'development' && nodeEnv !== 'development') {
      throw new ForbiddenException('Dev available tenants is only available in development mode');
    }
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
  async selectTenant(userId: string, tenantId: string): Promise<any> {
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
        role: user.role,
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
    };
  }
}

