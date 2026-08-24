import 'package:flutter_riverpod/flutter_riverpod.dart';

import '/core/network/api_result.dart';
import '/data/datasources/remote/notification_api.dart';
import '/domain/entities/notification_item.dart';
import '/domain/repositories/notification_repository.dart';

/// Concrete implementation of [NotificationRepository] that talks to the
/// backend via [NotificationApi].
class NotificationRepositoryImpl implements NotificationRepository {
  NotificationRepositoryImpl(this._api);

  final NotificationApi _api;

  /// Cache local du compteur non lues (pour éviter un appel à chaque lecture).
  /// Est rafraîchi par [getUnreadCount] depuis l'API.
  int _cachedUnreadCount = 0;

  @override
  Future<List<NotificationItem>> getNotifications({
    int page = 1,
    int limit = 20,
  }) async {
    final offset = (page - 1) * limit;
    final result = await _api.getNotifications(limit: limit, offset: offset);
    return result.when(
      success: (items) => items,
      failure: (_) => <NotificationItem>[], // silent fallback
      loading: () => <NotificationItem>[],
    );
  }

  @override
  Future<void> markAsRead(String id) async {
    await _api.markAsRead(id);
    // Optimistic: décrémenter le cache local
    if (_cachedUnreadCount > 0) _cachedUnreadCount--;
  }

  @override
  Future<void> markAllAsRead() async {
    await _api.markAllAsRead();
    _cachedUnreadCount = 0;
  }

  @override
  int getUnreadCount() => _cachedUnreadCount;

  /// Fetch fresh unread count from backend (called by the bell icon poller).
  Future<int> refreshUnreadCount() async {
    final result = await _api.getUnreadCount();
    return result.when(
      success: (count) {
        _cachedUnreadCount = count;
        return count;
      },
      failure: (_) => _cachedUnreadCount,
      loading: () => _cachedUnreadCount,
    );
  }

  /// V3-4: Register FCM token to receive mobile push notifications.
  Future<ApiResult<void>> registerDeviceToken({
    required String fcmToken,
    String platform = 'ANDROID',
    String? deviceInfo,
  }) {
    return _api.registerDeviceToken(
      fcmToken: fcmToken,
      platform: platform,
      deviceInfo: deviceInfo,
    );
  }

  /// V3-4: Unregister FCM token (called on logout).
  Future<ApiResult<void>> unregisterDeviceToken(String fcmToken) {
    return _api.unregisterDeviceToken(fcmToken);
  }
}

/// Riverpod provider for [NotificationRepositoryImpl].
final notificationRepositoryProvider = Provider<NotificationRepositoryImpl>((Ref ref) {
  return NotificationRepositoryImpl(ref.watch(notificationApiProvider));
});
