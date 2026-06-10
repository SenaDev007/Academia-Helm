/**
 * ============================================================================
 * FEE REGIME CONTROLLER
 * ============================================================================
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FeeRegimeService } from './fee-regime.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { CreateFeeRegimeDto, UpdateFeeRegimeDto, CreateFeeRegimeRuleDto } from './dto';

@Controller('finance/fee-regimes')
@UseGuards(JwtAuthGuard)
export class FeeRegimeController {
  constructor(private readonly regimeService: FeeRegimeService) {}

  @Post()
  async createRegime(
    @Body() data: CreateFeeRegimeDto,
    @CurrentUser() user: User,
  ) {
    return this.regimeService.createRegime({
      ...data,
      tenantId: user.tenantId || '',
    });
  }

  @Get()
  async getRegimes(
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId: string,
    @CurrentUser() user: User,
  ) {
    return this.regimeService.getRegimes(
      user.tenantId || '',
      academicYearId,
      schoolLevelId,
    );
  }

  @Get(':id')
  async getRegimeById(@Param('id') id: string) {
    return this.regimeService.getRegimeById(id);
  }

  @Put(':id')
  async updateRegime(
    @Param('id') id: string,
    @Body() data: UpdateFeeRegimeDto,
  ) {
    return this.regimeService.updateRegime(id, data);
  }

  @Delete(':id')
  async deleteRegime(@Param('id') id: string) {
    return this.regimeService.deleteRegime(id);
  }

  @Post(':id/rules')
  async addRule(
    @Param('id') id: string,
    @Body() data: CreateFeeRegimeRuleDto,
  ) {
    // Map DTO fields to service-expected format
    let discountType: string;
    let discountValue: number;
    if (data.reductionPercentage !== undefined) {
      discountType = 'PERCENT';
      discountValue = data.reductionPercentage;
    } else if (data.fixedAmount !== undefined) {
      discountType = 'FIXED';
      discountValue = data.fixedAmount;
    } else {
      discountType = 'PERCENT';
      discountValue = 0;
    }
    return this.regimeService.addRule(id, {
      feeType: data.feeType,
      discountType,
      discountValue,
    });
  }
}

