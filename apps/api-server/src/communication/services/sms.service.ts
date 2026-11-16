/**
 * ============================================================================
 * SMS SERVICE - ENVOI DE MESSAGES SMS
 * ============================================================================
 * 
 * Service pour l'envoi de messages SMS via différents providers
 * Supporte : Termii, Twilio, Infobip, API Gateway, Mock (développement)
 * 
 * ⭐ nov. 2026 (demande promoteur) — provider TERMII :
 *   https://developers.termii.com — POST {TERMII_BASE_URL}/api/sms/send
 *   Variables d'environnement :
 *     - SMS_PROVIDER=termii
 *     - TERMII_API_KEY   (requis — clé API du dashboard Termii)
 *     - TERMII_BASE_URL  (défaut https://v4.api.termii.com)
 *     - TERMII_SENDER_ID (défaut Academia Helm — sender ID alphanumérique
 *       3-11 caractères enregistré sur le compte Termii)
 *     - TERMII_CHANNEL   (défaut dnd — route transactionnelle recommandée
 *       pour les identifiants ; « generic » = route promotionnelle qui
 *       n'aboutit pas sur les numéros en DND ; activer la route DND sur le
 *       compte Termii auprès de leur support)
 *       ⭐ 16/11/2026 (fix 1.0.8) : si la route configurée est refusée par
 *       Termii (HTTP 422 « Route not configured … route=DND » — workspace
 *       sans route DND active pour le pays, ex. BJ), l'envoi est RÉESSAYÉ UNE
 *       FOIS automatiquement sur la route « generic » pour que le SMS parte
 *       quand même (repli, en attendant l'activation de la route DND).
 *       ⭐ 16/11/2026 nuit (fix 1.0.13, retour promoteur « facturé mais non
 *       reçu ») : la route generic facture à la SOUMISSION (200 « Successfully
 *       Sent », solde déduit) sans garantie de livraison — non délivré sur les
 *       numéros en DND (route promotionnelle) et sur les numéros de l'ANCIEN
 *       plan ARCEP. Migration automatique à l'envoi des numéros béninois
 *       hérités (229 + 8 chiffres, pré-réforme du 30/11/2024) vers le plan
 *       ACTUEL (229 + « 01 » + 8 chiffres) — les opérateurs ne routent plus
 *       l'ancien format depuis le basculement ARCEP.
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

export type SmsProvider = 'termii' | 'twilio' | 'gateway' | 'infobip' | 'mock';

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
   *
   * ⭐ Pour Twilio (Programmable SMS), les numéros béninois DOIVENT être au format
   * E.164 strict sans le préfixe trunk "01" :
   *   - +22995722234 ✅ (8 chiffres après +229)
   *   - +2290195722234 ❌ (10 chiffres — Twilio retourne l'erreur 21211 "Invalid To")
   *
   * ⭐ Termii (nov. 2026) : suit le plan ARCEP Bénin ACTUEL (réforme du
   *   30/11/2024) — format international +229 suivi du préfixe 01 et du
   *   numéro (ex : 0195000299 → +2290195000299 → « 2290195000299 » pour
   *   l'API Termii, sans le « + »). On conserve donc le « 01 ».
   */
  async sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    // Normalisation du numéro — strip « 01 » uniquement pour Twilio (legacy)
    const stripBenin01 = this.provider === 'twilio';
    const normalizedTo = normalizePhoneE164(to, { stripBenin01 });
    this.logger.log(`SMS normalisation: raw="${to}" → normalized="${normalizedTo}" (provider: ${this.provider})`);
    if (!isValidPhoneE164(normalizedTo)) {
      throw new Error(`Numéro SMS invalide: "${to}" → normalisé: "${normalizedTo}". Format attendu: +229XXXXXXXX (E.164)`);
    }

    const request: SmsRequest = { to: normalizedTo, message };
    
    try {
      switch (this.provider) {
        case 'termii':
          return await this.sendViaTermii(request);
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
   * ⭐ nov. 2026 — true si un VRAI provider SMS est pleinement configuré
   * (termii / twilio / infobip avec leurs clés). Exclut mock/gateway :
   * l'UI peut ainsi afficher « SMS — non configuré » au lieu d'un faux ✓.
   */
  isRealProviderConfigured(): boolean {
    switch (this.provider) {
      case 'termii':
        return !!this.configService.get<string>('TERMII_API_KEY');
      case 'twilio':
        return !!(
          this.configService.get<string>('TWILIO_ACCOUNT_SID') &&
          this.configService.get<string>('TWILIO_AUTH_TOKEN') &&
          this.configService.get<string>('TWILIO_PHONE_NUMBER')
        );
      case 'infobip':
        return !!(
          this.configService.get<string>('INFOBIP_API_URL') &&
          this.configService.get<string>('INFOBIP_API_KEY')
        );
      default:
        return false; // mock / gateway : pas une vraie configuration
    }
  }

  /**
   * ⭐ nov. 2026 (demande promoteur) — Envoie via l'API Termii
   * (https://developers.termii.com/messaging-api).
   *
   * POST {TERMII_BASE_URL}/api/sms/send
   * Body : { api_key, to, from, sms, type: 'plain', channel }
   * Réponse 200 : { code: 'ok', balance, message_id, message: 'Successfully Sent' }
   *
   * Le numéro « to » est au format international SANS le « + »
   * (ex : +2290195000299 → 2290195000299).
   *
   * ⭐ 16/11/2026 (fix 1.0.8) — REPLI AUTOMATIQUE : si Termii refuse la route
   * configurée (422 « Route not configured … route=DND » — constaté en prod
   * tant que la route DND du workspace n'est pas activée pour le BJ), on
   * réessaie UNE fois sur la route « generic » au lieu d'un échec sec.
   */
  private async sendViaTermii(request: SmsRequest): Promise<{ success: boolean; messageId?: string }> {
    const apiKey = this.configService.get<string>('TERMII_API_KEY');
    if (!apiKey) {
      throw new Error(
        'Configuration Termii incomplète. Définissez TERMII_API_KEY (clé API du dashboard Termii) — et éventuellement TERMII_BASE_URL, TERMII_SENDER_ID, TERMII_CHANNEL. Route transactionnelle recommandée : TERMII_CHANNEL=dnd.',
      );
    }

    const baseUrl = (
      this.configService.get<string>('TERMII_BASE_URL') || 'https://v4.api.termii.com'
    ).replace(/\/+$/, '');
    const senderId = this.configService.get<string>('TERMII_SENDER_ID') || 'Academia Helm';
    const channel = this.configService.get<string>('TERMII_CHANNEL') || 'dnd';

    try {
      return await this.sendViaTermiiChannel(request, apiKey, baseUrl, senderId, channel);
    } catch (err: any) {
      // ⭐ 16/11/2026 (fix 1.0.8) — route non configurée côté Termii → repli
      //    automatique UNE fois sur la route generic (promotionnelle).
      if (channel !== 'generic' && this.isTermiiRouteError(err)) {
        this.logger.warn(
          `Route Termii « ${channel} » refusée (${String(err?.message || '').substring(0, 200)}) — REPLI automatique sur la route generic`,
        );
        return await this.sendViaTermiiChannel(request, apiKey, baseUrl, senderId, 'generic');
      }
      throw err;
    }
  }

  /**
   * ⭐ 16/11/2026 (fix 1.0.8) — Détecte une erreur Termii de type « route non
   * configurée » (ex. 422 « Route not configured for workspace=… country=BJ
   * channel=SMS route=DND. Contact platform support. »).
   */
  private isTermiiRouteError(err: any): boolean {
    const msg = String(err?.message || '');
    return /route not configured|not configured for workspace|route=dnd|route dnd|dnd route|no active route/i.test(msg)
      || (/http 422/i.test(msg) && /route/i.test(msg));
  }

  /**
   * ⭐ 16/11/2026 nuit (fix 1.0.13) — Numéro béninois au format international
   * SANS « + » pour l'API Termii, en migrant l'ANCIEN plan ARCEP vers le plan
   * ACTUEL.
   *
   * Réforme ARCEP du 30/11/2024 : les numéros béninois passent de 8 à 10
   * chiffres avec l'ajout du préfixe « 01 » (ex : 97 99 99 99 → 01 97 99 99
   * 99, E.164 +22997999999 → +2290197999999). Depuis le basculement, les
   * opérateurs ne routent PLUS l'ancien format : un SMS soumis sur un numéro
   * 8 chiffres est accepté ET FACTURÉ par Termii (« Successfully Sent », solde
   * déduit) mais n'est JAMAIS délivré — exactement le symptôme « facturé mais
   * non reçu » constaté le 16/11/2026.
   *
   * Diagnostic DB au 16/11/2026 : 13 guardians + 2 numéros locaux (tous
   * tenants) encore en ancien format — leurs envois partaient vers des
   * numéros morts. Cette migration à l'envoi les rend livrables sans toucher
   * à la donnée source (recherche DB / connexion parent inchangées).
   */
  private toTermiiDestination(phoneE164: string): string {
    let digits = phoneE164.replace(/^\+/, '');
    // Bénin ancien plan : 229 + 8 chiffres → plan actuel 229 + 01 + 8 chiffres
    if (/^229\d{8}$/.test(digits)) {
      digits = '22901' + digits.substring(3);
    }
    return digits;
  }

  /**
   * Envoi effectif vers l'API Termii sur une route (channel) donnée.
   */
  private async sendViaTermiiChannel(
    request: SmsRequest,
    apiKey: string,
    baseUrl: string,
    senderId: string,
    channel: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    // Format Termii : international sans le « + » — avec migration du plan
    // ARCEP hérité (fix 1.0.13)
    const to = this.toTermiiDestination(request.to);

    const response = await fetch(`${baseUrl}/api/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        to,
        from: senderId,
        sms: request.message,
        type: 'plain',
        channel,
      }),
    });

    const result: any = await response.json().catch(() => ({}));
    if (!response.ok || (result?.code && result.code !== 'ok')) {
      this.logger.error(`Termii API error (channel=${channel}):`, result);
      throw new Error(
        `Termii error HTTP ${response.status}: ${JSON.stringify(result).substring(0, 300)}`,
      );
    }

    const messageId = result?.message_id || result?.message_id_str || `termii-${Date.now()}`;
    this.logger.log(
      `✅ SMS sent via Termii to ${to}: ${messageId} (channel=${channel}, message: ${result?.message}, solde: ${result?.balance})`,
    );

    return {
      success: true,
      messageId,
    };
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
