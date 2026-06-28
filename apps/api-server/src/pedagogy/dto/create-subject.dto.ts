import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSubjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  abbreviation: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsNumber()
  @Type(() => Number)
  coefficient: number;

  @IsString()
  @IsOptional()
  language?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  weeklyHours?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  schoolLevelId: string;

  @IsString()
  @IsNotEmpty()
  academicYearId: string;

  @IsString()
  @IsOptional()
  academicTrackId?: string;
}
