import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './services/onboarding.service';
import { OtpService } from './services/otp.service';
import { DraftCleanupService } from './services/draft-cleanup.service';
import { BillingModule } from '../billing/billing.module';
import { OrionModule } from '../orion/orion.module';
import { CommonModule } from '../common/common.module';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Pour les tâches cron de nettoyage automatique
    forwardRef(() => BillingModule), // Pour PricingService
    OrionModule, // Pour OrionAlertsService (émission d'événements)
    CommonModule, // Pour SubdomainService
    CommunicationModule, // Pour WhatsAppService et SmsService
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService, OtpService, DraftCleanupService],
  exports: [OnboardingService, OtpService],
})
export class OnboardingModule {}
