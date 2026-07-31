import '../../../core/network/api_result.dart';
import '../../../domain/entities/message.dart';
import '../../../domain/repositories/message_repository.dart';
import '../datasources/remote/message_api.dart';

/// Concrete implementation of [MessageRepository] that delegates to [MessageApi].
class MessageRepositoryImpl implements MessageRepository {
  final MessageApi _messageApi;

  MessageRepositoryImpl(this._messageApi);

  @override
  Future<ApiResult<List<SchoolMessage>>> getMessages({
    String? type,
    bool? isRead,
    int page = 1,
    int limit = 20,
  }) {
    return _messageApi.getMessages(
      type: type,
      isRead: isRead,
      page: page,
      limit: limit,
    );
  }

  @override
  Future<ApiResult<SchoolMessage>> getMessageDetail(String messageId) {
    return _messageApi.getMessageDetail(messageId);
  }

  @override
  Future<ApiResult<void>> markAsRead(String messageId) {
    return _messageApi.markAsRead(messageId);
  }
}
