/**
 * ============================================================================
 * CONTEXT MODULE - MODULE DE CONTEXTE UNIFIÉ
 * ============================================================================
 * 
 * Module qui fournit les services de contexte pour :
 * - Résolution du tenant
 * - Résolution du niveau scolaire
 * - Résolution du module
 * 
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { RequestContextService } from './request-context.service';
import { ModulesModule } from '../../modules/modules.module';
import { SchoolLevelsModule } from '../../school-levels/school-levels.module';
import { TenantsModule } from '../../tenants/tenants.module';

@Module({
  imports: [
    ModulesModule,
    SchoolLevelsModule,
    TenantsModule,
  ],
  providers: [RequestContextService],
  exports: [RequestContextService],
})
export class ContextModule {}

