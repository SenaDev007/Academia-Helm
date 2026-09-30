/**
 * FederisSaisieController — Saisie des notes par les secrétaires d'examen
 *
 *   UI SECRÉTAIRE (compte provisoire PATRONAT_SAISIE_NOTES) :
 *     GET   /federis/saisie/me                                 — mes affectations
 *     POST  /federis/saisie/assignments/:id/grades/bulk        — enregistrer
 *     POST  /federis/saisie/assignments/:id/submit             — soumettre
 *
 *   PATRONAT (gestion + suivi temps réel) :
 *     GET   /federis/exams/:examId/grades/live                 — suivi live
 *     POST  /federis/supervisors/:id/provision-account         — provisionner
 *     POST  /federis/supervisors/:id/account/freeze            — geler
 *     POST  /federis/supervisors/:id/account/reactivate        — réactiver
 *     POST  /federis/supervisors/:id/account/reset-password    — nouveau MDP
 *     DELETE /federis/supervisors/:id/account                  — supprimer
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FederisSaisieService, SaisieBulkGradesDto } from './federis-saisie.service';

@Controller('federis')
export class FederisSaisieController {
  constructor(private readonly saisieService: FederisSaisieService) {}

  private uid(req: any): string {
    return req.user.id || req.user.sub;
  }

  // ── UI du secrétaire (compte provisoire) ────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('saisie/me')
  async myAssignments(@Req() req: any) {
    return this.saisieService.myAssignments(req.user.tenantId, this.uid(req));
  }

  @UseGuards(JwtAuthGuard)
  @Post('saisie/assignments/:supervisorId/grades/bulk')
  async saveGrades(
    @Req() req: any,
    @Param('supervisorId') supervisorId: string,
    @Body() dto: SaisieBulkGradesDto,
  ) {
    return this.saisieService.saveGrades(
      req.user.tenantId,
      this.uid(req),
      supervisorId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('saisie/assignments/:supervisorId/submit')
  async submitAssignment(
    @Req() req: any,
    @Param('supervisorId') supervisorId: string,
  ) {
    return this.saisieService.submitAssignment(
      req.user.tenantId,
      this.uid(req),
      supervisorId,
    );
  }

  // ── Suivi temps réel (patronat — module Notes et moyennes) ─────────────

  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/grades/live')
  async getLive(@Req() req: any, @Param('examId') examId: string) {
    return this.saisieService.getLive(req.user.tenantId, this.uid(req), examId);
  }

  // ── Gestion des comptes provisoires (patronat — registre) ──────────────

  @UseGuards(JwtAuthGuard)
  @Post('supervisors/:id/provision-account')
  async provisionAccount(@Req() req: any, @Param('id') id: string) {
    return this.saisieService.provisionAccountForSupervisor(
      req.user.tenantId,
      id,
      this.uid(req),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('supervisors/:id/account/freeze')
  async freezeAccount(@Req() req: any, @Param('id') id: string) {
    return this.saisieService.manageAccount(req.user.tenantId, this.uid(req), id, 'freeze');
  }

  @UseGuards(JwtAuthGuard)
  @Post('supervisors/:id/account/reactivate')
  async reactivateAccount(@Req() req: any, @Param('id') id: string) {
    return this.saisieService.manageAccount(req.user.tenantId, this.uid(req), id, 'reactivate');
  }

  @UseGuards(JwtAuthGuard)
  @Post('supervisors/:id/account/reset-password')
  async resetAccountPassword(@Req() req: any, @Param('id') id: string) {
    return this.saisieService.manageAccount(
      req.user.tenantId,
      this.uid(req),
      id,
      'reset-password',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('supervisors/:id/account')
  async deleteAccount(@Req() req: any, @Param('id') id: string) {
    return this.saisieService.manageAccount(req.user.tenantId, this.uid(req), id, 'delete');
  }
}
