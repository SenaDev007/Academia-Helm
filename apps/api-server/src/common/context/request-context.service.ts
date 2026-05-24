/**
 * ============================================================================
 * REQUEST CONTEXT SERVICE - CONTEXTE UNIFIÉ TENANT + SCHOOL_LEVEL + MODULE
 * ============================================================================
 * 
 * Service centralisé pour gérer le contexte de requête :
 * - tenant_id : Identifiant du tenant (école)
 * - school_level_id : Identifiant du niveau scolaire (OBLIGATOIRE)
 * - module_type : Type de module métier (OBLIGATOIRE)
 * 
 * Ce service garantit que toutes les requêtes sont correctement scoped
 * et qu'aucune requête ambiguë n'est autorisée.
 * 
 * ============================================================================
 */

import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { ModulesService } from '../../modules/modules.service';
import { SchoolLevelsService } from '../../school-levels/school-levels.service';
import { TenantsService } from '../../tenants/tenants.service';
import { ModuleType } from '../../modules/entities/module.entity';

export interface RequestContext {
  tenantId: string;
  schoolLevelId: string;
  moduleType: ModuleType;
  userId?: string;
}

@Injectable()
export class RequestContextService {
  constructor(
    private readonly modulesService: ModulesService,
    private readonly schoolLevelsService: SchoolLevelsService,
    private readonly tenantsService: TenantsService,
  ) {}

  /**
   * Résout et valide le contexte complet depuis la requête
   */
  async resolveContext(request: Request): Promise<RequestContext> {
    // 1. Résoudre tenant_id
    const tenantId = this.resolveTenantId(request);
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }

    // 2. Valider que le tenant existe et est actif
    await this.validateTenant(tenantId);

    // 3. Résoudre school_level_id (OBLIGATOIRE)
    const schoolLevelId = this.resolveSchoolLevelId(request);
    if (!schoolLevelId) {
      throw new BadRequestException(
        'School Level ID is required. All operations must be scoped to a school level.'
      );
    }

    // 4. Valider que le niveau scolaire existe et appartient au tenant
    await this.validateSchoolLevel(tenantId, schoolLevelId);

    // 5. Résoudre module_type depuis la route ou le décorateur
    const moduleType = this.resolveModuleType(request);
    if (!moduleType) {
      throw new BadRequestException(
        'Module type is required. All operations must be scoped to a module.'
      );
    }

    // 6. Valider que le module est activé pour ce niveau
    await this.validateModule(tenantId, moduleType, schoolLevelId);

    // 7. Extraire user_id si disponible
    const user = request['user'] as any;
    const userId = user?.id;

    return {
      tenantId,
      schoolLevelId,
      moduleType,
      userId,
    };
  }

  /**
   * Résout tenant_id depuis plusieurs sources
   */
  private resolveTenantId(request: Request): string | undefined {
    // 1. Depuis le header X-Tenant-ID
    const tenantIdHeader = request.headers['x-tenant-id'];
    if (tenantIdHeader && typeof tenantIdHeader === 'string') {
      return tenantIdHeader;
    }

    // 2. Depuis le sous-domaine
    const host = request.headers.host;
    if (host && host.includes('.')) {
      const parts = host.split('.');
      if (parts.length > 2 && parts[0] !== 'www') {
        // TODO: Résoudre slug vers tenant_id via DB
        return parts[0];
      }
    }

    // 3. Depuis le JWT payload (après authentification)
    const user = request['user'] as any;
    if (user && user.tenantId) {
      return user.tenantId;
    }

    // 4. Depuis request.tenantId (déjà résolu par TenantGuard)
    if (request['tenantId']) {
      return request['tenantId'];
    }

    return undefined;
  }

  /**
   * Résout school_level_id depuis plusieurs sources
   */
  private resolveSchoolLevelId(request: Request): string | undefined {
    // 1. Depuis le header X-School-Level-ID
    const schoolLevelHeader = request.headers['x-school-level-id'];
    if (schoolLevelHeader && typeof schoolLevelHeader === 'string') {
      return schoolLevelHeader;
    }

    // 2. Depuis les query params
    if (request.query && request.query.schoolLevelId) {
      return request.query.schoolLevelId as string;
    }

    // 3. Depuis le body
    if (request.body && request.body.schoolLevelId) {
      return request.body.schoolLevelId;
    }

    // 4. Depuis request.schoolLevelId (déjà résolu)
    if (request['schoolLevelId']) {
      return request['schoolLevelId'];
    }

    return undefined;
  }

  /**
   * Résout module_type depuis plusieurs sources
   */
  private resolveModuleType(request: Request): ModuleType | undefined {
    // 1. Depuis le décorateur @ModuleTypeRequired (via metadata)
    if (request['moduleType']) {
      return request['moduleType'];
    }

    // 2. Depuis le header X-Module-Type
    const moduleTypeHeader = request.headers['x-module-type'];
    if (moduleTypeHeader && typeof moduleTypeHeader === 'string') {
      return moduleTypeHeader as ModuleType;
    }

    // 3. Depuis la route (déduction automatique)
    const route = request.path;
    const routeToModule: Record<string, ModuleType> = {
      '/students': ModuleType.SCOLARITE,
      '/scolarite': ModuleType.SCOLARITE,
      '/finance': ModuleType.FINANCES,
      '/finances': ModuleType.FINANCES,
      '/payments': ModuleType.FINANCES,
      '/expenses': ModuleType.FINANCES,
      '/hr': ModuleType.RH,
      '/rh': ModuleType.RH,
      '/teachers': ModuleType.RH,
      '/planning': ModuleType.PEDAGOGIE,
      '/pedagogie': ModuleType.PEDAGOGIE,
      '/classes': ModuleType.PEDAGOGIE,
      '/subjects': ModuleType.PEDAGOGIE,
      '/examinations': ModuleType.EXAMENS,
      '/examens': ModuleType.EXAMENS,
      '/exams': ModuleType.EXAMENS,
      '/grades': ModuleType.EXAMENS,
      '/communication': ModuleType.COMMUNICATION,
      '/library': ModuleType.BIBLIOTHEQUE,
      '/bibliotheque': ModuleType.BIBLIOTHEQUE,
      '/laboratory': ModuleType.LABORATOIRE,
      '/laboratoire': ModuleType.LABORATOIRE,
      '/transport': ModuleType.TRANSPORT,
      '/cafeteria': ModuleType.CANTINE,
      '/cantine': ModuleType.CANTINE,
      '/health': ModuleType.INFIRMERIE,
      '/infirmerie': ModuleType.INFIRMERIE,
      '/qhse': ModuleType.QHSE,
      '/educast': ModuleType.EDUCAST,
      '/boutique': ModuleType.BOUTIQUE,
    };

    for (const [path, module] of Object.entries(routeToModule)) {
      if (route.includes(path)) {
        return module;
      }
    }

    return undefined;
  }

  /**
   * Valide que le tenant existe et est actif
   */
  private async validateTenant(tenantId: string): Promise<void> {
    try {
      const tenant = await this.tenantsService.findOne(tenantId);
      if (!tenant) {
        throw new ForbiddenException(`Tenant ${tenantId} not found`);
      }
      if (tenant.status !== 'active') {
        throw new ForbiddenException(`Tenant ${tenantId} is not active`);
      }
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException(`Invalid tenant: ${tenantId}`);
    }
  }

  /**
   * Valide que le niveau scolaire existe et appartient au tenant
   */
  private async validateSchoolLevel(tenantId: string, schoolLevelId: string): Promise<void> {
    if (schoolLevelId === 'ALL') {
      return;
    }
    try {
      const schoolLevel = await this.schoolLevelsService.findOne(schoolLevelId, tenantId);
      if (!schoolLevel) {
        throw new BadRequestException(
          `School Level ${schoolLevelId} not found or does not belong to tenant ${tenantId}`
        );
      }
      if (!schoolLevel.isActive) {
        throw new BadRequestException(
          `School Level ${schoolLevelId} is not active`
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Invalid school level: ${schoolLevelId}`);
    }
  }

  /**
   * Valide que le module est activé pour ce niveau
   */
  private async validateModule(
    tenantId: string,
    moduleType: ModuleType,
    schoolLevelId: string,
  ): Promise<void> {
    const isEnabled = await this.modulesService.isModuleEnabled(
      tenantId,
      moduleType,
      schoolLevelId,
    );

    if (!isEnabled) {
      throw new ForbiddenException(
        `Module ${moduleType} is not enabled for school level ${schoolLevelId}`
      );
    }

    if (schoolLevelId === 'ALL') {
      return;
    }

    // Vérifier les dépendances
    const dependencies = await this.modulesService.checkDependencies(
      tenantId,
      moduleType,
      schoolLevelId,
    );

    if (!dependencies.satisfied) {
      throw new ForbiddenException(
        `Module ${moduleType} requires the following modules to be enabled: ${dependencies.missing.join(', ')}`
      );
    }
  }

  /**
   * Attache le contexte résolu à la requête
   */
  attachContextToRequest(request: Request, context: RequestContext): void {
    request['context'] = context;
    request['tenantId'] = context.tenantId;
    request['schoolLevelId'] = context.schoolLevelId;
    request['moduleType'] = context.moduleType;
    if (context.userId) {
      request['userId'] = context.userId;
    }
  }
}

