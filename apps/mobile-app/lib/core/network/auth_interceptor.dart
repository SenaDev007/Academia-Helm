import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../academic_year/academic_year_provider.dart';
import '../academic_year/school_level_provider.dart';
import '../auth/token_storage.dart';
import '../tenant/tenant_notifier.dart';
import 'api_config.dart';

/// Dio interceptor that injects authentication headers and handles token
/// refresh on 401 responses.
///
/// Responsibilities:
/// - Injects `Authorization: Bearer <accessToken>` on every request.
/// - Injects `X-Tenant-Id` header when a tenant is selected.
/// - Injects `x-academic-year-id` header when an academic year is selected.
/// - Injects `x-school-level-id` header when a school level is selected.
/// - On 401: attempts to refresh the access token, then retries the
///   original request.
/// - On 401 after refresh failure: redirects to login by throwing
///   [UnauthorizedException].
class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required this.ref,
  });

  final Ref ref;

  /// Guard to prevent concurrent refresh requests.
  bool _isRefreshing = false;

  /// Queue of requests waiting for a token refresh.
  final List<_RetryRequest> _requestQueue = [];

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Inject Bearer token.
    final String? accessToken = await TokenStorage.getAccessToken();
    if (accessToken != null && accessToken.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $accessToken';
    }

    // Inject X-Tenant-Id header when a tenant is selected.
    try {
      final TenantState tenantState = ref.read(tenantNotifierProvider);
      tenantState.when(
        initial: () {},
        loading: () {},
        selected: (Tenant tenant) {
          options.headers['X-Tenant-Id'] = tenant.id;
        },
      );
    } catch (_) {
      // Provider may not be initialized yet; silently continue.
    }

    // Inject x-academic-year-id header when an academic year is selected.
    try {
      final currentYear = ref.read(currentAcademicYearProvider);
      if (currentYear != null) {
        options.headers['x-academic-year-id'] = currentYear.id;
      }
    } catch (_) {
      // Provider may not be initialized yet; silently continue.
    }

    // Inject x-school-level-id header when a school level is selected.
    try {
      final currentLevel = ref.read(currentSchoolLevelProvider);
      if (currentLevel != null) {
        options.headers['x-school-level-id'] = currentLevel.id;
      }
    } catch (_) {
      // Provider may not be initialized yet; silently continue.
    }

    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode != 401) {
      handler.next(err);
      return;
    }

    // If the failed request is the refresh endpoint itself, don't retry.
    if (err.requestOptions.path == ApiConfig.refreshTokenEndpoint) {
      await _forceLogout(handler, err);
      return;
    }

    // Queue the request while refreshing.
    if (_isRefreshing) {
      _requestQueue.add(_RetryRequest(err.requestOptions, handler));
      return;
    }

    _isRefreshing = true;

    try {
      final bool refreshed = await _attemptRefresh();
      _isRefreshing = false;

      if (refreshed) {
        // Retry the original request.
        await _retryRequest(err.requestOptions, handler);
        // Retry queued requests.
        await _processQueue();
      } else {
        await _forceLogout(handler, err);
        _failQueue();
      }
    } catch (_) {
      _isRefreshing = false;
      await _forceLogout(handler, err);
      _failQueue();
    }
  }

  /// Attempts to refresh the access token using the stored refresh token.
  ///
  /// Returns `true` on success, `false` on failure.
  Future<bool> _attemptRefresh() async {
    final String? refreshToken = await TokenStorage.getRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      return false;
    }

    try {
      final Dio refreshDio = Dio(BaseOptions(
        baseUrl: ApiConfig.baseUrl,
        connectTimeout: ApiConfig.connectTimeout,
        receiveTimeout: ApiConfig.receiveTimeout,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ));

      final Response<Map<String, dynamic>> response =
          await refreshDio.post<Map<String, dynamic>>(
        ApiConfig.refreshTokenEndpoint,
        data: {'refreshToken': refreshToken},
      );

      final Map<String, dynamic> data = response.data!;
      final String newAccessToken = data['accessToken'] as String;
      final String newRefreshToken = data['refreshToken'] as String? ??
          refreshToken; // keep old if not returned

      await TokenStorage.saveTokens(
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      );

      return true;
    } catch (_) {
      return false;
    }
  }

  /// Retries a single request with the new access token.
  Future<void> _retryRequest(
    RequestOptions options,
    ErrorInterceptorHandler handler,
  ) async {
    final String? newToken = await TokenStorage.getAccessToken();

    final RequestOptions newOptions = RequestOptions(
      method: options.method,
      baseUrl: options.baseUrl,
      path: options.path,
      queryParameters: options.queryParameters,
      data: options.data,
      extra: options.extra,
      headers: {
        ...options.headers,
        if (newToken != null) 'Authorization': 'Bearer $newToken',
      },
      responseType: options.responseType,
      contentType: options.contentType,
      validateStatus: options.validateStatus,
      receiveTimeout: options.receiveTimeout,
      sendTimeout: options.sendTimeout,
    );

    try {
      final Dio dio = Dio(BaseOptions(baseUrl: options.baseUrl));
      final Response<dynamic> response = await dio.fetch(newOptions);
      handler.resolve(response);
    } on DioException catch (e) {
      handler.next(e);
    }
  }

  /// Processes queued requests after a successful refresh.
  Future<void> _processQueue() async {
    final List<_RetryRequest> queue = List.of(_requestQueue);
    _requestQueue.clear();

    for (final _RetryRequest retry in queue) {
      await _retryRequest(retry.options, retry.handler);
    }
  }

  /// Fails all queued requests after a refresh failure.
  void _failQueue() {
    for (final _RetryRequest retry in _requestQueue) {
      retry.handler.next(
        DioException(
          requestOptions: retry.options,
          error: 'Session expired. Please log in again.',
          type: DioExceptionType.unknown,
        ),
      );
    }
    _requestQueue.clear();
  }

  /// Clears tokens and propagates an [UnauthorizedException] so that the
  /// presentation layer can redirect to the login screen.
  Future<void> _forceLogout(
    ErrorInterceptorHandler handler,
    DioException originalError,
  ) async {
    await TokenStorage.clearTokens();
    handler.next(
      DioException(
        requestOptions: originalError.requestOptions,
        error: const UnauthorizedException('Session expired. Please log in again.'),
        type: DioExceptionType.unknown,
        response: originalError.response,
      ),
    );
  }
}

/// Exception thrown when the user is no longer authenticated and must
/// re-login.
class UnauthorizedException implements Exception {
  const UnauthorizedException(this.message);
  final String message;

  @override
  String toString() => 'UnauthorizedException: $message';
}

/// Private helper to store a request waiting for token refresh.
class _RetryRequest {
  _RetryRequest(this.options, this.handler);
  final RequestOptions options;
  final ErrorInterceptorHandler handler;
}
