import { IsString, IsDateString, IsNumber, IsOptional, Min, IsUUID, IsIn, IsNotEmpty } from 'class-validator';

export class CreateExamDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsIn(['DEVOIR', 'COMPOSITION', 'ORAL', 'PRATIQUE', 'INTERROGATION'])
  @IsOptional()
  examType?: string;

  @IsUUID()
  @IsOptional()
  subjectId?: string;

  @IsUUID()
  @IsOptional()
  classId?: string;

  @IsUUID()
  @IsOptional()
  academicYearId?: string;

  @IsUUID()
  @IsOptional()
  quarterId?: string;

  @IsDateString()
  @IsOptional()
  examDate?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxScore?: number;

  @IsUUID()
  @IsOptional()
  academicTrackId?: string;
}
