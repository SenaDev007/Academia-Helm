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
  ],
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
    CommunicationSaraService,
    // Prisma CRUD services
    CommunicationPrismaService,
    MessagesPrismaService,
    SchedulingPrismaService,
    AutomationPrismaService,
    TemplatesPrismaService,
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
    CommunicationSaraService,
    CommunicationPrismaService,
    MessagesPrismaService,
    SchedulingPrismaService,
    AutomationPrismaService,
    TemplatesPrismaService,
  ],
})
export class CommunicationModule {}
