// NOTE: This file uses @freezed annotations for ApiResult.
// Run `build_runner` to generate the companion files:
//   dart run build_runner build --delete-conflicting-outputs

import 'package:dio/dio.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part 'api_result.freezed.dart';

// ─── ApiErrorType ────────────────────────────────────────────────────────────

/// Enum representing the category of an API error.
///
/// Used by [ApiError] to classify the error for conditional handling
/// (e.g. offline fallback, auth redirect, etc.).
enum ApiErrorType {
  /// A network connectivity issue (e.g. no internet).
  network,

  /// A server-side error (5xx).
  server,

  /// The request lacked valid authentication (401).
  unauthorized,

  /// The authenticated user lacks permission (403).
  forbidden,

  /// The requested resource was not found (404).
  notFound,

  /// Server-side validation errors (422).
  validation,

  /// The request timed out.
  timeout,

  /// An unexpected or unclassified error.
  unknown,

  /// The request was cancelled.
  cancelled,
}

// ─── ApiError ────────────────────────────────────────────────────────────────

/// Represents an API error with a human-readable [message], a categorical
/// [type], and an optional [isOffline] flag.
///
/// This is a plain class (not freezed) so that callers can construct errors
/// with named parameters and use the [fromDioException] factory.
class ApiError {
  /// A human-readable description of the error.
  final String message;

  /// The category of the error.
  final ApiErrorType type;

  /// Whether the error is due to being offline.
  final bool isOffline;

  /// Optional HTTP status code (for server errors).
  final int? statusCode;

  /// Optional field-level validation errors.
  final Map<String, String>? fieldErrors;

  const ApiError({
    required this.message,
    this.type = ApiErrorType.unknown,
    this.isOffline = false,
    this.statusCode,
    this.fieldErrors,
  });

  /// Factory that converts a [DioException] (or any [Exception]) into an
  /// [ApiError] with the appropriate [type].
  ///
  /// Handles all standard DioException types and falls back to
  /// [ApiErrorType.unknown] for unrecognized exceptions.
  factory ApiError.fromDioException(Object error) {
    if (error is DioException) {
      switch (error.type) {
        case DioExceptionType.connectionError:
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
          return ApiError(
            message: error.message ?? 'Erreur de connexion réseau',
            type: ApiErrorType.network,
            isOffline: true,
          );

        case DioExceptionType.badResponse:
          final int? statusCode = error.response?.statusCode;
          final String serverMessage =
              _extractServerMessage(error.response?.data) ??
                  'Erreur serveur';

          if (statusCode == 401) {
            return ApiError(
              message: serverMessage,
              type: ApiErrorType.unauthorized,
              statusCode: statusCode,
            );
          }
          if (statusCode == 403) {
            return ApiError(
              message: serverMessage,
              type: ApiErrorType.forbidden,
              statusCode: statusCode,
            );
          }
          if (statusCode == 404) {
            return ApiError(
              message: serverMessage,
              type: ApiErrorType.notFound,
              statusCode: statusCode,
            );
          }
          if (statusCode == 422) {
            final Map<String, String> fieldErrors =
                _extractFieldErrors(error.response?.data);
            return ApiError(
              message: serverMessage,
              type: ApiErrorType.validation,
              statusCode: statusCode,
              fieldErrors: fieldErrors.isNotEmpty ? fieldErrors : null,
            );
          }
          if (statusCode != null && statusCode >= 500) {
            return ApiError(
              message: serverMessage,
              type: ApiErrorType.server,
              statusCode: statusCode,
            );
          }
          return ApiError(
            message: serverMessage,
            type: ApiErrorType.unknown,
            statusCode: statusCode,
          );

        case DioExceptionType.cancel:
          return const ApiError(
            message: 'Requête annulée',
            type: ApiErrorType.cancelled,
          );

        case DioExceptionType.badCertificate:
          return const ApiError(
            message: 'Certificat SSL invalide',
            type: ApiErrorType.network,
          );

        case DioExceptionType.unknown:
          // Check if the underlying error is a SocketException (offline)
          final String errorString = error.toString().toLowerCase();
          if (errorString.contains('socket') ||
              errorString.contains('connection refused') ||
              errorString.contains('network')) {
            return ApiError(
              message: error.message ?? 'Erreur de connexion réseau',
              type: ApiErrorType.network,
              isOffline: true,
            );
          }
          return ApiError(
            message: error.message ?? 'Erreur inconnue',
            type: ApiErrorType.unknown,
          );
      }
    }

    // Non-Dio exceptions
    return ApiError(
      message: error.toString(),
      type: ApiErrorType.unknown,
    );
  }

  /// A user-friendly display message.
  String get displayMessage {
    switch (type) {
      case ApiErrorType.network:
        return message;
      case ApiErrorType.server:
        return statusCode != null
            ? 'Erreur serveur ($statusCode) : $message'
            : 'Erreur serveur : $message';
      case ApiErrorType.unauthorized:
        return message;
      case ApiErrorType.forbidden:
        return 'Vous n\'avez pas la permission d\'effectuer cette action.';
      case ApiErrorType.notFound:
        return 'La ressource demandée est introuvable.';
      case ApiErrorType.validation:
        if (fieldErrors != null && fieldErrors!.isNotEmpty) {
          return fieldErrors!.values.join('\n');
        }
        return message;
      case ApiErrorType.timeout:
        return 'Délai d\'attente dépassé. Veuillez réessayer.';
      case ApiErrorType.cancelled:
        return 'Requête annulée.';
      case ApiErrorType.unknown:
        return 'Une erreur inattendue est survenue : $message';
    }
  }

  /// Returns `true` if this is an authentication error (401).
  bool get isAuthError => type == ApiErrorType.unauthorized;

  @override
  String toString() => 'ApiError($type, $message, isOffline: $isOffline)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ApiError &&
          runtimeType == other.runtimeType &&
          message == other.message &&
          type == other.type &&
          isOffline == other.isOffline &&
          statusCode == other.statusCode;

  @override
  int get hashCode =>
      message.hashCode ^
      type.hashCode ^
      isOffline.hashCode ^
      statusCode.hashCode;

  // ─── Private helpers for response parsing ───────────────────────────────

  /// Extracts a human-readable message from a Dio response body.
  static String? _extractServerMessage(dynamic data) {
    if (data is Map<String, dynamic>) {
      return data['message'] as String? ??
          data['error'] as String? ??
          data['msg'] as String?;
    }
    if (data is String) return data;
    return null;
  }

  /// Extracts field-level validation errors from a 422 response body.
  static Map<String, String> _extractFieldErrors(dynamic data) {
    if (data is Map<String, dynamic>) {
      final dynamic errors = data['errors'];
      if (errors is Map) {
        return errors.map((key, value) {
          if (value is List && value.isNotEmpty) {
            return MapEntry(key.toString(), value.first.toString());
          }
          return MapEntry(key.toString(), value.toString());
        });
      }
    }
    return {};
  }
}

// ─── ApiResult (freezed sealed class) ────────────────────────────────────────

/// Sealed class representing the result of an API call.
///
/// Every API response is wrapped in one of three states:
/// - [ApiSuccess] — the request completed successfully and contains data.
/// - [ApiFailure] — the request failed and contains an [ApiError].
/// - [ApiLoading] — the request is in progress (useful for UI state).
@freezed
sealed class ApiResult<T> with _$ApiResult<T> {
  const factory ApiResult.success(T data) = ApiSuccess;
  const factory ApiResult.failure(ApiError error) = ApiFailure;
  const factory ApiResult.loading() = ApiLoading;
}

/// Extension providing convenience helpers on [ApiResult].
extension ApiResultX<T> on ApiResult<T> {
  /// Returns `true` when the result is [ApiSuccess].
  bool get isSuccess => this is ApiSuccess<T>;

  /// Returns `true` when the result is [ApiFailure].
  bool get isFailure => this is ApiFailure<T>;

  /// Returns `true` when the result is [ApiLoading].
  bool get isLoading => this is ApiLoading<T>;

  /// Returns the data if [ApiSuccess], otherwise `null`.
  T? get dataOrNull => when<T?>(
        success: (T data) => data,
        failure: (_) => null,
        loading: () => null,
      );

  /// Returns the error if [ApiFailure], otherwise `null`.
  ApiError? get errorOrNull => when<ApiError?>(
        success: (_) => null,
        failure: (ApiError error) => error,
        loading: () => null,
      );

  /// Returns a human-readable error message if [ApiFailure], otherwise `null`.
  String? get errorMessageOrNull => errorOrNull?.displayMessage;
}
