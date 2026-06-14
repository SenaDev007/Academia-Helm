import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../theme/ah_theme.dart';
import '../widgets/adaptive_scaffold.dart';
import 'route_guards.dart';
import '../../features/auth/pages/splash_screen.dart';
import '../../features/auth/pages/login_screen.dart';
import '../../features/auth/pages/tenant_select_screen.dart';
import '../../features/dashboard/pages/dashboard_screen.dart';
import '../../features/profile/pages/profile_screen.dart';

// ── Navigation Destinations ───────────────────────────────────────────

const List<NavigationDestination> ahDestinations = [
  NavigationDestination(
    icon: Icon(Icons.dashboard_outlined),
    selectedIcon: Icon(Icons.dashboard),
    label: 'Tableau de bord',
  ),
  NavigationDestination(
    icon: Icon(Icons.school_outlined),
    selectedIcon: Icon(Icons.school),
    label: 'Élèves',
  ),
  NavigationDestination(
    icon: Icon(Icons.message_outlined),
    selectedIcon: Icon(Icons.message),
    label: 'Messages',
  ),
  NavigationDestination(
    icon: Icon(Icons.person_outline),
    selectedIcon: Icon(Icons.person),
    label: 'Profil',
  ),
];

const List<AdaptiveDestination> adaptiveDestinations = [
  AdaptiveDestination(
    icon: Icons.dashboard_outlined,
    selectedIcon: Icons.dashboard,
    label: 'Tableau de bord',
    path: '/dashboard',
  ),
  AdaptiveDestination(
    icon: Icons.school_outlined,
    selectedIcon: Icons.school,
    label: 'Élèves',
    path: '/students',
  ),
  AdaptiveDestination(
    icon: Icons.message_outlined,
    selectedIcon: Icons.message,
    label: 'Messages',
    path: '/messages',
  ),
  AdaptiveDestination(
    icon: Icons.person_outline,
    selectedIcon: Icons.person,
    label: 'Profil',
    path: '/profile',
  ),
];

// ── Shell Branches ────────────────────────────────────────────────────

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorKey = GlobalKey<NavigatorState>();

// ── Router Provider ───────────────────────────────────────────────────

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/splash',
    debugLogDiagnostics: true,
    redirect: (context, state) => authGuardRedirect(ref, state),
    routes: [
      // ── Public Routes ────────────────────────────────────────────
      GoRoute(
        path: '/splash',
        name: 'splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/tenant-select',
        name: 'tenantSelect',
        builder: (context, state) => const TenantSelectScreen(),
      ),

      // ── Authenticated Shell ──────────────────────────────────────
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) {
          return AHAdaptiveScaffold(
            destinations: adaptiveDestinations,
            currentPath: state.matchedLocation,
            onDestinationSelected: (path) => context.go(path),
            child: child,
          );
        },
        routes: [
          GoRoute(
            path: '/dashboard',
            name: 'dashboard',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: DashboardScreen(),
            ),
          ),
          GoRoute(
            path: '/students',
            name: 'students',
            builder: (context, state) => const _PlaceholderScreen(
              title: 'Élèves',
              icon: Icons.school,
            ),
          ),
          GoRoute(
            path: '/students/:id',
            name: 'studentDetail',
            builder: (context, state) {
              final studentId = state.pathParameters['id'] ?? '';
              return _PlaceholderScreen(
                title: 'Détail élève $studentId',
                icon: Icons.person,
              );
            },
          ),
          GoRoute(
            path: '/parents',
            name: 'parents',
            builder: (context, state) => const _PlaceholderScreen(
              title: 'Espace Parents',
              icon: Icons.family_restroom,
            ),
          ),
          GoRoute(
            path: '/teachers',
            name: 'teachers',
            builder: (context, state) => const _PlaceholderScreen(
              title: 'Espace Enseignants',
              icon: Icons.cast_for_education,
            ),
          ),
          GoRoute(
            path: '/admin',
            name: 'admin',
            builder: (context, state) => const _PlaceholderScreen(
              title: 'Administration',
              icon: Icons.admin_panel_settings,
            ),
          ),
          GoRoute(
            path: '/messages',
            name: 'messages',
            builder: (context, state) => const _PlaceholderScreen(
              title: 'Messages',
              icon: Icons.message,
            ),
          ),
          GoRoute(
            path: '/profile',
            name: 'profile',
            builder: (context, state) => const ProfileScreen(),
          ),
          GoRoute(
            path: '/settings',
            name: 'settings',
            builder: (context, state) => const _PlaceholderScreen(
              title: 'Paramètres',
              icon: Icons.settings,
            ),
          ),
          GoRoute(
            path: '/notifications',
            name: 'notifications',
            builder: (context, state) => const _PlaceholderScreen(
              title: 'Notifications',
              icon: Icons.notifications,
            ),
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => _ErrorScreen(error: state.error),
  );
});

// ── Placeholder Screen (for routes not yet fully implemented) ─────────

class _PlaceholderScreen extends StatelessWidget {
  const _PlaceholderScreen({
    required this.title,
    required this.icon,
  });

  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AHColors.navy.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 40, color: AHColors.navy),
            ),
            const SizedBox(height: AHSpacing.xl),
            Text(
              title,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: AHColors.navy,
                  ),
            ),
            const SizedBox(height: AHSpacing.sm),
            Text(
              'Module en cours de développement',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AHColors.gray500,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Error Screen ──────────────────────────────────────────────────────

class _ErrorScreen extends StatelessWidget {
  const _ErrorScreen({required this.error});

  final GoException? error;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(AHSpacing.xl),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 64, color: AHColors.error),
              const SizedBox(height: AHSpacing.xl),
              Text(
                'Page introuvable',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AHColors.gray900,
                    ),
              ),
              const SizedBox(height: AHSpacing.sm),
              Text(
                error?.toString() ?? 'La page demandée n\'existe pas.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AHColors.gray500,
                    ),
              ),
              const SizedBox(height: AHSpacing.xl),
              ElevatedButton(
                onPressed: () => context.go('/dashboard'),
                child: const Text('Retour au tableau de bord'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
