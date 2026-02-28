/**
 * Module 1 — API cycle de vie élève : pre-register, admit, re-enroll, transfer, change-class, history, export EDUCMASTER.
 */

import { BadRequestException, Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { StreamableFile } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StudentsLifecycleService } from '../services/students-lifecycle.service';
import { StudentIdCardService } from '../services/student-id-card.service';
import { EducmasterExcelExportService } from '../services/educmaster-excel-export.service';

@Controller('api/students')
@UseGuards(JwtAuthGuard)
export class StudentsLifecycleController {
  constructor(
    private readonly lifecycle: StudentsLifecycleService,
    private readonly idCard: StudentIdCardService,
    private readonly educmasterExcel: EducmasterExcelExportService,
  ) {}

  @Post('pre-register')
  async preRegister(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() body: any) {
    return this.lifecycle.preRegister(tenantId, body, user?.id);
  }

  @Post('admit')
  async admit(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() body: any) {
    return this.lifecycle.admit(tenantId, body, user?.id);
  }

  @Post('re-enroll')
  async reEnroll(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() body: any) {
    return this.lifecycle.reEnroll(tenantId, body, user?.id);
  }

  @Post('transfer')
  async transfer(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() body: any) {
    return this.lifecycle.transfer(tenantId, body, user?.id);
  }

  @Post('change-class')
  async changeClass(@TenantId() tenantId: string, @CurrentUser() user: any, @Body() body: any) {
    return this.lifecycle.changeClass(tenantId, body, user?.id);
  }

  /**
   * Promotion annuelle manuelle d'un élève (hors clôture globale).
   */
  @Post('promote')
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
   * Query: academicYearId, schoolLevelId (obligatoires).
   */
  @Get('export/educmaster-excel')
  async exportEducmasterExcel(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId: string,
  ) {
    if (!academicYearId || !schoolLevelId) {
      throw new BadRequestException('academicYearId et schoolLevelId sont obligatoires');
    }
    const result = await this.educmasterExcel.generateWorkbook({
      tenantId,
      academicYearId,
      schoolLevelId,
    });
    return new StreamableFile(result.buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${encodeURIComponent(result.filename)}"`,
    });
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
}
