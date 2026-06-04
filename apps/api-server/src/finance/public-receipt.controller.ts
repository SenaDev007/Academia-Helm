/**
 * ============================================================================
 * PUBLIC RECEIPT CONTROLLER - VÉRIFICATION PUBLIQUE DES REÇUS
 * ============================================================================
 * 
 * Controller public pour la vérification de reçus via QR Code
 * Pas d'authentification requise
 * 
 * ============================================================================
 */

import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '@/auth/decorators/public.decorator';
import { ReceiptGenerationService } from './receipt-generation.service';

@Controller('public/receipts')
export class PublicReceiptController {
  constructor(private readonly receiptService: ReceiptGenerationService) {}

  /**
   * GET /api/public/receipts/verify/:token
   * Vérifie un reçu via token QR Code (API publique)
   */
  @Public()
  @Get('verify/:token')
  async verifyReceipt(@Param('token') token: string) {
    return this.receiptService.verifyReceiptToken(token);
  }
}

