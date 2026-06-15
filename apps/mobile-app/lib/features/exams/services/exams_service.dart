/// ============================================================================
/// EXAMS SERVICE — Academia Hub Mobile
/// ============================================================================
///
/// Service CRUD pour le module Examens, miroir du web app (exams.service.ts).
///
/// Étend [BaseCrudService] et fournit les méthodes spécifiques au module :
/// - CRUD de base (getAll, create, update, delete)
/// - Évaluations (Evaluations) avec CRUD
/// - Notes (Grades) avec sauvegarde en masse
/// - Bulletins scolaires
/// - Conseils de classe (Councils)
/// - Configuration examens
/// - Tableau de bord examens
///
/// Pattern offline-first :
/// - Lectures → apiGetWithFallback (API avec fallback local)
/// - Écritures → apiPostWithOfflineFallback / apiUpdateWithOfflineFallback
///   (API avec outbox pattern hors ligne)
/// ============================================================================

import '../../../core/crud/base_crud_service.dart';
import '../../../core/network/api_config.dart';
import '../../../core/network/api_result.dart';
import '../../../core/offline/offline_service.dart';

class ExamsService extends BaseCrudService {
  // ─── Singleton ────────────────────────────────────────────────────────────

  static ExamsService? _instance;

  /// Instance singleton du service.
  static ExamsService get instance => _instance ??= ExamsService._();

  ExamsService._() : super(
    endpoint: ApiConfig.exams,
    collection: 'exams',
    entityType: SyncEntityType.exam,
  );

  // ─── CRUD de base ────────────────────────────────────────────────────────

  /// Récupère tous les examens avec filtres optionnels.
  ///
  /// Miroir de `examsService.getAll()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getAll({
    Map<String, dynamic>? params,
  }) => super.getAll(params: params);

  /// Crée un nouvel examen.
  ///
  /// Miroir de `examsService.create(data)` du web app.
  /// Hors ligne → outbox pattern (SyncEntityType.exam).
  Future<ApiResult<Map<String, dynamic>>> create(
    Map<String, dynamic> data,
  ) => super.create(data);

  /// Met à jour un examen existant.
  ///
  /// Miroir de `examsService.update(id, data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> update(
    String id,
    Map<String, dynamic> data,
  ) => super.update(id, data);

  /// Supprime un examen.
  ///
  /// Miroir de `examsService.delete(id)` du web app.
  /// Hors ligne → soft delete + outbox pattern.
  Future<ApiResult<void>> delete(String id) => super.delete(id);

  // ─── Évaluations ─────────────────────────────────────────────────────────

  /// Récupère toutes les évaluations.
  ///
  /// Miroir de `examsService.getEvaluations()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getEvaluations({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.examEvaluations,
        params: params,
        localCollection: 'exams',
        localFilters: {'type': 'evaluation'},
      );

  /// Crée une nouvelle évaluation.
  ///
  /// Miroir de `examsService.createEvaluation(data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> createEvaluation(
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.examEvaluations,
        data,
        offlineEntityType: SyncEntityType.exam,
      );

  // ─── Notes (Grades) ──────────────────────────────────────────────────────

  /// Récupère les notes, optionnellement filtrées par évaluation.
  ///
  /// Miroir de `examsService.getGrades(evaluationId)` du web app.
  /// Si [evaluationId] est fourni, filtre les notes pour cette évaluation.
  Future<ApiResult<List<Map<String, dynamic>>>> getGrades({
    String? evaluationId,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        evaluationId != null
            ? ApiConfig.examGradesByEvaluation(evaluationId)
            : ApiConfig.examGrades,
        localCollection: 'exams',
        localFilters: {
          'type': 'grade',
          if (evaluationId != null) 'evaluationId': evaluationId,
        },
      );

  /// Sauvegarde les notes en masse (bulk).
  ///
  /// Miroir de `examsService.saveGrades(data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> saveGrades(
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.examSaveGrades,
        data,
        offlineEntityType: SyncEntityType.grade,
      );

  // ─── Bulletins ───────────────────────────────────────────────────────────

  /// Récupère les bulletins scolaires, optionnellement filtrés par classe.
  ///
  /// Miroir de `examsService.getBulletins(classId)` du web app.
  /// Si [classId] est fourni, filtre les bulletins pour cette classe.
  Future<ApiResult<List<Map<String, dynamic>>>> getBulletins({
    String? classId,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        classId != null
            ? ApiConfig.examBulletinByClass(classId)
            : ApiConfig.examBulletins,
        localCollection: 'exams',
        localFilters: {
          'type': 'bulletin',
          if (classId != null) 'classId': classId,
        },
      );

  // ─── Conseils de classe (Councils) ───────────────────────────────────────

  /// Récupère tous les conseils de classe.
  ///
  /// Miroir de `examsService.getCouncils()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getCouncils({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.examCouncils,
        params: params,
        localCollection: 'exams',
        localFilters: {'type': 'council'},
      );

  // ─── Configuration examens ───────────────────────────────────────────────

  /// Récupère la configuration des examens.
  ///
  /// Miroir de `examsService.getConfig()` du web app.
  Future<ApiResult<Map<String, dynamic>>> getConfig() =>
      apiGetWithFallback<Map<String, dynamic>>(
        ApiConfig.examConfig,
      );

  // ─── Tableau de bord ─────────────────────────────────────────────────────

  /// Récupère le tableau de bord des examens pour une année académique.
  ///
  /// Miroir de `examsService.getDashboard(academicYearId)` du web app.
  Future<ApiResult<Map<String, dynamic>>> getDashboard(
    String academicYearId,
  ) =>
      apiGetWithFallback<Map<String, dynamic>>(
        ApiConfig.examDashboard(academicYearId),
      );
}
