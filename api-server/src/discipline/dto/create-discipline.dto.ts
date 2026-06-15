import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateDisciplineDto {
  @IsString()
  studentId: string;

  @IsDateString()
  incidentDate: string;

  @IsString()
  @IsOptional()
  severity?: string;

  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  actionTaken?: string;
}

