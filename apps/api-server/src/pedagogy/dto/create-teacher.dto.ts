import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum ContractType {
  CDI = 'CDI',
  CDD = 'CDD',
  INTERIM = 'INTERIM',
  VACATAIRE = 'VACATAIRE',
  STAGIAIRE = 'STAGIAIRE',
}

export enum TeacherStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ON_LEAVE = 'on_leave',
  ARCHIVED = 'archived',
}

export class CreateTeacherDto {
  @IsString()
  @IsNotEmpty()
  matricule: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

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

  @IsEnum(ContractType)
  @IsOptional()
  contractType?: ContractType;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  workingHours?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
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

  @IsString()
  @IsNotEmpty()
  schoolLevelId: string;

  @IsEnum(TeacherStatus)
  @IsOptional()
  status?: TeacherStatus;
}
