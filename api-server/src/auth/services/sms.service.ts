/**
 * SMS Service
 * 
 * Service pour l'envoi de SMS
 * Supporte : Twilio, SMS Gateway générique
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';

export interface SmsRequest {
  to: string; // Numéro au format international (ex: +22961234567)
  message: string;
}

export type SmsProvider = 'twilio' | 'sms-gateway' | 'mock';

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
  async sendSms(request: SmsRequest): Promise<{ success: boolean; messageId?: string }> {
    try {
      switch (this.provider) {
        case 'twilio':
          return await this.sendViaTwilio(request);
        case 'sms-gateway':
          return await this.sendViaGateway(request);
        case 'mock':
        default:
          return await this.sendMock(request);
      }
    } catch (error: any) {
      this.logger.error(`Failed to send SMS via ${this.provider}:`, error);
      throw new Error(`Échec d'envoi SMS: ${error.message}`);
    }
  }

  /**
   * Envoie un SMS via Twilio
   */
  private async sendViaTwilio(request: SmsRequest): Promise<{ success: boolean; messageId?: string }> {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Configuration Twilio incomplète. Vérifiez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER');
    }

    // Client Twilio
    const client = twilio(accountSid, authToken);

    const result = await client.messages.create({
      body: request.message,
      from: fromNumber,
      to: request.to,
    });

    this.logger.log(`SMS sent via Twilio to ${request.to}: ${result.sid}`);

    return {
      success: true,
      messageId: result.sid,
    };
  }

  /**
   * Envoie un SMS via SMS Gateway générique
   */
  private async sendViaGateway(request: SmsRequest): Promise<{ success: boolean; messageId?: string }> {
    const gatewayUrl = this.configService.get<string>('SMS_GATEWAY_URL');
    const apiKey = this.configService.get<string>('SMS_GATEWAY_API_KEY');

    if (!gatewayUrl || !apiKey) {
      throw new Error('Configuration SMS Gateway incomplète. Vérifiez SMS_GATEWAY_URL et SMS_GATEWAY_API_KEY');
    }

    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to: request.to,
        message: request.message,
      }),
    });

    if (!response.ok) {
      throw new Error(`SMS Gateway returned ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();

    this.logger.log(`SMS sent via Gateway to ${request.to}: ${result.messageId || 'unknown'}`);

    return {
      success: true,
      messageId: result.messageId || result.id,
    };
  }

  /**
   * Mode mock (développement)
   */
  private async sendMock(request: SmsRequest): Promise<{ success: boolean; messageId?: string }> {
    // En développement, logger le message au lieu de l'envoyer
    this.logger.log(`[MOCK SMS] To: ${request.to}`);
    this.logger.log(`[MOCK SMS] Message: ${request.message}`);
    this.logger.warn('⚠️  SMS service is in MOCK mode. No SMS will be sent. Configure SMS_PROVIDER for production.');

    // Simuler un délai d'envoi
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      messageId: `mock-${Date.now()}`,
    };
  }

  /**
   * Formate le message OTP
   */
  formatOtpMessage(code: string, purpose: 'LOGIN' | 'DEVICE_VERIFICATION' | 'SENSITIVE_ACTION'): string {
    const messages: Record<string, string> = {
      LOGIN: `Votre code de connexion Academia Hub est: ${code}. Valable 5 minutes. Ne partagez pas ce code.`,
      DEVICE_VERIFICATION: `Code de vérification d'appareil: ${code}. Valable 5 minutes. Ne partagez pas ce code.`,
      SENSITIVE_ACTION: `Code de confirmation: ${code}. Valable 5 minutes. Ne partagez pas ce code.`,
    };

    return messages[purpose] || `Votre code de vérification est: ${code}. Valable 5 minutes.`;
  }
}
