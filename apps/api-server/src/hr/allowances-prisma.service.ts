/**
 * ============================================================================
 * ALLOWANCES PRISMA SERVICE - HR MODULE (SCHEMA-ALIGNED v3)
 * ============================================================================
 *
 * Service for managing allowance types and staff allowance assignments,
 * aligned with the AllowanceType and StaffAllowance Prisma models.
 *
 * Key models:
 *   - AllowanceType : Templates for allowances (per tenant)
 *     Fields: id, tenantId, name, code (@unique), description?, isTaxable,
 *             isCnss, amount (Decimal?), isFixed, isActive, createdAt, updatedAt
 *     Relations: tenant → Tenant, assignments → StaffAllowance[]
 *
 *   - StaffAllowance : Allowance assignments to staff members
 *     Fields: id, tenantId, academicYearId?, schoolLevelId?, staffId,
 *             allowanceTypeId, amount (Decimal), effectiveDate, endDate?,
 *             status (ACTIVE/INACTIVE/CANCELLED), notes?, createdAt, updatedAt
 *     Relations: staff → Staff, allowanceType → AllowanceType, tenant → Tenant,
 *                academicYear → AcademicYear?
 *
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AllowancesPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // ALLOWANCE TYPES (Templates)
  // ============================================================================

  /**
   * Creates a new allowance type for a tenant.
   *
   * Validates code uniqueness (code is @unique in the schema).
   *
   * @param data - Allowance type creation payload
   * @returns The created AllowanceType record
   */
  async createAllowanceType(data: {
    tenantId: string;
    name: string;
    code: string;
    description?: string;
    isTaxable?: boolean;
    isCnss?: boolean;
    amount?: number;
    isFixed?: boolean;
    isActive?: boolean;
  }) {
    // Verify code uniqueness across tenants (code is @unique globally in schema)
    const existing = await this.prisma.allowanceType.findFirst({
      where: { code: data.code },
    });
    if (existing) {
      throw new BadRequestException(
        `Allowance type with code '${data.code}' already exists`,
      );
    }

    return this.prisma.allowanceType.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        code: data.code,
        description: data.description ?? null,
        isTaxable: data.isTaxable ?? true,
        isCnss: data.isCnss ?? false,
        amount: data.amount !== undefined && data.amount !== null ? new Prisma.Decimal(data.amount) : null,
        isFixed: data.isFixed ?? true,
        isActive: data.isActive ?? true,
      },
    });
  }

  /**
   * Retrieves all active allowance types for a tenant.
   *
   * @param tenantId - Tenant ID for scoping
   * @param includeInactive - Whether to include inactive types (default: false)
   * @returns Array of AllowanceType records with assignment counts
   */
  async findAllAllowanceTypes(tenantId: string, includeInactive = false) {
    const where: Record<string, unknown> = { tenantId };
    if (!includeInactive) where.isActive = true;

    return this.prisma.allowanceType.findMany({
      where,
      include: {
        _count: { select: { assignments: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Updates an existing allowance type.
   *
   * @param id - Allowance type ID
   * @param tenantId - Tenant ID for scoping
   * @param data - Partial update payload
   * @returns The updated AllowanceType record
   */
  async updateAllowanceType(id: string, tenantId: string, data: Record<string, unknown>) {
    const existing = await this.prisma.allowanceType.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Allowance type ${id} not found`);
    }

    return this.prisma.allowanceType.update({
      where: { id },
      data,
    });
  }

  /**
   * Retrieves a single allowance type by ID.
   *
   * @param id - Allowance type ID
   * @param tenantId - Tenant ID for scoping
   * @returns The AllowanceType record with assignment count
   */
  async findAllowanceTypeById(id: string, tenantId: string) {
    const allowanceType = await this.prisma.allowanceType.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { assignments: true } },
      },
    });

    if (!allowanceType) {
      throw new NotFoundException(`Allowance type ${id} not found`);
    }

    return allowanceType;
  }

  // ============================================================================
  // STAFF ALLOWANCES (Assignments)
  // ============================================================================

  /**
   * Assigns an allowance to a staff member.
   *
   * Validates:
   *  - Allowance type exists within tenant
   *  - Staff member exists within tenant
   *
   * @param data - Staff allowance assignment payload
   * @returns The created StaffAllowance record with allowanceType included
   */
  async assignAllowanceToStaff(data: {
    tenantId: string;
    academicYearId?: string;
    schoolLevelId?: string;
    staffId: string;
    allowanceTypeId: string;
    amount: number;
    effectiveDate: Date;
    endDate?: Date;
    notes?: string;
  }) {
    // Verify allowance type exists within tenant
    const allowanceType = await this.prisma.allowanceType.findFirst({
      where: { id: data.allowanceTypeId, tenantId: data.tenantId },
    });
    if (!allowanceType) {
      throw new NotFoundException(
        `Allowance type ${data.allowanceTypeId} not found`,
      );
    }

    // Verify staff member exists within tenant
    const staff = await this.prisma.staff.findFirst({
      where: { id: data.staffId, tenantId: data.tenantId },
    });
    if (!staff) {
      throw new NotFoundException(`Staff member ${data.staffId} not found`);
    }

    return this.prisma.staffAllowance.create({
      data: {
        tenantId: data.tenantId,
        academicYearId: data.academicYearId ?? null,
        schoolLevelId: data.schoolLevelId ?? null,
        staffId: data.staffId,
        allowanceTypeId: data.allowanceTypeId,
        amount: new Prisma.Decimal(data.amount),
        effectiveDate: data.effectiveDate,
        endDate: data.endDate ?? null,
        status: 'ACTIVE',
        notes: data.notes ?? null,
      },
      include: {
        allowanceType: true,
      },
    });
  }

  /**
   * Retrieves all allowances assigned to a staff member.
   *
   * @param staffId - Staff member ID
   * @param tenantId - Tenant ID for scoping
   * @param includeInactive - Whether to include inactive/cancelled assignments
   * @returns Array of StaffAllowance records with allowanceType details
   */
  async findStaffAllowances(
    staffId: string,
    tenantId: string,
    includeInactive = false,
  ) {
    const where: Record<string, unknown> = { staffId, tenantId };
    if (!includeInactive) where.status = 'ACTIVE';

    return this.prisma.staffAllowance.findMany({
      where,
      include: {
        allowanceType: true,
      },
      orderBy: { effectiveDate: 'desc' },
    });
  }

  /**
   * Retrieves all staff allowance assignments for a tenant with optional filters.
   *
   * @param tenantId - Tenant ID for scoping
   * @param filters - Optional filter criteria (staffId, allowanceTypeId, status)
   * @returns Array of StaffAllowance records with staff and allowanceType details
   */
  async findAllStaffAllowances(
    tenantId: string,
    filters?: {
      staffId?: string;
      allowanceTypeId?: string;
      status?: string;
    },
  ) {
    const where: Record<string, unknown> = { tenantId };

    if (filters?.staffId) where.staffId = filters.staffId;
    if (filters?.allowanceTypeId) where.allowanceTypeId = filters.allowanceTypeId;
    if (filters?.status) where.status = filters.status;

    return this.prisma.staffAllowance.findMany({
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
        allowanceType: true,
      },
      orderBy: { effectiveDate: 'desc' },
    });
  }

  /**
   * Updates a staff allowance assignment.
   *
   * @param id - Staff allowance ID
   * @param tenantId - Tenant ID for scoping
   * @param data - Partial update payload
   * @returns The updated StaffAllowance record
   */
  async updateStaffAllowance(
    id: string,
    tenantId: string,
    data: Record<string, unknown>,
  ) {
    const existing = await this.prisma.staffAllowance.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Staff allowance ${id} not found`);
    }

    return this.prisma.staffAllowance.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft-deletes a staff allowance assignment by setting status to INACTIVE.
   *
   * @param id - Staff allowance ID
   * @param tenantId - Tenant ID for scoping
   * @returns The updated StaffAllowance record with INACTIVE status
   */
  async removeStaffAllowance(id: string, tenantId: string) {
    const existing = await this.prisma.staffAllowance.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Staff allowance ${id} not found`);
    }

    return this.prisma.staffAllowance.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }
}
