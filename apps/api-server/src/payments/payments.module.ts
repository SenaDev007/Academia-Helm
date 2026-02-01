import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment } from './entities/payment.entity';
import { PaymentsRepository } from './payments.repository';
import { ModulesModule } from '../modules/modules.module'; // ✅ Import pour ModuleAccessGuard
import { TenantsModule } from '../tenants/tenants.module'; // ✅ Import pour TenantValidationGuard
import { AuditLogsModule } from '../audit-logs/audit-logs.module'; // ✅ Import pour AuditLogInterceptor
import { UsersModule } from '../users/users.module'; // ✅ Import pour PermissionsGuard

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    ModulesModule, // ✅ Import pour que ModuleAccessGuard puisse résoudre ModulesService
    TenantsModule, // ✅ Import pour que TenantValidationGuard puisse résoudre TenantRepository
    AuditLogsModule, // ✅ Import pour que AuditLogInterceptor puisse résoudre AuditLogRepository
    UsersModule, // ✅ Import pour que PermissionsGuard puisse résoudre UserRepository
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository],
  exports: [PaymentsService],
})
export class PaymentsModule {}

