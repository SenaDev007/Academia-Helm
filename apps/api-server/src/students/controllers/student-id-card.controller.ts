/**
 * ============================================================================
 * STUDENT ID CARD CONTROLLER - MODULE 1
 * ============================================================================
 * 
 * Controller pour génération de cartes scolaires officielles
 * 
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Put,
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

  /**
   * Génère une carte scolaire pour un élève
   */
  @Post(':studentId/generate')
  @UseGuards(RolesGuard)
  // ⚠️ PROMOTER = fondateur/propriétaire de l'école — doit pouvoir gérer les cartes
  // SCHOOL_OWNER, BOARD_PRESIDENT, DIRECTOR_GENERAL, SCHOOL_DIRECTOR, DEPUTY_DIRECTOR,
  // SCHOOL_ADMIN = rôles de direction équivalents à ADMIN/DIRECTOR
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
   * Génère des cartes par lot (classe, niveau)
   */
  @Post('generate-bulk')
  @UseGuards(RolesGuard)
  // ⚠️ PROMOTER + rôles de direction école (voir ci-dessus)
  @Roles('ADMIN', 'DIRECTOR', 'SECRETARY', 'PROMOTER', 'SCHOOL_OWNER', 'BOARD_PRESIDENT', 'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR', 'SCHOOL_ADMIN')
  async generateBulkIdCards(
    @GetTenant() tenant: any,
    @Body() data: {
      academicYearId: string;
      schoolLevelId: string;
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
   * Télécharge le PDF d'une carte
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
}

