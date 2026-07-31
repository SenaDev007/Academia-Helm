import 'permission_module.dart';
import 'permission_action.dart';

/// Represents a permission entry tying a [module] to a set of allowed [actions].
///
/// This is a lightweight, freezed-style immutable class (hand-written to avoid
/// code-gen dependency at this layer). It can be easily converted to a
/// @freezed class later if needed.
class Permission {
  const Permission({
    required this.module,
    required this.actions,
  });

  /// The module this permission applies to.
  final PermissionModule module;

  /// The set of actions allowed on this module.
  final Set<PermissionAction> actions;

  /// Whether this permission grants the specified [action].
  bool allows(PermissionAction action) => actions.contains(action);

  /// Whether this permission grants READ access.
  bool get canRead => allows(PermissionAction.read);

  /// Whether this permission grants WRITE access.
  bool get canWrite => allows(PermissionAction.write);

  /// Whether this permission grants DELETE access.
  bool get canDelete => allows(PermissionAction.delete);

  /// Whether this permission grants MANAGE access.
  bool get canManage => allows(PermissionAction.manage);

  /// Create a [Permission] from a JSON map (API response).
  ///
  /// Expected format:
  /// ```json
  /// {
  ///   "module": "finances",
  ///   "actions": ["read", "write"]
  /// }
  /// ```
  factory Permission.fromJson(Map<String, dynamic> json) {
    final moduleKey = json['module'] as String? ?? '';
    final module = PermissionModuleX.fromApiKey(moduleKey);

    final actionList = json['actions'] as List<dynamic>? ?? [];
    final actions = <PermissionAction>{};
    for (final actionKey in actionList) {
      final action = PermissionActionX.fromApiKey(actionKey as String);
      if (action != null) actions.add(action);
    }

    if (module == null) {
      // Unknown module — skip or return a default empty permission.
      return Permission(
        module: PermissionModule.parametres,
        actions: const {},
      );
    }

    return Permission(module: module, actions: actions);
  }

  /// Convert to JSON-compatible map.
  Map<String, dynamic> toJson() {
    return {
      'module': module.apiKey,
      'actions': actions.map((a) => a.apiKey).toList(),
    };
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    if (other is! Permission) return false;
    return module == other.module &&
        _setEquals(actions, other.actions);
  }

  @override
  int get hashCode => Object.hash(module, Object.hashAll(actions));

  /// Helper for Set equality.
  static bool _setEquals<T>(Set<T> a, Set<T> b) {
    if (a.length != b.length) return false;
    for (final item in a) {
      if (!b.contains(item)) return false;
    }
    return true;
  }

  @override
  String toString() => 'Permission(module: $module, actions: $actions)';
}
