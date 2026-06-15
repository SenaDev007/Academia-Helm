import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_result.dart';
import '../../../domain/entities/child.dart';
import '../../dto/child_dto.dart';

final childApiProvider = Provider<ChildApi>((ref) {
  return ChildApi(ref.read(apiClientProvider));
});

/// Remote API data source for child-related endpoints.
class ChildApi {
  final ApiClient _apiClient;

  ChildApi(this._apiClient);

  /// GET /api/profile/children
  Future<ApiResult<List<Child>>> getChildren() async {
    final result = await _apiClient.getRaw('/api/profile/children');

    return result.when(
      success: (data) {
        final List<dynamic> items =
            data['data'] ?? data['children'] ?? <dynamic>[];
        return ApiResult.success(
          items
              .map(
                  (e) => ChildDto.fromJson(e as Map<String, dynamic>).toDomain())
              .toList(),
        );
      },
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }

  /// GET /api/profile/children/{childId}
  Future<ApiResult<Child>> getChildDetail(String childId) async {
    final result = await _apiClient.getRaw('/api/profile/children/$childId');

    return result.when(
      success: (data) => ApiResult.success(
        ChildDto.fromJson(data).toDomain(),
      ),
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }
}
