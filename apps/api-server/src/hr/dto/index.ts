/**
 * ============================================================================
 * HR DTOs - Data Transfer Objects with class-validator
 * ============================================================================
 * Replaces `@Body() data: any` in HR controllers with typed, validated DTOs.
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
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsEnum(['TEACHER', 'ADMIN', 'SUPPORT', 'DIRECTOR', 'OTHER']) roleType?: string;
  @IsOptional() @IsDateString() hireDate?: string;
  @IsOptional() @IsString() contractType?: string;
  @IsOptional() @IsNumber() @Type(() => Number) salary?: number;
  @IsOptional() bankDetails?: Record<string, any>;
  @IsOptional() emergencyContact?: Record<string, any>;
  @IsOptional() @IsString() qualifications?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
}

export class UpdateStaffDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsEnum(['TEACHER', 'ADMIN', 'SUPPORT', 'DIRECTOR', 'OTHER']) roleType?: string;
  @IsOptional() @IsDateString() hireDate?: string;
  @IsOptional() @IsString() contractType?: string;
  @IsOptional() @IsNumber() @Type(() => Number) salary?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
}

// ─── Contract DTOs ───────────────────────────────────────────────────────────

export class CreateContractDto {
  @IsUUID() staffId: string;
  @IsEnum(['CDI', 'CDD', 'VACATAIRE', 'STAGE']) contractType: string;
  @IsDateString() startDate: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsNumber() @Type(() => Number) baseSalary: number;
  @IsOptional() @IsEnum(['BANK', 'CASH', 'MOBILE_MONEY']) paymentMode?: string;
  @IsOptional() @IsUUID() templateId?: string;
  @IsOptional() terms?: Record<string, any>;
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
}

export class UpdateContractDto {
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsNumber() @Type(() => Number) baseSalary?: number;
  @IsOptional() @IsEnum(['BANK', 'CASH', 'MOBILE_MONEY']) paymentMode?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() terms?: Record<string, any>;
}

export class CreateAmendmentDto {
  @IsEnum(['SALARY_CHANGE', 'POSITION_CHANGE', 'DURATION_EXTENSION', 'STATUS_CHANGE', 'OTHER']) amendmentType: string;
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
}

export class UpdatePayrollStatusDto {
  @IsEnum(['DRAFT', 'CALCULATED', 'VALIDATED', 'PAID']) status: string;
}

export class CreatePayrollPeriodDto {
  @IsUUID() academicYearId: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
  @IsString() name: string;
  @IsOptional() @IsEnum(['MONTHLY', 'QUARTERLY', 'ANNUAL', 'OFF_CYCLE']) periodType?: string;
  @IsOptional() @IsString() month?: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
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
  @IsOptional() @IsEnum(['PERFORMANCE', 'SIGNING', 'REFERRAL', 'END_OF_YEAR', 'OTHER']) bonusType?: string;
}

// ─── Leave DTOs ──────────────────────────────────────────────────────────────

export class CreateLeaveRequestDto {
  @IsUUID() academicYearId: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
  @IsUUID() staffId: string;
  @IsEnum(['ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'UNPAID', 'EXCEPTIONAL']) type: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @IsString() reason?: string;
}

export class ProcessLeaveRequestDto {
  @IsEnum(['APPROVED', 'REJECTED', 'CANCELLED']) status: string;
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
  @IsOptional() @IsBoolean() isFixed?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class AssignAllowanceToStaffDto {
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
  @IsUUID() staffId: string;
  @IsUUID() allowanceTypeId: string;
  @IsNumber() @Type(() => Number) amount: number;
  @IsDateString() effectiveDate: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() notes?: string;
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
  @IsString() month: string;
}

// ─── Attendance DTOs ─────────────────────────────────────────────────────────

export class RecordAttendanceDto {
  @IsUUID() staffId: string;
  @IsDateString() date: string;
  @IsOptional() @IsDateString() checkIn?: string;
  @IsOptional() @IsDateString() checkOut?: string;
  @IsOptional() @IsEnum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'MISSION']) status?: string;
  @IsOptional() @IsNumber() @Type(() => Number) hoursWorked?: number;
  @IsOptional() @IsString() notes?: string;
  @IsUUID() academicYearId: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
}

export class RecordOvertimeDto {
  @IsUUID() staffId: string;
  @IsDateString() date: string;
  @IsNumber() @Min(0) @Type(() => Number) hours: number;
  @IsOptional() @IsString() notes?: string;
  @IsUUID() academicYearId: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
}

// ─── Contract Template DTOs ──────────────────────────────────────────────────

export class CreateContractTemplateDto {
  @IsString() name: string;
  @IsEnum(['CDI', 'CDD', 'VACATAIRE', 'STAGE']) contractType: string;
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
}
