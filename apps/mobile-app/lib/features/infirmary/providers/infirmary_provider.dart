/// ============================================================================
/// INFIRMARY PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for the Infirmary (Infirmerie) module.
///
/// Providers:
/// - infirmaryDashboardProvider  → Dashboard stats
/// - infirmaryVisitsProvider     → Visits list
/// - infirmaryMedicationsProvider → Medications list
/// - infirmaryStatisticsProvider → Statistics
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final infirmaryDashboardProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/infirmary/dashboard');
  return response is Map<String, dynamic> ? response : <String, dynamic>{};
});

final infirmaryVisitsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/infirmary/visits');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final infirmaryMedicationsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/infirmary/medications');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final infirmaryStatisticsProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/infirmary/statistics');
  return response is Map<String, dynamic> ? response : <String, dynamic>{};
});

class InfirmaryMutationNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;
  InfirmaryMutationNotifier(this._ref) : super(const AsyncValue.data(null));

  Future<bool> createVisit(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      _ref.invalidate(infirmaryVisitsProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

final infirmaryMutationProvider =
    StateNotifierProvider<InfirmaryMutationNotifier, AsyncValue<void>>(
        (ref) => InfirmaryMutationNotifier(ref));
