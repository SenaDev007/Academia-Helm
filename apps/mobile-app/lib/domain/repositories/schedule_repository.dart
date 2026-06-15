import '../entities/schedule.dart';
import '../../../core/network/api_result.dart';

abstract class ScheduleRepository {
  /// Retrieves the weekly schedule for a student.
  ///
  /// [studentId] - The student's unique identifier.
  /// [dayOfWeek] - Optional day filter (1=Monday, 5=Friday).
  Future<ApiResult<List<ScheduleEntry>>> getSchedule(
    String studentId, {
    int? dayOfWeek,
  });
}
