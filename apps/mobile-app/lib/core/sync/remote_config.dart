/// ============================================================================
/// REMOTE CONFIGURATION MODELS — Academia Hub Mobile
/// ============================================================================
///
/// Data models representing the remote configuration fetched from the backend.
/// These models mirror the API responses from:
///   - /api/context/bootstrap
///   - /api/settings/features
///   - /api/permissions/my-permissions
///
/// The mobile app uses these models to dynamically build its navigation,
/// feature flags, and UI without requiring code changes when the web app evolves.
/// ============================================================================

import 'dart:convert';

// ─── Remote Academic Year ────────────────────────────────────────────────────

/// Represents the current academic year as returned by the API.
class RemoteAcademicYear {
  final String id;
  final String label;
  final DateTime? startDate;
  final DateTime? endDate;
  final bool isActive;

  const RemoteAcademicYear({
    required this.id,
    required this.label,
    this.startDate,
    this.endDate,
    this.isActive = true,
  });

  factory RemoteAcademicYear.fromJson(Map<String, dynamic> json) {
    return RemoteAcademicYear(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      startDate: json['startDate'] != null
          ? DateTime.tryParse(json['startDate'] as String)
          : null,
      endDate: json['endDate'] != null
          ? DateTime.tryParse(json['endDate'] as String)
          : null,
      isActive: json['isActive'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'label': label,
        'startDate': startDate?.toIso8601String(),
        'endDate': endDate?.toIso8601String(),
        'isActive': isActive,
      };
}

// ─── Remote School Level ─────────────────────────────────────────────────────

/// Represents a school level (e.g., Maternelle, Primaire, Secondaire).
class RemoteSchoolLevel {
  final String id;
  final String label;
  final String? code;
  final int? order;

  const RemoteSchoolLevel({
    required this.id,
    required this.label,
    this.code,
    this.order,
  });

  factory RemoteSchoolLevel.fromJson(Map<String, dynamic> json) {
    return RemoteSchoolLevel(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      code: json['code'] as String?,
      order: json['order'] as int?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'label': label,
        'code': code,
        'order': order,
      };
}

// ─── Remote Role ─────────────────────────────────────────────────────────────

/// Represents a user role as returned by the API.
class RemoteRole {
  final String id;
  final String code;
  final String label;
  final String? portal;
  final List<String> permissions;

  const RemoteRole({
    required this.id,
    required this.code,
    required this.label,
    this.portal,
    this.permissions = const [],
  });

  factory RemoteRole.fromJson(Map<String, dynamic> json) {
    return RemoteRole(
      id: json['id'] as String? ?? '',
      code: json['code'] as String? ?? '',
      label: json['label'] as String? ?? '',
      portal: json['portal'] as String?,
      permissions: (json['permissions'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'code': code,
        'label': label,
        'portal': portal,
        'permissions': permissions,
      };
}

// ─── Remote SubTab ───────────────────────────────────────────────────────────

/// A single sub-tab within a remote module.
class RemoteSubTab {
  final String id;
  final String label;
  final String route;
  final String icon;
  final String? featureCode;
  final List<String> visibleToRoles;

  const RemoteSubTab({
    required this.id,
    required this.label,
    required this.route,
    required this.icon,
    this.featureCode,
    this.visibleToRoles = const [],
  });

  factory RemoteSubTab.fromJson(Map<String, dynamic> json) {
    return RemoteSubTab(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      route: json['route'] as String? ?? '',
      icon: json['icon'] as String? ?? 'circle',
      featureCode: json['featureCode'] as String?,
      visibleToRoles: (json['visibleToRoles'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'label': label,
        'route': route,
        'icon': icon,
        'featureCode': featureCode,
        'visibleToRoles': visibleToRoles,
      };
}

// ─── Remote Module ───────────────────────────────────────────────────────────

/// Represents a navigation module as returned by the API.
/// The mobile app dynamically builds its navigation from these objects.
class RemoteModule {
  final String id;
  final String label;
  final String route;
  final String icon;
  final String? featureCode;
  final bool isSupplementary;
  final List<RemoteSubTab> subTabs;
  final List<String> visibleToRoles;
  final List<String> portals;
  final int? order;

  const RemoteModule({
    required this.id,
    required this.label,
    required this.route,
    required this.icon,
    this.featureCode,
    this.isSupplementary = false,
    this.subTabs = const [],
    this.visibleToRoles = const [],
    this.portals = const [],
    this.order,
  });

  /// Whether this module requires a specific feature to be enabled.
  bool get requiresFeature => featureCode != null && featureCode!.isNotEmpty;

  factory RemoteModule.fromJson(Map<String, dynamic> json) {
    return RemoteModule(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      route: json['route'] as String? ?? '/',
      icon: json['icon'] as String? ?? 'circle',
      featureCode: json['featureCode'] as String?,
      isSupplementary: json['isSupplementary'] as bool? ?? false,
      subTabs: (json['subTabs'] as List<dynamic>?)
              ?.map((e) => RemoteSubTab.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      visibleToRoles: (json['visibleToRoles'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      portals: (json['portals'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      order: json['order'] as int?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'label': label,
        'route': route,
        'icon': icon,
        'featureCode': featureCode,
        'isSupplementary': isSupplementary,
        'subTabs': subTabs.map((e) => e.toJson()).toList(),
        'visibleToRoles': visibleToRoles,
        'portals': portals,
        'order': order,
      };
}

// ─── Remote Tenant Settings ──────────────────────────────────────────────────

/// Tenant-specific settings returned by the bootstrap API.
class RemoteTenantSettings {
  final String? schoolName;
  final String? schoolLogoUrl;
  final String? primaryColor;
  final String? accentColor;
  final String? locale;
  final String? timezone;
  final String? currency;
  final bool? enablePayments;
  final bool? enableMessaging;
  final bool? enableAttendance;
  final bool? enableGrades;
  final bool? enableSchedule;
  final Map<String, dynamic> custom;

  const RemoteTenantSettings({
    this.schoolName,
    this.schoolLogoUrl,
    this.primaryColor,
    this.accentColor,
    this.locale,
    this.timezone,
    this.currency,
    this.enablePayments,
    this.enableMessaging,
    this.enableAttendance,
    this.enableGrades,
    this.enableSchedule,
    this.custom = const {},
  });

  factory RemoteTenantSettings.fromJson(Map<String, dynamic> json) {
    return RemoteTenantSettings(
      schoolName: json['schoolName'] as String?,
      schoolLogoUrl: json['schoolLogoUrl'] as String?,
      primaryColor: json['primaryColor'] as String?,
      accentColor: json['accentColor'] as String?,
      locale: json['locale'] as String?,
      timezone: json['timezone'] as String?,
      currency: json['currency'] as String?,
      enablePayments: json['enablePayments'] as bool?,
      enableMessaging: json['enableMessaging'] as bool?,
      enableAttendance: json['enableAttendance'] as bool?,
      enableGrades: json['enableGrades'] as bool?,
      enableSchedule: json['enableSchedule'] as bool?,
      custom: json['custom'] as Map<String, dynamic>? ?? {},
    );
  }

  Map<String, dynamic> toJson() => {
        'schoolName': schoolName,
        'schoolLogoUrl': schoolLogoUrl,
        'primaryColor': primaryColor,
        'accentColor': accentColor,
        'locale': locale,
        'timezone': timezone,
        'currency': currency,
        'enablePayments': enablePayments,
        'enableMessaging': enableMessaging,
        'enableAttendance': enableAttendance,
        'enableGrades': enableGrades,
        'enableSchedule': enableSchedule,
        'custom': custom,
      };
}

// ─── Remote Config (Root) ────────────────────────────────────────────────────

/// The root remote configuration object fetched from /api/context/bootstrap.
///
/// This is the single source of truth for all dynamic configuration.
/// When the web app changes modules, features, or settings, the mobile app
/// automatically reflects those changes by refreshing this object.
class RemoteConfig {
  final List<RemoteModule> modules;
  final Set<String> enabledFeatureCodes;
  final List<RemoteRole> roles;
  final RemoteAcademicYear? academicYear;
  final List<RemoteSchoolLevel> schoolLevels;
  final RemoteTenantSettings tenantSettings;
  final DateTime lastUpdated;

  const RemoteConfig({
    this.modules = const [],
    this.enabledFeatureCodes = const {},
    this.roles = const [],
    this.academicYear,
    this.schoolLevels = const [],
    this.tenantSettings = const RemoteTenantSettings(),
    DateTime? lastUpdated,
  }) : lastUpdated = lastUpdated ?? _defaultTimestamp;

  static final DateTime _defaultTimestamp = DateTime(2000, 1, 1);

  /// Whether a specific feature is enabled.
  bool isFeatureEnabled(String featureCode) =>
      enabledFeatureCodes.contains(featureCode);

  /// Returns modules that are visible for a given portal code.
  List<RemoteModule> modulesForPortal(String portalCode) {
    return modules.where((m) {
      // Module must belong to the portal
      if (m.portals.isNotEmpty && !m.portals.contains(portalCode)) {
        return false;
      }
      // Module must not require a disabled feature
      if (m.requiresFeature && !isFeatureEnabled(m.featureCode!)) {
        return false;
      }
      return true;
    }).toList();
  }

  /// Returns modules filtered by both portal and user roles.
  List<RemoteModule> modulesForPortalAndRoles(
    String portalCode,
    List<String> roleCodes,
  ) {
    return modulesForPortal(portalCode).where((m) {
      if (m.visibleToRoles.isEmpty) return true;
      return m.visibleToRoles.any((r) => roleCodes.contains(r));
    }).toList();
  }

  /// Creates a RemoteConfig from the API JSON response.
  factory RemoteConfig.fromJson(Map<String, dynamic> json) {
    return RemoteConfig(
      modules: (json['modules'] as List<dynamic>?)
              ?.map((e) => RemoteModule.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      enabledFeatureCodes: Set<String>.from(
        json['enabledFeatureCodes'] as List<dynamic>? ?? [],
      ),
      roles: (json['roles'] as List<dynamic>?)
              ?.map((e) => RemoteRole.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      academicYear: json['academicYear'] != null
          ? RemoteAcademicYear.fromJson(
              json['academicYear'] as Map<String, dynamic>)
          : null,
      schoolLevels: (json['schoolLevels'] as List<dynamic>?)
              ?.map(
                  (e) => RemoteSchoolLevel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      tenantSettings: json['tenantSettings'] != null
          ? RemoteTenantSettings.fromJson(
              json['tenantSettings'] as Map<String, dynamic>)
          : const RemoteTenantSettings(),
      lastUpdated: DateTime.now(),
    );
  }

  /// Creates a RemoteConfig from the /api/context/bootstrap response format.
  factory RemoteConfig.fromBootstrapResponse(Map<String, dynamic> json) {
    final features = <String>{};
    if (json['features'] is List) {
      features.addAll(
        (json['features'] as List<dynamic>).map((e) => e.toString()),
      );
    } else if (json['enabledFeatureCodes'] is List) {
      features.addAll(
        (json['enabledFeatureCodes'] as List<dynamic>).map((e) => e.toString()),
      );
    }

    return RemoteConfig(
      modules: (json['modules'] as List<dynamic>?)
              ?.map((e) => RemoteModule.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      enabledFeatureCodes: features,
      roles: (json['roles'] as List<dynamic>?)
              ?.map((e) => RemoteRole.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      academicYear: json['academicYear'] != null
          ? RemoteAcademicYear.fromJson(
              json['academicYear'] as Map<String, dynamic>)
          : null,
      schoolLevels: (json['schoolLevels'] as List<dynamic>?)
              ?.map(
                  (e) => RemoteSchoolLevel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      tenantSettings: json['tenantSettings'] != null
          ? RemoteTenantSettings.fromJson(
              json['tenantSettings'] as Map<String, dynamic>)
          : const RemoteTenantSettings(),
      lastUpdated: DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
        'modules': modules.map((e) => e.toJson()).toList(),
        'enabledFeatureCodes': enabledFeatureCodes.toList(),
        'roles': roles.map((e) => e.toJson()).toList(),
        'academicYear': academicYear?.toJson(),
        'schoolLevels': schoolLevels.map((e) => e.toJson()).toList(),
        'tenantSettings': tenantSettings.toJson(),
        'lastUpdated': lastUpdated.toIso8601String(),
      };

  /// Serializes to JSON string for local caching.
  String toJsonString() => jsonEncode(toJson());

  /// Deserializes from JSON string (e.g., from Hive cache).
  static RemoteConfig fromJsonString(String jsonString) {
    return RemoteConfig.fromJson(
      jsonDecode(jsonString) as Map<String, dynamic>,
    );
  }

  /// Creates a copy with optional field overrides.
  RemoteConfig copyWith({
    List<RemoteModule>? modules,
    Set<String>? enabledFeatureCodes,
    List<RemoteRole>? roles,
    RemoteAcademicYear? academicYear,
    List<RemoteSchoolLevel>? schoolLevels,
    RemoteTenantSettings? tenantSettings,
    DateTime? lastUpdated,
  }) {
    return RemoteConfig(
      modules: modules ?? this.modules,
      enabledFeatureCodes: enabledFeatureCodes ?? this.enabledFeatureCodes,
      roles: roles ?? this.roles,
      academicYear: academicYear ?? this.academicYear,
      schoolLevels: schoolLevels ?? this.schoolLevels,
      tenantSettings: tenantSettings ?? this.tenantSettings,
      lastUpdated: lastUpdated ?? this.lastUpdated,
    );
  }

  /// An empty default config used before the first API fetch.
  static const RemoteConfig empty = RemoteConfig();
}
