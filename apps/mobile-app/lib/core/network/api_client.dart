import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_config.dart';
import 'auth_interceptor.dart';
import 'logging_interceptor.dart';
import 'api_result.dart';

/// Riverpod provider that exposes a configured [Dio] instance.
///
/// The Dio client is pre-configured with:
/// - Base URL from [ApiConfig]
/// - Connect, receive, and send timeouts
/// - JSON content type
/// - [AuthInterceptor] for token injection and refresh
/// - [LoggingInterceptor] for debug logging
final dioProvider = Provider<Dio>((Ref ref) {
  final Dio dio = Dio(
    BaseOptions(
      baseUrl: ApiConfig.versionedBaseUrl,
      connectTimeout: ApiConfig.connectTimeout,
      receiveTimeout: ApiConfig.receiveTimeout,
      sendTimeout: ApiConfig.sendTimeout,
      headers: <String, dynamic>{
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      responseType: ResponseType.json,
      validateStatus: (int? status) {
        // Accept 2xx and 3xx; let interceptors handle 4xx/5xx.
        return status != null && status >= 200 && status < 400;
      },
    ),
  );

  dio.interceptors.addAll(<Interceptor>[
    AuthInterceptor(ref: ref),
    LoggingInterceptor(enabled: !ApiConfig.isProduction),
  ]);

  return dio;
});

/// High-level API client that wraps [Dio] and returns [ApiResult] instead
/// of throwing exceptions.
///
/// Usage:
/// ```dart
/// final ApiClient apiClient = ref.read(apiClientProvider);
/// final ApiResult<User> result = await apiClient.get<User>(
///   '/users/me',
///   fromJson: (json) => User.fromJson(json),
/// );
/// ```
final apiClientProvider = Provider<ApiClient>((Ref ref) {
  return ApiClient(ref.watch(dioProvider));
});

/// API client that translates Dio responses and errors into [ApiResult].
class ApiClient {
  ApiClient(this._dio);

  final Dio _dio;

  // ── GET ───────────────────────────────────────────────────────────────

  Future<ApiResult<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    required T Function(Map<String, dynamic>) fromJson,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return _safeCall<T>(
      () => _dio.get<dynamic>(
        path,
        queryParameters: queryParameters,
        options: options,
        cancelToken: cancelToken,
      ),
      fromJson: fromJson,
    );
  }

  // ── POST ──────────────────────────────────────────────────────────────

  Future<ApiResult<T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    required T Function(Map<String, dynamic>) fromJson,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return _safeCall<T>(
      () => _dio.post<dynamic>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
        cancelToken: cancelToken,
      ),
      fromJson: fromJson,
    );
  }

  // ── PUT ───────────────────────────────────────────────────────────────

  Future<ApiResult<T>> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    required T Function(Map<String, dynamic>) fromJson,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return _safeCall<T>(
      () => _dio.put<dynamic>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
        cancelToken: cancelToken,
      ),
      fromJson: fromJson,
    );
  }

  // ── PATCH ─────────────────────────────────────────────────────────────

  Future<ApiResult<T>> patch<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    required T Function(Map<String, dynamic>) fromJson,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return _safeCall<T>(
      () => _dio.patch<dynamic>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
        cancelToken: cancelToken,
      ),
      fromJson: fromJson,
    );
  }

  // ── DELETE ────────────────────────────────────────────────────────────

  Future<ApiResult<T>> delete<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    required T Function(Map<String, dynamic>) fromJson,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return _safeCall<T>(
      () => _dio.delete<dynamic>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
        cancelToken: cancelToken,
      ),
      fromJson: fromJson,
    );
  }

  // ── Raw GET (returns Map<String, dynamic> directly) ───────────────────

  Future<ApiResult<Map<String, dynamic>>> getRaw(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return _safeCall<Map<String, dynamic>>(
      () => _dio.get<dynamic>(
        path,
        queryParameters: queryParameters,
        options: options,
        cancelToken: cancelToken,
      ),
      fromJson: (Map<String, dynamic> json) => json,
    );
  }

  // ── Raw POST (returns Map<String, dynamic> directly) ──────────────────

  Future<ApiResult<Map<String, dynamic>>> postRaw(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) async {
    return _safeCall<Map<String, dynamic>>(
      () => _dio.post<dynamic>(
        path,
        data: data,
        queryParameters: queryParameters,
        options: options,
        cancelToken: cancelToken,
      ),
      fromJson: (Map<String, dynamic> json) => json,
    );
  }

  // ── Core Safe Call ────────────────────────────────────────────────────

  Future<ApiResult<T>> _safeCall<T>(
    Future<Response<dynamic>> Function() call, {
    required T Function(Map<String, dynamic>) fromJson,
  }) async {
    try {
      final Response<dynamic> response = await call();

      if (response.data is Map<String, dynamic>) {
        return ApiResult<T>.success(fromJson(response.data as Map<String, dynamic>));
      }

      // Some endpoints may return a list or a plain value — try to wrap.
      if (response.data is List) {
        return ApiResult<T>.success(
          fromJson({'data': response.data}),
        );
      }

      // Fallback for non-map responses.
      return ApiResult<T>.success(
        fromJson(<String, dynamic>{}),
      );
    } on DioException catch (e) {
      return ApiResult<T>.failure(_mapDioError(e));
    } catch (e) {
      return ApiResult<T>.failure(
        ApiError.unknown(e.toString()),
      );
    }
  }

  // ── Error Mapping ─────────────────────────────────────────────────────

  ApiError _mapDioError(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const ApiError.timeout();

      case DioExceptionType.connectionError:
        return ApiError.network(
          e.message ?? 'No internet connection. Please check your network.',
        );

      case DioExceptionType.badResponse:
        return _mapStatusCode(e.response);

      case DioExceptionType.cancel:
        return const ApiError.unknown('Request was cancelled.');

      case DioExceptionType.badCertificate:
        return const ApiError.network('SSL certificate verification failed.');

      case DioExceptionType.unknown:
        if (e.error is UnauthorizedException) {
          return ApiError.unauthorized((e.error as UnauthorizedException).message);
        }
        return ApiError.unknown(e.message ?? 'An unexpected error occurred.');
    }
  }

  ApiError _mapStatusCode(Response<dynamic>? response) {
    final int? statusCode = response?.statusCode;
    final String message = _extractErrorMessage(response?.data);

    if (statusCode == null) {
      return ApiError.unknown(message);
    }

    switch (statusCode) {
      case 401:
        return ApiError.unauthorized(message);
      case 403:
        return ApiError.forbidden(message);
      case 404:
        return ApiError.notFound(message);
      case 422:
        return _extractValidationErrors(response!.data);
      default:
        return ApiError.server(statusCode, message);
    }
  }

  String _extractErrorMessage(dynamic data) {
    if (data is Map<String, dynamic>) {
      return data['message'] as String? ??
          data['error'] as String? ??
          'An error occurred.';
    }
    return 'An error occurred.';
  }

  ApiError _extractValidationErrors(dynamic data) {
    if (data is Map<String, dynamic>) {
      final dynamic errors = data['errors'];
      if (errors is Map<String, dynamic>) {
        final Map<String, String> validationErrors = <String, String>{};
        errors.forEach((String key, dynamic value) {
          validationErrors[key] = value.toString();
        });
        return ApiError.validation(validationErrors);
      }
    }
    return const ApiError.validation(<String, String>{});
  }
}
