import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_result.dart';
import '../../../domain/entities/message.dart';
import '../../dto/message_dto.dart';

final messageApiProvider = Provider<MessageApi>((ref) {
  return MessageApi(ref.read(apiClientProvider));
});

/// Remote API data source for message-related endpoints.
class MessageApi {
  final ApiClient _apiClient;

  MessageApi(this._apiClient);

  /// GET /api/messages
  Future<ApiResult<List<SchoolMessage>>> getMessages({
    String? type,
    bool? isRead,
    int page = 1,
    int limit = 20,
  }) async {
    final queryParams = <String, dynamic>{
      'page': page,
      'limit': limit,
    };
    if (type != null) queryParams['type'] = type;
    if (isRead != null) queryParams['isRead'] = isRead;

    final result = await _apiClient.getRaw(
      '/api/messages',
      queryParameters: queryParams,
    );

    return result.when(
      success: (data) {
        final List<dynamic> items =
            data['data'] ?? data['messages'] ?? <dynamic>[];
        return ApiResult.success(
          items
              .map((e) => SchoolMessageDto.fromJson(e as Map<String, dynamic>)
                  .toDomain())
              .toList(),
        );
      },
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }

  /// GET /api/messages/{messageId}
  Future<ApiResult<SchoolMessage>> getMessageDetail(String messageId) async {
    final result = await _apiClient.getRaw('/api/messages/$messageId');

    return result.when(
      success: (data) => ApiResult.success(
        SchoolMessageDto.fromJson(data).toDomain(),
      ),
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }

  /// POST /api/messages/{messageId}/read
  Future<ApiResult<void>> markAsRead(String messageId) async {
    final result = await _apiClient.postRaw(
      '/api/messages/$messageId/read',
    );

    return result.when(
      success: (_) => const ApiResult.success(null),
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }
}
