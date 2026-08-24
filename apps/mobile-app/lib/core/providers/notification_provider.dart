import 'package:flutter_riverpod/flutter_riverpod.dart';

import '/data/repositories/notification_repository_impl.dart';
import '/domain/entities/notification_item.dart';

/// V3-4: Riverpod state notifier that exposes the in-app notification list
/// and unread count for the bell icon UI.
///
/// Bell icon usage:
///   final state = ref.watch(notificationProvider);
///   state.unreadCount      // int
///   state.notifications     // List<NotificationItem>
///   state.isLoading         // bool
///
/// Actions:
///   ref.read(notificationProvider.notifier).refresh();
///   ref.read(notificationProvider.notifier).markAsRead(id);
///   ref.read(notificationProvider.notifier).markAllAsRead();
class NotificationState {
  const NotificationState({
    this.notifications = const [],
    this.unreadCount = 0,
    this.isLoading = false,
    this.lastError,
  });

  final List<NotificationItem> notifications;
  final int unreadCount;
  final bool isLoading;
  final String? lastError;

  NotificationState copyWith({
    List<NotificationItem>? notifications,
    int? unreadCount,
    bool? isLoading,
    String? lastError,
  }) {
    return NotificationState(
      notifications: notifications ?? this.notifications,
      unreadCount: unreadCount ?? this.unreadCount,
      isLoading: isLoading ?? this.isLoading,
      lastError: lastError ?? this.lastError,
    );
  }
}

class NotificationNotifier extends StateNotifier<NotificationState> {
  NotificationNotifier(this._repo) : super(const NotificationState());

  final NotificationRepositoryImpl _repo;

  /// Refresh both the unread count and the notification list.
  Future<void> refresh() async {
    state = state.copyWith(isLoading: true, lastError: null);
    try {
      final unreadCount = await _repo.refreshUnreadCount();
      final items = await _repo.getNotifications(limit: 30);
      state = state.copyWith(
        notifications: items,
        unreadCount: unreadCount,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, lastError: e.toString());
    }
  }

  /// Refresh only the unread count (lighter — called by the bell icon poller).
  Future<void> refreshUnreadCount() async {
    final count = await _repo.refreshUnreadCount();
    state = state.copyWith(unreadCount: count);
  }

  /// Mark a single notification as read (optimistic).
  Future<void> markAsRead(String id) async {
    final previous = state.notifications;
    // Optimistic update
    state = state.copyWith(
      notifications: previous
          .map((n) => n.id == id ? n.copyWith(isRead: true) : n)
          .toList(),
      unreadCount: state.unreadCount > 0 ? state.unreadCount - 1 : 0,
    );
    try {
      await _repo.markAsRead(id);
    } catch (e) {
      // Rollback on error
      state = state.copyWith(notifications: previous, lastError: e.toString());
    }
  }

  /// Mark all notifications as read (optimistic).
  Future<void> markAllAsRead() async {
    final previous = state.notifications;
    state = state.copyWith(
      notifications: previous.map((n) => n.copyWith(isRead: true)).toList(),
      unreadCount: 0,
    );
    try {
      await _repo.markAllAsRead();
    } catch (e) {
      state = state.copyWith(notifications: previous, lastError: e.toString());
    }
  }
}

/// Riverpod provider for [NotificationNotifier].
final notificationProvider =
    StateNotifierProvider<NotificationNotifier, NotificationState>((Ref ref) {
  return NotificationNotifier(ref.watch(notificationRepositoryProvider));
});
