import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';
import { ModulesRepository } from './modules.repository';
import { Module as ModuleEntity } from './entities/module.entity';
import { SchoolLevelsModule } from '../school-levels/school-levels.module';
import { TenantsModule } from '../tenants/tenants.module'; // ✅ Import pour TenantValidationGuard
import { AuditLogsModule } from '../audit-logs/audit-logs.module'; // ✅ Import pour AuditLogInterceptor
import { UsersModule } from '../users/users.module'; // ✅ Import pour PermissionsGuard

@Module({
  imports: [
    TypeOrmModule.forFeature([ModuleEntity]),
    SchoolLevelsModule,
    TenantsModule, // ✅ Import pour que TenantValidationGuard puisse résoudre TenantRepository
    AuditLogsModule, // ✅ Import pour que AuditLogInterceptor puisse résoudre AuditLogRepository
    UsersModule, // ✅ Import pour que PermissionsGuard puisse résoudre UserRepository
  ],
  controllers: [ModulesController],
  providers: [ModulesService, ModulesRepository],
  exports: [ModulesService, ModulesRepository],
})
export class ModulesModule {}

