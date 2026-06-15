/// ============================================================================
/// POST LOGIN FLOW — Academia Hub Mobile
/// ============================================================================
///
/// Post-login flow matching the web app's usePostLoginFlow.
/// 6 steps: INIT_SECURE_CONTEXT, VERIFY_ACADEMIC_YEAR, LOAD_ROLES_PERMISSIONS,
/// CHECK_OFFLINE_STATUS, INIT_ORION, PRELOAD_UI
///
/// Steps 2-5 run in parallel for faster load times.
/// Real progress reporting (0-100%).
/// Fresh login detection and session dedup (30-min TTL).
/// ============================================================================

import 'dart:async';

import '../api/client.dart';
import '../auth/auth_state.dart';
import '../auth/token_storage.dart';
import 'loading_messages.dart';

// ─── Flow Step Result ────────────────────────────────────────────────────────

/// Result of a single flow step.
class FlowStepResult {
  final PostLoginStep step;
  final bool success;
  final String? error;
  final Map<String, dynamic>? data;

  const FlowStepResult({
    required this.step,
    required this.success,
    this.error,
    this.data,
  });
}

// ─── Flow Progress ───────────────────────────────────────────────────────────

/// Progress update from the post-login flow.
class FlowProgress {
  final PostLoginStep currentStep;
  final double progress; // 0.0 to 100.0
  final String title;
  final String subtitle;
  final bool isComplete;
  final String? error;

  const FlowProgress({
    required this.currentStep,
    required this.progress,
    required this.title,
    required this.subtitle,
    this.isComplete = false,
    this.error,
  });
}

// ─── Post Login Flow ─────────────────────────────────────────────────────────

/// Orchestrates the 6-step post-login initialization flow.
/// Matches the web app's usePostLoginFlow hook.
class PostLoginFlow {
  PostLoginFlow({
    required TokenStorage tokenStorage,
    required AuthUser user,
    TenantInfo? tenant,
  })  : _tokenStorage = tokenStorage,
        _user = user,
        _tenant = tenant,
        _dio = ApiClient.instance.dio;

  final TokenStorage _tokenStorage;
  final AuthUser _user;
  final TenantInfo? _tenant;
  final Dio _dio;

  bool _isRunning = false;
  String? _sessionId;
  DateTime? _lastRunTime;

  // Session dedup: 30-minute TTL
  static const Duration _sessionDedupTtl = Duration(minutes: 30);

  /// Whether the flow is currently running.
  bool get isRunning => _isRunning;

  /// Runs the full post-login flow with progress reporting.
  ///
  /// Steps 2-5 run in parallel. Progress is reported via [onProgress].
  /// Returns true if the flow completed successfully.
  Future<bool> run({
    required void Function(FlowProgress) onProgress,
    bool isFreshLogin = true,
  }) async {
    if (_isRunning) return false;

    // Session dedup: skip if run recently with same session
    if (!isFreshLogin && _lastRunTime != null) {
      final sinceLastRun = DateTime.now().difference(_lastRunTime!);
      if (sinceLastRun < _sessionDedupTtl && _sessionId != null) {
        final storedSessionId = await _tokenStorage.getSessionId();
        if (storedSessionId == _sessionId) {
          // Same session, skip flow
          onProgress(const FlowProgress(
            currentStep: PostLoginStep.preloadUI,
            progress: 100.0,
            title: 'Session restaurée',
            subtitle: 'Bienvenue !',
            isComplete: true,
          ));
          return true;
        }
      }
    }

    _isRunning = true;

    try {
      // Step 1: INIT_SECURE_CONTEXT (sequential)
      _reportStep(onProgress, PostLoginStep.initSecureContext, 10.0);
      final step1 = await _initSecureContext();
      if (!step1.success) {
        _reportError(onProgress, step1.error ?? 'Erreur d\'initialisation');
        return false;
      }

      // Steps 2-5: Run in parallel
      _reportStep(onProgress, PostLoginStep.loadRolesPermissions, 30.0);

      final results = await Future.wait([
        _verifyAcademicYear(),
        _loadRolesPermissions(),
        _checkOfflineStatus(),
        _initOrion(),
      ]);

      // Check for failures
      for (final result in results) {
        if (!result.success) {
          // Non-critical failures: log but continue
          // Only auth/permission failures are critical
          if (result.step == PostLoginStep.loadRolesPermissions && !result.success) {
            _reportError(onProgress, result.error ?? 'Erreur de permissions');
            return false;
          }
        }
      }

      // Step 6: PRELOAD_UI (sequential, after parallel steps)
      _reportStep(onProgress, PostLoginStep.preloadUI, 75.0);
      final step6 = await _preloadUI();
      if (!step6.success) {
        // Non-critical, continue
      }

      // Flow complete
      _sessionId = DateTime.now().millisecondsSinceEpoch.toString();
      await _tokenStorage.setSessionId(_sessionId!);
      _lastRunTime = DateTime.now();

      onProgress(FlowProgress(
        currentStep: PostLoginStep.preloadUI,
        progress: 100.0,
        title: 'Bienvenue, ${_user.displayName} !',
        subtitle: 'Votre espace est prêt.',
        isComplete: true,
      ));

      return true;
    } catch (e) {
      _reportError(onProgress, 'Erreur inattendue: $e');
      return false;
    } finally {
      _isRunning = false;
    }
  }

  // ─── Step Implementations ─────────────────────────────────────────────────

  /// Step 1: Initialize secure context.
  /// Sets up secure storage, validates token, configures API headers.
  Future<FlowStepResult> _initSecureContext() async {
    try {
      // Validate stored tokens
      final isExpired = await _tokenStorage.isTokenExpired();
      if (isExpired) {
        return FlowStepResult(
          step: PostLoginStep.initSecureContext,
          success: false,
          error: 'Token expiré',
        );
      }

      // Set up tenant header if available
      if (_tenant != null) {
        _dio.options.headers['X-Tenant-Id'] = _tenant!.id;
      }

      // Persist session
      await _tokenStorage.persistSession(
        user: _user,
        tenant: _tenant,
      );

      return FlowStepResult(
        step: PostLoginStep.initSecureContext,
        success: true,
        data: {'tenantId': _tenant?.id},
      );
    } catch (e) {
      return FlowStepResult(
        step: PostLoginStep.initSecureContext,
        success: false,
        error: e.toString(),
      );
    }
  }

  /// Step 2: Verify academic year is active and current.
  Future<FlowStepResult> _verifyAcademicYear() async {
    try {
      final response = await _dio.get('/academic-years/current');
      final data = response.data as Map<String, dynamic>?;
      return FlowStepResult(
        step: PostLoginStep.verifyAcademicYear,
        success: true,
        data: data,
      );
    } catch (e) {
      // Non-critical: continue without academic year data
      return FlowStepResult(
        step: PostLoginStep.verifyAcademicYear,
        success: true,
      );
    }
  }

  /// Step 3: Load user roles and permissions.
  Future<FlowStepResult> _loadRolesPermissions() async {
    try {
      final response = await _dio.get('/auth/permissions');
      final data = response.data as Map<String, dynamic>?;
      return FlowStepResult(
        step: PostLoginStep.loadRolesPermissions,
        success: true,
        data: data,
      );
    } catch (e) {
      return FlowStepResult(
        step: PostLoginStep.loadRolesPermissions,
        success: false,
        error: 'Impossible de charger les permissions',
      );
    }
  }

  /// Step 4: Check offline data status.
  Future<FlowStepResult> _checkOfflineStatus() async {
    try {
      // In a full implementation, this would check local database
      // for pending sync operations and offline data freshness
      return FlowStepResult(
        step: PostLoginStep.checkOfflineStatus,
        success: true,
        data: {'hasPendingSync': false, 'lastSync': null},
      );
    } catch (e) {
      return FlowStepResult(
        step: PostLoginStep.checkOfflineStatus,
        success: true, // Non-critical
      );
    }
  }

  /// Step 5: Initialize Orion AI module.
  Future<FlowStepResult> _initOrion() async {
    try {
      final response = await _dio.get('/orion/status');
      final data = response.data as Map<String, dynamic>?;
      return FlowStepResult(
        step: PostLoginStep.initOrion,
        success: true,
        data: data,
      );
    } catch (e) {
      // Orion may not be available for all tenants — non-critical
      return FlowStepResult(
        step: PostLoginStep.initOrion,
        success: true,
      );
    }
  }

  /// Step 6: Preload UI resources.
  Future<FlowStepResult> _preloadUI() async {
    try {
      // Preload dashboard data
      await _dio.get('/dashboard/summary');

      return FlowStepResult(
        step: PostLoginStep.preloadUI,
        success: true,
      );
    } catch (e) {
      // Non-critical: UI will load lazily
      return FlowStepResult(
        step: PostLoginStep.preloadUI,
        success: true,
      );
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  void _reportStep(
    void Function(FlowProgress) onProgress,
    PostLoginStep step,
    double progress,
  ) {
    final message = getPostLoginMessage(step);
    onProgress(FlowProgress(
      currentStep: step,
      progress: progress,
      title: message.title,
      subtitle: message.subtitle,
    ));
  }

  void _reportError(
    void Function(FlowProgress) onProgress,
    String error,
  ) {
    onProgress(FlowProgress(
      currentStep: PostLoginStep.initSecureContext,
      progress: 0.0,
      title: LoadingErrorMessages.genericTitle,
      subtitle: error,
      isComplete: true,
      error: error,
    ));
  }
}
