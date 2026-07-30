import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ReleasesService } from './releases.service';
import { CreateReleaseDto } from './dto/create-release.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * ============================================================================
 * RELEASES CONTROLLER — API publique pour les installables
 * ============================================================================
 *
 * Endpoints PUBLICS (sans auth) :
 *   GET    /api/releases                — liste (filtrable par platform, channel)
 *   GET    /api/releases/latest         — dernière version par plateforme
 *   GET    /api/releases/:id            — détails d'une release
 *
 * Endpoints PROTÉGÉS (admin seulement) :
 *   POST   /api/releases                — créer une release
 *   PATCH  /api/releases/:id/latest     — marquer comme "latest"
 *   DELETE /api/releases/:id            — supprimer
 *
 * Les fichiers binaires sont stockés sur Cloudflare R2.
 * La base ne contient que les métadonnées.
 * ============================================================================
 */

@Controller('releases')
export class ReleasesController {
  private readonly logger = new Logger(ReleasesController.name);

  constructor(private readonly releasesService: ReleasesService) {}

  /**
   * GET /api/releases
   * Liste toutes les releases (publique).
   * Query params optionnels :
   *   - platform: android | windows | ios | macos | linux
   *   - channel: stable | beta | dev (défaut: stable)
   *   - latestOnly: true pour ne retourner que les versions "latest"
   */
  @Get()
  async findAll(
    @Query('platform') platform?: string,
    @Query('channel') channel?: string,
    @Query('latestOnly') latestOnly?: string,
  ) {
    return this.releasesService.findAll({
      platform,
      channel,
      latestOnly: latestOnly === 'true',
    });
  }

  /**
   * GET /api/releases/latest
   * Retourne la dernière version stable pour chaque plateforme.
   * Utilisé par la page /downloads pour afficher les boutons.
   */
  @Get('latest')
  async findLatest() {
    return this.releasesService.findLatest();
  }

  /**
   * GET /api/releases/:id
   * Détails d'une release spécifique.
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.releasesService.findOne(id);
  }

  /**
   * POST /api/releases
   * Crée une nouvelle release (admin seulement).
   * Le fichier doit déjà être uploadé sur R2 avant cet appel.
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'PATRONAT')
  async create(@Body() dto: CreateReleaseDto) {
    return this.releasesService.create(dto);
  }

  /**
   * PATCH /api/releases/:id/latest
   * Marque une release comme "latest" pour sa plateforme.
   * Le trigger SQL démarque automatiquement les autres.
   */
  @Patch(':id/latest')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'PATRONAT')
  async markAsLatest(@Param('id') id: string) {
    return this.releasesService.markAsLatest(id);
  }

  /**
   * DELETE /api/releases/:id
   * Supprime une release (admin seulement).
   * Note: ne supprime pas le fichier sur R2 — juste les métadonnées.
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'PATRONAT')
  async remove(@Param('id') id: string) {
    return this.releasesService.remove(id);
  }
}
