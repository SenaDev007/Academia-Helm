/**
 * ============================================================================
 * PUBLIC PORTAL CONTROLLER - API PUBLIQUE POUR RECHERCHE D'ÉCOLES
 * ============================================================================
 */

import { Controller, Get, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../auth/decorators/public.decorator';
import { SchoolSearchService } from '../services/school-search.service';

@Controller('public/schools')
@Public()
export class PublicPortalController {
  constructor(
    private readonly schoolSearchService: SchoolSearchService,
  ) {}

  /**
   * Liste tous les établissements actifs (pour sélecteur)
   */
  @Public() // ✅ Décorateur au niveau méthode pour garantir la détection
  @Get('list')
  @Throttle({ medium: { limit: 10, ttl: 60000 } }) // 10 requêtes par minute
  async listAllSchools() {
    console.log('[PublicPortalController] listAllSchools called - Route is public');
    return this.schoolSearchService.listAllSchools();
  }

  /**
   * Recherche publique d'établissements
   * Rate-limited, sécurisé
   */
  @Public() // ✅ Décorateur au niveau méthode pour garantir la détection
  @Get('search')
  @Throttle({ medium: { limit: 20, ttl: 60000 } }) // 20 requêtes par minute
  async searchSchools(
    @Query('q') searchTerm: string,
    @Req() request: any,
  ) {
    const ipAddress =
      request.ip ||
      request.headers['x-forwarded-for'] ||
      request.connection.remoteAddress;

    return this.schoolSearchService.searchSchools(searchTerm, ipAddress);
  }
}

