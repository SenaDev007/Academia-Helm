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
import { normalizePhoneE164, isValidPhoneE164 } from '../../common/utils/phone';

export interface SmsRequest {
  to: string; // Numéro au format international (ex: +22961234567)
  message: string;
}

export type SmsProvider = 'twilio' | 'gateway' | 'infobip' | 'mock';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: SmsProvider;

  constructor(private readonly configService: ConfigService) {
    this.provider = (this.configService.get<string>('SMS_PROVIDER', 'mock') as SmsProvider) || 'mock';
    this.logger.log(`📱 SmsService initialisé (provider: ${this.provider})`);
  }

  /**
   * Envoie un SMS — normalise le numéro avant l'envoi
   */
  async sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    // Normalisation du numéro (ex: 0195722234 → +22995722234)
    const normalizedTo = normalizePhoneE164(to);
    this.logger.log(`SMS normalisation: raw="${to}" → normalized="${normalizedTo}"`);
    if (!isValidPhoneE164(normalizedTo)) {
      throw new Error(`Numéro SMS invalide: "${to}" → normalisé: "${normalizedTo}". Format attendu: +229XXXXXXXX (E.164)`);
    }

    const request: SmsRequest = { to: normalizedTo, message };
    
    try {
      switch (this.provider) {
        case 'twilio':
          return await this.sendViaTwilio(request);
        case 'gateway':
          return await this.sendViaGateway(request);
        case 'infobip':
          return await this.sendViaInfobip(request);
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
   * Envoie via Twilio — même pattern que auth/services/sms.service.ts (OTP)
   * Utilise TWILIO_PHONE_NUMBER directement comme 'from' (simplicité + fiabilité)
   */
  private async sendViaTwilio(request: SmsRequest): Promise<{ success: boolean; messageId?: string }> {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error(
        'Configuration Twilio incomplète. Vérifiez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER'
      );
    }

    // Client Twilio — même pattern que auth/services/sms.service.ts (OTP)
    const client = twilio(accountSid, authToken);

    const result = await client.messages.create({
      body: request.message,
      from: fromNumber,
      to: request.to,
    });

    this.logger.log(`✅ SMS sent via Twilio to ${request.to}: ${result.sid}`);

    return {
      success: true,
      messageId: result.sid,
    };
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
   * Envoie via Infobip
   */
  private async sendViaInfobip(request: SmsRequest): Promise<{ success: boolean; messageId?: string }> {
    const apiUrl = this.configService.get<string>('INFOBIP_API_URL');
    const apiKey = this.configService.get<string>('INFOBIP_API_KEY');
    const senderId = this.configService.get<string>('INFOBIP_SENDER_ID') || 'Academia';

    if (!apiUrl || !apiKey) {
      throw new Error('Configuration Infobip incomplète. Vérifiez INFOBIP_API_URL et INFOBIP_API_KEY');
    }

    const response = await fetch(`${apiUrl}/sms/2/text/advanced`, {
      method: 'POST',
      headers: {
        Authorization: `App ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            from: senderId,
            destinations: [{ to: request.to }],
            text: request.message,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      this.logger.error('Infobip API error:', errorData);
      throw new Error(`Infobip error HTTP ${response.status}: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    const messageId = result.messages?.[0]?.messageId || `infobip-${Date.now()}`;
    this.logger.log(`✅ SMS sent via Infobip to ${request.to}: ${messageId}`);

    return {
      success: true,
      messageId: messageId,
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
