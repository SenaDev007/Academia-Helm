/// ============================================================================
/// GENERAL PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for the General (Direction) module.
/// Provides direction dashboard, news, documents, and announcements.
///
/// Providers:
/// - generalDashboardProvider  → Direction dashboard stats
/// - generalNewsProvider       → News / actualités list
/// - generalDocumentsProvider  → Documents list
/// - generalAnnouncementsProvider → Announcements list
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

// ─── Dashboard Provider ──────────────────────────────────────────────────────

final generalDashboardProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final client = ApiClient.defaultInstance();
  final response = await client.getRaw('/general/dashboard');
  return response is Map<String, dynamic> ? response : <String, dynamic>{};
});

// ─── News Provider ────────────────────────────────────────────────────────────

final generalNewsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient.defaultInstance();
  final response = await client.getRaw('/general/news');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

// ─── Documents Provider ───────────────────────────────────────────────────────

final generalDocumentsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient.defaultInstance();
  final response = await client.getRaw('/general/documents');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

// ─── Announcements Provider ──────────────────────────────────────────────────

final generalAnnouncementsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final client = ApiClient.defaultInstance();
  final response = await client.getRaw('/general/announcements');
  if (response is List) return response.cast<Map<String, dynamic>>();
  return [];
});

// ─── Mutation Notifier ────────────────────────────────────────────────────────

class GeneralMutationNotifier extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;
  GeneralMutationNotifier(this._ref) : super(const AsyncValue.data(null));

  Future<bool> createAnnouncement(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      _ref.invalidate(generalAnnouncementsProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

final generalMutationProvider =
    StateNotifierProvider<GeneralMutationNotifier, AsyncValue<void>>(
        (ref) => GeneralMutationNotifier(ref));
