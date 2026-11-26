import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { UsersModule } from '../../users/users.module';
import { AuditLogsModule } from '../../audit-logs/audit-logs.module';
import { ExamsGradesModule } from '../../exams-grades/exams-grades.module';
import { CommonModule } from '../../common/common.module';
import { CommunicationModule } from '../../communication/communication.module';
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
// ⭐ 2026-11-26 — Envoi automatique des bulletins aux parents (e-mail + Helm Connect)
import { BulletinDeliveryService } from './services/bulletin-delivery.service';
import { ExamsConfigController } from './exams-config.controller';
import { ExamsConfigService } from './services/exams-config.service';
import { CouncilsController } from './councils.controller';
import { CouncilsService } from './services/councils.service';
import { AcademicAuditController } from './academic-audit.controller';
import { AcademicAuditService } from './services/academic-audit.service';
import { BulletinPdfService } from './services/bulletin-pdf.service';
import { ExamsSpecConfigController } from './exams-spec-config.controller';
import { ExamsLockController } from './exams-lock.controller';
import { UnlockRequestsController } from './unlock-requests.controller';
// ⭐ 2026-09-16 — Cachets/signatures automatiques sur les bulletins
import { SettingsModule } from '../../settings/settings.module';
// ⭐ 2026-09-29 — Promotion & Redoublement
import { PedagogyModule } from '../../pedagogy/pedagogy.module';
import { FinanceModule } from '../../finance/finance.module';
import { PromotionController } from './promotion.controller';
// ⭐ 2026-09-29 — PDF Procès-verbal / Statistiques / Promotion
import { PvStatsPromotionPdfService } from './services/pv-stats-promotion-pdf.service';
import { PvStatsPromotionPdfController } from './pv-stats-promotion-pdf.controller';
// ⭐ 2026-09-30 — Distinctions / Tableau d'honneur
import { DistinctionsController, PublicDistinctionsController } from './distinctions/distinctions.controller';
import { DistinctionsNotificationService } from './distinctions/distinctions-notification.service';
// ⭐ 2026-10-01 — Educ Master Import / Interopérabilité
import { EducMasterController } from './educ-master/educ-master.controller';
import { EducMasterService } from './educ-master/educ-master.service';
// ⭐ 2026-09-30 — ParentProvisioningModule pour l'envoi email/Helm Connect aux parents
import { ParentProvisioningModule } from '../../students/parent-provisioning.module';

@Module({
  imports: [DatabaseModule, UsersModule, AuditLogsModule, ExamsGradesModule, CommonModule, CommunicationModule, SettingsModule, PedagogyModule, FinanceModule, ParentProvisioningModule],
  controllers: [
    ExamsDashboardController,
    EvaluationsController,
    UnlockRequestsController,
    GradesController,
    ValidationController,
    BulletinsController,
    ExamsConfigController,
    CouncilsController,
    AcademicAuditController,
    ExamsSpecConfigController,
    ExamsLockController,
    UnlockRequestsController,
    PromotionController,
    PvStatsPromotionPdfController,
    DistinctionsController,
    PublicDistinctionsController,
    EducMasterController,
  ],
  providers: [
    ExamsDashboardService,
    EvaluationsService,
    GradesService,
    ValidationService,
    BulletinsService,
    BulletinDeliveryService,
    ExamsConfigService,
    CouncilsService,
    AcademicAuditService,
    BulletinPdfService,
    PvStatsPromotionPdfService,
    DistinctionsNotificationService,
    EducMasterService,
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
    PvStatsPromotionPdfService,
  ],
})
export class InstitutionalExamsModule {}
