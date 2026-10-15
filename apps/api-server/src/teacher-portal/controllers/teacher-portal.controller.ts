/**
 * ============================================================================
 * HELM ENSEIGNANT — CONTRÔLEUR DU PORTAIL ENSEIGNANT AUTONOME
 * ============================================================================
 *
 * Routes publiques  : POST /teacher-portal/register, POST /teacher-portal/login
 * Routes protégées  : GET  /teacher-portal/profile
 *                     POST /teacher-portal/levels
 *                     POST /teacher-portal/invite-promoter
 *
 * ⭐ Le sélecteur de niveaux est la porte d'entrée « intelligente » :
 *    l'enseignant active Maternelle / Primaire / Secondaire et reçoit
 *    automatiquement toutes les classes et matières du niveau.
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '@/auth/decorators/public.decorator';
import { TeacherPortalAuthService } from '../services/teacher-portal-auth.service';
import { TeacherProvisioningService } from '../services/teacher-provisioning.service';
import {
  RegisterTeacherDto,
  TeacherStandaloneLoginDto,
  SetTeacherLevelsDto,
  InvitePromoterDto,
} from '../dto/teacher-portal.dto';

@Controller('teacher-portal')
export class TeacherPortalController {
  constructor(
    private readonly authService: TeacherPortalAuthService,
    private readonly provisioningService: TeacherProvisioningService,
  ) {}

  /** Inscription autonome — provisionne tout l'espace puis connecte. */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterTeacherDto, @Req() req: any) {
    return this.authService.register(
      dto,
      req?.ip || req?.headers?.['x-forwarded-for'],
      req?.headers?.['user-agent'],
    );
  }

  /** Connexion Helm Enseignant — email + mot de passe (sans établissement). */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: TeacherStandaloneLoginDto, @Req() req: any) {
    return this.authService.login(
      dto,
      req?.ip || req?.headers?.['x-forwarded-for'],
      req?.headers?.['user-agent'],
    );
  }

  /** Profil de l'espace : niveaux activés, année, identité, abonnement, stats. */
  @Get('profile')
  async getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user?.sub ?? req.user?.id);
  }

  /** Active / désactive des niveaux → provisionne classes + matières. */
  @Post('levels')
  async setLevels(@Body() dto: SetTeacherLevelsDto, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new Error('Tenant non résolu');
    }
    return this.provisioningService.setTeacherLevels(tenantId, dto.levels);
  }

  /** Invite le promoteur de son école à découvrir Academia Helm. */
  @Post('invite-promoter')
  @HttpCode(HttpStatus.OK)
  async invitePromoter(@Body() dto: InvitePromoterDto, @Req() req: any) {
    return this.authService.invitePromoter(req.user?.sub ?? req.user?.id, dto);
  }
}
