/**
 * ============================================================================
 * GLOBAL LIBRARY PRISMA CONTROLLER - MODULE 2
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GlobalLibraryPrismaService } from './global-library-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/pedagogy/global-library')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GlobalLibraryPrismaController {
  constructor(private readonly libraryService: GlobalLibraryPrismaService) {}

  /**
   * Récupère toutes les ressources (Tous rôles authentifiés)
   */
  @Get()
  async findAll(@Query() query: any) {
    return this.libraryService.findAllResources(query);
  }

  /**
   * Récupère une ressource par ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.libraryService.findResourceById(id);
  }

  /**
   * Crée une ressource (PLATFORM_OWNER / PLATFORM_ADMIN uniquement)
   */
  @Post()
  @Roles('PLATFORM_OWNER', 'PLATFORM_ADMIN')
  async create(@Body() createDto: any, @CurrentUser() user: any) {
    return this.libraryService.createResource({
      ...createDto,
      createdBy: user.id,
    });
  }

  /**
   * Met à jour une ressource (PLATFORM_OWNER / PLATFORM_ADMIN uniquement)
   */
  @Patch(':id')
  @Roles('PLATFORM_OWNER', 'PLATFORM_ADMIN')
  async update(@Param('id') id: string, @Body() updateDto: any) {
    return this.libraryService.updateResource(id, updateDto);
  }

  /**
   * Supprime une ressource (PLATFORM_OWNER / PLATFORM_ADMIN uniquement)
   */
  @Delete(':id')
  @Roles('PLATFORM_OWNER', 'PLATFORM_ADMIN')
  async remove(@Param('id') id: string) {
    return this.libraryService.deleteResource(id);
  }

  /**
   * Enregistre l'utilisation (Enseignants)
   */
  @Post(':id/usage')
  async logUsage(
    @Param('id') resourceId: string,
    @TenantId() tenantId: string,
    @Body('staffId') staffId: string,
  ) {
    return this.libraryService.logUsage({
      tenantId,
      resourceId,
      staffId,
    });
  }

  /**
   * Ajoute/Modifie une annotation (Enseignants)
   */
  @Post(':id/annotation')
  async upsertAnnotation(
    @Param('id') resourceId: string,
    @TenantId() tenantId: string,
    @Body() body: { staffId: string; note: string },
  ) {
    return this.libraryService.upsertAnnotation({
      tenantId,
      resourceId,
      staffId: body.staffId,
      note: body.note,
    });
  }

  /**
   * Récupère l'annotation d'un enseignant
   */
  @Get(':id/annotation/:staffId')
  async getAnnotation(
    @Param('id') resourceId: string,
    @Param('staffId') staffId: string,
    @TenantId() tenantId: string,
  ) {
    return this.libraryService.getTeacherAnnotation(tenantId, staffId, resourceId);
  }

  /**
   * Statistiques ORION
   */
  @Get('stats/most-used')
  @Roles('PLATFORM_OWNER', 'PLATFORM_ADMIN')
  async getMostUsed() {
    return this.libraryService.getMostUsedResources();
  }
}
