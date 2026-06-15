/// ============================================================================
/// EXAMS SERVICE — Academia Hub Mobile
/// ============================================================================
///
/// Service CRUD pour le module Examens.
/// Miroir du web app exams/evaluations/grades/bulletins.
///
/// Méthodes :
/// - getEvaluations, createEvaluation, updateEvaluation (Évaluations)
/// - saveGrades, getGradesByEvaluation (Notes)
/// - getBulletins, generateBulletin (Bulletins)
/// - getCouncils, createCouncil (Conseils de classe)
/// - getConfig, updateConfig (Configuration)
/// - getDashboard (Tableau de bord)
/// ============================================================================

import '../../core/crud/base_crud_service.dart';
import '../../core/network/api_config.dart';
import '../../core/network/api_result.dart';
import '../../core/network/api_client.dart';
import '../../core/offline/offline_service.dart';

class ExamsService extends BaseCrudService {
  ExamsService()
      : super(
          endpoint: ApiConfig.exams,
          collection: 'exams',
          entityType: SyncEntityType.exam,
        );

  // ─── Évaluations ─────────────────────────────────────────────────────────

  /// Récupère la liste des évaluations.
  Future<ApiResult<List<Map<String, dynamic>>>> getEvaluations({
    Map<String, dynamic>? params,
  }) async {
    return apiGetWithFallback(
      ApiConfig.examEvaluations,
      params: params,
    );
  }

  /// Récupère une évaluation par ID.
  Future<ApiResult<Map<String, dynamic>>> getEvaluationById(String id) async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.examEvaluationById(id),
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Crée une évaluation.
  Future<ApiResult<Map<String, dynamic>>> createEvaluation(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.examEvaluations,
      data,
    );
  }

  /// Met à jour une évaluation.
  Future<ApiResult<Map<String, dynamic>>> updateEvaluation(
    String id,
    Map<String, dynamic> data,
  ) async {
    return apiUpdateWithOfflineFallback(
      ApiConfig.examEvaluationById(id),
      id,
      data,
    );
  }

  // ─── Notes ───────────────────────────────────────────────────────────────

  /// Récupère les notes d'une évaluation.
  Future<ApiResult<List<Map<String, dynamic>>>> getGradesByEvaluation(
    String evaluationId,
  ) async {
    return apiGetWithFallback(
      ApiConfig.examGradesByEvaluation(evaluationId),
      localFilters: {'evaluationId': evaluationId},
    );
  }

  /// Sauvegarde les notes en lot.
  Future<ApiResult<Map<String, dynamic>>> saveGrades(
    List<Map<String, dynamic>> grades,
  ) async {
    try {
      final response = await ApiClient.instance.post(
        ApiConfig.examSaveGrades,
        data: {'grades': grades},
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Sauvegarde une note individuelle (offline-first).
  Future<ApiResult<Map<String, dynamic>>> saveGrade(
    Map<String, dynamic> gradeData,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.examGrades,
      gradeData,
      offlineEntityType: SyncEntityType.grade,
    );
  }

  // ─── Bulletins ───────────────────────────────────────────────────────────

  /// Récupère les bulletins d'une classe.
  Future<ApiResult<List<Map<String, dynamic>>>> getBulletins(
    String classId,
  ) async {
    return apiGetWithFallback(
      ApiConfig.examBulletinByClass(classId),
      localFilters: {'classId': classId},
    );
  }

  /// Génère un bulletin pour un élève.
  Future<ApiResult<Map<String, dynamic>>> generateBulletin(
    Map<String, dynamic> data,
  ) async {
    try {
      final response = await ApiClient.instance.post(
        ApiConfig.examBulletins,
        data: data,
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Conseils de classe ──────────────────────────────────────────────────

  /// Récupère les conseils de classe.
  Future<ApiResult<List<Map<String, dynamic>>>> getCouncils({
    Map<String, dynamic>? params,
  }) async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.examCouncils,
        queryParameters: params,
      );
      return ApiSuccess(
        (response.data as List).map((e) => e as Map<String, dynamic>).toList(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Crée un conseil de classe.
  Future<ApiResult<Map<String, dynamic>>> createCouncil(
    Map<String, dynamic> data,
  ) async {
    try {
      final response = await ApiClient.instance.post(
        ApiConfig.examCouncils,
        data: data,
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Récupère un conseil de classe par ID.
  Future<ApiResult<Map<String, dynamic>>> getCouncilById(String id) async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.examCouncilById(id),
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Configuration ───────────────────────────────────────────────────────

  /// Récupère la configuration des examens.
  Future<ApiResult<Map<String, dynamic>>> getConfig() async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.examConfig,
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  /// Met à jour la configuration des examens.
  Future<ApiResult<Map<String, dynamic>>> updateConfig(
    Map<String, dynamic> data,
  ) async {
    try {
      final response = await ApiClient.instance.put(
        ApiConfig.examConfig,
        data: data,
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Tableau de bord ─────────────────────────────────────────────────────

  /// Récupère le tableau de bord des examens.
  Future<ApiResult<Map<String, dynamic>>> getDashboard(
    String academicYearId,
  ) async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.examDashboard(academicYearId),
      );
      return ApiSuccess(response.data as Map<String, dynamic>);
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }

  // ─── Examens institutionnels ─────────────────────────────────────────────

  /// Récupère les examens institutionnels.
  Future<ApiResult<List<Map<String, dynamic>>>> getInstitutionalExams({
    Map<String, dynamic>? params,
  }) async {
    try {
      final response = await ApiClient.instance.get(
        ApiConfig.institutionalExams,
        queryParameters: params,
      );
      return ApiSuccess(
        (response.data as List).map((e) => e as Map<String, dynamic>).toList(),
      );
    } catch (e) {
      return ApiFailure(ApiError.fromDioException(e));
    }
  }
}
