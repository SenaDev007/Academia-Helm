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

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';

@Injectable()
export class LeavesPrismaService {
  constructor(private readonly prisma: PrismaService) {}

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
  /**
   * Resolves the academicYearId: returns the provided value if truthy,
   * otherwise looks up the active academic year for the tenant.
   * Returns null if no active academic year is found.
   */
  private async resolveAcademicYearId(tenantId: string, academicYearId?: string): Promise<string | null> {
    if (academicYearId) return academicYearId;
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
    });
    return activeYear?.id || null;
  }

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

    // Resolve academicYearId if not provided
    const resolvedAcademicYearId = await this.resolveAcademicYearId(data.tenantId, data.academicYearId);
    if (!resolvedAcademicYearId) {
      throw new BadRequestException('Aucune année académique active trouvée. Veuillez en configurer une.');
    }

    // Verify staff member exists within tenant
    const staff = await this.prisma.staff.findFirst({
      where: { id: data.staffId, tenantId: data.tenantId },
    });
    if (!staff) {
      throw new NotFoundException(`Staff member ${data.staffId} not found`);
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
        academicYearId: resolvedAcademicYearId,
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

    return this.prisma.leaveRequest.update({
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

    return this.prisma.leaveRequest.findMany({
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
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });
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
