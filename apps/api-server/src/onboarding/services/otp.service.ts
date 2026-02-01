/**
 * ============================================================================
 * OTP SERVICE - GÉNÉRATION ET VALIDATION OTP POUR ONBOARDING
 * ============================================================================
 * 
 * Service pour générer, envoyer et vérifier les codes OTP
 * pour la validation du numéro de téléphone du promoteur
 * 
 * ============================================================================
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { WhatsAppService } from '../../communication/services/whatsapp.service';
import { SmsService } from '../../communication/services/sms.service';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly OTP_LENGTH = 6;
  private readonly OTP_EXPIRY_MINUTES = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsAppService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * Génère un code OTP (6 chiffres)
   */
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Génère et envoie un code OTP au numéro de téléphone
   */
  async generateAndSendOTP(draftId: string, phone: string) {
    // Vérifier que le draft existe
    const draft = await this.prisma.onboardingDraft.findUnique({
      where: { id: draftId },
    });

    if (!draft) {
      throw new NotFoundException(`Onboarding draft not found: ${draftId}`);
    }

    // Invalider les anciens OTP non vérifiés pour ce draft
    await this.prisma.onboardingOTP.updateMany({
      where: {
        draftId,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      data: {
        verified: true, // Marquer comme utilisé pour éviter la réutilisation
      },
    });

    // Générer le nouveau code OTP
    const code = this.generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

    // Sauvegarder l'OTP dans la base de données
    const otp = await this.prisma.onboardingOTP.create({
      data: {
        draftId,
        phone,
        code,
        expiresAt,
      },
    });

    this.logger.log(`📱 OTP generated for draft ${draftId} - Phone: ${phone} - Code: ${code} - Expires: ${expiresAt.toISOString()}`);

    // Envoyer l'OTP via WhatsApp et SMS
    try {
      // Envoyer via WhatsApp (prioritaire)
      await this.whatsappService.sendWhatsApp({
        to: phone,
        message: `Votre code de vérification Academia Hub est : ${code}\n\nCe code expire dans ${this.OTP_EXPIRY_MINUTES} minutes.\n\nNe partagez jamais ce code avec personne.`,
      });
      this.logger.log(`✅ OTP sent via WhatsApp to ${phone}`);
    } catch (error) {
      this.logger.warn(`⚠️  Failed to send OTP via WhatsApp: ${error.message}`);
      
      // Fallback : envoyer via SMS
      try {
        await this.smsService.sendSMS(
          phone,
          `Votre code de vérification Academia Hub est : ${code}. Expire dans ${this.OTP_EXPIRY_MINUTES} minutes.`
        );
        this.logger.log(`✅ OTP sent via SMS to ${phone}`);
      } catch (smsError) {
        this.logger.error(`❌ Failed to send OTP via SMS: ${smsError.message}`);
        // En développement, on continue même si l'envoi échoue
        if (process.env.NODE_ENV === 'production') {
          throw new BadRequestException('Impossible d\'envoyer le code OTP. Veuillez réessayer.');
        }
      }
    }

    // En développement, retourner le code pour affichage
    const response: any = {
      success: true,
      message: 'Code OTP envoyé avec succès',
      expiresAt: expiresAt.toISOString(),
    };

    if (process.env.NODE_ENV === 'development') {
      response.code = code; // Afficher le code en développement
      this.logger.warn(`🔓 DEV MODE: OTP code displayed - ${code}`);
    }

    return response;
  }

  /**
   * Vérifie un code OTP
   */
  async verifyOTP(draftId: string, phone: string, code: string): Promise<boolean> {
    // Trouver l'OTP valide (non vérifié, non expiré)
    const otp = await this.prisma.onboardingOTP.findFirst({
      where: {
        draftId,
        phone,
        code,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: {
        createdAt: 'desc', // Prendre le plus récent
      },
    });

    if (!otp) {
      this.logger.warn(`❌ Invalid or expired OTP for draft ${draftId} - Phone: ${phone} - Code: ${code}`);
      return false;
    }

    // Marquer l'OTP comme vérifié
    await this.prisma.onboardingOTP.update({
      where: { id: otp.id },
      data: {
        verified: true,
        verifiedAt: new Date(),
      },
    });

    this.logger.log(`✅ OTP verified for draft ${draftId} - Phone: ${phone}`);
    return true;
  }

  /**
   * Vérifie si un OTP valide existe pour un draft
   */
  async hasValidOTP(draftId: string, phone: string): Promise<boolean> {
    const otp = await this.prisma.onboardingOTP.findFirst({
      where: {
        draftId,
        phone,
        verified: true,
        verifiedAt: { not: null },
      },
    });

    return !!otp;
  }
}
