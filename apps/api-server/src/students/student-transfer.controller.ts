import { Controller, Get, Post, Body, Param, UseGuards, Req, Patch, Query } from '@nestjs/common';
import { StudentTransferService } from './student-transfer.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * ⭐ P2.5 — RBAC renforcé sur StudentTransferController.
 *    Avant : `JwtAuthGuard` uniquement → tout user authentifié pouvait approve/execute.
 *    Maintenant : `TenantGuard` + `RolesGuard` + `@Roles` par endpoint.
 *
 * ⭐ P1.7 — Tenant scoping : tous les endpoints d'action (approve/reject/execute/confirm-exit)
 *    passent désormais le tenantId au service qui vérifie que l'utilisateur
 *    appartient bien au tenant cible (targetSchoolId pour approve/reject/execute,
 *    sourceSchoolId pour confirm-exit). Évite le risque IDOR où un user du tenant A
 *    pourrait approver un transfert destiné au tenant B en devinant l'UUID.
 */
const MANAGEMENT_ROLES = [
  'ADMIN', 'DIRECTOR', 'SCHOOL_ADMIN', 'DIRECTEUR',
  'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'SUPER_DIRECTOR',
  'PROMOTER', 'SCHOOL_OWNER', 'BOARD_PRESIDENT',
];

@Controller('students/transfers')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class StudentTransferController {
  constructor(private readonly transferService: StudentTransferService) {}

  @Post()
  @Roles(...MANAGEMENT_ROLES)
  async createRequest(@Req() req: any, @Body() data: any) {
    return this.transferService.createTransferRequest(req.user.userId, req.user.tenantId, data);
  }

  @Get('outgoing')
  @Roles(...MANAGEMENT_ROLES)
  async getOutgoing(@Req() req: any) {
    return this.transferService.getOutgoingTransfers(req.user.tenantId);
  }

  @Get('incoming')
  @Roles(...MANAGEMENT_ROLES)
  async getIncoming(@Req() req: any) {
    return this.transferService.getIncomingTransfers(req.user.tenantId);
  }

  @Get('search-schools')
  async searchSchools(@Query('q') q: string) {
    return this.transferService.searchSchools(q);
  }

  @Post(':id/approve')
  @Roles(...MANAGEMENT_ROLES)
  async approve(@Param('id') id: string, @Req() req: any) {
    // ⭐ P1.7 — Passer tenantId pour vérifier que l'utilisateur est bien du tenant destination
    return this.transferService.approveTransfer(id, req.user.userId, req.user.tenantId);
  }

  @Post(':id/reject')
  @Roles(...MANAGEMENT_ROLES)
  async reject(@Param('id') id: string, @Req() req: any, @Body('reason') reason: string) {
    return this.transferService.rejectTransfer(id, req.user.userId, reason, req.user.tenantId);
  }

  @Post(':id/request-complement')
  @Roles(...MANAGEMENT_ROLES)
  async requestComplement(@Param('id') id: string, @Req() req: any, @Body('message') message: string) {
    return this.transferService.requestComplement(id, req.user.userId, message, req.user.tenantId);
  }

  @Post(':id/confirm-exit')
  @Roles(...MANAGEMENT_ROLES)
  async confirmExit(@Param('id') id: string, @Req() req: any) {
    // ⭐ P1.7 — Passer tenantId pour vérifier que l'utilisateur est bien du tenant source
    return this.transferService.confirmSourceExit(id, req.user?.userId, req.user.tenantId);
  }

  @Post(':id/execute')
  @Roles(...MANAGEMENT_ROLES)
  async execute(@Param('id') id: string, @Req() req: any) {
    return this.transferService.executeTransfer(id, req.user?.userId, req.user.tenantId);
  }

  @Get(':id/dossier')
  @Roles(...MANAGEMENT_ROLES)
  async getDossier(@Param('id') id: string, @Query('level') level: 'FULL' | 'MASKED' = 'MASKED') {
    return this.transferService.compileFullDossier(id, level);
  }
}
