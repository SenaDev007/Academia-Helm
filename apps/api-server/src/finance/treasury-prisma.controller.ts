/**
 * ============================================================================
 * TREASURY PRISMA CONTROLLER - MODULE 4
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TreasuryPrismaService } from './treasury-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { SchoolLevelId } from '../common/decorators/school-level-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/finance/treasury')
@UseGuards(JwtAuthGuard)
export class TreasuryPrismaController {
  constructor(private readonly treasuryService: TreasuryPrismaService) {}

  @Post('daily-closures')
  async createDailyClosure(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() createDto: any,
  ) {
    return this.treasuryService.createDailyClosure({
      ...createDto,
      tenantId,
      createdBy: user?.id,
    });
  }

  @Put('daily-closures/:id/validate')
  async validateDailyClosure(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.treasuryService.validateDailyClosure(id, tenantId, user?.id);
  }

  @Get('daily-closures')
  async findAllDailyClosures(
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('validated') validated?: string,
  ) {
    return this.treasuryService.findAllDailyClosures(tenantId, {
      academicYearId,
      schoolLevelId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      validated: validated === 'true' ? true : validated === 'false' ? false : undefined,
    });
  }

  @Get('statistics')
  async getStatistics(
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.treasuryService.getTreasuryStatistics(
      tenantId,
      academicYearId,
      schoolLevelId
    );
  }
}

