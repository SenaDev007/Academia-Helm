/// Feature codes mirroring the web app's feature flag system.
///
/// Feature codes control module visibility. Default-enabled codes are
/// always available, while optional codes require feature flags.
enum FeatureCode {
  // ── Default Enabled (always visible) ────────────────────────────────
  students('STUDENTS'),
  finance('FINANCE'),
  exams('EXAMS'),
  pedagogy('PEDAGOGY'),
  hrPayroll('HR_PAYROLL'),
  communication('COMMUNICATION'),
  aggregation('AGGREGATION'),

  // ── Optional (feature-flagged) ──────────────────────────────────────
  orion('ORION'),
  library('LIBRARY'),
  transport('TRANSPORT'),
  canteen('CANTEEN'),
  infirmary('INFIRMARY'),
  qhse('QHSE'),
  educast('EDUCAST'),
  shop('SHOP'),

  // ── Special ─────────────────────────────────────────────────────────
  bilingualTrack('BILINGUAL_TRACK');

  const FeatureCode(this.code);
  final String code;

  /// Whether this feature code is enabled by default.
  bool get isDefaultEnabled {
    switch (this) {
      case FeatureCode.students:
      case FeatureCode.finance:
      case FeatureCode.exams:
      case FeatureCode.pedagogy:
      case FeatureCode.hrPayroll:
      case FeatureCode.communication:
      case FeatureCode.aggregation:
        return true;
      default:
        return false;
    }
  }

  /// Get the localized display name.
  String get displayName {
    switch (this) {
      case FeatureCode.students:
        return 'Élèves & Scolarité';
      case FeatureCode.finance:
        return 'Finances & Économat';
      case FeatureCode.exams:
        return 'Examens, Notes & Bulletins';
      case FeatureCode.pedagogy:
        return 'Organisation Pédagogique';
      case FeatureCode.hrPayroll:
        return 'Personnel, RH & Paie';
      case FeatureCode.communication:
        return 'Communication';
      case FeatureCode.aggregation:
        return 'Agrégation & Décision';
      case FeatureCode.orion:
        return 'ORION — Pilotage Direction';
      case FeatureCode.library:
        return 'Bibliothèque';
      case FeatureCode.transport:
        return 'Transport';
      case FeatureCode.canteen:
        return 'Cantine';
      case FeatureCode.infirmary:
        return 'Infirmerie';
      case FeatureCode.qhse:
        return 'QHSE';
      case FeatureCode.educast:
        return 'EduCast';
      case FeatureCode.shop:
        return 'Boutique';
      case FeatureCode.bilingualTrack:
        return 'Fil Bilingue';
    }
  }
}
