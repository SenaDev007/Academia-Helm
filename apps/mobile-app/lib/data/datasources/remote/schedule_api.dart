import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_result.dart';
import '../../../domain/entities/schedule.dart';
import '../../dto/schedule_dto.dart';

final scheduleApiProvider = Provider<ScheduleApi>((ref) {
  return ScheduleApi(ref.read(apiClientProvider));
});

/// Remote API data source for schedule-related endpoints.
class ScheduleApi {
  final ApiClient _apiClient;

  ScheduleApi(this._apiClient);

  /// GET /api/students/{studentId}/schedule
  Future<ApiResult<List<ScheduleEntry>>> getSchedule(
    String studentId, {
    int? dayOfWeek,
  }) async {
    final queryParams = <String, dynamic>{};
    if (dayOfWeek != null) queryParams['dayOfWeek'] = dayOfWeek;

    final result = await _apiClient.getRaw(
      '/api/students/$studentId/schedule',
      queryParameters: queryParams.isNotEmpty ? queryParams : null,
    );

    return result.when(
      success: (data) {
        final List<dynamic> items =
            data['data'] ?? data['schedule'] ?? <dynamic>[];
        return ApiResult.success(
          items
              .map((e) => ScheduleEntryDto.fromJson(e as Map<String, dynamic>)
                  .toDomain())
              .toList(),
        );
      },
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }
}
