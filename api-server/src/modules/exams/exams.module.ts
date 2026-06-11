import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { UsersModule } from '../../users/users.module';
import { AuditLogsModule } from '../../audit-logs/audit-logs.module';
import { ExamsDashboardController } from './exams-dashboard.controller';
import { ExamsDashboardService } from './services/exams-dashboard.service';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './services/evaluations.service';
import { GradesController } from './grades.controller';
import { GradesService } from './services/grades.service';
import { ValidationController } from './validation.controller';
import { ValidationService } from './services/validation.service';
import { BulletinsController } from './bulletins.controller';
import { BulletinsService } from './services/bulletins.service';
import { ExamsConfigController } from './exams-config.controller';
import { ExamsConfigService } from './services/exams-config.service';
import { CouncilsController } from './councils.controller';
import { CouncilsService } from './services/councils.service';
import { AcademicAuditController } from './academic-audit.controller';
import { AcademicAuditService } from './services/academic-audit.service';
import { BulletinPdfService } from './services/bulletin-pdf.service';

@Module({
  imports: [DatabaseModule, UsersModule, AuditLogsModule],
  controllers: [
    ExamsDashboardController,
    EvaluationsController,
    GradesController,
    ValidationController,
    BulletinsController,
    ExamsConfigController,
    CouncilsController,
    AcademicAuditController,
  ],
  providers: [
    ExamsDashboardService,
    EvaluationsService,
    GradesService,
    ValidationService,
    BulletinsService,
    ExamsConfigService,
    CouncilsService,
    AcademicAuditService,
    BulletinPdfService,
  ],
  exports: [
    ExamsDashboardService,
    EvaluationsService,
    GradesService,
    ValidationService,
    BulletinsService,
    ExamsConfigService,
    CouncilsService,
    AcademicAuditService,
    BulletinPdfService,
  ],
})
export class InstitutionalExamsModule {}
