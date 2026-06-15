/// ============================================================================
/// CONFIG SERVICE — Academia Hub Mobile
/// ============================================================================
///
/// Service that fetches, caches, and manages the remote configuration.
/// This is the core of the dynamic synchronization system.
///
/// Responsibilities:
///   - Fetch full config from /api/context/bootstrap
///   - Fetch feature flags from /api/settings/features
///   - Fetch permissions from /api/permissions/my-permissions
///   - Cache config in Hive for offline support
///   - TTL-based cache invalidation (5 minutes)
///   - Emit config change notifications for reactive UI updates
///
/// All user-facing strings are in FRENCH.
/// ============================================================================

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

import '../api/client.dart';
import 'remote_config.dart';
import 'sync_event.dart';

// ─── Constants ───────────────────────────────────────────────────────────────

/// Hive box name for caching remote configuration.
const _kConfigBox = 'remote_config';

/// Hive key for the cached RemoteConfig JSON.
const _kConfigKey = 'cached_config';

/// Hive key for the last successful fetch timestamp.
const _kLastFetchKey = 'last_fetch_time';

/// Cache TTL: 5 minutes before we consider the config stale.
const _cacheTtl = Duration(minutes: 5);

/// API endpoints.
const _bootstrapEndpoint = '/context/bootstrap';
const _featuresEndpoint = '/settings/features';
const _permissionsEndpoint = '/permissions/my-permissions';

// ─── Config Service ──────────────────────────────────────────────────────────

/// Service that manages remote configuration fetching and caching.
///
/// Usage:
///   final configService = ConfigService.instance;
///   await configService.initialize();
///   final config = configService.getConfig();
class ConfigService with ChangeNotifier {
  static ConfigService? _instance;

  /// Singleton instance.
  static ConfigService get instance => _instance ??= ConfigService._();

  ConfigService._();

  // ─── State ──────────────────────────────────────────────────────────────

  /// The current remote configuration (in memory).
  RemoteConfig _config = RemoteConfig.empty;

  /// Whether the service has been initialized.
  bool _isInitialized = false;

  /// Whether a fetch is currently in progress.
  bool _isFetching = false;

  /// The last error that occurred during a fetch.
  String? _lastError;

  /// The current sync status.
  SyncStatus _syncStatus = const SyncStatus();

  /// Stream controller for sync events.
  final StreamController<SyncEvent> _eventController =
      StreamController<SyncEvent>.broadcast();

  /// Subscription to connectivity changes.
  StreamSubscription<ConnectivityResult>? _connectivitySub;

  // ─── Getters ────────────────────────────────────────────────────────────

  /// The current remote configuration.
  RemoteConfig get config => _config;

  /// Whether the service has been initialized.
  bool get isInitialized => _isInitialized;

  /// Whether a fetch is currently in progress.
  bool get isFetching => _isFetching;

  /// The last error that occurred during a fetch.
  String? get lastError => _lastError;

  /// The current sync status.
  SyncStatus get syncStatus => _syncStatus;

  /// Stream of sync events for real-time listeners.
  Stream<SyncEvent> get events => _eventController.stream;

  /// Whether the cached config is stale (older than TTL).
  bool get isConfigStale {
    final box = Hive.box(_kConfigBox);
    final lastFetchStr = box.get(_kLastFetchKey) as String?;
    if (lastFetchStr == null) return true;
    final lastFetch = DateTime.tryParse(lastFetchStr);
    if (lastFetch == null) return true;
    return DateTime.now().difference(lastFetch) > _cacheTtl;
  }

  /// The set of currently enabled feature codes.
  Set<String> get enabledFeatureCodes => _config.enabledFeatureCodes;

  /// Whether a specific feature is enabled.
  bool isFeatureEnabled(String featureCode) =>
      _config.isFeatureEnabled(featureCode);

  // ─── Initialization ─────────────────────────────────────────────────────

  /// Initializes the config service.
  /// Loads cached config from Hive and checks if a refresh is needed.
  Future<void> initialize() async {
    if (_isInitialized) return;

    // Ensure the Hive box is open
    if (!Hive.isBoxOpen(_kConfigBox)) {
      await Hive.openBox(_kConfigBox);
    }

    // Load cached config
    await _loadCachedConfig();

    // Listen for connectivity changes to auto-refresh
    _connectivitySub = Connectivity().onConnectivityChanged.listen((result) {
      if (result != ConnectivityResult.none && isConfigStale) {
        fetchAndApplyConfig();
      }
    });

    _isInitialized = true;
    notifyListeners();
  }

  // ─── Fetch & Apply ─────────────────────────────────────────────────────

  /// Fetches the full configuration from the backend and applies it.
  ///
  /// Calls /api/context/bootstrap which returns:
  ///   - modules (with sub-tabs, visibility, feature codes)
  ///   - features (enabled feature codes)
  ///   - roles (with permissions)
  ///   - academicYear
  ///   - schoolLevels
  ///   - tenantSettings
  ///
  /// On success, caches the result in Hive and notifies listeners.
  /// On failure, falls back to cached config (offline support).
  Future<RemoteConfig> fetchAndApplyConfig() async {
    if (_isFetching) return _config;

    _isFetching = true;
    _lastError = null;
    _updateSyncStatus(
      connectionState: SyncConnectionState.connecting,
    );
    notifyListeners();

    try {
      final api = ApiClient.instance;
      final response = await api.get(_bootstrapEndpoint);

      final data = response.data as Map<String, dynamic>;
      final newConfig = RemoteConfig.fromBootstrapResponse(data);

      _config = newConfig;
      await _cacheConfig(newConfig);

      _updateSyncStatus(
        connectionState: SyncConnectionState.connected,
        lastSyncTime: DateTime.now(),
        isOffline: false,
      );

      _emitEvent(SyncEvent(
        type: SyncEventType.fullSyncRequired,
        message: 'Configuration mise à jour avec succès',
      ));

      _isFetching = false;
      notifyListeners();
      return _config;
    } catch (e) {
      _isFetching = false;
      _lastError = 'Impossible de charger la configuration : $e';

      // Fall back to cached config if available
      final cached = await _loadCachedConfig();
      if (cached != null) {
        _config = cached;
        _updateSyncStatus(
          connectionState: SyncConnectionState.disconnected,
          isOffline: true,
          lastError: _lastError,
        );
        _emitEvent(SyncEvent(
          type: SyncEventType.disconnected,
          message:
              'Utilisation de la configuration en cache (mode hors ligne)',
        ));
      } else {
        _updateSyncStatus(
          connectionState: SyncConnectionState.disconnected,
          isOffline: true,
          lastError: _lastError,
        );
      }

      notifyListeners();
      return _config;
    }
  }

  // ─── Feature Flags ─────────────────────────────────────────────────────

  /// Refreshes only the feature flags from /api/settings/features.
  ///
  /// This is called when a `settings:features-updated` event is received
  /// via the real-time sync, avoiding a full bootstrap fetch.
  Future<Set<String>> refreshFeatureFlags() async {
    try {
      final api = ApiClient.instance;
      final response = await api.get(_featuresEndpoint);

      final data = response.data;
      List<dynamic> featureList;

      if (data is Map<String, dynamic>) {
        // API might return { "features": [...] } or { "enabledFeatureCodes": [...] }
        featureList = (data['features'] ?? data['enabledFeatureCodes'] ?? [])
            as List<dynamic>;
      } else if (data is List) {
        featureList = data;
      } else {
        featureList = [];
      }

      final newFeatures =
          featureList.map((e) => e.toString()).toSet();

      _config = _config.copyWith(
        enabledFeatureCodes: newFeatures,
        lastUpdated: DateTime.now(),
      );
      await _cacheConfig(_config);

      _emitEvent(SyncEvent(
        type: SyncEventType.featuresUpdated,
        data: {'codes': newFeatures.toList()},
        message: 'Fonctionnalités mises à jour',
      ));

      notifyListeners();
      return newFeatures;
    } catch (e) {
      _lastError = 'Impossible de rafraîchir les fonctionnalités : $e';
      notifyListeners();
      return _config.enabledFeatureCodes;
    }
  }

  // ─── Permissions ───────────────────────────────────────────────────────

  /// Refreshes only the permissions from /api/permissions/my-permissions.
  ///
  /// Called when a `settings:roles-updated` event is received.
  Future<List<String>> refreshPermissions() async {
    try {
      final api = ApiClient.instance;
      final response = await api.get(_permissionsEndpoint);

      final data = response.data as Map<String, dynamic>;
      final permissions = (data['permissions'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [];

      _emitEvent(SyncEvent(
        type: SyncEventType.rolesUpdated,
        data: {'permissions': permissions},
        message: 'Permissions mises à jour',
      ));

      notifyListeners();
      return permissions;
    } catch (e) {
      _lastError = 'Impossible de rafraîchir les permissions : $e';
      notifyListeners();
      return [];
    }
  }

  // ─── Config Access ─────────────────────────────────────────────────────

  /// Returns the current cached config.
  /// If the cache is stale, triggers a background refresh.
  RemoteConfig getConfig() {
    if (isConfigStale && !_isFetching) {
      fetchAndApplyConfig();
    }
    return _config;
  }

  /// Forces a full refresh regardless of cache TTL.
  Future<RemoteConfig> forceRefresh() async {
    return fetchAndApplyConfig();
  }

  // ─── Event Handling (from RealtimeSync) ─────────────────────────────────

  /// Handles a sync event from the real-time service.
  /// Dispatches to the appropriate refresh method based on event type.
  Future<void> handleSyncEvent(SyncEvent event) async {
    switch (event.type) {
      case SyncEventType.featuresUpdated:
        await refreshFeatureFlags();
        break;

      case SyncEventType.rolesUpdated:
        await refreshPermissions();
        break;

      case SyncEventType.modulesUpdated:
      case SyncEventType.tenantUpdated:
      case SyncEventType.academicYearChanged:
      case SyncEventType.fullSyncRequired:
        // Full refresh needed for these events
        await fetchAndApplyConfig();
        break;

      case SyncEventType.connected:
        _updateSyncStatus(
          connectionState: SyncConnectionState.connected,
          isOffline: false,
          lastError: null,
        );
        break;

      case SyncEventType.disconnected:
        _updateSyncStatus(
          connectionState: SyncConnectionState.disconnected,
          isOffline: true,
        );
        break;

      case SyncEventType.offlineSyncComplete:
        _updateSyncStatus(
          pendingMutations: event.data?['pending'] as int? ?? 0,
        );
        break;
    }
  }

  // ─── Cache Management ──────────────────────────────────────────────────

  /// Saves the config to Hive for offline access.
  Future<void> _cacheConfig(RemoteConfig config) async {
    final box = Hive.box(_kConfigBox);
    await box.put(_kConfigKey, config.toJsonString());
    await box.put(_kLastFetchKey, DateTime.now().toIso8601String());
  }

  /// Loads the cached config from Hive.
  /// Returns null if no cache exists.
  Future<RemoteConfig?> _loadCachedConfig() async {
    try {
      final box = Hive.box(_kConfigBox);
      final cachedJson = box.get(_kConfigKey) as String?;
      if (cachedJson == null) return null;

      final config = RemoteConfig.fromJsonString(cachedJson);
      _config = config;
      return config;
    } catch (e) {
      // Cache is corrupted — clear it
      await _clearCache();
      return null;
    }
  }

  /// Clears the cached config.
  Future<void> _clearCache() async {
    final box = Hive.box(_kConfigBox);
    await box.delete(_kConfigKey);
    await box.delete(_kLastFetchKey);
  }

  /// Clears all cached data and resets the service.
  Future<void> clearAll() async {
    await _clearCache();
    _config = RemoteConfig.empty;
    _lastError = null;
    _syncStatus = const SyncStatus();
    notifyListeners();
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  void _updateSyncStatus({
    SyncConnectionState? connectionState,
    DateTime? lastSyncTime,
    bool? isOffline,
    int? pendingMutations,
    String? lastError,
  }) {
    _syncStatus = _syncStatus.copyWith(
      connectionState: connectionState,
      lastSyncTime: lastSyncTime,
      isOffline: isOffline,
      pendingMutations: pendingMutations,
      lastError: lastError,
    );
  }

  void _emitEvent(SyncEvent event) {
    if (!_eventController.isClosed) {
      _eventController.add(event);
    }
  }

  // ─── Dispose ───────────────────────────────────────────────────────────

  @override
  void dispose() {
    _connectivitySub?.cancel();
    _eventController.close();
    super.dispose();
  }
}
