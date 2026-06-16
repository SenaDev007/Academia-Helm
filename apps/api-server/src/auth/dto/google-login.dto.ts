/**
 * ============================================================================
 * DTOs pour Google OAuth School (Portail École)
 * ============================================================================
 *
 * Endpoints :
 *   POST /auth/check-school-user — vérifie qu'un user existe pour ce tenant
 *   POST /auth/google-login      — crée une session sans password (Google + OTP)
 *
 * Le flow complet :
 *   1. Frontend initie Google OAuth → reçoit code Google
 *   2. Frontend échange code → infos user (email, name, picture)
 *   3. Frontend appelle /auth/check-school-user pour vérifier l'user existe
 *   4. Si OK, frontend envoie OTP par email (Resend)
 *   5. User saisit OTP
 *   6. Frontend appelle /auth/google-login → crée session (sans password)
 * ============================================================================
 */

import { IsEmail, IsString, IsOptional, IsIn } from 'class-validator';

/**
 * POST /auth/check-school-user
 * Vérifie qu'un user avec cet email existe dans le tenant donné.
 */
export class CheckSchoolUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  tenant_id!: string; // UUID ou slug (résolu côté service)
}

/**
 * POST /auth/google-login
 * Crée une session SCHOOL pour l'utilisateur sans vérifier le mot de passe.
 * L'identité a déjà été prouvée via Google OAuth + OTP email.
 */
export class GoogleLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  tenant_id!: string; // UUID ou slug (résolu côté service)

  @IsString()
  @IsIn(['SCHOOL'])
  portal_type!: 'SCHOOL'; // Uniquement SCHOOL pour l'instant
}
