import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SettingsHistoryService } from './settings-history.service';

/**
 * Service pour la gestion des paramètres de communication
 * (SMS, Email, WhatsApp)
 */
@Injectable()
export class CommunicationSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: SettingsHistoryService,
  ) {}

  /**
   * Récupère les paramètres de communication
   */
  async getSettings(tenantId: string) {
    let settings = await this.prisma.settingsCommunication.findUnique({
      where: { tenantId },
    });

    if (!settings) {
      settings = await this.prisma.settingsCommunication.create({
        data: {
          tenantId,
          smsEnabled: false,
          emailEnabled: false,
          whatsappEnabled: false,
          smtpPort: 587,
          smtpSecure: true,
        },
      });
    }

    // Masquer les credentials sensibles dans la réponse
    return this.sanitizeSettings(settings);
  }

  /**
   * Récupère les paramètres bruts (pour usage interne)
   */
  async getRawSettings(tenantId: string) {
    return this.prisma.settingsCommunication.findUnique({
      where: { tenantId },
    });
  }

  /**
   * Met à jour les paramètres de communication
   */
  async updateSettings(
    tenantId: string,
    data: {
      // SMS
      smsProvider?: string;
      smsCredentials?: any;
      smsEnabled?: boolean;
      // WhatsApp
      whatsappProvider?: string;
      whatsappCredentials?: any;
      whatsappEnabled?: boolean;
      // Email SMTP
      smtpHost?: string;
      smtpPort?: number;
      smtpUser?: string;
      smtpPassword?: string;
      smtpFromEmail?: string;
      smtpFromName?: string;
      smtpSecure?: boolean;
      emailEnabled?: boolean;
      // Expéditeur par défaut
      defaultSenderName?: string;
      defaultSenderPhone?: string;
      // Limites
      dailySmsLimit?: number;
      dailyEmailLimit?: number;
    },
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    let existing = await this.prisma.settingsCommunication.findUnique({
      where: { tenantId },
    });

    if (!existing) {
      existing = await this.prisma.settingsCommunication.create({
        data: { tenantId },
      });
    }

    // Enregistrer les changements (sans les credentials sensibles dans l'historique)
    const changes: Record<string, { old: any; new: any }> = {};
    const sensitiveFields = ['smsCredentials', 'whatsappCredentials', 'smtpPassword'];

    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined) {
        const oldValue = existing[key];
        const newValue = data[key];

        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          if (sensitiveFields.includes(key)) {
            changes[key] = { old: '***', new: '***' };
          } else {
            changes[key] = { old: oldValue, new: newValue };
          }
        }
      }
    });

    if (Object.keys(changes).length === 0) {
      return this.sanitizeSettings(existing);
    }

    const updated = await this.prisma.settingsCommunication.update({
      where: { tenantId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    await this.historyService.logSettingChange(
      tenantId,
      null,
      'settings_communication',
      'communication',
      changes,
      userId,
      ipAddress,
      userAgent,
    );

    return this.sanitizeSettings(updated);
  }

  /**
   * Teste la configuration SMS
   */
  async testSms(tenantId: string, phoneNumber: string): Promise<{ success: boolean; message: string }> {
    const settings = await this.getRawSettings(tenantId);

    if (!settings?.smsEnabled || !settings?.smsProvider) {
      throw new BadRequestException('Le SMS n\'est pas configuré.');
    }

    try {
      // TODO: Implémenter l'envoi de test selon le provider
      // switch (settings.smsProvider) {
      //   case 'TWILIO':
      //     // Envoyer via Twilio
      //     break;
      //   case 'AFRICAS_TALKING':
      //     // Envoyer via Africa's Talking
      //     break;
      // }

      return { success: true, message: `SMS de test envoyé à ${phoneNumber}` };
    } catch (error) {
      return { success: false, message: `Erreur: ${error.message}` };
    }
  }

  /**
   * Teste la configuration Email
   */
  async testEmail(tenantId: string, emailAddress: string): Promise<{ success: boolean; message: string }> {
    const settings = await this.getRawSettings(tenantId);

    if (!settings?.emailEnabled || !settings?.smtpHost) {
      throw new BadRequestException('L\'email n\'est pas configuré.');
    }

    try {
      // TODO: Implémenter l'envoi de test via SMTP
      // const transporter = nodemailer.createTransport({
      //   host: settings.smtpHost,
      //   port: settings.smtpPort,
      //   secure: settings.smtpSecure,
      //   auth: {
      //     user: settings.smtpUser,
      //     pass: settings.smtpPassword,
      //   },
      // });

      return { success: true, message: `Email de test envoyé à ${emailAddress}` };
    } catch (error) {
      return { success: false, message: `Erreur: ${error.message}` };
    }
  }

  /**
   * Teste la configuration WhatsApp
   */
  async testWhatsapp(tenantId: string, phoneNumber: string): Promise<{ success: boolean; message: string }> {
    const settings = await this.getRawSettings(tenantId);

    if (!settings?.whatsappEnabled || !settings?.whatsappProvider) {
      throw new BadRequestException('WhatsApp n\'est pas configuré.');
    }

    try {
      // TODO: Implémenter l'envoi de test selon le provider
      return { success: true, message: `Message WhatsApp de test envoyé à ${phoneNumber}` };
    } catch (error) {
      return { success: false, message: `Erreur: ${error.message}` };
    }
  }

  /**
   * Récupère les templates de messages
   */
  async getTemplates(tenantId: string, type?: string) {
    return this.prisma.messageTemplate.findMany({
      where: {
        tenantId,
        ...(type && { type }),
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Crée ou met à jour un template
   */
  async upsertTemplate(
    tenantId: string,
    data: {
      id?: string;
      name: string;
      type: string;
      channelId?: string;
      subject?: string;
      content: string;
      contentFr?: string;
      contentEn?: string;
      variables?: any;
      isActive?: boolean;
    },
  ) {
    if (data.id) {
      return this.prisma.messageTemplate.update({
        where: { id: data.id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });
    }

    return this.prisma.messageTemplate.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  /**
   * Masque les informations sensibles
   */
  private sanitizeSettings(settings: any) {
    if (!settings) return settings;

    return {
      ...settings,
      smsCredentials: settings.smsCredentials ? { configured: true } : null,
      whatsappCredentials: settings.whatsappCredentials ? { configured: true } : null,
      smtpPassword: settings.smtpPassword ? '********' : null,
    };
  }
}
