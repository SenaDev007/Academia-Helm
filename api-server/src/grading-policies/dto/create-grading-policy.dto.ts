import { IsString, IsNumber, IsBoolean, IsObject, IsOptional, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class GradeScaleDto {
  @IsNumber()
  min: number;

  @IsNumber()
  max: number;

  @IsString()
  mention: string;

  @IsOptional()
  @IsString()
  emoji?: string;

  @IsOptional()
  @IsString()
  observation?: string;

  @IsOptional()
  @IsString()
  recommendation?: string;
}

class CalculationRulesDto {
  @IsBoolean()
  useCoefficients: boolean;

  @IsString()
  roundingMethod: 'floor' | 'ceil' | 'round';

  @IsNumber()
  decimalPlaces: number;
}

class ReportCardConfigDto {
  @IsString()
  template: string;

  @IsBoolean()
  includeRanking: boolean;

  @IsBoolean()
  includeClassAverage: boolean;

  @IsBoolean()
  includeComments: boolean;
}

export class CreateGradingPolicyDto {
  @IsUUID()
  countryId: string;

  @IsString()
  name: string;

  @IsString()
  educationLevel: string;

  @IsNumber()
  maxScore: number;

  @IsNumber()
  passingScore: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeScaleDto)
  gradeScales: GradeScaleDto[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CalculationRulesDto)
  calculationRules?: CalculationRulesDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ReportCardConfigDto)
  reportCardConfig?: ReportCardConfigDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

