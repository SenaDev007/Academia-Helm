import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/module_data_list.dart';
import '../../../core/widgets/sub_tab_content.dart';
import '../providers/qhse_provider.dart';

class QhseScreen extends ConsumerWidget {
  const QhseScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = allModules.firstWhere((m) => m.id == 'qhse');
    return StatefulModulePage(
      module: module,
      visibleSubTabs: module.subTabs,
      initialSubTabId: module.subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'qhse-dashboard': return const _DashboardContent();
          case 'qhse-risks': return const _RisksContent();
          case 'qhse-inspections': return const _InspectionsContent();
          case 'qhse-incidents': return const _IncidentsContent();
          case 'qhse-actions': return const _ActionsContent();
          case 'qhse-audits': return const _AuditsContent();
          case 'qhse-documents': return const _DocumentsContent();
          case 'qhse-training': return const _TrainingContent();
          case 'qhse-regulations': return const _RegulationsContent();
          case 'qhse-indicators': return const _IndicatorsContent();
          case 'qhse-nonconformities': return const _NonconformitiesContent();
          case 'qhse-permits': return const _PermitsContent();
          case 'qhse-reports': return const _ReportsContent();
          case 'qhse-settings': return const _SettingsContent();
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
      dashboardAsync: ref.watch(qhseDashboardProvider),
      moduleName: 'QHSE',
      onRetry: () => ref.invalidate(qhseDashboardProvider),
      statCards: const [
        StatCardConfig(title: 'Inspections ce mois', valueKey: 'inspections_count', defaultValue: '—', icon: Icons.search),
        StatCardConfig(title: 'Incidents ouverts', valueKey: 'open_incidents', defaultValue: '—', icon: Icons.alert_octagon, iconColor: AHColors.error),
        StatCardConfig(title: 'Taux conformité', valueKey: 'compliance_rate', defaultValue: '—', icon: Icons.verified, iconColor: AHColors.success),
        StatCardConfig(title: 'Actions en cours', valueKey: 'active_actions', defaultValue: '—', icon: Icons.build_circle, iconColor: AHColors.warning),
      ],
    );
  }
}

class _RisksContent extends ConsumerWidget {
  const _RisksContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(qhseRisksProvider),
      moduleName: 'Risques',
      emptyTitle: 'Aucun risque identifié',
      emptySubtitle: 'Appuyez sur + pour signaler un risque',
      onRetry: () => ref.invalidate(qhseRisksProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['name'] ?? 'Risque',
        subtitle: 'Niveau: ${item['level'] ?? '—'} - ${item['location'] ?? ''}',
        leadingIcon: Icons.warning_amber,
        leadingIconColor: _riskColor(item['level']),
        badge: StatusBadge(label: item['level'] ?? 'Moyen', type: _riskBadgeType(item['level'])),
      ),
    );
  }
}

class _InspectionsContent extends ConsumerWidget {
  const _InspectionsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Inspections')]);
}

class _IncidentsContent extends ConsumerWidget {
  const _IncidentsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(qhseIncidentsProvider),
      moduleName: 'Incidents',
      emptyTitle: 'Aucun incident signalé',
      emptySubtitle: 'Appuyez sur + pour signaler un incident',
      onRetry: () => ref.invalidate(qhseIncidentsProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context, title: 'Nouvel incident', fields: const [
          AddFieldConfig(key: 'title', label: 'Titre'),
          AddFieldConfig(key: 'severity', label: 'Gravité (Critique, Élevée, Faible)'),
          AddFieldConfig(key: 'location', label: 'Lieu'),
        ]);
        if (data != null) ref.read(qhseMutationProvider.notifier).createIncident(data);
      },
      itemBuilder: (item) => ListItemCard(
        title: item['title'] ?? 'Incident',
        subtitle: '${item['date'] ?? ''} - Gravité: ${item['severity'] ?? ''}',
        leadingIcon: Icons.alert_octagon,
        leadingIconColor: AHColors.error,
        badge: StatusBadge(label: item['status'] ?? 'Ouvert', type: StatusBadgeType.error),
      ),
    );
  }
}

class _ActionsContent extends ConsumerWidget {
  const _ActionsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Plans d\'action')]);
}
class _AuditsContent extends ConsumerWidget {
  const _AuditsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(qhseAuditsProvider),
      moduleName: 'Audits',
      emptyTitle: 'Aucun audit',
      emptySubtitle: 'Les audits apparaîtront ici',
      onRetry: () => ref.invalidate(qhseAuditsProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['title'] ?? 'Audit',
        subtitle: item['date'] ?? '',
        leadingIcon: Icons.shield,
        badge: StatusBadge(label: item['status'] ?? 'Planifié', type: StatusBadgeType.info),
      ),
    );
  }
}
class _DocumentsContent extends ConsumerWidget {
  const _DocumentsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Documents QHSE')]);
}
class _TrainingContent extends ConsumerWidget {
  const _TrainingContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Formations QHSE')]);
}
class _RegulationsContent extends ConsumerWidget {
  const _RegulationsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Réglementation')]);
}
class _IndicatorsContent extends ConsumerWidget {
  const _IndicatorsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Indicateurs')]);
}
class _NonconformitiesContent extends ConsumerWidget {
  const _NonconformitiesContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Non-conformités')]);
}
class _PermitsContent extends ConsumerWidget {
  const _PermitsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Permis & Autorisations')]);
}
class _ReportsContent extends ConsumerWidget {
  const _ReportsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Rapports QHSE')]);
}
class _SettingsContent extends ConsumerWidget {
  const _SettingsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Paramètres QHSE')]);
}

Color _riskColor(dynamic level) {
  if (level == null) return AHColors.warning;
  final v = level.toString().toLowerCase();
  if (v.contains('élevé') || v.contains('critique')) return AHColors.error;
  if (v.contains('moyen')) return AHColors.warning;
  return AHColors.info;
}

StatusBadgeType _riskBadgeType(dynamic level) {
  if (level == null) return StatusBadgeType.info;
  final v = level.toString().toLowerCase();
  if (v.contains('élevé') || v.contains('critique')) return StatusBadgeType.error;
  if (v.contains('moyen')) return StatusBadgeType.warning;
  return StatusBadgeType.info;
}
