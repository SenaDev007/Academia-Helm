/**
 * ============================================================================
 * TAXES MODULE — Module Impôts et États financiers
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { PuppeteerPoolService } from '../../common/services/puppeteer-pool.service';
import { TaxesController } from './taxes.controller';
import { TaxSettingsService } from './services/tax-settings.service';
import { FinancialStatementService } from './services/financial-statement.service';
import { TaxDeclarationService } from './services/tax-declaration.service';
import { FinancialNoteService } from './services/financial-note.service';
import { PayrollService } from './services/payroll.service';
import { TaxPdfService } from './services/tax-pdf.service';

@Module({
  imports: [PrismaModule],
  controllers: [TaxesController],
  providers: [
    PrismaService,
    StorageService,
    PuppeteerPoolService,
    TaxSettingsService,
    FinancialStatementService,
    TaxDeclarationService,
    FinancialNoteService,
    PayrollService,
    TaxPdfService,
  ],
  exports: [
    TaxSettingsService,
    FinancialStatementService,
    TaxDeclarationService,
    FinancialNoteService,
    PayrollService,
  ],
})
export class TaxesModule {}
