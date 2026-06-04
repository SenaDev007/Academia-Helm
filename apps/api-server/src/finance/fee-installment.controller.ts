/**
 * ============================================================================
 * FEE INSTALLMENT CONTROLLER - GESTION DES TRANCHES DE PAIEMENT
 * ============================================================================
 * 
 * Controller pour gérer les tranches de paiement pour les frais de scolarité
 * 
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { FeeInstallmentService } from './fee-installment.service';

@Controller('fees/installments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeeInstallmentController {
  constructor(private readonly installmentService: FeeInstallmentService) {}

  /**
   * POST /api/fees/installments/:feeDefinitionId
   * Crée des tranches pour une définition de frais
   */
  @Post(':feeDefinitionId')
  @Roles('DIRECTOR', 'ADMIN')
  async createInstallments(
    @Param('feeDefinitionId') feeDefinitionId: string,
    @Body() body: {
      installments: Array<{
        label: string;
        amount: number;
        dueDate: string;
        orderIndex: number;
        isMandatory?: boolean;
        description?: string;
      }>;
    },
  ) {
    const installments = body.installments.map(inst => ({
      ...inst,
      dueDate: new Date(inst.dueDate),
    }));

    return this.installmentService.createInstallments(feeDefinitionId, installments);
  }

  /**
   * POST /api/fees/installments/:feeDefinitionId/auto-generate
   * Génère automatiquement des tranches
   */
  @Post(':feeDefinitionId/auto-generate')
  @Roles('DIRECTOR', 'ADMIN')
  async autoGenerateInstallments(
    @Param('feeDefinitionId') feeDefinitionId: string,
    @Body() body: {
      numberOfInstallments: number;
      firstDueDate: string;
      intervalDays?: number;
    },
  ) {
    return this.installmentService.generateAutoInstallments(
      feeDefinitionId,
      body.numberOfInstallments,
      new Date(body.firstDueDate),
      body.intervalDays || 30,
    );
  }

  /**
   * GET /api/fees/installments/:feeDefinitionId
   * Récupère les tranches d'une définition de frais
   */
  @Get(':feeDefinitionId')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'TEACHER', 'PARENT', 'STUDENT')
  async getInstallments(@Param('feeDefinitionId') feeDefinitionId: string) {
    return this.installmentService.getInstallments(feeDefinitionId);
  }

  /**
   * PUT /api/fees/installments/:installmentId
   * Met à jour une tranche
   */
  @Put(':installmentId')
  @Roles('DIRECTOR', 'ADMIN')
  async updateInstallment(
    @Param('installmentId') installmentId: string,
    @Body() body: {
      label?: string;
      amount?: number;
      dueDate?: string;
      orderIndex?: number;
      isMandatory?: boolean;
      description?: string;
    },
  ) {
    const updateData: any = { ...body };
    if (body.dueDate) {
      updateData.dueDate = new Date(body.dueDate);
    }

    return this.installmentService.updateInstallment(installmentId, updateData);
  }

  /**
   * DELETE /api/fees/installments/:installmentId
   * Supprime une tranche
   */
  @Delete(':installmentId')
  @Roles('DIRECTOR', 'ADMIN')
  async deleteInstallment(@Param('installmentId') installmentId: string) {
    return this.installmentService.deleteInstallment(installmentId);
  }
}

