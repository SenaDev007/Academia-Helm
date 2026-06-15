import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/module_data_list.dart';
import '../../../core/widgets/sub_tab_content.dart';
import '../providers/shop_provider.dart';

class ShopScreen extends ConsumerWidget {
  const ShopScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = allModules.firstWhere((m) => m.id == 'shop');
    return StatefulModulePage(
      module: module,
      visibleSubTabs: module.subTabs,
      initialSubTabId: module.subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'shop-dashboard': return const _DashboardContent();
          case 'shop-products': return const _ProductsContent();
          case 'shop-orders': return const _OrdersContent();
          case 'shop-payments': return const _PaymentsContent();
          case 'shop-deliveries': return const _DeliveriesContent();
          case 'shop-returns': return const _ReturnsContent();
          case 'shop-categories': return const _CategoriesContent();
          case 'shop-inventory': return const _InventoryContent();
          case 'shop-suppliers': return const _SuppliersContent();
          case 'shop-promotions': return const _PromotionsContent();
          case 'shop-coupons': return const _CouponsContent();
          case 'shop-reviews': return const _ReviewsContent();
          case 'shop-reports': return const _ReportsContent();
          case 'shop-settings': return const _SettingsContent();
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
      dashboardAsync: ref.watch(shopDashboardProvider),
      moduleName: 'Boutique',
      onRetry: () => ref.invalidate(shopDashboardProvider),
      statCards: const [
        StatCardConfig(title: 'Produits', valueKey: 'products_count', defaultValue: '—', icon: Icons.shopping_bag),
        StatCardConfig(title: 'Commandes', valueKey: 'orders_count', defaultValue: '—', icon: Icons.receipt, iconColor: AHColors.info),
        StatCardConfig(title: 'Revenus', valueKey: 'revenue', defaultValue: '—', icon: Icons.euro, iconColor: AHColors.success),
        StatCardConfig(title: 'En attente', valueKey: 'pending_orders', defaultValue: '—', icon: Icons.pending, iconColor: AHColors.warning),
      ],
    );
  }
}

class _ProductsContent extends ConsumerWidget {
  const _ProductsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(shopProductsProvider),
      moduleName: 'Produits',
      emptyTitle: 'Aucun produit',
      emptySubtitle: 'Appuyez sur + pour ajouter un produit',
      onRetry: () => ref.invalidate(shopProductsProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context, title: 'Nouveau produit', fields: const [
          AddFieldConfig(key: 'name', label: 'Nom'),
          AddFieldConfig(key: 'price', label: 'Prix (€)'),
          AddFieldConfig(key: 'category', label: 'Catégorie'),
        ]);
        if (data != null) ref.read(shopMutationProvider.notifier).createProduct(data);
      },
      itemBuilder: (item) => ListItemCard(
        title: item['name'] ?? 'Produit',
        subtitle: '${item['price'] ?? '—'} € - ${item['category'] ?? ''}',
        leadingIcon: Icons.inventory_2,
        badge: StatusBadge(label: item['status'] ?? 'En stock', type: StatusBadgeType.success),
      ),
    );
  }
}

class _OrdersContent extends ConsumerWidget {
  const _OrdersContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(shopOrdersProvider),
      moduleName: 'Commandes',
      emptyTitle: 'Aucune commande',
      emptySubtitle: 'Les commandes apparaîtront ici',
      onRetry: () => ref.invalidate(shopOrdersProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['reference'] ?? 'Commande',
        subtitle: '${item['customer'] ?? ''} - ${item['amount'] ?? ''} €',
        leadingIcon: Icons.shopping_cart,
        badge: StatusBadge(label: item['status'] ?? 'En attente', type: StatusBadgeType.warning),
      ),
    );
  }
}

class _PaymentsContent extends ConsumerWidget {
  const _PaymentsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(shopPaymentsProvider),
      moduleName: 'Paiements',
      emptyTitle: 'Aucun paiement',
      emptySubtitle: 'Les paiements apparaîtront ici',
      onRetry: () => ref.invalidate(shopPaymentsProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['reference'] ?? 'Paiement',
        subtitle: '${item['amount'] ?? ''} €',
        leadingIcon: Icons.credit_card,
        badge: StatusBadge(label: item['status'] ?? 'En attente', type: StatusBadgeType.warning),
      ),
    );
  }
}

class _DeliveriesContent extends ConsumerWidget {
  const _DeliveriesContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Livraisons')]);
}
class _ReturnsContent extends ConsumerWidget {
  const _ReturnsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Retours')]);
}
class _CategoriesContent extends ConsumerWidget {
  const _CategoriesContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Catégories')]);
}
class _InventoryContent extends ConsumerWidget {
  const _InventoryContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Inventaire')]);
}
class _SuppliersContent extends ConsumerWidget {
  const _SuppliersContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Fournisseurs')]);
}
class _PromotionsContent extends ConsumerWidget {
  const _PromotionsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Promotions')]);
}
class _CouponsContent extends ConsumerWidget {
  const _CouponsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Coupons')]);
}
class _ReviewsContent extends ConsumerWidget {
  const _ReviewsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Avis')]);
}
class _ReportsContent extends ConsumerWidget {
  const _ReportsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Rapports')]);
}
class _SettingsContent extends ConsumerWidget {
  const _SettingsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Paramètres')]);
}
