/**
 * FederisSupervisorsController — Gestion des surveillants (Academia Federis)
 *
 * Onglet « Gestion des surveillants » du module « Centres, salles &
 * Surveillants » (sidebar Federis) :
 *
 *   GET    /federis/supervisors/requests                — demandes + compteurs
 *   POST   /federis/supervisors/requests                — demande aux écoles
 *   PATCH  /federis/supervisors/requests/:id            — clôturer / rouvrir
 *   GET    /federis/supervisors/requests/:id/submissions — listes par école
 *                                                          + récap + centres
 *   POST   /federis/supervisors/requests/:id/assignments — répartition centre
 *                                                          / salle + validation
 *   GET    /federis/supervisors?examId=                 — registre des
 *                                                          surveillants affectés
 *   POST   /federis/supervisors                         — création manuelle
 *   PATCH  /federis/supervisors/:id                     — changer centre/salle
 *   DELETE /federis/supervisors/:id                     — retirer
 *
 * Écritures réservées au coordonnateur et à l'organisateur (WRITE_EXAM_ORG —
 * garde finale côté service).
 */

import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  FederisSupervisorsService,
  CreateSupervisorRequestDto,
  UpdateSupervisorRequestDto,
  AssignSupervisorsDto,
  CreateSupervisorDto,
  UpdateSupervisorDto,
} from './federis-supervisors.service';

@Controller('federis/supervisors')
export class FederisSupervisorsController {
  constructor(private readonly supervisorsService: FederisSupervisorsService) {}

  private uid(req: any): string {
    return req.user.id || req.user.sub;
  }

  // ── Demandes aux écoles rattachées ────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('requests')
  async listRequests(@Req() req: any) {
    return this.supervisorsService.listRequests(req.user.tenantId, this.uid(req));
  }

  @UseGuards(JwtAuthGuard)
  @Post('requests')
  async createRequest(@Req() req: any, @Body() dto: CreateSupervisorRequestDto) {
    return this.supervisorsService.createRequest(
      req.user.tenantId,
      this.uid(req),
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch('requests/:id')
  async updateRequest(
    @Req() req: any,
    @Param('id') requestId: string,
    @Body() dto: UpdateSupervisorRequestDto,
  ) {
    return this.supervisorsService.updateRequest(
      req.user.tenantId,
      this.uid(req),
      requestId,
      dto,
    );
  }

  // ── Listes reçues par école + récapitulatif + répartition ─────────────────

  @UseGuards(JwtAuthGuard)
  @Get('requests/:id/submissions')
  async listRequestSubmissions(@Req() req: any, @Param('id') requestId: string) {
    return this.supervisorsService.listRequestSubmissions(
      req.user.tenantId,
      this.uid(req),
      requestId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('requests/:id/assignments')
  async assignSupervisors(
    @Req() req: any,
    @Param('id') requestId: string,
    @Body() dto: AssignSupervisorsDto,
  ) {
    return this.supervisorsService.assignSupervisors(
      req.user.tenantId,
      this.uid(req),
      requestId,
      dto,
    );
  }

  // ── Registre des surveillants (nominations écoles + saisie manuelle) ─────

  @UseGuards(JwtAuthGuard)
  @Get()
  async listSupervisors(@Req() req: any, @Query('examId') examId?: string) {
    return this.supervisorsService.listSupervisors(
      req.user.tenantId,
      this.uid(req),
      examId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createSupervisor(@Req() req: any, @Body() dto: CreateSupervisorDto) {
    return this.supervisorsService.createSupervisor(
      req.user.tenantId,
      this.uid(req),
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateSupervisor(
    @Req() req: any,
    @Param('id') supervisorId: string,
    @Body() dto: UpdateSupervisorDto,
  ) {
    return this.supervisorsService.updateSupervisor(
      req.user.tenantId,
      this.uid(req),
      supervisorId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async removeSupervisor(@Req() req: any, @Param('id') supervisorId: string) {
    return this.supervisorsService.removeSupervisor(
      req.user.tenantId,
      this.uid(req),
      supervisorId,
    );
  }
}
