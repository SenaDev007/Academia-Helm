/**
 * ============================================================================
 * CALCULATION SERVICE - SERVICES DE CALCUL PAR MODULE ET PAR NIVEAU
 * ============================================================================
 * 
 * Service de base pour les calculs métier par module et par niveau.
 * Garantit que tous les calculs sont :
 * - Scoped à un tenant
 * - Scoped à un niveau scolaire
 * - Scoped à un module
 * - Traçables (logs d'audit)
 * 
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ModuleType } from '../../modules/entities/module.entity';

export interface CalculationContext {
  tenantId: string;
  schoolLevelId: string;
  moduleType: ModuleType;
  userId?: string;
}

export interface CalculationResult<T = any> {
  data: T;
  context: CalculationContext;
  calculatedAt: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class CalculationService {
  private readonly logger = new Logger(CalculationService.name);

  /**
   * Valide le contexte de calcul
   */
  validateCalculationContext(context: CalculationContext): void {
    if (!context.tenantId) {
      throw new Error('Tenant ID is required for calculations');
    }
    if (!context.schoolLevelId) {
      throw new Error('School Level ID is required for calculations');
    }
    if (!context.moduleType) {
      throw new Error('Module Type is required for calculations');
    }
  }

  /**
   * Log un calcul pour traçabilité
   */
  logCalculation(
    context: CalculationContext,
    calculationType: string,
    result: any,
    metadata?: Record<string, any>,
  ): void {
    this.logger.log({
      message: `Calculation performed: ${calculationType}`,
      context: {
        tenantId: context.tenantId,
        schoolLevelId: context.schoolLevelId,
        moduleType: context.moduleType,
        userId: context.userId,
      },
      calculationType,
      result: typeof result === 'number' ? result : 'complex',
      metadata,
    });
  }

  /**
   * Crée un résultat de calcul standardisé
   */
  createCalculationResult<T>(
    data: T,
    context: CalculationContext,
    metadata?: Record<string, any>,
  ): CalculationResult<T> {
    this.validateCalculationContext(context);

    return {
      data,
      context,
      calculatedAt: new Date(),
      metadata,
    };
  }
}

