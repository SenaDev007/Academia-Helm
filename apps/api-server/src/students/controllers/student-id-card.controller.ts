/**
 * ============================================================================
 * STUDENT ID CARD CONTROLLER - MODULE 1
 * ============================================================================
 *
 * ⚠️ ORDRE DES ROUTES IMPORTANT :
 * Les routes STATIQUES (stats, grouped-by-class, class/:classId/bundle-pdf,
 * verify-qr, generate-bulk) DOIVENT être déclarées AVANT les routes
 * paramétrées (@Get(':studentId'), @Get(':cardId/download'), etc.)
 * sinon NestJS matche les routes statiques comme un :studentId/:cardId.
 *
 * Exemple du bug corrigé : @Get('grouped-by-class') était après @Get(':studentId')
 * → NestJS interprétait 'grouped-by-class' comme un studentId → 404
 *   "No active ID card found for student grouped-by-class"
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Res,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetTenant } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StudentIdCardService } from '../services/student-id-card.service';

@Controller('students/id-cards')
@UseGuards(JwtAuthGuard, TenantGuard)
export class StudentIdCardController {
  constructor(private readonly idCardService: StudentIdCardService) {}

  // ─── ROUTES STATIQUES (à déclarer AVANT les routes paramétrées) ────────────

  /**
   * Génère des cartes par lot (classe, niveau, ou TOUS les niveaux)
   *
   * ⭐ Si schoolLevelId n'est pas fourni dans le body, génère pour TOUS les
   * élèves actifs du tenant pour l'année, tous niveaux confondus.
   */
  @Post('generate-bulk')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DIRECTOR', 'SECRETARY', 'PROMOTER', 'SCHOOL_OWNER', 'BOARD_PRESIDENT', 'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR', 'SCHOOL_ADMIN')
  async generateBulkIdCards(
    @GetTenant() tenant: any,
    @Body() data: {
      academicYearId: string;
      schoolLevelId?: string;
      classId?: string;
      status?: string;
    },
    @CurrentUser() user: any,
  ) {
    return this.idCardService.generateBulkIdCards(
      tenant.id,
      data.academicYearId,
      data.schoolLevelId,
      {
        classId: data.classId,
        status: data.status,
      },
      user.id,
    );
  }

  /**
   * Vérifie un QR Code de carte (validation)
   */
  @Post('verify-qr')
  async verifyQRCode(@Body() data: { qrPayload: string; qrHash: string }) {
    if (!data.qrPayload || !data.qrHash) {
      throw new BadRequestException('qrPayload and qrHash are required');
    }
    const isValid = await this.idCardService.verifyQRCode(data.qrPayload, data.qrHash);
    return {
      isValid,
      ...(isValid && { message: 'QR Code valid and card is active' }),
      ...(!isValid && { message: 'QR Code invalid or card is revoked/expired' }),
    };
  }

  /**
   * Récupère les statistiques des cartes
   */
  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DIRECTOR', 'PROMOTER', 'SCHOOL_OWNER', 'BOARD_PRESIDENT', 'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR', 'SCHOOL_ADMIN', 'SECRETARY')
  async getIdCardStats(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.idCardService.getIdCardStats(tenant.id, academicYearId);
  }

  /**
   * ⭐ Liste les cartes groupées par niveau scolaire puis par classe.
   * GET /students/id-cards/grouped-by-class?academicYearId=...
   *
   * ⚠️ DOIT être avant @Get(':studentId') sinon 'grouped-by-class' est
   * intercepté comme un studentId.
   */
  @Get('grouped-by-class')
  async listCardsGroupedByClass(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    return this.idCardService.listCardsGroupedByClass(tenant.id, academicYearId);
  }

  /**
   * ⭐ Génère un PDF groupé contenant toutes les cartes d'une classe.
   * GET /students/id-cards/class/:classId/bundle-pdf?academicYearId=...
   *
   * ⚠️ DOIT être avant @Get(':studentId') sinon 'class' est intercepté
   * comme un studentId.
   */
  @Get('class/:classId/bundle-pdf')
  async downloadClassBundlePdf(
    @GetTenant() tenant: any,
    @Param('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
    @Res() res: Response,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    const { buffer, className, cardsCount } = await this.idCardService.generateClassBundlePdf(
      tenant.id,
      academicYearId,
      classId,
    );
    const safeName = className.replace(/[^a-zA-Z0-9-_]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="cartes-scolaires-${safeName}-${cardsCount}eleves.pdf"`);
    return res.send(buffer);
  }

  // ─── ROUTES PARAMÉTRÉES (après les routes statiques) ──────────────────────

  // ⚠️ ORDRE CRITIQUE : les routes :cardId/* DOIVENT être avant :studentId
  // car :studentId est un paramètre générique qui peut matcher n'importe quelle
  // valeur, y compris un cardId. Les routes à 2 segments (:cardId/download,
  // :cardId/preview-html) ne sont pas interceptées par :studentId (1 segment),
  // MAIS :studentId/history (2 segments) PEUT intercepter :cardId/download.
  // On met donc :cardId/* en premier.

  /**
   * ⭐ Prévisualisation HTML d'une carte (recto + verso) pour affichage dans l'UI.
   * GET /students/id-cards/:cardId/preview-html
   */
  @Get(':cardId/preview-html')
  async previewCardHtml(
    @GetTenant() tenant: any,
    @Param('cardId') cardId: string,
    @Res() res: Response,
  ) {
    const html = await this.idCardService.getCardPreviewHtml(cardId, tenant.id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.send(html);
  }

  /**
   * Télécharge le PDF d'une carte
   * GET /students/id-cards/:cardId/download
   */
  @Get(':cardId/download')
  async downloadIdCardPdf(
    @GetTenant() tenant: any,
    @Param('cardId') cardId: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.idCardService.downloadIdCardPdf(cardId, tenant.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="carte-scolaire-${cardId}.pdf"`);
    return res.send(pdfBuffer);
  }

  /**
   * Génère une carte scolaire pour un élève
   */
  @Post(':studentId/generate')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DIRECTOR', 'SECRETARY', 'PROMOTER', 'SCHOOL_OWNER', 'BOARD_PRESIDENT', 'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR', 'SCHOOL_ADMIN')
  async generateIdCard(
    @GetTenant() tenant: any,
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId: string,
    @CurrentUser() user: any,
  ) {
    return this.idCardService.generateIdCard(
      tenant.id,
      academicYearId,
      schoolLevelId,
      studentId,
      user.id,
    );
  }

  /**
   * Récupère la carte d'un élève pour une année scolaire
   */
  @Get(':studentId')
  async getStudentIdCard(
    @GetTenant() tenant: any,
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.idCardService.getStudentIdCard(studentId, tenant.id, academicYearId);
  }

  /**
   * Récupère l'historique des cartes d'un élève
   */
  @Get(':studentId/history')
  async getStudentIdCardsHistory(@GetTenant() tenant: any, @Param('studentId') studentId: string) {
    return this.idCardService.getStudentIdCardsHistory(studentId, tenant.id);
  }

  /**
   * Révoque une carte (perdue, volée, etc.)
   */
  @Put(':cardId/revoke')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DIRECTOR', 'PROMOTER', 'SCHOOL_OWNER', 'BOARD_PRESIDENT', 'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR', 'SCHOOL_ADMIN')
  async revokeIdCard(
    @GetTenant() tenant: any,
    @CurrentUser() user: any,
    @Param('cardId') cardId: string,
    @Body() data: { reason: string },
  ) {
    if (!data.reason || data.reason.trim().length === 0) {
      throw new BadRequestException('Revocation reason is mandatory');
    }
    return this.idCardService.revokeIdCard(cardId, tenant.id, user.id, data.reason);
  }


  /**
   * Récupère les statistiques des cartes
   */
  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DIRECTOR', 'PROMOTER', 'SCHOOL_OWNER', 'BOARD_PRESIDENT', 'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR', 'SCHOOL_ADMIN', 'SECRETARY')
  async getIdCardStats(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.idCardService.getIdCardStats(tenant.id, academicYearId);
  }

  /**
   * ⭐ Liste les cartes groupées par niveau scolaire puis par classe.
   * GET /students/id-cards/grouped-by-class?academicYearId=...
   */
  @Get('grouped-by-class')
  async listCardsGroupedByClass(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    return this.idCardService.listCardsGroupedByClass(tenant.id, academicYearId);
  }

  /**
   * ⭐ Génère un PDF groupé contenant toutes les cartes d'une classe.
   * GET /students/id-cards/class/:classId/bundle-pdf?academicYearId=...
   */
  @Get('class/:classId/bundle-pdf')
  async downloadClassBundlePdf(
    @GetTenant() tenant: any,
    @Param('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
    @Res() res: Response,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    const { buffer, className, cardsCount } = await this.idCardService.generateClassBundlePdf(
      tenant.id,
      academicYearId,
      classId,
    );
    const safeName = className.replace(/[^a-zA-Z0-9-_]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="cartes-scolaires-${safeName}-${cardsCount}eleves.pdf"`);
    return res.send(buffer);
  }

  /**
   * ⭐ DELETE /students/id-cards/all?academicYearId=...
   * Supprime TOUTES les cartes du tenant (optionnellement filtrées par année scolaire).
   */
  @Delete('all')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DIRECTOR', 'SCHOOL_OWNER', 'BOARD_PRESIDENT', 'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR', 'SCHOOL_ADMIN')
  async deleteAllCards(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.idCardService.deleteAllCards(tenant.id, academicYearId);
  }

  /**
   * ⭐ DELETE /students/id-cards/by-class/:classId?academicYearId=...
   * Supprime toutes les cartes d'une classe physique spécifique.
   */
  @Delete('by-class/:classId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DIRECTOR', 'SCHOOL_OWNER', 'BOARD_PRESIDENT', 'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR', 'SCHOOL_ADMIN')
  async deleteCardsByClass(
    @GetTenant() tenant: any,
    @Param('classId') classId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.idCardService.deleteCardsByClass(tenant.id, classId, academicYearId);
  }

  /**
   * ⭐ DELETE /students/id-cards/by-level/:levelId?academicYearId=...
   * Supprime toutes les cartes d'un niveau scolaire (Maternelle, Primaire, Secondaire).
   */
  @Delete('by-level/:levelId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DIRECTOR', 'SCHOOL_OWNER', 'BOARD_PRESIDENT', 'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR', 'SCHOOL_ADMIN')
  async deleteCardsByLevel(
    @GetTenant() tenant: any,
    @Param('levelId') levelId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.idCardService.deleteCardsByLevel(tenant.id, levelId, academicYearId);
  }

}
