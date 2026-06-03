import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class CreateClassDiaryDto {
  @IsString()
  @IsNotEmpty()
  classSubjectId: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  homework?: string;

  @IsString()
  @IsOptional()
  teacherNotes?: string;
}
