import '../../../core/network/api_result.dart';
import '../../../domain/entities/schedule.dart';
import '../../../domain/repositories/schedule_repository.dart';
import '../datasources/remote/schedule_api.dart';

/// Concrete implementation of [ScheduleRepository] that delegates to [ScheduleApi].
class ScheduleRepositoryImpl implements ScheduleRepository {
  final ScheduleApi _scheduleApi;

  ScheduleRepositoryImpl(this._scheduleApi);

  @override
  Future<ApiResult<List<ScheduleEntry>>> getSchedule(
    String studentId, {
    int? dayOfWeek,
  }) {
    return _scheduleApi.getSchedule(studentId, dayOfWeek: dayOfWeek);
  }
}
