import { IsNotEmpty, MinLength, IsString, IsEmail, Matches, IsOptional } from 'class-validator';

export class ResetPasswordDto {
  // ── Ancien format (rétro-compatibilité avec liens email JWT) ──
  // ⭐ FIX 2026-09-18 (« token must be a string ») : les champs ALTERNATIFS du
  //    DTO doivent être @IsOptional() — sans ça, class-validator rejette les
  //    payloads qui ne les contiennent PAS (le flux OTP envoie { email, code,
  //    newPassword } sans token → « token must be a string » ; le flux JWT
  //    envoie { token, newPassword } sans email/code → erreurs email/code).
  //    L'alternative (email+code) OU (token) est arbitrée dans auth.service.
  @IsOptional()
  @IsString()
  token?: string;

  // ── Nouveau format OTP ──
  @IsOptional()
  @IsEmail({}, { message: 'Veuillez fournir une adresse email valide' })
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Le code doit être composé de 6 chiffres' })
  code?: string;

  @IsNotEmpty({ message: 'Le nouveau mot de passe est requis' })
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @IsString()
  newPassword: string;
}
