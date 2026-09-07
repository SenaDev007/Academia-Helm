import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { InstitutionalExamsModule } from './modules/exams/exams.module';
import { FederisModule } from './federis/federis.module';
import { AtlasModule } from './atlas/atlas.module';
import { SaraModule } from './sara/sara.module';
import { EducMasterModule } from './educmaster/educmaster.module';
import { SaisieMasterModule } from './saisiemaster/saisiemaster.module';
import { CommunityModule } from './community/community.module';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AccessScopeGuard } from './common/guards/access-scope.guard';
import { AppController } from './app.controller';
import { HealthController } from './health/health.controller';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TenantsModule } from './tenants/tenants.module';
import { StudentsModule } from './students/students.module';
import { AcademicYearsModule } from './academic-years/academic-years.module';
import { QuartersModule } from './quarters/quarters.module';
import { SchoolsModule } from './schools/schools.module';
import { ClassesModule } from './classes/classes.module';
// SubjectsModule removed — replaced by SubjectsPrismaController in PedagogyModule
// TeachersModule removed — replaced by TeachersPrismaController in PedagogyModule
import { DepartmentsModule } from './departments/departments.module';
// RoomsModule removed — replaced by RoomsPrismaController in PedagogyModule
import { AbsencesModule } from './absences/absences.module';
import { DisciplineModule } from './discipline/discipline.module';
import { RiskScoreModule } from './risk-score/risk-score.module';
import { ExamFraudModule } from './exam-fraud/exam-fraud.module';
// ExamsModule removed — replaced by ExamsPrismaController (ExamsGradesModule)
// GradesModule removed — replaced by GradesController (InstitutionalExamsModule)
// GradingPoliciesModule removed — module isolé sans alternative Prisma (supprimé en Phase 6)
import { FeeConfigurationsModule } from './fee-configurations/fee-configurations.module';
import { PaymentsModule } from './payments/payments.module';
import { ExpensesModule } from './expenses/expenses.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { CountriesModule } from './countries/countries.module';
import { ReleasesModule } from './releases/releases.module';
import { SyncModule } from './sync/sync.module';
import { SalaryPoliciesModule } from './salary-policies/salary-policies.module';
import { ComplianceModule } from './compliance/compliance.module';
import { SchoolLevelsModule } from './school-levels/school-levels.module';
import { AcademicTracksModule } from './academic-tracks/academic-tracks.module';
import { TenantFeaturesModule } from './tenant-features/tenant-features.module';
import { PaymentFlowsModule } from './payment-flows/payment-flows.module';
import { OrionModule } from './orion/orion.module';
import { QhsModule } from './qhs/qhs.module';
import { SettingsModule } from './settings/settings.module';
import { MeetingsModule } from './meetings/meetings.module';
import { MediaModule } from './media/media.module';
import { TenantMediaModule } from './tenant-media/tenant-media.module';
import { TenantThemeModule } from './tenant-theme/tenant-theme.module';
import { TenantBlockSelectionModule } from './tenant-block-selection/tenant-block-selection.module';
import { AdminStructureModule } from './admin-structure/admin-structure.module';
import { StaffAdminAssignmentModule } from './staff-admin-assignment/staff-admin-assignment.module';
import { PositionsModule } from './positions/positions.module';
import { TimetableEngineModule } from './timetable-engine/timetable-engine.module';
import { MultigradeModule } from './multigrade/multigrade.module';
import { ModulesComplementairesModule } from './modules-complementaires/modules-complementaires.module';
import { KpiObjectivesModule } from './kpi-objectives/kpi-objectives.module';
import { PedagogyModule } from './pedagogy/pedagogy.module';
import { TenantWebsiteModule } from './tenant-website/tenant-website.module';
import { ExamsGradesModule } from './exams-grades/exams-grades.module';
import { FinanceModule } from './finance/finance.module';
import { HRModule } from './hr/hr.module';
import { CommunicationModule } from './communication/communication.module';
import { PortalModule } from './portal/portal.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { BillingModule } from './billing/billing.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { NotificationModule } from './notifications/notification.module';
import { ReviewsModule } from './reviews/reviews.module';
import { GeneralModule } from './modules/general/general.module';
import { ModulesModule } from './modules/modules.module';
import { PlatformModule } from './platform/platform.module';
import { ContextModule } from './common/context/context.module';
import { ContextModule as TenantContextModule } from './context/context.module';
import { SynthesisModule } from './modules/synthesis/synthesis.module';
import { AccessRequestsModule } from './access-requests/access-requests.module';
import { ScolariteModule } from './modules/scolarite/scolarite.module';
import { FinancesModule } from './modules/finances/finances.module';
import { AIModule } from './ai/ai.module';
import { OrionAiModule } from './orion/orion-ai.module';
import { CommonModule } from './common/common.module';
import { SecurityModule } from './security/security.module';
import { ParentPortalModule } from './parent-portal/parent-portal.module';
import { StorageMigrationModule } from './storage-migration/storage-migration.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { TenantValidationGuard } from './common/guards/tenant-validation.guard';
import { TenantIsolationGuard } from './common/guards/tenant-isolation.guard';
import { ContextValidationGuard } from './common/guards/context-validation.guard';
import { SchoolLevelIsolationGuard } from './common/guards/school-level-isolation.guard';
import { AcademicYearEnforcementGuard } from './common/guards/academic-year-enforcement.guard';
import { TenantSuspensionGuard } from './common/guards/tenant-suspension.guard';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { ContextInterceptor } from './common/interceptors/context.interceptor';
import { SchoolLevelEnforcementInterceptor } from './common/interceptors/school-level-enforcement.interceptor';
import { AcademicYearEnforcementInterceptor } from './common/interceptors/academic-year-enforcement.interceptor';
import { PerformanceLoggingInterceptor } from './common/interceptors/performance-logging.interceptor';
@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ScheduleModule — MUST be registered ONCE at root level (fixes triple-registration OOM)
    ScheduleModule.forRoot(),

    // Rate Limiting
    // ⭐ V5 (chantier 4) — ANTI-SPAM : le throttler nommé 'medium' est le régime
    //    GLOBAL par défaut → 300 requêtes/minute pour toutes les routes (les GET
    //    de polling restent à ce régime, jamais throttlés spécifiquement).
    //    Les POST d'ENVOI de messages surchargent localement 'medium' à 30/min
    //    via @Throttle({ medium: { limit: 30, ttl: 60000 } }) — voir
    //    chat.controller.ts (messages/text, messages/attachment, sticker).
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 seconde
        limit: 10, // 10 requêtes par seconde
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minute
        limit: 300, // ⭐ V5 — 300 requêtes/minute (global, spec anti-spam Helm Connect)
      },
      {
        name: 'long',
        ttl: 3600000, // 1 heure
        limit: 1000, // 1000 requêtes par heure
      },
    ]),

    // Database
    DatabaseModule,

    // CommonModule — MUST be imported BEFORE feature modules that need PuppeteerPoolService
    CommonModule,

    // Feature modules
    AuthModule,
    UsersModule,
    TenantsModule,
    StudentsModule,
    
    // Academic modules
    AcademicYearsModule,
    QuartersModule,
    SchoolsModule,
    
    // Pedagogical modules
    ClassesModule,
    // SubjectsModule removed — collides with SubjectsPrismaController (PedagogyModule)
    // TeachersModule removed — collides with TeachersPrismaController (PedagogyModule)
    DepartmentsModule,
    // RoomsModule removed — collides with RoomsPrismaController (PedagogyModule)
    PedagogyModule,
    TenantWebsiteModule,
    
    // Exams & Grades module (Module 3)
    ExamsGradesModule,
    
    // Finance & Économat module (Module 4)
    FinanceModule,
    
    // Personnel, RH & Paie module (Module 5)
    HRModule,
    
    // Module 3 - Examens, Notes & Bulletins (Hardened)
    InstitutionalExamsModule,
    
    // Communication & Engagement module (Module 6)
    CommunicationModule,
    
    // Attendance & Discipline
    AbsencesModule,
    DisciplineModule,
    RiskScoreModule,
    ExamFraudModule,
    
    // Evaluation modules
    // ExamsModule, GradesModule, GradingPoliciesModule removed — remplacés par ExamsGradesModule + InstitutionalExamsModule (Phase 6)
    
    // Finance modules
    FeeConfigurationsModule,
    PaymentsModule,
    ExpensesModule,
    
    // System modules
    RolesModule,
    PermissionsModule,
    AuditLogsModule,
    
    // Country & Policies modules
    CountriesModule,
    ReleasesModule,
    SyncModule,
    SalaryPoliciesModule,
    
    // Compliance module
    ComplianceModule,
    
    // School Levels module
    SchoolLevelsModule,
    
    // Academic Tracks module (Bilingue FR/EN)
    AcademicTracksModule,
    
    // Tenant Features module (Feature Flags)
    TenantFeaturesModule,
    
    // Payment Flows module (Séparation SAAS/TUITION)
    PaymentFlowsModule,
    
    // ORION - Pilotage Direction & IA (Module 8)
    OrionModule,
    
    // QHSE+ module (Gouvernance, Risques & Conformité)
    QhsModule,
    
    // Module Transversal — Paramètres (Centre de contrôle stratégique)
    SettingsModule,
    
    // Module Transversal — Réunions (Administratives, Pédagogiques & Parents)
    MeetingsModule,

    // Médias — optimisation d’images (Sharp), réutilisable plateforme
    MediaModule,

    // Bibliothèque médias tenant-scoped (CMS institutionnel)
    TenantMediaModule,

    // ⚠️ StorageMigrationModule TEMPORAIREMENT DÉSACTIVÉ — causait un crash DI
    // au bootstrap. Le service essayait d'injecter StorageService qui était
    // déclaré dans CommonModule (rendu @Global) MAIS aussi dans 5 feature modules.
    // Cela créait un conflit de résolution DI qui faisait crasher l'app avant
    // app.listen(). À réactiver après avoir nettoyé les déclarations dupliquées.
    // StorageMigrationModule,

    // Thèmes du site institutionnel tenant (40 thèmes 21st.dev)
    TenantThemeModule,

    // Sélections de composants CMS (navbar, hero, footer, etc.)
    TenantBlockSelectionModule,

    // Mode d'administration scolaire (SEPARATE vs FUSED_MATERNELLE_PRIMAIRE)
    AdminStructureModule,

    // Affectations administratives level-aware (Directeur Maternelle, etc.)
    StaffAdminAssignmentModule,

    // Postes occupés (CRUD, suggestions par défaut)
    PositionsModule,

    // Smart Timetable Engine (génération automatique d'emplois du temps)
    TimetableEngineModule,
    MultigradeModule,
    
    // Module 9 - Modules Complémentaires
    ModulesComplementairesModule,
    
    // KPI Objectives module (Pilotage Direction)
    KpiObjectivesModule,
    
    // General module (Agrégations contrôlées cross-level)
    GeneralModule,
    
    // Modules module
    ModulesModule,

    // Platform back-office module (admin.academiahelm.com — données réelles DB)
    PlatformModule,

    // Context module (DOIT être après ModulesModule, SchoolLevelsModule, TenantsModule)
    ContextModule,
    
    // Tenant Context module (Bootstrap du contexte tenant pour dashboards)
    TenantContextModule,
    
    // Security module (PLATFORM_OWNER, dev only)
    SecurityModule,
    
    // Module-specific calculation modules
    // Note: Ces modules fournissent des endpoints de calcul par module
    // Les modules métier (StudentsModule, PaymentsModule, etc.) restent pour CRUD
    ScolariteModule,
    FinancesModule,
    ParentPortalModule,

    // Synthesis module (Module général de synthèse - Lecture seule)
    SynthesisModule,
    AccessRequestsModule,
    
    // Sync & Offline
    SyncModule,
    
    // Portal module (Multi-portal access)
    PortalModule,
    
    // Dashboard module
    DashboardModule,

    // Analytics module (vue stratégique consolidée multi-écoles — promoteur)
    AnalyticsModule,
    
    // Billing module (Subscription & Billing)
    BillingModule,
    
    // Onboarding module (School onboarding)
    OnboardingModule,

    // Avis / témoignages (landing Trustpilot)
    ReviewsModule,

    // Patronat Module
    FederisModule,

    // IA Infrastructure Module (Gateway, MCP, Tool Calling)
    AIModule,

    // ⭐ ORION AI Module (GLM-5.2 chat + analysis)
    OrionAiModule,

    // IA ATLAS Module
    AtlasModule,

    // IA SARA Module
    SaraModule,

    // Notification Module
    NotificationModule,

    // EducMaster Module
    EducMasterModule,

    // SaisieMaster Module (free lead-capture tool for school directors)
    SaisieMasterModule,

    // ⭐ Academia Community — espace clients/prospects du produit (plateforme)
    CommunityModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // ✅ Authentification JWT (seul guard global)
    },
    {
      // ⭐ Filtre intelligent Rôles × Pistes × Niveaux — enforcement du périmètre
      //    serveur (bloque les headers/query/body hors scope : niveau, 'ALL',
      //    piste). Ne fait rien pour les routes @Public / comptes transverses /
      //    scopes non résolus (rétro-compat). Les listes sans filtre sont
      //    restreintes par les services via scope-where.ts (P3).
      provide: APP_GUARD,
      useClass: AccessScopeGuard,
    },
    // ✅ TenantValidationGuard et TenantIsolationGuard retirés des guards globaux
    // Ils seront appliqués uniquement sur les routes marquées avec @RequireTenant()
    {
      provide: APP_GUARD,
      useClass: ContextValidationGuard, // Validation du contexte (tenant + school_level + module) - seulement si tenant requis
    },
    {
      provide: APP_GUARD,
      useClass: SchoolLevelIsolationGuard, // Isolation stricte des niveaux scolaires - seulement si tenant requis
    },
    {
      provide: APP_GUARD,
      useClass: AcademicYearEnforcementGuard, // Enforcement academic_year_id - seulement si tenant requis
    },
    {
      // ⭐ MODE LECTURE SEULE : bloque toute écriture d'une école suspendue
      //    (suspension pilotée depuis le back-office /platform/tenants).
      //    Les lectures (GET) et les routes de règlement (/billing/renew…)
      //    restent autorisées. Cache 30 s par tenant.
      provide: APP_GUARD,
      useClass: TenantSuspensionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // Rate limiting global
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ContextInterceptor, // Résolution du contexte (DOIT être avant autres interceptors)
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SchoolLevelEnforcementInterceptor, // Enforcement school_level_id obligatoire
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AcademicYearEnforcementInterceptor, // Enforcement academic_year_id obligatoire
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceLoggingInterceptor, // Profiling des routes (DOIT être avant AuditLog)
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor, // Logs d'audit
    },
  ],
})
export class AppModule {}

