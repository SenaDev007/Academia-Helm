/**
 * ============================================================================
 * ORGANIGRAM PRISMA CONTROLLER
 * ============================================================================
 *
 * API REST pour la gestion de l'organigramme de l'établissement.
 *
 * Routes :
 *   POST   /hr/organigram/seed          — Initialise l'organigramme par défaut
 *   GET    /hr/organigram/tree           — Arbre complet (option: ?schoolLevelCode=MAT|PRI|SEC|ALL)
 *   GET    /hr/organigram/stats          — Statistiques
 *   GET    /hr/organigram/nodes          — Liste plate avec filtres
 *   GET    /hr/organigram/nodes/:id      — Détail d'un nœud
 *   POST   /hr/organigram/nodes          — Créer un nœud
 *   PUT    /hr/organigram/nodes/:id      — Modifier un nœud
 *   DELETE /hr/organigram/nodes/:id      — Supprimer un nœud
 *   PUT    /hr/organigram/nodes/:id/assign — Assigner un employé
 *   PUT    /hr/organigram/reorder        — Réordonner les nœuds
 *
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { OrganigramPrismaService } from './organigram-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

@Controller('hr/organigram')
@UseGuards(JwtAuthGuard, TenantGuard)
export class OrganigramPrismaController {
  constructor(private readonly organigramService: OrganigramPrismaService) {}

  /**
   * Initialise l'organigramme par défaut pour le tenant
   */
  @Post('seed')
  async seedOrganigram(@Req() req: any) {
    const tenantId = req.tenantId;
    return this.organigramService.seedOrganigram(tenantId);
  }

  /**
   * Récupère l'organigramme complet sous forme d'arbre
   * Query: ?schoolLevelCode=MAT|PRI|SEC|ALL
   */
  @Get('tree')
  async getTree(
    @Req() req: any,
    @Query('schoolLevelCode') schoolLevelCode?: string,
  ) {
    const tenantId = req.tenantId;
    return this.organigramService.getOrganigramTree(tenantId, schoolLevelCode);
  }

  /**
   * Statistiques de l'organigramme
   */
  @Get('stats')
  async getStats(@Req() req: any) {
    const tenantId = req.tenantId;
    return this.organigramService.getOrganigramStats(tenantId);
  }

  /**
   * Liste plate des nœuds avec filtres
   * Query: ?type=DEPARTMENT|SERVICE|POSITION&schoolLevelCode=MAT|PRI|SEC&isActive=true
   */
  @Get('nodes')
  async getAllNodes(
    @Req() req: any,
    @Query('type') type?: string,
    @Query('schoolLevelCode') schoolLevelCode?: string,
    @Query('isActive') isActive?: string,
  ) {
    const tenantId = req.tenantId;
    return this.organigramService.getAllNodes(tenantId, {
      type,
      schoolLevelCode,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  /**
   * Détail d'un nœud
   */
  @Get('nodes/:id')
  async getNodeById(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId;
    return this.organigramService.getNodeById(id, tenantId);
  }

  /**
   * Créer un nouveau nœud
   */
  @Post('nodes')
  async createNode(
    @Req() req: any,
    @Body() body: {
      title: string;
      type: string;
      level?: number;
      order?: number;
      schoolLevelCode?: string;
      staffId?: string;
      parentId?: string;
      metadata?: any;
      tenantId?: string;
    },
  ) {
    const tenantId = req.tenantId || body.tenantId;
    return this.organigramService.createNode({
      tenantId,
      title: body.title,
      type: body.type,
      level: body.level,
      order: body.order,
      schoolLevelCode: body.schoolLevelCode,
      staffId: body.staffId,
      parentId: body.parentId,
      metadata: body.metadata,
    });
  }

  /**
   * Modifier un nœud
   */
  @Put('nodes/:id')
  async updateNode(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: {
      title?: string;
      type?: string;
      level?: number;
      order?: number;
      schoolLevelCode?: string;
      staffId?: string | null;
      parentId?: string | null;
      metadata?: any;
      isActive?: boolean;
      tenantId?: string;
    },
  ) {
    const tenantId = req.tenantId || body.tenantId;
    return this.organigramService.updateNode(id, tenantId, body);
  }

  /**
   * Supprimer un nœud
   */
  @Delete('nodes/:id')
  async deleteNode(
    @Param('id') id: string,
    @Req() req: any,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.organigramService.deleteNode(id, req.tenantId || tenantId);
  }

  /**
   * Assigner un employé à un poste
   */
  @Put('nodes/:id/assign')
  async assignStaff(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { staffId: string | null; tenantId?: string },
  ) {
    const tenantId = req.tenantId || body.tenantId;
    return this.organigramService.assignStaff(id, tenantId, body.staffId);
  }

  /**
   * Réordonner les nœuds
   */
  @Put('reorder')
  async reorderNodes(
    @Req() req: any,
    @Body() body: { nodeIds: string[]; tenantId?: string },
  ) {
    const tenantId = req.tenantId || body.tenantId;
    return this.organigramService.reorderNodes(tenantId, body.nodeIds);
  }
}
