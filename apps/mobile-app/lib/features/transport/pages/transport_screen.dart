import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/module_data_list.dart';
import '../../../core/widgets/sub_tab_content.dart';
import '../providers/transport_provider.dart';

class TransportScreen extends ConsumerWidget {
  const TransportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = allModules.firstWhere((m) => m.id == 'transport');
    return StatefulModulePage(
      module: module,
      visibleSubTabs: module.subTabs,
      initialSubTabId: module.subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'transport-dashboard': return const _DashboardContent();
          case 'transport-routes': return const _RoutesContent();
          case 'transport-vehicles': return const _VehiclesContent();
          case 'transport-drivers': return const _DriversContent();
          case 'transport-students': return const _StudentsContent();
          case 'transport-tracking': return const _TrackingContent();
          case 'transport-maintenance': return const _MaintenanceContent();
          case 'transport-insurance': return const _InsuranceContent();
          case 'transport-fuel': return const _FuelContent();
          case 'transport-incidents': return const _IncidentsContent();
          case 'transport-contracts': return const _ContractsContent();
          case 'transport-payments': return const _PaymentsContent();
          case 'transport-reports': return const _ReportsContent();
          case 'transport-settings': return const _SettingsContent();
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
      dashboardAsync: ref.watch(transportDashboardProvider),
      moduleName: 'Transport',
      onRetry: () => ref.invalidate(transportDashboardProvider),
      statCards: const [
        StatCardConfig(title: 'Élèves transportés', valueKey: 'students_count', defaultValue: '—', icon: Icons.bus),
        StatCardConfig(title: 'Véhicules', valueKey: 'vehicles_count', defaultValue: '—', icon: Icons.directions_bus, iconColor: AHColors.info),
        StatCardConfig(title: 'Chauffeurs', valueKey: 'drivers_count', defaultValue: '—', icon: Icons.person, iconColor: AHColors.success),
        StatCardConfig(title: 'Incidents', valueKey: 'incidents_count', defaultValue: '0', icon: Icons.check_circle, iconColor: AHColors.success),
      ],
    );
  }
}

class _RoutesContent extends ConsumerWidget {
  const _RoutesContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(transportRoutesProvider),
      moduleName: 'Trajets',
      emptyTitle: 'Aucun trajet configuré',
      emptySubtitle: 'Appuyez sur + pour ajouter',
      onRetry: () => ref.invalidate(transportRoutesProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context, title: 'Nouveau trajet', fields: const [
          AddFieldConfig(key: 'name', label: 'Nom du circuit'),
          AddFieldConfig(key: 'stops', label: 'Nombre d\'arrêts'),
          AddFieldConfig(key: 'duration', label: 'Durée (min)'),
        ]);
        if (data != null) ref.read(transportMutationProvider.notifier).createRoute(data);
      },
      itemBuilder: (item) => ListItemCard(
        title: item['name'] ?? 'Circuit',
        subtitle: '${item['students'] ?? ''} élèves - ${item['stops'] ?? ''} arrêts',
        leadingIcon: Icons.alt_route,
        badge: StatusBadge(label: item['status'] ?? 'Actif', type: StatusBadgeType.success),
      ),
    );
  }
}

class _VehiclesContent extends ConsumerWidget {
  const _VehiclesContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(transportVehiclesProvider),
      moduleName: 'Véhicules',
      emptyTitle: 'Aucun véhicule',
      emptySubtitle: 'Les véhicules apparaîtront ici',
      onRetry: () => ref.invalidate(transportVehiclesProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['name'] ?? item['plate'] ?? 'Véhicule',
        subtitle: '${item['capacity'] ?? ''} places',
        leadingIcon: Icons.directions_bus,
        badge: StatusBadge(label: item['status'] ?? 'OK', type: StatusBadgeType.success),
      ),
    );
  }
}

class _DriversContent extends ConsumerWidget {
  const _DriversContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Chauffeurs')]);
}
class _StudentsContent extends ConsumerWidget {
  const _StudentsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(transportStudentsProvider),
      moduleName: 'Élèves transportés',
      emptyTitle: 'Aucun élève transporté',
      emptySubtitle: 'Les élèves inscrits apparaîtront ici',
      onRetry: () => ref.invalidate(transportStudentsProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['name'] ?? 'Élève',
        subtitle: '${item['route'] ?? ''} - ${item['stop'] ?? ''}',
        leadingIcon: Icons.person,
        badge: StatusBadge(label: item['status'] ?? 'Inscrit', type: StatusBadgeType.success),
      ),
    );
  }
}
class _TrackingContent extends ConsumerWidget {
  const _TrackingContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Suivi en temps réel')]);
}
class _MaintenanceContent extends ConsumerWidget {
  const _MaintenanceContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Maintenance')]);
}
class _InsuranceContent extends ConsumerWidget {
  const _InsuranceContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Assurance')]);
}
class _FuelContent extends ConsumerWidget {
  const _FuelContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Carburant')]);
}
class _IncidentsContent extends ConsumerWidget {
  const _IncidentsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Incidents')]);
}
class _ContractsContent extends ConsumerWidget {
  const _ContractsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Contrats')]);
}
class _PaymentsContent extends ConsumerWidget {
  const _PaymentsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Paiements')]);
}
class _ReportsContent extends ConsumerWidget {
  const _ReportsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Rapports')]);
}
class _SettingsContent extends ConsumerWidget {
  const _SettingsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Paramètres')]);
}
