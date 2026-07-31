/// ============================================================================
/// ACADEMIC YEAR MODEL — Academia Hub Mobile
/// ============================================================================
///
/// Richer models for AcademicYear and SchoolLevel used by providers and UI.
/// The domain entities (freezed) exist in lib/domain/entities/, but these
/// models add helper getters and ensure compatibility with the API response
/// format used in the mobile app.
///
/// All user-facing strings are in FRENCH.
/// ============================================================================

import '../../domain/entities/academic_year.dart' as domain;
import '../../domain/entities/school_level.dart' as domain;

// ─── Academic Year ────────────────────────────────────────────────────────────

/// Enriched academic year model with display helpers.
class AcademicYearModel {
  final String id;
  final String name;
  final DateTime startDate;
  final DateTime endDate;
  final bool isActive;
  final bool isCurrent;
  final String? status;

  const AcademicYearModel({
    required this.id,
    required this.name,
    required this.startDate,
    required this.endDate,
    this.isActive = false,
    this.isCurrent = false,
    this.status,
  });

  /// Crée depuis l'entité du domaine.
  factory AcademicYearModel.fromDomain(domain.AcademicYear entity) {
    return AcademicYearModel(
      id: entity.id,
      name: entity.name,
      startDate: entity.startDate,
      endDate: entity.endDate,
      isCurrent: entity.isCurrent ?? false,
      status: entity.status,
    );
  }

  /// Crée depuis un JSON de l'API.
  factory AcademicYearModel.fromJson(Map<String, dynamic> json) {
    return AcademicYearModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      startDate: json['startDate'] != null
          ? DateTime.parse(json['startDate'] as String)
          : DateTime.now(),
      endDate: json['endDate'] != null
          ? DateTime.parse(json['endDate'] as String)
          : DateTime.now(),
      isActive: json['isActive'] as bool? ?? json['status'] == 'ACTIVE' ?? false,
      isCurrent: json['isCurrent'] as bool? ?? json['current'] as bool? ?? false,
      status: json['status'] as String?,
    );
  }

  /// Convertit en JSON.
  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'startDate': startDate.toIso8601String(),
        'endDate': endDate.toIso8601String(),
        'isActive': isActive,
        'isCurrent': isCurrent,
        'status': status,
      };

  /// Label affichable : nom + année.
  String get displayName => name;

  /// Année scolaire courte (ex: "2024-2025").
  String get shortLabel {
    final startYear = startDate.year;
    final endYear = endDate.year;
    return '$startYear-$endYear';
  }

  /// Si l'année est en cours.
  bool get isActiveOrCurrent => isActive || isCurrent;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AcademicYearModel && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;
}

// ─── School Level ─────────────────────────────────────────────────────────────

/// Enriched school level model with display helpers.
class SchoolLevelModel {
  final String id;
  final String code;
  final String name;
  final String label;
  final int order;
  final bool isActive;

  const SchoolLevelModel({
    required this.id,
    required this.code,
    required this.name,
    required this.label,
    required this.order,
    this.isActive = true,
  });

  /// Crée depuis l'entité du domaine.
  factory SchoolLevelModel.fromDomain(domain.SchoolLevel entity) {
    return SchoolLevelModel(
      id: entity.id,
      code: entity.code,
      name: entity.name,
      label: entity.label,
      order: entity.order,
      isActive: entity.isActive ?? true,
    );
  }

  /// Crée depuis un JSON de l'API.
  factory SchoolLevelModel.fromJson(Map<String, dynamic> json) {
    return SchoolLevelModel(
      id: json['id'] as String? ?? '',
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
      label: json['label'] as String? ?? json['name'] as String? ?? '',
      order: json['order'] as int? ?? 0,
      isActive: json['isActive'] as bool? ?? true,
    );
  }

  /// Convertit en JSON.
  Map<String, dynamic> toJson() => {
        'id': id,
        'code': code,
        'name': name,
        'label': label,
        'order': order,
        'isActive': isActive,
      };

  /// Icône représentative du niveau.
  String get emoji {
    switch (code.toUpperCase()) {
      case 'MATERNELLE':
      case 'MAT':
        return '🧒';
      case 'PRIMAIRE':
      case 'PRI':
        return '📖';
      case 'SECONDAIRE':
      case 'SEC':
        return '🎓';
      default:
        return '🏫';
    }
  }

  /// Couleur sémantique du niveau (code hex).
  String get semanticColor {
    switch (code.toUpperCase()) {
      case 'MATERNELLE':
      case 'MAT':
        return '#F59E0B'; // warning/gold
      case 'PRIMAIRE':
      case 'PRI':
        return '#16A34A'; // success/green
      case 'SECONDAIRE':
      case 'SEC':
        return '#2563EB'; // info/blue
      default:
        return '#64748B'; // grey
    }
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SchoolLevelModel && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;
}
