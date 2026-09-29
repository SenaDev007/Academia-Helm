/**
 * FederisExamsController — Workflow examens nationaux (Academia Federis)
 *
 *   GET    /federis/exams                              — examens du patronat
 *   POST   /federis/exams                              — créer un examen
 *   PATCH  /federis/exams/:examId                      — statut / infos examen
 *   GET    /federis/exams/:examId/centers              — centres + salles
 *   POST   /federis/exams/:examId/centers              — créer un centre
 *   PATCH  /federis/centers/:centerId                  — modifier / archiver un centre
 *   POST   /federis/centers/:centerId/rooms            — créer une salle
 *   PATCH  /federis/rooms/:roomId                      — modifier une salle
 *   GET    /federis/exams/:examId/candidates           — candidats (recherche)
 *   GET    /federis/exams/:examId/school-lists         — listes officielles par école
 *   POST   /federis/exams/:examId/candidates           — ajout manuel
 *   POST   /federis/exams/:examId/candidates/import    — import par lot (Excel)
 *   POST   /federis/exams/:examId/assign-tables        — numéros de table
 */

import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import {
  FederisExamsService,
  CreateExamDto,
  UpdateExamDto,
  CreateCenterDto,
  UpdateCenterDto,
  CreateRoomDto,
  UpdateRoomDto,
  ImportCandidatesDto,
  AddCandidateDto,
  AssignTablesDto,
} from './federis-exams.service';

@Controller('federis')
export class FederisExamsController {
  constructor(private readonly examsService: FederisExamsService) {}

  private uid(req: any): string {
    return req.user.id || req.user.sub;
  }

  // ── Examens ──────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('exams')
  async listExams(@Req() req: any) {
    return this.examsService.listExams(req.user.tenantId, this.uid(req));
  }

  @UseGuards(JwtAuthGuard)
  @Post('exams')
  async createExam(@Req() req: any, @Body() dto: CreateExamDto) {
    return this.examsService.createExam(req.user.tenantId, this.uid(req), dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('exams/:examId')
  async updateExam(@Req() req: any, @Param('examId') examId: string, @Body() dto: UpdateExamDto) {
    return this.examsService.updateExam(req.user.tenantId, this.uid(req), examId, dto);
  }

  // ── Centres & salles ─────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/centers')
  async listCenters(@Req() req: any, @Param('examId') examId: string) {
    return this.examsService.listCenters(req.user.tenantId, this.uid(req), examId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/centers')
  async createCenter(
    @Req() req: any,
    @Param('examId') examId: string,
    @Body() dto: CreateCenterDto,
  ) {
    return this.examsService.createCenter(req.user.tenantId, this.uid(req), examId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('centers/:centerId')
  async updateCenter(
    @Req() req: any,
    @Param('centerId') centerId: string,
    @Body() dto: UpdateCenterDto,
  ) {
    return this.examsService.updateCenter(req.user.tenantId, this.uid(req), centerId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('centers/:centerId/rooms')
  async createRoom(
    @Req() req: any,
    @Param('centerId') centerId: string,
    @Body() dto: CreateRoomDto,
  ) {
    return this.examsService.createRoom(req.user.tenantId, this.uid(req), centerId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('rooms/:roomId')
  async updateRoom(@Req() req: any, @Param('roomId') roomId: string, @Body() dto: UpdateRoomDto) {
    return this.examsService.updateRoom(req.user.tenantId, this.uid(req), roomId, dto);
  }

  // ── Candidats ────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/candidates')
  async listCandidates(
    @Req() req: any,
    @Param('examId') examId: string,
    @Query('q') q?: string,
  ) {
    return this.examsService.listCandidates(req.user.tenantId, this.uid(req), examId, q);
  }

  // ⭐ Listes officielles transmises par les écoles rattachées (2026-09-29) —
  //    candidats de la campagne regroupés PAR ÉCOLE + informations de
  //    l'établissement (ville, département, contact).
  @UseGuards(JwtAuthGuard)
  @Get('exams/:examId/school-lists')
  async listSchoolLists(@Req() req: any, @Param('examId') examId: string) {
    return this.examsService.listSchoolLists(req.user.tenantId, this.uid(req), examId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/candidates')
  async addCandidate(
    @Req() req: any,
    @Param('examId') examId: string,
    @Body() dto: AddCandidateDto,
  ) {
    return this.examsService.addCandidate(req.user.tenantId, this.uid(req), examId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/candidates/import')
  async importCandidates(
    @Req() req: any,
    @Param('examId') examId: string,
    @Body() dto: ImportCandidatesDto,
  ) {
    return this.examsService.importCandidates(req.user.tenantId, this.uid(req), examId, dto);
  }

  // ── Numéros de table ─────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('exams/:examId/assign-tables')
  async assignTables(
    @Req() req: any,
    @Param('examId') examId: string,
    @Body() dto: AssignTablesDto,
  ) {
    return this.examsService.assignTableNumbers(req.user.tenantId, this.uid(req), examId, dto);
  }
}
