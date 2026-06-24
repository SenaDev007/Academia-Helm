import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsDateString, IsUUID, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDailyLogDto {
  @IsUUID()
  @IsOptional()
  teacherId?: string;

  /** Optional in Prisma schema (classId String?) */
  @IsUUID()
  @IsOptional()
  classId?: string;

  @IsDateString()
  @IsOptional()
  date?: string;

  /** Prisma field is `summary` (not `content`) */
  @IsString()
  @IsOptional()
  summary?: string;

  /** Prisma field: validated Boolean @default(false) */
  @IsBoolean()
  @IsOptional()
  validated?: boolean;

  /** Required by Prisma schema — now optional, resolved by service */
  @IsUUID()
  @IsOptional()
  academicYearId?: string;

  /** Required by Prisma schema — now optional, resolved by service */
  @IsOptional() @IsString() schoolLevelId?: string;

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

  // ─── Homework-specific fields (accepted from frontend, mapped in service) ──

  /** Homework title — mapped to summary by service if summary not provided */
  @IsString()
  @IsOptional()
  title?: string;

  /** Homework description — appended to summary by service */
  @IsString()
  @IsOptional()
  description?: string;

  /** Homework due date — mapped to `date` by service if date not provided */
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  /** Homework max score — stored in summary metadata */
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  maxScore?: number;
}
