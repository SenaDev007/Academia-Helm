/**
 * ============================================================================
 * COMPTA AUTO EXPORT SERVICE — Export comptable automatique mensuel
 * ============================================================================
 *
 * Cron job quotidien qui vérifie pour chaque tenant si un export comptable
 * doit être envoyé (jour du mois = comptaAutoExportDay) et envoie le fichier
 * par email au comptable configuré.
 *
 * Période exportée : du 1er au dernier jour du mois précédent.
 * Format : FEC (France), OHADA (Bénin), CSV (universel) — selon config.
 *
 * Anti-doublon : comptaAutoExportLastSent mémorise le dernier envoi pour
 * éviter les renvois si le cron s'exécute plusieurs fois le même jour.
 *
 * Référence : docs/INTEGRATION-COMPTABILITE.md — Phase 4
 * ============================================================================
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { ComptaExportService } from './compta-export.service';
import { EmailService } from '../communication/services/email.service';

@Injectable()
export class ComptaAutoExportService {
  private readonly logger = new Logger(ComptaAutoExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly comptaExportService: ComptaExportService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Cron job : vérifie tous les jours à 08:00 si des exports doivent être envoyés.
   */
  @Cron('0 8 * * *') // Tous les jours à 08:00
  async handleScheduledComptaExport() {
    this.logger.log('Vérification des exports comptables automatiques...');

    const tenantsWithAutoExport = await this.prisma.financialSettings.findMany({
      where: { comptaAutoExportEnabled: true },
      select: {
        tenantId: true,
        comptaAutoExportEmail: true,
        comptaAutoExportFormat: true,
        comptaAutoExportDay: true,
        comptaAutoExportLastSent: true,
      },
    });

    const today = new Date();
    const todayDay = today.getDate();

    for (const settings of tenantsWithAutoExport) {
      try {
        // Vérifier si on est le jour prévu pour l'envoi
        if (todayDay !== settings.comptaAutoExportDay) {
          continue;
        }

        // Anti-doublon : vérifier qu'on n'a pas déjà envoyé ce mois-ci
        if (settings.comptaAutoExportLastSent) {
          const lastSent = new Date(settings.comptaAutoExportLastSent);
          const sameMonth =
            lastSent.getFullYear() === today.getFullYear() &&
            lastSent.getMonth() === today.getMonth();
          if (sameMonth) {
            this.logger.log(
              `Tenant ${settings.tenantId}: export déjà envoyé ce mois-ci (${lastSent.toISOString()}) — skip`,
            );
            continue;
          }
        }

        // Vérifier que l'email du comptable est bien configuré
        if (!settings.comptaAutoExportEmail) {
          this.logger.warn(
            `Tenant ${settings.tenantId}: comptaAutoExportEnabled=true mais aucun email configuré — skip`,
          );
          continue;
        }

        await this.sendAutoExportForTenant(settings.tenantId, settings);
      } catch (err) {
        this.logger.error(
          `Erreur export auto tenant ${settings.tenantId}: ${err.message}`,
          err.stack,
        );
      }
    }

    this.logger.log(
      `Vérification terminée : ${tenantsWithAutoExport.length} tenant(s) avec export auto activé.`,
    );
  }

  /**
   * Envoie l'export comptable mensuel pour un tenant.
   * Méthode publique pour permettre le déclenchement manuel (endpoint admin).
   */
  async sendAutoExportForTenant(
    tenantId: string,
    settings: {
      comptaAutoExportEmail: string | null;
      comptaAutoExportFormat: string;
      comptaAutoExportDay: number;
      comptaAutoExportLastSent: Date | null;
    },
  ): Promise<{ success: boolean; message: string }> {
    if (!settings.comptaAutoExportEmail) {
      return { success: false, message: 'Aucun email destinataire configuré' };
    }

    // Calculer la période : mois précédent complet (1er au dernier jour)
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    const dateFrom = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;
    const dateTo = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfLastMonth).padStart(2, '0')}`;

    this.logger.log(
      `Tenant ${tenantId}: génération export ${settings.comptaAutoExportFormat} pour la période ${dateFrom} → ${dateTo}`,
    );

    // Récupérer l'année scolaire active pour ce tenant
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
      select: { id: true },
    });

    // Générer les écritures
    const ecritures = await this.comptaExportService.getAllEcritures(tenantId, {
      dateFrom,
      dateTo,
      academicYearId: academicYear?.id,
    });

    if (ecritures.length === 0) {
      this.logger.warn(`Tenant ${tenantId}: aucune écriture pour la période ${dateFrom} → ${dateTo}`);
      // On envoie quand même un email d'information (pas d'écritures)
    }

    // Générer le contenu du fichier selon le format
    const format = (settings.comptaAutoExportFormat || 'OHADA').toUpperCase();
    let fileContent: string;
    let fileName: string;
    let mimeType: string;

    if (format === 'FEC') {
      fileContent = this.comptaExportService.generateFecContent(ecritures);
      fileName = this.comptaExportService.generateFileName('fec', { dateFrom, dateTo });
      mimeType = 'text/plain';
    } else if (format === 'CSV') {
      fileContent = this.comptaExportService.generateUniversalCsvContent(ecritures);
      fileName = this.comptaExportService.generateFileName('csv', { dateFrom, dateTo });
      mimeType = 'text/csv';
    } else {
      // OHADA par défaut
      fileContent = this.comptaExportService.generateOhadaCsvContent(ecritures);
      fileName = this.comptaExportService.generateFileName('ohada', { dateFrom, dateTo });
      mimeType = 'text/csv';
    }

    // Récupérer le nom de l'établissement pour personnaliser l'email
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    const schoolName = tenant?.name || 'Votre établissement';

    // Construire l'email HTML
    const monthLabel = lastMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const formatLabel = format === 'FEC' ? 'FEC (Fichier d\'Écritures Comptables — France)' : format === 'CSV' ? 'CSV universel' : 'OHADA (Bénin)';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0D1F6E 0%, #1E40AF 100%); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Export comptable mensuel</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 6px 0 0; font-size: 14px;">${schoolName}</p>
        </div>
        <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin: 0 0 16px; color: #1e293b; font-size: 15px;">
            Bonjour,
          </p>
          <p style="margin: 0 0 16px; color: #475569; font-size: 14px; line-height: 1.6;">
            Veuillez trouver ci-joint l'export comptable du mois de <strong>${monthLabel}</strong>
            pour <strong>${schoolName}</strong>, au format <strong>${formatLabel}</strong>.
          </p>

          <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 8px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
              Récapitulatif
            </p>
            <table style="width: 100%; font-size: 14px; color: #1e293b;">
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Période :</td>
                <td style="padding: 4px 0; font-weight: 600; text-align: right;">${dateFrom} → ${dateTo}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Format :</td>
                <td style="padding: 4px 0; font-weight: 600; text-align: right;">${formatLabel}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Nombre d'écritures :</td>
                <td style="padding: 4px 0; font-weight: 600; text-align: right;">${ecritures.length}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Fichier joint :</td>
                <td style="padding: 4px 0; font-weight: 600; text-align: right; font-family: monospace; font-size: 12px;">${fileName}</td>
              </tr>
            </table>
          </div>

          <p style="margin: 16px 0; color: #475569; font-size: 14px; line-height: 1.6;">
            Ce fichier est directement importable dans votre logiciel comptable
            (Sage, Ciel, EBP, QuickBooks, Pennylane, Odoo, etc.).
            Consultez la documentation de votre logiciel pour la procédure d'import.
          </p>

          <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px; margin: 16px 0;">
            <p style="margin: 0; color: #92400e; font-size: 13px;">
              ⚠️ Cet email a été envoyé automatiquement par Academia Helm. Pour modifier
              la fréquence, le format ou le destinataire, connectez-vous à votre espace
              et rendez-vous dans <em>Finance → Paramètres → Export comptable automatique</em>.
            </p>
          </div>

          <p style="margin: 24px 0 0; color: #64748b; font-size: 12px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Academia Helm — ERP scolaire institutionnel<br/>
            Email automatique — ne pas répondre
          </p>
        </div>
      </div>
    `;

    // Envoyer l'email avec pièce jointe
    await this.emailService.sendEmail({
      to: settings.comptaAutoExportEmail,
      subject: `[${schoolName}] Export comptable — ${monthLabel}`,
      html,
      attachments: [
        {
          filename: fileName,
          content: format === 'FEC' ? fileContent : '\uFEFF' + fileContent, // BOM UTF-8 pour CSV
        },
      ],
    });

    // Mettre à jour la date du dernier envoi
    await this.prisma.financialSettings.update({
      where: { tenantId },
      data: { comptaAutoExportLastSent: new Date() },
    });

    this.logger.log(
      `Tenant ${tenantId}: export ${format} envoyé à ${settings.comptaAutoExportEmail} (${ecritures.length} écritures, ${fileName})`,
    );

    return {
      success: true,
      message: `Export envoyé à ${settings.comptaAutoExportEmail} (${ecritures.length} écritures)`,
    };
  }
}
