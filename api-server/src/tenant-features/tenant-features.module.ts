import { Module } from '@nestjs/common';
import { TenantFeaturesService } from './tenant-features.service';
import { TenantFeaturesController } from './tenant-features.controller';
import { TenantFeaturesRepository } from './tenant-features.repository';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AcademicTracksModule } from '../academic-tracks/academic-tracks.module';
import { DatabaseModule } from '../database/database.module';
import { BilingualValidationService } from './bilingual-validation.service';

@Module({
  imports: [
    AuditLogsModule,
    AcademicTracksModule,
    DatabaseModule, // Pour PrismaService
  ],
  controllers: [TenantFeaturesController],
  providers: [TenantFeaturesService, TenantFeaturesRepository, BilingualValidationService],
  exports: [TenantFeaturesService, TenantFeaturesRepository, BilingualValidationService],
})
export class TenantFeaturesModule {}

