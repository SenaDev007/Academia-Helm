/**
 * ============================================================================
 * PAYMENTS PRISMA CONTROLLER - MODULE 4
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
import { PaymentsPrismaService } from './payments-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { SchoolLevelId } from '../common/decorators/school-level-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/finance/payments')
@UseGuards(JwtAuthGuard)
export class PaymentsPrismaController {
  constructor(private readonly paymentsService: PaymentsPrismaService) {}

  @Post()
  async createPayment(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() createDto: any,
  ) {
    return this.paymentsService.createPayment({
      ...createDto,
      tenantId,
      createdBy: user?.id,
    });
  }

  @Get()
  async findAllPayments(
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('studentId') studentId?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    return this.paymentsService.findAllPayments(tenantId, {
      academicYearId,
      schoolLevelId,
      studentId,
      paymentMethod,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      search,
    });
  }

  @Get(':id')
  async findPaymentById(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.paymentsService.findPaymentById(id, tenantId);
  }

  @Get('student/:studentId/summary')
  async getStudentPaymentSummary(
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
    @TenantId() tenantId: string,
  ) {
    return this.paymentsService.getStudentPaymentSummary(
      studentId,
      academicYearId,
      tenantId
    );
  }
}

