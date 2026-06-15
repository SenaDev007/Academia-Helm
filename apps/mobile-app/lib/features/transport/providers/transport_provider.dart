/// ============================================================================
/// TRANSPORT PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for the Transport module.
///
/// Providers:
/// - transportDashboardProvider → Dashboard stats
/// - transportRoutesProvider    → Routes list
/// - transportVehiclesProvider  → Vehicles list
/// - transportStudentsProvider  → Transported students list
/// - transportStatisticsProvider → Statistics
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final transportDashboardProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/transport/dashboard');
  return response is Map<String, dynamic> ? response : <String, dynamic>{};
});

final transportRoutesProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/transport/routes');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final transportVehiclesProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/transport/vehicles');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final transportStudentsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/transport/students');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final transportStatisticsProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/transport/statistics');
  return response is Map<String, dynamic> ? response : <String, dynamic>{};
});

class TransportMutationNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;
  TransportMutationNotifier(this._ref) : super(const AsyncValue.data(null));

  Future<bool> createRoute(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      _ref.invalidate(transportRoutesProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

final transportMutationProvider =
    StateNotifierProvider<TransportMutationNotifier, AsyncValue<void>>(
        (ref) => TransportMutationNotifier(ref));
