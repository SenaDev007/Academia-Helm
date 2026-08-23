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
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EmailService } from './services/email.service';
import { EmailLogService } from './services/email-log.service';
import { InboundEmailService } from './services/inbound-email.service';
import { EmailTrackingService } from './services/email-tracking.service';
import { WhatsAppService } from './services/whatsapp.service';
import { WhatsAppLogService } from './services/whatsapp-log.service';
import { WhatsAppTemplateRegistry } from './services/whatsapp-template.registry';
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
import { WhatsAppLogController } from './whatsapp-log.controller';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { ScheduledEmailController } from './scheduled-email.controller';
import { DatabaseModule } from '../database/database.module';
import { ChatService } from './services/chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { PushNotificationService } from './services/push-notification.service';
import { AnnouncementService } from './services/announcement.service';
import { AnnouncementController } from './announcement.controller';
import { DynamicGroupService } from './services/dynamic-group.service';
import { NotificationPreferencesService } from './services/notification-preferences.service';
import { ScheduledAnnouncementDispatcher } from './services/scheduled-announcement-dispatcher';
import { HelmConnectV2Controller } from './helm-connect-v2.controller';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    // ⭐ JwtModule pour ChatGateway (vérification du JWT lors du handshake Socket.io)
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'your-secret-key-change-in-production'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    CommunicationV2Controller,
    CommunicationPrismaController,
    MessagesPrismaController,
    SchedulingPrismaController,
    AutomationPrismaController,
    TemplatesPrismaController,
    EmailLogController,
    WhatsAppLogController,
    WhatsAppWebhookController,
    ScheduledEmailController,
    // ⭐ Chat (messagerie interne type WhatsApp)
    ChatController,
    // ⭐ Helm Connect — Annonces officielles V1
    AnnouncementController,
    // ⭐ Helm Connect V2 — Dynamic Groups + Notifications + Scheduled Announcements
    HelmConnectV2Controller,
  ],
  providers: [
    EmailService,
    EmailLogService,
    InboundEmailService,
    EmailTrackingService,
    WhatsAppService,
    WhatsAppLogService,
    WhatsAppTemplateRegistry,
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
    // Prisma CRUD services
    CommunicationPrismaService,
    MessagesPrismaService,
    SchedulingPrismaService,
    AutomationPrismaService,
    TemplatesPrismaService,
    // ⭐ Chat (messagerie interne type WhatsApp)
    ChatService,
    ChatGateway,
    PushNotificationService,
    // ⭐ Helm Connect — Annonces officielles V1
    AnnouncementService,
    // ⭐ Helm Connect V2 — Dynamic Groups + Notifications + Scheduled Announcements
    DynamicGroupService,
    NotificationPreferencesService,
    ScheduledAnnouncementDispatcher,
  ],
  exports: [
    EmailService,
    EmailLogService,
    InboundEmailService,
    EmailTrackingService,
    WhatsAppService,
    WhatsAppLogService,
    WhatsAppTemplateRegistry,
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
    // ⭐ Chat exports
    ChatService,
  ],
})
export class CommunicationModule implements OnModuleInit {
  constructor(
    private readonly emailService: EmailService,
    private readonly emailLogService: EmailLogService,
    private readonly emailTrackingService: EmailTrackingService,
    private readonly whatsappService: WhatsAppService,
    private readonly whatsappLogService: WhatsAppLogService,
  ) {}

  /**
   * Injecte EmailLogService + EmailTrackingService dans EmailService pour
   * éviter la circular dependency. EmailService peut alors appeler
   * emailLogService.createLog() et emailTrackingService.injectTracking()
   * sans dépendre statiquement d'eux.
   *
   * De même, injecte WhatsAppLogService dans WhatsAppService pour la
   * traçabilité des messages WhatsApp (mirror du pattern email).
   */
  onModuleInit() {
    this.emailService.setEmailLogService(this.emailLogService);
    this.emailService.setEmailTrackingService(this.emailTrackingService);
    this.whatsappService.setWhatsAppLogService(this.whatsappLogService);
  }
}
