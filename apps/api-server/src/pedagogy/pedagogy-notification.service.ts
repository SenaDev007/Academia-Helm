/**
 * ============================================================================
 * PEDAGOGY NOTIFICATION SERVICE — Récapitulatif profil enseignant par email
 * ============================================================================
 *
 * Envoi AUTOMATIQUE d'un email récapitulatif à un enseignant, sans aucune
 * saisie utilisateur. Le service rassemble toutes les données pédagogiques
 * de l'enseignant pour l'année en cours, puis génère et envoie l'email.
 *
 * Données rassemblées automatiquement :
 *   1. Identité (Teacher : nom, matricule, email, niveau, langue, statut)
 *   2. Paramètres académiques (TeacherAcademicProfile : maxWeeklyHours, isSemainier)
 *   3. Habilitations (TeacherSubjectQualification → Subject)
 *   4. Autorisations de niveau (TeacherLevelAuthorization → AcademicLevel)
 *   5. Disponibilités hebdomadaires (TeacherAvailability)
 *   6. Multigrade (MultigradeAssignment → classIds → Class.name)
 *   7. Affectations par classe (TeacherClassAssignment → ClassSubject → Subject + AcademicClass)
 *   8. Charge horaire globale (somme des weeklyHours des affectations)
 *
 * Deux modes d'envoi :
 *   - notifyTeacher()  → individuel (1 enseignant)
 *   - notifyTeachers() → groupé (N enseignants, séquentiel, anti rate-limiting)
 *
 * Traçabilité : chaque envoi crée un EmailLog (category=PEDAGOGIE,
 * subCategory=TEACHER_PROFILE_SUMMARY, recipientType=ENSEIGNANT).
 *
 * DEPENDENCIES :
 *   - EmailService (CommunicationModule) — envoi réel via Resend/SMTP/mock
 *   - PrismaService — fetch Teacher + toutes les relations pédagogiques
 *   - ConfigService — APP_PUBLIC_URL pour le logo du tenant
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../communication/services/email.service';
import { PrismaService } from '../database/prisma.service';
import { TenantBranding } from '../hr/recruitment-email-templates';
import {
  renderTeacherProfileSummaryEmail,
  TeacherProfileSummaryData,
  AvailabilitySlot,
  ClassAssignmentInfo,
  MultigradeInfo,
} from './pedagogy-email-templates';

export interface NotifyTeacherParams {
  teacherId: string;
  tenantId: string;
  academicYearId?: string;
  /** ID utilisateur qui déclenche l'envoi (pour audit EmailLog) */
  triggeredByUserId?: string;
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
   * l'email. Réutilise la même logique que RecruitmentNotificationService.
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

      const tenant = !profile?.schoolName
        ? await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { name: true },
          })
        : null;

      const schoolName = profile?.schoolName || tenant?.name || 'Établissement';

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
   * Détermine l'année scolaire active pour le tenant. Si l'appelant fournit
   * un academicYearId, on l'utilise. Sinon, on cherche l'année active.
   */
  private async resolveAcademicYear(
    tenantId: string,
    academicYearId?: string,
  ): Promise<{ id: string; label: string } | null> {
    if (academicYearId) {
      const y = await this.prisma.academicYear.findUnique({
        where: { id: academicYearId },
        select: { id: true, name: true, startDate: true, endDate: true },
      });
      if (y) {
        return { id: y.id, label: y.name || this.formatYearLabel(y.startDate, y.endDate) };
      }
    }
    // Fallback : année active du tenant
    const active = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, startDate: true, endDate: true },
      orderBy: { createdAt: 'desc' },
    });
    if (active) {
      return { id: active.id, label: active.name || this.formatYearLabel(active.startDate, active.endDate) };
    }
    return null;
  }

  private formatYearLabel(start: Date, end: Date): string {
    try {
      return `${start.getFullYear()}-${end.getFullYear()}`;
    } catch {
      return 'Année courante';
    }
  }

  /**
   * Récupère TOUTES les données pédagogiques d'un enseignant pour l'année
   * donnée, et les met en forme pour le template d'email.
   *
   * ⚠️ Plusieurs requêtes Prisma sont nécessaires — c'est intentionnel :
   *   - on évite les includes trop profonds qui cassent sur les anciennes
   *     migrations Fly.io (ex: classId NULL sur class_subjects)
   *   - on garde le contrôle sur chaque champ, et on peut tolérer les
   *     données partielles (ex: AcademicClass sans name) sans faire crasher
   *     l'envoi de l'email.
   */
  private async buildTeacherProfileData(
    teacherId: string,
    tenantId: string,
    academicYearId: string,
    academicYearLabel: string,
  ): Promise<TeacherProfileSummaryData | null> {
    // 1. Fetch teacher (avec schoolLevel + assignedLanguages)
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        matricule: true,
        assignedLanguages: true,
        status: true,
        schoolLevel: { select: { name: true } },
      },
    });
    if (!teacher) return null;

    // 2. Fetch TeacherAcademicProfile (avec qualifications + authorizations + availabilities)
    const profile = await this.prisma.teacherAcademicProfile.findFirst({
      where: { teacherId, tenantId, academicYearId },
      include: {
        subjectQualifications: {
          include: { subject: { select: { id: true, name: true, code: true } } },
        },
        levelAuthorizations: {
          include: { level: { select: { id: true, name: true } } },
        },
        availabilities: {
          select: { id: true, dayOfWeek: true, startTime: true, endTime: true },
          orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        },
      },
    });

    // 3. Fetch MultigradeAssignment(s)
    const multigradeAssignments = await this.prisma.multigradeAssignment.findMany({
      where: { teacherId, tenantId, academicYearId },
      select: { id: true, classIds: true, language: true, notes: true, isActive: true },
    });

    // 4. Fetch TeacherClassAssignment(s) — avec ClassSubject + Subject + AcademicClass
    const classAssignments = await this.prisma.teacherClassAssignment.findMany({
      where: { teacherId, tenantId, academicYearId },
      include: {
        classSubject: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
            academicClass: { select: { id: true, name: true } },
          },
        },
        physicalClass: { select: { id: true, name: true } },
      },
    });

    // 5. Fetch branding (pour le template)
    const branding = await this.getTenantBranding(tenantId);

    // 6. ─── Construction des objets pour le template ────────────────────────

    // Habilitations
    const subjectQualifications = (profile?.subjectQualifications || []).map((sq) => ({
      subjectCode: sq.subject?.code || undefined,
      subjectName: sq.subject?.name || '—',
      certified: sq.certified,
    }));

    // Autorisations de niveau
    const levelAuthorizations = (profile?.levelAuthorizations || []).map((la) => ({
      levelName: la.level?.name || '—',
    }));

    // Disponibilités
    const availabilities: AvailabilitySlot[] = (profile?.availabilities || []).map((a) => ({
      dayOfWeek: a.dayOfWeek,
      startTime: a.startTime,
      endTime: a.endTime,
    }));

    // Multigrade — résoudre les noms de classes physiques
    const allClassIds: string[] = [];
    for (const mg of multigradeAssignments) {
      try {
        const ids = (typeof mg.classIds === 'string'
          ? JSON.parse(mg.classIds)
          : mg.classIds) as string[];
        if (Array.isArray(ids)) allClassIds.push(...ids);
      } catch {
        // ignore parse errors
      }
    }
    const physicalClasses = allClassIds.length > 0
      ? await this.prisma.class.findMany({
          where: { id: { in: allClassIds } },
          select: { id: true, name: true },
        })
      : [];
    const classIdToName = new Map(physicalClasses.map((c) => [c.id, c.name]));

    const multigradeInfo: MultigradeInfo[] = multigradeAssignments.map((mg) => {
      let ids: string[] = [];
      try {
        const parsed = typeof mg.classIds === 'string' ? JSON.parse(mg.classIds) : mg.classIds;
        if (Array.isArray(parsed)) ids = parsed;
      } catch {
        // ignore
      }
      return {
        classNames: ids.map((id) => classIdToName.get(id) || '—'),
        language: mg.language,
        notes: mg.notes,
        isActive: mg.isActive,
      };
    });

    // Affectations par classe
    const classAssignmentInfos: ClassAssignmentInfo[] = classAssignments.map((a) => {
      // Nom de classe : priorité à physicalClass.name, sinon academicClass.name
      const className =
        a.physicalClass?.name ||
        a.classSubject?.academicClass?.name ||
        '—';
      return {
        className,
        subjectCode: a.classSubject?.subject?.code || '—',
        subjectName: a.classSubject?.subject?.name || '—',
        weeklyHours: a.classSubject?.weeklyHours || 0,
      };
    });

    // Charge horaire totale = somme des weeklyHours des affectations
    const totalAssignedHours = classAssignmentInfos.reduce(
      (sum, a) => sum + (a.weeklyHours || 0),
      0,
    );

    // Languages parsing robuste (assignedLanguages peut être array, string JSON, ou null)
    let assignedLanguages: string[] = [];
    try {
      const raw = teacher.assignedLanguages as any;
      if (Array.isArray(raw)) {
        assignedLanguages = raw.map((x) => String(x));
      } else if (typeof raw === 'string') {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) assignedLanguages = parsed.map((x: any) => String(x));
        else assignedLanguages = [raw];
      }
    } catch {
      // ignore
    }

    const teacherName = `${teacher.lastName} ${teacher.firstName}`.trim();

    return {
      branding,
      academicYearLabel,
      teacherName,
      teacherFirstName: teacher.firstName || teacherName,
      matricule: teacher.matricule || undefined,
      email: teacher.email || undefined,
      schoolLevelName: teacher.schoolLevel?.name || undefined,
      assignedLanguages,
      isActive: teacher.status === 'active',
      maxWeeklyHours: profile?.maxWeeklyHours ?? 0,
      isSemainier: profile?.isSemainier ?? false,
      subjectQualifications,
      levelAuthorizations,
      availabilities,
      multigradeAssignments: multigradeInfo,
      classAssignments: classAssignmentInfos,
      totalAssignedHours,
    };
  }

  /**
   * Envoi individuel — bouton « Notifier » sur fiche enseignant.
   *
   * Workflow :
   *   1. Résoudre l'année scolaire active (ou utiliser celle fournie)
   *   2. Builder le TeacherProfileSummaryData (fetch toutes les relations)
   *   3. Renderer le HTML via renderTeacherProfileSummaryEmail
   *   4. Envoyer via EmailService.sendCategorized (traçabilité EmailLog)
   */
  async notifyTeacher(params: NotifyTeacherParams): Promise<NotifyResult> {
    const { teacherId, tenantId } = params;

    // 1. Résoudre l'année scolaire
    const academicYear = await this.resolveAcademicYear(tenantId, params.academicYearId);
    if (!academicYear) {
      return {
        teacherId,
        teacherName: '—',
        email: '—',
        success: false,
        error: 'Aucune année scolaire active trouvée',
      };
    }

    // 2. Fetch teacher (pour valider existence + email)
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, tenantId },
      select: { id: true, firstName: true, lastName: true, email: true },
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

    // 3. Builder les données complètes
    const data = await this.buildTeacherProfileData(
      teacherId,
      tenantId,
      academicYear.id,
      academicYear.label,
    );

    if (!data) {
      return {
        teacherId,
        teacherName,
        email: teacherEmail,
        success: false,
        error: 'Impossible de charger les données pédagogiques',
      };
    }

    // 4. Render email
    const { subject, html } = renderTeacherProfileSummaryEmail(data);

    // 5. Send via categorized (creates EmailLog for traceability)
    try {
      const result = await this.emailService.sendCategorized({
        tenantId,
        category: 'PEDAGOGIE',
        subCategory: 'TEACHER_PROFILE_SUMMARY',
        module: 'pedagogy',
        to: teacherEmail,
        toName: teacherName,
        recipientType: 'ENSEIGNANT',
        recipientId: teacher.id,
        fromEmail:
          this.configService.get<string>('EMAIL_FROM_NOREPLY') ||
          'noreply@academiahelm.com',
        fromName: `${data.branding.schoolName} — Pédagogie`,
        subject,
        html,
        triggeredBy: 'STAFF',
        triggeredByUserId: params.triggeredByUserId,
        relatedEntityId: teacher.id,
        relatedEntityType: 'Teacher',
      });

      if (result.success) {
        this.logger.log(
          `📧 Récap pédagogie envoyé à ${teacherEmail} (${teacherName}) — logId=${result.logId || 'N/A'}`,
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
          `📧 Récap pédagogie FAILED pour ${teacherEmail} (${teacherName}): ${result.error}`,
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
        `📧 Récap pédagogie threw pour ${teacherEmail} (${teacherName}): ${err.message}`,
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
   * Envoi groupé — bouton « Notifier tous » du toolbar.
   *
   * ⚠️ Séquentiel (for...of + await) — PAS de Promise.all :
   *   - Resend rate-limite à ~2 emails/sec sur le plan gratuit
   *   - Promise.all enverrait 20 emails simultanés → 429 Too Many Requests
   *   - Séquentiel permet aussi de tracer chaque envoi dans l'EmailLog
   *   - Et de retourner un récap détaillé au frontend
   */
  async notifyTeachers(params: NotifyBatchParams): Promise<BatchNotifyResult> {
    const { teacherIds, tenantId } = params;

    if (!teacherIds || teacherIds.length === 0) {
      return { total: 0, sent: 0, failed: 0, skipped: 0, results: [] };
    }

    this.logger.log(
      `📧 Batch teacher profile summary: ${teacherIds.length} recipient(s)`,
    );

    // Résoudre l'année scolaire une fois pour tout le batch
    const academicYear = await this.resolveAcademicYear(tenantId, params.academicYearId);
    if (!academicYear) {
      return {
        total: teacherIds.length,
        sent: 0,
        failed: teacherIds.length,
        skipped: 0,
        results: teacherIds.map((id) => ({
          teacherId: id,
          teacherName: '—',
          email: '—',
          success: false,
          error: 'Aucune année scolaire active',
        })),
      };
    }

    const results: NotifyResult[] = [];
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    // Boucle séquentielle — un envoi à la fois
    for (let i = 0; i < teacherIds.length; i++) {
      const teacherId = teacherIds[i];

      const result = await this.notifyTeacher({
        teacherId,
        tenantId,
        academicYearId: academicYear.id,
        triggeredByUserId: params.triggeredByUserId,
      });

      if (result.success) {
        sent++;
        this.logger.log(
          `  ✅ [${sent}/${teacherIds.length}] ${result.email} (${result.teacherName}) — logId=${result.logId || 'N/A'}`,
        );
      } else if (result.error && (result.error.includes('introuvable') || result.error.includes('Email non renseigné'))) {
        skipped++;
        this.logger.warn(
          `  ⏭️ [${i + 1}/${teacherIds.length}] ${result.teacherName}: ${result.error}`,
        );
      } else {
        failed++;
        this.logger.error(
          `  ❌ [${i + 1}/${teacherIds.length}] ${result.email || result.teacherName}: ${result.error}`,
        );
      }
      results.push(result);

      // Petit délai (200ms) entre chaque envoi pour rester sous le rate-limit Resend
      if (i < teacherIds.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    this.logger.log(
      `📧 Batch terminé: ${sent}/${teacherIds.length} envoyé(s), ${failed} échec(s), ${skipped} ignoré(s)`,
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
