// ┌──────────────────────────────────────────────────────────────────────────┐
// │  DEPRECATED — This file is kept for backward compatibility only.        │
// │  Use authNotifierProvider and the convenience providers from             │
// │  core/auth/auth_providers.dart instead.                                  │
// └──────────────────────────────────────────────────────────────────────────┘

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_notifier.dart';
import '../../../core/auth/auth_providers.dart' as real_providers;
import '../../../core/auth/auth_state.dart' as real_auth;

// ── DEPRECATED Models ──────────────────────────────────────────────────

/// @Deprecated('Use TenantBasic from core/auth/auth_state.dart instead')
@Deprecated('Use TenantBasic from core/auth/auth_state.dart instead')
class TenantInfo {
  final String id;
  final String name;
  final String acronym;
  final String? logoUrl;
  final String type;
  final String? subdomain;

  const TenantInfo({
    required this.id,
    required this.name,
    required this.acronym,
    this.logoUrl,
    required this.type,
    this.subdomain,
  });

  /// Creates a [TenantInfo] from a [TenantBasic] (real auth model).
  factory TenantInfo.fromTenantBasic(real_auth.TenantBasic tenant) {
    return TenantInfo(
      id: tenant.id,
      name: tenant.name,
      acronym: tenant.acronym ?? tenant.shortName,
      logoUrl: tenant.logoUrl,
      type: tenant.type ?? '',
      subdomain: tenant.subdomain,
    );
  }
}

// ── DEPRECATED AuthState ───────────────────────────────────────────────

/// @Deprecated('Use AuthState from core/auth/auth_state.dart instead')
@Deprecated('Use AuthState from core/auth/auth_state.dart instead')
class AuthState {
  final bool isAuthenticated;
  final String? accessToken;
  final String? refreshToken;
  final String? userId;
  final String? email;
  final String? fullName;
  final String? role;
  final String? selectedTenantId;
  final String? selectedTenantName;
  final String? selectedTenantAcronym;
  final List<TenantInfo> availableTenants;
  final String? error;
  final bool isLoading;

  const AuthState({
    this.isAuthenticated = false,
    this.accessToken,
    this.refreshToken,
    this.userId,
    this.email,
    this.fullName,
    this.role,
    this.selectedTenantId,
    this.selectedTenantName,
    this.selectedTenantAcronym,
    this.availableTenants = const [],
    this.error,
    this.isLoading = false,
  });

  /// Whether the user has selected a tenant after login.
  bool get hasTenant => selectedTenantId != null;

  /// Creates a deprecated AuthState by reading from the real auth state.
  factory AuthState.fromRealAuthState(real_auth.AuthState state) {
    return state.when(
      initial: () => const AuthState(),
      authenticated: (user, accessToken, tenants, tenantId, portal) {
        final tenant = tenantId != null
            ? tenants.where((t) => t.id == tenantId).firstOrNull
            : null;
        return AuthState(
          isAuthenticated: true,
          accessToken: accessToken,
          userId: user.id,
          email: user.email,
          fullName: user.displayName,
          role: user.role,
          selectedTenantId: tenantId,
          selectedTenantName: tenant?.name,
          selectedTenantAcronym: tenant?.acronym,
          availableTenants: tenants.map(TenantInfo.fromTenantBasic).toList(),
        );
      },
      unauthenticated: () => const AuthState(),
      loading: () => const AuthState(isLoading: true),
      loginLoading: () => const AuthState(isLoading: true),
    );
  }
}

// ── DEPRECATED Providers (delegate to real auth) ───────────────────────

/// @Deprecated('Use authNotifierProvider from core/auth/auth_notifier.dart instead')
@Deprecated('Use authNotifierProvider from core/auth/auth_notifier.dart instead')
final authStateProvider =
    AsyncNotifierProvider<_DeprecatedAuthNotifier, AuthState>(
  _DeprecatedAuthNotifier.new,
);

/// Internal notifier that delegates to the real [AuthNotifier].
class _DeprecatedAuthNotifier extends AsyncNotifier<AuthState> {
  @override
  Future<AuthState> build() async {
    final realState = await ref.watch(authNotifierProvider.future);
    return AuthState.fromRealAuthState(realState);
  }

  /// @Deprecated('Use authNotifierProvider.notifier.login() instead')
  @Deprecated('Use authNotifierProvider.notifier.login() instead')
  Future<void> login({required String email, required String password}) async {
    await ref.read(authNotifierProvider.notifier).login(
          email: email,
          password: password,
        );
  }

  /// @Deprecated('Use authNotifierProvider.notifier.selectTenant() instead')
  @Deprecated('Use authNotifierProvider.notifier.selectTenant() instead')
  Future<void> selectTenant(TenantInfo tenant) async {
    await ref.read(authNotifierProvider.notifier).selectTenant(tenant.id);
  }

  /// @Deprecated('Use authNotifierProvider.notifier.logout() instead')
  @Deprecated('Use authNotifierProvider.notifier.logout() instead')
  Future<void> logout() async {
    await ref.read(authNotifierProvider.notifier).logout();
  }
}

/// @Deprecated('Use isAuthenticatedProvider from core/auth/auth_providers.dart instead')
@Deprecated('Use isAuthenticatedProvider from core/auth/auth_providers.dart instead')
final isAuthenticatedProvider = Provider<bool>((ref) {
  return ref.watch(real_providers.isAuthenticatedProvider);
});

/// @Deprecated('Use currentSelectedTenantIdProvider from core/auth/auth_providers.dart instead')
@Deprecated('Use currentSelectedTenantIdProvider from core/auth/auth_providers.dart instead')
final hasTenantProvider = Provider<bool>((ref) {
  return ref.watch(real_providers.currentSelectedTenantIdProvider) != null;
});

/// @Deprecated('Use currentUserRoleProvider from core/auth/auth_providers.dart instead')
@Deprecated('Use currentUserRoleProvider from core/auth/auth_providers.dart instead')
final currentUserRoleProvider = Provider<String?>((ref) {
  return ref.watch(real_providers.currentUserRoleProvider);
});

/// @Deprecated('Use currentUserDisplayNameProvider from core/auth/auth_providers.dart instead')
@Deprecated('Use currentUserDisplayNameProvider from core/auth/auth_providers.dart instead')
final currentUserDisplayNameProvider = Provider<String?>((ref) {
  return ref.watch(real_providers.currentUserDisplayNameProvider);
});

/// @Deprecated('Read tenant name from tenantNotifierProvider instead')
@Deprecated('Read tenant name from tenantNotifierProvider instead')
final currentTenantNameProvider = Provider<String?>((ref) {
  // Read from the real auth state's tenant data
  final authState = ref.watch(authNotifierProvider).valueOrNull;
  final tenantId = authState?.selectedTenantIdOrNull;
  if (tenantId == null) return null;
  final tenants = authState?.availableTenantsOrNull ?? [];
  final tenant = tenants.where((t) => t.id == tenantId).firstOrNull;
  return tenant?.name;
});

/// @Deprecated('Use availableTenantsProvider from core/auth/auth_providers.dart instead')
@Deprecated('Use availableTenantsProvider from core/auth/auth_providers.dart instead')
final availableTenantsProvider = Provider<List<TenantInfo>>((ref) {
  final tenants = ref.watch(real_providers.availableTenantsProvider);
  return tenants.map(TenantInfo.fromTenantBasic).toList();
});
