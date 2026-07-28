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

  @IsString()
  @IsOptional()
  portal_type?: string;
}

export class TeacherPortalLoginDto {
  @IsString()
  tenantId: string;

  @IsString()
  teacherIdentifier: string; // Identifiant enseignant

  @IsString()
  password: string;

  @IsString()
  @IsOptional()
  portal_type?: string;
}

/**
 * DTO d'authentification parent multi-canal.
 *
 * Deux modes de connexion supportés :
 *   1. Téléphone + OTP   → identifierType='PHONE' (par défaut pour rétrocompatibilité)
 *   2. Email + password   → identifierType='EMAIL'
 *
 * Le parent peut utiliser indifféremment le numéro de téléphone ou l'email
 * qu'il a fournis lors de l'inscription de son enfant.
 *
 * Pour le mode EMAIL, on envoie un OTP par email (au lieu du SMS).
 * Pour le mode PHONE, on envoie un OTP par SMS (comportement inchangé).
 */
export class ParentPortalLoginDto {
  @IsString()
  tenantId: string;

  /**
   * Type d'identifiant utilisé pour la connexion.
   * - 'PHONE' (défaut) : on cherche le Guardian par `phone`
   * - 'EMAIL'          : on cherche le Guardian par `email`
   * Si non fourni, on déduit automatiquement :
   *   - contient '@' → EMAIL
   *   - sinon       → PHONE
   */
  @IsString()
  @IsOptional()
  identifierType?: 'PHONE' | 'EMAIL';

  /**
   * Téléphone (si identifierType='PHONE' ou non spécifié).
   */
  @IsString()
  @IsOptional()
  phone?: string;

  /**
   * Email (si identifierType='EMAIL').
   */
  @IsEmail()
  @IsOptional()
  email?: string;

  /**
   * Code OTP (si mode OTP). Obligatoire en étape 2 du flux OTP.
   */
  @IsString()
  @IsOptional()
  otp?: string;

  /**
   * Mot de passe (si mode EMAIL + password, alternative à OTP).
   * Permet aux parents lettrés de se connecter sans OTP.
   */
  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  portal_type?: string;
}
