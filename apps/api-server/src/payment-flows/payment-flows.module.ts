import { Module } from '@nestjs/common';
import { PaymentFlowsService } from './payment-flows.service';
import { PaymentFlowsController } from './payment-flows.controller';
import { PaymentFlowsRepository, SchoolPaymentAccountsRepository } from './payment-flows.repository';
import { FedapayService } from './providers/fedapay.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    AuditLogsModule,
    FinanceModule,
  ],
  controllers: [PaymentFlowsController],
  providers: [
    PaymentFlowsService,
    PaymentFlowsRepository,
    SchoolPaymentAccountsRepository,
    FedapayService,
  ],
  exports: [PaymentFlowsService, PaymentFlowsRepository],
})
export class PaymentFlowsModule {}

