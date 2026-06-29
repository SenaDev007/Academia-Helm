import { IsString, IsOptional, IsIn, IsDateString, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO pour la création d'une admission.
 *
 * ⚠️ Tous les champs collectés par le formulaire frontend (AdmissionForm.tsx)
 * doivent être déclarés ici — sinon le ValidationPipe global avec
 * forbidNonWhitelisted=true rejette la requête avec "property X should not exist".
 *
 * Le service AdmissionService.create() persiste TOUS ces champs (depuis
 * la migration 20260701080000_extend_admissions_table).
 */
export class CreateAdmissionDto {
  @IsString()
  academicYearId: string;

  @IsString()
  schoolLevelId: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional() @IsIn(['M', 'F'])
  gender?: string;

  @IsOptional() @IsDateString()
  dateOfBirth?: string;

  // ─── Identité élève ──────────────────────────────────────────────────────
  @IsOptional() @IsString()
  birthPlace?: string;

  @IsOptional() @IsString()
  nationality?: string;

  @IsOptional() @IsString()
  address?: string;

  // ─── Vœux académiques ────────────────────────────────────────────────────
  @IsOptional() @IsString()
  requestedClassId?: string;

  @IsOptional() @IsString()
  requestedSeriesId?: string;

  @IsOptional() @IsBoolean()
  wantsBilingual?: boolean;

  @IsOptional() @IsString()
  previousSchool?: string;

  // ─── Responsable légal ───────────────────────────────────────────────────
  @IsOptional() @IsString()
  mainGuardianName?: string;

  @IsOptional() @IsString()
  mainGuardianPhone?: string;

  @IsOptional() @IsString()
  mainGuardianEmail?: string;

  @IsOptional() @IsString()
  mainGuardianRelationship?: string;

  // ─── Divers ──────────────────────────────────────────────────────────────
  @IsOptional() @IsString()
  notes?: string;

  /** Frontend peut envoyer tenantId — ignoré (résolu server-side) */
  @IsOptional() @IsString()
  tenantId?: string;
}
