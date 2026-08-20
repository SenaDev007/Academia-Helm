/**
 * ============================================================================
 * MATERIAL RETURNS CONTROLLER — Suivi des retours de matériel en fin d'année
 * ============================================================================
 *
 * Flux utilisateur :
 *   1. Enseignant (UI Espace Pédagogique → sous-onglet Matériel) :
 *      - Voit automatiquement toutes ses attributions de l'année
 *      - Coche chaque item retourné (returnQuantity, returnCondition)
 *      - Signe une fois (signature pad → base64)
 *      - Clique "Envoyer" → toutes ses attributions passent en SUBMITTED
 *
 *   2. Direction (UI Organisation Pédagogique → sous-onglet Retour) :
 *      - Voit les soumissions en attente (returnStatus = SUBMITTED)
 *      - Valide ou refuse chaque item
 *      - Peut noter les pertes (lostQuantity, lostNotes)
 *
 * Endpoints :
 *   GET    /pedagogy/material-returns/my-assignments?userId=&academicYearId=
 *   PATCH  /pedagogy/material-returns/:id/return        (update returnQuantity etc.)
 *   POST   /pedagogy/material-returns/submit            (bulk submit with signature)
 *   GET    /pedagogy/material-returns/pending?academicYearId=
 *   GET    /pedagogy/material-returns/history?academicYearId=&teacherId=
 *   POST   /pedagogy/material-returns/:id/validate
 *   POST   /pedagogy/material-returns/:id/reject
 * ============================================================================
 */

import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, BadRequestException, NotFoundException, Res,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { MaterialReturnsService } from './material-returns.service';

@Controller('pedagogy/material-returns')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MaterialReturnsController {
  constructor(private readonly service: MaterialReturnsService) {}

  /// Récupère les attributions de matériel de l'enseignant connecté.
  ///    Le frontend passe user.id ; on résout en Teacher.id.
  @Get('my-assignments')
  async getMyAssignments(
    @TenantId() tenantId: string,
    @Query('userId') userId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!userId || !academicYearId) {
      throw new BadRequestException('userId et academicYearId sont requis');
    }
    return this.service.getMyAssignments(tenantId, userId, academicYearId);
  }

  /// Liste les enseignants groupés par niveau scolaire (pour le select Distribution)
  @Get('teachers-by-level')
  async getTeachersByLevel(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.service.getTeachersByLevel(tenantId, academicYearId);
  }

  /// Met à jour les informations de retour pour UNE attribution.
  @Patch(':id/return')
  @HttpCode(HttpStatus.OK)
  async updateReturnInfo(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: {
      returnQuantity?: number;
      returnCondition?: string;
      returnNotes?: string;
    },
  ) {
    return this.service.updateReturnInfo(tenantId, id, body);
  }

  /// ⭐ Signe la RÉCEPTION d'une attribution (l'enseignant confirme avoir reçu le matériel)
  ///    Sépare de la soumission de retour (qui se fait en fin d'année).
  @Post(':id/sign-receipt')
  @HttpCode(HttpStatus.OK)
  async signReceipt(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { userId: string; signatureUrl: string },
  ) {
    if (!body.userId || !body.signatureUrl) {
      throw new BadRequestException('userId et signatureUrl sont requis');
    }
    return this.service.signReceipt(tenantId, id, body.userId, body.signatureUrl);
  }

  /// Soumet TOUTES les attributions PENDING de l'enseignant pour l'année
  ///    avec une signature unique (base64 data URL).
  @Post('submit')
  @HttpCode(HttpStatus.OK)
  async submitReturn(
    @TenantId() tenantId: string,
    @Body() body: {
      userId: string;
      academicYearId: string;
      signatureUrl: string;
    },
  ) {
    if (!body.userId || !body.academicYearId || !body.signatureUrl) {
      throw new BadRequestException('userId, academicYearId, signatureUrl sont requis');
    }
    return this.service.submitReturn(
      tenantId, body.userId, body.academicYearId, body.signatureUrl,
    );
  }

  /// Liste les soumissions en attente de validation (vue direction)
  @Get('pending')
  async getPendingReturns(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    return this.service.getPendingReturns(tenantId, academicYearId, schoolLevelId);
  }

  /// Vue historique par année / par enseignant
  @Get('history')
  async getHistory(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('teacherId') teacherId?: string,
    @Query('classId') classId?: string,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    return this.service.getHistory(tenantId, academicYearId, teacherId, classId);
  }

  /// La direction valide une soumission de retour
  @Post(':id/validate')
  @HttpCode(HttpStatus.OK)
  async validateReturn(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { validatedBy: string; lostQuantity?: number; lostNotes?: string },
  ) {
    if (!body.validatedBy) {
      throw new BadRequestException('validatedBy est requis');
    }
    return this.service.validateReturn(
      tenantId, id, body.validatedBy,
      body.lostQuantity ?? 0, body.lostNotes,
    );
  }

  /// La direction refuse une soumission de retour (avec motif)
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectReturn(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { validatedBy: string; rejectionReason: string },
  ) {
    if (!body.validatedBy || !body.rejectionReason) {
      throw new BadRequestException('validatedBy et rejectionReason sont requis');
    }
    return this.service.rejectReturn(
      tenantId, id, body.validatedBy, body.rejectionReason,
    );
  }

  // ===========================================================================
  // EXPORTS PDF
  // ===========================================================================

  /// ⭐ PDF — Bon de réception de matériel pédagogique pour un enseignant
  ///    Généré côté backend avec en-tête école (logo + nom + acronyme),
  ///    titre du document, liste des matériels reçus, signature enseignant.
  @Get('my-receipt-pdf')
  async exportMyReceiptPdf(
    @TenantId() tenantId: string,
    @Query('userId') userId: string,
    @Query('academicYearId') academicYearId: string,
    @Res() res: any,
  ) {
    if (!userId || !academicYearId) {
      throw new BadRequestException('userId et academicYearId sont requis');
    }
    const buffer = await this.service.exportMyReceiptPdf(tenantId, userId, academicYearId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="bon_reception_materiel_${userId.substring(0, 8)}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /// ⭐ PDF — État complet des distributions (vue direction)
  ///    Liste tous les matériels distribués à tous les enseignants pour l'année.
  @Get('distribution-pdf')
  async exportDistributionPdf(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId: string,
    @Res() res: any,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    const buffer = await this.service.exportDistributionPdf(tenantId, academicYearId, schoolLevelId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="etat_distributions_materiel_${academicYearId.substring(0, 8)}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /// ⭐ PDF — Inventaire complet du matériel pédagogique (vue direction)
  ///    Liste tous les matériels + stock total + stock disponible par année.
  @Get('inventory-pdf')
  async exportInventoryPdf(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Res() res: any,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    const buffer = await this.service.exportInventoryPdf(tenantId, academicYearId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="inventaire_materiel_pedagogique_${academicYearId.substring(0, 8)}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
