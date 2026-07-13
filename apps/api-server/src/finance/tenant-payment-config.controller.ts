/**
 * TENANT PAYMENT CONFIG CONTROLLER
 * Endpoints pour configurer les paiements en ligne (FedaPay / Fedapay)
 */
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { TenantPaymentConfigService } from './tenant-payment-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('finance/payment-config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantPaymentConfigController {
  constructor(private readonly service: TenantPaymentConfigService) {}

  /**
   * GET /finance/payment-config
   * Récupère la config de paiement du tenant (clés masquées).
   */
  @Get()
  async getConfig(@TenantId() tenantId: string) {
    return this.service.getConfig(tenantId);
  }

  /**
   * POST /finance/payment-config
   * Crée ou met à jour la config de paiement.
   * Body: { provider, isActive, fedapayApiKey, fedapayShopId, ... }
   */
  @Post()
  @Roles(
    'SUPER_DIRECTOR', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN',
    'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN',
    'PROMOTEUR', 'PROMOTER', 'SCHOOL_OWNER', 'SCHOOL_ADMIN',
    'DIRECTOR_GENERAL', 'DIRECTEUR', 'DIRECTEUR_GENERAL',
  )
  async upsertConfig(
    @TenantId() tenantId: string,
    @Body() body: {
      provider?: string;
      isActive?: boolean;
      fedapayApiKey?: string;
      fedapayShopId?: string;
      fedapaySecretKey?: string;
      fedapayPublicKey?: string;
      fedapaySecretKey?: string;
      webhookSecret?: string;
    },
  ) {
    const config = await this.service.upsertConfig(tenantId, body);
    return {
      success: true,
      message: 'Configuration de paiement enregistrée avec succès',
      config: {
        ...config,
        fedapayApiKey: config.fedapayApiKey ? '****' + config.fedapayApiKey.substring(config.fedapayApiKey.length - 4) : null,
        fedapaySecretKey: config.fedapaySecretKey ? '****' + config.fedapaySecretKey.substring(config.fedapaySecretKey.length - 4) : null,
        fedapaySecretKey: config.fedapaySecretKey ? '****' + config.fedapaySecretKey.substring(config.fedapaySecretKey.length - 4) : null,
        webhookSecret: config.webhookSecret ? '****' + config.webhookSecret.substring(config.webhookSecret.length - 4) : null,
      },
    };
  }
}
