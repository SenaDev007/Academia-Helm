/**
 * ============================================================================
 * INTER-MODULE ACCESS GUARD - RÈGLES D'ACCÈS INTER-MODULES
 * ============================================================================
 * 
 * Guard pour vérifier les règles d'accès entre modules selon la matrice
 * d'accès définie dans ARCHITECTURE-MODULES.md
 * 
 * Matrice d'accès :
 * - ✅ RW : Lecture et Écriture
 * - ✅ R : Lecture seule
 * - ❌ : Pas d'accès
 * 
 * ============================================================================
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { ModuleType } from '../../modules/entities/module.entity';

/**
 * Matrice d'accès inter-modules
 * [sourceModule][targetModule] = 'RW' | 'R' | null
 */
const MODULE_ACCESS_MATRIX: Record<ModuleType, Partial<Record<ModuleType, 'RW' | 'R'>>> = {
  // SCOLARITE
  [ModuleType.SCOLARITE]: {
    [ModuleType.SCOLARITE]: 'RW',
    [ModuleType.COMMUNICATION]: 'R',
    [ModuleType.BIBLIOTHEQUE]: 'R',
    [ModuleType.TRANSPORT]: 'R',
    [ModuleType.CANTINE]: 'R',
    [ModuleType.INFIRMERIE]: 'R',
  },
  // FINANCES
  [ModuleType.FINANCES]: {
    [ModuleType.FINANCES]: 'RW',
    [ModuleType.SCOLARITE]: 'R',
    [ModuleType.COMMUNICATION]: 'R',
    [ModuleType.CANTINE]: 'R',
    [ModuleType.BOUTIQUE]: 'R',
  },
  // RH
  [ModuleType.RH]: {
    [ModuleType.RH]: 'RW',
    [ModuleType.FINANCES]: 'R', // Pour la paie
    [ModuleType.COMMUNICATION]: 'R',
  },
  // PEDAGOGIE
  [ModuleType.PEDAGOGIE]: {
    [ModuleType.PEDAGOGIE]: 'RW',
    [ModuleType.SCOLARITE]: 'R',
    [ModuleType.RH]: 'R',
    [ModuleType.COMMUNICATION]: 'R',
    [ModuleType.LABORATOIRE]: 'R',
    [ModuleType.EDUCAST]: 'R',
  },
  // EXAMENS
  [ModuleType.EXAMENS]: {
    [ModuleType.EXAMENS]: 'RW',
    [ModuleType.SCOLARITE]: 'R',
    [ModuleType.PEDAGOGIE]: 'R',
    [ModuleType.RH]: 'R',
    [ModuleType.COMMUNICATION]: 'R',
  },
  // COMMUNICATION
  [ModuleType.COMMUNICATION]: {
    [ModuleType.COMMUNICATION]: 'RW',
    [ModuleType.SCOLARITE]: 'R',
    [ModuleType.FINANCES]: 'R',
    [ModuleType.RH]: 'R',
    [ModuleType.PEDAGOGIE]: 'R',
    [ModuleType.EXAMENS]: 'R',
    [ModuleType.BIBLIOTHEQUE]: 'R',
    [ModuleType.LABORATOIRE]: 'R',
    [ModuleType.TRANSPORT]: 'R',
    [ModuleType.CANTINE]: 'R',
    [ModuleType.INFIRMERIE]: 'R',
    [ModuleType.QHSE]: 'R',
    [ModuleType.EDUCAST]: 'R',
    [ModuleType.BOUTIQUE]: 'R',
  },
  // BIBLIOTHEQUE
  [ModuleType.BIBLIOTHEQUE]: {
    [ModuleType.BIBLIOTHEQUE]: 'RW',
    [ModuleType.SCOLARITE]: 'R',
    [ModuleType.COMMUNICATION]: 'R',
  },
  // LABORATOIRE
  [ModuleType.LABORATOIRE]: {
    [ModuleType.LABORATOIRE]: 'RW',
    [ModuleType.PEDAGOGIE]: 'R',
    [ModuleType.COMMUNICATION]: 'R',
  },
  // TRANSPORT
  [ModuleType.TRANSPORT]: {
    [ModuleType.TRANSPORT]: 'RW',
    [ModuleType.SCOLARITE]: 'R',
    [ModuleType.COMMUNICATION]: 'R',
  },
  // CANTINE
  [ModuleType.CANTINE]: {
    [ModuleType.CANTINE]: 'RW',
    [ModuleType.SCOLARITE]: 'R',
    [ModuleType.FINANCES]: 'R',
    [ModuleType.COMMUNICATION]: 'R',
  },
  // INFIRMERIE
  [ModuleType.INFIRMERIE]: {
    [ModuleType.INFIRMERIE]: 'RW',
    [ModuleType.SCOLARITE]: 'R',
    [ModuleType.COMMUNICATION]: 'R',
  },
  // QHSE
  [ModuleType.QHSE]: {
    [ModuleType.QHSE]: 'RW',
    [ModuleType.COMMUNICATION]: 'R',
  },
  // EDUCAST
  [ModuleType.EDUCAST]: {
    [ModuleType.EDUCAST]: 'RW',
    [ModuleType.PEDAGOGIE]: 'R',
    [ModuleType.COMMUNICATION]: 'R',
  },
  // BOUTIQUE
  [ModuleType.BOUTIQUE]: {
    [ModuleType.BOUTIQUE]: 'RW',
    [ModuleType.SCOLARITE]: 'R',
    [ModuleType.FINANCES]: 'R',
    [ModuleType.COMMUNICATION]: 'R',
  },
};

@Injectable()
export class InterModuleAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const sourceModule = request['moduleType'] as ModuleType | undefined;
    const targetModule = this.getTargetModuleFromRoute(request);

    // Si aucun module source ou cible, autoriser (route publique ou non modulaire)
    if (!sourceModule || !targetModule) {
      return true;
    }

    // Vérifier l'accès dans la matrice
    const access = MODULE_ACCESS_MATRIX[sourceModule]?.[targetModule];

    if (!access) {
      throw new ForbiddenException(
        `Module ${sourceModule} cannot access ${targetModule}. Access denied.`
      );
    }

    // Vérifier si l'opération est en écriture (POST, PUT, PATCH, DELETE)
    const method = request.method;
    const isWriteOperation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    // Si opération en écriture, vérifier que l'accès est 'RW'
    if (isWriteOperation && access !== 'RW') {
      throw new ForbiddenException(
        `Module ${sourceModule} has read-only access to ${targetModule}. Write operations are not allowed.`
      );
    }

    return true;
  }

  /**
   * Détermine le module cible depuis la route
   */
  private getTargetModuleFromRoute(request: Request): ModuleType | undefined {
    const path = request.path;

    // Mapping des routes vers les modules
    const routeToModule: Record<string, ModuleType> = {
      '/scolarite': ModuleType.SCOLARITE,
      '/students': ModuleType.SCOLARITE,
      '/finances': ModuleType.FINANCES,
      '/finance': ModuleType.FINANCES,
      '/payments': ModuleType.FINANCES,
      '/expenses': ModuleType.FINANCES,
      '/rh': ModuleType.RH,
      '/hr': ModuleType.RH,
      '/teachers': ModuleType.RH,
      '/pedagogie': ModuleType.PEDAGOGIE,
      '/planning': ModuleType.PEDAGOGIE,
      '/classes': ModuleType.PEDAGOGIE,
      '/subjects': ModuleType.PEDAGOGIE,
      '/examens': ModuleType.EXAMENS,
      '/examinations': ModuleType.EXAMENS,
      '/exams': ModuleType.EXAMENS,
      '/grades': ModuleType.EXAMENS,
      '/communication': ModuleType.COMMUNICATION,
      '/messages': ModuleType.COMMUNICATION,
      '/bibliotheque': ModuleType.BIBLIOTHEQUE,
      '/library': ModuleType.BIBLIOTHEQUE,
      '/laboratoire': ModuleType.LABORATOIRE,
      '/laboratory': ModuleType.LABORATOIRE,
      '/transport': ModuleType.TRANSPORT,
      '/cantine': ModuleType.CANTINE,
      '/cafeteria': ModuleType.CANTINE,
      '/infirmerie': ModuleType.INFIRMERIE,
      '/health': ModuleType.INFIRMERIE,
      '/qhse': ModuleType.QHSE,
      '/educast': ModuleType.EDUCAST,
      '/boutique': ModuleType.BOUTIQUE,
    };

    // Chercher le module correspondant à la route
    for (const [route, module] of Object.entries(routeToModule)) {
      if (path.includes(route)) {
        return module;
      }
    }

    return undefined;
  }
}

