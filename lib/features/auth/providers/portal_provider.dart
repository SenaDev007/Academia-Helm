import 'package:flutter_riverpod/flutter_riverpod.dart';

// Re-export PortalType from the canonical location (user_role.dart) so that
// all consumers use the SAME PortalType enum. Previously this file defined
// its own PortalType with only 4 values (no 'public'), which caused a type
// mismatch with auth_notifier.dart that imports from user_role.dart.
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
