import { Module, forwardRef } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { PricingController } from './controllers/pricing.controller';
import { PricingAdminController } from './controllers/pricing-admin.controller';
import { SubscriptionLifecycleController } from './subscription-lifecycle.controller';
// ⭐ FedaPay supprimé — seul FedaPay est conservé comme passerelle de paiement
import { SubscriptionService } from './services/subscription.service';
import { SubscriptionLifecycleService } from './services/subscription-lifecycle.service';
import { StudentCountVerifierService } from './services/student-count-verifier.service';
import { BillingReminderService } from './services/billing-reminder.service';
import { SubscriptionPlanSeedService } from './services/subscription-plan-seed.service';
import { PricingConfigSeedService } from './services/pricing-config-seed.service';
import { FedaPayService } from './services/fedapay.service';
import { PricingService } from './services/pricing.service';
import { BillingService } from './billing.service';
import { BillingGuard } from './guards/billing.guard';
import { InvoiceService } from './services/invoice.service';
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
  controllers: [BillingController, PricingController, PricingAdminController, SubscriptionLifecycleController],
  providers: [
    SubscriptionService,
    SubscriptionLifecycleService,
    StudentCountVerifierService,
    BillingReminderService,
    SubscriptionPlanSeedService,
    PricingConfigSeedService,
    FedaPayService,
    BillingService,
    PricingService,
    BillingGuard,
    InvoiceService,
  ],
  exports: [
    SubscriptionService,
    SubscriptionLifecycleService,
    StudentCountVerifierService,
    BillingReminderService,
    PricingService,
    FedaPayService,
    BillingService,
    BillingGuard,
    InvoiceService,
  ],
})
export class BillingModule {}
