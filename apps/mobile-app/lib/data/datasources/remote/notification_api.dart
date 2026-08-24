import 'package:flutter_riverpod/flutter_riverpod.dart';

import '/core/network/api_client.dart';
import '/core/network/api_config.dart';
import '/core/network/api_result.dart';
import '/domain/entities/notification_item.dart';

/// API client for the in-app notifications endpoints.
///
/// Endpoints (all scoped to the current user via JWT):
///   GET    /notifications                — list (?unread=true&limit=&offset=)
///   GET    /notifications/unread-count   → { count: number }
///   PATCH  /notifications/:id/read        — mark as read
///   PATCH  /notifications/read-all        — mark all as read
///   DELETE /notifications/:id             — delete
///
/// V3-4 FCM mobile push:
///   POST   /notifications/device-tokens   — register FCM token
///   DELETE /notifications/device-tokens   — unregister FCM token (logout)
class NotificationApi {
  NotificationApi(this._apiClient);

  final ApiClient _apiClient;

  /// GET /notifications?unread=true&limit=20&offset=0
  ///
  /// Backend returns a JSON array. `_safeCall` wraps it as `{'data': [...]}`
  /// (see api_client.dart) when the response is a List.
  Future<ApiResult<List<NotificationItem>>> getNotifications({
    bool onlyUnread = false,
    int limit = 20,
    int offset = 0,
  }) async {
    final queryParams = <String, dynamic>{
      'limit': limit,
      'offset': offset,
      if (onlyUnread) 'unread': 'true',
    };
    final result = await _apiClient.getRaw(
      ApiConfig.notifications,
      queryParameters: queryParams,
    );
    return result.when(
      success: (data) {
        // The raw response may be either a List directly (wrapped as
        // {'data': [...]}) OR a Map with a 'data' key.
        final dynamic raw = data['data'] ?? data;
        if (raw is! List) {
          return const ApiResult.success(<NotificationItem>[]);
        }
        final items = raw
            .map((e) => NotificationItem.fromJson(e as Map<String, dynamic>))
            .toList();
        return ApiResult.success(items);
      },
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }

  /// GET /notifications/unread-count → { count: number }
  Future<ApiResult<int>> getUnreadCount() async {
    final result = await _apiClient.getRaw(ApiConfig.notificationsUnreadCount);
    return result.when(
      success: (data) =>
          ApiResult.success((data['count'] as num?)?.toInt() ?? 0),
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }

  /// PATCH /notifications/:id/read
  Future<ApiResult<void>> markAsRead(String id) async {
    final result = await _apiClient.patchRaw(
      ApiConfig.notificationMarkAsRead(id),
    );
    return result.when(
      success: (_) => const ApiResult.success(null),
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }

  /// PATCH /notifications/read-all
  Future<ApiResult<void>> markAllAsRead() async {
    final result = await _apiClient.patchRaw(ApiConfig.notificationsReadAll);
    return result.when(
      success: (_) => const ApiResult.success(null),
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }

  /// DELETE /notifications/:id
  Future<ApiResult<void>> delete(String id) async {
    final result =
        await _apiClient.deleteRaw(ApiConfig.notificationById(id));
    return result.when(
      success: (_) => const ApiResult.success(null),
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }

  /// POST /notifications/device-tokens
  /// Body: { fcmToken, platform?, deviceInfo? }
  Future<ApiResult<void>> registerDeviceToken({
    required String fcmToken,
    String platform = 'ANDROID',
    String? deviceInfo,
  }) async {
    final result = await _apiClient.postRaw(
      ApiConfig.notificationsDeviceTokens,
      data: <String, dynamic>{
        'fcmToken': fcmToken,
        'platform': platform,
        if (deviceInfo != null) 'deviceInfo': deviceInfo,
      },
    );
    return result.when(
      success: (_) => const ApiResult.success(null),
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }

  /// DELETE /notifications/device-tokens
  /// Body: { fcmToken }
  Future<ApiResult<void>> unregisterDeviceToken(String fcmToken) async {
    final result = await _apiClient.deleteRaw(
      ApiConfig.notificationsDeviceTokens,
      data: <String, dynamic>{'fcmToken': fcmToken},
    );
    return result.when(
      success: (_) => const ApiResult.success(null),
      failure: (error) => ApiResult.failure(error),
      loading: () => const ApiResult.loading(),
    );
  }
}

/// Riverpod provider for [NotificationApi].
final notificationApiProvider = Provider<NotificationApi>((Ref ref) {
  return NotificationApi(ref.watch(apiClientProvider));
});
