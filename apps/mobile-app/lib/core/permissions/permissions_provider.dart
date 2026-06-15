import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/auth_notifier.dart';
import '../network/api_client.dart';
import '../network/api_config.dart';
import '../network/api_result.dart';
import 'permission.dart';
import 'permission_module.dart';
import 'permission_action.dart';

// ── Permissions Provider ──────────────────────────────────────────────

/// Fetches the current user's permissions from `/auth/permissions`.
///
/// Returns a map of [PermissionModule] → [Permission] for the authenticated
/// user. If the user is not authenticated or the fetch fails, returns an
/// empty map.
final permissionsProvider =
    FutureProvider<Map<PermissionModule, Permission>>((ref) async {
  final authState = ref.watch(authNotifierProvider).valueOrNull;
  if (authState == null || !authState.isAuthenticated) {
    return {};
  }

  try {
    final apiClient = ref.read(apiClientProvider);
    final ApiResult<Map<String, dynamic>> result =
        await apiClient.getRaw('/auth/permissions');

    return result.when(
      success: (Map<String, dynamic> data) {
        final List<dynamic> permissionList =
            data['permissions'] as List<dynamic>? ?? [];
        final Map<PermissionModule, Permission> permissions = {};

        for (final item in permissionList) {
          final permission = Permission.fromJson(item as Map<String, dynamic>);
          permissions[permission.module] = permission;
        }

        return permissions;
      },
      failure: (_) => {},
      loading: () => {},
    );
  } catch (_) {
    // On failure, return empty permissions — UI will fall back gracefully.
    return {};
  }
});

// ── Permission Check Providers ────────────────────────────────────────

/// Parameter class for permission checks.
class PermissionCheck {
  const PermissionCheck({
    required this.module,
    required this.action,
  });

  final PermissionModule module;
  final PermissionAction action;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is PermissionCheck &&
          module == other.module &&
          action == other.action;

  @override
  int get hashCode => Object.hash(module, action);
}

/// Checks if the current user has a specific [PermissionAction] on a
/// specific [PermissionModule].
///
/// Usage:
/// ```dart
/// final canWrite = ref.read(hasPermissionProvider(
///   PermissionCheck(module: PermissionModule.finances, action: PermissionAction.write),
/// ));
/// ```
final hasPermissionProvider = Provider.family<bool, PermissionCheck>((ref, check) {
  final permissionsAsync = ref.watch(permissionsProvider);
  final permissions = permissionsAsync.valueOrNull ?? {};
  final permission = permissions[check.module];
  return permission?.allows(check.action) ?? false;
});

/// Checks if the current user has READ access to a module.
final hasModuleAccessProvider =
    Provider.family<bool, PermissionModule>((ref, module) {
  return ref.read(hasPermissionProvider(
    PermissionCheck(module: module, action: PermissionAction.read),
  ));
});

/// Checks if the current user has WRITE permission on a module.
final canWriteProvider =
    Provider.family<bool, PermissionModule>((ref, module) {
  return ref.read(hasPermissionProvider(
    PermissionCheck(module: module, action: PermissionAction.write),
  ));
});

/// Checks if the current user has DELETE permission on a module.
final canDeleteProvider =
    Provider.family<bool, PermissionModule>((ref, module) {
  return ref.read(hasPermissionProvider(
    PermissionCheck(module: module, action: PermissionAction.delete),
  ));
});

/// Checks if the current user has MANAGE permission on a module.
final canManageProvider =
    Provider.family<bool, PermissionModule>((ref, module) {
  return ref.read(hasPermissionProvider(
    PermissionCheck(module: module, action: PermissionAction.manage),
  ));
});
