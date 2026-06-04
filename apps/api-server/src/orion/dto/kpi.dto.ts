import { IsString, IsOptional, IsNumber, IsObject } from 'class-validator';

export class UpsertKpiDefinitionDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  category: string;

  @IsString()
  unit: string;

  @IsOptional()
  @IsNumber()
  targetValue?: number;

  @IsOptional()
  @IsNumber()
  warningThreshold?: number;

  @IsOptional()
  @IsNumber()
  criticalThreshold?: number;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsObject()
  calculationConfig?: Record<string, any>;
}

export class CalculateKpiDto {
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  schoolLevelId?: string;
}
