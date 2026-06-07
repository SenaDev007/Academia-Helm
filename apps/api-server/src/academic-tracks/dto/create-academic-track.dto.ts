import { IsEnum, IsString, IsOptional, IsBoolean, IsInt, IsObject } from 'class-validator';
import { AcademicTrackCode } from '../entities/academic-track.entity';

export class CreateAcademicTrackDto {
  @IsEnum(AcademicTrackCode)
  code: AcademicTrackCode;

  @IsString()
  name: string;

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
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

