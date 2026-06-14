import 'package:academia_helm_mobile/domain/entities/notification_item.dart';

abstract class NotificationRepository {
  /// Retrieves a paginated list of notifications.
  ///
  /// [page] - Page number (1-based).
  /// [limit] - Number of items per page.
  Future<List<NotificationItem>> getNotifications({
    int page = 1,
    int limit = 20,
  });

  /// Marks a single notification as read.
  Future<void> markAsRead(String id);

  /// Marks all notifications as read for the current user.
  Future<void> markAllAsRead();

  /// Returns the count of unread notifications.
  int getUnreadCount();
}
