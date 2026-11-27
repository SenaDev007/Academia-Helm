import { Controller, Post, Body, Get, UseGuards, HttpCode, HttpStatus, ForbiddenException, Req, Logger } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
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
import { TwoFactorService } from './services/twofactor.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly twoFactorService: TwoFactorService,
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
    // ⭐ MOBILE SESSION — détecter le TÉLÉPHONE (app Android WebView Capacitor
    //    OU navigateur mobile) via le marqueur « ; wv) » de l'UA, les UA mobiles
    //    (Android Mobile / iPhone / iPad / iPod) ou l'en-tête explicite
    //    X-AH-Native-App → refresh token 90 jours (session toujours ouverte
    //    sur mobile — nov. 2026, retour promoteur « comme WhatsApp »).
    const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '';
    const nativeApp =
      /;\s*wv\)/.test(ua) ||
      /capacitor/i.test(ua) ||
      /iPhone|iPod|iPad/i.test(ua) ||
      (/Android/i.test(ua) && /Mobile/i.test(ua)) ||
      req.headers['x-ah-native-app'] === '1';
    return this.authService.login(loginDto, {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: ua || undefined,
      nativeApp,
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
      // ⭐ 2026-11-27 — meta IP/user-agent pour l'audit LOGOUT (Appareils autorisés)
      await this.authService.logout(token, {
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
      });
    }
    return { message: 'Logged out successfully' };
  }

  /** Public : le client envoie uniquement le refresh JWT (pas d’Authorization). */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string, @Req() req: Request) {
    // ⭐ MOBILE SESSION — le TÉLÉPHONE (app Android WebView OU navigateur mobile)
    //    est détecté soit par le marqueur « ; wv) » de son user-agent, soit par
    //    les UA mobiles (Android Mobile / iPhone / iPad / iPod), soit par
    //    l'en-tête explicite X-AH-Native-App posé par le client web (fiable à
    //    100 %) → refresh token 90 jours (session toujours ouverte sur mobile —
    //    jamais de déconnexion automatique, uniquement volontaire).
    //    Les navigateurs web desktop : 7 jours (inchangé).
    const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '';
    const nativeSession =
      /;\s*wv\)/.test(ua) ||
      /capacitor/i.test(ua) ||
      /iPhone|iPod|iPad/i.test(ua) ||
      (/Android/i.test(ua) && /Mobile/i.test(ua)) ||
      req.headers['x-ah-native-app'] === '1';
    return this.authService.refreshToken(refreshToken, nativeSession);
  }

  // ═══════════════════════════════════════════════════════════
  //  ⭐ 2FA TOTP — double authentification (RFC 6238)
  // ═══════════════════════════════════════════════════════════

  /** Génère un secret PENDING + QR code (JWT requis). */
  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  async twoFactorSetup(@Req() req: Request) {
    const user = (req as any).user;
    const userId = user?.id || user?.sub || user?.userId;
    if (!userId) throw new ForbiddenException('Utilisateur non authentifié');
    return this.twoFactorService.setup(userId);
  }

  /** Active la 2FA après vérification du code contre le secret PENDING.
   *  Renvoie les 10 codes de secours UNE SEULE FOIS (en clair). */
  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  async twoFactorEnable(@Req() req: Request, @Body() body: { code?: string }) {
    const user = (req as any).user;
    const userId = user?.id || user?.sub || user?.userId;
    if (!userId) throw new ForbiddenException('Utilisateur non authentifié');
    return this.twoFactorService.enable(userId, body?.code || '');
  }

  /** Désactive la 2FA (exige un code TOTP OU le mot de passe). */
  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  async twoFactorDisable(@Req() req: Request, @Body() body: { code?: string; password?: string }) {
    const user = (req as any).user;
    const userId = user?.id || user?.sub || user?.userId;
    if (!userId) throw new ForbiddenException('Utilisateur non authentifié');
    return this.twoFactorService.disable(userId, body?.code, body?.password);
  }

  /** Statut 2FA de l'utilisateur courant. */
  @UseGuards(JwtAuthGuard)
  @Get('2fa/status')
  async twoFactorStatus(@Req() req: Request) {
    const user = (req as any).user;
    const userId = user?.id || user?.sub || user?.userId;
    if (!userId) throw new ForbiddenException('Utilisateur non authentifié');
    return this.twoFactorService.status(userId);
  }

  /** PUBLIC — échange le jeton temporaire + code TOTP contre les tokens
   *  complets de connexion (appelé par l'écran de login après requires2fa). */
  @Public()
  @Post('2fa/verify-login')
  @HttpCode(HttpStatus.OK)
  async twoFactorVerifyLogin(
    @Req() req: Request,
    @Body() body: { twoFactorTempToken?: string; code?: string },
  ) {
    if (!body?.twoFactorTempToken) {
      throw new ForbiddenException('twoFactorTempToken requis');
    }
    return this.twoFactorService.verifyLogin(body.twoFactorTempToken, body?.code || '', {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
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
   * ⭐ Changement de mot de passe self-service DEPUIS l'application (connecté).
   *
   * EXACTEMENT le même processus que « mot de passe oublié » :
   *   1. POST /auth/request-password-change (ici) → code OTP 6 chiffres par email
   *      (email tiré du JWT — l'utilisateur connecté, pas saisi)
   *   2. POST /auth/verify-reset-otp { email, code }
   *   3. POST /auth/reset-password { email, code, newPassword }
   *      → bcrypt + invalidation de toutes les sessions (reconnexion requise)
   *
   * ⚠️ PAS de @Public : route protégée par le JwtAuthGuard global → seul
   *    l'utilisateur connecté peut déclencher l'envoi du code pour SON compte.
   */
  @Post('request-password-change')
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { limit: 5, ttl: 60000 } })
  async requestPasswordChange(@CurrentUser() user: any) {
    const userId = user?.id || user?.sub || user?.userId;
    const email = user?.email;
    if (!userId || !email) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }
    return this.authService.requestPasswordChange({ id: userId, email });
  }

  /**
   * ⭐ Changement d'adresse email self-service DEPUIS l'application (connecté).
   *
   * Même mécanique OTP que « mot de passe oublié », mais le code est envoyé
   * à la NOUVELLE adresse (prouve que l'utilisateur la contrôle) et lié à la
   * demande via password_resets.pendingEmail :
   *   1. POST /auth/request-email-change { newEmail }   (ici) → code OTP
   *   2. POST /auth/confirm-email-change { code, newEmail } → users.email
   *      mis à jour + toutes les sessions invalidées + notification à
   *      l'ancienne adresse.
   *
   * ⚠️ PAS de @Public : route protégée par le JwtAuthGuard global → seul
   *    l'utilisateur connecté peut demander le changement pour SON compte.
   */
  @Post('request-email-change')
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { limit: 5, ttl: 60000 } })
  async requestEmailChange(
    @CurrentUser() user: any,
    @Body('newEmail') newEmail: string,
  ) {
    const userId = user?.id || user?.sub || user?.userId;
    const email = user?.email;
    if (!userId || !email) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }
    if (!newEmail || typeof newEmail !== 'string') {
      throw new ForbiddenException('Nouvelle adresse email requise.');
    }
    return this.authService.requestEmailChange({ id: userId, email }, newEmail);
  }

  /**
   * ⭐ Changement d'adresse email — ÉTAPE 2 : confirmation par code OTP.
   * Applique le changement (users.email), invalide toutes les sessions et
   * notifie l'ancienne adresse. Reconnexion obligatoire ensuite.
   */
  @Post('confirm-email-change')
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  async confirmEmailChange(
    @CurrentUser() user: any,
    @Body('code') code: string,
    @Body('newEmail') newEmail: string | undefined,
  ) {
    const userId = user?.id || user?.sub || user?.userId;
    const email = user?.email;
    if (!userId || !email) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }
    return this.authService.confirmEmailChange({ id: userId, email }, { code, newEmail });
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

