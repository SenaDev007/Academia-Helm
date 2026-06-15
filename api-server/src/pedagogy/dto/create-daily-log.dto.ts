import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsDateString, IsUUID } from 'class-validator';

export class CreateDailyLogDto {
  @IsUUID()
  @IsNotEmpty()
  teacherId: string;

  /** Optional in Prisma schema (classId String?) */
  @IsUUID()
  @IsOptional()
  classId?: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  /** Prisma field is `summary` (not `content`) */
  @IsString()
  @IsNotEmpty()
  summary: string;

  /** Prisma field: validated Boolean @default(false) */
  @IsBoolean()
  @IsOptional()
  validated?: boolean;

  /** Required by Prisma schema */
  @IsUUID()
  @IsNotEmpty()
  academicYearId: string;

  /** Required by Prisma schema */
  @IsUUID()
  @IsNotEmpty()
  schoolLevelId: string;

  /** Frontend may send subjectId (not in Prisma model but accepted for lookups) */
  @IsUUID()
  @IsOptional()
  subjectId?: string;

  /** Frontend may send homework (not in DailyLog Prisma model) */
  @IsString()
  @IsOptional()
  homework?: string;

  /** Frontend may send content as alias for summary */
  @IsString()
  @IsOptional()
  content?: string;

  /** Frontend may send status (legacy) — mapped to validated in service */
  @IsString()
  @IsOptional()
  status?: string;
}
