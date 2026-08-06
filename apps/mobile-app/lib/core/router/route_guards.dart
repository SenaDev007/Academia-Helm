import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../auth/auth_notifier.dart';
import '../auth/auth_providers.dart';
import '../auth/auth_state.dart';

/// Redirect logic for the GoRouter.
///
/// Rules:
/// 1. If not authenticated → /login
/// 2. If authenticated but no tenant selected → /tenant-select
/// 3. If authenticated with tenant → allow navigation
String? authGuardRedirect(Ref ref, GoRouterState state) {
  final authState = ref.read(authNotifierProvider).valueOrNull;
  final isAuthenticated = authState?.isAuthenticated ?? false;
  final hasTenant = authState?.hasTenant ?? false;

  final isLoginRoute = state.matchedLocation == '/login';
  final isSplashRoute = state.matchedLocation == '/splash';
  final isTenantSelectRoute = state.matchedLocation == '/tenant-select';
  final isForgotPasswordRoute = state.matchedLocation == '/forgot-password';
  final isResetPasswordRoute = state.matchedLocation == '/reset-password';
  final isPortalSelectRoute = state.matchedLocation == '/portal-select';

  // Public routes accessible without authentication.
  final isPublicRoute = isLoginRoute ||
      isSplashRoute ||
      isForgotPasswordRoute ||
      isResetPasswordRoute ||
      isPortalSelectRoute;

  // Allow splash unconditionally.
  if (isSplashRoute) return null;

  // Allow public routes for unauthenticated users.
  if (isPublicRoute && !isAuthenticated) return null;

  // If not authenticated, send to login (unless already there or on a public route).
  if (!isAuthenticated) {
    return isLoginRoute ? null : '/login';
  }

  // If authenticated but on login/forgot/reset, redirect appropriately.
  if (isLoginRoute || isForgotPasswordRoute || isResetPasswordRoute) {
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
