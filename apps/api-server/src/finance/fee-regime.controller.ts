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

@Controller('finance/fee-regimes')
@UseGuards(JwtAuthGuard)
export class FeeRegimeController {
  constructor(private readonly regimeService: FeeRegimeService) {}

  @Post()
  async createRegime(
    @Body() data: any,
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
    @Body() data: any,
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
    @Body() data: any,
  ) {
    return this.regimeService.addRule(id, data);
  }
}

