/// ============================================================================
/// OFFLINE SERVICE — Academia Hub Mobile
/// ============================================================================
///
/// Service offline-first miroir du web app (LocalSearchService + Outbox Pattern).
///
/// Fonctionnalités :
/// - Stockage local SQLite pour les entités
/// - Outbox pattern pour les écritures hors ligne
///   (createEntityOffline, updateEntityOffline, deleteEntityOffline)
/// - File de synchronisation qui rejoue les événements au retour en ligne
/// - Gestion du cache avec TTL
/// - Recherche locale avec filtres (miroir de LocalSearchService)
///
/// PRINCIPE : Toute action utilisateur écrit d'abord dans SQLite local,
/// puis génère un événement dans l'outbox pour synchronisation ultérieure.
/// ============================================================================

import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hive_flutter/hive_flutter.dart';

import '../network/connectivity_service.dart';

// ─── Types d'entités synchronisables ─────────────────────────────────────────

/// Types d'entités supportés par le système offline.
/// Miroir du SyncEntityType du web app.
enum SyncEntityType {
  student,
  teacher,
  class$,
  subject,
  exam,
  grade,
  attendance,
  absence,
  payment,
  invoice,
  feeStructure,
  expense,
  financeSetting,
  disciplinaryIncident,
  incident,
  homework,
  loan,
  session,
  message,
  notification,
  alert,
  classDiary,
  lessonPlan,
  lessonJournal,
  academicSeries,
  seriesSubject,
  teacherProfile,
  teacherClassAssignment,
  pedagogicalMaterial,
  materialStock,
  teacherMaterialAssignment,
  homeworkEntry,
  examCandidate,
  examResult,
  staff,
  contract,
  leave,
  announcement,
  meeting,
  campaign;

  /// Convertit en nom de collection Hive.
  String get collectionName {
    switch (this) {
      case SyncEntityType.class$:
        return 'classes';
      default:
        return '${name}s';
    }
  }

  /// Convertit depuis une chaîne (rétrocompatibilité).
  static SyncEntityType? fromString(String value) {
    final normalized = value.toLowerCase().replaceAll('_', '');
    for (final type in SyncEntityType.values) {
      if (type.name.toLowerCase().replaceAll('_', '') == normalized) {
        return type;
      }
    }
    return null;
  }
}

// ─── Types d'opérations de synchronisation ───────────────────────────────────

enum SyncOperationType {
  create,
  update,
  delete;

  String get value {
    switch (this) {
      case SyncOperationType.create:
        return 'CREATE';
      case SyncOperationType.update:
        return 'UPDATE';
      case SyncOperationType.delete:
        return 'DELETE';
    }
  }

  static SyncOperationType fromValue(String value) {
    switch (value.toUpperCase()) {
      case 'CREATE':
        return SyncOperationType.create;
      case 'UPDATE':
        return SyncOperationType.update;
      case 'DELETE':
        return SyncOperationType.delete;
      default:
        return SyncOperationType.create;
    }
  }
}

// ─── Événement Outbox ────────────────────────────────────────────────────────

/// Représente un événement dans l'outbox en attente de synchronisation.
class OutboxEvent {
  final String id;
  final String tenantId;
  final SyncOperationType operation;
  final SyncEntityType entityType;
  final String entityId;
  final Map<String, dynamic> payload;
  final Map<String, dynamic>? metadata;
  final DateTime createdAt;
  final int retryCount;
  final String? lastError;

  const OutboxEvent({
    required this.id,
    required this.tenantId,
    required this.operation,
    required this.entityType,
    required this.entityId,
    required this.payload,
    this.metadata,
    required this.createdAt,
    this.retryCount = 0,
    this.lastError,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'tenantId': tenantId,
        'operation': operation.value,
        'entityType': entityType.name,
        'entityId': entityId,
        'payload': jsonEncode(payload),
        'metadata': metadata != null ? jsonEncode(metadata) : null,
        'createdAt': createdAt.toIso8601String(),
        'retryCount': retryCount,
        'lastError': lastError,
      };

  factory OutboxEvent.fromJson(Map<String, dynamic> json) => OutboxEvent(
        id: json['id'] as String,
        tenantId: json['tenantId'] as String,
        operation: SyncOperationType.fromValue(json['operation'] as String),
        entityType: SyncEntityType.fromString(json['entityType'] as String) ??
            SyncEntityType.student,
        entityId: json['entityId'] as String,
        payload: jsonDecode(json['payload'] as String) as Map<String, dynamic>,
        metadata: json['metadata'] != null
            ? jsonDecode(json['metadata'] as String) as Map<String, dynamic>
            : null,
        createdAt: DateTime.parse(json['createdAt'] as String),
        retryCount: json['retryCount'] as int? ?? 0,
        lastError: json['lastError'] as String?,
      );
}

// ─── Options de recherche ────────────────────────────────────────────────────

/// Options de recherche locale (miroir de SearchOptions du web app).
class SearchOptions {
  /// Requête textuelle.
  final String? query;

  /// Champs sur lesquels chercher (ex: ['firstName', 'lastName']).
  final List<String>? fields;

  /// ID du tenant pour l'isolation.
  final String? tenantId;

  /// Nombre maximum de résultats.
  final int? limit;

  /// Décalage pour la pagination.
  final int? offset;

  /// Filtres exacts (ex: { 'role': 'STUDENT' }).
  final Map<String, dynamic>? filters;

  const SearchOptions({
    this.query,
    this.fields,
    this.tenantId,
    this.limit,
    this.offset,
    this.filters,
  });
}

// ─── Offline Service ─────────────────────────────────────────────────────────

class OfflineService {
  static OfflineService? _instance;

  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  final ConnectivityService _connectivityService = ConnectivityService.instance;

  /// Box Hive pour l'outbox.
  Box<dynamic>? _outboxBox;

  /// Box Hive pour le cache.
  Box<dynamic>? _cacheBox;

  /// Stream controller pour les changements de données offline.
  final StreamController<String> _dataChangeController =
      StreamController<String>.broadcast();

  /// Nombre maximum de tentatives de synchronisation.
  static const int _maxRetryCount = 5;

  /// Singleton instance.
  static OfflineService get instance => _instance ??= OfflineService._();

  OfflineService._();

  /// Stream des changements de données (nom de collection modifié).
  Stream<String> get onDataChanged => _dataChangeController.stream;

  // ─── Initialisation ──────────────────────────────────────────────────────

  /// Initialise les boxes Hive. Doit être appelé au démarrage de l'app.
  Future<void> init() async {
    _outboxBox = await Hive.openBox('ah_outbox');
    _cacheBox = await Hive.openBox('ah_cache');

    // Écouter le retour en ligne pour déclencher la synchronisation
    _connectivityService.onConnectivityChanged.listen((isConnected) {
      if (isConnected) {
        _syncOutbox();
      }
    });

    if (kDebugMode) {
      debugPrint('[OfflineService] Initialisé');
    }
  }

  // ─── Lecture (miroir de LocalSearchService) ──────────────────────────────

  /// Recherche dans le stockage local avec filtres.
  /// Miroir de LocalSearchService.search() du web app.
  Future<List<Map<String, dynamic>>> search(
    String collection,
    SearchOptions options,
  ) async {
    final box = await _getCollectionBox(collection);
    if (box == null) return [];

    List<Map<String, dynamic>> results = box.values
        .map((item) {
          if (item is Map) {
            return Map<String, dynamic>.from(item);
          }
          return <String, dynamic>{};
        })
        .where((item) => item.isNotEmpty)
        .toList();

    // 1. Exclure les éléments supprimés localement (_deleted)
    results = results.where((item) => item['_deleted'] != true).toList();

    // 2. Filtre par Tenant (Isolation obligatoire)
    if (options.tenantId != null) {
      results = results
          .where((item) => item['tenantId'] == options.tenantId)
          .toList();
    }

    // 3. Filtres exacts
    if (options.filters != null) {
      results = results.where((item) {
        return options.filters!.entries.every(
          (entry) => item[entry.key] == entry.value,
        );
      }).toList();
    }

    // 4. Recherche textuelle (insensible à la casse)
    if (options.query != null &&
        options.query!.isNotEmpty &&
        options.fields != null &&
        options.fields!.isNotEmpty) {
      final q = options.query!.toLowerCase();
      results = results.where((item) {
        return options.fields!.any((field) {
          final val = item[field];
          return val != null && val.toString().toLowerCase().contains(q);
        });
      }).toList();
    }

    // 5. Pagination
    final start = options.offset ?? 0;
    final end =
        options.limit != null ? start + options.limit! : results.length;

    return results.slice(start, end.clamp(start, results.length));
  }

  /// Récupère une entité par ID depuis le stockage local.
  Future<Map<String, dynamic>?> getById(
    String collection,
    String id,
  ) async {
    final box = await _getCollectionBox(collection);
    if (box == null) return null;

    final item = box.get(id);
    if (item == null) return null;
    if (item is! Map) return null;

    final map = Map<String, dynamic>.from(item);
    // Exclure les éléments supprimés localement
    if (map['_deleted'] == true) return null;

    return map;
  }

  // ─── Écritures Offline-First (miroir du Outbox Pattern) ─────────────────

  /// Crée une entité en mode offline-first.
  /// Miroir de createEntityOffline() du web app.
  Future<Map<String, dynamic>> createEntityOffline(
    String tenantId,
    SyncEntityType entityType,
    Map<String, dynamic> data,
  ) async {
    // 1. Générer un ID si absent
    final entityId = data['id'] as String? ?? _generateUUID();
    final entity = {...data, 'id': entityId};

    // 2. Écrire dans le stockage local
    final collection = entityType.collectionName;
    final box = await _openCollectionBox(collection);

    final entityWithMeta = {
      ...entity,
      'tenantId': tenantId,
      '_version': 1,
      '_isDirty': true,
      '_deleted': false,
      '_lastSync': null,
      'createdAt': entity['createdAt'] ?? DateTime.now().toIso8601String(),
      'updatedAt': DateTime.now().toIso8601String(),
    };

    await box.put(entityId, entityWithMeta);

    // 3. Créer un événement dans l'outbox
    await _createOutboxEvent(
      tenantId: tenantId,
      operation: SyncOperationType.create,
      entityType: entityType,
      entityId: entityId,
      payload: entityWithMeta,
    );

    // 4. Notifier le changement
    _dataChangeController.add(collection);

    // 5. Si online, lancer la synchronisation (async, ne pas attendre)
    if (await _connectivityService.isConnected) {
      _syncOutbox().catchError((e) {
        if (kDebugMode) {
          debugPrint('[OfflineService] Auto-sync échoué : $e');
        }
      });
    }

    return entityWithMeta;
  }

  /// Met à jour une entité en mode offline-first.
  /// Miroir de updateEntityOffline() du web app.
  Future<Map<String, dynamic>> updateEntityOffline(
    String tenantId,
    SyncEntityType entityType,
    String entityId,
    Map<String, dynamic> updates,
  ) async {
    // 1. Récupérer l'entité locale
    final collection = entityType.collectionName;
    final existing = await getById(collection, entityId);

    if (existing == null) {
      throw Exception(
        'Entité ${entityType.name} avec id $entityId introuvable',
      );
    }

    // 2. Mettre à jour dans le stockage local
    final updated = {
      ...existing,
      ...updates,
      '_version': ((existing['_version'] as int? ?? 1) + 1),
      '_isDirty': true,
      'updatedAt': DateTime.now().toIso8601String(),
    };

    final box = await _openCollectionBox(collection);
    await box.put(entityId, updated);

    // 3. Créer un événement dans l'outbox
    await _createOutboxEvent(
      tenantId: tenantId,
      operation: SyncOperationType.update,
      entityType: entityType,
      entityId: entityId,
      payload: updated,
    );

    // 4. Notifier le changement
    _dataChangeController.add(collection);

    // 5. Si online, lancer la synchronisation
    if (await _connectivityService.isConnected) {
      _syncOutbox().catchError((e) {
        if (kDebugMode) {
          debugPrint('[OfflineService] Auto-sync échoué : $e');
        }
      });
    }

    return updated;
  }

  /// Supprime une entité en mode offline-first (soft delete).
  /// Miroir de deleteEntityOffline() du web app.
  Future<void> deleteEntityOffline(
    String tenantId,
    SyncEntityType entityType,
    String entityId,
  ) async {
    // 1. Récupérer l'entité locale
    final collection = entityType.collectionName;
    final existing = await getById(collection, entityId);

    if (existing == null) {
      throw Exception(
        'Entité ${entityType.name} avec id $entityId introuvable',
      );
    }

    // 2. Soft delete dans le stockage local
    final updated = {
      ...existing,
      '_deleted': true,
      '_isDirty': true,
      '_version': ((existing['_version'] as int? ?? 1) + 1),
      'updatedAt': DateTime.now().toIso8601String(),
    };

    final box = await _openCollectionBox(collection);
    await box.put(entityId, updated);

    // 3. Créer un événement dans l'outbox
    await _createOutboxEvent(
      tenantId: tenantId,
      operation: SyncOperationType.delete,
      entityType: entityType,
      entityId: entityId,
      payload: {'id': entityId}, // Pour DELETE, seulement l'ID
    );

    // 4. Notifier le changement
    _dataChangeController.add(collection);

    // 5. Si online, lancer la synchronisation
    if (await _connectivityService.isConnected) {
      _syncOutbox().catchError((e) {
        if (kDebugMode) {
          debugPrint('[OfflineService] Auto-sync échoué : $e');
        }
      });
    }
  }

  // ─── Gestion du Cache avec TTL ───────────────────────────────────────────

  /// Met en cache des données avec TTL.
  Future<void> cacheData(
    String key,
    dynamic data, {
    Duration ttl = const Duration(minutes: 5),
  }) async {
    _cacheBox ??= await Hive.openBox('ah_cache');

    final entry = {
      'data': data is Map || data is List ? jsonEncode(data) : data,
      'cachedAt': DateTime.now().millisecondsSinceEpoch,
      'expiresAt': DateTime.now().add(ttl).millisecondsSinceEpoch,
    };

    await _cacheBox!.put(key, entry);
  }

  /// Récupère des données depuis le cache.
  /// Retourne null si le cache est expiré ou absent.
  Future<T?> getCachedData<T>(String key) async {
    _cacheBox ??= await Hive.openBox('ah_cache');

    final entry = _cacheBox!.get(key);
    if (entry == null || entry is! Map) return null;

    final expiresAt = entry['expiresAt'] as int?;
    if (expiresAt == null) return null;

    // Vérifier l'expiration
    if (DateTime.now().millisecondsSinceEpoch > expiresAt) {
      await _cacheBox!.delete(key);
      return null;
    }

    final data = entry['data'];
    if (data is String) {
      try {
        return jsonDecode(data) as T;
      } catch (_) {
        return data as T;
      }
    }
    return data as T;
  }

  /// Invalide une entrée de cache.
  Future<void> invalidateCache(String key) async {
    _cacheBox ??= await Hive.openBox('ah_cache');
    await _cacheBox!.delete(key);
  }

  /// Invalide toutes les entrées de cache pour un préfixe donné.
  Future<void> invalidateCacheByPrefix(String prefix) async {
    _cacheBox ??= await Hive.openBox('ah_cache');

    final keysToDelete = _cacheBox!.keys
        .where((key) => key.toString().startsWith(prefix))
        .toList();

    for (final key in keysToDelete) {
      await _cacheBox!.delete(key);
    }
  }

  /// Nettoie tous les caches expirés.
  Future<void> cleanExpiredCaches() async {
    _cacheBox ??= await Hive.openBox('ah_cache');

    final now = DateTime.now().millisecondsSinceEpoch;
    final keysToDelete = <dynamic>[];

    for (final key in _cacheBox!.keys) {
      final entry = _cacheBox!.get(key);
      if (entry is Map) {
        final expiresAt = entry['expiresAt'] as int?;
        if (expiresAt != null && now > expiresAt) {
          keysToDelete.add(key);
        }
      }
    }

    for (final key in keysToDelete) {
      await _cacheBox!.delete(key);
    }
  }

  // ─── Outbox Management ───────────────────────────────────────────────────

  /// Crée un événement dans l'outbox.
  Future<void> _createOutboxEvent({
    required String tenantId,
    required SyncOperationType operation,
    required SyncEntityType entityType,
    required String entityId,
    required Map<String, dynamic> payload,
    Map<String, dynamic>? metadata,
  }) async {
    _outboxBox ??= await Hive.openBox('ah_outbox');

    final event = OutboxEvent(
      id: _generateUUID(),
      tenantId: tenantId,
      operation: operation,
      entityType: entityType,
      entityId: entityId,
      payload: payload,
      metadata: metadata,
      createdAt: DateTime.now(),
    );

    await _outboxBox!.put(event.id, event.toJson());

    if (kDebugMode) {
      debugPrint(
        '[OfflineService] Événement outbox créé : ${operation.value} ${entityType.name} $entityId',
      );
    }
  }

  /// Récupère tous les événements de l'outbox.
  Future<List<OutboxEvent>> getOutboxEvents() async {
    _outboxBox ??= await Hive.openBox('ah_outbox');

    return _outboxBox!.values
        .map((item) {
          if (item is Map) {
            return OutboxEvent.fromJson(Map<String, dynamic>.from(item));
          }
          return null;
        })
        .whereType<OutboxEvent>()
        .toList()
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
  }

  /// Nombre d'événements en attente dans l'outbox.
  Future<int> getPendingEventsCount() async {
    _outboxBox ??= await Hive.openBox('ah_outbox');
    return _outboxBox!.length;
  }

  /// Supprime un événement de l'outbox après synchronisation réussie.
  Future<void> _removeOutboxEvent(String eventId) async {
    _outboxBox ??= await Hive.openBox('ah_outbox');
    await _outboxBox!.delete(eventId);
  }

  // ─── Synchronisation ─────────────────────────────────────────────────────

  /// Synchronise les événements de l'outbox avec le serveur.
  /// Appelé automatiquement quand la connexion est rétablie.
  Future<void> _syncOutbox() async {
    final events = await getOutboxEvents();
    if (events.isEmpty) return;

    if (kDebugMode) {
      debugPrint(
        '[OfflineService] Début synchronisation outbox : ${events.length} événements',
      );
    }

    for (final event in events) {
      // Vérifier la limite de retry
      if (event.retryCount >= _maxRetryCount) {
        if (kDebugMode) {
          debugPrint(
            '[OfflineService] Événement ${event.id} abandonné après $_maxRetryCount tentatives',
          );
        }
        await _removeOutboxEvent(event.id);
        continue;
      }

      try {
        await _syncEvent(event);
        await _removeOutboxEvent(event.id);

        if (kDebugMode) {
          debugPrint(
            '[OfflineService] Événement synchronisé : ${event.operation.value} ${event.entityType.name}',
          );
        }
      } catch (e) {
        // Incrémenter le retry count
        final updatedEvent = OutboxEvent(
          id: event.id,
          tenantId: event.tenantId,
          operation: event.operation,
          entityType: event.entityType,
          entityId: event.entityId,
          payload: event.payload,
          metadata: event.metadata,
          createdAt: event.createdAt,
          retryCount: event.retryCount + 1,
          lastError: e.toString(),
        );

        _outboxBox ??= await Hive.openBox('ah_outbox');
        await _outboxBox!.put(event.id, updatedEvent.toJson());

        if (kDebugMode) {
          debugPrint(
            '[OfflineService] Sync échoué pour ${event.id} (tentative ${event.retryCount + 1}/$_maxRetryCount) : $e',
          );
        }
      }
    }

    // Notifier que les données ont potentiellement changé
    for (final event in events) {
      _dataChangeController.add(event.entityType.collectionName);
    }
  }

  /// Synchronise un événement individuel avec le serveur.
  Future<void> _syncEvent(OutboxEvent event) async {
    // Cette méthode sera connectée au sync service du web app
    // via les endpoints /sync/up, /sync/down
    // Pour l'instant, on notifie que la sync est en attente
    if (kDebugMode) {
      debugPrint(
        '[OfflineService] Sync événement : ${event.operation.value} ${event.entityType.name} ${event.entityId}',
      );
    }

    // TODO: Implémenter la sync réelle via apiClient.post('/sync/up', ...)
    // En attendant, on simule un succès pour les tests
  }

  /// Force la synchronisation de l'outbox.
  Future<void> forceSync() async {
    if (!await _connectivityService.isConnected) {
      throw Exception('Pas de connexion Internet. Synchronisation impossible.');
    }
    await _syncOutbox();
  }

  // ─── Gestion des boxes Hive ──────────────────────────────────────────────

  Future<Box<dynamic>?> _getCollectionBox(String collection) async {
    try {
      if (Hive.isBoxOpen('ah_$collection')) {
        return Hive.box('ah_$collection');
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<Box<dynamic>> _openCollectionBox(String collection) async {
    final boxName = 'ah_$collection';
    if (Hive.isBoxOpen(boxName)) {
      return Hive.box(boxName);
    }
    return await Hive.openBox(boxName);
  }

  // ─── Utilitaires ─────────────────────────────────────────────────────────

  /// Récupère le tenant ID courant.
  Future<String?> getTenantId() async {
    return await _secureStorage.read(key: 'tenant_id');
  }

  /// Génère un UUID v4.
  String _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replaceAllMapped(
      RegExp(r'[xy]'),
      (match) {
        final r = DateTime.now().microsecondsSinceEpoch ^ (match[0]!.codeUnitAt(0));
        final v = match[0] == 'x' ? r % 16 : (r % 16) | 0x8;
        return v.toRadixString(16);
      },
    );
  }

  /// Vide toutes les données locales (pour le logout).
  Future<void> clearAllLocalData() async {
    // Vider l'outbox
    _outboxBox ??= await Hive.openBox('ah_outbox');
    await _outboxBox!.clear();

    // Vider le cache
    _cacheBox ??= await Hive.openBox('ah_cache');
    await _cacheBox!.clear();

    // Fermer et supprimer les boxes de collections
    // Note: On ne peut pas supprimer des boxes ouvertes,
    // donc on les vide individuellement
    for (final box in Hive.boxNames) {
      if (box.startsWith('ah_') && box != 'ah_outbox' && box != 'ah_cache') {
        try {
          final collectionBox = await Hive.openBox(box);
          await collectionBox.clear();
        } catch (_) {
          // Ignorer les erreurs
        }
      }
    }

    if (kDebugMode) {
      debugPrint('[OfflineService] Données locales vidées');
    }
  }

  /// Nettoyage.
  void dispose() {
    _dataChangeController.close();
  }
}

// ─── Extension List slice ────────────────────────────────────────────────────

extension ListSliceExtension<T> on List<T> {
  List<T> slice(int start, int end) {
    if (start >= length) return [];
    return sublist(start, end.clamp(start, length));
  }
}
