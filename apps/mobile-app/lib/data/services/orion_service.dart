/// ============================================================================
/// ORION SERVICE — Academia Hub Mobile
/// ============================================================================
///
/// Service pour ORION, l'assistant de direction institutionnel.
/// Miroir de orion.service.ts du web app.
///
/// CONTRAINTES ABSOLUES (miroir du web app) :
/// - 100% lecture seule
/// - Aucune modification de données
/// - Aucune exécution d'action
/// - Uniquement données réelles et agrégées
///
/// Méthodes :
/// - ask (Pose une question à ORION)
/// - getMonthlySummary (Résumé mensuel)
/// - getAlerts, acknowledgeAlert (Alertes)
/// - getHistory (Historique des analyses)
/// - getConfig, updateConfig (Configuration)
/// - getKPIs (Indicateurs clés)
/// - getInsights (Perspectives)
/// ============================================================================

import '../../core/crud/base_crud_service.dart';
import '../../core/network/api_config.dart';
import '../../core/network/api_result.dart';
import '../../core/network/api_client.dart';
import '../../core/offline/offline_service.dart';

class OrionService extends BaseCrudService {
  OrionService()
      : super(
          endpoint: ApiConfig.orion,
          collection: 'orion_cache',
          entityType: SyncEntityType.alert,
        );

  // ─── Questions à ORION ───────────────────────────────────────────────────

  /// Pose une question à ORION.
  ///
  /// ORION répond uniquement avec des faits basés sur les données réelles.
  /// Aucune supposition, aucun conseil non factuel.
  Future<ApiResult<Map<String, dynamic>>> ask(
    Map<String, dynamic> request,
  ) async {
    final isConnected =
        await OfflineService.instance._connectivityService.isConnected;
    final tenantId = await _getTenantId();

    if (!isConnected) {
      return ApiFailure(const ApiError(
        message:
            'ORION nécessite une connexion Internet pour répondre à vos questions.',
        type: ApiErrorType.network,
        isOffline: true,
      ));
    }

    return ApiClient.instance.postRaw(
      ApiConfig.orionQuery,
      data: request,
    );
  }

  // ─── Résumé mensuel ──────────────────────────────────────────────────────

  /// Récupère le résumé mensuel ORION.
  ///
  /// Résumé structuré : Faits, Interprétation, Vigilance.
  Future<ApiResult<Map<String, dynamic>>> getMonthlySummary({
    String? period,
  }) async {
    final path = period != null
        ? '${ApiConfig.orionMonthlySummary}?period=${Uri.encodeComponent(period)}'
        : ApiConfig.orionMonthlySummary;

    return _offlineFetch<Map<String, dynamic>>(
      path,
      'orion_cache',
    );
  }

  // ─── Alertes ─────────────────────────────────────────────────────────────

  /// Récupère les alertes ORION.
  ///
  /// Alertes hiérarchisées : INFO, ATTENTION, CRITIQUE.
  Future<ApiResult<List<Map<String, dynamic>>>> getAlerts({
    String? level,
    bool? acknowledged,
    String? alertType,
    String? academicYearId,
  }) async {
    final params = <String, dynamic>{};
    if (acknowledged != null) {
      params['acknowledged'] = acknowledged;
    } else {
      params['acknowledged'] = true;
    }
    if (level != null) params['level'] = level;
    if (alertType != null) params['alertType'] = alertType;
    if (academicYearId != null) params['academicYearId'] = academicYearId;

    final qs = params.entries.map((e) => '${e.key}=${e.value}').join('&');
    final path = '${ApiConfig.orionAlerts}?${qs}';

    return _offlineFetch<List<Map<String, dynamic>>>(
      path,
      'orion_alerts',
    );
  }

  /// Acquitte une alerte ORION.
  Future<ApiResult<void>> acknowledgeAlert(String alertId) async {
    final isConnected =
        await OfflineService.instance._connectivityService.isConnected;

    if (!isConnected) {
      return const ApiFailure(ApiError(
        message:
            'Impossible d\'acquitter l\'alerte hors ligne. Veuillez vous connecter.',
        type: ApiErrorType.network,
        isOffline: true,
      ));
    }

    try {
      final result = await ApiClient.instance.postRaw(
        ApiConfig.orionAlertAcknowledge(alertId),
      );
      return result.when(
        success: (_) => const ApiSuccess(null),
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Historique des analyses ──────────────────────────────────────────────

  /// Récupère l'historique des analyses ORION.
  Future<ApiResult<List<Map<String, dynamic>>>> getHistory({
    int limit = 50,
    String? type,
    String? startDate,
    String? endDate,
  }) async {
    final params = <String, dynamic>{'limit': limit};
    if (type != null) params['type'] = type;
    if (startDate != null) params['startDate'] = startDate;
    if (endDate != null) params['endDate'] = endDate;

    final qs = params.entries.map((e) => '${e.key}=${e.value}').join('&');
    final path = '${ApiConfig.orionHistory}?${qs}';

    return _offlineFetch<List<Map<String, dynamic>>>(
      path,
      'orion_cache',
    );
  }

  // ─── Configuration ───────────────────────────────────────────────────────

  /// Récupère la configuration ORION.
  Future<ApiResult<Map<String, dynamic>>> getConfig() async {
    return _offlineFetch<Map<String, dynamic>>(
      ApiConfig.orionConfig,
      'orion_cache',
    );
  }

  /// Met à jour la configuration ORION.
  Future<ApiResult<Map<String, dynamic>>> updateConfig(
    Map<String, dynamic> config,
  ) async {
    final isConnected =
        await OfflineService.instance._connectivityService.isConnected;

    if (!isConnected) {
      return const ApiFailure(ApiError(
        message:
            'Impossible de modifier la configuration ORION hors ligne.',
        type: ApiErrorType.network,
        isOffline: true,
      ));
    }

    return ApiClient.instance.put(
      ApiConfig.orionConfig,
      data: config,
      fromJson: (json) => json,
    );
  }

  // ─── KPIs ────────────────────────────────────────────────────────────────

  /// Récupère les indicateurs clés ORION.
  Future<ApiResult<List<Map<String, dynamic>>>> getKPIs({
    Map<String, dynamic>? params,
  }) async {
    final qs = params != null
        ? '?${params.entries.map((e) => '${e.key}=${e.value}').join('&')}'
        : '';
    final path = '${ApiConfig.orionKpis}$qs';

    return _offlineFetch<List<Map<String, dynamic>>>(
      path,
      'orion_cache',
    );
  }

  // ─── Perspectives (Insights) ─────────────────────────────────────────────

  /// Récupère les perspectives ORION.
  Future<ApiResult<List<Map<String, dynamic>>>> getInsights({
    Map<String, dynamic>? params,
  }) async {
    final qs = params != null
        ? '?${params.entries.map((e) => '${e.key}=${e.value}').join('&')}'
        : '';
    final path = '${ApiConfig.orionInsights}$qs';

    return _offlineFetch<List<Map<String, dynamic>>>(
      path,
      'orion_cache',
    );
  }

  // ─── Helper privé : fetch avec cache offline ─────────────────────────────

  /// Wrapper offline-aware pour les requêtes GET ORION.
  ///
  /// Comportement (miroir de offlineFetch du web app) :
  /// - EN LIGNE : fetch réseau → succès → cache local → retourne données
  /// - EN LIGNE : fetch réseau → échec → fallback cache local
  /// - HORS LIGNE : lecture depuis le cache local
  Future<ApiResult<T>> _offlineFetch<T>(
    String path,
    String cacheStore,
  ) async {
    final isConnected =
        await OfflineService.instance._connectivityService.isConnected;
    final tenantId = await _getTenantId();

    // Hors ligne : lecture depuis le cache
    if (!isConnected) {
      return _localFallback<T>(cacheStore, tenantId);
    }

    // En ligne : essayer le réseau, fallback local si échec
    try {
      final result = await ApiClient.instance.getRaw(path);
      return result.when(
        success: (data) {
          // Mettre en cache les données réussies (non bloquant)
          _cacheResponse(path, cacheStore, data, tenantId).catchError((_) {});

          // Transformer la réponse — getRaw returns Map<String, dynamic>
          if (data.containsKey('data') && data['data'] is List) {
            final listData = (data['data'] as List)
                .map((e) => e as Map<String, dynamic>)
                .toList();
            return ApiSuccess(listData as T);
          }
          return ApiSuccess(data as T);
        },
        failure: (error) => _localFallback<T>(cacheStore, tenantId),
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      // Fallback vers les données locales
      return _localFallback<T>(cacheStore, tenantId);
    }
  }

  /// Lecture depuis le cache local avec filtrage par tenant.
  Future<ApiResult<T>> _localFallback<T>(
    String cacheStore,
    String? tenantId,
  ) async {
    try {
      final results = await OfflineService.instance.search(
        cacheStore,
        SearchOptions(tenantId: tenantId),
      );

      if (results.isEmpty) {
        // Retourner un tableau vide plutôt que de crasher
        if (T == List<Map<String, dynamic>>) {
          return ApiSuccess([] as T);
        }
        return ApiFailure(const ApiError(
          message: 'Aucune donnée ORION en cache disponible hors ligne.',
          type: ApiErrorType.notFound,
          isOffline: true,
        ));
      }

      if (T == List<Map<String, dynamic>>) {
        return ApiSuccess(results as T);
      }
      return ApiSuccess(results.first as T);
    } catch (e) {
      if (T == List<Map<String, dynamic>>) {
        return ApiSuccess([] as T);
      }
      return ApiFailure(const ApiError(
        message: 'Aucune donnée ORION en cache disponible.',
        type: ApiErrorType.notFound,
        isOffline: true,
      ));
    }
  }

  /// Cache une réponse API localement.
  Future<void> _cacheResponse(
    String url,
    String cacheStore,
    dynamic data,
    String? tenantId,
  ) async {
    try {
      if (data is List) {
        if (data.isEmpty) return;
        for (final item in data) {
          if (item is Map<String, dynamic>) {
            final id = item['id'] ?? '';
            final itemWithMeta = {
              ...item,
              'tenantId': item['tenantId'] ?? tenantId,
              '_cachedAt': DateTime.now().toIso8601String(),
            };
            await OfflineService.instance.cacheData(
              '$cacheStore/$id',
              itemWithMeta,
            );
          }
        }
      } else if (data is Map<String, dynamic>) {
        final id = data['id'] ?? url.hashCode.toString();
        final itemWithMeta = {
          ...data,
          'tenantId': data['tenantId'] ?? tenantId,
          '_cachedAt': DateTime.now().toIso8601String(),
        };
        await OfflineService.instance.cacheData(
          '$cacheStore/$id',
          itemWithMeta,
        );
      }
    } catch (_) {
      // Erreur de cache non bloquante
    }
  }

  Future<String?> _getTenantId() async {
    return await OfflineService.instance.getTenantId();
  }
}
