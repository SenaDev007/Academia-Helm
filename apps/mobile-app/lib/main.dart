import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'core/theme/ah_theme.dart';
import 'core/router/app_router.dart';

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
  // This is critical: Firebase plugins auto-register on the Android side,
  // and if Firebase.initializeApp() is not called, any Firebase plugin usage
  // (or even the auto-registration) will crash the app with
  // "Academia Helm keeps stopping".
  //
  // We use try/catch so that if Firebase config is missing/misconfigured,
  // the app still starts (just without push notifications).
  try {
    await Firebase.initializeApp(
      options: const FirebaseOptions(
        apiKey: 'AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        appId: '1:102938475610:android:a1b2c3d4e5f6a7b8c9d0',
        messagingSenderId: '102938475610',
        projectId: 'academia-helm-mobile',
        storageBucket: 'academia-helm-mobile.appspot.com',
      ),
    );
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
      supportedLocales: const [
        Locale('fr'),
        Locale('en'),
      ],
      builder: (context, child) {
        if (!_initialized) {
          // Show a loading screen while Hive/storage initializes.
          return Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF071D4A), Color(0xFF0B2F73), Color(0xFF1A3F8B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: const Center(
              child: CircularProgressIndicator(
                color: Color(0xFFF5B335),
                strokeWidth: 2.5,
              ),
            ),
          );
        }
        return child!;
      },
    );
  }
}
