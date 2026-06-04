/**
 * SOUS-MODULE 8 — Paramétrage financier — API
 */
import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { FinancialSettingsService } from './financial-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateFinancialSettingsDto } from './dto';

@Controller('finance/settings')
@UseGuards(JwtAuthGuard)
export class FinancialSettingsController {
  constructor(private readonly service: FinancialSettingsService) {}

  @Get()
  async get(@TenantId() tenantId: string) {
    return this.service.getOrCreate(tenantId);
  }

  @Patch()
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body()
    body: UpdateFinancialSettingsDto,
  ) {
    return this.service.update(tenantId, body, user?.id);
  }
}
