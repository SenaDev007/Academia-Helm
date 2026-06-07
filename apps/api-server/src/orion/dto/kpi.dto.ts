import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

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
  @IsString()
  formula?: string;

  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CalculateKpiDto {
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  schoolLevelId?: string;
}
