import { IsString, IsNumber, IsOptional, Min, IsUUID } from 'class-validator';

export class CreateGradeDto {
  @IsString()
  studentId: string;

  @IsString()
  @IsOptional()
  examId?: string;

  @IsString()
  subjectId: string;

  @IsString()
  @IsOptional()
  classId?: string;

  @IsString()
  @IsOptional()
  academicYearId?: string;

  @IsString()
  @IsOptional()
  quarterId?: string;

  @IsNumber()
  @Min(0)
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
  notes?: string;

  @IsUUID()
  @IsOptional()
  academicTrackId?: string;
}

