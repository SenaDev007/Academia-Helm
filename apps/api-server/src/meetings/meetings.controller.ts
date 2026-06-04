import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MeetingsService } from './services/meetings.service';
import { MeetingParticipantsService } from './services/meeting-participants.service';
import { MeetingAgendasService } from './services/meeting-agendas.service';
import { MeetingMinutesService } from './services/meeting-minutes.service';
import { MeetingDecisionsService } from './services/meeting-decisions.service';
import { MeetingOrionIntegrationService } from './services/meeting-orion-integration.service';
import { MeetingMinutesTemplateService } from './services/meeting-minutes-template.service';
import { MeetingMinutesGenerationService } from './services/meeting-minutes-generation.service';
import { MeetingMinutesPdfService } from './services/meeting-minutes-pdf.service';
import { ElectronicSignatureService } from './services/electronic-signature.service';
import { MeetingMinutesNlpService } from './services/meeting-minutes-nlp.service';

/**
 * Controller pour le Module Réunions
 *
 * ⚠️ IMPORTANT: Route order matters in NestJS. Static routes MUST be defined
 * BEFORE parameterized routes (e.g., @Get(':id')) to avoid route conflicts.
 * All specific paths like /templates, /orion/*, /decisions/*, /signatures/*,
 * /nlp/* must come before @Get(':id') which would otherwise catch them.
 */
@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly participantsService: MeetingParticipantsService,
    private readonly agendasService: MeetingAgendasService,
    private readonly minutesService: MeetingMinutesService,
    private readonly decisionsService: MeetingDecisionsService,
    private readonly orionIntegrationService: MeetingOrionIntegrationService,
    private readonly templateService: MeetingMinutesTemplateService,
    private readonly generationService: MeetingMinutesGenerationService,
    private readonly pdfService: MeetingMinutesPdfService,
    private readonly signatureService: ElectronicSignatureService,
    private readonly nlpService: MeetingMinutesNlpService,
  ) {}

  // ============================================================================
  // RÉUNIONS — Static list routes (MUST be before :id)
  // ============================================================================

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('meetingType') meetingType?: string,
    @Query('scopeType') scopeType?: string,
    @Query('scopeId') scopeId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.meetingsService.findAll(tenantId, {
      academicYearId,
      meetingType,
      scopeType,
      scopeId,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('upcoming')
  async getUpcoming(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.meetingsService.getUpcoming(tenantId, academicYearId);
  }

  @Get('history')
  async getHistory(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.meetingsService.getHistory(tenantId, academicYearId);
  }

  // ============================================================================
  // INTÉGRATION ORION — Static routes (MUST be before :id)
  // ============================================================================

  @Get('orion/kpis')
  async getOrionKPIs(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.orionIntegrationService.getMeetingKPIs(tenantId, academicYearId);
  }

  @Get('orion/alerts')
  async getOrionAlerts(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.orionIntegrationService.generateOrionAlerts(tenantId, academicYearId);
  }

  // ============================================================================
  // DÉCISIONS — Static routes (MUST be before :id)
  // ============================================================================

  @Get('decisions/overdue')
  async getOverdueDecisions(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.decisionsService.getOverdueDecisions(tenantId, academicYearId);
  }

  @Get('decisions/stats')
  async getDecisionStats(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.decisionsService.getDecisionStats(tenantId, academicYearId);
  }

  // ============================================================================
  // TEMPLATES DE COMPTES RENDUS — Static routes (MUST be before :id)
  // ============================================================================

  @Get('templates')
  async getTemplates(
    @TenantId() tenantId: string,
    @Query('meetingType') meetingType?: string,
    @Query('includeSystem') includeSystem?: string,
  ) {
    return this.templateService.findAll(
      tenantId,
      meetingType,
      includeSystem !== 'false',
    );
  }

  @Get('templates/system/:meetingType')
  async getSystemTemplate(
    @TenantId() tenantId: string,
    @Param('meetingType') meetingType: string,
  ) {
    return this.templateService.getSystemTemplate(meetingType);
  }

  @Get('templates/:id')
  async getTemplate(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.templateService.findOne(id, tenantId);
  }

  @Post('templates')
  async createTemplate(
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.templateService.create(tenantId, data);
  }

  @Put('templates/:id')
  async updateTemplate(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.templateService.update(id, tenantId, data);
  }

  @Delete('templates/:id')
  async deleteTemplate(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.templateService.delete(id, tenantId);
  }

  @Post('templates/initialize')
  async initializeTemplates(@TenantId() tenantId: string) {
    return this.templateService.initializeSystemTemplates(tenantId);
  }

  // ============================================================================
  // SIGNATURES ÉLECTRONIQUES — Static routes (MUST be before :id)
  // ============================================================================

  @Get('signatures/stats')
  async getSignatureStats(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.signatureService.getSignatureStats(tenantId, academicYearId);
  }

  @Post('signatures/:signatureId/verify')
  async verifySignature(
    @Param('signatureId') signatureId: string,
    @TenantId() tenantId: string,
  ) {
    return this.signatureService.verifySignature(signatureId, tenantId);
  }

  // ============================================================================
  // NLP & EXTRACTION DE DONNÉES — Static routes (MUST be before :id)
  // ============================================================================

  @Get('nlp/recurring-themes')
  async getRecurringThemes(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.nlpService.detectRecurringThemes(tenantId, academicYearId);
  }

  @Get('nlp/orion-insights')
  async getOrionInsights(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.nlpService.generateOrionInsights(tenantId, academicYearId);
  }

  // ============================================================================
  // RÉUNIONS — Parameterized routes (:id) — MUST be AFTER all static routes
  // ============================================================================

  @Get(':id')
  async findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.meetingsService.findOne(id, tenantId);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.meetingsService.create(tenantId, data, user.id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.meetingsService.update(id, tenantId, data);
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { reason: string },
  ) {
    return this.meetingsService.cancel(id, tenantId, body.reason, user.id);
  }

  @Post(':id/mark-held')
  async markAsHeld(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.meetingsService.markAsHeld(id, tenantId);
  }

  // ============================================================================
  // PARTICIPANTS
  // ============================================================================

  @Get(':id/participants')
  async getParticipants(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.participantsService.findByMeeting(id, tenantId);
  }

  @Post(':id/participants')
  async addParticipant(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.participantsService.addParticipant(id, tenantId, data, user.id);
  }

  @Delete(':id/participants/:participantId')
  async removeParticipant(
    @Param('id') id: string,
    @Param('participantId') participantId: string,
    @TenantId() tenantId: string,
  ) {
    return this.participantsService.removeParticipant(id, participantId, tenantId);
  }

  @Put(':id/participants/:participantId/attendance')
  async updateAttendance(
    @Param('id') id: string,
    @Param('participantId') participantId: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.participantsService.updateAttendance(id, participantId, tenantId, data);
  }

  @Get(':id/participants/attendance-rate')
  async getAttendanceRate(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.participantsService.calculateAttendanceRate(id, tenantId);
  }

  // ============================================================================
  // ORDRES DU JOUR
  // ============================================================================

  @Get(':id/agendas')
  async getAgendas(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.agendasService.findByMeeting(id, tenantId);
  }

  @Post(':id/agendas')
  async addAgendaItem(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.agendasService.addAgendaItem(id, tenantId, data);
  }

  @Put(':id/agendas/:agendaId')
  async updateAgendaItem(
    @Param('id') id: string,
    @Param('agendaId') agendaId: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.agendasService.updateAgendaItem(agendaId, id, tenantId, data);
  }

  @Delete(':id/agendas/:agendaId')
  async deleteAgendaItem(
    @Param('id') id: string,
    @Param('agendaId') agendaId: string,
    @TenantId() tenantId: string,
  ) {
    return this.agendasService.deleteAgendaItem(agendaId, id, tenantId);
  }

  @Post(':id/agendas/reorder')
  async reorderAgendas(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { agendaItemIds: string[] },
  ) {
    return this.agendasService.reorderAgendaItems(id, tenantId, body.agendaItemIds);
  }

  // ============================================================================
  // COMPTES RENDUS
  // ============================================================================

  @Get(':id/minutes')
  async getMinutes(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.minutesService.findByMeeting(id, tenantId);
  }

  @Post(':id/minutes')
  async createOrUpdateMinutes(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() data: any,
  ) {
    return this.minutesService.createOrUpdate(id, tenantId, data, user.id);
  }

  @Post(':id/minutes/validate')
  async validateMinutes(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.minutesService.validate(id, tenantId, user.id);
  }

  @Post(':id/minutes/unvalidate')
  async unvalidateMinutes(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.minutesService.unvalidate(id, tenantId, user.id);
  }

  @Post(':id/minutes/generate')
  async generateFromTemplate(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { templateId?: string },
  ) {
    return this.generationService.generateFromTemplate(id, tenantId, body.templateId, user.id);
  }

  @Get(':id/minutes/pdf')
  async getPdf(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    const minutes = await this.minutesService.findByMeeting(id, tenantId);
    if (!minutes || !minutes.id) {
      throw new Error('Minutes not found');
    }
    return this.pdfService.getPdf(minutes.id, tenantId);
  }

  @Post(':id/minutes/generate-pdf')
  async generatePdf(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    const minutes = await this.minutesService.findByMeeting(id, tenantId);
    if (!minutes || !minutes.id) {
      throw new Error('Minutes not found');
    }
    return this.pdfService.generatePdf(minutes.id, tenantId);
  }

  @Get(':id/minutes/versions')
  async getVersionHistory(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    const minutes = await this.minutesService.findByMeeting(id, tenantId);
    if (!minutes || !minutes.id) {
      throw new Error('Minutes not found');
    }
    return this.generationService.getVersionHistory(minutes.id, tenantId);
  }

  @Post(':id/minutes/versions')
  async createVersion(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { changes: string },
  ) {
    const minutes = await this.minutesService.findByMeeting(id, tenantId);
    if (!minutes || !minutes.id) {
      throw new Error('Minutes not found');
    }
    return this.generationService.createVersion(minutes.id, tenantId, body.changes, user.id);
  }

  // ============================================================================
  // DÉCISIONS (per-meeting)
  // ============================================================================

  @Get(':id/decisions')
  async getDecisions(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.decisionsService.findByMeeting(id, tenantId);
  }

  @Post(':id/decisions')
  async createDecision(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.decisionsService.create(id, tenantId, data);
  }

  @Put(':id/decisions/:decisionId')
  async updateDecision(
    @Param('id') id: string,
    @Param('decisionId') decisionId: string,
    @TenantId() tenantId: string,
    @Body() data: any,
  ) {
    return this.decisionsService.update(decisionId, id, tenantId, data);
  }

  @Delete(':id/decisions/:decisionId')
  async deleteDecision(
    @Param('id') id: string,
    @Param('decisionId') decisionId: string,
    @TenantId() tenantId: string,
  ) {
    return this.decisionsService.delete(decisionId, id, tenantId);
  }

  // ============================================================================
  // SIGNATURES ÉLECTRONIQUES (per-meeting)
  // ============================================================================

  @Post(':id/minutes/sign')
  async signMinutes(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { signatureType?: string; signatureData?: string },
    @Request() req: any,
  ) {
    const minutes = await this.minutesService.findByMeeting(id, tenantId);
    if (!minutes || !minutes.id) {
      throw new Error('Minutes not found');
    }

    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.signatureService.sign(
      minutes.id,
      tenantId,
      user.id,
      body.signatureType || 'VALIDATION',
      body.signatureData,
      ipAddress,
      userAgent,
    );
  }

  @Get(':id/minutes/signatures')
  async getSignatures(@Param('id') id: string, @TenantId() tenantId: string) {
    const minutes = await this.minutesService.findByMeeting(id, tenantId);
    if (!minutes || !minutes.id) {
      throw new Error('Minutes not found');
    }
    return this.signatureService.getSignatures(minutes.id, tenantId);
  }

  // ============================================================================
  // NLP & EXTRACTION DE DONNÉES (per-meeting)
  // ============================================================================

  @Get(':id/minutes/nlp/entities')
  async extractEntities(@Param('id') id: string, @TenantId() tenantId: string) {
    const minutes = await this.minutesService.findByMeeting(id, tenantId);
    if (!minutes || !minutes.id) {
      throw new Error('Minutes not found');
    }
    return this.nlpService.extractEntities(minutes.id, tenantId);
  }

  @Get(':id/minutes/nlp/sentiment')
  async analyzeSentiment(@Param('id') id: string, @TenantId() tenantId: string) {
    const minutes = await this.minutesService.findByMeeting(id, tenantId);
    if (!minutes || !minutes.id) {
      throw new Error('Minutes not found');
    }
    return this.nlpService.analyzeSentiment(minutes.id, tenantId);
  }
}
