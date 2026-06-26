import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, BadRequestException, Logger,
} from '@nestjs/common';
import { StaffAdminAssignmentService } from './staff-admin-assignment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';

/**
 * ============================================================================
 * StaffAdminAssignmentController — CRUD des affectations administratives
 * ============================================================================
 *
 * Endpoints (tous authentifiés + réservés aux directeurs/admins) :
 *
 *   GET    /api/staff-admin-assignments                    → liste (filtres: staffId, schoolLevelCode, adminRole, isActive)
 *   GET    /api/staff-admin-assignments/:id                → détail
 *   POST   /api/staff-admin-assignments                    → crée
 *   PUT    /api/staff-admin-assignments/:id                → met à jour
 *   DELETE /api/staff-admin-assignments/:id                → supprime
 *   GET    /api/staff-admin-assignments/staff/:staffId     → affectations d'un staff
 *   GET    /api/staff-admin-assignments/resolve-levels/:staffId → niveaux administrés par un staff
 * ============================================================================
 */

function resolveTid(tenant: any, tenantIdFallback?: string): string {
  const tid = tenant?.id || tenantIdFallback;
  if (!tid) throw new BadRequestException('Tenant ID requis pour cette opération');
  return tid;
}

@Controller('staff-admin-assignments')
@Roles('SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'SCHOOL_ADMIN', 'SCHOOL_OWNER', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PROMOTER', 'DIRECTEUR_MATERNELLE', 'DIRECTEUR_PRIMAIRE', 'DIRECTEUR_SECONDAIRE', 'DIRECTEUR_MAT_PRI', 'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'admin')
export class StaffAdminAssignmentController {
  private readonly logger = new Logger(StaffAdminAssignmentController.name);

  constructor(private readonly service: StaffAdminAssignmentService) {}

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Get()
  async list(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Query('staffId') staffId?: string,
    @Query('schoolLevelCode') schoolLevelCode?: string,
    @Query('adminRole') adminRole?: string,
    @Query('isActive') isActive?: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    return this.service.list(tid, {
      staffId,
      schoolLevelCode,
      adminRole,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Get('staff/:staffId')
  async getByStaff(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Param('staffId') staffId: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    return this.service.getByStaff(tid, staffId);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Get('resolve-levels/:staffId')
  async resolveLevels(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Param('staffId') staffId: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    const levels = await this.service.resolveAdminLevelsForStaff(tid, staffId);
    return { staffId, levelCodes: levels };
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Get(':id')
  async getById(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Param('id') id: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    return this.service.getById(tid, id);
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Post()
  async create(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Body() body: {
      staffId: string;
      schoolLevelCode: string;
      adminRole: string;
      academicYearId?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    if (!body?.staffId || !body?.schoolLevelCode || !body?.adminRole) {
      throw new BadRequestException('staffId, schoolLevelCode et adminRole sont requis');
    }
    return this.service.create(tid, {
      staffId: body.staffId,
      schoolLevelCode: body.schoolLevelCode,
      adminRole: body.adminRole,
      academicYearId: body.academicYearId,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Put(':id')
  async update(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Param('id') id: string,
    @Body() body: {
      schoolLevelCode?: string;
      adminRole?: string;
      academicYearId?: string | null;
      startDate?: string;
      endDate?: string | null;
      isActive?: boolean;
    },
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    return this.service.update(tid, id, {
      schoolLevelCode: body.schoolLevelCode,
      adminRole: body.adminRole,
      academicYearId: body.academicYearId,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      isActive: body.isActive,
    });
  }

  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Delete(':id')
  async delete(
    @GetTenant() tenant: any,
    @TenantId() tenantIdFallback: string,
    @Param('id') id: string,
  ) {
    const tid = resolveTid(tenant, tenantIdFallback);
    await this.service.delete(tid, id);
    return { success: true };
  }
}
