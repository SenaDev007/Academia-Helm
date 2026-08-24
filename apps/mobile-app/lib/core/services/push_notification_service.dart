import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '/core/network/api_result.dart';
import '/data/repositories/notification_repository_impl.dart';

/// V3-4: Push notification service for the mobile app.
///
/// Responsibilities:
///   1. Request notification permission (Android 13+ POST_NOTIFICATIONS, iOS
///      alert/badge/sound).
///   2. Get the FCM token + listen to onTokenRefresh.
///   3. POST the token to backend `/notifications/device-tokens`.
///   4. Listen to onMessage (foreground) → show a local notification via
///      flutter_local_notifications.
///   5. Listen to onMessageOpenedApp (background/terminated tap) → deep-link
///      navigation via a callback.
///   6. On logout → unregister the token via DELETE /notifications/device-tokens.
///
/// Multi-tenant strict: the JWT injected by AuthInterceptor scopes the token
/// to the current user/tenant automatically server-side.
class PushNotificationService {
  PushNotificationService(this._ref);

  final Ref _ref;

  final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  /// The last FCM token we registered with the backend. Used on logout to
  /// unregister.
  String? _registeredToken;

  /// Called by the router shell when the user taps a notification that has a
  /// `data.url`. Wired in main.dart to do `router.push(url)`.
  void Function(String url)? onDeepLink;

  /// Initialize FCM + local notifications. Call once at app startup.
  Future<void> initialize() async {
    // 1. Initialize flutter_local_notifications (Android channel + iOS settings)
    const androidInit = AndroidInitializationSettings('@mipmap/ic_notification');
    const iosInit = DarwinInitializationSettings(
      requestAlertPermission: false, // we request via FirebaseMessaging below
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    await _localNotifications.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
      onDidReceiveNotificationResponse: _onLocalNotificationTap,
    );

    // Create the high-priority Android channel for foreground notifications
    if (Platform.isAndroid) {
      await _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(
            const AndroidNotificationChannel(
              'academia_helm_notifications',
              'Academia Helm Notifications',
              description: 'Notifications Helm Connect (absences, examens, bulletins, discipline)',
              importance: Importance.high,
            ),
          );
    }

    // 2. Request permission via FirebaseMessaging (cross-platform)
    await _firebaseMessaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      announcement: false,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
    );

    // 3. Get initial token + register
    final token = await _firebaseMessaging.getToken();
    if (token != null) {
      await _registerToken(token);
    }

    // 4. Listen for token refresh
    _firebaseMessaging.onTokenRefresh.listen(_registerToken);

    // 5. Foreground messages → local notification
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // 6. Background/terminated tap → deep link
    FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageOpenedApp);

    // 7. Initial message (app launched from a notification tap)
    final initialMessage = await _firebaseMessaging.getInitialMessage();
    if (initialMessage != null) {
      _handleMessageOpenedApp(initialMessage);
    }
  }

  /// Register the FCM token with the backend (POST /notifications/device-tokens).
  Future<void> _registerToken(String token) async {
    final repo = _ref.read(notificationRepositoryProvider);
    final platform = Platform.isIOS ? 'IOS' : 'ANDROID';
    final result = await repo.registerDeviceToken(
      fcmToken: token,
      platform: platform,
      deviceInfo: 'Flutter ${Platform.operatingSystem}',
    );
    result.when(
      success: (_) {
        _registeredToken = token;
      },
      failure: (error, _) {
        // Silent — we'll retry on next app launch via onTokenRefresh.
      },
    );
  }

  /// Unregister the FCM token on logout (DELETE /notifications/device-tokens).
  Future<void> unregister() async {
    if (_registeredToken == null) return;
    final repo = _ref.read(notificationRepositoryProvider);
    await repo.unregisterDeviceToken(_registeredToken!);
    _registeredToken = null;
  }

  /// Foreground message handler — shows a local notification.
  void _handleForegroundMessage(RemoteMessage message) {
    final notification = message.notification;
    final data = message.data;
    final title = notification?.title ?? data['title'] as String? ?? 'Academia Helm';
    final body = notification?.body ?? data['body'] as String? ?? '';

    _localNotifications.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000, // unique id
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          'academia_helm_notifications',
          'Academia Helm Notifications',
          channelDescription: 'Notifications Helm Connect (absences, examens, bulletins, discipline)',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_notification',
          color: const Color.fromARGB(255, 207, 166, 58), // Academia Helm gold
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: data['url'] != null ? data['url'] as String : null,
    );
  }

  /// Background/terminated tap handler — deep link to the URL.
  void _handleMessageOpenedApp(RemoteMessage message) {
    final url = message.data['url'] as String?;
    if (url != null && onDeepLink != null) {
      onDeepLink!(url);
    }
  }

  /// Local notification tap (foreground notification) — deep link.
  void _onLocalNotificationTap(NotificationResponse response) {
    final url = response.payload;
    if (url != null && url.isNotEmpty && onDeepLink != null) {
      onDeepLink!(url);
    }
  }
}

/// Riverpod provider for [PushNotificationService].
final pushNotificationServiceProvider = Provider<PushNotificationService>((Ref ref) {
  return PushNotificationService(ref);
});
