import { IsString, IsDateString, IsInt, IsBoolean, IsOptional, Min, Max } from 'class-validator';

export class CreateQuarterDto {
  @IsString()
  academicYearId: string;

  @IsString()
  name: string;

  @IsInt()
  @Min(1)
  @Max(4)
  number: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsBoolean()
  @IsOptional()
  isCurrent?: boolean;
}

