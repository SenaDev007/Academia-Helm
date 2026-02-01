import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolLevelsController } from './school-levels.controller';
import { SchoolLevelsService } from './school-levels.service';
import { SchoolLevelsRepository } from './school-levels.repository';
import { SchoolLevel } from './entities/school-level.entity';
import { TenantsModule } from '../tenants/tenants.module'; // ✅ Import pour TenantValidationGuard
import { AuditLogsModule } from '../audit-logs/audit-logs.module'; // ✅ Import pour AuditLogInterceptor
import { UsersModule } from '../users/users.module'; // ✅ Import pour PermissionsGuard

@Module({
  imports: [
    TypeOrmModule.forFeature([SchoolLevel]),
    TenantsModule, // ✅ Import pour que TenantValidationGuard puisse résoudre TenantRepository
    AuditLogsModule, // ✅ Import pour que AuditLogInterceptor puisse résoudre AuditLogRepository
    UsersModule, // ✅ Import pour que PermissionsGuard puisse résoudre UserRepository
  ],
  controllers: [SchoolLevelsController],
  providers: [SchoolLevelsService, SchoolLevelsRepository],
  exports: [SchoolLevelsService, SchoolLevelsRepository],
})
export class SchoolLevelsModule {}

