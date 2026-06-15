/// ============================================================================
/// CONFIG PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for the dynamic configuration system.
/// These providers bridge the ConfigService with the widget tree,
/// enabling reactive UI updates when the remote configuration changes.
///
/// Provider hierarchy:
///   remoteConfigProvider → dynamicModulesProvider → dynamicNavigationProvider
///                       → dynamicEnabledFeaturesProvider
///                       → syncStatusProvider
///
/// All user-facing strings are in FRENCH.
/// ============================================================================

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../enums/user_role.dart';
import '../enums/module_config.dart';
import '../auth/auth_notifier.dart';
import 'remote_config.dart';
import 'config_service.dart';
import 'sync_event.dart';
import 'module_config_dynamic.dart';

// ─── Config Service Provider ─────────────────────────────────────────────────

/// Provides the singleton ConfigService instance.
final configServiceProvider = Provider<ConfigService>((ref) {
  final service = ConfigService.instance;
  ref.onDispose(() {
    // Don't dispose the singleton — it's shared across the app
  });
  return service;
});

// ─── Remote Config Provider ──────────────────────────────────────────────────

/// AsyncNotifier that fetches and caches the remote configuration.
///
/// On first watch, initializes the ConfigService and fetches the config.
/// Re-fetches when the auth state changes (user logs in/out).
final remoteConfigProvider =
    AsyncNotifierProvider<RemoteConfigNotifier, RemoteConfig>(
  RemoteConfigNotifier.new,
);

class RemoteConfigNotifier extends AsyncNotifier<RemoteConfig> {
  StreamSubscription<SyncEvent>? _eventSub;

  @override
  Future<RemoteConfig> build() async {
    final configService = ref.watch(configServiceProvider);
    final authState = ref.watch(authNotifierProvider);

    // Clean up previous subscription
    _eventSub?.cancel();

    // Listen for sync events to trigger reactive updates
    _eventSub = configService.events.listen((event) {
      // When a config-changing event arrives, re-read the config
      if (event.type == SyncEventType.featuresUpdated ||
          event.type == SyncEventType.modulesUpdated ||
          event.type == SyncEventType.tenantUpdated ||
          event.type == SyncEventType.academicYearChanged ||
          event.type == SyncEventType.fullSyncRequired) {
        // Trigger a rebuild with the updated config
        state = AsyncData(configService.config);
      }
    });

    ref.onDispose(() {
      _eventSub?.cancel();
    });

    // If not authenticated, return empty config
    if (!authState.isAuthenticated) {
      return RemoteConfig.empty;
    }

    // Initialize the config service if needed
    if (!configService.isInitialized) {
      await configService.initialize();
    }

    // Fetch fresh config
    return configService.fetchAndApplyConfig();
  }

  /// Forces a refresh of the remote configuration.
  Future<void> refresh() async {
    final configService = ref.read(configServiceProvider);
    state = const AsyncLoading();
    try {
      final config = await configService.forceRefresh();
      state = AsyncData(config);
    } catch (e, st) {
      state = AsyncError(e, st);
    }
  }

  /// Refreshes only the feature flags.
  Future<void> refreshFeatures() async {
    final configService = ref.read(configServiceProvider);
    await configService.refreshFeatureFlags();
    state = AsyncData(configService.config);
  }

  /// Refreshes only the permissions.
  Future<void> refreshPermissions() async {
    final configService = ref.read(configServiceProvider);
    await configService.refreshPermissions();
    // Permissions don't change the config directly
  }
}

// ─── Dynamic Modules Provider ────────────────────────────────────────────────

/// Builds the list of ModuleConfig objects from the RemoteConfig.
///
/// This merges the hardcoded [allModules] with the remote configuration:
///   - Remote modules override local visibility, feature codes, and sub-tabs
///   - New remote modules that don't exist locally are created dynamically
///   - Modules hidden by the remote config are filtered out
///   - Modules are sorted according to the remote order (if provided)
final dynamicModulesProvider = Provider<List<ModuleConfig>>((ref) {
  final asyncConfig = ref.watch(remoteConfigProvider);
  final authState = ref.watch(authNotifierProvider);

  return asyncConfig.when(
    data: (config) {
      final portal = authState.currentPortal;
      if (portal == null) return <ModuleConfig>[];

      // Get the user's role codes for visibility filtering
      final userRole = authState.currentRole;
      final roleCodes = <String>[];
      if (userRole != null) {
        roleCodes.add(userRole.name);
      }

      // Build dynamic modules from remote config
      return buildDynamicModules(
        localModules: allModules,
        remoteConfig: config,
        portal: portal,
        roleCodes: roleCodes,
      );
    },
    loading: () {
      // While loading, use the hardcoded modules as fallback
      final portal = authState.currentPortal;
      if (portal == null) return <ModuleConfig>[];
      return getVisibleModules(portal);
    },
    error: (_, __) {
      // On error, fall back to hardcoded modules
      final portal = authState.currentPortal;
      if (portal == null) return <ModuleConfig>[];
      return getVisibleModules(portal);
    },
  );
});

// ─── Dynamic Enabled Features Provider ───────────────────────────────────────

/// Provides the set of enabled feature codes from the API.
///
/// This replaces the need for hardcoded feature flags. When the backend
/// enables or disables a feature, this set updates automatically.
final dynamicEnabledFeaturesProvider = Provider<Set<String>>((ref) {
  final asyncConfig = ref.watch(remoteConfigProvider);
  return asyncConfig.when(
    data: (config) => config.enabledFeatureCodes,
    loading: () => const <String>{},
    error: (_, __) => const <String>{},
  );
});

// ─── Dynamic Feature Check Provider ──────────────────────────────────────────

/// Provider that checks if a specific feature is enabled.
///
/// Usage:
///   final isEnabled = ref.watch(featureEnabledProvider('FINANCE'));
///   if (isEnabled) { ... }
final featureEnabledProvider =
    Provider.family<bool, String>((ref, featureCode) {
  final features = ref.watch(dynamicEnabledFeaturesProvider);
  return features.contains(featureCode);
});

// ─── Dynamic Navigation Provider ─────────────────────────────────────────────

/// Builds the navigation structure from the remote configuration.
///
/// Returns a list of NavigationItem objects that can be used directly
/// by the AdaptiveScaffold to build the bottom navigation bar or rail.
final dynamicNavigationProvider =
    Provider<List<NavigationItem>>((ref) {
  final modules = ref.watch(dynamicModulesProvider);
  final config = ref.watch(remoteConfigProvider);

  return config.when(
    data: (_) => modules
        .map((m) => NavigationItem(
              moduleConfig: m,
              isFeatureEnabled: m.featureCode == null ||
                  ref.read(featureEnabledProvider(m.featureCode ?? '')),
            ))
        .where((item) => item.isFeatureEnabled)
        .toList(),
    loading: () => modules
        .map((m) => NavigationItem(moduleConfig: m, isFeatureEnabled: true))
        .toList(),
    error: (_, __) => modules
        .map((m) => NavigationItem(moduleConfig: m, isFeatureEnabled: true))
        .toList(),
  );
});

// ─── Sync Status Provider ────────────────────────────────────────────────────

/// Provides the current sync status for display in the UI.
///
/// Use this to show connectivity indicators, offline banners, etc.
final syncStatusProvider = Provider<SyncStatus>((ref) {
  final configService = ref.watch(configServiceProvider);
  return configService.syncStatus;
});

// ─── Academic Year Provider ──────────────────────────────────────────────────

/// Provides the current academic year from the remote config.
final academicYearProvider = Provider<RemoteAcademicYear?>((ref) {
  final asyncConfig = ref.watch(remoteConfigProvider);
  return asyncConfig.whenOrNull(
    data: (config) => config.academicYear,
  );
});

// ─── School Levels Provider ──────────────────────────────────────────────────

/// Provides the school levels from the remote config.
final schoolLevelsProvider = Provider<List<RemoteSchoolLevel>>((ref) {
  final asyncConfig = ref.watch(remoteConfigProvider);
  return asyncConfig.when(
    data: (config) => config.schoolLevels,
    loading: () => <RemoteSchoolLevel>[],
    error: (_, __) => <RemoteSchoolLevel>[],
  );
});

// ─── Tenant Settings Provider ────────────────────────────────────────────────

/// Provides the tenant settings from the remote config.
final tenantSettingsProvider = Provider<RemoteTenantSettings>((ref) {
  final asyncConfig = ref.watch(remoteConfigProvider);
  return asyncConfig.when(
    data: (config) => config.tenantSettings,
    loading: () => const RemoteTenantSettings(),
    error: (_, __) => const RemoteTenantSettings(),
  );
});

// ─── Navigation Item ─────────────────────────────────────────────────────────

/// A navigation item combining a ModuleConfig with its feature state.
class NavigationItem {
  final ModuleConfig moduleConfig;
  final bool isFeatureEnabled;

  const NavigationItem({
    required this.moduleConfig,
    this.isFeatureEnabled = true,
  });
}

// ─── Portal Modules (Convenience) ────────────────────────────────────────────

/// Returns modules for the current user's portal, enriched with remote config.
final currentPortalModulesProvider = Provider<List<ModuleConfig>>((ref) {
  return ref.watch(dynamicModulesProvider);
});

/// Returns bottom navigation items (max 5) for the current portal.
final bottomNavItemsProvider = Provider<List<NavigationItem>>((ref) {
  final navItems = ref.watch(dynamicNavigationProvider);
  if (navItems.length <= 5) return navItems;

  // Take first 4 + profile module as last
  final first4 = navItems.sublist(0, 4);
  final profileItem = navItems.where(
      (item) => item.moduleConfig.id == 'profile');
  if (profileItem.isNotEmpty) {
    return [...first4, profileItem.first];
  }
  return first4;
});
