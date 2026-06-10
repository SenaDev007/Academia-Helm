/**
 * ============================================================================
 * PAYMENTS ENHANCED CONTROLLER - PAIEMENTS AVEC ALLOCATION AUTOMATIQUE
 * ============================================================================
 * 
 * Controller pour les paiements avec allocation automatique selon priorité
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
import { PaymentsPrismaEnhancedService } from './payments-prisma-enhanced.service';

@Controller('payments/enhanced')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsEnhancedController {
  constructor(private readonly paymentsService: PaymentsPrismaEnhancedService) {}

  /**
   * POST /api/payments/enhanced
   * Crée un paiement avec allocation automatique selon priorité
   */
  @Post()
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')
  async createPaymentWithAutoAllocation(
    @Body() body: {
      academicYearId: string;
      schoolLevelId: string;
      studentId: string;
      amount: number;
      paymentMethod: string;
      paymentDate: string;
      reference?: string;
      notes?: string;
    },
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    const createdBy = req.user.id;

    return this.paymentsService.createPaymentWithAutoAllocation({
      tenantId,
      academicYearId: body.academicYearId,
      schoolLevelId: body.schoolLevelId,
      studentId: body.studentId,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      paymentDate: new Date(body.paymentDate),
      reference: body.reference,
      notes: body.notes,
      createdBy,
    });
  }

  /**
   * GET /api/payments/enhanced/:paymentId
   * Récupère un paiement avec ses allocations
   */
  @Get(':paymentId')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'TEACHER', 'PARENT', 'STUDENT')
  async getPaymentWithAllocations(@Param('paymentId') paymentId: string) {
    return this.paymentsService.getPaymentWithAllocations(paymentId);
  }

  /**
   * GET /api/payments/enhanced/check-tuition/:studentId
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
    return this.paymentsService.isTuitionPaymentAllowed(
      tenantId,
      studentId,
      body.academicYearId,
    );
  }
}

