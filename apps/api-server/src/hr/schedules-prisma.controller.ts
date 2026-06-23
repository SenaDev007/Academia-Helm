/**
 * ============================================================================
 * SCHEDULES PRISMA CONTROLLER - HR MODULE (SCHEMA-ALIGNED)
 * ============================================================================
 *
 * REST controller for staff schedule management.
 * Endpoints match the frontend PlanningWorkspace API calls:
 *   GET    /hr/schedules          — list schedules with query filters
 *   POST   /hr/schedules          — create schedule
 *   PUT    /hr/schedules/:id      — update schedule
 *   DELETE /hr/schedules/:id      — delete schedule
 *
 * NOTE: No 'api/' prefix — main.ts sets setGlobalPrefix('api')
 *
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SchedulesPrismaService } from './schedules-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { CreateScheduleDto, UpdateScheduleDto } from './dto';

@Controller('hr/schedules')
@UseGuards(JwtAuthGuard, TenantGuard)
export class SchedulesPrismaController {
  constructor(private readonly schedulesService: SchedulesPrismaService) {}

  /**
   * GET /hr/schedules
   * List schedules with optional query filters.
   *
   * Query params:
   *   - academicYearId  Filter by academic year
   *   - staffId         Filter by staff member
   *   - startDate       (accepted for API compat, schedules are weekly patterns)
   *   - endDate         (accepted for API compat, schedules are weekly patterns)
   */
  @Get()
  async findAll(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('staffId') staffId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.schedulesService.findAll(tid, {
      academicYearId,
      staffId,
      startDate,
      endDate,
    });
  }

  /**
   * POST /hr/schedules
   * Create a new staff schedule.
   */
  @Post()
  async create(
    @GetTenant() tenant: any,
    @Body() data: CreateScheduleDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }

    // ─── Resolve dayOfWeek (number 0-6) ──
    // Frontend may send:
    //   - dayOfWeek as a number (0-6)
    //   - dayOfWeekName as a string ('MONDAY', 'TUESDAY', etc.)
    //   - date as ISO string (we derive dayOfWeek from it)
    const DAY_NAME_TO_NUM: Record<string, number> = {
      SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3,
      THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
    };
    let dayOfWeek = data.dayOfWeek;
    if (dayOfWeek === undefined || dayOfWeek === null) {
      if (data.dayOfWeekName && DAY_NAME_TO_NUM[data.dayOfWeekName] !== undefined) {
        dayOfWeek = DAY_NAME_TO_NUM[data.dayOfWeekName];
      } else if (data.date) {
        dayOfWeek = new Date(data.date).getDay();
      } else {
        throw new BadRequestException('dayOfWeek, dayOfWeekName, or date is required');
      }
    }

    // Map shift → shiftType if shiftType not provided
    const shiftType = data.shiftType || data.shift || 'MORNING';

    // Default start/end times if not provided
    const startTime = data.startTime || (shiftType === 'AFTERNOON' ? '14:00' : '08:00');
    const endTime = data.endTime || (shiftType === 'AFTERNOON' ? '18:00' : '12:00');

    return this.schedulesService.create({
      ...data,
      dayOfWeek,
      shiftType,
      startTime,
      endTime,
      tenantId: tid,
    }, tid);
  }

  /**
   * PUT /hr/schedules/:id
   * Update an existing staff schedule.
   */
  @Put(':id')
  async update(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() data: UpdateScheduleDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.schedulesService.update(id, data, tid);
  }

  /**
   * DELETE /hr/schedules/:id
   * Delete a staff schedule.
   */
  @Delete(':id')
  async delete(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.schedulesService.delete(id, tid);
  }
}
