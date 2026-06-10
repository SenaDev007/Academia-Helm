/**
 * ============================================================================
 * PORTAL LOGIN DTOs
 * ============================================================================
 */

import { IsString, IsEmail, IsOptional, IsEnum } from 'class-validator';

export enum PortalType {
  SCHOOL = 'SCHOOL',
  TEACHER = 'TEACHER',
  PARENT = 'PARENT',
}

export class SchoolPortalLoginDto {
  @IsString()
  tenantId: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class TeacherPortalLoginDto {
  @IsString()
  tenantId: string;

  @IsString()
  teacherIdentifier: string; // Identifiant enseignant

  @IsString()
  password: string;
}

export class ParentPortalLoginDto {
  @IsString()
  tenantId: string;

  @IsString()
  phone: string; // Téléphone parent

  @IsString()
  @IsOptional()
  otp?: string; // Code OTP si déjà envoyé
}

