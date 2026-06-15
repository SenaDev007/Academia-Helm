/// ============================================================================
/// DYNAMIC MODULE CONFIGURATION BUILDER — Academia Hub Mobile
/// ============================================================================
///
/// Bridges the gap between the API-driven RemoteConfig and the existing
/// ModuleConfig/UI system used by the adaptive scaffold.
///
/// When the backend adds, removes, or modifies modules, the mobile app
/// automatically reflects those changes through this builder:
///
///   1. Takes the hardcoded [allModules] as the base
///   2. Merges with remote configuration (remote overrides visibility,
///      feature codes, sub-tabs, labels, icons)
///   3. If a new module appears in remote config that doesn't exist locally,
///      creates a dynamic ModuleConfig
///   4. If a module is hidden in remote config but visible locally, hides it
///   5. Respects the remote ordering (if provided)
///
/// This module provides [buildDynamicModules] which works with the typed
/// [RemoteConfig] model. The lower-level [mergeWithRemoteConfig] in
/// module_config.dart works with raw JSON data.
///
/// All user-facing strings are in FRENCH.
/// ============================================================================

import '../enums/user_role.dart';
import '../enums/module_config.dart';
import 'remote_config.dart';

// ─── Dynamic Module Builder ──────────────────────────────────────────────────

/// Builds the dynamic module list from a typed [RemoteConfig] object.
///
/// This is the high-level function used by the config_provider to produce
/// the merged module list. It converts the typed RemoteConfig into the
/// format expected by [mergeWithRemoteConfig] in module_config.dart and
/// adds additional logic for:
///   - Sorting by remote order
///   - Checking explicit visibility (empty portals = hidden)
///   - Sub-tab merging with feature flag filtering
///
/// Parameters:
///   - [localModules]: The hardcoded [allModules] list
///   - [remoteConfig]: The typed configuration fetched from the API
///   - [portal]: The current user's portal type
///   - [roleCodes]: The current user's role codes for visibility filtering
///
/// Returns a list of [ModuleConfig] objects ready for the adaptive scaffold.
List<ModuleConfig> buildDynamicModules({
  required List<ModuleConfig> localModules,
  required RemoteConfig remoteConfig,
  required PortalType portal,
  required List<String> roleCodes,
}) {
  final result = <ModuleConfig>[];
  final processedIds = <String>{};

  // Step 1: Process remote modules (they take priority)
  for (final remoteModule in remoteConfig.modules) {
    // Check portal visibility
    if (!_isVisibleInPortal(remoteModule, portal)) {
      processedIds.add(remoteModule.id);
      continue;
    }

    // Check feature flag
    if (remoteModule.requiresFeature &&
        !remoteConfig.isFeatureEnabled(remoteModule.featureCode!)) {
      processedIds.add(remoteModule.id);
      continue;
    }

    // Check role visibility
    if (!_isVisibleForRoles(remoteModule, roleCodes)) {
      processedIds.add(remoteModule.id);
      continue;
    }

    // Find matching local module
    final localMatch = _findLocalModule(localModules, remoteModule.id);

    if (localMatch != null) {
      // Merge: remote overrides local, but keep local as base
      final merged = _mergeModule(localMatch, remoteModule, remoteConfig);
      result.add(merged);
    } else {
      // New module from remote — create dynamically
      final dynamicModule = _createDynamicModule(remoteModule, remoteConfig);
      result.add(dynamicModule);
    }

    processedIds.add(remoteModule.id);
  }

  // Step 2: Add local modules that weren't in the remote config
  // (graceful fallback — they remain visible unless explicitly hidden)
  for (final localModule in localModules) {
    if (processedIds.contains(localModule.id)) continue;

    // Check if this module should be visible for the current portal
    if (!localModule.isVisibleFor(portal)) continue;

    // Check if the remote config explicitly hides this module
    if (_isExplicitlyHidden(localModule.id, remoteConfig)) continue;

    // Check feature flag if the local module has a known feature code
    final fc = localModule.featureCode ?? getFeatureCodeForModule(localModule.id);
    if (fc != null && !remoteConfig.isFeatureEnabled(fc)) {
      continue;
    }

    result.add(localModule);
  }

  // Step 3: Sort by remote order if available
  _sortByRemoteOrder(result, remoteConfig);

  return result;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/// Checks if a remote module is visible in the given portal.
bool _isVisibleInPortal(RemoteModule remoteModule, PortalType portal) {
  if (remoteModule.portals.isEmpty) return true;

  final portalName = portal.name.toLowerCase();
  return remoteModule.portals.any(
    (p) => p.toLowerCase() == portalName,
  );
}

/// Checks if a remote module is visible for the given roles.
bool _isVisibleForRoles(RemoteModule remoteModule, List<String> roleCodes) {
  if (remoteModule.visibleToRoles.isEmpty) return true;
  return remoteModule.visibleToRoles.any(
    (r) => roleCodes.contains(r) || roleCodes.contains(r.toLowerCase()),
  );
}

/// Finds a local module matching the remote module ID.
ModuleConfig? _findLocalModule(List<ModuleConfig> localModules, String id) {
  for (final m in localModules) {
    if (m.id == id) return m;
  }
  return null;
}

/// Merges a local module with its remote counterpart.
/// Remote values take priority for overridable fields.
ModuleConfig _mergeModule(
  ModuleConfig local,
  RemoteModule remote,
  RemoteConfig config,
) {
  // Merge sub-tabs: prefer remote sub-tabs if provided
  final mergedSubTabs = remote.subTabs.isNotEmpty
      ? _mergeSubTabs(local.subTabs, remote.subTabs, config)
      : local.subTabs;

  // Determine portals: prefer remote if specified
  final mergedPortals = remote.portals.isNotEmpty
      ? _parsePortalTypesFromRemote(remote.portals)
      : local.portals;

  // Determine feature code: prefer remote if specified
  final mergedFeatureCode =
      remote.featureCode ?? local.featureCode ?? getFeatureCodeForModule(local.id);

  return ModuleConfig(
    id: local.id,
    label: remote.label.isNotEmpty ? remote.label : local.label,
    icon: remote.icon.isNotEmpty ? remote.icon : local.icon,
    route: remote.route.isNotEmpty ? remote.route : local.route,
    portals: mergedPortals,
    subTabs: mergedSubTabs,
    featureCode: mergedFeatureCode,
  );
}

/// Merges local sub-tabs with remote sub-tabs.
List<SubTab> _mergeSubTabs(
  List<SubTab> localSubTabs,
  List<RemoteSubTab> remoteSubTabs,
  RemoteConfig config,
) {
  final result = <SubTab>[];
  final processedIds = <String>{};

  // Process remote sub-tabs first (they take priority)
  for (final remoteTab in remoteSubTabs) {
    // Check feature flag for this sub-tab
    if (remoteTab.featureCode != null &&
        !config.isFeatureEnabled(remoteTab.featureCode!)) {
      continue;
    }

    // Find matching local sub-tab
    final localMatch = localSubTabs.where((t) => t.id == remoteTab.id).firstOrNull;

    if (localMatch != null) {
      result.add(SubTab(
        id: localMatch.id,
        label: remoteTab.label.isNotEmpty ? remoteTab.label : localMatch.label,
        icon: remoteTab.icon.isNotEmpty ? remoteTab.icon : localMatch.icon,
        route: remoteTab.route.isNotEmpty ? remoteTab.route : localMatch.route,
      ));
    } else {
      // New sub-tab from remote
      result.add(SubTab(
        id: remoteTab.id,
        label: remoteTab.label,
        icon: remoteTab.icon,
        route: remoteTab.route,
      ));
    }

    processedIds.add(remoteTab.id);
  }

  // Add local sub-tabs that weren't overridden
  for (final localTab in localSubTabs) {
    if (!processedIds.contains(localTab.id)) {
      result.add(localTab);
    }
  }

  return result;
}

/// Creates a dynamic ModuleConfig from a RemoteModule that has no local equivalent.
/// This allows the backend to add entirely new modules without mobile code changes.
ModuleConfig _createDynamicModule(RemoteModule remote, RemoteConfig config) {
  // Filter sub-tabs by feature flags
  final visibleSubTabs = remote.subTabs.where((tab) {
    if (tab.featureCode == null) return true;
    return config.isFeatureEnabled(tab.featureCode!);
  }).map((tab) => SubTab(
        id: tab.id,
        label: tab.label,
        icon: tab.icon,
        route: tab.route,
      )).toList();

  return ModuleConfig(
    id: remote.id,
    label: remote.label,
    icon: remote.icon,
    route: remote.route,
    portals: _parsePortalTypesFromRemote(remote.portals),
    subTabs: visibleSubTabs,
    featureCode: remote.featureCode,
  );
}

/// Parses a list of portal name strings into PortalType enums.
List<PortalType> _parsePortalTypesFromRemote(List<String> portalNames) {
  return portalNames.map((name) {
    switch (name.toLowerCase()) {
      case 'platform':
        return PortalType.platform;
      case 'school':
        return PortalType.school;
      case 'teacher':
        return PortalType.teacher;
      case 'parent':
        return PortalType.parent;
      case 'public':
        return PortalType.public;
      default:
        return PortalType.public;
    }
  }).toList();
}

/// Checks if a module ID is explicitly hidden in the remote config.
///
/// A module is considered "explicitly hidden" if it appears in the remote
/// modules list but with no portals (empty portals = hidden everywhere).
bool _isExplicitlyHidden(String moduleId, RemoteConfig config) {
  for (final remote in config.modules) {
    if (remote.id == moduleId) {
      // Module is in remote config but with empty portals = explicitly hidden
      return remote.portals.isEmpty;
    }
  }
  // Module is not in remote config at all — not explicitly hidden
  return false;
}

/// Sorts the result list by the remote module order if specified.
void _sortByRemoteOrder(List<ModuleConfig> modules, RemoteConfig config) {
  if (config.modules.isEmpty) return;

  // Build an order map from the remote config
  final orderMap = <String, int>{};
  for (final remote in config.modules) {
    if (remote.order != null) {
      orderMap[remote.id] = remote.order!;
    }
  }

  // If no order information, don't sort
  if (orderMap.isEmpty) return;

  // Sort: modules with order come first (sorted by order),
  // modules without order keep their relative position
  modules.sort((a, b) {
    final orderA = orderMap[a.id];
    final orderB = orderMap[b.id];

    if (orderA != null && orderB != null) {
      return orderA.compareTo(orderB);
    }
    if (orderA != null) return -1;
    if (orderB != null) return 1;
    return 0;
  });
}
