import { Controller, Post, Body, Get, UseGuards, HttpCode, HttpStatus, ForbiddenException, Req } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Req() req: Request) {
    return this.authService.register(registerDto, {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    return this.authService.login(loginDto, {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    return { message: 'Logged out successfully' };
  }

  /** Public : le client envoie uniquement le refresh JWT (pas d’Authorization). */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  /**
   * Route de développement : connexion automatique avec PLATFORM_OWNER
   * ⚠️ UNIQUEMENT EN DÉVELOPPEMENT
   */
  @Public()
  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  async devLogin() {
    // Vérifier que c'est en développement
    const appEnv = this.configService.get<string>('APP_ENV', 'production');
    const nodeEnv = process.env.NODE_ENV || 'production';
    
    if (appEnv !== 'development' && nodeEnv !== 'development') {
      throw new ForbiddenException('Dev login is only available in development mode');
    }

    // Récupérer les identifiants PLATFORM_OWNER
    const platformOwnerEmail = this.configService.get<string>('PLATFORM_OWNER_EMAIL');
    const platformOwnerSecret = this.configService.get<string>('PLATFORM_OWNER_SECRET');

    if (!platformOwnerEmail || !platformOwnerSecret) {
      throw new ForbiddenException('PLATFORM_OWNER credentials not configured');
    }

    // Utiliser le service d'authentification avec les identifiants PLATFORM_OWNER
    return this.authService.login({
      email: platformOwnerEmail,
      password: platformOwnerSecret,
    });
  }

  /**
   * Liste des écoles (tenants) pour le mode développement - sans authentification.
   * Permet de sélectionner une école avant de saisir les identifiants.
   */
  @Public()
  @Get('dev-available-tenants')
  @HttpCode(HttpStatus.OK)
  async getDevAvailableTenants() {
    return this.authService.getDevAvailableTenants();
  }

  /**
   * ÉTAPE 2 : Récupère la liste des tenants accessibles à l'utilisateur
   * 
   * Guard : AuthGuard uniquement (pas de TenantGuard)
   * 
   * Retourne :
   * - PLATFORM_OWNER → tous les tenants actifs
   * - Utilisateur normal → son tenant (ou ses tenants si multi-tenant)
   */
  @UseGuards(JwtAuthGuard)
  @Get('available-tenants')
  @HttpCode(HttpStatus.OK)
  async getAvailableTenants(@Req() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.authService.getAvailableTenants(userId);
  }

  /**
   * ÉTAPE 3 : Sélectionne un tenant et génère un nouveau token enrichi
   * 
   * Guard : AuthGuard uniquement (pas de TenantGuard)
   * 
   * Payload :
   * {
   *   "tenant_id": "uuid"
   * }
   * 
   * Retourne :
   * - Nouveau JWT avec tenant_id
   * - Informations du tenant
   * - Année académique active
   */
  @UseGuards(JwtAuthGuard)
  @Post('select-tenant')
  @HttpCode(HttpStatus.OK)
  async selectTenant(@Req() req: any, @Body('tenant_id') tenantId: string) {
    if (!tenantId) {
      throw new ForbiddenException('tenant_id is required');
    }

    const userId = req.user.sub || req.user.id;
    return this.authService.selectTenant(userId, tenantId, {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }
}

