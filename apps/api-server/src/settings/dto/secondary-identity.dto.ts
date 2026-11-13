import { IsString, IsOptional, IsNotEmpty, IsEmail, MaxLength } from 'class-validator';

/**
 * ⭐ 2026-11-13 — Identité du niveau SECONDAIRE (écoles combinées).
 * Champs vides/non fournis ⇒ retombent sur le profil global
 * (tenant_identity_profiles) pour ce champ : override partiel autorisé
 * (ex. nom + logo différents, mêmes contacts).
 * Le ValidationPipe global est strict (whitelist + forbidNonWhitelisted) :
 * n'envoyer QUE ces clés depuis le front.
 */
export class UpdateSecondaryIdentityDto {
  /** Nom de l'établissement du secondaire (ex. « Collège Saint-Joseph ») */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  schoolName: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  schoolAcronym?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  slogan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phonePrimary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phoneSecondary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  whatsapp?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  /** Logo du secondaire — data-URL base64 (pas de limite : pattern identité) */
  @IsOptional()
  @IsString()
  logoUrl?: string;

  /** Raison de la modification (audit) */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeReason?: string;
}
