import { IsString, IsOptional, IsIn, IsDateString } from 'class-validator';

export class CreateAdmissionDto {
  @IsString()
  academicYearId: string;

  @IsString()
  schoolLevelId: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsIn(['M', 'F'])
  gender?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
