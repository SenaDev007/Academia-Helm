// ============================================================================
// SYNC DELTA SERVICE — Synchronisation descendante Neon → Hive (mobile)
// ============================================================================
//
// Service qui appelle POST /api/sync/pull (endpoint RÉEL du backend NestJS)
// toutes les 60s et met à jour le cache Hive local avec les changements reçus.
//
// ⭐ FIX Task 74 :
//   - AVANT : GET /api/sync/delta?since=token — cet endpoint N'EXISTE PAS sur
//     le backend (le contrôleur sync n'expose que pull/push/status/tables/
//     schema-hash) → 404 systématique → le cache local ne se remplissait
//     jamais ("téléchargement local des données" sans effet).
//   - MAINTENANT : POST /api/sync/pull avec last_sync_at (delta) — le même
//     endpoint que le web-app, tenant-scopé côté serveur depuis le JWT, avec
//     X-Tenant-Id envoyé en plus pour lever toute ambiguïté de périmètre.
//
// ⚠️ READ-ONLY — Neon est la source de vérité. Ce service ne fait que LIRE
//    depuis Neon et écrire dans le cache Hive local. Aucune écriture vers Neon
//    (les écritures passent par l'outbox géré dans offline_service.dart).
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

/// Clé secure storage pour le timestamp de la dernière sync réussie
/// (remplace l'ancien « syncToken » — le backend pull fonctionne par date).
const String _lastSyncTokenKey = 'last_sync_at';

/// Tables tirées par la sync mobile (périmètre ALLÉGÉ — les seules tables
/// réellement lues hors ligne par l'app mobile). Évite de tirer les ~600
/// tables du schéma toutes les 60s comme le faisait le web avant son
/// propre filtrage ESSENTIAL_BOOTSTRAP_TABLES.
const List<String> _mobileSyncTables = <String>[
  'students',
  'student_enrollments',
  'guardians',
  'student_guardians',
  'classes',
  'school_levels',
  'subjects',
  'schedules',
  'student_accounts',
  'finance_transactions',
  'fee_structures',
  'fee_arrears',
  'fee_installments',
  'recovery_reminders',
  'finance_expenses',
  'evaluations',
  'grades',
  'report_cards',
  'report_card_items',
  'quarters',
  'attendance_records',
  'attendance_registers',
  'admissions',
  'staff',
  'teachers',
  'announcements',
  'messages',
];

/// Service de synchronisation descendante.
///
/// Architecture :
///   1. Au démarrage → première sync complète (récupère TOUT, pas de date)
///   2. Toutes les 60s → sync delta (récupère les changements depuis la date)
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
    receiveTimeout: const Duration(seconds: 60),
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
  /// ⭐ FIX Task 74 : POST /api/sync/pull (endpoint réel) avec last_sync_at.
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
      // ⭐ FIX Task 74 : clé 'ah_access_token' (TokenStorage) — l'ancienne clé
      //    'access_token' n'était jamais écrite → sync TOUJOURS en échec
      //    « Not authenticated » → le cache local ne se mettait jamais à jour.
      final token = await _secureStorage.read(key: 'ah_access_token') ??
          await _secureStorage.read(key: 'access_token');
      if (token == null) {
        return SyncResult(success: false, entitiesSynced: 0, error: 'Not authenticated');
      }

      // ⭐ FIX Task 74 (périmètre tenant) : envoyer X-Tenant-Id pour que la
      //    sync descendante ne charge QUE les données de l'école connectée.
      //    (Le backend scoppe de toute façon par le JWT — ce header lève
      //    toute ambiguïté côté garde multi-tenant.)
      final tenantId = await _resolveTenantId();

      // Récupérer le timestamp de la dernière sync réussie
      _lastSyncToken = await _getLastSyncToken();

      // Timestamp AVANT la requête — utilisé comme last_sync_at de secours
      // (marge anti-décalage horloge : quelques doublons re-tirés = upsert
      // idempotent, jamais de perte).
      final requestedAt = DateTime.now().toUtc();

      final body = <String, dynamic>{
        // ⭐ Périmètre mobile uniquement (voir _mobileSyncTables)
        'tables': _mobileSyncTables,
        if (_lastSyncToken != null) 'last_sync_at': _lastSyncToken,
        if (tenantId != null) 'tenant_id': tenantId,
        'device_id': 'mobile-${tenantId ?? 'unknown'}',
      };

      final response = await _dio.post<dynamic>(
        '/sync/pull',
        data: body,
        options: Options(headers: {
          'Authorization': 'Bearer $token',
          if (tenantId != null) 'X-Tenant-Id': tenantId,
        }),
      );

      if (response.statusCode != 200) {
        return SyncResult(
          success: false,
          entitiesSynced: 0,
          error: 'API error: ${response.statusCode}',
        );
      }

      final rawData = response.data;
      final Map<String, dynamic> data = rawData is Map<String, dynamic>
          ? rawData
          : const <String, dynamic>{};
      final entities =
          data['entities'] as Map<String, dynamic>? ?? <String, dynamic>{};

      // Mettre à jour le cache Hive local
      final count = await _updateLocalCache(entities);

      // Sauvegarder le nouveau timestamp de sync.
      // ⭐ Le backend renvoie `pulledAt` (camelCase). On retire une marge de
      //    sécurité de 5 s : les enregistrements créés PENDANT la requête
      //    seront re-tirés au prochain delta (upsert idempotent) au lieu
      //    d'être manqués pour toujours.
      final pulledAt = (data['pulledAt'] as String?) ??
          (data['pulled_at'] as String?) ??
          requestedAt.toIso8601String();
      final pulledAtDt = DateTime.tryParse(pulledAt);
      final effectiveLastSync = (pulledAtDt ?? requestedAt)
          .subtract(const Duration(seconds: 5));
      await _saveSyncToken(effectiveLastSync.toUtc().toIso8601String());
      _lastSyncToken = effectiveLastSync.toUtc().toIso8601String();

      _lastSyncAt = DateTime.now();

      debugPrint('[SyncDelta] Sync complete — $count entities, pulled_at: $pulledAt');

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

  /// Dernier timestamp de sync utilisé.
  String? get lastSyncToken => _lastSyncToken;

  // ── Helpers ──

  Future<String?> _getLastSyncToken() async {
    return await _secureStorage.read(key: _lastSyncTokenKey);
  }

  Future<void> _saveSyncToken(String token) async {
    await _secureStorage.write(key: _lastSyncTokenKey, value: token);
  }

  /// Résout le tenant connecté (même logique que OfflineService.getTenantId).
  /// Sources : 'ah_tenant_data' (TokenStorage) → 'tenant_id' → 'ah_selected_tenant_id'.
  Future<String?> _resolveTenantId() async {
    final tenantJson = await _secureStorage.read(key: 'ah_tenant_data');
    if (tenantJson != null && tenantJson.isNotEmpty) {
      try {
        final tenant = jsonDecode(tenantJson);
        if (tenant is Map<String, dynamic>) {
          final id = tenant['id'];
          if (id is String && id.isNotEmpty) return id;
        }
      } catch (_) {}
    }
    final legacy = await _secureStorage.read(key: 'tenant_id');
    if (legacy != null && legacy.isNotEmpty) return legacy;
    final selected = await _secureStorage.read(key: 'ah_selected_tenant_id');
    if (selected != null && selected.isNotEmpty) return selected;
    return null;
  }

  /// Met à jour le cache Hive avec les entités reçues.
  ///
  /// ⭐ FIX Task 74 : écrit dans les boxes `ah_<collection>` — la MÊME
  ///    convention que OfflineService (`_openCollectionBox('ah_$collection')`).
  ///    Avant : écriture dans la box nue ('students') alors que les lectures
  ///    offline cherchent 'ah_students' → les données téléchargées n'étaient
  ///    jamais servies en mode hors ligne.
  Future<int> _updateLocalCache(Map<String, dynamic> entities) async {
    var count = 0;

    for (final entry in entities.entries) {
      final entityType = entry.key;
      final items = entry.value as List?;
      if (items == null || items.isEmpty) continue;

      final collection = _entityTypeToBoxName(entityType);
      if (collection == null) continue;

      final box = await Hive.openBox('ah_$collection');

      for (final item in items) {
        final itemMap = item as Map<String, dynamic>;
        final id = itemMap['id'] as String?;
        if (id == null) continue;

        // Conserver la forme Map (comme OfflineService) plutôt que JSON
        // encodé — les lectures (search/getById) attendent des Maps.
        await box.put(id, Map<String, dynamic>.from(itemMap));
        count++;
      }
    }

    return count;
  }

  /// Mappe le nom de table (depuis l'API pull) vers le nom de COLLECTION
  /// OfflineService (la box réelle est préfixée `ah_` à l'écriture).
  ///
  /// ⭐ FIX Task 74 : le backend /sync/pull renvoie des noms de TABLES au
  ///    format snake_case pluriel ('students', 'student_enrollments'…).
  ///    L'ancien mapping n'acceptait que le camelCase ('studentEnrollments')
  ///    → aucune table ne matchait → 0 entité cachée même quand l'API
  ///    répondait correctement. On accepte désormais les deux formats.
  String? _entityTypeToBoxName(String entityType) {
    const mapping = {
      // ⭐ Noms de tables réels (snake_case — format du backend pull)
      'students': 'students',
      'student_enrollments': 'student_enrollments',
      'guardians': 'guardians',
      'student_guardians': 'student_guardians',
      'admissions': 'admissions',
      'classes': 'classes',
      'school_levels': 'school_levels',
      'subjects': 'subjects',
      'schedules': 'schedules',
      'student_accounts': 'student_accounts',
      'finance_transactions': 'finance_transactions',
      'fee_structures': 'fee_structures',
      'fee_arrears': 'fee_arrears',
      'fee_installments': 'fee_installments',
      'recovery_reminders': 'recovery_reminders',
      'finance_expenses': 'finance_expenses',
      'evaluations': 'evaluations',
      'grades': 'grades',
      'report_cards': 'report_cards',
      'report_card_items': 'report_card_items',
      'quarters': 'quarters',
      'attendance_records': 'attendance_records',
      'attendance_registers': 'attendance_registers',
      // Rétrocompatibilité camelCase (ancien format)
      'studentEnrollments': 'student_enrollments',
      'studentGuardians': 'student_guardians',
      'schoolLevels': 'school_levels',
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
      'reportCards': 'report_cards',
      'reportCardItems': 'report_card_items',
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
