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
import '../providers/exams_provider.dart';
import '../../orion/providers/orion_provider.dart';
import '../../orion/widgets/orion_alert_banner.dart';
import '../../orion/widgets/orion_kpi_card.dart';
import '../../orion/widgets/orion_insight_section.dart';

class ExamsScreen extends ConsumerWidget {
  const ExamsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = allModules.firstWhere((m) => m.id == 'exams');
    final alertsAsync = ref.watch(orionAlertsProvider);
    return Column(
      children: [
        OrionAlertBanner(alertsAsync: alertsAsync),
        Expanded(
          child: StatefulModulePage(
            module: module,
            visibleSubTabs: module.subTabs,
            initialSubTabId: module.subTabs.first.id,
            subTabBuilder: (subTab) {
              switch (subTab.id) {
          case 'exams-dashboard': return const _DashboardContent();
          case 'exams-schedule': return const _ScheduleContent();
          case 'exams-results': return const _ResultsContent();
          case 'exams-statistics': return const _StatisticsContent();
          case 'exams-deliberations': return const _DeliberationsContent();
          case 'exams-rankings': return const _RankingsContent();
          case 'exams-certificates': return const _CertificatesContent();
          case 'exams-appeals': return const _AppealsContent();
          case 'exams-rooms': return const _RoomsContent();
          case 'exams-supervision': return const _SupervisionContent();
          case 'exams-archive': return const _ArchiveContent();
          case 'exams-orion': return const _OrionContent();
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
      dashboardAsync: ref.watch(examsDashboardProvider),
      moduleName: 'Examens',
      onRetry: () => ref.invalidate(examsDashboardProvider),
      statCards: const [
        StatCardConfig(title: 'Examens planifiés', valueKey: 'planned_exams', defaultValue: '—', icon: Icons.event_available),
        StatCardConfig(title: 'Résultats publiés', valueKey: 'published_results', defaultValue: '—', icon: Icons.check_circle, iconColor: AHColors.success),
        StatCardConfig(title: 'Délibérations', valueKey: 'deliberations', defaultValue: '—', icon: Icons.gavel, iconColor: AHColors.gold),
        StatCardConfig(title: 'Taux de réussite', valueKey: 'success_rate', defaultValue: '—', icon: Icons.trending_up, iconColor: AHColors.info),
      ],
    );
  }
}

class _ScheduleContent extends ConsumerWidget {
  const _ScheduleContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(evaluationsProvider),
      moduleName: 'Planning',
      emptyTitle: 'Aucun examen planifié',
      emptySubtitle: 'Appuyez sur + pour planifier un examen',
      onRetry: () => ref.invalidate(evaluationsProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context, title: 'Nouvel examen', fields: const [
          AddFieldConfig(key: 'subject', label: 'Matière'),
          AddFieldConfig(key: 'class', label: 'Classe'),
          AddFieldConfig(key: 'date', label: 'Date et heure'),
          AddFieldConfig(key: 'room', label: 'Salle'),
        ]);
        if (data != null) ref.read(examsMutationProvider.notifier).createEvaluation(data);
      },
      addLabel: 'Planifier un examen',
      itemBuilder: (item) => ListItemCard(
        title: item['subject'] ?? 'Examen',
        subtitle: '${item['date'] ?? ''} - ${item['room'] ?? ''}',
        leadingIcon: Icons.event_available,
        badge: StatusBadge(label: item['status'] ?? 'Planifié', type: _st(item['status'])),
      ),
    );
  }
}

class _ResultsContent extends ConsumerWidget {
  const _ResultsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(evaluationsProvider),
      moduleName: 'Résultats',
      emptyTitle: 'Aucun résultat disponible',
      emptySubtitle: 'Les résultats apparaîtront après correction',
      onRetry: () => ref.invalidate(evaluationsProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['subject'] ?? item['title'] ?? 'Résultat',
        subtitle: 'Moyenne: ${item['average'] ?? '—'}/20 - ${item['student_count'] ?? ''} élèves',
        leadingIcon: Icons.assessment,
        badge: StatusBadge(label: item['status'] ?? 'Publié', type: _st(item['status'])),
      ),
    );
  }
}

class _StatisticsContent extends ConsumerWidget {
  const _StatisticsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDashboardView(
      dashboardAsync: ref.watch(examsDashboardProvider),
      moduleName: 'Statistiques',
      onRetry: () => ref.invalidate(examsDashboardProvider),
      statCards: const [
        StatCardConfig(title: 'Moy. générale', valueKey: 'average_grade', defaultValue: '—', icon: Icons.grade, iconColor: AHColors.gold),
        StatCardConfig(title: 'Taux réussite', valueKey: 'success_rate', defaultValue: '—', icon: Icons.check_circle, iconColor: AHColors.success),
        StatCardConfig(title: 'Écart type', valueKey: 'std_deviation', defaultValue: '—', icon: Icons.bar_chart, iconColor: AHColors.info),
        StatCardConfig(title: 'Médiane', valueKey: 'median', defaultValue: '—', icon: Icons.straighten, iconColor: AHColors.navy),
      ],
    );
  }
}

class _DeliberationsContent extends ConsumerWidget {
  const _DeliberationsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(councilsProvider),
      moduleName: 'Délibérations',
      emptyTitle: 'Aucun conseil de classe',
      emptySubtitle: 'Appuyez sur + pour planifier',
      onRetry: () => ref.invalidate(councilsProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context, title: 'Nouveau conseil de classe', fields: const [
          AddFieldConfig(key: 'class', label: 'Classe'),
          AddFieldConfig(key: 'date', label: 'Date'),
        ]);
        if (data != null) ref.read(examsMutationProvider.notifier).createCouncil(data);
      },
      itemBuilder: (item) => ListItemCard(
        title: item['title'] ?? 'Conseil de classe',
        subtitle: item['date'] ?? '',
        leadingIcon: Icons.gavel,
        badge: StatusBadge(label: item['status'] ?? 'Planifié', type: _st(item['status'])),
      ),
    );
  }
}

class _RankingsContent extends ConsumerWidget {
  const _RankingsContent();
  @override Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Classements')]);
  }
}
class _CertificatesContent extends ConsumerWidget {
  const _CertificatesContent();
  @override Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Certificats')]);
  }
}
class _AppealsContent extends ConsumerWidget {
  const _AppealsContent();
  @override Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Recours')]);
  }
}
class _RoomsContent extends ConsumerWidget {
  const _RoomsContent();
  @override Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Salles d\'examen')]);
  }
}
class _SupervisionContent extends ConsumerWidget {
  const _SupervisionContent();
  @override Widget build(BuildContext context, WidgetRef ref) {
    return SubTabContentWrapper(children: const [SectionHeader(title: 'Surveillance')]);
  }
}
class _ArchiveContent extends ConsumerWidget {
  const _ArchiveContent();
  @override Widget build(BuildContext context, WidgetRef ref) {
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
      const SectionHeader(title: 'ORION — Examens'),
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
              icon: Icons.fact_check,
            ),
          )).toList(),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const SizedBox.shrink(),
      ),
      const SizedBox(height: AHSpacing.lg),
      OrionInsightSection(insightsAsync: insightsAsync, moduleName: 'Examens'),
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
  if (v.contains('valid') || v.contains('publié') || v.contains('actif')) return StatusBadgeType.success;
  if (v.contains('attente') || v.contains('retard')) return StatusBadgeType.warning;
  if (v.contains('rejeté') || v.contains('error')) return StatusBadgeType.error;
  return StatusBadgeType.info;
}
