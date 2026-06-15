import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/module_data_list.dart';
import '../../../core/widgets/sub_tab_content.dart';
import '../providers/infirmary_provider.dart';

class InfirmaryScreen extends ConsumerWidget {
  const InfirmaryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = allModules.firstWhere((m) => m.id == 'infirmary');
    return StatefulModulePage(
      module: module,
      visibleSubTabs: module.subTabs,
      initialSubTabId: module.subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'infirmary-dashboard': return const _DashboardContent();
          case 'infirmary-records': return const _RecordsContent();
          case 'infirmary-visits': return const _VisitsContent();
          case 'infirmary-medications': return const _MedicationsContent();
          case 'infirmary-allergies': return const _AllergiesContent();
          case 'infirmary-vaccinations': return const _VaccinationsContent();
          case 'infirmary-emergencies': return const _EmergenciesContent();
          case 'infirmary-reports': return const _ReportsContent();
          case 'infirmary-stock': return const _StockContent();
          case 'infirmary-settings': return const _SettingsContent();
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
      dashboardAsync: ref.watch(infirmaryDashboardProvider),
      moduleName: 'Infirmerie',
      onRetry: () => ref.invalidate(infirmaryDashboardProvider),
      statCards: const [
        StatCardConfig(title: 'Visites ce mois', valueKey: 'visits_this_month', defaultValue: '—', icon: Icons.local_hospital),
        StatCardConfig(title: 'Élèves suivis', valueKey: 'monitored_students', defaultValue: '—', icon: Icons.health_and_safety, iconColor: AHColors.info),
        StatCardConfig(title: 'Vaccinations à jour', valueKey: 'vaccination_rate', defaultValue: '—', icon: Icons.vaccines, iconColor: AHColors.success),
        StatCardConfig(title: 'Urgences ce mois', valueKey: 'emergencies_this_month', defaultValue: '0', icon: Icons.emergency, iconColor: AHColors.error),
      ],
    );
  }
}

class _RecordsContent extends ConsumerWidget {
  const _RecordsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Dossiers médicaux')]);
}

class _VisitsContent extends ConsumerWidget {
  const _VisitsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(infirmaryVisitsProvider),
      moduleName: 'Visites',
      emptyTitle: 'Aucune visite enregistrée',
      emptySubtitle: 'Appuyez sur + pour enregistrer une visite',
      onRetry: () => ref.invalidate(infirmaryVisitsProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context, title: 'Nouvelle visite', fields: const [
          AddFieldConfig(key: 'student_name', label: 'Élève'),
          AddFieldConfig(key: 'reason', label: 'Motif'),
          AddFieldConfig(key: 'treatment', label: 'Traitement'),
        ]);
        if (data != null) ref.read(infirmaryMutationProvider.notifier).createVisit(data);
      },
      itemBuilder: (item) => ListItemCard(
        title: item['student_name'] ?? 'Visite',
        subtitle: '${item['reason'] ?? ''} - ${item['date'] ?? ''}',
        leadingIcon: Icons.login,
        badge: StatusBadge(label: item['status'] ?? 'Traité', type: StatusBadgeType.success),
      ),
    );
  }
}

class _MedicationsContent extends ConsumerWidget {
  const _MedicationsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(infirmaryMedicationsProvider),
      moduleName: 'Médicaments',
      emptyTitle: 'Aucun médicament en stock',
      emptySubtitle: 'Les médicaments apparaîtront ici',
      onRetry: () => ref.invalidate(infirmaryMedicationsProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['name'] ?? 'Médicament',
        subtitle: '${item['quantity'] ?? ''} - Péremption: ${item['expiry'] ?? ''}',
        leadingIcon: Icons.medication,
        badge: StatusBadge(label: item['status'] ?? 'OK', type: StatusBadgeType.success),
      ),
    );
  }
}

class _AllergiesContent extends ConsumerWidget {
  const _AllergiesContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Allergies')]);
}
class _VaccinationsContent extends ConsumerWidget {
  const _VaccinationsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Vaccinations')]);
}
class _EmergenciesContent extends ConsumerWidget {
  const _EmergenciesContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Urgences')]);
}
class _ReportsContent extends ConsumerWidget {
  const _ReportsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Rapports')]);
}
class _StockContent extends ConsumerWidget {
  const _StockContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Stock')]);
}
class _SettingsContent extends ConsumerWidget {
  const _SettingsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Paramètres')]);
}
