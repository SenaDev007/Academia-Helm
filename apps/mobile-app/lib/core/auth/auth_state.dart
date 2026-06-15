// NOTE: This file uses @freezed annotations. Run `build_runner` to generate
// the .freezed.dart and .g.dart companion files:
//   dart run build_runner build --delete-conflicting-outputs

import 'package:freezed_annotation/freezed_annotation.dart';

import '../enums/user_role.dart' show PortalType;

part 'auth_state.freezed.dart';
part 'auth_state.g.dart';

/// Basic tenant info returned during login alongside the user profile.
@Freezed(toJson: true)
class TenantBasic with _$TenantBasic {
  const factory TenantBasic({
    required String id,
    required String name,
    String? acronym,
    String? logoUrl,
    String? type,
    String? subdomain,
  }) = _TenantBasic;

  const TenantBasic._();

  /// Display-friendly short name.
  String get shortName => acronym ?? name.split(' ').first;

  factory TenantBasic.fromJson(Map<String, dynamic> json) =>
      _$TenantBasicFromJson(json);
}

/// Represents an authenticated user in the auth context.
///
/// This is distinct from [User] in `domain/entities/user.dart` which
/// represents a user entity in the data layer. [AuthUser] is used
/// exclusively in the authentication state machine.
@Freezed(toJson: true)
class AuthUser with _$AuthUser {
  const factory AuthUser({
    required String id,
    required String email,
    required String firstName,
    required String lastName,
    String? avatarUrl,
    String? phone,
    String? role,
    @Default(true) bool isActive,
    @Default([]) List<String> permissions,
    DateTime? lastLoginAt,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) = _AuthUser;

  const AuthUser._();

  /// Full display name.
  String get displayName => '$firstName $lastName';

  /// Initials for avatar fallback.
  String get initials {
    final String first = firstName.isNotEmpty ? firstName[0].toUpperCase() : '';
    final String last = lastName.isNotEmpty ? lastName[0].toUpperCase() : '';
    return '$first$last';
  }

  factory AuthUser.fromJson(Map<String, dynamic> json) =>
      _$AuthUserFromJson(json);
}

/// Sealed class representing the authentication state of the app.
@freezed
sealed class AuthState with _$AuthState {
  /// Initial state before any auth check has been performed.
  const factory AuthState.initial() = AuthInitial;

  /// The user is authenticated with a valid access token.
  const factory AuthState.authenticated(
    AuthUser user,
    String accessToken, {
    @Default([]) List<TenantBasic> availableTenants,
    String? selectedTenantId,
    PortalType? selectedPortal,
  }) = AuthAuthenticated;

  /// The user is not authenticated.
  const factory AuthState.unauthenticated() = AuthUnauthenticated;

  /// An auth operation is in progress (login, logout, refresh).
  const factory AuthState.loading() = AuthLoading;

  /// Login is specifically in progress (distinct from other loading states
  /// like token refresh or logout).
  const factory AuthState.loginLoading() = AuthLoginLoading;
}

/// Extension providing convenience helpers on [AuthState].
extension AuthStateX on AuthState {
  /// Returns `true` when the user is authenticated.
  bool get isAuthenticated => this is AuthAuthenticated;

  /// Returns `true` when any auth operation is in progress.
  bool get isLoading => this is AuthLoading || this is AuthLoginLoading;

  /// Returns `true` when login is specifically in progress.
  bool get isLoginLoading => this is AuthLoginLoading;

  /// Returns the [AuthUser] if authenticated, otherwise `null`.
  AuthUser? get userOrNull => when<AuthUser?>(
        initial: () => null,
        authenticated: (AuthUser user, _, __, ___, ____) => user,
        unauthenticated: () => null,
        loading: () => null,
        loginLoading: () => null,
      );

  /// Returns the access token if authenticated, otherwise `null`.
  String? get accessTokenOrNull => when<String?>(
        initial: () => null,
        authenticated: (_, String accessToken, __, ___, ____) => accessToken,
        unauthenticated: () => null,
        loading: () => null,
        loginLoading: () => null,
      );

  /// Returns the available tenants if authenticated, otherwise empty list.
  List<TenantBasic> get availableTenantsOrNull => when<List<TenantBasic>>(
        initial: () => [],
        authenticated: (_, __, List<TenantBasic> tenants, ___, ____) => tenants,
        unauthenticated: () => [],
        loading: () => [],
        loginLoading: () => [],
      );

  /// Returns the selected tenant ID if authenticated and a tenant is selected.
  String? get selectedTenantIdOrNull => when<String?>(
        initial: () => null,
        authenticated: (_, __, ___, String? tenantId, ____) => tenantId,
        unauthenticated: () => null,
        loading: () => null,
        loginLoading: () => null,
      );

  /// Returns the selected portal type if authenticated and a portal is selected.
  PortalType? get selectedPortalOrNull => when<PortalType?>(
        initial: () => null,
        authenticated: (_, __, ___, ____, PortalType? portal) => portal,
        unauthenticated: () => null,
        loading: () => null,
        loginLoading: () => null,
      );

  /// Whether the user has selected a tenant after login.
  bool get hasTenant => selectedTenantIdOrNull != null;

  /// Returns the user's role if authenticated, otherwise `null`.
  String? get roleOrNull => userOrNull?.role;
}
