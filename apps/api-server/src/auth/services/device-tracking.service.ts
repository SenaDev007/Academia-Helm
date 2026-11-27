/**
 * Device Tracking Service
 *
 * ⭐ 2026-11-27 — Branché pour de VRAI sur le flux de connexion (retour
 *    promoteur : l'onglet Paramètres → Appareils autorisés n'affichait
 *    RIEN). À chaque login/register/2FA/Google :
 *    - l'appareil est déduit de l'User-Agent (nom lisible type Facebook :
 *      « Chrome sur Windows », « Safari sur iPhone (iOS 17.2) »…) ;
 *    - une ligne user_devices est créée/mise à jour (dernier vu, IP) ;
 *    - une entrée auth_audit_logs est écrite (LOGIN / LOGIN_FAILED /
 *      LOGOUT / DEVICE_REVOKED) avec IP + user-agent.
 *
 * Gère aussi :
 * - Génération device_hash sécurisé (SHA-256 de l'empreinte NAVIGATEUR,
 *   SANS l'IP — l'IP change en mobile sans que l'appareil change) ;
 * - Appareils trusted (approbation manuelle) ;
 * - Révocation : désactive les sessions de l'appareil ET supprime les
 *   sessions web (refresh tokens) correspondantes → déconnexion réelle.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as crypto from 'crypto';

export interface DeviceInfo {
  userAgent?: string;
  ipAddress?: string;
  deviceName?: string;
  deviceType: 'desktop' | 'tablet' | 'mobile';
}

export interface CreateDeviceResult {
  deviceId: string;
  deviceHash: string;
  isNew: boolean;
}

@Injectable()
export class DeviceTrackingService {
  private readonly logger = new Logger(DeviceTrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * ⭐ 2026-11-27 — Déduit un NOM D'APPAREIL lisible de l'User-Agent,
   *    comme Facebook (« Chrome sur Windows », « Safari sur iPhone »,
   *    « Samsung Internet sur Android »…).
   */
  parseUserAgent(ua?: string): { deviceName: string; deviceType: 'desktop' | 'tablet' | 'mobile' } {
    const s = ua || '';

    // ── Type d'appareil ──
    const isTablet = /iPad|Tablet|PlayBook|Silk/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s));
    const isMobile = !isTablet && /Mobi|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone/i.test(s);
    const deviceType: 'desktop' | 'tablet' | 'mobile' = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

    // ── Navigateur (ordre important : Edge/Opera contiennent Chrome) ──
    let browser = '';
    let browserVersion = '';
    const browserPatterns: Array<[string, RegExp]> = [
      ['Edge', /Edg(?:e|A|iOS)?\/([\d.]+)/],
      ['Opera', /OPR\/([\d.]+)/],
      ['Samsung Internet', /SamsungBrowser\/([\d.]+)/],
      ['Firefox', /Firefox\/([\d.]+)/],
      ['Chrome', /Chrome\/([\d.]+)/],
      ['Safari', /Version\/([\d.]+).*Safari/],
    ];
    for (const [name, re] of browserPatterns) {
      const m = s.match(re);
      if (m) { browser = name; browserVersion = m[1] || ''; break; }
    }
    if (!browser && /Safari/.test(s)) browser = 'Safari';
    if (!browser && /Capacitor|wv\)/.test(s)) browser = 'Application Academia Helm';

    // ── Système / modèle ──
    let os = '';
    let model = '';
    if (/iPhone/i.test(s)) {
      model = 'iPhone';
      const v = s.match(/iPhone OS ([\d_]+)/);
      os = v ? `iOS ${v[1].replace(/_/g, '.')}` : 'iOS';
    } else if (/iPad/i.test(s)) {
      model = 'iPad';
      const v = s.match(/CPU OS ([\d_]+)/);
      os = v ? `iPadOS ${v[1].replace(/_/g, '.')}` : 'iPadOS';
    } else if (/Android/i.test(s)) {
      const mv = s.match(/Android[^;]*;\s*([^;)]+?)\s*(?:Build|\))/);
      model = (mv ? mv[1].trim() : '') || '';
      // Les UA génériques « Android 13 » sans modèle restent sans modèle
      if (/^Android ?\d*/i.test(model)) model = '';
      const av = s.match(/Android ([\d.]+)/);
      os = `Android${av ? ' ' + av[1] : ''}`;
    } else if (/Windows/i.test(s)) {
      os = /Windows NT 10/.test(s) ? 'Windows' : 'Windows';
    } else if (/Mac OS X|Macintosh/i.test(s)) {
      const v = s.match(/Mac OS X ([\d_.]+)/);
      os = v ? `macOS ${v[1].replace(/_/g, '.')}` : 'macOS';
    } else if (/Linux/i.test(s)) {
      os = 'Linux';
    }

    const parts: string[] = [];
    if (browser) parts.push(browserVersion ? `${browser} ${browserVersion.split('.')[0]}` : browser);
    if (model) parts.push(`sur ${model}`);
    else if (os) parts.push(`sur ${os}`);
    else if (browser) parts.push('sur appareil inconnu');

    let deviceName = parts.join(' ') || 'Appareil inconnu';
    // Cas « Chrome sur iPhone » → préciser l'OS entre parenthèses
    if (model && os) deviceName += ` (${os})`;
    // Application native Capacitor
    if (/Capacitor/i.test(s)) deviceName = `Application Academia Helm${os ? ` — ${os}` : ''}`;

    return { deviceName, deviceType };
  }

  /**
   * Génère un device_hash sécurisé à partir des informations de l'appareil.
   * ⭐ 2026-11-27 — SANS l'adresse IP : en mobile l'IP change à chaque
   *    réseau sans que l'appareil change (sinon un « nouvel appareil » était
   *    créé à chaque changement de réseau). L'IP reste stockée/mise à jour
   *    sur la ligne user_devices.
   */
  generateDeviceHash(
    userId: string,
    tenantId: string,
    userAgent?: string,
    _ipAddress?: string,
  ): string {
    const deviceFingerprint = `${userId}:${tenantId}:${userAgent || 'unknown'}`;
    return crypto.createHash('sha256').update(deviceFingerprint).digest('hex');
  }

  /**
   * Crée ou récupère un appareil
   */
  async createOrGetDevice(
    userId: string,
    tenantId: string,
    deviceInfo: DeviceInfo
  ): Promise<CreateDeviceResult> {
    const deviceHash = this.generateDeviceHash(
      userId,
      tenantId,
      deviceInfo.userAgent,
      deviceInfo.ipAddress
    );

    // ⭐ 2026-11-27 — nom lisible déduit de l'UA si non fourni
    const parsed = this.parseUserAgent(deviceInfo.userAgent);
    const deviceName = deviceInfo.deviceName || parsed.deviceName;
    const deviceType = deviceInfo.deviceType || parsed.deviceType;

    // Chercher un appareil existant
    const existingDevice = await this.prisma.userDevice.findUnique({
      where: { deviceHash },
    });

    if (existingDevice) {
      // Mettre à jour lastUsedAt (+ nom si l'UA a été précisé)
      const updated = await this.prisma.userDevice.update({
        where: { id: existingDevice.id },
        data: {
          lastUsedAt: new Date(),
          ipAddress: deviceInfo.ipAddress,
          userAgent: deviceInfo.userAgent,
          ...(existingDevice.revokedAt ? { revokedAt: null } : {}),
          ...(existingDevice.deviceName ? {} : { deviceName }),
        },
      });

      return {
        deviceId: updated.id,
        deviceHash: updated.deviceHash,
        isNew: false,
      };
    }

    // Créer un nouvel appareil
    const newDevice = await this.prisma.userDevice.create({
      data: {
        userId,
        tenantId,
        deviceHash,
        deviceName,
        deviceType,
        userAgent: deviceInfo.userAgent,
        ipAddress: deviceInfo.ipAddress,
        isTrusted: false,
        lastUsedAt: new Date(),
      },
    });

    return {
      deviceId: newDevice.id,
      deviceHash: newDevice.deviceHash,
      isNew: true,
    };
  }

  /**
   * ⭐ 2026-11-27 — Écrit une entrée d'audit d'authentification
   *    (LOGIN / LOGIN_FAILED / LOGOUT / DEVICE_APPROVED / DEVICE_REVOKED…).
   *    Best-effort : n'interrompt JAMAIS le flux principal.
   */
  async writeAudit(entry: {
    userId?: string | null;
    tenantId?: string | null;
    deviceId?: string | null;
    action: string;
    status: string;
    reason?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: any;
  }): Promise<void> {
    try {
      await this.prisma.authAuditLog.create({
        data: {
          userId: entry.userId ?? null,
          tenantId: entry.tenantId ?? null,
          deviceId: entry.deviceId ?? null,
          action: entry.action,
          status: entry.status,
          reason: entry.reason ?? null,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
          ...(entry.metadata ? { metadata: entry.metadata } : {}),
        },
      });
    } catch (e: any) {
      this.logger.warn(`writeAudit(${entry.action}) failed: ${e.message}`);
    }
  }

  /**
   * Vérifie si un appareil est trusted
   */
  async isDeviceTrusted(deviceId: string): Promise<boolean> {
    const device = await this.prisma.userDevice.findUnique({
      where: { id: deviceId },
      select: { isTrusted: true, revokedAt: true },
    });

    if (!device) {
      return false;
    }

    if (device.revokedAt) {
      return false;
    }

    return device.isTrusted;
  }

  /**
   * Marque un appareil comme trusted
   */
  async trustDevice(deviceId: string): Promise<void> {
    await this.prisma.userDevice.update({
      where: { id: deviceId },
      data: {
        isTrusted: true,
        trustedAt: new Date(),
      },
    });
  }

  /**
   * Révoque un appareil — ⭐ 2026-11-27 : DÉCONNEXION RÉELLE.
   *    1. marque l'appareil révoqué (n'apparaît plus dans « connectés ») ;
   *    2. désactive les device_sessions actives ;
   *    3. supprime les SESSIONS WEB (table sessions = refresh tokens) du
   *       même utilisateur sur le même user-agent → la session est coupée
   *       au prochain refresh (l'access token JWT expire de lui-même en
   *       15 min maximum) ;
   *    4. écrit l'entrée d'audit DEVICE_REVOKED.
   */
  async revokeDevice(deviceId: string, userId: string, revokedBy?: { userId?: string; ipAddress?: string; userAgent?: string }) {
    const device = await this.prisma.userDevice.findUnique({
      where: { id: deviceId },
      select: { userId: true, tenantId: true, userAgent: true, deviceName: true, revokedAt: true },
    });

    await this.prisma.userDevice.update({
      where: { id: deviceId },
      data: {
        isTrusted: false,
        revokedAt: new Date(),
      },
    });

    // Invalider toutes les sessions de cet appareil
    await this.prisma.deviceSession.updateMany({
      where: { deviceId, isActive: true },
      data: { isActive: false },
    });

    // ⭐ Couper les sessions web du même navigateur (refresh tokens)
    if (device?.userAgent) {
      try {
        await this.prisma.session.deleteMany({
          where: { userId: device.userId, userAgent: device.userAgent },
        });
      } catch (e: any) {
        this.logger.warn(`revokeDevice: purge sessions web échouée: ${e.message}`);
      }
    }

    await this.writeAudit({
      userId: device?.userId ?? userId,
      tenantId: device?.tenantId ?? null,
      deviceId,
      action: 'DEVICE_REVOKED',
      status: 'SUCCESS',
      reason: `Appareil « ${device?.deviceName || deviceId} » révoqué${revokedBy?.userId && revokedBy.userId !== device?.userId ? ' par un administrateur' : ''}`,
      ipAddress: revokedBy?.ipAddress,
      userAgent: revokedBy?.userAgent,
    });
  }

  /**
   * Liste les appareils d'un utilisateur
   */
  async getUserDevices(userId: string, tenantId: string) {
    return this.prisma.userDevice.findMany({
      where: {
        userId,
        tenantId,
        revokedAt: null,
      },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        deviceName: true,
        deviceType: true,
        isTrusted: true,
        lastUsedAt: true,
        trustedAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * Vérifie si un appareil nécessite une vérification OTP
   */
  async requiresOtpVerification(
    deviceId: string,
    userId: string,
    tenantId: string,
    academicYearId: string
  ): Promise<boolean> {
    const device = await this.prisma.userDevice.findUnique({
      where: { id: deviceId },
      select: { isTrusted: true, revokedAt: true },
    });

    if (!device || device.revokedAt || !device.isTrusted) {
      return true; // Nouvel appareil ou appareil non trusted
    }

    // Vérifier s'il existe une session active pour ce contexte
    const activeSession = await this.prisma.deviceSession.findFirst({
      where: {
        userId,
        tenantId,
        academicYearId,
        deviceId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    });

    if (!activeSession) {
      return true; // Pas de session active pour ce contexte
    }

    return false; // Appareil trusted avec session active
  }

  /**
   * Liste tous les appareils du tenant (admin sync / tableau appareils)
   * Utilisé par GET /sync/devices pour Promoteur / PLATFORM_OWNER
   */
  async getTenantDevices(tenantId: string) {
    return this.prisma.userDevice.findMany({
      where: { tenantId, revokedAt: null },
      orderBy: [{ lastSyncAt: 'desc' }, { lastUsedAt: 'desc' }],
      select: {
        id: true,
        deviceName: true,
        deviceType: true,
        userAgent: true,
        ipAddress: true,
        isTrusted: true,
        lastUsedAt: true,
        lastSyncAt: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }
}
