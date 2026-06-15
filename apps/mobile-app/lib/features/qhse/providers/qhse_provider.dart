/// ============================================================================
/// QHSE PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for the QHSE module.
///
/// Providers:
/// - qhseDashboardProvider   → Dashboard stats
/// - qhseAuditsProvider      → Audits list
/// - qhseIncidentsProvider   → Incidents list
/// - qhseRisksProvider       → Risks list
/// - qhseStatisticsProvider  → Statistics
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final qhseDashboardProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/qhse/dashboard');
  return response is Map<String, dynamic> ? response : <String, dynamic>{};
});

final qhseAuditsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/qhse/audits');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final qhseIncidentsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/qhse/incidents');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final qhseRisksProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/qhse/risks');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final qhseStatisticsProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/qhse/statistics');
  return response is Map<String, dynamic> ? response : <String, dynamic>{};
});

class QhseMutationNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;
  QhseMutationNotifier(this._ref) : super(const AsyncValue.data(null));

  Future<bool> createIncident(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      _ref.invalidate(qhseIncidentsProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

final qhseMutationProvider =
    StateNotifierProvider<QhseMutationNotifier, AsyncValue<void>>(
        (ref) => QhseMutationNotifier(ref));
