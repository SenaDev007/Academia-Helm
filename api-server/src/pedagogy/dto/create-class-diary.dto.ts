import { IsString, IsNotEmpty, IsOptional, IsDateString, IsUUID } from 'class-validator';

export class CreateClassDiaryDto {
  @IsUUID()
  @IsNotEmpty()
  classSubjectId: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  /** Prisma field: homework String? */
  @IsString()
  @IsOptional()
  homework?: string;

  /** Prisma field: notes String? (was incorrectly named teacherNotes) */
  @IsString()
  @IsOptional()
  notes?: string;

  /** Required by Prisma schema */
  @IsUUID()
  @IsNotEmpty()
  academicYearId: string;

  /** Required by Prisma schema */
  @IsUUID()
  @IsNotEmpty()
  schoolLevelId: string;

  /** Frontend may send content (legacy) — can be mapped to notes in service */
  @IsString()
  @IsOptional()
  content?: string;

  /** Frontend may send teacherNotes (legacy) — mapped to notes in service */
  @IsString()
  @IsOptional()
  teacherNotes?: string;
}
