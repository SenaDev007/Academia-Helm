import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';
import '../network/api_config.dart';
import '../network/api_result.dart';
import 'auth_state.dart';
import 'token_storage.dart';
import '../enums/user_role.dart' show PortalType;

// Re-export AuthState and its extensions so consumers don't need to import
// both files separately.
export 'auth_state.dart';

/// Riverpod provider for the [AuthNotifier].
final authNotifierProvider =
    AsyncNotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);

/// Riverpod [AsyncNotifier] that manages the authentication lifecycle.
///
/// Responsibilities:
/// - Login (email + password, matricule + password, phone/email + password)
/// - Logout
/// - Token refresh
/// - Auto-restore session from secure storage on app start
/// - Tenant selection after login
/// - Portal selection
/// - Forgot / reset password
///
/// Login endpoints (matches web app):
/// - SCHOOL / PLATFORM → POST /auth/login
/// - TEACHER → POST /portal/auth/teacher
/// - PARENT → POST /portal/auth/parent
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
        final AuthUser user = AuthUser.fromJson(data);
        final String? accessToken = _cachedAccessToken;

        // Restore tenant selection from secure storage.
        final Map<String, dynamic>? sessionUser =
            TokenStorage.getSessionUserSync();
        final Map<String, dynamic>? sessionTenant =
            TokenStorage.getSessionTenantSync();

        String? selectedTenantId;
        List<TenantBasic> availableTenants = [];

        if (sessionTenant != null) {
          selectedTenantId = sessionTenant['id'] as String?;
        }

        // Restore available tenants from session user data if present.
        if (sessionUser != null) {
          final dynamic tenantsData = sessionUser['availableTenants'];
          if (tenantsData is List) {
            availableTenants = tenantsData
                .cast<Map<String, dynamic>>()
                .map(TenantBasic.fromJson)
                .toList();
          }
        }

        return AuthState.authenticated(
          user,
          accessToken ?? '',
          availableTenants: availableTenants,
          selectedTenantId: selectedTenantId,
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

  /// Authenticates the user with [identifier] and [password].
  ///
  /// The [identifier] can be:
  /// - An email (for SCHOOL / PLATFORM portals)
  /// - A matricule (for TEACHER portal)
  /// - A phone number or email (for PARENT portal)
  ///
  /// The [portalType] determines which API endpoint to call:
  /// - SCHOOL / PLATFORM → POST /auth/login
  /// - TEACHER → POST /portal/auth/teacher
  /// - PARENT → POST /portal/auth/parent
  ///
  /// The [tenantId] is required for TEACHER and PARENT portals.
  Future<void> login({
    required String identifier,
    required String password,
    PortalType? portalType,
    String? tenantId,
  }) async {
    state = const AsyncValue<AuthState>.data(AuthState.loginLoading());

    try {
      final ApiClient apiClient = ref.read(apiClientProvider);

      // Determine the endpoint and payload based on portal type
      final String endpoint = _getLoginEndpoint(portalType);
      final Map<String, dynamic> payload = _buildLoginPayload(
        identifier: identifier,
        password: password,
        portalType: portalType,
        tenantId: tenantId,
      );

      final ApiResult<Map<String, dynamic>> result =
          await apiClient.postRaw(
        endpoint,
        data: payload,
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

          final AuthUser user = AuthUser.fromJson(userData);

          // Parse available tenants from the response.
          final List<TenantBasic> availableTenants = _parseTenants(data);

          // Persist session data.
          await TokenStorage.persistSession(
            user: userData,
            tenant: null,
          );

          // Update last activity.
          await TokenStorage.updateLastActivity();

          state = AsyncValue<AuthState>.data(
            AuthState.authenticated(
              user,
              accessToken,
              availableTenants: availableTenants,
            ),
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

  /// Returns the correct login endpoint based on portal type.
  /// Matches the web app's 3-endpoint architecture.
  String _getLoginEndpoint(PortalType? portalType) {
    switch (portalType) {
      case PortalType.teacher:
        return '/portal/auth/teacher';
      case PortalType.parent:
        return '/portal/auth/parent';
      case PortalType.school:
      case PortalType.platform:
      default:
        return ApiConfig.loginEndpoint; // /auth/login
    }
  }

  /// Builds the login payload based on portal type.
  /// Each portal sends different fields to its endpoint.
  Map<String, dynamic> _buildLoginPayload({
    required String identifier,
    required String password,
    PortalType? portalType,
    String? tenantId,
  }) {
    switch (portalType) {
      case PortalType.teacher:
        return <String, dynamic>{
          'tenantId': tenantId,
          'teacherIdentifier': identifier,
          'password': password,
          'portal_type': 'TEACHER',
        };
      case PortalType.parent:
        // Parent: auto-detect phone vs email based on '@'
        final isEmail = identifier.contains('@');
        final payload = <String, dynamic>{
          'tenantId': tenantId,
          'identifierType': isEmail ? 'EMAIL' : 'PHONE',
          'portal_type': 'PARENT',
        };
        if (isEmail) {
          payload['email'] = identifier;
          if (password.isNotEmpty) {
            payload['password'] = password;
          }
        } else {
          payload['phone'] = identifier;
        }
        return payload;
      case PortalType.school:
      case PortalType.platform:
      default:
        return <String, dynamic>{
          'email': identifier,
          'password': password,
          'portal_type': portalType == PortalType.platform
              ? 'PLATFORM'
              : 'SCHOOL',
          if (tenantId != null) 'tenant_id': tenantId,
        };
    }
  }

  // ── Select Tenant ─────────────────────────────────────────────────────

  /// Selects a tenant for the current session.
  ///
  /// Calls the `/tenants/select` API endpoint and updates the state.
  Future<void> selectTenant(String tenantId) async {
    final AuthState current = state.valueOrNull ?? const AuthState.initial();

    // Only proceed if authenticated.
    if (current is! AuthAuthenticated) return;

    try {
      // Notify the backend about the tenant selection.
      final ApiClient apiClient = ref.read(apiClientProvider);
      await apiClient.postRaw(
        ApiConfig.tenantSelectionEndpoint,
        data: <String, dynamic>{'tenantId': tenantId},
      );
    } catch (_) {
      // Swallow — the local selection is still valid.
    }

    // Find the tenant name for persisting.
    final TenantBasic? selectedTenant = current.availableTenants
        .where((TenantBasic t) => t.id == tenantId)
        .firstOrNull;

    // Persist tenant selection.
    await TokenStorage.persistSession(
      user: const {}, // Keep existing user data
      tenant: selectedTenant != null
          ? {
              'id': selectedTenant.id,
              'name': selectedTenant.name,
              'acronym': selectedTenant.acronym,
              'logoUrl': selectedTenant.logoUrl,
              'type': selectedTenant.type,
              'subdomain': selectedTenant.subdomain,
            }
          : {'id': tenantId},
    );

    await TokenStorage.updateLastActivity();

    state = AsyncValue<AuthState>.data(
      current.copyWith(selectedTenantId: tenantId),
    );
  }

  // ── Select Portal ─────────────────────────────────────────────────────

  /// Updates the selected portal in the current auth state.
  void selectPortal(PortalType portal) {
    final AuthState current = state.valueOrNull ?? const AuthState.initial();
    if (current is! AuthAuthenticated) return;

    state = AsyncValue<AuthState>.data(
      current.copyWith(selectedPortal: portal),
    );
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

  // ── Forgot Password ───────────────────────────────────────────────────

  /// Sends a password reset email to [email].
  ///
  /// Throws [AuthException] on failure.
  Future<void> forgotPassword(String email) async {
    try {
      final ApiClient apiClient = ref.read(apiClientProvider);
      final ApiResult<Map<String, dynamic>> result =
          await apiClient.postRaw(
        '/auth/forgot-password',
        data: <String, dynamic>{'email': email},
      );

      result.when(
        success: (_) {
          // Password reset email sent successfully.
        },
        failure: (ApiError error) {
          throw AuthException(error.displayMessage);
        },
        loading: () {},
      );
    } catch (e) {
      if (e is AuthException) rethrow;
      throw AuthException(e.toString());
    }
  }

  // ── Reset Password ────────────────────────────────────────────────────

  /// Resets the user's password using a valid reset [token] and [newPassword].
  ///
  /// Throws [AuthException] on failure.
  Future<void> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    try {
      final ApiClient apiClient = ref.read(apiClientProvider);
      final ApiResult<Map<String, dynamic>> result =
          await apiClient.postRaw(
        '/auth/reset-password',
        data: <String, dynamic>{
          'token': token,
          'newPassword': newPassword,
        },
      );

      result.when(
        success: (_) {
          // Password reset successfully.
        },
        failure: (ApiError error) {
          throw AuthException(error.displayMessage);
        },
        loading: () {},
      );
    } catch (e) {
      if (e is AuthException) rethrow;
      throw AuthException(e.toString());
    }
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
  void updateUser(AuthUser user) {
    final AuthState current = state.valueOrNull ?? const AuthState.initial();
    current.when(
      initial: () {},
      authenticated: (_, String accessToken,
          List<TenantBasic> tenants, String? tenantId, PortalType? portal) {
        state = AsyncValue<AuthState>.data(
          AuthState.authenticated(
            user,
            accessToken,
            availableTenants: tenants,
            selectedTenantId: tenantId,
            selectedPortal: portal,
          ),
        );
      },
      unauthenticated: () {},
      loading: () {},
      loginLoading: () {},
    );
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  /// Cached access token to avoid async reads during state construction.
  String? _cachedAccessToken;

  /// Parses the available tenants from the login response.
  List<TenantBasic> _parseTenants(Map<String, dynamic> data) {
    final dynamic tenantsData =
        data['tenants'] ?? data['availableTenants'] ?? data['schools'];

    if (tenantsData is List) {
      try {
        return tenantsData
            .cast<Map<String, dynamic>>()
            .map(TenantBasic.fromJson)
            .toList();
      } catch (_) {
        return [];
      }
    }
    return [];
  }
}

/// Custom exception for auth-related errors.
class AuthException implements Exception {
  AuthException(this.message);
  final String message;

  @override
  String toString() => 'AuthException: $message';
}
