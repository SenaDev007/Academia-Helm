// ============================================================================
// API CONFIG — Configuration de l'API backend
// ============================================================================

class ApiConfig {
  /// URL de base de l'API NestJS
  /// En production: https://api.academiahelm.com/api
  /// En dev local: http://10.0.2.2:3001/api (émulateur Android → localhost)
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.academiahelm.com/api',
  );

  /// URL de base pour les pages web (portail école)
  static const String webBaseUrl = String.fromEnvironment(
    'WEB_BASE_URL',
    defaultValue: 'https://app.academiahelm.com',
  );

  /// Timeout des requêtes (30 secondes)
  static const Duration requestTimeout = Duration(seconds: 30);

  /// Headers par défaut
  static Map<String, String> get defaultHeaders => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Platform': 'mobile',
      };
}
