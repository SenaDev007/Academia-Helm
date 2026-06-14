import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

// ── Models ────────────────────────────────────────────────────────────

/// Represents the authentication state of the app.
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

  AuthState copyWith({
    bool? isAuthenticated,
    String? accessToken,
    String? refreshToken,
    String? userId,
    String? email,
    String? fullName,
    String? role,
    String? selectedTenantId,
    String? selectedTenantName,
    String? selectedTenantAcronym,
    List<TenantInfo>? availableTenants,
    String? error,
    bool? isLoading,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      userId: userId ?? this.userId,
      email: email ?? this.email,
      fullName: fullName ?? this.fullName,
      role: role ?? this.role,
      selectedTenantId: selectedTenantId ?? this.selectedTenantId,
      selectedTenantName: selectedTenantName ?? this.selectedTenantName,
      selectedTenantAcronym:
          selectedTenantAcronym ?? this.selectedTenantAcronym,
      availableTenants: availableTenants ?? this.availableTenants,
      error: error,
      isLoading: isLoading ?? this.isLoading,
    );
  }

  /// Whether the user has selected a tenant after login.
  bool get hasTenant => selectedTenantId != null;
}

/// Info about a tenant (school) the user has access to.
class TenantInfo {
  final String id;
  final String name;
  final String acronym;
  final String? logoUrl;
  final String type; // e.g. "École", "Lycée", "Collège", "Université"
  final String? subdomain;

  const TenantInfo({
    required this.id,
    required this.name,
    required this.acronym,
    this.logoUrl,
    required this.type,
    this.subdomain,
  });
}

// ── Auth Notifier ─────────────────────────────────────────────────────

class AuthNotifier extends AsyncNotifier<AuthState> {
  static const _secureStorage = FlutterSecureStorage();

  @override
  Future<AuthState> build() async {
    // Try to restore session from secure storage on app start.
    final accessToken = await _secureStorage.read(key: 'access_token');
    final refreshToken = await _secureStorage.read(key: 'refresh_token');
    final userId = await _secureStorage.read(key: 'user_id');
    final email = await _secureStorage.read(key: 'user_email');
    final fullName = await _secureStorage.read(key: 'user_full_name');
    final role = await _secureStorage.read(key: 'user_role');
    final tenantId = await _secureStorage.read(key: 'selected_tenant_id');
    final tenantName = await _secureStorage.read(key: 'selected_tenant_name');
    final tenantAcronym =
        await _secureStorage.read(key: 'selected_tenant_acronym');

    if (accessToken != null && userId != null) {
      return AuthState(
        isAuthenticated: true,
        accessToken: accessToken,
        refreshToken: refreshToken,
        userId: userId,
        email: email,
        fullName: fullName,
        role: role,
        selectedTenantId: tenantId,
        selectedTenantName: tenantName,
        selectedTenantAcronym: tenantAcronym,
      );
    }

    return const AuthState();
  }

  /// Login with email and password.
  Future<void> login({
    required String email,
    required String password,
  }) async {
    state = const AsyncLoading();
    try {
      // Simulate API call — replace with real API integration.
      await Future.delayed(const Duration(seconds: 1));

      // Mock successful login response.
      final mockTenants = [
        const TenantInfo(
          id: 'tenant-001',
          name: 'École Internationale de Lomé',
          acronym: 'EIL',
          type: 'École',
          logoUrl: null,
          subdomain: 'eil',
        ),
        const TenantInfo(
          id: 'tenant-002',
          name: 'Lycée de Kpalimé',
          acronym: 'LDK',
          type: 'Lycée',
          logoUrl: null,
          subdomain: 'ldk',
        ),
        const TenantInfo(
          id: 'tenant-003',
          name: 'Collège Saint Joseph',
          acronym: 'CSJ',
          type: 'Collège',
          logoUrl: null,
          subdomain: 'csj',
        ),
      ];

      // Store tokens securely.
      const fakeAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock';
      const fakeRefreshToken = 'mock_refresh_token';
      const fakeUserId = 'user-001';
      const fakeRole = 'ADMIN';

      await _secureStorage.write(key: 'access_token', value: fakeAccessToken);
      await _secureStorage.write(
          key: 'refresh_token', value: fakeRefreshToken);
      await _secureStorage.write(key: 'user_id', value: fakeUserId);
      await _secureStorage.write(key: 'user_email', value: email);
      await _secureStorage.write(key: 'user_full_name', value: 'Amadou Diallo');
      await _secureStorage.write(key: 'user_role', value: fakeRole);

      state = AsyncData(AuthState(
        isAuthenticated: true,
        accessToken: fakeAccessToken,
        refreshToken: fakeRefreshToken,
        userId: fakeUserId,
        email: email,
        fullName: 'Amadou Diallo',
        role: fakeRole,
        availableTenants: mockTenants,
      ));
    } catch (e) {
      state = AsyncData(AuthState(
        isAuthenticated: false,
        error: e.toString(),
      ));
    }
  }

  /// Select a tenant after login.
  Future<void> selectTenant(TenantInfo tenant) async {
    final current = state.valueOrNull;
    if (current == null) return;

    await _secureStorage.write(
        key: 'selected_tenant_id', value: tenant.id);
    await _secureStorage.write(
        key: 'selected_tenant_name', value: tenant.name);
    await _secureStorage.write(
        key: 'selected_tenant_acronym', value: tenant.acronym);

    state = AsyncData(current.copyWith(
      selectedTenantId: tenant.id,
      selectedTenantName: tenant.name,
      selectedTenantAcronym: tenant.acronym,
    ));
  }

  /// Logout and clear all stored credentials.
  Future<void> logout() async {
    await _secureStorage.deleteAll();
    state = const AsyncData(AuthState());
  }

  /// Clear the error message.
  void clearError() {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncData(current.copyWith(error: null));
  }
}

// ── Providers ─────────────────────────────────────────────────────────

/// Main auth state provider.
final authStateProvider =
    AsyncNotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);

/// Whether the user is currently authenticated.
final isAuthenticatedProvider = Provider<bool>((ref) {
  final authState = ref.watch(authStateProvider).valueOrNull;
  return authState?.isAuthenticated ?? false;
});

/// Whether the user has selected a tenant.
final hasTenantProvider = Provider<bool>((ref) {
  final authState = ref.watch(authStateProvider).valueOrNull;
  return authState?.hasTenant ?? false;
});

/// The current user's role.
final currentUserRoleProvider = Provider<String?>((ref) {
  final authState = ref.watch(authStateProvider).valueOrNull;
  return authState?.role;
});

/// The current user's display name.
final currentUserDisplayNameProvider = Provider<String?>((ref) {
  final authState = ref.watch(authStateProvider).valueOrNull;
  return authState?.fullName;
});

/// The current tenant name.
final currentTenantNameProvider = Provider<String?>((ref) {
  final authState = ref.watch(authStateProvider).valueOrNull;
  return authState?.selectedTenantName;
});

/// The available tenants for the current user.
final availableTenantsProvider = Provider<List<TenantInfo>>((ref) {
  final authState = ref.watch(authStateProvider).valueOrNull;
  return authState?.availableTenants ?? [];
});
