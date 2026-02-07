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
import { VoiceService } from '../../communication/services/voice.service';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly OTP_LENGTH = 6;
  private readonly OTP_EXPIRY_MINUTES = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsAppService,
    private readonly smsService: SmsService,
    private readonly voiceService: VoiceService,
  ) {}

  /**
   * Génère un code OTP (6 chiffres)
   */
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Génère et envoie un code OTP au numéro de téléphone
   * @param draftId - ID du draft d'onboarding
   * @param phone - Numéro de téléphone (format international)
   * @param method - Méthode d'envoi : 'sms' | 'voice' | 'whatsapp'
   */
  async generateAndSendOTP(draftId: string, phone: string, method: 'sms' | 'voice' | 'whatsapp' = 'sms') {
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

    this.logger.log(`📱 OTP generated for draft ${draftId} - Phone: ${phone} - Code: ${code} - Method: ${method} - Expires: ${expiresAt.toISOString()}`);

    // Messages professionnels pour chaque méthode
    const smsMessage = `Academia Hub - Code de vérification\n\nVotre code de vérification est : ${code}\n\nCe code est valable ${this.OTP_EXPIRY_MINUTES} minutes.\n\nNe partagez jamais ce code avec personne. L'équipe Academia Hub ne vous demandera jamais votre code par téléphone ou email.\n\nSi vous n'avez pas demandé ce code, ignorez ce message.`;

    const whatsappMessage = `🔐 *Academia Hub - Code de vérification*\n\nVotre code de vérification est : *${code}*\n\n⏰ Ce code est valable *${this.OTP_EXPIRY_MINUTES} minutes*.\n\n🔒 *Sécurité* : Ne partagez jamais ce code avec personne. L'équipe Academia Hub ne vous demandera jamais votre code par téléphone ou email.\n\n❓ Si vous n'avez pas demandé ce code, ignorez ce message.\n\nMerci de votre confiance,\nL'équipe Academia Hub`;

    // Envoyer l'OTP selon la méthode choisie
    try {
      switch (method) {
        case 'whatsapp':
          await this.whatsappService.sendWhatsApp({
            to: phone,
            message: whatsappMessage,
          });
          this.logger.log(`✅ OTP sent via WhatsApp to ${phone}`);
          // Afficher le message en mode développement
          if (process.env.NODE_ENV === 'development') {
            this.logger.log(`\n📱 [DEV MODE] WhatsApp Message to ${phone}:\n${whatsappMessage}\n`);
          }
          break;

        case 'voice':
          await this.voiceService.sendVoiceOTP({
            to: phone,
            code,
            language: 'fr-FR',
          });
          this.logger.log(`✅ OTP sent via Voice call to ${phone}`);
          // Afficher le message en mode développement
          if (process.env.NODE_ENV === 'development') {
            const codeDigits = code.split('').join(', ');
            const voiceMessage = `Bonjour. Vous recevez un appel de la part d'Academia Hub. Votre code de vérification est : ${codeDigits}. Je répète : ${codeDigits}. Ce code est valable 3 minutes. Ne partagez jamais ce code avec personne. Merci.`;
            this.logger.log(`\n📞 [DEV MODE] Voice Call Message to ${phone}:\n${voiceMessage}\n`);
          }
          break;

        case 'sms':
        default:
          await this.smsService.sendSMS(phone, smsMessage);
          this.logger.log(`✅ OTP sent via SMS to ${phone}`);
          // Afficher le message en mode développement
          if (process.env.NODE_ENV === 'development') {
            this.logger.log(`\n📱 [DEV MODE] SMS Message to ${phone}:\n${smsMessage}\n`);
          }
          break;
      }
    } catch (error: any) {
      this.logger.error(`❌ Failed to send OTP via ${method} to ${phone}: ${error.message}`);
      
      // En développement, on continue même si l'envoi échoue
      if (process.env.NODE_ENV === 'production') {
        throw new BadRequestException(
          `Impossible d'envoyer le code OTP via ${method}. Veuillez réessayer avec une autre méthode.`
        );
      } else {
        this.logger.warn(`⚠️  DEV MODE: Continuing despite ${method} failure`);
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
    // Normaliser le numéro de téléphone pour la comparaison (enlever les espaces, +, etc.)
    const normalizedPhone = phone.replace(/\s+/g, '').trim();
    
    // Trouver l'OTP valide (non vérifié, non expiré)
    // Chercher avec le numéro exact ET avec des variations possibles
    const otp = await this.prisma.onboardingOTP.findFirst({
      where: {
        draftId,
        OR: [
          { phone: normalizedPhone },
          { phone: phone.trim() },
          { phone: phone.replace(/^\+/, '') }, // Sans le +
          { phone: `+${normalizedPhone}` }, // Avec le +
        ],
        code,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: {
        createdAt: 'desc', // Prendre le plus récent
      },
    });

    if (!otp) {
      // Log détaillé pour le débogage
      const allOtps = await this.prisma.onboardingOTP.findMany({
        where: { draftId, code },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
      
      this.logger.warn(`❌ Invalid or expired OTP for draft ${draftId} - Phone: ${phone} (normalized: ${normalizedPhone}) - Code: ${code}`);
      if (allOtps.length > 0) {
        this.logger.warn(`📋 Found ${allOtps.length} OTP(s) with this code for this draft:`);
        allOtps.forEach((o, idx) => {
          this.logger.warn(`  ${idx + 1}. Phone: ${o.phone}, Verified: ${o.verified}, Expires: ${o.expiresAt.toISOString()}, Created: ${o.createdAt.toISOString()}`);
        });
      }
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

    this.logger.log(`✅ OTP verified for draft ${draftId} - Phone: ${otp.phone} (requested: ${phone})`);
    return true;
  }

  /**
   * Vérifie si un OTP valide existe pour un draft
   */
  async hasValidOTP(draftId: string, phone: string): Promise<boolean> {
    // Normaliser le numéro de téléphone pour la comparaison
    const normalizedPhone = phone.replace(/\s+/g, '').trim();
    
    const otp = await this.prisma.onboardingOTP.findFirst({
      where: {
        draftId,
        OR: [
          { phone: normalizedPhone },
          { phone: phone.trim() },
          { phone: phone.replace(/^\+/, '') }, // Sans le +
          { phone: `+${normalizedPhone}` }, // Avec le +
        ],
        verified: true,
        verifiedAt: { not: null },
      },
      orderBy: {
        verifiedAt: 'desc', // Prendre le plus récent
      },
    });

    return !!otp;
  }
}
