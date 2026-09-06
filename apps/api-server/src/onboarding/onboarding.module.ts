import { Module, forwardRef } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { AnnexOnboardingController } from './annex-onboarding.controller';
import { OnboardingService } from './services/onboarding.service';
import { OtpService } from './services/otp.service';
import { DraftCleanupService } from './services/draft-cleanup.service';
import { ContractGenerationService } from './contract-generation.service';
import { BillingReceiptService } from './billing-receipt.service';
import { ContractController } from './contract.controller';
import { BillingModule } from '../billing/billing.module';
import { OrionModule } from '../orion/orion.module';
import { CommonModule } from '../common/common.module';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [
    forwardRef(() => BillingModule), // Pour PricingService
    OrionModule, // Pour OrionAlertsService (émission d'événements)
    CommonModule, // Pour SubdomainService
    CommunicationModule, // Pour WhatsAppService et SmsService
  ],
  controllers: [OnboardingController, ContractController, AnnexOnboardingController],
  providers: [OnboardingService, OtpService, DraftCleanupService, ContractGenerationService, BillingReceiptService],
  exports: [OnboardingService, OtpService, ContractGenerationService, BillingReceiptService],
})
export class OnboardingModule {}
