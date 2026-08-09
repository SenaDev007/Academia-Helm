/**
 * ============================================================================
 * GUARDIANS PRISMA CONTROLLER
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
  UseGuards,
} from '@nestjs/common';
import { GuardiansPrismaService } from './guardians-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CreateGuardianDto, UpdateGuardianDto, UpdateGuardianRelationDto } from './dto';

/**
 * ⭐ P2.3 — RBAC renforcé sur GuardiansPrismaController.
 *    Avant : `JwtAuthGuard` uniquement → tout user authentifié pouvait CRUD guardians.
 *    Maintenant : `TenantGuard` + `RolesGuard` + `@Roles` par endpoint.
 */
const MANAGEMENT_ROLES = [
  'ADMIN', 'DIRECTOR', 'SCHOOL_ADMIN', 'DIRECTEUR',
  'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'SUPER_DIRECTOR',
  'PROMOTER', 'SCHOOL_OWNER', 'BOARD_PRESIDENT', 'SECRETARY', 'TEACHER',
];

@Controller('students/:studentId/guardians')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class GuardiansPrismaController {
  constructor(private readonly guardiansService: GuardiansPrismaService) {}

  @Post()
  @Roles(...MANAGEMENT_ROLES)
  async create(
    @Param('studentId') studentId: string,
    @TenantId() tenantId: string,
    @Body() createDto: CreateGuardianDto,
  ) {
    return this.guardiansService.createGuardianForStudent({
      ...createDto,
      tenantId,
      studentId,
    });
  }

  @Get()
  async findAll(
    @Param('studentId') studentId: string,
    @TenantId() tenantId: string,
  ) {
    return this.guardiansService.getStudentGuardians(studentId, tenantId);
  }

  @Put(':guardianId')
  @Roles(...MANAGEMENT_ROLES)
  async update(
    @Param('guardianId') guardianId: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateGuardianDto,
  ) {
    return this.guardiansService.updateGuardian(guardianId, tenantId, updateDto);
  }

  @Put('relation/:studentGuardianId')
  @Roles(...MANAGEMENT_ROLES)
  async updateRelation(
    @Param('studentGuardianId') studentGuardianId: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateGuardianRelationDto,
  ) {
    return this.guardiansService.updateStudentGuardian(
      studentGuardianId,
      tenantId,
      updateDto,
    );
  }

  @Delete(':studentGuardianId')
  @Roles(...MANAGEMENT_ROLES)
  async remove(
    @Param('studentGuardianId') studentGuardianId: string,
    @TenantId() tenantId: string,
  ) {
    return this.guardiansService.removeStudentGuardian(studentGuardianId, tenantId);
  }
}
