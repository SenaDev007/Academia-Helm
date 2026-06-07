import { IsString, IsOptional, IsDateString, IsInt, IsNumber, Min } from 'class-validator';

export class CreateTeacherDto {
  @IsString()
  matricule: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  specialization?: string;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsString()
  @IsOptional()
  academicYearId?: string;

  @IsDateString()
  @IsOptional()
  hireDate?: string;

  @IsString()
  @IsOptional()
  contractType?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  workingHours?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  salary?: number;

  @IsString()
  @IsOptional()
  bankDetails?: string;

  @IsString()
  @IsOptional()
  emergencyContact?: string;

  @IsString()
  @IsOptional()
  qualifications?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

