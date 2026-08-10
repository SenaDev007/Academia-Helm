import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Headers } from '@nestjs/common';
import { SchoolDirectorsService } from './school-directors.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@Controller('hr/school-directors')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class SchoolDirectorsController {
  constructor(private readonly directorsService: SchoolDirectorsService) {}

  @Get()
  @Permissions('hr.read')
  async getDirectors(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    return this.directorsService.getDirectors(resolvedTenantId);
  }

  @Post()
  @Permissions('hr.manage')
  async upsertDirector(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Body() data: any,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    return this.directorsService.upsertDirector(resolvedTenantId, {
      ...data,
      createdById: user?.id,
    });
  }

  @Delete(':id')
  @Permissions('hr.manage')
  async deleteDirector(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    return this.directorsService.deleteDirector(resolvedTenantId, id);
  }

  @Get('by-level')
  @Permissions('hr.read')
  async getDirectorByLevel(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Query('schoolLevelId') schoolLevelId: string,
    @Query('language') language?: string,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    return this.directorsService.getDirectorByLevel(resolvedTenantId, schoolLevelId, language);
  }

  /**
   * ⭐ POST /hr/school-directors/:id/send-credentials
   *    Renvoie les identifiants au directeur (ou envoie pour la 1ère fois).
   *    Réutilise le pipeline StaffCredentialService :
   *    - Crée/maj un User avec mdp temporaire
   *    - Envoie un email avec loginUrl + site institutionnel + identifiants
   *    - Le directeur peut modifier son mdp après connexion.
   */
  @Post(':id/send-credentials')
  @Permissions('hr.manage')
  async sendCredentials(
    @Param('id') directorId: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    // Charger le directeur pour récupérer staffId + schoolLevelName
    const directors = await this.directorsService.getDirectors(resolvedTenantId);
    const director = directors.find((d: any) => d.id === directorId);
    if (!director) {
      return { success: false, message: 'Directeur introuvable' };
    }
    if (!director.staffId) {
      return {
        success: false,
        message: 'Ce directeur n\'est pas lié à un membre du personnel. Sélectionnez d\'abord un staff, puis réessayez.',
      };
    }
    return this.directorsService.sendCredentialsToDirector(
      resolvedTenantId,
      director.staffId,
      user?.id,
      {
        schoolLevelName: director.schoolLevelName,
        schoolLevelCode: director.schoolLevelCode,
        language: director.language,
      },
    );
  }
}
