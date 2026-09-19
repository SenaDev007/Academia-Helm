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
import { SkipAcademicYear } from '../common/decorators/skip-academic-year.decorator';
import { CreateGuardianDto, UpdateGuardianDto, UpdateGuardianRelationDto } from './dto';

/**
 * ⭐ P2.3 — RBAC renforcé sur GuardiansPrismaController.
 *    Avant : `JwtAuthGuard` uniquement → tout user authentifié pouvait CRUD guardians.
 *    Maintenant : `TenantGuard` + `RolesGuard` + `@Roles` par endpoint.
 *
 * ⭐ 2026-09-19 (retour promoteur « parents sans compte utilisateur ») :
 *    la liste était plus RESTRICTIVE que celle du cycle de vie élèves
 *    (students-lifecycle.controller.ts). Le secrétaire comptable qui inscrit
 *    un élève (pre-register/admit autorisés) voyait l'ajout des parents
 *    rejeté en 403 — avalé silencieusement par le frontend (console.warn)
 *    → inscription « réussie » mais SANS guardian, donc sans compte parent.
 *    Alignement sur la liste du cycle de vie (mêmes métiers que l'inscription).
 */
const MANAGEMENT_ROLES = [
  'ADMIN', 'DIRECTOR', 'SCHOOL_ADMIN', 'DIRECTEUR',
  'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'SUPER_DIRECTOR',
  'PROMOTER', 'SCHOOL_OWNER', 'BOARD_PRESIDENT', 'SECRETARY', 'TEACHER',
  // ⭐ 2026-09-19 : secrétaires et comptables finalisent les inscriptions —
  //    usage métier légitime, aligné sur students-lifecycle.controller.ts.
  'SECRETAIRE', 'SECRETAIRE_COMPTABLE', 'COMPTABLE', 'ACCOUNTANT',
  'RESP_SCOLARITE', 'CENSEUR', 'ECONOME', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR',
];

@Controller('students/:studentId/guardians')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@SkipAcademicYear() // ⭐ Les guardians ne sont pas liés à une année scolaire.
//    Sans ce décorateur, l'AcademicYearEnforcementInterceptor injecte
//    academicYearId dans request.body → le ValidationPipe rejette avec
//    "property academicYearId should not exist" (CreateGuardianDto
//    n'a pas de champ academicYearId, et forbidNonWhitelisted=true).
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
