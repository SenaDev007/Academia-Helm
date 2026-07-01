/**
 * ============================================================================
 * STUDENTS ORION CONTROLLER - MODULE 1
 * ============================================================================
 *
 * Controller ORION pour alertes matricule et cartes scolaires
 *
 * ============================================================================
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetTenant } from '../../common/decorators/tenant.decorator';
import { StudentsOrionService } from '../services/students-orion.service';

/**
 * Rôles autorisés à consulter ORION (KPIs + alertes).
 * ⚠️ Le @Roles au niveau classe est ignoré par RolesGuard (qui ne lit que
 * les métadonnées method-level). On déclare donc @Roles au niveau méthode.
 */
const ORION_VIEWER_ROLES = [
  'ADMIN', 'DIRECTOR', 'DIRECTEUR',
  'SUPER_DIRECTOR', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'SCHOOL_DIRECTOR',
  'DIRECTOR_GENERAL', 'DIRECTEUR_MATERNELLE', 'DIRECTEUR_PRIMAIRE',
  'DIRECTEUR_SECONDAIRE', 'DIRECTEUR_MAT_PRI',
  'PROMOTER', 'PROMOTEUR',
  'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN',
  'TEACHER', 'SECRETARY',
  'admin',
];

@Controller('students/orion')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class StudentsOrionController {
  constructor(private readonly orionService: StudentsOrionService) {}

  /**
   * Récupère les KPIs ORION pour matricule et cartes
   */
  @Get('kpis')
  @Roles(...ORION_VIEWER_ROLES)
  async getIdentificationKPIs(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.orionService.getStudentIdentificationKPIs(tenant.id, academicYearId);
  }

  /**
   * Récupère les alertes ORION pour matricule et cartes
   */
  @Get('alerts')
  @Roles(...ORION_VIEWER_ROLES)
  async getAlerts(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.orionService.generateAlerts(tenant.id, academicYearId);
  }
}

