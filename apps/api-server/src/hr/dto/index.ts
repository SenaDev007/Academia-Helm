/**
 * ============================================================================
 * HR DTOs - Data Transfer Objects with class-validator
 * ============================================================================
 * Replaces `@Body() data: any` in HR controllers with typed, validated DTOs.
 *
 * IMPORTANT: With `forbidNonWhitelisted: true` in the global ValidationPipe,
 * any field NOT decorated here will cause a 400 error. All fields sent by the
 * frontend MUST be declared as optional/required decorated properties.
 * ============================================================================
 */

import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsBoolean,
  IsDateString,
  IsUUID,
  IsIn,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Staff DTOs ──────────────────────────────────────────────────────────────

export class CreateStaffDto {
  @IsString() firstName: string;
  @IsString() lastName: string;
  /** Auto-generated if not provided (format: STF-YY-XXXXX) */
  @IsOptional() @IsString() employeeNumber?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsIn(['TEACHER', 'ADMIN', 'SUPPORT', 'DIRECTOR', 'OTHER']) roleType?: string;
  /** Frontend may send "category" as alias for roleType (e.g. "ADMIN", "PEDAGOGICAL") */
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsDateString() hireDate?: string;
  @IsOptional() @IsString() contractType?: string;
  @IsOptional() @IsNumber() @Type(() => Number) salary?: number;
  @IsOptional() bankDetails?: Record<string, any>;
  @IsOptional() emergencyContact?: Record<string, any>;
  @IsOptional() @IsString() qualifications?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
  /** Frontend OnboardingWizardModal sends status: 'ACTIVE' */
  @IsOptional() @IsString() status?: string;
  /** Frontend may send tenantId — ignored (resolved server-side) */
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdateStaffDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() employeeNumber?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsIn(['TEACHER', 'ADMIN', 'SUPPORT', 'DIRECTOR', 'OTHER']) roleType?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsDateString() hireDate?: string;
  @IsOptional() @IsString() contractType?: string;
  @IsOptional() @IsNumber() @Type(() => Number) salary?: number;
  @IsOptional() bankDetails?: Record<string, any>;
  @IsOptional() emergencyContact?: Record<string, any>;
  @IsOptional() @IsString() qualifications?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
  @IsOptional() @IsString() tenantId?: string;
}

// ─── Contract DTOs ───────────────────────────────────────────────────────────

export class CreateContractDto {
  @IsUUID() staffId: string;
  @IsIn(['CDI', 'CDD', 'VACATAIRE', 'STAGE', 'CONSULTANT']) contractType: string;
  @IsDateString() startDate: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsNumber() @Type(() => Number) baseSalary: number;
  @IsOptional() @IsIn(['BANK', 'CASH', 'MOBILE_MONEY']) paymentMode?: string;
  @IsOptional() @IsUUID() templateId?: string;
  @IsOptional() terms?: Record<string, any>;
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
  /** Frontend ContractsWorkspace sends status: 'ACTIVE' */
  @IsOptional() @IsString() status?: string;
  /** Frontend may send tenantId — ignored (resolved server-side) */
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdateContractDto {
  @IsOptional() @IsUUID() staffId?: string;
  @IsOptional() @IsIn(['CDI', 'CDD', 'VACATAIRE', 'STAGE', 'CONSULTANT']) contractType?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsNumber() @Type(() => Number) baseSalary?: number;
  @IsOptional() @IsIn(['BANK', 'CASH', 'MOBILE_MONEY']) paymentMode?: string;
  @IsOptional() @IsUUID() templateId?: string;
  @IsOptional() terms?: Record<string, any>;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
  @IsOptional() @IsString() tenantId?: string;
}

export class CreateAmendmentDto {
  @IsIn(['SALARY_CHANGE', 'POSITION_CHANGE', 'DURATION_EXTENSION', 'STATUS_CHANGE', 'OTHER']) amendmentType: string;
  @IsString() description: string;
  @IsOptional() @IsString() previousValue?: string;
  @IsOptional() @IsString() newValue?: string;
  @IsDateString() effectiveDate: string;
}

// ─── Payroll DTOs ────────────────────────────────────────────────────────────

export class CreatePayrollDto {
  @IsUUID() academicYearId: string;
  @IsString() month: string; // "2025-01" format
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
  @IsOptional() @IsUUID() payrollPeriodId?: string;
  @IsOptional() @IsString() notes?: string;
  /** Frontend may send tenantId — ignored (resolved server-side) */
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdatePayrollStatusDto {
  @IsIn(['DRAFT', 'CALCULATED', 'VALIDATED', 'PAID']) status: string;
}

export class CreatePayrollPeriodDto {
  @IsUUID() academicYearId: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
  /** Name is auto-generated from month/type if not provided */
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(['MONTHLY', 'QUARTERLY', 'ANNUAL', 'OFF_CYCLE']) periodType?: string;
  @IsOptional() @IsString() month?: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  /** Frontend PayrollWorkspace sends tenantId — ignored (resolved server-side) */
  @IsOptional() @IsString() tenantId?: string;
}

export class UpsertPayrollRateDto {
  @IsString() countryCode: string;
  @IsString() roleType: string;
  @IsOptional() @IsString() grade?: string;
  @IsNumber() @Type(() => Number) monthlyBaseSalary: number;
  @IsNumber() @Type(() => Number) hourlyRate: number;
  @IsOptional() @IsNumber() @Type(() => Number) overtimeMultiplier?: number;
  @IsDateString() effectiveFrom: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
}

export class CreateOneTimeBonusDto {
  @IsUUID() academicYearId: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
  @IsUUID() staffId: string;
  @IsNumber() @Min(0) @Type(() => Number) amount: number;
  @IsString() @MaxLength(500) reason: string;
  @IsOptional() @IsIn(['PERFORMANCE', 'SIGNING', 'REFERRAL', 'END_OF_YEAR', 'OTHER']) bonusType?: string;
}

// ─── Leave DTOs ──────────────────────────────────────────────────────────────

export class CreateLeaveRequestDto {
  @IsUUID() academicYearId: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
  @IsUUID() staffId: string;
  @IsIn(['ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'UNPAID', 'EXCEPTIONAL']) type: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @IsString() reason?: string;
  /** Frontend LeavesWorkspace sends tenantId — ignored (resolved server-side) */
  @IsOptional() @IsString() tenantId?: string;
}

export class ProcessLeaveRequestDto {
  @IsIn(['APPROVED', 'REJECTED', 'CANCELLED']) status: string;
  @IsOptional() @IsUUID() approvedBy?: string;
  @IsOptional() @IsString() rejectedReason?: string;
}

// ─── Allowance DTOs ──────────────────────────────────────────────────────────

export class CreateAllowanceTypeDto {
  @IsString() name: string;
  @IsString() code: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isTaxable?: boolean;
  @IsOptional() @IsBoolean() isCnss?: boolean;
  @IsOptional() @IsNumber() @Type(() => Number) amount?: number;
  /** Frontend AllowancesWorkspace sends defaultAmount — mapped to amount in service */
  @IsOptional() @IsNumber() @Type(() => Number) defaultAmount?: number;
  @IsOptional() @IsBoolean() isFixed?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** Frontend AllowancesWorkspace sends category */
  @IsOptional() @IsString() category?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class AssignAllowanceToStaffDto {
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
  @IsUUID() staffId: string;
  @IsUUID() allowanceTypeId: string;
  @IsNumber() @Type(() => Number) amount: number;
  @IsOptional() @IsDateString() effectiveDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  /** Frontend AllowancesWorkspace sends startDate — mapped to effectiveDate in service */
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsString() notes?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdateAllowanceTypeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isTaxable?: boolean;
  @IsOptional() @IsBoolean() isCnss?: boolean;
  @IsOptional() @IsNumber() @Type(() => Number) amount?: number;
  @IsOptional() @IsNumber() @Type(() => Number) defaultAmount?: number;
  @IsOptional() @IsBoolean() isFixed?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdateStaffAllowanceDto {
  @IsOptional() @IsNumber() @Type(() => Number) amount?: number;
  @IsOptional() @IsDateString() effectiveDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() tenantId?: string;
}

// ─── CNSS DTOs ───────────────────────────────────────────────────────────────

export class UpsertCNSSRateDto {
  @IsString() countryCode: string;
  @IsNumber() @Type(() => Number) employeeRate: number;
  @IsNumber() @Type(() => Number) employerRate: number;
  @IsOptional() @IsNumber() @Type(() => Number) salaryCeiling?: number;
  @IsDateString() effectiveFrom: string;
  @IsOptional() @IsDateString() effectiveTo?: string;
}

export class CreateCNSSDeclarationDto {
  @IsUUID() academicYearId: string;
  /** Month in "YYYY-MM" format — auto-derived from periodStart if not provided */
  @IsOptional() @IsString() month?: string;
  /** Frontend CnssWorkspace sends periodStart — mapped to month in service */
  @IsOptional() @IsString() periodStart?: string;
  /** Frontend CnssWorkspace sends periodEnd */
  @IsOptional() @IsString() periodEnd?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

// ─── Attendance DTOs ─────────────────────────────────────────────────────────

export class RecordAttendanceDto {
  @IsUUID() staffId: string;
  @IsDateString() date: string;
  @IsOptional() @IsDateString() checkIn?: string;
  @IsOptional() @IsDateString() checkOut?: string;
  @IsOptional() @IsIn(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'MISSION']) status?: string;
  @IsOptional() @IsNumber() @Type(() => Number) hoursWorked?: number;
  @IsOptional() @IsString() notes?: string;
  @IsUUID() academicYearId: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class RecordOvertimeDto {
  @IsUUID() staffId: string;
  @IsDateString() date: string;
  @IsNumber() @Min(0) @Type(() => Number) hours: number;
  @IsOptional() @IsString() notes?: string;
  /** Frontend AttendanceWorkspace sends reason — mapped to notes */
  @IsOptional() @IsString() reason?: string;
  @IsUUID() academicYearId: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

// ─── Contract Template DTOs ──────────────────────────────────────────────────

export class CreateContractTemplateDto {
  @IsString() name: string;
  @IsIn(['CDI', 'CDD', 'VACATAIRE', 'STAGE', 'CONSULTANT']) contractType: string;
  @IsString() template: string;
  @IsOptional() variables?: Record<string, any>;
}

// ─── Evaluation DTOs ─────────────────────────────────────────────────────────

export class CreateEvaluationDto {
  @IsUUID() staffId: string;
  @IsOptional() @IsNumber() @Min(0) @Max(999.99) @Type(() => Number) score?: number;
  @IsOptional() @IsString() comments?: string;
  @IsOptional() @IsUUID() evaluatorId?: string;
  @IsUUID() academicYearId: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
}

export class UpdateEvaluationDto {
  @IsOptional() @IsNumber() @Min(0) @Max(999.99) @Type(() => Number) score?: number;
  @IsOptional() @IsString() comments?: string;
  @IsOptional() @IsUUID() evaluatorId?: string;
}

export class CreateTrainingDto {
  @IsUUID() staffId: string;
  @IsString() title: string;
  @IsOptional() @IsString() provider?: string;
  @IsDateString() dateCompleted: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
}

// ─── Document DTOs ───────────────────────────────────────────────────────────

export class AddStaffDocumentDto {
  @IsString() documentType: string;
  @IsString() fileName: string;
  @IsString() filePath: string;
  @IsOptional() @IsNumber() @Type(() => Number) fileSize?: number;
  @IsOptional() @IsString() mimeType?: string;
}

// ─── Sign Contract DTO ───────────────────────────────────────────────────────

export class SignContractDto {
  @IsString() signatureData: string; // base64 PNG
  @IsString() signerName: string;
  @IsOptional() @IsString() signerRole?: string;
}

// ─── Schedule DTOs ────────────────────────────────────────────────────────────

export class CreateScheduleDto {
  @IsString() staffId!: string;
  @IsInt() @Min(0) @Max(6) dayOfWeek!: number;
  @IsString() shiftType!: string;
  @IsString() startTime!: string;
  @IsString() endTime!: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() notes?: string;
  @IsString() academicYearId!: string;
  @IsOptional() @IsString() schoolLevelId?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
  /** Frontend PlanningWorkspace sends date — used to derive dayOfWeek if not set */
  @IsOptional() @IsDateString() date?: string;
  /** Frontend PlanningWorkspace sends shift — alias for shiftType */
  @IsOptional() @IsString() shift?: string;
}
