/// ============================================================================
/// BASE CRUD SERVICE — Academia Hub Mobile
/// ============================================================================
///
/// Service CRUD générique qui implémente le pattern du web app :
/// - Online → Appel API
/// - Offline → LocalSearchService (lectures) ou Outbox Pattern (écritures)
///
/// Miroir du pattern utilisé dans chaque service du web app :
/// - students.service.ts
/// - finance.service.ts
/// - pedagogy.service.ts
/// etc.
///
/// Configuration (miroir TanStack Query) :
/// - staleTime = 60 secondes
/// - gcTime = 30 minutes
/// - retry = 1
/// ============================================================================

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../network/api_client.dart';
import '../network/api_config.dart';
import '../network/api_result.dart';
import '../network/connectivity_service.dart';
import '../offline/offline_service.dart';

// ─── Cache Configuration ─────────────────────────────────────────────────────

/// Configuration du cache (miroir de TanStack Query).
class CacheConfig {
  /// Durée pendant laquelle les données sont considérées fraîches.
  /// Miroir de staleTime=60s.
  final Duration staleTime;

  /// Durée avant que les données soient supprimées du cache.
  /// Miroir de gcTime=30min.
  final Duration gcTime;

  /// Nombre de tentatives en cas d'erreur.
  /// Miroir de retry=1.
  final int retryCount;

  /// TTL du cache local.
  final Duration localCacheTTL;

  const CacheConfig({
    this.staleTime = ApiConfig.staleTime,
    this.gcTime = ApiConfig.gcTime,
    this.retryCount = ApiConfig.retryCount,
    this.localCacheTTL = ApiConfig.defaultCacheTTL,
  });
}

// ─── Base CRUD Service ───────────────────────────────────────────────────────

/// Service CRUD de base générique qui implémente le pattern offline-first.
///
/// Usage :
/// ```dart
/// class StudentsService extends BaseCrudService {
///   StudentsService() : super(
///     endpoint: '/students',
///     collection: 'students',
///     entityType: SyncEntityType.student,
///   );
///
///   // Méthodes spécifiques au module...
/// }
/// ```
class BaseCrudService {
  // ─── Dépendances ────────────────────────────────────────────────────────

  final ApiClient _apiClient = ApiClient.instance;
  final OfflineService _offlineService = OfflineService.instance;
  final ConnectivityService _connectivityService = ConnectivityService.instance;
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();

  // ─── Configuration ──────────────────────────────────────────────────────

  /// Endpoint API de base (ex: '/students').
  final String endpoint;

  /// Nom de la collection dans le stockage local (ex: 'students').
  final String collection;

  /// Type d'entité pour l'outbox.
  final SyncEntityType entityType;

  /// Configuration du cache.
  final CacheConfig cacheConfig;

  // ─── Cache en mémoire ───────────────────────────────────────────────────

  /// Cache en mémoire avec timestamp.
  final Map<String, _CacheEntry> _memoryCache = {};

  BaseCrudService({
    required this.endpoint,
    required this.collection,
    required this.entityType,
    this.cacheConfig = const CacheConfig(),
  });

  // ─── Lecture ────────────────────────────────────────────────────────────

  /// Récupère toutes les entités.
  ///
  /// Pattern (miroir du web app) :
  /// - Online → Appel API
  /// - Offline → Lecture depuis le stockage local
  /// - Erreur API → Fallback vers stockage local
  Future<ApiResult<List<Map<String, dynamic>>>> getAll({
    Map<String, dynamic>? params,
  }) async {
    // Vérifier le cache en mémoire
    final cacheKey = _buildCacheKey('getAll', params);
    final cached = _getFromMemoryCache(cacheKey);
    if (cached != null) {
      return ApiSuccess(cached as List<Map<String, dynamic>>);
    }

    // Vérifier la connectivité
    final isConnected = await _connectivityService.isConnected;

    if (!isConnected) {
      // Hors ligne → lecture locale
      return _getAllFromLocal(params);
    }

    // En ligne → appel API
    try {
      final response = await _apiClient.get<List<dynamic>>(
        endpoint,
        queryParameters: params,
      );

      final data = (response.data as List<dynamic>)
          .map((item) => item as Map<String, dynamic>)
          .toList();

      // Mettre en cache
      _setMemoryCache(cacheKey, data);
      await _cacheResponseLocally(data);

      return ApiSuccess(data);
    } on DioException catch (e) {
      // Erreur API → fallback vers stockage local
      if (kDebugMode) {
        debugPrint(
          '[$runtimeType] API échouée pour $endpoint, fallback local : ${e.message}',
        );
      }
      return _getAllFromLocal(params);
    } catch (e) {
      return ApiFailure(ApiError(
        message: 'Erreur lors de la récupération des données : $e',
        type: ApiErrorType.unknown,
      ));
    }
  }

  /// Récupère une entité par ID.
  ///
  /// Pattern :
  /// - Online → Appel API
  /// - Offline → Lecture locale
  /// - Erreur API → Fallback local
  Future<ApiResult<Map<String, dynamic>>> getById(String id) async {
    // Vérifier le cache en mémoire
    final cacheKey = _buildCacheKey('getById', {'id': id});
    final cached = _getFromMemoryCache(cacheKey);
    if (cached != null) {
      return ApiSuccess(cached as Map<String, dynamic>);
    }

    final isConnected = await _connectivityService.isConnected;

    if (!isConnected) {
      return _getByIdFromLocal(id);
    }

    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        '$endpoint/$id',
      );

      final data = response.data as Map<String, dynamic>;

      _setMemoryCache(cacheKey, data);
      await _offlineService.cacheData(
        '$collection/$id',
        data,
        ttl: cacheConfig.localCacheTTL,
      );

      return ApiSuccess(data);
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[$runtimeType] API échouée pour $endpoint/$id, fallback local : ${e.message}',
        );
      }
      return _getByIdFromLocal(id);
    } catch (e) {
      return ApiFailure(ApiError(
        message: 'Erreur lors de la récupération : $e',
        type: ApiErrorType.unknown,
      ));
    }
  }

  // ─── Écritures ──────────────────────────────────────────────────────────

  /// Crée une nouvelle entité.
  ///
  /// Pattern (miroir du web app) :
  /// - Hors ligne → createEntityOffline (outbox)
  /// - En ligne → Appel API
  Future<ApiResult<Map<String, dynamic>>> create(
    Map<String, dynamic> data,
  ) async {
    final tenantId = await _getTenantId();
    final isConnected = await _connectivityService.isConnected;

    if (!isConnected && tenantId != null) {
      // Hors ligne → outbox pattern
      try {
        final result = await _offlineService.createEntityOffline(
          tenantId,
          entityType,
          data,
        );
        _invalidateMemoryCache();
        return ApiSuccess(result);
      } catch (e) {
        return ApiFailure(ApiError(
          message: 'Impossible de sauvegarder hors ligne : $e',
          type: ApiErrorType.unknown,
          isOffline: true,
        ));
      }
    }

    // En ligne → appel API
    try {
      final response = await _apiClient.post<Map<String, dynamic>>(
        endpoint,
        data: data,
      );

      final result = response.data as Map<String, dynamic>;
      _invalidateMemoryCache();

      // Mettre en cache local
      if (tenantId != null) {
        await _offlineService.cacheData(
          '$collection/${result['id']}',
          result,
          ttl: cacheConfig.localCacheTTL,
        );
      }

      return ApiSuccess(result);
    } on DioException catch (e) {
      final apiError = ApiError.fromDioException(e);

      // Si erreur réseau, tenter le fallback offline
      if (apiError.isOffline && tenantId != null) {
        try {
          final result = await _offlineService.createEntityOffline(
            tenantId,
            entityType,
            data,
          );
          _invalidateMemoryCache();
          return ApiSuccess(result);
        } catch (_) {
          // Fallback échoué aussi
        }
      }

      return ApiFailure(apiError);
    } catch (e) {
      return ApiFailure(ApiError(
        message: 'Erreur lors de la création : $e',
        type: ApiErrorType.unknown,
      ));
    }
  }

  /// Met à jour une entité.
  ///
  /// Pattern :
  /// - Hors ligne → updateEntityOffline (outbox)
  /// - En ligne → Appel API
  Future<ApiResult<Map<String, dynamic>>> update(
    String id,
    Map<String, dynamic> data,
  ) async {
    final tenantId = await _getTenantId();
    final isConnected = await _connectivityService.isConnected;

    if (!isConnected && tenantId != null) {
      try {
        final result = await _offlineService.updateEntityOffline(
          tenantId,
          entityType,
          id,
          data,
        );
        _invalidateMemoryCache();
        return ApiSuccess(result);
      } catch (e) {
        return ApiFailure(ApiError(
          message: 'Impossible de mettre à jour hors ligne : $e',
          type: ApiErrorType.unknown,
          isOffline: true,
        ));
      }
    }

    try {
      final response = await _apiClient.patch<Map<String, dynamic>>(
        '$endpoint/$id',
        data: data,
      );

      final result = response.data as Map<String, dynamic>;
      _invalidateMemoryCache();

      return ApiSuccess(result);
    } on DioException catch (e) {
      final apiError = ApiError.fromDioException(e);

      if (apiError.isOffline && tenantId != null) {
        try {
          final result = await _offlineService.updateEntityOffline(
            tenantId,
            entityType,
            id,
            data,
          );
          _invalidateMemoryCache();
          return ApiSuccess(result);
        } catch (_) {}
      }

      return ApiFailure(apiError);
    } catch (e) {
      return ApiFailure(ApiError(
        message: 'Erreur lors de la mise à jour : $e',
        type: ApiErrorType.unknown,
      ));
    }
  }

  /// Supprime une entité.
  ///
  /// Pattern :
  /// - Hors ligne → deleteEntityOffline (soft delete + outbox)
  /// - En ligne → Appel API
  Future<ApiResult<void>> delete(String id) async {
    final tenantId = await _getTenantId();
    final isConnected = await _connectivityService.isConnected;

    if (!isConnected && tenantId != null) {
      try {
        await _offlineService.deleteEntityOffline(
          tenantId,
          entityType,
          id,
        );
        _invalidateMemoryCache();
        return const ApiSuccess(null);
      } catch (e) {
        return ApiFailure(ApiError(
          message: 'Impossible de supprimer hors ligne : $e',
          type: ApiErrorType.unknown,
          isOffline: true,
        ));
      }
    }

    try {
      await _apiClient.delete('$endpoint/$id');
      _invalidateMemoryCache();
      return const ApiSuccess(null);
    } on DioException catch (e) {
      final apiError = ApiError.fromDioException(e);

      if (apiError.isOffline && tenantId != null) {
        try {
          await _offlineService.deleteEntityOffline(
            tenantId,
            entityType,
            id,
          );
          _invalidateMemoryCache();
          return const ApiSuccess(null);
        } catch (_) {}
      }

      return ApiFailure(apiError);
    } catch (e) {
      return ApiFailure(ApiError(
        message: 'Erreur lors de la suppression : $e',
        type: ApiErrorType.unknown,
      ));
    }
  }

  // ─── Recherche locale ───────────────────────────────────────────────────

  /// Recherche dans le stockage local avec filtres.
  Future<List<Map<String, dynamic>>> searchLocal({
    String? query,
    List<String>? fields,
    Map<String, dynamic>? filters,
    int? limit,
    int? offset,
  }) async {
    final tenantId = await _getTenantId();
    return _offlineService.search(
      collection,
      SearchOptions(
        query: query,
        fields: fields,
        tenantId: tenantId,
        filters: filters,
        limit: limit,
        offset: offset,
      ),
    );
  }

  // ─── Méthodes utilitaires protégées ─────────────────────────────────────

  /// Exécute un appel API GET avec fallback local.
  /// Utilitaire pour les méthodes spécifiques des sous-classes.
  Future<ApiResult<T>> apiGetWithFallback<T>(
    String path, {
    Map<String, dynamic>? params,
    String? localCollection,
    Map<String, dynamic>? localFilters,
  }) async {
    final isConnected = await _connectivityService.isConnected;
    final effectiveCollection = localCollection ?? collection;

    if (!isConnected) {
      return _localFallback<T>(effectiveCollection, localFilters);
    }

    try {
      final response = await _apiClient.get<T>(path, queryParameters: params);
      return ApiSuccess(response.data as T);
    } on DioException catch (_) {
      return _localFallback<T>(effectiveCollection, localFilters);
    } catch (e) {
      return ApiFailure(ApiError(
        message: 'Erreur : $e',
        type: ApiErrorType.unknown,
      ));
    }
  }

  /// Exécute un appel API POST avec fallback offline.
  /// Utilitaire pour les méthodes spécifiques des sous-classes.
  Future<ApiResult<T>> apiPostWithOfflineFallback<T>(
    String path,
    Map<String, dynamic> data, {
    SyncEntityType? offlineEntityType,
  }) async {
    final tenantId = await _getTenantId();
    final isConnected = await _connectivityService.isConnected;
    final effectiveEntityType = offlineEntityType ?? entityType;

    if (!isConnected && tenantId != null) {
      try {
        final result = await _offlineService.createEntityOffline(
          tenantId,
          effectiveEntityType,
          data,
        );
        return ApiSuccess(result as T);
      } catch (e) {
        return ApiFailure(ApiError(
          message: 'Impossible de sauvegarder hors ligne : $e',
          isOffline: true,
        ));
      }
    }

    try {
      final response = await _apiClient.post<T>(path, data: data);
      return ApiSuccess(response.data as T);
    } on DioException catch (e) {
      final apiError = ApiError.fromDioException(e);
      if (apiError.isOffline && tenantId != null) {
        try {
          final result = await _offlineService.createEntityOffline(
            tenantId,
            effectiveEntityType,
            data,
          );
          return ApiSuccess(result as T);
        } catch (_) {}
      }
      return ApiFailure(apiError);
    } catch (e) {
      return ApiFailure(ApiError(message: 'Erreur : $e'));
    }
  }

  /// Exécute un appel API PATCH/PUT avec fallback offline.
  Future<ApiResult<T>> apiUpdateWithOfflineFallback<T>(
    String path,
    String id,
    Map<String, dynamic> data, {
    SyncEntityType? offlineEntityType,
  }) async {
    final tenantId = await _getTenantId();
    final isConnected = await _connectivityService.isConnected;
    final effectiveEntityType = offlineEntityType ?? entityType;

    if (!isConnected && tenantId != null) {
      try {
        final result = await _offlineService.updateEntityOffline(
          tenantId,
          effectiveEntityType,
          id,
          data,
        );
        return ApiSuccess(result as T);
      } catch (e) {
        return ApiFailure(ApiError(
          message: 'Impossible de mettre à jour hors ligne : $e',
          isOffline: true,
        ));
      }
    }

    try {
      final response = await _apiClient.patch<T>(path, data: data);
      return ApiSuccess(response.data as T);
    } on DioException catch (e) {
      final apiError = ApiError.fromDioException(e);
      if (apiError.isOffline && tenantId != null) {
        try {
          final result = await _offlineService.updateEntityOffline(
            tenantId,
            effectiveEntityType,
            id,
            data,
          );
          return ApiSuccess(result as T);
        } catch (_) {}
      }
      return ApiFailure(apiError);
    } catch (e) {
      return ApiFailure(ApiError(message: 'Erreur : $e'));
    }
  }

  /// Exécute un appel API DELETE avec fallback offline.
  Future<ApiResult<void>> apiDeleteWithOfflineFallback(
    String path,
    String id, {
    SyncEntityType? offlineEntityType,
  }) async {
    final tenantId = await _getTenantId();
    final isConnected = await _connectivityService.isConnected;
    final effectiveEntityType = offlineEntityType ?? entityType;

    if (!isConnected && tenantId != null) {
      try {
        await _offlineService.deleteEntityOffline(
          tenantId,
          effectiveEntityType,
          id,
        );
        return const ApiSuccess(null);
      } catch (e) {
        return ApiFailure(ApiError(
          message: 'Impossible de supprimer hors ligne : $e',
          isOffline: true,
        ));
      }
    }

    try {
      await _apiClient.delete(path);
      return const ApiSuccess(null);
    } on DioException catch (e) {
      final apiError = ApiError.fromDioException(e);
      if (apiError.isOffline && tenantId != null) {
        try {
          await _offlineService.deleteEntityOffline(
            tenantId,
            effectiveEntityType,
            id,
          );
          return const ApiSuccess(null);
        } catch (_) {}
      }
      return ApiFailure(apiError);
    } catch (e) {
      return ApiFailure(ApiError(message: 'Erreur : $e'));
    }
  }

  // ─── Helpers privés ─────────────────────────────────────────────────────

  Future<ApiResult<List<Map<String, dynamic>>>> _getAllFromLocal(
    Map<String, dynamic>? params,
  ) async {
    try {
      final tenantId = await _getTenantId();
      final results = await _offlineService.search(
        collection,
        SearchOptions(
          tenantId: tenantId,
          filters: params,
        ),
      );
      return ApiSuccess(results);
    } catch (e) {
      return ApiFailure(ApiError(
        message: 'Aucune donnée locale disponible',
        type: ApiErrorType.unknown,
        isOffline: true,
      ));
    }
  }

  Future<ApiResult<Map<String, dynamic>>> _getByIdFromLocal(String id) async {
    try {
      final result = await _offlineService.getById(collection, id);
      if (result != null) {
        return ApiSuccess(result);
      }
      return ApiFailure(ApiError(
        message: 'Entité introuvable localement',
        type: ApiErrorType.notFound,
        isOffline: true,
      ));
    } catch (e) {
      return ApiFailure(ApiError(
        message: 'Erreur de lecture locale',
        type: ApiErrorType.unknown,
        isOffline: true,
      ));
    }
  }

  Future<ApiResult<T>> _localFallback<T>(
    String localCollection,
    Map<String, dynamic>? localFilters,
  ) async {
    try {
      final tenantId = await _getTenantId();
      final results = await _offlineService.search(
        localCollection,
        SearchOptions(
          tenantId: tenantId,
          filters: localFilters,
        ),
      );
      return ApiSuccess(results as T);
    } catch (e) {
      return ApiFailure(ApiError(
        message: 'Aucune donnée locale disponible',
        type: ApiErrorType.unknown,
        isOffline: true,
      ));
    }
  }

  Future<String?> _getTenantId() async {
    return await _secureStorage.read(key: 'tenant_id');
  }

  // ─── Cache en mémoire ───────────────────────────────────────────────────

  String _buildCacheKey(String method, Map<String, dynamic>? params) {
    final paramString =
        params?.entries.map((e) => '${e.key}=${e.value}').join('&') ?? '';
    return '$collection:$method:$paramString';
  }

  dynamic _getFromMemoryCache(String key) {
    final entry = _memoryCache[key];
    if (entry == null) return null;

    // Vérifier le staleTime
    if (DateTime.now().difference(entry.cachedAt) > cacheConfig.staleTime) {
      _memoryCache.remove(key);
      return null;
    }

    return entry.data;
  }

  void _setMemoryCache(String key, dynamic data) {
    _memoryCache[key] = _CacheEntry(
      data: data,
      cachedAt: DateTime.now(),
    );

    // Nettoyer les entrées expirées (gcTime)
    _memoryCache.removeWhere((key, entry) {
      return DateTime.now().difference(entry.cachedAt) > cacheConfig.gcTime;
    });
  }

  void _invalidateMemoryCache() {
    // Supprimer toutes les entrées pour cette collection
    _memoryCache.removeWhere(
        (key, _) => key.startsWith('$collection:'));
  }

  /// Invalide tout le cache en mémoire.
  void invalidateAllCache() {
    _memoryCache.clear();
  }

  Future<void> _cacheResponseLocally(List<Map<String, dynamic>> data) async {
    final tenantId = await _getTenantId();
    if (tenantId == null) return;

    // Mettre en cache chaque élément individuellement
    for (final item in data) {
      final id = item['id'];
      if (id != null) {
        final box = await OfflineService.instance._openCollectionBox(collection);
        final itemWithMeta = {
          ...item,
          'tenantId': item['tenantId'] ?? tenantId,
          '_cachedAt': DateTime.now().toIso8601String(),
        };
        await box.put(id, itemWithMeta);
      }
    }
  }
}

// ─── Entrée de cache ─────────────────────────────────────────────────────────

class _CacheEntry {
  final dynamic data;
  final DateTime cachedAt;

  const _CacheEntry({
    required this.data,
    required this.cachedAt,
  });
}
