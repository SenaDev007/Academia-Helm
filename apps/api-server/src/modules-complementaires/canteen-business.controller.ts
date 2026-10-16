/**
 * ============================================================================
 * CANTEEN BUSINESS CONTROLLER — Capital, Vente journalière, Dispatching, Bilan
 * ============================================================================
 *
 * ⭐ V1 (2026-10-15) — Modèle métier Cantine scolaire au Bénin
 *
 * Endpoints (tous préfixés par /modules-complementaires/canteen/business/) :
 *
 *   GET    /settings          — Paramètres métier (taux, cantinière, vendeur)
 *   PUT    /settings          — Mettre à jour les paramètres
 *
 *   GET    /fund              — Capital de l'année courante
 *   POST   /fund              — Définir le capital initial
 *   PUT    /fund/:id          — Modifier le capital
 *
 *   GET    /sales             — Liste des ventes journalières
 *   POST   /sales             — Enregistrer une vente journalière
 *   PUT    /sales/:id         — Modifier une vente
 *   DELETE /sales/:id         — Supprimer une vente
 *
 *   POST   /sales/:id/dispatch — Dispatching journalier (répartir la recette)
 *   GET    /sales/:id/dispatch — Récupérer le dispatching d'une vente
 *
 *   GET    /purchases         — Liste des achats
 *   POST   /purchases         — Enregistrer un achat
 *   PUT    /purchases/:id     — Modifier un achat
 *   DELETE /purchases/:id     — Supprimer un achat
 *
 *   GET    /report            — Bilan annuel (calculé en temps réel)
 *   POST   /report/close      — Clôturer l'année (fige le bilan)
 *
 * 🔒 JWT + TenantGuard
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, BadRequestException, NotFoundException,
} from '@nestjs/common';
// ⚠️ 2026-10-16 — FIX BUILD : chemins relatifs corrigés (un seul '../' depuis
//    src/modules-complementaires/ — '../../' pointait hors de src → build KO)
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../database/prisma.service';
import { randomUUID } from 'crypto';

interface AuthUser {
  id: string;
  email: string;
  tenantId: string | null;
  role?: string;
}

@Controller('modules-complementaires/canteen/business')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CanteenBusinessController {
  constructor(private readonly prisma: PrismaService) {}

  // ═════════════════════════════════════════════════════════════════
  //  SETTINGS — Paramètres métier
  // ═════════════════════════════════════════════════════════════════

  @Get('settings')
  async getSettings(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const yearId = await this.resolveAcademicYearId(tenantId, academicYearId);
    const rows = await this.prisma.$queryRawUnsafe<Array<any>>(
      `SELECT * FROM "canteen_business_settings" WHERE "tenantId" = $1 AND "academicYearId" = $2`,
      tenantId, yearId,
    );
    return rows.length > 0 ? rows[0] : null;
  }

  @Put('settings')
  async updateSettings(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const yearId = await this.resolveAcademicYearId(tenantId, academicYearId);
    const id = randomUUID();

    // Upsert : si l'enregistrement existe, on update ; sinon on insert
    const existing = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "canteen_business_settings" WHERE "tenantId" = $1 AND "academicYearId" = $2`,
      tenantId, yearId,
    );

    if (existing.length > 0) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "canteen_business_settings" SET
          "schoolRate" = $1, "sellerRate" = $2, "cantiniereRate" = $3,
          "pricePerMealDefault" = $4, "cantiniereName" = $5, "sellerName" = $6,
          "sellerType" = $7, "autoDispatch" = $8, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $9`,
        body.schoolRate ?? 0, body.sellerRate ?? 0, body.cantiniereRate ?? 0,
        body.pricePerMealDefault ?? 0, body.cantiniereName ?? null, body.sellerName ?? null,
        body.sellerType ?? 'CANTINIERE', body.autoDispatch ?? false, existing[0].id,
      );
      return { id: existing[0].id, ...body };
    }

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "canteen_business_settings"
        ("id", "tenantId", "academicYearId", "schoolRate", "sellerRate", "cantiniereRate",
         "pricePerMealDefault", "cantiniereName", "sellerName", "sellerType", "autoDispatch")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      id, tenantId, yearId,
      body.schoolRate ?? 0, body.sellerRate ?? 0, body.cantiniereRate ?? 0,
      body.pricePerMealDefault ?? 0, body.cantiniereName ?? null, body.sellerName ?? null,
      body.sellerType ?? 'CANTINIERE', body.autoDispatch ?? false,
    );
    return { id, ...body };
  }

  // ═════════════════════════════════════════════════════════════════
  //  FUND — Capital de la cantine
  // ═════════════════════════════════════════════════════════════════

  @Get('fund')
  async getFund(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const yearId = await this.resolveAcademicYearId(tenantId, academicYearId);
    const rows = await this.prisma.$queryRawUnsafe<Array<any>>(
      `SELECT * FROM "canteen_funds" WHERE "tenantId" = $1 AND "academicYearId" = $2`,
      tenantId, yearId,
    );
    return rows.length > 0 ? rows[0] : null;
  }

  @Post('fund')
  async createFund(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const yearId = await this.resolveAcademicYearId(tenantId, academicYearId);
    const id = randomUUID();

    // Vérifier s'il existe déjà un capital pour cette année
    const existing = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "canteen_funds" WHERE "tenantId" = $1 AND "academicYearId" = $2`,
      tenantId, yearId,
    );
    if (existing.length > 0) {
      throw new BadRequestException('Un capital existe déjà pour cette année scolaire');
    }

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "canteen_funds"
        ("id", "tenantId", "academicYearId", "initialCapital", "currentBalance", "fundDate", "notes", "createdBy")
       VALUES ($1, $2, $3, $4, $4, $5, $6, $7)`,
      id, tenantId, yearId,
      body.initialCapital ?? 0, body.fundDate ?? new Date().toISOString().slice(0, 10),
      body.notes ?? null, user.id,
    );
    return { id, ...body, currentBalance: body.initialCapital ?? 0 };
  }

  @Put('fund/:id')
  async updateFund(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE "canteen_funds" SET
        "initialCapital" = $1, "currentBalance" = $2, "notes" = $3,
        "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $4 AND "tenantId" = $5`,
      body.initialCapital ?? 0, body.currentBalance ?? body.initialCapital ?? 0,
      body.notes ?? null, id, tenantId,
    );
    return { id, ...body };
  }

  // ═════════════════════════════════════════════════════════════════
  //  SALES — Ventes journalières
  // ═════════════════════════════════════════════════════════════════

  @Get('sales')
  async getSales(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const yearId = await this.resolveAcademicYearId(tenantId, academicYearId);
    let query = `SELECT s.*, d.id AS "dispatchId", d."restockAmount", d."schoolAmount",
      d."sellerAmount", d."savingsAmount"
      FROM "canteen_daily_sales" s
      LEFT JOIN "canteen_daily_dispatches" d ON d."saleId" = s."id"
      WHERE s."tenantId" = $1 AND s."academicYearId" = $2`;
    const params: any[] = [tenantId, yearId];
    if (from) { query += ` AND s."saleDate" >= $3`; params.push(from); }
    if (to) { query += ` AND s."saleDate" <= $${params.length + 1}`; params.push(to); }
    query += ` ORDER BY s."saleDate" DESC`;
    return this.prisma.$queryRawUnsafe(query, ...params);
  }

  @Post('sales')
  async createSale(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const yearId = await this.resolveAcademicYearId(tenantId, academicYearId);
    const id = randomUUID();
    const totalRevenue = (body.mealsSold ?? 0) * (body.pricePerMeal ?? 0);

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "canteen_daily_sales"
        ("id", "tenantId", "academicYearId", "saleDate", "mealsSold", "pricePerMeal",
         "totalRevenue", "mealsPlanned", "mealsWasted", "sellerType", "sellerName", "notes", "createdBy")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      id, tenantId, yearId,
      body.saleDate ?? new Date().toISOString().slice(0, 10),
      body.mealsSold ?? 0, body.pricePerMeal ?? 0, totalRevenue,
      body.mealsPlanned ?? 0, body.mealsWasted ?? 0,
      body.sellerType ?? 'CANTINIERE', body.sellerName ?? null,
      body.notes ?? null, user.id,
    );

    // Auto-dispatch si activé
    const settings = await this.getSettings(tenantId, academicYearId);
    if (settings?.autoDispatch) {
      await this.autoDispatch(tenantId, yearId, id, totalRevenue, settings, user.id);
    }

    return { id, ...body, totalRevenue };
  }

  @Put('sales/:id')
  async updateSale(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const totalRevenue = (body.mealsSold ?? 0) * (body.pricePerMeal ?? 0);
    await this.prisma.$executeRawUnsafe(
      `UPDATE "canteen_daily_sales" SET
        "mealsSold" = $1, "pricePerMeal" = $2, "totalRevenue" = $3,
        "mealsPlanned" = $4, "mealsWasted" = $5, "sellerType" = $6, "sellerName" = $7,
        "notes" = $8, "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $9 AND "tenantId" = $10`,
      body.mealsSold ?? 0, body.pricePerMeal ?? 0, totalRevenue,
      body.mealsPlanned ?? 0, body.mealsWasted ?? 0,
      body.sellerType ?? 'CANTINIERE', body.sellerName ?? null,
      body.notes ?? null, id, tenantId,
    );
    return { id, ...body, totalRevenue };
  }

  @Delete('sales/:id')
  async deleteSale(@TenantId() tenantId: string, @Param('id') id: string) {
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "canteen_daily_sales" WHERE "id" = $1 AND "tenantId" = $2`,
      id, tenantId,
    );
    return { success: true };
  }

  // ═════════════════════════════════════════════════════════════════
  //  DISPATCH — Dispatching journalier
  // ═════════════════════════════════════════════════════════════════

  @Get('sales/:id/dispatch')
  async getDispatch(@TenantId() tenantId: string, @Param('id') saleId: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<any>>(
      `SELECT * FROM "canteen_daily_dispatches" WHERE "saleId" = $1 AND "tenantId" = $2`,
      saleId, tenantId,
    );
    return rows.length > 0 ? rows[0] : null;
  }

  @Post('sales/:id/dispatch')
  async createDispatch(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') saleId: string,
    @Body() body: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const yearId = await this.resolveAcademicYearId(tenantId, academicYearId);

    // Récupérer la vente
    const sales = await this.prisma.$queryRawUnsafe<Array<any>>(
      `SELECT * FROM "canteen_daily_sales" WHERE "id" = $1 AND "tenantId" = $2`,
      saleId, tenantId,
    );
    if (sales.length === 0) throw new NotFoundException('Vente introuvable');
    const sale = sales[0];
    const totalRevenue = parseFloat(sale.totalRevenue);

    // Calcul du dispatching
    const schoolAmount = body.schoolAmount ?? (totalRevenue * (body.schoolRate ?? 0) / 100);
    const sellerAmount = body.sellerAmount ?? (totalRevenue * (body.sellerRate ?? 0) / 100);
    const restockAmount = body.restockAmount ?? 0;
    const savingsAmount = totalRevenue - schoolAmount - sellerAmount - restockAmount;

    // Vérifier si un dispatch existe déjà
    const existing = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "canteen_daily_dispatches" WHERE "saleId" = $1`,
      saleId,
    );

    if (existing.length > 0) {
      // Update
      await this.prisma.$executeRawUnsafe(
        `UPDATE "canteen_daily_dispatches" SET
          "totalRevenue" = $1, "restockAmount" = $2, "schoolAmount" = $3,
          "schoolRate" = $4, "sellerAmount" = $5, "sellerRate" = $6,
          "savingsAmount" = $7, "notes" = $8, "updatedAt" = CURRENT_TIMESTAMP
         WHERE "id" = $9`,
        totalRevenue, restockAmount, schoolAmount, body.schoolRate ?? 0,
        sellerAmount, body.sellerRate ?? 0, savingsAmount,
        body.notes ?? null, existing[0].id,
      );
      return { id: existing[0].id, totalRevenue, restockAmount, schoolAmount, sellerAmount, savingsAmount };
    }

    // Insert
    const id = randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "canteen_daily_dispatches"
        ("id", "tenantId", "academicYearId", "saleId", "dispatchDate", "totalRevenue",
         "restockAmount", "schoolAmount", "schoolRate", "sellerAmount", "sellerRate",
         "savingsAmount", "notes", "createdBy")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      id, tenantId, yearId, saleId, sale.saleDate,
      totalRevenue, restockAmount, schoolAmount, body.schoolRate ?? 0,
      sellerAmount, body.sellerRate ?? 0, savingsAmount,
      body.notes ?? null, user.id,
    );

    // Mettre à jour le solde du capital
    await this.updateFundBalance(tenantId, yearId, totalRevenue, restockAmount, schoolAmount, sellerAmount);

    return { id, totalRevenue, restockAmount, schoolAmount, sellerAmount, savingsAmount };
  }

  // ═════════════════════════════════════════════════════════════════
  //  PURCHASES — Achats journaliers
  // ═════════════════════════════════════════════════════════════════

  @Get('purchases')
  async getPurchases(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const yearId = await this.resolveAcademicYearId(tenantId, academicYearId);
    let query = `SELECT * FROM "canteen_purchases" WHERE "tenantId" = $1 AND "academicYearId" = $2`;
    const params: any[] = [tenantId, yearId];
    if (from) { query += ` AND "purchaseDate" >= $3`; params.push(from); }
    if (to) { query += ` AND "purchaseDate" <= $${params.length + 1}`; params.push(to); }
    query += ` ORDER BY "purchaseDate" DESC`;
    return this.prisma.$queryRawUnsafe(query, ...params);
  }

  @Post('purchases')
  async createPurchase(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const yearId = await this.resolveAcademicYearId(tenantId, academicYearId);
    const id = randomUUID();

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "canteen_purchases"
        ("id", "tenantId", "academicYearId", "purchaseDate", "items", "totalAmount",
         "supplierId", "supplierName", "paymentMode", "purchasedBy", "receiptImageUrl", "notes", "createdBy")
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13)`,
      id, tenantId, yearId,
      body.purchaseDate ?? new Date().toISOString().slice(0, 10),
      JSON.stringify(body.items ?? []),
      body.totalAmount ?? 0,
      body.supplierId ?? null, body.supplierName ?? null,
      body.paymentMode ?? 'CASH', body.purchasedBy ?? 'CANTINIERE',
      body.receiptImageUrl ?? null, body.notes ?? null, user.id,
    );

    // Déduire du capital
    await this.deductFromFund(tenantId, yearId, body.totalAmount ?? 0);

    return { id, ...body };
  }

  @Put('purchases/:id')
  async updatePurchase(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE "canteen_purchases" SET
        "items" = $1::jsonb, "totalAmount" = $2, "supplierName" = $3,
        "paymentMode" = $4, "notes" = $5, "receiptImageUrl" = $6,
        "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $7 AND "tenantId" = $8`,
      JSON.stringify(body.items ?? []), body.totalAmount ?? 0,
      body.supplierName ?? null, body.paymentMode ?? 'CASH',
      body.notes ?? null, body.receiptImageUrl ?? null,
      id, tenantId,
    );
    return { id, ...body };
  }

  @Delete('purchases/:id')
  async deletePurchase(@TenantId() tenantId: string, @Param('id') id: string) {
    // Récupérer le montant pour rembourser le capital
    const rows = await this.prisma.$queryRawUnsafe<Array<{ totalAmount: string; academicYearId: string }>>(
      `SELECT "totalAmount", "academicYearId" FROM "canteen_purchases" WHERE "id" = $1 AND "tenantId" = $2`,
      id, tenantId,
    );
    if (rows.length > 0) {
      await this.refundFund(tenantId, rows[0].academicYearId, parseFloat(rows[0].totalAmount));
    }
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "canteen_purchases" WHERE "id" = $1 AND "tenantId" = $2`,
      id, tenantId,
    );
    return { success: true };
  }

  // ═════════════════════════════════════════════════════════════════
  //  REPORT — Bilan annuel
  // ═════════════════════════════════════════════════════════════════

  @Get('report')
  async getReport(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const yearId = await this.resolveAcademicYearId(tenantId, academicYearId);

    // Capital
    const fundRows = await this.prisma.$queryRawUnsafe<Array<any>>(
      `SELECT * FROM "canteen_funds" WHERE "tenantId" = $1 AND "academicYearId" = $2`,
      tenantId, yearId,
    );
    const fund = fundRows.length > 0 ? fundRows[0] : null;
    const initialCapital = fund ? parseFloat(fund.initialCapital) : 0;
    const currentBalance = fund ? parseFloat(fund.currentBalance) : 0;

    // Ventes
    const salesRows = await this.prisma.$queryRawUnsafe<Array<any>>(
      `SELECT
        COALESCE(SUM("totalRevenue"), 0) AS "totalRevenue",
        COALESCE(SUM("mealsSold"), 0) AS "mealsSoldTotal",
        COALESCE(SUM("mealsWasted"), 0) AS "mealsWastedTotal"
       FROM "canteen_daily_sales" WHERE "tenantId" = $1 AND "academicYearId" = $2`,
      tenantId, yearId,
    );
    const sales = salesRows[0] || {};
    const totalRevenue = parseFloat(sales.totalRevenue || 0);
    const mealsSoldTotal = parseInt(sales.mealsSoldTotal || 0);
    const mealsWastedTotal = parseInt(sales.mealsWastedTotal || 0);

    // Dispatching
    const dispatchRows = await this.prisma.$queryRawUnsafe<Array<any>>(
      `SELECT
        COALESCE(SUM("schoolAmount"), 0) AS "totalSchoolAmount",
        COALESCE(SUM("sellerAmount"), 0) AS "totalSellerAmount",
        COALESCE(SUM("savingsAmount"), 0) AS "totalSavings",
        COALESCE(SUM("restockAmount"), 0) AS "totalRestock"
       FROM "canteen_daily_dispatches" WHERE "tenantId" = $1 AND "academicYearId" = $2`,
      tenantId, yearId,
    );
    const dispatch = dispatchRows[0] || {};
    const totalSchoolAmount = parseFloat(dispatch.totalSchoolAmount || 0);
    const totalSellerAmount = parseFloat(dispatch.totalSellerAmount || 0);
    const totalSavings = parseFloat(dispatch.totalSavings || 0);
    const totalRestock = parseFloat(dispatch.totalRestock || 0);

    // Achats
    const purchaseRows = await this.prisma.$queryRawUnsafe<Array<any>>(
      `SELECT COALESCE(SUM("totalAmount"), 0) AS "totalPurchases"
       FROM "canteen_purchases" WHERE "tenantId" = $1 AND "academicYearId" = $2`,
      tenantId, yearId,
    );
    const totalPurchases = parseFloat(purchaseRows[0]?.totalPurchases || 0);

    // Settings
    const settings = await this.getSettings(tenantId, academicYearId);
    const cantiniereRate = settings?.cantiniereRate ? parseFloat(settings.cantiniereRate) : 0;

    // Calculs finaux
    const capitalRecovered = currentBalance;
    const totalProfit = totalSavings;
    const cantiniereAmount = (totalProfit * cantiniereRate) / 100;

    // Vérifier si un rapport clôturé existe
    const reportRows = await this.prisma.$queryRawUnsafe<Array<any>>(
      `SELECT * FROM "canteen_annual_reports" WHERE "tenantId" = $1 AND "academicYearId" = $2`,
      tenantId, yearId,
    );
    const closedReport = reportRows.length > 0 ? reportRows[0] : null;

    return {
      academicYearId: yearId,
      initialCapital,
      currentBalance,
      totalRevenue,
      totalPurchases,
      totalSchoolAmount,
      totalSellerAmount,
      totalSavings,
      totalRestock,
      capitalRecovered,
      totalProfit,
      cantiniereRate,
      cantiniereAmount,
      mealsSoldTotal,
      mealsWastedTotal,
      status: closedReport?.status || 'OPEN',
      closedAt: closedReport?.closedAt || null,
      isClosed: closedReport?.status === 'CLOSED',
    };
  }

  @Post('report/close')
  async closeReport(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const yearId = await this.resolveAcademicYearId(tenantId, academicYearId);
    const report = await this.getReport(tenantId, academicYearId);

    // Vérifier si déjà clôturé
    const existing = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "canteen_annual_reports" WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "status" = 'CLOSED'`,
      tenantId, yearId,
    );
    if (existing.length > 0) {
      throw new BadRequestException('Le bilan annuel a déjà été clôturé');
    }

    const id = randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "canteen_annual_reports"
        ("id", "tenantId", "academicYearId", "initialCapital", "totalRevenue", "totalPurchases",
         "totalSchoolAmount", "totalSellerAmount", "totalSavings", "capitalRecovered", "totalProfit",
         "cantiniereRate", "cantiniereAmount", "mealsSoldTotal", "mealsWastedTotal", "status", "closedAt", "createdBy")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'CLOSED', CURRENT_TIMESTAMP, $16)`,
      id, tenantId, yearId,
      report.initialCapital, report.totalRevenue, report.totalPurchases,
      report.totalSchoolAmount, report.totalSellerAmount, report.totalSavings,
      report.capitalRecovered, report.totalProfit,
      report.cantiniereRate, report.cantiniereAmount,
      report.mealsSoldTotal, report.mealsWastedTotal, user.id,
    );

    return { id, ...report, status: 'CLOSED', closedAt: new Date().toISOString() };
  }

  // ═════════════════════════════════════════════════════════════════
  //  HELPERS
  // ═════════════════════════════════════════════════════════════════

  private async resolveAcademicYearId(tenantId: string, academicYearId?: string): Promise<string> {
    if (academicYearId) return academicYearId;
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "academic_years" WHERE "tenantId" = $1 AND "isActive" = true ORDER BY "startDate" DESC LIMIT 1`,
      tenantId,
    );
    if (rows.length === 0) throw new BadRequestException('Aucune année scolaire active');
    return rows[0].id;
  }

  private async autoDispatch(
    tenantId: string, yearId: string, saleId: string,
    totalRevenue: number, settings: any, userId: string,
  ) {
    const schoolRate = parseFloat(settings?.schoolRate || 0);
    const sellerRate = parseFloat(settings?.sellerRate || 0);
    const schoolAmount = (totalRevenue * schoolRate) / 100;
    const sellerAmount = (totalRevenue * sellerRate) / 100;
    const restockAmount = 0; // Pas de réappro auto
    const savingsAmount = totalRevenue - schoolAmount - sellerAmount - restockAmount;

    const dispatchId = randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "canteen_daily_dispatches"
        ("id", "tenantId", "academicYearId", "saleId", "dispatchDate", "totalRevenue",
         "restockAmount", "schoolAmount", "schoolRate", "sellerAmount", "sellerRate",
         "savingsAmount", "createdBy")
       VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6, $7, $8, $9, $10, $11, $12)`,
      dispatchId, tenantId, yearId, saleId,
      totalRevenue, restockAmount, schoolAmount, schoolRate,
      sellerAmount, sellerRate, savingsAmount, userId,
    );
  }

  private async updateFundBalance(
    tenantId: string, yearId: string,
    revenue: number, restock: number, schoolAmount: number, sellerAmount: number,
  ) {
    // Le solde du capital augmente avec la recette et diminue avec les sorties
    const net = revenue - restock - schoolAmount - sellerAmount;
    await this.prisma.$executeRawUnsafe(
      `UPDATE "canteen_funds" SET
        "currentBalance" = "currentBalance" + $1,
        "updatedAt" = CURRENT_TIMESTAMP
       WHERE "tenantId" = $2 AND "academicYearId" = $3`,
      net, tenantId, yearId,
    );
  }

  private async deductFromFund(tenantId: string, yearId: string, amount: number) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE "canteen_funds" SET
        "currentBalance" = "currentBalance" - $1,
        "updatedAt" = CURRENT_TIMESTAMP
       WHERE "tenantId" = $2 AND "academicYearId" = $3`,
      amount, tenantId, yearId,
    );
  }

  private async refundFund(tenantId: string, yearId: string, amount: number) {
    await this.prisma.$executeRawUnsafe(
      `UPDATE "canteen_funds" SET
        "currentBalance" = "currentBalance" + $1,
        "updatedAt" = CURRENT_TIMESTAMP
       WHERE "tenantId" = $2 AND "academicYearId" = $3`,
      amount, tenantId, yearId,
    );
  }
}
