/**
 * ============================================================================
 * SCHEDULES PRISMA SERVICE - HR MODULE (SCHEMA-ALIGNED)
 * ============================================================================
 *
 * Service for managing staff schedules, aligned with the StaffSchedule
 * Prisma model.
 *
 * Key model: StaffSchedule
 *   - Fields: id, tenantId, academicYearId, schoolLevelId?, staffId,
 *     dayOfWeek (0-6), shiftType, startTime, endTime, role?, location?,
 *     notes?, isActive, createdAt, updatedAt
 *   - Unique constraint: [staffId, dayOfWeek, shiftType, academicYearId]
 *   - Relations: staff → Staff, tenant → Tenant, academicYear → AcademicYear,
 *     schoolLevel → SchoolLevel?
 *
 * ============================================================================
 */

import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';

@Injectable()
export class SchedulesPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // STAFF SCHEDULES
  // ============================================================================

  /**
   * Retrieves all schedules for a tenant, with optional filters.
   *
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @param filters - Optional filter criteria (academicYearId, startDate, endDate, staffId)
   * @returns Array of StaffSchedule records with staff details
   */
  async findAll(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      startDate?: string;
      endDate?: string;
      staffId?: string;
    },
  ) {
    const where: Record<string, unknown> = { tenantId };

    if (filters?.academicYearId) where.academicYearId = filters.academicYearId;
    if (filters?.staffId) where.staffId = filters.staffId;

    // startDate/endDate are provided by the frontend but StaffSchedule uses
    // dayOfWeek (not calendar dates). We still accept them for API
    // compatibility but they don't filter on the DB side since schedules
    // are recurring weekly patterns, not date-specific records.

    return this.prisma.staffSchedule.findMany({
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
        schoolLevel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  /**
   * Retrieves a single schedule by ID.
   *
   * @param id - StaffSchedule ID
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @returns The StaffSchedule record with staff details
   * @throws NotFoundException if schedule not found
   */
  async findById(id: string, tenantId: string) {
    const schedule = await this.prisma.staffSchedule.findFirst({
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
        schoolLevel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${id} not found`);
    }

    return schedule;
  }

  /**
   * Creates a new staff schedule.
   *
   * Validates:
   *  - Staff member exists within the tenant
   *  - No unique constraint violation (staffId + dayOfWeek + shiftType + academicYearId)
   *
   * @param data - Schedule creation payload
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @returns The created StaffSchedule record
   */
  async create(
    data: {
      staffId: string;
      dayOfWeek?: number;
      dayOfWeekName?: string;
      shiftType?: string;
      startTime?: string;
      endTime?: string;
      role?: string;
      location?: string;
      notes?: string;
      academicYearId?: string;
      schoolLevelId?: string;
    },
    tenantId: string,
  ) {
    // Verify staff member exists within tenant
    const staff = await this.prisma.staff.findFirst({
      where: { id: data.staffId, tenantId },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member ${data.staffId} not found`);
    }

    // ─── Resolve dayOfWeek (number 0-6) ──
    const DAY_NAME_TO_NUM: Record<string, number> = {
      SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3,
      THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
    };
    let dayOfWeek = data.dayOfWeek;
    if (dayOfWeek === undefined || dayOfWeek === null) {
      if (data.dayOfWeekName && DAY_NAME_TO_NUM[data.dayOfWeekName] !== undefined) {
        dayOfWeek = DAY_NAME_TO_NUM[data.dayOfWeekName];
      } else {
        dayOfWeek = new Date().getDay();
      }
    }

    // ─── Resolve shiftType ──
    const shiftType = data.shiftType || 'MORNING';

    // ─── Resolve start/end times ──
    const startTime = data.startTime || (shiftType === 'AFTERNOON' ? '14:00' : '08:00');
    const endTime = data.endTime || (shiftType === 'AFTERNOON' ? '18:00' : '12:00');

    // ─── Resolve academicYearId if not provided ──
    let academicYearId = data.academicYearId;
    if (!academicYearId) {
      const activeYear = await this.prisma.academicYear.findFirst({
        where: { isActive: true, tenantId },
        select: { id: true },
      });
      if (activeYear) {
        academicYearId = activeYear.id;
      } else {
        const lastYear = await this.prisma.academicYear.findFirst({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        if (!lastYear) {
          throw new BadRequestException(
            'Aucune année académique trouvée. Veuillez créer une année académique dans les paramètres.',
          );
        }
        academicYearId = lastYear.id;
      }
    }

    try {
      return await this.prisma.staffSchedule.create({
        data: {
          ...prismaCreateDefaults(),
          tenantId,
          academicYearId,
          schoolLevelId: data.schoolLevelId ?? null,
          staffId: data.staffId,
          dayOfWeek,
          shiftType,
          startTime,
          endTime,
          role: data.role ?? null,
          location: data.location ?? null,
          notes: data.notes ?? null,
          isActive: true,
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
          schoolLevel: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error: any) {
      // Handle unique constraint violation: [staffId, dayOfWeek, shiftType, academicYearId]
      if (error.code === 'P2002') {
        throw new ConflictException(
          'A schedule already exists for this staff member on this day with the same shift type and academic year',
        );
      }
      throw error;
    }
  }

  /**
   * Updates an existing staff schedule.
   *
   * @param id - StaffSchedule ID
   * @param data - Update payload (partial schedule fields)
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @returns The updated StaffSchedule record
   * @throws NotFoundException if schedule not found
   */
  async update(
    id: string,
    data: {
      staffId?: string;
      dayOfWeek?: number;
      dayOfWeekName?: string;
      shiftType?: string;
      shift?: string;
      startTime?: string;
      endTime?: string;
      role?: string;
      location?: string;
      notes?: string;
      academicYearId?: string;
      schoolLevelId?: string;
      isActive?: boolean;
    },
    tenantId: string,
  ) {
    // Verify the schedule exists within the tenant
    const schedule = await this.prisma.staffSchedule.findFirst({
      where: { id, tenantId },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${id} not found`);
    }

    // If staffId is being changed, verify the new staff exists
    if (data.staffId && data.staffId !== schedule.staffId) {
      const staff = await this.prisma.staff.findFirst({
        where: { id: data.staffId, tenantId },
      });

      if (!staff) {
        throw new NotFoundException(`Staff member ${data.staffId} not found`);
      }
    }

    // ─── Resolve dayOfWeek from dayOfWeekName if needed ──
    const DAY_NAME_TO_NUM: Record<string, number> = {
      SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3,
      THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
    };
    let resolvedDayOfWeek = data.dayOfWeek;
    if (resolvedDayOfWeek === undefined && data.dayOfWeekName) {
      resolvedDayOfWeek = DAY_NAME_TO_NUM[data.dayOfWeekName];
    }

    // Map shift → shiftType
    const resolvedShiftType = data.shiftType || data.shift;

    try {
      return await this.prisma.staffSchedule.update({
        where: { id },
        data: {
          ...prismaUpdateDefaults(),
          ...(data.staffId !== undefined && { staffId: data.staffId }),
          ...(resolvedDayOfWeek !== undefined && { dayOfWeek: resolvedDayOfWeek }),
          ...(resolvedShiftType !== undefined && { shiftType: resolvedShiftType }),
          ...(data.startTime !== undefined && { startTime: data.startTime }),
          ...(data.endTime !== undefined && { endTime: data.endTime }),
          ...(data.role !== undefined && { role: data.role }),
          ...(data.location !== undefined && { location: data.location }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.academicYearId !== undefined && { academicYearId: data.academicYearId }),
          ...(data.schoolLevelId !== undefined && { schoolLevelId: data.schoolLevelId }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
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
          schoolLevel: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    } catch (error: any) {
      // Handle unique constraint violation on update
      if (error.code === 'P2002') {
        throw new ConflictException(
          'A schedule already exists for this staff member on this day with the same shift type and academic year',
        );
      }
      throw error;
    }
  }

  /**
   * Deletes a staff schedule.
   *
   * @param id - StaffSchedule ID
   * @param tenantId - Tenant ID for multi-tenant isolation
   * @returns The deleted StaffSchedule record
   * @throws NotFoundException if schedule not found
   */
  async delete(id: string, tenantId: string) {
    const schedule = await this.prisma.staffSchedule.findFirst({
      where: { id, tenantId },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${id} not found`);
    }

    return this.prisma.staffSchedule.delete({
      where: { id },
    });
  }
}
