/**
 * ============================================================================
 * ACADEMIC YEAR ID DECORATOR
 * ============================================================================
 * 
 * Décorateur pour extraire academic_year_id depuis la requête.
 * 
 * Priorité d'extraction :
 * 1. Contexte résolu (request.context.academicYearId)
 * 2. Request property (request.academicYearId)
 * 3. Header (X-Academic-Year-ID)
 * 4. Query param (academicYearId)
 * 5. Body (academicYearId)
 * 
 * ============================================================================
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const AcademicYearId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();

    // Priorité 1 : Depuis le contexte résolu
    if (request['context']?.academicYearId) {
      return request['context'].academicYearId;
    }

    // Priorité 2 : Depuis request.academicYearId
    if (request['academicYearId']) {
      return request['academicYearId'];
    }

    // Priorité 3 : Depuis les headers
    if (request.headers['x-academic-year-id']) {
      return request.headers['x-academic-year-id'] as string;
    }

    // Priorité 4 : Depuis query params
    if (request.query?.academicYearId) {
      return request.query.academicYearId as string;
    }

    // Priorité 5 : Depuis body
    if (request.body?.academicYearId) {
      return request.body.academicYearId as string;
    }

    throw new Error('Academic Year ID not found in request context');
  },
);

