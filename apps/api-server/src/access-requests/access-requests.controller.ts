/**
 * Access Requests Controller — gestion des demandes d'accès PLATFORM_OWNER
 */

import { Controller, Get, Post, Body, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { AccessRequestsService } from './access-requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@Controller('access-requests')
@UseGuards(JwtAuthGuard)
export class AccessRequestsController {
  constructor(private readonly accessRequestsService: AccessRequestsService) {}

  /**
   * GET /api/access-requests
   * Liste les demandes d'accès pour le tenant de l'utilisateur connecté.
   * Réservé aux DIRECTOR, PROMOTER, ADMIN.
   */
  @Get()
  async list(@Req() req: any) {
    const userRole = req.user?.role;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant requis');
    }

    // Seuls les DIRECTOR, PROMOTER, ADMIN peuvent voir les demandes
    if (!['DIRECTOR', 'PROMOTER', 'ADMIN'].includes(userRole)) {
      throw new ForbiddenException('Accès réservé au directeur ou au promoteur');
    }

    return this.accessRequestsService.listByTenant(tenantId);
  }

  /**
   * POST /api/access-requests/:id/approve
   */
  @Post(':id/approve')
  async approve(
    @Param('id') id: string,
    @Req() req: any,
    @Body('reviewNote') reviewNote?: string,
  ) {
    const userRole = req.user?.role;
    if (!['DIRECTOR', 'PROMOTER', 'ADMIN'].includes(userRole)) {
      throw new ForbiddenException('Seul le directeur ou le promoteur peut approuver');
    }
    return this.accessRequestsService.approve(id, req.user.sub || req.user.id, reviewNote);
  }

  /**
   * POST /api/access-requests/:id/reject
   */
  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @Req() req: any,
    @Body('reviewNote') reviewNote?: string,
  ) {
    const userRole = req.user?.role;
    if (!['DIRECTOR', 'PROMOTER', 'ADMIN'].includes(userRole)) {
      throw new ForbiddenException('Seul le directeur ou le promoteur peut refuser');
    }
    return this.accessRequestsService.reject(id, req.user.sub || req.user.id, reviewNote);
  }

  /**
   * POST /api/access-requests/:id/revoke
   */
  @Post(':id/revoke')
  async revoke(
    @Param('id') id: string,
    @Req() req: any,
    @Body('reviewNote') reviewNote?: string,
  ) {
    const userRole = req.user?.role;
    if (!['DIRECTOR', 'PROMOTER', 'ADMIN'].includes(userRole)) {
      throw new ForbiddenException('Seul le directeur ou le promoteur peut révoquer');
    }
    return this.accessRequestsService.revoke(id, req.user.sub || req.user.id, reviewNote);
  }
}
