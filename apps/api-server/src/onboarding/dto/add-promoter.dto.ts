import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';

export class AddPromoterDto {
  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  phone: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  otpCode?: string;
}
