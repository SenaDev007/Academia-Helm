import {
  IsEnum,
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  IsUUID,
  IsObject,
} from 'class-validator';
import { ModuleType, ModuleStatus } from '../entities/module.entity';

export class CreateModuleDto {
  @IsEnum(ModuleType)
  type: ModuleType;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  schoolLevelId: string;

  @IsOptional()
  @IsEnum(ModuleStatus)
  status?: ModuleStatus;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependencies?: string[];

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @IsString()
  icon?: string;
}

