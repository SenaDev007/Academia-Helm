import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO de pagination standard pour toutes les routes list
 *
 * Usage:
 * @Query() pagination: PaginationDto
 *
 * Exemple: ?page=1&limit=20
 *
 * ⭐ Champs optionnels ajoutés pour permettre aux routes qui utilisent
 *    @Query() pagination: PaginationDto de recevoir aussi des filtres
 *    communs (academicYearId, search, etc.) SANS que forbidNonWhitelisted
 *    ne les rejette avec 400 "property X should not exist".
 *    Ces champs sont neutres (non utilisés par la pagination elle-même) —
 *    les controllers peuvent les récupérer séparément via @Query('academicYearId')
 *    ou les lire depuis pagination.academicYearId.
 */
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100) // Limite max pour éviter surcharge
  limit?: number = 20;

  // ⭐ Filtres communs acceptés (pass-through, non utilisés pour la pagination)
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  schoolLevelId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  /**
   * Calcule le skip pour Prisma/TypeORM
   */
  get skip(): number {
    return ((this.page || 1) - 1) * (this.limit || 20);
  }

  /**
   * Calcule le take pour Prisma/TypeORM
   */
  get take(): number {
    return this.limit || 20;
  }
}

/**
 * Réponse paginée standard
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
