/**
 * ============================================================================
 * PEDAGOGY NOTIFICATION SERVICE — Envoi d'emails aux enseignants
 * ============================================================================
 *
 * Service pour l'envoi d'emails de notification aux enseignants depuis le
 * module Pédagogie. Deux modes d'envoi :
 *
 *   1. notifyTeacher()   → envoi individuel (bouton « Notifier » sur fiche)
 *   2. notifyTeachers()  → envoi groupé (bouton « Notifier tous » toolbar)
 *
 * RÈGLES :
 *   - Chaque envoi passe par EmailService.sendCategorized() pour traçabilité
 *     (EmailLog avec category=PEDAGOGIE, subCategory=TEACHER_NOTIFICATION).
 *   - Les envois groupés sont SÉQUENTIELS (for...of + await) — pas de
 *     Promise.all — pour éviter le rate-limiting du provider Resend et
 *     pouvoir tracer chaque envoi individuellement dans les logs.
 *   - Si un envoi échoue (email invalide, provider HS), on log l'erreur et on
 *     continue vers le prochain enseignant — on ne bloque pas tout le batch.
 *   - Retourne un récapitulatif détaillé { sent, failed, skipped, results[] }
 *     que le frontend peut afficher à l'utilisateur.
 *
 * DEPENDENCIES :
 *   - EmailService (CommunicationModule) — envoi réel via Resend/SMTP/mock
 *   - PrismaService — fetch Teacher (email, nom, niveau) + Tenant branding
 *   - ConfigService — APP_PUBLIC_URL pour le logo du tenant
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../communication/services/email.service';
import { PrismaService } from '../database/prisma.service';
import { TenantBranding } from '../hr/recruitment-email-templates';
import { renderPedagogyNotificationEmail } from './pedagogy-email-templates';

export interface NotifyTeacherParams {
  teacherId: string;
  tenantId: string;
  subject: string;
  message: string;
  /** ID utilisateur qui déclenche l'envoi (pour audit) */
  triggeredByUserId?: string;
  /** Nom affiché de l'émetteur (ex: "M. Directeur") */
  senderName?: string;
  /** Fonction de l'émetteur (ex: "Directeur pédagogique") */
  senderFunction?: string;
}

export interface NotifyBatchParams extends Omit<NotifyTeacherParams, 'teacherId'> {
  teacherIds: string[];
}

export interface NotifyResult {
  teacherId: string;
  teacherName: string;
  email: string;
  success: boolean;
  error?: string;
  logId?: string;
}

export interface BatchNotifyResult {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  results: NotifyResult[];
}

@Injectable()
export class PedagogyNotificationService {
  private readonly logger = new Logger(PedagogyNotificationService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Récupère le branding du tenant (logo + nom + contact) pour personnaliser
   * l'email. Réutilise la même logique que RecruitmentNotificationService
   * pour rester cohérent visuellement avec les autres emails de la plateforme.
   */
  async getTenantBranding(tenantId: string): Promise<TenantBranding> {
    try {
      // 1. Identité école (logo + nom + contact)
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

      // 2. Fallback sur le nom du tenant
      const tenant = !profile?.schoolName
        ? await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { name: true },
          })
        : null;

      const schoolName = profile?.schoolName || tenant?.name || 'Établissement';

      // Logo : utiliser l'URL publique servie par l'API
      // (GET /api/tenants/:tenantId/logo) plutôt que le base64 — plus léger
      // pour l'email et évite les blocages Gmail/Outlook sur les base64 >100KB.
      const apiBaseUrl =
        this.configService.get<string>('APP_PUBLIC_URL') ||
        'https://academia-helm-api.fly.dev';
      const logoUrl = profile?.logoUrl
        ? `${apiBaseUrl}/api/tenants/${tenantId}/logo`
        : null;

      return {
        schoolName,
        schoolLogo: logoUrl,
        schoolAddress: profile?.address || null,
        schoolPhone: profile?.phonePrimary || null,
        schoolEmail: profile?.email || null,
      };
    } catch (err: any) {
      this.logger.warn(
        `Failed to load tenant branding for ${tenantId}: ${err.message} — using fallback`,
      );
      return {
        schoolName: 'Établissement',
        schoolLogo: null,
        schoolAddress: null,
        schoolPhone: null,
        schoolEmail: null,
      };
    }
  }

  /**
   * Envoi individuel — utilisé par le bouton « Notifier » sur la fiche enseignant.
   */
  async notifyTeacher(params: NotifyTeacherParams): Promise<NotifyResult> {
    const { teacherId, tenantId, subject, message } = params;

    // 1. Fetch teacher
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        matricule: true,
        schoolLevel: { select: { name: true } },
      },
    });

    if (!teacher) {
      return {
        teacherId,
        teacherName: '—',
        email: '—',
        success: false,
        error: 'Enseignant introuvable',
      };
    }

    const teacherName = `${teacher.lastName} ${teacher.firstName}`.trim();
    const teacherEmail = teacher.email?.trim();

    if (!teacherEmail) {
      return {
        teacherId,
        teacherName,
        email: '—',
        success: false,
        error: 'Email non renseigné pour cet enseignant',
      };
    }

    // 2. Fetch branding
    const branding = await this.getTenantBranding(tenantId);

    // 3. Render email
    const { subject: emailSubject, html } = renderPedagogyNotificationEmail({
      branding,
      teacherName,
      teacherFirstName: teacher.firstName || teacherName,
      subject,
      message,
      matricule: teacher.matricule || undefined,
      schoolLevelName: teacher.schoolLevel?.name || undefined,
      senderName: params.senderName,
      senderFunction: params.senderFunction,
    });

    // 4. Send via categorized (creates EmailLog for traceability)
    try {
      const result = await this.emailService.sendCategorized({
        tenantId,
        category: 'PEDAGOGIE',
        subCategory: 'TEACHER_NOTIFICATION',
        module: 'pedagogy',
        to: teacherEmail,
        toName: teacherName,
        recipientType: 'ENSEIGNANT',
        recipientId: teacher.id,
        fromEmail:
          this.configService.get<string>('EMAIL_FROM_NOREPLY') ||
          'noreply@academiahelm.com',
        fromName: `Academia Helm — Pédagogie`,
        subject: emailSubject,
        html,
        // triggeredBy indique QUI a déclenché l'envoi (SYSTEM/STAFF/AUTOMATION).
        // Pour une notification manuelle déclenchée par un utilisateur admin/direction,
        // c'est 'STAFF'. L'ID utilisateur est passé via triggeredByUserId pour audit.
        triggeredBy: 'STAFF',
        triggeredByUserId: params.triggeredByUserId,
        relatedEntityId: teacher.id,
        relatedEntityType: 'Teacher',
      });

      if (result.success) {
        this.logger.log(
          `📧 Email pédagogie envoyé à ${teacherEmail} (${teacherName}) — subject="${subject.substring(0, 60)}" — logId=${result.logId || 'N/A'}`,
        );
        return {
          teacherId,
          teacherName,
          email: teacherEmail,
          success: true,
          logId: result.logId,
        };
      } else {
        this.logger.error(
          `📧 Email pédagogie FAILED pour ${teacherEmail} (${teacherName}): ${result.error}`,
        );
        return {
          teacherId,
          teacherName,
          email: teacherEmail,
          success: false,
          error: result.error || 'Échec d\'envoi (provider)',
        };
      }
    } catch (err: any) {
      this.logger.error(
        `📧 Email pédagogie threw pour ${teacherEmail} (${teacherName}): ${err.message}`,
        err.stack,
      );
      return {
        teacherId,
        teacherName,
        email: teacherEmail,
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Envoi groupé — utilisé par le bouton « Notifier tous » du toolbar.
   *
   * ⚠️ Séquentiel (for...of + await) — PAS de Promise.all :
   *   - Resend rate-limite à ~2 emails/sec sur le plan gratuit
   *   - Promise.all enverrait 20 emails simultanés → 429 Too Many Requests
   *   - Séquentiel permet aussi de tracer chaque envoi dans l'EmailLog
   *   - Et de retourner un récap détaillé au frontend
   */
  async notifyTeachers(params: NotifyBatchParams): Promise<BatchNotifyResult> {
    const { teacherIds, tenantId, subject, message } = params;

    if (!teacherIds || teacherIds.length === 0) {
      return {
        total: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        results: [],
      };
    }

    this.logger.log(
      `📧 Starting batch teacher notification: ${teacherIds.length} recipient(s), subject="${subject.substring(0, 60)}"`,
    );

    // Fetch branding une seule fois pour tout le batch
    const branding = await this.getTenantBranding(tenantId);

    // Fetch all teachers in one query (évite N+1)
    const teachers = await this.prisma.teacher.findMany({
      where: { id: { in: teacherIds }, tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        matricule: true,
        schoolLevel: { select: { name: true } },
      },
    });

    const teacherMap = new Map(teachers.map((t) => [t.id, t]));
    const results: NotifyResult[] = [];
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    // Boucle séquentielle — un envoi à la fois
    for (const teacherId of teacherIds) {
      const teacher = teacherMap.get(teacherId);

      if (!teacher) {
        results.push({
          teacherId,
          teacherName: '—',
          email: '—',
          success: false,
          error: 'Enseignant introuvable',
        });
        skipped++;
        continue;
      }

      const teacherName = `${teacher.lastName} ${teacher.firstName}`.trim();
      const teacherEmail = teacher.email?.trim();

      if (!teacherEmail) {
        results.push({
          teacherId,
          teacherName,
          email: '—',
          success: false,
          error: 'Email non renseigné',
        });
        skipped++;
        continue;
      }

      // Render email (chaque enseignant a son propre prénom/niveau)
      const { subject: emailSubject, html } = renderPedagogyNotificationEmail({
        branding,
        teacherName,
        teacherFirstName: teacher.firstName || teacherName,
        subject,
        message,
        matricule: teacher.matricule || undefined,
        schoolLevelName: teacher.schoolLevel?.name || undefined,
        senderName: params.senderName,
        senderFunction: params.senderFunction,
      });

      try {
        const result = await this.emailService.sendCategorized({
          tenantId,
          category: 'PEDAGOGIE',
          subCategory: 'TEACHER_NOTIFICATION',
          module: 'pedagogy',
          to: teacherEmail,
          toName: teacherName,
          recipientType: 'ENSEIGNANT',
          recipientId: teacher.id,
          fromEmail:
            this.configService.get<string>('EMAIL_FROM_NOREPLY') ||
            'noreply@academiahelm.com',
          fromName: `Academia Helm — Pédagogie`,
          subject: emailSubject,
          html,
          triggeredBy: 'STAFF',
          triggeredByUserId: params.triggeredByUserId,
          relatedEntityId: teacher.id,
          relatedEntityType: 'Teacher',
        });

        if (result.success) {
          sent++;
          this.logger.log(
            `  ✅ [${sent}/${teacherIds.length}] ${teacherEmail} (${teacherName}) — logId=${result.logId || 'N/A'}`,
          );
          results.push({
            teacherId,
            teacherName,
            email: teacherEmail,
            success: true,
            logId: result.logId,
          });
        } else {
          failed++;
          this.logger.error(
            `  ❌ [${failed}] ${teacherEmail} (${teacherName}): ${result.error}`,
          );
          results.push({
            teacherId,
            teacherName,
            email: teacherEmail,
            success: false,
            error: result.error || 'Échec d\'envoi (provider)',
          });
        }
      } catch (err: any) {
        failed++;
        this.logger.error(
          `  ❌ [${failed}] ${teacherEmail} (${teacherName}) threw: ${err.message}`,
        );
        results.push({
          teacherId,
          teacherName,
          email: teacherEmail,
          success: false,
          error: err.message,
        });
      }

      // Petit délai (200ms) entre chaque envoi pour rester sous le rate-limit Resend
      // (~2/sec sur le plan gratuit). Pas critique mais protège contre les 429.
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    this.logger.log(
      `📧 Batch teacher notification terminé: ${sent}/${teacherIds.length} envoyé(s), ${failed} échec(s), ${skipped} ignoré(s)`,
    );

    return {
      total: teacherIds.length,
      sent,
      failed,
      skipped,
      results,
    };
  }
}
