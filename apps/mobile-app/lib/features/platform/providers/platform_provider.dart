/// ============================================================================
/// PLATFORM PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for the Platform Administration module.
///
/// Providers:
/// - platformDashboardProvider → Dashboard stats
/// - platformTenantsProvider   → Tenants list
/// - platformUsersProvider     → Users list
/// - platformAuditLogsProvider → Audit logs
/// - platformStatisticsProvider → Statistics
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final platformDashboardProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/platform/dashboard');
  return response is Map<String, dynamic> ? response : <String, dynamic>{};
});

final platformTenantsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/platform/tenants');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final platformUsersProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/platform/users');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final platformAuditLogsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/platform/audit');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final platformStatisticsProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/platform/statistics');
  return response is Map<String, dynamic> ? response : <String, dynamic>{};
});

class PlatformMutationNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;
  PlatformMutationNotifier(this._ref) : super(const AsyncValue.data(null));

  Future<bool> createTenant(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      _ref.invalidate(platformTenantsProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

final platformMutationProvider =
    StateNotifierProvider<PlatformMutationNotifier, AsyncValue<void>>(
        (ref) => PlatformMutationNotifier(ref));
