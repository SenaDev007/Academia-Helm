import '../entities/message.dart';
import '../../../core/network/api_result.dart';

abstract class MessageRepository {
  /// Retrieves the list of messages for the current user.
  ///
  /// [type] - Optional message type filter.
  /// [isRead] - Optional read status filter.
  /// [page] - Page number for pagination (1-based).
  /// [limit] - Number of items per page.
  Future<ApiResult<List<SchoolMessage>>> getMessages({
    String? type,
    bool? isRead,
    int page = 1,
    int limit = 20,
  });

  /// Retrieves a single message detail.
  ///
  /// [messageId] - The message's unique identifier.
  Future<ApiResult<SchoolMessage>> getMessageDetail(String messageId);

  /// Marks a message as read.
  ///
  /// [messageId] - The message's unique identifier.
  Future<ApiResult<void>> markAsRead(String messageId);
}
