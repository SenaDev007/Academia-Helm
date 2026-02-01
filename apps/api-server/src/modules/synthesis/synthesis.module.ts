/**
 * ============================================================================
 * SYNTHESIS MODULE - MODULE GÉNÉRAL DE SYNTHÈSE
 * ============================================================================
 * 
 * Module en lecture seule qui fournit une vue globale sans jamais
 * modifier les données brutes. Toutes les agrégations sont explicites
 * et traçables.
 * 
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SynthesisController } from './synthesis.controller';
import { SynthesisService } from './synthesis.service';
import { SchoolLevelsModule } from '../../school-levels/school-levels.module';
import { TenantsModule } from '../../tenants/tenants.module';
import { UsersModule } from '../../users/users.module'; // ✅ Import pour PermissionsGuard
import { AuditLogsModule } from '../../audit-logs/audit-logs.module'; // ✅ Import pour AuditLogInterceptor

@Module({
  imports: [
    TypeOrmModule.forFeature([]), // Pas d'entités, seulement des vues
    SchoolLevelsModule,
    TenantsModule,
    UsersModule, // ✅ Import pour que PermissionsGuard puisse résoudre UserRepository
    AuditLogsModule, // ✅ Import pour que AuditLogInterceptor puisse résoudre AuditLogRepository
  ],
  controllers: [SynthesisController],
  providers: [SynthesisService],
  exports: [SynthesisService],
})
export class SynthesisModule {}

