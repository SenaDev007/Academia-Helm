import { IsNotEmpty, MinLength, IsString, IsEmail, Matches } from 'class-validator';

export class ResetPasswordDto {
  // ── Ancien format (rétro-compatibilité avec liens email JWT) ──
  @IsString()
  token?: string;

  // ── Nouveau format OTP ──
  @IsEmail({}, { message: 'Veuillez fournir une adresse email valide' })
  email?: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'Le code doit être composé de 6 chiffres' })
  code?: string;

  @IsNotEmpty({ message: 'Le nouveau mot de passe est requis' })
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @IsString()
  newPassword: string;
}
