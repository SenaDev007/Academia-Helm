/**
 * ============================================================================
 * SMS SERVICE - ENVOI DE MESSAGES SMS
 * ============================================================================
 * 
 * Service pour l'envoi de messages SMS via différents providers
 * Supporte : Twilio, API Gateway, Mock (développement)
 * 
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';

export interface SmsRequest {
  to: string; // Numéro au format international (ex: +22961234567)
  message: string;
}

export type SmsProvider = 'twilio' | 'gateway' | 'mock';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: SmsProvider;

  constructor(private readonly configService: ConfigService) {
    this.provider = (this.configService.get<string>('SMS_PROVIDER', 'mock') as SmsProvider) || 'mock';
  }

  /**
   * Envoie un SMS
   */
  async sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    const request: SmsRequest = { to, message };
    
    try {
      switch (this.provider) {
        case 'twilio':
          return await this.sendViaTwilio(request);
        case 'gateway':
          return await this.sendViaGateway(request);
        case 'mock':
        default:
          return await this.sendMock(request);
      }
    } catch (error: any) {
      this.logger.error(`Failed to send SMS via ${this.provider}:`, error);
      throw error;
    }
  }

  /**
   * Envoie via Twilio
   * Supporte deux méthodes :
   * 1. MessagingServiceSid (recommandé) : Utilise un service de messagerie Twilio
   * 2. From : Utilise directement un numéro de téléphone
   */
  private async sendViaTwilio(request: SmsRequest): Promise<{ success: boolean; messageId?: string }> {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const messagingServiceSid = this.configService.get<string>('TWILIO_MESSAGING_SERVICE_SID');
    const fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken) {
      throw new Error(
        'Configuration Twilio incomplète. Vérifiez TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN'
      );
    }

    // Vérifier qu'au moins une méthode d'envoi est configurée
    if (!messagingServiceSid && !fromNumber) {
      throw new Error(
        'Configuration Twilio incomplète. Configurez soit TWILIO_MESSAGING_SERVICE_SID (recommandé) soit TWILIO_PHONE_NUMBER'
      );
    }

    // Client Twilio
    const client = twilio(accountSid, authToken);

    try {
      // Préparer les paramètres selon la méthode disponible
      const messageParams: any = {
        body: request.message,
        to: request.to,
      };

      // Priorité : MessagingServiceSid (recommandé par Twilio)
      if (messagingServiceSid) {
        messageParams.messagingServiceSid = messagingServiceSid;
        this.logger.debug(`📱 Using MessagingServiceSid: ${messagingServiceSid}`);
      } else {
        // Fallback : utiliser le numéro direct
        messageParams.from = fromNumber;
        this.logger.debug(`📱 Using From number: ${fromNumber}`);
      }

      const result = await client.messages.create(messageParams);

      this.logger.log(`✅ SMS sent via Twilio to ${request.to}: ${result.sid}`);
      this.logger.debug(`📱 Twilio Message SID: ${result.sid}, Status: ${result.status}, Account SID: ${result.accountSid}`);

      return {
        success: true,
        messageId: result.sid,
      };
    } catch (error: any) {
      this.logger.error(`❌ Failed to send SMS via Twilio to ${request.to}:`, error);
      
      // Gestion des erreurs spécifiques Twilio
      if (error.code === 21211) {
        throw new Error('Numéro de téléphone invalide. Vérifiez le format (ex: +22961234567)');
      } else if (error.code === 21614) {
        throw new Error('Numéro Twilio invalide. Vérifiez TWILIO_PHONE_NUMBER ou TWILIO_MESSAGING_SERVICE_SID');
      } else if (error.code === 20003) {
        throw new Error('Identifiants Twilio invalides. Vérifiez TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN');
      } else if (error.code === 21608) {
        throw new Error('MessagingServiceSid invalide. Vérifiez TWILIO_MESSAGING_SERVICE_SID');
      }
      
      throw new Error(`Erreur Twilio: ${error.message || 'Échec d\'envoi SMS'}`);
    }
  }

  /**
   * Envoie via API Gateway
   */
  private async sendViaGateway(request: SmsRequest): Promise<{ success: boolean; messageId?: string }> {
    // TODO: Implémenter l'intégration API Gateway
    this.logger.log(`📱 [Gateway] Sending SMS to ${request.to}`);
    this.logger.log(`Message: ${request.message}`);
    
    return {
      success: true,
      messageId: `gateway-${Date.now()}`,
    };
  }

  /**
   * Mock pour le développement
   */
  private async sendMock(request: SmsRequest): Promise<{ success: boolean; messageId?: string }> {
    this.logger.log(`📱 [MOCK] SMS to ${request.to}`);
    this.logger.log(`Message: ${request.message}`);
    
    return {
      success: true,
      messageId: `mock-${Date.now()}`,
    };
  }
}
