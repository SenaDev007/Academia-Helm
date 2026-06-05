/**
 * ============================================================================
 * COMPLIANCE MODULE - CONFORMITÉ DONNÉES SCOLAIRES
 * ============================================================================
 * 
 * Module pour la conformité des données scolaires :
 * - RGPD (GDPR)
 * - Protection des données personnelles
 * - Droit à l'oubli
 * - Export des données
 * - Consentement
 * 
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { UsersModule } from '../users/users.module';
import { StudentsModule } from '../students/students.module';
import { TenantsModule } from '../tenants/tenants.module'; // ✅ Import pour TenantValidationGuard
import { AuditLogsModule } from '../audit-logs/audit-logs.module'; // ✅ Import pour AuditLogInterceptor

@Module({
  imports: [
    UsersModule,
    StudentsModule,
    TenantsModule, // ✅ Import pour que TenantValidationGuard puisse résoudre TenantRepository
    AuditLogsModule, // ✅ Import pour que AuditLogInterceptor puisse résoudre AuditLogRepository
  ],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}

