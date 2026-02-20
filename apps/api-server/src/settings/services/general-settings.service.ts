import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsHistoryService } from './settings-history.service';

/**
 * Service pour la gestion des paramètres généraux de l'école
 * (identité, locale, etc.)
 */
@Injectable()
export class GeneralSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: SettingsHistoryService,
  ) {}

  /**
   * Récupère les paramètres de l'école pour un tenant
   */
  async getSchoolSettings(tenantId: string) {
    let settings = await this.prisma.schoolSettings.findUnique({
      where: { tenantId },
    });

    // Si aucun paramètre n'existe, créer les paramètres par défaut
    if (!settings) {
      settings = await this.prisma.schoolSettings.create({
        data: {
          tenantId,
          schoolName: 'Nom de l\'établissement',
          timezone: 'Africa/Porto-Novo',
          defaultLanguage: 'FR',
          currency: 'XOF',
          currencySymbol: 'FCFA',
          country: 'BJ',
          establishmentType: 'PRIVEE',
        },
      });
    }

    return settings;
  }

  /**
   * Met à jour les paramètres de l'école
   * - Enregistre l'historique
   * - Incrémente la version
   * - Intègre avec ORION pour alertes
   */
  async updateSchoolSettings(
    tenantId: string,
    data: {
      // Identité juridique
      schoolName?: string;
      abbreviation?: string;
      establishmentType?: string;
      authorizationNumber?: string;
      authorizationDate?: Date;
      foundingDate?: Date;
      // Visuels
      logoUrl?: string;
      sealUrl?: string;
      signatureUrl?: string;
      // Localisation
      address?: string;
      city?: string;
      department?: string;
      country?: string;
      postalCode?: string;
      gpsCoordinates?: { lat: number; lng: number };
      // Contacts
      phone?: string;
      secondaryPhone?: string;
      fax?: string;
      email?: string;
      website?: string;
      whatsapp?: string;
      socialMediaLinks?: Record<string, string>;
      // Paramètres régionaux
      timezone?: string;
      defaultLanguage?: string;
      currency?: string;
      currencySymbol?: string;
      // Branding
      slogan?: string;
      primaryColor?: string;
      secondaryColor?: string;
    },
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const existing = await this.getSchoolSettings(tenantId);

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

    // Mettre à jour les paramètres avec incrémentation de version
    const updated = await this.prisma.schoolSettings.update({
      where: { tenantId },
      data: {
        ...data,
        version: existing.version + 1,
        updatedAt: new Date(),
      },
    });

    // Enregistrer l'historique
    await this.historyService.logSettingChange(
      tenantId,
      null,
      'school_settings',
      'identity',
      changes,
      userId,
      ipAddress,
      userAgent,
    );

    // Intégrer avec ORION pour détecter les changements sensibles
    await this.checkOrionAlerts(tenantId, changes);

    return updated;
  }

  /**
   * Récupère l'historique des versions de l'identité
   */
  async getIdentityHistory(tenantId: string, limit = 50) {
    return this.prisma.settingsHistory.findMany({
      where: {
        tenantId,
        category: 'identity',
      },
      orderBy: { changedAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Vérifie si des changements nécessitent une alerte ORION
   */
  private async checkOrionAlerts(
    tenantId: string,
    changes: Record<string, { old: any; new: any }>,
  ) {
    const sensitiveFields = ['defaultLanguage', 'timezone', 'currency', 'establishmentType'];

    for (const field of sensitiveFields) {
      if (changes[field]) {
        // TODO: Intégrer avec OrionAlertsService pour créer une alerte
      }
    }
  }
}

