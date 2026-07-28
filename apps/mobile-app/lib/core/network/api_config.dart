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
}

/// Enum representing the API environment.
enum ApiEnvironment {
  production,
  staging,
}
