import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/module_data_list.dart';
import '../../../core/widgets/sub_tab_content.dart';
import '../../../core/widgets/loading/module_loading_wrapper.dart';
import '../providers/students_provider.dart';
import '../../orion/providers/orion_provider.dart';
import '../../orion/widgets/orion_alert_banner.dart';
import '../../orion/widgets/orion_kpi_card.dart';
import '../../orion/widgets/orion_insight_section.dart';

class StudentsScreen extends ConsumerWidget {
  const StudentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = allModules.firstWhere((m) => m.id == 'students');
    final subTabs = module.subTabs;
    final alertsAsync = ref.watch(orionAlertsProvider);
    return Column(
      children: [
        OrionAlertBanner(alertsAsync: alertsAsync),
        Expanded(
          child: StatefulModulePage(
            module: module,
            visibleSubTabs: subTabs,
            initialSubTabId: subTabs.first.id,
            subTabBuilder: (subTab) {
              switch (subTab.id) {
          case 'students-dashboard':
            return _DashboardContent();
          case 'students-list':
            return _ListContent();
          case 'students-enrollments':
            return _EnrollmentsContent();
          case 'students-attendance':
            return _AttendanceContent();
          case 'students-grades':
            return _GradesContent();
          case 'students-discipline':
            return _DisciplineContent();
          case 'students-health':
            return _HealthContent();
          case 'students-transports':
            return _TransportsContent();
          case 'students-canteen':
            return _CanteenContent();
          case 'students-documents':
            return _DocumentsContent();
          case 'students-communications':
            return _CommunicationsContent();
          case 'students-scholarships':
            return _ScholarshipsContent();
          case 'students-activities':
            return _ActivitiesContent();
          case 'students-alumni':
            return _AlumniContent();
          case 'students-reports':
            return _ReportsContent();
          case 'students-archive':
            return _ArchiveContent();
          case 'students-orion':
            return const _OrionContent();
          default:
            return PlaceholderContent(title: subTab.label);
        }
      },
          ),
        ),
      ],
    );
  }
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

class _DashboardContent extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDashboardView(
      dashboardAsync: ref.watch(studentsOrionKpisProvider('current')),
      moduleName: 'Élèves',
      onRetry: () => ref.invalidate(studentsOrionKpisProvider('current')),
      statCards: const [
        StatCardConfig(title: 'Élèves inscrits', valueKey: 'total_students', defaultValue: '—', icon: Icons.school, subtitle: 'Cette année'),
        StatCardConfig(title: 'Nouveaux', valueKey: 'new_enrollments', defaultValue: '—', icon: Icons.person_add, iconColor: AHColors.success),
        StatCardConfig(title: 'Taux présence', valueKey: 'attendance_rate', defaultValue: '—', icon: Icons.event_available, iconColor: AHColors.info),
        StatCardConfig(title: 'Moyenne générale', valueKey: 'average_grade', defaultValue: '—', icon: Icons.grade, iconColor: AHColors.gold),
      ],
    );
  }
}

// ─── List ────────────────────────────────────────────────────────────────────

class _ListContent extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(studentsProvider),
      moduleName: 'Élèves',
      emptyTitle: 'Aucun élève trouvé',
      emptySubtitle: 'Appuyez sur + pour ajouter un élève',
      onRetry: () => ref.invalidate(studentsProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context,
            title: 'Nouvel élève',
            fields: const [
              AddFieldConfig(key: 'first_name', label: 'Prénom', hint: 'Prénom de l\'élève'),
              AddFieldConfig(key: 'last_name', label: 'Nom', hint: 'Nom de l\'élève'),
              AddFieldConfig(key: 'class', label: 'Classe', hint: 'ex: 3ème B'),
            ]);
        if (data != null) {
          ref.read(studentMutationProvider.notifier).createStudent(data);
        }
      },
      addLabel: 'Ajouter un élève',
      itemBuilder: (item) => ListItemCard(
        title: '${item['first_name'] ?? ''} ${item['last_name'] ?? ''}'.trim(),
        subtitle: item['class'] ?? item['classe'] ?? '',
        leadingIcon: Icons.person,
        badge: StatusBadge(
          label: item['status'] ?? 'Actif',
          type: (item['status'] ?? '') == 'Inactif'
              ? StatusBadgeType.neutral
              : StatusBadgeType.success,
        ),
      ),
    );
  }
}

// ─── Enrollments ─────────────────────────────────────────────────────────────

class _EnrollmentsContent extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(studentEnrollmentsProvider),
      moduleName: 'Inscriptions',
      emptyTitle: 'Aucune inscription trouvée',
      emptySubtitle: 'Appuyez sur + pour enregistrer une inscription',
      onRetry: () => ref.invalidate(studentEnrollmentsProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context,
            title: 'Nouvelle inscription',
            fields: const [
              AddFieldConfig(key: 'student_name', label: 'Nom de l\'élève'),
              AddFieldConfig(key: 'class', label: 'Classe demandée'),
              AddFieldConfig(key: 'date', label: 'Date de demande'),
            ]);
        if (data != null) {
          ref.read(studentMutationProvider.notifier).createStudent(data);
        }
      },
      itemBuilder: (item) => ListItemCard(
        title: item['student_name'] ?? item['name'] ?? '',
        subtitle: 'Demande: ${item['class'] ?? ''} - ${item['date'] ?? ''}',
        leadingIcon: Icons.person_add,
        badge: StatusBadge(
          label: item['status'] ?? 'En attente',
          type: _statusType(item['status']),
        ),
      ),
    );
  }
}

// ─── Attendance ──────────────────────────────────────────────────────────────

class _AttendanceContent extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDashboardView(
      dashboardAsync: ref.watch(studentsStatisticsProvider(
        const StudentStatsArgs(academicYearId: 'current', schoolLevelId: 'all'),
      )),
      moduleName: 'Présence',
      onRetry: () => ref.invalidate(studentsStatisticsProvider(
        const StudentStatsArgs(academicYearId: 'current', schoolLevelId: 'all'),
      )),
      statCards: const [
        StatCardConfig(title: 'Taux présence', valueKey: 'attendance_rate', defaultValue: '—', icon: Icons.check_circle, iconColor: AHColors.success),
        StatCardConfig(title: 'Absences aujourd\'hui', valueKey: 'absences_today', defaultValue: '—', icon: Icons.person_off, iconColor: AHColors.error),
        StatCardConfig(title: 'Retards', valueKey: 'late_count', defaultValue: '—', icon: Icons.schedule, iconColor: AHColors.warning),
        StatCardConfig(title: 'Justifiées', valueKey: 'justified_count', defaultValue: '—', icon: Icons.verified, iconColor: AHColors.info),
      ],
    );
  }
}

// ─── Grades, Discipline, Health, etc. (list-based sub-tabs) ─────────────────

class _GradesContent extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final itemsAsync = ref.watch(studentsProvider);
    return ModuleDataList(
      itemsAsync: itemsAsync,
      moduleName: 'Notes',
      emptyTitle: 'Aucune note disponible',
      emptySubtitle: 'Les notes seront affichées ici',
      onRetry: () => ref.invalidate(studentsProvider),
      itemBuilder: (item) => ListItemCard(
        title: '${item['first_name'] ?? ''} ${item['last_name'] ?? ''}'.trim(),
        subtitle: 'Moyenne: ${item['average'] ?? '—'}',
        leadingIcon: Icons.assessment,
      ),
    );
  }
}

class _DisciplineContent extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final itemsAsync = ref.watch(studentsProvider);
    return ModuleDataList(
      itemsAsync: itemsAsync,
      moduleName: 'Discipline',
      emptyTitle: 'Aucun incident disciplinaire',
      emptySubtitle: 'Aucun signalement en cours',
      onRetry: () => ref.invalidate(studentsProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context,
            title: 'Signalement discipline',
            fields: const [
              AddFieldConfig(key: 'student_name', label: 'Élève'),
              AddFieldConfig(key: 'type', label: 'Type (avertissement, blâme...)'),
              AddFieldConfig(key: 'reason', label: 'Motif'),
            ]);
        if (data != null) {
          ref.read(studentMutationProvider.notifier).createStudent(data);
        }
      },
      itemBuilder: (item) => ListItemCard(
        title: '${item['first_name'] ?? ''} ${item['last_name'] ?? ''}'.trim(),
        subtitle: item['discipline_note'] ?? '',
        leadingIcon: Icons.warning,
        leadingIconColor: AHColors.warning,
      ),
    );
  }
}

class _HealthContent extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [
      SectionHeader(title: 'Santé'),
    ]);
  }
}

class _TransportsContent extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [
      SectionHeader(title: 'Transports'),
    ]);
  }
}

class _CanteenContent extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [
      SectionHeader(title: 'Cantine'),
    ]);
  }
}

class _DocumentsContent extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [
      SectionHeader(title: 'Documents'),
    ]);
  }
}

class _CommunicationsContent extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [
      SectionHeader(title: 'Communications'),
    ]);
  }
}

class _ScholarshipsContent extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [
      SectionHeader(title: 'Bourses'),
    ]);
  }
}

class _ActivitiesContent extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [
      SectionHeader(title: 'Activités'),
    ]);
  }
}

class _AlumniContent extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [
      SectionHeader(title: 'Anciens élèves'),
    ]);
  }
}

class _ReportsContent extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [
      SectionHeader(title: 'Rapports'),
    ]);
  }
}

class _ArchiveContent extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [
      SectionHeader(title: 'Archive'),
    ]);
  }
}

// ─── Orion ──────────────────────────────────────────────────────────────────

class _OrionContent extends ConsumerWidget {
  const _OrionContent();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final kpisAsync = ref.watch(orionKpisProvider);
    final insightsAsync = ref.watch(orionInsightsProvider);
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'ORION — Élèves'),
      const SizedBox(height: AHSpacing.sm),
      // KPI Cards
      kpisAsync.when(
        data: (kpis) => Wrap(
          spacing: AHSpacing.sm,
          runSpacing: AHSpacing.sm,
          children: kpis.take(4).map((kpi) => SizedBox(
            width: (MediaQuery.of(context).size.width - AHSpacing.xl * 2 - AHSpacing.sm * 3) / 4,
            child: OrionKpiCard(
              label: kpi['label'] ?? kpi['title'] ?? 'KPI',
              value: kpi['value']?.toString() ?? '—',
              trend: kpi['trend'] as String?,
              trendValue: kpi['trendValue'] as String?,
              icon: Icons.analytics,
            ),
          )).toList(),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const SizedBox.shrink(),
      ),
      const SizedBox(height: AHSpacing.lg),
      // Insights Section
      OrionInsightSection(insightsAsync: insightsAsync, moduleName: 'Élèves'),
      const SizedBox(height: AHSpacing.lg),
      // Alert List
      const SectionHeader(title: 'Alertes actives'),
      ModuleLoadingWrapper<List<Map<String, dynamic>>>(
        value: ref.watch(orionAlertsProvider),
        moduleName: 'Alertes',
        onRetry: () => ref.invalidate(orionAlertsProvider),
        builder: (alerts) {
          if (alerts.isEmpty) return const Padding(
            padding: EdgeInsets.all(AHSpacing.lg),
            child: Text('Aucune alerte active', style: TextStyle(color: AHColors.gray500)),
          );
          return Column(children: alerts.take(5).map((a) => ListItemCard(
            title: a['title'] ?? 'Alerte',
            subtitle: a['description'] ?? '',
            leadingIcon: Icons.warning_amber,
            leadingIconColor: AHColors.warning,
          )).toList());
        },
      ),
    ]);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

StatusBadgeType _statusType(dynamic status) {
  if (status == null) return StatusBadgeType.info;
  final s = status.toString().toLowerCase();
  if (s.contains('valid') || s.contains('actif') || s.contains('payé') || s.contains('terminé')) {
    return StatusBadgeType.success;
  }
  if (s.contains('attente') || s.contains('warning') || s.contains('retard')) {
    return StatusBadgeType.warning;
  }
  if (s.contains('error') || s.contains('incomplet') || s.contains('rejeté')) {
    return StatusBadgeType.error;
  }
  if (s.contains('inactif') || s.contains('archivé')) {
    return StatusBadgeType.neutral;
  }
  return StatusBadgeType.info;
}
