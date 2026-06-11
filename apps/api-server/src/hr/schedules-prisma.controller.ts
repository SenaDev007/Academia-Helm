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
    // Derive dayOfWeek from date if not provided
    let dayOfWeek = data.dayOfWeek;
    if (!dayOfWeek && data.date) {
      dayOfWeek = new Date(data.date).getDay();
    }
    // Map shift → shiftType if shiftType not provided
    const shiftType = data.shiftType || data.shift || 'MORNING';
    return this.schedulesService.create({
      ...data,
      dayOfWeek,
      shiftType,
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
