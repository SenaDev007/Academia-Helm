import { IsString, IsOptional, IsInt, Min, IsUUID } from 'class-validator';

export class CreateClassDto {
  @IsString()
  name: string;

  @IsString()
  level: string;

  /** Niveau scolaire — obligatoire pour encapsuler les données par niveau */
  @IsString()
  schoolLevelId: string;

  /**
   * Année scolaire — obligatoire pour le mode "année stricte".
   * Injecté automatiquement par l'AcademicYearEnforcementInterceptor
   * depuis le header X-Academic-Year-ID.
   */
  @IsUUID()
  academicYearId: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsString()
  @IsOptional()
  mainTeacherId?: string;

  @IsString()
  @IsOptional()
  roomId?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

