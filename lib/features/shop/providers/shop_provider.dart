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




final shopDashboardProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient.defaultInstance();
  return await _unwrapMap(client.getRaw('/shop/dashboard')) ?? <String, dynamic>{};
});

final shopProductsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient.defaultInstance();
  return await _unwrapList(client.getRaw('/shop/products'));
});

final shopOrdersProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient.defaultInstance();
  return await _unwrapList(client.getRaw('/shop/orders'));
});

final shopPaymentsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient.defaultInstance();
  return await _unwrapList(client.getRaw('/shop/payments'));
});

final shopStatisticsProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient.defaultInstance();
  return await _unwrapMap(client.getRaw('/shop/statistics')) ?? <String, dynamic>{};
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
