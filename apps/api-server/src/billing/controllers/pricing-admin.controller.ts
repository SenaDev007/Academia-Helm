/**
 * ============================================================================
 * PRICING ADMIN CONTROLLER - GESTION PRICING PAR SUPER ADMIN
 * ============================================================================
 * 
 * Controller pour gérer le pricing depuis le panel super admin
 * 
 * ⚠️ CRITIQUE : Accessible uniquement à PLATFORM_OWNER
 * 
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { PricingService } from '../services/pricing.service';

@Controller('admin/pricing')
@UseGuards(JwtAuthGuard)
export class PricingAdminController {
  private readonly logger = new Logger(PricingAdminController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
  ) {}

  /**
   * Vérifie que l'utilisateur est PLATFORM_OWNER
   */
  private checkPlatformOwner(req: any) {
    const user = req.user;
    if (user?.role !== 'PLATFORM_OWNER') {
      throw new BadRequestException('Only PLATFORM_OWNER can manage pricing');
    }
  }

  /**
   * Récupère la configuration pricing active
   * 
   * GET /admin/pricing/config
   */
  @Get('config')
  async getActiveConfig(@Req() req: any) {
    this.checkPlatformOwner(req);
    return this.pricingService.getActiveConfig();
  }

  /**
   * Récupère toutes les versions de configuration (pour audit)
   * 
   * GET /admin/pricing/configs
   */
  @Get('configs')
  async getAllConfigs(@Req() req: any) {
    this.checkPlatformOwner(req);
    return this.prisma.pricingConfig.findMany({
      orderBy: { version: 'desc' },
    });
  }

  /**
   * Crée une nouvelle version de configuration
   * 
   * POST /admin/pricing/config
   * 
   * ⚠️ CRITIQUE : Versionning - ne modifie jamais la config active
   */
  @Post('config')
  async createConfig(@Req() req: any, @Body() data: any) {
    this.checkPlatformOwner(req);

    // Récupérer la dernière version
    const lastConfig = await this.prisma.pricingConfig.findFirst({
      orderBy: { version: 'desc' },
    });

    const newVersion = lastConfig ? lastConfig.version + 1 : 1;

    // Désactiver toutes les configs précédentes
    await this.prisma.pricingConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Créer la nouvelle version
    const newConfig = await this.prisma.pricingConfig.create({
      data: {
        initialSubscriptionFee: data.initialSubscriptionFee || 100000,
        monthlyBasePrice: data.monthlyBasePrice || 15000,
        yearlyBasePrice: data.yearlyBasePrice || 150000,
        yearlyDiscountPercent: data.yearlyDiscountPercent || 17,
        bilingualMonthlyAddon: data.bilingualMonthlyAddon || 5000,
        bilingualYearlyAddon: data.bilingualYearlyAddon || 50000,
        schoolAdditionalPrice: data.schoolAdditionalPrice || 10000,
        trialDays: data.trialDays || 30,
        graceDays: data.graceDays || 7,
        reminderDays: data.reminderDays || [7, 3, 1],
        currency: data.currency || 'XOF',
        isActive: true,
        version: newVersion,
        createdBy: req.user.id,
        metadata: data.metadata,
      },
    });

    // Invalider le cache
    (this.pricingService as any).activeConfigCache = null;

    this.logger.log(`✅ New pricing config created: version ${newVersion} by ${req.user.id}`);

    return newConfig;
  }

  /**
   * Récupère tous les group tiers
   * 
   * GET /admin/pricing/group-tiers
   */
  @Get('group-tiers')
  async getGroupTiers(@Req() req: any) {
    this.checkPlatformOwner(req);
    return this.prisma.pricingGroupTier.findMany({
      orderBy: { schoolsCount: 'asc' },
    });
  }

  /**
   * Crée ou met à jour un group tier
   * 
   * POST /admin/pricing/group-tiers
   */
  @Post('group-tiers')
  async upsertGroupTier(@Req() req: any, @Body() data: any) {
    this.checkPlatformOwner(req);

    if (!data.schoolsCount || !data.monthlyPrice || !data.yearlyPrice) {
      throw new BadRequestException('schoolsCount, monthlyPrice, and yearlyPrice are required');
    }

    const tier = await this.prisma.pricingGroupTier.upsert({
      where: { schoolsCount: data.schoolsCount },
      create: {
        schoolsCount: data.schoolsCount,
        monthlyPrice: data.monthlyPrice,
        yearlyPrice: data.yearlyPrice,
        isActive: data.isActive !== false,
        createdBy: req.user.id,
        metadata: data.metadata,
      },
      update: {
        monthlyPrice: data.monthlyPrice,
        yearlyPrice: data.yearlyPrice,
        isActive: data.isActive !== false,
        metadata: data.metadata,
      },
    });

    this.logger.log(`✅ Group tier ${tier.schoolsCount} schools updated by ${req.user.id}`);

    return tier;
  }

  /**
   * Récupère tous les overrides
   * 
   * GET /admin/pricing/overrides
   */
  @Get('overrides')
  async getOverrides(@Req() req: any) {
    this.checkPlatformOwner(req);
    return this.prisma.pricingOverride.findMany({
      include: { tenant: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Crée un override (promo code ou tenant spécifique)
   * 
   * POST /admin/pricing/overrides
   */
  @Post('overrides')
  async createOverride(@Req() req: any, @Body() data: any) {
    this.checkPlatformOwner(req);

    if (!data.percentDiscount && !data.fixedPrice) {
      throw new BadRequestException('Either percentDiscount or fixedPrice must be provided');
    }

    if (data.code) {
      // Vérifier unicité du code
      const existing = await this.prisma.pricingOverride.findUnique({
        where: { code: data.code },
      });

      if (existing) {
        throw new BadRequestException(`Override code already exists: ${data.code}`);
      }
    }

    const override = await this.prisma.pricingOverride.create({
      data: {
        tenantId: data.tenantId || null,
        code: data.code || null,
        percentDiscount: data.percentDiscount || null,
        fixedPrice: data.fixedPrice || null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        isActive: data.isActive !== false,
        createdBy: req.user.id,
        metadata: data.metadata,
      },
    });

    this.logger.log(`✅ Pricing override created: ${override.id} by ${req.user.id}`);

    return override;
  }

  /**
   * Désactive un override
   * 
   * PUT /admin/pricing/overrides/:id/deactivate
   */
  @Put('overrides/:id/deactivate')
  async deactivateOverride(@Req() req: any, @Param('id') id: string) {
    this.checkPlatformOwner(req);

    const override = await this.prisma.pricingOverride.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`✅ Pricing override deactivated: ${id} by ${req.user.id}`);

    return override;
  }
}
