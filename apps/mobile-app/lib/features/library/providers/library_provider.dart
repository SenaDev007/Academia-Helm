/// ============================================================================
/// LIBRARY PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for the Library (Bibliothèque) module.
///
/// Providers:
/// - libraryDashboardProvider → Dashboard stats
/// - libraryCatalogProvider   → Catalog list
/// - libraryBorrowingsProvider → Borrowings list
/// - libraryReturnsProvider   → Returns list
/// - libraryStatisticsProvider → Statistics
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final libraryDashboardProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/library/dashboard');
  return response is Map<String, dynamic> ? response : <String, dynamic>{};
});

final libraryCatalogProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/library/catalog');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final libraryBorrowingsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/library/borrowings');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final libraryReturnsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/library/returns');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final libraryStatisticsProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/library/statistics');
  return response is Map<String, dynamic> ? response : <String, dynamic>{};
});

class LibraryMutationNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;
  LibraryMutationNotifier(this._ref) : super(const AsyncValue.data(null));

  Future<bool> createBorrowing(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      _ref.invalidate(libraryBorrowingsProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

final libraryMutationProvider =
    StateNotifierProvider<LibraryMutationNotifier, AsyncValue<void>>(
        (ref) => LibraryMutationNotifier(ref));
