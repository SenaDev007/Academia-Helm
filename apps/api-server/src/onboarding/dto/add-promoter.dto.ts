import { IsString, IsEmail, IsOptional, MinLength, Matches, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface, Validate } from 'class-validator';

/**
 * Validateur personnalisé pour les règles de mot de passe
 * - Au moins 8 caractères
 * - Au moins 3 des 4 types suivants : minuscules, majuscules, chiffres, caractères spéciaux
 * - Pas plus de 2 caractères identiques consécutifs
 */
@ValidatorConstraint({ name: 'passwordRules', async: false })
export class PasswordRulesConstraint implements ValidatorConstraintInterface {
  validate(password: string, args: ValidationArguments) {
    if (!password || password.length < 8) {
      return false;
    }

    // Vérifier les types de caractères
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    // Vérifier qu'au moins 3 des 4 types sont présents
    const typeCount = [hasLowercase, hasUppercase, hasNumbers, hasSpecialChars].filter(Boolean).length;
    if (typeCount < 3) {
      return false;
    }
    
    // Vérifier qu'il n'y a pas plus de 2 caractères identiques consécutifs
    if (/(.)\1{2,}/.test(password)) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Le mot de passe doit contenir au moins 8 caractères, au moins 3 des 4 types suivants (minuscules, majuscules, chiffres, caractères spéciaux), et pas plus de 2 caractères identiques consécutifs';
  }
}

export class AddPromoterDto {
  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  phone: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @Validate(PasswordRulesConstraint)
  password: string;

  @IsOptional()
  @IsString()
  otpCode?: string;
}
