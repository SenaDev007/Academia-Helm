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
  IsNotEmpty,
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
  /** Accept ISO date string or null. Empty strings are treated as null. */
  @IsOptional() dateOfBirth?: string | null;
  /** Accept ISO date string or null. Empty strings are treated as null. */
  @IsOptional() birthDate?: string | null;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsIn(['TEACHER', 'ADMIN', 'SUPPORT', 'DIRECTOR', 'OTHER']) roleType?: string;
  /** Frontend may send "category" as alias for roleType (e.g. "ADMIN", "PEDAGOGICAL") */
  @IsOptional() @IsString() category?: string;
  /** Accept ISO date string or null. Empty strings are treated as null. */
  @IsOptional() hireDate?: string | null;
  @IsOptional() @IsString() contractType?: string;
  @IsOptional() @IsNumber() @Type(() => Number) salary?: number;
  @IsOptional() bankDetails?: Record<string, any>;
  /** Accept object (structured) or string (free-form). */
  @IsOptional() emergencyContact?: Record<string, any> | string;
  @IsOptional() @IsString() qualifications?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() maritalStatus?: string;
  @IsOptional() @IsNumber() @Type(() => Number) numberOfChildren?: number;
  @IsOptional() @IsString() nationalId?: string;
  @IsOptional() @IsString() cnssNumber?: string;
  @IsOptional() @IsString() ifuNumber?: string;
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
  /** Accept ISO date string or null/undefined. Empty strings are treated as null. */
  @IsOptional() dateOfBirth?: string | null;
  /** Accept ISO date string or null/undefined. Empty strings are treated as null. */
  @IsOptional() birthDate?: string | null;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsIn(['TEACHER', 'ADMIN', 'SUPPORT', 'DIRECTOR', 'OTHER']) roleType?: string;
  @IsOptional() @IsString() category?: string;
  /** Accept ISO date string or null/undefined. Empty strings are treated as null. */
  @IsOptional() hireDate?: string | null;
  @IsOptional() @IsString() contractType?: string;
  @IsOptional() @IsNumber() @Type(() => Number) salary?: number;
  @IsOptional() bankDetails?: Record<string, any>;
  /** Accept object (structured) or string (free-form). */
  @IsOptional() emergencyContact?: Record<string, any> | string;
  @IsOptional() @IsString() qualifications?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() maritalStatus?: string;
  @IsOptional() @IsNumber() @Type(() => Number) numberOfChildren?: number;
  @IsOptional() @IsString() nationalId?: string;
  @IsOptional() @IsString() cnssNumber?: string;
  @IsOptional() @IsString() ifuNumber?: string;
  @IsOptional() @IsString() terminationType?: string;
  @IsOptional() terminationDetails?: Record<string, any>;
  @IsOptional() terminatedAt?: string | null;
  @IsOptional() @IsNumber() @Type(() => Number) noticePeriodDays?: number;
  @IsOptional() lastWorkingDate?: string | null;
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
  /** Frontend ContractsWorkspace sends status: 'PENDING' — contract becomes ACTIVE only after signing */
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
  @IsDateString() @Type(() => Date) dateCompleted: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
  /** Frontend may send tenantId — ignored (resolved server-side) */
  @IsOptional() @IsString() tenantId?: string;
}

// ─── Document DTOs ───────────────────────────────────────────────────────────

export class AddStaffDocumentDto {
  @IsString() documentType: string;
  @IsString() fileName: string;
  @IsString() filePath: string;
  @IsOptional() @IsNumber() @Type(() => Number) fileSize?: number;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

/**
 * DTO for Multer file upload of staff document.
 * The file itself is handled by FileInterceptor; this DTO captures the
 * additional form fields sent alongside the file.
 */
export class UploadStaffDocumentDto {
  /** Document type: CV, CNI, BIRTH_CERTIFICATE, DIPLOMA, CONTRACT, CNSS_CERTIFICATE, MEDICAL_CERTIFICATE, WORK_PERMIT, OTHER */
  @IsString() @Type(() => String) documentType: string;
  @IsOptional() @IsString() @Type(() => String) description?: string;
  /** Accept date string or empty string (empty will be treated as null) */
  @IsOptional() @Type(() => String) expiresAt?: string;
  /** Category for document classification (IDENTITE, DIPLOMES, EXPERIENCE, ADMINISTRATIF, MEDICAL, GENERAL) */
  @IsOptional() @IsString() @Type(() => String) category?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() @Type(() => String) tenantId?: string;
}

/**
 * DTO for document validation/rejection
 */
export class ValidateDocumentDto {
  @IsIn(['VALIDATED', 'REJECTED']) status: 'VALIDATED' | 'REJECTED';
}

// ─── Sign Contract DTO ───────────────────────────────────────────────────────

export class SignContractDto {
  @IsString() signatureData: string; // base64 PNG
  @IsString() signerName: string;
  /** EMPLOYEUR = employer representative signs first; EMPLOYE = employee signs second */
  @IsOptional() @IsIn(['EMPLOYEUR', 'EMPLOYE', 'Employeur', 'Employé', 'Employe']) signerRole?: string;
}

export class CompleteOnboardingDto {
  @IsUUID() staffId: string;
  @IsUUID() contractId: string;
  @IsOptional() @IsBoolean() sendEmail?: boolean;
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

// ─── Recruitment DTOs ────────────────────────────────────────────────────────

export class CreateJobDto {
  @IsString() title: string;
  /** DB column name — frontend may send 'dept' or 'department' */
  @IsOptional() @IsString() dept?: string;
  /** Alias: frontend RecruitmentWorkspace sends 'department' */
  @IsOptional() @IsString() department?: string;
  /** DB column name — frontend may send 'loc' or 'location' */
  @IsOptional() @IsString() loc?: string;
  /** Alias: frontend RecruitmentWorkspace sends 'location' */
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() ref?: string;
  @IsOptional() @IsIn(['BROUILLON', 'PUBLIÉE', 'FERMÉE', 'ARCHIVÉE', 'DÉSACTIVÉE']) status?: string;
  @IsOptional() @IsString() description?: string;
  /** DB column name — frontend may send 'missions' or 'keyMissions' */
  @IsOptional() @IsString() missions?: string;
  /** Alias: frontend forms may send 'keyMissions' */
  @IsOptional() @IsString() keyMissions?: string;
  @IsOptional() @IsString() responsibilities?: string;
  /** DB column name — frontend may send 'academicLevel' or 'requiredEducation' */
  @IsOptional() @IsString() academicLevel?: string;
  /** Alias: frontend forms may send 'requiredEducation' */
  @IsOptional() @IsString() requiredEducation?: string;
  /** DB column name — frontend may send 'experience' or 'requiredExperience' */
  @IsOptional() @IsString() experience?: string;
  /** Alias: frontend forms may send 'requiredExperience' */
  @IsOptional() @IsString() requiredExperience?: string;
  @IsOptional() @IsString() skillsRequired?: string;
  @IsOptional() @IsString() salary?: string;
  @IsOptional() @IsString() contractType?: string;
  /** Date when the job was published — set automatically on publish/republish */
  @IsOptional() @IsDateString() publishedAt?: string;
  /** Frontend may send tenantId — ignored (resolved server-side) */
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdateJobDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() dept?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() loc?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() ref?: string;
  @IsOptional() @IsIn(['BROUILLON', 'PUBLIÉE', 'FERMÉE', 'ARCHIVÉE', 'DÉSACTIVÉE']) status?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() missions?: string;
  @IsOptional() @IsString() keyMissions?: string;
  @IsOptional() @IsString() responsibilities?: string;
  @IsOptional() @IsString() academicLevel?: string;
  @IsOptional() @IsString() requiredEducation?: string;
  @IsOptional() @IsString() experience?: string;
  @IsOptional() @IsString() requiredExperience?: string;
  @IsOptional() @IsString() skillsRequired?: string;
  @IsOptional() @IsString() salary?: string;
  @IsOptional() @IsString() contractType?: string;
  /** Date when the job was published — updated automatically on republish */
  @IsOptional() @IsDateString() publishedAt?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class CreateCandidateDto {
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsString() email: string;
  @IsString() phone: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  /** Optional: if provided, an HrApplication is auto-created for this job */
  @IsOptional() @IsUUID() jobId?: string;
  /** Optional: initial application status (defaults to NOUVEAU) */
  @IsOptional() @IsIn(['NOUVEAU', 'EN_COURS', 'ENTRETIEN', 'TEST', 'EMBAUCHÉ', 'REJETÉ']) status?: string;
  /** Frontend may send tenantId — ignored (resolved server-side) */
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdateCandidateDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class CreateApplicationDto {
  @IsUUID() jobId: string;
  @IsUUID() candidateId: string;
  @IsOptional() @IsIn(['NOUVEAU', 'EN_COURS', 'ENTRETIEN', 'TEST', 'EMBAUCHÉ', 'REJETÉ']) status?: string;
  /** Frontend may send tenantId — ignored (resolved server-side) */
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdateApplicationStatusDto {
  @IsIn(['NOUVEAU', 'EN_COURS', 'ENTRETIEN', 'TEST', 'EMBAUCHÉ', 'REJETÉ']) status: string;
  @IsOptional() @IsString() review?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class CreateInterviewDto {
  @IsUUID() candidateId: string;
  @IsOptional() @IsIn(['RH', 'TECHNIQUE', 'DIRECTION', 'PEDAGOGIQUE']) type?: string;
  @IsDateString() date: string;
  @IsString() time: string;
  @IsOptional() @IsString() format?: string;
  @IsString() evaluator: string;
  @IsOptional() @IsInt() @Type(() => Number) score?: number;
  @IsOptional() @IsString() comments?: string;
  /** Frontend may send tenantId — ignored (resolved server-side) */
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdateInterviewDto {
  /** Frontend may send candidateId — ignored (not updatable) */
  @IsOptional() @IsUUID() candidateId?: string;
  @IsOptional() @IsIn(['RH', 'TECHNIQUE', 'DIRECTION', 'PEDAGOGIQUE']) type?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() time?: string;
  @IsOptional() @IsString() format?: string;
  @IsOptional() @IsString() evaluator?: string;
  @IsOptional() @IsInt() @Type(() => Number) score?: number;
  @IsOptional() @IsString() comments?: string;
  @IsOptional() @IsIn(['PLANIFIÉ', 'EN_COURS', 'TERMINÉ']) status?: string;
  @IsOptional() @IsIn(['RÉUSSI', 'ÉCHOUÉ', 'EN_ATTENTE']) result?: string;
  @IsOptional() @IsString() feedback?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class CreateTestDto {
  @IsString() name: string;
  @IsString() type: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Type(() => Number) duration?: number; // minutes
  @IsOptional() @IsString() instructions?: string;
  @IsOptional() @IsInt() @Type(() => Number) maxScore?: number;
  @IsOptional() @IsInt() @Type(() => Number) passingScore?: number;
  @IsOptional() @IsIn(['ACTIF', 'ARCHIVÉ', 'BROUILLON']) status?: string;
  /** Frontend may send tenantId — ignored (resolved server-side) */
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdateTestDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Type(() => Number) duration?: number;
  @IsOptional() @IsString() instructions?: string;
  @IsOptional() @IsInt() @Type(() => Number) maxScore?: number;
  @IsOptional() @IsInt() @Type(() => Number) passingScore?: number;
  @IsOptional() @IsIn(['ACTIF', 'ARCHIVÉ', 'BROUILLON']) status?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class CreateTestResultDto {
  @IsUUID() testId: string;
  @IsUUID() candidateId: string;
  @IsInt() @Type(() => Number) score: number;
  @IsOptional() @IsIn(['RÉUSSI', 'ÉCHOUÉ', 'EN_ATTENTE']) result?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() evaluatedAt?: string; // ISO date string
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdateTestResultDto {
  @IsOptional() @IsInt() @Type(() => Number) score?: number;
  @IsOptional() @IsIn(['RÉUSSI', 'ÉCHOUÉ', 'EN_ATTENTE']) result?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() evaluatedAt?: string; // ISO date string
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class ValidateInterviewDto {
  @IsIn(['TERMINÉ', 'ANNULÉ']) status: string;
  @IsIn(['RÉUSSI', 'ÉCHOUÉ', 'EN_ATTENTE']) result: string;
  @IsOptional() @IsInt() @Type(() => Number) score?: number;
  @IsOptional() @IsString() feedback?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class AddToTalentPoolDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() status?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class ApplyJobDto {
  @IsUUID() jobId: string;
  @IsString() firstName: string;
  @IsString() lastName: string;
  @IsString() email: string;
  @IsString() phone: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() gender?: string;
  @IsUUID() tenantId: string;
  /**
   * Skills, experiences, and education are sent as JSON strings from the
   * frontend (FormData). They MAY also arrive as already-parsed arrays
   * if a middleware transforms them — the service handles both cases.
   * Using `@IsOptional()` without `@IsString()` avoids the validation
   * pipe stripping/rejecting these fields when they are arrays.
   */
  @IsOptional() skills?: any;
  @IsOptional() experiences?: any;
  @IsOptional() education?: any;
  @IsOptional() @IsString() pitch?: string;
  @IsOptional() @IsString() linkedinUrl?: string;
}

// ─── Recruiter Profile DTO ───────────────────────────────────────────────────

export class UpsertRecruiterProfileDto {
  @IsString() recruiterType: string; // PROMOTER | DEDICATED_RH | DELEGATED
  @IsOptional() @IsString() staffId?: string;
  @IsString() fullName: string;
  @IsOptional() @IsString() functionLabel?: string;
  @IsString() email: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() signatureText?: string;
  @IsOptional() @IsString() signatureLogoUrl?: string;
  @IsOptional() @IsString() defaultInterviewFormat?: string;
  @IsOptional() @IsInt() defaultInterviewDelayHr?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// ─── Reassign Application DTO (multi-postulation / réaffectation) ────────────

export class ReassignApplicationDto {
  @IsUUID() newJobId: string;
  @IsOptional() @IsString() newContractType?: string;
  @IsOptional() @IsString() reason?: string; // motif de réaffectation
}

// ─── Missing Update DTOs (for controllers still using @Body() body: any) ─────

export class UpdateContractTemplateDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() template?: string;
  @IsOptional() variables?: Record<string, any>;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateScheduleDto {
  @IsOptional() @IsUUID() staffId?: string;
  @IsOptional() @IsInt() @Min(0) @Max(6) @Type(() => Number) dayOfWeek?: number;
  @IsOptional() @IsString() shiftType?: string;
  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @IsString() endTime?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** Frontend PlanningWorkspace may send date — used to derive dayOfWeek */
  @IsOptional() @IsDateString() date?: string;
  /** Frontend PlanningWorkspace sends shift — alias for shiftType */
  @IsOptional() @IsString() shift?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdateAttendanceDto {
  @IsOptional() @IsDateString() checkIn?: string;
  @IsOptional() @IsDateString() checkOut?: string;
  @IsOptional() @IsIn(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'MISSION']) status?: string;
  @IsOptional() @IsNumber() @Type(() => Number) hoursWorked?: number;
  @IsOptional() @IsString() notes?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdateTrainingDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() provider?: string;
  @IsOptional() @IsDateString() @Type(() => Date) dateCompleted?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() certificatePath?: string;
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

// ─── Termination / Débauche DTOs ────────────────────────────────────────────

/**
 * DTO pour la débauche d'un employé (départ de l'entreprise).
 * Ce processus met à jour le statut du personnel, résilie les contrats actifs,
 * et enregistre les détails de la débauche de manière professionnelle.
 */
export class TerminateStaffDto {
  /** Type de départ */
  @IsIn([
    'RESIGNATION',         // Démission
    'DISMISSAL',           // Licenciement
    'MUTUAL_AGREEMENT',    // Rupture conventionnelle
    'END_OF_CONTRACT',     // Fin de contrat
    'RETIREMENT',          // Retraite
    'DEATH',               // Décès
    'ABANDONMENT',         // Abandon de poste
    'OTHER',               // Autre
  ])
  terminationType: string;

  /** Date effective du départ (obligatoire) */
  @IsDateString()
  effectiveDate: string;

  /** Dernier jour travaillé (optionnel, par défaut = effectiveDate) */
  @IsOptional() @IsDateString()
  lastWorkingDate?: string;

  /** Nombre de jours de préavis (légal ou contractuel) */
  @IsOptional() @IsInt() @Min(0) @Type(() => Number)
  noticePeriodDays?: number;

  /** Motif principal de la résiliation (texte libre) */
  @IsOptional() @IsString() @MaxLength(1000)
  reason?: string;

  /** Motif détaillé / notes complètes */
  @IsOptional() @IsString()
  detailedReason?: string;

  /** Entretien de sortie réalisé ? */
  @IsOptional() @IsBoolean()
  exitInterviewConducted?: boolean;

  /** Notes de l'entretien de sortie */
  @IsOptional() @IsString()
  exitInterviewNotes?: string;

  /** Remise du matériel effectuée ? */
  @IsOptional() @IsBoolean()
  equipmentReturned?: boolean;

  /** Documents de sortie remis ? (certificat de travail, attestation, etc.) */
  @IsOptional() @IsBoolean()
  exitDocumentsProvided?: boolean;

  /** Solde de tout compte réglé ? */
  @IsOptional() @IsBoolean()
  finalSettlementPaid?: boolean;

  /** Autorisé par (nom du responsable RH ou direction) */
  @IsOptional() @IsString()
  authorizedBy?: string;

  /** Référence de la lettre de débauche */
  @IsOptional() @IsString()
  terminationLetterRef?: string;

  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString()
  tenantId?: string;
}

/**
 * DTO pour la résiliation d'un contrat spécifique.
 * Contrairement à la débauche qui affecte le personnel et tous ses contrats,
 * la résiliation de contrat ne concerne qu'un seul contrat.
 */
export class TerminateContractDto {
  /** Motif de la résiliation */
  @IsString() @MaxLength(1000)
  reason: string;

  /** Date de résiliation (par défaut = aujourd'hui) */
  @IsOptional() @IsDateString()
  terminatedAt?: string;

  /** Type de résiliation */
  @IsOptional() @IsIn(['RESIGNATION', 'DISMISSAL', 'MUTUAL_AGREEMENT', 'END_OF_CONTRACT', 'OTHER'])
  terminationType?: string;

  /** Mettre à jour également le statut du personnel ? (par défaut true si c'est le seul contrat actif) */
  @IsOptional() @IsBoolean()
  updateStaffStatus?: boolean;

  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString()
  tenantId?: string;
}

// ─── Batch Assign Level DTOs ─────────────────────────────────────────────────

export class BatchAssignLevelDto {
  @IsArray()
  @IsUUID('4', { each: true })
  staffIds: string[];

  @IsUUID('4')
  @IsNotEmpty()
  schoolLevelId: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;
}
