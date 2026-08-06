/// Permission actions matching the web app's 4-action system.
///
/// Each action represents a level of access to a permission module:
/// - **read**: View/access the module's data
/// - **write**: Create or update data in the module
/// - **delete**: Remove data from the module
/// - **manage**: Full administrative control over the module
enum PermissionAction {
  read,
  write,
  delete,
  manage,
}

/// Extension providing French display names for [PermissionAction].
extension PermissionActionX on PermissionAction {
  /// French display name for the action.
  String get displayName {
    switch (this) {
      case PermissionAction.read:
        return 'Lecture';
      case PermissionAction.write:
        return 'Écriture';
      case PermissionAction.delete:
        return 'Suppression';
      case PermissionAction.manage:
        return 'Gestion';
    }
  }

  /// API key name matching the web app's action identifiers.
  String get apiKey {
    switch (this) {
      case PermissionAction.read:
        return 'read';
      case PermissionAction.write:
        return 'write';
      case PermissionAction.delete:
        return 'delete';
      case PermissionAction.manage:
        return 'manage';
    }
  }

  /// Lookup an action by its API key name.
  static PermissionAction? fromApiKey(String key) {
    for (final action in PermissionAction.values) {
      if (action.apiKey == key) return action;
    }
    return null;
  }
}
