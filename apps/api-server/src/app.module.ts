import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { SubjectsModule } from './subjects/subjects.module';
import { TeachersModule } from './teachers/teachers.module';
import { DepartmentsModule } from './departments/departments.module';
import { RoomsModule } from './rooms/rooms.module';
import { AbsencesModule } from './absences/absences.module';
import { DisciplineModule } from './discipline/discipline.module';
import { ExamsModule } from './exams/exams.module';
import { GradesModule } from './grades/grades.module';
import { FeeConfigurationsModule } from './fee-configurations/fee-configurations.module';
import { PaymentsModule } from './payments/payments.module';
import { ExpensesModule } from './expenses/expenses.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { CountriesModule } from './countries/countries.module';
import { GradingPoliciesModule } from './grading-policies/grading-policies.module';
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
import { ModulesComplementairesModule } from './modules-complementaires/modules-complementaires.module';
import { KpiObjectivesModule } from './kpi-objectives/kpi-objectives.module';
import { PedagogyModule } from './pedagogy/pedagogy.module';
import { ExamsGradesModule } from './exams-grades/exams-grades.module';
import { FinanceModule } from './finance/finance.module';
import { HRModule } from './hr/hr.module';
import { CommunicationModule } from './communication/communication.module';
import { PortalModule } from './portal/portal.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { BillingModule } from './billing/billing.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { ReviewsModule } from './reviews/reviews.module';
import { GeneralModule } from './modules/general/general.module';
import { ModulesModule } from './modules/modules.module';
import { ContextModule } from './common/context/context.module';
import { ContextModule as TenantContextModule } from './context/context.module';
import { SynthesisModule } from './modules/synthesis/synthesis.module';
import { SyncModule } from './sync/sync.module';
import { CommonModule } from './common/common.module';
import { SecurityModule } from './security/security.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { TenantValidationGuard } from './common/guards/tenant-validation.guard';
import { TenantIsolationGuard } from './common/guards/tenant-isolation.guard';
import { ContextValidationGuard } from './common/guards/context-validation.guard';
import { SchoolLevelIsolationGuard } from './common/guards/school-level-isolation.guard';
import { AcademicYearEnforcementGuard } from './common/guards/academic-year-enforcement.guard';
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

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 seconde
        limit: 10, // 10 requêtes par seconde
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requêtes par minute
      },
      {
        name: 'long',
        ttl: 3600000, // 1 heure
        limit: 1000, // 1000 requêtes par heure
      },
    ]),

    // Database
    DatabaseModule,

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
    SubjectsModule,
    TeachersModule,
    DepartmentsModule,
    RoomsModule,
    PedagogyModule,
    
    // Exams & Grades module (Module 3)
    ExamsGradesModule,
    
    // Finance & Économat module (Module 4)
    FinanceModule,
    
    // Personnel, RH & Paie module (Module 5)
    HRModule,
    
    // Communication & Engagement module (Module 6)
    CommunicationModule,
    
    // Attendance & Discipline
    AbsencesModule,
    DisciplineModule,
    
    // Evaluation modules
    ExamsModule,
    GradesModule,
    
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
    GradingPoliciesModule,
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
    
    // Module 9 - Modules Complémentaires
    ModulesComplementairesModule,
    
    // KPI Objectives module (Pilotage Direction)
    KpiObjectivesModule,
    
    // Communication module
    CommunicationModule,
    
    // General module (Agrégations contrôlées cross-level)
    GeneralModule,
    
    // Modules module
    ModulesModule,
    
    // Context module (DOIT être après ModulesModule, SchoolLevelsModule, TenantsModule)
    ContextModule,
    
    // Tenant Context module (Bootstrap du contexte tenant pour dashboards)
    TenantContextModule,
    
    // Common module (Permissions, services communs)
    CommonModule,
    
    // Security module (PLATFORM_OWNER, dev only)
    SecurityModule,
    
    // Module-specific calculation modules
    // Note: Ces modules fournissent des endpoints de calcul par module
    // Les modules métier (StudentsModule, PaymentsModule, etc.) restent pour CRUD
    // ScolariteModule, // Décommenter quand prêt
    // FinancesModule, // Décommenter quand prêt
    
    // Synthesis module (Module général de synthèse - Lecture seule)
    SynthesisModule,
    
    // Sync & Offline
    SyncModule,
    
    // Portal module (Multi-portal access)
    PortalModule,
    
    // Dashboard module
    DashboardModule,
    
    // Billing module (Subscription & Billing)
    BillingModule,
    
    // Onboarding module (School onboarding)
    OnboardingModule,

    // Avis / témoignages (landing Trustpilot)
    ReviewsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // ✅ Authentification JWT (seul guard global)
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

