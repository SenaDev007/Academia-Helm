/// ============================================================================
/// CANTEEN PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for the Cantine module.
///
/// Providers:
/// - canteenDashboardProvider  → Dashboard stats
/// - canteenMenusProvider      → Menus list
/// - canteenReservationsProvider → Reservations list
/// - canteenPaymentsProvider   → Payments list
/// - canteenStatisticsProvider → Statistics
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final canteenDashboardProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/canteen/dashboard');
  return response is Map<String, dynamic> ? response : <String, dynamic>{};
});

final canteenMenusProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/canteen/menus');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final canteenReservationsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/canteen/reservations');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final canteenPaymentsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/canteen/payments');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final canteenStatisticsProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/canteen/statistics');
  return response is Map<String, dynamic> ? response : <String, dynamic>{};
});

class CanteenMutationNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;
  CanteenMutationNotifier(this._ref) : super(const AsyncValue.data(null));

  Future<bool> createMenu(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      _ref.invalidate(canteenMenusProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

final canteenMutationProvider =
    StateNotifierProvider<CanteenMutationNotifier, AsyncValue<void>>(
        (ref) => CanteenMutationNotifier(ref));
