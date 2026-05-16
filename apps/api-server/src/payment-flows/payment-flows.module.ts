import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentFlowsService } from './payment-flows.service';
import { PaymentFlowsController } from './payment-flows.controller';
import { PaymentFlowsRepository, SchoolPaymentAccountsRepository } from './payment-flows.repository';
import { PaymentFlow } from './entities/payment-flow.entity';
import { SchoolPaymentAccount } from './entities/school-payment-account.entity';
import { FedapayService } from './providers/fedapay.service';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentFlow, SchoolPaymentAccount]),
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

