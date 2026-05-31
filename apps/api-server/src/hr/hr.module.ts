/**
 * ============================================================================
 * HR MODULE - MODULE 5 (SCHEMA-ALIGNED)
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { PrismaService } from '../database/prisma.service';
import { StaffPrismaService } from './staff-prisma.service';
import { ContractsPrismaService } from './contracts-prisma.service';
import { AttendancePrismaService } from './attendance-prisma.service';
import { LeavesPrismaService } from './leaves-prisma.service';
import { AllowancesPrismaService } from './allowances-prisma.service';
import { EvaluationsPrismaService } from './evaluations-prisma.service';
import { PayrollPrismaService } from './payroll-prisma.service';
import { CNSSPrismaService } from './cnss-prisma.service';
import { TaxService } from './services/tax.service';
import { PayrollTaxService } from './services/payroll-tax.service';
import { PayrollPdfService } from './services/payroll-pdf.service';
import { HROrionService } from './services/hr-orion.service';
import { ContractPdfService } from './services/contract-pdf.service';
import { HrKpiService } from './hr-kpi.service';
import { StaffPrismaController } from './staff-prisma.controller';
import { ContractsPrismaController } from './contracts-prisma.controller';
import { AttendancePrismaController } from './attendance-prisma.controller';
import { LeavesPrismaController } from './leaves-prisma.controller';
import { AllowancesPrismaController } from './allowances-prisma.controller';
import { EvaluationsPrismaController } from './evaluations-prisma.controller';
import { PayrollPrismaController } from './payroll-prisma.controller';
import { CNSSPrismaController } from './cnss-prisma.controller';
import { HrOverviewController } from './hr-overview.controller';
import { OrionModule } from '../orion/orion.module';

@Module({
  imports: [PrismaModule, OrionModule],
  providers: [
    PrismaService,
    StaffPrismaService,
    ContractsPrismaService,
    AttendancePrismaService,
    LeavesPrismaService,
    AllowancesPrismaService,
    EvaluationsPrismaService,
    PayrollPrismaService,
    CNSSPrismaService,
    TaxService,
    PayrollTaxService,
    PayrollPdfService,
    HROrionService,
    ContractPdfService,
    HrKpiService,
  ],
  controllers: [
    StaffPrismaController,
    ContractsPrismaController,
    AttendancePrismaController,
    LeavesPrismaController,
    AllowancesPrismaController,
    EvaluationsPrismaController,
    PayrollPrismaController,
    CNSSPrismaController,
    HrOverviewController,
  ],
  exports: [
    StaffPrismaService,
    ContractsPrismaService,
    AttendancePrismaService,
    LeavesPrismaService,
    AllowancesPrismaService,
    EvaluationsPrismaService,
    PayrollPrismaService,
    CNSSPrismaService,
    TaxService,
    PayrollTaxService,
    PayrollPdfService,
    HROrionService,
    ContractPdfService,
    HrKpiService,
  ],
})
export class HRModule {}
