// ============================================================================
// APP ROUTER — Navigation GoRouter
// ============================================================================
// Routes:
//   / → SchoolSearchPage (portail public — recherche d'école)
//   /login → LoginPage (connexion après sélection d'école)
//   /dashboard → DashboardPage (après authentification)
//   /parent/* → Pages spécifiques parent
//   /teacher/* → Pages spécifiques enseignant
// ============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/school_search/school_search_page.dart';
import '../features/auth/login_page.dart';
import '../features/dashboard/dashboard_page.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      // ── Portail public : recherche d'école ──
      GoRoute(
        path: '/',
        name: 'school_search',
        builder: (context, state) => const SchoolSearchPage(),
      ),

      // ── Connexion ──
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginPage(),
      ),

      // ── Dashboard (après auth) ──
      GoRoute(
        path: '/dashboard',
        name: 'dashboard',
        builder: (context, state) => const DashboardPage(),
      ),
    ],
    redirect: (context, state) {
      // TODO: vérifier auth pour routes protégées
      return null;
    },
  );
});
