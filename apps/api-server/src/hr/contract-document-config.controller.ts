/**
 * ============================================================================
 * CONTRACT DOCUMENT CONFIG CONTROLLER
 * ============================================================================
 *
 * Endpoints pour gérer la configuration visuelle des contrats par école :
 *   - GET  /api/hr/contracts/document-config  → récupérer la config
 *   - PUT  /api/hr/contracts/document-config  → mettre à jour la config
 *
 * Une config par tenant (école). Appliquée à tous les contrats de l'école.
 * ============================================================================
 */

import {
  Controller, Get, Put, Body, Query,
  UseGuards, BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { GetTenant } from '../../common/decorators/tenant.decorator';
import { ContractDocumentConfigService, UpdateContractDocumentConfigDto } from './services/contract-document-config.service';

@Controller('hr/contract-document-config')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ContractDocumentConfigController {
  constructor(
    private readonly configService: ContractDocumentConfigService,
  ) {}

  /**
   * GET /api/hr/contracts/document-config
   * Récupère la configuration visuelle des contrats du tenant.
   * Si aucune config n'existe, la crée avec les valeurs par défaut.
   */
  @Get()
  async getConfig(
    @GetTenant() tenant: any,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.configService.getConfig(tid);
  }

  /**
   * PUT /api/hr/contracts/document-config
   * Met à jour la configuration visuelle des contrats.
   * Seuls les champs fournis dans le body sont mis à jour (partial update).
   */
  @Put()
  async updateConfig(
    @GetTenant() tenant: any,
    @Body() dto: UpdateContractDocumentConfigDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.configService.updateConfig(tid, dto);
  }
}
