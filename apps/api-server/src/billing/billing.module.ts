import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BillingController } from './billing.controller';
import { PricingController } from './controllers/pricing.controller';
import { PricingAdminController } from './controllers/pricing-admin.controller';
import { SubscriptionService } from './services/subscription.service';
import { BillingReminderService } from './services/billing-reminder.service';
import { SubscriptionPlanSeedService } from './services/subscription-plan-seed.service';
import { PricingConfigSeedService } from './services/pricing-config-seed.service';
import { FedaPayService } from './services/fedapay.service';
import { PricingService } from './services/pricing.service';
import { BillingService } from './billing.service';
import { BillingGuard } from './guards/billing.guard';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { CommunicationModule } from '../communication/communication.module';
import { AuthModule } from '../auth/auth.module';
import { OrionModule } from '../orion/orion.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CommunicationModule, // Pour EmailService et WhatsAppService
    AuthModule, // Pour SmsService
    OrionModule, // Pour OrionAlertsService (intégration ORION)
    forwardRef(() => OnboardingModule), // Pour utiliser OnboardingService dans FedaPayService
  ],
  controllers: [BillingController, PricingController, PricingAdminController],
  // FedaPayService avant BillingService : ordre cohérent avec la dépendance (Billing → FedaPay en DI).
  providers: [
    SubscriptionService,
    BillingReminderService,
    SubscriptionPlanSeedService,
    PricingConfigSeedService,
    FedaPayService,
    BillingService,
    PricingService,
    BillingGuard,
  ],
  exports: [
    SubscriptionService,
    BillingReminderService,
    PricingService,
    FedaPayService,
    BillingService,
    BillingGuard,
  ],
})
export class BillingModule {}
