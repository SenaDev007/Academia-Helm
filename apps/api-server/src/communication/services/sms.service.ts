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
   */
  private async sendViaTwilio(request: SmsRequest): Promise<{ success: boolean; messageId?: string }> {
    // TODO: Implémenter l'intégration Twilio
    this.logger.log(`📱 [Twilio] Sending SMS to ${request.to}`);
    this.logger.log(`Message: ${request.message}`);
    
    // Pour l'instant, simuler l'envoi
    return {
      success: true,
      messageId: `twilio-${Date.now()}`,
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
