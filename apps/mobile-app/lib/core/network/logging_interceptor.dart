import 'dart:developer' as developer;

import 'package:dio/dio.dart';

/// Dio interceptor that logs request and response details in debug mode.
///
/// This interceptor only produces output when `kDebugMode` is true (or the
/// [enabled] flag is explicitly set). It logs request method, URL, headers,
/// body, and response status, headers, and body using `dart:developer.log`.
class LoggingInterceptor extends Interceptor {
  LoggingInterceptor({this.enabled = true});

  /// Whether logging is active. Defaults to `true`; set to `false` to
  /// silence all output (e.g. in production builds).
  final bool enabled;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (!enabled) {
      handler.next(options);
      return;
    }

    developer.log(
      '┌──── HTTP REQUEST ────────────────────────────────────────────',
      name: 'API',
    );
    developer.log(
      '│ ${options.method} ${options.uri}',
      name: 'API',
    );
    developer.log(
      '│ Headers: ${_formatHeaders(options.headers)}',
      name: 'API',
    );

    if (options.data != null) {
      developer.log(
        '│ Body: ${_truncate(options.data.toString(), 500)}',
        name: 'API',
      );
    }

    if (options.queryParameters.isNotEmpty) {
      developer.log(
        '│ Query: ${options.queryParameters}',
        name: 'API',
      );
    }

    developer.log(
      '└──────────────────────────────────────────────────────────────',
      name: 'API',
    );

    handler.next(options);
  }

  @override
  void onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) {
    if (!enabled) {
      handler.next(response);
      return;
    }

    developer.log(
      '┌──── HTTP RESPONSE ───────────────────────────────────────────',
      name: 'API',
    );
    developer.log(
      '│ ${response.statusCode} ${response.requestOptions.method} ${response.requestOptions.uri}',
      name: 'API',
    );
    developer.log(
      '│ Headers: ${_formatHeaders(response.headers.map)}',
      name: 'API',
    );

    if (response.data != null) {
      developer.log(
        '│ Body: ${_truncate(response.data.toString(), 800)}',
        name: 'API',
      );
    }

    developer.log(
      '└──────────────────────────────────────────────────────────────',
      name: 'API',
    );

    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (!enabled) {
      handler.next(err);
      return;
    }

    developer.log(
      '┌──── HTTP ERROR ──────────────────────────────────────────────',
      name: 'API',
      error: err.error,
    );
    developer.log(
      '│ ${err.type} ${err.requestOptions.method} ${err.requestOptions.uri}',
      name: 'API',
    );

    if (err.response != null) {
      developer.log(
        '│ Status: ${err.response?.statusCode}',
        name: 'API',
      );
      developer.log(
        '│ Body: ${_truncate(err.response?.data?.toString() ?? 'N/A', 500)}',
        name: 'API',
      );
    } else {
      developer.log(
        '│ Message: ${err.message}',
        name: 'API',
      );
    }

    developer.log(
      '└──────────────────────────────────────────────────────────────',
      name: 'API',
    );

    handler.next(err);
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  String _formatHeaders(Map<String, dynamic> headers) {
    final List<String> entries = <String>[];
    headers.forEach((String key, dynamic value) {
      // Mask sensitive headers.
      if (key.toLowerCase() == 'authorization') {
        entries.add('$key: [REDACTED]');
      } else {
        entries.add('$key: $value');
      }
    });
    return entries.join(', ');
  }

  String _truncate(String text, int maxLength) {
    if (text.length <= maxLength) return text;
    return '${text.substring(0, maxLength)}... [truncated]';
  }
}
