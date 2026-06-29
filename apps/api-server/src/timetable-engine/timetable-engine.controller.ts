import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, BadRequestException,
} from '@nestjs/common';
import { TimetableEngineService, CONSTRAINT_TYPE_LABELS } from './timetable-engine.service';
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

  @Get('config')
  async getConfig(@GetTenant() tenant: any, @TenantId() fallback: string,
    @Query('schoolLevelId') schoolLevelId: string, @Query('academicYearId') academicYearId: string) {
    const tid = resolveTid(tenant, fallback);
    if (!schoolLevelId || !academicYearId) throw new BadRequestException('schoolLevelId et academicYearId requis');
    return this.service.getConfig(tid, schoolLevelId, academicYearId);
  }

  @Put('config')
  async updateConfig(@GetTenant() tenant: any, @TenantId() fallback: string, @Body() body: any) {
    const tid = resolveTid(tenant, fallback);
    return this.service.updateConfig(tid, body.schoolLevelId, body.academicYearId, body);
  }

  @Get('teachers')
  async getTeachers(@GetTenant() tenant: any, @TenantId() fallback: string, @Query('schoolLevelId') schoolLevelId?: string) {
    const tid = resolveTid(tenant, fallback);
    return this.service.getTeachersWithAvailability(tid, schoolLevelId);
  }

  @Get('availability')
  async getAvailability(@GetTenant() tenant: any, @TenantId() fallback: string, @Query('teacherId') teacherId?: string) {
    const tid = resolveTid(tenant, fallback);
    return this.service.getAvailability(tid, teacherId);
  }

  @Post('availability')
  async setAvailability(@GetTenant() tenant: any, @TenantId() fallback: string, @Body() body: any) {
    const tid = resolveTid(tenant, fallback);
    return this.service.setAvailability(tid, body);
  }

  @Delete('availability/:id')
  async deleteAvailability(@GetTenant() tenant: any, @TenantId() fallback: string, @Param('id') id: string) {
    const tid = resolveTid(tenant, fallback);
    return this.service.deleteAvailability(tid, id);
  }

  @Get('constraints')
  async getConstraints(@GetTenant() tenant: any, @TenantId() fallback: string,
    @Query('schoolLevelId') schoolLevelId?: string, @Query('type') type?: string,
    @Query('severity') severity?: string, @Query('isActive') isActive?: string) {
    const tid = resolveTid(tenant, fallback);
    return this.service.getConstraints(tid, schoolLevelId, {
      type, severity, isActive: isActive === undefined ? undefined : isActive === 'true',
    });
  }

  @Get('constraints/types')
  async getConstraintTypes() {
    return Object.entries(CONSTRAINT_TYPE_LABELS).map(([key, value]) => ({
      type: key, label: value.label, description: value.description, entityType: value.entityType,
    }));
  }

  @Post('constraints')
  async createConstraint(@GetTenant() tenant: any, @TenantId() fallback: string, @Body() body: any) {
    const tid = resolveTid(tenant, fallback);
    return this.service.createConstraint(tid, body);
  }

  @Put('constraints/:id')
  async updateConstraint(@GetTenant() tenant: any, @TenantId() fallback: string, @Param('id') id: string, @Body() body: any) {
    const tid = resolveTid(tenant, fallback);
    return this.service.updateConstraint(tid, id, body);
  }

  @Delete('constraints/:id')
  async deleteConstraint(@GetTenant() tenant: any, @TenantId() fallback: string, @Param('id') id: string) {
    const tid = resolveTid(tenant, fallback);
    return this.service.deleteConstraint(tid, id);
  }

  @Post('generate')
  async generate(@GetTenant() tenant: any, @TenantId() fallback: string, @Body() body: { academicYearId: string; schoolLevelId: string }) {
    const tid = resolveTid(tenant, fallback);
    if (!body.academicYearId || !body.schoolLevelId) throw new BadRequestException('academicYearId et schoolLevelId requis');
    return this.service.generate(tid, body.academicYearId, body.schoolLevelId);
  }

  @Post('generate-multi')
  async generateMulti(@GetTenant() tenant: any, @TenantId() fallback: string, @Body() body: any) {
    const tid = resolveTid(tenant, fallback);
    if (!body.academicYearId || !body.schoolLevelId) throw new BadRequestException('academicYearId et schoolLevelId requis');
    return this.service.generateMulti(tid, body.academicYearId, body.schoolLevelId, {
      strategies: body.strategies, backtrackingDepth: body.backtrackingDepth,
    });
  }

  @Get('solutions')
  async getSolutions(@GetTenant() tenant: any, @TenantId() fallback: string,
    @Query('academicYearId') academicYearId: string, @Query('schoolLevelId') schoolLevelId: string) {
    const tid = resolveTid(tenant, fallback);
    return this.service.getSolutions(tid, academicYearId, schoolLevelId);
  }

  @Post('solutions/:id/accept')
  async acceptSolution(@GetTenant() tenant: any, @TenantId() fallback: string, @Param('id') id: string) {
    const tid = resolveTid(tenant, fallback);
    return this.service.acceptSolution(tid, id);
  }
}
