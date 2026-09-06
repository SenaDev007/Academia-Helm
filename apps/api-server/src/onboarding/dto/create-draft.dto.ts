import { IsString, IsEmail, IsBoolean, IsInt, IsOptional, MinLength, IsArray, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

/** École annexe déclarée dès l'onboarding (multi-écoles). */
export class AnnexSchoolDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  /** Ville/quartier de l'annexe (peut différer de l'école principale). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;
}

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

  /** ⭐ Effectif estimé (élèves) — fiche de souscription (Article 1 du contrat). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  estimatedStudentCount?: number;

  @IsOptional()
  @IsInt()
  schoolsCount?: number;

  /** ⭐ Écoles annexes (multi-écoles dès le signup) — 1 entrée par école
   *  supplémentaire. Le nombre d'annexes + 1 doit correspondre à schoolsCount
   *  (cohérence vérifiée côté service). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnnexSchoolDto)
  @MaxLength(9, { message: 'Au maximum 9 écoles annexes par onboarding' })
  annexes?: AnnexSchoolDto[];

  /** Sous-domaine personnalisé (optionnel). Vérifié en format et unicité si fourni. */
  @IsOptional()
  @IsString()
  preferredSubdomain?: string;

  /** URL publique du logo uploadé (ex: /uploads/logos/logo-xxx.jpg). Optionnel. */
  @IsOptional()
  @IsString()
  logoUrl?: string;
}
