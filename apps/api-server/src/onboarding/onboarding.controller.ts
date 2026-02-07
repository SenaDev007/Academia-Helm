/**
 * ============================================================================
 * ONBOARDING CONTROLLER - WORKFLOW ONBOARDING ÉCOLE
 * ============================================================================
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { OnboardingService } from './services/onboarding.service';
import { OtpService } from './services/otp.service';
import { CreateDraftDto } from './dto/create-draft.dto';
import { AddPromoterDto } from './dto/add-promoter.dto';
import { SelectPlanDto } from './dto/select-plan.dto';

@Controller('onboarding')
@Public()
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly otpService: OtpService,
  ) {}

  /**
   * PHASE 1 : Créer un draft d'onboarding
   */
  @Post('draft')
  @HttpCode(HttpStatus.CREATED)
  async createDraft(@Body() dto: CreateDraftDto) {
    return this.onboardingService.createDraft(dto);
  }

  /**
   * PHASE 2 : Ajouter les infos du promoteur
   */
  @Post('draft/:draftId/promoter')
  @HttpCode(HttpStatus.OK)
  async addPromoter(
    @Param('draftId') draftId: string,
    @Body() dto: AddPromoterDto,
  ) {
    return this.onboardingService.addPromoterInfo(draftId, dto);
  }

  /**
   * PHASE 3 : Sélectionner le plan
   */
  @Post('draft/:draftId/plan')
  @HttpCode(HttpStatus.OK)
  async selectPlan(
    @Param('draftId') draftId: string,
    @Body() dto: SelectPlanDto,
  ) {
    return this.onboardingService.selectPlan(draftId, dto);
  }

  /**
   * PHASE 4 : Créer une session de paiement
   */
  @Post('draft/:draftId/payment')
  @HttpCode(HttpStatus.OK)
  async createPaymentSession(@Param('draftId') draftId: string) {
    return this.onboardingService.createPaymentSession(draftId);
  }

  /**
   * Vérifier si un draft existe pour un email
   */
  @Get('draft/check/:email')
  async checkDraftByEmail(@Param('email') email: string) {
    const draft = await this.onboardingService.checkDraftByEmail(email);
    return {
      exists: !!draft,
      draft: draft || null,
    };
  }

  /**
   * Récupérer un draft
   */
  @Get('draft/:draftId')
  async getDraft(@Param('draftId') draftId: string) {
    return this.onboardingService.getDraft(draftId);
  }

  /**
   * Supprimer un draft
   */
  @Post('draft/:draftId/delete')
  @HttpCode(HttpStatus.OK)
  async deleteDraft(@Param('draftId') draftId: string) {
    return this.onboardingService.deleteDraft(draftId);
  }

  /**
   * Générer et envoyer un code OTP
   */
  @Post('draft/:draftId/otp/generate')
  @HttpCode(HttpStatus.OK)
  async generateOTP(
    @Param('draftId') draftId: string,
    @Body() body: { phone: string; method?: 'sms' | 'voice' | 'whatsapp' },
  ) {
    const method = body.method || 'sms';
    return this.otpService.generateAndSendOTP(draftId, body.phone, method);
  }

  /**
   * Vérifier un code OTP
   */
  @Post('draft/:draftId/otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOTP(
    @Param('draftId') draftId: string,
    @Body() body: { phone: string; code: string },
  ) {
    const isValid = await this.otpService.verifyOTP(draftId, body.phone, body.code);
    return {
      valid: isValid,
      message: isValid ? 'Code OTP valide' : 'Code OTP invalide ou expiré',
    };
  }
}
