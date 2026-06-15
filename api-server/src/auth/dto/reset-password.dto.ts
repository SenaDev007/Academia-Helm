import { IsNotEmpty, MinLength, IsString } from 'class-validator';

export class ResetPasswordDto {
  @IsNotEmpty({ message: 'Le jeton de réinitialisation est requis' })
  @IsString()
  token: string;

  @IsNotEmpty({ message: 'Le nouveau mot de passe est requis' })
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @IsString()
  newPassword: string;
}
