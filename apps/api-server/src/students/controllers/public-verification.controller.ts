/**
 * ============================================================================
 * PUBLIC VERIFICATION CONTROLLER - API PUBLIQUE QR CARTE SCOLAIRE
 * ============================================================================
 * GET /v/:token (ou /api/public/verify/:token) — pas d'auth, rate limit, journalisation IP
 * Réponse : Carte valide → Nom, École, Année, Statut, Photo ; sinon "Carte invalide ou désactivée"
 * ============================================================================
 */

import { Controller, Get, Param, Req, NotFoundException } from '@nestjs/common';
import { PublicVerificationService } from '../services/public-verification.service';
import { Public } from '@/auth/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

@Controller('api/public/verify')
export class PublicVerificationController {
  constructor(
    private readonly verificationService: PublicVerificationService,
  ) {}

  /**
   * GET /api/public/verify/v/:token
   * Vérification publique (scan QR carte scolaire). Rate limit strict.
   * Spec : 404 si carte invalide ou désactivée.
   */
  @Public()
  @Throttle({ short: { limit: 20, ttl: 60000 } })
  @Get('v/:token')
  async verifyByToken(@Param('token') token: string, @Req() req: Request) {
    const ip = (req.ip || (req.headers['x-forwarded-for'] as string) || null) as string | null;
    const result = await this.verificationService.verifyToken(token, ip);
    if (!result.isValid) {
      throw new NotFoundException({
        valid: false,
        message: result.message ?? 'Carte invalide ou désactivée',
        isExpired: result.isExpired,
      });
    }
    return {
      valid: true,
      student: result.student,
    };
  }

  /**
   * GET /api/public/verify/:token (legacy path)
   */
  @Public()
  @Throttle({ short: { limit: 20, ttl: 60000 } })
  @Get(':token')
  async verifyToken(@Param('token') token: string, @Req() req: Request) {
    const ip = (req.ip || (req.headers['x-forwarded-for'] as string) || null) as string | null;
    const result = await this.verificationService.verifyToken(token, ip);
    if (!result.isValid) {
      throw new NotFoundException({
        valid: false,
        isValid: false,
        message: result.message ?? 'Carte invalide ou désactivée',
        isExpired: result.isExpired,
      });
    }
    return {
      valid: true,
      isValid: true,
      student: result.student,
    };
  }
}

