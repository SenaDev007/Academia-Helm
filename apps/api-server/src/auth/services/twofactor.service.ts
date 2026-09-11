/**
 * ============================================================================
 * TWO-FACTOR SERVICE — cycle de vie 2FA TOTP de Helm Connect
 * ============================================================================
 *
 * ⭐ Endpoints (via AuthController) :
 *      POST /auth/2fa/setup         → { secret, otpauthUrl, qrDataUrl }
 *      POST /auth/2fa/enable        → { backupCodes: string[] }
 *      POST /auth/2fa/disable       → { ok: true }
 *      GET  /auth/2fa/status        → { enabled, enabledAt, remainingBackupCodes }
 *      POST /auth/2fa/verify-login  → payload complet de connexion (public)
 *
 * Flux d'activation (la spec sécurité exige TOTP, pas de SMS) :
 *   1. POST setup    : un secret PENDING est stocké (pas encore actif) → QR.
 *   2. L'utilisateur scanne le QR (Google Authenticator/Aegis…), saisit le code.
 *   3. POST enable   : le code est vérifié contre le secret pending → le
 *                      secret devient ACTIF + 10 codes de secours hachés bcrypt
 *                      sont renvoyés UNE SEULE FOIS (en clair).
 *   4. À la connexion : /auth/login renvoie { requires2fa, twoFactorTempToken }
 *                      (JWT signé 5 min) → l'utilisateur saisit son code →
 *                      POST 2fa/verify-login { twoFactorTempToken, code } →
 *                      tokens complets.
 * ============================================================================
 */

import {
  Injectable, Logger, BadRequestException, UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { TotpService } from './totp.service';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from '../auth.service';

interface TwoFactorTempPayload {
  sub: string;
  purpose: '2fa_login';
  tenant_id?: string;
  portal_type?: string;
  iat: number;
  exp: number;
}

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    private readonly totp: TotpService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  // ═════════════════════════════════════════════════════════════════
  //  SETUP — génère un secret PENDING + QR (aucune activation avant enable)
  // ═════════════════════════════════════════════════════════════════
  async setup(userId: string): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string }> {
    const secret = this.totp.generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorPendingSecret: secret },
    });
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const otpauth = this.totp.otpauthUrl(secret, user?.email || userId);
    const qrDataUrl = await this.totp.qrDataUrl(otpauth);
    return { secret, otpauthUrl: otpauth, qrDataUrl };
  }

  // ═════════════════════════════════════════════════════════════════
  //  ENABLE — vérifie le code contre le secret PENDING → active la 2FA
  // ═════════════════════════════════════════════════════════════════
  async enable(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorPendingSecret: true, twoFactorEnabled: true, email: true },
    });
    if (!user) throw new UnauthorizedException('Utilisateur introuvable');
    if (user.twoFactorEnabled) throw new BadRequestException('La double authentification est déjà activée');
    if (!user.twoFactorPendingSecret) throw new BadRequestException("Aucun setup en cours — appelez d'abord 2fa/setup");

    const valid = this.totp.verifyCode(user.twoFactorPendingSecret, code || '');
    if (!valid) throw new BadRequestException('Code TOTP invalide — vérifiez l\'heure de votre appareil et réessayez');

    const { plain, hashed } = await this.totp.generateBackupCodes(10);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: user.twoFactorPendingSecret,
        twoFactorPendingSecret: null,
        twoFactorEnabled: true,
        twoFactorBackupCodes: JSON.stringify(hashed),
        twoFactorEnabledAt: new Date(),
      },
    });
    this.logger.log(`2FA activée pour ${user.email}`);
    return { backupCodes: plain };
  }

  // ═════════════════════════════════════════════════════════════════
  //  DISABLE — exige un code TOTP OU le mot de passe (pas une désactivation à chaud)
  // ═════════════════════════════════════════════════════════════════
  async disable(userId: string, code?: string, password?: string): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorSecret: true, passwordHash: true, email: true },
    });
    if (!user?.twoFactorEnabled) throw new BadRequestException('La double authentification n\'est pas activée');

    let authorized = false;
    if (code && user.twoFactorSecret) {
      authorized = this.totp.verifyCode(user.twoFactorSecret, code);
    }
    if (!authorized && password && user.passwordHash) {
      authorized = await bcrypt.compare(password, user.passwordHash);
    }
    if (!authorized) {
      throw new ForbiddenException('Code TOTP ou mot de passe requis pour désactiver la 2FA');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: null,
        twoFactorPendingSecret: null,
        twoFactorEnabled: false,
        twoFactorBackupCodes: null,
        twoFactorEnabledAt: null,
      },
    });
    this.logger.log(`2FA désactivée pour ${user.email}`);
    return { ok: true };
  }

  // ═════════════════════════════════════════════════════════════════
  //  STATUS
  // ═════════════════════════════════════════════════════════════════
  async status(userId: string): Promise<{
    enabled: boolean;
    enabledAt: Date | null;
    hasPendingSetup: boolean;
    remainingBackupCodes: number;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorEnabledAt: true, twoFactorPendingSecret: true, twoFactorBackupCodes: true },
    });
    let remaining = 0;
    if (user?.twoFactorBackupCodes) {
      try { remaining = (JSON.parse(user.twoFactorBackupCodes) as string[]).length; } catch { remaining = 0; }
    }
    return {
      enabled: !!user?.twoFactorEnabled,
      enabledAt: user?.twoFactorEnabledAt ?? null,
      hasPendingSetup: !!user?.twoFactorPendingSecret,
      remainingBackupCodes: remaining,
    };
  }

  // ═════════════════════════════════════════════════════════════════
  //  PORTE DE CONNEXION — appelé par AuthService.login quand la 2FA est active
  // ═════════════════════════════════════════════════════════════════
  /** Signe un jeton temporaire (5 min) portant le contexte de login en cours. */
  issueLoginTempToken(userId: string, tenantId?: string, portalType?: string): string {
    return this.jwt.sign(
      { sub: userId, purpose: '2fa_login', tenant_id: tenantId, portal_type: portalType },
      { expiresIn: '5m' },
    );
  }

  // ═════════════════════════════════════════════════════════════════
  //  VERIFY-LOGIN — jeton temporaire + code TOTP/backup → payload complet
  // ═════════════════════════════════════════════════════════════════
  async verifyLogin(
    twoFactorTempToken: string,
    code: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<any> {
    // 1. Vérifier le jeton temporaire (signé, 5 min, purpose dédié)
    let payload: TwoFactorTempPayload;
    try {
      payload = this.jwt.verify(twoFactorTempToken);
    } catch {
      throw new UnauthorizedException('Session 2FA expirée — reconnectez-vous');
    }
    if (payload.purpose !== '2fa_login') {
      throw new UnauthorizedException('Jeton 2FA invalide');
    }

    // 2. Recharger l'utilisateur + vérifier le code (TOTP ou backup)
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, email: true, firstName: true, lastName: true, role: true, tenantId: true,
        status: true, passwordHash: true,
        twoFactorEnabled: true, twoFactorSecret: true, twoFactorBackupCodes: true,
      },
    });
    if (!user) throw new UnauthorizedException('Utilisateur introuvable');
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('La double authentification n\'est pas activée pour ce compte');
    }
    if (user.status !== 'active') throw new ForbiddenException('Compte inactif');

    const normalized = (code || '').trim();
    const isTotp = this.totp.verifyCode(user.twoFactorSecret, normalized);
    let consumedBackupIndex = -1;
    if (!isTotp) {
      consumedBackupIndex = await this.totp.findBackupCodeIndex(user.twoFactorBackupCodes, normalized);
      if (consumedBackupIndex === -1) {
        throw new UnauthorizedException('Code de vérification invalide');
      }
    }

    // 3. Consommer le code de secours utilisé (usage unique)
    if (consumedBackupIndex >= 0 && user.twoFactorBackupCodes) {
      const remaining: string[] = JSON.parse(user.twoFactorBackupCodes);
      remaining.splice(consumedBackupIndex, 1);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { twoFactorBackupCodes: JSON.stringify(remaining) },
      });
      this.logger.log(`Code de secours consommé pour ${user.email} — restants : ${remaining.length}`);
    }

    // 4. Compléter la connexion (tokens + session persistée + payload complet)
    return this.auth.completeLoginAfter2fa(user.id, payload.tenant_id, meta);
  }
}
