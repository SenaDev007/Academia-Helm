/**
 * ============================================================================
 * NOTIFICATION SERVICE — In-app notifications (cloche header)
 * ============================================================================
 *
 * Système de notifications in-app générique, user-scoped, avec statut isRead.
 *
 * Cas d'usage :
 *   - Nouvelle demande d'admission reçue → notifyAdmissionStaff()
 *   - Nouvelle candidature RH reçue → notifyRecruitmentStaff()
 *   - (extensible à tout autre événement métier)
 *
 * Pattern :
 *   - Création d'une ligne InAppNotification par destinataire
 *   - Fire-and-forget depuis les services métier (applyAdmission, applyJob)
 *   - Le frontend récupère via GET /notifications + polling 30s
 *   - Le push Web (VAPID) est géré par PushService (optionnel, si configuré)
 *
 * Note : l'ancienne méthode sendNotification() référençait prisma.userNotification
 * qui n'existait pas en DB → cassée. Remplacée par ce service générique.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PushService } from './push.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {}

  // ═══ CRUD principal ═══

  /**
   * Crée une notification in-app pour un utilisateur.
   * Utilisé par tous les helpers métier (admission, RH, etc.).
   *
   * Effet de bord : envoie aussi un push Web Push (si l'utilisateur a des
   * abonnements push enregistrés et que VAPID est configuré). Fire-and-forget.
   */
  async create(data: {
    tenantId: string;
    recipientId: string;
    type: string;
    title: string;
    body: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    data?: any;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }) {
    const notification = await this.prisma.inAppNotification.create({
      data: {
        tenantId: data.tenantId,
        recipientId: data.recipientId,
        type: data.type,
        title: data.title,
        body: data.body,
        priority: data.priority || 'MEDIUM',
        data: data.data ?? undefined,
        relatedEntityType: data.relatedEntityType ?? null,
        relatedEntityId: data.relatedEntityId ?? null,
        isRead: false,
      },
    });

    // Fire-and-forget : envoyer un push Web Push au destinataire
    // (visible même si l'onglet est fermé, sur mobile comme sur desktop)
    this.pushService
      .sendToUser(data.recipientId, {
        title: data.title,
        body: data.body,
        data: data.data,
      })
      .catch((err) =>
        this.logger.warn(`Push send failed (in create): ${err.message}`),
      );

    return notification;
  }

  /**
   * Liste les notifications d'un utilisateur (triées par date desc).
   */
  async listForUser(
    tenantId: string,
    userId: string,
    options?: { onlyUnread?: boolean; limit?: number; offset?: number },
  ) {
    const where: any = { tenantId, recipientId: userId };
    if (options?.onlyUnread) where.isRead = false;

    return this.prisma.inAppNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 20,
      skip: options?.offset || 0,
    });
  }

  /**
   * Compte les notifications non lues d'un utilisateur.
   */
  async unreadCount(tenantId: string, userId: string): Promise<number> {
    return this.prisma.inAppNotification.count({
      where: { tenantId, recipientId: userId, isRead: false },
    });
  }

  /**
   * Marque une notification comme lue.
   */
  async markAsRead(id: string, userId: string) {
    return this.prisma.inAppNotification.updateMany({
      where: { id, recipientId: userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Marque toutes les notifications d'un utilisateur comme lues.
   */
  async markAllAsRead(tenantId: string, userId: string) {
    return this.prisma.inAppNotification.updateMany({
      where: { tenantId, recipientId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Supprime une notification.
   */
  async delete(id: string, userId: string) {
    return this.prisma.inAppNotification.deleteMany({
      where: { id, recipientId: userId },
    });
  }

  // ═══ Helpers métier ═══

  /**
   * Notifie le staff admnistratif d'une nouvelle demande d'admission.
   * Destinataires : utilisateurs du tenant avec un rôle d'administration
   * (SUPER_DIRECTOR, DIRECTOR, ADMIN, CENSEUR, SURVEILLANT_GENERAL).
   *
   * Fire-and-forget — ne lève jamais d'erreur bloquante.
   */
  async notifyAdmissionStaff(params: {
    admissionId: string;
    tenantId: string;
    admission: { firstName: string; lastName: string; admissionNumber?: string | null };
    requestedClassLabel?: string;
  }) {
    try {
      const recipients = await this.resolveAdmissionStaff(params.tenantId);
      if (recipients.length === 0) {
        this.logger.warn(`notifyAdmissionStaff: aucun destinataire trouvé pour tenant ${params.tenantId}`);
        return;
      }

      const { firstName, lastName, admissionNumber } = params.admission;
      const title = 'Nouvelle demande d\'admission';
      const body = `${firstName} ${lastName}${params.requestedClassLabel ? ` — classe ${params.requestedClassLabel}` : ''}${admissionNumber ? ` (${admissionNumber})` : ''}`;

      const notifications = await Promise.all(
        recipients.map((userId) =>
          this.create({
            tenantId: params.tenantId,
            recipientId: userId,
            type: 'ADMISSION_SUBMITTED',
            title,
            body,
            priority: 'HIGH',
            data: { url: '/app/students?tab=admissions' },
            relatedEntityType: 'Admission',
            relatedEntityId: params.admissionId,
          }).catch((e) => {
            this.logger.error(`create notif failed for user ${userId}: ${e.message}`);
            return null;
          }),
        ),
      );

      const created = notifications.filter(Boolean);
      this.logger.log(
        `notifyAdmissionStaff: ${created.length} notification(s) créée(s) pour admission ${params.admissionId}`,
      );
    } catch (err: any) {
      this.logger.error(`notifyAdmissionStaff failed: ${err.message}`, err.stack);
    }
  }

  /**
   * Notifie le staff RH d'une nouvelle candidature.
   * Destinataires : propriétaire du RecruiterProfile (si configuré) +
   * utilisateurs avec rôle ADMIN/DIRECTOR/SUPER_DIRECTOR.
   *
   * Fire-and-forget.
   */
  async notifyRecruitmentStaff(params: {
    candidateId: string;
    applicationId: string;
    tenantId: string;
    jobId: string;
    candidate: { firstName: string; lastName: string; email: string };
    jobTitle?: string;
  }) {
    try {
      const recipients = await this.resolveRecruitmentStaff(params.tenantId);
      if (recipients.length === 0) {
        this.logger.warn(`notifyRecruitmentStaff: aucun destinataire pour tenant ${params.tenantId}`);
        return;
      }

      const { firstName, lastName } = params.candidate;
      const title = 'Nouvelle candidature reçue';
      const body = `${firstName} ${lastName}${params.jobTitle ? ` — ${params.jobTitle}` : ''}`;

      const notifications = await Promise.all(
        recipients.map((userId) =>
          this.create({
            tenantId: params.tenantId,
            recipientId: userId,
            type: 'CANDIDATURE_SUBMITTED',
            title,
            body,
            priority: 'HIGH',
            data: { url: '/app/hr/recruitment' },
            relatedEntityType: 'HrCandidate',
            relatedEntityId: params.candidateId,
          }).catch((e) => {
            this.logger.error(`create notif failed for user ${userId}: ${e.message}`);
            return null;
          }),
        ),
      );

      const created = notifications.filter(Boolean);
      this.logger.log(
        `notifyRecruitmentStaff: ${created.length} notification(s) créée(s) pour candidature ${params.candidateId}`,
      );
    } catch (err: any) {
      this.logger.error(`notifyRecruitmentStaff failed: ${err.message}`, err.stack);
    }
  }

  // ═══ Résolution des destinataires ═══

  /**
   * Résout les userId du staff d'admission d'un tenant.
   * Rôles ciblés : PROMOTER (propriétaire de l'école), SUPER_DIRECTOR, DIRECTOR,
   * ADMIN, CENSEUR, SURVEILLANT_GENERAL, SECRETARY_GENERAL.
   */
  private async resolveAdmissionStaff(tenantId: string): Promise<string[]> {
    const targetRoles = [
      'PROMOTER',
      'SUPER_DIRECTOR',
      'DIRECTOR',
      'ADMIN',
      'CENSEUR',
      'SURVEILLANT_GENERAL',
      'SECRETARY_GENERAL',
    ];

    try {
      // User table : chercher par tenantId + role
      // Note : User.role et User.tenantId sont nullable (String?) — on filtre les non-null.
      // User.status = "active" (pas isActive boolean)
      const users = await this.prisma.user.findMany({
        where: {
          tenantId,
          role: { in: targetRoles },
          status: 'active',
        },
        select: { id: true },
      });
      return users.map((u) => u.id);
    } catch (err: any) {
      this.logger.warn(`resolveAdmissionStaff failed: ${err.message}`);
      return [];
    }
  }

  /**
   * Résout les userId du staff RH d'un tenant.
   * 1. RecruiterProfile actif (si configuré)
   * 2. Sinon : users avec rôle ADMIN/DIRECTOR/SUPER_DIRECTOR
   */
  private async resolveRecruitmentStaff(tenantId: string): Promise<string[]> {
    try {
      // 1. RecruiterProfile → récupère le staff lié
      const recruiter = await this.prisma.recruiterProfile.findFirst({
        where: { tenantId, isActive: true },
        select: { staffId: true },
      });

      const userIds = new Set<string>();

      if (recruiter?.staffId) {
        // RecruiterProfile est lié à Staff, qui peut être lié à User
        const staff = await this.prisma.staff.findUnique({
          where: { id: recruiter.staffId },
          select: { userId: true },
        });
        if (staff?.userId) userIds.add(staff.userId);
      }

      // 2. Fallback : users avec rôle administratif
      if (userIds.size === 0) {
        const users = await this.prisma.user.findMany({
          where: {
            tenantId,
            role: { in: ['PROMOTER', 'ADMIN', 'DIRECTOR', 'SUPER_DIRECTOR', 'HR_MANAGER'] },
            status: 'active',
          },
          select: { id: true },
        });
        users.forEach((u) => userIds.add(u.id));
      }

      return Array.from(userIds);
    } catch (err: any) {
      this.logger.warn(`resolveRecruitmentStaff failed: ${err.message}`);
      return [];
    }
  }

  /**
   * ═══ Notifie les enseignants qu'une évaluation a été programmée ═══
   *
   * Cas d'usage : après `EvaluationsService.createBulk()`, on prévient chaque
   * enseignant assigné qu'une évaluation a été planifiée pour sa classe × matière.
   *
   * Résolution des destinataires :
   *   1. Pour chaque (teacherId) impliqué, on cherche un User avec email matching
   *      (Teacher.email = User.email, tenantId identique).
   *   2. Si pas de Teacher associé à la combo (classe × matière), aucune notif.
   *
   * Fire-and-forget — ne lève jamais d'erreur bloquante.
   */
  async notifyTeachersEvaluationScheduled(params: {
    tenantId: string;
    academicYearId: string;
    evaluations: Array<{
      id: string;
      title: string | null;
      evaluationDate: Date;
      className: string;
      subjectName: string;
      teacherId: string | null;
      evaluationTypeName?: string;
    }>;
  }) {
    try {
      // 1. Collecter les teacherIds uniques
      const teacherIds = Array.from(
        new Set(params.evaluations.map((e) => e.teacherId).filter(Boolean) as string[]),
      );

      if (teacherIds.length === 0) {
        this.logger.log(
          `notifyTeachersEvaluationScheduled: aucun enseignant assigné — aucune notification envoyée`,
        );
        return;
      }

      // 2. Résoudre les Teacher.email → User.id
      const teachers = await this.prisma.teacher.findMany({
        where: { id: { in: teacherIds }, tenantId: params.tenantId },
        select: { id: true, email: true, firstName: true, lastName: true },
      });

      const teacherEmails = teachers
        .map((t) => t.email)
        .filter((e): e is string => !!e);

      const users = teacherEmails.length
        ? await this.prisma.user.findMany({
            where: { email: { in: teacherEmails }, tenantId: params.tenantId },
            select: { id: true, email: true },
          })
        : [];

      const emailToUserId = new Map<string, string>();
      for (const u of users) {
        emailToUserId.set(u.email, u.id);
      }
      const teacherIdToUserId = new Map<string, string>();
      for (const t of teachers) {
        if (t.email && emailToUserId.has(t.email)) {
          teacherIdToUserId.set(t.id, emailToUserId.get(t.email)!);
        }
      }

      // 3. Grouper les évaluations par enseignant destinataire
      // Pour chaque enseignant, on génère UNE notification résumée plutôt
      // qu'une par évaluation (évite le spam).
      const byTeacher = new Map<string, typeof params.evaluations>();
      for (const ev of params.evaluations) {
        if (!ev.teacherId) continue;
        const userId = teacherIdToUserId.get(ev.teacherId);
        if (!userId) continue;
        if (!byTeacher.has(userId)) byTeacher.set(userId, []);
        byTeacher.get(userId)!.push(ev);
      }

      if (byTeacher.size === 0) {
        this.logger.warn(
          `notifyTeachersEvaluationScheduled: aucun User trouvé pour ${teacherIds.length} enseignant(s)`,
        );
        return;
      }

      // 4. Créer une notification par enseignant
      const teacherName = (id: string) => {
        const t = teachers.find((t) => t.id === id);
        return t ? `${t.firstName} ${t.lastName}` : 'Enseignant';
      };

      const notifications = await Promise.all(
        Array.from(byTeacher.entries()).map(([userId, evals]) => {
          const count = evals.length;
          const first = evals[0];
          const dateStr = first.evaluationDate.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          });

          const title =
            count === 1
              ? `Nouvelle évaluation programmée — ${first.subjectName}`
              : `${count} évaluations programmées`;

          const classesList = Array.from(
            new Set(evals.map((e) => e.className)),
          ).slice(0, 5);
          const subjectsList = Array.from(
            new Set(evals.map((e) => e.subjectName)),
          ).slice(0, 5);

          const body =
            count === 1
              ? `Classe ${first.className} • ${first.evaluationTypeName || 'Évaluation'} • ${dateStr}`
              : `Classes : ${classesList.join(', ')} • Matières : ${subjectsList.join(', ')} • À partir du ${dateStr}`;

          return this
            .create({
              tenantId: params.tenantId,
              recipientId: userId,
              type: 'EVALUATION_SCHEDULED',
              title,
              body,
              priority: 'HIGH',
              data: {
                url: '/app/exams/evaluations',
                evaluationIds: evals.map((e) => e.id),
                count,
                classes: classesList,
                subjects: subjectsList,
                date: first.evaluationDate.toISOString(),
              },
              relatedEntityType: 'Evaluation',
              relatedEntityId: first.id,
            })
            .catch((e) => {
              this.logger.error(
                `notifyTeachersEvaluationScheduled: create notif failed for user ${userId}: ${e.message}`,
              );
              return null;
            });
        }),
      );

      const created = notifications.filter(Boolean);
      this.logger.log(
        `notifyTeachersEvaluationScheduled: ${created.length} notification(s) créée(s) pour ${byTeacher.size} enseignant(s)`,
      );
    } catch (err: any) {
      this.logger.error(
        `notifyTeachersEvaluationScheduled failed: ${err.message}`,
        err.stack,
      );
    }
  }
}
