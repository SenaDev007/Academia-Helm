/**
 * FederisSchoolSupervisorsController — Gestion des surveillants (portail école)
 *
 * Section « Gestion des surveillants » du module « Patronats & Examens »
 * d'Academia Helm (/app/federis) :
 *
 *   GET  /federis/school/supervisors                        — demandes reçues
 *     des patronats rattachés + soumissions de l'école + affectations reçues
 *   GET  /federis/school/supervisors/teachers               — enseignants
 *     actifs de l'école (base Teacher — pour la sélection)
 *   POST /federis/school/supervisors/requests/:id/submit    — envoyer la
 *     sélection d'enseignants au patronat (+ notification équipe patronat)
 *   POST /federis/school/supervisors/assignments/:id/notify-teacher
 *     — transmettre une affectation à l'UI de l'enseignant (notification
 *       in-app, Teacher.email → User)
 *   POST /federis/school/supervisors/assignments/notify-all — transmission
 *     en lot de toutes les affectations en attente
 *
 * Sélection/envoi et transmission réservés à la direction + secrétariat
 * (garde finale côté service — pattern federis-school-exams).
 */

import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  FederisSupervisorsService,
  SubmitNominationDto,
} from './federis-supervisors.service';

@Controller('federis/school/supervisors')
export class FederisSchoolSupervisorsController {
  constructor(private readonly supervisorsService: FederisSupervisorsService) {}

  private uid(req: any): string {
    return req.user.id || req.user.sub;
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getOverview(@Req() req: any) {
    return this.supervisorsService.getSchoolOverview(
      req.user.tenantId,
      this.uid(req),
      req.user.role,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('teachers')
  async listTeachers(@Req() req: any, @Query('q') q?: string) {
    return this.supervisorsService.listTeachers(
      req.user.tenantId,
      this.uid(req),
      req.user.role,
      q,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('requests/:id/submit')
  async submitNomination(
    @Req() req: any,
    @Param('id') requestId: string,
    @Body() dto: SubmitNominationDto,
  ) {
    return this.supervisorsService.submitNomination(
      req.user.tenantId,
      this.uid(req),
      req.user.role,
      requestId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('assignments/notify-all')
  async notifyAllTeachers(@Req() req: any) {
    return this.supervisorsService.notifyAllTeachers(
      req.user.tenantId,
      this.uid(req),
      req.user.role,
    );
  }

  // ⚠️ APRÈS les routes statiques (notify-all) — :id est un UUID
  @UseGuards(JwtAuthGuard)
  @Post('assignments/:id/notify-teacher')
  async notifyTeacher(@Req() req: any, @Param('id') supervisorId: string) {
    return this.supervisorsService.notifyTeacher(
      req.user.tenantId,
      this.uid(req),
      req.user.role,
      supervisorId,
    );
  }
}
