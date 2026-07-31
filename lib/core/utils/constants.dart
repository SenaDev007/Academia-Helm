/// App-wide constants for Academia Helm.
///
/// Centralises values that are referenced throughout the application so that
/// they can be updated in a single place.
class AHConstants {
  AHConstants._();

  // ── App Identity ──────────────────────────────────────────────────────

  static const String appName = 'Academia Helm';
  static const String appVersion = '1.0.0';
  static const String appBuildNumber = '1';
  static const String appPackageName = 'com.academiahelm.app';

  // ── Contact ───────────────────────────────────────────────────────────

  static const String supportEmail = 'support@academiahelm.com';
  static const String supportPhone = '+237 6 00 00 00 00';
  static const String websiteUrl = 'https://academiahelm.com';
  static const String privacyPolicyUrl = 'https://academiahelm.com/privacy';
  static const String termsOfServiceUrl = 'https://academiahelm.com/terms';

  // ── Network ───────────────────────────────────────────────────────────

  static const int maxRetryAttempts = 3;
  static const Duration retryDelay = Duration(seconds: 2);
  static const Duration cacheDuration = Duration(minutes: 5);
  static const Duration staleCacheDuration = Duration(hours: 24);

  // ── Pagination ────────────────────────────────────────────────────────

  static const int defaultPageSize = 20;
  static const int maxPageSize = 100;

  // ── Secure Storage Keys ───────────────────────────────────────────────

  static const String accessTokenKey = 'ah_access_token';
  static const String refreshTokenKey = 'ah_refresh_token';
  static const String selectedTenantIdKey = 'ah_selected_tenant_id';
  static const String localeKey = 'ah_locale';
  static const String themeKey = 'ah_theme';
  static const String onboardingCompleteKey = 'ah_onboarding_complete';

  // ── Date Formats ──────────────────────────────────────────────────────

  static const String dateFormat = 'dd/MM/yyyy';
  static const String dateTimeFormat = 'dd/MM/yyyy HH:mm';
  static const String timeFormat = 'HH:mm';
  static const String apiDateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'";

  // ── Currency ──────────────────────────────────────────────────────────

  static const String currencyCode = 'XAF';
  static const String currencySymbol = 'FCFA';
  static const String currencyName = 'CFA Franc BEAC';
  static const int currencyDecimals = 0;

  // ── Locale ────────────────────────────────────────────────────────────

  static const String defaultLocale = 'en';
  static const String fallbackLocale = 'fr';
  static const List<String> supportedLocales = <String>['en', 'fr'];

  // ── Validation ────────────────────────────────────────────────────────

  static const int passwordMinLength = 8;
  static const int passwordMaxLength = 128;
  static const int nameMinLength = 2;
  static const int nameMaxLength = 100;
  static const int phoneMinLength = 9;
  static const int phoneMaxLength = 15;
  static const int matriculeMinLength = 5;
  static const int matriculeMaxLength = 20;

  // ── File Upload ───────────────────────────────────────────────────────

  static const int maxFileSizeBytes = 10 * 1024 * 1024; // 10 MB
  static const int maxAvatarSizeBytes = 2 * 1024 * 1024; // 2 MB
  static const List<String> allowedImageExtensions = <String>[
    'jpg',
    'jpeg',
    'png',
    'webp',
  ];
  static const List<String> allowedDocumentExtensions = <String>[
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'csv',
  ];

  // ── Animation ─────────────────────────────────────────────────────────

  static const Duration animationDurationShort = Duration(milliseconds: 150);
  static const Duration animationDurationMedium = Duration(milliseconds: 300);
  static const Duration animationDurationLong = Duration(milliseconds: 500);

  // ── Debounce ──────────────────────────────────────────────────────────

  static const Duration searchDebounce = Duration(milliseconds: 300);
  static const Duration inputDebounce = Duration(milliseconds: 500);

  // ── Session ───────────────────────────────────────────────────────────

  static const Duration sessionTimeout = Duration(minutes: 30);
  static const Duration tokenRefreshBuffer = Duration(seconds: 30);

  // ── Feature Flags ─────────────────────────────────────────────────────

  static const bool enableNotifications = true;
  static const bool enableOfflineMode = true;
  static const bool enableBiometricLogin = true;
  static const bool enableDarkMode = true;
  static const bool enableMultiLanguage = true;

  // ── Student ───────────────────────────────────────────────────────────

  static const List<String> guardianRelations = <String>[
    'Father',
    'Mother',
    'Guardian',
    'Uncle',
    'Aunt',
    'Other',
  ];

  static const List<String> studentStatuses = <String>[
    'Active',
    'Inactive',
    'Graduated',
    'Suspended',
    'Transferred',
  ];

  // ── Teacher ───────────────────────────────────────────────────────────

  static const List<String> employmentTypes = <String>[
    'Full-time',
    'Part-time',
    'Contract',
    'Substitute',
  ];

  // ── Grade ─────────────────────────────────────────────────────────────

  static const double passingGrade = 10.0;
  static const double maxGrade = 20.0;
  static const double minGrade = 0.0;
}
