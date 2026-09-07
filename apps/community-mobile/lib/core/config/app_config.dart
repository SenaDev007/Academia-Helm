/// Configuration de l'application — URL de l'api-server Academia Helm.
///
/// L'URL est fournie au build via `--dart-define` (0 google-services.json,
/// 0 fichier à modifier) :
///
/// ```sh
/// flutter build apk --release \
///   --dart-define=API_BASE_URL=https://academiahelm-api.up.railway.app/api
/// ```
///
/// Sans dart-define, on retombe sur l'URL de production.
library;

class AppConfig {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.academiahelm.com/api',
  );

  /// Vitrine web (liens « En savoir plus », mentions légales…)
  static const String webUrl = String.fromEnvironment(
    'WEB_URL',
    defaultValue: 'https://academiahelm.com',
  );
}
