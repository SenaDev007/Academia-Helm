import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAcademicCycleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Type(() => Number)
  orderIndex: number;

  @IsString()
  @IsNotEmpty()
  levelId: string;

  @IsString()
  @IsNotEmpty()
  academicYearId: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
