/// Permission modules matching the web app's 17-module permission system.
///
/// Each module corresponds to a feature area in the application, and each
/// module can have 4 permission actions: READ, WRITE, DELETE, MANAGE.
enum PermissionModule {
  eleves,
  inscriptions,
  documentsScolaires,
  organisationPedagogique,
  materielPedagogique,
  examens,
  bulletins,
  finances,
  recouvrement,
  depenses,
  rh,
  paie,
  communication,
  parametres,
  anneesScolaires,
  orion,
  qhse,
}

/// Extension providing French display names for [PermissionModule].
extension PermissionModuleX on PermissionModule {
  /// French display name for the module.
  String get displayName {
    switch (this) {
      case PermissionModule.eleves:
        return 'Élèves';
      case PermissionModule.inscriptions:
        return 'Inscriptions';
      case PermissionModule.documentsScolaires:
        return 'Documents Scolaires';
      case PermissionModule.organisationPedagogique:
        return 'Organisation Pédagogique';
      case PermissionModule.materielPedagogique:
        return 'Matériel Pédagogique';
      case PermissionModule.examens:
        return 'Examens';
      case PermissionModule.bulletins:
        return 'Bulletins';
      case PermissionModule.finances:
        return 'Finances';
      case PermissionModule.recouvrement:
        return 'Recouvrement';
      case PermissionModule.depenses:
        return 'Dépenses';
      case PermissionModule.rh:
        return 'Ressources Humaines';
      case PermissionModule.paie:
        return 'Paie';
      case PermissionModule.communication:
        return 'Communication';
      case PermissionModule.parametres:
        return 'Paramètres';
      case PermissionModule.anneesScolaires:
        return 'Années Scolaires';
      case PermissionModule.orion:
        return 'Orion';
      case PermissionModule.qhse:
        return 'QHSE';
    }
  }

  /// API key name matching the web app's module identifiers.
  String get apiKey {
    switch (this) {
      case PermissionModule.eleves:
        return 'eleves';
      case PermissionModule.inscriptions:
        return 'inscriptions';
      case PermissionModule.documentsScolaires:
        return 'documents_scolaires';
      case PermissionModule.organisationPedagogique:
        return 'organisation_pedagogique';
      case PermissionModule.materielPedagogique:
        return 'materiel_pedagogique';
      case PermissionModule.examens:
        return 'examens';
      case PermissionModule.bulletins:
        return 'bulletins';
      case PermissionModule.finances:
        return 'finances';
      case PermissionModule.recouvrement:
        return 'recouvrement';
      case PermissionModule.depenses:
        return 'depenses';
      case PermissionModule.rh:
        return 'rh';
      case PermissionModule.paie:
        return 'paie';
      case PermissionModule.communication:
        return 'communication';
      case PermissionModule.parametres:
        return 'parametres';
      case PermissionModule.anneesScolaires:
        return 'annees_scolaires';
      case PermissionModule.orion:
        return 'orion';
      case PermissionModule.qhse:
        return 'qhse';
    }
  }

  /// Lookup a module by its API key name.
  static PermissionModule? fromApiKey(String key) {
    for (final module in PermissionModule.values) {
      if (module.apiKey == key) return module;
    }
    return null;
  }
}
