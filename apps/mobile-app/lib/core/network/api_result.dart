// NOTE: This file uses @freezed annotations. Run `build_runner` to generate
// the .g.dart companion file:
//   dart run build_runner build --delete-conflicting-outputs

import 'package:freezed_annotation/freezed_annotation.dart';

part 'api_result.g.dart';

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

/// Sealed class representing the various types of API errors.
@freezed
class ApiError with _$ApiError {
  /// A network connectivity issue (e.g. no internet).
  const factory ApiError.network(String message) = NetworkError;

  /// A server-side error (5xx) with status code and message.
  const factory ApiError.server(int code, String message) = ServerError;

  /// The request lacked valid authentication (401).
  const factory ApiError.unauthorized(String message) = UnauthorizedError;

  /// The authenticated user lacks permission (403).
  const factory ApiError.forbidden(String message) = ForbiddenError;

  /// The requested resource was not found (404).
  const factory ApiError.notFound(String message) = NotFoundError;

  /// Server-side validation errors (422) with field-level messages.
  const factory ApiError.validation(Map<String, String> errors) = ValidationError;

  /// The request timed out.
  const factory ApiError.timeout() = TimeoutError;

  /// An unexpected or unclassified error.
  const factory ApiError.unknown(String message) = UnknownError;
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
  String? get errorMessageOrNull => errorOrNull?.when<String?>(
        network: (String message) => message,
        server: (int code, String message) => 'Server error ($code): $message',
        unauthorized: (String message) => message,
        forbidden: (String message) => message,
        notFound: (String message) => message,
        validation: (Map<String, String> errors) =>
            errors.values.join('\n'),
        timeout: () => 'Request timed out. Please try again.',
        unknown: (String message) => message,
      );
}

/// Extension providing convenience helpers on [ApiError].
extension ApiErrorX on ApiError {
  /// Returns a user-friendly error message.
  String get displayMessage => when<String>(
        network: (String message) => message,
        server: (int code, String message) => 'Server error ($code): $message',
        unauthorized: (String message) => message,
        forbidden: (String message) =>
            'You do not have permission to perform this action.',
        notFound: (String message) => 'The requested resource was not found.',
        validation: (Map<String, String> errors) =>
            errors.values.join('\n'),
        timeout: () => 'Request timed out. Please try again.',
        unknown: (String message) => 'An unexpected error occurred: $message',
      );

  /// Returns `true` if this is an authentication error.
  bool get isAuthError => maybeWhen(
        unauthorized: (_) => true,
        orElse: () => false,
      );
}
