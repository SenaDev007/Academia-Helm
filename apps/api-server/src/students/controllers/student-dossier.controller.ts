/**
 * ============================================================================
 * STUDENT DOSSIER CONTROLLER - API DOSSIER SCOLAIRE
 * ============================================================================
 * 
 * Controller pour gérer le dossier scolaire numérique de l'élève
 * RBAC strict selon le rôle utilisateur
 * 
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { StudentDossierService } from '../services/student-dossier.service';
import { PublicVerificationService } from '../services/public-verification.service';

@Controller('api/students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentDossierController {
  constructor(
    private readonly dossierService: StudentDossierService,
    private readonly verificationService: PublicVerificationService,
  ) {}

  /**
   * GET /api/students/:studentId/dossier
   * Récupère le dossier scolaire complet d'un élève
   */
  @Get(':studentId/dossier')
  @Roles('DIRECTOR', 'ADMIN', 'TEACHER', 'PARENT', 'STUDENT')
  async getDossier(
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId?: string,
    @Request() req?: any,
  ) {
    const tenantId = req.user.tenantId;
    
    // Vérifier les permissions selon le rôle
    if (req.user.role === 'PARENT' || req.user.role === 'STUDENT') {
      // Les parents et élèves ne peuvent voir que leur propre dossier
      // TODO: Vérifier la relation parent-élève ou student-élève
    }

    return this.dossierService.getStudentDossier(tenantId, studentId, academicYearId);
  }

  /**
   * GET /api/students/:studentId/academic-dossier
   * Génère le dossier académique consolidé en PDF.
   */
  @Get(':studentId/academic-dossier')
  @Roles('DIRECTOR', 'ADMIN')
  async getAcademicDossierPdf(
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string | undefined,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const tenantId = req.user.tenantId;
    const pdfBuffer = await this.dossierService.generateAcademicDossierPdf(
      tenantId,
      studentId,
      academicYearId,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="dossier-academique-${studentId}.pdf"`,
    );
    return res.send(pdfBuffer);
  }

  /**
   * POST /api/students/:studentId/dossier/academic-record
   * Crée ou met à jour un enregistrement académique
   */
  @Post(':studentId/dossier/academic-record')
  @Roles('DIRECTOR', 'ADMIN')
  async upsertAcademicRecord(
    @Param('studentId') studentId: string,
    @Body() data: any,
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    const { academicYearId, ...recordData } = data;

    if (!academicYearId) {
      throw new Error('academicYearId est requis');
    }

    return this.dossierService.upsertAcademicRecord(
      tenantId,
      studentId,
      academicYearId,
      recordData,
    );
  }

  /**
   * POST /api/students/:studentId/dossier/disciplinary-summary
   * Crée ou met à jour un résumé disciplinaire
   */
  @Post(':studentId/dossier/disciplinary-summary')
  @Roles('DIRECTOR', 'ADMIN')
  async upsertDisciplinarySummary(
    @Param('studentId') studentId: string,
    @Body() data: any,
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    const { academicYearId, ...summaryData } = data;

    if (!academicYearId) {
      throw new Error('academicYearId est requis');
    }

    return this.dossierService.upsertDisciplinarySummary(
      tenantId,
      studentId,
      academicYearId,
      summaryData,
    );
  }

  /**
   * POST /api/students/:studentId/dossier/sync-disciplinary
   * Synchronise automatiquement le résumé disciplinaire
   */
  @Post(':studentId/dossier/sync-disciplinary')
  @Roles('DIRECTOR', 'ADMIN')
  async syncDisciplinarySummary(
    @Param('studentId') studentId: string,
    @Body() body: { academicYearId: string },
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    return this.dossierService.syncDisciplinarySummary(
      tenantId,
      studentId,
      body.academicYearId,
    );
  }

  /**
   * POST /api/students/:studentId/verification-token/generate
   * Génère un token de vérification publique pour un élève
   */
  @Post(':studentId/verification-token/generate')
  @Roles('DIRECTOR', 'ADMIN')
  async generateVerificationToken(
    @Param('studentId') studentId: string,
    @Body() body: { academicYearId: string },
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    return this.verificationService.generateVerificationToken(
      tenantId,
      studentId,
      body.academicYearId,
    );
  }

  /**
   * GET /api/students/verification/stats
   * Récupère les statistiques de vérification
   */
  @Get('verification/stats')
  @Roles('DIRECTOR', 'ADMIN')
  async getVerificationStats(
    @Query('academicYearId') academicYearId?: string,
    @Request() req?: any,
  ) {
    const tenantId = req.user.tenantId;
    return this.verificationService.getVerificationStats(tenantId, academicYearId);
  }
}

