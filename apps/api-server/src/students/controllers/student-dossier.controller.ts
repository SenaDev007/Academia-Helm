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

// ⭐ 1.0.10 (refonte dossier numérique) — rôles autorisés à consulter/générer
//    le dossier complet : inclut le PROMOTEUR et la SECRETAIRE (avant, la route
//    PDF était limitée à DIRECTEUR/ADMIN — le promoteur avait un 403).
const DOSSIER_ROLES = [
  'ADMIN', 'DIRECTOR', 'SCHOOL_ADMIN', 'DIRECTEUR',
  'DIRECTEUR_GENERAL', 'DIRECTEUR_ETABLISSEMENT', 'SUPER_DIRECTOR',
  'PROMOTER', 'SCHOOL_OWNER', 'BOARD_PRESIDENT', 'SECRETARY', 'SECRETAIRE',
  'TEACHER',
];

@Controller('students')
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
  @Roles('DIRECTEUR', 'DIRECTOR', 'ADMIN', 'TEACHER', 'PARENT', 'STUDENT')
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
   * ⭐ 1.0.10 — génère le DOSSIER SCOLAIRE COMPLET en PDF (7 sections :
   *    identité, responsables, parcours année par année + école d'origine,
   *    bulletins, assiduité/discipline, documents, carte scolaire).
   */
  @Get(':studentId/academic-dossier')
  @Roles(...DOSSIER_ROLES)
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
  @Roles('DIRECTEUR', 'DIRECTOR', 'ADMIN')
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
  @Roles('DIRECTEUR', 'DIRECTOR', 'ADMIN')
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
  @Roles('DIRECTEUR', 'DIRECTOR', 'ADMIN')
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
   * GET /api/students/:studentId/verification-qr
   * Retourne l'URL publique et l'image QR pour la carte scolaire (dossier / impression)
   */
  @Get(':studentId/verification-qr')
  @Roles('DIRECTEUR', 'DIRECTOR', 'ADMIN', 'TEACHER', 'PARENT', 'STUDENT')
  async getVerificationQR(
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    if (!academicYearId) throw new Error('academicYearId est requis');
    return this.verificationService.getStudentQRForDossier(tenantId, studentId, academicYearId);
  }

  /**
   * POST /api/students/:studentId/verification-token/generate
   * Génère un token de vérification publique pour un élève
   */
  @Post(':studentId/verification-token/generate')
  @Roles('DIRECTEUR', 'DIRECTOR', 'ADMIN')
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
   * POST /api/students/:studentId/verification-token/regenerate
   * Régénère le token (révocable, anti-abus : 1 fois / 5 min). Rôle directeur uniquement.
   */
  @Post(':studentId/verification-token/regenerate')
  @Roles('DIRECTEUR', 'DIRECTOR', 'ADMIN')
  async regenerateVerificationToken(
    @Param('studentId') studentId: string,
    @Body() body: { academicYearId: string },
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    return this.verificationService.regenerateToken(
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
  @Roles('DIRECTEUR', 'DIRECTOR', 'ADMIN')
  async getVerificationStats(
    @Query('academicYearId') academicYearId?: string,
    @Request() req?: any,
  ) {
    const tenantId = req.user.tenantId;
    return this.verificationService.getVerificationStats(tenantId, academicYearId);
  }
}

