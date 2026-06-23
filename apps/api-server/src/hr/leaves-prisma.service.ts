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

const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL: 'Congé annuel',
  SICK: 'Congé maladie',
  MATERNITY: 'Congé maternité',
  PATERNITY: 'Congé paternité',
  UNPAID: 'Congé sans solde',
  EXCEPTIONAL: 'Congé exceptionnel',
};

@Injectable()
export class LeavesPrismaService {
  private readonly logger = new Logger(LeavesPrismaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationService: RecruitmentNotificationService,
    private readonly storageService: StorageService,
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

    return this.prisma.leaveRequest.create({
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
            position: true,
            roleType: true,
          },
        },
      },
    });
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
    }

    return updated;
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

      await this.emailService.sendEmail({
        to: staff.email,
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
   * @param staffId - Staff member ID
   * @param tenantId - Tenant ID for scoping
   * @returns Object with earned, taken, pending, and balance figures
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

    const totalTaken = approvedLeaves.reduce((acc, req) => {
      const diffMs = Math.abs(req.endDate.getTime() - req.startDate.getTime());
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
      return acc + diffDays;
    }, 0);

    // Calculate days from pending leave requests
    const pendingLeaves = await this.prisma.leaveRequest.findMany({
      where: {
        staffId,
        tenantId,
        status: 'PENDING',
      },
    });

    const totalPending = pendingLeaves.reduce((acc, req) => {
      const diffMs = Math.abs(req.endDate.getTime() - req.startDate.getTime());
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
      return acc + diffDays;
    }, 0);

    return {
      earned: totalEarned,
      taken: totalTaken,
      pending: totalPending,
      balance: totalEarned - totalTaken,
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
}
