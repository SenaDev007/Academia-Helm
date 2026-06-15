/// ============================================================================
/// SETTINGS SERVICE — Academia Hub Mobile
/// ============================================================================
///
/// Service CRUD pour le module Paramètres.
/// Miroir de settings.service.ts du web app.
///
/// Méthodes :
/// - getGeneral, updateGeneral (Paramètres généraux)
/// - getAcademicYears, getCurrentAcademicYear (Années scolaires)
/// - getClasses, createClass, updateClass, deleteClass (Classes)
/// - getSubjects, createSubject (Matières)
/// - getRoles, getPermissions (Rôles & Permissions)
/// - getFeatureFlags, enableFeature, disableFeature (Feature Flags)
/// - getSecuritySettings (Sécurité)
/// ============================================================================

import '../../core/crud/base_crud_service.dart';
import '../../core/network/api_config.dart';
import '../../core/network/api_result.dart';
import '../../core/network/api_client.dart';
import '../../core/offline/offline_service.dart';

class SettingsService extends BaseCrudService {
  SettingsService()
      : super(
          endpoint: ApiConfig.settings,
          collection: 'settings',
          entityType: SyncEntityType.financeSetting,
        );

  // ─── Paramètres généraux ─────────────────────────────────────────────────

  /// Récupère les paramètres généraux.
  Future<ApiResult<Map<String, dynamic>>> getGeneral() async {
    return ApiClient.instance.getRaw(
      ApiConfig.settingsGeneral,
    );
  }

  /// Met à jour les paramètres généraux.
  Future<ApiResult<Map<String, dynamic>>> updateGeneral(
    Map<String, dynamic> data,
  ) async {
    return ApiClient.instance.put(
      ApiConfig.settingsGeneral,
      data: data,
      fromJson: (json) => json,
    );
  }

  // ─── Années scolaires ────────────────────────────────────────────────────

  /// Récupère les années scolaires.
  Future<ApiResult<List<Map<String, dynamic>>>> getAcademicYears() async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.settingsAcademicYear,
      );
      return result.when(
        success: (data) {
          if (data.containsKey('data') && data['data'] is List) {
            return ApiSuccess(
              (data['data'] as List)
                  .map((e) => e as Map<String, dynamic>)
                  .toList(),
            );
          }
          return ApiSuccess([data]);
        },
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Récupère l'année scolaire courante.
  Future<ApiResult<Map<String, dynamic>>> getCurrentAcademicYear() async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.settingsAcademicYear,
        queryParameters: {'current': 'true'},
      );
      return result.when(
        success: (data) {
          // Peut retourner une liste dans 'data' ou un objet unique
          if (data.containsKey('data') && data['data'] is List) {
            final list = data['data'] as List;
            if (list.isNotEmpty) {
              return ApiSuccess(list.first as Map<String, dynamic>);
            }
            return ApiFailure(ApiError(
              message: 'Aucune année scolaire courante trouvée',
              type: ApiErrorType.notFound,
            ));
          }
          return ApiSuccess(data);
        },
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Classes ─────────────────────────────────────────────────────────────

  /// Récupère la liste des classes.
  Future<ApiResult<List<Map<String, dynamic>>>> getClasses({
    Map<String, dynamic>? params,
  }) async {
    return apiGetWithFallback(
      ApiConfig.settingsClasses,
      params: params,
      localCollection: 'classes',
    );
  }

  /// Crée une classe.
  Future<ApiResult<Map<String, dynamic>>> createClass(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.settingsClasses,
      data,
      offlineEntityType: SyncEntityType.class$,
    );
  }

  /// Met à jour une classe.
  Future<ApiResult<Map<String, dynamic>>> updateClass(
    String id,
    Map<String, dynamic> data,
  ) async {
    return apiUpdateWithOfflineFallback(
      '${ApiConfig.settingsClasses}/$id',
      id,
      data,
      offlineEntityType: SyncEntityType.class$,
    );
  }

  /// Supprime une classe.
  Future<ApiResult<void>> deleteClass(String id) async {
    return apiDeleteWithOfflineFallback(
      '${ApiConfig.settingsClasses}/$id',
      id,
      offlineEntityType: SyncEntityType.class$,
    );
  }

  // ─── Matières ────────────────────────────────────────────────────────────

  /// Récupère la liste des matières.
  Future<ApiResult<List<Map<String, dynamic>>>> getSubjects({
    Map<String, dynamic>? params,
  }) async {
    return apiGetWithFallback(
      ApiConfig.settingsSubjects,
      params: params,
      localCollection: 'subjects',
    );
  }

  /// Crée une matière.
  Future<ApiResult<Map<String, dynamic>>> createSubject(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.settingsSubjects,
      data,
      offlineEntityType: SyncEntityType.subject,
    );
  }

  // ─── Rôles & Permissions ─────────────────────────────────────────────────

  /// Récupère les rôles.
  Future<ApiResult<List<Map<String, dynamic>>>> getRoles() async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.settingsRoles,
      );
      return result.when(
        success: (data) {
          if (data.containsKey('data') && data['data'] is List) {
            return ApiSuccess(
              (data['data'] as List)
                  .map((e) => e as Map<String, dynamic>)
                  .toList(),
            );
          }
          return ApiSuccess([data]);
        },
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Récupère les permissions.
  Future<ApiResult<List<Map<String, dynamic>>>> getPermissions() async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.settingsPermissions,
      );
      return result.when(
        success: (data) {
          if (data.containsKey('data') && data['data'] is List) {
            return ApiSuccess(
              (data['data'] as List)
                  .map((e) => e as Map<String, dynamic>)
                  .toList(),
            );
          }
          return ApiSuccess([data]);
        },
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Feature Flags ───────────────────────────────────────────────────────

  /// Récupère les feature flags.
  Future<ApiResult<List<Map<String, dynamic>>>> getFeatures() async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.settingsFeatureFlags,
      );
      return result.when(
        success: (data) {
          if (data.containsKey('data') && data['data'] is List) {
            return ApiSuccess(
              (data['data'] as List)
                  .map((e) => e as Map<String, dynamic>)
                  .toList(),
            );
          }
          return ApiSuccess([data]);
        },
        failure: (error) => ApiFailure(error),
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Active une fonctionnalité.
  Future<ApiResult<Map<String, dynamic>>> enableFeature(String featureId) async {
    return ApiClient.instance.patch(
      '${ApiConfig.settingsFeatureFlags}/$featureId',
      data: {'enabled': true},
      fromJson: (json) => json,
    );
  }

  /// Désactive une fonctionnalité.
  Future<ApiResult<Map<String, dynamic>>> disableFeature(String featureId) async {
    return ApiClient.instance.patch(
      '${ApiConfig.settingsFeatureFlags}/$featureId',
      data: {'enabled': false},
      fromJson: (json) => json,
    );
  }

  // ─── Sécurité ────────────────────────────────────────────────────────────

  /// Récupère les paramètres de sécurité.
  Future<ApiResult<Map<String, dynamic>>> getSecuritySettings() async {
    return ApiClient.instance.getRaw(
      ApiConfig.settingsSecurity,
    );
  }

  // ─── Facturation ─────────────────────────────────────────────────────────

  /// Récupère les paramètres de facturation.
  Future<ApiResult<Map<String, dynamic>>> getBillingSettings() async {
    return ApiClient.instance.getRaw(
      ApiConfig.settingsBilling,
    );
  }

  // ─── Communication ───────────────────────────────────────────────────────

  /// Récupère les paramètres de communication.
  Future<ApiResult<Map<String, dynamic>>> getCommunicationSettings() async {
    return ApiClient.instance.getRaw(
      ApiConfig.settingsCommunication,
    );
  }

  // ─── Sceaux & Signatures ─────────────────────────────────────────────────

  /// Récupère les sceaux et signatures.
  Future<ApiResult<Map<String, dynamic>>> getSeals() async {
    return ApiClient.instance.getRaw(
      ApiConfig.settingsSeals,
    );
  }
}
