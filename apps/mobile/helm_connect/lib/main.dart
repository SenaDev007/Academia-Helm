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
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
// ⭐ Firebase — initialisation au démarrage
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'theme/helm_theme.dart';
import 'services/api_service.dart';
import 'screens/tenant_selection_screen.dart';
import 'screens/chat_screen.dart';

// ⭐ Background message handler — doit être top-level (pas dans une classe)
//    Appelé par Firebase quand l'app est tuée et qu'un message arrive.
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  // Le service HelmConnectFirebaseMessagingService (Android) affiche déjà la notification.
  // Ce handler est appelé pour traiter les "data-only messages" en arrière-plan.
  print('🔔 Background message: ${message.notification?.title} / ${message.data}');
}

void main() async {
  // ⭐ Initialiser les bindings Flutter avant tout await
  WidgetsFlutterBinding.ensureInitialized();

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

class HelmConnectApp extends StatelessWidget {
  const HelmConnectApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Helm Connect',
      debugShowCheckedModeBanner: false,
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

      // Listen for foreground messages
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        print('🔔 Foreground message: ${message.notification?.title}');
        // TODO V2.8: show in-app notification banner
      });

      // Listen for notification opens (when user taps the notification)
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        final conversationId = message.data['conversationId'] as String?;
        if (conversationId != null) {
          print('🔔 Opened from notification — conversation: $conversationId');
          // TODO V2.8: navigate to the conversation
        }
      });

      // Get the initial message (app launched from terminated state via notification)
      final initialMessage = await messaging.getInitialMessage();
      if (initialMessage != null) {
        final conversationId = initialMessage.data['conversationId'] as String?;
        if (conversationId != null) {
          print('🔔 Launched from notification — conversation: $conversationId');
        }
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

  /// Send the FCM token to the backend so the user can receive push notifications
  Future<void> _sendTokenToBackend(String token) async {
    try {
      final userId = await AuthService.getUserId();
      if (userId == null) {
        print('🔔 No userId — token not sent to backend');
        return;
      }
      // POST /api/chat/push/subscribe with { userId, subscription: { token } }
      await ApiService.post('/api/chat/push/subscribe', {
        'userId': userId,
        'subscription': {
          'token': token,
          'platform': 'android', // or 'ios'
        },
      });
      print('✅ FCM token envoyé au backend');
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
