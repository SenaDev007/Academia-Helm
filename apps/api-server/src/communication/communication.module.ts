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

@Module({
  imports: [ConfigModule],
  providers: [EmailService, WhatsAppService, SmsService],
  exports: [EmailService, WhatsAppService, SmsService],
})
export class CommunicationModule {}
