/// ============================================================================
/// EDUCAST PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for the EduCast module.
///
/// Providers:
/// - educastDashboardProvider → Dashboard stats
/// - educastChannelsProvider  → Channels list
/// - educastVideosProvider    → Videos list
/// - educastStatisticsProvider → Statistics
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final educastDashboardProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/educast/dashboard');
  return response is Map<String, dynamic> ? response : <String, dynamic>{};
});

final educastChannelsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/educast/channels');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final educastVideosProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/educast/videos');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

final educastStatisticsProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient();
  final response = await client.get('/educast/statistics');
  return response is Map<String, dynamic> ? response : <String, dynamic>{};
});

class EducastMutationNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;
  EducastMutationNotifier(this._ref) : super(const AsyncValue.data(null));

  Future<bool> createChannel(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      _ref.invalidate(educastChannelsProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

final educastMutationProvider =
    StateNotifierProvider<EducastMutationNotifier, AsyncValue<void>>(
        (ref) => EducastMutationNotifier(ref));
