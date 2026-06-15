import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { QhsService } from './qhs.service';
import { CreateQhsIncidentDto } from './dto/create-qhs-incident.dto';
import { UpdateQhsIncidentDto } from './dto/update-qhs-incident.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('qhs')
@UseGuards(JwtAuthGuard)
export class QhsController {
  constructor(private readonly qhsService: QhsService) {}

  // ============================================================================
  // INCIDENTS
  // ============================================================================

  @Post('incidents')
  async createIncident(
    @TenantId() tenantId: string,
    @Body() createDto: CreateQhsIncidentDto,
    @CurrentUser() user: any,
  ) {
    return this.qhsService.createIncident(tenantId, createDto, user?.id);
  }

  @Get('incidents')
  async findAllIncidents(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('type') type?: string,
    @Query('gravity') gravity?: string,
    @Query('status') status?: string,
  ) {
    return this.qhsService.findAllIncidents(tenantId, academicYearId, schoolLevelId, {
      type,
      gravity,
      status,
    });
  }

  @Get('incidents/:id')
  async findOneIncident(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.qhsService.findOneIncident(id, tenantId);
  }

  @Patch('incidents/:id')
  async updateIncident(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateQhsIncidentDto,
  ) {
    return this.qhsService.updateIncident(id, tenantId, updateDto);
  }

  // ============================================================================
  // RISK REGISTER
  // ============================================================================

  @Get('risk-register')
  async findAllRisks(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    return this.qhsService.findAllRisks(tenantId, academicYearId, schoolLevelId);
  }

  @Get('risk-register/:id')
  async findOneRisk(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.qhsService.findOneRisk(id, tenantId);
  }

  // ============================================================================
  // AUDITS
  // ============================================================================

  @Get('audits')
  async findAllAudits(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    return this.qhsService.findAllAudits(tenantId, academicYearId, schoolLevelId);
  }

  @Get('audits/:id')
  async findOneAudit(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.qhsService.findOneAudit(id, tenantId);
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  @Get('statistics')
  async getStatistics(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.qhsService.getStatistics(tenantId, academicYearId);
  }
}

