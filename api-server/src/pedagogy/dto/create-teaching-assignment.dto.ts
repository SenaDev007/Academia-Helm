import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTeachingAssignmentDto {
  @IsString()
  @IsNotEmpty()
  profileId: string;

  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsString()
  @IsOptional()
  seriesId?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  weeklyHours?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsNotEmpty()
  academicYearId: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
