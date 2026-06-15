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
import '../providers/pedagogy_provider.dart';
import '../../orion/providers/orion_provider.dart';
import '../../orion/widgets/orion_alert_banner.dart';
import '../../orion/widgets/orion_kpi_card.dart';
import '../../orion/widgets/orion_insight_section.dart';

// Alias for convenience — the provider is named pedagogyKpiDashboardProvider
final _pedagogyKpisProvider = pedagogyKpiDashboardProvider;

class PedagogyScreen extends ConsumerWidget {
  const PedagogyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = allModules.firstWhere((m) => m.id == 'pedagogy');
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
          case 'pedagogy-dashboard': return const _DashboardContent();
          case 'pedagogy-planning': return const _PlanningContent();
          case 'pedagogy-lessons': return const _LessonsContent();
          case 'pedagogy-homework': return const _HomeworkContent();
          case 'pedagogy-resources': return const _ResourcesContent();
          case 'pedagogy-evaluations': return const _EvaluationsContent();
          case 'pedagogy-competencies': return const _CompetenciesContent();
          case 'pedagogy-projects': return const _ProjectsContent();
          case 'pedagogy-differentiation': return const _DifferentiationContent();
          case 'pedagogy-progress': return const _ProgressContent();
          case 'pedagogy-reports': return const _ReportsContent();
          case 'pedagogy-archive': return const _ArchiveContent();
          case 'pedagogy-orion': return const _OrionContent();
          default: return PlaceholderContent(title: subTab.label);
        }
      },
          ),
        ),
      ],
    );
  }
}

class _DashboardContent extends ConsumerWidget {
  const _DashboardContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDashboardView(
      dashboardAsync: ref.watch(_pedagogyKpisProvider),
      moduleName: 'Pédagogie',
      onRetry: () => ref.invalidate(_pedagogyKpisProvider),
      statCards: const [
        StatCardConfig(title: 'Leçons actives', valueKey: 'active_lessons', defaultValue: '—', icon: Icons.menu_book, subtitle: 'Enseignants actifs'),
        StatCardConfig(title: 'Devoirs assignés', valueKey: 'assigned_homework', defaultValue: '—', icon: Icons.assignment, iconColor: AHColors.info),
        StatCardConfig(title: 'Évaluations', valueKey: 'planned_evaluations', defaultValue: '—', icon: Icons.fact_check, iconColor: AHColors.gold),
        StatCardConfig(title: 'Ressources', valueKey: 'shared_resources', defaultValue: '—', icon: Icons.folder_open, iconColor: AHColors.success),
      ],
    );
  }
}

class _PlanningContent extends ConsumerWidget {
  const _PlanningContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(classDiariesProvider),
      moduleName: 'Progression',
      emptyTitle: 'Aucune progression trouvée',
      emptySubtitle: 'Appuyez sur + pour créer une progression',
      onRetry: () => ref.invalidate(classDiariesProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context, title: 'Nouvelle progression', fields: const [
          AddFieldConfig(key: 'subject', label: 'Matière'),
          AddFieldConfig(key: 'class', label: 'Classe'),
          AddFieldConfig(key: 'chapter', label: 'Chapitre'),
        ]);
        if (data != null) ref.read(pedagogyMutationProvider.notifier).createClassDiary(data);
      },
      itemBuilder: (item) => ListItemCard(
        title: item['subject'] ?? item['title'] ?? 'Progression',
        subtitle: '${item['class'] ?? ''} - ${item['progress'] ?? ''}',
        leadingIcon: Icons.calendar_month,
        badge: StatusBadge(label: item['status'] ?? 'En cours', type: _st(item['status'])),
      ),
    );
  }
}

class _LessonsContent extends ConsumerWidget {
  const _LessonsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(lessonPlansProvider),
      moduleName: 'Leçons',
      emptyTitle: 'Aucune leçon trouvée',
      emptySubtitle: 'Appuyez sur + pour ajouter une leçon',
      onRetry: () => ref.invalidate(lessonPlansProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context, title: 'Nouvelle leçon', fields: const [
          AddFieldConfig(key: 'title', label: 'Titre'),
          AddFieldConfig(key: 'subject', label: 'Matière'),
          AddFieldConfig(key: 'class', label: 'Classe'),
        ]);
        if (data != null) ref.read(pedagogyMutationProvider.notifier).createLessonPlan(data);
      },
      itemBuilder: (item) => ListItemCard(
        title: item['title'] ?? 'Leçon',
        subtitle: '${item['subject'] ?? ''} - ${item['class'] ?? ''}',
        leadingIcon: Icons.auto_stories,
      ),
    );
  }
}

class _HomeworkContent extends ConsumerWidget {
  const _HomeworkContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(teacherAssignmentsProvider),
      moduleName: 'Devoirs',
      emptyTitle: 'Aucun devoir trouvé',
      emptySubtitle: 'Appuyez sur + pour assigner un devoir',
      onRetry: () => ref.invalidate(teacherAssignmentsProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context, title: 'Nouveau devoir', fields: const [
          AddFieldConfig(key: 'title', label: 'Titre'),
          AddFieldConfig(key: 'subject', label: 'Matière'),
          AddFieldConfig(key: 'due_date', label: 'Date limite'),
        ]);
        if (data != null) ref.read(pedagogyMutationProvider.notifier).createHomeworkEntry(data);
      },
      itemBuilder: (item) => ListItemCard(
        title: item['title'] ?? 'Devoir',
        subtitle: '${item['subject'] ?? ''} - Pour le ${item['due_date'] ?? ''}',
        leadingIcon: Icons.edit_note,
        badge: StatusBadge(label: item['status'] ?? 'À rendre', type: _st(item['status'])),
      ),
    );
  }
}

class _ResourcesContent extends ConsumerWidget {
  const _ResourcesContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Ressources')]);
  }
}
class _EvaluationsContent extends ConsumerWidget {
  const _EvaluationsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Évaluations')]);
  }
}
class _CompetenciesContent extends ConsumerWidget {
  const _CompetenciesContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Compétences')]);
  }
}
class _ProjectsContent extends ConsumerWidget {
  const _ProjectsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Projets')]);
  }
}
class _DifferentiationContent extends ConsumerWidget {
  const _DifferentiationContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Différenciation')]);
  }
}
class _ProgressContent extends ConsumerWidget {
  const _ProgressContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Suivi des progrès')]);
  }
}
class _ReportsContent extends ConsumerWidget {
  const _ReportsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Rapports')]);
  }
}
class _ArchiveContent extends ConsumerWidget {
  const _ArchiveContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Archive')]);
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
      const SectionHeader(title: 'ORION — Pédagogie'),
      const SizedBox(height: AHSpacing.sm),
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
              icon: Icons.menu_book,
            ),
          )).toList(),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const SizedBox.shrink(),
      ),
      const SizedBox(height: AHSpacing.lg),
      OrionInsightSection(insightsAsync: insightsAsync, moduleName: 'Pédagogie'),
      const SizedBox(height: AHSpacing.lg),
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

StatusBadgeType _st(dynamic s) {
  if (s == null) return StatusBadgeType.info;
  final v = s.toString().toLowerCase();
  if (v.contains('valid') || v.contains('actif') || v.contains('rendu') || v.contains('terminé')) return StatusBadgeType.success;
  if (v.contains('attente') || v.contains('retard') || v.contains('à rendre')) return StatusBadgeType.warning;
  if (v.contains('rejeté') || v.contains('error')) return StatusBadgeType.error;
  return StatusBadgeType.info;
}
