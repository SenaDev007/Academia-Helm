/**
 * ============================================================================
 * LEAVES PRISMA SERVICE - HR MODULE (SCHEMA-ALIGNED v3)
 * ============================================================================
 *
 * Service for managing staff leave requests, aligned with the LeaveRequest
 * Prisma model.
 *
 * Key model: LeaveRequest
 *   - Fields: id, tenantId, academicYearId, schoolLevelId?, staffId, type,
 *     startDate, endDate, reason?, status, approvedBy?, approvedAt?,
 *     rejectedReason?, createdAt, updatedAt
 *   - Status values: PENDING → APPROVED | REJECTED | CANCELLED
 *   - Relations: staff → Staff, tenant → Tenant, academicYear → AcademicYear,
 *     schoolLevel → SchoolLevel?, approver → User? (@relation "LeaveRequestApprover")
 *
 * NOTE: Absence model is for STUDENTS only. Staff leave tracking uses
 *       LeaveRequest exclusively.
 *
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';
import { EmailService } from '../communication/services/email.service';
import { RecruitmentNotificationService } from './recruitment-notification.service';
import { StorageService } from '../common/services/storage.service';
import { renderLeaveDecisionEmail } from './hr-email-templates';
// ⭐ 2026-11-21 — Notifications in-app (cloche) : décision de congé → personnel,
//    nouvelle demande → gestionnaires RH. NotificationModule est @Global.
import { NotificationService } from '../notifications/notification.service';

const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: 'Congé annuel',
  SICK: 'Congé maladie',
  MATERNITY: 'Congé maternité',
  PATERNITY: 'Congé paternité',
  UNPAID: 'Congé sans solde',
  EXCEPTIONAL: 'Congé exceptionnel',
  // ⭐ Demande d'ABSENCE justifiée (motif libre) — le personnel peut demander
  //    une absence sans que ce soit un congé (ex: problème personnel, convocation).
  ABSENCE: 'Absence justifiée',
};

@Injectable()
export class LeavesPrismaService {
  private readonly logger = new Logger(LeavesPrismaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationService: RecruitmentNotificationService,
    private readonly storageService: StorageService,
    // ⭐ In-app notifications (cloche) — RH self-service
    private readonly inAppNotifications: NotificationService,
  ) {}

  // ============================================================================
  // LEAVE REQUESTS
  // ============================================================================

  /**
   * Creates a new leave request for a staff member.
   *
   * Validates:
   *  - Staff member exists within the tenant
   *  - Start date is before end date
   *  - No overlapping approved leave exists for the same period
   *
   * ⭐ 2026-11-21 — `origin` : 
   *  - 'SELF' → demande créée par le personnel lui-même (self-service) →
   *    notification in-app aux gestionnaires RH (cloche + push)
   *  - 'RH' → demande déposée par le RH POUR un membre du personnel →
   *    notification in-app AU personnel concerné ("une demande a été
   *    déposée en votre nom")
   *
   * @param data - Leave request creation payload
   * @returns The created LeaveRequest record
   */
  async createLeaveRequest(data: {
    tenantId: string;
    academicYearId?: string;
    schoolLevelId?: string;
    staffId: string;
    type: string;
    startDate: string | Date;
    endDate: string | Date;
    reason?: string;
    origin?: 'SELF' | 'RH';
  }) {
    // Convert date strings to Date objects (DTO sends strings via @IsDateString)
    const startDate = data.startDate instanceof Date ? data.startDate : new Date(data.startDate);
    const endDate = data.endDate instanceof Date ? data.endDate : new Date(data.endDate);

    // Validate date ordering
    if (startDate > endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Verify staff member exists within tenant
    const staff = await this.prisma.staff.findFirst({
      where: { id: data.staffId, tenantId: data.tenantId },
    });
    if (!staff) {
      throw new NotFoundException(`Staff member ${data.staffId} not found`);
    }

    // ─── Résoudre l'année académique active si non fournie ──
    // academicYearId est requis dans le schéma Prisma (non-nullable).
    // Si le frontend ne l'envoie pas, on récupère l'année active du tenant.
    let academicYearId = data.academicYearId;
    if (!academicYearId) {
      const activeYear = await this.prisma.academicYear.findFirst({
        where: { isActive: true, tenantId: data.tenantId },
        select: { id: true },
      });
      if (!activeYear) {
        // Fallback: prendre la dernière année créée pour ce tenant
        const lastYear = await this.prisma.academicYear.findFirst({
          where: { tenantId: data.tenantId },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        if (!lastYear) {
          throw new BadRequestException(
            'Aucune année académique trouvée. Veuillez créer une année académique dans les paramètres.',
          );
        }
        academicYearId = lastYear.id;
      } else {
        academicYearId = activeYear.id;
      }
    }

    // Check for overlapping approved leave requests
    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        staffId: data.staffId,
        tenantId: data.tenantId,
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        'An approved leave request already exists for this period',
      );
    }

    const created = await this.prisma.leaveRequest.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        academicYearId,
        schoolLevelId: data.schoolLevelId ?? null,
        staffId: data.staffId,
        type: data.type,
        startDate,
        endDate,
        reason: data.reason ?? null,
        status: 'PENDING',
      },
      include: {
        staff: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            email: true,
            position: true,
            roleType: true,
            // ⭐ 2026-11-26 — séparation RH par niveau (maternel/primaire vs
            //    secondaire) : le niveau de la fiche personnel alimente la
            //    catégorie d'affichage côté Congés & Absences.
            schoolLevel: { select: { name: true, code: true } },
          },
        },
      },
    });

    // ─── ⭐ 2026-11-21 — Notifications in-app (cloche), fire-and-forget ───
    //    SELF  → le RH est alerté qu'une demande attend son traitement
    //    RH    → le personnel est alerté qu'une demande a été déposée en son nom
    this.dispatchLeaveCreationNotifications(created, data.tenantId, data.origin ?? 'RH').catch(
      (err) => this.logger.error(`dispatchLeaveCreationNotifications failed (non-blocking): ${err.message}`),
    );

    return created;
  }

  /**
   * ⭐ 2026-11-21 — Notifications in-app émises à la création d'une demande :
   *    - origin 'SELF' : le personnel a soumis SA demande → alerte aux
   *      gestionnaires RH (cloche, push, FCM — voir NotificationService)
   *    - origin 'RH'   : le RH a déposé une demande POUR un membre du
   *      personnel → alerte au personnel concerné
   *    Fire-and-forget — jamais bloquant.
   */
  private async dispatchLeaveCreationNotifications(
    leaveRequest: any,
    tenantId: string,
    origin: 'SELF' | 'RH',
  ): Promise<void> {
    const staff = leaveRequest?.staff;
    if (!staff) return;

    const startDate = new Date(leaveRequest.startDate);
    const endDate = new Date(leaveRequest.endDate);
    const daysCount =
      Math.ceil(Math.abs(endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    const typeLabel = LEAVE_TYPE_LABELS[leaveRequest.type] || leaveRequest.type;

    if (origin === 'SELF') {
      // → Notifier les gestionnaires RH (demande en attente dans leur interface)
      await this.inAppNotifications.notifyHrLeaveRequestSubmitted({
        tenantId,
        requestId: leaveRequest.id,
        staff: {
          firstName: staff.firstName,
          lastName: staff.lastName,
          position: staff.position,
        },
        leaveTypeLabel: typeLabel,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        daysCount,
        reason: leaveRequest.reason,
      });
    } else {
      // → Notifier le personnel concerné (demande déposée en son nom par le RH)
      const fmt = (d: Date) => d.toLocaleDateString('fr-FR');
      await this.notifyStaffUser({
        tenantId,
        staffEmail: staff.email ?? null,
        staffRoleType: staff.roleType,
        type: 'LEAVE_REQUEST_SUBMITTED',
        title: 'Demande de congé / absence déposée en votre nom',
        body: `${typeLabel} : ${fmt(startDate)} → ${fmt(endDate)} (${daysCount} j) — en attente de traitement par le RH.`,
        relatedEntityType: 'LeaveRequest',
        relatedEntityId: leaveRequest.id,
      });
    }
  }

  /**
   * ⭐ 2026-11-21 — Crée une notification in-app pour le User lié à un membre
   * du personnel (rapprochement par email, insensible à la casse — le compte
   * User est créé avec l'email du staff en minuscules).
   * Fire-and-forget — jamais bloquant.
   */
  private async notifyStaffUser(params: {
    tenantId: string;
    staffEmail: string | null | undefined;
    staffRoleType?: string | null;
    type: string;
    title: string;
    body: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    relatedEntityType?: string;
    relatedEntityId?: string;
  }): Promise<void> {
    try {
      if (!params.staffEmail) {
        this.logger.warn(`notifyStaffUser: pas d'email staff — notification ignorée`);
        return;
      }
      const user = await this.prisma.user.findFirst({
        where: {
          tenantId: params.tenantId,
          status: 'active',
          email: { equals: params.staffEmail, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (!user) {
        this.logger.warn(
          `notifyStaffUser: aucun User actif pour l'email ${params.staffEmail} — notification ignorée`,
        );
        return;
      }

      // ⭐ URL de destination : la page self-service du personnel —
      //    /app/teacher/presence pour les enseignants, /app/my-presence pour
      //    les autres membres du personnel (directeur, comptable…).
      const url =
        params.staffRoleType === 'TEACHER'
          ? '/app/teacher/presence'
          : '/app/my-presence';

      await this.inAppNotifications.create({
        tenantId: params.tenantId,
        recipientId: user.id,
        type: params.type,
        title: params.title,
        body: params.body,
        priority: params.priority ?? 'MEDIUM',
        data: { url },
        relatedEntityType: params.relatedEntityType ?? null,
        relatedEntityId: params.relatedEntityId ?? null,
      });
    } catch (err: any) {
      this.logger.error(`notifyStaffUser failed: ${err.message}`, err.stack);
    }
  }

  /**
   * Processes a leave request by updating its status.
   *
   * - APPROVED: sets approvedBy and approvedAt
   * - REJECTED: sets rejectedReason if provided
   * - CANCELLED: allows cancellation of a pending request
   *
   * Only PENDING requests can be processed.
   *
   * @param id - Leave request ID
   * @param tenantId - Tenant ID for scoping
   * @param status - Target status (APPROVED, REJECTED, CANCELLED)
   * @param approvedBy - User ID of the approver (required for APPROVED)
   * @param rejectedReason - Reason for rejection (optional for REJECTED)
   * @returns The updated LeaveRequest record
   */
  async processLeaveRequest(
    id: string,
    tenantId: string,
    status: 'APPROVED' | 'REJECTED' | 'CANCELLED',
    approvedBy?: string,
    rejectedReason?: string,
  ) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, tenantId },
    });

    if (!request) {
      throw new NotFoundException(`Leave request with ID ${id} not found`);
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        `Leave request is already ${request.status} and cannot be processed`,
      );
    }

    const updateData: Record<string, unknown> = { status };

    if (status === 'APPROVED') {
      updateData.approvedBy = approvedBy ?? null;
      updateData.approvedAt = new Date();
    }

    if (status === 'REJECTED' && rejectedReason) {
      updateData.rejectedReason = rejectedReason;
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        ...updateData,
      },
      include: {
        staff: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            email: true,
            roleType: true,
          },
        },
        approver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // ─── Envoi de l'email de notification au personnel ──
    if (status === 'APPROVED' || status === 'REJECTED') {
      this.sendLeaveDecisionEmail(updated, tenantId, status, rejectedReason).catch((err) => {
        this.logger.error(`Failed to send leave decision email: ${err.message}`);
      });

      // ─── ⭐ 2026-11-21 — Notification IN-APP (cloche) au personnel ──
      //    le personnel est notifié DANS SON INTERFACE dès que le RH
      //    approuve ou refuse sa demande (en plus de l'email).
      this.notifyStaffLeaveDecisionInApp(updated, tenantId, status, rejectedReason).catch(
        (err) => this.logger.error(`notifyStaffLeaveDecisionInApp failed (non-blocking): ${err.message}`),
      );
    }

    // ─── Fusion #3 : auto-créer des lignes ABSENT dans staff_attendances ──
    //    Quand un congé est APPROVED, on génère une ligne d'absence pour
    //    chaque jour couvert par la période du congé (incluse). Cela fait
    //    du pointage la source unique de vérité "qui était absent le jour J"
    //    et élimine le doublon conceptuel entre Congés et Présences.
    //
    //    Stratégie :
    //      - On n'écrase pas une ligne d'attendance déjà existante pour
    //        ce staff + ce jour (ex: si le recruteur a déjà pointé ABSENT
    //        manuellement, on garde la trace originale).
    //      - Pour chaque jour non déjà enregistré, on crée une ligne avec
    //        status='ABSENT' et un note "Congé <type> approuvé le <date>".
    //      - L'academicYearId est hérité du congé ; schoolLevelId du staff.
    if (status === 'APPROVED') {
      this.generateAttendanceForApprovedLeave(updated, tenantId).catch((err) => {
        this.logger.error(
          `[processLeaveRequest] generateAttendanceForApprovedLeave failed (non-blocking): ${err.message}`,
        );
      });
    }

    return updated;
  }

  /**
   * Génère les lignes d'attendance ABSENT pour chaque jour couvert par
   * un congé approuvé. Ne crée pas de doublon si une ligne existe déjà
   * pour le même (staffId, date).
   */
  private async generateAttendanceForApprovedLeave(
    leaveRequest: any,
    tenantId: string,
  ): Promise<void> {
    if (!leaveRequest?.staffId || !leaveRequest?.startDate || !leaveRequest?.endDate) {
      return;
    }

    const startDate = new Date(leaveRequest.startDate);
    const endDate = new Date(leaveRequest.endDate);
    if (endDate < startDate) return;

    // Récupérer le schoolLevelId du staff (si défini)
    let schoolLevelId: string | null = null;
    try {
      const staff = await this.prisma.staff.findUnique({
        where: { id: leaveRequest.staffId },
        select: { schoolLevelId: true, academicYearId: true },
      });
      schoolLevelId = staff?.schoolLevelId ?? null;
      // Si le staff a un academicYearId, on l'utilise ; sinon on prend celui
      // du congé (qui devrait toujours être défini)
      if (staff?.academicYearId) {
        // priorité au staff
      }
    } catch (err: any) {
      this.logger.warn(`generateAttendance: failed to load staff: ${err.message}`);
    }

    const academicYearId = leaveRequest.academicYearId;
    if (!academicYearId) {
      this.logger.warn(
        `[generateAttendanceForApprovedLeave] leaveRequest ${leaveRequest.id} has no academicYearId — skipping`,
      );
      return;
    }

    // Itérer sur chaque jour entre startDate et endDate (inclus)
    const leaveTypeLabel = LEAVE_TYPE_LABELS[leaveRequest.type] || 'Congé';
    const note = `Congé ${leaveTypeLabel} approuvé le ${new Date().toLocaleDateString('fr-FR')}`;

    const days: Date[] = [];
    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    let createdCount = 0;
    let skippedCount = 0;
    for (const day of days) {
      try {
        // Vérifier si une ligne existe déjà pour ce (staffId, date)
        // ⚠ La contrainte @@unique([staffId, date]) impose l'unicité.
        const existing = await this.prisma.staffAttendance.findUnique({
          where: {
            staffId_date: {
              staffId: leaveRequest.staffId,
              date: day,
            },
          },
          select: { id: true },
        });
        if (existing) {
          skippedCount++;
          continue;
        }

        await this.prisma.staffAttendance.create({
          data: {
            ...prismaCreateDefaults(),
            tenantId,
            academicYearId,
            schoolLevelId,
            staffId: leaveRequest.staffId,
            date: day,
            status: 'ABSENT',
            hoursWorked: 0,
            notes: note,
          },
        });
        createdCount++;
      } catch (err: any) {
        // Non bloquant — on log et on continue
        this.logger.warn(
          `[generateAttendanceForApprovedLeave] failed for staff=${leaveRequest.staffId} date=${day.toISOString().slice(0, 10)}: ${err.message}`,
        );
      }
    }

    this.logger.log(
      `[generateAttendanceForApprovedLeave] leave=${leaveRequest.id} staff=${leaveRequest.staffId} — ${createdCount} attendance rows created, ${skippedCount} already existing`,
    );
  }

  /**
   * ⭐ 2026-11-21 — Notification in-app (cloche) au personnel concerné quand
   * le RH a traité sa demande : APPROVED → "demande approuvée", REJECTED →
   * "demande refusée" (+ motif). Le clic sur la notification ouvre SA page
   * self-service présence/congés. Fire-and-forget — jamais bloquant.
   */
  private async notifyStaffLeaveDecisionInApp(
    leaveRequest: any,
    tenantId: string,
    decision: 'APPROVED' | 'REJECTED',
    rejectedReason?: string,
  ): Promise<void> {
    const staff = leaveRequest?.staff;
    if (!staff?.email) {
      this.logger.warn(`notifyStaffLeaveDecisionInApp: pas d'email staff — ignoré`);
      return;
    }

    const fmt = (d: string | Date) => new Date(d).toLocaleDateString('fr-FR');
    const typeLabel = LEAVE_TYPE_LABELS[leaveRequest.type] || leaveRequest.type;

    const approver = leaveRequest.approver;
    const approverName = approver
      ? `${approver.firstName || ''} ${approver.lastName || ''}`.trim()
      : undefined;

    if (decision === 'APPROVED') {
      await this.notifyStaffUser({
        tenantId,
        staffEmail: staff.email,
        staffRoleType: staff.roleType,
        type: 'LEAVE_REQUEST_APPROVED',
        title: 'Demande approuvée',
        body:
          `Votre ${typeLabel.toLowerCase()} (${fmt(leaveRequest.startDate)} → ${fmt(leaveRequest.endDate)}) ` +
          `a été approuvée par ${approverName || 'la direction'}.`,
        relatedEntityType: 'LeaveRequest',
        relatedEntityId: leaveRequest.id,
      });
    } else {
      await this.notifyStaffUser({
        tenantId,
        staffEmail: staff.email,
        staffRoleType: staff.roleType,
        type: 'LEAVE_REQUEST_REJECTED',
        title: 'Demande refusée',
        body:
          `Votre ${typeLabel.toLowerCase()} (${fmt(leaveRequest.startDate)} → ${fmt(leaveRequest.endDate)}) ` +
          `a été refusée${rejectedReason ? ` : ${rejectedReason}` : '.'}`,
        relatedEntityType: 'LeaveRequest',
        relatedEntityId: leaveRequest.id,
      });
    }
  }

  /**
   * Envoie un email de notification au personnel pour l'approbation ou le rejet
   * de sa demande de congé. Utilise le template Helm standardisé.
   */
  private async sendLeaveDecisionEmail(
    leaveRequest: any,
    tenantId: string,
    decision: 'APPROVED' | 'REJECTED',
    rejectionReason?: string,
  ) {
    try {
      const staff = leaveRequest.staff;
      if (!staff?.email) {
        this.logger.warn(`No email for staff ${staff?.id} — skipping leave decision notification`);
        return;
      }

      const branding = await this.notificationService.getTenantBranding(tenantId);

      // Calculate days count
      const startDate = new Date(leaveRequest.startDate);
      const endDate = new Date(leaveRequest.endDate);
      const daysCount = Math.ceil(
        Math.abs(endDate.getTime() - startDate.getTime()) / 86400000,
      ) + 1;

      const approver = leaveRequest.approver;
      const approverName = approver
        ? `${approver.firstName || ''} ${approver.lastName || ''}`.trim()
        : undefined;

      const { subject, html } = renderLeaveDecisionEmail({
        branding,
        staffName: `${staff.firstName} ${staff.lastName}`,
        leaveType: leaveRequest.type,
        leaveTypeLabel: LEAVE_TYPE_LABELS[leaveRequest.type] || leaveRequest.type,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        daysCount,
        reason: leaveRequest.reason,
        decision,
        rejectionReason,
        approverName,
      });

      // ⭐ Tâche 181 — voie centralisée : SMTP de l'école (file + plafond)
      // (catégorie RECRUTEMENT = pôle RH dans la taxonomie EmailLog)
      await this.emailService.sendCategorized({
        tenantId,
        category: 'RECRUTEMENT',
        subCategory: decision === 'APPROVED' ? 'conge_approuve' : 'conge_rejete',
        module: 'hr',
        to: staff.email,
        recipientType: 'STAFF',
        subject,
        html,
        fromName: branding.schoolName || 'Academia Helm',
      });

      this.logger.log(`Leave decision email sent to ${staff.email} (${decision})`);
    } catch (err) {
      this.logger.error(`sendLeaveDecisionEmail failed: ${err.message}`, err.stack);
    }
  }

  /**
   * Retrieves all leave requests for a tenant, with optional filters.
   *
   * @param tenantId - Tenant ID for scoping
   * @param filters - Optional filter criteria
   * @returns Array of LeaveRequest records with staff details
   */
  async findAllLeaveRequests(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      staffId?: string;
      status?: string;
      type?: string;
    },
  ) {
    const where: Record<string, unknown> = { tenantId };

    if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters?.schoolLevelId) where.schoolLevelId = filters.schoolLevelId;
    if (filters?.staffId) where.staffId = filters.staffId;
    if (filters?.status) where.status = filters.status;
    if (filters?.type) where.type = filters.type;

    const requests = await this.prisma.leaveRequest.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            position: true,
            roleType: true,
            photo: { select: { thumbnailUrl: true } },
            // ⭐ 2026-11-26 — séparation RH par niveau (Congés & Absences)
            schoolLevel: { select: { name: true, code: true } },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    // Resolve photo URLs for R2/S3 storage
    return Promise.all(requests.map(async (r) => ({
      ...r,
      staff: r.staff ? {
        ...r.staff,
        staffCode: r.staff.employeeNumber,
        photoUrl: r.staff.photo?.thumbnailUrl
          ? await this.storageService.resolveFileUrl(r.staff.photo.thumbnailUrl)
          : null,
      } : r.staff,
    })));
  }

  /**
   * Retrieves a single leave request by ID.
   *
   * @param id - Leave request ID
   * @param tenantId - Tenant ID for scoping
   * @returns The LeaveRequest record with staff and approver details
   */
  async findLeaveRequestById(id: string, tenantId: string) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, tenantId },
      include: {
        staff: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            position: true,
            roleType: true,
          },
        },
        approver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException(`Leave request ${id} not found`);
    }

    return request;
  }

  /**
   * Calculates the leave balance for a staff member.
   *
   * Business logic (simplified):
   *  - Earned: 2.5 days per month worked since hire date
   *  - Taken: total days from APPROVED leave requests
   *  - Pending: total days from PENDING leave requests
   *  - Balance: earned - taken
   *
   * ⭐ 2026-11-21 — PRÉCISION SÉMANTIQUE : le solde affiché est le solde de
   * CONGÉS ANNUELS (acquisition 2,5 j/mois). Seules les demandes de type
   * ANNUAL consomment/reservent ce solde — les autres types (maladie,
   * maternité, paternité, sans solde, exceptionnel, ABSENCE justifiée)
   * ne déduisent PAS les congés annuels acquis. `byType` expose la
   * répartition des jours APPROUVÉS par type (pour affichage RH/paie).
   *
   * @param staffId - Staff member ID
   * @param tenantId - Tenant ID for scoping
   * @returns Object with earned, taken, pending, balance and byType figures
   */
  async calculateLeaveBalance(staffId: string, tenantId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member ${staffId} not found`);
    }

    // Calculate days from approved leave requests
    const approvedLeaves = await this.prisma.leaveRequest.findMany({
      where: {
        staffId,
        tenantId,
        status: 'APPROVED',
      },
    });

    const hireDate = staff.hireDate ?? new Date();
    const now = new Date();
    const monthsWorked =
      (now.getFullYear() - hireDate.getFullYear()) * 12 +
      (now.getMonth() - hireDate.getMonth());

    const totalEarned = monthsWorked * 2.5;

    // ⭐ Seuls les congés ANNUAL consomment le solde annuel
    const daysOf = (req: { startDate: Date; endDate: Date }) =>
      Math.ceil(Math.abs(req.endDate.getTime() - req.startDate.getTime()) / 86400000) + 1;

    const totalTaken = approvedLeaves
      .filter((req) => req.type === 'ANNUAL')
      .reduce((acc, req) => acc + daysOf(req), 0);

    // Répartition des jours APPROUVÉS par type (transparence RH/paie)
    const byType: Record<string, number> = {};
    for (const req of approvedLeaves) {
      byType[req.type] = (byType[req.type] || 0) + daysOf(req);
    }

    // Calculate days from pending leave requests
    const pendingLeaves = await this.prisma.leaveRequest.findMany({
      where: {
        staffId,
        tenantId,
        status: 'PENDING',
      },
    });

    // ⭐ Idem : seules les demandes ANNUAL en attente réservent le solde
    const totalPending = pendingLeaves
      .filter((req) => req.type === 'ANNUAL')
      .reduce((acc, req) => acc + daysOf(req), 0);

    return {
      earned: totalEarned,
      taken: totalTaken,
      pending: totalPending,
      balance: totalEarned - totalTaken,
      byType,
    };
  }

  /**
   * Supprime une demande de congé (soft-delete : status → CANCELLED)
   */
  async deleteLeaveRequest(id: string, tenantId: string) {
    const existing = await this.prisma.leaveRequest.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Leave request ${id} not found`);
    }

    // Only allow deletion of PENDING requests
    if (existing.status === 'APPROVED') {
      throw new BadRequestException('Cannot delete an approved leave request. Cancel it first.');
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        status: 'CANCELLED',
      },
    });
  }

  // ============================================================================
  // ⭐ 2026-09-15 — MODULE PRÉSENCE ENSEIGNANT (self-service congés/absences)
  //
  // Endpoints dédiés au portail enseignant (/app/teacher/presence → onglet
  // "Congés & Absences") :
  //   - GET  my-requests          : SES demandes (PENDING/APPROVED/REJECTED…)
  //   - POST my-requests          : créer SA demande de congé/absence
  //   - PUT  my-requests/:id/cancel : annuler SA demande (PENDING uniquement)
  //   - GET  my-balance           : SON solde de congés
  //
  // Le Staff est résolu par l'email de l'utilisateur connecté — jamais par un
  // staffId fourni par le client (anti-usurpation d'identité).
  // L'approbation/rejet reste du ressort de la direction (module RH →
  // Congés & Absences) ; à l'APPROBATION, le backend génère déjà les lignes
  // staff_attendances ABSENT pour chaque jour du congé.
  // ============================================================================

  /**
   * Résout le Staff actif lié à l'email de l'utilisateur connecté.
   */
  private async resolveStaffByEmail(email: string, tenantId: string) {
    return this.prisma.staff.findFirst({
      where: { email, tenantId, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, email: true, schoolLevelId: true, roleType: true, hireDate: true },
    });
  }

  /**
   * ⭐ Les demandes de congé de l'utilisateur connecté (par email).
   */
  async findMyLeaveRequests(
    tenantId: string,
    userEmail: string,
    filters?: { academicYearId?: string; status?: string },
  ) {
    const staff = await this.resolveStaffByEmail(userEmail, tenantId);
    if (!staff) {
      return { staff: null, requests: [], message: 'Aucune fiche personnel active trouvée pour votre compte — contactez la direction pour être rattaché(e) au module RH.' };
    }

    const where: any = { staffId: staff.id, tenantId };
    if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters?.status) where.status = filters.status;

    const requests = await this.prisma.leaveRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        staff: { select: { id: true, firstName: true, lastName: true, position: true } },
      },
    });

    return {
      staff: { id: staff.id, staffName: `${staff.firstName} ${staff.lastName}` },
      requests,
    };
  }

  /**
   * ⭐ L'utilisateur connecté crée SA demande de congé/absence.
   * Le staffId est résolu côté serveur (par email) — impossible de créer
   * une demande pour quelqu'un d'autre.
   */
  async createMyLeaveRequest(
    tenantId: string,
    userEmail: string,
    data: { type: string; startDate: string | Date; endDate: string | Date; reason?: string; academicYearId?: string },
  ) {
    const staff = await this.resolveStaffByEmail(userEmail, tenantId);
    if (!staff) {
      throw new BadRequestException(
        `Aucune fiche personnel active trouvée pour l'email ${userEmail}. ` +
        `Contactez la direction pour être rattaché(e) au module RH.`
      );
    }

    this.logger.log(
      `✅ Self-service congé — ${staff.firstName} ${staff.lastName} (staffId=${staff.id}) ` +
      `type=${data.type}`
    );

    return this.createLeaveRequest({
      tenantId,
      academicYearId: data.academicYearId,
      schoolLevelId: staff.schoolLevelId ?? undefined,
      staffId: staff.id,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      // ⭐ Demande créée par le personnel lui-même → le RH est notifié
      origin: 'SELF',
    });
  }

  /**
   * ⭐ L'utilisateur connecté annule SA demande (PENDING uniquement).
   * Vérifie la PROPRIÉTÉ : on ne peut annuler que ses propres demandes.
   */
  async cancelMyLeaveRequest(tenantId: string, userEmail: string, requestId: string) {
    const staff = await this.resolveStaffByEmail(userEmail, tenantId);
    if (!staff) {
      throw new BadRequestException('Aucune fiche personnel active trouvée pour votre compte.');
    }

    const request = await this.prisma.leaveRequest.findFirst({
      where: { id: requestId, tenantId },
    });
    if (!request) {
      throw new NotFoundException(`Demande de congé ${requestId} introuvable`);
    }
    if (request.staffId !== staff.id) {
      throw new BadRequestException('Vous ne pouvez annuler que vos propres demandes.');
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        `Cette demande est déjà ${request.status} — seule une demande en attente peut être annulée.`
      );
    }

    return this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: { ...prismaUpdateDefaults(), status: 'CANCELLED' },
    });
  }

  /**
   * ⭐ Le solde de congés de l'utilisateur connecté (par email).
   */
  async getMyLeaveBalance(tenantId: string, userEmail: string) {
    const staff = await this.resolveStaffByEmail(userEmail, tenantId);
    if (!staff) {
      return { staff: null, balance: null, message: 'Aucune fiche personnel active trouvée pour votre compte.' };
    }
    const balance = await this.calculateLeaveBalance(staff.id, tenantId);
    return {
      staff: { id: staff.id, staffName: `${staff.firstName} ${staff.lastName}`, hireDate: staff.hireDate },
      balance,
    };
  }
}
