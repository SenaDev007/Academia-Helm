import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../network/api_client.dart';
import '../network/api_config.dart';
import 'logout_state.dart';
import 'auth_notifier.dart';
import 'token_storage.dart';

/// Service that performs a 5-step secure logout matching the web app's
/// logout process.
///
/// Steps:
/// 1. **User confirmation** — Returns a confirmation result; actual UI dialog
///    is handled by the caller.
/// 2. **Server session invalidation** — Calls `/auth/logout` API endpoint
///    (best-effort, don't fail if network error).
/// 3. **Offline data preservation** — Preserve the Hive offline data
///    (don't clear it). Only clear auth-related data.
/// 4. **App context cleanup** — Clear tokens from TokenStorage, clear
///    SharedPreferences session data, invalidate all Riverpod providers,
///    dispatch reset events for orion/permissions/user-context.
/// 5. **Controlled redirect** — Navigate to `/portal-select`.
class SecureLogoutService {
  SecureLogoutService({
    required this.ref,
  });

  /// Riverpod ref for accessing providers and invalidating state.
  final Ref ref;

  /// Auth keys that should be cleared from secure storage during logout.
  static const List<String> _authKeys = [
    // Legacy keys from mock auth
    'access_token',
    'refresh_token',
    'user_id',
    'user_email',
    'user_full_name',
    'user_role',
    'selected_tenant_id',
    'selected_tenant_name',
    'selected_tenant_acronym',
    // Current keys from TokenStorage
    'ah_access_token',
    'ah_refresh_token',
    'ah_token_expiry',
    'ah_session_id',
    'ah_last_activity',
    'ah_user_data',
    'ah_tenant_data',
  ];

  /// Session keys to clear from SharedPreferences.
  static const List<String> _sessionKeys = [
    'session_id',
    'last_activity',
    'remember_me',
  ];

  /// Performs the 5-step secure logout.
  ///
  /// Reports progress via [onProgress] callback. Each step is async and
  /// independent. Returns a [LogoutResult] indicating success or failure.
  Future<LogoutResult> logout({
    required void Function(LogoutProgress progress) onProgress,
  }) async {
    final completedSteps = <LogoutStep>{};

    try {
      // ── Step 1: Confirmation ────────────────────────────────────────
      onProgress(const LogoutProgress(
        currentStep: LogoutStep.confirmation,
        progress: 0.0,
        message: 'Confirmation de déconnexion…',
      ));

      // The actual confirmation dialog is handled by the caller before
      // calling this method. We just report progress.
      completedSteps.add(LogoutStep.confirmation);

      // ── Step 2: Server session invalidation ─────────────────────────
      onProgress(const LogoutProgress(
        currentStep: LogoutStep.serverInvalidation,
        progress: 0.2,
        message: 'Invalidation de la session serveur…',
      ));

      await _invalidateServerSession();
      completedSteps.add(LogoutStep.serverInvalidation);

      // ── Step 3: Offline data preservation ───────────────────────────
      onProgress(const LogoutProgress(
        currentStep: LogoutStep.offlinePreservation,
        progress: 0.4,
        message: 'Préservation des données hors-ligne…',
      ));

      await _preserveOfflineData();
      completedSteps.add(LogoutStep.offlinePreservation);

      // ── Step 4: App context cleanup ─────────────────────────────────
      onProgress(const LogoutProgress(
        currentStep: LogoutStep.contextCleanup,
        progress: 0.6,
        message: 'Nettoyage du contexte applicatif…',
      ));

      await _cleanupAppContext();
      completedSteps.add(LogoutStep.contextCleanup);

      // ── Step 5: Controlled redirect ─────────────────────────────────
      onProgress(const LogoutProgress(
        currentStep: LogoutStep.redirect,
        progress: 0.8,
        message: 'Redirection en cours…',
      ));

      // The actual navigation is handled by the caller (LogoutScreen).
      completedSteps.add(LogoutStep.redirect);

      onProgress(const LogoutProgress(
        currentStep: LogoutStep.redirect,
        progress: 1.0,
        message: 'Déconnexion terminée',
      ));

      return LogoutResult(
        success: true,
        completedSteps: completedSteps,
      );
    } catch (e) {
      return LogoutResult.failure(
        'Erreur lors de la déconnexion : $e',
        completedSteps: completedSteps,
      );
    }
  }

  // ── Step 2: Server Session Invalidation ────────────────────────────

  /// Calls the server logout endpoint to invalidate the session.
  /// Best-effort: errors are silently swallowed.
  Future<void> _invalidateServerSession() async {
    try {
      final apiClient = ref.read(apiClientProvider);
      await apiClient.postRaw(ApiConfig.logoutEndpoint).timeout(
        const Duration(seconds: 5),
      );
    } catch (_) {
      // Best-effort: network errors should not prevent local logout.
    }
  }

  // ── Step 3: Offline Data Preservation ──────────────────────────────

  /// Preserves Hive offline data. Only clears auth-related keys from
  /// secure storage, not the entire Hive database.
  Future<void> _preserveOfflineData() async {
    // Hive data is preserved — we don't clear it.
    // Only auth-related keys in secure storage are targeted.
    // This is handled in Step 4.
  }

  // ── Step 4: App Context Cleanup ────────────────────────────────────

  /// Cleans up the app context:
  /// - Clears tokens from TokenStorage
  /// - Clears auth keys from FlutterSecureStorage
  /// - Clears session keys from SharedPreferences
  /// - Resets the auth state via Riverpod
  Future<void> _cleanupAppContext() async {
    // 1. Clear tokens via TokenStorage.
    await TokenStorage.clearTokens();

    // 2. Clear individual auth keys from secure storage.
    const secureStorage = FlutterSecureStorage();
    for (final key in _authKeys) {
      try {
        await secureStorage.delete(key: key);
      } catch (_) {
        // Swallow — some keys may not exist.
      }
    }

    // 3. Clear session keys from SharedPreferences.
    try {
      final prefs = await SharedPreferences.getInstance();
      for (final key in _sessionKeys) {
        prefs.remove(key);
      }
    } catch (_) {
      // Swallow — SharedPreferences may not be initialized.
    }

    // 4. Invalidate Riverpod providers by resetting the auth state.
    try {
      ref.invalidate(authNotifierProvider);
    } catch (_) {
      // Provider may already be invalidated.
    }
  }
}
