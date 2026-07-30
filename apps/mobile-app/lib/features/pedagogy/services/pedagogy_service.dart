/// ============================================================================
/// PEDAGOGY SERVICE — Academia Hub Mobile
/// ============================================================================
///
/// Service CRUD pour le module Pédagogie, miroir du web app (pedagogy.service.ts).
///
/// Étend [BaseCrudService] et fournit les méthodes spécifiques au module :
/// - CRUD de base (getAll, create, update, delete)
/// - Cahier de textes (Class Diaries) avec CRUD
/// - Fiches pédagogiques (Lesson Plans) avec CRUD
/// - Affectations enseignants (Assignments) avec CRUD
/// - Matières (Subjects)
/// - Enseignants (Teachers)
/// - Emploi du temps (Timetables)
/// - Tableau de bord KPI pédagogie
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

class PedagogyService extends BaseCrudService {
  // ─── Singleton ────────────────────────────────────────────────────────────

  static PedagogyService? _instance;

  /// Instance singleton du service.
  static PedagogyService get instance => _instance ??= PedagogyService._();

  PedagogyService._() : super(
    endpoint: ApiConfig.pedagogy,
    collection: 'pedagogy',
    entityType: SyncEntityType.classDiary,
  );

  // ─── CRUD de base ────────────────────────────────────────────────────────

  /// Récupère toutes les entités pédagogie avec filtres optionnels.
  ///
  /// Miroir de `pedagogyService.getAll()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getAll({
    Map<String, dynamic>? params,
  }) => super.getAll(params: params);

  /// Crée une nouvelle entité pédagogie.
  ///
  /// Miroir de `pedagogyService.create(data)` du web app.
  /// Hors ligne → outbox pattern (SyncEntityType.classDiary).
  Future<ApiResult<Map<String, dynamic>>> create(
    Map<String, dynamic> data,
  ) => super.create(data);

  /// Met à jour une entité pédagogie existante.
  ///
  /// Miroir de `pedagogyService.update(id, data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> update(
    String id,
    Map<String, dynamic> data,
  ) => super.update(id, data);

  /// Supprime une entité pédagogie.
  ///
  /// Miroir de `pedagogyService.delete(id)` du web app.
  /// Hors ligne → soft delete + outbox pattern.
  Future<ApiResult<void>> delete(String id) => super.delete(id);

  // ─── Cahier de textes (Class Diaries) ─────────────────────────────────────

  /// Récupère tous les cahiers de textes.
  ///
  /// Miroir de `pedagogyService.getClassDiaries()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getClassDiaries({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.classDiaries,
        params: params,
        localCollection: 'pedagogy',
        localFilters: {'type': 'classDiary'},
      );

  /// Crée un nouveau cahier de textes.
  ///
  /// Miroir de `pedagogyService.createClassDiary(data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> createClassDiary(
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.classDiaries,
        data,
        offlineEntityType: SyncEntityType.classDiary,
      );

  // ─── Fiches pédagogiques (Lesson Plans) ───────────────────────────────────

  /// Récupère toutes les fiches pédagogiques.
  ///
  /// Miroir de `pedagogyService.getLessonPlans()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getLessonPlans({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.lessonPlans,
        params: params,
        localCollection: 'pedagogy',
        localFilters: {'type': 'lessonPlan'},
      );

  /// Crée une nouvelle fiche pédagogique.
  ///
  /// Miroir de `pedagogyService.createLessonPlan(data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> createLessonPlan(
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.lessonPlans,
        data,
        offlineEntityType: SyncEntityType.lessonPlan,
      );

  // ─── Affectations enseignants (Assignments) ──────────────────────────────

  /// Récupère toutes les affectations enseignants.
  ///
  /// Miroir de `pedagogyService.getAssignments()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getAssignments({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.pedagogyAssignments,
        params: params,
        localCollection: 'pedagogy',
        localFilters: {'type': 'assignment'},
      );

  /// Crée une nouvelle affectation enseignant.
  ///
  /// Miroir de `pedagogyService.createAssignment(data)` du web app.
  /// Hors ligne → outbox pattern.
  Future<ApiResult<Map<String, dynamic>>> createAssignment(
    Map<String, dynamic> data,
  ) =>
      apiPostWithOfflineFallback<Map<String, dynamic>>(
        ApiConfig.pedagogyAssignments,
        data,
        offlineEntityType: SyncEntityType.teacherClassAssignment,
      );

  // ─── Matières (Subjects) ─────────────────────────────────────────────────

  /// Récupère toutes les matières.
  ///
  /// Miroir de `pedagogyService.getSubjects()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getSubjects({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.subjects,
        params: params,
        localCollection: 'pedagogy',
        localFilters: {'type': 'subject'},
      );

  // ─── Enseignants (Teachers) ──────────────────────────────────────────────

  /// Récupère tous les enseignants.
  ///
  /// Miroir de `pedagogyService.getTeachers()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getTeachers({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.teachers,
        params: params,
        localCollection: 'pedagogy',
        localFilters: {'type': 'teacher'},
      );

  // ─── Emploi du temps (Timetables) ────────────────────────────────────────

  /// Récupère tous les emplois du temps.
  ///
  /// Miroir de `pedagogyService.getTimetables()` du web app.
  Future<ApiResult<List<Map<String, dynamic>>>> getTimetables({
    Map<String, dynamic>? params,
  }) =>
      apiGetWithFallback<List<Map<String, dynamic>>>(
        ApiConfig.timetables,
        params: params,
        localCollection: 'pedagogy',
        localFilters: {'type': 'timetable'},
      );

  // ─── Tableau de bord KPI ─────────────────────────────────────────────────

  /// Récupère le tableau de bord KPI pédagogie pour une année académique.
  ///
  /// Miroir de `pedagogyService.getKpiDashboard(academicYearId)` du web app.
  Future<ApiResult<Map<String, dynamic>>> getKpiDashboard(
    String academicYearId,
  ) =>
      apiGetWithFallback<Map<String, dynamic>>(
        ApiConfig.pedagogyKpiDashboard(academicYearId),
      );
}
