/// ============================================================================
/// SYNC STATUS PROVIDER — Academia Hub Mobile
/// ============================================================================
///
/// Riverpod providers for offline sync state.
/// Exposes outbox count, sync-in-progress flag, last sync time, and a
/// manual sync trigger.
///
/// All user-facing strings are in FRENCH.
/// ============================================================================

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../offline/offline_service.dart';

// ─── Outbox Count ─────────────────────────────────────────────────────────────

/// Provider that returns the number of pending outbox events.
///
/// Uses a periodic refresh approach: the count is read once on access.
/// To refresh, invalidate this provider.
final outboxCountProvider = FutureProvider<int>((Ref ref) async {
  return OfflineService.instance.getPendingEventsCount();
});

// ─── Sync In Progress ─────────────────────────────────────────────────────────

/// Whether a sync operation is currently in progress.
final isSyncingProvider = StateProvider<bool>((Ref ref) => false);

// ─── Last Sync Time ───────────────────────────────────────────────────────────

/// The timestamp of the last successful sync, or null if never synced.
final lastSyncTimeProvider = StateProvider<DateTime?>((Ref ref) => null);

// ─── Sync Now ─────────────────────────────────────────────────────────────────

/// Provider that triggers a force-sync when invoked.
///
/// Usage:
/// ```dart
/// ref.read(syncNowProvider);
/// ```
final syncNowProvider = Provider<void Function()>((Ref ref) {
  return () async {
    final isSyncing = ref.read(isSyncingProvider);
    if (isSyncing) return; // Prevent concurrent syncs

    ref.read(isSyncingProvider.notifier).state = true;

    try {
      await OfflineService.instance.forceSync();
      ref.read(lastSyncTimeProvider.notifier).state = DateTime.now();

      if (kDebugMode) {
        debugPrint('[SyncStatus] Synchronisation forcée réussie');
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[SyncStatus] Synchronisation forcée échouée : $e');
      }
    } finally {
      ref.read(isSyncingProvider.notifier).state = false;
      // Refresh outbox count after sync attempt
      ref.invalidate(outboxCountProvider);
    }
  };
});
