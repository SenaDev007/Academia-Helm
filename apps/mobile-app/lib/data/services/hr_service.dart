/// ============================================================================
/// HR SERVICE — Academia Hub Mobile
/// ============================================================================
///
/// Service CRUD pour le module Ressources Humaines.
/// Miroir des services hr du web app.
///
/// Méthodes :
/// - getStaff, getStaffById, createStaff, updateStaff (Personnel)
/// - getContracts, createContract, updateContract (Contrats)
/// - getPayroll, getPayrollById (Paie)
/// - getLeaves, recordLeave, approveLeave (Congés)
/// - getCredentials (Certifications)
/// ============================================================================

import '../../core/crud/base_crud_service.dart';
import '../../core/network/api_config.dart';
import '../../core/network/api_result.dart';
import '../../core/network/api_client.dart';
import '../../core/offline/offline_service.dart';

class HrService extends BaseCrudService {
  HrService()
      : super(
          endpoint: ApiConfig.hr,
          collection: 'hr',
          entityType: SyncEntityType.staff,
        );

  // ─── Personnel ───────────────────────────────────────────────────────────

  /// Récupère la liste du personnel.
  Future<ApiResult<List<Map<String, dynamic>>>> getStaff({
    Map<String, dynamic>? params,
  }) async {
    return apiGetWithFallback(
      ApiConfig.hrStaff,
      params: params,
      localCollection: 'staff',
    );
  }

  /// Récupère un membre du personnel par ID.
  Future<ApiResult<Map<String, dynamic>>> getStaffById(String id) async {
    try {
      return ApiClient.instance.getRaw(
        ApiConfig.hrStaffById(id),
      );
    } catch (e) {
      // Fallback local
      final local = await getById(id);
      return local;
    }
  }

  /// Crée un membre du personnel.
  Future<ApiResult<Map<String, dynamic>>> createStaff(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.hrStaff,
      data,
      offlineEntityType: SyncEntityType.staff,
    );
  }

  /// Met à jour un membre du personnel.
  Future<ApiResult<Map<String, dynamic>>> updateStaff(
    String id,
    Map<String, dynamic> data,
  ) async {
    return apiUpdateWithOfflineFallback(
      ApiConfig.hrStaffById(id),
      id,
      data,
      offlineEntityType: SyncEntityType.staff,
    );
  }

  // ─── Contrats ────────────────────────────────────────────────────────────

  /// Récupère la liste des contrats.
  Future<ApiResult<List<Map<String, dynamic>>>> getContracts({
    Map<String, dynamic>? params,
  }) async {
    return apiGetWithFallback(
      ApiConfig.hrContracts,
      params: params,
      localCollection: 'contracts',
    );
  }

  /// Récupère un contrat par ID.
  Future<ApiResult<Map<String, dynamic>>> getContractById(String id) async {
    return ApiClient.instance.getRaw(
      ApiConfig.hrContractById(id),
    );
  }

  /// Crée un contrat.
  Future<ApiResult<Map<String, dynamic>>> createContract(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.hrContracts,
      data,
      offlineEntityType: SyncEntityType.contract,
    );
  }

  /// Met à jour un contrat.
  Future<ApiResult<Map<String, dynamic>>> updateContract(
    String id,
    Map<String, dynamic> data,
  ) async {
    return apiUpdateWithOfflineFallback(
      ApiConfig.hrContractById(id),
      id,
      data,
      offlineEntityType: SyncEntityType.contract,
    );
  }

  // ─── Paie ────────────────────────────────────────────────────────────────

  /// Récupère la liste des fiches de paie.
  Future<ApiResult<List<Map<String, dynamic>>>> getPayroll({
    Map<String, dynamic>? params,
  }) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.hrPayroll,
        queryParameters: params,
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

  /// Récupère une fiche de paie par ID.
  Future<ApiResult<Map<String, dynamic>>> getPayrollById(String id) async {
    return ApiClient.instance.getRaw(
      ApiConfig.hrPayrollById(id),
    );
  }

  // ─── Congés ──────────────────────────────────────────────────────────────

  /// Récupère la liste des congés.
  Future<ApiResult<List<Map<String, dynamic>>>> getLeaves({
    Map<String, dynamic>? params,
  }) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.hrLeaves,
        queryParameters: params,
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

  /// Enregistre un congé.
  Future<ApiResult<Map<String, dynamic>>> recordLeave(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.hrLeaves,
      data,
      offlineEntityType: SyncEntityType.leave,
    );
  }

  /// Approuve un congé.
  Future<ApiResult<Map<String, dynamic>>> approveLeave(
    String id,
  ) async {
    return apiUpdateWithOfflineFallback(
      ApiConfig.hrLeaveById(id),
      id,
      {'status': 'APPROVED'},
      offlineEntityType: SyncEntityType.leave,
    );
  }

  /// Rejette un congé.
  Future<ApiResult<Map<String, dynamic>>> rejectLeave(
    String id,
    String comment,
  ) async {
    return apiUpdateWithOfflineFallback(
      ApiConfig.hrLeaveById(id),
      id,
      {'status': 'REJECTED', 'comment': comment},
      offlineEntityType: SyncEntityType.leave,
    );
  }

  // ─── Certifications ──────────────────────────────────────────────────────

  /// Récupère les certifications du personnel.
  Future<ApiResult<List<Map<String, dynamic>>>> getCredentials({
    Map<String, dynamic>? params,
  }) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.hrCredentials,
        queryParameters: params,
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
}
