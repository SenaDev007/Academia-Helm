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
}

final pedagogySpaceServiceProvider = Provider<PedagogySpaceService>((ref) {
  return PedagogySpaceService(ref.watch(apiClientProvider));
});
