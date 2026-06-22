/**
 * ============================================================================
 * COMMUNICATION MODULE
 * ============================================================================
 * 
 * Module pour les services de communication (Email, WhatsApp, SMS)
 * + Traçabilité catégorisée (EmailLogService) + Inbound (Volet 2)
 * 
 * ============================================================================
 */

import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './services/email.service';
import { EmailLogService } from './services/email-log.service';
import { InboundEmailService } from './services/inbound-email.service';
import { EmailTrackingService } from './services/email-tracking.service';
import { WhatsAppService } from './services/whatsapp.service';
import { SmsService } from './services/sms.service';
import { VoiceService } from './services/voice.service';
import { CommunicationDashboardService } from './services/communication-dashboard.service';
import { InternalMessagingService } from './services/internal-messaging.service';
import { AnnouncementsServiceV2 } from './services/announcements.service';
import { TemplateService } from './services/template.service';
import { CommunicationOrionService } from './services/communication-orion.service';
import { CommunicationSaraService } from './services/communication-sara.service';
import { ScheduledEmailService } from './services/scheduled-email.service';
import { ScheduledEmailDispatcherService } from './services/scheduled-email-dispatcher.service';
import { CommunicationV2Controller } from './communication-v2.controller';
import { CommunicationPrismaController } from './communication-prisma.controller';
import { CommunicationPrismaService } from './communication-prisma.service';
import { MessagesPrismaController } from './messages-prisma.controller';
import { MessagesPrismaService } from './messages-prisma.service';
import { SchedulingPrismaController } from './scheduling-prisma.controller';
import { SchedulingPrismaService } from './scheduling-prisma.service';
import { AutomationPrismaController } from './automation-prisma.controller';
import { AutomationPrismaService } from './automation-prisma.service';
import { TemplatesPrismaController } from './templates-prisma.controller';
import { TemplatesPrismaService } from './templates-prisma.service';
import { EmailLogController } from './email-log.controller';
import { ScheduledEmailController } from './scheduled-email.controller';
import { StorageService } from '../common/services/storage.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [
    CommunicationV2Controller,
    CommunicationPrismaController,
    MessagesPrismaController,
    SchedulingPrismaController,
    AutomationPrismaController,
    TemplatesPrismaController,
    EmailLogController,
    ScheduledEmailController,
  ],
  providers: [
    EmailService, 
    EmailLogService,
    InboundEmailService,
    EmailTrackingService,
    WhatsAppService, 
    SmsService, 
    VoiceService,
    CommunicationDashboardService,
    InternalMessagingService,
    AnnouncementsServiceV2,
    TemplateService,
    CommunicationOrionService,
    CommunicationSaraService,
    // Scheduled emails (programmation d'envoi à date/heure précise)
    ScheduledEmailService,
    ScheduledEmailDispatcherService,
    StorageService,
    // Prisma CRUD services
    CommunicationPrismaService,
    MessagesPrismaService,
    SchedulingPrismaService,
    AutomationPrismaService,
    TemplatesPrismaService,
  ],
  exports: [
    EmailService, 
    EmailLogService,
    InboundEmailService,
    EmailTrackingService,
    WhatsAppService, 
    SmsService, 
    VoiceService,
    CommunicationDashboardService,
    InternalMessagingService,
    AnnouncementsServiceV2,
    TemplateService,
    CommunicationOrionService,
    CommunicationSaraService,
    ScheduledEmailService,
    CommunicationPrismaService,
    MessagesPrismaService,
    SchedulingPrismaService,
    AutomationPrismaService,
    TemplatesPrismaService,
  ],
})
export class CommunicationModule implements OnModuleInit {
  constructor(
    private readonly emailService: EmailService,
    private readonly emailLogService: EmailLogService,
    private readonly emailTrackingService: EmailTrackingService,
  ) {}

  /**
   * Injecte EmailLogService + EmailTrackingService dans EmailService pour
   * éviter la circular dependency. EmailService peut alors appeler
   * emailLogService.createLog() et emailTrackingService.injectTracking()
   * sans dépendre statiquement d'eux.
   */
  onModuleInit() {
    this.emailService.setEmailLogService(this.emailLogService);
    this.emailService.setEmailTrackingService(this.emailTrackingService);
  }
}
