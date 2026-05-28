import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  abbreviation?: string;

  @IsString()
  code: string;

  @IsString()
  level: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  coefficient?: number;

  @IsString()
  @IsOptional()
  academicYearId?: string;
}

