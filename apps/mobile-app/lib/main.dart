import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'core/theme/ah_theme.dart';
import 'core/router/app_router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Hive for local cache.
  await Hive.initFlutter();

  // Initialize secure storage.
  const secureStorage = FlutterSecureStorage();

  // Pre-fetch tokens to determine initial route.
  final accessToken = await secureStorage.read(key: 'access_token');

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

  runApp(
    ProviderScope(
      child: AcademiaHelmApp(hasToken: accessToken != null),
    ),
  );
}

class AcademiaHelmApp extends ConsumerWidget {
  const AcademiaHelmApp({super.key, required this.hasToken});

  final bool hasToken;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

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
    );
  }
}
