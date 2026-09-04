/**
 * ============================================================================
 * ANNEX ONBOARDING CONTROLLER — Activation multi-écoles depuis les paramètres
 * ============================================================================
 *
 * POST /onboarding/annex
 *   Réservé aux promoteurs AUTHENTIFIÉS (rôles stratégiques) qui gèrent déjà
 *   au moins une école : crée un draft d'onboarding pour l'ÉCOLE ANNEXE avec
 *   les infos du promoteur pré-remplies depuis la session (source de confiance
 *   — aucune validation d'agent YEHI OR Tech n'est requise, contrairement au
 *   signup public).
 *
 *   Le draft est immédiatement rattaché au plan choisi (selectPlan), puis le
 *   flux EXISTANT de signature de contrat s'applique :
 *     - contrat conforme au document Word (génération + signature numérique)
 *     - marquage de paiement en espèces (intégral ou échéancier de tranches)
 *     - activation : tenant isolé + UserTenant (le promoteur rejoint son
 *       groupe dans available-tenants et la vue stratégique)
 *
 * GET /onboarding/annex/eligibility
 *   Éligibilité multi-écoles du promoteur courant : écoles déjà gérées,
 *   possibilité d'ajout, prix de la prochaine annexe (par école).
 *
 * ⚠️ Contrôleur AUTHENTIFIÉ (pas de @Public) : le JwtAuthGuard global
 *    s'applique. Le périmètre (rôles) est vérifié dans le contrôleur.
 * ============================================================================
 */

import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OnboardingService } from './services/onboarding.service';
import { isStrategicRole } from '../analytics/analytics.service';

const HELM_PLAN_CODES = ['SEED', 'GROW', 'LEAD', 'NETWORK'] as const;

export class CreateAnnexDraftDto {
  /** Nom de l'école annexe (propre à l'établissement). */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  annexName: string;

  /** Ville/quartier de l'annexe (peut différer de l'école principale). */
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  annexCity: string;

  /** Type d'établissement de l'annexe. */
  @IsString()
  @IsIn(['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE', 'MIXTE', 'mixte', 'SCHOOL'])
  schoolType: string;

  /** Téléphone de contact de l'annexe. */
  @IsString()
  @MinLength(6)
  @MaxLength(30)
  phone: string;

  /** Email de contact de l'annexe. */
  @IsEmail()
  email: string;

  /** Plan de l'annexe (détermine ses frais annuels). */
  @IsIn(HELM_PLAN_CODES as unknown as string[])
  planCode: string;

  /** Effectif estimé de l'annexe. */
  @IsInt()
  @Min(0)
  @Max(100000)
  estimatedStudentCount: number;

  /** Option bilingue FR/EN pour l'annexe. */
  @IsOptional()
  @IsBoolean()
  bilingual?: boolean;

  /** Sous-domaine souhaité (optionnel — sinon auto-généré depuis le nom). */
  @IsOptional()
  @IsString()
  @MaxLength(63)
  preferredSubdomain?: string;
}

@Controller('onboarding/annex')
export class AnnexOnboardingController {
  private readonly logger = new Logger(AnnexOnboardingController.name);

  constructor(private readonly onboardingService: OnboardingService) {}

  /** Éligibilité + périmètre courant du promoteur (écoles gérées, prix annexe). */
  @Get('eligibility')
  async getEligibility(@CurrentUser() user: any) {
    if (!isStrategicRole(user)) {
      throw new ForbiddenException(
        "L'activation multi-écoles est réservée aux promoteurs et rôles stratégiques",
      );
    }
    return this.onboardingService.getAnnexEligibility({
      sub: user?.sub || user?.id,
      role: user?.role,
      tenantId: user?.tenantId,
    });
  }

  /** Crée le draft d'onboarding de l'école annexe (promoteur authentifié). */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createAnnexDraft(
    @CurrentUser() user: any,
    @Body() dto: CreateAnnexDraftDto,
  ) {
    if (!isStrategicRole(user)) {
      throw new ForbiddenException(
        "L'activation multi-écoles est réservée aux promoteurs et rôles stratégiques",
      );
    }
    if (user?.sub || user?.id) {
      return this.onboardingService.createAnnexDraft(
        {
          userId: user.sub || user.id,
          email: user?.email,
          firstName: user?.firstName,
          lastName: user?.lastName,
        },
        {
          annexName: dto.annexName,
          annexCity: dto.annexCity,
          schoolType: dto.schoolType,
          phone: dto.phone,
          email: dto.email,
          planCode: dto.planCode,
          estimatedStudentCount: dto.estimatedStudentCount,
          bilingual: dto.bilingual || false,
          preferredSubdomain: dto.preferredSubdomain,
        },
      );
    }
    throw new BadRequestException('Session invalide — identité du promoteur introuvable');
  }
}
