import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';

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

// ── Dashboard Stats Provider ───────────────────────────────────────────

/// Fetches dashboard stats from the real API.
/// Uses /general/consolidated-report for admin/school portal.
/// Uses /finance/reports/kpi for financial KPIs.
final dashboardStatsProvider =
    FutureProvider<List<DashboardStat>>((ref) async {
  final role = ref.watch(currentUserRoleProvider);
  final apiClient = ref.watch(apiClientProvider);

  switch (role?.toUpperCase()) {
    case 'TEACHER':
    case 'ENSEIGNANT':
      return _fetchTeacherStats(apiClient);
    case 'PARENT':
    case 'PARENT_PRIMARY':
    case 'LEGAL_GUARDIAN':
    case 'GUARDIAN':
      return _fetchParentStats(apiClient);
    default:
      return _fetchAdminStats(apiClient);
  }
});

Future<List<DashboardStat>> _fetchAdminStats(ApiClient apiClient) async {
  final stats = <DashboardStat>[];

  // Fetch consolidated report (same as web's PilotageDashboardV2)
  final reportResult = await apiClient.getRaw('/general/consolidated-report');

  reportResult.when(
    success: (data) {
      final enrollment = data['enrollment'] ?? {};
      final attendance = data['attendance'] ?? {};
      final revenue = data['revenue'] ?? {};
      final alerts = data['alerts'] ?? {};
      final weightedAvg = data['weightedAverage'] ?? {};

      stats.add(DashboardStat(
        label: 'Effectifs',
        value: _fmt(enrollment['total']),
        icon: Icons.school,
        color: const Color(0xFF0B2F73),
      ));
      stats.add(DashboardStat(
        label: 'Taux présence',
        value: '${_fmt(attendance['rate'])}%',
        icon: Icons.check_circle,
        color: const Color(0xFF10B981),
      ));
      stats.add(DashboardStat(
        label: 'Recettes',
        value: '${_fmt(revenue['total'])} FCFA',
        icon: Icons.payments,
        color: const Color(0xFFF5B335),
      ));
      stats.add(DashboardStat(
        label: 'Moyenne générale',
        value: _fmt(weightedAvg['value']),
        icon: Icons.assessment,
        color: const Color(0xFF3B82F6),
      ));
    },
    failure: (_) {
      stats.addAll(_defaultAdminStats());
    },
    loading: () {},
  );

  // Also fetch finance KPIs for the dashboard
  final kpiResult = await apiClient.getRaw(ApiConfig.financeKpiReports);
  kpiResult.when(
    success: (data) {
      // Replace revenue stat with more accurate data if available
      final totalEncaissement = data['totalEncaissement'];
      if (totalEncaissement != null && stats.length >= 3) {
        stats[2] = DashboardStat(
          label: 'Encaissé',
          value: '${_fmt(totalEncaissement)} FCFA',
          icon: Icons.payments,
          color: const Color(0xFF10B981),
        );
      }
    },
    failure: (_) {},
    loading: () {},
  );

  if (stats.isEmpty) return _defaultAdminStats();
  return stats;
}

Future<List<DashboardStat>> _fetchTeacherStats(ApiClient apiClient) async {
  final stats = <DashboardStat>[];

  // Fetch my-classes for teacher stats
  final result = await apiClient.getRaw(ApiConfig.pedagogySpaceMyClasses);

  result.when(
    success: (data) {
      final list = data['data'] ?? data['classes'] ?? data;
      int classCount = 0;
      int totalStudents = 0;
      int totalBoys = 0;
      int totalGirls = 0;

      if (list is List) {
        classCount = list.length;
        for (final item in list) {
          if (item is Map<String, dynamic>) {
            totalStudents += _toInt(item['totalStudents'] ?? item['students']);
            totalBoys += _toInt(item['boys']);
            totalGirls += _toInt(item['girls']);
          }
        }
      }

      stats.add(DashboardStat(
        label: 'Mes Classes',
        value: classCount.toString(),
        icon: Icons.class_,
        color: const Color(0xFF0B2F73),
      ));
      stats.add(DashboardStat(
        label: 'Garçons',
        value: totalBoys.toString(),
        icon: Icons.male,
        color: const Color(0xFF0891B2),
      ));
      stats.add(DashboardStat(
        label: 'Filles',
        value: totalGirls.toString(),
        icon: Icons.female,
        color: const Color(0xFFDB2777),
      ));
      stats.add(DashboardStat(
        label: 'Total élèves',
        value: totalStudents.toString(),
        icon: Icons.people,
        color: const Color(0xFF059669),
      ));
    },
    failure: (_) {
      stats.addAll(_defaultTeacherStats());
    },
    loading: () {},
  );

  if (stats.isEmpty) return _defaultTeacherStats();
  return stats;
}

Future<List<DashboardStat>> _fetchParentStats(ApiClient apiClient) async {
  final stats = <DashboardStat>[];

  final result = await apiClient.getRaw(ApiConfig.parentChildren);

  result.when(
    success: (data) {
      final list = data['data'] ?? data['children'] ?? data;
      int childrenCount = 0;
      if (list is List) childrenCount = list.length;

      stats.add(DashboardStat(
        label: 'Mes Enfants',
        value: childrenCount.toString(),
        icon: Icons.child_care,
        color: const Color(0xFF0B2F73),
      ));
    },
    failure: (_) {
      stats.add(DashboardStat(
        label: 'Mes Enfants',
        value: '0',
        icon: Icons.child_care,
        color: const Color(0xFF0B2F73),
      ));
    },
    loading: () {},
  );

  // Add placeholder stats for parent
  stats.add(DashboardStat(
    label: 'Moyenne générale',
    value: '—',
    icon: Icons.grade,
    color: const Color(0xFFF5B335),
  ));
  stats.add(DashboardStat(
    label: 'Absences',
    value: '—',
    icon: Icons.event_busy,
    color: const Color(0xFFEF4444),
  ));
  stats.add(DashboardStat(
    label: 'Paiements',
    value: '—',
    icon: Icons.payment,
    color: const Color(0xFF3B82F6),
  ));

  return stats;
}

// ── Defaults ──────────────────────────────────────────────────────────

List<DashboardStat> _defaultAdminStats() => const [
  DashboardStat(label: 'Effectifs', value: '0', icon: Icons.school, color: Color(0xFF0B2F73)),
  DashboardStat(label: 'Taux présence', value: '0%', icon: Icons.check_circle, color: Color(0xFF10B981)),
  DashboardStat(label: 'Recettes', value: '0 FCFA', icon: Icons.payments, color: Color(0xFFF5B335)),
  DashboardStat(label: 'Moyenne générale', value: '0', icon: Icons.assessment, color: Color(0xFF3B82F6)),
];

List<DashboardStat> _defaultTeacherStats() => const [
  DashboardStat(label: 'Mes Classes', value: '0', icon: Icons.class_, color: Color(0xFF0B2F73)),
  DashboardStat(label: 'Garçons', value: '0', icon: Icons.male, color: Color(0xFF0891B2)),
  DashboardStat(label: 'Filles', value: '0', icon: Icons.female, color: Color(0xFFDB2777)),
  DashboardStat(label: 'Total élèves', value: '0', icon: Icons.people, color: Color(0xFF059669)),
];

// ── Quick Actions ─────────────────────────────────────────────────────

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
  QuickAction(label: 'Finances', icon: Icons.payment, route: '/finance'),
  QuickAction(label: 'RH', icon: Icons.people, route: '/hr'),
  QuickAction(label: 'Pédagogie', icon: Icons.menu_book, route: '/pedagogy'),
];

const _teacherActions = [
  QuickAction(label: 'Mes élèves', icon: Icons.school, route: '/students'),
  QuickAction(label: 'Notes', icon: Icons.grade, route: '/grades'),
  QuickAction(label: 'Appel', icon: Icons.check_circle, route: '/absences'),
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

// ── Helpers ───────────────────────────────────────────────────────────

String _fmt(dynamic value) {
  if (value == null) return '0';
  if (value is int) return value.toString();
  if (value is double) return value.toStringAsFixed(0);
  if (value is String) return value;
  return '0';
}

int _toInt(dynamic value) {
  if (value == null) return 0;
  if (value is int) return value;
  if (value is String) return int.tryParse(value) ?? 0;
  if (value is double) return value.toInt();
  return 0;
}
