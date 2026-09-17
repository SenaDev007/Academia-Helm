/// ============================================================================
/// API CLIENT — Academia Hub Mobile
/// ============================================================================
///
/// HTTP client for communicating with the Academia Hub API.
/// Uses Dio for HTTP requests with JWT authentication.
/// ============================================================================

import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  static ApiClient? _instance;
  late final Dio _dio;
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();

  /// ⭐ FIX Task 74 : base par défaut = BFF `https://academiahelm.com/api`
  ///    (même base que core/network/api_client.dart — le backend NestJS expose
  ///    des routes plates sous /api, AUCUNE route /v1 ni racine sans préfixe).
  ///    Avant : `https://api.academiahelm.com` (sans /api) → toutes les
  ///    requêtes de ConfigService (bootstrap, features, permissions)
  ///    échouaient en 404.
  static const String _baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://academiahelm.com/api',
  );

  ApiClient._() {
    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    // Add auth interceptor
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: _onRequest,
      onError: _onError,
    ));
  }

  /// Singleton instance.
  static ApiClient get instance => _instance ??= ApiClient._();

  /// Expose the Dio instance for direct use if needed.
  Dio get dio => _dio;

  // ─── Auth Interceptor ───────────────────────────────────────────────────

  Future<void> _onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Skip auth header for login/refresh endpoints
    final skipAuth = options.path.contains('/auth/login') ||
        options.path.contains('/auth/refresh') ||
        options.path.contains('/auth/forgot-password');

    if (!skipAuth) {
      // ⭐ FIX Task 74 : clé 'ah_access_token' (TokenStorage — écrite au login).
      //    Avant : 'auth_token' (clé jamais écrite) → requêtes non authentifiées.
      final token = await _secureStorage.read(key: 'ah_access_token') ??
          await _secureStorage.read(key: 'auth_token');
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }

    // Add tenant header if available
    // ⭐ FIX Task 74 : résolution du tenant depuis 'ah_tenant_data'
    //    (persisté par TokenStorage.persistSession) avec fallbacks —
    //    garantit que les requêtes partent POUR l'école connectée.
    final tenantId = await _resolveTenantId();
    if (tenantId != null) {
      options.headers['X-Tenant-Id'] = tenantId;
    }

    handler.next(options);
  }

  /// Résout le tenant connecté.
  /// Sources : 'ah_tenant_data' (TokenStorage) → 'tenant_id' → 'ah_selected_tenant_id'.
  Future<String?> _resolveTenantId() async {
    final tenantJson = await _secureStorage.read(key: 'ah_tenant_data');
    if (tenantJson != null && tenantJson.isNotEmpty) {
      try {
        final tenant = jsonDecode(tenantJson);
        if (tenant is Map<String, dynamic>) {
          final id = tenant['id'];
          if (id is String && id.isNotEmpty) return id;
        }
      } catch (_) {}
    }
    final legacy = await _secureStorage.read(key: 'tenant_id');
    if (legacy != null && legacy.isNotEmpty) return legacy;
    final selected =
        await _secureStorage.read(key: 'ah_selected_tenant_id');
    if (selected != null && selected.isNotEmpty) return selected;
    return null;
  }

  Future<void> _onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    // If 401, attempt token refresh
    if (err.response?.statusCode == 401) {
      // ⭐ FIX Task 74 : refresh token lu depuis 'ah_refresh_token' (TokenStorage)
      final refreshToken =
          await _secureStorage.read(key: 'ah_refresh_token') ??
              await _secureStorage.read(key: 'refresh_token');
      if (refreshToken != null) {
        try {
          final response = await _dio.post('/auth/refresh', data: {
            'refreshToken': refreshToken,
          });

          final rawData = response.data;
          final Map<String, dynamic> refreshData = rawData is Map<String, dynamic>
              ? rawData
              : const <String, dynamic>{};
          final newToken = (refreshData['accessToken'] ??
              refreshData['token']) as String?;
          if (newToken == null || newToken.isEmpty) {
            throw Exception('Réponse refresh sans token');
          }
          final newRefreshToken =
              refreshData['refreshToken'] as String? ?? refreshToken;
          // ⭐ Écrire dans les clés canoniques TokenStorage
          await _secureStorage.write(key: 'ah_access_token', value: newToken);
          await _secureStorage.write(
              key: 'ah_refresh_token', value: newRefreshToken);

          // Retry the original request
          err.requestOptions.headers['Authorization'] = 'Bearer $newToken';
          final retryResponse = await _dio.fetch(err.requestOptions);
          handler.resolve(retryResponse);
          return;
        } catch (_) {
          // Refresh failed — reject (les clés canoniques restent intactes :
          // c'est AuthInterceptor qui gère le logout global)
        }
      }
    }

    handler.next(err);
  }

  // ─── Convenience Methods ────────────────────────────────────────────────

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) =>
      _dio.get<T>(path, queryParameters: queryParameters, options: options);

  Future<Response<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) =>
      _dio.post<T>(path,
          data: data, queryParameters: queryParameters, options: options);

  Future<Response<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) =>
      _dio.put<T>(path,
          data: data, queryParameters: queryParameters, options: options);

  Future<Response<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) =>
      _dio.delete<T>(path,
          data: data, queryParameters: queryParameters, options: options);
}
