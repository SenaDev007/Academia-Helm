/**
 * ============================================================================
 * ALLOW CROSS LEVEL DECORATOR
 * ============================================================================
 * 
 * Décorateur pour autoriser explicitement les opérations cross-level
 * UNIQUEMENT pour le Module Général (agrégations contrôlées).
 * 
 * UTILISATION STRICTE :
 * - Uniquement sur les endpoints du Module Général
 * - Uniquement pour des opérations de lecture (agrégation)
 * - JAMAIS pour des opérations d'écriture
 * 
 * ============================================================================
 */

import { SetMetadata } from '@nestjs/common';

export const ALLOW_CROSS_LEVEL_KEY = 'allowCrossLevel';

/**
 * Autorise explicitement les opérations cross-level
 * UNIQUEMENT pour le Module Général
 */
export const AllowCrossLevel = () => SetMetadata(ALLOW_CROSS_LEVEL_KEY, true);

