// ============================================================================
// HELM CONNECT — Flutter Mobile App Entry Point
// ============================================================================
// ⭐ V3-9: Complete startup flow rewrite:
//   1. Branded splash screen (Royal Blue + gold halo + Helm Connect logo)
//   2. Auto-check session (token + tenant in SharedPreferences)
//   3. If logged in → ChatScreen directly (auto-login, no re-auth)
//   4. If not logged in → TenantSelectionScreen → PortalSelectScreen
//      → LoginScreen → ChatScreen
//   5. Session persists across app restarts (one-time login)
// ============================================================================

import 'dart:async';
import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'theme/helm_theme.dart';
import 'services/api_service.dart';
import 'screens/tenant_selection_screen.dart';
import 'screens/portal_select_screen.dart';
import 'screens/login_screen.dart';
import 'screens/chat_screen.dart';

// ⭐ Global navigator key for deep-link navigation from FCM taps
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

// ⭐ Notification channel + plugin
const AndroidNotificationChannel _fcmChannel = AndroidNotificationChannel(
  'academia_helm_notifications',
  'Academia Helm Notifications',
  description: 'Notifications Helm Connect (absences, examens, bulletins, discipline)',
  importance: Importance.high,
);
final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();

Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print('🔔 Background message: ${message.notification?.title} / ${message.data}');
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ⭐ V3-9: Initialize Hive for offline chat storage
  try {
    await Hive.initFlutter();
  } catch (e) {
    print('⚠️ Hive init failed (non-blocking): $e');
  }

  // ⭐ V3-4: Initialize flutter_local_notifications (wrapped in try/catch)
  try {
    const androidInit = AndroidInitializationSettings('@mipmap/ic_notification');
    const iosInit = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    await _localNotifications.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
      onDidReceiveNotificationResponse: (NotificationResponse response) {
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
  } catch (e) {
    print('⚠️ Local notifications init failed (non-blocking): $e');
  }

  // ⭐ Initialize Firebase
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);
    print('✅ Firebase initialisé');
  } catch (e) {
    print('⚠️ Firebase init échoué: $e (continuons sans Firebase)');
  }

  runApp(const HelmConnectApp());
}

void _navigateToUrl(String url) {
  final nav = navigatorKey.currentState;
  if (nav == null) return;
  nav.pushNamedAndRemoveUntil('/chat', (route) => false);
}

class HelmConnectApp extends StatelessWidget {
  const HelmConnectApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Helm Connect',
      debugShowCheckedModeBanner: false,
      navigatorKey: navigatorKey,
      theme: HelmThemes.lightTheme(),
      darkTheme: HelmThemes.darkTheme(),
      themeMode: ThemeMode.system,
      home: const SplashScreen(),
      routes: {
        '/tenant-selection': (context) => const TenantSelectionScreen(),
        '/chat': (context) => const ChatScreen(),
      },
    );
  }
}

// ============================================================================
// SPLASH SCREEN — Branded loading with Helm Connect logo + gold halo
// ============================================================================
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  late AnimationController _haloController;
  late AnimationController _logoController;
  late Animation<double> _haloAnimation;
  late Animation<double> _logoScale;

  @override
  void initState() {
    super.initState();

    // Gold halo pulse animation (1.8s loop)
    _haloController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    );
    _haloAnimation = Tween<double>(begin: 0.4, end: 1.0).animate(
      CurvedAnimation(parent: _haloController, curve: Curves.easeInOut),
    );
    _haloController.repeat(reverse: true);

    // Logo entrance animation
    _logoController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _logoScale = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(parent: _logoController, curve: Curves.elasticOut),
    );
    _logoController.forward();

    // ⭐ Check session after 2 seconds (show splash for at least 2s)
    _checkSessionAndNavigate();
  }

  @override
  void dispose() {
    _haloController.dispose();
    _logoController.dispose();
    super.dispose();
  }

  Future<void> _checkSessionAndNavigate() async {
    // Wait at least 2 seconds for the splash to be visible
    await Future.delayed(const Duration(seconds: 2));

    try {
      final isLoggedIn = await AuthService.isLoggedIn();
      final prefs = await SharedPreferences.getInstance();
      final hasToken = prefs.getString('auth_token') != null;
      final hasTenant = prefs.getString('tenant_slug') != null;

      if (!mounted) return;

      if (isLoggedIn == true && hasToken && hasTenant) {
        // ⭐ Auto-login: session is valid → go directly to chat
        _setupFirebaseMessaging();
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const ChatScreen()),
        );
      } else {
        // ⭐ Not logged in → go to tenant selection
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const TenantSelectionScreen()),
        );
      }
    } catch (e) {
      print('⚠️ Session check failed: $e');
      if (!mounted) return;
      // On error, go to tenant selection
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const TenantSelectionScreen()),
      );
    }
  }

  void _setupFirebaseMessaging() {
    try {
      final messaging = FirebaseMessaging.instance;
      messaging.requestPermission(alert: true, badge: true, sound: true);

      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        final notification = message.notification;
        final title = notification?.title ?? message.data['title'] as String? ?? 'Helm Connect';
        final body = notification?.body ?? message.data['body'] as String? ?? '';
        final url = message.data['url'] as String?;

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
              color: const Color(0xFFCFA63A),
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

      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        _navigateToUrl(message.data['url'] as String? ?? '/chat');
      });

      messaging.getToken().then((token) async {
        if (token != null) {
          try {
            await ApiService.registerFcmToken(
              fcmToken: token,
              platform: 'ANDROID',
              deviceInfo: 'Helm Connect Flutter',
            );
            print('✅ FCM token registered');
          } catch (e) {
            print('⚠️ FCM token registration failed: $e');
          }
        }
      });

      messaging.onTokenRefresh.listen((token) async {
        try {
          await ApiService.registerFcmToken(
            fcmToken: token,
            platform: 'ANDROID',
            deviceInfo: 'Helm Connect Flutter',
          );
        } catch (e) {
          print('⚠️ FCM token refresh failed: $e');
        }
      });
    } catch (e) {
      print('⚠️ FCM setup failed (non-blocking): $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        // ⭐ Royal Blue gradient background (Academia Helm palette)
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xFF0A2A5E), // Royal Blue night
              Color(0xFF114FC4), // Royal Blue mid
              Color(0xFF1C6FE8), // Royal Blue vivid
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // ⭐ Logo with pulsing gold halo
                SizedBox(
                  width: 140,
                  height: 140,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Outer gold halo (pulsing)
                      AnimatedBuilder(
                        animation: _haloAnimation,
                        builder: (context, child) {
                          return Opacity(
                            opacity: _haloAnimation.value * 0.3,
                            child: Container(
                              width: 140,
                              height: 140,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: const Color(0xFFCFA63A),
                              ),
                            ),
                          );
                        },
                      ),
                      // Inner gold ring
                      AnimatedBuilder(
                        animation: _haloAnimation,
                        builder: (context, child) {
                          return Opacity(
                            opacity: _haloAnimation.value * 0.5,
                            child: Container(
                              width: 120,
                              height: 120,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: const Color(0xFFFFE08A),
                                  width: 3,
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                      // Logo (speech bubble icon)
                      ScaleTransition(
                        scale: _logoScale,
                        child: Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white.withOpacity(0.15),
                            border: Border.all(
                              color: const Color(0xFFFFE08A),
                              width: 2,
                            ),
                          ),
                          child: const Icon(
                            Icons.chat_bubble,
                            color: Colors.white,
                            size: 40,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                // "Helm Connect" wordmark
                const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Helm',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                    SizedBox(width: 6),
                    Text(
                      'Connect',
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFF5B335),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                // Subtitle
                const Text(
                  'COMMUNIQUEZ • COLLABOREZ • RESTEZ CONNECTÉS',
                  style: TextStyle(
                    fontFamily: 'Inter',
                    fontSize: 10,
                    letterSpacing: 2.5,
                    color: Color(0xFFBBDEFB),
                  ),
                ),
                const SizedBox(height: 40),
                // Loading indicator
                SizedBox(
                  width: 28,
                  height: 28,
                  child: CircularProgressIndicator(
                    color: const Color(0xFFF5B335),
                    strokeWidth: 2.5,
                    value: null,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
