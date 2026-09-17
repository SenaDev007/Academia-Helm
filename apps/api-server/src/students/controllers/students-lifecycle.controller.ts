/**
 * Module 1 — API cycle de vie élève : pre-register, admit, re-enroll, transfer, change-class, history, export EDUCMASTER.
 */

import { BadRequestException, Controller, Get, Post, Body, Param, Query, UseGuards, Res, NotFoundException } from '@nestjs/common';
import { StreamableFile } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StudentsLifecycleService } from '../services/students-lifecycle.service';
import { StudentIdCardService } from '../services/student-id-card.service';
import { EducmasterExcelExportService } from '../services/educmaster-excel-export.service';
import { ClassListPdfService, ClassListPdfMode } from '../services/class-list-pdf.service';
import { PrismaService } from '../../database/prisma.service';
import type { Response } from 'express';

/**
 * ⭐ P2.1 — RBAC renforcé sur le contrôleur lifecycle.
 *    Avant : `JwtAuthGuard` uniquement → tout user authentifié pouvait withdraw/exclude/exit.
 *    Maintenant : `TenantGuard` + `RolesGuard` avec @Roles par endpoint.
 *
 *    Rôles autorisés par défaut : 'ADMIN', 'DIRECTOR', 'SCHOOL_ADMIN', 'DIRECTEUR',
 *    'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'SUPER_DIRECTOR', 'PROMOTER',
 *    'SCHOOL_OWNER' (rôles direction/propriétaire).
 */
const MANAGEMENT_ROLES = [
  'ADMIN', 'DIRECTOR', 'SCHOOL_ADMIN', 'DIRECTEUR',
  'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'SUPER_DIRECTOR',
  'PROMOTER', 'SCHOOL_OWNER', 'BOARD_PRESIDENT',
  // ⭐ 2026-09-06 : secrétaires et comptables gèrent les inscriptions/listes —
  //    usage métier légitime (le RolesGuard normalise les suffixes de niveau).
  'SECRETAIRE', 'SECRETAIRE_COMPTABLE', 'SECRETARY', 'COMPTABLE', 'ACCOUNTANT',
  'RESP_SCOLARITE', 'CENSEUR', 'ECONOME', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR',
];

@Controller('students')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class StudentsLifecycleController {
  constructor(
    private readonly lifecycle: StudentsLifecycleService,
    private readonly idCard: StudentIdCardService,
    private readonly educmasterExcel: EducmasterExcelExportService,
    private readonly classListPdf: ClassListPdfService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('enrollments')
  async getEnrollments(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    // ⭐ 2026-09-18 — Anomalie « Élèves non affectés » (onglet Inscriptions) :
    //    /pedagogy/academic-structure/classes applique le SCOPE niveau serveur
    //    (applyLevelScope — un SECRETAIRE_COMPTABLE_SEC ne voit que les classes
    //    Secondaire) mais GET /students/enrollments ne l'appliquait PAS →
    //    l'onglet Inscriptions groupait les inscriptions (TOUS niveaux) sur
    //    les classes du SEUL périmètre du rôle → tous les élèves des autres
    //    niveaux s'affichaient « Élèves non affectés » (ex: 424/683 pour un
    //    sec-comptable Secondaire de N'Dali). On passe le scope au service pour
    //    la même règle que les listes élèves (P3 : le périmètre serveur
    //    s'applique PARTOUT, listes et KPIs restent cohérents).
    return this.lifecycle.getEnrollments(tenantId, { academicYearId, schoolLevelId }, user?.scope);
  }

  @Post('pre-register')
  @Roles(...MANAGEMENT_ROLES)
  async preRegister(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() body: any) {
    return this.lifecycle.preRegister(tenantId, body, user?.id);
  }

  @Post('admit')
  @Roles(...MANAGEMENT_ROLES)
  async admit(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() body: any) {
    return this.lifecycle.admit(tenantId, body, user?.id);
  }

  @Post('re-enroll')
  @Roles(...MANAGEMENT_ROLES)
  async reEnroll(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() body: any) {
    return this.lifecycle.reEnroll(tenantId, body, user?.id);
  }

  @Post('transfer')
  @Roles(...MANAGEMENT_ROLES)
  async transfer(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() body: any) {
    return this.lifecycle.transfer(tenantId, body, user?.id);
  }

  /**
   * POST /students/lifecycle/withdraw
   * Abandon / sortie définitive d'un élève.
   * Body: { studentId, academicYearId, exitReason?, exitDate? }
   */
  @Post('withdraw')
  @Roles(...MANAGEMENT_ROLES)
  async withdraw(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() body: any) {
    return this.lifecycle.withdraw(tenantId, body, user?.id);
  }

  /**
   * POST /students/lifecycle/reintegrate
   * Réintégration d'un élève ayant abandonné.
   * Body: { studentId, academicYearId, schoolLevelId, classId? }
   */
  @Post('reintegrate')
  @Roles(...MANAGEMENT_ROLES)
  async reintegrate(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() body: any) {
    return this.lifecycle.reintegrate(tenantId, body, user?.id);
  }

  @Post('change-class')
  @Roles(...MANAGEMENT_ROLES)
  async changeClass(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() body: any) {
    return this.lifecycle.changeClass(tenantId, body, user?.id);
  }

  /**
   * ⭐ POST /students/exclude
   * Exclusion administrative (renvoi disciplinaire).
   * Body: { studentId, academicYearId, reason, exitDate? }
   */
  @Post('exclude')
  @Roles(...MANAGEMENT_ROLES)
  async exclude(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() body: any) {
    if (!body.reason?.trim()) {
      throw new BadRequestException('Un motif d\'exclusion est obligatoire');
    }
    return this.lifecycle.exclude(tenantId, body, user?.id);
  }

  /**
   * ⭐ POST /students/exit
   * Sortie fin d'année (sortie naturelle, non disciplinaire).
   * Body: { studentId, academicYearId, exitReason?, exitDate? }
   */
  @Post('exit')
  @Roles(...MANAGEMENT_ROLES)
  async exit(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() body: any) {
    return this.lifecycle.exit(tenantId, body, user?.id);
  }

  /**
   * ⭐ GET /students/movement-history
   * Historique global des mouvements (transferts, abandons, exclusions, etc.)
   * Query: academicYearId?, action?, studentId?, limit?
   */
  @Get('movement-history')
  async getMovementHistory(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('action') action?: string,
    @Query('studentId') studentId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.lifecycle.getMovementHistory(tenantId, academicYearId, {
      action,
      studentId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * ⭐ Affectation initiale d'un élève vers une classe PHYSIQUE.
   * Sous-onglet "Affectation vers classe physique" du module Affectations.
   * Body: { studentId, academicYearId, physicalClassId, reason? }
   */
  @Post('assign-physical-class')
  @Roles(...MANAGEMENT_ROLES)
  async assignPhysicalClass(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() body: any) {
    return this.lifecycle.assignPhysicalClass(tenantId, body, user?.id);
  }

  /**
   * ⭐ Changement de série officielle d'un élève.
   * Sous-onglet "Changement de série" du module Affectations.
   * Body: { studentId, academicYearId, newSeriesId, reason? }
   */
  @Post('change-series')
  @Roles(...MANAGEMENT_ROLES)
  async changeSeries(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() body: any) {
    return this.lifecycle.changeSeries(tenantId, body, user?.id);
  }

  /**
   * ⭐ Liste les élèves admis/inscrits SANS classe physique (classId NULL).
   * Query: ?academicYearId=...
   */
  @Get('students-without-physical-class')
  async getStudentsWithoutPhysicalClass(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    return this.lifecycle.getStudentsWithoutPhysicalClass(tenantId, academicYearId);
  }

  /**
   * ⭐ Liste l'historique des transferts/affectations (ClassTransfer).
   * Query: ?academicYearId=...
   */
  @Get('class-transfers-history')
  async getClassTransfersHistory(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.lifecycle.getClassTransfersHistory(tenantId, academicYearId);
  }

  /**
   * ⭐ Réinitialise toutes les affectations de classes physiques pour l'année.
   * Passe classId = NULL sur toutes les inscriptions actives, afin que
   * l'administrateur puisse refaire l'affectation manuellement.
   *
   * ⚠️ L'academicClassId (classe officielle) est PRÉSERVÉ.
   *
   * POST /students/reset-physical-assignments
   * Body: { academicYearId }
   */
  @Post('reset-physical-assignments')
  @Roles(...MANAGEMENT_ROLES)
  async resetPhysicalAssignments(
    @TenantId() tenantId: string,
    @Body() body: { academicYearId: string },
  ) {
    if (!body?.academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    return this.lifecycle.resetPhysicalClassAssignments(tenantId, body.academicYearId);
  }

  /**
   * Promotion annuelle manuelle d'un élève (hors clôture globale).
   */
  @Post('promote')
  @Roles(...MANAGEMENT_ROLES)
  async promote(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: {
      studentId: string;
      fromAcademicYearId: string;
      toAcademicYearId: string;
      schoolLevelId: string;
      toClassId?: string | null;
      previousArrears?: number;
    },
  ) {
    return this.lifecycle.promoteStudent(tenantId, body, user?.id);
  }

  /**
   * Redoublement manuel d'un élève.
   */
  @Post('repeat')
  @Roles(...MANAGEMENT_ROLES)
  async repeat(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: {
      studentId: string;
      fromAcademicYearId: string;
      toAcademicYearId: string;
      schoolLevelId: string;
      classId: string;
      previousArrears?: number;
    },
  ) {
    return this.lifecycle.repeatStudent(tenantId, body, user?.id);
  }

  /**
   * Batch promotion (sélection multiple).
   */
  @Post('batch-promote')
  @Roles(...MANAGEMENT_ROLES)
  async batchPromote(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: {
      studentIds: string[];
      fromAcademicYearId: string;
      toAcademicYearId: string;
      schoolLevelId: string;
      toClassId?: string | null;
    },
  ) {
    return this.lifecycle.batchPromote(tenantId, body, user?.id);
  }

  /**
   * Batch mise à jour de statut (WITHDRAWN, EXPELLED, DECEASED, GRADUATED, etc.).
   */
  @Post('batch-update-status')
  @Roles(...MANAGEMENT_ROLES)
  async batchUpdateStatus(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: {
      studentIds: string[];
      status: string;
    },
  ) {
    return this.lifecycle.batchUpdateStatus(tenantId, body, user?.id);
  }

  /**
   * GET /api/students/export/educmaster-excel
   * Un fichier par niveau scolaire pour emp.educmaster.bj.
   * - Maternelle : 1 fichier, feuilles "Maternelle 1", "Maternelle 2".
   * - Primaire : 1 fichier, feuilles CI, CP, CE1, CE2, CM1, CM2.
   * Nom du fichier : NiveauScolaire_NomEcole_AnnéeScolaire.xlsx
   *
   * Query: academicYearId (obligatoire), code OU schoolLevelId (au moins un des deux).
   *        ⭐ `code` (MATERNELLE/PRIMAIRE/SECONDAIRE) est la méthode recommandée —
   *        elle élimine l'ambiguïté entre education_levels.id et school_levels.id.
   */
  @Get('export/educmaster-excel')
  async exportEducmasterExcel(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('code') code?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est obligatoire');
    }
    if (!code && !schoolLevelId) {
      throw new BadRequestException('code (MATERNELLE/PRIMAIRE/SECONDAIRE) ou schoolLevelId est obligatoire');
    }
    const result = await this.educmasterExcel.generateWorkbook({
      tenantId,
      academicYearId,
      schoolLevelId,
      code,
    });
    return new StreamableFile(result.buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${encodeURIComponent(result.filename)}"`,
    });
  }

  /**
   * GET /students/export/class-excel?academicYearId=...&classId=...
   * Génère un fichier Excel pour UNE classe officielle (AcademicClass).
   * Une feuille par classe, avec les colonnes Educmaster.
   */
  @Get('export/class-excel')
  async exportClassExcel(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId: string,
  ) {
    if (!academicYearId || !classId) {
      throw new BadRequestException('academicYearId et classId sont obligatoires');
    }
    const result = await this.educmasterExcel.generateWorkbookForSingleClass({
      tenantId,
      academicYearId,
      classId,
    });
    return new StreamableFile(result.buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${encodeURIComponent(result.filename)}"`,
    });
  }

  /**
   * GET /students/export/all-classes-pdf?academicYearId=...&code=...
   * Génère un PDF de TOUTES les classes d'un niveau, regroupées par niveau.
   * Chaque classe commence sur une nouvelle page.
   */
  @Get('export/all-classes-pdf')
  async exportAllClassesPdf(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('code') code?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('status') status: string = '',
    @Res() res?: Response,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est obligatoire');
    }
    if (!code && !schoolLevelId) {
      throw new BadRequestException('code (MATERNELLE/PRIMAIRE/SECONDAIRE) ou schoolLevelId est obligatoire');
    }
    const { buffer: pdfBuffer, filename } = await this.classListPdf.generateAllClassesPdf(
      tenantId,
      academicYearId,
      code,
      schoolLevelId,
      status,
    );
    const safeName = filename
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 60);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${safeName}"`,
      'Content-Length': pdfBuffer.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });
    res.send(pdfBuffer);
  }

  /**
   * GET /students/export/global-excel?academicYearId=...
   * Génère un fichier Excel GLOBAL avec TOUTES les classes officielles de TOUS les niveaux.
   * Une feuille par classe officielle.
   */
  @Roles(...MANAGEMENT_ROLES)
  @Get('export/global-excel')
  async exportGlobalExcel(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est obligatoire');
    }
    const result = await this.educmasterExcel.generateGlobalWorkbook({
      tenantId,
      academicYearId,
    });
    return new StreamableFile(result.buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${encodeURIComponent(result.filename)}"`,
    });
  }

  /**
   * GET /students/export/global-pdf?academicYearId=...
   * Génère un PDF GLOBAL avec TOUTES les classes de TOUS les niveaux.
   * Chaque classe commence sur une nouvelle page.
   */
  @Roles(...MANAGEMENT_ROLES)
  @Get('export/global-pdf')
  async exportGlobalPdf(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Res() res: Response,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est obligatoire');
    }
    const { buffer: pdfBuffer, filename } = await this.classListPdf.generateGlobalPdf(
      tenantId,
      academicYearId,
    );
    const safeName = filename
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 60);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${safeName}"`,
      'Content-Length': pdfBuffer.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });
    res.send(pdfBuffer);
  }

  /**
   * GET /students/export/physical-class-excel?academicYearId=...&classId=...
   * Génère un fichier Excel pour UNE classe PHYSIQUE (Class, section réelle).
   * Utilisé par l'onglet "Liste des Élèves".
   */
  @Get('export/physical-class-excel')
  async exportPhysicalClassExcel(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId: string,
  ) {
    if (!academicYearId || !classId) {
      throw new BadRequestException('academicYearId et classId sont obligatoires');
    }
    const result = await this.educmasterExcel.generateWorkbookForSinglePhysicalClass({
      tenantId,
      academicYearId,
      classId,
    });
    return new StreamableFile(result.buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${encodeURIComponent(result.filename)}"`,
    });
  }

  /**
   * GET /students/export/global-physical-excel?academicYearId=...
   * Génère un fichier Excel GLOBAL avec TOUTES les classes PHYSIQUES (sections).
   * Une feuille par section physique.
   * Utilisé par l'onglet "Liste des Élèves".
   */
  @Roles(...MANAGEMENT_ROLES)
  @Get('export/global-physical-excel')
  async exportGlobalPhysicalExcel(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est obligatoire');
    }
    const result = await this.educmasterExcel.generateGlobalPhysicalWorkbook({
      tenantId,
      academicYearId,
    });
    return new StreamableFile(result.buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${encodeURIComponent(result.filename)}"`,
    });
  }

  /**
   * GET /students/export/global-physical-pdf?academicYearId=...
   * Génère un PDF GLOBAL avec TOUTES les classes PHYSIQUES (sections).
   * Chaque section commence sur une nouvelle page.
   * Utilisé par l'onglet "Liste des Élèves".
   */
  @Roles(...MANAGEMENT_ROLES)
  @Get('export/global-physical-pdf')
  async exportGlobalPhysicalPdf(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Res() res: Response,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est obligatoire');
    }
    const { buffer: pdfBuffer, filename } = await this.classListPdf.generateGlobalPhysicalPdf(
      tenantId,
      academicYearId,
    );
    const safeName = filename
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 60);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${safeName}"`,
      'Content-Length': pdfBuffer.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });
    res.send(pdfBuffer);
  }

  @Get('class/:classId')
  async getByClass(
    @TenantId() tenantId: string,
    @Param('classId') classId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.lifecycle.getStudentsByClass(tenantId, classId, academicYearId);
  }

  @Get(':id/history')
  async getHistory(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.lifecycle.getStudentHistory(tenantId, id);
  }

  /**
   * GET /api/students/:id/audit
   * Journal d'audit des actions Module 1 (pré-inscription, admission, réinscription, transfert, changement de classe)
   */
  @Get(':id/audit')
  async getAuditLog(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.lifecycle.getStudentAuditLog(tenantId, id);
  }

  @Post(':id/generate-card')
  async generateCard(
    @TenantId() tenantId: string,
    @Param('id') studentId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId: string,
  ) {
    return this.idCard.generateIdCard(tenantId, academicYearId, schoolLevelId, studentId, undefined);
  }

  @Post(':id/export-educmaster')
  async exportEducmaster(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.lifecycle.exportEducmaster(tenantId, id);
  }

  /**
   * GET /students/class-list/:classId/pdf
   * Génère le PDF de la liste des élèves d'une classe.
   *
   * En-tête officiel adapté au niveau :
   *   - Maternelle/Primaire → "Ministère des Enseignements Maternel et Primaire"
   *   - Secondaire → "Ministère de l'Enseignement Secondaire, de la Formation
   *     Technique et Professionnelle, de la Reconversion et de l'Insertion des Jeunes"
   *
   * Query:
   *   - academicYearId (requis)
   *   - mode : 'physical' (défaut) ou 'official'
   *     'physical' = classe physique (Class, table `classes`) — sections CE1-A, CE1-B...
   *     'official' = classe officielle (AcademicClass, table `pedagogy_academic_classes`) — CE1, CP, 6ème...
   */
  @Get('class-list/:classId/pdf')
  async generateClassListPdf(
    @TenantId() tenantId: string,
    @Param('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('mode') mode?: string,
    @Query('status') status: string = '',
    @Res() res?: Response,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    const pdfMode: ClassListPdfMode = mode === 'official' ? 'official' : 'physical';
    const { buffer: pdfBuffer, className } = await this.classListPdf.generateClassListPdf(
      classId,
      tenantId,
      academicYearId,
      pdfMode,
      status,
    );

    // Nettoyer le nom de la classe pour le nom de fichier (ASCII-safe)
    const safeName = (className || 'classe')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 60);

    // ⚠️ Utiliser res.send() et NON return pdfBuffer
    // Avec @Res({ passthrough: true }) + return, NestJS sérialise le Buffer en
    // JSON {type:"Buffer", data:[...]} au lieu d'envoyer le binaire brut.
    // Avec @Res() (sans passthrough) + res.send(), le Buffer est envoyé tel quel.
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="liste_${safeName}.pdf"`,
      'Content-Length': pdfBuffer.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });
    res.send(pdfBuffer);
  }

  /**
   * POST /students/class-list/:classId/pdf/generate
   * Génère le PDF de la liste de classe et le STOCKE en DB (GeneratedDocument).
   * Pattern identique au module RH (contrats) : générer une fois, visualiser ensuite.
   *
   * Body: { academicYearId, mode? }
   *   - mode : 'physical' (défaut) ou 'official'
   * Returns: { success: true, documentId, fileName, fileSize, generatedAt }
   */
  @Post('class-list/:classId/pdf/generate')
  async generateAndStoreClassListPdf(
    @TenantId() tenantId: string,
    @Param('classId') classId: string,
    @Body() body: { academicYearId: string; mode?: string },
    @CurrentUser() user: any,
  ) {
    if (!body?.academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    const pdfMode: ClassListPdfMode = body.mode === 'official' ? 'official' : 'physical';

    // Générer le PDF
    const { buffer: pdfBuffer, className, schoolName } = await this.classListPdf.generateClassListPdf(
      classId,
      tenantId,
      body.academicYearId,
      pdfMode,
    );

    // Convertir en data URL base64 pour stockage (pattern data URL comme admission documents)
    const base64Data = pdfBuffer.toString('base64');
    const dataUrl = `data:application/pdf;base64,${base64Data}`;

    const safeName = (className || 'classe')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 60);
    const fileName = `liste_${safeName}.pdf`;

    // Supprimer l'ancien document stocké s'il existe (même classId + même mode)
    // ⭐ Inclut 'mode' dans le filtre deleteMany pour éviter de supprimer un PDF
    // de l'autre mode (ex: régénérer l'officiel ne doit pas supprimer le physique).
    await this.prisma.generatedDocument.deleteMany({
      where: {
        tenantId,
        documentType: 'CLASS_LIST_PDF',
        AND: [
          { metadata: { path: ['classId'], equals: classId } as any },
          { metadata: { path: ['mode'], equals: pdfMode } as any },
        ],
      },
    }).catch(() => {});

    // Stocker le nouveau PDF
    const doc = await this.prisma.generatedDocument.create({
      data: {
        tenantId,
        academicYearId: body.academicYearId,
        documentType: 'CLASS_LIST_PDF',
        fileName,
        filePath: dataUrl,
        fileSize: pdfBuffer.length,
        mimeType: 'application/pdf',
        generatedBy: user?.id || null,
        metadata: { classId, className, schoolName, mode: pdfMode } as any,
      },
    });

    return {
      success: true,
      documentId: doc.id,
      fileName,
      fileSize: pdfBuffer.length,
      generatedAt: doc.createdAt,
    };
  }

  /**
   * GET /students/class-list/:classId/pdf/stored?academicYearId=xxx&mode=xxx
   * Récupère le PDF stocké en DB (sans regénérer). Retourne 404 si non généré.
   *
   * Pattern : l'appelant vérifie d'abord /exists, puis appelle /stored si le doc existe.
   * ⭐ Le paramètre `mode` est utilisé pour filtrer les métadonnées (évite les collisions
   *    entre un PDF officiel et un PDF physique de la même classe).
   */
  @Get('class-list/:classId/pdf/stored')
  async getStoredClassListPdf(
    @TenantId() tenantId: string,
    @Param('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('mode') mode: string = '',
    @Res() res?: Response,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    const pdfMode: ClassListPdfMode = mode === 'official' ? 'official' : 'physical';

    const doc = await this.prisma.generatedDocument.findFirst({
      where: {
        tenantId,
        documentType: 'CLASS_LIST_PDF',
        academicYearId,
        AND: [
          { metadata: { path: ['classId'], equals: classId } as any },
          { metadata: { path: ['mode'], equals: pdfMode } as any },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!doc || !doc.filePath) {
      throw new NotFoundException('Aucun PDF généré pour cette classe. Générez d\'abord le document.');
    }

    // Le filePath est un data URL — extraire le base64 et envoyer en binaire
    const match = doc.filePath.match(/^data:application\/pdf;base64,(.+)$/);
    if (match) {
      const buffer = Buffer.from(match[1], 'base64');
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${doc.fileName}"`,
        'Content-Length': buffer.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      });
      res.send(buffer);
    } else {
      throw new NotFoundException('Document corrompu. Régénérez le document.');
    }
  }

  /**
   * GET /students/class-list/:classId/pdf/exists?academicYearId=xxx&mode=xxx
   * Vérifie si un PDF a déjà été généré pour cette classe.
   * Retourne { exists: boolean, documentId?, generatedAt? }
   * ⭐ Le paramètre `mode` est utilisé pour filtrer les métadonnées (évite les collisions
   *    entre un PDF officiel et un PDF physique de la même classe).
   */
  @Get('class-list/:classId/pdf/exists')
  async checkClassListPdfExists(
    @TenantId() tenantId: string,
    @Param('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('mode') mode?: string,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    const pdfMode: ClassListPdfMode = mode === 'official' ? 'official' : 'physical';

    const doc = await this.prisma.generatedDocument.findFirst({
      where: {
        tenantId,
        documentType: 'CLASS_LIST_PDF',
        academicYearId,
        AND: [
          { metadata: { path: ['classId'], equals: classId } as any },
          { metadata: { path: ['mode'], equals: pdfMode } as any },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, fileName: true, fileSize: true },
    });

    return {
      exists: !!doc,
      documentId: doc?.id || null,
      generatedAt: doc?.createdAt || null,
      fileName: doc?.fileName || null,
      fileSize: doc?.fileSize || null,
    };
  }

  /**
   * ⭐ Bascule "Nouvel élève / Ancien élève" pour un enrollment existant.
   *
   * Met à jour `enrollmentType` sur le StudentEnrollment, puis recalcule
   * automatiquement le StudentAccount pour refléter le changement au niveau
   * financier (frais d'INSCRIPTION vs REINSCRIPTION).
   *
   * Body: { studentId, academicYearId, enrollmentType: 'NEW' | 'REPEAT' | 'PROMOTION' | 'TRANSFER' }
   */
  @Post('update-enrollment-type')
  async updateEnrollmentType(
    @TenantId() tenantId: string,
    @Body() body: { studentId: string; academicYearId: string; enrollmentType: 'NEW' | 'REPEAT' | 'PROMOTION' | 'TRANSFER' },
  ) {
    return this.lifecycle.updateEnrollmentType(
      tenantId,
      body.studentId,
      body.academicYearId,
      body.enrollmentType,
    );
  }

  /**
   * ⭐ Supprime définitivement un élève et toutes ses données liées.
   * Sécurité : seuls les élèves avec statut PRE_REGISTERED ou ADMITTED
   * (sans paiements) peuvent être supprimés.
   */
  @Post('delete-student')
  @Roles(...MANAGEMENT_ROLES)
  async deleteStudent(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { studentId: string },
  ) {
    return this.lifecycle.deleteStudent(tenantId, body.studentId, user?.id);
  }

  /**
   * ⭐ POST /students/repair-enrollment
   * Réparation idempotente d'une inscription interrompue (connexion perdue
   * entre preRegister et admit). Complète UNIQUEMENT ce qui manque :
   *   - enrollment manquant → recréé
   *   - classe officielle / type d'inscription → mis à jour (+ section physique
   *     ré-assignée selon la règle « section unique »)
   *   - matricule manquant → généré
   *   - statut PRE_REGISTERED/PENDING → ADMITTED
   *   - dossier académique / identifiant global / token public → créés si absents
   *   - compte financier → créé ou recalculé (imputations des frais)
   * Body: { studentId, academicYearId, schoolLevelId?, academicClassId?, enrollmentType? }
   */
  @Post('repair-enrollment')
  @Roles(...MANAGEMENT_ROLES)
  async repairEnrollment(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: {
      studentId: string;
      academicYearId: string;
      schoolLevelId?: string;
      academicClassId?: string;
      enrollmentType?: string;
    },
  ) {
    if (!body?.studentId || !body?.academicYearId) {
      throw new BadRequestException('studentId et academicYearId sont requis');
    }
    return this.lifecycle.repairEnrollment(tenantId, body, user?.id);
  }
}
