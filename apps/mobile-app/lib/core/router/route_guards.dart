import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/providers/auth_provider.dart';

/// Redirect logic for the GoRouter.
///
/// Rules:
/// 1. If not authenticated → /login
/// 2. If authenticated but no tenant selected → /tenant-select
/// 3. If authenticated with tenant → allow navigation
String? authGuardRedirect(Ref ref, GoRouterState state) {
  final authState = ref.read(authStateProvider).valueOrNull;
  final isAuthenticated = authState?.isAuthenticated ?? false;
  final hasTenant = authState?.hasTenant ?? false;

  final isLoginRoute = state.matchedLocation == '/login';
  final isSplashRoute = state.matchedLocation == '/splash';
  final isTenantSelectRoute = state.matchedLocation == '/tenant-select';

  // Allow splash unconditionally.
  if (isSplashRoute) return null;

  // If not authenticated, send to login (unless already there).
  if (!isAuthenticated) {
    return isLoginRoute ? null : '/login';
  }

  // If authenticated but on login, redirect appropriately.
  if (isLoginRoute) {
    return hasTenant ? '/dashboard' : '/tenant-select';
  }

  // If authenticated but no tenant selected, send to tenant select.
  if (!hasTenant && !isTenantSelectRoute) {
    return '/tenant-select';
  }

  // If tenant is selected and on tenant-select, go to dashboard.
  if (hasTenant && isTenantSelectRoute) {
    return '/dashboard';
  }

  // All checks passed.
  return null;
}

/// Checks if the user can access admin routes.
bool canAccessAdminRoute(Ref ref) {
  final role = ref.read(currentUserRoleProvider);
  return role == 'ADMIN' || role == 'SUPER_ADMIN';
}

/// Checks if the user can access teacher routes.
bool canAccessTeacherRoute(Ref ref) {
  final role = ref.read(currentUserRoleProvider);
  return role == 'TEACHER' || role == 'ADMIN' || role == 'SUPER_ADMIN';
}

/// Checks if the user can access parent routes.
bool canAccessParentRoute(Ref ref) {
  final role = ref.read(currentUserRoleProvider);
  return role == 'PARENT' || role == 'ADMIN' || role == 'SUPER_ADMIN';
}
