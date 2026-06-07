import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO de pagination standard pour toutes les routes list
 * 
 * Usage:
 * @Query() pagination: PaginationDto
 * 
 * Exemple: ?page=1&limit=20
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
