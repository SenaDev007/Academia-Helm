/**
 * ============================================================================
 * TAXES MODULE — Module Impôts et États financiers
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PrismaService } from '../../database/prisma.service';
import { TaxesController } from './taxes.controller';
import { TaxSettingsService } from './services/tax-settings.service';
import { FinancialStatementService } from './services/financial-statement.service';
import { TaxDeclarationService } from './services/tax-declaration.service';

@Module({
  imports: [PrismaModule],
  controllers: [TaxesController],
  providers: [
    PrismaService,
    TaxSettingsService,
    FinancialStatementService,
    TaxDeclarationService,
  ],
  exports: [
    TaxSettingsService,
    FinancialStatementService,
    TaxDeclarationService,
  ],
})
export class TaxesModule {}
