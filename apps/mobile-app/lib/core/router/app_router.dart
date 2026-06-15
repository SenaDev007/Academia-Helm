import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../theme/ah_theme.dart';
import '../widgets/adaptive_scaffold.dart';
import 'route_guards.dart';
import '../../features/auth/pages/splash_screen.dart';
import '../../features/auth/pages/login_screen.dart';
import '../../features/auth/pages/tenant_select_screen.dart';
import '../../features/auth/pages/portal_select_screen.dart';
import '../../features/auth/pages/logout_screen.dart';
import '../../features/auth/pages/forgot_password_screen.dart';
import '../../features/auth/pages/reset_password_screen.dart';
import '../../features/dashboard/pages/dashboard_screen.dart';
import '../../features/profile/pages/profile_screen.dart';
import '../../features/students/pages/students_screen.dart';
import '../../features/finance/pages/finance_screen.dart';
import '../../features/hr/pages/hr_screen.dart';
import '../../features/pedagogy/pages/pedagogy_screen.dart';
import '../../features/exams/pages/exams_screen.dart';
import '../../features/communication/pages/communication_screen.dart';
import '../../features/settings/pages/settings_screen.dart';
import '../../features/meetings/pages/meetings_screen.dart';
import '../../features/orion/pages/orion_screen.dart';
import '../../features/platform/pages/platform_screen.dart';
import '../../features/aggregation/pages/aggregation_screen.dart';
import '../../features/general/pages/general_screen.dart';
import '../../features/library/pages/library_screen.dart';
import '../../features/transport/pages/transport_screen.dart';
import '../../features/canteen/pages/canteen_screen.dart';
import '../../features/infirmary/pages/infirmary_screen.dart';
import '../../features/qhse/pages/qhse_screen.dart';
import '../../features/educast/pages/educast_screen.dart';
import '../../features/shop/pages/shop_screen.dart';

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
        path: '/portal-select',
        name: 'portalSelect',
        builder: (context, state) => const PortalSelectScreen(),
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
      GoRoute(
        path: '/logout',
        name: 'logout',
        builder: (context, state) => const LogoutScreen(),
      ),
      GoRoute(
        path: '/forgot-password',
        name: 'forgotPassword',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
      GoRoute(
        path: '/reset-password',
        name: 'resetPassword',
        builder: (context, state) => const ResetPasswordScreen(),
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
            builder: (context, state) => const StudentsScreen(),
          ),
          GoRoute(
            path: '/students/:id',
            name: 'studentDetail',
            builder: (context, state) {
              final studentId = state.pathParameters['id'] ?? '';
              return StudentsScreen(); // TODO: student detail view
            },
          ),
          GoRoute(
            path: '/finance',
            name: 'finance',
            builder: (context, state) => const FinanceScreen(),
          ),
          GoRoute(
            path: '/hr',
            name: 'hr',
            builder: (context, state) => const HrScreen(),
          ),
          GoRoute(
            path: '/pedagogy',
            name: 'pedagogy',
            builder: (context, state) => const PedagogyScreen(),
          ),
          GoRoute(
            path: '/exams',
            name: 'exams',
            builder: (context, state) => const ExamsScreen(),
          ),
          GoRoute(
            path: '/communication',
            name: 'communication',
            builder: (context, state) => const CommunicationScreen(),
          ),
          GoRoute(
            path: '/settings',
            name: 'settings',
            builder: (context, state) => const SettingsScreen(),
          ),
          GoRoute(
            path: '/meetings',
            name: 'meetings',
            builder: (context, state) => const MeetingsScreen(),
          ),
          GoRoute(
            path: '/orion',
            name: 'orion',
            builder: (context, state) => const OrionScreen(),
          ),
          GoRoute(
            path: '/platform',
            name: 'platform',
            builder: (context, state) => const PlatformScreen(),
          ),
          GoRoute(
            path: '/aggregation',
            name: 'aggregation',
            builder: (context, state) => const AggregationScreen(),
          ),
          GoRoute(
            path: '/general',
            name: 'general',
            builder: (context, state) => const GeneralScreen(),
          ),
          GoRoute(
            path: '/library',
            name: 'library',
            builder: (context, state) => const LibraryScreen(),
          ),
          GoRoute(
            path: '/transport',
            name: 'transport',
            builder: (context, state) => const TransportScreen(),
          ),
          GoRoute(
            path: '/canteen',
            name: 'canteen',
            builder: (context, state) => const CanteenScreen(),
          ),
          GoRoute(
            path: '/infirmary',
            name: 'infirmary',
            builder: (context, state) => const InfirmaryScreen(),
          ),
          GoRoute(
            path: '/qhse',
            name: 'qhse',
            builder: (context, state) => const QhseScreen(),
          ),
          GoRoute(
            path: '/educast',
            name: 'educast',
            builder: (context, state) => const EducastScreen(),
          ),
          GoRoute(
            path: '/shop',
            name: 'shop',
            builder: (context, state) => const ShopScreen(),
          ),
          // Legacy routes kept for compatibility — redirect to real screens
          GoRoute(
            path: '/parents',
            name: 'parents',
            redirect: (context, state) => '/students',
          ),
          GoRoute(
            path: '/teachers',
            name: 'teachers',
            redirect: (context, state) => '/hr',
          ),
          GoRoute(
            path: '/admin',
            name: 'admin',
            redirect: (context, state) => '/platform',
          ),
          GoRoute(
            path: '/messages',
            name: 'messages',
            redirect: (context, state) => '/communication',
          ),
          GoRoute(
            path: '/notifications',
            name: 'notifications',
            redirect: (context, state) => '/communication',
          ),
          GoRoute(
            path: '/profile',
            name: 'profile',
            builder: (context, state) => const ProfileScreen(),
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => _ErrorScreen(error: state.error),
  );
});

// ── Error Screen ──────────────────────────────────────────────────────

class _ErrorScreen extends StatelessWidget {
  const _ErrorScreen({required this.error});

  final GoException? error;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 64, color: AHColors.error),
              const SizedBox(height: 24),
              Text(
                'Page introuvable',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AHColors.gray900,
                    ),
              ),
              const SizedBox(height: 12),
              Text(
                error?.toString() ?? 'La page demandée n\'existe pas.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AHColors.gray500,
                    ),
              ),
              const SizedBox(height: 24),
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
