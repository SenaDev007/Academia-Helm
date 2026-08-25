// ============================================================================
// HELM CONNECT — Flutter Mobile App Entry Point
// ============================================================================
// Identité visuelle : Azure + Cyan (cf. theme/helm_theme.dart)
//
// ⭐ Flux au lancement :
//   1. Initialiser Firebase (firebase_core + firebase_messaging)
//   2. Si session valide (token + tenant stockés) → ChatScreen
//   3. Sinon → TenantSelectionScreen (sélection école) → LoginScreen
//   4. Après login → ChatScreen (chat principale)
//
// ⭐ Architecture :
//   - Theme : HelmThemes.lightTheme() / darkTheme()
//   - State : Provider (V2: ChangeNotifier for chat state)
//   - Real-time : socket_io_client (Socket.io backend)
//   - Offline : Hive (V2: offline-first sync)
//   - Push : firebase_messaging + HelmConnectFirebaseMessagingService (Android)
// ============================================================================

import 'dart:async';
import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
// ⭐ Firebase — initialisation au démarrage
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
// ⭐ V3: Hive for offline-first chat storage (replaces SharedPreferences)
import 'package:hive_flutter/hive_flutter.dart';
// ⭐ V3-4: foreground banner + deep-link via flutter_local_notifications
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'theme/helm_theme.dart';
import 'services/api_service.dart';
import 'screens/tenant_selection_screen.dart';
import 'screens/chat_screen.dart';

// ⭐ V3-4: Global navigator key for deep-link navigation from FCM taps
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

// ⭐ V3-4: Channel + plugin for foreground notifications
const AndroidNotificationChannel _fcmChannel = AndroidNotificationChannel(
  'academia_helm_notifications',
  'Academia Helm Notifications',
  description: 'Notifications Helm Connect (absences, examens, bulletins, discipline)',
  importance: Importance.high,
);
final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();

// ⭐ Background message handler — doit être top-level (pas dans une classe)
//    Appelé par Firebase quand l'app est tuée et qu'un message arrive.
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print('🔔 Background message: ${message.notification?.title} / ${message.data}');
}

void main() async {
  // ⭐ Initialiser les bindings Flutter avant tout await
  WidgetsFlutterBinding.ensureInitialized();

  // ⭐ V3: Initialize Hive for offline-first chat storage.
  //    Must run BEFORE any Hive.openBox() call (chat_local_storage.dart,
  //    ratchet_store.dart). Lazy box opening is fine — no boxes are opened here.
  await Hive.initFlutter();

  // ⭐ V3-4: Initialize flutter_local_notifications (foreground banner + channel)
  const androidInit = AndroidInitializationSettings('@mipmap/ic_notification');
  const iosInit = DarwinInitializationSettings(
    requestAlertPermission: false,
    requestBadgePermission: false,
    requestSoundPermission: false,
  );
  await _localNotifications.initialize(
    const InitializationSettings(android: androidInit, iOS: iosInit),
    onDidReceiveNotificationResponse: (NotificationResponse response) {
      // Tap on foreground notification → deep-link
      final url = response.payload;
      if (url != null && url.isNotEmpty) {
        _navigateToUrl(url);
      }
    },
  );
  if (Platform.isAndroid) {
    await _localNotifications
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_fcmChannel);
  }

  // ⭐ Initialiser Firebase AVANT runApp (obligatoire pour firebase_messaging)
  try {
    await Firebase.initializeApp();
    // Register background message handler
    FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);
    print('✅ Firebase initialisé');
  } catch (e) {
    print('⚠️ Firebase init échoué: $e (continuons sans Firebase)');
  }

  runApp(const HelmConnectApp());
}

// ⭐ V3-4: Deep-link navigation helper — parses a URL like '/chat' or '/chat?conversationId=xxx'
//    and pushes the corresponding screen via the global navigatorKey.
void _navigateToUrl(String url) {
  final nav = navigatorKey.currentState;
  if (nav == null) return;
  if (url == '/chat' || url == '/app/parent/messages' || url == '/app/teacher/communication') {
    nav.pushNamedAndRemoveUntil('/chat', (route) => false);
    return;
  }
  // Extract conversationId from query if present
  if (url.contains('conversationId=')) {
    final uri = Uri.parse(url);
    final conversationId = uri.queryParameters['conversationId'];
    if (conversationId != null) {
      // For V3-4, just navigate to /chat — the user can open the conversation manually
      // (V3-5 will add direct navigation to ConversationDetailScreen)
      nav.pushNamedAndRemoveUntil('/chat', (route) => false);
      return;
    }
  }
  // Default fallback
  nav.pushNamedAndRemoveUntil('/chat', (route) => false);
}

class HelmConnectApp extends StatelessWidget {
  const HelmConnectApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Helm Connect',
      debugShowCheckedModeBanner: false,
      navigatorKey: navigatorKey, // ⭐ V3-4: for deep-link navigation from FCM
      theme: HelmThemes.lightTheme(),
      darkTheme: HelmThemes.darkTheme(),
      themeMode: ThemeMode.system, // ⭐ Light/Dark selon préférence système
      home: const StartupGate(),
      routes: {
        '/': (context) => const StartupGate(),
        '/tenant-selection': (context) => const TenantSelectionScreen(),
        '/chat': (context) => const ChatScreen(),
      },
    );
  }
}

/// Détermine l'écran d'entrée en fonction de l'état de session.
class StartupGate extends StatefulWidget {
  const StartupGate({super.key});

  @override
  State<StartupGate> createState() => _StartupGateState();
}

class _StartupGateState extends State<StartupGate> {
  bool? _isLoggedIn;
  String? _tenantSlug;
  // StreamSubscription for FCM token refresh
  StreamSubscription<String?>? _fcmTokenSub;

  @override
  void initState() {
    super.initState();
    _checkSession();
    _setupFirebaseMessaging();
  }

  @override
  void dispose() {
    _fcmTokenSub?.cancel();
    super.dispose();
  }

  Future<void> _checkSession() async {
    final loggedIn = await AuthService.isLoggedIn();
    final prefs = await SharedPreferences.getInstance();
    final slug = prefs.getString('tenant_slug');
    if (mounted) {
      setState(() {
        _isLoggedIn = loggedIn;
        _tenantSlug = slug;
      });
    }
  }

  /// ⭐ Configure Firebase Cloud Messaging (push notifications)
  ///    - Request permission (iOS + Android 13+)
  ///    - Listen for foreground messages
  ///    - Send token to backend when refreshed
  Future<void> _setupFirebaseMessaging() async {
    try {
      final messaging = FirebaseMessaging.instance;

      // Request permission (iOS + Android 13+)
      final settings = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        criticalAlert: true,
      );
      print('🔔 FCM permission status: ${settings.authorizationStatus}');

      // Listen for foreground messages — show a local notification (whatsapp-style banner)
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        final notification = message.notification;
        final title = notification?.title ?? message.data['title'] as String? ?? 'Academia Helm';
        final body = notification?.body ?? message.data['body'] as String? ?? '';
        final url = message.data['url'] as String?;

        print('🔔 Foreground message: $title / $body');

        // ⭐ V3-4: Show a foreground banner via flutter_local_notifications
        _localNotifications.show(
          DateTime.now().millisecondsSinceEpoch ~/ 1000,
          title,
          body,
          NotificationDetails(
            android: AndroidNotificationDetails(
              _fcmChannel.id,
              _fcmChannel.name,
              channelDescription: _fcmChannel.description,
              importance: Importance.high,
              priority: Priority.high,
              icon: '@mipmap/ic_notification',
              color: const Color(0xFFCFA63A), // Academia Helm gold
            ),
            iOS: const DarwinNotificationDetails(
              presentAlert: true,
              presentBadge: true,
              presentSound: true,
            ),
          ),
          payload: url,
        );
      });

      // Listen for notification opens (when user taps the notification in background)
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        final url = message.data['url'] as String?;
        final conversationId = message.data['conversationId'] as String?;
        print('🔔 Opened from notification — url: $url, conversation: $conversationId');
        if (url != null && url.isNotEmpty) {
          _navigateToUrl(url);
        } else {
          // Fallback: navigate to chat list
          _navigateToUrl('/chat');
        }
      });

      // Get the initial message (app launched from terminated state via notification)
      final initialMessage = await messaging.getInitialMessage();
      if (initialMessage != null) {
        final url = initialMessage.data['url'] as String?;
        final conversationId = initialMessage.data['conversationId'] as String?;
        print('🔔 Launched from notification — url: $url, conversation: $conversationId');
        // Wait a moment for the app to initialize, then navigate
        Future.delayed(const Duration(milliseconds: 500), () {
          if (url != null && url.isNotEmpty) {
            _navigateToUrl(url);
          }
        });
      }

      // Listen for token refresh
      _fcmTokenSub = messaging.onTokenRefresh.listen((String token) async {
        print('🔔 FCM token refreshed: $token');
        await _sendTokenToBackend(token);
      });

      // Get initial token and send to backend
      final token = await messaging.getToken();
      if (token != null) {
        print('🔔 Initial FCM token: $token');
        await _sendTokenToBackend(token);
      }
    } catch (e) {
      print('⚠️ FCM setup échoué: $e');
    }
  }

  /// Send the FCM token to the backend so the user can receive push notifications.
  /// ⭐ V3-4: Uses the new /notifications/device-tokens endpoint (with fcm_token field)
  ///    instead of the legacy /api/chat/push/subscribe.
  Future<void> _sendTokenToBackend(String token) async {
    try {
      final userId = await AuthService.getUserId();
      if (userId == null) {
        print('🔔 No userId — token not sent to backend');
        return;
      }
      // ⭐ V3-4: New endpoint POST /notifications/device-tokens with { fcmToken, platform, deviceInfo }
      await ApiService.registerFcmToken(
        fcmToken: token,
        platform: 'ANDROID',
        deviceInfo: 'Helm Connect Flutter',
      );
      print('✅ FCM token envoyé au backend (/notifications/device-tokens)');
    } catch (e) {
      print('⚠️ Échec envoi token FCM: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoggedIn == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_isLoggedIn == true) {
      return const ChatScreen();
    }
    // Not logged in — go to tenant selection
    return const TenantSelectionScreen();
  }
}
