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
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { DataConsent } from './entities/data-consent.entity';
import { DataExport } from './entities/data-export.entity';
import { UsersModule } from '../users/users.module';
import { StudentsModule } from '../students/students.module';
import { TenantsModule } from '../tenants/tenants.module'; // ✅ Import pour TenantValidationGuard
import { AuditLogsModule } from '../audit-logs/audit-logs.module'; // ✅ Import pour AuditLogInterceptor

@Module({
  imports: [
    TypeOrmModule.forFeature([DataConsent, DataExport]),
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

