import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class CreateLessonPlanDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsOptional()
  classId?: string;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsString()
  @IsOptional()
  teacherId?: string;

  @IsString()
  @IsOptional()
  objectives?: string;

  @IsString()
  @IsOptional()
  methodology?: string;

  @IsString()
  @IsOptional()
  materials?: string;

  @IsString()
  @IsOptional()
  evaluation?: string;

  @IsString()
  @IsOptional()
  homework?: string;

  @IsString()
  @IsNotEmpty()
  schoolLevelId: string;

  @IsString()
  @IsNotEmpty()
  academicYearId: string;

  @IsString()
  @IsOptional()
  academicTrackId?: string;
}
