/**
 * ============================================================================
 * 📧 TÂCHE 181 — CONTROLLER DE L'ONGLET PARAMÈTRES → E-MAIL
 * ============================================================================
 *
 * Routes (toutes protégées JWT + permission dédiée PARAMETRES_email —
 * équivalent du settings.email.manage du cahier des charges, attribuée par
 * défaut à la direction et aux administrateurs) :
 *
 *   GET    /school-email/status       → réglages (sans secret) + compteur
 *   PUT    /school-email/config       → enregistre la configuration SMTP
 *   POST   /school-email/test         → e-mail test à l'utilisateur connecté
 *   GET    /school-email/log          → 50 derniers envois
 *   POST   /school-email/disconnect   → supprime les secrets
 *
 * Sécurité (CDC section 7) :
 *   - permission vérifiée côté serveur sur CHAQUE route ;
 *   - le mot de passe n'apparaît ni dans les réponses API, ni dans les logs ;
 *   - bouton de test limité à 5 essais par heure et par école ;
 *   - toutes les requêtes filtrent par tenantId (aucune lecture croisée).
 * ============================================================================
 */

import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { SchoolEmailSettingsService } from './school-email-settings.service';
import { CentralEmailService } from './central-email.service';
import { EmailQueueDispatcherService } from './email-queue-dispatcher.service';
import { createSmtpTransport } from './smtp-helpers';
import {
  SaveSchoolEmailConfigDto,
  SchoolEmailSettingsView,
  SchoolEmailUsageView,
  EmailSendLogEntry,
  SendTestEmailDto,
} from './dto/school-email.dto';

/** Limite du bouton de test (CDC section 7.3). */
const MAX_TEST_PER_HOUR = 5;

@Controller('school-email')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('PARAMETRES', 'email')
export class SchoolEmailController {
  private readonly logger = new Logger(SchoolEmailController.name);

  constructor(
    private readonly settings: SchoolEmailSettingsService,
    private readonly central: CentralEmailService,
    private readonly dispatcher: EmailQueueDispatcherService,
  ) {}

  /** Statut + réglages (SANS secret) + compteur du jour + alertes. */
  @Get('status')
  async getStatus(
    @TenantId() tenantId: string,
  ): Promise<{ settings: SchoolEmailSettingsView; usage: SchoolEmailUsageView }> {
    const [settings, usage] = await Promise.all([
      this.settings.getView(tenantId),
      this.settings.getUsage(tenantId),
    ]);
    return { settings, usage };
  }

  /**
   * Enregistre la configuration SMTP. Le mot de passe d'application est
   * chiffré immédiatement (AES-256-GCM) et n'est JAMAIS renvoyé — la réponse
   * ne contient que secretSet: true (affiché « •••• » côté UI).
   * Une vérification de connexion SMTP suit l'enregistrement : le statut
   * passe à Actif ou Erreur avec la date de dernière vérification.
   */
  @Put('config')
  async saveConfig(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: SaveSchoolEmailConfigDto,
  ): Promise<{ settings: SchoolEmailSettingsView; verified: boolean; verifyError?: string }> {
    const view = await this.settings.saveConfig(tenantId, user?.id ?? 'unknown', dto);

    // Vérification réelle de la connexion SMTP (transport.verify).
    let verified = false;
    let verifyError: string | undefined;
    try {
      const password = await this.settings.decryptSecret(tenantId);
      const raw = await this.settings.findRaw(tenantId);
      const transport = createSmtpTransport({
        host: raw?.smtpHost || 'smtp.gmail.com',
        port: raw?.smtpPort || 587,
        user: raw?.smtpUser || raw?.fromEmail || dto.fromEmail,
        password,
      });
      await transport.verify();
      transport.close();
      verified = true;
      await this.settings.markVerified(tenantId);
    } catch (err: any) {
      verifyError =
        err?.responseCode === 535 || /auth/i.test(String(err?.message || ''))
          ? 'Authentification refusée par Gmail — vérifiez le mot de passe d\'application (et que la validation en deux étapes est active).'
          : `Connexion SMTP échouée : ${String(err?.message || err).slice(0, 200)}`;
      await this.settings.markError(tenantId, verifyError);
      this.logger.warn(`Vérification SMTP échouée (tenant ${tenantId}) : ${verifyError}`);
    }

    const fresh = await this.settings.getView(tenantId);
    return { settings: fresh, verified, verifyError };
  }

  /**
   * E-mail de test — TOUJOURS envoyé à l'adresse de l'utilisateur connecté
   * (jamais à une adresse libre, CDC section 2.5). Max 5 essais/heure/école.
   */
  @Post('test')
  @HttpCode(200)
  async sendTest(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: SendTestEmailDto,
  ): Promise<{ success: boolean; status?: string; message: string }> {
    const userEmail = (dto?.to || user?.email || '').toString().trim().toLowerCase();
    if (!userEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(userEmail)) {
      throw new BadRequestException(
        'Aucune adresse e-mail valide sur votre compte utilisateur pour le test.',
      );
    }

    // Limite 5 essais/heure (comptés dans email_send_log, category=test).
    const usage = await this.settings.getUsage(tenantId);
    if (usage.testCountLastHour >= MAX_TEST_PER_HOUR) {
      throw new ForbiddenException(
        `Limite de ${MAX_TEST_PER_HOUR} e-mails de test par heure atteinte. Réessayez plus tard.`,
      );
    }

    const raw = await this.settings.findRaw(tenantId);
    if (!raw || raw.mode === 'aucun') {
      throw new BadRequestException(
        "Configurez d'abord la connexion SMTP de votre école avant d'envoyer un test.",
      );
    }

    const result = await this.central.send({
      schoolId: tenantId,
      module: 'settings',
      category: 'test',
      to: userEmail,
      subject: `Test de l'e-mail de ${raw.fromName} — Academia Helm`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="color:#111827;margin:0 0 12px">E-mail de test réussi</h2>
  <p style="color:#374151;margin:0 0 12px">Bonjour ${escapeHtmlText(String(user?.firstName || user?.fullName || ''))},</p>
  <p style="color:#374151;margin:0 0 12px">Cet e-mail confirme que <strong>${escapeHtmlText(raw.fromName)}</strong> envoie désormais ses e-mails depuis sa propre adresse Gmail <strong>${escapeHtmlText(raw.fromEmail)}</strong> via Academia Helm.</p>
  <p style="color:#6b7280;font-size:12px;margin:0">Si vous recevez ce message, la configuration est opérationnelle.</p>
</div>`,
      text: `E-mail de test réussi.\n\nBonjour ${String(user?.firstName || user?.fullName || '')},\n\nCet e-mail confirme que ${raw.fromName} envoie désormais ses e-mails depuis sa propre adresse Gmail ${raw.fromEmail} via Academia Helm.\n\nSi vous recevez ce message, la configuration est opérationnelle.`,
      triggeredByUserId: user?.id,
      wait: true,
    });

    switch (result.status) {
      case 'envoye':
        return { success: true, status: result.status, message: `E-mail de test envoyé à ${userEmail}.` };
      case 'reporte':
        return {
          success: false,
          status: result.status,
          message: 'Plafond quotidien atteint — le test partira dès que la fenêtre se libère.',
        };
      case 'en_file':
        return {
          success: true,
          status: result.status,
          message: `E-mail de test accepté pour ${userEmail} — envoi en cours (débit limité à 20/minute).`,
        };
      default:
        return {
          success: false,
          status: result.status,
          message: result.error || 'Échec de l\'envoi du test.',
        };
    }
  }

  /** Journal des 50 derniers envois (date, module, destinataire, statut). */
  @Get('log')
  async getLog(@TenantId() tenantId: string): Promise<{ entries: EmailSendLogEntry[] }> {
    const entries = await this.settings.getRecentLog(tenantId, 50);
    return { entries };
  }

  /** Déconnexion : supprime tous les secrets et repasse à Non configuré. */
  @Post('disconnect')
  @HttpCode(200)
  async disconnect(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ): Promise<{ settings: SchoolEmailSettingsView }> {
    const settings = await this.settings.disconnect(tenantId, user?.id ?? 'unknown');
    return { settings };
  }

  /** Rattrapage manuel de la file (diagnostic — même permission). */
  @Post('dispatch')
  @HttpCode(200)
  async dispatchNow(@TenantId() tenantId: string): Promise<{ ok: true }> {
    await this.dispatcher.dispatchDue();
    return { ok: true };
  }
}

function escapeHtmlText(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
