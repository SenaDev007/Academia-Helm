import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class CreateSemainierDto {
  @IsString()
  @IsNotEmpty()
  assignmentId: string;

  @IsDateString()
  @IsNotEmpty()
  weekStartDate: string;

  @IsDateString()
  @IsNotEmpty()
  weekEndDate: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsNotEmpty()
  schoolLevelId: string;

  @IsString()
  @IsNotEmpty()
  academicYearId: string;
}
