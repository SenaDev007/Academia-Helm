import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/providers/auth_provider.dart';

// ── Models ────────────────────────────────────────────────────────────

/// A single KPI/stat for the dashboard.
class DashboardStat {
  final String label;
  final String value;
  final IconData icon;
  final String? trend; // 'up' | 'down' | null
  final String? trendValue; // e.g. "+12%"
  final Color color;

  const DashboardStat({
    required this.label,
    required this.value,
    required this.icon,
    this.trend,
    this.trendValue,
    required this.color,
  });
}

/// Quick action button data.
class QuickAction {
  final String label;
  final IconData icon;
  final String route;

  const QuickAction({
    required this.label,
    required this.icon,
    required this.route,
  });
}

// ── Dashboard Provider ────────────────────────────────────────────────

/// Provider for dashboard stats based on user role.
final dashboardStatsProvider = Provider<List<DashboardStat>>((ref) {
  final role = ref.watch(currentUserRoleProvider);

  switch (role) {
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return _adminStats;
    case 'TEACHER':
      return _teacherStats;
    case 'PARENT':
      return _parentStats;
    case 'STUDENT':
      return _studentStats;
    default:
      return _adminStats;
  }
});

/// Provider for quick actions based on user role.
final dashboardQuickActionsProvider = Provider<List<QuickAction>>((ref) {
  final role = ref.watch(currentUserRoleProvider);

  switch (role) {
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return _adminActions;
    case 'TEACHER':
      return _teacherActions;
    case 'PARENT':
      return _parentActions;
    case 'STUDENT':
      return _studentActions;
    default:
      return _adminActions;
  }
});

// ── Mock Data ─────────────────────────────────────────────────────────

const _adminStats = [
  DashboardStat(
    label: 'Élèves inscrits',
    value: '1 247',
    icon: Icons.school,
    trend: 'up',
    trendValue: '+8%',
    color: Color(0xFF0B2F73),
  ),
  DashboardStat(
    label: 'Enseignants',
    value: '63',
    icon: Icons.person,
    trend: 'up',
    trendValue: '+2',
    color: Color(0xFFF5B335),
  ),
  DashboardStat(
    label: 'Paiements en attente',
    value: '34',
    icon: Icons.payment,
    trend: 'down',
    trendValue: '-12%',
    color: Color(0xFFEF4444),
  ),
  DashboardStat(
    label: 'Taux de présence',
    value: '92%',
    icon: Icons.check_circle,
    trend: 'up',
    trendValue: '+3%',
    color: Color(0xFF10B981),
  ),
];

const _teacherStats = [
  DashboardStat(
    label: 'Mes classes',
    value: '5',
    icon: Icons.class_,
    color: Color(0xFF0B2F73),
  ),
  DashboardStat(
    label: 'Élèves',
    value: '182',
    icon: Icons.school,
    color: Color(0xFFF5B335),
  ),
  DashboardStat(
    label: 'Évaluations',
    value: '12',
    icon: Icons.assignment,
    color: Color(0xFF3B82F6),
  ),
  DashboardStat(
    label: 'Prochains cours',
    value: '3',
    icon: Icons.schedule,
    color: Color(0xFF10B981),
  ),
];

const _parentStats = [
  DashboardStat(
    label: 'Enfants',
    value: '2',
    icon: Icons.child_care,
    color: Color(0xFF0B2F73),
  ),
  DashboardStat(
    label: 'Moyenne générale',
    value: '14.5',
    icon: Icons.grade,
    trend: 'up',
    trendValue: '+1.2',
    color: Color(0xFFF5B335),
  ),
  DashboardStat(
    label: 'Absences ce mois',
    value: '1',
    icon: Icons.event_busy,
    color: Color(0xFFEF4444),
  ),
  DashboardStat(
    label: 'Paiements en attente',
    value: '1',
    icon: Icons.payment,
    color: Color(0xFF3B82F6),
  ),
];

const _studentStats = [
  DashboardStat(
    label: 'Moyenne générale',
    value: '14.5',
    icon: Icons.grade,
    trend: 'up',
    trendValue: '+1.2',
    color: Color(0xFF0B2F73),
  ),
  DashboardStat(
    label: 'Prochains devoirs',
    value: '3',
    icon: Icons.assignment,
    color: Color(0xFFF5B335),
  ),
  DashboardStat(
    label: 'Absences',
    value: '2',
    icon: Icons.event_busy,
    color: Color(0xFFEF4444),
  ),
  DashboardStat(
    label: "Cours aujourd'hui",
    value: '5',
    icon: Icons.schedule,
    color: Color(0xFF10B981),
  ),
];

const _adminActions = [
  QuickAction(label: 'Élèves', icon: Icons.school, route: '/students'),
  QuickAction(label: 'Notes', icon: Icons.grade, route: '/students'),
  QuickAction(label: 'Paiements', icon: Icons.payment, route: '/students'),
  QuickAction(label: 'Messages', icon: Icons.message, route: '/messages'),
];

const _teacherActions = [
  QuickAction(label: 'Mes classes', icon: Icons.class_, route: '/students'),
  QuickAction(label: 'Notes', icon: Icons.grade, route: '/students'),
  QuickAction(label: 'Présence', icon: Icons.check_circle, route: '/students'),
  QuickAction(label: 'Messages', icon: Icons.message, route: '/messages'),
];

const _parentActions = [
  QuickAction(label: 'Notes', icon: Icons.grade, route: '/students'),
  QuickAction(label: 'Paiements', icon: Icons.payment, route: '/students'),
  QuickAction(label: 'Absences', icon: Icons.event_busy, route: '/students'),
  QuickAction(label: 'Messages', icon: Icons.message, route: '/messages'),
];

const _studentActions = [
  QuickAction(label: 'Mes notes', icon: Icons.grade, route: '/students'),
  QuickAction(label: 'Emploi du temps', icon: Icons.schedule, route: '/students'),
  QuickAction(label: 'Absences', icon: Icons.event_busy, route: '/students'),
  QuickAction(label: 'Messages', icon: Icons.message, route: '/messages'),
];
