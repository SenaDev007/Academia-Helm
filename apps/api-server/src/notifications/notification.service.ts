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

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═══ CRUD principal ═══

  /**
   * Crée une notification in-app pour un utilisateur.
   * Utilisé par tous les helpers métier (admission, RH, etc.).
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
    return this.prisma.inAppNotification.create({
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
            data: { url: '/app/students/admissions' },
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
   * Rôles ciblés : SUPER_DIRECTOR, DIRECTOR, ADMIN, CENSEUR, SURVEILLANT_GENERAL.
   */
  private async resolveAdmissionStaff(tenantId: string): Promise<string[]> {
    const targetRoles = [
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
            role: { in: ['ADMIN', 'DIRECTOR', 'SUPER_DIRECTOR', 'HR_MANAGER'] },
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
}
