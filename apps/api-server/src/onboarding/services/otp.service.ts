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
import { renderEmail, renderHeader, renderFooter } from '../../hr/recruitment-email-templates';
import type { TenantBranding } from '../../hr/recruitment-email-templates';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly OTP_LENGTH = 6;
  private readonly OTP_EXPIRY_MINUTES = 3;

  // ⭐ Anti brute-force (sans migration DB) : compteur d'échecs par draft en mémoire.
  //    Après MAX_VERIFY_ATTEMPTS échecs → lockout du draft pendant LOCKOUT_MINUTES.
  //    Best-effort multi-instances (chaque instance garde son compteur) ;
  //    complété par le ThrottlerGuard global.
  private readonly MAX_VERIFY_ATTEMPTS = 5;
  private readonly LOCKOUT_MINUTES = 10;
  private verifyAttempts = new Map<string, { count: number; lockedUntil: number }>();

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
   * Génère un code OTP (6 chiffres) — PRNG cryptographique
   * (Math.random n'est PAS sûr pour des codes de vérification).
   */
  private generateOTP(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Génère et envoie un code OTP au numéro de téléphone
   * @param draftId - ID du draft d'onboarding
   * @param phone - Numéro de téléphone (format international)
   * @param method - Méthode d'envoi : 'sms' | 'voice' | 'whatsapp' | 'email'
   * @param promoterEmail - Email du promoteur (pour la méthode email). Si non fourni,
   *   on essaie de le récupérer depuis le draft. Si toujours absent, on utilise
   *   l'email de contact du draft (champ email de l'établissement).
   */
  async generateAndSendOTP(
    draftId: string,
    phone: string,
    method: 'sms' | 'voice' | 'whatsapp' | 'email' = 'sms',
    promoterEmail?: string,
  ) {
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
          // ⭐ Envoi du code OTP par email.
          // Récupérer l'email : priorité au paramètre, puis draft.promoterEmail,
          // puis draft.email (email de contact de l'établissement).
          {
            const emailTo = promoterEmail || draft.promoterEmail || draft.email;
            if (!emailTo) {
              throw new BadRequestException(
                'Aucun email trouvé pour envoyer le code OTP. Veuillez saisir votre email.',
              );
            }
            const emailHtml = this.buildOtpEmailHtml(code, draft.schoolName || 'votre établissement', `${draft.promoterFirstName || ''} ${draft.promoterLastName || ''}`.trim() || undefined, promoterEmail || draft.promoterEmail || draft.email || '');
            await this.emailService.sendEmail({
              to: emailTo,
              subject: `🔐 Votre code de vérification — Academia Helm`,
              html: emailHtml,
              text: `Votre code de vérification Academia Helm est : ${code}. Ce code est valable 3 minutes. Ne le partagez avec personne.`,
              from: process.env.EMAIL_FROM_NOREPLY || 'noreply@academiahelm.com',
              fromName: 'Academia Helm',
            });
            this.logger.log(`✅ OTP sent via Email to ${emailTo}`);
          }
          break;

        case 'sms':
        default: {
          // ⭐ Diagnostic : si SMS_PROVIDER n'est pas 'twilio', on log un avertissement.
          // Si c'est 'mock' en production, c'est probablement un oubli de config Fly.io.
          const smsProvider = process.env.SMS_PROVIDER || 'mock';
          if (smsProvider !== 'twilio') {
            this.logger.warn(
              `⚠️  SMS_PROVIDER=${smsProvider} (pas 'twilio'). Vérifiez la variable SMS_PROVIDER sur Fly.io.`,
            );
          }
          this.logger.log(
            `📱 [SMS] Tentative d'envoi à ${phone} via provider=${smsProvider} — TWILIO_ACCOUNT_SID=${process.env.TWILIO_ACCOUNT_SID ? '✅ set' : '❌ missing'}, TWILIO_PHONE_NUMBER=${process.env.TWILIO_PHONE_NUMBER ? '✅ set' : '❌ missing'}`,
          );
          await this.smsService.sendSMS(phone, smsMessage);
          this.logger.log(`✅ OTP sent via SMS to ${phone}`);
          // Afficher le message en mode développement
          if (process.env.NODE_ENV === 'development') {
            this.logger.log(`\n📱 [DEV MODE] SMS Message to ${phone}:\n${smsMessage}\n`);
          }
          break;
        }
      }
    } catch (error: any) {
      // ⭐ Log détaillé pour diagnostiquer les échecs SMS (Twilio renvoie souvent
      // error.code (ex: 21211, 21614) et error.status (401, 403, 400)).
      this.logger.error(
        `❌ Failed to send OTP via ${method} to ${phone}: ${error.message}`,
        error?.stack,
      );
      if (error?.code || error?.status) {
        this.logger.error(
          `   → Détails: code=${error.code}, status=${error.status}, moreInfo=${error.moreInfo || 'N/A'}`,
        );
      }
      
      // En développement, on continue même si l'envoi échoue
      if (process.env.NODE_ENV === 'production') {
        // ⭐ Pour SMS : message plus explicite si erreur d'authentification Twilio
        let userMessage = `Impossible d'envoyer le code OTP via ${method}. Erreur: ${error.message}.`;
        if (method === 'sms' && (
          error.message?.toLowerCase().includes('auth') ||
          error.status === 401 ||
          error.status === 403
        )) {
          userMessage = `Le service SMS a refusé l'authentification (Twilio). Veuillez réessayer avec la méthode Email, ou contactez le support si le problème persiste.`;
        }
        userMessage += ' Veuillez réessayer avec une autre méthode.';
        throw new BadRequestException(userMessage);
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
    // ⭐ Anti brute-force : vérifier le lockout du draft
    const attemptState = this.verifyAttempts.get(draftId);
    if (attemptState?.lockedUntil && attemptState.lockedUntil > Date.now()) {
      const minutesLeft = Math.ceil((attemptState.lockedUntil - Date.now()) / 60000);
      this.logger.warn(`🔒 OTP verification LOCKED for draft ${draftId} (${minutesLeft} min restantes)`);
      throw new BadRequestException(
        `Trop de tentatives incorrectes. Veuillez réessayer dans ${minutesLeft} minute(s) ou demander un nouveau code.`
      );
    }

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
    let otp = await this.prisma.onboardingOTP.findFirst({
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

    // ⭐ FIX OTP email : si aucun match sur le numéro (ex: OTP envoyé par email
    //    alors que le téléphone promoteur diffère, ou phone='N/A' envoyé par le
    //    wizard), retomber sur une recherche par draftId + code uniquement.
    //    Le code reste le secret principal (6 chiffres, 3 min, lockout).
    if (!otp) {
      otp = await this.prisma.onboardingOTP.findFirst({
        where: {
          draftId,
          code,
          verified: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      if (otp) {
        this.logger.log(`📧 OTP matched by draftId+code only (email flow) for draft ${draftId}`);
      }
    }
    
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

      // ⭐ Anti brute-force : incrémenter le compteur d'échecs du draft
      this.registerFailedAttempt(draftId);

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

    // ⭐ Succès : reset du compteur d'échecs
    this.verifyAttempts.delete(draftId);

    this.logger.log(`✅ OTP verified for draft ${draftId} - Phone: ${otp.phone} (requested: ${phone})`);
    return true;
  }

  /**
   * ⭐ Enregistre un échec de vérification et déclenche le lockout si nécessaire.
   */
  private registerFailedAttempt(draftId: string): void {
    const state = this.verifyAttempts.get(draftId) || { count: 0, lockedUntil: 0 };
    state.count += 1;
    if (state.count >= this.MAX_VERIFY_ATTEMPTS) {
      state.lockedUntil = Date.now() + this.LOCKOUT_MINUTES * 60 * 1000;
      state.count = 0;
      this.logger.warn(`🔒 OTP verification LOCKED for draft ${draftId} pendant ${this.LOCKOUT_MINUTES} min (${this.MAX_VERIFY_ATTEMPTS} échecs)`);
    }
    this.verifyAttempts.set(draftId, state);
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
   * Utilise les mêmes templates que le module RH (renderHeader, renderFooter, renderEmail).
   * Le branding utilise le logo Academia Helm (pas le logo école, car c'est un email système).
   */
  private buildOtpEmailHtml(code: string, schoolName: string, promoterName?: string, promoterEmail?: string): string {
    // Branding Academia Helm (pas le logo école — c'est un email système)
    const branding: TenantBranding = {
      schoolName: 'Academia Helm',
      schoolLogo: 'https://www.academiahelm.com/images/logo-Academia%20Hub.png',
      schoolAddress: 'Parakou, Bénin — Afrique de l\'Ouest',
      schoolPhone: '+229 01 41 36 08 03',
      schoolEmail: 'support@academia-helm.com',
    };

    const greeting = promoterName
      ? `Bonjour ${promoterName},`
      : 'Bonjour,';

    const bodyContent = `
      <div style="font-size:15px;color:#0f172a;line-height:1.6;">
        <p style="margin:0 0 16px;">${greeting}</p>
        <p style="margin:0 0 16px;">
          Vous êtes en train de créer le compte pour <strong style="color:#0D1F6E;">${schoolName}</strong>
          sur Academia Helm. Pour finaliser votre inscription, veuillez utiliser le code de vérification ci-dessous :
        </p>

        <!-- Code OTP -->
        <div style="text-align:center;margin:28px 0;">
          <div style="display:inline-block;background:#0D1F6E;border-radius:12px;padding:22px 52px;">
            <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#ffffff;font-family:'Courier New',monospace;">
              ${code}
            </span>
          </div>
        </div>

        <p style="margin:0 0 20px;text-align:center;font-size:13px;color:#64748b;">
          Ce code est valable pendant <strong style="color:#0D1F6E;">3 minutes</strong>.
        </p>

        <!-- Avertissement sécurité -->
        <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:24px 0;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#92400e;">
            <strong>Sécurité :</strong> Ne partagez jamais ce code avec qui que ce soit.
            L'équipe Academia Helm ne vous demandera jamais votre code par téléphone, email ou WhatsApp.
            Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
          </p>
        </div>

        <p style="margin:0;font-size:13px;color:#475569;">
          Cordialement,<br />
          <strong style="color:#0D1F6E;">L'équipe Academia Helm</strong>
        </p>
      </div>`;

    return renderEmail(branding, bodyContent, 'Vérification de sécurité');
  }
}
