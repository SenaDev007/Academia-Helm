import {
  Controller, Get, Post, Put, Body, Param, Query, UseGuards, BadRequestException,
} from '@nestjs/common';
import { TimetableEngineService } from './timetable-engine.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';

function resolveTid(tenant: any, fallback?: string): string {
  const tid = tenant?.id || fallback;
  if (!tid) throw new BadRequestException('Tenant ID requis');
  return tid;
}

@Controller('timetable-engine')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TimetableEngineController {
  constructor(private readonly service: TimetableEngineService) {}

  // ═══ CONFIG ═══

  @Get('config')
  async getConfig(
    @GetTenant() tenant: any, @TenantId() fallback: string,
    @Query('schoolLevelId') schoolLevelId: string, @Query('academicYearId') academicYearId: string,
  ) {
    const tid = resolveTid(tenant, fallback);
    if (!schoolLevelId || !academicYearId) throw new BadRequestException('schoolLevelId et academicYearId requis');
    return this.service.getConfig(tid, schoolLevelId, academicYearId);
  }

  @Put('config')
  async updateConfig(
    @GetTenant() tenant: any, @TenantId() fallback: string,
    @Body() body: { schoolLevelId: string; academicYearId: string; [key: string]: any },
  ) {
    const tid = resolveTid(tenant, fallback);
    return this.service.updateConfig(tid, body.schoolLevelId, body.academicYearId, body);
  }

  // ═══ AVAILABILITY ═══

  @Get('availability')
  async getAvailability(
    @GetTenant() tenant: any, @TenantId() fallback: string,
    @Query('teacherId') teacherId?: string,
  ) {
    const tid = resolveTid(tenant, fallback);
    return this.service.getAvailability(tid, teacherId);
  }

  @Post('availability')
  async setAvailability(
    @GetTenant() tenant: any, @TenantId() fallback: string,
    @Body() body: { teacherId: string; staffId?: string; dayOfWeek: number; startTime: string; endTime: string; status: string; reason?: string },
  ) {
    const tid = resolveTid(tenant, fallback);
    return this.service.setAvailability(tid, body);
  }

  // ═══ GENERATE ═══

  @Post('generate')
  async generate(
    @GetTenant() tenant: any, @TenantId() fallback: string,
    @Body() body: { academicYearId: string; schoolLevelId: string },
  ) {
    const tid = resolveTid(tenant, fallback);
    if (!body.academicYearId || !body.schoolLevelId) throw new BadRequestException('academicYearId et schoolLevelId requis');
    return this.service.generate(tid, body.academicYearId, body.schoolLevelId);
  }

  // ═══ SOLUTIONS ═══

  @Get('solutions')
  async getSolutions(
    @GetTenant() tenant: any, @TenantId() fallback: string,
    @Query('academicYearId') academicYearId: string, @Query('schoolLevelId') schoolLevelId: string,
  ) {
    const tid = resolveTid(tenant, fallback);
    return this.service.getSolutions(tid, academicYearId, schoolLevelId);
  }

  @Post('solutions/:id/accept')
  async acceptSolution(
    @GetTenant() tenant: any, @TenantId() fallback: string,
    @Param('id') id: string,
  ) {
    const tid = resolveTid(tenant, fallback);
    return this.service.acceptSolution(tid, id);
  }
}
