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
import '../../../core/network/api_result.dart';

// Helper to unwrap ApiResult<Map<String, dynamic>> to a plain Map (or null on failure).
Future<Map<String, dynamic>?> _unwrapMap(
    Future<ApiResult<Map<String, dynamic>>> future) async {
  try {
    final result = await future;
    return result.when<Map<String, dynamic>?>(
      success: (data) => data,
      failure: (_) => null,
      loading: () => null,
    );
  } catch (_) {
    return null;
  }
}

// Helper to unwrap ApiResult<Map<String, dynamic>> to a List<Map<String, dynamic>>.
// The API may return either a List directly or a Map with a 'data' key containing a List.
Future<List<Map<String, dynamic>>> _unwrapList(
    Future<ApiResult<Map<String, dynamic>>> future) async {
  try {
    final result = await future;
    return result.when<List<Map<String, dynamic>>>(
      success: (data) {
        if (data['data'] is List) {
          return (data['data'] as List)
              .map((e) => e is Map<String, dynamic>
                  ? e
                  : (e as Map).cast<String, dynamic>())
              .toList();
        }
        // Single object wrapped as list
        return [data];
      },
      failure: (_) => [],
      loading: () => [],
    );
  } catch (_) {
    return [];
  }
}




final platformDashboardProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient.defaultInstance();
  return await _unwrapMap(client.getRaw('/platform/dashboard')) ?? <String, dynamic>{};
});

final platformTenantsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient.defaultInstance();
  return await _unwrapList(client.getRaw('/platform/tenants'));
});

final platformUsersProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient.defaultInstance();
  return await _unwrapList(client.getRaw('/platform/users'));
});

final platformAuditLogsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient.defaultInstance();
  return await _unwrapList(client.getRaw('/platform/audit'));
});

final platformStatisticsProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient.defaultInstance();
  return await _unwrapMap(client.getRaw('/platform/statistics')) ?? <String, dynamic>{};
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
