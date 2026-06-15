import '../entities/absence.dart';
import '../../../core/network/api_result.dart';

abstract class AbsenceRepository {
  /// Retrieves the list of absences for a given student.
  ///
  /// [studentId] - The student's unique identifier.
  /// [type] - Optional absence type filter ('ABSENCE' or 'TARDINESS').
  /// [startDate] - Optional start date filter.
  /// [endDate] - Optional end date filter.
  Future<ApiResult<List<Absence>>> getAbsences(
    String studentId, {
    String? type,
    DateTime? startDate,
    DateTime? endDate,
  });
}
