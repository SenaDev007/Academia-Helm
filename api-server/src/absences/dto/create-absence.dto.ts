import { IsString, IsDateString, IsBoolean, IsOptional } from 'class-validator';

export class CreateAbsenceDto {
  @IsString()
  studentId: string;

  @IsString()
  @IsOptional()
  classId?: string;

  @IsDateString()
  date: string;

  @IsBoolean()
  @IsOptional()
  isJustified?: boolean;

  @IsString()
  @IsOptional()
  justification?: string;
}

