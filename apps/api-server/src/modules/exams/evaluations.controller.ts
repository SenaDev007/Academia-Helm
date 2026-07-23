import { Controller, Get, Post, Body, Param, Query, UseGuards, Patch, Delete } from '@nestjs/common';
import { EvaluationsService } from './services/evaluations.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AcademicYearId } from '../../common/decorators/academic-year-id.decorator';
import { UserId } from '../../auth/decorators/user-id.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';

import { PermissionsGuard } from '../../auth/guards/permissions.guard';

/**
 * ============================================================================
 * EVALUATIONS CONTROLLER - MODULE 3
 * ============================================================================
 *
 * CRUD complet + cycle de vie des évaluations.
 *
 * Endpoints :
 *   GET    /                                   — liste filtrée
 *   GET    /:id                                — détail d'une évaluation
 *   POST   /                                   — créer une évaluation
 *   PATCH  /:id                                — mettre à jour
 *   DELETE /:id                                — supprimer (ou soft-cancel si notes)
 *   POST   /:id/open                           — ouvrir pour saisie (PLANNED → OPEN_FOR_GRADING)
 *   PATCH  /:id/submit                         — soumettre pour validation
 *   PATCH  /:id/validate                       — valider (admin/directeur)
 *   POST   /:id/cancel                         — annuler (any → CANCELLED)
 * ============================================================================
 */
@Controller('institutional-exams/evaluations')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Get()
  @Permissions('exams.read')
  async findAll(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @Query() filters: any,
  ) {
    return this.evaluationsService.findAll(tenantId, academicYearId, filters);
  }

  @Get(':id')
  @Permissions('exams.read')
  async findOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.evaluationsService.findOne(id, tenantId);
  }

  @Post()
  @Permissions('exams.manage')
  async create(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @UserId() userId: string,
    @Body() data: any,
  ) {
    // Injecter createdBy depuis l'utilisateur connecté
    return this.evaluationsService.create(tenantId, academicYearId, {
      ...data,
      createdBy: userId,
    });
  }

  @Patch(':id')
  @Permissions('exams.manage')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.evaluationsService.update(id, tenantId, data);
  }

  @Delete(':id')
  @Permissions('exams.manage')
  async remove(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.evaluationsService.remove(id, tenantId);
  }

  @Post(':id/open')
  @Permissions('exams.manage')
  async open(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.evaluationsService.open(id, tenantId);
  }

  @Patch(':id/submit')
  @Permissions('exams.manage')
  async submit(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.evaluationsService.submitForValidation(id, tenantId);
  }

  @Patch(':id/validate')
  @Permissions('exams.validate')
  async validate(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @UserId() userId: string,
  ) {
    return this.evaluationsService.validate(id, tenantId, userId);
  }

  @Post(':id/cancel')
  @Permissions('exams.manage')
  async cancel(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { reason?: string },
  ) {
    return this.evaluationsService.cancel(id, tenantId, body?.reason);
  }
}
