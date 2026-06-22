/**
 * ============================================================================
 * SCHEDULED EMAIL DISPATCHER — Cron qui envoie les emails programmés
 * ============================================================================
 *
 * Tourne toutes les minutes pour vérifier les emails PENDING dont
 * scheduledAt <= now() et les envoie via EmailService.sendCategorized().
 *
 * Logique :
 *   1. Récupère les emails PENDING dus (scheduledAt <= now())
 *   2. Pour chaque email :
 *      a. Si l'option replyToOverride est fournie → on la passe à
 *         sendCategorized (le candidat répondra directement au recruteur)
 *      b. Envoie l'email via EmailService
 *      c. Marque comme SENT (avec emailLogId) ou FAILED
 *
 * Sécurité :
 *   - Limité à 50 emails par run (évite OOM)
 *   - Gestion d'erreur par email (un échec ne bloque pas les autres)
 *   - Log détaillé pour audit
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScheduledEmailService } from './scheduled-email.service';
import { EmailService } from './email.service';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/services/storage.service';

@Injectable()
export class ScheduledEmailDispatcherService {
  private readonly logger = new Logger(ScheduledEmailDispatcherService.name);
  private isRunning = false;

  constructor(
    private readonly scheduledEmailService: ScheduledEmailService,
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Cron toutes les minutes pour dispatcher les emails programmés dus.
   *
   * ⚠️ IMPORTANT : utilise CronExpression.EVERY_MINUTE (qui vaut '* * * * *',
   * 5 champs sans secondes). Ne PAS utiliser '0 * * * * *' (6 champs avec
   * secondes) car @nestjs/schedule n'accepte que les expressions 5 champs
   * par défaut — une expression 6 champs fait crasher l'app au démarrage
   * (le ScheduleModule lève une erreur pendant l'init, avant que l'app
   * ne bind le port 3000 → "instance refused connection" sur Fly.io).
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchPendingEmails(): Promise<void> {
    // Évite les runs concurrents si le précédent n'a pas fini
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    try {
      const pendingEmails = await this.scheduledEmailService.findPendingDue();

      if (pendingEmails.length === 0) {
        return; // rien à envoyer
      }

      this.logger.log(
        `Dispatching ${pendingEmails.length} scheduled email(s) due now`,
      );

      let sentCount = 0;
      let failedCount = 0;

      for (const email of pendingEmails) {
        try {
          await this.sendOne(email);
          sentCount++;
        } catch (err: any) {
          failedCount++;
          this.logger.error(
            `Failed to send scheduled email ${email.id} to ${email.to_email}: ${err.message}`,
            err.stack,
          );
        }
      }

      this.logger.log(
        `Scheduled email dispatch complete: ${sentCount} sent, ${failedCount} failed`,
      );
    } catch (err: any) {
      // Si la table scheduled_emails n'existe pas encore (migration non
      // appliquée), on logge en warning sans crasher — le prochain run
      // réessaiera une fois la migration appliquée.
      if (err?.message?.includes('relation') && err?.message?.includes('does not exist')) {
        this.logger.warn(
          `scheduled_emails table not found — skipping dispatch (migration may not be applied yet)`,
        );
      } else {
        this.logger.error(
          `Scheduled email dispatcher error: ${err.message}`,
          err.stack,
        );
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Envoie un email programmé individuel.
   *
   * Le HTML du message est enveloppé dans un template professionnel avec :
   *   - Header : logo (école ou Academia Helm selon la catégorie) + nom école
   *   - Corps : le message rédigé par l'utilisateur
   *   - Footer : signature Academia Helm + infos contact
   */
  private async sendOne(email: any): Promise<void> {
    const hasCategory = !!email.category;
    const tenantId = email.tenant_id;

    // Récupérer les infos du tenant (logo + nom école) pour personnaliser l'email
    const branding = tenantId ? await this.getTenantBranding(tenantId, email.category) : null;

    // Envelopper le HTML du message dans le template avec logo
    const wrappedHtml = this.wrapWithEmailTemplate(email.html_body, email.subject, branding);

    // Utiliser sendCategorized si category + tenantId sont fournis
    // (traçabilité EmailLog + replyToOverride)
    if (hasCategory && tenantId) {
      try {
        const result = await this.emailService.sendCategorized({
          tenantId,
          category: email.category as any,
          subCategory: email.subcategory || undefined,
          module: email.module || undefined,
          to: email.to_email,
          toName: email.to_name || undefined,
          recipientType: email.recipient_type as any,
          recipientId: email.recipient_id || undefined,
          fromName: branding?.schoolName || 'Academia Helm',
          subject: email.subject,
          html: wrappedHtml,
          text: email.text_body || undefined,
          relatedEntityId: email.recipient_id || undefined,
          relatedEntityType: email.recipient_type || undefined,
          replyToOverride: email.reply_to_override || undefined,
        });

        if (result.success) {
          await this.scheduledEmailService.markAsSent(email.id, result.logId);
          this.logger.log(
            `✅ Scheduled email sent: id=${email.id}, to=${email.to_email}, subject="${email.subject.substring(0, 60)}", logId=${result.logId}`,
          );
        } else {
          await this.scheduledEmailService.markAsFailed(
            email.id,
            result.error || 'Provider returned success=false',
          );
        }
        return;
      } catch (err: any) {
        // Fallback vers sendEmail simple si sendCategorized échoue
        this.logger.warn(
          `sendCategorized failed for ${email.id}, falling back to sendEmail: ${err.message}`,
        );
      }
    }

    // Voie legacy (non catégorisée)
    try {
      const result = await this.emailService.sendEmail({
        to: email.to_email,
        subject: email.subject,
        html: wrappedHtml,
        text: email.text_body || undefined,
        fromName: branding?.schoolName || 'Academia Helm',
        replyTo: email.reply_to_override || undefined,
      });

      if (result.success) {
        await this.scheduledEmailService.markAsSent(email.id);
        this.logger.log(
          `✅ Scheduled email sent (legacy): id=${email.id}, to=${email.to_email}`,
        );
      } else {
        await this.scheduledEmailService.markAsFailed(
          email.id,
          'Provider returned success=false',
        );
      }
    } catch (err: any) {
      await this.scheduledEmailService.markAsFailed(email.id, err.message);
      throw err; // re-throw pour le compteur failedCount
    }
  }

  /**
   * Récupère le branding du tenant (logo + nom école) pour personnaliser l'email.
   *
   * Logique de choix du logo :
   *   - Si category = 'SYSTEM' → logo Academia Helm (email système, pas lié à une école)
   *   - Sinon → logo de l'école (SchoolSettings.logoUrl > TenantIdentityProfile.logoUrl)
   *
   * Si aucun logo n'est trouvé, on utilise le logo Academia Helm par défaut.
   */
  private async getTenantBranding(
    tenantId: string,
    category: string | null,
  ): Promise<{
    schoolName: string;
    logoUrl: string;
    schoolEmail?: string;
    schoolPhone?: string;
    schoolAddress?: string;
    schoolCity?: string;
  } | null> {
    try {
      // Logo Academia Helm par défaut (pour catégorie SYSTEM ou si pas de logo école)
      const ACADEMIA_HELM_LOGO = 'https://www.academiahelm.com/images/logo-Academia%20Hub.png';
      const ACADEMIA_HELM_NAME = 'Academia Helm';

      // Si catégorie SYSTEM → on retourne directement le branding Academia Helm
      if (category === 'SYSTEM') {
        return {
          schoolName: ACADEMIA_HELM_NAME,
          logoUrl: ACADEMIA_HELM_LOGO,
        };
      }

      // Sinon → récupérer les infos de l'école
      const [schoolSettings, identityProfile, tenant] = await Promise.all([
        this.prisma.schoolSettings.findFirst({
          where: { tenantId },
          select: {
            schoolName: true,
            logoUrl: true,
            email: true,
            phone: true,
            address: true,
            city: true,
          },
        }).catch(() => null),
        this.prisma.tenantIdentityProfile.findFirst({
          where: { tenantId, isActive: true },
          orderBy: { version: 'desc' },
          select: {
            schoolName: true,
            logoUrl: true,
            email: true,
            phonePrimary: true,
            address: true,
            city: true,
          },
        }).catch(() => null),
        this.prisma.tenant.findFirst({
          where: { id: tenantId },
          select: { name: true },
        }).catch(() => null),
      ]);

      const schoolName =
        schoolSettings?.schoolName ||
        identityProfile?.schoolName ||
        tenant?.name ||
        ACADEMIA_HELM_NAME;

      // Résoudre le logo en URL complète si nécessaire
      let logoUrl = schoolSettings?.logoUrl || identityProfile?.logoUrl || '';
      const logoStr = typeof logoUrl === 'string' ? logoUrl : (logoUrl as any)?.url || '';
      if (logoStr) {
        try {
          logoUrl = await this.storageService.resolveFileUrl(logoStr);
        } catch {
          logoUrl = logoStr;
        }
      } else {
        // Pas de logo école → fallback Academia Helm
        logoUrl = ACADEMIA_HELM_LOGO;
      }

      return {
        schoolName,
        logoUrl: logoUrl as string,
        schoolEmail: schoolSettings?.email || identityProfile?.email || undefined,
        schoolPhone: schoolSettings?.phone || identityProfile?.phonePrimary || undefined,
        schoolAddress: schoolSettings?.address || identityProfile?.address || undefined,
        schoolCity: schoolSettings?.city || identityProfile?.city || undefined,
      };
    } catch (err: any) {
      this.logger.warn(`Failed to get tenant branding: ${err.message}`);
      return null;
    }
  }

  /**
   * Enveloppe le HTML du message dans un template professionnel avec header
   * (logo + nom école) et footer (signature Academia Helm + infos contact).
   *
   * Le HTML du message est injecté tel quel dans le corps — l'utilisateur
   * peut avoir utilisé la toolbar WYSIWYG (gras, italique, listes) pour
   * mettre en forme son texte.
   */
  private wrapWithEmailTemplate(
    messageHtml: string,
    subject: string,
    branding: {
      schoolName: string;
      logoUrl: string;
      schoolEmail?: string;
      schoolPhone?: string;
      schoolAddress?: string;
      schoolCity?: string;
    } | null,
  ): string {
    const schoolName = branding?.schoolName || 'Academia Helm';
    const logoUrl = branding?.logoUrl || 'https://www.academiahelm.com/images/logo-Academia%20Hub.png';

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#eef2f7;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(12,26,51,0.08);">

          <!-- Header avec logo + nom école -->
          <tr>
            <td style="background:linear-gradient(160deg,#0D1F6E 0%,#0D3B85 100%);padding:24px;border-bottom:3px solid #F5A623;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;padding-right:14px;text-align:left;">
                    <img src="${logoUrl}" alt="${schoolName}" style="max-height:48px;max-width:160px;object-fit:contain;" />
                  </td>
                  <td style="padding-left:14px;text-align:left;vertical-align:middle;">
                    <div style="font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">${schoolName}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Corps du message -->
          <tr>
            <td style="padding:32px 28px;background:#f8fafc;">
              <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:24px;font-size:14px;color:#334155;line-height:1.7;">
                ${messageHtml}
              </div>
            </td>
          </tr>

          <!-- Footer avec infos contact + signature -->
          ${
            branding?.schoolEmail || branding?.schoolPhone || branding?.schoolAddress
              ? `
          <tr>
            <td style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 8px;font-size:12px;color:#0D1F6E;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">Contact</p>
              ${branding?.schoolPhone ? `<p style="margin:2px 0;font-size:12px;color:#64748b;">📞 ${branding.schoolPhone}</p>` : ''}
              ${branding?.schoolEmail ? `<p style="margin:2px 0;font-size:12px;color:#64748b;">✉️ <a href="mailto:${branding.schoolEmail}" style="color:#0D1F6E;text-decoration:none;">${branding.schoolEmail}</a></p>` : ''}
              ${(branding?.schoolAddress || branding?.schoolCity) ? `<p style="margin:2px 0;font-size:12px;color:#64748b;">📍 ${[branding.schoolAddress, branding.schoolCity].filter(Boolean).join(', ')}</p>` : ''}
            </td>
          </tr>
          `
              : ''
          }

          <!-- Signature Academia Helm -->
          <tr>
            <td style="background:#0D1F6E;padding:20px 28px;text-align:center;">
              <div style="font-size:13px;color:#ffffff;font-weight:bold;">Academia Helm</div>
              <div style="font-size:11px;color:#F5A623;margin-top:2px;">Plateforme de pilotage éducatif</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
  }
}
