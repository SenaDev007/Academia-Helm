import { IsEnum, IsString, IsOptional, IsInt, IsBoolean, IsObject } from 'class-validator';
import { SchoolLevelType } from '../entities/school-level.entity';

export class CreateSchoolLevelDto {
  @IsEnum(SchoolLevelType)
  type: SchoolLevelType;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  abbreviation?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

