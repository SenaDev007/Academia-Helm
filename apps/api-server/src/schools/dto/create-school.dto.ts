import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateSchoolDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  abbreviation?: string;

  @IsArray()
  @IsOptional()
  educationLevels?: string[];

  @IsString()
  @IsOptional()
  motto?: string;

  @IsString()
  @IsOptional()
  slogan?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  primaryPhone?: string;

  @IsString()
  @IsOptional()
  secondaryPhone?: string;

  @IsString()
  @IsOptional()
  primaryEmail?: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsString()
  @IsOptional()
  whatsapp?: string;

  @IsString()
  @IsOptional()
  logo?: string;

  @IsString()
  @IsOptional()
  primaryColor?: string;

  @IsString()
  @IsOptional()
  secondaryColor?: string;

  @IsString()
  @IsOptional()
  founderName?: string;

  @IsString()
  @IsOptional()
  directorPrimary?: string;

  @IsString()
  @IsOptional()
  directorSecondary?: string;
}

