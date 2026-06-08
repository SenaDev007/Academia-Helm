import { PartialType } from '@nestjs/mapped-types';
import { CreateTenantFeatureDto } from './create-tenant-feature.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { FeatureStatus } from '../entities/tenant-feature.entity';

export class UpdateTenantFeatureDto extends PartialType(CreateTenantFeatureDto) {
  @IsOptional()
  @IsEnum(FeatureStatus)
  status?: FeatureStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

