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
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { CollectionPrismaService } from './collection-prisma.service';
import { CollectionCaseService } from './collection-case.service';
import { ArrearAccumulationService } from './arrear-accumulation.service';
import { FinanceTransactionService } from './finance-transaction.service';
import { PrismaService } from '../database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { SchoolLevelId } from '../common/decorators/school-level-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateCollectionReminderDto } from './dto';

@Controller('finance/collection')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CollectionPrismaController {
  constructor(
    private readonly collectionService: CollectionPrismaService,
    private readonly collectionCaseService: CollectionCaseService,
    private readonly arrearAccumulationService: ArrearAccumulationService,
    private readonly financeTransactionService: FinanceTransactionService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('detect-arrears')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
  async detectArrears(
    @TenantId() tenantId: string,
    @Body() body: { academicYearId: string },
  ) {
    // ─── Détecter sur l'année active (carriedArrears) ───
    const allArrears: any[] = [];

    // 1. Détecter sur l'année passée en paramètre (année active)
    const activeArrears = await this.collectionService.detectArrears(tenantId, body.academicYearId);
    allArrears.push(...activeArrears);

    // 2. Détecter sur TOUTES les années NON actives (années antérieures)
    //    car les arriérés peuvent être sur n'importe quelle année antérieure
    const inactiveYears = await this.prisma.academicYear.findMany({
      where: { tenantId, isActive: false },
      select: { id: true },
    });

    for (const year of inactiveYears) {
      const yearArrears = await this.collectionService.detectArrears(tenantId, year.id);
      allArrears.push(...yearArrears);
    }

    return allArrears;
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

  @Get('statistics')
  async getStatistics(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.collectionService.getCollectionStatistics(tenantId, academicYearId);
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
  //  PHASE 3-BIS : ENCAISSEMENT DIRECT D'UN ARRÉRÉ (onglet Recouvrement)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * POST /finance/collection/arrears/:id/payment
   * Enregistre qu'un élève a payé (totalement ou partiellement) son arriéré.
   *
   * Crée une FinanceTransaction PAYMENT sur le compte élève de l'année de
   * l'arriéré → le trigger DB update_balance_after_transaction RECALCULE
   * automatiquement totalPaid / balance / status du compte ; l'arriéré
   * (totalPaid, balanceDue, status) et StudentAccount.arrearsAmount sont
   * mis à jour dans la même transaction atomique.
   *
   * Body: {
   *   amount: number,                 // 1 .. balanceDue
   *   paymentMethod: 'CASH' | 'MOBILE_MONEY' | 'WIRE' | 'FEDAPAY',
   *   reference?: string,
   *   cashRegisterId?: string,       // caisse ouverte requise si fournie
   *   notes?: string,
   * }
   */
  @Post('arrears/:id/payment')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
  async recordArrearPayment(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: {
      amount: number;
      paymentMethod?: string;
      reference?: string;
      cashRegisterId?: string;
      notes?: string;
    },
  ) {
    return this.financeTransactionService.createArrearPayment(tenantId, id, {
      amount: Number(body?.amount),
      paymentMethod: body?.paymentMethod ?? 'CASH',
      reference: body?.reference,
      cashierId: user?.id,
      cashRegisterId: body?.cashRegisterId,
      notes: body?.notes,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PHASE 3-TER : MODIFICATION D'UN ARRÉRÉ (CORRECTION D'ERREUR DE SAISIE)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * PATCH /finance/collection/arrears/:id
   * Modifie un arriéré (correction d'erreur de saisie) :
   *   - totalDue  : montant total dû
   *   - totalPaid : montant déjà payé
   *   - notes     : motif de la correction
   *
   * Le restant dû (balanceDue), le statut et le niveau de gravité sont
   * recalculés automatiquement ; les miroirs d'arriérés du compte élève
   * (arrearsAmount / carriedArrears) sont resynchronisés dans la même
   * opération — le compte élève, les KPIs et le bilan des encaissements
   * reflètent immédiatement la correction.
   */
  @Patch('arrears/:id')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
  async updateArrear(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { totalDue?: number; totalPaid?: number; notes?: string; reason?: string },
  ) {
    return this.collectionService.updateArrear(tenantId, id, {
      totalDue: body?.totalDue !== undefined ? Number(body.totalDue) : undefined,
      totalPaid: body?.totalPaid !== undefined ? Number(body.totalPaid) : undefined,
      notes: typeof body?.notes === 'string' ? body.notes : undefined,
      reason: body?.reason,
    }, user?.id);
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

  /**
   * POST /finance/collection/arrears/bulk-delete
   * ⭐ Suppression MULTIPLE d'arriérés (correction d'erreurs de saisie en masse).
   *
   * Même sémantique que la suppression unitaire, mais :
   *   - une seule transaction (tout ou rien)
   *   - ajustement de compte adaptatif (voir service)
   *   - trace d'audit groupée
   *
   * Body: { ids: string[] }
   */
  @Post('arrears/bulk-delete')
  @Roles('DIRECTOR', 'ADMIN', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
  async bulkDeleteArrears(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { ids: string[] },
  ) {
    return this.collectionService.bulkDeleteArrears(tenantId, body?.ids, user?.id);
  }

  /**
   * DELETE /finance/collection/arrears/:id
   * Supprime un arriéré (pour correction d'erreurs de saisie).
   * Ajuste le StudentAccount si nécessaire.
   */
  @Delete('arrears/:id')
  @Roles('DIRECTOR', 'ADMIN', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
  async deleteArrear(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    const arrear = await this.prisma.feeArrear.findFirst({
      where: { id, tenantId },
    });
    if (!arrear) throw new NotFoundException('Arriéré non trouvé');

    const balanceDue = Number(arrear.balanceDue);

    // ⭐ Moteur unifié (nov. 2026) : plus AUCUN ajustement manuel de
    // totalDue/balance du compte (l'arriéré n'a jamais été incrusté dans les
    // totaux — périmètre compte de l'élève = frais de l'année uniquement).
    // Seul le MIROIR arrearsAmount est resynchronisé après la suppression
    // (cf. resyncArrearsMirrors ci-dessous, depuis les FeeArrear restants).

    // Ajuster previousArrears sur l'inscription si elle existe
    try {
      const enrollment = await this.prisma.studentEnrollment.findFirst({
        where: { studentId: arrear.studentId, tenantId, academicYearId: arrear.academicYearId },
      });
      if (enrollment && Number(enrollment.previousArrears) > 0) {
        await this.prisma.studentEnrollment.update({
          where: { id: enrollment.id },
          data: { previousArrears: { decrement: balanceDue } },
        });
      }
    } catch {
      // Non bloquant
    }

    // Supprimer les dépendances (reminders, promises, actions)
    await this.prisma.collectionReminder.deleteMany({ where: { feeArrearId: id } });
    await this.prisma.paymentPromise.deleteMany({ where: { feeArrearId: id } });
    await this.prisma.collectionAction.deleteMany({ where: { feeArrearId: id } });

    // Supprimer l'arriéré
    await this.prisma.feeArrear.delete({ where: { id } });

    // ⭐ Moteur unifié : miroirs d'arriérés resynchronisés depuis les FeeArrear
    //    restants (seule source de vérité).
    await this.collectionService.resyncArrearsMirrors(tenantId, [arrear.studentId]);

    return { success: true, deletedAmount: balanceDue };
  }
}

