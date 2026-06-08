import { IsEnum, IsOptional, IsString, IsObject } from 'class-validator';
import { FeatureCode, FeatureStatus } from '../entities/tenant-feature.entity';

export class CreateTenantFeatureDto {
  @IsEnum(FeatureCode)
  featureCode: FeatureCode;

  @IsOptional()
  @IsEnum(FeatureStatus)
  status?: FeatureStatus;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

