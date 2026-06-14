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
}

/// Enum representing the API environment.
enum ApiEnvironment {
  production,
  staging,
}
