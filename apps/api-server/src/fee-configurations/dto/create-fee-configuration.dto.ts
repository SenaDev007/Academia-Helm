import { IsString, IsNumber, IsBoolean, IsDateString, IsOptional, Min } from 'class-validator';

export class CreateFeeConfigurationDto {
  @IsString()
  name: string;

  @IsString()
  feeType: string;

  @IsString()
  @IsOptional()
  level?: string;

  @IsString()
  @IsOptional()
  classId?: string;

  @IsString()
  @IsOptional()
  academicYearId?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsDateString()
  @IsOptional()
  dueDate?: string;
}

