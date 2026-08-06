// ============================================================================
// SYNC DELTA SERVICE — Synchronisation descendante Neon → Hive (mobile)
// ============================================================================
//
// Service qui appelle GET /api/sync/delta?since=lastSyncToken toutes les 60s.
// Met à jour le cache Hive local avec les changements reçus depuis Neon.
//
// ⚠️ READ-ONLY — Neon est la source de vérité. Ce service ne fait que LIRE
//    depuis Neon et écrire dans le cache Hive local. Aucune écriture vers Neon
//    (sauf queue offline gérée par offline_service.dart).
// ============================================================================

import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../network/api_config.dart';
import '../network/connectivity_service.dart';

/// Fréquence de sync descendante (60 secondes)
const Duration _syncInterval = Duration(seconds: 60);

/// Clé Hive pour stocker le dernier syncToken
const String _lastSyncTokenKey = 'last_sync_token';

/// Service de synchronisation descendante.
///
/// Architecture :
///   1. Au démarrage → première sync complète (récupère TOUT)
///   2. Toutes les 60s → sync delta (récupère les changements)
///   3. Au retour de connexion → sync immédiate
///   4. Bouton "Synchroniser" manuel → sync immédiate
class SyncDeltaService {
  static SyncDeltaService? _instance;
  static SyncDeltaService get instance {
    _instance ??= SyncDeltaService._();
    return _instance!;
  }

  SyncDeltaService._();

  final Dio _dio = Dio(BaseOptions(
    baseUrl: ApiConfig.baseUrl,
    connectTimeout: const Duration(seconds: 30),
    receiveTimeout: const Duration(seconds: 30),
    headers: {'Content-Type': 'application/json'},
  ));

  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  Timer? _syncTimer;
  bool _isSyncing = false;
  String? _lastSyncToken;
  DateTime? _lastSyncAt;

  /// Démarre le worker de sync (à appeler au démarrage de l'app).
  void start() {
    if (_syncTimer != null) return; // déjà démarré

    debugPrint('[SyncDelta] Starting worker (interval: 60s)');

    // Première sync immédiate
    Timer(const Duration(seconds: 2), () => performSync());

    // Sync périodique
    _syncTimer = Timer.periodic(_syncInterval, (_) {
      if (ConnectivityService.instance.isOnline) {
        performSync();
      }
    });

    // Sync au retour de connexion
    ConnectivityService.instance.onConnectivityChanged.listen((isOnline) {
      if (isOnline) {
        debugPrint('[SyncDelta] Connection restored — triggering sync');
        performSync();
      }
    });
  }

  /// Arrête le worker.
  void stop() {
    _syncTimer?.cancel();
    _syncTimer = null;
    debugPrint('[SyncDelta] Worker stopped');
  }

  /// Exécute une sync delta.
  /// Appelle GET /api/sync/delta?since=lastSyncToken
  Future<SyncResult> performSync() async {
    if (_isSyncing) {
      return SyncResult(success: false, entitiesSynced: 0, error: 'Already syncing');
    }

    if (!ConnectivityService.instance.isOnline) {
      return SyncResult(success: false, entitiesSynced: 0, error: 'Offline');
    }

    _isSyncing = true;

    try {
      // Récupérer le token JWT
      final token = await _secureStorage.read(key: 'access_token');
      if (token == null) {
        return SyncResult(success: false, entitiesSynced: 0, error: 'Not authenticated');
      }

      // Récupérer le dernier syncToken
      _lastSyncToken = await _getLastSyncToken();

      // Appeler l'API
      final queryParameters = <String, dynamic>{};
      if (_lastSyncToken != null) {
        queryParameters['since'] = _lastSyncToken;
      }

      final response = await _dio.get(
        '/sync/delta',
        queryParameters: queryParameters,
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );

      if (response.statusCode != 200) {
        return SyncResult(
          success: false,
          entitiesSynced: 0,
          error: 'API error: ${response.statusCode}',
        );
      }

      final data = response.data as Map<String, dynamic>;
      final entities = data['entities'] as Map<String, dynamic>? ?? {};

      // Mettre à jour le cache Hive local
      final count = await _updateLocalCache(entities);

      // Sauvegarder le nouveau syncToken
      final newSyncToken = data['syncToken'] as String?;
      if (newSyncToken != null) {
        await _saveSyncToken(newSyncToken);
        _lastSyncToken = newSyncToken;
      }

      _lastSyncAt = DateTime.now();

      debugPrint('[SyncDelta] Sync complete — $count entities, token: $newSyncToken');

      return SyncResult(success: true, entitiesSynced: count);
    } on DioException catch (e) {
      debugPrint('[SyncDelta] Sync failed: ${e.message}');
      return SyncResult(
        success: false,
        entitiesSynced: 0,
        error: e.message ?? 'Network error',
      );
    } catch (e) {
      debugPrint('[SyncDelta] Sync failed: $e');
      return SyncResult(
        success: false,
        entitiesSynced: 0,
        error: e.toString(),
      );
    } finally {
      _isSyncing = false;
    }
  }

  /// Sync manuelle (bouton "Synchroniser").
  Future<SyncResult> manualSync() async {
    debugPrint('[SyncDelta] Manual sync triggered');
    return performSync();
  }

  /// Indique si une sync est en cours.
  bool get isSyncing => _isSyncing;

  /// Date de la dernière sync.
  DateTime? get lastSyncAt => _lastSyncAt;

  /// Dernier syncToken utilisé.
  String? get lastSyncToken => _lastSyncToken;

  // ── Helpers ──

  Future<String?> _getLastSyncToken() async {
    return await _secureStorage.read(key: _lastSyncTokenKey);
  }

  Future<void> _saveSyncToken(String token) async {
    await _secureStorage.write(key: _lastSyncTokenKey, value: token);
  }

  /// Met à jour le cache Hive avec les entités reçues.
  Future<int> _updateLocalCache(Map<String, dynamic> entities) async {
    var count = 0;

    for (final entry in entities.entries) {
      final entityType = entry.key;
      final items = entry.value as List?;
      if (items == null || items.isEmpty) continue;

      final boxName = _entityTypeToBoxName(entityType);
      if (boxName == null) continue;

      final box = await Hive.openBox(boxName);

      for (final item in items) {
        final itemMap = item as Map<String, dynamic>;
        final id = itemMap['id'] as String?;
        if (id == null) continue;

        await box.put(id, jsonEncode(itemMap));
        count++;
      }
    }

    return count;
  }

  /// Mappe le nom d'entité (depuis l'API) vers le nom de box Hive.
  String? _entityTypeToBoxName(String entityType) {
    const mapping = {
      'students': 'students',
      'studentEnrollments': 'student_enrollments',
      'guardians': 'guardians',
      'studentGuardians': 'student_guardians',
      'admissions': 'admissions',
      'classes': 'classes',
      'schoolLevels': 'school_levels',
      'subjects': 'subjects',
      'schedules': 'schedules',
      'cahierJournalEntries': 'cahier_journal',
      'pedagogicalFiches': 'pedagogical_fiches',
      'homeworkEntries': 'homework_entries',
      'pedagogicalTaskStudents': 'pedagogical_task_students',
      'studentAccounts': 'student_accounts',
      'financeTransactions': 'finance_transactions',
      'feeStructures': 'fee_structures',
      'feeArrears': 'fee_arrears',
      'feeInstallments': 'fee_installments',
      'recoveryReminders': 'recovery_reminders',
      'financeExpenses': 'finance_expenses',
      'evaluations': 'evaluations',
      'grades': 'grades',
      'reportCards': 'report_cards',
      'reportCardItems': 'report_card_items',
      'quarters': 'quarters',
      'attendanceRecords': 'attendance_records',
      'attendanceRegisters': 'attendance_registers',
    };

    return mapping[entityType];
  }
}

/// Résultat d'une sync.
class SyncResult {
  final bool success;
  final int entitiesSynced;
  final String? error;

  SyncResult({
    required this.success,
    required this.entitiesSynced,
    this.error,
  });
}
