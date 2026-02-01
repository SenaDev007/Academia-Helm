import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';

export enum PortalType {
  PLATFORM = 'PLATFORM',
  SCHOOL = 'SCHOOL',
  TEACHER = 'TEACHER',
  PARENT = 'PARENT',
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  tenant_id?: string;

  @IsOptional()
  @IsEnum(PortalType)
  portal_type?: PortalType;
}

