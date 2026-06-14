// NOTE: This file uses @freezed annotations. Run `build_runner` to generate
// the .g.dart companion file:
//   dart run build_runner build --delete-conflicting-outputs

import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_state.g.dart';

/// Represents an authenticated user.
@freezed
class User with _$User {
  const factory User({
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
  }) = _User;

  const User._();

  /// Full display name.
  String get displayName => '$firstName $lastName';

  /// Initials for avatar fallback.
  String get initials {
    final String first = firstName.isNotEmpty ? firstName[0].toUpperCase() : '';
    final String last = lastName.isNotEmpty ? lastName[0].toUpperCase() : '';
    return '$first$last';
  }
}

/// Sealed class representing the authentication state of the app.
@freezed
sealed class AuthState with _$AuthState {
  /// Initial state before any auth check has been performed.
  const factory AuthState.initial() = AuthInitial;

  /// The user is authenticated with a valid access token.
  const factory AuthState.authenticated(
    User user,
    String accessToken,
  ) = AuthAuthenticated;

  /// The user is not authenticated.
  const factory AuthState.unauthenticated() = AuthUnauthenticated;

  /// An auth operation is in progress (login, logout, refresh).
  const factory AuthState.loading() = AuthLoading;
}

/// Extension providing convenience helpers on [AuthState].
extension AuthStateX on AuthState {
  /// Returns `true` when the user is authenticated.
  bool get isAuthenticated => this is AuthAuthenticated;

  /// Returns `true` when an auth operation is in progress.
  bool get isLoading => this is AuthLoading;

  /// Returns the [User] if authenticated, otherwise `null`.
  User? get userOrNull => when<User?>(
        initial: () => null,
        authenticated: (User user, _) => user,
        unauthenticated: () => null,
        loading: () => null,
      );

  /// Returns the access token if authenticated, otherwise `null`.
  String? get accessTokenOrNull => when<String?>(
        initial: () => null,
        authenticated: (_, String accessToken) => accessToken,
        unauthenticated: () => null,
        loading: () => null,
      );
}
