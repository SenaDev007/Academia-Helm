/**
 * ============================================================================
 * RECOVERY REMINDER EMAIL SERVICE — Envoi d'emails aux parents pour retards
 * ============================================================================
 *
 * Service complémentaire à RecoveryReminderService qui envoie réellement un
 * email au parent (Guardian) de l'élève quand un reminder est créé.
 *
 * Le RecoveryReminderService d'origine crée seulement des records en DB mais
 * n'envoie aucun email. Ce service corrige ce gap en :
 *   1. Récupérant le Guardian principal de l'élève (isPrimary=true)
 *   2. Si le Guardian a un email → envoi d'un email catégorisé
 *   3. L'email contient : nom de l'élève, montant dû, niveau de reminder,
 *      et un appel à l'action pour régulariser
 *
 * Utilise EmailService.sendCategorized pour la traçabilité (EmailLog).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../communication/services/email.service';
import { ReminderLevel } from '@prisma/client';

@Injectable()
export class RecoveryReminderEmailService {
  private readonly logger = new Logger(RecoveryReminderEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Envoie un email de rappel de paiement au parent (Guardian) de l'élève.
   *
   * @param tenantId - ID du tenant
   * @param studentAccountId - ID du StudentAccount en retard
   * @param reminderLevel - Niveau du reminder (WARNING / URGENT / FINAL_NOTICE)
   * @param amountDue - Montant dû en FCFA
   * @returns true si un email a été envoyé, false sinon
   */
  async sendRecoveryEmailToParent(
    tenantId: string,
    studentAccountId: string,
    reminderLevel: ReminderLevel | string,
    amountDue: number,
  ): Promise<boolean> {
    try {
      // 1. Récupérer le StudentAccount + Student + Guardian principal
      const account = await this.prisma.studentAccount.findFirst({
        where: { id: studentAccountId, tenantId },
        include: {
          student: {
            include: {
              studentGuardians: {
                where: { isPrimary: true },
                include: { guardian: true },
                take: 1,
              },
            },
          },
          academicYear: { select: { name: true } },
        },
      });

      if (!account) {
        this.logger.warn(`StudentAccount ${studentAccountId} not found`);
        return false;
      }

      // Si pas de guardian principal, essayer n'importe quel guardian
      let guardian = account.student?.studentGuardians?.[0]?.guardian;
      if (!guardian) {
        const fallbackGuardians = await this.prisma.studentGuardian.findMany({
          where: { studentId: account.studentId, tenantId },
          include: { guardian: true },
          take: 1,
        });
        guardian = fallbackGuardians[0]?.guardian;
      }

      if (!guardian?.email) {
        this.logger.debug(
          `No guardian email for student ${account.studentId} — skipping recovery email`,
        );
        return false;
      }

      // 2. Récupérer les infos de l'école
      const schoolSettings = await this.prisma.schoolSettings.findFirst({
        where: { tenantId },
        select: { schoolName: true, phone: true, email: true, address: true, city: true },
      });

      const tenant = await this.prisma.tenant.findFirst({
        where: { id: tenantId },
        select: { name: true },
      });

      const schoolName = schoolSettings?.schoolName || tenant?.name || 'L\'établissement';

      // 3. Déterminer le libellé + couleur selon le niveau
      const levelConfig = this.getLevelConfig(reminderLevel);

      // 4. Construire l'email
      const studentName = `${account.student?.firstName || ''} ${account.student?.lastName || ''}`.trim();
      const formattedAmount = amountDue.toLocaleString('fr-FR') + ' FCFA';
      const academicYearName = account.academicYear?.name || 'Année en cours';

      const subject = `${levelConfig.emoji} ${levelConfig.label} — Solde dû pour ${studentName} — ${schoolName}`;

      const html = this.buildRecoveryEmailHtml({
        schoolName,
        guardianName: `${guardian.firstName} ${guardian.lastName}`,
        studentName,
        formattedAmount,
        reminderLevel: levelConfig.label,
        reminderEmoji: levelConfig.emoji,
        reminderColor: levelConfig.color,
        reminderBgColor: levelConfig.bgColor,
        academicYearName,
        schoolPhone: schoolSettings?.phone,
        schoolEmail: schoolSettings?.email,
        schoolAddress: schoolSettings?.address,
        schoolCity: schoolSettings?.city,
      });

      // 5. Envoyer l'email via sendCategorized
      const fromEmail =
        this.config.get<string>('EMAIL_FROM_NOREPLY') ||
        'noreply@academiahelm.com';

      const result = await this.emailService.sendCategorized({
        tenantId,
        category: 'FINANCE' as any,
        subCategory: 'rappel_paiement',
        module: 'finance',
        to: guardian.email,
        toName: `${guardian.firstName} ${guardian.lastName}`,
        recipientType: 'PARENT' as any,
        recipientId: guardian.id,
        fromEmail,
        fromName: schoolName,
        subject,
        html,
        triggeredBy: 'AUTOMATION',
        relatedEntityId: studentAccountId,
        relatedEntityType: 'StudentAccount',
        // Reply-to = email de l'école pour que le parent puisse répondre
        replyToOverride: schoolSettings?.email || undefined,
      });

      if (result.success) {
        this.logger.log(
          `✅ Recovery email sent to ${guardian.email} for student ${studentName} — ` +
            `level=${reminderLevel}, amount=${formattedAmount}, logId=${result.logId}`,
        );
        return true;
      } else {
        this.logger.error(
          `Failed to send recovery email to ${guardian.email}: ${result.error}`,
        );
        return false;
      }
    } catch (err: any) {
      this.logger.error(
        `Error sending recovery email for account ${studentAccountId}: ${err.message}`,
        err.stack,
      );
      return false;
    }
  }

  /**
   * Configuration d'affichage selon le niveau de reminder.
   */
  private getLevelConfig(level: string): {
    label: string;
    emoji: string;
    color: string;
    bgColor: string;
  } {
    switch (level) {
      case ReminderLevel.FINAL_NOTICE:
        return {
          label: 'Mise en demeure finale',
          emoji: '🚨',
          color: '#dc2626',
          bgColor: '#fef2f2',
        };
      case ReminderLevel.URGENT:
        return {
          label: 'Rappel urgent',
          emoji: '⚠️',
          color: '#ea580c',
          bgColor: '#fff7ed',
        };
      case ReminderLevel.WARNING:
      default:
        return {
          label: 'Rappel de paiement',
          emoji: '📧',
          color: '#ca8a04',
          bgColor: '#fefce8',
        };
    }
  }

  /**
   * Construit le HTML de l'email de rappel.
   */
  private buildRecoveryEmailHtml(data: {
    schoolName: string;
    guardianName: string;
    studentName: string;
    formattedAmount: string;
    reminderLevel: string;
    reminderEmoji: string;
    reminderColor: string;
    reminderBgColor: string;
    academicYearName: string;
    schoolPhone: string | null;
    schoolEmail: string | null;
    schoolAddress: string | null;
    schoolCity: string | null;
  }): string {
    const {
      schoolName, guardianName, studentName, formattedAmount,
      reminderLevel, reminderEmoji, reminderColor, reminderBgColor,
      academicYearName, schoolPhone, schoolEmail, schoolAddress, schoolCity,
    } = data;

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
              <h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:bold;">${reminderEmoji} ${reminderLevel}</h1>
              <p style="margin:8px 0 0;font-size:14px;color:#F5A623;font-weight:bold;">${schoolName}</p>
            </td>
          </tr>

          <!-- Corps -->
          <tr>
            <td style="padding:28px 24px;">

              <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
                Bonjour <strong>${guardianName}</strong>,
              </p>

              <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
                Nous vous contactons concernant le solde dû pour la scolarité de votre enfant
                <strong>${studentName}</strong> pour l'année académique ${academicYearName}.
              </p>

              <!-- Encart montant -->
              <div style="background:${reminderBgColor};border-left:4px solid ${reminderColor};border-radius:0 8px 8px 0;padding:18px 20px;margin-bottom:24px;">
                <p style="margin:0 0 6px;font-size:12px;color:${reminderColor};font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">Montant dû</p>
                <p style="margin:0;font-size:28px;color:${reminderColor};font-weight:bold;">${formattedAmount}</p>
              </div>

              <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
                Nous vous prions de bien vouloir régulariser cette situation dans les meilleurs délais.
                Vous pouvez effectuer votre paiement :
              </p>

              <ul style="margin:0 0 20px;padding-left:24px;font-size:14px;color:#475569;line-height:1.8;">
                <li>À la caisse de l'établissement</li>
                <li>Par Mobile Money (MTN, Moov, Celtis)</li>
                <li>Par virement bancaire (nous contacter pour les coordonnées)</li>
              </ul>

              <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
                Pour toute question ou pour convenir d'un échéancier, n'hésitez pas à contacter
                l'établissement.
              </p>

              <!-- Contact -->
              ${(schoolPhone || schoolEmail || schoolAddress) ? `
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:20px;">
                <p style="margin:0 0 8px;font-size:12px;color:#0D1F6E;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">Contact</p>
                ${schoolPhone ? `<p style="margin:2px 0;font-size:13px;color:#334155;">📞 ${schoolPhone}</p>` : ''}
                ${schoolEmail ? `<p style="margin:2px 0;font-size:13px;color:#334155;">✉️ <a href="mailto:${schoolEmail}" style="color:#0D1F6E;text-decoration:none;">${schoolEmail}</a></p>` : ''}
                ${(schoolAddress || schoolCity) ? `<p style="margin:2px 0;font-size:13px;color:#334155;">📍 ${[schoolAddress, schoolCity].filter(Boolean).join(', ')}</p>` : ''}
              </div>
              ` : ''}

              <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;text-align:center;border-top:1px solid #e2e8f0;padding-top:16px;">
                Cet email a été envoyé automatiquement par Academia Helm au nom de ${schoolName}.<br/>
                Merci de ne pas répondre directement — utilisez les coordonnées ci-dessus.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0D1F6E;padding:20px 24px;text-align:center;">
              <div style="font-size:13px;color:#ffffff;font-weight:bold;">${schoolName}</div>
              <div style="font-size:11px;color:#F5A623;margin-top:2px;">Géré par Academia Helm</div>
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
