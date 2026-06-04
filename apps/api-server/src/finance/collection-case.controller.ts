/**
 * ============================================================================
 * COLLECTION CASE CONTROLLER - RECOUVREMENT
 * ============================================================================
 * 
 * Controller pour gérer les dossiers de recouvrement
 * 
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { CollectionCaseService } from './collection-case.service';

@Controller('collection')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CollectionCaseController {
  constructor(private readonly collectionService: CollectionCaseService) {}

  /**
   * GET /api/collection/cases
   * Récupère tous les dossiers de recouvrement
   */
  @Get('cases')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')
  async findAllCollectionCases(
    @Query() query: {
      academicYearId?: string;
      status?: string;
      minOutstanding?: string;
    },
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    return this.collectionService.findAllCollectionCases(tenantId, {
      academicYearId: query.academicYearId,
      status: query.status,
      minOutstanding: query.minOutstanding ? parseFloat(query.minOutstanding) : undefined,
    });
  }

  /**
   * GET /api/collection/cases/:studentId/:academicYearId
   * Récupère un dossier de recouvrement pour un élève
   */
  @Get('cases/:studentId/:academicYearId')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'TEACHER', 'PARENT', 'STUDENT')
  async getCollectionCase(
    @Param('studentId') studentId: string,
    @Param('academicYearId') academicYearId: string,
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    return this.collectionService.getCollectionCase(tenantId, studentId, academicYearId);
  }

  /**
   * POST /api/collection/cases/:studentId/:academicYearId/sync
   * Synchronise (crée ou met à jour) un dossier de recouvrement
   */
  @Post('cases/:studentId/:academicYearId/sync')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')
  async syncCollectionCase(
    @Param('studentId') studentId: string,
    @Param('academicYearId') academicYearId: string,
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    return this.collectionService.upsertCollectionCase(tenantId, studentId, academicYearId);
  }

  /**
   * POST /api/collection/cases/:studentId/:academicYearId/trigger-reminders
   * Déclenche les relances automatiques
   */
  @Post('cases/:studentId/:academicYearId/trigger-reminders')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')
  async triggerReminders(
    @Param('studentId') studentId: string,
    @Param('academicYearId') academicYearId: string,
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    return this.collectionService.triggerAutomaticReminders(
      tenantId,
      studentId,
      academicYearId,
    );
  }
}

