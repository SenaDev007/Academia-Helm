/**
 * ============================================================================
 * EXAMS-GRADES DTOs
 * ============================================================================
 * DTOs pour le module Examens & Notes (Layer 2 - Prisma)
 *
 * Ces DTOs sont nécessaires car forbidNonWhitelisted: true dans le ValidationPipe
 * global rejette toute propriété non déclarée.
 * ============================================================================
 */

import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsUUID,
  IsBoolean,
  IsArray,
  IsIn,
  IsNotEmpty,
  Min,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Examen (Exam) ──────────────────────────────────────────────

export class CreateExamPrismaDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsIn(['DEVOIR', 'COMPOSITION', 'ORAL', 'PRATIQUE', 'INTERROGATION'])
  examType: string;

  @IsUUID()
  @IsNotEmpty()
  subjectId: string;

  @IsUUID()
  @IsNotEmpty()
  academicYearId: string;

  @IsUUID()
  @IsNotEmpty()
  schoolLevelId: string;

  @IsUUID()
  @IsOptional()
  academicTrackId?: string;

  @IsUUID()
  @IsOptional()
  quarterId?: string;

  @IsUUID()
  @IsOptional()
  classSubjectId?: string;

  @IsUUID()
  @IsOptional()
  classId?: string;

  @IsDateString()
  @IsNotEmpty()
  examDate: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxScore?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  coefficient?: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateExamPrismaDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsIn(['DEVOIR', 'COMPOSITION', 'ORAL', 'PRATIQUE', 'INTERROGATION'])
  @IsOptional()
  examType?: string;

  @IsDateString()
  @IsOptional()
  examDate?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxScore?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  coefficient?: number;

  @IsString()
  @IsOptional()
  description?: string;
}

// ─── Notes (Exam Scores) ────────────────────────────────────────

export class CreateExamScoreDto {
  @IsUUID()
  @IsNotEmpty()
  examId: string;

  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @IsUUID()
  @IsNotEmpty()
  subjectId: string;

  @IsUUID()
  @IsNotEmpty()
  academicYearId: string;

  @IsUUID()
  @IsNotEmpty()
  schoolLevelId: string;

  @IsUUID()
  @IsOptional()
  academicTrackId?: string;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  score: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxScore?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  coefficient?: number;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class ValidateScoresDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @IsNotEmpty()
  scoreIds: string[];
}

// ─── Feuille de notation (Grading Sheet) ────────────────────────

export class GradingSheetScoreDto {
  @IsUUID()
  studentId: string;

  @IsObject()
  @IsOptional()
  scores?: Record<string, number>;
}

export class SaveGradingSheetDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradingSheetScoreDto)
  scores: GradingSheetScoreDto[];

  @IsBoolean()
  @IsOptional()
  submit?: boolean;
}

// ─── Calcul des moyennes ────────────────────────────────────────

export class CalculateAveragesDto {
  @IsUUID()
  @IsNotEmpty()
  classId: string;

  @IsUUID()
  @IsNotEmpty()
  periodId: string;

  @IsUUID()
  @IsNotEmpty()
  academicYearId: string;
}

// ─── Bulletins / Report Cards ───────────────────────────────────

export class GenerateReportCardsDto {
  @IsUUID()
  @IsNotEmpty()
  classId: string;

  @IsUUID()
  @IsNotEmpty()
  periodId: string;

  @IsUUID()
  @IsNotEmpty()
  academicYearId: string;
}

export class GenerateReportCardDto {
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @IsUUID()
  @IsNotEmpty()
  academicYearId: string;

  @IsUUID()
  @IsNotEmpty()
  schoolLevelId: string;

  @IsUUID()
  @IsOptional()
  academicTrackId?: string;

  @IsUUID()
  @IsOptional()
  quarterId?: string;

  @IsString()
  @IsIn(['QUARTERLY', 'SEMESTER', 'ANNUAL', 'SEQUENCE'])
  @IsNotEmpty()
  type: string;
}

export class PublishReportCardDto {
  @IsString()
  @IsNotEmpty()
  filePath: string;
}

// ─── Publication des bulletins ──────────────────────────────────

export class PublishBulletinsDto {
  @IsUUID()
  @IsNotEmpty()
  classId: string;

  @IsUUID()
  @IsNotEmpty()
  periodId: string;

  @IsUUID()
  @IsNotEmpty()
  academicYearId: string;
}

// ─── Tableau d'honneur (Honor Rolls) ───────────────────────────

export class GenerateHonorRollDto {
  @IsUUID()
  @IsNotEmpty()
  academicYearId: string;

  @IsUUID()
  @IsNotEmpty()
  schoolLevelId: string;

  @IsUUID()
  @IsNotEmpty()
  quarterId: string;

  @IsUUID()
  @IsOptional()
  academicTrackId?: string;

  @IsUUID()
  @IsOptional()
  classId?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minAverage?: number;
}

// ─── Décisions de conseil (Council Decisions) ──────────────────

export class CreateCouncilDecisionDto {
  @IsUUID()
  @IsNotEmpty()
  councilId: string;

  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @IsUUID()
  @IsNotEmpty()
  academicYearId: string;

  @IsUUID()
  @IsNotEmpty()
  schoolLevelId: string;

  @IsUUID()
  @IsOptional()
  quarterId?: string;

  @IsString()
  @IsIn(['ADMIS', 'REDOUBLE', 'AJOURNE', 'CONDITIONAL'])
  @IsNotEmpty()
  decision: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  comments?: string;

  @IsNumber()
  @IsOptional()
  votesFor?: number;

  @IsNumber()
  @IsOptional()
  votesAgainst?: number;

  @IsNumber()
  @IsOptional()
  votesAbstain?: number;
}

export class UpdateCouncilDecisionDto {
  @IsString()
  @IsIn(['ADMIS', 'REDOUBLE', 'AJOURNE', 'CONDITIONAL'])
  @IsOptional()
  decision?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  comments?: string;

  @IsNumber()
  @IsOptional()
  votesFor?: number;

  @IsNumber()
  @IsOptional()
  votesAgainst?: number;

  @IsNumber()
  @IsOptional()
  votesAbstain?: number;
}
