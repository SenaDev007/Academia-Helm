/**
 * ============================================================================
 * SCHOOL LEVEL ID DECORATOR
 * ============================================================================
 * 
 * Decorator pour extraire school_level_id depuis le contexte de requête.
 * 
 * Usage:
 * @Get()
 * async findAll(@SchoolLevelId() schoolLevelId: string) {
 *   return this.service.findAll(tenantId, schoolLevelId);
 * }
 * 
 * ============================================================================
 */

import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';

export const SchoolLevelId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    
    // Priorité 1 : Depuis le contexte résolu
    if (request['context']?.schoolLevelId) {
      return request['context'].schoolLevelId;
    }

    // Priorité 2 : Depuis request.schoolLevelId
    if (request['schoolLevelId']) {
      return request['schoolLevelId'];
    }

    // Priorité 3 : Depuis les headers HTTP
    const headerSchoolLevelId = request.headers['x-school-level-id'] || request.headers['X-School-Level-ID'];
    if (headerSchoolLevelId) {
      return headerSchoolLevelId as string;
    }

    // Priorité 4 : Depuis les query params
    if (request.query?.schoolLevelId) {
      return request.query.schoolLevelId as string;
    }

    // Priorité 4 : Depuis le body
    if (request.body?.schoolLevelId) {
      return request.body.schoolLevelId;
    }

    throw new BadRequestException(
      'School Level ID is required. All operations must be scoped to a school level.'
    );
  },
);

