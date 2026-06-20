/**
 * ============================================================================
 * CONTRACT PUBLIC SIGN CONTROLLER
 * ============================================================================
 *
 * Endpoints PUBLICS pour la signature électronique de contrat par lien magique.
 *
 * Permet à un candidat de signer son contrat sans compte utilisateur :
 *   1. GET  /api/hr/contracts-public/{token}
 *      → Valide le token + retourne les infos contrat à afficher
 *
 *   2. POST /api/hr/contracts-public/{token}/sign
 *      → Enregistre la signature (canvas base64) + déclenche la cascade
 *        (contract ACTIVE, staff ACTIVE, credentials créés, emails envoyés)
 *
 * Sécurité :
 *   - Aucune auth JWT requise (le token fait foi)
 *   - Token = 32 chars hex (128 bits d'entropie) → impossible à deviner
 *   - 1 token = 1 signature (usedAt set après usage)
 *   - Expiration 30 jours
 *   - IP + User-Agent tracés
 *
 * Ces endpoints sont volontairement dans un controller séparé pour ne pas
 * hériter du @UseGuards(JwtAuthGuard, TenantGuard) du ContractsPrismaController.
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { ContractSignTokenService } from './services/contract-sign-token.service';
import { ContractPdfService } from './services/contract-pdf.service';

@Controller('hr/contracts-public')
export class ContractPublicSignController {
  private readonly logger = new Logger(ContractPublicSignController.name);

  constructor(
    private readonly contractSignTokenService: ContractSignTokenService,
    private readonly contractPdfService: ContractPdfService,
  ) {}

  /**
   * GET /api/hr/contracts-public/:token
   *
   * Valide un token de signature et retourne les infos contrat à afficher
   * au candidat sur la page publique de signature.
   *
   * Ne retourne PAS de données sensibles (pas de signedBy, pas de terms
   * complets avec signatureData base64).
   */
  @Public()
  @Get(':token')
  async getContractInfoByToken(@Param('token') token: string) {
    if (!token || token.length < 16) {
      throw new BadRequestException('Token invalide');
    }

    const info = await this.contractSignTokenService.validateToken(token);
    return info;
  }

  /**
   * POST /api/hr/contracts-public/:token/sign
   *
   * Enregistre la signature électronique du candidat.
   *
   * Body:
   *   {
   *     "signatureData": "data:image/png;base64,iVBOR...",  // canvas → PNG base64
   *     "signerName": "Aurore AKPOVI"                        // nom complet
   *   }
   *
   * Cascade déclenchée (déjà codée dans ContractPdfService.signContract) :
   *   - Contract.signedAt = now(), status = ACTIVE
   *   - Contract.terms.signatureData = base64
   *   - PDF regénéré avec signature
   *   - Staff.status = PENDING_SIGNATURE → ACTIVE
   *   - Credentials créés (username + password)
   *   - Email "Identifiants de connexion" envoyé
   *   - Email "Contrat signé" envoyé
   *   - Token marqué USED
   */
  @Public()
  @Post(':token/sign')
  async signContractByToken(
    @Param('token') token: string,
    @Body() body: { signatureData: string; signerName: string },
    @Req() req: Request,
  ) {
    if (!token || token.length < 16) {
      throw new BadRequestException('Token invalide');
    }

    if (!body?.signatureData || !body?.signerName) {
      throw new BadRequestException('signatureData et signerName sont requis');
    }

    // Valider le format de signatureData (data:image/png;base64,...)
    if (!body.signatureData.startsWith('data:image/')) {
      throw new BadRequestException(
        'signatureData doit être une image base64 (format: data:image/png;base64,...)',
      );
    }

    // 1. Valider le token (vérifie existence, expiration, usage, contrat non signé)
    const info = await this.contractSignTokenService.validateToken(token);

    // 2. Récupérer l'IP et User-Agent pour audit
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    this.logger.log(
      `Signature par token: token=${token.substring(0, 8)}..., contractId=${info.contractId}, ` +
        `signerName="${body.signerName}", IP=${ip}`,
    );

    // 3. Appeler signContract avec signerRole=EMPLOYE
    //    (le candidat signe en tant qu'employé)
    //    Cela déclenche toute la cascade (staff ACTIVE, credentials, emails, etc.)
    const signedContract = await this.contractPdfService.signContract(
      info.contractId,
      info.tenantId,
      {
        signatureData: body.signatureData,
        signerName: body.signerName,
        signerRole: 'EMPLOYE',
        ipAddress: ip,
      },
    );

    // 4. Marquer le token comme utilisé
    await this.contractSignTokenService.markAsUsed(token, ip, userAgent);

    this.logger.log(
      `✅ Contrat ${info.contractId} signé avec succès par ${body.signerName} via token ${token.substring(0, 8)}...`,
    );

    return {
      success: true,
      message: 'Contrat signé avec succès',
      contractId: info.contractId,
      signedAt: signedContract.signedAt,
      signedBy: signedContract.signedBy,
      contractStatus: signedContract.status,
      // Indiquer que les credentials vont être envoyés par email
      credentialsWillBeEmailed: true,
    };
  }

  /**
   * POST /api/hr/contracts-public/:token/regenerate
   *
   * Permet à l'admin de régénérer un token expiré ou utilisé.
   * Endpoint PUBLIC mais en pratique utilisé par l'admin via l'UI.
   *
   * Body:
   *   { "contractId": "...", "tenantId": "..." }
   */
  // Note: Cet endpoint n'est PAS Public — il est ici pour la cohérence
  // mais nécessite une authentification admin (à implémenter si besoin)
}
