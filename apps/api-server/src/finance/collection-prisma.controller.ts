/**
 * ============================================================================
 * COLLECTION PRISMA CONTROLLER - MODULE 4 (RECOUVREMENT)
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CollectionPrismaService } from './collection-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { SchoolLevelId } from '../common/decorators/school-level-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/finance/collection')
@UseGuards(JwtAuthGuard)
export class CollectionPrismaController {
  constructor(private readonly collectionService: CollectionPrismaService) {}

  @Post('detect-arrears')
  async detectArrears(
    @TenantId() tenantId: string,
    @Body() body: { academicYearId: string },
  ) {
    return this.collectionService.detectArrears(tenantId, body.academicYearId);
  }

  @Get('arrears')
  async findAllArrears(
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('arrearsLevel') arrearsLevel?: string,
    @Query('studentId') studentId?: string,
    @Query('search') search?: string,
  ) {
    return this.collectionService.findAllArrears(tenantId, {
      academicYearId,
      schoolLevelId,
      arrearsLevel,
      studentId,
      search,
    });
  }

  @Post('reminders')
  async createReminder(@Body() createDto: any) {
    return this.collectionService.createReminder(createDto);
  }

  @Post('promises')
  async createPaymentPromise(
    @CurrentUser() user: any,
    @Body() createDto: any,
  ) {
    return this.collectionService.createPaymentPromise({
      ...createDto,
      createdBy: user?.id,
    });
  }

  @Post('actions')
  async createCollectionAction(
    @CurrentUser() user: any,
    @Body() createDto: any,
  ) {
    return this.collectionService.createCollectionAction({
      ...createDto,
      performedBy: user?.id,
    });
  }

  @Get('statistics')
  async getStatistics(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.collectionService.getCollectionStatistics(tenantId, academicYearId);
  }
}

