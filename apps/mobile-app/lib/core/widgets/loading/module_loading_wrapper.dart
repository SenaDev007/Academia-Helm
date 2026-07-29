/// ============================================================================
/// MODULE LOADING WRAPPER — Academia Hub Mobile
/// ============================================================================
///
/// Consistent loading pattern wrapper for ALL module screens:
/// - First load   → ModuleSkeleton (full-screen skeleton placeholder)
/// - Refresh      → Linear progress bar at top (data still visible)
/// - Error        → ErrorStateWidget with retry
/// - Offline      → Offline banner + cached data (if available)
///
/// Usage:
/// ```dart
/// class StudentsScreen extends ConsumerWidget {
///   @override
///   Widget build(BuildContext context, WidgetRef ref) {
///     final studentsAsync = ref.watch(studentsProvider);
///
///     return ModuleLoadingWrapper<List<Student>>(
///       value: studentsAsync,
///       moduleName: 'Élèves',
///       onRetry: () => ref.invalidate(studentsProvider),
///       builder: (students) => StudentList(students: students),
///     );
///   }
/// }
/// ```
///
/// Uses AHColors: Navy (#0B2F73), Gold (#F5B335), Blue (#1D4FA5)
/// ============================================================================

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../loading/loading_messages.dart';
import '../../network/connectivity_service.dart';
import '../../theme/ah_colors.dart';
import 'async_value_widget.dart';
import 'inline_spinner.dart';
import 'module_loading.dart';

// ─── Module Loading Wrapper ─────────────────────────────────────────────────

/// A wrapper that provides a consistent loading pattern for module screens.
///
/// Behaviour by state:
/// | State                     | Display                                            |
/// |---------------------------|----------------------------------------------------|
/// | First load (no prior data)| ModuleSkeleton / DashboardSkeletonMobile           |
/// | Refresh (has prior data)  | Data + LinearProgress bar at top                   |
/// | Error (no prior data)     | ErrorStateWidget                                   |
/// | Error (has cached data)   | Data + error snackbar                              |
/// | Offline (has cached data) | Data + OfflineBanner at top                        |
/// | Offline (no cached data)  | Offline error state                                |
class ModuleLoadingWrapper<T> extends ConsumerStatefulWidget {
  /// The Riverpod async value to render.
  final AsyncValue<T> value;

  /// Builder invoked when data is available.
  final Widget Function(T data) builder;

  /// Module name displayed in the skeleton header while loading.
  final String moduleName;

  /// Whether to show the module header in the skeleton.
  final bool showHeader;

  /// Retry callback — typically `() => ref.invalidate(provider)`.
  final VoidCallback onRetry;

  /// Optional custom loading widget for the first load.
  /// Falls back to [ModuleLoading] when null.
  final Widget? loadingWidget;

  /// Optional loading message shown during first load.
  final String? loadingMessage;

  /// Whether to show the offline banner when the device is offline
  /// but cached data is available. Defaults to true.
  final bool showOfflineBanner;

  const ModuleLoadingWrapper({
    super.key,
    required this.value,
    required this.builder,
    required this.moduleName,
    required this.onRetry,
    this.showHeader = true,
    this.loadingWidget,
    this.loadingMessage,
    this.showOfflineBanner = true,
  });

  @override
  ConsumerState<ModuleLoadingWrapper<T>> createState() =>
      _ModuleLoadingWrapperState<T>();
}

class _ModuleLoadingWrapperState<T>
    extends ConsumerState<ModuleLoadingWrapper<T>> {
  /// Tracks whether we have ever received data (for first-load vs refresh).
  bool _hasData = false;

  /// Holds the most recent data for display during refresh / offline.
  T? _cachedData;

  /// Subscription to connectivity changes.
  StreamSubscription<bool>? _connectivitySubscription;

  /// Current connectivity state.
  bool _isOnline = true;

  @override
  void initState() {
    super.initState();
    _initConnectivity();
  }

  @override
  void dispose() {
    _connectivitySubscription?.cancel();
    super.dispose();
  }

  Future<void> _initConnectivity() async {
    // Get initial state
    _isOnline = await ConnectivityService.instance.isConnected;

    // Listen for changes
    _connectivitySubscription =
        ConnectivityService.instance.onConnectivityChanged.listen((connected) {
      if (!mounted) return;
      setState(() => _isOnline = connected);
    });
  }

  @override
  Widget build(BuildContext context) {
    // Update cached data / hasData flag when the value changes
    widget.value.whenData((data) {
      _cachedData = data;
      if (!_hasData) {
        _hasData = true;
      }
    });

    return widget.value.when(
      loading: _buildLoading,
      error: _buildError,
      data: _buildData,
    );
  }

  // ─── Loading State ──────────────────────────────────────────────────────

  Widget _buildLoading() {
    // If we have prior data, show it with a linear progress bar at top
    if (_hasData && _cachedData != null) {
      return _buildRefreshOverlay(widget.builder(_cachedData as T));
    }

    // First load: show the full skeleton
    if (widget.loadingWidget != null) return widget.loadingWidget!;

    return Column(
      children: [
        if (widget.loadingMessage != null)
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
                    widget.loadingMessage!,
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
            moduleName: widget.moduleName,
            showHeader: widget.showHeader,
          ),
        ),
      ],
    );
  }

  // ─── Error State ────────────────────────────────────────────────────────

  Widget _buildError(Object error, StackTrace stackTrace) {
    // If we have cached data, show it with an error indicator
    if (_hasData && _cachedData != null) {
      // Show data with an error banner at top
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.error_outline, color: AHColors.error, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _extractErrorMessage(error),
                    style: const TextStyle(color: AHColors.textPrimary),
                  ),
                ),
              ],
            ),
            backgroundColor: AHColors.surface,
            action: SnackBarAction(
              label: 'Réessayer',
              textColor: AHColors.navy,
              onPressed: widget.onRetry,
            ),
            duration: const Duration(seconds: 6),
            behavior: SnackBarBehavior.floating,
          ),
        );
      });

      return _buildWithOfflineBanner(widget.builder(_cachedData as T));
    }

    // No cached data — show full error state
    return ErrorStateWidget(
      error: error,
      onRetry: widget.onRetry,
      isOffline: !_isOnline,
    );
  }

  // ─── Data State ─────────────────────────────────────────────────────────

  Widget _buildData(T data) {
    return _buildWithOfflineBanner(widget.builder(data));
  }

  // ─── Overlay Helpers ────────────────────────────────────────────────────

  /// Wraps content with a thin linear progress bar at the top for refreshes.
  Widget _buildRefreshOverlay(Widget child) {
    return Stack(
      children: [
        // Content
        Positioned.fill(
          child: _buildWithOfflineBanner(child),
        ),
        // Linear progress at the very top
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: LinearProgress(
            height: 3,
            color: SpinnerColor.navy,
          ),
        ),
      ],
    );
  }

  /// Optionally wraps content with an offline indicator banner.
  Widget _buildWithOfflineBanner(Widget child) {
    if (!widget.showOfflineBanner || _isOnline) {
      return child;
    }

    return Column(
      children: [
        // Offline banner
        _OfflineBanner(onRetry: widget.onRetry),
        // Actual content
        Expanded(child: child),
      ],
    );
  }

  /// Extracts a short user-friendly error message.
  String _extractErrorMessage(Object error) {
    final str = error.toString();
    if (str.length <= 100) return str;
    return '${str.substring(0, 97)}...';
  }
}

// ─── Offline Banner ──────────────────────────────────────────────────────────

/// A thin banner shown at the top of a module screen when the device is offline
/// but cached data is available for display.
class _OfflineBanner extends StatelessWidget {
  final VoidCallback onRetry;

  const _OfflineBanner({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: AHColors.warning.withOpacity(0.08),
        border: Border(
          bottom: BorderSide(
            color: AHColors.warning.withOpacity(0.2),
            width: 1,
          ),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.cloud_off,
            size: 18,
            color: AHColors.warning.withOpacity(0.9),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              LoadingErrorMessages.offlineSubtitle,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: AHColors.warning.withOpacity(0.9),
              ),
            ),
          ),
          TextButton(
            onPressed: onRetry,
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(
              'Réessayer',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AHColors.warning.withOpacity(0.9),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
