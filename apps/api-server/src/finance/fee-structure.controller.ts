/**
 * SOUS-MODULE 1 — Configuration des frais (FeeStructure) — API
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FeeStructureService } from './fee-structure.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/finance/fees')
@UseGuards(JwtAuthGuard)
export class FeeStructureController {
  constructor(private readonly service: FeeStructureService) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: any,
  ) {
    const installments = body.installments?.map((i: any) => ({
      ...i,
      dueDate: i.dueDate ? new Date(i.dueDate) : new Date(),
    }));
    return this.service.create(tenantId, {
      academicYearId: body.academicYearId,
      levelId: body.levelId,
      classId: body.classId,
      name: body.name,
      feeType: body.feeType,
      totalAmount: Number(body.totalAmount),
      isInstallment: body.isInstallment ?? false,
      isMandatory: body.isMandatory ?? true,
      installments,
      createdById: user?.id,
    }, user?.id);
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('levelId') levelId?: string,
    @Query('classId') classId?: string,
    @Query('feeType') feeType?: string,
    @Query('isActive') isActive?: string,
  ) {
    if (!academicYearId) {
      return [];
    }
    return this.service.findAll(tenantId, {
      academicYearId,
      levelId,
      classId,
      feeType,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Post('copy-to-year')
  async copyToNewYear(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { fromAcademicYearId: string; toAcademicYearId: string },
  ) {
    return this.service.copyToNewYear(tenantId, {
      fromAcademicYearId: body.fromAcademicYearId,
      toAcademicYearId: body.toAcademicYearId,
      createdById: user?.id,
    }, user?.id);
  }

  @Post('override')
  async createOverride(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { feeStructureId: string; studentId: string; customAmount: number; reason: string },
  ) {
    return this.service.createOverride(tenantId, {
      ...body,
      customAmount: Number(body.customAmount),
      createdById: user?.id,
    }, user?.id);
  }

  @Get('overrides')
  async getOverrides(
    @TenantId() tenantId: string,
    @Query('studentId') studentId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    if (!studentId) return [];
    return this.service.getOverridesForStudent(tenantId, studentId, academicYearId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.findOne(id, tenantId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: any,
  ) {
    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.totalAmount !== undefined) data.totalAmount = Number(body.totalAmount);
    if (body.isInstallment !== undefined) data.isInstallment = body.isInstallment;
    if (body.isMandatory !== undefined) data.isMandatory = body.isMandatory;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.levelId !== undefined) data.levelId = body.levelId || null;
    if (body.classId !== undefined) data.classId = body.classId || null;
    return this.service.update(id, tenantId, data, user?.id);
  }

  @Post(':id/installments')
  async addInstallment(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { label: string; amount: number; dueDate: string; orderIndex: number },
  ) {
    return this.service.addInstallment(id, tenantId, {
      ...body,
      amount: Number(body.amount),
      dueDate: new Date(body.dueDate),
      orderIndex: Number(body.orderIndex),
    });
  }
}
