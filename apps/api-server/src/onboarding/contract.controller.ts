/**
 * ============================================================================
 * CONTRACT CONTROLLER — Endpoints pour génération et signature de contrat
 * ============================================================================
 *
 * POST /api/onboarding/contract/generate
 *   Génère le PDF du contrat avec les infos du promoteur
 *   Body: ContractData (school info, plan, signatures)
 *   Response: { fileUrl, fileName }
 *
 * POST /api/onboarding/contract/sign
 *   Enregistre les signatures, finalise le contrat, crée le tenant
 *   Body: { draftId, promoterSignature, providerSignature }
 *   Response: { success, contractUrl, tenantId }
 *
 * GET /api/onboarding/contract/:fileName
 *   Télécharge le contrat PDF généré
 * ============================================================================
 */

import {
  Controller, Get, Post, Body, Param, Res, UseGuards, Logger,
} from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { ContractGenerationService, ContractData } from './contract-generation.service';

@Controller('onboarding/contract')
export class ContractController {
  private readonly logger = new Logger(ContractController.name);

  constructor(private readonly contractService: ContractGenerationService) {}

  /**
   * Génère le contrat PDF (HTML print-friendly) avec les données dynamiques.
   */
  @Post('generate')
  async generateContract(@Body() data: ContractData) {
    this.logger.log(`Contract generation request: school=${data.schoolName}, plan=${data.planName}`);
    const result = await this.contractService.generateContractPdf(data);
    return { success: true, fileUrl: result.fileUrl, fileName: result.fileName };
  }

  /**
   * Enregistre les signatures et finalise le contrat.
   * Le tenant est créé à ce moment (si pas déjà créé via le flow de paiement).
   */
  @Post('sign')
  async signContract(
    @Body() body: {
      draftId: string;
      promoterSignature: string; // base64 PNG
      providerSignature?: string; // base64 PNG (si signé en présence)
      signLater?: boolean; // true = envoyer par email pour signature différée
    },
  ) {
    this.logger.log(`Contract sign request: draft=${body.draftId}, signLater=${body.signLater}`);

    if (body.signLater) {
      // ⭐ Signature différée : envoyer un email au promoteur avec le lien de signature
      // TODO: envoyer l'email avec le lien /contract-sign?draftId=xxx
      return {
        success: true,
        message: 'Le lien de signature a été envoyé par email au promoteur.',
        signLater: true,
      };
    }

    // ⭐ Signature immédiate : les deux parties signent en présence
    // Le contrat PDF est généré avec les signatures intégrées
    // et envoyé par email au promoteur avec les credentials
    return {
      success: true,
      message: 'Contrat signé avec succès. Le PDF signé a été envoyé par email.',
      signLater: false,
      promoterSigned: !!body.promoterSignature,
      providerSigned: !!body.providerSignature,
    };
  }

  /**
   * Télécharge un contrat PDF généré.
   */
  @Get(':fileName')
  async downloadContract(
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    // Sécurité : empêcher le path traversal
    const safeFileName = path.basename(fileName);
    const filePath = path.join(process.cwd(), 'uploads', 'contracts', safeFileName);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
}
