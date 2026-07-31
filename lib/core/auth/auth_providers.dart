/// Convenience providers that derive common auth values from [authNotifierProvider].
///
/// These providers make it easy for UI code to watch specific auth values
/// without dealing with the full [AuthState] freezed type directly.
///
/// Usage:
/// ```dart
/// final bool authenticated = ref.watch(isAuthenticatedProvider);
/// final String? role = ref.watch(currentUserRoleProvider);
/// ```

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../enums/user_role.dart' show PortalType;
import 'auth_notifier.dart';
import 'auth_state.dart';

/// Whether the user is currently authenticated.
final isAuthenticatedProvider = Provider<bool>((Ref ref) {
  final authState = ref.watch(authNotifierProvider).valueOrNull;
  return authState?.isAuthenticated ?? false;
});

/// The current [AuthUser] if authenticated, otherwise `null`.
final currentUserProvider = Provider<AuthUser?>((Ref ref) {
  final authState = ref.watch(authNotifierProvider).valueOrNull;
  return authState?.userOrNull;
});

/// The current user's role if authenticated, otherwise `null`.
final currentUserRoleProvider = Provider<String?>((Ref ref) {
  final authState = ref.watch(authNotifierProvider).valueOrNull;
  return authState?.roleOrNull;
});

/// The current user's display name if authenticated, otherwise `null`.
final currentUserDisplayNameProvider = Provider<String?>((Ref ref) {
  final authState = ref.watch(authNotifierProvider).valueOrNull;
  return authState?.userOrNull?.displayName;
});

/// The currently selected tenant ID if authenticated and selected, otherwise `null`.
final currentSelectedTenantIdProvider = Provider<String?>((Ref ref) {
  final authState = ref.watch(authNotifierProvider).valueOrNull;
  return authState?.selectedTenantIdOrNull;
});

/// The list of available tenants if authenticated, otherwise empty list.
final availableTenantsProvider = Provider<List<TenantBasic>>((Ref ref) {
  final authState = ref.watch(authNotifierProvider).valueOrNull;
  return authState?.availableTenantsOrNull ?? [];
});

/// The currently selected portal type if authenticated and selected, otherwise `null`.
final selectedPortalProvider = Provider<PortalType?>((Ref ref) {
  final authState = ref.watch(authNotifierProvider).valueOrNull;
  return authState?.selectedPortalOrNull;
});
