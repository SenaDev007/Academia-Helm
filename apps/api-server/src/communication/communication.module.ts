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

@Module({
  imports: [ConfigModule],
  providers: [EmailService, WhatsAppService, SmsService, VoiceService],
  exports: [EmailService, WhatsAppService, SmsService, VoiceService],
})
export class CommunicationModule {}
