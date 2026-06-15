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
    return ApiClient.instance.getRaw(
      ApiConfig.examEvaluationById(id),
    );
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
    return ApiClient.instance.postRaw(
      ApiConfig.examSaveGrades,
      data: {'grades': grades},
    );
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
    return ApiClient.instance.postRaw(
      ApiConfig.examBulletins,
      data: data,
    );
  }

  // ─── Conseils de classe ──────────────────────────────────────────────────

  /// Récupère les conseils de classe.
  Future<ApiResult<List<Map<String, dynamic>>>> getCouncils({
    Map<String, dynamic>? params,
  }) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.examCouncils,
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

  /// Crée un conseil de classe.
  Future<ApiResult<Map<String, dynamic>>> createCouncil(
    Map<String, dynamic> data,
  ) async {
    return ApiClient.instance.postRaw(
      ApiConfig.examCouncils,
      data: data,
    );
  }

  /// Récupère un conseil de classe par ID.
  Future<ApiResult<Map<String, dynamic>>> getCouncilById(String id) async {
    return ApiClient.instance.getRaw(
      ApiConfig.examCouncilById(id),
    );
  }

  // ─── Configuration ───────────────────────────────────────────────────────

  /// Récupère la configuration des examens.
  Future<ApiResult<Map<String, dynamic>>> getConfig() async {
    return ApiClient.instance.getRaw(
      ApiConfig.examConfig,
    );
  }

  /// Met à jour la configuration des examens.
  Future<ApiResult<Map<String, dynamic>>> updateConfig(
    Map<String, dynamic> data,
  ) async {
    return ApiClient.instance.put(
      ApiConfig.examConfig,
      data: data,
      fromJson: (json) => json,
    );
  }

  // ─── Tableau de bord ─────────────────────────────────────────────────────

  /// Récupère le tableau de bord des examens.
  Future<ApiResult<Map<String, dynamic>>> getDashboard(
    String academicYearId,
  ) async {
    return ApiClient.instance.getRaw(
      ApiConfig.examDashboard(academicYearId),
    );
  }

  // ─── Examens institutionnels ─────────────────────────────────────────────

  /// Récupère les examens institutionnels.
  Future<ApiResult<List<Map<String, dynamic>>>> getInstitutionalExams({
    Map<String, dynamic>? params,
  }) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.institutionalExams,
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
