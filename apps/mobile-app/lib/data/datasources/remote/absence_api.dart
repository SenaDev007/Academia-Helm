import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_result.dart';
import '../../../domain/entities/absence.dart';
import '../../dto/absence_dto.dart';

final absenceApiProvider = Provider<AbsenceApi>((ref) {
  return AbsenceApi(ref.read(apiClientProvider));
});

/// Remote API data source for absence-related endpoints.
class AbsenceApi {
  final ApiClient _apiClient;

  AbsenceApi(this._apiClient);

  /// GET /api/students/{studentId}/absences
  Future<ApiResult<List<Absence>>> getAbsences(
    String studentId, {
    String? type,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    final queryParams = <String, dynamic>{};
    if (type != null) queryParams['type'] = type;
    if (startDate != null) queryParams['startDate'] = startDate.toIso8601String();
    if (endDate != null) queryParams['endDate'] = endDate.toIso8601String();

    final result = await _apiClient.getRaw(
      '/api/students/$studentId/absences',
      queryParameters: queryParams.isNotEmpty ? queryParams : null,
    );

    return result.when(
      success: (data) {
        final List<dynamic> items =
            data['data'] ?? data['absences'] ?? <dynamic>[];
        return ApiResult.success(
          items
              .map((e) =>
                  AbsenceDto.fromJson(e as Map<String, dynamic>).toDomain())
              .toList(),
        );
      },
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }
}
