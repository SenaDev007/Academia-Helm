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

  /**
   * Récupère le libellé d'un niveau scolaire (education_levels).
   * schoolLevelId est un UUID → on récupère le nom (MATERNELLE/PRIMAIRE/SECONDAIRE).
   */
  private async getEducationLevelLabel(levelId?: string | null): Promise<string | null> {
    if (!levelId) return null;
    try {
      const level = await this.prisma.educationLevel.findUnique({
        where: { id: levelId },
        select: { name: true },
      });
      return level?.name || null;
    } catch {
      return null;
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
            notes: true,
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

      const [academicYearLabel, classLabelFromClass, levelLabel] = await Promise.all([
        this.getAcademicYearLabel(admission.academicYearId),
        this.getClassLabel(admission.requestedClassId),
        this.getEducationLevelLabel(admission.schoolLevelId),
      ]);

      // La classe souhaitée : priorité au libellé de la classe (UUID), sinon
      // extraire depuis notes (format "Classe souhaitée : Maternelle 1 (M1)"),
      // sinon utiliser le nom du niveau scolaire (MATERNELLE/PRIMAIRE/SECONDAIRE).
      let requestedClassLabel = classLabelFromClass;
      if (requestedClassLabel === 'Non spécifiée' && admission.notes) {
        const match = admission.notes.match(/Classe souhaitée\s*:\s*(.+)/i);
        if (match) {
          requestedClassLabel = match[1].trim();
        }
      }
      if (requestedClassLabel === 'Non spécifiée' && levelLabel) {
        requestedClassLabel = levelLabel;
      }

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

  // ─── 2. ADMISSION CONVERTIE — inscription confirmée ──────────────────────
  async notifyAdmissionConverted(params: {
    admissionId: string;
    tenantId: string;
    studentId: string;
  }): Promise<void> {
    try {
      const [branding, admission, student] = await Promise.all([
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
            schoolLevelId: true,
          },
        }),
        this.prisma.student.findUnique({
          where: { id: params.studentId },
          select: {
            tenantMatricule: true,
            globalMatricule: true,
            studentEnrollments: {
              take: 1,
              orderBy: { enrollmentDate: 'desc' },
              include: { class: { select: { name: true } } },
            },
          },
        }),
      ]);

      if (!admission || !student) return;
      if (!admission.mainGuardianEmail) return;

      const [academicYearLabel, levelLabel] = await Promise.all([
        this.getAcademicYearLabel(admission.academicYearId),
        this.getEducationLevelLabel(admission.schoolLevelId),
      ]);

      const childName = `${admission.firstName} ${admission.lastName}`;
      const className = student.studentEnrollments?.[0]?.class?.name || levelLabel || 'Non spécifiée';
      const matricule = student.tenantMatricule || student.globalMatricule || 'Non attribué';

      // Email simple HTML (pas de template externe pour rester autonome)
      const subject = `🎉 Inscription confirmée — ${childName} chez ${branding.schoolName}`;
      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:linear-gradient(160deg,#0D1F6E 0%,#0D3B85 100%);padding:28px 24px;text-align:center;border-bottom:3px solid #F5A623;">
            ${branding.schoolLogo ? `<img src="${branding.schoolLogo}" alt="${branding.schoolName}" style="max-height:64px;max-width:180px;object-fit:contain;display:block;margin:0 auto 14px;" />` : ''}
            <div style="font-size:22px;font-weight:bold;color:#ffffff;">${branding.schoolName}</div>
            <div style="font-size:13px;color:#F5A623;margin-top:4px;">Admission</div>
          </div>
          <div style="padding:32px 28px;background:#f8fafc;">
            <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:999px;padding:8px 14px;display:inline-block;color:#047857;font-size:13px;font-weight:bold;margin-bottom:20px;">🎉 Inscription confirmée</div>
            <p style="font-size:15px;color:#0f172a;line-height:1.6;">Bonjour <strong>${admission.mainGuardianName || 'Responsable'}</strong>,</p>
            <p style="font-size:14px;color:#334155;line-height:1.6;">
              Nous avons le plaisir de vous confirmer que l'inscription de
              <strong>${childName}</strong> est désormais officiellement validée
              pour l'année scolaire <strong>${academicYearLabel}</strong>.
            </p>
            <table style="width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin:20px 0;padding:16px;">
              <tr><td style="padding:4px 0;font-size:13px;color:#64748b;">Élève :</td><td style="font-size:13px;font-weight:600;color:#0f172a;">${childName}</td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#64748b;">Classe :</td><td style="font-size:13px;font-weight:600;color:#0f172a;">${className}</td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#64748b;">Matricule :</td><td style="font-size:13px;font-weight:600;color:#1e40af;font-family:monospace;">${matricule}</td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#64748b;">Année scolaire :</td><td style="font-size:13px;font-weight:600;color:#0f172a;">${academicYearLabel}</td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#64748b;">Établissement :</td><td style="font-size:13px;font-weight:600;color:#0f172a;">${branding.schoolName}</td></tr>
            </table>
            <p style="font-size:13px;color:#475569;line-height:1.6;">
              Le matricule de l'élève est <strong style="color:#1e40af;">${matricule}</strong>.
              Conservez-le précieusement, il vous sera demandé pour toute communication
              avec l'établissement. Votre enfant fait désormais partie officiellement
              de notre communauté éducative.
            </p>
            <p style="font-size:13px;color:#475569;line-height:1.6;margin-top:16px;">
              Cordialement,<br/><strong>Service des Admissions</strong><br/><em>${branding.schoolName}</em>
            </p>
          </div>
          <div style="background:#0D1F6E;padding:24px 28px;text-align:center;">
            <div style="font-size:15px;font-weight:bold;color:#ffffff;">Academia Helm</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:4px;">Plateforme de pilotage éducatif</div>
          </div>
        </div>
      `;

      await this.sendEmail(admission.mainGuardianEmail, subject, html, {
        fromName: branding.schoolName,
        category: 'ADMINISTRATIF',
        subCategory: 'inscription_confirmee',
        tenantId: params.tenantId,
        recipientName: admission.mainGuardianName || undefined,
        recipientType: 'PARENT',
        relatedEntityId: params.studentId,
        relatedEntityType: 'Student',
      });
    } catch (err: any) {
      this.logger.error(
        `notifyAdmissionConverted failed: ${err.message}`,
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
