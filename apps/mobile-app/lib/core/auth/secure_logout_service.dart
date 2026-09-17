import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../network/api_client.dart';
import '../network/api_config.dart';
import '../offline/offline_service.dart';
import '../sync/sync_delta_service.dart';
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
/// 3. **Offline data isolation** — ⭐ FIX Task 74 : purge the Hive offline
///    data (tenant isolation — nothing from this school stays on the device).
/// 4. **App context cleanup** — Clear tokens from TokenStorage, clear
///    SharedPreferences session data, invalidate all Riverpod providers,
///    dispatch reset events for orion/permissions/user-context.
/// 5. **Controlled redirect** — Navigate to `/portal-select`.
class SecureLogoutService {
  SecureLogoutService({
    required dynamic ref,
  }) : _ref = ref;

  /// Riverpod ref for accessing providers and invalidating state.
  /// Accepts either a `Ref` (from a Provider) or a `WidgetRef` (from a widget).
  final dynamic _ref;

  /// Forwards to `Ref.read`/`WidgetRef.read` polymorphically.
  T read<T>(ProviderListenable<T> provider) => (_ref as dynamic).read(provider) as T;
  T watch<T>(ProviderListenable<T> provider) => (_ref as dynamic).watch(provider) as T;
  void invalidate(ProviderOrFamily provider) =>
      (_ref as dynamic).invalidate(provider);

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

      // ── Step 3: Offline data isolation (purge inter-tenants) ──────
      onProgress(const LogoutProgress(
        currentStep: LogoutStep.offlinePreservation,
        progress: 0.4,
        message: 'Effacement des données locales de l\u2019école…',
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
      final apiClient = read(apiClientProvider);
      await apiClient.postRaw(ApiConfig.logoutEndpoint).timeout(
        const Duration(seconds: 5),
      );
    } catch (_) {
      // Best-effort: network errors should not prevent local logout.
    }
  }

  // ── Step 3: Offline Data Isolation ─────────────────────────────────

  /// ⭐ FIX Task 74 (isolation tenant) : PURGE des données locales au lieu
  ///    de les « préserver ». Le cache Hive contient les données de l'école
  ///    connectée (élèves, finances, notes…) sans contrôle d'accès local :
  ///    le conserver après déconnexion l'expose au prochain utilisateur du
  ///    même appareil. La sync descendante refait un téléchargement complet
  ///    à la reconnexion (last_sync_at purgé) — le confort est préservé.
  Future<void> _preserveOfflineData() async {
    try {
      // Arrêter le worker de sync descendante avant la purge.
      SyncDeltaService.instance.stop();
    } catch (_) {
      // Non critique
    }
    try {
      await OfflineService.instance.clearAllLocalData();
    } catch (_) {
      // Non critique — la purge est best-effort, le logout doit continuer.
    }
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
      invalidate(authNotifierProvider);
    } catch (_) {
      // Provider may already be invalidated.
    }
  }
}
