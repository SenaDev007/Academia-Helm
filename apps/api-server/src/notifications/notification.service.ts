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

import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PushService } from './push.service';
// ⭐ V3-4: FCM sender for mobile push notifications
import { FcmSenderService } from './fcm-sender.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    @Optional() @Inject(FcmSenderService)
    private readonly fcmSender?: FcmSenderService,
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

    // ⭐ V3-4: Fire-and-forget — envoyer aussi un push FCM aux appareils mobiles
    //    (l'app mobile Flutter enregistre ses tokens via POST /notifications/device-tokens)
    if (this.fcmSender) {
      this.fcmSender
        .sendToUser(data.recipientId, {
          title: data.title,
          body: data.body,
          type: data.type,
          data: data.data
            ? Object.fromEntries(
                Object.entries(data.data).map(([k, v]) => [k, String(v)]),
              )
            : undefined,
        })
        .catch((err) =>
          this.logger.warn(`FCM send failed (in create): ${err.message}`),
        );
    }

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

  // ═══ V3-4: FCM Device Tokens (mobile push) ═══

  /**
   * Enregistre (ou réactive) un token FCM pour un utilisateur.
   * Si le token existe déjà (réinstallation / autre utilisateur), on le rattache
   * au nouvel utilisateur (un token FCM ne peut être associé qu'à un seul user
   * à la fois côté Firebase).
   */
  async registerFcmToken(params: {
    tenantId: string;
    userId: string;
    fcmToken: string;
    platform?: string;
    deviceInfo?: string;
  }) {
    try {
      // Upsert : si le token existe déjà, on le met à jour (changement d'utilisateur possible)
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "fcm_device_tokens" ("tenantId", "userId", "fcmToken", "platform", "deviceInfo", "isActive", "lastUsedAt")
         VALUES ($1, $2, $3, $4, $5, true, NOW())
         ON CONFLICT ("fcmToken") DO UPDATE
         SET "tenantId" = EXCLUDED."tenantId",
             "userId" = EXCLUDED."userId",
             "platform" = EXCLUDED."platform",
             "deviceInfo" = EXCLUDED."deviceInfo",
             "isActive" = true,
             "lastUsedAt" = NOW(),
             "updatedAt" = NOW()`,
        params.tenantId,
        params.userId,
        params.fcmToken,
        params.platform || 'ANDROID',
        params.deviceInfo || null,
      );
      this.logger.log(
        `registerFcmToken: token enregistré pour user ${params.userId} (platform=${params.platform || 'ANDROID'})`,
      );
      return { success: true };
    } catch (err: any) {
      this.logger.error(`registerFcmToken failed: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Désactive un token FCM (à l'appel de logout depuis l'app mobile).
   * On ne supprime pas physiquement pour garder l'audit trail.
   */
  async unregisterFcmToken(fcmToken: string) {
    try {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "fcm_device_tokens" SET "isActive" = false, "updatedAt" = NOW()
         WHERE "fcmToken" = $1`,
        fcmToken,
      );
      this.logger.log(`unregisterFcmToken: token désactivé`);
      return { success: true };
    } catch (err: any) {
      this.logger.error(`unregisterFcmToken failed: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Récupère tous les tokens FCM actifs d'un utilisateur (multi-device possible).
   */
  async getFcmTokensForUser(userId: string): Promise<string[]> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ fcmToken: string }>>(
        `SELECT "fcmToken" FROM "fcm_device_tokens"
         WHERE "userId" = $1 AND "isActive" = true`,
        userId,
      );
      return rows.map((r) => r.fcmToken);
    } catch {
      return [];
    }
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

  /**
   * ═══ Notifie les parents d'élèves d'une classe qu'un nouveau devoir a été donné ═══
   *
   * Cas d'usage : depuis pedagogical-workspace-prisma.service lorsqu'un enseignant
   * ajoute un devoir (homework) à une séance de cahier journal.
   *
   * Résolution des destinataires :
   *   1. Récupère tous les StudentEnrollment actifs pour la classe (academicYear courant)
   *   2. Pour chaque student → StudentGuardian (isPrimary = true en priorité)
   *   3. Pour chaque Guardian → cherche un User avec email matching
   *   4. Si User trouvé → crée une notification in-app + push web
   *
   * Fire-and-forget — ne lève jamais d'erreur bloquante.
   */
  async notifyParentsNewHomework(
    classId: string,
    tenantId: string,
    subjectLabel: string,
    homeworkDescription: string,
  ) {
    try {
      // 1. Récupérer les élèves actifs de la classe
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: {
          tenantId,
          classId,
          status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED', 'CONFIRMED'] },
        },
        select: { studentId: true },
      });

      if (enrollments.length === 0) {
        this.logger.log(
          `notifyParentsNewHomework: aucun élève dans la classe ${classId} — aucune notification`,
        );
        return;
      }

      const studentIds = enrollments.map((e) => e.studentId);

      // 2. Récupérer les guardians principaux de ces élèves
      const guardians = await this.prisma.studentGuardian.findMany({
        where: {
          studentId: { in: studentIds },
          tenantId,
          // isPrimary en priorité — si pas de primary, on prend tous
        },
        select: {
          studentId: true,
          guardianId: true,
          isPrimary: true,
          guardian: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
        },
      });

      if (guardians.length === 0) {
        this.logger.log(
          `notifyParentsNewHomework: aucun guardian pour ${studentIds.length} élève(s) de la classe ${classId}`,
        );
        return;
      }

      // Ne garder que le guardian principal par élève (ou le premier si pas de primary)
      const primaryByStudent = new Map<string, typeof guardians[number]>();
      for (const g of guardians) {
        const existing = primaryByStudent.get(g.studentId);
        if (!existing) {
          primaryByStudent.set(g.studentId, g);
        } else if (!existing.isPrimary && g.isPrimary) {
          primaryByStudent.set(g.studentId, g);
        }
      }

      // 3. Résoudre les User par email matching
      const guardianEmails = Array.from(primaryByStudent.values())
        .map((g) => g.guardian.email)
        .filter((e): e is string => !!e);

      if (guardianEmails.length === 0) {
        this.logger.log(
          `notifyParentsNewHomework: aucun guardian avec email pour la classe ${classId}`,
        );
        return;
      }

      const users = await this.prisma.user.findMany({
        where: {
          email: { in: guardianEmails },
          tenantId,
          status: 'active',
        },
        select: { id: true, email: true },
      });

      if (users.length === 0) {
        this.logger.log(
          `notifyParentsNewHomework: aucun User actif correspondant aux ${guardianEmails.length} email(s) de guardian`,
        );
        return;
      }

      // 4. Créer une notification par parent
      const title = `Nouveau devoir — ${subjectLabel}`;
      const body = homeworkDescription
        ? (homeworkDescription.length > 120
            ? homeworkDescription.substring(0, 117) + '…'
            : homeworkDescription)
        : 'Un nouveau devoir a été ajouté pour votre enfant.';

      const notifications = await Promise.all(
        users.map((u) =>
          this
            .create({
              tenantId,
              recipientId: u.id,
              type: 'NEW_HOMEWORK',
              title,
              body,
              priority: 'MEDIUM',
              data: {
                url: '/app/parent',
                classId,
                subject: subjectLabel,
              },
              relatedEntityType: 'HomeworkEntry',
              relatedEntityId: null,
            })
            .catch((e) => {
              this.logger.error(
                `notifyParentsNewHomework: create notif failed for user ${u.id}: ${e.message}`,
              );
              return null;
            }),
        ),
      );

      const created = notifications.filter(Boolean);
      this.logger.log(
        `notifyParentsNewHomework: ${created.length} notification(s) créée(s) pour la classe ${classId} (${users.length} parents)`,
      );
    } catch (err: any) {
      this.logger.error(
        `notifyParentsNewHomework failed: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * ⭐ Finance — Multi-caisses : notifie les promoteurs / super-directeurs
   * qu'une caisse présente un solde négatif.
   *
   * Déclenché par le bouton « Alerter le promoteur » (CashRegistersContent).
   * Historiquement, le backend se contentait d'un console.log + faux succès ;
   * on crée désormais de vraies notifications in-app (priorité HIGH).
   *
   * Fire-and-forget — ne doit jamais bloquer l'action appelante.
   */
  async notifyPromotersCashAlert(params: {
    tenantId: string;
    cashRegisterId?: string;
    cashRegisterName?: string;
    balance?: number;
  }): Promise<{ notified: number }> {
    try {
      const recipients = await this.prisma.user.findMany({
        where: {
          tenantId: params.tenantId,
          role: { in: ['PROMOTER', 'SUPER_DIRECTOR'] },
          status: 'active',
        },
        select: { id: true },
      });
      if (recipients.length === 0) {
        this.logger.warn(
          `notifyPromotersCashAlert: aucun destinataire (PROMOTER/SUPER_DIRECTOR actif) pour tenant ${params.tenantId}`,
        );
        return { notified: 0 };
      }

      const name = params.cashRegisterName || 'Caisse';
      const balanceTxt =
        typeof params.balance === 'number'
          ? ` — solde actuel : ${params.balance.toLocaleString('fr-FR')} FCFA`
          : '';
      const title = 'Alerte : solde de caisse négatif';
      const body = `La caisse « ${name} » présente un solde négatif${balanceTxt}. Merci de vérifier la situation de trésorerie dans le module Finances.`;

      const results = await Promise.all(
        recipients.map((u) =>
          this.create({
            tenantId: params.tenantId,
            recipientId: u.id,
            type: 'CASH_REGISTER_ALERT',
            title,
            body,
            priority: 'HIGH',
            data: {
              url: '/app/finance/cash-registers',
              cashRegisterId: params.cashRegisterId,
              balance: params.balance,
            },
            relatedEntityType: 'CashRegister',
            relatedEntityId: params.cashRegisterId,
          }).catch((e) => {
            this.logger.error(
              `notifyPromotersCashAlert: create notif failed for user ${u.id}: ${e.message}`,
            );
            return null;
          }),
        ),
      );

      const notified = results.filter(Boolean).length;
      this.logger.log(
        `notifyPromotersCashAlert: ${notified}/${recipients.length} notification(s) créée(s) (caisse ${params.cashRegisterId || 'n/a'})`,
      );
      return { notified };
    } catch (err: any) {
      this.logger.error(
        `notifyPromotersCashAlert failed: ${err.message}`,
        err.stack,
      );
      return { notified: 0 };
    }
  }
}
