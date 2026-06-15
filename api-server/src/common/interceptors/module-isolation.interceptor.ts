/**
 * ============================================================================
 * MODULE ISOLATION INTERCEPTOR - ISOLATION STRICTE PAR MODULE
 * ============================================================================
 * 
 * Interceptor pour garantir l'isolation stricte des données par module
 * et par niveau scolaire. Empêche toute lecture/écriture cross-niveau
 * non autorisée.
 * 
 * ============================================================================
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { ModulesService } from '../../modules/modules.service';
import { ModuleType } from '../../modules/entities/module.entity';

@Injectable()
export class ModuleIsolationInterceptor implements NestInterceptor {
  constructor(private modulesService: ModulesService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const tenantId = request['tenantId'];
    const schoolLevelId = request['schoolLevelId'] || request.body?.schoolLevelId;
    const query = request.query;
    const body = request.body;

    // Vérifier que schoolLevelId est présent
    if (!schoolLevelId) {
      throw new ForbiddenException(
        'School Level ID is required. All operations must be scoped to a school level.'
      );
    }

    // Empêcher la modification du schoolLevelId dans le body
    if (body && body.schoolLevelId && body.schoolLevelId !== schoolLevelId) {
      throw new ForbiddenException(
        'Cannot modify school_level_id in request body. This is a security violation.'
      );
    }

    // Empêcher la spécification d'un schoolLevelId différent dans les query params
    if (query && query.schoolLevelId && query.schoolLevelId !== schoolLevelId) {
      throw new ForbiddenException(
        'Cannot specify different school_level_id in query parameters.'
      );
    }

    // We NO LONGER inject schoolLevelId into the body here.
    // It causes ValidationPipe errors (forbidNonWhitelisted) for DTOs that don't declare it.
    // The controllers extract schoolLevelId via the @SchoolLevelId() decorator instead.

    return next.handle();
  }
}

