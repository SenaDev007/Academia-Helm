import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/module_data_list.dart';
import '../../../core/widgets/sub_tab_content.dart';
import '../providers/canteen_provider.dart';

class CanteenScreen extends ConsumerWidget {
  const CanteenScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = allModules.firstWhere((m) => m.id == 'canteen');
    return StatefulModulePage(
      module: module,
      visibleSubTabs: module.subTabs,
      initialSubTabId: module.subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'canteen-dashboard': return const _DashboardContent();
          case 'canteen-menus': return const _MenusContent();
          case 'canteen-meals': return const _MealsContent();
          case 'canteen-reservations': return const _ReservationsContent();
          case 'canteen-payments': return const _PaymentsContent();
          case 'canteen-stock': return const _StockContent();
          case 'canteen-suppliers': return const _SuppliersContent();
          case 'canteen-allergens': return const _AllergensContent();
          case 'canteen-statistics': return const _StatisticsContent();
          case 'canteen-reports': return const _ReportsContent();
          case 'canteen-feedback': return const _FeedbackContent();
          case 'canteen-settings': return const _SettingsContent();
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
      dashboardAsync: ref.watch(canteenDashboardProvider),
      moduleName: 'Cantine',
      onRetry: () => ref.invalidate(canteenDashboardProvider),
      statCards: const [
        StatCardConfig(title: 'Repas servis aujourd\'hui', valueKey: 'meals_today', defaultValue: '—', icon: Icons.restaurant),
        StatCardConfig(title: 'Réservations demain', valueKey: 'reservations_tomorrow', defaultValue: '—', icon: Icons.bookmark, iconColor: AHColors.info),
        StatCardConfig(title: 'Taux de satisfaction', valueKey: 'satisfaction_rate', defaultValue: '—', icon: Icons.sentiment_satisfied, iconColor: AHColors.success),
        StatCardConfig(title: 'Stock alertes', valueKey: 'stock_alerts', defaultValue: '0', icon: Icons.warning, iconColor: AHColors.warning),
      ],
    );
  }
}

class _MenusContent extends ConsumerWidget {
  const _MenusContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(canteenMenusProvider),
      moduleName: 'Menus',
      emptyTitle: 'Aucun menu configuré',
      emptySubtitle: 'Appuyez sur + pour créer un menu',
      onRetry: () => ref.invalidate(canteenMenusProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context, title: 'Nouveau menu', fields: const [
          AddFieldConfig(key: 'name', label: 'Nom du menu'),
          AddFieldConfig(key: 'date', label: 'Date'),
          AddFieldConfig(key: 'items', label: 'Plats'),
        ]);
        if (data != null) ref.read(canteenMutationProvider.notifier).createMenu(data);
      },
      itemBuilder: (item) => ListItemCard(
        title: item['name'] ?? 'Menu',
        subtitle: item['items'] ?? item['date'] ?? '',
        leadingIcon: Icons.today,
        badge: StatusBadge(label: item['status'] ?? 'Actif', type: StatusBadgeType.success),
      ),
    );
  }
}

class _MealsContent extends ConsumerWidget {
  const _MealsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Repas')]);
}
class _ReservationsContent extends ConsumerWidget {
  const _ReservationsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(canteenReservationsProvider),
      moduleName: 'Réservations',
      emptyTitle: 'Aucune réservation',
      emptySubtitle: 'Les réservations apparaîtront ici',
      onRetry: () => ref.invalidate(canteenReservationsProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['date'] ?? 'Réservation',
        subtitle: '${item['count'] ?? ''} repas',
        leadingIcon: Icons.bookmark,
      ),
    );
  }
}
class _PaymentsContent extends ConsumerWidget {
  const _PaymentsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(canteenPaymentsProvider),
      moduleName: 'Paiements Cantine',
      emptyTitle: 'Aucun paiement',
      emptySubtitle: 'Les paiements apparaîtront ici',
      onRetry: () => ref.invalidate(canteenPaymentsProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['reference'] ?? 'Facture',
        subtitle: '${item['amount'] ?? ''} €',
        leadingIcon: Icons.receipt,
        badge: StatusBadge(label: item['status'] ?? 'En cours', type: StatusBadgeType.warning),
      ),
    );
  }
}
class _StockContent extends ConsumerWidget {
  const _StockContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Stock')]);
}
class _SuppliersContent extends ConsumerWidget {
  const _SuppliersContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Fournisseurs')]);
}
class _AllergensContent extends ConsumerWidget {
  const _AllergensContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Allergènes')]);
}
class _StatisticsContent extends ConsumerWidget {
  const _StatisticsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Statistiques')]);
}
class _ReportsContent extends ConsumerWidget {
  const _ReportsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Rapports')]);
}
class _FeedbackContent extends ConsumerWidget {
  const _FeedbackContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Avis')]);
}
class _SettingsContent extends ConsumerWidget {
  const _SettingsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Paramètres')]);
}
