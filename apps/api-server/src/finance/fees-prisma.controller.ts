/**
 * ============================================================================
 * FEES PRISMA CONTROLLER - MODULE 4
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FeesPrismaService } from './fees-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { SchoolLevelId } from '../common/decorators/school-level-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/finance/fees')
@UseGuards(JwtAuthGuard)
export class FeesPrismaController {
  constructor(private readonly feesService: FeesPrismaService) {}

  // Fee Categories
  @Post('categories')
  async createCategory(@TenantId() tenantId: string, @Body() createDto: any) {
    return this.feesService.createFeeCategory({
      ...createDto,
      tenantId,
    });
  }

  @Get('categories')
  async findAllCategories(@TenantId() tenantId: string) {
    return this.feesService.findAllFeeCategories(tenantId);
  }

  @Get('categories/:id')
  async findCategoryById(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.feesService.findFeeCategoryById(id, tenantId);
  }

  // Fee Definitions
  @Post('definitions')
  async createDefinition(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() createDto: any
  ) {
    return this.feesService.createFeeDefinition({
      ...createDto,
      tenantId,
      createdBy: user?.id,
    });
  }

  @Get('definitions')
  async findAllDefinitions(
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('classId') classId?: string,
    @Query('feeCategoryId') feeCategoryId?: string,
    @Query('search') search?: string,
  ) {
    return this.feesService.findAllFeeDefinitions(tenantId, {
      academicYearId,
      schoolLevelId,
      classId,
      feeCategoryId,
      search,
    });
  }

  @Get('definitions/:id')
  async findDefinitionById(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.feesService.findFeeDefinitionById(id, tenantId);
  }

  @Put('definitions/:id')
  async updateDefinition(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: any,
  ) {
    return this.feesService.updateFeeDefinition(id, tenantId, updateDto);
  }

  @Delete('definitions/:id')
  async deleteDefinition(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.feesService.deleteFeeDefinition(id, tenantId);
  }

  // Student Fees
  @Post('student-fees')
  async createStudentFee(@TenantId() tenantId: string, @Body() createDto: any) {
    return this.feesService.createStudentFee({
      ...createDto,
      tenantId,
    });
  }

  @Get('student-fees')
  async findAllStudentFees(
    @TenantId() tenantId: string,
    @Query('studentId') studentId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('status') status?: string,
  ) {
    return this.feesService.findStudentFees(tenantId, {
      studentId,
      academicYearId,
      schoolLevelId,
      status,
    });
  }

  @Put('student-fees/:id/status')
  async updateStudentFeeStatus(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { status: 'NOT_STARTED' | 'PARTIAL' | 'PAID' },
  ) {
    return this.feesService.updateStudentFeeStatus(id, tenantId, body.status);
  }
}

