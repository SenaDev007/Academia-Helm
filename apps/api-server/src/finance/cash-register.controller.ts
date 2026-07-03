/**
 * ============================================================================
 * CASH REGISTER CONTROLLER - Multi-caisses intelligentes
 * ============================================================================
 *
 * Endpoints REST pour la gestion des caisses d'une école :
 *   POST   /finance/cash-registers              — Créer une caisse
 *   GET    /finance/cash-registers              — Lister les caisses (filtres)
 *   GET    /finance/cash-registers/:id          — Détail d'une caisse
 *   PATCH  /finance/cash-registers/:id          — Mettre à jour
 *   DELETE /finance/cash-registers/:id          — Archiver (soft delete)
 *   POST   /finance/cash-registers/:id/open     — Ouvrir la caisse
 *   POST   /finance/cash-registers/:id/close    — Fermer la caisse
 *   GET    /finance/cash-registers/:id/stats    — Statistiques de la caisse
 *
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
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CashRegisterService,
  CreateCashRegisterDto,
  UpdateCashRegisterDto,
  OpenCashRegisterDto,
  CloseCashRegisterDto,
} from './cash-register.service';

@Controller('finance/cash-registers')
@UseGuards(JwtAuthGuard)
export class CashRegisterController {
  constructor(private readonly service: CashRegisterService) {}

  /**
   * POST /finance/cash-registers
   * Crée une nouvelle caisse.
   */
  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateCashRegisterDto,
  ) {
    if (!dto.code || !dto.name) {
      throw new BadRequestException('code et name sont requis');
    }
    return this.service.create(tenantId, dto, user?.id);
  }

  /**
   * GET /finance/cash-registers?isActive=true&isOpen=true&responsibleUserId=...
   * Liste les caisses d'un tenant.
   */
  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('isActive') isActive?: string,
    @Query('isOpen') isOpen?: string,
    @Query('responsibleUserId') responsibleUserId?: string,
  ) {
    return this.service.findAll(tenantId, {
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      isOpen: isOpen === 'true' ? true : isOpen === 'false' ? false : undefined,
      responsibleUserId,
    });
  }

  /**
   * GET /finance/cash-registers/:id
   * Détail d'une caisse (inclut les 50 dernières transactions).
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.findOne(id, tenantId);
  }

  /**
   * PATCH /finance/cash-registers/:id
   * Met à jour une caisse (nom, description, responsable, emplacement, isActive).
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() dto: UpdateCashRegisterDto,
  ) {
    return this.service.update(id, tenantId, dto);
  }

  /**
   * DELETE /finance/cash-registers/:id
   * Archive une caisse (soft delete — isActive = false).
   */
  @Delete(':id')
  async archive(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.archive(id, tenantId);
  }

  /**
   * POST /finance/cash-registers/:id/open
   * Ouvre la caisse pour une session.
   * Body: { openingBalance?, note? }
   */
  @Post(':id/open')
  async open(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: { openingBalance?: number; note?: string },
  ) {
    if (!user?.id) throw new BadRequestException('User ID required');
    return this.service.open(id, tenantId, {
      userId: user.id,
      openingBalance: dto.openingBalance,
      note: dto.note,
    });
  }

  /**
   * POST /finance/cash-registers/:id/close
   * Ferme la caisse avec rapprochement physique.
   * Body: { countedBalance?, note? }
   */
  @Post(':id/close')
  async close(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: { countedBalance?: number; note?: string },
  ) {
    if (!user?.id) throw new BadRequestException('User ID required');
    return this.service.close(id, tenantId, {
      userId: user.id,
      countedBalance: dto.countedBalance,
      note: dto.note,
    });
  }

  /**
   * GET /finance/cash-registers/:id/stats?dateFrom=&dateTo=
   * Statistiques d'une caisse pour une période.
   */
  @Get(':id/stats')
  async getStats(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.getStats(
      id,
      tenantId,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
    );
  }

  /**
   * POST /finance/cash-registers/transfer
   * Transfert de fonds entre deux caisses.
   * Body: { fromId, toId, amount, note? }
   */
  @Post('transfer')
  async transfer(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { fromId: string; toId: string; amount: number; note?: string },
  ) {
    return this.service.transfer(body.fromId, body.toId, tenantId, {
      amount: Number(body.amount),
      note: body.note,
    }, user?.id);
  }
}
