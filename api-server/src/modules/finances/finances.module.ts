/**
 * ============================================================================
 * FINANCES MODULE - MODULE FINANCIER
 * ============================================================================
 * 
 * Module pour les opérations financières avec :
 * - Endpoints séparés par module
 * - Services de calcul par niveau
 * - Isolation stricte par tenant + school_level
 * 
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { FinancesCalculationService } from './services/finances-calculation.service';
import { FinancesController } from './finances.controller';
import { CalculationService } from '../../common/services/calculation.service';
import { PaymentsModule } from '../../payments/payments.module';
import { ExpensesModule } from '../../expenses/expenses.module';
import { UsersModule } from '../../users/users.module';
import { AuditLogsModule } from '../../audit-logs/audit-logs.module';

@Module({
  imports: [
    PaymentsModule,
    ExpensesModule,
    UsersModule,
    AuditLogsModule,
  ],
  controllers: [FinancesController],
  providers: [
    FinancesCalculationService,
    CalculationService,
  ],
  exports: [FinancesCalculationService],
})
export class FinancesModule {}

