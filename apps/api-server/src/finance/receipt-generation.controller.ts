/**
 * ============================================================================
 * RECEIPT GENERATION CONTROLLER - GÉNÉRATION DE REÇUS
 * ============================================================================
 * 
 * Controller pour gérer la génération et la vérification de reçus
 * 
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/auth/guards/roles.guard';
import { Roles } from '@/auth/decorators/roles.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import { ReceiptGenerationService } from './receipt-generation.service';
import { PrismaService } from '../database/prisma.service';
import { Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';

@Controller('receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReceiptGenerationController {
  constructor(
    private readonly receiptService: ReceiptGenerationService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /api/receipts/generate/:paymentId
   * Génère un reçu pour un paiement
   */
  @Post('generate/:paymentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')
  async generateReceipt(
    @Param('paymentId') paymentId: string,
    @Request() req: any,
  ) {
    const issuedBy = req.user?.id;
    return this.receiptService.generateReceipt(paymentId, issuedBy);
  }

  /**
   * GET /api/receipts/:receiptId/download
   * Télécharge le PDF d'un reçu
   */
  @Get(':receiptId/download')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'TEACHER', 'PARENT', 'STUDENT')
  async downloadReceipt(
    @Param('receiptId') receiptId: string,
    @Res() res: Response,
  ) {
    const receipt = await this.prisma.paymentReceipt.findUnique({
      where: { id: receiptId },
    });

    if (!receipt || !receipt.filePath) {
      return res.status(404).json({ error: 'Receipt PDF not found' });
    }

    const filePath = path.resolve(receipt.filePath);
    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);

    if (!fileExists) {
      return res.status(404).json({ error: 'Receipt PDF file not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="receipt-${receipt.receiptNumber}.pdf"`,
    );

    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
  }

  /**
   * POST /api/receipts/:receiptId/duplicate
   * Génère un duplicata de reçu
   */
  @Post(':receiptId/duplicate')
  @Roles('DIRECTOR', 'ADMIN', 'ACCOUNTANT')
  async generateDuplicate(
    @Param('receiptId') receiptId: string,
    @Request() req: any,
  ) {
    const issuedBy = req.user?.id;
    return this.receiptService.generateDuplicate(receiptId, issuedBy);
  }

}

