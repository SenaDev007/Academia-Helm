import { PaginatedResponse, PaginationDto } from '../dto/pagination.dto';

/**
 * Helper pour créer une réponse paginée
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  pagination: PaginationDto,
): PaginatedResponse<T> {
  const page = pagination.page || 1;
  const limit = pagination.limit || 20;
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
