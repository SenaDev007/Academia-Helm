import { Module } from '@nestjs/common';
import { MeetingsController } from './meetings.controller';
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
import { DatabaseModule } from '../database/database.module';

/**
 * Module Réunions — Réunions Administratives, Pédagogiques & Parents
 * 
 * Ce module transversal permet de gérer :
 * - Planification des réunions (administratives, pédagogiques, parents)
 * - Gestion des participants
 * - Ordres du jour
 * - Comptes rendus (bilingue FR/EN)
 * - Décisions et suivi
 * - Notifications multicanales
 * - Intégration ORION (KPIs et alertes)
 */
@Module({
  imports: [DatabaseModule],
  controllers: [MeetingsController],
  providers: [
    MeetingsService,
    MeetingParticipantsService,
    MeetingAgendasService,
    MeetingMinutesService,
    MeetingDecisionsService,
    MeetingOrionIntegrationService,
    MeetingMinutesTemplateService,
    MeetingMinutesGenerationService,
    MeetingMinutesPdfService,
    ElectronicSignatureService,
    MeetingMinutesNlpService,
  ],
  exports: [
    MeetingsService,
    MeetingParticipantsService,
    MeetingAgendasService,
    MeetingMinutesService,
    MeetingDecisionsService,
    MeetingOrionIntegrationService,
    MeetingMinutesTemplateService,
    MeetingMinutesGenerationService,
    MeetingMinutesPdfService,
    ElectronicSignatureService,
    MeetingMinutesNlpService,
  ],
})
export class MeetingsModule {}

