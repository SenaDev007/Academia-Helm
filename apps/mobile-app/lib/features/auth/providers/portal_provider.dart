import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/enums/user_role.dart' show PortalType;

// Re-export PortalType so consumers that import this file get the type too.
export '../../../core/enums/user_role.dart' show PortalType;

/// Currently selected portal type (null if not yet selected).
///
/// Mirrors the web app's sessionStorage['academia_portal_school'] + URL
/// ?portal= parameter — stores which portal the user picked on the
/// portal-select screen.
final selectedPortalProvider = StateProvider<PortalType?>((ref) => null);

/// Derives a French display name from the currently selected portal.
/// Returns an empty string if no portal is selected.
final portalDisplayNameProvider = Provider<String>((ref) {
  final portal = ref.watch(selectedPortalProvider);
  return portal?.displayName ?? '';
});
