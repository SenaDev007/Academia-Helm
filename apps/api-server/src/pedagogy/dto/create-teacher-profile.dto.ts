import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTeacherProfileDto {
  @IsString()
  @IsNotEmpty()
  teacherId: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  maxWeeklyHours?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isSemainier?: boolean;

  @IsString()
  @IsNotEmpty()
  academicYearId: string;
}
