import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_result.dart';
import '../../../domain/entities/grade.dart';
import '../../dto/grade_dto.dart';

final gradeApiProvider = Provider<GradeApi>((ref) {
  return GradeApi(ref.read(apiClientProvider));
});

/// Remote API data source for grade-related endpoints.
class GradeApi {
  final ApiClient _apiClient;

  GradeApi(this._apiClient);

  /// GET /api/students/{studentId}/grades
  Future<ApiResult<List<Grade>>> getGrades(
    String studentId, {
    String? period,
    String? subjectId,
  }) async {
    final queryParams = <String, dynamic>{};
    if (period != null) queryParams['period'] = period;
    if (subjectId != null) queryParams['subjectId'] = subjectId;

    final result = await _apiClient.getRaw(
      '/api/students/$studentId/grades',
      queryParameters: queryParams.isNotEmpty ? queryParams : null,
    );

    return result.when(
      success: (data) {
        final List<dynamic> items =
            data['data'] ?? data['grades'] ?? <dynamic>[];
        return ApiResult.success(
          items
              .map((e) =>
                  GradeDto.fromJson(e as Map<String, dynamic>).toDomain())
              .toList(),
        );
      },
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }

  /// GET /api/students/{studentId}/grades/{gradeId}
  Future<ApiResult<Grade>> getGradeDetail(
    String studentId,
    String gradeId,
  ) async {
    final result = await _apiClient.getRaw(
      '/api/students/$studentId/grades/$gradeId',
    );

    return result.when(
      success: (data) => ApiResult.success(
        GradeDto.fromJson(data).toDomain(),
      ),
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }

  /// GET /api/students/{studentId}/grades/averages
  Future<ApiResult<List<SubjectAverage>>> getSubjectAverages(
    String studentId, {
    String? period,
  }) async {
    final queryParams = <String, dynamic>{};
    if (period != null) queryParams['period'] = period;

    final result = await _apiClient.getRaw(
      '/api/students/$studentId/grades/averages',
      queryParameters: queryParams.isNotEmpty ? queryParams : null,
    );

    return result.when(
      success: (data) {
        final List<dynamic> items =
            data['data'] ?? data['averages'] ?? <dynamic>[];
        return ApiResult.success(
          items
              .map((e) => SubjectAverageDto.fromJson(e as Map<String, dynamic>)
                  .toDomain())
              .toList(),
        );
      },
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }

  /// GET /api/students/{studentId}/grades/report
  Future<ApiResult<PeriodReport>> getPeriodReport(
    String studentId,
    String period,
  ) async {
    final result = await _apiClient.getRaw(
      '/api/students/$studentId/grades/report',
      queryParameters: {'period': period},
    );

    return result.when(
      success: (data) => ApiResult.success(
        PeriodReportDto.fromJson(data).toDomain(),
      ),
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }
}
