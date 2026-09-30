/**
 * FederisPublicResultsController — ⭐ T26 (2026-10-01)
 * Routes PUBLIQUES du portail provisoire de consultation des résultats
 * ═══════════════════════════════════════════════════════════════════════════
 * Fréquentées par les PARENTS sans compte (page /federis/resultats/:token) :
 *
 *   GET /federis/public/results/:token           — infos du lien + examen
 *                                                    (nom, session, patronat,
 *                                                    stats, expiration)
 *   GET /federis/public/results/:token/lookup?q= — recherche d'un élève par
 *                                                    nom, n° de table ou
 *                                                    matricule + fiche résultat
 *                                                    (notes, moyenne, décision)
 *
 * Garde-fous : le TOKEN fait office d'authentification (généré à la
 * publication, durée de vie paramétrable, révocable par le coordonnateur).
 * Toute la logique de validation vit dans FederisPublicResultsService.
 */

import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { FederisPublicResultsService } from './federis-public-results.service';

@Controller('federis/public')
export class FederisPublicResultsController {
  constructor(private readonly publicResultsService: FederisPublicResultsService) {}

  /** Écran d'accueil : examen, session, patronat, stats — sans résultats. */
  @Public()
  @Get('results/:token')
  async getPublicInfo(@Param('token') token: string) {
    return this.publicResultsService.getPublicInfo(token);
  }

  /** Recherche d'un élève : ?q=nom | matricule | numéro de table. */
  @Public()
  @Get('results/:token/lookup')
  async lookup(@Param('token') token: string, @Query('q') q?: string) {
    return this.publicResultsService.lookup(token, q ?? '');
  }
}
