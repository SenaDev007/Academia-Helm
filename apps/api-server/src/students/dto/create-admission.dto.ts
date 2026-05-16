import { IsString, IsOptional, IsEnum, IsDateString, IsBoolean } from 'class-validator';
import { Gender } from '@prisma/client';

export class CreateAdmissionDto {
  @IsString()
  academicYearId: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsEnum(['M', 'F'])
  gender?: Gender;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  birthPlace?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  requestedLevelId?: string;

  @IsOptional()
  @IsString()
  requestedClassId?: string;

  @IsOptional()
  @IsString()
  requestedSeriesId?: string;

  @IsOptional()
  @IsBoolean()
  wantsBilingual?: boolean;

  @IsOptional()
  @IsString()
  previousSchool?: string;

  @IsOptional()
  @IsString()
  mainGuardianName?: string;

  @IsOptional()
  @IsString()
  mainGuardianPhone?: string;

  @IsOptional()
  @IsString()
  mainGuardianEmail?: string;
}
