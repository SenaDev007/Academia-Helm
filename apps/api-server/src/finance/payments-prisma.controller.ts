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
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PaymentsPrismaService } from './payments-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { SchoolLevelId } from '../common/decorators/school-level-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreatePaymentDto } from './dto';
import { PrismaService } from '../database/prisma.service';

@Controller('finance/payments')
@UseGuards(JwtAuthGuard)
export class PaymentsPrismaController {
  constructor(
    private readonly paymentsService: PaymentsPrismaService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Post()
  async createPayment(
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
    @CurrentUser() user: any,
    @Body() createDto: CreatePaymentDto,
  ) {
    // Look up the student fee to get studentId, schoolLevelId, and academicYearId
    const studentFee = await this.prisma.studentFee.findFirst({
      where: { id: createDto.studentFeeId, tenantId },
      include: { student: true },
    });

    if (!studentFee) {
      throw new BadRequestException(`Student fee with ID ${createDto.studentFeeId} not found`);
    }

    return this.paymentsService.createPayment({
      tenantId,
      academicYearId: createDto.academicYearId || studentFee.academicYearId || '',
      schoolLevelId: studentFee.student?.schoolLevelId || schoolLevelId,
      studentId: studentFee.studentId,
      studentFeeId: createDto.studentFeeId,
      amount: createDto.amount,
      paymentMethod: createDto.paymentMethod,
      paymentDate: new Date(),
      reference: createDto.reference,
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

  @Get(':id')
  async findPaymentById(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.paymentsService.findPaymentById(id, tenantId);
  }

  /**
   * Annulation par écriture inverse (REVERSAL). Motif obligatoire.
   */
  @Post(':id/reverse')
  async reversePayment(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { reversalReason: string },
  ) {
    if (!body?.reversalReason?.trim()) {
      throw new BadRequestException('reversalReason is required');
    }
    return this.paymentsService.reversePayment(id, tenantId, {
      reversalReason: body.reversalReason.trim(),
      createdBy: user?.id,
    });
  }
}

