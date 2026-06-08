/**
 * ============================================================================
 * VOICE SERVICE - ENVOI D'APPELS VOCAUX VIA TWILIO
 * ============================================================================
 * 
 * Service pour l'envoi d'appels vocaux OTP via Twilio
 * 
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';

export interface VoiceRequest {
  to: string; // Numéro au format international (ex: +22961234567)
  code: string; // Code OTP à dicter
  language?: string; // Langue pour la synthèse vocale (fr, en)
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Envoie un appel vocal avec le code OTP
   */
  async sendVoiceOTP(request: VoiceRequest): Promise<{ success: boolean; callId?: string }> {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');
    const baseUrl = this.configService.get<string>('API_URL') || 'http://localhost:3000';

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error(
        'Configuration Twilio incomplète. Vérifiez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER'
      );
    }

    // Client Twilio
    const client = twilio(accountSid, authToken);

    try {
      // Créer le message TwiML professionnel pour dicter le code
      // Format: chaque chiffre est dicté séparément (ex: "1, 2, 3, 4, 5, 6")
      const codeDigits = request.code.split('').join(', ');
      const language = request.language || 'fr-FR';
      
      // Message professionnel en français
      const message = language.startsWith('fr') 
        ? `Bonjour. Vous recevez un appel de la part d'Academia Helm. Votre code de vérification est : ${codeDigits}. Je répète : ${codeDigits}. Ce code est valable 3 minutes. Ne partagez jamais ce code avec personne. Merci.`
        : `Hello. You are receiving a call from Academia Helm. Your verification code is : ${codeDigits}. I repeat : ${codeDigits}. This code is valid for 3 minutes. Never share this code with anyone. Thank you.`;

      // Créer l'appel
      const call = await client.calls.create({
        to: request.to,
        from: fromNumber,
        twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice" language="${language}">${message}</Say>
    <Pause length="2"/>
    <Say voice="alice" language="${language}">${message}</Say>
</Response>`,
      });

      this.logger.log(`✅ Voice call initiated via Twilio to ${request.to}: ${call.sid}`);
      this.logger.debug(`📞 Twilio Call SID: ${call.sid}, Status: ${call.status}`);

      return {
        success: true,
        callId: call.sid,
      };
    } catch (error: any) {
      this.logger.error(`❌ Failed to send voice call via Twilio to ${request.to}:`, error);
      
      // Gestion des erreurs spécifiques Twilio
      if (error.code === 21211) {
        throw new Error('Numéro de téléphone invalide. Vérifiez le format (ex: +22961234567)');
      } else if (error.code === 21614) {
        throw new Error('Numéro Twilio invalide. Vérifiez TWILIO_PHONE_NUMBER');
      } else if (error.code === 20003) {
        throw new Error('Identifiants Twilio invalides. Vérifiez TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN');
      }
      
      throw new Error(`Erreur Twilio: ${error.message || 'Échec d\'envoi d\'appel vocal'}`);
    }
  }
}
