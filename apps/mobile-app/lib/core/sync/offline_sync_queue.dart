/// ============================================================================
/// OFFLINE SYNC QUEUE — Academia Hub Mobile
/// ============================================================================
///
/// Queues mutations made while offline (creates, updates, deletes) and
/// replays them in order when the device is back online.
///
/// Features:
///   - Queues API mutations with full request details
///   - Persists queue to Hive (survives app restarts)
///   - Replays queued mutations in FIFO order when online
///   - Conflict resolution: server wins, with user notification
///   - Progress reporting for sync status
///   - Maximum queue size to prevent unbounded growth
///   - TTL for queued items (stale mutations are discarded)
///
/// All user-facing strings are in FRENCH.
/// ============================================================================

import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

import '../api/client.dart';
import 'sync_event.dart';

// ─── Constants ───────────────────────────────────────────────────────────────

/// Hive box name for the offline sync queue.
const _kQueueBox = 'offline_sync_queue';

/// Maximum number of queued mutations before oldest are discarded.
const _maxQueueSize = 100;

/// TTL for queued mutations: 24 hours.
const _queueTtl = Duration(hours: 24);

/// Delay between replay attempts for individual mutations.
const _replayDelayMs = 500;

// ─── Queued Mutation ─────────────────────────────────────────────────────────

/// Represents a single API mutation that was made while offline.
class QueuedMutation {
  /// Unique identifier for this mutation.
  final String id;

  /// HTTP method (POST, PUT, PATCH, DELETE).
  final String method;

  /// API endpoint path (e.g., "/students/123/attendance").
  final String path;

  /// Request body (JSON-serializable map).
  final Map<String, dynamic>? body;

  /// Query parameters.
  final Map<String, dynamic>? queryParameters;

  /// Timestamp when the mutation was originally attempted.
  final DateTime createdAt;

  /// Human-readable description of the mutation (for notifications).
  final String description;

  /// The type of entity being mutated (for conflict resolution).
  final String? entityType;

  /// The ID of the entity being mutated (for conflict resolution).
  final String? entityId;

  const QueuedMutation({
    required this.id,
    required this.method,
    required this.path,
    this.body,
    this.queryParameters,
    required this.createdAt,
    required this.description,
    this.entityType,
    this.entityId,
  });

  factory QueuedMutation.fromJson(Map<String, dynamic> json) {
    return QueuedMutation(
      id: json['id'] as String? ?? '',
      method: json['method'] as String? ?? 'POST',
      path: json['path'] as String? ?? '',
      body: json['body'] as Map<String, dynamic>?,
      queryParameters: json['queryParameters'] as Map<String, dynamic>?,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
      description: json['description'] as String? ?? '',
      entityType: json['entityType'] as String?,
      entityId: json['entityId'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'method': method,
        'path': path,
        'body': body,
        'queryParameters': queryParameters,
        'createdAt': createdAt.toIso8601String(),
        'description': description,
        'entityType': entityType,
        'entityId': entityId,
      };
}

// ─── Sync Result ─────────────────────────────────────────────────────────────

/// The result of replaying a single queued mutation.
enum MutationResult {
  /// The mutation was successfully applied on the server.
  success,

  /// There was a conflict (e.g., 409 Conflict) — server version wins.
  conflict,

  /// The mutation failed with a non-recoverable error.
  failed,

  /// The mutation was skipped (e.g., stale TTL exceeded).
  skipped,
}

// ─── Sync Progress ───────────────────────────────────────────────────────────

/// Progress information for the sync replay process.
class SyncProgress {
  /// Total number of mutations to replay.
  final int total;

  /// Number of mutations already replayed.
  final int completed;

  /// Number of successful replays.
  final int succeeded;

  /// Number of conflicts detected.
  final int conflicts;

  /// Number of failed replays.
  final int failed;

  /// Number of skipped mutations.
  final int skipped;

  const SyncProgress({
    this.total = 0,
    this.completed = 0,
    this.succeeded = 0,
    this.conflicts = 0,
    this.failed = 0,
    this.skipped = 0,
  });

  /// Progress as a value between 0.0 and 1.0.
  double get progress => total > 0 ? completed / total : 0.0;

  /// Whether all mutations have been processed.
  bool get isComplete => completed >= total;

  /// Human-readable summary (en français).
  String get summary {
    if (isComplete) {
      final parts = <String>[];
      if (succeeded > 0) parts.add('$succeeded réussie${succeeded > 1 ? "s" : ""}');
      if (conflicts > 0) parts.add('$conflicts en conflit');
      if (failed > 0) parts.add('$failed échouée${failed > 1 ? "s" : ""}');
      if (skipped > 0) parts.add('$skipped ignorée${skipped > 1 ? "s" : ""}');
      return parts.join(', ');
    }
    return '$completed / $total traitées';
  }

  SyncProgress copyWith({
    int? total,
    int? completed,
    int? succeeded,
    int? conflicts,
    int? failed,
    int? skipped,
  }) {
    return SyncProgress(
      total: total ?? this.total,
      completed: completed ?? this.completed,
      succeeded: succeeded ?? this.succeeded,
      conflicts: conflicts ?? this.conflicts,
      failed: failed ?? this.failed,
      skipped: skipped ?? this.skipped,
    );
  }
}

// ─── Offline Sync Queue Service ──────────────────────────────────────────────

/// Service that manages the offline mutation queue.
///
/// Usage:
///   final queue = OfflineSyncQueue.instance;
///   await queue.initialize();
///
///   // When a mutation fails due to offline state:
///   await queue.enqueue(QueuedMutation(...));
///
///   // When back online:
///   await queue.replayAll();
class OfflineSyncQueue with ChangeNotifier {
  static OfflineSyncQueue? _instance;

  /// Singleton instance.
  static OfflineSyncQueue get instance => _instance ??= OfflineSyncQueue._();

  OfflineSyncQueue._();

  // ─── State ──────────────────────────────────────────────────────────────

  /// Whether the queue has been initialized.
  bool _isInitialized = false;

  /// Whether a replay is currently in progress.
  bool _isReplaying = false;

  /// The current sync progress.
  SyncProgress _progress = const SyncProgress();

  /// Stream controller for progress updates.
  final StreamController<SyncProgress> _progressController =
      StreamController<SyncProgress>.broadcast();

  /// Stream controller for conflict notifications.
  final StreamController<QueuedMutation> _conflictController =
      StreamController<QueuedMutation>.broadcast();

  /// Subscription to connectivity changes.
  StreamSubscription<ConnectivityResult>? _connectivitySub;

  // ─── Getters ────────────────────────────────────────────────────────────

  /// Whether the queue is initialized.
  bool get isInitialized => _isInitialized;

  /// Whether a replay is currently in progress.
  bool get isReplaying => _isReplaying;

  /// The current sync progress.
  SyncProgress get progress => _progress;

  /// Stream of sync progress updates.
  Stream<SyncProgress> get onProgress => _progressController.stream;

  /// Stream of conflict notifications.
  Stream<QueuedMutation> get onConflict => _conflictController.stream;

  /// The number of mutations currently in the queue.
  int get queueLength {
    final box = Hive.box(_kQueueBox);
    return box.length;
  }

  /// Whether there are pending mutations.
  bool get hasPendingMutations => queueLength > 0;

  // ─── Initialization ─────────────────────────────────────────────────────

  /// Initializes the offline sync queue.
  Future<void> initialize() async {
    if (_isInitialized) return;

    if (!Hive.isBoxOpen(_kQueueBox)) {
      await Hive.openBox(_kQueueBox);
    }

    // Clean up expired mutations
    await _removeExpiredMutations();

    // Listen for connectivity changes to auto-replay
    _connectivitySub = Connectivity().onConnectivityChanged.listen((result) {
      if (result != ConnectivityResult.none && hasPendingMutations) {
        replayAll();
      }
    });

    _isInitialized = true;
  }

  // ─── Enqueue ────────────────────────────────────────────────────────────

  /// Adds a mutation to the offline queue.
  ///
  /// If the queue exceeds [_maxQueueSize], the oldest mutation is discarded.
  /// Returns the assigned queue ID.
  Future<String> enqueue(QueuedMutation mutation) async {
    if (!_isInitialized) await initialize();

    final box = Hive.box(_kQueueBox);

    // Enforce maximum queue size
    if (box.length >= _maxQueueSize) {
      // Remove the oldest entry
      final oldestKey = box.keys.first;
      await box.delete(oldestKey);
    }

    // Store the mutation
    await box.put(mutation.id, jsonEncode(mutation.toJson()));

    debugPrint(
        '[OfflineSync] Mutation ajoutée : ${mutation.description} '
        '(${mutation.method} ${mutation.path})');

    notifyListeners();
    return mutation.id;
  }

  /// Convenience method to enqueue a POST mutation.
  Future<String> enqueuePost({
    required String path,
    required Map<String, dynamic> body,
    required String description,
    String? entityType,
    String? entityId,
  }) {
    return enqueue(QueuedMutation(
      id: _generateId(),
      method: 'POST',
      path: path,
      body: body,
      createdAt: DateTime.now(),
      description: description,
      entityType: entityType,
      entityId: entityId,
    ));
  }

  /// Convenience method to enqueue a PUT mutation.
  Future<String> enqueuePut({
    required String path,
    required Map<String, dynamic> body,
    required String description,
    String? entityType,
    String? entityId,
  }) {
    return enqueue(QueuedMutation(
      id: _generateId(),
      method: 'PUT',
      path: path,
      body: body,
      createdAt: DateTime.now(),
      description: description,
      entityType: entityType,
      entityId: entityId,
    ));
  }

  /// Convenience method to enqueue a DELETE mutation.
  Future<String> enqueueDelete({
    required String path,
    required String description,
    String? entityType,
    String? entityId,
  }) {
    return enqueue(QueuedMutation(
      id: _generateId(),
      method: 'DELETE',
      path: path,
      createdAt: DateTime.now(),
      description: description,
      entityType: entityType,
      entityId: entityId,
    ));
  }

  // ─── Replay ────────────────────────────────────────────────────────────

  /// Replays all queued mutations in order.
  ///
  /// Mutations are replayed sequentially (FIFO) to maintain data consistency.
  /// After each mutation, a short delay is added to avoid overwhelming the
  /// server.
  ///
  /// Conflict resolution: server wins. If a 409 Conflict is received,
  /// the server's version is kept and the user is notified.
  Future<SyncProgress> replayAll() async {
    if (_isReplaying) return _progress;
    if (!hasPendingMutations) return const SyncProgress();

    _isReplaying = true;
    final box = Hive.box(_kQueueBox);

    // Load all mutations and sort by creation time (FIFO)
    final mutations = <QueuedMutation>[];
    for (final key in box.keys) {
      try {
        final jsonStr = box.get(key) as String?;
        if (jsonStr != null) {
          final json = jsonDecode(jsonStr) as Map<String, dynamic>;
          mutations.add(QueuedMutation.fromJson(json));
        }
      } catch (e) {
        // Corrupted entry — remove it
        await box.delete(key);
      }
    }

    mutations.sort((a, b) => a.createdAt.compareTo(b.createdAt));

    _progress = SyncProgress(total: mutations.length);
    _emitProgress();

    for (final mutation in mutations) {
      // Skip expired mutations
      if (_isExpired(mutation)) {
        await box.delete(mutation.id);
        _progress = _progress.copyWith(
          completed: _progress.completed + 1,
          skipped: _progress.skipped + 1,
        );
        _emitProgress();
        continue;
      }

      // Replay the mutation
      final result = await _replayMutation(mutation);

      switch (result) {
        case MutationResult.success:
          await box.delete(mutation.id);
          _progress = _progress.copyWith(
            completed: _progress.completed + 1,
            succeeded: _progress.succeeded + 1,
          );
          break;

        case MutationResult.conflict:
          await box.delete(mutation.id);
          _progress = _progress.copyWith(
            completed: _progress.completed + 1,
            conflicts: _progress.conflicts + 1,
          );
          // Notify about the conflict
          if (!_conflictController.isClosed) {
            _conflictController.add(mutation);
          }
          break;

        case MutationResult.failed:
          // Keep in queue for next replay attempt
          _progress = _progress.copyWith(
            completed: _progress.completed + 1,
            failed: _progress.failed + 1,
          );
          break;

        case MutationResult.skipped:
          await box.delete(mutation.id);
          _progress = _progress.copyWith(
            completed: _progress.completed + 1,
            skipped: _progress.skipped + 1,
          );
          break;
      }

      _emitProgress();

      // Small delay between replays
      if (mutations.indexOf(mutation) < mutations.length - 1) {
        await Future.delayed(const Duration(milliseconds: _replayDelayMs));
      }
    }

    _isReplaying = false;

    // Emit completion event
    ConfigService.instance.handleSyncEvent(SyncEvent(
      type: SyncEventType.offlineSyncComplete,
      data: {
        'replayed': _progress.succeeded,
        'conflicts': _progress.conflicts,
        'failed': _progress.failed,
        'skipped': _progress.skipped,
      },
      message: 'Synchronisation hors ligne terminée : ${_progress.summary}',
    ));

    notifyListeners();
    return _progress;
  }

  /// Replays a single mutation.
  Future<MutationResult> _replayMutation(QueuedMutation mutation) async {
    try {
      final api = ApiClient.instance;

      switch (mutation.method.toUpperCase()) {
        case 'POST':
          await api.post(mutation.path, data: mutation.body);
          break;
        case 'PUT':
          await api.put(mutation.path, data: mutation.body);
          break;
        case 'PATCH':
          await api.put(mutation.path, data: mutation.body);
          break;
        case 'DELETE':
          await api.delete(mutation.path);
          break;
        default:
          debugPrint('[OfflineSync] Méthode non supportée : ${mutation.method}');
          return MutationResult.skipped;
      }

      debugPrint('[OfflineSync] Mutation réussie : ${mutation.description}');
      return MutationResult.success;
    } catch (e) {
      // Check for conflict (409)
      if (e.toString().contains('409') || e.toString().contains('Conflict')) {
        debugPrint(
            '[OfflineSync] Conflit détecté : ${mutation.description} — '
            'la version serveur est conservée');
        return MutationResult.conflict;
      }

      // Check for "not found" (410/404) — entity was deleted on server
      if (e.toString().contains('404') || e.toString().contains('410')) {
        debugPrint(
            '[OfflineSync] Entité introuvable : ${mutation.description} — '
            'ignorée');
        return MutationResult.skipped;
      }

      debugPrint(
          '[OfflineSync] Échec mutation : ${mutation.description} — $e');
      return MutationResult.failed;
    }
  }

  // ─── Queue Management ──────────────────────────────────────────────────

  /// Returns all queued mutations (for debugging / admin UI).
  List<QueuedMutation> getAll() {
    final box = Hive.box(_kQueueBox);
    final mutations = <QueuedMutation>[];

    for (final key in box.keys) {
      try {
        final jsonStr = box.get(key) as String?;
        if (jsonStr != null) {
          final json = jsonDecode(jsonStr) as Map<String, dynamic>;
          mutations.add(QueuedMutation.fromJson(json));
        }
      } catch (_) {
        // Skip corrupted entries
      }
    }

    mutations.sort((a, b) => a.createdAt.compareTo(b.createdAt));
    return mutations;
  }

  /// Removes a specific mutation from the queue.
  Future<void> remove(String id) async {
    final box = Hive.box(_kQueueBox);
    await box.delete(id);
    notifyListeners();
  }

  /// Clears all mutations from the queue.
  Future<void> clearAll() async {
    final box = Hive.box(_kQueueBox);
    await box.clear();
    notifyListeners();
  }

  /// Removes expired mutations from the queue.
  Future<void> _removeExpiredMutations() async {
    final box = Hive.box(_kQueueBox);
    final keysToDelete = <dynamic>[];

    for (final key in box.keys) {
      try {
        final jsonStr = box.get(key) as String?;
        if (jsonStr != null) {
          final json = jsonDecode(jsonStr) as Map<String, dynamic>;
          final mutation = QueuedMutation.fromJson(json);
          if (_isExpired(mutation)) {
            keysToDelete.add(key);
          }
        }
      } catch (_) {
        // Corrupted entry — remove it
        keysToDelete.add(key);
      }
    }

    for (final key in keysToDelete) {
      await box.delete(key);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  /// Checks if a mutation has exceeded the TTL.
  bool _isExpired(QueuedMutation mutation) {
    return DateTime.now().difference(mutation.createdAt) > _queueTtl;
  }

  /// Generates a unique ID for a queued mutation.
  String _generateId() {
    return 'mq_${DateTime.now().millisecondsSinceEpoch}_${DateTime.now().microsecond}';
  }

  /// Emits the current progress.
  void _emitProgress() {
    if (!_progressController.isClosed) {
      _progressController.add(_progress);
    }
  }

  // ─── Dispose ───────────────────────────────────────────────────────────

  @override
  void dispose() {
    _connectivitySub?.cancel();
    _progressController.close();
    _conflictController.close();
    super.dispose();
  }
}
