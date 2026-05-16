/**
 * ============================================================================
 * COMMUNICATION MODULE
 * ============================================================================
 * 
 * Module pour les services de communication (Email, WhatsApp, SMS)
 * 
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './services/email.service';
import { WhatsAppService } from './services/whatsapp.service';
import { SmsService } from './services/sms.service';
import { VoiceService } from './services/voice.service';
import { CommunicationDashboardService } from './services/communication-dashboard.service';
import { InternalMessagingService } from './services/internal-messaging.service';
import { AnnouncementsServiceV2 } from './services/announcements.service';
import { TemplateService } from './services/template.service';
import { CommunicationOrionService } from './services/communication-orion.service';
import { CommunicationSaraService } from './services/communication-sara.service';
import { CommunicationV2Controller } from './communication-v2.controller';

@Module({
  imports: [ConfigModule],
  controllers: [CommunicationV2Controller],
  providers: [
    EmailService, 
    WhatsAppService, 
    SmsService, 
    VoiceService,
    CommunicationDashboardService,
    InternalMessagingService,
    AnnouncementsServiceV2,
    TemplateService,
    CommunicationOrionService,
    CommunicationSaraService
  ],
  exports: [
    EmailService, 
    WhatsAppService, 
    SmsService, 
    VoiceService,
    CommunicationDashboardService,
    InternalMessagingService,
    AnnouncementsServiceV2,
    TemplateService,
    CommunicationOrionService,
    CommunicationSaraService
  ],
})
export class CommunicationModule {}
