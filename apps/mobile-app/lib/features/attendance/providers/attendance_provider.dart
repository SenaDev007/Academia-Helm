/// ============================================================================
/// ATTENDANCE PROVIDER — Provider pour la saisie d'appel (enseignant)
/// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_result.dart';

/// Provider pour l'API d'appel
final attendanceApiProvider = Provider<AttendanceApi>((ref) {
  return AttendanceApi(ref.read(apiClientProvider));
});

/// Service API pour la saisie de présence
class AttendanceApi {
  final ApiClient _client;
  AttendanceApi(this._client);

  /// GET /api/attendance/class/{classId}?date=YYYY-MM-DD
  /// Récupère la liste des élèves d'une classe avec leur statut de présence
  Future<ApiResult<List<Map<String, dynamic>>>> getClassAttendance(
    String classId, {
    DateTime? date,
  }) async {
    final dateStr = (date ?? DateTime.now()).toIso8601String().split('T')[0];
    final result = await _client.getRaw('/api/attendance/class/$classId?date=$dateStr');

    return result.when(
      success: (data) {
        final items = data['data'] ?? data['students'] ?? <dynamic>[];
        return ApiResult.success(
          (items as List).cast<Map<String, dynamic>>(),
        );
      },
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }

  /// POST /api/attendance/save
  /// Sauvegarde les présences pour une classe et une date
  Future<ApiResult<void>> saveAttendance({
    required String classId,
    required DateTime date,
    required List<Map<String, dynamic>> records,
  }) async {
    final result = await _client.post('/api/attendance/save',
        data: {
          'classId': classId,
          'date': date.toIso8601String().split('T')[0],
          'records': records,
        },
        fromJson: (_) => <String, dynamic>{});

    return result.when(
      success: (_) => const ApiResult.success(null),
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }
}

/// Provider pour la liste de présence d'une classe
final classAttendanceProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, classId) async {
  final api = ref.watch(attendanceApiProvider);
  final result = await api.getClassAttendance(classId);

  return result.when(
    success: (students) => students,
    failure: (error) => throw Exception(error.message),
    loading: () => [],
  );
});

/// Statuts de présence
enum AttendanceStatus { present, absent, late }

extension AttendanceStatusExt on AttendanceStatus {
  String get label {
    switch (this) {
      case AttendanceStatus.present: return 'Présent';
      case AttendanceStatus.absent: return 'Absent';
      case AttendanceStatus.late: return 'Retard';
    }
  }

  String get apiValue {
    switch (this) {
      case AttendanceStatus.present: return 'PRESENT';
      case AttendanceStatus.absent: return 'ABSENT';
      case AttendanceStatus.late: return 'LATE';
    }
  }
}
