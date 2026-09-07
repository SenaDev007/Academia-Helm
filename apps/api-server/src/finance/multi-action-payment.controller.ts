/**
 * ============================================================================
 * MULTI-ACTION PAYMENT CONTROLLER
 * ============================================================================
 *
 * Endpoint : POST /finance/transactions/multi-action
 *
 * Permet d'encaisser en une seule opération :
 *   - Les frais scolaires (FinanceTransaction)
 *   - Des articles boutique (ShopSale)
 *
 * Body attendu :
 * {
 *   "academicYearId": "uuid",
 *   "studentAccountId": "uuid",
 *   "feeAmount": 50000,           // Montant alloué aux frais (peut être 0)
 *   "shopItems": [                // Articles boutique (peut être vide)
 *     { "productId": "uuid", "quantity": 2, "unitPrice": 5000 }
 *   ],
 *   "paymentMethod": "CASH",
 *   "reference": "FEDAPAY-REF-123",  // Optionnel
 *   "cashRegisterId": "uuid",        // Requis pour CASH
 *   "customerName": "M. Dupont",     // Optionnel
 *   "notes": "Paiement combiné"      // Optionnel
 * }
 *
 * Réponse :
 * {
 *   "transaction": { ... FinanceTransaction ... },
 *   "shopSale": { ... ShopSale avec items ... } | null,
 *   "totalAmount": 60000,
 *   "feeAmount": 50000,
 *   "shopAmount": 10000
 * }
 * ============================================================================
 */

import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  Get,
  Query,
  Param,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MultiActionPaymentService } from './multi-action-payment.service';

@Controller('finance/transactions')
@UseGuards(JwtAuthGuard)
export class MultiActionPaymentController {
  private readonly logger = new Logger(MultiActionPaymentController.name);

  constructor(private readonly multiActionService: MultiActionPaymentService) {}

  /**
   * POST /finance/transactions/multi-action
   * Encaisse frais + articles boutique en une seule opération.
   */
  @Post('multi-action')
  async createMultiAction(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: any,
  ) {
    this.logger.log(
      `Multi-action payment request from user ${user?.id}: feeAmount=${body?.feeAmount}, ` +
      `shopItems=${body?.shopItems?.length || 0}, paymentMethod=${body?.paymentMethod}`,
    );

    // Validation minimale
    if (!body?.academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    if (!body?.studentAccountId) {
      throw new BadRequestException('studentAccountId est requis');
    }
    if (body?.paymentMethod === 'CASH' && !body?.cashRegisterId) {
      throw new BadRequestException('cashRegisterId est requis pour les paiements en espèces');
    }

    const result = await this.multiActionService.createMultiAction(tenantId, {
      academicYearId: body.academicYearId,
      studentAccountId: body.studentAccountId,
      feeAmount: Number(body.feeAmount || 0),
      shopItems: Array.isArray(body.shopItems) ? body.shopItems : [],
      paymentMethod: body.paymentMethod || 'CASH',
      reference: body.reference,
      cashierId: user?.id ?? '',
      deviceId: body.deviceId,
      cashRegisterId: body.cashRegisterId,
      customerName: body.customerName,
      notes: body.notes,
      // ⭐ RÉPARTITION MANUELLE (flexibilité sept. 2026) — imputations explicites
      manualAllocations: Array.isArray(body.manualAllocations)
        ? body.manualAllocations.map((m: any) => ({
          accountBreakdownId: String(m?.accountBreakdownId ?? ''),
          amount: Number(m?.amount ?? 0),
        }))
        : undefined,
      // ⭐ FRAIS GÉNÉRAUX À LA CARTE (sept. 2026) — sélection catalogue
      generalFeeAddOns: Array.isArray(body.generalFeeAddOns)
        ? body.generalFeeAddOns.map((g: any) => ({
          feeStructureId: String(g?.feeStructureId ?? ''),
          amount: Number(g?.amount ?? 0),
        }))
        : undefined,
    });

    return result;
  }

  /**
   * GET /finance/transactions/shop-sales
   * Liste les ventes boutique pour l'année académique (utilisé par l'onglet
   * Encaissement du module Finance pour afficher les ventes boutique).
   */
  @Get('shop-sales')
  async findShopSales(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('studentId') studentId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!academicYearId) {
      throw new BadRequestException('academicYearId est requis');
    }
    return this.multiActionService.findAllShopSalesForFinance(tenantId, academicYearId, {
      studentId: studentId || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  /**
   * GET /finance/transactions/:id/linked-shop-sale
   * Récupère la ShopSale liée à une FinanceTransaction (multi-action).
   */
  @Get(':id/linked-shop-sale')
  async findLinkedShopSale(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    if (!id) {
      throw new BadRequestException('id est requis');
    }
    return this.multiActionService.findShopSaleByTransactionId(id);
  }
}
