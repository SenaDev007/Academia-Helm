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
import { EmailService } from '../../communication/services/email.service';

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
    private readonly emailService: EmailService,
  ) {}

  /**
   * Normalise un numéro de téléphone de manière cohérente
   * - Enlève tous les espaces
   * - S'assure qu'il commence par +
   * - Enlève les caractères non numériques sauf le +
   * - Pour le Bénin (+229) : retire le "01" initial si présent (format WhatsApp)
   */
  private normalizePhone(phone: string): string {
    if (!phone) return '';
    // Enlever tous les espaces et caractères non numériques sauf le +
    let normalized = phone.replace(/\s+/g, '').trim();
    // S'assurer qu'il commence par +
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }
    // Enlever tous les caractères non numériques sauf le + au début
    normalized = normalized.replace(/[^\d+]/g, '');
    // S'assurer qu'il y a un seul + au début
    normalized = '+' + normalized.replace(/^\+/, '').replace(/\+/g, '');
    
    // Pour le Bénin (+229) : retirer le "01" initial si présent
    // Format WhatsApp Bénin : +229 + 8 chiffres (sans le "01")
    // Exemple : +2290195722234 → +22995722234
    if (normalized.startsWith('+22901')) {
      normalized = '+229' + normalized.substring(6); // Retirer le "01" après +229
      this.logger.debug(`📱 Numéro béninois normalisé (01 retiré): ${normalized}`);
    }
    
    return normalized;
  }

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
   * @param method - Méthode d'envoi : 'sms' | 'voice' | 'whatsapp' | 'email'
   */
  async generateAndSendOTP(draftId: string, phone: string, method: 'sms' | 'voice' | 'whatsapp' | 'email' = 'sms') {
    // Vérifier que le draft existe
    const draft = await this.prisma.onboardingDraft.findUnique({
      where: { id: draftId },
    });

    if (!draft) {
      throw new NotFoundException(
        `Onboarding draft introuvable ou expiré. Le draft expire après 4 heures d'inactivité. Veuillez recommencer le processus d'inscription depuis le début.`
      );
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

    // Normaliser le numéro de téléphone de manière cohérente
    const normalizedPhone = this.normalizePhone(phone);

    // Générer le nouveau code OTP
    const code = this.generateOTP();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

    // Sauvegarder l'OTP dans la base de données avec le numéro normalisé
    const otp = await this.prisma.onboardingOTP.create({
      data: {
        draftId,
        phone: normalizedPhone, // Stocker le numéro normalisé
        code,
        expiresAt,
      },
    });

    this.logger.log(`📱 OTP generated for draft ${draftId} - Phone: ${phone} - Code: ${code} - Method: ${method} - Expires: ${expiresAt.toISOString()}`);

    // Messages professionnels pour chaque méthode
    const smsMessage = `Academia Helm - Code de vérification\n\nVotre code de vérification est : ${code}\n\nCe code est valable ${this.OTP_EXPIRY_MINUTES} minutes.\n\nNe partagez jamais ce code avec personne. L'équipe Academia Helm ne vous demandera jamais votre code par téléphone ou email.\n\nSi vous n'avez pas demandé ce code, ignorez ce message.`;

    // Message WhatsApp informatif et professionnel
    const whatsappMessage = `*🔐 ACADEMIA HUB - CODE DE VÉRIFICATION*\n\nBonjour,\n\nVous avez demandé un code de vérification pour finaliser votre inscription sur Academia Helm, la plateforme de gestion scolaire complète.\n\n*Votre code de vérification est :*\n*${code}*\n\n*⏰ Validité :* Ce code est valable pendant *${this.OTP_EXPIRY_MINUTES} minutes*. Après ce délai, vous devrez en demander un nouveau.\n\n*🔒 IMPORTANT - SÉCURITÉ :*\n• Ne partagez *jamais* ce code avec qui que ce soit\n• L'équipe Academia Helm ne vous demandera *jamais* votre code par téléphone, email ou WhatsApp\n• Si quelqu'un vous demande ce code, ignorez-le et contactez-nous immédiatement\n• Ce code est strictement personnel et confidentiel\n\n*❓ Vous n'avez pas demandé ce code ?*\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message. Votre compte reste sécurisé.\n\n*📚 À propos d'Academia Helm :*\nAcademia Helm est votre partenaire de confiance pour la gestion complète de votre établissement scolaire. Nous vous accompagnons dans la digitalisation de votre école avec des outils modernes et sécurisés.\n\n*💬 Besoin d'aide ?*\nContactez notre équipe support :\n• Email : support@academia-hub.pro\n• Site web : www.academia-hub.pro\n\nMerci de votre confiance et bienvenue dans la communauté Academia Helm !\n\n*L'équipe Academia Helm*\n_Plateforme de gestion scolaire intelligente_`;

    // Envoyer l'OTP selon la méthode choisie
    try {
      switch (method) {
        case 'whatsapp':
          // Pour WhatsApp au Bénin, retirer le "01" initial du numéro
          // Format WhatsApp Bénin : +229 + 8 chiffres (sans le "01")
          // Exemple : +2290195722234 → +22995722234
          const whatsappPhone = this.normalizePhone(phone);
          
          // Utiliser Content SID avec variables pour un message dynamique
          // Le code OTP est passé dans contentVariables avec la clé "1"
          await this.whatsappService.sendWhatsApp({
            to: whatsappPhone, // Utiliser le numéro normalisé (sans "01" pour le Bénin)
            contentSid: process.env.TWILIO_WHATSAPP_CONTENT_SID || 'HX229f5a04fd0510ce1b071852155d3e75', // Content SID du template
            contentVariables: {
              '1': code, // Le code OTP dans la variable "1"
            },
            message: whatsappMessage, // Fallback si Content SID n'est pas disponible
          });
          this.logger.log(`✅ OTP sent via WhatsApp to ${whatsappPhone} (original: ${phone})`);
          // Afficher le message en mode développement
          if (process.env.NODE_ENV === 'development') {
            this.logger.log(`\n📱 [DEV MODE] WhatsApp Message to ${phone}:\nContent SID: ${process.env.TWILIO_WHATSAPP_CONTENT_SID || 'HX229f5a04fd0510ce1b071852155d3e75'}\nCode OTP: ${code}\nFallback Message: ${whatsappMessage}\n`);
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
            const voiceMessage = `Bonjour. Vous recevez un appel de la part d'Academia Helm. Votre code de vérification est : ${codeDigits}. Je répète : ${codeDigits}. Ce code est valable 3 minutes. Ne partagez jamais ce code avec personne. Merci.`;
            this.logger.log(`\n📞 [DEV MODE] Voice Call Message to ${phone}:\n${voiceMessage}\n`);
          }
          break;

        case 'email':
          // ⭐ Envoi du code OTP par email (fallback si SMS/WhatsApp/Appel échouent).
          // Suit le même pattern que le module RH (staff-credential.service.ts).
          if (!draft.promoterEmail) {
            throw new BadRequestException(
              'Aucun email promoteur trouvé dans le draft. Veuillez d\'abord saisir votre email à l\'étape 2.',
            );
          }
          {
            const emailHtml = this.buildOtpEmailHtml(code, draft.schoolName || 'votre établissement');
            const emailResult = await this.emailService.sendCategorized({
              tenantId: 'onboarding',
              category: 'SYSTEM',
              subCategory: 'otp_verification',
              module: 'onboarding',
              to: draft.promoterEmail,
              toName: `${draft.promoterFirstName || ''} ${draft.promoterLastName || ''}`.trim() || undefined,
              subject: `🔐 Votre code de vérification — Academia Helm`,
              html: emailHtml,
              text: `Votre code de vérification Academia Helm est : ${code}. Ce code est valable 3 minutes. Ne le partagez avec personne.`,
              fromEmail: process.env.EMAIL_FROM_NOREPLY || process.env.SMTP_FROM || 'noreply@academiahelm.com',
              fromName: 'Academia Helm',
              recipientType: 'PROMOTER',
              triggeredBy: 'SYSTEM',
            });
            // ⭐ sendCategorized retourne { success, error } sans lancer d'exception.
            // On doit vérifier le retour manuellement.
            if (!emailResult.success) {
              this.logger.error(`❌ Email OTP failed: ${emailResult.error}`);
              throw new Error(`Email sending failed: ${emailResult.error}`);
            }
            this.logger.log(`✅ OTP sent via Email to ${draft.promoterEmail}`);
            if (process.env.NODE_ENV === 'development') {
              this.logger.log(`\n📧 [DEV MODE] Email OTP to ${draft.promoterEmail}:\nCode: ${code}\n`);
            }
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
      
      // ⭐ Si l'email échoue, ne pas bloquer l'utilisateur — retourner quand même
      // le code OTP dans la réponse (comme en mode dev). L'email est un "nice to have"
      // pour l'OTP, pas un canal critique comme le SMS.
      // En mode production pour SMS/voice, on bloque (le SMS doit marcher).
      if (method === 'email') {
        this.logger.warn(`⚠️  Email OTP failed but continuing — returning code in response`);
      } else if (process.env.NODE_ENV === 'production') {
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

    // ⭐ Si l'email a échoué mais qu'on continue, inclure le code dans la réponse
    // pour que le frontend puisse l'afficher (comme en mode dev).
    if (process.env.NODE_ENV !== 'production' || method === 'email') {
      response.code = code;
      response.note = method === 'email'
        ? 'Email non envoyé (configuration SMTP/Resend manquante). Voici votre code :'
        : 'MODE DÉVELOPPEMENT';
    }

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
    // Normaliser le numéro de téléphone de manière cohérente (même fonction que lors de la génération)
    const normalizedPhone = this.normalizePhone(phone);
    
    // Pour le Bénin, chercher avec les deux formats (avec et sans "01") pour compatibilité avec les anciens OTP
    const isBeninNumber = normalizedPhone.startsWith('+229');
    const phoneVariants = isBeninNumber && normalizedPhone.startsWith('+229') && !normalizedPhone.startsWith('+22901')
      ? [
          normalizedPhone, // Format normalisé sans "01" (+22995722234)
          '+22901' + normalizedPhone.substring(4), // Format avec "01" (+2290195722234) pour compatibilité
        ]
      : [normalizedPhone];
    
    // Trouver l'OTP valide (non vérifié, non expiré) avec le numéro normalisé ou ses variantes
    const otp = await this.prisma.onboardingOTP.findFirst({
      where: {
        draftId,
        phone: { in: phoneVariants }, // Chercher avec le numéro normalisé ou ses variantes
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
    // Normaliser le numéro de téléphone de manière cohérente
    const normalizedPhone = this.normalizePhone(phone);
    
    // Pour le Bénin, chercher avec les deux formats (avec et sans "01") pour compatibilité avec les anciens OTP
    const isBeninNumber = normalizedPhone.startsWith('+229');
    const phoneVariants = isBeninNumber && normalizedPhone.startsWith('+229') && !normalizedPhone.startsWith('+22901')
      ? [
          normalizedPhone, // Format normalisé sans "01" (+22995722234)
          '+22901' + normalizedPhone.substring(4), // Format avec "01" (+2290195722234) pour compatibilité
        ]
      : [normalizedPhone];
    
    const otp = await this.prisma.onboardingOTP.findFirst({
      where: {
        draftId,
        phone: { in: phoneVariants }, // Chercher avec le numéro normalisé ou ses variantes
        verified: true,
        verifiedAt: { not: null },
      },
      orderBy: {
        verifiedAt: 'desc', // Prendre le plus récent
      },
    });

    return !!otp;
  }

  /**
   * ⭐ Construit le HTML de l'email OTP avec en-tête et footer professionnels.
   * Même structure que les emails du module RH (contrats, recrutement).
   */
  private buildOtpEmailHtml(code: string, schoolName: string): string {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Code de vérification — Academia Helm</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5;color:#1a1a1a;">

  <!-- EN-TÊTE -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0D1F6E 0%,#1E40AF 100%);padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:0 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="display:inline-block;background:#fff;border-radius:8px;padding:8px 14px;font-size:18px;font-weight:700;color:#0D1F6E;letter-spacing:0.5px;">
                      🎓 Academia Helm
                    </div>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="color:#fff;font-size:12px;opacity:0.8;">Plateforme de gestion scolaire</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- CORPS -->
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);overflow:hidden;">

          <!-- Bandeau supérieur -->
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;border-bottom:1px solid #e2e8f0;">
              <p style="margin:0;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Vérification de sécurité</p>
            </td>
          </tr>

          <!-- Contenu -->
          <tr>
            <td style="padding:32px;">

              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0D1F6E;">🔐 Votre code de vérification</h1>

              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">
                Bonjour,
              </p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#475569;">
                Vous êtes en train de créer le compte pour <strong style="color:#0D1F6E;">${schoolName}</strong> sur Academia Helm.
                Pour finaliser votre inscription, veuillez utiliser le code de vérification ci-dessous :
              </p>

              <!-- Code OTP -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <div style="display:inline-block;background:#0D1F6E;border-radius:12px;padding:20px 48px;">
                      <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#fff;font-family:'Courier New',monospace;">
                        ${code}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;font-size:13px;color:#64748b;text-align:center;">
                ⏰ Ce code est valable pendant <strong>3 minutes</strong>.
              </p>

              <!-- Sécurité -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px;">
                    <p style="margin:0;font-size:12px;line-height:1.5;color:#92400e;">
                      <strong>🔒 Sécurité :</strong> Ne partagez jamais ce code avec qui que ce soit.
                      L'équipe Academia Helm ne vous demandera jamais votre code par téléphone, email ou WhatsApp.
                      Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;line-height:1.6;color:#475569;">
                Cordialement,<br>
                <strong style="color:#0D1F6E;">L'équipe Academia Helm</strong>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- FOOTER -->
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:0 0 32px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="padding:0 24px;">
              <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">
                Academia Helm — Plateforme de gestion scolaire intelligente
              </p>
              <p style="margin:0;font-size:11px;color:#cbd5e1;">
                📧 support@academia-helm.com · 🌐 www.academia-helm.com
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#cbd5e1;">
                © ${new Date().getFullYear()} Academia Helm. Tous droits réservés.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
  }
}
