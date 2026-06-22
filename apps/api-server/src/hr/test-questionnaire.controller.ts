/**
 * ============================================================================
 * TEST QUESTIONNAIRE CONTROLLER
 * ============================================================================
 *
 * Endpoints pour gérer les questionnaires de test en ligne :
 *
 * Recruteur (JWT + Tenant) :
 *   POST   /hr/recruitment/questionnaires           — Créer un questionnaire
 *   GET    /hr/recruitment/questionnaires            — Lister les questionnaires
 *   GET    /hr/recruitment/questionnaires/:id        — Détail questionnaire
 *   PUT    /hr/recruitment/questionnaires/:id        — Modifier
 *   PUT    /hr/recruitment/questionnaires/:id/publish — Publier
 *   DELETE /hr/recruitment/questionnaires/:id        — Supprimer
 *   POST   /hr/recruitment/questionnaires/:id/send   — Envoyer au candidat
 *   GET    /hr/recruitment/questionnaires/:id/responses — Réponses reçues
 *   GET    /hr/recruitment/test-responses/:id        — Détail d'une réponse
 *   PUT    /hr/recruitment/test-responses/:id/score  — Noter manuellement
 *
 * Public (candidat, pas de JWT) :
 *   GET    /tests-public/:token/start   — Démarrer le test (retourne questions)
 *   POST   /tests-public/:token/submit  — Soumettre les réponses
 * ============================================================================
 */

import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { TestQuestionnaireService, CreateQuestionnaireDto, UpdateQuestionnaireDto, SendQuestionnaireDto, SubmitResponseDto } from './services/test-questionnaire.service';

@Controller('hr/recruitment')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TestQuestionnaireController {
  constructor(private readonly service: TestQuestionnaireService) {}

  // ─── CRUD Questionnaires ────────────────────────────────────────────────────

  @Post('questionnaires')
  async create(
    @GetTenant() tenant: any,
    @Body() dto: CreateQuestionnaireDto,
    @Query('testId') testId?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    return this.service.createQuestionnaire(tid, testId || null, dto);
  }

  @Get('questionnaires')
  async list(
    @GetTenant() tenant: any,
    @Query('testId') testId?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    return this.service.listQuestionnaires(tid, testId);
  }

  @Get('questionnaires/:id')
  async getOne(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    return this.service.getQuestionnaire(id, tid);
  }

  @Put('questionnaires/:id')
  async update(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() dto: UpdateQuestionnaireDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    return this.service.updateQuestionnaire(id, tid, dto);
  }

  @Put('questionnaires/:id/publish')
  async publish(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    return this.service.publishQuestionnaire(id, tid);
  }

  @Delete('questionnaires/:id')
  async delete(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    await this.service.deleteQuestionnaire(id, tid);
    return { success: true };
  }

  // ─── Envoi au candidat ──────────────────────────────────────────────────────

  @Post('questionnaires/:id/send')
  async send(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() dto: SendQuestionnaireDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    return this.service.sendToCandidate(id, tid, dto.candidateId, dto.applicationId);
  }

  // ─── Réponses reçues ────────────────────────────────────────────────────────

  @Get('questionnaires/:id/responses')
  async listResponses(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    return this.service.listResponses(id, tid);
  }

  @Get('test-responses/:id')
  async getResponse(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    return this.service.getResponse(id, tid);
  }

  @Put('test-responses/:id/score')
  async scoreResponse(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: { recruiterScore: number; recruiterFeedback?: string },
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) throw new BadRequestException('Tenant ID requis');
    return this.service.scoreResponse(id, tid, body.recruiterScore, body.recruiterFeedback);
  }
}

// ─── Controller PUBLIC (candidat, pas de JWT) ─────────────────────────────

@Controller('tests-public')
export class TestPublicController {
  constructor(private readonly service: TestQuestionnaireService) {}

  @Public()
  @Get(':token/start')
  async startTest(@Param('token') token: string) {
    return this.service.startTest(token);
  }

  @Public()
  @Post(':token/submit')
  async submitTest(
    @Param('token') token: string,
    @Body() dto: SubmitResponseDto,
  ) {
    return this.service.submitTest(token, dto);
  }
}
