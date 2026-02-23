import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { TenantFeaturesService } from './tenant-features.service';
import { FeatureCode } from './entities/tenant-feature.entity';
import { UpdateTenantFeatureDto } from './dto/update-tenant-feature.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('tenant-features')
@UseGuards(JwtAuthGuard)
export class TenantFeaturesController {
  constructor(private readonly tenantFeaturesService: TenantFeaturesService) {}

  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.tenantFeaturesService.findAll(tenantId);
  }

  @Get('pricing-impact')
  getPricingImpact(@TenantId() tenantId: string) {
    return this.tenantFeaturesService.calculatePricingImpact(tenantId);
  }

  @Get('check/:featureCode')
  checkFeature(
    @Param('featureCode') featureCode: FeatureCode,
    @TenantId() tenantId: string,
  ) {
    return this.tenantFeaturesService.isFeatureEnabled(featureCode, tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.tenantFeaturesService.findOne(id, tenantId);
  }

  @Post('enable/:featureCode')
  enableFeature(
    @Param('featureCode') featureCode: FeatureCode,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { reason?: string },
  ) {
    return this.tenantFeaturesService.enableFeature(
      featureCode,
      tenantId,
      user.id,
      body.reason,
    );
  }

  @Post('disable/:featureCode')
  disableFeature(
    @Param('featureCode') featureCode: FeatureCode,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { reason?: string },
  ) {
    return this.tenantFeaturesService.disableFeature(
      featureCode,
      tenantId,
      user.id,
      body.reason,
    );
  }

  @Patch(':featureCode')
  update(
    @Param('featureCode') featureCode: FeatureCode,
    @Body() updateDto: UpdateTenantFeatureDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.tenantFeaturesService.repository.update(tenantId, featureCode, {
      ...updateDto,
      updatedBy: user.id,
    });
  }
}

