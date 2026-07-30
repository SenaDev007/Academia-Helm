/// API configuration for Academia Helm.
///
/// Centralises base URLs, timeouts, and environment detection so that the
/// rest of the networking layer can remain environment-agnostic.
class ApiConfig {
  ApiConfig._();

  // ── Base URLs ─────────────────────────────────────────────────────────

  static const String _productionBaseUrl = 'https://api.academiahelm.com/api';
  static const String _stagingBaseUrl = 'https://api-staging.academiahelm.com/api';

  // ── Timeouts ──────────────────────────────────────────────────────────

  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);
  static const Duration sendTimeout = Duration(seconds: 30);

  // ── Environment ───────────────────────────────────────────────────────

  /// Current environment. Change this value to switch between staging and
  /// production builds. In a real app this would be driven by compile-time
  /// `--dart-define` flags or flavor configurations.
  static ApiEnvironment environment = ApiEnvironment.staging;

  // ── Helpers ───────────────────────────────────────────────────────────

  /// Returns the appropriate base URL for the current [environment].
  static String get baseUrl {
    switch (environment) {
      case ApiEnvironment.production:
        return _productionBaseUrl;
      case ApiEnvironment.staging:
        return _stagingBaseUrl;
    }
  }

  /// Returns `true` when the current environment is production.
  static bool get isProduction => environment == ApiEnvironment.production;

  /// Returns `true` when the current environment is staging.
  static bool get isStaging => environment == ApiEnvironment.staging;

  // ── API Version ───────────────────────────────────────────────────────

  static const String apiVersion = 'v1';

  /// Returns the full versioned base URL, e.g.
  /// `https://api-staging.academiahelm.com/api/v1`.
  static String get versionedBaseUrl => '$baseUrl/$apiVersion';

  // ── Auth Endpoints ────────────────────────────────────────────────────

  static const String loginEndpoint = '/auth/login';
  static const String logoutEndpoint = '/auth/logout';
  static const String refreshTokenEndpoint = '/auth/refresh';
  static const String meEndpoint = '/auth/me';

  // ── Tenant Endpoints ──────────────────────────────────────────────────

  static const String tenantsEndpoint = '/tenants';
  static const String tenantSelectionEndpoint = '/tenants/select';

  // ── Retry ─────────────────────────────────────────────────────────────

  static const int maxRetryAttempts = 3;
  static const Duration retryDelay = Duration(seconds: 2);

  // ── Cache Configuration (mirror of TanStack Query) ────────────────────

  /// Durée pendant laquelle les données sont considérées fraîches.
  /// Miroir de staleTime=60s.
  static const Duration staleTime = Duration(seconds: 60);

  /// Durée avant que les données soient supprimées du cache.
  /// Miroir de gcTime=30min.
  static const Duration gcTime = Duration(minutes: 30);

  /// Nombre de tentatives en cas d'erreur.
  /// Miroir de retry=1.
  static const int retryCount = 1;

  /// TTL du cache local.
  static const Duration defaultCacheTTL = Duration(minutes: 5);

  // ── Meetings Endpoints ───────────────────────────────────────────────

  static const String meetings = '/meetings';
  static String meetingById(String id) => '/meetings/$id';
  static String meetingAgenda(String meetingId) => '/meetings/$meetingId/agenda';
  static String meetingMinutes(String meetingId) => '/meetings/$meetingId/minutes';
  static String meetingParticipants(String meetingId) => '/meetings/$meetingId/participants';
  static String meetingDecisions(String meetingId) => '/meetings/$meetingId/decisions';

  // ── Settings Endpoints ───────────────────────────────────────────────

  static const String settings = '/settings';
  static const String settingsGeneral = '/settings/general';
  static const String settingsAcademicYear = '/settings/academic-years';
  static const String settingsClasses = '/settings/classes';
  static const String settingsSubjects = '/settings/subjects';
  static const String settingsRoles = '/settings/roles';
  static const String settingsPermissions = '/settings/permissions';
  static const String settingsFeatureFlags = '/settings/feature-flags';
  static const String settingsSecurity = '/settings/security';
  static const String settingsBilling = '/settings/billing';
  static const String settingsCommunication = '/settings/communication';
  static const String settingsSeals = '/settings/seals';

  // ── Exams Endpoints ──────────────────────────────────────────────────

  static const String institutionalExams = '/exams/institutional';
  static const String examSaveGrades = '/exams/grades/save';
  static const String examGrades = '/exams/grades';
  static const String examBulletins = '/exams/bulletins';
  static const String examCouncils = '/exams/councils';
  static const String examConfig = '/exams/config';

  static String examEvaluationById(String id) => '/exams/evaluations/$id';
  static String examGradesByEvaluation(String evaluationId) => '/exams/evaluations/$evaluationId/grades';
  static String examBulletinByClass(String classId) => '/exams/bulletins/class/$classId';
  static String examCouncilById(String id) => '/exams/councils/$id';
  static String examDashboard(String academicYearId) => '/exams/dashboard/$academicYearId';

  // ── Exams Endpoints (extra aliases) ───────────────────────────────────

  static const String exams = '/exams';
  static const String examEvaluations = '/exams/evaluations';

  // ── Finance Endpoints ────────────────────────────────────────────────

  static const String finance = '/finance';
  static const String financeFeeRegimes = '/finance/fee-regimes';
  static const String financeFeeStructures = '/finance/fee-structures';
  static const String financeFeeStructuresCopyToYear = '/finance/fee-structures/copy-to-year';
  static const String financeFeeStructuresOverride = '/finance/fee-structures/override';
  static const String financeStudentFeeProfiles = '/finance/student-fee-profiles';
  static const String financeExpenses = '/finance/expenses';
  static const String financeExpenseCategories = '/finance/expenses/categories';
  static const String financeExpenseByCategory = '/finance/expenses/by-category';
  static const String financeTransactions = '/finance/transactions';
  static const String financeStudentAccounts = '/finance/student-accounts';
  static const String financeTreasuryClosures = '/finance/treasury-closures';
  static const String financeSettings = '/finance/settings';
  static const String financeKpiReports = '/finance/reports/kpi';
  static const String financeClassEncaissements = '/finance/reports/class-encaissements';
  static const String financeMonthlyEncaissements = '/finance/reports/monthly-encaissements';
  static const String financeArrears = '/finance/reports/arrears';
  static const String financeExportReports = '/finance/reports/export';
  static const String financeRecoveryRemindersManual = '/finance/recovery-reminders/manual';
  static const String financeRecoveryRemindersNightly = '/finance/recovery-reminders/nightly';

  static String financeFeeStructureById(String id) => '/finance/fee-structures/$id';
  static String financeExpenseBudgets(String academicYearId) => '/finance/expenses/budgets/$academicYearId';
  static String financeExpenseApprove(String id) => '/finance/expenses/$id/approve';
  static String financeExpenseReject(String id) => '/finance/expenses/$id/reject';
  static String financeTreasuryClosureValidate(String id) => '/finance/treasury-closures/$id/validate';
  static String financeStudentAccountById(String id) => '/finance/student-accounts/$id';
  static String financeStudentAccountUnblock(String id) => '/finance/student-accounts/$id/unblock';
  static String financeRecoveryReminders(String academicYearId) => '/finance/recovery-reminders/$academicYearId';
  static String financeAnomalies({int limit = 30}) => '/finance/audit/anomalies?limit=$limit';
  static String financeAuditLogs({int limit = 30}) => '/finance/audit/logs?limit=$limit';

  // ── Orion Endpoints (read-only assistant) ────────────────────────────

  static const String orion = '/orion';
  static const String orionQuery = '/orion/query';
  static const String orionMonthlySummary = '/orion/monthly-summary';
  static const String orionAlerts = '/orion/alerts';
  static const String orionHistory = '/orion/history';
  static const String orionConfig = '/orion/config';
  static const String orionKpis = '/orion/kpis';
  static const String orionInsights = '/orion/insights';

  static String orionAlertAcknowledge(String id) => '/orion/alerts/$id/acknowledge';

  // ── Students Endpoints ───────────────────────────────────────────────

  static const String students = '/students';
  static const String studentAdmissions = '/students/admissions';
  static const String studentEnrollments = '/students/enrollments';
  static const String studentPreRegister = '/students/pre-register';
  static const String studentGenerateBulkMatricules = '/students/generate-bulk-matricules';
  static const String studentGenerateBulkIdCards = '/students/generate-bulk-id-cards';
  static const String studentIdCardStats = '/students/id-cards/stats';
  static const String studentIdentifiersStats = '/students/identifiers/stats';

  static String studentDossier(String id) => '/students/$id/dossier';
  static String studentGuardians(String id) => '/students/$id/guardians';
  static String studentHistory(String id) => '/students/$id/history';
  static String studentStatistics(String id, [String? schoolLevelId]) =>
      schoolLevelId == null
          ? '/students/$id/statistics'
          : '/students/$id/statistics?schoolLevelId=$schoolLevelId';
  static String studentUploadPhoto(String id) => '/students/$id/photo';
  static String studentRegenerateQR(String id) => '/students/$id/regenerate-qr';
  static String studentRevokeIdCard(String id) => '/students/$id/revoke-id-card';
  static String studentVerificationQR(String token) => '/students/verify-qr/$token';
  static String studentSearchByMatricule(String matricule) => '/students/search-by-matricule/$matricule';
  static String studentGenerateMatricule(String id) => '/students/$id/generate-matricule';
  static String studentOrionAlerts(String id) => '/students/$id/orion-alerts';
  static String studentOrionKpis(String id) => '/students/$id/orion-kpis';
  static String studentEnroll(String id) => '/students/$id/enroll';
  static String studentAdmissionById(String id) => '/students/admissions/$id';
  static String studentAdmissionSubmit(String id) => '/students/admissions/$id/submit';
  static String studentAdmissionDecide(String id) => '/students/admissions/$id/decide';
  static String studentAdmissionConvert(String id) => '/students/admissions/$id/convert';

  // ── Communication Endpoints ──────────────────────────────────────────

  static const String communication = '/communication';
  static const String communicationMessages = '/communication/messages';
  static const String communicationAnnouncements = '/communication/announcements';
  static const String communicationEmails = '/communication/emails';
  static const String communicationSms = '/communication/sms';
  static const String communicationWhatsApp = '/communication/whatsapp';
  static const String communicationCampaigns = '/communication/campaigns';
  static const String communicationTemplates = '/communication/templates';

  static String communicationMessageById(String id) => '/communication/messages/$id';
  static String communicationAnnouncementById(String id) => '/communication/announcements/$id';

  // ── Pedagogy Endpoints ───────────────────────────────────────────────

  static const String pedagogy = '/pedagogy';
  static const String pedagogyAssignments = '/pedagogy/assignments';
  static const String academicSeries = '/pedagogy/academic-series';
  static const String academicSeriesSubjects = '/pedagogy/academic-series-subjects';
  static const String academicClasses = '/pedagogy/academic-classes';
  static const String classDiaries = '/pedagogy/class-diaries';
  static const String lessonPlans = '/pedagogy/lesson-plans';
  static const String lessonJournals = '/pedagogy/lesson-journals';
  static const String homeworkEntries = '/pedagogy/homework-entries';
  static const String semainier = '/pedagogy/semainier';
  static const String pedagogicalMaterials = '/pedagogy/materials';
  static const String subjects = '/pedagogy/subjects';
  static const String teachers = '/pedagogy/teachers';
  static const String teacherProfiles = '/pedagogy/teacher-profiles';
  static const String timetables = '/pedagogy/timetables';

  static String academicSeriesById(String id) => '/pedagogy/academic-series/$id';
  static String academicSeriesSubjectById(String id) => '/pedagogy/academic-series-subjects/$id';
  static String classDiaryById(String id) => '/pedagogy/class-diaries/$id';
  static String lessonPlanById(String id) => '/pedagogy/lesson-plans/$id';
  static String lessonJournalById(String id) => '/pedagogy/lesson-journals/$id';
  static String homeworkEntryById(String id) => '/pedagogy/homework-entries/$id';
  static String pedagogicalMaterialById(String id) => '/pedagogy/materials/$id';
  static String pedagogyAssignmentById(String id) => '/pedagogy/assignments/$id';
  static String subjectById(String id) => '/pedagogy/subjects/$id';
  static String teacherById(String id) => '/pedagogy/teachers/$id';
  static String teacherProfileById(String id) => '/pedagogy/teacher-profiles/$id';
  static String classSubjects(String classId) => '/pedagogy/classes/$classId/subjects';
  static String classSubjectById(String classId, String subjectId) => '/pedagogy/classes/$classId/subjects/$subjectId';
  static String semainierDailyEntries(String classId) => '/pedagogy/semainier/$classId/daily-entries';
  static String semainierIncidents(String classId) => '/pedagogy/semainier/$classId/incidents';
  static String semainierSubmit(String classId) => '/pedagogy/semainier/$classId/submit';
  static String pedagogyKpiDashboard(String academicYearId) => '/pedagogy/dashboard/$academicYearId';
  static String pedagogyOrionDashboard(String academicYearId) => '/pedagogy/orion-dashboard/$academicYearId';

  // ── HR Endpoints ─────────────────────────────────────────────────────

  static const String hr = '/hr';
  static const String hrStaff = '/hr/staff';
  static const String hrContracts = '/hr/contracts';
  static const String hrLeaves = '/hr/leaves';
  static const String hrPayroll = '/hr/payroll';
  static const String hrCredentials = '/hr/credentials';

  static String hrStaffById(String id) => '/hr/staff/$id';
  static String hrContractById(String id) => '/hr/contracts/$id';
  static String hrLeaveById(String id) => '/hr/leaves/$id';
  static String hrPayrollById(String id) => '/hr/payroll/$id';
}

/// Enum representing the API environment.
enum ApiEnvironment {
  production,
  staging,
}
