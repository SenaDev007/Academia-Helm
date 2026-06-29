/**
 * ============================================================================
 * SUPPLEMENTARY PEDAGOGY DTOs
 * ============================================================================
 * Replaces `@Body() data: any` and inline object types in Pedagogy controllers
 * with typed, validated DTOs.
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
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Room DTOs ──────────────────────────────────────────────────────────────

export class CreateRoomDto {
  @IsString() roomCode: string;
  @IsString() roomName: string;
  @IsIn(['CLASSROOM', 'LABORATORY', 'LIBRARY', 'OFFICE', 'MEETING_ROOM', 'SPORTS_HALL', 'MULTIPURPOSE', 'OTHER']) roomType: string;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) capacity?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsArray() equipment?: any[];
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
  /** Frontend may send tenantId — ignored (resolved server-side) */
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdateRoomDto {
  @IsOptional() @IsString() roomCode?: string;
  @IsOptional() @IsString() roomName?: string;
  @IsOptional() @IsIn(['CLASSROOM', 'LABORATORY', 'LIBRARY', 'OFFICE', 'MEETING_ROOM', 'SPORTS_HALL', 'MULTIPURPOSE', 'OTHER']) roomType?: string;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) capacity?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsArray() equipment?: any[];
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsOptional() @IsUUID() schoolLevelId?: string;
  @IsOptional() @IsString() tenantId?: string;
}

export class CreateRoomAllocationDto {
  @IsUUID() academicYearId: string;
  @IsOptional() @IsUUID() classId?: string;
  @IsOptional() @IsString() dayOfWeek?: string;
  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @IsString() endTime?: string;
  @IsOptional() @IsString() notes?: string;
}

// ─── Room Maintenance & Schedule DTOs ────────────────────────────────────────

export class CreateRoomMaintenanceDto {
  @IsUUID() roomId: string;
  @IsDateString() startDate: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsString() reason: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class CreateRoomScheduleDto {
  @IsUUID() academicYearId: string;
  @IsUUID() roomId: string;
  @IsInt() @Min(0) @Max(6) @Type(() => Number) dayOfWeek: number;
  @IsString() startTime: string;
  @IsString() endTime: string;
  @IsOptional() @IsUUID() classId?: string;
}

// ─── Time Slot DTO ──────────────────────────────────────────────────────────
// Prisma TimeSlot model: dayOfWeek (Int), startTime (String), endTime (String)

export class CreateTimeSlotDto {
  /** Prisma field: dayOfWeek Int */
  @IsInt() @Min(0) @Max(6) @Type(() => Number) dayOfWeek: number;
  /** Prisma field: startTime String (e.g. "08:00") */
  @IsString() startTime: string;
  /** Prisma field: endTime String (e.g. "10:00") */
  @IsString() endTime: string;
  /** Frontend may send name — not in Prisma model but accepted for display */
  @IsOptional() @IsString() name?: string;
  /** Frontend may send type — not in Prisma model but accepted for display */
  @IsOptional() @IsString() type?: string;
  /** Frontend may send isActive — not in Prisma model but accepted */
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** Frontend may send startHour/startMinute/endHour/endMinute — accepted, mapped to startTime/endTime in service */
  @IsOptional() @IsInt() @Min(0) @Max(23) @Type(() => Number) startHour?: number;
  @IsOptional() @IsInt() @Min(0) @Max(59) @Type(() => Number) startMinute?: number;
  @IsOptional() @IsInt() @Min(0) @Max(23) @Type(() => Number) endHour?: number;
  @IsOptional() @IsInt() @Min(0) @Max(59) @Type(() => Number) endMinute?: number;
  /** Frontend may send tenantId — ignored (resolved server-side) */
  @IsOptional() @IsString() tenantId?: string;
}

// ─── Pedagogy Sub-route DTOs ────────────────────────────────────────────────

export class CreateTeacherSubjectDto {
  @IsUUID() teacherId: string;
  @IsUUID() subjectId: string;
  @IsUUID() academicYearId: string;
  /** Frontend may send weeklyHours — not in Prisma TeacherSubject model, accepted but ignored */
  @IsOptional() @IsNumber() @Type(() => Number) weeklyHours?: number;
  /** Frontend may send tenantId — ignored (resolved server-side) */
  @IsOptional() @IsString() tenantId?: string;
}

export class CreateClassSubjectBulkDto {
  @IsUUID() academicYearId: string;
  @IsArray() @IsUUID(undefined, { each: true }) classIds: string[];
  @IsArray() @IsUUID(undefined, { each: true }) subjectIds: string[];
  @IsOptional() @IsNumber() @Type(() => Number) weeklyHours?: number;
  @IsOptional() @IsNumber() @Type(() => Number) coefficient?: number;
  @IsOptional() @IsBoolean() useSeriesCoefficients?: boolean;
  /** Frontend may send schoolLevelId */
  @IsOptional() @IsUUID() schoolLevelId?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class CreateClassSubjectDto {
  @IsUUID() classId: string;
  @IsUUID() subjectId: string;
  @IsUUID() academicYearId: string;
  @IsOptional() @IsNumber() @Type(() => Number) weeklyHours?: number;
  @IsOptional() @IsNumber() @Type(() => Number) coefficient?: number;
  @IsOptional() @IsUUID() schoolLevelId?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class CreateTeacherClassAssignmentDto {
  @IsUUID() teacherId: string;
  @IsUUID() classSubjectId: string;
  /// Classe physique (CI/A, CI/B) — optionnel mais recommandé
  @IsOptional() @IsUUID() classId?: string;
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsOptional() @IsNumber() @Type(() => Number) weeklyHours?: number;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

// ─── Academic Cycle Update DTO ───────────────────────────────────────────────

export class UpdateAcademicCycleDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) orderIndex?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// ─── Academic Series DTOs ────────────────────────────────────────────────────

export class CreateAcademicSeriesDto {
  @IsUUID() academicYearId: string;
  @IsUUID() levelId: string;
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdateAcademicSeriesDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class AddSeriesSubjectDto {
  @IsUUID() academicYearId: string;
  @IsUUID() seriesId: string;
  @IsUUID() subjectId: string;
  @IsNumber() @Type(() => Number) coefficient: number;
  @IsNumber() @Type(() => Number) weeklyHours: number;
  /** Frontend may send tenantId — ignored */
  @IsOptional() @IsString() tenantId?: string;
}

export class UpdateSeriesSubjectDto {
  @IsOptional() @IsNumber() @Type(() => Number) coefficient?: number;
  @IsOptional() @IsNumber() @Type(() => Number) weeklyHours?: number;
}

// ─── Teacher Profile Sub-route DTOs ─────────────────────────────────────────

export class AddQualificationDto {
  @IsUUID() academicYearId: string;
  @IsUUID() subjectId: string;
  @IsOptional() @IsBoolean() certified?: boolean;
}

export class AddLevelAuthorizationDto {
  @IsUUID() academicYearId: string;
  @IsUUID() levelId: string;
}

export class CreateAvailabilityDto {
  @IsUUID() academicYearId: string;
  @IsInt() @Min(0) @Max(6) @Type(() => Number) dayOfWeek: number;
  @IsString() startTime: string;
  @IsString() endTime: string;
  /// Statut de disponibilité :
  ///   'UNAVAILABLE' : enseignant NON disponible (défaut, rétro-compat)
  ///   'PREFERRED'   : enseignant PEUT enseigner + préfère ce créneau
  @IsOptional() @IsIn(['UNAVAILABLE', 'PREFERRED']) status?: string;
}

export class UpdateAvailabilityDto {
  @IsOptional() @IsInt() @Min(0) @Max(6) @Type(() => Number) dayOfWeek?: number;
  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @IsString() endTime?: string;
  @IsOptional() @IsIn(['UNAVAILABLE', 'PREFERRED']) status?: string;
}

// ─── Global Library DTOs ────────────────────────────────────────────────────

export class CreateGlobalLibraryResourceDto {
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() level?: string;
  @IsOptional() @IsString() classLevel?: string;
  @IsOptional() @IsString() series?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() language?: string;
  @IsString() resourceType: string;
  @IsOptional() @IsString() fileUrl?: string;
  @IsOptional() @IsString() externalUrl?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
  /** Frontend may send tenantId — ignored (resolved server-side) */
  @IsOptional() @IsString() tenantId?: string;
  /** Frontend may send createdBy — resolved server-side */
  @IsOptional() @IsString() createdBy?: string;
}

export class UpdateGlobalLibraryResourceDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() level?: string;
  @IsOptional() @IsString() classLevel?: string;
  @IsOptional() @IsString() series?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() resourceType?: string;
  @IsOptional() @IsString() fileUrl?: string;
  @IsOptional() @IsString() externalUrl?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
  @IsOptional() @IsString() tenantId?: string;
}

export class UpsertAnnotationDto {
  @IsString() staffId: string;
  @IsString() note: string;
}
