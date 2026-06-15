import { prismaCreateDefaults, prismaUpdateDefaults } from '../../common/utils/prisma-helpers';
import { Injectable } from '@nestjs/common';
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
    },
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
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

