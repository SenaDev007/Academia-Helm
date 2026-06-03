import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAcademicClassDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  capacity?: number;

  @IsString()
  @IsNotEmpty()
  levelId: string;

  @IsString()
  @IsOptional()
  cycleId?: string;

  @IsString()
  @IsOptional()
  roomId?: string;

  @IsString()
  @IsOptional()
  mainTeacherId?: string;

  @IsString()
  @IsOptional()
  languageTrack?: string;

  @IsString()
  @IsOptional()
  seriesId?: string;

  @IsString()
  @IsNotEmpty()
  academicYearId: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
