/**
 * ============================================================================
 * COLLECTION PRISMA CONTROLLER - MODULE 4 (RECOUVREMENT)
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CollectionPrismaService } from './collection-prisma.service';
import { CollectionCaseService } from './collection-case.service';
import { ArrearAccumulationService } from './arrear-accumulation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { SchoolLevelId } from '../common/decorators/school-level-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateCollectionReminderDto, CreatePaymentPromiseDto, CreateCollectionActionDto } from './dto';

@Controller('finance/collection')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CollectionPrismaController {
  constructor(
    private readonly collectionService: CollectionPrismaService,
    private readonly collectionCaseService: CollectionCaseService,
    private readonly arrearAccumulationService: ArrearAccumulationService,
  ) {}

  @Post('detect-arrears')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
  async detectArrears(
    @TenantId() tenantId: string,
    @Body() body: { academicYearId: string },
  ) {
    return this.collectionService.detectArrears(tenantId, body.academicYearId);
  }

  @Get('arrears')
  async findAllArrears(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('arrearsLevel') arrearsLevel?: string,
    @Query('studentId') studentId?: string,
    @Query('search') search?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    return this.collectionService.findAllArrears(tenantId, {
      academicYearId,
      schoolLevelId: schoolLevelId && schoolLevelId !== 'ALL' ? schoolLevelId : undefined,
      arrearsLevel,
      studentId,
      search,
    });
  }

  @Post('reminders')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
  async createReminder(
    @TenantId() tenantId: string,
    @Body() createDto: CreateCollectionReminderDto,
  ) {
    // tenantId available for tenant-scoped validation
    return this.collectionService.createReminder({
      feeArrearId: createDto.arrearId,
      channel: createDto.channel,
      reminderStage: createDto.level,
      message: createDto.message,
    });
  }

  @Get('reminders')
  async findAllReminders(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('feeArrearId') feeArrearId?: string,
    @Query('status') status?: string,
  ) {
    return this.collectionService.findAllCollectionReminders(tenantId, {
      academicYearId,
      feeArrearId,
      status,
    });
  }

  @Post('promises')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
  async createPaymentPromise(
    @CurrentUser() user: any,
    @Body() createDto: CreatePaymentPromiseDto,
  ) {
    return this.collectionService.createPaymentPromise({
      feeArrearId: createDto.arrearId,
      promisedAmount: createDto.promisedAmount,
      promisedDate: new Date(createDto.promiseDate),
      notes: createDto.notes,
      createdBy: user?.id,
    });
  }

  @Get('promises')
  async findAllPromises(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('status') status?: string,
    @Query('feeArrearId') feeArrearId?: string,
  ) {
    return this.collectionService.findAllPaymentPromises(tenantId, {
      academicYearId,
      status,
      feeArrearId,
    });
  }

  @Patch('promises/:id/status')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
  async updatePromiseStatus(
    @Param('id') promiseId: string,
    @Body() body: { status: 'HONORED' | 'BROKEN' | 'PENDING' },
  ) {
    return this.collectionService.updatePaymentPromiseStatus(promiseId, body.status);
  }

  @Post('actions')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
  async createCollectionAction(
    @CurrentUser() user: any,
    @Body() createDto: CreateCollectionActionDto,
  ) {
    return this.collectionService.createCollectionAction({
      feeArrearId: createDto.arrearId,
      actionType: createDto.actionType,
      notes: createDto.description,
      performedBy: user?.id,
    });
  }

  @Get('actions')
  async findAllActions(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('actionType') actionType?: string,
    @Query('feeArrearId') feeArrearId?: string,
  ) {
    return this.collectionService.findAllCollectionActions(tenantId, {
      academicYearId,
      actionType,
      feeArrearId,
    });
  }

  @Get('statistics')
  async getStatistics(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.collectionService.getCollectionStatistics(tenantId, academicYearId);
  }

  @Get('cases')
  async findAllCases(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('status') status?: string,
    @Query('minOutstanding') minOutstanding?: string,
  ) {
    return this.collectionCaseService.findAllCollectionCases(tenantId, {
      academicYearId,
      status,
      minOutstanding: minOutstanding ? Number(minOutstanding) : undefined,
    });
  }

  @Get('cases/:studentId/:academicYearId')
  async getCase(
    @TenantId() tenantId: string,
    @Param('studentId') studentId: string,
    @Param('academicYearId') academicYearId: string,
  ) {
    return this.collectionCaseService.getCollectionCase(tenantId, studentId, academicYearId);
  }

  @Post('cases/:studentId/:academicYearId/sync')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
  async syncCase(
    @TenantId() tenantId: string,
    @Param('studentId') studentId: string,
    @Param('academicYearId') academicYearId: string,
  ) {
    return this.collectionCaseService.upsertCollectionCase(tenantId, studentId, academicYearId);
  }

  @Post('cases/:studentId/:academicYearId/trigger-reminders')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
  async triggerReminders(
    @TenantId() tenantId: string,
    @Param('studentId') studentId: string,
    @Param('academicYearId') academicYearId: string,
  ) {
    return this.collectionCaseService.triggerAutomaticReminders(tenantId, studentId, academicYearId);
  }

  /**
   * Workflow d'escalade automatique : parcourt tous les cas de l'année et
   * déclenche les relances selon le niveau d'escalade calculé.
   *
   * Niveaux :
   *   1 → Rappel interne (notification système)
   *   2 → SMS + WhatsApp (rappel ferme)
   *   3 → Notification direction (critique)
   *   4 → Blocage administratif
   */
  @Post('run-escalation')
  @Roles('DIRECTOR', 'ADMIN', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
  async runEscalation(
    @TenantId() tenantId: string,
    @Body() body: { academicYearId: string },
  ) {
    // Récupérer tous les cas avec solde impayé
    const cases = await this.collectionCaseService.findAllCollectionCases(tenantId, {
      academicYearId: body.academicYearId,
    });

    const results: any[] = [];
    for (const c of cases) {
      if (c.status === 'ON_TIME') continue;
      try {
        const r = await this.collectionCaseService.triggerAutomaticReminders(
          tenantId,
          c.studentId,
          body.academicYearId,
        );
        results.push({ studentId: c.studentId, ...r });
      } catch (err: any) {
        results.push({ studentId: c.studentId, error: err.message });
      }
    }

    return {
      totalCases: cases.length,
      processed: results.length,
      triggered: results.filter((r) => r.triggered).length,
      results,
    };
  }

  /**
   * POST /finance/collection/arrears/manual
   *
   * Saisie manuelle d'un arriéré pour un élève (onboarding nouveaux clients).
   * Permet aux écoles qui débutent avec Academia Helm en cours d'année de
   * saisir les arriérés existants (sur papier) dans le système.
   *
   * Crée ou met à jour :
   *   - StudentEnrollment.previousArrears (pour traçabilité)
   *   - StudentAccount.arrearsAmount + ajuste totalDue et balance
   *   - FeeArrear (pour que l'arriéré apparaisse dans le tableau de recouvrement)
   *
   * Body: {
   *   studentId: string,
   *   academicYearId: string,
   *   amount: number,          // montant de l'arriéré en FCFA
   *   reason?: string,         // motif (ex: "Arriéré année 2024-2025")
   * }
   */
  @Post('arrears/manual')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
  async createManualArrear(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { studentId: string; academicYearId?: string; academicYearName?: string; amount: number; reason?: string },
  ) {
    return this.collectionService.createManualArrear(tenantId, body, user?.id);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PHASE 2 : REPORT D'ARRIÉRÉS AU PASSAGE D'ANNÉE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * POST /finance/collection/arrears/transfer-year
   * Reporte les arriérés d'une année clôturée vers la nouvelle année.
   * Body: { fromAcademicYearId, toAcademicYearId }
   */
  @Post('arrears/transfer-year')
  @Roles('DIRECTOR', 'ADMIN', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
  async transferArrearsToNewYear(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { fromAcademicYearId: string; toAcademicYearId: string },
  ) {
    return this.arrearAccumulationService.transferArrearsToNewYear(
      tenantId,
      body.fromAcademicYearId,
      body.toAcademicYearId,
      user?.id,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PHASE 3 : ABANDON DE CRÉANCE (WRITE-OFF)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * POST /finance/collection/arrears/:id/write-off
   * Marque un arriéré comme "abandonné" (write-off).
   * Body: { reason }
   */
  @Post('arrears/:id/write-off')
  @Roles('DIRECTOR', 'ADMIN', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
  async writeOffArrear(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.arrearAccumulationService.writeOffArrear(tenantId, id, body.reason, user?.id);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PHASE 5 : RAPPORT — RÉCAPITULATIF DES ARRÉRÉS PAR ANNÉE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * GET /finance/collection/arrears/summary-by-year
   * Récupère un récapitulatif des arriérés par année scolaire.
   */
  @Get('arrears/summary-by-year')
  async getArrearsSummaryByYear(@TenantId() tenantId: string) {
    return this.arrearAccumulationService.getArrearsSummaryByYear(tenantId);
  }
}

