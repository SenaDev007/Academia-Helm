import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/module_data_list.dart';
import '../../../core/widgets/loading/module_loading_wrapper.dart';
import '../../../core/widgets/sub_tab_content.dart';
import '../providers/orion_provider.dart';

class OrionScreen extends ConsumerWidget {
  const OrionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = allModules.firstWhere((m) => m.id == 'orion');
    return StatefulModulePage(
      module: module,
      visibleSubTabs: module.subTabs,
      initialSubTabId: module.subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'orion-dashboard': return const _DashboardContent();
          case 'orion-analysis': return const _AnalysisContent();
          case 'orion-predictions': return const _PredictionsContent();
          case 'orion-reports': return const _ReportsContent();
          case 'orion-settings': return const _SettingsContent();
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
      dashboardAsync: ref.watch(orionMonthlySummaryProvider),
      moduleName: 'Orion IA',
      onRetry: () => ref.invalidate(orionMonthlySummaryProvider),
      statCards: const [
        StatCardConfig(title: 'Analyses actives', valueKey: 'active_analyses', defaultValue: '—', icon: Icons.analytics),
        StatCardConfig(title: 'Prédictions', valueKey: 'predictions_count', defaultValue: '—', icon: Icons.trending_up, iconColor: AHColors.success),
        StatCardConfig(title: 'Alertes', valueKey: 'alerts_count', defaultValue: '—', icon: Icons.notifications_active, iconColor: AHColors.warning),
        StatCardConfig(title: 'Rapports générés', valueKey: 'reports_count', defaultValue: '—', icon: Icons.description, iconColor: AHColors.info),
      ],
      extraChildren: [
        const SectionHeader(title: 'Alertes récentes'),
        ModuleLoadingWrapper<List<Map<String, dynamic>>>(
          value: ref.watch(orionAlertsProvider),
          moduleName: 'Alertes',
          onRetry: () => ref.invalidate(orionAlertsProvider),
          builder: (alerts) {
            if (alerts.isEmpty) return const Padding(
              padding: EdgeInsets.all(AHSpacing.lg),
              child: Text('Aucune alerte active', style: TextStyle(color: AHColors.muted)),
            );
            return Column(children: alerts.take(3).map((a) => ListItemCard(
              title: a['title'] ?? 'Alerte',
              subtitle: a['description'] ?? '',
              leadingIcon: Icons.warning_amber,
              leadingIconColor: AHColors.warning,
            )).toList());
          },
        ),
      ],
    );
  }
}

class _AnalysisContent extends ConsumerWidget {
  const _AnalysisContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(orionInsightsProvider),
      moduleName: 'Analyses',
      emptyTitle: 'Aucune analyse en cours',
      emptySubtitle: 'Les analyses Orion apparaîtront ici',
      onRetry: () => ref.invalidate(orionInsightsProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['title'] ?? 'Analyse',
        subtitle: item['description'] ?? '',
        leadingIcon: Icons.analytics,
        badge: StatusBadge(label: item['status'] ?? 'En cours', type: _st(item['status'])),
      ),
    );
  }
}

class _PredictionsContent extends ConsumerWidget {
  const _PredictionsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDashboardView(
      dashboardAsync: ref.watch(orionKpisProvider),
      moduleName: 'Prédictions',
      onRetry: () => ref.invalidate(orionKpisProvider),
      statCards: const [
        StatCardConfig(title: 'Taux de réussite estimé', valueKey: 'estimated_success_rate', defaultValue: '—', icon: Icons.school, iconColor: AHColors.success),
        StatCardConfig(title: 'Risque d\'abandon', valueKey: 'dropout_risk', defaultValue: '—', icon: Icons.person_off, iconColor: AHColors.error),
        StatCardConfig(title: 'Progression moyenne', valueKey: 'average_progression', defaultValue: '—', icon: Icons.trending_up, iconColor: AHColors.info),
        StatCardConfig(title: 'Confiance modèle', valueKey: 'model_confidence', defaultValue: '—', icon: Icons.verified, iconColor: AHColors.gold),
      ],
    );
  }
}

class _ReportsContent extends ConsumerWidget {
  const _ReportsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(orionHistoryFilteredProvider(const OrionHistoryArgs())),
      moduleName: 'Rapports IA',
      emptyTitle: 'Aucun rapport IA',
      emptySubtitle: 'Les rapports générés apparaîtront ici',
      onRetry: () => ref.invalidate(orionHistoryFilteredProvider(const OrionHistoryArgs())),
      itemBuilder: (item) => ListItemCard(
        title: item['title'] ?? 'Rapport',
        subtitle: item['date'] ?? '',
        leadingIcon: Icons.description,
        badge: StatusBadge(label: item['status'] ?? 'Nouveau', type: _st(item['status'])),
      ),
    );
  }
}

class _SettingsContent extends ConsumerWidget {
  const _SettingsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleLoadingWrapper<Map<String, dynamic>>(
      value: ref.watch(orionConfigProvider),
      moduleName: 'Configuration Orion',
      onRetry: () => ref.invalidate(orionConfigProvider),
      builder: (config) => SubTabContentWrapper(children: [
        const SectionHeader(title: 'Configuration Orion IA'),
        ListItemCard(title: 'Modèles de prédiction', subtitle: '${config['models_count'] ?? '—'} modèles actifs', leadingIcon: Icons.model_training),
        ListItemCard(title: 'Sources de données', subtitle: '${config['sources_count'] ?? '—'} connecteurs configurés', leadingIcon: Icons.storage),
        ListItemCard(title: 'Seuils d\'alerte', subtitle: 'Configurés pour ${config['indicators_count'] ?? '—'} indicateurs', leadingIcon: Icons.tune),
        ListItemCard(title: 'Planification des analyses', subtitle: config['schedule'] ?? 'Quotidienne', leadingIcon: Icons.schedule),
      ]),
    );
  }
}

StatusBadgeType _st(dynamic s) {
  if (s == null) return StatusBadgeType.info;
  final v = s.toString().toLowerCase();
  if (v.contains('actif') || v.contains('terminé') || v.contains('valid')) return StatusBadgeType.success;
  if (v.contains('attente') || v.contains('retard')) return StatusBadgeType.warning;
  if (v.contains('error')) return StatusBadgeType.error;
  return StatusBadgeType.info;
}
