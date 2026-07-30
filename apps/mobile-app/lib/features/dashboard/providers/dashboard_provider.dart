/// ============================================================================
/// DASHBOARD PROVIDER — Academia Helm Mobile
/// ============================================================================
///
/// ⭐ P0-4: Remplacement des MOCK data par des appels API réels.
///
/// Stratégie :
///   - FutureProvider qui appelle l'API selon le rôle de l'utilisateur
///   - Admin → /api/dashboard/admin (effectifs, finances, présences)
///   - Enseignant → /api/dashboard/teacher (classes, élèves, évaluations)
///   - Parent → /api/profile/children (compte enfants + moyennes + absences)
///   - Si l'API échoue → fallback sur des données par défaut (vides)
///
/// ============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_result.dart';

// ── Models ────────────────────────────────────────────────────────────

class DashboardStat {
  final String label;
  final String value;
  final IconData icon;
  final String? trend;
  final String? trendValue;
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

// ── Dashboard Stats Provider (API réelle) ─────────────────────────────

/// Provider qui récupère les statistiques du dashboard depuis l'API.
/// Adapte l'endpoint selon le rôle de l'utilisateur.
final dashboardStatsProvider =
    FutureProvider<List<DashboardStat>>((ref) async {
  final role = ref.watch(currentUserRoleProvider);
  final apiClient = ref.watch(apiClientProvider);

  // Choisir l'endpoint selon le rôle
  String endpoint;
  switch (role?.toUpperCase()) {
    case 'TEACHER':
    case 'ENSEIGNANT':
      endpoint = '/api/dashboard/teacher';
      break;
    case 'PARENT':
    case 'PARENT_PRIMARY':
    case 'LEGAL_GUARDIAN':
    case 'GUARDIAN':
      endpoint = '/api/profile/children';
      break;
    default:
      endpoint = '/api/dashboard/admin';
  }

  final result = await apiClient.getRaw(endpoint);

  return result.when(
    success: (data) {
      // Parser les données selon le rôle
      switch (role?.toUpperCase()) {
        case 'TEACHER':
        case 'ENSEIGNANT':
          return _parseTeacherStats(data);
        case 'PARENT':
        case 'PARENT_PRIMARY':
        case 'LEGAL_GUARDIAN':
        case 'GUARDIAN':
          return _parseParentStats(data);
        default:
          return _parseAdminStats(data);
      }
    },
    failure: (error) {
      // Fallback silencieux sur données par défaut
      return _defaultStats(role);
    },
    loading: () => _defaultStats(role),
  );
});

// ── Parsers ───────────────────────────────────────────────────────────

List<DashboardStat> _parseAdminStats(Map<String, dynamic> data) {
  final stats = <DashboardStat>[];
  final studentsCount = data['studentsCount'] ?? data['totalStudents'] ?? 0;
  final teachersCount = data['teachersCount'] ?? data['totalTeachers'] ?? 0;
  final pendingPayments = data['pendingPayments'] ?? 0;
  final attendanceRate = data['attendanceRate'] ?? 0;

  stats.add(DashboardStat(
    label: 'Élèves inscrits',
    value: _formatNumber(studentsCount),
    icon: Icons.school,
    color: const Color(0xFF0B2F73),
  ));
  stats.add(DashboardStat(
    label: 'Enseignants',
    value: _formatNumber(teachersCount),
    icon: Icons.person,
    color: const Color(0xFFF5B335),
  ));
  stats.add(DashboardStat(
    label: 'Paiements en attente',
    value: _formatNumber(pendingPayments),
    icon: Icons.payment,
    color: const Color(0xFFEF4444),
  ));
  stats.add(DashboardStat(
    label: 'Taux de présence',
    value: '${attendanceRate}%',
    icon: Icons.check_circle,
    color: const Color(0xFF10B981),
  ));

  return stats;
}

List<DashboardStat> _parseTeacherStats(Map<String, dynamic> data) {
  final stats = <DashboardStat>[];
  final classesCount = data['classesCount'] ?? data['totalClasses'] ?? 0;
  final studentsCount = data['studentsCount'] ?? data['totalStudents'] ?? 0;
  final evaluationsCount = data['evaluationsCount'] ?? 0;
  final upcomingClasses = data['upcomingClasses'] ?? 0;

  stats.add(DashboardStat(
    label: 'Mes classes',
    value: _formatNumber(classesCount),
    icon: Icons.class_,
    color: const Color(0xFF0B2F73),
  ));
  stats.add(DashboardStat(
    label: 'Élèves',
    value: _formatNumber(studentsCount),
    icon: Icons.school,
    color: const Color(0xFFF5B335),
  ));
  stats.add(DashboardStat(
    label: 'Évaluations',
    value: _formatNumber(evaluationsCount),
    icon: Icons.assignment,
    color: const Color(0xFF3B82F6),
  ));
  stats.add(DashboardStat(
    label: 'Prochains cours',
    value: _formatNumber(upcomingClasses),
    icon: Icons.schedule,
    color: const Color(0xFF10B981),
  ));

  return stats;
}

List<DashboardStat> _parseParentStats(Map<String, dynamic> data) {
  final stats = <DashboardStat>[];

  // data peut être une liste d'enfants ou un objet avec stats
  final children = data['data'] ?? data['children'] ?? data;
  int childrenCount = 0;
  if (children is List) {
    childrenCount = children.length;
  } else if (children is Map) {
    childrenCount = (children['count'] ?? 0) as int;
  }

  stats.add(DashboardStat(
    label: 'Enfants',
    value: _formatNumber(childrenCount),
    icon: Icons.child_care,
    color: const Color(0xFF0B2F73),
  ));
  stats.add(DashboardStat(
    label: 'Moyenne générale',
    value: data['overallAverage']?.toString() ?? '—',
    icon: Icons.grade,
    color: const Color(0xFFF5B335),
  ));
  stats.add(DashboardStat(
    label: 'Absences ce mois',
    value: _formatNumber(data['absencesThisMonth'] ?? 0),
    icon: Icons.event_busy,
    color: const Color(0xFFEF4444),
  ));
  stats.add(DashboardStat(
    label: 'Paiements en attente',
    value: _formatNumber(data['pendingPayments'] ?? 0),
    icon: Icons.payment,
    color: const Color(0xFF3B82F6),
  ));

  return stats;
}

// ── Données par défaut (fallback si API indisponible) ──

List<DashboardStat> _defaultStats(String? role) {
  switch (role?.toUpperCase()) {
    case 'TEACHER':
    case 'ENSEIGNANT':
      return const [
        DashboardStat(label: 'Mes classes', value: '—', icon: Icons.class_, color: Color(0xFF0B2F73)),
        DashboardStat(label: 'Élèves', value: '—', icon: Icons.school, color: Color(0xFFF5B335)),
        DashboardStat(label: 'Évaluations', value: '—', icon: Icons.assignment, color: Color(0xFF3B82F6)),
        DashboardStat(label: 'Prochains cours', value: '—', icon: Icons.schedule, color: Color(0xFF10B981)),
      ];
    case 'PARENT':
    case 'PARENT_PRIMARY':
    case 'LEGAL_GUARDIAN':
    case 'GUARDIAN':
      return const [
        DashboardStat(label: 'Enfants', value: '—', icon: Icons.child_care, color: Color(0xFF0B2F73)),
        DashboardStat(label: 'Moyenne générale', value: '—', icon: Icons.grade, color: Color(0xFFF5B335)),
        DashboardStat(label: 'Absences ce mois', value: '—', icon: Icons.event_busy, color: Color(0xFFEF4444)),
        DashboardStat(label: 'Paiements en attente', value: '—', icon: Icons.payment, color: Color(0xFF3B82F6)),
      ];
    default:
      return const [
        DashboardStat(label: 'Élèves inscrits', value: '—', icon: Icons.school, color: Color(0xFF0B2F73)),
        DashboardStat(label: 'Enseignants', value: '—', icon: Icons.person, color: Color(0xFFF5B335)),
        DashboardStat(label: 'Paiements en attente', value: '—', icon: Icons.payment, color: Color(0xFFEF4444)),
        DashboardStat(label: 'Taux de présence', value: '—', icon: Icons.check_circle, color: Color(0xFF10B981)),
      ];
  }
}

// ── Quick Actions (statiques, routes déjà corrigées) ──

final dashboardQuickActionsProvider = Provider<List<QuickAction>>((ref) {
  final role = ref.watch(currentUserRoleProvider);

  switch (role?.toUpperCase()) {
    case 'TEACHER':
    case 'ENSEIGNANT':
      return _teacherActions;
    case 'PARENT':
    case 'PARENT_PRIMARY':
    case 'LEGAL_GUARDIAN':
    case 'GUARDIAN':
      return _parentActions;
    case 'STUDENT':
      return _studentActions;
    default:
      return _adminActions;
  }
});

const _adminActions = [
  QuickAction(label: 'Élèves', icon: Icons.school, route: '/students'),
  QuickAction(label: 'Notes', icon: Icons.grade, route: '/grades'),
  QuickAction(label: 'Finances', icon: Icons.payment, route: '/finance'),
  QuickAction(label: 'Messages', icon: Icons.message, route: '/messages'),
];

const _teacherActions = [
  QuickAction(label: 'Mes élèves', icon: Icons.school, route: '/students'),
  QuickAction(label: 'Notes', icon: Icons.grade, route: '/grades'),
  QuickAction(label: 'Faire l\'appel', icon: Icons.check_circle, route: '/absences'),
  QuickAction(label: 'Emploi du temps', icon: Icons.schedule, route: '/schedule'),
];

const _parentActions = [
  QuickAction(label: 'Mes enfants', icon: Icons.child_care, route: '/children'),
  QuickAction(label: 'Bulletins', icon: Icons.grade, route: '/grades'),
  QuickAction(label: 'Paiements', icon: Icons.payment, route: '/payments'),
  QuickAction(label: 'Absences', icon: Icons.event_busy, route: '/absences'),
];

const _studentActions = [
  QuickAction(label: 'Mes notes', icon: Icons.grade, route: '/grades'),
  QuickAction(label: 'Emploi du temps', icon: Icons.schedule, route: '/schedule'),
  QuickAction(label: 'Absences', icon: Icons.event_busy, route: '/absences'),
  QuickAction(label: 'Messages', icon: Icons.message, route: '/messages'),
];

// ── Utilitaires ──

String _formatNumber(dynamic value) {
  if (value is int) return value.toString();
  if (value is double) return value.toStringAsFixed(0);
  if (value is String) return value;
  return '0';
}
