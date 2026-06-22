/**
 * ============================================================================
 * RECRUITMENT DAILY SUMMARY SERVICE — Résumé quotidien des candidatures
 * ============================================================================
 *
 * Cron quotidien à 8h00 (Africa/Porto-Novo) qui envoie au recruteur un
 * résumé des activités de recrutement de la veille :
 *   - Nouvelles candidatures reçues
 *   - Entretiens programmés / réalisés
 *   - Tests programmés / réalisés
 *   - Embauches effectuées
 *   - Rejets
 *
 * Si aucune activité → aucun email envoyé (anti-spam).
 * Si pas de RecruiterProfile → log warning, skip.
 *
 * Le résumé est envoyé via EmailService.sendCategorized avec replyToOverride
 * = email du recruteur (pour que le recruteur puisse répondre directement).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../../communication/services/email.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RecruitmentDailySummaryService {
  private readonly logger = new Logger(RecruitmentDailySummaryService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Cron quotidien à 8h00 du matin (heure de Porto-Novo = UTC+1).
   * Envoyé sous forme UTC donc 7h00 UTC = 8h00 UTC+1.
   */
  @Cron('0 7 * * *')
  async sendDailySummary(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Daily summary already running, skipping');
      return;
    }
    this.isRunning = true;

    try {
      this.logger.log('Starting recruitment daily summary cron...');

      // Calculer la plage horaire de la veille (UTC)
      const now = new Date();
      const yesterdayStart = new Date(now);
      yesterdayStart.setUTCDate(now.getUTCDate() - 1);
      yesterdayStart.setUTCHours(0, 0, 0, 0);
      const yesterdayEnd = new Date(now);
      yesterdayEnd.setUTCHours(0, 0, 0, 0);

      // Récupérer tous les tenants actifs par batches de 5 (anti-OOM)
      const BATCH_SIZE = 5;
      let skip = 0;
      let totalSummariesSent = 0;

      while (true) {
        const tenants = await this.prisma.tenant.findMany({
          where: { status: 'active', deletedAt: null },
          select: { id: true, name: true },
          take: BATCH_SIZE,
          skip,
        });

        if (tenants.length === 0) break;

        for (const tenant of tenants) {
          try {
            const sent = await this.processTenantDailySummary(
              tenant.id,
              tenant.name,
              yesterdayStart,
              yesterdayEnd,
            );
            if (sent) totalSummariesSent++;
          } catch (err: any) {
            this.logger.error(
              `Daily summary failed for tenant ${tenant.id} (${tenant.name}): ${err.message}`,
              err.stack,
            );
          }
        }

        skip += BATCH_SIZE;
        if (global.gc) global.gc();
      }

      this.logger.log(
        `Recruitment daily summary complete: ${totalSummariesSent} email(s) sent`,
      );
    } catch (err: any) {
      this.logger.error(`Daily summary cron error: ${err.message}`, err.stack);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Traite le résumé quotidien pour un tenant.
   * Retourne true si un email a été envoyé, false sinon.
   */
  private async processTenantDailySummary(
    tenantId: string,
    tenantName: string,
    yesterdayStart: Date,
    yesterdayEnd: Date,
  ): Promise<boolean> {
    // 1. Récupérer le RecruiterProfile (avec son email)
    const recruiter = await this.prisma.recruiterProfile.findFirst({
      where: { tenantId, isActive: true },
      select: {
        fullName: true,
        email: true,
        functionLabel: true,
      },
    });

    if (!recruiter?.email) {
      this.logger.debug(
        `No recruiter email for tenant ${tenantId} — skipping daily summary`,
      );
      return false;
    }

    // 2. Récupérer les activités de la veille (raw SQL pour éviter Prisma client issues)
    const newApplications = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT c.id, c.first_name, c.last_name, c.email, j.title as job_title
      FROM hr_candidates c
      LEFT JOIN hr_applications a ON a.candidate_id = c.id
      LEFT JOIN hr_jobs j ON j.id = a.job_id
      WHERE c.tenant_id = $1
        AND c.created_at >= $2 AND c.created_at < $3
      ORDER BY c.created_at DESC
      LIMIT 50
    `, tenantId, yesterdayStart, yesterdayEnd);

    const interviewsScheduled = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT i.id, c.first_name, c.last_name, i.scheduled_date, i.format, i.status
      FROM hr_interviews i
      JOIN hr_candidates c ON c.id = i.candidate_id
      WHERE i.tenant_id = $1
        AND i.created_at >= $2 AND i.created_at < $3
      ORDER BY i.created_at DESC
      LIMIT 50
    `, tenantId, yesterdayStart, yesterdayEnd);

    const interviewsCompleted = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT i.id, c.first_name, c.last_name, i.result, i.score
      FROM hr_interviews i
      JOIN hr_candidates c ON c.id = i.candidate_id
      WHERE i.tenant_id = $1
        AND i.validated_at >= $2 AND i.validated_at < $3
      ORDER BY i.validated_at DESC
      LIMIT 50
    `, tenantId, yesterdayStart, yesterdayEnd);

    const testsScheduled = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT tr.id, c.first_name, c.last_name, t.name as test_name
      FROM hr_test_results tr
      JOIN hr_candidates c ON c.id = tr.candidate_id
      LEFT JOIN hr_tests t ON t.id = tr.test_id
      WHERE tr.tenant_id = $1
        AND tr.created_at >= $2 AND tr.created_at < $3
      ORDER BY tr.created_at DESC
      LIMIT 50
    `, tenantId, yesterdayStart, yesterdayEnd);

    const hires = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT c.first_name, c.last_name, c.status, c.contract_type
      FROM hr_candidates c
      WHERE c.tenant_id = $1
        AND c.status = 'EMBAUCHÉ'
        AND c.updated_at >= $2 AND c.updated_at < $3
      ORDER BY c.updated_at DESC
      LIMIT 50
    `, tenantId, yesterdayStart, yesterdayEnd);

    const rejections = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT c.first_name, c.last_name
      FROM hr_candidates c
      WHERE c.tenant_id = $1
        AND c.status = 'REJETÉ'
        AND c.updated_at >= $2 AND c.updated_at < $3
      ORDER BY c.updated_at DESC
      LIMIT 50
    `, tenantId, yesterdayStart, yesterdayEnd);

    // 3. Si aucune activité → pas d'email (anti-spam)
    const totalActivity =
      newApplications.length +
      interviewsScheduled.length +
      interviewsCompleted.length +
      testsScheduled.length +
      hires.length +
      rejections.length;

    if (totalActivity === 0) {
      this.logger.debug(
        `No recruitment activity yesterday for tenant ${tenantId} — no summary sent`,
      );
      return false;
    }

    // 4. Construire l'email HTML
    const formattedDate = yesterdayStart.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const html = this.buildSummaryHtml({
      tenantName,
      recruiterName: recruiter.fullName,
      formattedDate,
      newApplications,
      interviewsScheduled,
      interviewsCompleted,
      testsScheduled,
      hires,
      rejections,
    });

    // 5. Envoyer l'email via sendCategorized (traçabilité + replyToOverride)
    const fromEmail =
      this.config.get<string>('EMAIL_FROM_NOREPLY') ||
      'noreply@academiahelm.com';

    const subject = `📊 Résumé recrutement du ${formattedDate} — ${tenantName}`;

    try {
      const result = await this.emailService.sendCategorized({
        tenantId,
        category: 'RECRUTEMENT' as any,
        subCategory: 'resume_quotidien',
        module: 'hr',
        to: recruiter.email,
        toName: recruiter.fullName,
        recipientType: 'STAFF' as any,
        fromEmail,
        fromName: tenantName,
        subject,
        html,
        triggeredBy: 'AUTOMATION',
        replyToOverride: recruiter.email,
      });

      if (result.success) {
        this.logger.log(
          `✅ Daily summary sent to ${recruiter.email} for tenant ${tenantId} — ` +
            `${totalActivity} activities, logId=${result.logId}`,
        );
        return true;
      } else {
        this.logger.error(
          `Failed to send daily summary to ${recruiter.email}: ${result.error}`,
        );
        return false;
      }
    } catch (err: any) {
      this.logger.error(
        `Error sending daily summary to ${recruiter.email}: ${err.message}`,
        err.stack,
      );
      return false;
    }
  }

  /**
   * Construit le HTML du résumé quotidien.
   */
  private buildSummaryHtml(data: {
    tenantName: string;
    recruiterName: string;
    formattedDate: string;
    newApplications: any[];
    interviewsScheduled: any[];
    interviewsCompleted: any[];
    testsScheduled: any[];
    hires: any[];
    rejections: any[];
  }): string {
    const {
      tenantName, recruiterName, formattedDate,
      newApplications, interviewsScheduled, interviewsCompleted,
      testsScheduled, hires, rejections,
    } = data;

    const sectionHtml = (title: string, items: any[], renderItem: (item: any) => string) => {
      if (items.length === 0) return '';
      return `
        <div style="margin-bottom:24px;">
          <h3 style="margin:0 0 10px;font-size:14px;color:#0D1F6E;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #F5A623;padding-bottom:6px;">
            ${title} <span style="background:#0D1F6E;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:6px;">${items.length}</span>
          </h3>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
            ${items.map((item, idx) => `
              <div style="padding:10px 14px;${idx < items.length - 1 ? 'border-bottom:1px solid #f1f5f9;' : ''}font-size:13px;color:#334155;">
                ${renderItem(item)}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    };

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

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(160deg,#0D1F6E 0%,#0D3B85 100%);padding:28px 24px 22px;text-align:center;border-bottom:3px solid #F5A623;">
              <h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:bold;">📊 Résumé Recrutement</h1>
              <p style="margin:8px 0 0;font-size:14px;color:#F5A623;font-weight:bold;">${formattedDate}</p>
              <p style="margin:4px 0 0;font-size:12px;color:#c7d2fe;">${tenantName}</p>
            </td>
          </tr>

          <!-- Corps -->
          <tr>
            <td style="padding:28px 24px;">

              <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
                Bonjour <strong>${recruiterName}</strong>,<br/>
                Voici le résumé des activités de recrutement de la veille.
              </p>

              ${sectionHtml(
                '🆕 Nouvelles candidatures',
                newApplications,
                (item) => `<strong>${item.first_name} ${item.last_name}</strong> — ${item.job_title || 'Poste non spécifié'}<br/><span style="color:#64748b;font-size:12px;">${item.email}</span>`,
              )}

              ${sectionHtml(
                '📅 Entretiens programmés',
                interviewsScheduled,
                (item) => `<strong>${item.first_name} ${item.last_name}</strong> — ${item.format || 'Format non spécifié'}<br/><span style="color:#64748b;font-size:12px;">${item.scheduled_date ? new Date(item.scheduled_date).toLocaleString('fr-FR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'Date non spécifiée'}</span>`,
              )}

              ${sectionHtml(
                '✅ Entretiens réalisés',
                interviewsCompleted,
                (item) => `<strong>${item.first_name} ${item.last_name}</strong> — Résultat: <span style="color:${item.result === 'RÉUSSI' ? '#047857' : '#dc2626'};font-weight:bold;">${item.result || 'N/A'}</span>${item.score != null ? ` (${item.score}/100)` : ''}`,
              )}

              ${sectionHtml(
                '📝 Tests programmés',
                testsScheduled,
                (item) => `<strong>${item.first_name} ${item.last_name}</strong> — ${item.test_name || 'Test non spécifié'}`,
              )}

              ${sectionHtml(
                '🎉 Embauches',
                hires,
                (item) => `<strong>${item.first_name} ${item.last_name}</strong> — ${item.contract_type || 'Contrat non spécifié'}`,
              )}

              ${sectionHtml(
                '❌ Rejets',
                rejections,
                (item) => `<strong>${item.first_name} ${item.last_name}</strong>`,
              )}

              <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;text-align:center;border-top:1px solid #e2e8f0;padding-top:16px;">
                Cet email a été envoyé automatiquement par Academia Helm.<br/>
                Vous pouvez répondre directement à cet email — votre réponse sera envoyée à ${recruiterName}.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0D1F6E;padding:20px 24px;text-align:center;">
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
