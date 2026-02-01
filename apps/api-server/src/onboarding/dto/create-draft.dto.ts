import { IsString, IsEmail, IsBoolean, IsInt, IsOptional, MinLength } from 'class-validator';

export class CreateDraftDto {
  @IsString()
  @MinLength(2)
  schoolName: string;

  @IsString()
  schoolType: string; // 'MATERNELLE' | 'PRIMAIRE' | 'SECONDAIRE' | 'MIXTE'

  @IsString()
  city: string;

  @IsString()
  country: string;

  @IsString()
  phone: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsBoolean()
  bilingual?: boolean;

  @IsOptional()
  @IsInt()
  schoolsCount?: number;
}
