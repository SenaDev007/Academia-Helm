/**
 * ============================================================================
 * MODULE TYPE DECORATOR
 * ============================================================================
 * 
 * Decorator pour :
 * 1. Définir le module requis pour une route (méta-donnée)
 * 2. Extraire le module_type depuis le contexte de requête
 * 
 * Usage:
 * @ModuleTypeRequired(ModuleType.SCOLARITE) // Définit le module requis
 * @Get()
 * async findAll(@ModuleTypeParam() moduleType: ModuleType) {
 *   return this.service.findAll(moduleType);
 * }
 * 
 * ============================================================================
 */

import { createParamDecorator, ExecutionContext, SetMetadata, BadRequestException } from '@nestjs/common';
import { ModuleType } from '../../modules/entities/module.entity';

/**
 * Clé pour les métadonnées du module requis
 */
export const MODULE_TYPE_KEY = 'moduleType';

/**
 * Decorator pour définir le module requis pour une route
 */
export const ModuleTypeRequired = (moduleType: ModuleType) => SetMetadata(MODULE_TYPE_KEY, moduleType);

/**
 * Decorator pour extraire le module_type depuis le contexte (pour usage dans les paramètres)
 */
export const ModuleTypeParam = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): ModuleType => {
    const request = ctx.switchToHttp().getRequest();
    
    // Priorité 1 : Depuis le contexte résolu
    if (request['context']?.moduleType) {
      return request['context'].moduleType;
    }

    // Priorité 2 : Depuis request.moduleType
    if (request['moduleType']) {
      return request['moduleType'];
    }

    // Priorité 3 : Depuis les métadonnées de la route
    const handler = ctx.getHandler();
    const classRef = ctx.getClass();
    const moduleTypeFromMetadata = Reflect.getMetadata(MODULE_TYPE_KEY, handler) ||
                                   Reflect.getMetadata(MODULE_TYPE_KEY, classRef);
    
    if (moduleTypeFromMetadata) {
      return moduleTypeFromMetadata;
    }

    throw new BadRequestException(
      'Module type is required. All operations must be scoped to a module.'
    );
  },
);
