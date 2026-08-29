import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';

export enum PortalType {
  PLATFORM = 'PLATFORM',
  SCHOOL = 'SCHOOL',
  TEACHER = 'TEACHER',
  PARENT = 'PARENT',
  PATRONAT = 'PATRONAT',
}

export class LoginDto {
  /**
   * Identifiant de connexion — accepte EMAIL ou MATRICULE.
   *
   * ⭐ Multi-portail unifié : un personnel ayant à la fois un poste enseignant
   *    et un poste administratif peut se connecter au portail ÉCOLE avec son
   *    email (ex: aurore@ecole.com) OU avec son matricule (ex: CSPEBE-P-26-00005).
   *    Au portail ENSEIGNANT, il se connecte avec son matricule.
   *
   *    Le système détecte automatiquement :
   *      - Si l'identifiant contient '@' → recherche par email dans User
   *      - Sinon → recherche par matricule dans Staff, puis email dans User
   */
  @IsString()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  tenant_id?: string;

  @IsOptional()
  @IsEnum(PortalType)
  portal_type?: PortalType;
}

