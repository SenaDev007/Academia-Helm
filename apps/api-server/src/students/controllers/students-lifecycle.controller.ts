/**
 * Module 1 — API cycle de vie élève : pre-register, admit, re-enroll, transfer, change-class, history, export EDUCMASTER.
 */

import { BadRequestException, Controller, Get, Post, Body, Param, Query, UseGuards, Res, NotFoundException } from '@nestjs/common';
import { StreamableFile } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StudentsLifecycleService } from '../services/students-lifecycle.service';
import { StudentIdCardService } from '../services/student-id-card.service';
import { EducmasterExcelExportService } from '../services/educmaster-excel-export.service';
import { ClassListPdfService } from '../services/class-list-pdf.service';
import { PrismaService } from '../../database/prisma.service';
import type { Response } from 'express';

@Controller('students')
@UseGuards(JwtAuthGuard)
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
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    return this.lifecycle.getEnrollments(tenantId, { academicYearId, schoolLevelId });
  }

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

  /**
   * GET /students/class-list/:classId/pdf
   * Génère le PDF de la liste des élèves d'une classe.
   *
   * En-tête officiel adapté au niveau :
   *   - Maternelle/Primaire → "Ministère des Enseignements Maternel et Primaire"
   *   - Secondaire → "Ministère de l'Enseignement Secondaire, de la Formation
   *     Technique et Professionnelle, de la Reconversion et de l'Insertion des Jeunes"
   *
   * Query: academicYearId (requis)
   */
  @Get('class-list/:classId/pdf')
  async generateClassListPdf(
    @TenantId() tenantId: string,
    @Param('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
    @Res() res: Response,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    const { buffer: pdfBuffer, className } = await this.classListPdf.generateClassListPdf(
      classId,
      tenantId,
      academicYearId,
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
   * Body: { academicYearId }
   * Returns: { success: true, documentId, fileName, fileSize, generatedAt }
   */
  @Post('class-list/:classId/pdf/generate')
  async generateAndStoreClassListPdf(
    @TenantId() tenantId: string,
    @Param('classId') classId: string,
    @Body() body: { academicYearId: string },
    @CurrentUser() user: any,
  ) {
    if (!body?.academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }

    // Générer le PDF
    const { buffer: pdfBuffer, className, schoolName } = await this.classListPdf.generateClassListPdf(
      classId,
      tenantId,
      body.academicYearId,
    );

    // Convertir en data URL base64 pour stockage (pattern data URL comme admission documents)
    const base64Data = pdfBuffer.toString('base64');
    const dataUrl = `data:application/pdf;base64,${base64Data}`;

    const safeName = (className || 'classe')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 60);
    const fileName = `liste_${safeName}.pdf`;

    // Supprimer l'ancien document stocké s'il existe (même classId + academicYearId)
    await this.prisma.generatedDocument.deleteMany({
      where: {
        tenantId,
        documentType: 'CLASS_LIST_PDF',
        metadata: {
          path: ['classId'],
          equals: classId,
        },
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
        metadata: { classId, className, schoolName } as any,
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
   * GET /students/class-list/:classId/pdf/stored?academicYearId=xxx
   * Récupère le PDF stocké en DB (sans regénérer). Retourne 404 si non généré.
   *
   * Pattern : l'appelant vérifie d'abord /exists, puis appelle /stored si le doc existe.
   */
  @Get('class-list/:classId/pdf/stored')
  async getStoredClassListPdf(
    @TenantId() tenantId: string,
    @Param('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
    @Res() res: Response,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }

    const doc = await this.prisma.generatedDocument.findFirst({
      where: {
        tenantId,
        documentType: 'CLASS_LIST_PDF',
        academicYearId,
        metadata: { path: ['classId'], equals: classId } as any,
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
   * GET /students/class-list/:classId/pdf/exists?academicYearId=xxx
   * Vérifie si un PDF a déjà été généré pour cette classe.
   * Retourne { exists: boolean, documentId?, generatedAt? }
   */
  @Get('class-list/:classId/pdf/exists')
  async checkClassListPdfExists(
    @TenantId() tenantId: string,
    @Param('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }

    const doc = await this.prisma.generatedDocument.findFirst({
      where: {
        tenantId,
        documentType: 'CLASS_LIST_PDF',
        academicYearId,
        metadata: { path: ['classId'], equals: classId } as any,
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
}
