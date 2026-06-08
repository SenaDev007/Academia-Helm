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
  @Roles('ADMIN', 'DIRECTOR', 'SECRETARY')
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
  @Roles('ADMIN', 'DIRECTOR')
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
  @Roles('ADMIN', 'DIRECTOR')
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
  @Roles('ADMIN', 'DIRECTOR')
  async getIdCardStats(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.idCardService.getIdCardStats(tenant.id, academicYearId);
  }
}

