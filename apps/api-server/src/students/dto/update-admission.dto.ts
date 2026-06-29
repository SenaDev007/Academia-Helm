import { PartialType } from '@nestjs/mapped-types';
import { CreateAdmissionDto } from './create-admission.dto';
import { IsIn, IsOptional, IsString, IsDateString, IsNumber, Type } from 'class-transformer';
import { IsBoolean } from 'class-validator';

/**
 * DTO pour la mise à jour d'une admission.
 *
 * Étend CreateAdmissionDto (tous les champs deviennent optionnels via PartialType)
 * + ajoute les champs spécifiques à la mise à jour (status, decision, etc.).
 */
export class UpdateAdmissionDto extends PartialType(CreateAdmissionDto) {
  // ─── Statut & décision ────────────────────────────────────────────────────
  @IsOptional()
  @IsIn([
    'PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'MISSING_DOCUMENTS',
    'INTERVIEW_REQUIRED', 'TEST_REQUIRED', 'ACCEPTED', 'REJECTED',
    'WAITLISTED', 'CONVERTED', 'CANCELLED',
  ])
  status?: string;

  @IsOptional() @IsString()
  decisionBy?: string;

  @IsOptional() @IsDateString()
  decisionDate?: string;

  @IsOptional() @IsString()
  notes?: string;

  // ─── Entretien / Test (Phase 3) ───────────────────────────────────────────
  @IsOptional() @IsDateString()
  interviewDate?: string;

  @IsOptional() @IsDateString()
  testDate?: string;

  @IsOptional() @IsNumber() @Type(() => Number)
  testScore?: number;

  // ─── Traçabilité conversion ───────────────────────────────────────────────
  @IsOptional() @IsString()
  convertedStudentId?: string;
}
