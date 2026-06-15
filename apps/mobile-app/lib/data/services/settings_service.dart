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
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.settingsGeneral,
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Met à jour les paramètres généraux.
  Future<ApiResult<Map<String, dynamic>>> updateGeneral(
    Map<String, dynamic> data,
  ) async {
    try {
      final response = await ApiClient.instance.put(
        ApiConfig.settingsGeneral,
        data: data,
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Années scolaires ────────────────────────────────────────────────────

  /// Récupère les années scolaires.
  Future<ApiResult<List<Map<String, dynamic>>>> getAcademicYears() async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.settingsAcademicYear,
      );
      return ApiSuccess(
        (response.data as List).map((e) => e as Map<String, dynamic>).toList(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Récupère l'année scolaire courante.
  Future<ApiResult<Map<String, dynamic>>> getCurrentAcademicYear() async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.settingsAcademicYear,
        queryParameters: {'current': 'true'},
      );
      // Peut retourner une liste ou un objet unique
      if (response.data is List) {
        final list = response.data as List;
        if (list.isNotEmpty) {
          return ApiSuccess(list.first as Map<String, dynamic>);
        }
        return ApiFailure(ApiError(
          message: 'Aucune année scolaire courante trouvée',
          type: ApiErrorType.notFound,
        ));
      }
      return ApiSuccess(response.data as Map<String, dynamic>);
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
      final response = await ApiClient.instance.get(
        ApiConfig.settingsRoles,
      );
      return ApiSuccess(
        (response.data as List).map((e) => e as Map<String, dynamic>).toList(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Récupère les permissions.
  Future<ApiResult<List<Map<String, dynamic>>>> getPermissions() async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.settingsPermissions,
      );
      return ApiSuccess(
        (response.data as List).map((e) => e as Map<String, dynamic>).toList(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Feature Flags ───────────────────────────────────────────────────────

  /// Récupère les feature flags.
  Future<ApiResult<List<Map<String, dynamic>>>> getFeatures() async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.settingsFeatureFlags,
      );
      return ApiSuccess(
        (response.data as List).map((e) => e as Map<String, dynamic>).toList(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Active une fonctionnalité.
  Future<ApiResult<Map<String, dynamic>>> enableFeature(String featureId) async {
    try {
      final response = await ApiClient.instance.patch(
        '${ApiConfig.settingsFeatureFlags}/$featureId',
        data: {'enabled': true},
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Désactive une fonctionnalité.
  Future<ApiResult<Map<String, dynamic>>> disableFeature(String featureId) async {
    try {
      final response = await ApiClient.instance.patch(
        '${ApiConfig.settingsFeatureFlags}/$featureId',
        data: {'enabled': false},
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Sécurité ────────────────────────────────────────────────────────────

  /// Récupère les paramètres de sécurité.
  Future<ApiResult<Map<String, dynamic>>> getSecuritySettings() async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.settingsSecurity,
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Facturation ─────────────────────────────────────────────────────────

  /// Récupère les paramètres de facturation.
  Future<ApiResult<Map<String, dynamic>>> getBillingSettings() async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.settingsBilling,
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Communication ───────────────────────────────────────────────────────

  /// Récupère les paramètres de communication.
  Future<ApiResult<Map<String, dynamic>>> getCommunicationSettings() async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.settingsCommunication,
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Sceaux & Signatures ─────────────────────────────────────────────────

  /// Récupère les sceaux et signatures.
  Future<ApiResult<Map<String, dynamic>>> getSeals() async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.settingsSeals,
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }
}
