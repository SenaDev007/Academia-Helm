import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FeeConfigurationsService } from './fee-configurations.service';
import { CreateFeeConfigurationDto } from './dto/create-fee-configuration.dto';
import { UpdateFeeConfigurationDto } from './dto/update-fee-configuration.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('fee-configurations')
@UseGuards(JwtAuthGuard)
export class FeeConfigurationsController {
  constructor(private readonly feeConfigurationsService: FeeConfigurationsService) {}

  @Post()
  create(
    @Body() createFeeConfigurationDto: CreateFeeConfigurationDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.feeConfigurationsService.create(createFeeConfigurationDto, tenantId, user.id);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('classId') classId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.feeConfigurationsService.findAll(tenantId, classId, academicYearId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.feeConfigurationsService.findOne(id, tenantId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateFeeConfigurationDto: UpdateFeeConfigurationDto,
    @TenantId() tenantId: string,
  ) {
    return this.feeConfigurationsService.update(id, updateFeeConfigurationDto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.feeConfigurationsService.delete(id, tenantId);
  }
}

