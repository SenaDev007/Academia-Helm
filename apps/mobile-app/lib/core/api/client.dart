/// ============================================================================
/// API CLIENT — Academia Hub Mobile
/// ============================================================================
///
/// HTTP client for communicating with the Academia Hub API.
/// Uses Dio for HTTP requests with JWT authentication.
/// ============================================================================

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  static ApiClient? _instance;
  late final Dio _dio;
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();

  static const String _baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.academiahelm.com',
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
      final token = await _secureStorage.read(key: 'auth_token');
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }

    // Add tenant header if available
    final tenantId = await _secureStorage.read(key: 'tenant_id');
    if (tenantId != null) {
      options.headers['X-Tenant-Id'] = tenantId;
    }

    handler.next(options);
  }

  Future<void> _onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    // If 401, attempt token refresh
    if (err.response?.statusCode == 401) {
      final refreshToken = await _secureStorage.read(key: 'refresh_token');
      if (refreshToken != null) {
        try {
          final response = await _dio.post('/auth/refresh', data: {
            'refreshToken': refreshToken,
          });

          final newToken = response.data['token'] as String;
          final newRefreshToken = response.data['refreshToken'] as String?;
          await _secureStorage.write(key: 'auth_token', value: newToken);
          if (newRefreshToken != null) {
            await _secureStorage.write(
                key: 'refresh_token', value: newRefreshToken);
          }

          // Retry the original request
          err.requestOptions.headers['Authorization'] = 'Bearer $newToken';
          final retryResponse = await _dio.fetch(err.requestOptions);
          handler.resolve(retryResponse);
          return;
        } catch (_) {
          // Refresh failed — clear tokens and reject
          await _secureStorage.delete(key: 'auth_token');
          await _secureStorage.delete(key: 'refresh_token');
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
