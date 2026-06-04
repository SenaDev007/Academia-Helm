/**
 * ============================================================================
 * PAYMENT ALLOCATION CONTROLLER - ALLOCATION AUTOMATIQUE DES PAIEMENTS
 * ============================================================================
 * 
 * Controller pour gérer l'allocation automatique des paiements selon priorité
 * 
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { PaymentAllocationService } from './payment-allocation.service';
import { PrismaService } from '../database/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

@Controller('payments/allocation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentAllocationController {
  constructor(
    private readonly allocationService: PaymentAllocationService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /api/payments/allocation/:paymentId
   * Alloue automatiquement un paiement selon les règles de priorité
   */
  @Post(':paymentId')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')
  async allocatePayment(
    @Param('paymentId') paymentId: string,
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;

    // Récupérer le paiement
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        student: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.tenantId !== tenantId) {
      throw new ForbiddenException('Unauthorized');
    }

    if (!payment.academicYearId) {
      throw new NotFoundException('Payment must have an academic year');
    }

    return this.allocationService.allocatePayment(
      tenantId,
      payment.studentId,
      payment.academicYearId,
      paymentId,
      payment.amount,
    );
  }

  /**
   * GET /api/payments/allocation/:paymentId
   * Récupère les allocations d'un paiement
   */
  @Get(':paymentId')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'TEACHER', 'PARENT', 'STUDENT')
  async getPaymentAllocations(@Param('paymentId') paymentId: string) {
    return this.allocationService.getPaymentAllocations(paymentId);
  }

  /**
   * GET /api/payments/allocation/student-fee/:studentFeeId
   * Récupère toutes les allocations pour un frais élève
   */
  @Get('student-fee/:studentFeeId')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'TEACHER', 'PARENT', 'STUDENT')
  async getStudentFeeAllocations(@Param('studentFeeId') studentFeeId: string) {
    return this.allocationService.getStudentFeeAllocations(studentFeeId);
  }

  /**
   * GET /api/payments/allocation/check-tuition/:studentId
   * Vérifie si un paiement de scolarité est autorisé
   */
  @Get('check-tuition/:studentId')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')
  async checkTuitionPaymentAllowed(
    @Param('studentId') studentId: string,
    @Body() body: { academicYearId: string },
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    return this.allocationService.isTuitionPaymentAllowed(
      tenantId,
      studentId,
      body.academicYearId,
    );
  }
}

