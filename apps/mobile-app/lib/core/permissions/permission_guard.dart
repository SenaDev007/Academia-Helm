import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'permission_module.dart';
import 'permission_action.dart';
import 'permissions_provider.dart';

/// A widget that conditionally shows or hides its [child] based on the
/// current user's permission for a given [module] and [action].
///
/// If the user does not have the required permission, the [fallback] widget
/// is shown instead (defaults to an empty [SizedBox]).
///
/// Usage:
/// ```dart
/// PermissionGuard(
///   module: PermissionModule.finances,
///   action: PermissionAction.write,
///   child: ElevatedButton(
///     onPressed: () => createInvoice(),
///     child: Text('Créer une facture'),
///   ),
/// )
/// ```
class PermissionGuard extends ConsumerWidget {
  const PermissionGuard({
    super.key,
    required this.module,
    required this.action,
    required this.child,
    this.fallback,
  });

  /// The module to check permission for.
  final PermissionModule module;

  /// The action to check permission for.
  final PermissionAction action;

  /// The widget to show when the user HAS the permission.
  final Widget child;

  /// The widget to show when the user DOES NOT have the permission.
  /// Defaults to an empty [SizedBox].
  final Widget? fallback;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hasPermission = ref.watch(hasPermissionProvider(
      PermissionCheck(module: module, action: action),
    ));

    if (hasPermission) {
      return child;
    }

    return fallback ?? const SizedBox.shrink();
  }
}
