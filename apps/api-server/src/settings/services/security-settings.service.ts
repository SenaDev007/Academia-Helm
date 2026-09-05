import { prismaCreateDefaults, prismaUpdateDefaults } from '../../common/utils/prisma-helpers';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsHistoryService } from './settings-history.service';

/**
 * Service pour la gestion des paramètres de sécurité et conformité
 */
@Injectable()
export class SecuritySettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: SettingsHistoryService,
  ) {}

  /**
   * Récupère les paramètres de sécurité pour un tenant
   */
  async getSecuritySettings(tenantId: string) {
    let settings = await this.prisma.securitySettings.findUnique({
      where: { tenantId },
    });

    // Si aucun paramètre n'existe, créer les paramètres par défaut
    if (!settings) {
      settings = await this.prisma.securitySettings.create({
        data: {
        ...prismaCreateDefaults(),
          tenantId,
          passwordMinLength: 8,
          passwordRequireUppercase: true,
          passwordRequireLowercase: true,
          passwordRequireNumbers: true,
          passwordRequireSpecial: false,
          passwordExpirationDays: null, // Jamais expirer par défaut
          sessionTimeoutMinutes: 30,
          maxLoginAttempts: 5,
          lockoutDurationMinutes: 15,
          twoFactorEnabled: false,
          requireEmailVerification: true,
          auditLogRetentionDays: 365,
          dataRetentionYears: 7,
          gdprCompliant: false,
          allowInspectionAccess: false,
          // ⭐ Nouveaux champs — valeurs par défaut prudentes
          inactivityLockMinutes: 15,
          deviceFingerprintEnabled: true,
          notifyOnNewDevice: true,
        },
      });
    }

    return settings;
  }

  /**
   * Met à jour les paramètres de sécurité
   */
  async updateSecuritySettings(
    tenantId: string,
    data: {
      passwordMinLength?: number;
      passwordRequireUppercase?: boolean;
      passwordRequireLowercase?: boolean;
      passwordRequireNumbers?: boolean;
      passwordRequireSpecial?: boolean;
      passwordExpirationDays?: number | null;
      sessionTimeoutMinutes?: number;
      maxLoginAttempts?: number;
      lockoutDurationMinutes?: number;
      twoFactorEnabled?: boolean;
      requireEmailVerification?: boolean;
      auditLogRetentionDays?: number;
      dataRetentionYears?: number;
      gdprCompliant?: boolean;
      allowInspectionAccess?: boolean;
      // ⭐ Nouveaux champs (session/verrouillage + auth avancée)
      inactivityLockMinutes?: number;
      deviceFingerprintEnabled?: boolean;
      notifyOnNewDevice?: boolean;
    },
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    this.validateNewFields(data);
    const existing = await this.getSecuritySettings(tenantId);

    // Enregistrer l'historique des changements
    const changes: Record<string, { old: any; new: any }> = {};
    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && existing[key] !== data[key]) {
        changes[key] = { old: existing[key], new: data[key] };
      }
    });

    if (Object.keys(changes).length === 0) {
      return existing;
    }

    // Mettre à jour les paramètres
    const updated = await this.prisma.securitySettings.update({
      where: { tenantId },
      data: {
        ...prismaUpdateDefaults(),
        ...data,
        updatedAt: new Date(),
      },
    });

    // Enregistrer l'historique
    await this.historyService.logSettingChange(
      tenantId,
      null,
      'security_settings',
      'security',
      changes,
      userId,
      ipAddress,
      userAgent,
    );

    // Vérifier les alertes ORION pour changements critiques
    await this.checkOrionAlerts(tenantId, changes);

    return updated;
  }

  /**
   * Validation des plages de valeurs des nouveaux champs.
   * Ignore les valeurs undefined/null — ne valide que les champs explicitement fournis.
   */
  private validateNewFields(data: any): void {
    if (data.inactivityLockMinutes !== undefined && data.inactivityLockMinutes !== null) {
      const v = Number(data.inactivityLockMinutes);
      if (isNaN(v) || v < 1 || v > 120) {
        throw new BadRequestException('inactivityLockMinutes doit être entre 1 et 120');
      }
    }
    if (data.passwordMinLength !== undefined && data.passwordMinLength !== null) {
      const v = Number(data.passwordMinLength);
      if (isNaN(v) || v < 6 || v > 20) {
        throw new BadRequestException('passwordMinLength doit être entre 6 et 20');
      }
    }
    if (data.sessionTimeoutMinutes !== undefined && data.sessionTimeoutMinutes !== null) {
      const v = Number(data.sessionTimeoutMinutes);
      if (isNaN(v) || v < 5 || v > 480) {
        throw new BadRequestException('sessionTimeoutMinutes doit être entre 5 et 480');
      }
    }
    if (data.maxLoginAttempts !== undefined && data.maxLoginAttempts !== null) {
      const v = Number(data.maxLoginAttempts);
      if (isNaN(v) || v < 3 || v > 10) {
        throw new BadRequestException('maxLoginAttempts doit être entre 3 et 10');
      }
    }
  }

  /**
   * Vérifie si des changements nécessitent une alerte ORION
   */
  private async checkOrionAlerts(
    tenantId: string,
    changes: Record<string, { old: any; new: any }>,
  ) {
    // Changements critiques qui nécessitent une alerte
    const criticalFields = [
      'gdprCompliant',
      'twoFactorEnabled',
      'allowInspectionAccess',
      'passwordExpirationDays',
      'auditLogRetentionDays',
    ];

    for (const field of criticalFields) {
      if (changes[field]) {
        // TODO: Intégrer avec OrionAlertsService
        // await this.orionAlertsService.createAlert({
        //   tenantId,
        //   alertType: 'SECURITY',
        //   severity: 'CRITICAL',
        //   title: `Paramètre de sécurité modifié: ${field}`,
        //   description: `Le paramètre ${field} a été modifié de ${changes[field].old} à ${changes[field].new}`,
        // });
      }
    }
  }
}

