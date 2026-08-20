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
  UseGuards, HttpCode, HttpStatus, BadRequestException, NotFoundException,
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

  /// Met à jour les informations de retour pour UNE attribution.
  ///    L'enseignant appelle ça au fur et à mesure qu'il coche les items.
  @Patch(':id/return')
  @HttpCode(HttpStatus.OK)
  async updateReturnInfo(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: {
      returnQuantity?: number;
      returnCondition?: string; // NEW | GOOD | USED | DAMAGED | LOST
      returnNotes?: string;
    },
  ) {
    return this.service.updateReturnInfo(tenantId, id, body);
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
}
