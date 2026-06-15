/// ============================================================================
/// PEDAGOGY SERVICE — Academia Hub Mobile
/// ============================================================================
///
/// Service CRUD pour le module Pédagogie (Offline-First).
/// Miroir de pedagogy.service.ts du web app.
///
/// Méthodes :
/// - getClassDiaries, createClassDiary, updateClassDiary (Cahier de textes)
/// - getLessonPlans, createLessonPlan, updateLessonPlan (Fiches pédagogiques)
/// - getLessonJournals, createLessonJournal (Cahier journal)
/// - getTeacherAssignments, createTeacherAssignment (Affectations)
/// - getSubjects, createSubject, updateSubject, deleteSubject (Matières)
/// - getSeries, createSeries (Séries académiques)
/// - getTeachers, createTeacher, updateTeacher (Enseignants)
/// - getTeacherProfiles, createTeacherProfile (Profils enseignants)
/// - getAcademicClasses, getClassSubjects (Classes & Structure)
/// - getTimetables (Emploi du temps)
/// - getHomeworkEntries, createHomeworkEntry (Devoirs)
/// - getSemainier, createSemainier (Semainier)
/// - getPedagogicalMaterials (Matériel pédagogique)
/// - getKpiDashboard, getOrionDashboard (Analytics)
/// ============================================================================

import '../../core/crud/base_crud_service.dart';
import '../../core/network/api_config.dart';
import '../../core/network/api_result.dart';
import '../../core/network/api_client.dart';
import '../../core/offline/offline_service.dart';

class PedagogyService extends BaseCrudService {
  PedagogyService()
      : super(
          endpoint: ApiConfig.pedagogy,
          collection: 'pedagogy',
          entityType: SyncEntityType.classDiary,
        );

  // ─── Cahier de textes ────────────────────────────────────────────────────

  /// Récupère les cahiers de textes pour une classe/matière.
  Future<ApiResult<List<Map<String, dynamic>>>> getClassDiaries(
    String classSubjectId,
  ) async {
    return apiGetWithFallback(
      '${ApiConfig.classDiaries}?classSubjectId=$classSubjectId',
      localCollection: 'class_diaries',
      localFilters: {'classSubjectId': classSubjectId},
    );
  }

  /// Crée un cahier de textes.
  Future<ApiResult<Map<String, dynamic>>> createClassDiary(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.classDiaries,
      data,
      offlineEntityType: SyncEntityType.classDiary,
    );
  }

  /// Met à jour un cahier de textes.
  Future<ApiResult<Map<String, dynamic>>> updateClassDiary(
    String id,
    Map<String, dynamic> data,
  ) async {
    return apiUpdateWithOfflineFallback(
      ApiConfig.classDiaryById(id),
      id,
      data,
      offlineEntityType: SyncEntityType.classDiary,
    );
  }

  // ─── Fiches pédagogiques ─────────────────────────────────────────────────

  /// Récupère les fiches pédagogiques.
  Future<ApiResult<List<Map<String, dynamic>>>> getLessonPlans({
    String? classSubjectId,
  }) async {
    final path = classSubjectId != null
        ? '${ApiConfig.lessonPlans}?classSubjectId=$classSubjectId'
        : ApiConfig.lessonPlans;
    return apiGetWithFallback(
      path,
      localCollection: 'lesson_plans',
    );
  }

  /// Crée une fiche pédagogique.
  Future<ApiResult<Map<String, dynamic>>> createLessonPlan(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.lessonPlans,
      data,
      offlineEntityType: SyncEntityType.lessonPlan,
    );
  }

  /// Met à jour une fiche pédagogique.
  Future<ApiResult<Map<String, dynamic>>> updateLessonPlan(
    String id,
    Map<String, dynamic> data,
  ) async {
    return apiUpdateWithOfflineFallback(
      ApiConfig.lessonPlanById(id),
      id,
      data,
      offlineEntityType: SyncEntityType.lessonPlan,
    );
  }

  // ─── Cahier journal ──────────────────────────────────────────────────────

  /// Récupère les cahiers journal.
  Future<ApiResult<List<Map<String, dynamic>>>> getLessonJournals({
    String? date,
  }) async {
    final path = date != null
        ? '${ApiConfig.lessonJournals}?date=$date'
        : ApiConfig.lessonJournals;
    return apiGetWithFallback(
      path,
      localCollection: 'lesson_journals',
    );
  }

  /// Crée un cahier journal.
  Future<ApiResult<Map<String, dynamic>>> createLessonJournal(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.lessonJournals,
      data,
      offlineEntityType: SyncEntityType.lessonJournal,
    );
  }

  /// Met à jour un cahier journal.
  Future<ApiResult<Map<String, dynamic>>> updateLessonJournal(
    String id,
    Map<String, dynamic> data,
  ) async {
    return apiUpdateWithOfflineFallback(
      ApiConfig.lessonJournalById(id),
      id,
      data,
      offlineEntityType: SyncEntityType.lessonJournal,
    );
  }

  // ─── Affectations enseignants ────────────────────────────────────────────

  /// Récupère les affectations d'un enseignant.
  Future<ApiResult<List<Map<String, dynamic>>>> getTeacherAssignments(
    String teacherId,
    String academicYearId,
  ) async {
    return apiGetWithFallback(
      '${ApiConfig.pedagogyAssignments}?teacherId=$teacherId&academicYearId=$academicYearId',
      localCollection: 'teacher_class_assignments',
      localFilters: {'teacherId': teacherId, 'academicYearId': academicYearId},
    );
  }

  /// Crée une affectation enseignant.
  Future<ApiResult<Map<String, dynamic>>> createTeacherAssignment(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.pedagogyAssignments,
      data,
      offlineEntityType: SyncEntityType.teacherClassAssignment,
    );
  }

  /// Supprime une affectation enseignant.
  Future<ApiResult<void>> deleteTeacherAssignment(String id) async {
    return apiDeleteWithOfflineFallback(
      ApiConfig.pedagogyAssignmentById(id),
      id,
      offlineEntityType: SyncEntityType.teacherClassAssignment,
    );
  }

  // ─── Matières ────────────────────────────────────────────────────────────

  /// Récupère les matières pour une année académique.
  Future<ApiResult<List<Map<String, dynamic>>>> getSubjects(
    String academicYearId,
  ) async {
    return apiGetWithFallback(
      '${ApiConfig.subjects}?academicYearId=$academicYearId',
      localCollection: 'subjects',
      localFilters: {'academicYearId': academicYearId},
    );
  }

  /// Crée une matière.
  Future<ApiResult<Map<String, dynamic>>> createSubject(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.subjects,
      data,
      offlineEntityType: SyncEntityType.subject,
    );
  }

  /// Met à jour une matière.
  Future<ApiResult<Map<String, dynamic>>> updateSubject(
    String id,
    Map<String, dynamic> data,
  ) async {
    return apiUpdateWithOfflineFallback(
      ApiConfig.subjectById(id),
      id,
      data,
      offlineEntityType: SyncEntityType.subject,
    );
  }

  /// Supprime une matière.
  Future<ApiResult<void>> deleteSubject(String id) async {
    return apiDeleteWithOfflineFallback(
      ApiConfig.subjectById(id),
      id,
      offlineEntityType: SyncEntityType.subject,
    );
  }

  // ─── Séries académiques ──────────────────────────────────────────────────

  /// Récupère les séries académiques.
  Future<ApiResult<List<Map<String, dynamic>>>> getSeries(
    String academicYearId,
  ) async {
    return apiGetWithFallback(
      '${ApiConfig.academicSeries}?academicYearId=$academicYearId',
      localCollection: 'academic_series',
      localFilters: {'academicYearId': academicYearId},
    );
  }

  /// Crée une série académique.
  Future<ApiResult<Map<String, dynamic>>> createSeries(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.academicSeries,
      data,
      offlineEntityType: SyncEntityType.academicSeries,
    );
  }

  /// Met à jour une série académique.
  Future<ApiResult<Map<String, dynamic>>> updateSeries(
    String id,
    Map<String, dynamic> data,
  ) async {
    return apiUpdateWithOfflineFallback(
      ApiConfig.academicSeriesById(id),
      id,
      data,
      offlineEntityType: SyncEntityType.academicSeries,
    );
  }

  /// Ajoute une matière à une série.
  Future<ApiResult<Map<String, dynamic>>> addSubjectToSeries(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.academicSeriesSubjects,
      data,
      offlineEntityType: SyncEntityType.seriesSubject,
    );
  }

  /// Retire une matière d'une série.
  Future<ApiResult<void>> removeSubjectFromSeries(String id) async {
    return apiDeleteWithOfflineFallback(
      ApiConfig.academicSeriesSubjectById(id),
      id,
      offlineEntityType: SyncEntityType.seriesSubject,
    );
  }

  // ─── Enseignants ─────────────────────────────────────────────────────────

  /// Récupère la liste des enseignants.
  Future<ApiResult<List<Map<String, dynamic>>>> getTeachers() async {
    return apiGetWithFallback(
      ApiConfig.teachers,
      localCollection: 'teachers',
    );
  }

  /// Crée un enseignant.
  Future<ApiResult<Map<String, dynamic>>> createTeacher(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.teachers,
      data,
      offlineEntityType: SyncEntityType.teacher,
    );
  }

  /// Met à jour un enseignant.
  Future<ApiResult<Map<String, dynamic>>> updateTeacher(
    String id,
    Map<String, dynamic> data,
  ) async {
    return apiUpdateWithOfflineFallback(
      ApiConfig.teacherById(id),
      id,
      data,
      offlineEntityType: SyncEntityType.teacher,
    );
  }

  // ─── Profils enseignants ─────────────────────────────────────────────────

  /// Récupère les profils enseignants.
  Future<ApiResult<List<Map<String, dynamic>>>> getTeacherProfiles(
    String academicYearId,
  ) async {
    return apiGetWithFallback(
      '${ApiConfig.teacherProfiles}?academicYearId=$academicYearId',
      localCollection: 'teacher_profiles',
      localFilters: {'academicYearId': academicYearId},
    );
  }

  /// Crée un profil enseignant.
  Future<ApiResult<Map<String, dynamic>>> createTeacherProfile(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.teacherProfiles,
      data,
      offlineEntityType: SyncEntityType.teacherProfile,
    );
  }

  /// Met à jour un profil enseignant.
  Future<ApiResult<Map<String, dynamic>>> updateTeacherProfile(
    String id,
    Map<String, dynamic> data,
  ) async {
    return apiUpdateWithOfflineFallback(
      ApiConfig.teacherProfileById(id),
      id,
      data,
      offlineEntityType: SyncEntityType.teacherProfile,
    );
  }

  // ─── Classes & Structure académique ──────────────────────────────────────

  /// Récupère les classes académiques.
  Future<ApiResult<List<Map<String, dynamic>>>> getAcademicClasses(
    String academicYearId,
  ) async {
    return apiGetWithFallback(
      '${ApiConfig.academicClasses}?academicYearId=$academicYearId',
      localCollection: 'classes',
      localFilters: {'academicYearId': academicYearId},
    );
  }

  /// Récupère les matières d'une classe.
  Future<ApiResult<List<Map<String, dynamic>>>> getClassSubjects(
    String classId,
    String academicYearId,
  ) async {
    return apiGetWithFallback(
      '${ApiConfig.classSubjects(classId)}?academicYearId=$academicYearId',
      localCollection: 'class_subjects',
      localFilters: {'classId': classId, 'academicYearId': academicYearId},
    );
  }

  /// Retire une matière d'une classe.
  Future<ApiResult<void>> removeClassSubject(String id) async {
    return apiDeleteWithOfflineFallback(
      ApiConfig.classSubjectById(id),
      id,
    );
  }

  // ─── Emploi du temps ─────────────────────────────────────────────────────

  /// Récupère les emplois du temps.
  Future<ApiResult<List<Map<String, dynamic>>>> getTimetables({
    Map<String, dynamic>? params,
  }) async {
    try {
      final result = await ApiClient.instance.getRaw(
        ApiConfig.timetables,
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

  // ─── Semainier ───────────────────────────────────────────────────────────

  /// Récupère le semainier courant.
  Future<ApiResult<Map<String, dynamic>?>> getCurrentSemainier(
    String academicYearId,
    String schoolLevelId,
  ) async {
    final isConnected =
        await OfflineService.instance._connectivityService.isConnected;
    if (!isConnected) {
      final results = await searchLocal(
        filters: {'academicYearId': academicYearId},
      );
      return ApiSuccess(results.isNotEmpty ? results.first : null);
    }
    try {
      final result = await ApiClient.instance.getRaw(
        '${ApiConfig.semainier}/current?academicYearId=$academicYearId&schoolLevelId=$schoolLevelId',
      );
      return result.when(
        success: (data) => ApiSuccess(data),
        failure: (error) async {
          final results = await searchLocal(
            filters: {'academicYearId': academicYearId},
          );
          return ApiSuccess(results.isNotEmpty ? results.first : null);
        },
        loading: () => const ApiResult.loading(),
      );
    } catch (e) {
      final results = await searchLocal(
        filters: {'academicYearId': academicYearId},
      );
      return ApiSuccess(results.isNotEmpty ? results.first : null);
    }
  }

  /// Crée un semainier.
  Future<ApiResult<Map<String, dynamic>>> createSemainier(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.semainier,
      data,
      offlineEntityType: SyncEntityType.homeworkEntry,
    );
  }

  /// Ajoute une entrée journalière au semainier.
  Future<ApiResult<Map<String, dynamic>>> addSemainierDailyEntry(
    String semainierId,
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.semainierDailyEntries(semainierId),
      {'semainierId': semainierId, 'action': 'ADD_ENTRY', ...data},
      offlineEntityType: SyncEntityType.homeworkEntry,
    );
  }

  /// Signale un incident dans le semainier.
  Future<ApiResult<Map<String, dynamic>>> reportSemainierIncident(
    String semainierId,
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.semainierIncidents(semainierId),
      {'semainierId': semainierId, 'action': 'REPORT_INCIDENT', ...data},
      offlineEntityType: SyncEntityType.incident,
    );
  }

  /// Soumet un semainier.
  Future<ApiResult<Map<String, dynamic>>> submitSemainier(
    String semainierId,
  ) async {
    return apiUpdateWithOfflineFallback(
      ApiConfig.semainierSubmit(semainierId),
      semainierId,
      {'status': 'SOUMIS'},
      offlineEntityType: SyncEntityType.homeworkEntry,
    );
  }

  // ─── Devoirs & Exercices ─────────────────────────────────────────────────

  /// Récupère les devoirs.
  Future<ApiResult<List<Map<String, dynamic>>>> getHomeworkEntries({
    String? classId,
  }) async {
    final path = classId != null
        ? '${ApiConfig.homeworkEntries}?classId=$classId'
        : ApiConfig.homeworkEntries;
    return apiGetWithFallback(
      path,
      localCollection: 'homework_entries',
    );
  }

  /// Crée un devoir.
  Future<ApiResult<Map<String, dynamic>>> createHomeworkEntry(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.homeworkEntries,
      data,
      offlineEntityType: SyncEntityType.homeworkEntry,
    );
  }

  /// Met à jour un devoir.
  Future<ApiResult<Map<String, dynamic>>> updateHomeworkEntry(
    String id,
    Map<String, dynamic> data,
  ) async {
    return apiUpdateWithOfflineFallback(
      ApiConfig.homeworkEntryById(id),
      id,
      data,
      offlineEntityType: SyncEntityType.homeworkEntry,
    );
  }

  /// Supprime un devoir.
  Future<ApiResult<void>> deleteHomeworkEntry(String id) async {
    return apiDeleteWithOfflineFallback(
      ApiConfig.homeworkEntryById(id),
      id,
      offlineEntityType: SyncEntityType.homeworkEntry,
    );
  }

  // ─── Matériel pédagogique ────────────────────────────────────────────────

  /// Récupère le matériel pédagogique.
  Future<ApiResult<List<Map<String, dynamic>>>> getPedagogicalMaterials(
    String academicYearId,
  ) async {
    return apiGetWithFallback(
      '${ApiConfig.pedagogicalMaterials}?academicYearId=$academicYearId',
      localCollection: 'pedagogical_materials',
    );
  }

  /// Crée un matériel pédagogique.
  Future<ApiResult<Map<String, dynamic>>> createPedagogicalMaterial(
    Map<String, dynamic> data,
  ) async {
    return apiPostWithOfflineFallback(
      ApiConfig.pedagogicalMaterials,
      data,
      offlineEntityType: SyncEntityType.pedagogicalMaterial,
    );
  }

  /// Met à jour un matériel pédagogique.
  Future<ApiResult<Map<String, dynamic>>> updatePedagogicalMaterial(
    String id,
    Map<String, dynamic> data,
  ) async {
    return apiUpdateWithOfflineFallback(
      ApiConfig.pedagogicalMaterialById(id),
      id,
      data,
      offlineEntityType: SyncEntityType.pedagogicalMaterial,
    );
  }

  /// Supprime un matériel pédagogique.
  Future<ApiResult<void>> deletePedagogicalMaterial(String id) async {
    return apiDeleteWithOfflineFallback(
      ApiConfig.pedagogicalMaterialById(id),
      id,
      offlineEntityType: SyncEntityType.pedagogicalMaterial,
    );
  }

  // ─── Contrôle & Analytics ────────────────────────────────────────────────

  /// Tableau de bord KPI pédagogie.
  Future<ApiResult<Map<String, dynamic>>> getKpiDashboard(
    String academicYearId,
  ) async {
    return ApiClient.instance.getRaw(
      ApiConfig.pedagogyKpiDashboard(academicYearId),
    );
  }

  /// Tableau de bord ORION pédagogie.
  Future<ApiResult<Map<String, dynamic>>> getOrionDashboard(
    String academicYearId,
  ) async {
    return ApiClient.instance.getRaw(
      ApiConfig.pedagogyOrionDashboard(academicYearId),
    );
  }

  // ─── Alias pour createAssignment ─────────────────────────────────────────

  /// Alias — crée une affectation (comme le web app).
  Future<ApiResult<Map<String, dynamic>>> createAssignment(
    Map<String, dynamic> data,
  ) async {
    return createTeacherAssignment(data);
  }
}
