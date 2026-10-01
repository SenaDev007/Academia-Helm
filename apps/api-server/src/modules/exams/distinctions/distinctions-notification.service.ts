/**
 * ============================================================================
 * DISTINCTIONS NOTIFICATION SERVICE
 * ============================================================================
 *
 * Envoie les certificats de distinction aux parents via :
 *   1. Email (EmailService.sendCategorized) — PDF en pièce jointe
 *   2. Helm Connect chat (ChatService.sendAttachmentMessage) — PDF dans le chat parent
 *   3. Bell-icon InAppNotification (NotificationService.create) — notification UI
 *
 * Pattern rigoureusement identique au module Finance (Encaissement) :
 *   - Fire-and-forget (chaque canal en try/catch, jamais bloquant)
 *   - PDF Buffer passé directement à Nodemailer (pas de base64)
 *   - ParentUserProvisioningService pour résoudre le User du parent
 * ============================================================================
 */

import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EmailService } from '../../../communication/services/email.service';
import { ChatService } from '../../../communication/services/chat.service';
import { NotificationService } from '../../../notifications/notification.service';
import { ParentUserProvisioningService } from '../../../students/services/parent-user-provisioning.service';
import { renderEmail, escHtml } from '../../../hr/recruitment-email-templates';
import { buildCertificateHtml } from './html-builder';
import type { DistinctionInput, Level } from './html-builder';

@Injectable()
export class DistinctionsNotificationService {
  private readonly logger = new Logger(DistinctionsNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly chatService: ChatService,
    private readonly notificationService: NotificationService,
    private readonly parentUserProvisioningService: ParentUserProvisioningService,
  ) {}

  /**
   * Récupère les contacts du parent (email, nom) depuis StudentGuardian
   */
  private async getParentContacts(studentId: string, tenantId: string) {
    const guardians = await this.prisma.studentGuardian.findMany({
      where: { studentId, tenantId },
      include: { guardian: true },
    }).catch(() => []);

    const primary = guardians.find(g => g.isPrimary) || guardians[0];
    if (!primary?.guardian) return null;

    return {
      email: primary.guardian.email || null,
      name: `${primary.guardian.firstName || ''} ${primary.guardian.lastName || ''}`.trim() || 'Parent',
      guardianId: primary.guardian.id,
    };
  }

  /**
   * Récupère le branding du tenant
   */
  private async getBranding(tenantId: string) {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: { schoolName: true, logoUrl: true },
      });
      return {
        schoolName: profile?.schoolName || 'Établissement',
        logoUrl: profile?.logoUrl || undefined,
      };
    } catch {
      return { schoolName: 'Établissement' };
    }
  }

  /**
   * Envoie un certificat de distinction à un élève via email + Helm Connect + bell icon
   */
  async sendDistinctionNotification(
    tenantId: string,
    studentId: string,
    studentName: string,
    distinctionLabel: string,
    distinctionCode: string,
    pdfBuffer: Buffer,
    periodLabel: string,
    className: string,
    triggeredByUserId: string,
  ): Promise<{ email?: string; helmConnect?: string; bellIcon?: string }> {
    const results: { email?: string; helmConnect?: string; bellIcon?: string } = {};
    const parent = await this.getParentContacts(studentId, tenantId);
    const branding = await this.getBranding(tenantId);

    if (!parent) {
      this.logger.warn(`Aucun parent trouvé pour l'élève ${studentId}`);
      return results;
    }

    // ── 1. EMAIL ──────────────────────────────────────────────────────────
    if (parent.email) {
      try {
        const subject = `Tableau d'honneur — ${studentName} — ${distinctionLabel}`;
        const bodyContent = `
          <div style="padding:24px 0;">
            <h2 style="color:#0A2A5E;font-size:22px;margin-bottom:16px;">🎓 Tableau d'honneur</h2>
            <p>Bonjour ${escHtml(parent.name)},</p>
            <p>Nous avons le plaisir de vous annoncer que <strong>${escHtml(studentName)}</strong>,
            élève en <strong>${escHtml(className)}</strong>, a obtenu la mention
            <strong style="color:#B45309;">${escHtml(distinctionLabel)}</strong>
            pour la période <strong>${escHtml(periodLabel)}</strong>.</p>
            <p>Le certificat officiel est joint à cet email.</p>
            <p>Félicitations à votre enfant pour cette belle distinction !</p>
            <p style="margin-top:24px;color:#64748b;font-size:14px;">Cordialement,<br/>La Direction — ${escHtml(branding.schoolName)}</p>
          </div>
        `;
        const html = renderEmail(
          { schoolName: branding.schoolName, logoUrl: branding.logoUrl } as any,
          bodyContent,
          'Distinctions',
        );

        await this.emailService.sendCategorized({
          tenantId,
          category: 'PEDAGOGIE',
          subCategory: 'DISTINCTION',
          module: 'exams',
          to: parent.email,
          toName: parent.name,
          recipientType: 'PARENT',
          subject,
          html,
          text: `Tableau d'honneur — ${studentName} a obtenu la mention ${distinctionLabel} pour ${periodLabel}`,
          fromName: branding.schoolName || 'Academia Helm',
          triggeredBy: 'SYSTEM',
          relatedEntityType: 'Distinction',
          relatedEntityId: studentId,
          attachments: [{
            filename: `certificat_${distinctionCode}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          }],
        } as any);
        results.email = 'sent';
        this.logger.log(`Email envoyé à ${parent.email} pour ${studentName}`);
      } catch (err: any) {
        results.email = `failed: ${err.message}`;
        this.logger.error(`Email échoué pour ${studentName}: ${err.message}`);
      }
    }

    // ── 2. HELM CONNECT CHAT ──────────────────────────────────────────────
    try {
      const provisioning = await this.parentUserProvisioningService
        .ensureUserForPrimaryGuardianOfStudent(tenantId, studentId);

      if (provisioning?.userId) {
        const conversation = await this.chatService.createOrGetDirectConversation(
          tenantId,
          triggeredByUserId,
          provisioning.userId,
        );

        const caption = [
          `🎓 <b>Tableau d'honneur</b>`,
          ``,
          `Bonjour ${escHtml(parent.name)},`,
          `Nous avons le plaisir de vous annoncer que ${escHtml(studentName)},`,
          `élève en ${escHtml(className)}, a obtenu la mention :`,
          `<b>${escHtml(distinctionLabel)}</b>`,
          `pour la période ${escHtml(periodLabel)}.`,
          ``,
          `Félicitations !`,
          `Cordialement,`,
          `La Direction — ${escHtml(branding.schoolName)}`,
        ].join('\n');

        const fakeFile = {
          buffer: pdfBuffer,
          originalname: `certificat_${distinctionCode}.pdf`,
          mimetype: 'application/pdf',
          size: pdfBuffer.length,
          fieldname: 'file',
          encoding: '7bit',
          destination: '',
          filename: `certificat_${distinctionCode}.pdf`,
          path: '',
        } as unknown as Express.Multer.File;

        await this.chatService.sendAttachmentMessage(
          tenantId,
          triggeredByUserId,
          conversation.id,
          { type: 'DOCUMENT', file: fakeFile, content: caption },
        );
        results.helmConnect = 'sent';
        this.logger.log(`Helm Connect envoyé à ${parent.name} pour ${studentName}`);

        // ── 3. BELL ICON NOTIFICATION ────────────────────────────────────
        try {
          await this.notificationService.create({
            tenantId,
            recipientId: provisioning.userId,
            type: 'DISTINCTION_AWARDED',
            title: `Tableau d'honneur — ${studentName}`,
            body: `Félicitations ! Votre enfant a obtenu la mention « ${distinctionLabel} » pour ${periodLabel}.`,
            priority: 'HIGH',
            data: { url: '/app/parent', distinctionLabel, studentName },
            relatedEntityType: 'Distinction',
            relatedEntityId: studentId,
          });
          results.bellIcon = 'sent';
          this.logger.log(`Bell icon envoyé pour ${studentName}`);
        } catch (err: any) {
          results.bellIcon = `failed: ${err.message}`;
          this.logger.error(`Bell icon échoué pour ${studentName}: ${err.message}`);
        }
      }
    } catch (err: any) {
      results.helmConnect = `failed: ${err.message}`;
      this.logger.error(`Helm Connect échoué pour ${studentName}: ${err.message}`);
    }

    return results;
  }
}
