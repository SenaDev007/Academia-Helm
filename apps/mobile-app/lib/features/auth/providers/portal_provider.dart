import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Portal types matching the web app's portal selection page.
enum PortalType {
  platform,
  school,
  teacher,
  parent,
}

/// Extension providing French display names and metadata for [PortalType].
extension PortalTypeX on PortalType {
  /// French display name for the portal.
  String get displayName {
    switch (this) {
      case PortalType.platform:
        return 'Plateforme';
      case PortalType.school:
        return 'École';
      case PortalType.teacher:
        return 'Enseignant';
      case PortalType.parent:
        return 'Parent';
    }
  }

  /// French description for the portal.
  String get description {
    switch (this) {
      case PortalType.platform:
        return 'Gestion multi-établissements';
      case PortalType.school:
        return 'Direction et administration';
      case PortalType.teacher:
        return 'Pédagogie et évaluation';
      case PortalType.parent:
        return 'Suivi scolaire et paiements';
    }
  }

  /// API-safe name used in query parameters.
  String get apiName {
    switch (this) {
      case PortalType.platform:
        return 'PLATFORM';
      case PortalType.school:
        return 'SCHOOL';
      case PortalType.teacher:
        return 'TEACHER';
      case PortalType.parent:
        return 'PARENT';
    }
  }
}

// ── Providers ──────────────────────────────────────────────────────────

/// Currently selected portal type (null if not yet selected).
final selectedPortalProvider = StateProvider<PortalType?>((ref) => null);

/// Derives a French display name from the currently selected portal.
/// Returns an empty string if no portal is selected.
final portalDisplayNameProvider = Provider<String>((ref) {
  final portal = ref.watch(selectedPortalProvider);
  return portal?.displayName ?? '';
});
