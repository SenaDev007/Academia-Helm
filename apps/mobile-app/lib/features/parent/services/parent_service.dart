import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';
import '../../../core/network/api_result.dart';

/// Service for the parent portal — calls /api/parent/* endpoints.
///
/// Mirrors the web app's parent service (React Query hooks calling
/// /api/parent/children, /api/parent/today/:childId, etc.).
class ParentService {
  ParentService(this._apiClient);

  final ApiClient _apiClient;

  /// GET /parent/children
  Future<ApiResult<Map<String, dynamic>>> getChildren({
    String? academicYearId,
  }) async {
    final params = <String, dynamic>{};
    if (academicYearId != null && academicYearId.isNotEmpty) {
      params['academicYearId'] = academicYearId;
    }
    return _apiClient.getRaw(
      ApiConfig.parentChildren,
      queryParameters: params,
    );
  }

  /// GET /parent/today/:childId
  Future<ApiResult<Map<String, dynamic>>> getTodaySummary({
    required String childId,
    String? academicYearId,
  }) async {
    final params = <String, dynamic>{};
    if (academicYearId != null && academicYearId.isNotEmpty) {
      params['academicYearId'] = academicYearId;
    }
    return _apiClient.getRaw(
      ApiConfig.parentTodayByChild(childId),
      queryParameters: params,
    );
  }

  /// GET /parent/attendance/:childId
  Future<ApiResult<Map<String, dynamic>>> getAttendance({
    required String childId,
  }) async {
    return _apiClient.getRaw(
      ApiConfig.parentAttendanceByChild(childId),
    );
  }

  /// GET /parent/finance/:studentId/breakdown
  Future<ApiResult<Map<String, dynamic>>> getFinanceBreakdown({
    required String studentId,
    String? academicYearId,
  }) async {
    final params = <String, dynamic>{};
    if (academicYearId != null && academicYearId.isNotEmpty) {
      params['academicYearId'] = academicYearId;
    }
    return _apiClient.getRaw(
      ApiConfig.parentFinanceBreakdown(studentId),
      queryParameters: params,
    );
  }

  /// GET /parent/grades/:childId
  Future<ApiResult<Map<String, dynamic>>> getGrades({
    required String childId,
  }) async {
    return _apiClient.getRaw(
      ApiConfig.parentGradesByChild(childId),
    );
  }

  /// GET /parent/results/:childId
  Future<ApiResult<Map<String, dynamic>>> getResults({
    required String childId,
  }) async {
    return _apiClient.getRaw(
      ApiConfig.parentResultsByChild(childId),
    );
  }

  /// GET /parent/cahier-journal/:classId
  Future<ApiResult<Map<String, dynamic>>> getCahierJournal({
    required String classId,
    String? weekStart,
  }) async {
    final params = <String, dynamic>{};
    if (weekStart != null && weekStart.isNotEmpty) {
      params['weekStart'] = weekStart;
    }
    return _apiClient.getRaw(
      ApiConfig.parentCahierJournalByClass(classId),
      queryParameters: params,
    );
  }

  /// GET /parent/weeks/:classId
  Future<ApiResult<Map<String, dynamic>>> getAvailableWeeks({
    required String classId,
  }) async {
    return _apiClient.getRaw(
      ApiConfig.parentWeeksByClass(classId),
    );
  }

  /// GET /notifications?limit=N
  Future<ApiResult<Map<String, dynamic>>> getNotifications({
    int limit = 50,
  }) async {
    return _apiClient.getRaw(
      '/notifications',
      queryParameters: {'limit': limit},
    );
  }

  /// PATCH /notifications/:id/read
  Future<ApiResult<Map<String, dynamic>>> markNotificationRead(
    String notificationId,
  ) async {
    return _apiClient.patchRaw(
      '/notifications/$notificationId/read',
      data: {},
    );
  }

  /// PATCH /notifications/read-all
  Future<ApiResult<Map<String, dynamic>>> markAllNotificationsRead() async {
    return _apiClient.patchRaw(
      '/notifications/read-all',
      data: {},
    );
  }

  /// GET /communication/v2/announcements?limit=N
  Future<ApiResult<Map<String, dynamic>>> getAnnouncements({
    int limit = 20,
  }) async {
    return _apiClient.getRaw(
      '/communication/v2/announcements',
      queryParameters: {'limit': limit},
    );
  }
}

/// Riverpod provider for [ParentService].
final parentServiceProvider = Provider<ParentService>((ref) {
  return ParentService(ref.watch(apiClientProvider));
});
