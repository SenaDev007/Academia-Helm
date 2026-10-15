/**
 * ============================================================================
 * HELM ENSEIGNANT — DTOs du portail enseignant autonome
 * ============================================================================
 *
 * Mini-SaaS intégré à Academia Helm : un enseignant individuel crée son
 * compte SANS école (son propre tenant `type: 'TEACHER'`), active les
 * niveaux qu'il enseigne (maternelle / primaire / secondaire) et reçoit
 * automatiquement toutes les classes et matières du niveau.
 */

import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsArray,
  IsIn,
  ArrayMinSize,
  ArrayMaxSize,
  IsOptional,
  IsBoolean,
} from 'class-validator';

/** Codes de niveaux proposés à l'enseignant autonome (offerts par défaut). */
export const TEACHER_LEVEL_CODES = ['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE'] as const;
export type TeacherLevelCode = (typeof TEACHER_LEVEL_CODES)[number];

export class RegisterTeacherDto {
  @IsEmail({}, { message: 'Adresse email invalide' })
  @IsNotEmpty({ message: 'Email requis' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @MaxLength(72)
  password!: string;

  @IsString()
  @IsNotEmpty({ message: 'Prénom requis' })
  @MinLength(2)
  @MaxLength(60)
  firstName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Nom requis' })
  @MinLength(2)
  @MaxLength(60)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  /** Niveaux activés à l'inscription — au moins un requis. */
  @IsArray()
  @ArrayMinSize(1, { message: 'Activez au moins un niveau' })
  @ArrayMaxSize(3)
  @IsIn(TEACHER_LEVEL_CODES, { each: true })
  levels!: TeacherLevelCode[];
}

export class TeacherStandaloneLoginDto {
  @IsEmail({}, { message: 'Adresse email invalide' })
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class SetTeacherLevelsDto {
  /** Liste complète des niveaux activés (remplace l'état précédent). */
  @IsArray()
  @ArrayMaxSize(3)
  @IsIn(TEACHER_LEVEL_CODES, { each: true })
  levels!: TeacherLevelCode[];
}

export class InvitePromoterDto {
  @IsEmail({}, { message: 'Adresse email invalide' })
  @IsNotEmpty()
  promoterEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  schoolName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  message?: string;

  /** Ne pas stocker — usage analytique optionnel. */
  @IsOptional()
  @IsBoolean()
  acceptContact?: boolean;
}
