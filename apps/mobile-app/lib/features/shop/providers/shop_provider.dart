/// ============================================================================
/// SHOP PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for the Shop (Boutique) module.
///
/// Providers:
/// - shopDashboardProvider → Dashboard stats
/// - shopProductsProvider  → Products list
/// - shopOrdersProvider    → Orders list
/// - shopPaymentsProvider  → Payments list
/// - shopStatisticsProvider → Statistics
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final shopDashboardProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/shop/dashboard');
  return response is Map<String, dynamic> ? response : <String, dynamic>{};
});

final shopProductsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/shop/products');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final shopOrdersProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/shop/orders');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final shopPaymentsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/shop/payments');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final shopStatisticsProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/shop/statistics');
  return response is Map<String, dynamic> ? response : <String, dynamic>{};
});

class ShopMutationNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;
  ShopMutationNotifier(this._ref) : super(const AsyncValue.data(null));

  Future<bool> createProduct(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      _ref.invalidate(shopProductsProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

final shopMutationProvider =
    StateNotifierProvider<ShopMutationNotifier, AsyncValue<void>>(
        (ref) => ShopMutationNotifier(ref));
