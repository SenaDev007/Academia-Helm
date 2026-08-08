import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';
import '../../../core/network/api_result.dart';

/// Service for the Pedagogy Space API (/pedagogy-space/*).
///
/// Mirrors the web app's pedagogy-space endpoints.
class PedagogySpaceService {
  PedagogySpaceService(this._apiClient);

  final ApiClient _apiClient;

  /// GET /pedagogy-space/attendance/:classId?date=YYYY-MM-DD
  Future<ApiResult<Map<String, dynamic>>> getDailyAttendance({
    required String classId,
    required String date,
  }) async {
    return _apiClient.getRaw(
      ApiConfig.pedagogySpaceAttendanceByClass(classId),
      queryParameters: {'date': date},
    );
  }

  /// POST /pedagogy-space/attendance
  Future<ApiResult<Map<String, dynamic>>> saveDailyAttendance({
    required String academicYearId,
    required String classId,
    required String date,
    required List<Map<String, dynamic>> records,
    String? schoolLevelId,
  }) async {
    return _apiClient.postRaw(
      ApiConfig.pedagogySpaceAttendance,
      data: {
        'academicYearId': academicYearId,
        'classId': classId,
        'date': date,
        'records': records,
        if (schoolLevelId != null) 'schoolLevelId': schoolLevelId,
      },
    );
  }

  /// POST /pedagogy-space/cahier-journal (load/get-or-create)
  Future<ApiResult<Map<String, dynamic>>> loadCahierJournal({
    required String academicYearId,
    required String classId,
    required String teacherId,
    required String weekStart,
  }) async {
    return _apiClient.postRaw(
      ApiConfig.pedagogySpaceCahierJournal,
      data: {
        'academicYearId': academicYearId,
        'classId': classId,
        'teacherId': teacherId,
        'weekStart': weekStart,
      },
    );
  }

  /// PUT /pedagogy-space/cahier-journal/:id
  Future<ApiResult<Map<String, dynamic>>> updateCahierJournal({
    required String journalId,
    required Map<String, dynamic> data,
  }) async {
    return _apiClient.putRaw(
      ApiConfig.pedagogySpaceCahierJournalById(journalId),
      data: data,
    );
  }

  /// POST /pedagogy-space/cahier-journal/:id/submit-with-fiches
  Future<ApiResult<Map<String, dynamic>>> submitCahierJournalWithFiches({
    required String journalId,
    required List<String> dayRange,
  }) async {
    return _apiClient.postRaw(
      ApiConfig.pedagogySpaceCahierJournalSubmitWithFiches(journalId),
      data: {'dayRange': dayRange},
    );
  }

  /// GET /pedagogy-space/homeworks?teacherId=…&academicYearId=…
  Future<ApiResult<Map<String, dynamic>>> getHomeworks({
    required String teacherId,
    String? academicYearId,
  }) async {
    return _apiClient.getRaw(
      ApiConfig.pedagogySpaceHomeworks,
      queryParameters: {
        'teacherId': teacherId,
        if (academicYearId != null) 'academicYearId': academicYearId,
      },
    );
  }

  /// POST /pedagogy-space/homeworks
  Future<ApiResult<Map<String, dynamic>>> createHomework({
    required Map<String, dynamic> data,
  }) async {
    return _apiClient.postRaw(
      ApiConfig.pedagogySpaceHomeworks,
      data: data,
    );
  }

  /// GET /pedagogy-space/homeworks/:id/students
  Future<ApiResult<Map<String, dynamic>>> getHomeworkStudents({
    required String homeworkId,
  }) async {
    return _apiClient.getRaw(
      ApiConfig.pedagogySpaceHomeworkStudents(homeworkId),
    );
  }

  /// PUT /pedagogy-space/task-students/:taskId
  Future<ApiResult<Map<String, dynamic>>> updateTaskStudent({
    required String taskId,
    required Map<String, dynamic> data,
  }) async {
    return _apiClient.putRaw(
      ApiConfig.pedagogySpaceTaskStudents(taskId),
      data: data,
    );
  }

  /// GET /institutional-exams/evaluations?teacherId=…
  Future<ApiResult<Map<String, dynamic>>> getTeacherEvaluations({
    required String teacherId,
    String? academicYearId,
    String? schoolLevelId,
  }) async {
    return _apiClient.getRaw(
      ApiConfig.institutionalExamsEvaluations,
      queryParameters: {
        'teacherId': teacherId,
        if (academicYearId != null) 'academicYearId': academicYearId,
        if (schoolLevelId != null) 'schoolLevelId': schoolLevelId,
      },
    );
  }

  /// GET /institutional-exams/grades/evaluation/:id
  Future<ApiResult<Map<String, dynamic>>> getEvaluationGrades({
    required String evaluationId,
  }) async {
    return _apiClient.getRaw(
      ApiConfig.examGradesByEvaluation(evaluationId),
    );
  }

  /// POST /institutional-exams/grades/evaluation/:id/bulk
  Future<ApiResult<Map<String, dynamic>>> saveGradesBulk({
    required String evaluationId,
    required List<Map<String, dynamic>> grades,
  }) async {
    return _apiClient.postRaw(
      ApiConfig.examGradesBulkByEvaluation(evaluationId),
      data: grades,
    );
  }

  /// POST /institutional-exams/evaluations/:id/open
  Future<ApiResult<Map<String, dynamic>>> openEvaluation({
    required String evaluationId,
  }) async {
    return _apiClient.postRaw(
      ApiConfig.examEvaluationOpen(evaluationId),
    );
  }

  // ── Attendance Registers (Registre d'Appel) ────────────────────────

  /// POST /pedagogy-space/attendance-registers (load/get-or-create)
  Future<ApiResult<Map<String, dynamic>>> loadAttendanceRegister({
    required String academicYearId,
    required String classId,
    required int month,
    required int year,
  }) async {
    return _apiClient.postRaw(
      ApiConfig.pedagogySpaceAttendanceRegisters,
      data: {
        'academicYearId': academicYearId,
        'classId': classId,
        'month': month,
        'year': year,
      },
    );
  }

  /// PUT /pedagogy-space/attendance-registers/:id
  Future<ApiResult<Map<String, dynamic>>> updateAttendanceRegister({
    required String registerId,
    required Map<String, dynamic> data,
  }) async {
    return _apiClient.putRaw(
      '/pedagogy-space/attendance-registers/$registerId',
      data: data,
    );
  }

  /// POST /pedagogy-space/submit-unified
  Future<ApiResult<Map<String, dynamic>>> submitUnified({
    required Map<String, dynamic> data,
  }) async {
    return _apiClient.postRaw(
      ApiConfig.pedagogySpaceSubmitUnified,
      data: data,
    );
  }

  /// POST /pedagogy-space/notify-director
  Future<ApiResult<Map<String, dynamic>>> notifyDirector({
    required Map<String, dynamic> data,
  }) async {
    return _apiClient.postRaw(
      ApiConfig.pedagogySpaceNotifyDirector,
      data: data,
    );
  }

  // ── Monthly Evaluations & Summaries ────────────────────────────────

  /// POST /pedagogy-space/monthly-evaluations
  Future<ApiResult<Map<String, dynamic>>> getMonthlyEvaluations({
    required Map<String, dynamic> data,
  }) async {
    return _apiClient.postRaw(
      ApiConfig.pedagogySpaceMonthlyEvaluations,
      data: data,
    );
  }

  /// GET /pedagogy-space/monthly-summaries?academicYearId=…&classId=…
  Future<ApiResult<Map<String, dynamic>>> getMonthlySummaries({
    required String academicYearId,
    required String classId,
  }) async {
    return _apiClient.getRaw(
      ApiConfig.pedagogySpaceMonthlySummaries,
      queryParameters: {
        'academicYearId': academicYearId,
        'classId': classId,
      },
    );
  }

  /// POST /pedagogy-space/monthly-summaries/refresh
  Future<ApiResult<Map<String, dynamic>>> refreshMonthlySummaries({
    required String classId,
  }) async {
    return _apiClient.postRaw(
      ApiConfig.pedagogySpaceMonthlySummariesRefresh(classId),
    );
  }

  // ── Fiches Pédagogiques ────────────────────────────────────────────

  /// GET /pedagogy-space/fiches?teacherId=…&academicYearId=…&classId=…&sheetType=…
  Future<ApiResult<Map<String, dynamic>>> getFiches({
    required String teacherId,
    String? academicYearId,
    String? classId,
    String? sheetType,
  }) async {
    return _apiClient.getRaw(
      ApiConfig.pedagogySpaceFiches,
      queryParameters: {
        'teacherId': teacherId,
        if (academicYearId != null) 'academicYearId': academicYearId,
        if (classId != null) 'classId': classId,
        if (sheetType != null) 'sheetType': sheetType,
      },
    );
  }

  /// POST /pedagogy-space/fiches
  Future<ApiResult<Map<String, dynamic>>> createFiche({
    required Map<String, dynamic> data,
  }) async {
    return _apiClient.postRaw(
      ApiConfig.pedagogySpaceFiches,
      data: data,
    );
  }

  /// PUT /pedagogy-space/fiches/:id
  Future<ApiResult<Map<String, dynamic>>> updateFiche({
    required String ficheId,
    required Map<String, dynamic> data,
  }) async {
    return _apiClient.putRaw(
      ApiConfig.pedagogySpaceFicheById(ficheId),
      data: data,
    );
  }

  /// DELETE /pedagogy-space/fiches/:id
  Future<ApiResult<Map<String, dynamic>>> deleteFiche({
    required String ficheId,
  }) async {
    return _apiClient.deleteRaw(
      ApiConfig.pedagogySpaceFicheById(ficheId),
    );
  }

  /// POST /pedagogy-space/fiches/:id/submit
  Future<ApiResult<Map<String, dynamic>>> submitFiche({
    required String ficheId,
  }) async {
    return _apiClient.postRaw(
      ApiConfig.pedagogySpaceFicheSubmit(ficheId),
    );
  }

  // ── Cahier de Semaine (Semainier) ──────────────────────────────────

  /// GET /pedagogy-space/seminar-config?academicYearId=…
  Future<ApiResult<Map<String, dynamic>>> getSeminarConfig({
    required String academicYearId,
  }) async {
    return _apiClient.getRaw(
      ApiConfig.pedagogySpaceSeminarConfig,
      queryParameters: {'academicYearId': academicYearId},
    );
  }

  /// POST /pedagogy-space/seminar-config/auto-generate
  Future<ApiResult<Map<String, dynamic>>> autoGenerateSeminar({
    required String academicYearId,
  }) async {
    return _apiClient.postRaw(
      '${ApiConfig.pedagogySpaceSeminarConfig}/auto-generate',
      data: {'academicYearId': academicYearId},
    );
  }

  /// POST /pedagogy-space/seminar-config/manual
  Future<ApiResult<Map<String, dynamic>>> createManualSeminar({
    required Map<String, dynamic> data,
  }) async {
    return _apiClient.postRaw(
      '${ApiConfig.pedagogySpaceSeminarConfig}/manual',
      data: data,
    );
  }

  /// PUT /pedagogy-space/seminar-config/:id
  Future<ApiResult<Map<String, dynamic>>> updateSeminar({
    required String seminarId,
    required Map<String, dynamic> data,
  }) async {
    return _apiClient.putRaw(
      '${ApiConfig.pedagogySpaceSeminarConfig}/$seminarId',
      data: data,
    );
  }

  /// DELETE /pedagogy-space/seminar-config/:id
  Future<ApiResult<Map<String, dynamic>>> deleteSeminar({
    required String seminarId,
  }) async {
    return _apiClient.deleteRaw(
      '${ApiConfig.pedagogySpaceSeminarConfig}/$seminarId',
    );
  }

  // ── Cahier de Texte (secondary only) ───────────────────────────────

  /// GET /pedagogy-space/cahier-textes?teacherId=…&academicYearId=…&testType=…&trimester=…
  Future<ApiResult<Map<String, dynamic>>> getCahierTextes({
    required String teacherId,
    String? academicYearId,
    String? testType,
    int? trimester,
  }) async {
    return _apiClient.getRaw(
      ApiConfig.pedagogySpaceCahierTextes,
      queryParameters: {
        'teacherId': teacherId,
        if (academicYearId != null) 'academicYearId': academicYearId,
        if (testType != null) 'testType': testType,
        if (trimester != null) 'trimester': trimester,
      },
    );
  }

  /// POST /pedagogy-space/cahier-textes
  Future<ApiResult<Map<String, dynamic>>> createCahierTexte({
    required Map<String, dynamic> data,
  }) async {
    return _apiClient.postRaw(
      ApiConfig.pedagogySpaceCahierTextes,
      data: data,
    );
  }

  /// PUT /pedagogy-space/cahier-textes/:id
  Future<ApiResult<Map<String, dynamic>>> updateCahierTexte({
    required String id,
    required Map<String, dynamic> data,
  }) async {
    return _apiClient.putRaw(
      ApiConfig.pedagogySpaceCahierTexteById(id),
      data: data,
    );
  }

  /// DELETE /pedagogy-space/cahier-textes/:id
  Future<ApiResult<Map<String, dynamic>>> deleteCahierTexte({
    required String id,
  }) async {
    return _apiClient.deleteRaw(
      ApiConfig.pedagogySpaceCahierTexteById(id),
    );
  }

  /// POST /pedagogy-space/cahier-textes/:id/submit
  Future<ApiResult<Map<String, dynamic>>> submitCahierTexte({
    required String id,
  }) async {
    return _apiClient.postRaw(
      ApiConfig.pedagogySpaceCahierTexteSubmit(id),
    );
  }

  /// POST /pedagogy-space/cahier-textes/:id/init-students
  Future<ApiResult<Map<String, dynamic>>> initCahierTexteStudents({
    required String id,
  }) async {
    return _apiClient.postRaw(
      ApiConfig.pedagogySpaceCahierTexteInitStudents(id),
    );
  }
}

final pedagogySpaceServiceProvider = Provider<PedagogySpaceService>((ref) {
  return PedagogySpaceService(ref.watch(apiClientProvider));
});
