import { Controller, Post, Body, Get, UseGuards, HttpCode, HttpStatus, ForbiddenException, Req, Logger } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { CheckSchoolUserDto, GoogleLoginDto } from './dto/google-login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

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

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request) {
    const authHeader = req.headers.authorization;
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      const cookieHeader = req.headers.cookie;
      if (cookieHeader) {
        const match = cookieHeader.match(/(?:^|;\s*)academia_token=([^;]*)/);
        if (match) {
          token = decodeURIComponent(match[1].trim());
        }
      }
    }
    if (token) {
      await this.authService.logout(token);
    }
    return { message: 'Logged out successfully' };
  }

  /** Public : le client envoie uniquement le refresh JWT (pas d’Authorization). */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Public()
  @Post('verify-reset-otp')
  @HttpCode(HttpStatus.OK)
  async verifyResetOtp(@Body() verifyResetOtpDto: VerifyResetOtpDto) {
    return this.authService.verifyResetOtp(verifyResetOtpDto);
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
  /**
   * Route de diagnostic : vérifie la configuration email et tente un envoi de test.
   * ⚠️ UNIQUEMENT EN DÉVELOPPEMENT — expose des infos sensibles (clés partielles)
   */
  @Public()
  @Post('test-email-config')
  @HttpCode(HttpStatus.OK)
  async testEmailConfig(@Body('email') testEmail?: string) {
    const appEnv = this.configService.get<string>('APP_ENV', 'production');
    const nodeEnv = process.env.NODE_ENV || 'production';
    const isDev = appEnv === 'development' || nodeEnv === 'development';

    const emailProvider = this.configService.get<string>('EMAIL_PROVIDER', '(non défini)');
    const resendKey = this.configService.get<string>('RESEND_API_KEY');
    const emailFromNoreply = this.configService.get<string>('EMAIL_FROM_NOREPLY', '(non défini)');
    const smtpHost = this.configService.get<string>('SMTP_HOST', '(non défini)');

    const config = {
      EMAIL_PROVIDER: emailProvider,
      RESEND_API_KEY: resendKey ? `${resendKey.substring(0, 6)}...${resendKey.slice(-4)}` : '(non défini)',
      EMAIL_FROM_NOREPLY: emailFromNoreply,
      SMTP_HOST: smtpHost,
      NODE_ENV: nodeEnv,
      APP_ENV: appEnv,
    };

    // Tenter un envoi réel si un email de test est fourni
    let sendResult = null;
    if (testEmail) {
      try {
        sendResult = await this.authService.sendTestEmail(testEmail);
      } catch (error: any) {
        sendResult = { success: false, error: error?.message || String(error) };
      }
    }

    return {
      config: isDev ? config : { EMAIL_PROVIDER: emailProvider, EMAIL_FROM_NOREPLY: emailFromNoreply },
      testEmail: testEmail || null,
      sendResult,
    };
  }

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

  // ═══════════════════════════════════════════════════════════════════════
  //  GOOGLE OAUTH — PORTAIL ÉCOLE (SCHOOL)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * POST /auth/check-school-user
   *
   * Vérifie qu'un utilisateur avec cet email existe dans le tenant donné.
   * Utilisé par le frontend Next.js après Google OAuth pour valider que
   * l'email Google correspond à un compte établissement existant.
   */
  @Public()
  @Post('check-school-user')
  @HttpCode(HttpStatus.OK)
  async checkSchoolUser(@Body() dto: CheckSchoolUserDto) {
    return this.authService.checkSchoolUser(dto);
  }

  /**
   * POST /auth/google-login
   *
   * Crée une session SCHOOL pour l'utilisateur sans vérifier le mot de passe.
   * L'identité a déjà été prouvée via Google OAuth + OTP email (vérifié par
   * le frontend Next.js via /api/school-auth/verify-otp).
   *
   * Retourne { user, tenant, accessToken, refreshToken, serverSessionId }.
   */
  @Public()
  @Post('google-login')
  @HttpCode(HttpStatus.OK)
  async googleLogin(@Body() dto: GoogleLoginDto, @Req() req: Request) {
    return this.authService.googleLogin(dto, {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }
}

