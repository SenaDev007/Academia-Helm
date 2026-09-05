/**
 * ============================================================================
 * PORTAL SWITCH CONTROLLER — BASCULE DE PORTAIL SANS DÉCONNEXION
 * ============================================================================
 *
 * Endpoints AUTHENTIFIÉS (JwtAuthGuard) pour le personnel à double casquette
 * (ex : secrétaire + enseignant, directeur + enseignant) :
 *
 *   GET  /portal/auth/switch-options
 *        → liste les portails vers lesquels l'utilisateur peut basculer
 *          (sert au frontend à n'afficher le bouton que si la 2e casquette
 *          existe réellement).
 *
 *   POST /portal/auth/switch-portal  { targetPortal: 'SCHOOL' | 'TEACHER' }
 *        → ré-émet un JWT avec le nouveau portalType + crée une session de
 *          portail. AUCUNE déconnexion, AUCUNE ressaisie d'identifiants.
 *
 * Sécurité : les règles d'éligibilité sont le MIROIR EXACT de celles des
 * logins directs (loginSchool / loginTeacher) — la bascule ne peut jamais
 * ouvrir un accès que le login refuserait.
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { PortalSwitchService } from '../services/portal-switch.service';
import { IsIn, IsString } from 'class-validator';

class SwitchPortalDto {
  @IsString()
  @IsIn(['SCHOOL', 'TEACHER'])
  targetPortal: 'SCHOOL' | 'TEACHER';
}

@Controller('portal/auth')
@UseGuards(JwtAuthGuard)
export class PortalSwitchController {
  constructor(private readonly portalSwitchService: PortalSwitchService) {}

  /**
   * Portails de bascule disponibles pour l'utilisateur connecté.
   * Le frontend interroge cet endpoint pour décider d'afficher (ou non)
   * le bouton « Basculer vers l'UI Enseignant / École ».
   */
  @Get('switch-options')
  async getSwitchOptions(@Req() request: any) {
    const user = request.user;
    return this.portalSwitchService.getSwitchOptions({
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      portalType: user.portalType,
    });
  }

  /**
   * Bascule la session vers un autre portail (SCHOOL ⇄ TEACHER).
   * Retourne le même payload que les logins de portail (user, teacher?,
   * token, sessionId, portalType) — la BFF Next.js met à jour le cookie
   * de session et le client son localStorage, puis redirige.
   */
  @Post('switch-portal')
  @HttpCode(HttpStatus.OK)
  async switchPortal(@Body() dto: SwitchPortalDto, @Req() request: any) {
    const user = request.user;
    const ipAddress =
      request.ip ||
      request.headers['x-forwarded-for'] ||
      request.connection.remoteAddress;
    const userAgent = request.headers['user-agent'];

    return this.portalSwitchService.switchPortal(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        portalType: user.portalType,
      },
      dto.targetPortal,
      ipAddress,
      userAgent,
    );
  }
}
