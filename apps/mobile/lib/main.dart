// ============================================================================
// MAIN — Academia Helm Mobile App
// ============================================================================
// Point d'entrée de l'application mobile Flutter.
//
// FLUX :
//   1. L'app démarre → vérifie si une école est déjà sélectionnée (SharedPreferences)
//   2. Si oui → écran de connexion (avec l'école mémorisée)
//   3. Si non → écran de recherche d'école (portail public)
//   4. Après connexion → dashboard selon le rôle (PARENT / TEACHER / SCHOOL)
// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app/router.dart';
import 'core/theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    const ProviderScope(
      child: AcademiaHelmApp(),
    ),
  );
}

class AcademiaHelmApp extends ConsumerWidget {
  const AcademiaHelmApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'Academia Helm',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      routerConfig: router,
    );
  }
}
