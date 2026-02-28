import { IsString, IsOptional, IsDateString, IsEmail, IsPhoneNumber } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  /** NPI : Numéro d'Identification Personnel (citoyens béninois). Distinct du matricule Academia Helm et du numéro Educmaster. */
  @IsOptional()
  @IsString()
  npi?: string;
}
