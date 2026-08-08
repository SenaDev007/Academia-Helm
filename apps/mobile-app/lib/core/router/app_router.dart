import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../theme/ah_theme.dart';
import '../widgets/adaptive_scaffold.dart';
import 'route_guards.dart';
import '../auth/auth_notifier.dart';
import '../theme/ah_colors.dart';
import '../auth/auth_state.dart';
import '../auth/auth_providers.dart';
import '../../features/auth/pages/splash_screen.dart';
import '../../features/auth/pages/login_screen.dart';
import '../../features/auth/pages/tenant_select_screen.dart';
import '../../features/auth/pages/portal_select_screen.dart';
import '../../features/auth/pages/school_select_screen.dart';
import '../../features/auth/pages/logout_screen.dart';
import '../../features/auth/pages/forgot_password_screen.dart';
import '../../features/auth/pages/reset_password_screen.dart';
import '../../features/landing/pages/landing_page_screen.dart';
import '../../features/teacher/pages/teacher_dashboard_screen.dart';
import '../../features/parent/pages/parent_dashboard_screen.dart';
import '../../features/dashboard/pages/pilotage_dashboard_screen.dart';
import '../../features/profile/pages/profile_screen.dart';
import '../../features/students/pages/students_module_screen.dart';
import '../../features/finance/pages/finance_module_screen.dart';
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
// ⭐ P0: Import des écrans orphelins (écrans qui existaient mais n'étaient pas routés)
import '../../features/grades/pages/grades_list_screen.dart';
import '../../features/grades/pages/grade_detail_screen.dart';
import '../../features/payments/pages/payments_list_screen.dart';
import '../../features/payments/pages/payment_detail_screen.dart';
import '../../features/messages/pages/messages_list_screen.dart';
import '../../features/messages/pages/message_detail_screen.dart';
import '../../features/absences/pages/absences_list_screen.dart';
import '../../features/schedule/pages/schedule_screen.dart';
// ⭐ P0-2: Écran Mes Enfants pour le portail Parent
import '../../features/parents/pages/children_screen.dart';
// ⭐ P1-6: Écran Faire l'appel (enseignant)
import '../../features/attendance/pages/take_attendance_screen.dart';
// ⭐ P1-7: Écran Saisir les notes (enseignant)
import '../../features/grades/pages/grade_entry_screen.dart';
// ⭐ P1-8: Écran Bulletin (parent)
import '../../features/parents/pages/bulletin_screen.dart';
// ⭐ P1-9: Écran Cahier de texte (parent)
import '../../features/parents/pages/child_journal_screen.dart';
// ⭐ P1-10: Écran Initier paiement (parent)
import '../../features/parents/pages/initiate_payment_screen.dart';
// ⭐ Module Documents (parent)
import '../../features/parents/pages/documents_screen.dart';

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

// ⭐ P0-5: Destinations dynamiques selon le portail sélectionné
// Remplace l'ancienne liste hardcodée à 4 entrées fixes.
// Chaque portail voit ses propres modules dans la barre de navigation.

/// Provider qui retourne les destinations de navigation selon le portail.
final adaptiveDestinationsProvider = Provider<List<AdaptiveDestination>>((ref) {
  // Lire le portail sélectionné depuis l'état d'auth
  // Pour l'instant on utilise une approche simple basée sur le rôle user
  final authState = ref.watch(authNotifierProvider);

  return authState.maybeWhen(
    data: (state) {
      final role = state.userOrNull?.role?.toUpperCase() ?? '';
      final portal = state.selectedPortalOrNull;

      // Si le portail est explicitement choisi, l'utiliser
      if (portal != null) {
        return _destinationsForPortal(portal);
      }

      // Sinon, déduire du rôle
      if (role == 'TEACHER' || role == 'ENSEIGNANT') {
        return _teacherDestinations;
      } else if (role == 'PARENT' || role == 'PARENT_PRIMARY' ||
          role == 'LEGAL_GUARDIAN' || role == 'GUARDIAN') {
        return _parentDestinations;
      }
      return _adminDestinations;
    },
    orElse: () => _adminDestinations,
  );
});

const List<AdaptiveDestination> _adminDestinations = [
  AdaptiveDestination(
    icon: Icons.dashboard_outlined,
    selectedIcon: Icons.dashboard,
    label: 'Accueil',
    path: '/dashboard',
  ),
  AdaptiveDestination(
    icon: Icons.school_outlined,
    selectedIcon: Icons.school,
    label: 'Élèves',
    path: '/students',
  ),
  AdaptiveDestination(
    icon: Icons.attach_money_outlined,
    selectedIcon: Icons.attach_money,
    label: 'Finances',
    path: '/finance',
  ),
  AdaptiveDestination(
    icon: Icons.people_outline,
    selectedIcon: Icons.people,
    label: 'RH',
    path: '/hr',
  ),
  AdaptiveDestination(
    icon: Icons.menu_book_outlined,
    selectedIcon: Icons.menu_book,
    label: 'Pédagogie',
    path: '/pedagogy',
  ),
  AdaptiveDestination(
    icon: Icons.person_outline,
    selectedIcon: Icons.person,
    label: 'Profil',
    path: '/profile',
  ),
];

const List<AdaptiveDestination> _teacherDestinations = [
  AdaptiveDestination(
    icon: Icons.dashboard_outlined,
    selectedIcon: Icons.dashboard,
    label: 'Accueil',
    path: '/dashboard',
  ),
  AdaptiveDestination(
    icon: Icons.school_outlined,
    selectedIcon: Icons.school,
    label: 'Mes élèves',
    path: '/students',
  ),
  AdaptiveDestination(
    icon: Icons.grade_outlined,
    selectedIcon: Icons.grade,
    label: 'Notes',
    path: '/grades',
  ),
  AdaptiveDestination(
    icon: Icons.calendar_today_outlined,
    selectedIcon: Icons.calendar_today,
    label: 'Emploi du temps',
    path: '/schedule',
  ),
  AdaptiveDestination(
    icon: Icons.menu_book_outlined,
    selectedIcon: Icons.menu_book,
    label: 'Pédagogie',
    path: '/pedagogy',
  ),
  AdaptiveDestination(
    icon: Icons.person_outline,
    selectedIcon: Icons.person,
    label: 'Profil',
    path: '/profile',
  ),
];

const List<AdaptiveDestination> _parentDestinations = [
  AdaptiveDestination(
    icon: Icons.dashboard_outlined,
    selectedIcon: Icons.dashboard,
    label: 'Accueil',
    path: '/dashboard',
  ),
  AdaptiveDestination(
    icon: Icons.child_care_outlined,
    selectedIcon: Icons.child_care,
    label: 'Mes enfants',
    path: '/children',
  ),
  AdaptiveDestination(
    icon: Icons.grade_outlined,
    selectedIcon: Icons.grade,
    label: 'Bulletins',
    path: '/grades',
  ),
  AdaptiveDestination(
    icon: Icons.attach_money_outlined,
    selectedIcon: Icons.attach_money,
    label: 'Paiements',
    path: '/payments',
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

List<AdaptiveDestination> _destinationsForPortal(dynamic portal) {
  if (portal.toString().toUpperCase() == 'TEACHER') return _teacherDestinations;
  if (portal.toString().toUpperCase() == 'PARENT') return _parentDestinations;
  return _adminDestinations;
}

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
        path: '/landing',
        name: 'landing',
        builder: (context, state) => const LandingPageScreen(),
      ),
      GoRoute(
        path: '/school-select',
        name: 'schoolSelect',
        builder: (context, state) => const SchoolSelectScreen(),
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
      // ⭐ P0-5: Destinations dynamiques selon le portail (admin/teacher/parent)
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) {
          // ⭐ Utiliser le provider dynamique au lieu de la constante hardcodée
          final destinations = ref.read(adaptiveDestinationsProvider);
          return AHAdaptiveScaffold(
            destinations: destinations,
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
              child: PilotageDashboardScreen(),
            ),
          ),
          GoRoute(
            path: '/teacher-dashboard',
            name: 'teacherDashboard',
            builder: (context, state) => const TeacherDashboardScreen(),
          ),
          GoRoute(
            path: '/parent-dashboard',
            name: 'parentDashboard',
            builder: (context, state) => const ParentDashboardScreen(),
          ),
          GoRoute(
            path: '/students',
            name: 'students',
            builder: (context, state) => const StudentsModuleScreen(),
          ),
          GoRoute(
            path: '/students/:id',
            name: 'studentDetail',
            builder: (context, state) {
              final studentId = state.pathParameters['id'] ?? '';
              return StudentsScreen(); // TODO: student detail view
            },
          ),

          // ⭐ P0-2: Route Mes Enfants (portail Parent)
          GoRoute(
            path: '/children',
            name: 'children',
            builder: (context, state) => const ChildrenScreen(),
          ),

          // ⭐ P0-1: Routes orphelines maintenant câblées
          // Grades (notes / bulletins)
          GoRoute(
            path: '/grades',
            name: 'grades',
            builder: (context, state) => const GradesListScreen(),
          ),
          GoRoute(
            path: '/grades/:id',
            name: 'gradeDetail',
            builder: (context, state) {
              final gradeId = state.pathParameters['id'] ?? '';
              return GradeDetailScreen(gradeId: gradeId);
            },
          ),

          // Payments (paiements / scolarité)
          GoRoute(
            path: '/payments',
            name: 'payments',
            builder: (context, state) => const PaymentsListScreen(),
          ),
          GoRoute(
            path: '/payments/:id',
            name: 'paymentDetail',
            builder: (context, state) {
              final paymentId = state.pathParameters['id'] ?? '';
              return PaymentDetailScreen(paymentId: paymentId);
            },
          ),

          // Messages (messagerie — plus de redirect, vraie route)
          GoRoute(
            path: '/messages',
            name: 'messages',
            builder: (context, state) => const MessagesListScreen(),
          ),
          GoRoute(
            path: '/messages/:id',
            name: 'messageDetail',
            builder: (context, state) {
              final messageId = state.pathParameters['id'] ?? '';
              return MessageDetailScreen(messageId: messageId);
            },
          ),

          // Absences (présences / absences)
          GoRoute(
            path: '/absences',
            name: 'absences',
            builder: (context, state) => const AbsencesListScreen(),
          ),

          // Schedule (emploi du temps)
          GoRoute(
            path: '/schedule',
            name: 'schedule',
            builder: (context, state) => const ScheduleScreen(),
          ),

          // ⭐ P1-6: Faire l'appel (enseignant)
          GoRoute(
            path: '/take-attendance/:classId',
            name: 'takeAttendance',
            builder: (context, state) {
              final classId = state.pathParameters['classId'] ?? '';
              return TakeAttendanceScreen(classId: classId);
            },
          ),

          // ⭐ P1-7: Saisir les notes (enseignant)
          GoRoute(
            path: '/grade-entry/:evaluationId',
            name: 'gradeEntry',
            builder: (context, state) {
              final evaluationId = state.pathParameters['evaluationId'] ?? '';
              return GradeEntryScreen(evaluationId: evaluationId);
            },
          ),

          // ⭐ P1-8: Bulletin (parent)
          GoRoute(
            path: '/bulletin',
            name: 'bulletin',
            builder: (context, state) => const BulletinScreen(),
          ),

          // ⭐ P1-9: Cahier de texte (parent)
          GoRoute(
            path: '/child-journal',
            name: 'childJournal',
            builder: (context, state) => const ChildJournalScreen(),
          ),

          // ⭐ P1-10: Initier paiement (parent)
          GoRoute(
            path: '/initiate-payment',
            name: 'initiatePayment',
            builder: (context, state) => const InitiatePaymentScreen(),
          ),

          // ⭐ Module Documents (parent)
          GoRoute(
            path: '/documents',
            name: 'documents',
            builder: (context, state) => const DocumentsScreen(),
          ),

          GoRoute(
            path: '/finance',
            name: 'finance',
            builder: (context, state) => const FinanceModuleScreen(),
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
          // Legacy routes
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
