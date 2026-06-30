/**
 * ============================================================================
 * ADMISSION NOTIFICATION SERVICE
 * ============================================================================
 *
 * Envoi d'emails aux parents/responsables légaux tout au long du cycle d'admission :
 *   1. Demande d'admission reçue   → notifyAdmissionReceived
 *
 * RÈGLES (alignées sur RecruitmentNotificationService) :
 *   - Toutes les notifications sont FIRE-AND-FORGET (.catch(log))
 *     → elles ne bloquent jamais l'action métier
 *   - Chaque email est personnalisé pour l'école tenante :
 *     * Header : logo + nom de l'école (depuis TenantIdentityProfile)
 *     * Footer : signature Academia Helm
 *   - Si l'email échoue, on log l'erreur et on continue — l'admission n'est pas affectée
 *
 * DEPENDENCIES :
 *   - EmailService (CommunicationModule)
 *   - PrismaService (DB access pour récupérer tenant, admission, branding)
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../../communication/services/email.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import {
  renderAdmissionReceived,
  TenantBranding,
} from '../admission-email-templates';

// Réutilise la fonction getTenantBranding du module RH pour DRY
// (on ne la ré-exporte pas directement pour éviter la dépendance circulaire,
// on instancie juste RecruitmentNotificationService dans le module students
// si besoin — mais ici on duplique la logique pour garder le module autonome).

@Injectable()
export class AdmissionNotificationService {
  private readonly logger = new Logger(AdmissionNotificationService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Récupère le branding (logo + nom + contact) du tenant.
   * Pattern aligné sur RecruitmentNotificationService.getTenantBranding.
   */
  async getTenantBranding(tenantId: string): Promise<TenantBranding> {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: {
          schoolName: true,
          logoUrl: true,
          address: true,
          phonePrimary: true,
          email: true,
        },
      });

      if (profile?.schoolName) {
        const apiBaseUrl = this.configService.get<string>('APP_PUBLIC_URL')
          || 'https://academia-helm-api.fly.dev';
        const logoUrl = profile.logoUrl
          ? `${apiBaseUrl}/api/tenants/${tenantId}/logo`
          : null;

        return {
          schoolName: profile.schoolName,
          schoolLogo: logoUrl,
          schoolAddress: profile.address,
          schoolPhone: profile.phonePrimary,
          schoolEmail: profile.email,
        };
      }

      // Fallback sur le tenant directement
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
      return {
        schoolName: tenant?.name || 'Établissement',
      };
    } catch (err: any) {
      this.logger.warn(`getTenantBranding failed for tenant ${tenantId}: ${err.message}`);
      return { schoolName: 'Établissement' };
    }
  }

  /**
   * Récupère le libellé d'une classe depuis son ID.
   */
  private async getClassLabel(classId?: string | null): Promise<string> {
    if (!classId) return 'Non spécifiée';
    try {
      const cls = await this.prisma.class.findUnique({
        where: { id: classId },
        select: { name: true, code: true },
      });
      return cls?.name || cls?.code || 'Classe inconnue';
    } catch {
      return 'Classe inconnue';
    }
  }

  /**
   * Récupère le libellé d'une année académique.
   */
  private async getAcademicYearLabel(academicYearId: string): Promise<string> {
    try {
      const year = await this.prisma.academicYear.findUnique({
        where: { id: academicYearId },
        select: { name: true },
      });
      return year?.name || 'Année académique';
    } catch {
      return 'Année académique';
    }
  }

  // ─── 1. DEMANDE D'ADMISSION REÇUE ──────────────────────────────────────────
  async notifyAdmissionReceived(params: {
    admissionId: string;
    tenantId: string;
    documentsSubmitted?: Array<{ type: string; fileName: string }>;
  }): Promise<void> {
    try {
      const [branding, admission] = await Promise.all([
        this.getTenantBranding(params.tenantId),
        this.prisma.admission.findUnique({
          where: { id: params.admissionId },
          select: {
            firstName: true,
            lastName: true,
            mainGuardianName: true,
            mainGuardianEmail: true,
            admissionNumber: true,
            academicYearId: true,
            requestedClassId: true,
            schoolLevelId: true,
            status: true,
          },
        }),
      ]);

      if (!admission) {
        this.logger.warn(`notifyAdmissionReceived: admission ${params.admissionId} introuvable`);
        return;
      }

      if (!admission.mainGuardianEmail) {
        this.logger.warn(
          `notifyAdmissionReceived: pas d'email responsable pour admission ${params.admissionId}`,
        );
        return;
      }

      const [academicYearLabel, requestedClassLabel] = await Promise.all([
        this.getAcademicYearLabel(admission.academicYearId),
        this.getClassLabel(admission.requestedClassId),
      ]);

      const childName = `${admission.firstName} ${admission.lastName}`;
      const childFirstName = admission.firstName || 'l\'élève';

      const { subject, html } = renderAdmissionReceived({
        branding,
        childName,
        childFirstName,
        guardianName: admission.mainGuardianName || 'Responsable',
        guardianEmail: admission.mainGuardianEmail,
        academicYearLabel,
        requestedClassLabel,
        admissionNumber: admission.admissionNumber,
        documentsSubmitted: params.documentsSubmitted || [],
      });

      await this.sendEmail(admission.mainGuardianEmail, subject, html, {
        fromName: branding.schoolName,
        category: 'ADMINISTRATIF',
        subCategory: 'admission_recue',
        tenantId: params.tenantId,
        recipientName: admission.mainGuardianName || undefined,
        recipientType: 'PARENT',
        relatedEntityId: params.admissionId,
        relatedEntityType: 'Admission',
      });
    } catch (err: any) {
      this.logger.error(
        `notifyAdmissionReceived failed: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Envoi d'email avec tracing (voie categorisée) + fallback simple.
   * Pattern aligné sur RecruitmentNotificationService.sendEmail.
   */
  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    options?: {
      fromName?: string;
      category?: 'ADMINISTRATIF' | 'COMMUNICATION' | 'SYSTEM';
      subCategory?: string;
      tenantId?: string;
      recipientName?: string;
      recipientType?: 'PARENT' | 'STAFF' | 'EXTERNE';
      relatedEntityId?: string;
      relatedEntityType?: string;
    },
  ): Promise<void> {
    const fromEmail =
      this.configService.get<string>('EMAIL_FROM_NOREPLY') ||
      'noreply@academiahelm.com';
    const fromName = options?.fromName || 'Academia Helm — Admissions';

    // Voie tracée (catégorisée)
    if (options?.category && options?.tenantId) {
      try {
        const result = await this.emailService.sendCategorized({
          tenantId: options.tenantId,
          category: options.category,
          subCategory: options.subCategory,
          module: 'students',
          to,
          toName: options.recipientName,
          recipientType: options.recipientType || 'PARENT',
          fromEmail,
          fromName,
          subject,
          html,
          triggeredBy: 'SYSTEM',
          relatedEntityId: options.relatedEntityId,
          relatedEntityType: options.relatedEntityType,
        });

        if (result.success) {
          this.logger.log(
            `📧 Email admission envoyé à ${to} — subject: "${subject.substring(0, 80)}" — logId=${result.logId}`,
          );
          return;
        } else {
          this.logger.error(
            `📧 Email admission categorisé FAILED pour ${to}: ${result.error} — fallback sendEmail`,
          );
        }
      } catch (err: any) {
        this.logger.error(
          `sendCategorized threw (will fallback to plain sendEmail): ${err.message}`,
        );
      }
    }

    // Fallback simple
    try {
      const result = await this.emailService.sendEmail({
        to,
        from: fromEmail,
        fromName,
        subject,
        html,
      });
      if (!result.success) {
        this.logger.error(`Email admission fallback FAILED pour ${to}`);
      }
    } catch (err: any) {
      this.logger.error(`Email admission fallback threw: ${err.message}`);
    }
  }
}
