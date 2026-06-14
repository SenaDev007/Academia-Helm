import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';
import '../network/api_config.dart';
import '../network/api_result.dart';
import 'auth_state.dart';
import 'token_storage.dart';

/// Riverpod provider for the [AuthNotifier].
final authNotifierProvider =
    AsyncNotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);

/// Riverpod [AsyncNotifier] that manages the authentication lifecycle.
///
/// Responsibilities:
/// - Login (email + password)
/// - Logout
/// - Token refresh
/// - Auto-restore session from secure storage on app start
/// - Tenant selection after login
class AuthNotifier extends AsyncNotifier<AuthState> {
  AuthNotifier();

  @override
  Future<AuthState> build() async {
    // On app start, attempt to restore the session from secure storage.
    return _restoreSession();
  }

  // ── Restore Session ───────────────────────────────────────────────────

  /// Attempts to restore a previously authenticated session by checking
  /// for stored tokens and fetching the current user profile.
  Future<AuthState> _restoreSession() async {
    final bool hasTokens = await TokenStorage.hasTokens();
    if (!hasTokens) {
      return const AuthState.unauthenticated();
    }

    // Check if the access token is still valid.
    final bool isExpired = await TokenStorage.isTokenExpired();
    if (isExpired) {
      // Try refreshing the token.
      final bool refreshed = await _refreshToken();
      if (!refreshed) {
        await TokenStorage.clearTokens();
        return const AuthState.unauthenticated();
      }
    }

    // Fetch the current user profile to validate the session.
    final ApiClient apiClient = ref.read(apiClientProvider);
    final ApiResult<Map<String, dynamic>> result =
        await apiClient.getRaw(ApiConfig.meEndpoint);

    return result.when(
      success: (Map<String, dynamic> data) {
        final User user = User.fromJson(data);
        final String? accessToken = _cachedAccessToken;
        return AuthState.authenticated(
          user,
          accessToken ?? '',
        );
      },
      failure: (_) {
        TokenStorage.clearTokens();
        return const AuthState.unauthenticated();
      },
      loading: () => const AuthState.loading(),
    );
  }

  // ── Login ─────────────────────────────────────────────────────────────

  /// Authenticates the user with [email] and [password].
  ///
  /// On success:
  /// 1. Stores the access and refresh tokens.
  /// 2. Fetches the user profile.
  /// 3. Updates the state to [AuthAuthenticated].
  Future<void> login({
    required String email,
    required String password,
  }) async {
    state = const AsyncValue.loading();

    try {
      final ApiClient apiClient = ref.read(apiClientProvider);
      final ApiResult<Map<String, dynamic>> result =
          await apiClient.postRaw(
        ApiConfig.loginEndpoint,
        data: <String, dynamic>{
          'email': email,
          'password': password,
        },
      );

      result.when(
        success: (Map<String, dynamic> data) async {
          final String accessToken = data['accessToken'] as String;
          final String refreshToken = data['refreshToken'] as String;
          final int? expiresIn = data['expiresIn'] as int?;

          // Persist tokens.
          await TokenStorage.saveTokens(
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresIn: expiresIn != null
                ? Duration(seconds: expiresIn)
                : null,
          );

          _cachedAccessToken = accessToken;

          // Parse user data.
          final Map<String, dynamic> userData =
              data['user'] as Map<String, dynamic>? ?? data;

          final User user = User.fromJson(userData);

          state = AsyncValue<AuthState>.data(
            AuthState.authenticated(user, accessToken),
          );
        },
        failure: (ApiError error) {
          state = AsyncValue<AuthState>.data(
            const AuthState.unauthenticated(),
          );
          throw AuthException(error.displayMessage);
        },
        loading: () {
          // Should not happen for a completed call.
        },
      );
    } catch (e, st) {
      state = AsyncValue<AuthState>.data(
        const AuthState.unauthenticated(),
      );
      if (e is AuthException) rethrow;
      throw AuthException(e.toString());
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────

  /// Logs out the current user, clears tokens, and resets state.
  Future<void> logout() async {
    state = const AsyncValue.loading();

    try {
      // Notify the backend (best-effort).
      final ApiClient apiClient = ref.read(apiClientProvider);
      await apiClient.postRaw(ApiConfig.logoutEndpoint);
    } catch (_) {
      // Swallow errors — we'll clear locally regardless.
    }

    await TokenStorage.clearTokens();
    _cachedAccessToken = null;

    state = const AsyncValue<AuthState>.data(
      AuthState.unauthenticated(),
    );
  }

  // ── Token Refresh ─────────────────────────────────────────────────────

  /// Attempts to refresh the access token using the stored refresh token.
  ///
  /// Returns `true` on success, `false` on failure.
  Future<bool> _refreshToken() async {
    final String? refreshToken = await TokenStorage.getRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      return false;
    }

    try {
      final ApiClient apiClient = ref.read(apiClientProvider);
      final ApiResult<Map<String, dynamic>> result =
          await apiClient.postRaw(
        ApiConfig.refreshTokenEndpoint,
        data: <String, dynamic>{'refreshToken': refreshToken},
      );

      return result.when(
        success: (Map<String, dynamic> data) async {
          final String newAccessToken = data['accessToken'] as String;
          final String newRefreshToken =
              data['refreshToken'] as String? ?? refreshToken;
          final int? expiresIn = data['expiresIn'] as int?;

          await TokenStorage.saveTokens(
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresIn:
                expiresIn != null ? Duration(seconds: expiresIn) : null,
          );

          _cachedAccessToken = newAccessToken;
          return true;
        },
        failure: (_) => false,
        loading: () => false,
      );
    } catch (_) {
      return false;
    }
  }

  // ── Update User Profile ───────────────────────────────────────────────

  /// Updates the current user in the state (e.g. after profile edit).
  void updateUser(User user) {
    final AuthState current = state.valueOrNull ?? const AuthState.initial();
    current.when(
      initial: () {},
      authenticated: (_, String accessToken) {
        state = AsyncValue<AuthState>.data(
          AuthState.authenticated(user, accessToken),
        );
      },
      unauthenticated: () {},
      loading: () {},
    );
  }

  // ── Private ───────────────────────────────────────────────────────────

  /// Cached access token to avoid async reads during state construction.
  String? _cachedAccessToken;
}

/// Custom exception for auth-related errors.
class AuthException implements Exception {
  AuthException(this.message);
  final String message;

  @override
  String toString() => 'AuthException: $message';
}
