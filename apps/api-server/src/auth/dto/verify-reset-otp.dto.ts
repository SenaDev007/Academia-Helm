import { IsEmail, IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class VerifyResetOtpDto {
  @IsEmail({}, { message: 'Veuillez fournir une adresse email valide' })
  @IsNotEmpty({ message: "L'adresse email est requise" })
  email: string;

  @IsNotEmpty({ message: 'Le code de vérification est requis' })
  @IsString()
  @MinLength(6, { message: 'Le code doit contenir 6 chiffres' })
  @Matches(/^\d{6}$/, { message: 'Le code doit être composé de 6 chiffres' })
  code: string;
}
