import { Module, forwardRef } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { PricingController } from './controllers/pricing.controller';
import { PricingAdminController } from './controllers/pricing-admin.controller';
import { SubscriptionLifecycleController } from './subscription-lifecycle.controller';
import { FeexPayController } from './feexpay.controller';
import { SubscriptionService } from './services/subscription.service';
import { SubscriptionLifecycleService } from './services/subscription-lifecycle.service';
import { FeexPayService } from './services/feexpay.service';
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
    CommunicationModule,
    AuthModule,
    OrionModule,
    forwardRef(() => OnboardingModule),
  ],
  controllers: [BillingController, PricingController, PricingAdminController, SubscriptionLifecycleController, FeexPayController],
  providers: [
    SubscriptionService,
    SubscriptionLifecycleService,
    FeexPayService,
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
    SubscriptionLifecycleService,
    FeexPayService,
    BillingReminderService,
    PricingService,
    FedaPayService,
    BillingService,
    BillingGuard,
  ],
})
export class BillingModule {}
