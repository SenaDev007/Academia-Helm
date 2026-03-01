/**
 * ============================================================================
 * FINANCE MODULE - MODULE 4
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { FeesPrismaService } from './fees-prisma.service';
import { PaymentsPrismaService } from './payments-prisma.service';
import { ExpensesPrismaService } from './expenses-prisma.service';
import { CollectionPrismaService } from './collection-prisma.service';
import { TreasuryPrismaService } from './treasury-prisma.service';
import { FeesPrismaController } from './fees-prisma.controller';
import { PaymentsPrismaController } from './payments-prisma.controller';
import { ExpensesPrismaController } from './expenses-prisma.controller';
import { CollectionPrismaController } from './collection-prisma.controller';
import { TreasuryPrismaController } from './treasury-prisma.controller';
import { DatabaseModule } from '../database/database.module';
import { SettingsModule } from '../settings/settings.module';
// Sous-modules Finance (config frais, comptes, encaissements, recouvrement)
import { FeeStructureController } from './fee-structure.controller';
import { FeeStructureService } from './fee-structure.service';
import { StudentAccountController } from './student-account.controller';
import { StudentAccountService } from './student-account.service';
import { FinanceTransactionController } from './finance-transaction.controller';
import { FinanceTransactionService } from './finance-transaction.service';
import { RecoveryReminderController } from './recovery-reminder.controller';
import { RecoveryReminderService } from './recovery-reminder.service';
// Module 4 - Frais & Priorité de Paiement
import { PaymentAllocationService } from './payment-allocation.service';
import { FeeInstallmentService } from './fee-installment.service';
import { PaymentsPrismaEnhancedService } from './payments-prisma-enhanced.service';
import { PaymentAllocationController } from './payment-allocation.controller';
import { FeeInstallmentController } from './fee-installment.controller';
import { PaymentsEnhancedController } from './payments-enhanced.controller';
// Module 4 - Recouvrement & Reçus
import { CollectionCaseService } from './collection-case.service';
import { ReceiptGenerationService } from './receipt-generation.service';
import { ReceiptNotificationService } from './receipt-notification.service';
import { FinanceOrionService } from './finance-orion.service';
import { CollectionCaseController } from './collection-case.controller';
import { ReceiptGenerationController } from './receipt-generation.controller';
import { ReceiptNotificationController } from './receipt-notification.controller';
import { FinanceOrionController } from './finance-orion.controller';
import { PublicReceiptController } from './public-receipt.controller';
// Module 4 - Régimes tarifaires & Arriérés
import { FeeRegimeService } from './fee-regime.service';
import { StudentFeeProfileService } from './student-fee-profile.service';
import { StudentArrearService } from './student-arrear.service';
import { FeeRegimeController } from './fee-regime.controller';
import { StudentFeeProfileController } from './student-fee-profile.controller';
import { StudentArrearController } from './student-arrear.controller';
// Sous-modules 5–8
import { FinanceExpenseService } from './finance-expense.service';
import { FinanceExpenseController } from './finance-expense.controller';
import { FinanceDailyClosureService } from './finance-daily-closure.service';
import { FinanceDailyClosureController } from './finance-daily-closure.controller';
import { FinancialSettingsService } from './financial-settings.service';
import { FinancialSettingsController } from './financial-settings.controller';
import { FinanceReportsService } from './finance-reports.service';
import { FinanceReportsController } from './finance-reports.controller';
import { FinanceAuditController } from './finance-audit.controller';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot(), DatabaseModule, SettingsModule],
  controllers: [
    FeeStructureController,
    StudentAccountController,
    FinanceTransactionController,
    RecoveryReminderController,
    FeesPrismaController,
    PaymentsPrismaController,
    ExpensesPrismaController,
    CollectionPrismaController,
    TreasuryPrismaController,
    // Module 4 - Frais & Priorité de Paiement
    PaymentAllocationController,
    FeeInstallmentController,
    PaymentsEnhancedController,
    // Module 4 - Recouvrement & Reçus
    CollectionCaseController,
    ReceiptGenerationController,
    ReceiptNotificationController,
    FinanceOrionController,
    PublicReceiptController,
    // Module 4 - Régimes tarifaires & Arriérés
    FeeRegimeController,
    StudentFeeProfileController,
    StudentArrearController,
    FinanceExpenseController,
    FinanceDailyClosureController,
    FinancialSettingsController,
    FinanceReportsController,
    FinanceAuditController,
  ],
  providers: [
    FeesPrismaService,
    PaymentsPrismaService,
    ExpensesPrismaService,
    CollectionPrismaService,
    TreasuryPrismaService,
    FeeStructureService,
    StudentAccountService,
    FinanceTransactionService,
    RecoveryReminderService,
    // Module 4 - Frais & Priorité de Paiement
    PaymentAllocationService,
    FeeInstallmentService,
    PaymentsPrismaEnhancedService,
    // Module 4 - Recouvrement & Reçus
    CollectionCaseService,
    ReceiptGenerationService,
    ReceiptNotificationService,
    FinanceOrionService,
    // Module 4 - Régimes tarifaires & Arriérés
    FeeRegimeService,
    StudentFeeProfileService,
    StudentArrearService,
    FinanceExpenseService,
    FinanceDailyClosureService,
    FinancialSettingsService,
    FinanceReportsService,
  ],
  exports: [
    FeesPrismaService,
    PaymentsPrismaService,
    ExpensesPrismaService,
    CollectionPrismaService,
    TreasuryPrismaService,
    FeeStructureService,
    StudentAccountService,
    FinanceTransactionService,
    RecoveryReminderService,
    // Module 4 - Frais & Priorité de Paiement
    PaymentAllocationService,
    FeeInstallmentService,
    PaymentsPrismaEnhancedService,
    // Module 4 - Recouvrement & Reçus
    CollectionCaseService,
    ReceiptGenerationService,
    FinancialSettingsService,
    FinanceReportsService,
  ],
})
export class FinanceModule {}

