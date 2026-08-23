/**
 * ============================================================================
 * FINANCE MODULE - MODULE 4
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { CommonModule } from '../common/common.module';
// Sous-modules Finance (config frais, comptes, encaissements, recouvrement)
import { FeeStructureController } from './fee-structure.controller';
import { FeeStructureService } from './fee-structure.service';
import { StudentAccountController } from './student-account.controller';
import { StudentAccountService } from './student-account.service';
import { FinanceTransactionController } from './finance-transaction.controller';
import { FinanceTransactionService } from './finance-transaction.service';
import { RecoveryReminderController } from './recovery-reminder.controller';
import { RecoveryReminderService } from './recovery-reminder.service';
import { RecoveryReminderEmailService } from './recovery-reminder-email.service';
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
import { ReceiptFinanceService } from './receipt-finance.service';
import { ReceiptNotificationFinanceService } from './receipt-notification-finance.service';
import { RecoveryNotificationFinanceService } from './recovery-notification-finance.service';
import { HelmConnectFinanceNotificationService } from './helm-connect-finance-notification.service';
import { ArrearAccumulationService } from './arrear-accumulation.service';
import { TenantPaymentConfigService } from './tenant-payment-config.service';
import { TenantPaymentConfigController } from './tenant-payment-config.controller';
// ⭐ FedaPay supprimé — seul FedaPay est conservé comme passerelle de paiement
import { FedapayService } from './fedapay.service';
import { FedapayController } from './fedapay.controller';
import { PaymentInitiationService } from './payment-initiation.service';
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
import { CashRegisterService } from './cash-register.service';
import { CashRegisterController } from './cash-register.controller';
import { FinancePdfExportService } from './finance-pdf-export.service';
import { AutoRecoveryService } from './auto-recovery.service';
import { FinancePdfExportController } from './finance-pdf-export.controller';
import { ComptaExportService } from './compta-export.service';
import { ComptaExportController } from './compta-export.controller';
import { ComptaAutoExportService } from './compta-auto-export.service';
import { ArrearsImportService } from './arrears-import.service';
import { ArrearsImportController } from './arrears-import.controller';
import { FeeOverrideImportService } from './fee-override-import.service';
import { CollectionSummaryImportService } from './collection-summary-import.service';
import { CollectionSummaryController } from './collection-summary.controller';
import { MultiActionPaymentService } from './multi-action-payment.service';
// ⭐ Promoter Eligibility — élèves "paiement direct au fondateur"
import { PromoterEligibilityController } from './promoter-eligibility.controller';
import { PromoterEligibilityService } from './promoter-eligibility.service';
import { MultiActionPaymentController } from './multi-action-payment.controller';
import { CommunicationModule } from '../communication/communication.module';
import { StudentsModule } from '../students/students.module';

@Module({
  imports: [ConfigModule, DatabaseModule, SettingsModule, CommunicationModule, CommonModule, StudentsModule],
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
    FinancePdfExportController,
    FinanceAuditController,
    CashRegisterController,
    TenantPaymentConfigController,
    FedapayController,
    // Sous-module 7 — Export comptable (FEC + OHADA + CSV)
    ComptaExportController,
    // Import d'arriérés via Excel
    ArrearsImportController,
    // Bilan des encaissements + Récapitulatif
    CollectionSummaryController,
    // Multi-action : frais + articles boutique en un seul encaissement
    MultiActionPaymentController,
    // ⭐ Promoter Eligibility — élèves "paiement direct au fondateur"
    PromoterEligibilityController,
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
    RecoveryReminderEmailService,
    ReceiptFinanceService,
    ReceiptNotificationFinanceService,
    RecoveryNotificationFinanceService,
    // ⭐ Helm Connect finance notifications — replaces SMS/WhatsApp for
    //    receipt delivery and recovery reminders. Messages go to the
    //    parent's Helm Connect account (auto-provisioned if needed).
    HelmConnectFinanceNotificationService,
    ArrearAccumulationService,
    TenantPaymentConfigService,
    FedapayService,
    PaymentInitiationService,
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
    CashRegisterService,
    FinancePdfExportService,
    AutoRecoveryService,
    // Sous-module 7 — Export comptable (FEC + OHADA + CSV)
    ComptaExportService,
    // Phase 4 — Export comptable automatique mensuel (cron + email)
    ComptaAutoExportService,
    // Import d'arriérés via Excel
    ArrearsImportService,
    // Import en masse de personnalisations de frais (FeeOverride)
    FeeOverrideImportService,
    // Import en masse du bilan des encaissements (FinanceTransaction)
    CollectionSummaryImportService,
    // Multi-action : frais + articles boutique en un seul encaissement
    MultiActionPaymentService,
    // ⭐ Promoter Eligibility — élèves "paiement direct au fondateur"
    PromoterEligibilityService,
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
    RecoveryReminderEmailService,
    // Module 4 - Frais & Priorité de Paiement
    PaymentAllocationService,
    FeeInstallmentService,
    PaymentsPrismaEnhancedService,
    // Module 4 - Recouvrement & Reçus
    CollectionCaseService,
    ReceiptGenerationService,
    FinancialSettingsService,
    CashRegisterService,
    FinanceReportsService,
    // Multi-action : frais + articles boutique en un seul encaissement
    MultiActionPaymentService,
  ],
})
export class FinanceModule {}

