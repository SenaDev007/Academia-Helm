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

// ─── Dashboard Provider ──────────────────────────────────────────────────────

/// Fetches aggregation dashboard statistics.
final aggregationDashboardProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/aggregation/dashboard');
  return response is Map<String, dynamic> ? response : <String, dynamic>{};
});

// ─── Data Provider ────────────────────────────────────────────────────────────

/// Fetches the list of aggregated data sources.
final aggregationDataProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/aggregation/data');
  if (response is List) {
    return response.cast<Map<String, dynamic>>();
  }
  return [];
});

// ─── Reports Provider ─────────────────────────────────────────────────────────

/// Fetches aggregation reports.
final aggregationReportsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/aggregation/reports');
  if (response is List) {
    return response.cast<Map<String, dynamic>>();
  }
  return [];
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
