import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../network/api_client.dart';
import '../network/api_config.dart';
import '../network/api_result.dart';
import 'tenant_state.dart';

/// Storage key for the currently selected tenant ID.
const String _selectedTenantIdKey = 'ah_selected_tenant_id';

/// Storage key for the cached list of user tenants.
const String _cachedTenantsKey = 'ah_cached_tenants';

/// Riverpod provider for the [TenantNotifier].
final tenantNotifierProvider =
    NotifierProvider<TenantNotifier, TenantState>(TenantNotifier.new);

/// Riverpod provider for the list of available tenants for the current user.
final availableTenantsProvider =
    FutureProvider<List<Tenant>>((Ref ref) async {
  final TenantNotifier notifier = ref.watch(tenantNotifierProvider.notifier);
  return notifier.fetchAvailableTenants();
});

/// Riverpod [Notifier] that manages the current tenant selection.
///
/// Responsibilities:
/// - Current selected tenant
/// - Available tenants for the user
/// - Switch tenant
/// - Persist selection to local storage
class TenantNotifier extends Notifier<TenantState> {
  TenantNotifier();

  /// In-memory cache of available tenants.
  List<Tenant> _availableTenants = <Tenant>[];

  @override
  TenantState build() {
    // On initialization, attempt to restore the previously selected tenant.
    _restoreSelectedTenant();
    return const TenantState.initial();
  }

  // ── Restore Selected Tenant ───────────────────────────────────────────

  /// Attempts to restore the selected tenant from local storage.
  Future<void> _restoreSelectedTenant() async {
    try {
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      final String? tenantId = prefs.getString(_selectedTenantIdKey);

      if (tenantId == null || tenantId.isEmpty) {
        state = const TenantState.initial();
        return;
      }

      // Try to find tenant in cached list first.
      final List<Tenant> cached = await _loadCachedTenants();
      final Tenant? match = cached.where((Tenant t) => t.id == tenantId).firstOrNull;

      if (match != null) {
        state = TenantState.selected(match);
      } else {
        // Fetch from API if not in cache.
        final ApiClient apiClient = ref.read(apiClientProvider);
        final ApiResult<List<Tenant>> result = await _fetchTenants(apiClient);

        result.when(
          success: (List<Tenant> tenants) {
            _availableTenants = tenants;
            final Tenant? found =
                tenants.where((Tenant t) => t.id == tenantId).firstOrNull;
            if (found != null) {
              state = TenantState.selected(found);
            } else {
              state = const TenantState.initial();
            }
          },
          failure: (_) {
            state = const TenantState.initial();
          },
          loading: () {
            state = const TenantState.loading();
          },
        );
      }
    } catch (_) {
      state = const TenantState.initial();
    }
  }

  // ── Fetch Available Tenants ───────────────────────────────────────────

  /// Fetches the list of tenants available to the currently authenticated
  /// user from the API.
  Future<List<Tenant>> fetchAvailableTenants() async {
    final ApiClient apiClient = ref.read(apiClientProvider);
    final ApiResult<List<Tenant>> result = await _fetchTenants(apiClient);

    return result.when(
      success: (List<Tenant> tenants) {
        _availableTenants = tenants;
        _cacheTenants(tenants);
        return tenants;
      },
      failure: (_) => <Tenant>[],
      loading: () => <Tenant>[],
    );
  }

  // ── Select Tenant ─────────────────────────────────────────────────────

  /// Selects a tenant for the current session and persists the selection.
  Future<void> selectTenant(Tenant tenant) async {
    state = const TenantState.loading();

    try {
      // Notify the backend about the tenant selection.
      final ApiClient apiClient = ref.read(apiClientProvider);
      await apiClient.postRaw(
        ApiConfig.tenantSelectionEndpoint,
        data: <String, dynamic>{'tenantId': tenant.id},
      );
    } catch (_) {
      // Swallow — the local selection is still valid.
    }

    // Persist locally.
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString(_selectedTenantIdKey, tenant.id);

    state = TenantState.selected(tenant);
  }

  // ── Switch Tenant ─────────────────────────────────────────────────────

  /// Switches the active tenant to a different one by [tenantId].
  ///
  /// Returns `true` on success, `false` if the tenant is not found in the
  /// available list.
  Future<bool> switchTenant(String tenantId) async {
    // Ensure available tenants are loaded.
    if (_availableTenants.isEmpty) {
      await fetchAvailableTenants();
    }

    final Tenant? tenant = _availableTenants
        .where((Tenant t) => t.id == tenantId)
        .firstOrNull;

    if (tenant == null) {
      return false;
    }

    await selectTenant(tenant);
    return true;
  }

  // ── Clear Tenant ──────────────────────────────────────────────────────

  /// Clears the current tenant selection (e.g. on logout).
  Future<void> clearTenant() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.remove(_selectedTenantIdKey);
    await prefs.remove(_cachedTenantsKey);
    _availableTenants = <Tenant>[];
    state = const TenantState.initial();
  }

  // ── Get Available Tenants ─────────────────────────────────────────────

  /// Returns the cached list of available tenants.
  List<Tenant> get availableTenants => List.unmodifiable(_availableTenants);

  // ── Private Helpers ───────────────────────────────────────────────────

  Future<ApiResult<List<Tenant>>> _fetchTenants(ApiClient apiClient) async {
    final ApiResult<Map<String, dynamic>> result =
        await apiClient.getRaw(ApiConfig.tenantsEndpoint);

    return result.when(
      success: (Map<String, dynamic> data) {
        final dynamic tenantsData = data['data'] ?? data['tenants'] ?? data;
        if (tenantsData is List) {
          final List<Tenant> tenants = tenantsData
              .cast<Map<String, dynamic>>()
              .map(Tenant.fromJson)
              .toList();
          return ApiResult<List<Tenant>>.success(tenants);
        }
        return const ApiResult<List<Tenant>>.success(<Tenant>[]);
      },
      failure: (ApiError error) => ApiResult<List<Tenant>>.failure(error),
      loading: () => const ApiResult<List<Tenant>>.loading(),
    );
  }

  /// Persists the tenant list to [SharedPreferences] as JSON.
  Future<void> _cacheTenants(List<Tenant> tenants) async {
    try {
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      final String json = jsonEncode(
        tenants.map((Tenant t) => t.toJson()).toList(),
      );
      await prefs.setString(_cachedTenantsKey, json);
    } catch (_) {
      // Swallow cache write errors.
    }
  }

  /// Loads the cached tenant list from [SharedPreferences].
  Future<List<Tenant>> _loadCachedTenants() async {
    try {
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      final String? json = prefs.getString(_cachedTenantsKey);
      if (json == null || json.isEmpty) return <Tenant>[];

      final List<dynamic> decoded = jsonDecode(json) as List<dynamic>;
      return decoded
          .cast<Map<String, dynamic>>()
          .map(Tenant.fromJson)
          .toList();
    } catch (_) {
      return <Tenant>[];
    }
  }
}
