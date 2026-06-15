import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/module_data_list.dart';
import '../../../core/widgets/sub_tab_content.dart';
import '../providers/aggregation_provider.dart';

class AggregationScreen extends ConsumerWidget {
  const AggregationScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = allModules.firstWhere((m) => m.id == 'aggregation');
    return StatefulModulePage(
      module: module,
      visibleSubTabs: module.subTabs,
      initialSubTabId: module.subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'aggregation-dashboard': return const _DashboardContent();
          case 'aggregation-data': return const _DataContent();
          case 'aggregation-reports': return const _ReportsContent();
          default: return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }
}

class _DashboardContent extends ConsumerWidget {
  const _DashboardContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDashboardView(
      dashboardAsync: ref.watch(aggregationDashboardProvider),
      moduleName: 'Agrégation',
      onRetry: () => ref.invalidate(aggregationDashboardProvider),
      statCards: const [
        StatCardConfig(title: 'Sources de données', valueKey: 'sources_count', defaultValue: '—', icon: Icons.storage),
        StatCardConfig(title: 'Dernière synchro', valueKey: 'last_sync', defaultValue: '—', icon: Icons.sync, iconColor: AHColors.success),
        StatCardConfig(title: 'Enregistrements', valueKey: 'total_records', defaultValue: '—', icon: Icons.dataset, iconColor: AHColors.info),
        StatCardConfig(title: 'Erreurs', valueKey: 'error_count', defaultValue: '0', icon: Icons.check_circle, iconColor: AHColors.success),
      ],
    );
  }
}

class _DataContent extends ConsumerWidget {
  const _DataContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(aggregationDataProvider),
      moduleName: 'Données agrégées',
      emptyTitle: 'Aucune source de données',
      emptySubtitle: 'Les données agrégées apparaîtront ici',
      onRetry: () => ref.invalidate(aggregationDataProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['name'] ?? item['source'] ?? 'Source',
        subtitle: '${item['records'] ?? '—'} enregistrements',
        leadingIcon: Icons.school,
        badge: StatusBadge(label: item['status'] ?? 'Synchro', type: StatusBadgeType.success),
      ),
    );
  }
}

class _ReportsContent extends ConsumerWidget {
  const _ReportsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(aggregationReportsProvider),
      moduleName: 'Rapports d\'agrégation',
      emptyTitle: 'Aucun rapport d\'agrégation',
      emptySubtitle: 'Les rapports apparaîtront ici',
      onRetry: () => ref.invalidate(aggregationReportsProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['title'] ?? 'Rapport',
        subtitle: item['date'] ?? '',
        leadingIcon: Icons.assessment,
        badge: StatusBadge(label: item['status'] ?? 'Nouveau', type: StatusBadgeType.gold),
      ),
    );
  }
}
