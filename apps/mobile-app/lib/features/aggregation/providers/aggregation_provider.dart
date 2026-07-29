/// ============================================================================
/// AGGREGATION PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for the Aggregation (Agrégation) module.
/// Provides data consolidation, reports, and statistics across modules.
///
/// Providers:
/// - aggregationDashboardProvider  → Dashboard statistics
/// - aggregationDataProvider       → Consolidated data list
/// - aggregationReportsProvider    → Aggregation reports list
/// - AggregationMutationNotifier   → Mutation operations
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




// ─── Dashboard Provider ──────────────────────────────────────────────────────

/// Fetches aggregation dashboard statistics.
final aggregationDashboardProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient.defaultInstance();
  return await _unwrapMap(client.getRaw('/aggregation/dashboard')) ?? <String, dynamic>{};
});

// ─── Data Provider ────────────────────────────────────────────────────────────

/// Fetches the list of aggregated data sources.
final aggregationDataProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  return await _unwrapList(ApiClient.defaultInstance().getRaw('/aggregation/data'));
});

// ─── Reports Provider ─────────────────────────────────────────────────────────

/// Fetches aggregation reports.
final aggregationReportsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  return await _unwrapList(ApiClient.defaultInstance().getRaw('/aggregation/reports'));
});

// ─── Mutation Notifier ────────────────────────────────────────────────────────

/// Notifier for aggregation mutations.
class AggregationMutationNotifier extends StateNotifier<AsyncValue<void>> {
  AggregationMutationNotifier() : super(const AsyncValue.data(null));

  Future<bool> refreshData() async {
    state = const AsyncValue.loading();
    try {
      // Trigger a refresh of aggregation data
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

/// Provider for aggregation mutation operations.
final aggregationMutationProvider =
    StateNotifierProvider<AggregationMutationNotifier, AsyncValue<void>>(
        (ref) => AggregationMutationNotifier());
