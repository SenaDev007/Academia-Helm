/**
 * ============================================================================
 * MODULE ACCESS GUARD - PROTECTION ACCÈS PAR MODULE
 * ============================================================================
 * 
 * Guard pour vérifier que l'utilisateur a accès au module demandé
 * et que le module est activé pour le niveau scolaire concerné.
 * 
 * ============================================================================
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ModulesService } from '../../modules/modules.service';
import { ModuleType } from '../../modules/entities/module.entity';
import { MODULE_TYPE_KEY } from '../decorators/module-type.decorator';

@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private modulesService: ModulesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<ModuleType>(
      MODULE_TYPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredModule) {
      // Aucun module requis, autoriser l'accès
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    
    const tenantId = request['tenantId'] || 
                     request.headers['x-tenant-id'] ||
                     (request['user'] as any)?.tenantId ||
                     request.query?.tenantId ||
                     request.body?.tenantId;
                     
    const schoolLevelId = request['schoolLevelId'] ||
                          request.headers['x-school-level-id'] ||
                          request.query?.schoolLevelId ||
                          request.body?.schoolLevelId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant ID not found');
    }

    if (!schoolLevelId) {
      throw new ForbiddenException('School Level ID is required for module access');
    }

    // Populate request object for other guards/interceptors
    if (tenantId && !request['tenantId']) {
      request['tenantId'] = tenantId;
    }
    if (schoolLevelId && !request['schoolLevelId']) {
      request['schoolLevelId'] = schoolLevelId;
    }

    // Vérifier que le module est activé pour ce niveau
    const isEnabled = await this.modulesService.isModuleEnabled(
      tenantId,
      requiredModule,
      schoolLevelId,
    );

    if (!isEnabled) {
      throw new ForbiddenException(
        `Module ${requiredModule} is not enabled for this school level`
      );
    }

    // Vérifier les dépendances (optionnel, peut être désactivé si trop strict)
    try {
      const dependencies = await this.modulesService.checkDependencies(
        tenantId,
        requiredModule,
        schoolLevelId,
      );

      if (!dependencies.satisfied) {
        throw new ForbiddenException(
          `Module ${requiredModule} requires the following modules to be enabled: ${dependencies.missing.join(', ')}`
        );
      }
    } catch (error) {
      // Si le module n'existe pas encore, on peut continuer (initialisation)
      if (error instanceof NotFoundException) {
        // Module pas encore initialisé, on autorise
        return true;
      }
      throw error;
    }

    return true;
  }
}

