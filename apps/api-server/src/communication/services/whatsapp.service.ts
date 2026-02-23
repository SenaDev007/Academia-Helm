/**
 * ============================================================================
 * WHATSAPP SERVICE - ENVOI DE MESSAGES WHATSAPP
 * ============================================================================
 * 
 * Service pour l'envoi de messages WhatsApp via différents providers
 * Supporte : WhatsApp Business API, Twilio WhatsApp, API Gateway
 * 
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';

export interface WhatsAppRequest {
  to: string; // Numéro au format international (ex: +22961234567)
  message?: string; // Message texte (pour WhatsApp Business ou fallback)
  template?: string; // Nom du template (pour WhatsApp Business)
  variables?: Record<string, string>; // Variables pour le template
  contentSid?: string; // Content SID pour Twilio WhatsApp (template dynamique)
  contentVariables?: Record<string, string>; // Variables pour le Content SID Twilio
}

export type WhatsAppProvider = 'whatsapp-business' | 'twilio-whatsapp' | 'gateway' | 'mock';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly provider: WhatsAppProvider;

  constructor(private readonly configService: ConfigService) {
    this.provider = (this.configService.get<string>('WHATSAPP_PROVIDER', 'mock') as WhatsAppProvider) || 'mock';
  }

  /**
   * Envoie un message WhatsApp
   */
  async sendWhatsApp(request: WhatsAppRequest): Promise<{ success: boolean; messageId?: string }> {
    try {
      switch (this.provider) {
        case 'whatsapp-business':
          return await this.sendViaWhatsAppBusiness(request);
        case 'twilio-whatsapp':
          return await this.sendViaTwilioWhatsApp(request);
        case 'gateway':
          return await this.sendViaGateway(request);
        case 'mock':
        default:
          return await this.sendMock(request);
      }
    } catch (error: any) {
      this.logger.error(`Failed to send WhatsApp via ${this.provider}:`, error);
      throw new Error(`Échec d'envoi WhatsApp: ${error.message}`);
    }
  }

  /**
   * Envoie un message via WhatsApp Business API
   */
  private async sendViaWhatsAppBusiness(request: WhatsAppRequest): Promise<{ success: boolean; messageId?: string }> {
    const apiUrl = this.configService.get<string>('WHATSAPP_BUSINESS_API_URL') || 'https://graph.facebook.com/v18.0';
    const accessToken = this.configService.get<string>('WHATSAPP_BUSINESS_ACCESS_TOKEN');
    const phoneNumberId = this.configService.get<string>('WHATSAPP_BUSINESS_PHONE_NUMBER_ID');

    if (!accessToken || !phoneNumberId) {
      throw new Error('WhatsApp Business API configuration incomplete. Check WHATSAPP_BUSINESS_ACCESS_TOKEN and WHATSAPP_BUSINESS_PHONE_NUMBER_ID');
    }

    // Si un template est fourni, utiliser l'API de template
    if (request.template) {
      const response = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: request.to,
          type: 'template',
          template: {
            name: request.template,
            language: { code: 'fr' },
            components: request.variables ? [
              {
                type: 'body',
                parameters: Object.entries(request.variables).map(([key, value]) => ({
                  type: 'text',
                  text: value,
                })),
              },
            ] : [],
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`WhatsApp Business API error: ${JSON.stringify(error)}`);
      }

      const result = await response.json();
      this.logger.log(`WhatsApp sent via Business API to ${request.to}: ${result.messages?.[0]?.id}`);

      return {
        success: true,
        messageId: result.messages?.[0]?.id,
      };
    }

    // Message texte simple
    const response = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: request.to,
        type: 'text',
        text: {
          body: request.message,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp Business API error: ${JSON.stringify(error)}`);
    }

    const result = await response.json();
    this.logger.log(`WhatsApp sent via Business API to ${request.to}: ${result.messages?.[0]?.id}`);

    return {
      success: true,
      messageId: result.messages?.[0]?.id,
    };
  }

  /**
   * Envoie un message via Twilio WhatsApp
   * Supporte deux méthodes :
   * 1. Content SID avec variables (recommandé pour templates dynamiques)
   * 2. Message texte simple (fallback)
   */
  private async sendViaTwilioWhatsApp(request: WhatsAppRequest): Promise<{ success: boolean; messageId?: string }> {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const fromNumber = this.configService.get<string>('TWILIO_WHATSAPP_NUMBER') || 'whatsapp:+14155238886';
    const defaultContentSid = this.configService.get<string>('TWILIO_WHATSAPP_CONTENT_SID');

    if (!accountSid || !authToken) {
      throw new Error('Twilio configuration incomplete. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
    }

    if (!fromNumber) {
      throw new Error('TWILIO_WHATSAPP_NUMBER is required for WhatsApp messages');
    }

    // Client Twilio
    const client = twilio(accountSid, authToken);

    try {
      // Priorité 1 : Utiliser Content SID avec variables (template dynamique)
      // Utilisé uniquement si contentSid ET contentVariables sont explicitement fournis
      if (request.contentSid && request.contentVariables) {
        // Convertir les variables en JSON string comme requis par Twilio
        const contentVariables = JSON.stringify(request.contentVariables);
        
        const result = await client.messages.create({
          from: fromNumber,
          to: `whatsapp:${request.to}`,
          contentSid: request.contentSid,
          contentVariables: contentVariables,
        });

        this.logger.log(`✅ WhatsApp sent via Twilio (Content SID) to ${request.to}: ${result.sid}`);
        this.logger.debug(`💬 Twilio Message SID: ${result.sid}, Status: ${result.status}, Content SID: ${request.contentSid}, Variables: ${contentVariables}`);

        return {
          success: true,
          messageId: result.sid,
        };
      }

      // Priorité 2 : Utiliser Content SID par défaut si configuré ET contentVariables fourni
      // (pour compatibilité avec l'envoi OTP qui utilise defaultContentSid)
      if (defaultContentSid && request.contentVariables) {
        const contentVariables = JSON.stringify(request.contentVariables);
        
        const result = await client.messages.create({
          from: fromNumber,
          to: `whatsapp:${request.to}`,
          contentSid: defaultContentSid,
          contentVariables: contentVariables,
        });

        this.logger.log(`✅ WhatsApp sent via Twilio (Content SID default) to ${request.to}: ${result.sid}`);
        this.logger.debug(`💬 Twilio Message SID: ${result.sid}, Status: ${result.status}, Content SID: ${defaultContentSid}, Variables: ${contentVariables}`);

        return {
          success: true,
          messageId: result.sid,
        };
      }

      // Priorité 3 : Message texte simple (pour conversations initiées par l'utilisateur)
      if (!request.message) {
        throw new Error('Either contentSid with contentVariables or message is required for WhatsApp');
      }

      const result = await client.messages.create({
        body: request.message,
        from: fromNumber,
        to: `whatsapp:${request.to}`,
      });

      this.logger.log(`✅ WhatsApp sent via Twilio (text) to ${request.to}: ${result.sid}`);
      this.logger.debug(`💬 Twilio Message SID: ${result.sid}, Status: ${result.status}, Body: ${request.message.substring(0, 50)}...`);

      return {
        success: true,
        messageId: result.sid,
      };
    } catch (error: any) {
      this.logger.error(`❌ Failed to send WhatsApp via Twilio to ${request.to}:`, error);
      
      // Gestion des erreurs spécifiques Twilio
      if (error.code === 21211) {
        throw new Error('Numéro de téléphone invalide. Vérifiez le format (ex: +22961234567)');
      } else if (error.code === 21614) {
        throw new Error('Numéro WhatsApp Twilio invalide. Vérifiez TWILIO_WHATSAPP_NUMBER');
      } else if (error.code === 20003) {
        throw new Error('Identifiants Twilio invalides. Vérifiez TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN');
      }
      
      throw new Error(`Erreur Twilio WhatsApp: ${error.message || 'Échec d\'envoi WhatsApp'}`);
    }
  }

  /**
   * Envoie un message via Gateway générique
   */
  private async sendViaGateway(request: WhatsAppRequest): Promise<{ success: boolean; messageId?: string }> {
    const gatewayUrl = this.configService.get<string>('WHATSAPP_GATEWAY_URL');
    const apiKey = this.configService.get<string>('WHATSAPP_GATEWAY_API_KEY');

    if (!gatewayUrl || !apiKey) {
      throw new Error('WhatsApp Gateway configuration incomplete. Check WHATSAPP_GATEWAY_URL and WHATSAPP_GATEWAY_API_KEY');
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
        template: request.template,
        variables: request.variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`WhatsApp Gateway returned ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    this.logger.log(`WhatsApp sent via Gateway to ${request.to}: ${result.messageId || 'unknown'}`);

    return {
      success: true,
      messageId: result.messageId || result.id,
    };
  }

  /**
   * Mode mock (développement)
   */
  private async sendMock(request: WhatsAppRequest): Promise<{ success: boolean; messageId?: string }> {
    this.logger.log(`[MOCK WHATSAPP] To: ${request.to}`);
    this.logger.log(`[MOCK WHATSAPP] Message: ${request.message}`);
    this.logger.warn('⚠️  WhatsApp service is in MOCK mode. No messages will be sent. Configure WHATSAPP_PROVIDER for production.');

    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      messageId: `mock-whatsapp-${Date.now()}`,
    };
  }

  /**
   * Formate un message de rappel de facturation
   */
  formatBillingReminderMessage(data: {
    schoolName: string;
    planName: string;
    daysRemaining: number;
    status: string;
    renewalUrl: string;
  }): string {
    const statusText = data.status === 'TRIAL_ACTIVE' ? 'période d\'essai' : 'abonnement';

    return `🔔 *Rappel Academia Helm*

Bonjour,

Votre ${statusText} pour *${data.schoolName}* expire dans *${data.daysRemaining} jour${data.daysRemaining > 1 ? 's' : ''}*.

📋 Plan actuel : ${data.planName}

Pour continuer à bénéficier de tous les services Academia Helm, renouvelez votre abonnement :

${data.renewalUrl}

Cordialement,
L'équipe Academia Helm`.trim();
  }
}
