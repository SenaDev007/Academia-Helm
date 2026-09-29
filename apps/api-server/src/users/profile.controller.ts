/**
 * ============================================================================
 * PROFILE CONTROLLER — Profil self-service « Mon profil » (tous les UI)
 * ============================================================================
 *
 * Endpoints pour l'utilisateur CONNECTÉ (identité = JWT, jamais d'ID client) :
 *
 *   GET    /api/users/me/profile   — Profil complet (champs sûrs)
 *   POST   /api/users/me/avatar    — Upload photo de profil ({ photoDataUrl })
 *   DELETE /api/users/me/avatar    — Suppression photo de profil
 *
 * ⚠️ AUCUN TenantGuard volontairement : les parents/promoteurs/enseignants
 *    comme les comptes sans tenant (ex : propriétaire plateforme) doivent
 *    gérer leur profil. Le JwtAuthGuard global protège ces routes.
 *    Aucun @Roles : tous les rôles (PROMOTER, DIRECTEUR, ENSEIGNANT,
 *    PARENT, ...) ont le même droit self-service.
 * ============================================================================
 */

import { Controller, Get, Post, Delete, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IMAGE_ONLY_DATA_URL_PIPE } from '../common/pipes/data-url-validation.pipe';
import { ProfileService } from './profile.service';

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  /**
   * Profil de l'utilisateur connecté (photo, identité, sécurité 2FA).
   * Utilisé par la boîte de dialogue « Mon profil » et les avatars topbar.
   */
  @Get('profile')
  async getMyProfile(@CurrentUser() user: any) {
    const userId = user?.id || user?.sub || user?.userId;
    return this.profileService.getMyProfile(userId);
  }

  /**
   * Upload de la photo de profil (data URL base64, image uniquement, ≤ 5 Mo).
   * Throttle renforcé : 10 uploads / minute max (le traitement sharp coûte).
   */
  @Post('avatar')
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  async uploadAvatar(
    @CurrentUser() user: any,
    @Body('photoDataUrl', IMAGE_ONLY_DATA_URL_PIPE) photoDataUrl: string,
  ) {
    const userId = user?.id || user?.sub || user?.userId;
    return this.profileService.uploadAvatar(userId, photoDataUrl);
  }

  /**
   * Suppression de la photo de profil (retour aux initiales).
   */
  @Delete('avatar')
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  async deleteAvatar(@CurrentUser() user: any) {
    const userId = user?.id || user?.sub || user?.userId;
    return this.profileService.deleteAvatar(userId);
  }
}
