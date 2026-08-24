/**
 * ============================================================================
 * WHATSAPP WEBHOOK CONTROLLER
 * ============================================================================
 *
 * Webhooks pour les événements WhatsApp Business / Gupshup :
 *   - POST /communication/whatsapp-webhook  → delivery/read/failed events
 *   - GET  /communication/whatsapp-webhook  → verification challenge Meta
 *
 * Sécurité :
 *   - Meta Cloud API : header X-Hub-Signature-256 (HMAC SHA256 avec APP_SECRET)
 *   - Gupshup : header apikey (comparaison simple avec GUPSHUP_API_KEY)
 *
 * Si le secret n'est pas configuré, on log un warn et on accepte (best-effort).
 * TODO: implémenter la vérification cryptographique complète.
 * ============================================================================
 */

import {
  Controller, Get, Post, Body, Headers, Query, Logger, BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators/public.decorator';
import { WhatsAppLogService } from './services/whatsapp-log.service';
import * as crypto from 'crypto';

@Controller('communication')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly whatsappLogService: WhatsAppLogService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * GET /communication/whatsapp-webhook
   *
   * Vérification du challenge Meta (Cloud API).
   * Meta envoie GET avec :
   *   - hub.mode=subscribe
   *   - hub.challenge=<challenge string>
   *   - hub.verify_token=<token configuré dans Meta dashboard>
   *
   * On doit répondre avec le hub.challenge si le verify_token correspond.
   */
  @Public()
  @Get('whatsapp-webhook')
  async verifyWebhook(
    @Query('hub.mode') mode?: string,
    @Query('hub.challenge') challenge?: string,
    @Query('hub.verify_token') verifyToken?: string,
  ) {
    const expectedToken = this.configService.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN');

    if (!expectedToken) {
      this.logger.warn(
        'WHATSAPP_WEBHOOK_VERIFY_TOKEN not configured — cannot verify webhook subscription',
      );
      throw new BadRequestException('Webhook verification token not configured');
    }

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      this.logger.log('✅ WhatsApp webhook subscription verified');
      // Retourner le challenge tel quel (Meta exige la string brute)
      return challenge || '';
    }

    this.logger.warn(
      `❌ WhatsApp webhook verification failed — mode=${mode}, token match=${verifyToken === expectedToken}`,
    );
    throw new BadRequestException('Webhook verification failed');
  }

  /**
   * POST /communication/whatsapp-webhook
   *
   * Reçoit les événements de Meta Cloud API ou Gupshup.
   *
   * Meta Cloud API payload (exemple) :
   *   {
   *     "object": "whatsapp_business_account",
   *     "entry": [{
   *       "id": "...",
   *       "changes": [{
   *         "field": "messages",
   *         "value": {
   *           "messaging_product": "whatsapp",
   *           "statuses": [{
   *             "id": "wamid.HBgL...",      ← providerId
   *             "status": "delivered",       ← sent|delivered|read|failed
   *             "timestamp": "1234567890",
   *             "recipient_id": "229XXXXXXXX",
   *             "errors": [{ "code": ..., "title": "..." }]
   *           }],
   *           "messages": [{ ... }]  ← messages entrants (si parent répond)
   *         }
   *       }]
   *     }]
   *   }
   *
   * Gupshup payload (exemple) :
   *   {
   *     "event": "message-event",
   *     "messageId": "msg-uuid-...",
   *     "eventType": "delivered" | "read" | "failed" | "sent",
   *     "destination": "229XXXXXXXX",
   *     "errors": [{ "code": ..., "title": "..." }]
   *   }
   */
  @Public()
  @Post('whatsapp-webhook')
  async handleWebhook(
    @Body() body: any,
    @Headers('x-hub-signature-256') metaSignature?: string,
    @Headers('apikey') gupshupApiKey?: string,
  ) {
    // 1. Vérification de la signature (best-effort)
    await this.verifySignature(body, metaSignature, gupshupApiKey);

    // 2. Détecter le format (Meta vs Gupshup)
    const isMeta = body?.object === 'whatsapp_business_account';
    const isGupshup = !!body?.event && !!body?.eventType;

    if (isMeta) {
      return this.handleMetaWebhook(body);
    } else if (isGupshup) {
      return this.handleGupshupWebhook(body);
    }

    // Format inconnu — loguer et accepter (pour ne pas casser les retries)
    this.logger.warn(
      `WhatsApp webhook: format inconnu — ${JSON.stringify(body).substring(0, 500)}`,
    );
    return { received: true, ignored: true, reason: 'unknown_format' };
  }

  // ─── META CLOUD API ────────────────────────────────────────────────────

  private async handleMetaWebhook(body: any) {
    const entries = body?.entry || [];
    let processed = 0;

    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const value = change?.value;
        if (!value) continue;

        // Status updates (delivered, read, failed)
        const statuses = value?.statuses || [];
        for (const status of statuses) {
          const providerId = status?.id;
          const statusType = status?.status as 'sent' | 'delivered' | 'read' | 'failed' | undefined;
          const errorMessage = status?.errors?.[0]?.title;

          if (providerId && statusType) {
            try {
              await this.whatsappLogService.updateStatusFromWebhook(
                providerId,
                statusType,
                errorMessage,
              );
              processed++;
            } catch (err: any) {
              this.logger.error(
                `Meta webhook: failed to update status for ${providerId}: ${err.message}`,
              );
            }
          }
        }

        // Messages entrants (si parent répond)
        const messages = value?.messages || [];
        if (messages.length > 0) {
          this.logger.log(
            `📨 WhatsApp inbound message received from ${value?.contacts?.[0]?.wa_id} — not yet processed (TODO)`,
          );
          // TODO: traiter les messages entrants (stocker, notifier le SG, etc.)
        }
      }
    }

    this.logger.log(`Meta webhook processed: ${processed} status updates`);
    return { received: true, processed };
  }

  // ─── GUPSHUP ───────────────────────────────────────────────────────────

  private async handleGupshupWebhook(body: any) {
    const providerId = body?.messageId;
    const eventType = body?.eventType as 'sent' | 'delivered' | 'read' | 'failed' | undefined;
    const errorMessage = body?.errors?.[0]?.title;

    if (!providerId || !eventType) {
      this.logger.warn(
        `Gupshup webhook: missing messageId or eventType — ${JSON.stringify(body).substring(0, 300)}`,
      );
      return { received: true, ignored: true };
    }

    try {
      await this.whatsappLogService.updateStatusFromWebhook(
        providerId,
        eventType,
        errorMessage,
      );
      this.logger.log(`Gupshup webhook processed: ${providerId} → ${eventType}`);
      return { received: true, processed: 1 };
    } catch (err: any) {
      this.logger.error(`Gupshup webhook failed: ${err.message}`);
      throw err;
    }
  }

  // ─── SIGNATURE VERIFICATION ────────────────────────────────────────────

  private async verifySignature(body: any, metaSignature?: string, gupshupApiKey?: string) {
    // Meta Cloud API : X-Hub-Signature-256 (HMAC SHA256)
    if (metaSignature) {
      const appSecret = this.configService.get<string>('WHATSAPP_BUSINESS_APP_SECRET');
      if (appSecret) {
        const expected = 'sha256=' + crypto
          .createHmac('sha256', appSecret)
          .update(JSON.stringify(body), 'utf8')
          .digest('hex');
        if (metaSignature !== expected) {
          this.logger.warn('Meta webhook signature mismatch — accepting anyway (best-effort)');
          // TODO: reject au lieu d'accepter une fois la phase de test passée
        }
      } else {
        this.logger.warn('WHATSAPP_BUSINESS_APP_SECRET not configured — accepting Meta webhook without verification');
      }
      return;
    }

    // Gupshup : header apikey
    if (gupshupApiKey !== undefined) {
      const expectedKey = this.configService.get<string>('GUPSHUP_API_KEY');
      if (expectedKey) {
        if (gupshupApiKey !== expectedKey) {
          this.logger.warn('Gupshup webhook apikey mismatch — accepting anyway (best-effort)');
        }
      } else {
        this.logger.warn('GUPSHUP_API_KEY not configured — accepting Gupshup webhook without verification');
      }
      return;
    }

    this.logger.warn('WhatsApp webhook: no signature/apikey header — accepting (best-effort)');
  }
}
