/**
 * ============================================================================
 * DISCIPLINE NOTIFICATION SERVICE
 * ============================================================================
 *
 * Notifie le parent (via WhatsApp Business API + fallback SMS) quand une
 * sanction comportementale est créée ou annulée par le Surveillant Général.
 *
 * Patterns réutilisés :
 * - WhatsAppService.sendCategorized() avec template Meta v3 (sanction_created)
 * - SmsService.sendSMS() en fallback si WhatsApp échoue
 * - ReceiptFinanceService.getParentContacts() pattern pour récupérer le tuteur
 *
 * Fire-and-forget — ne bloque JAMAIS l'API de saisie de sanction. Le SG
 * doit pouvoir créer sa sanction rapidement, la notification part en arrière-plan.
 *
 * Différenciateur marché : aucun concurrent béninois (SuccèsSco, Pronote) ne
 * notifie WhatsApp sur sanction disciplinaire.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { WhatsAppService } from '../../communication/services/whatsapp.service';
import { SmsService } from '../../communication/services/sms.service';

export interface SanctionNotificationPayload {
  tenantId: string;
  sanctionId: string;
  studentId: string;
  academicYearId: string;
  faultName: string;
  hoursAttributed: number;
  pointsDeducted: number;
  conductReference?: number; // défaut 20
  conductRemaining?: number; // après déduction
  sanctionDate?: Date;
  triggeredByUserId?: string;
}

export interface SanctionCancellationPayload {
  tenantId: string;
  sanctionId: string;
  studentId: string;
  academicYearId: string;
  faultName: string;
  pointsRefunded: number;
  newConduct?: number; // après restitution
  cancellationReason: string;
  triggeredByUserId?: string;
}

export interface NotificationResult {
  channels: {
    whatsapp?: { status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string; logId?: string };
    sms?: { status: 'sent' | 'failed' | 'skipped'; to?: string; error?: string };
  };
  parentContact: { phone?: string; name?: string; found: boolean };
}

@Injectable()
export class DisciplineNotificationService {
  private readonly logger = new Logger(DisciplineNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsAppService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * Notifie le parent qu'une sanction a été saisie.
   * Tente WhatsApp d'abord, fallback SMS si WhatsApp échoue ou pas de numéro WhatsApp.
   * Fire-and-forget — ne lance jamais d'erreur.
   */
  async notifyParentSanctionCreated(payload: SanctionNotificationPayload): Promise<NotificationResult> {
    const result: NotificationResult = {
      channels: {},
      parentContact: { found: false },
    };

    try {
      // 1. Récupérer les contacts du tuteur principal
      const contact = await this.getParentContacts(payload.studentId);
      result.parentContact = {
        phone: contact.phone,
        name: contact.name,
        found: !!contact.phone,
      };

      if (!contact.phone) {
        this.logger.warn(
          `notifyParentSanctionCreated: Aucun numéro de téléphone pour le tuteur de l'élève ${payload.studentId} — notification skipped`,
        );
        result.channels.whatsapp = { status: 'skipped', error: 'No parent phone' };
        result.channels.sms = { status: 'skipped', error: 'No parent phone' };
        return result;
      }

      // 2. Récupérer le nom de l'élève
      const student = await this.prisma.student.findUnique({
        where: { id: payload.studentId },
        select: { firstName: true, lastName: true },
      });
      const studentName = student ? `${student.firstName} ${student.lastName}` : 'l\'élève';

      // 3. Récupérer le nom de l'école (pour fallback SMS)
      const schoolName = await this.getSchoolName(payload.tenantId);

      // 4. Calculer la conduite restante
      const conductRef = payload.conductReference ?? 20;
      const conductRemaining = payload.conductRemaining ?? Math.max(0, conductRef - payload.pointsDeducted);
      const sanctionDateStr = (payload.sanctionDate ?? new Date()).toLocaleDateString('fr-FR');

      // 5. Tenter WhatsApp (template Meta v3)
      try {
        const waResult = await this.whatsappService.sendCategorized({
          tenantId: payload.tenantId,
          category: 'PEDAGOGIE',
          module: 'discipline',
          subCategory: 'sanction_created',
          to: contact.phone,
          toName: contact.name,
          recipientType: 'PARENT',
          recipientId: undefined,
          message: `Sanction: ${payload.faultName} - ${payload.hoursAttributed}h -${payload.pointsDeducted}pts pour ${studentName}`,
          templateName: 'sanction_created',
          templateVariables: {
            parent_name: contact.name || 'Parent',
            student_name: studentName,
            school_name: schoolName,
            fault_name: payload.faultName,
            hours_attributed: String(payload.hoursAttributed),
            points_deducted: String(payload.pointsDeducted),
            conduct_remaining: String(conductRemaining),
            sanction_date: sanctionDateStr,
          },
          triggeredBy: 'STAFF',
          triggeredByUserId: payload.triggeredByUserId,
          relatedEntityId: payload.sanctionId,
          relatedEntityType: 'Sanction',
        } as any);

        if (waResult.success) {
          result.channels.whatsapp = {
            status: 'sent',
            to: contact.phone,
            logId: waResult.logId,
          };
          this.logger.log(
            `✅ WhatsApp sanction_created envoyé à ${contact.phone} pour sanction ${payload.sanctionId}`,
          );
          return result;
        } else {
          result.channels.whatsapp = {
            status: 'failed',
            to: contact.phone,
            error: waResult.error,
          };
          this.logger.warn(
            `⚠️ WhatsApp sanction_created échoué pour ${contact.phone}: ${waResult.error} — fallback SMS`,
          );
        }
      } catch (waErr: any) {
        result.channels.whatsapp = {
          status: 'failed',
          to: contact.phone,
          error: waErr.message,
        };
        this.logger.warn(
          `⚠️ WhatsApp sanction_created exception pour ${contact.phone}: ${waErr.message} — fallback SMS`,
        );
      }

      // 6. Fallback SMS
      try {
        const smsMessage = `Academia Helm - Sanction notifiee a ${studentName}: ${payload.faultName}. Heures: ${payload.hoursAttributed}. Points deduits: ${payload.pointsDeducted}. Conduite restante: ${conductRemaining}/20. Date: ${sanctionDateStr}. Contactez l'etablissement pour plus d'informations.`;
        const smsResult = await this.smsService.sendSMS(contact.phone, smsMessage);
        if (smsResult.success) {
          result.channels.sms = { status: 'sent', to: contact.phone };
          this.logger.log(`✅ SMS fallback sanction envoyé à ${contact.phone}`);
        } else {
          result.channels.sms = {
            status: 'failed',
            to: contact.phone,
            error: 'SMS provider returned failure',
          };
          this.logger.error(`❌ SMS fallback sanction échoué pour ${contact.phone}`);
        }
      } catch (smsErr: any) {
        result.channels.sms = {
          status: 'failed',
          to: contact.phone,
          error: smsErr.message,
        };
        this.logger.error(`❌ SMS fallback sanction exception pour ${contact.phone}: ${smsErr.message}`);
      }
    } catch (err: any) {
      this.logger.error(
        `❌ notifyParentSanctionCreated erreur globale: ${err.message}`,
        err.stack,
      );
    }

    return result;
  }

  /**
   * Notifie le parent qu'une sanction a été annulée (points restitués).
   */
  async notifyParentSanctionCancelled(payload: SanctionCancellationPayload): Promise<NotificationResult> {
    const result: NotificationResult = {
      channels: {},
      parentContact: { found: false },
    };

    try {
      const contact = await this.getParentContacts(payload.studentId);
      result.parentContact = {
        phone: contact.phone,
        name: contact.name,
        found: !!contact.phone,
      };

      if (!contact.phone) {
        result.channels.whatsapp = { status: 'skipped', error: 'No parent phone' };
        result.channels.sms = { status: 'skipped', error: 'No parent phone' };
        return result;
      }

      const student = await this.prisma.student.findUnique({
        where: { id: payload.studentId },
        select: { firstName: true, lastName: true },
      });
      const studentName = student ? `${student.firstName} ${student.lastName}` : 'l\'élève';
      const schoolName = await this.getSchoolName(payload.tenantId);
      const newConduct = payload.newConduct ?? 20;

      // Tenter WhatsApp (template sanction_cancelled)
      try {
        const waResult = await this.whatsappService.sendCategorized({
          tenantId: payload.tenantId,
          category: 'PEDAGOGIE',
          module: 'discipline',
          subCategory: 'sanction_cancelled',
          to: contact.phone,
          toName: contact.name,
          recipientType: 'PARENT',
          message: `Sanction annulée: ${payload.faultName} +${payload.pointsRefunded}pts pour ${studentName}`,
          templateName: 'sanction_cancelled',
          templateVariables: {
            parent_name: contact.name || 'Parent',
            student_name: studentName,
            school_name: schoolName,
            fault_name: payload.faultName,
            points_refunded: String(payload.pointsRefunded),
            new_conduct: String(newConduct),
            cancellation_reason: payload.cancellationReason,
          },
          triggeredBy: 'STAFF',
          triggeredByUserId: payload.triggeredByUserId,
          relatedEntityId: payload.sanctionId,
          relatedEntityType: 'Sanction',
        } as any);

        if (waResult.success) {
          result.channels.whatsapp = { status: 'sent', to: contact.phone, logId: waResult.logId };
          this.logger.log(`✅ WhatsApp sanction_cancelled envoyé à ${contact.phone}`);
          return result;
        } else {
          result.channels.whatsapp = { status: 'failed', to: contact.phone, error: waResult.error };
        }
      } catch (waErr: any) {
        result.channels.whatsapp = { status: 'failed', to: contact.phone, error: waErr.message };
      }

      // Fallback SMS
      try {
        const smsMessage = `Academia Helm - La sanction (${payload.faultName}) notifiee a ${studentName} a ete annulee. Points restitues: ${payload.pointsRefunded}. Nouvelle conduite: ${newConduct}/20. Motif: ${payload.cancellationReason}.`;
        const smsResult = await this.smsService.sendSMS(contact.phone, smsMessage);
        if (smsResult.success) {
          result.channels.sms = { status: 'sent', to: contact.phone };
        } else {
          result.channels.sms = { status: 'failed', to: contact.phone, error: 'SMS provider returned failure' };
        }
      } catch (smsErr: any) {
        result.channels.sms = { status: 'failed', to: contact.phone, error: smsErr.message };
      }
    } catch (err: any) {
      this.logger.error(`❌ notifyParentSanctionCancelled erreur globale: ${err.message}`, err.stack);
    }

    return result;
  }

  // ─── HELPERS ───────────────────────────────────────────────────────────

  /**
   * Récupère les contacts du tuteur principal d'un élève.
   * Pattern identique à ReceiptFinanceService.getParentContacts().
   */
  private async getParentContacts(studentId: string): Promise<{ phone?: string; name?: string }> {
    const sgs = await this.prisma.studentGuardian.findMany({
      where: { studentId, isPrimary: true },
      include: { guardian: true },
      take: 1,
    });
    if (sgs.length === 0) {
      const anySg = await this.prisma.studentGuardian.findFirst({
        where: { studentId },
        include: { guardian: true },
      });
      if (!anySg) return {};
      return {
        phone: anySg.guardian?.phone || undefined,
        name: anySg.guardian ? `${anySg.guardian.firstName} ${anySg.guardian.lastName}` : undefined,
      };
    }
    const g = sgs[0].guardian;
    return {
      phone: g?.phone || undefined,
      name: g ? `${g.firstName} ${g.lastName}` : undefined,
    };
  }

  /**
   * Récupère le nom de l'école pour le fallback SMS.
   */
  private async getSchoolName(tenantId: string): Promise<string> {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: { schoolName: true },
      });
      return profile?.schoolName || 'Academia Helm';
    } catch {
      return 'Academia Helm';
    }
  }
}
