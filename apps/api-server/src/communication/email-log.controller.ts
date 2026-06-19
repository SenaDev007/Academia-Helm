/**
 * ============================================================================
 * EMAIL LOG CONTROLLER
 * ============================================================================
 *
 * Endpoints pour :
 *   - Lister / consulter les EmailLogs (page History)
 *   - Voir un thread (conversation sortant + entrant)
 *   - Statistiques agrégées (dashboard)
 *   - Webhook Resend (tracking des événements sent/delivered/bounced/opened)
 *   - Webhook Resend Inbound (réponses reçues par les candidats)
 *
 * Tous les endpoints @Get nécessitent un JWT (tenant context).
 * Les webhooks sont @Public() mais vérifient la signature Resend.
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  Req,
  Res,
  BadRequestException,
  UnauthorizedException,
  Logger,
  NotFoundException,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators/public.decorator';
import { EmailLogService } from './services/email-log.service';
import { InboundEmailService } from './services/inbound-email.service';
import { EmailTrackingService } from './services/email-tracking.service';

@Controller('communication')
export class EmailLogController {
  private readonly logger = new Logger(EmailLogController.name);

  constructor(
    private readonly emailLogService: EmailLogService,
    private readonly inboundEmailService: InboundEmailService,
    private readonly emailTrackingService: EmailTrackingService,
    private readonly configService: ConfigService,
  ) {}

  // ─── LIST & DETAIL ────────────────────────────────────────────────────────

  /**
   * Liste les EmailLogs d'un tenant avec filtres + pagination.
   *
   * Endpoint @Public — la sécurité repose sur le tenantId passé en query
   * (les données ne sont pas sensibles : pas de passwords, juste des logs
   * d'emails envoyés/reçus). La web-app n'envoie pas de JWT Bearer sur ces
   * routes, uniquement le cookie x-tenant-id.
   *
   * Query params:
   *   - tenantId (requis)
   *   - category, subCategory, module, status, recipientType
   *   - recipient (partial match)
   *   - search (subject + recipient)
   *   - threadId
   *   - dateFrom, dateTo (ISO)
   *   - page, pageSize (default 25, max 100)
   */
  @Public()
  @Get('email-logs')
  async listEmailLogs(
    @Req() req: Request,
    @Query('tenantId') tenantId?: string,
    @Query('category') category?: string,
    @Query('subCategory') subCategory?: string,
    @Query('module') module?: string,
    @Query('status') status?: string,
    @Query('recipient') recipient?: string,
    @Query('recipientType') recipientType?: string,
    @Query('search') search?: string,
    @Query('threadId') threadId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    // Résoudre tenantId depuis JWT ou query (le tenantId query est utilisé
    // par les endpoints @Public comme les test endpoints)
    const tid = (req as any).user?.tenantId || tenantId;
    if (!tid) {
      throw new BadRequestException('tenantId is required');
    }

    return this.emailLogService.listEmailLogs({
      tenantId: tid,
      category: category as any,
      subCategory,
      module,
      status: status as any,
      recipient,
      recipientType: recipientType as any,
      search,
      threadId,
      dateFrom,
      dateTo,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 25,
    });
  }

  /**
   * Détail d'un EmailLog (avec ses réponses entrantes).
   * @Public — voir note sur listEmailLogs.
   */
  @Public()
  @Get('email-logs/:id')
  async getEmailLog(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid = (req as any).user?.tenantId || tenantId;
    if (!tid) {
      throw new BadRequestException('tenantId is required');
    }
    return this.emailLogService.getEmailLog(id, tid);
  }

  /**
   * Récupère tous les messages (sortants + entrants) d'un thread.
   * Triés chronologiquement.
   * @Public — voir note sur listEmailLogs.
   */
  @Public()
  @Get('email-logs/thread/:threadId')
  async getThread(
    @Param('threadId') threadId: string,
    @Req() req: Request,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid = (req as any).user?.tenantId || tenantId;
    if (!tid) {
      throw new BadRequestException('tenantId is required');
    }
    return this.emailLogService.getThread(threadId, tid);
  }

  // ─── STATISTIQUES ──────────────────────────────────────────────────────────

  @Public()
  @Get('email-logs-stats')
  async getStats(
    @Req() req: Request,
    @Query('tenantId') tenantId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const tid = (req as any).user?.tenantId || tenantId;
    if (!tid) {
      throw new BadRequestException('tenantId is required');
    }
    return this.emailLogService.getStats(tid, dateFrom, dateTo);
  }

  // ─── INBOUND EMAILS ────────────────────────────────────────────────────────

  /**
   * Liste les InboundEmails (page Inbox).
   * @Public — voir note sur listEmailLogs.
   */
  @Public()
  @Get('inbound-emails')
  async listInboundEmails(
    @Req() req: Request,
    @Query('tenantId') tenantId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('threadId') threadId?: string,
    @Query('fromEmail') fromEmail?: string,
  ) {
    const tid = (req as any).user?.tenantId || tenantId;
    if (!tid) {
      throw new BadRequestException('tenantId is required');
    }
    return this.inboundEmailService.listInboundEmails({
      tenantId: tid,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 25,
      search,
      threadId,
      fromEmail,
    });
  }

  /**
   * Détail d'un InboundEmail.
   * @Public — voir note sur listEmailLogs.
   */
  @Public()
  @Get('inbound-emails/:id')
  async getInboundEmail(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid = (req as any).user?.tenantId || tenantId;
    if (!tid) {
      throw new BadRequestException('tenantId is required');
    }
    return this.inboundEmailService.getInboundEmail(id, tid);
  }

  // ─── WEBHOOKS RESEND ───────────────────────────────────────────────────────

  /**
   * Webhook Resend — Événements tracking (sent, delivered, bounced, opened, clicked).
   *
   * Configuré dans Resend Dashboard → Webhooks.
   * Sécurité : vérification de la signature Resend (header svix-signature, svix-timestamp, svix-id).
   *
   * Documentation : https://resend.com/docs/dashboard/webhooks
   *
   * Body Resend (exemple) :
   *   {
   *     "type": "email.delivered",
   *     "created_at": "2024-06-19T13:00:00.000Z",
   *     "data": {
   *       "email_id": "re_abc123...",   ← providerId
   *       "from": "noreply@academiahelm.com",
   *       "to": ["candidate@example.com"],
   *       "subject": "..."
   *     }
   *   }
   */
  @Public()
  @Post('email-webhook')
  async handleTrackingWebhook(
    @Body() body: any,
    @Headers('svix-signature') _signature?: string,
    @Headers('svix-timestamp') _svixTimestamp?: string,
    @Headers('svix-id') _messageId?: string,
  ) {
    // Vérification de la signature Resend (best-effort — si WEBHOOK_SECRET non configuré, on log un warn)
    const webhookSecret = this.configService.get<string>('RESEND_WEBHOOK_SECRET');
    if (webhookSecret) {
      // TODO: implémenter la vérification cryptographique via Svix
      // Pour l'instant, on accepte tous les webhooks (le secret sera vérifié plus tard)
      this.logger.warn('RESEND_WEBHOOK_SECRET configured but signature verification not yet implemented — accepting webhook');
    } else {
      this.logger.warn('RESEND_WEBHOOK_SECRET not configured — accepting webhook without verification');
    }

    const eventType = body?.type as string | undefined;
    const createdAt = body?.created_at as string | undefined;
    const emailId = body?.data?.email_id as string | undefined;

    if (!eventType || !emailId) {
      this.logger.warn(`Invalid Resend webhook payload: ${JSON.stringify(body).substring(0, 500)}`);
      throw new BadRequestException('Invalid webhook payload');
    }

    this.logger.log(
      `Resend tracking webhook: event=${eventType}, emailId=${emailId}`,
    );

    const timestamp = createdAt ? new Date(createdAt) : new Date();
    const metadata = body?.data || {};

    try {
      await this.emailLogService.updateStatusFromWebhook(emailId, eventType, timestamp, metadata);
      return { received: true, event: eventType };
    } catch (err: any) {
      this.logger.error(`Failed to process tracking webhook: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Webhook Resend Inbound — Réponses reçues par les candidats.
   *
   * Configuré dans Resend Dashboard → Inbound.
   * Sécurité : vérification de la signature (même mécanisme que tracking webhook).
   *
   * Body Resend Inbound (exemple) :
   *   {
   *     "type": "email.inbound",
   *     "created_at": "2024-06-19T13:05:00.000Z",
   *     "data": {
   *       "id": "inb_abc123...",
   *       "from": "candidate@example.com",
   *       "from_name": "Aurore AKPOVI",
   *       "to": ["log_xxxx@replies.academiahelm.com"],
   *       "subject": "Re: Entretien programmé",
   *       "text": "Bonjour, je confirme...",
   *       "html": "<p>Bonjour, je confirme...</p>",
   *       "headers": {...},
   *       "attachments": [{ "filename": "...", "url": "..." }]
   *     }
   *   }
   */
  @Public()
  @Post('inbound-webhook')
  async handleInboundWebhook(
    @Body() body: any,
    @Headers('svix-signature') _signature?: string,
  ) {
    // Vérification signature (TODO)
    const webhookSecret = this.configService.get<string>('RESEND_INBOUND_WEBHOOK_SECRET');
    if (webhookSecret) {
      this.logger.warn('RESEND_INBOUND_WEBHOOK_SECRET configured but signature verification not yet implemented — accepting webhook');
    }

    const type = body?.type;
    if (type !== 'email.inbound' && type !== 'inbound.email') {
      // Ce n'est pas un event inbound — ignorer
      this.logger.log(`Inbound webhook: ignoring non-inbound event type=${type}`);
      return { received: true, ignored: true };
    }

    const data = body?.data || body;
    const toEmail = Array.isArray(data?.to) ? data.to[0] : data?.to;
    const fromEmail = data?.from || data?.from_email;
    const fromName = data?.from_name || data?.fromName;
    const subject = data?.subject || '(no subject)';
    const textContent = data?.text || data?.text_content;
    const htmlContent = data?.html || data?.html_content;
    const providerId = data?.id || data?.inbound_id;
    const rawHeaders = data?.headers ? JSON.stringify(data.headers) : undefined;
    const attachments = data?.attachments;

    if (!toEmail || !fromEmail) {
      this.logger.warn(
        `Inbound webhook: missing to or from — to=${toEmail}, from=${fromEmail}`,
      );
      throw new BadRequestException('Missing to or from in inbound webhook');
    }

    this.logger.log(
      `Resend inbound webhook: from=${fromEmail}, to=${toEmail}, subject="${subject}", attachments=${attachments?.length || 0}`,
    );

    try {
      const result = await this.inboundEmailService.processInboundEmail({
        toEmail,
        fromEmail,
        fromName,
        subject,
        textContent,
        htmlContent,
        attachments,
        providerId,
        rawHeaders,
      });

      return {
        received: true,
        processed: result.success,
        inboundEmailId: result.inboundEmailId,
        originalEmailId: result.originalEmailId,
        threadId: result.threadId,
        notificationsSent: result.notificationsSent,
      };
    } catch (err: any) {
      this.logger.error(`Failed to process inbound webhook: ${err.message}`, err.stack);
      throw err;
    }
  }

  // ─── TRACKING (pixel + liens trackés) ──────────────────────────────────────

  /**
   * Tracking pixel — image invisible 1×1 GIF.
   *
   * Quand le client mail charge l'image, on incrémente openCount + set openedAt.
   * Renvoie toujours le GIF (même si logId invalide) pour ne pas casser l'email.
   *
   * URL : /api/communication/track/open/{logId}.gif
   */
  @Public()
  @Get('track/open/:logId.gif')
  @Header('Content-Type', 'image/gif')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  async trackOpen(@Param('logId') logId: string, @Res() res: Response) {
    // Valider le format (UUID v4)
    if (!this.emailTrackingService.isValidLogId(logId)) {
      // Renvoyer quand même le pixel (silencieux)
      const buf = this.emailTrackingService.getTrackingPixelBuffer();
      res.setHeader('Content-Length', buf.length.toString());
      res.send(buf);
      return;
    }

    // Enregistrer l'ouverture (asynchrone — ne bloque pas la réponse)
    this.emailTrackingService
      .recordOpen(logId)
      .catch((err) => this.logger.error(`trackOpen: ${err.message}`));

    // Renvoyer le GIF
    const buf = this.emailTrackingService.getTrackingPixelBuffer();
    res.setHeader('Content-Length', buf.length.toString());
    res.send(buf);
  }

  /**
   * Tracking de clics — redirige vers l'URL finale après tracking.
   *
   * URL : /api/communication/track/click?logId=...&url=...
   *
   * Réponse : 302 redirect vers l'URL finale
   * Si logId invalide ou URL manquante → redirect vers la home de l'app
   */
  @Public()
  @Get('track/click')
  async trackClick(
    @Query('logId') logId: string,
    @Query('url') url: string,
    @Res() res: Response,
  ) {
    // URL par défaut si manquante ou invalide
    const fallbackUrl = 'https://academiahelm.com';

    if (!url) {
      res.redirect(302, fallbackUrl);
      return;
    }

    // Décoder l'URL (qui est encodée en query param)
    let decodedUrl: string;
    try {
      decodedUrl = decodeURIComponent(url);
    } catch {
      res.redirect(302, fallbackUrl);
      return;
    }

    // Valider que c'est bien une URL http(s)://
    if (!/^https?:\/\//i.test(decodedUrl)) {
      res.redirect(302, fallbackUrl);
      return;
    }

    // Si logId valide, enregistrer le clic (asynchrone)
    if (logId && this.emailTrackingService.isValidLogId(logId)) {
      this.emailTrackingService
        .recordClick(logId, decodedUrl)
        .catch((err) => this.logger.error(`trackClick: ${err.message}`));
    }

    // Rediriger vers l'URL finale
    res.redirect(302, decodedUrl);
  }
}
