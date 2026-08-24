import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'core/theme/ah_theme.dart';
import 'core/router/app_router.dart';
import 'core/widgets/ah_logo_circle.dart';
// ⭐ V3-4: Helm Connect mobile push notifications (Examens/Absences/Discipline)
import 'core/services/push_notification_service.dart';

/// Background message handler for Firebase Messaging.
/// MUST be a top-level function (not a class method or closure)
/// and annotated with @pragma('vm:entry-point') to prevent tree-shaking
/// in release builds.
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // If you're going to use other Firebase services in the background, such as
  // Firestore, make sure you call `initializeApp` before using them.
  await Firebase.initializeApp();
}

void main() async {
  // Ensure Flutter bindings are initialized before any async work.
  WidgetsFlutterBinding.ensureInitialized();

  // ── Initialize Firebase BEFORE runApp() ──
  // With google-services.json + the Google Services Gradle plugin properly
  // configured, Firebase.initializeApp() reads the config automatically.
  // No need to pass FirebaseOptions manually on Android.
  //
  // We use try/catch so that if Firebase config is missing/misconfigured,
  // the app still starts (just without push notifications).
  try {
    await Firebase.initializeApp();
  } catch (e) {
    // Firebase failed to initialize — app will continue without push notifications.
    // This prevents a hard crash; the user can still use the app.
    debugPrint('⚠️ Firebase initialization failed (push notifications disabled): $e');
  }

  runApp(
    ProviderScope(
      child: AcademiaHelmApp(),
    ),
  );
}

class AcademiaHelmApp extends ConsumerStatefulWidget {
  const AcademiaHelmApp({super.key});

  @override
  ConsumerState<AcademiaHelmApp> createState() => _AcademiaHelmAppState();
}

class _AcademiaHelmAppState extends ConsumerState<AcademiaHelmApp> {
  bool _initialized = false;
  Object? _initError;

  @override
  void initState() {
    super.initState();
    _initializeApp();
  }

  Future<void> _initializeApp() async {
    try {
      // Initialize Hive for local cache.
      await Hive.initFlutter();

      // Initialize secure storage with Android-specific options.
      // Using encryptedSharedPreferences on Android for better security.
      const secureStorage = FlutterSecureStorage(
        aOptions: AndroidOptions(
          encryptedSharedPreferences: true,
        ),
      );

      // Pre-fetch tokens to determine initial route.
      await secureStorage.read(key: 'ah_access_token');

      // System UI configuration.
      SystemChrome.setSystemUIOverlayStyle(
        const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.light,
          statusBarBrightness: Brightness.dark,
        ),
      );

      await SystemChrome.setPreferredOrientations([
        DeviceOrientation.portraitUp,
        DeviceOrientation.portraitDown,
      ]);

      // ⭐ V3-4: Initialize push notifications (FCM + local notifications + register token)
      try {
        final pushService = ref.read(pushNotificationServiceProvider);
        // Wire deep link handler — taps on notifications navigate to data.url
        pushService.onDeepLink = (String url) {
          if (url.isNotEmpty) {
            ref.read(appRouterProvider).push(url);
          }
        };
        await pushService.initialize();
      } catch (e) {
        // Push init failed — app still works, just without push
        debugPrint('⚠️ Push notification initialization failed (non-blocking): $e');
      }

      if (mounted) {
        setState(() => _initialized = true);
      }
    } catch (e, st) {
      // Capture the error so we can display it instead of crashing.
      debugPrint('Initialization error: $e\n$st');
      if (mounted) {
        setState(() => _initError = e);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);

    // If initialization failed, show an error screen instead of crashing.
    if (_initError != null) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Scaffold(
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 64, color: Colors.red),
                  const SizedBox(height: 16),
                  const Text(
                    "Erreur d'initialisation",
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '$_initError',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 14, color: Colors.grey),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    // While initializing, show a simple splash (router is already available).
    return MaterialApp.router(
      title: 'Academia Helm',
      debugShowCheckedModeBanner: false,
      theme: AHTheme.light,
      darkTheme: AHTheme.dark,
      themeMode: ThemeMode.system,
      routerConfig: router,
      locale: const Locale('fr'),
      supportedLocales: const [
        Locale('fr'),
        Locale('en'),
      ],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) {
        if (!_initialized) {
          // Show a branded loading screen while Hive/storage initializes.
          // Matches the web app's AcademiaLoader: Royal Blue background,
          // gold-haloed logo, "Academia Helm" wordmark.
          return Container(
            decoration: const BoxDecoration(
              color: Color(0xFF1A237E),
            ),
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Logo (matches web LogoCircle exactly)
                  const AHLogoCircle(size: 96),
                  const SizedBox(height: 24),
                  // "Academia Helm" wordmark
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Academia',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                      SizedBox(width: 6),
                      Text(
                        'Helm',
                        style: TextStyle(
                          fontFamily: 'Inter',
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFFF5B335),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'PLATEFORME DE PILOTAGE ÉDUCATIF',
                    style: TextStyle(
                      fontFamily: 'Inter',
                      fontSize: 10,
                      letterSpacing: 2.5,
                      color: Color(0xFFBBDEFB),
                    ),
                  ),
                  const SizedBox(height: 32),
                  const SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(
                      color: Color(0xFFF5B335),
                      strokeWidth: 2.5,
                    ),
                  ),
                ],
              ),
            ),
          );
        }
        return child!;
      },
    );
  }
}
