/**
 * ============================================================================
 * REQUIRED MODULE DECORATOR
 * ============================================================================
 */

import { SetMetadata } from '@nestjs/common';
import { Module } from '../enums/module.enum';

export const REQUIRED_MODULE_KEY = 'requiredModule';

/**
 * Décorateur pour spécifier le module requis pour accéder à une route
 */
export const RequiredModule = (module: Module) => SetMetadata(REQUIRED_MODULE_KEY, module);
