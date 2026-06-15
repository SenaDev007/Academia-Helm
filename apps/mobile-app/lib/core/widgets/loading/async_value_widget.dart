/// ============================================================================
/// ASYNC VALUE WIDGET — Academia Hub Mobile
/// ============================================================================
///
/// Generic Riverpod AsyncValue wrapper that integrates with the loading system:
/// - Loading → ModuleSkeleton or custom loading widget
/// - Error   → ErrorStateWidget with retry button
/// - Data    → child builder
///
/// Usage:
/// ```dart
/// AsyncValueWidget<List<Student>>(
///   value: ref.watch(studentsProvider),
///   builder: (students) => StudentList(students: students),
///   loadingMessage: 'Chargement des élèves...',
/// )
/// ```
///
/// Uses AHColors: Navy (#0B2F73), Gold (#F5B335), Blue (#1D4FA5)
/// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../loading/loading_messages.dart';
import '../../theme/ah_colors.dart';
import 'inline_spinner.dart';
import 'module_loading.dart';
import 'skeleton.dart';

// ─── Async Value Widget ─────────────────────────────────────────────────────

/// Generic widget that handles Riverpod [AsyncValue] states and maps them to
/// the Academia Hub loading system.
///
/// - **Loading**: Shows [ModuleSkeleton] (or a custom [loadingWidget]).
/// - **Error**: Shows [ErrorStateWidget] with a retry button.
/// - **Data**: Invokes [builder] with the resolved data.
class AsyncValueWidget<T> extends StatelessWidget {
  /// The Riverpod async value to render.
  final AsyncValue<T> value;

  /// Builder invoked when data is available.
  final Widget Function(T data) builder;

  /// Optional custom loading widget. Falls back to [ModuleSkeleton] when null.
  final Widget? loadingWidget;

  /// Module name displayed in the default skeleton header.
  /// Ignored when [loadingWidget] is provided.
  final String moduleName;

  /// Optional message shown below the skeleton while loading.
  final String? loadingMessage;

  /// Whether to show the module header in the default skeleton.
  /// Ignored when [loadingWidget] is provided.
  final bool showHeader;

  /// Optional callback to customise the error display.
  /// When provided, replaces the default [ErrorStateWidget].
  final Widget Function(Object error, StackTrace stackTrace, VoidCallback retry)?
      errorBuilder;

  /// Optional retry callback. If null, the widget will try to invalidate
  /// the provider through the [ConsumerStatefulWidget] pattern when used
  /// inside a [Consumer].
  final VoidCallback? onRetry;

  const AsyncValueWidget({
    super.key,
    required this.value,
    required this.builder,
    this.loadingWidget,
    this.moduleName = '',
    this.loadingMessage,
    this.showHeader = true,
    this.errorBuilder,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    return value.when(
      loading: _buildLoading,
      error: _buildError,
      data: builder,
    );
  }

  // ─── Loading State ──────────────────────────────────────────────────────

  Widget _buildLoading() {
    if (loadingWidget != null) return loadingWidget!;

    return Column(
      children: [
        if (loadingMessage != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                const OrbitalSpinner(
                  size: SpinnerSize.sm,
                  color: SpinnerColor.navy,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    loadingMessage!,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: AHColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ),
        Expanded(
          child: ModuleLoading(
            moduleName: moduleName,
            showHeader: showHeader,
          ),
        ),
      ],
    );
  }

  // ─── Error State ────────────────────────────────────────────────────────

  Widget _buildError(Object error, StackTrace stackTrace) {
    if (errorBuilder != null) {
      return errorBuilder!(error, stackTrace, _retry);
    }

    return ErrorStateWidget(
      error: error,
      onRetry: onRetry ?? _defaultRetry,
    );
  }

  VoidCallback get _retry => onRetry ?? _defaultRetry;

  void _defaultRetry() {
    // No-op by default. When used inside a ConsumerWidget,
    // the parent should pass an onRetry that invalidates the provider.
  }
}

// ─── Error State Widget ──────────────────────────────────────────────────────

/// A reusable error state widget that displays an error message with an
/// optional retry button. Follows the Academia Hub design system.
class ErrorStateWidget extends StatelessWidget {
  /// The error to display.
  final Object error;

  /// Retry callback. When null, the retry button is hidden.
  final VoidCallback? onRetry;

  /// Optional title override. Defaults to [LoadingErrorMessages.genericTitle].
  final String? title;

  /// Optional subtitle override. Defaults to the error message.
  final String? subtitle;

  /// Whether this is an offline-related error.
  final bool isOffline;

  const ErrorStateWidget({
    super.key,
    required this.error,
    this.onRetry,
    this.title,
    this.subtitle,
    this.isOffline = false,
  });

  @override
  Widget build(BuildContext context) {
    final displayTitle = title ??
        (isOffline
            ? LoadingErrorMessages.offlineTitle
            : LoadingErrorMessages.genericTitle);

    final displaySubtitle = subtitle ??
        _extractErrorMessage() ??
        (isOffline
            ? LoadingErrorMessages.offlineSubtitle
            : LoadingErrorMessages.genericSubtitle);

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Error icon
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: (isOffline ? AHColors.warning : AHColors.error)
                    .withOpacity(0.1),
                border: Border.all(
                  color: (isOffline ? AHColors.warning : AHColors.error)
                      .withOpacity(0.3),
                  width: 2,
                ),
              ),
              child: Icon(
                isOffline ? Icons.cloud_off : Icons.error_outline,
                size: 36,
                color: isOffline ? AHColors.warning : AHColors.error,
              ),
            ),
            const SizedBox(height: 20),

            // Title
            Text(
              displayTitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: AHColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),

            // Subtitle
            Text(
              displaySubtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 14,
                color: AHColors.textSecondary,
              ),
            ),
            const SizedBox(height: 24),

            // Retry button
            if (onRetry != null)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh, size: 20),
                  label: const Text('Réessayer'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AHColors.navy,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  /// Attempts to extract a user-friendly message from the error object.
  String? _extractErrorMessage() {
    final errorString = error.toString();

    // Check for common error patterns
    if (errorString.contains('SocketException') ||
        errorString.contains('Connection refused')) {
      return LoadingErrorMessages.networkSubtitle;
    }
    if (errorString.contains('401') || errorString.contains('Unauthorized')) {
      return LoadingErrorMessages.authSubtitle;
    }
    if (errorString.contains('TimeoutException') ||
        errorString.contains('timed out')) {
      return LoadingErrorMessages.timeoutSubtitle;
    }

    // Return the raw message if it's reasonably short
    if (errorString.length <= 120) {
      return errorString;
    }

    return null;
  }
}

// ─── Convenience Consumer Widget ─────────────────────────────────────────────

/// A [ConsumerWidget] that automatically handles [AsyncValue] states with
/// the Academia Hub loading system. Use this when you need provider access
/// for retry (invalidation).
///
/// Usage:
/// ```dart
/// class StudentsListScreen extends ConsumerWidget {
///   @override
///   Widget build(BuildContext context, WidgetRef ref) {
///     final studentsAsync = ref.watch(studentsProvider);
///     return AsyncValueConsumerWidget(
///       value: studentsAsync,
///       builder: (students) => StudentList(students: students),
///       onRetry: () => ref.invalidate(studentsProvider),
///       moduleName: 'Élèves',
///     );
///   }
/// }
/// ```
///
/// This is essentially [AsyncValueWidget] with a guaranteed [onRetry]
/// that can invalidate a provider.
class AsyncValueConsumerWidget<T> extends ConsumerWidget {
  final AsyncValue<T> value;
  final Widget Function(T data) builder;
  final String moduleName;
  final String? loadingMessage;
  final Widget? loadingWidget;
  final bool showHeader;
  final VoidCallback onRetry;

  const AsyncValueConsumerWidget({
    super.key,
    required this.value,
    required this.builder,
    required this.onRetry,
    this.moduleName = '',
    this.loadingMessage,
    this.loadingWidget,
    this.showHeader = true,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AsyncValueWidget<T>(
      value: value,
      builder: builder,
      moduleName: moduleName,
      loadingMessage: loadingMessage,
      loadingWidget: loadingWidget,
      showHeader: showHeader,
      onRetry: onRetry,
    );
  }
}
