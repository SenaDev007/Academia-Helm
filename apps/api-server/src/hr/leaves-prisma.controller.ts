/**
 * ============================================================================
 * LEAVES PRISMA CONTROLLER - MODULE 5 (SCHEMA-ALIGNED v2)
 * ============================================================================
 *
 * Controller aligné sur le service LeavesPrismaService réécrit.
 * Utilise le modèle LeaveRequest.
 * Les endpoints d'absence ont été retirés (le modèle Absence concerne les étudiants).
 *
 * ============================================================================
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { LeavesPrismaService } from './leaves-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateLeaveRequestDto, ProcessLeaveRequestDto, SelfCreateLeaveRequestDto } from './dto';

@Controller('hr/leaves')
@UseGuards(JwtAuthGuard, TenantGuard)
export class LeavesPrismaController {
  constructor(private readonly leavesService: LeavesPrismaService) {}

  @Post('requests')
  async createLeaveRequest(
    @GetTenant() tenant: any,
    @Body() data: CreateLeaveRequestDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.leavesService.createLeaveRequest({
      ...data,
      tenantId: tid,
      // ⭐ 2026-11-21 — Demande déposée PAR le RH pour un membre du
      //    personnel → le personnel concerné est notifié in-app.
      origin: 'RH',
    });
  }

  @Get('requests')
  async findAllLeaveRequests(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('staffId') staffId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.leavesService.findAllLeaveRequests(tid, {
      academicYearId,
      staffId,
      status,
      type,
    });
  }

  @Get('requests/:id')
  async findLeaveRequestById(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.leavesService.findLeaveRequestById(id, tid);
  }

  @Put('requests/:id/process')
  async processLeaveRequest(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: ProcessLeaveRequestDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    // ⭐ 2026-11-21 — Traçabilité de l'approbation : si le frontend ne fournit
    //    pas d'approvedBy, c'est l'utilisateur RH CONNECTÉ qui approuve/refuse
    //    (son id vient du JWT) — plus de décisions non attribuées.
    const approvedBy = body.approvedBy ?? user?.id;
    return this.leavesService.processLeaveRequest(
      id, tid, body.status, approvedBy, body.rejectedReason,
    );
  }

  @Delete('requests/:id')
  async deleteLeaveRequest(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.leavesService.deleteLeaveRequest(id, tid);
  }

  @Get('staff/:staffId/balance')
  async getLeaveBalance(
    @GetTenant() tenant: any,
    @Param('staffId') staffId: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.leavesService.calculateLeaveBalance(staffId, tid);
  }

  // ===========================================================================
  // ⭐ 2026-09-15 — MODULE PRÉSENCE ENSEIGNANT (self-service congés/absences)
  //
  // Le Staff est TOUJOURS résolu par l'email de l'utilisateur connecté :
  // un enseignant ne voit/crée/annule que SES propres demandes.
  // Utilisé par /app/teacher/presence → onglet "Congés & Absences".
  // ===========================================================================

  /**
   * ⭐ Les demandes de congé de l'utilisateur connecté.
   */
  @Get('my-requests')
  async findMyLeaveRequests(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('status') status?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback ?? user?.tenantId;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    if (!user?.email) throw new BadRequestException('Utilisateur non authentifié');

    return this.leavesService.findMyLeaveRequests(tid, user.email, {
      academicYearId,
      status,
    });
  }

  /**
   * ⭐ L'utilisateur connecté crée SA demande de congé/absence.
   * L'approbation/rejet reste du côté direction (module RH → Congés & Absences) ;
   * à l'approbation, le backend génère les présences ABSENT correspondantes.
   */
  @Post('my-requests')
  async createMyLeaveRequest(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Body() data: SelfCreateLeaveRequestDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback ?? user?.tenantId;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    if (!user?.email) throw new BadRequestException('Utilisateur non authentifié');

    return this.leavesService.createMyLeaveRequest(tid, user.email, {
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      academicYearId: data.academicYearId,
    });
  }

  /**
   * ⭐ L'utilisateur connecté annule SA demande (PENDING uniquement).
   * Vérification de propriété côté service.
   */
  @Put('my-requests/:id/cancel')
  async cancelMyLeaveRequest(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback ?? user?.tenantId;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    if (!user?.email) throw new BadRequestException('Utilisateur non authentifié');

    return this.leavesService.cancelMyLeaveRequest(tid, user.email, id);
  }

  /**
   * ⭐ Le solde de congés de l'utilisateur connecté (2,5 j/mois depuis l'embauche).
   */
  @Get('my-balance')
  async getMyLeaveBalance(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback ?? user?.tenantId;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    if (!user?.email) throw new BadRequestException('Utilisateur non authentifié');

    return this.leavesService.getMyLeaveBalance(tid, user.email);
  }
}
