/**
 * ============================================================================
 * FINANCE MODULE — ALL DTOs
 * ============================================================================
 * Single source of truth for every request-body DTO in the Finance module.
 * The global ValidationPipe is configured with:
 *   whitelist: true, forbidNonWhitelisted: true
 * so only explicitly-decorated fields will pass through.
 * ============================================================================
 */

import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsIn,
  IsArray,
  ValidateNested,
} from 'class-validator';

// ─── 1. FeeStructure ────────────────────────────────────────────────────────

export class CreateFeeStructureDto {
  @IsString()
  academicYearId: string;

  @IsString()
  name: string;

  @IsIn(['INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'ANNEX', 'EXCEPTIONAL'])
  feeType: string;

  @IsNumber()
  totalAmount: number;

  @IsBoolean()
  isInstallment: boolean;

  @IsBoolean()
  isMandatory: boolean;

  @IsOptional()
  @IsString()
  levelId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  installments?: any[];
}

export class UpdateFeeStructureDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  @IsOptional()
  @IsBoolean()
  isInstallment?: boolean;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  levelId?: string | null;

  @IsOptional()
  @IsString()
  classId?: string | null;
}

// ─── 2. FeeCategory ─────────────────────────────────────────────────────────

export class CreateFeeCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  code?: string;
}

// ─── 3. FeeDefinition ───────────────────────────────────────────────────────

export class CreateFeeDefinitionDto {
  @IsString()
  name: string;

  @IsString()
  feeCategoryId: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  schoolLevelId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateFeeDefinitionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  feeCategoryId?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

// ─── 4. StudentFee ──────────────────────────────────────────────────────────

export class CreateStudentFeeDto {
  @IsString()
  studentId: string;

  @IsString()
  feeDefinitionId: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  schoolLevelId?: string;
}

// ─── 5. Payment ─────────────────────────────────────────────────────────────

export class CreatePaymentDto {
  @IsString()
  academicYearId?: string;

  @IsString()
  studentFeeId: string;

  @IsNumber()
  amount: number;

  @IsIn(['CASH', 'MOBILE_MONEY', 'WIRE', 'FEDAPAY'])
  paymentMethod: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;
}

// ─── 6. Transaction ─────────────────────────────────────────────────────────

export class CreateTransactionDto {
  @IsString()
  academicYearId: string;

  @IsString()
  studentAccountId: string;

  @IsNumber()
  amount: number;

  @IsIn(['CASH', 'MOBILE_MONEY', 'WIRE', 'FEDAPAY'])
  paymentMethod: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;
}

// ─── 7. ExpenseCategory ─────────────────────────────────────────────────────

export class CreateExpenseCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  schoolLevelId?: string;
}

export class UpdateExpenseCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  code?: string;
}

// ─── 8. Expense ─────────────────────────────────────────────────────────────

export class CreateExpenseDto {
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsString()
  schoolLevelId: string;

  @IsString()
  categoryId: string;

  @IsString()
  description: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  expenseDate?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  expenseDate?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

// ─── 9. Treasury (Daily Closures) ───────────────────────────────────────────

export class CreateTreasuryClosureDto {
  @IsString()
  academicYearId: string;

  @IsString()
  schoolLevelId: string;

  @IsString()
  date: string;

  @IsNumber()
  openingBalance: number;

  @IsOptional()
  @IsNumber()
  totalCollected?: number;

  @IsOptional()
  @IsNumber()
  totalSpent?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ─── 10. Collection ─────────────────────────────────────────────────────────

export class CreateCollectionReminderDto {
  @IsString()
  arrearId: string;

  @IsIn(['WARNING', 'URGENT', 'FINAL_NOTICE'])
  level: string;

  @IsIn(['SMS', 'WHATSAPP', 'EMAIL'])
  channel: string;

  @IsOptional()
  @IsString()
  message?: string;
}

export class CreatePaymentPromiseDto {
  @IsString()
  arrearId: string;

  @IsNumber()
  promisedAmount: number;

  @IsString()
  promiseDate: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateCollectionActionDto {
  @IsString()
  arrearId: string;

  @IsString()
  actionType: string;

  @IsOptional()
  @IsString()
  description?: string;
}

// ─── 11. FeeRegime ──────────────────────────────────────────────────────────

export class CreateFeeRegimeDto {
  @IsString()
  academicYearId: string;

  @IsString()
  schoolLevelId: string;

  @IsIn(['STANDARD', 'ENFANT_ENSEIGNANT', 'REDUCTION'])
  code: string;

  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateFeeRegimeDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateFeeRegimeRuleDto {
  @IsString()
  feeType: string;

  @IsOptional()
  @IsNumber()
  reductionPercentage?: number;

  @IsOptional()
  @IsNumber()
  fixedAmount?: number;

  @IsOptional()
  @IsString()
  condition?: string;
}

// ─── 12. FinanceExpenseV2 ───────────────────────────────────────────────────

export class CreateFinanceExpenseDto {
  @IsString()
  academicYearId: string;

  @IsString()
  categoryId: string;

  @IsNumber()
  amount: number;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;
}

// ─── 13. DailyClosure ───────────────────────────────────────────────────────

export class CreateDailyClosureDto {
  @IsString()
  academicYearId: string;

  @IsString()
  date: string;

  @IsOptional()
  @IsNumber()
  physicalAmount?: number;

  @IsOptional()
  @IsBoolean()
  validate?: boolean;
}

// ─── 14. FinancialSettings ──────────────────────────────────────────────────

export class UpdateFinancialSettingsDto {
  @IsOptional()
  @IsNumber()
  blockingThreshold?: number;

  @IsOptional()
  @IsNumber()
  reminderWarningDays?: number;

  @IsOptional()
  @IsNumber()
  reminderUrgentDays?: number;

  @IsOptional()
  @IsNumber()
  reminderFinalDays?: number;

  @IsOptional()
  @IsBoolean()
  autoClosureEnabled?: boolean;

  @IsOptional()
  @IsString()
  autoClosureTime?: string;

  @IsOptional()
  @IsNumber()
  budgetAlertThreshold?: number;

  @IsOptional()
  @IsBoolean()
  allowPartialPayment?: boolean;

  @IsOptional()
  @IsNumber()
  minimumInstallmentAmount?: number | null;

  @IsOptional()
  @IsNumber()
  cancellationDelayHours?: number;

  @IsOptional()
  @IsBoolean()
  fedapayEnabled?: boolean;

  @IsOptional()
  @IsString()
  fedapayPublicKey?: string;

  @IsOptional()
  @IsString()
  fedapaySecretKey?: string;
}
