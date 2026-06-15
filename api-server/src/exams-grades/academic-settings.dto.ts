/**
 * ============================================================================
 * ACADEMIC SETTINGS DTOs
 * ============================================================================
 *
 * Data Transfer Objects for creating and updating SchoolAcademicSettings.
 * All fields are validated using class-validator decorators.
 *
 * ============================================================================
 */

import {
  IsString,
  IsOptional,
  IsObject,
  IsNotEmpty,
} from 'class-validator';

// ---------------------------------------------------------------------------
// CreateAcademicSettingsDto
// ---------------------------------------------------------------------------

export class CreateAcademicSettingsDto {
  /** Human-readable name for this settings profile */
  @IsString()
  @IsNotEmpty()
  name: string;

  /** Optional description of the settings */
  @IsString()
  @IsOptional()
  description?: string;

  /** ISO 3166-1 alpha-2 country code (e.g. 'CM', 'FR') */
  @IsString()
  @IsNotEmpty()
  countryCode: string;

  /** Education system code (e.g. 'FRANCOPHONE', 'ANGLOPHONE') */
  @IsString()
  @IsOptional()
  systemCode?: string;

  /** Curriculum cycle code (e.g. 'PRIMARY', 'SECONDARY') */
  @IsString()
  @IsOptional()
  cycleCode?: string;

  /** School level code (e.g. 'FORM1', 'CLASS6') */
  @IsString()
  @IsOptional()
  levelCode?: string;

  /** Optional class identifier for class-scoped overrides */
  @IsString()
  @IsOptional()
  classId?: string;

  /** School year this settings profile belongs to */
  @IsString()
  @IsNotEmpty()
  schoolYearId: string;

  /**
   * Full academic config object.
   * Expected shape:
   * {
   *   periods: Array<{ code, label, startDate, endDate }>,
   *   assessmentTypes: Array<{ code, label, maxScore, weight, includedInAverage }>,
   *   calculationRules: {
   *     subjectAverage: { expression: string, type: string },
   *     generalAverage: { weighted: boolean },
   *     promotionRules: Array<{ condition: string, decision: string }>,
   *     appreciationScale: Array<{ min: number, max: number, label: string }>,
   *   },
   * }
   */
  @IsObject()
  @IsNotEmpty()
  config: Record<string, any>;
}

// ---------------------------------------------------------------------------
// UpdateAcademicSettingsDto
// ---------------------------------------------------------------------------

export class UpdateAcademicSettingsDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  countryCode?: string;

  @IsString()
  @IsOptional()
  systemCode?: string;

  @IsString()
  @IsOptional()
  cycleCode?: string;

  @IsString()
  @IsOptional()
  levelCode?: string;

  @IsString()
  @IsOptional()
  classId?: string;

  @IsString()
  @IsOptional()
  schoolYearId?: string;

  @IsObject()
  @IsOptional()
  config?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// ActivateSettingsDto
// ---------------------------------------------------------------------------

/**
 * Payload for the activate endpoint.
 * Currently intentionally empty — the target settings ID comes from the URL.
 */
export class ActivateSettingsDto {}

// ---------------------------------------------------------------------------
// LockSettingsDto
// ---------------------------------------------------------------------------

/**
 * Payload for the lock endpoint.
 * Currently intentionally empty — the target settings ID comes from the URL.
 */
export class LockSettingsDto {}

// ---------------------------------------------------------------------------
// DuplicateSettingsDto
// ---------------------------------------------------------------------------

/**
 * Payload for the duplicate endpoint.
 * Optionally override the name of the new settings profile.
 */
export class DuplicateSettingsDto {
  /** Optional new name for the duplicated settings. Defaults to "<original> (copie)". */
  @IsString()
  @IsOptional()
  name?: string;
}
