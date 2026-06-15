import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/module_data_list.dart';
import '../../../core/widgets/sub_tab_content.dart';
import '../providers/library_provider.dart';

class LibraryScreen extends ConsumerWidget {
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = allModules.firstWhere((m) => m.id == 'library');
    return StatefulModulePage(
      module: module,
      visibleSubTabs: module.subTabs,
      initialSubTabId: module.subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'library-dashboard': return const _DashboardContent();
          case 'library-catalog': return const _CatalogContent();
          case 'library-borrowings': return const _BorrowingsContent();
          case 'library-returns': return const _ReturnsContent();
          case 'library-reservations': return const _ReservationsContent();
          case 'library-fines': return const _FinesContent();
          case 'library-acquisition': return const _AcquisitionContent();
          case 'library-inventory': return const _InventoryContent();
          case 'library-digital': return const _DigitalContent();
          case 'library-statistics': return const _StatisticsContent();
          case 'library-members': return const _MembersContent();
          case 'library-reports': return const _ReportsContent();
          case 'library-settings': return const _SettingsContent();
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
      dashboardAsync: ref.watch(libraryDashboardProvider),
      moduleName: 'Bibliothèque',
      onRetry: () => ref.invalidate(libraryDashboardProvider),
      statCards: const [
        StatCardConfig(title: 'Ouvrages', valueKey: 'total_books', defaultValue: '—', icon: Icons.menu_book),
        StatCardConfig(title: 'Emprunts en cours', valueKey: 'active_borrowings', defaultValue: '—', icon: Icons.logout, iconColor: AHColors.info),
        StatCardConfig(title: 'Membres actifs', valueKey: 'active_members', defaultValue: '—', icon: Icons.people, iconColor: AHColors.success),
        StatCardConfig(title: 'Réservations', valueKey: 'pending_reservations', defaultValue: '—', icon: Icons.bookmark, iconColor: AHColors.gold),
      ],
    );
  }
}

class _CatalogContent extends ConsumerWidget {
  const _CatalogContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(libraryCatalogProvider),
      moduleName: 'Catalogue',
      emptyTitle: 'Aucun ouvrage dans le catalogue',
      emptySubtitle: 'Appuyez sur + pour ajouter',
      onRetry: () => ref.invalidate(libraryCatalogProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['title'] ?? 'Ouvrage',
        subtitle: '${item['author'] ?? ''} - ${item['copies'] ?? ''} exemplaires',
        leadingIcon: Icons.menu_book,
      ),
    );
  }
}

class _BorrowingsContent extends ConsumerWidget {
  const _BorrowingsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(libraryBorrowingsProvider),
      moduleName: 'Emprunts',
      emptyTitle: 'Aucun emprunt en cours',
      emptySubtitle: 'Appuyez sur + pour enregistrer un emprunt',
      onRetry: () => ref.invalidate(libraryBorrowingsProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context, title: 'Nouvel emprunt', fields: const [
          AddFieldConfig(key: 'member', label: 'Membre'),
          AddFieldConfig(key: 'book', label: 'Ouvrage'),
          AddFieldConfig(key: 'return_date', label: 'Date de retour'),
        ]);
        if (data != null) ref.read(libraryMutationProvider.notifier).createBorrowing(data);
      },
      itemBuilder: (item) => ListItemCard(
        title: item['member'] ?? 'Emprunt',
        subtitle: '${item['book'] ?? ''} - Retour le ${item['return_date'] ?? ''}',
        leadingIcon: Icons.logout,
        badge: StatusBadge(label: item['status'] ?? 'En cours', type: _st(item['status'])),
      ),
    );
  }
}

class _ReturnsContent extends ConsumerWidget {
  const _ReturnsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(libraryReturnsProvider),
      moduleName: 'Retours',
      emptyTitle: 'Aucun retour récent',
      emptySubtitle: 'Les retours apparaîtront ici',
      onRetry: () => ref.invalidate(libraryReturnsProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['book'] ?? 'Retour',
        subtitle: '${item['member'] ?? ''} - ${item['date'] ?? ''}',
        leadingIcon: Icons.login,
        badge: StatusBadge(label: item['status'] ?? 'Rendu', type: StatusBadgeType.success),
      ),
    );
  }
}

class _ReservationsContent extends ConsumerWidget {
  const _ReservationsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Réservations')]);
}
class _FinesContent extends ConsumerWidget {
  const _FinesContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Amendes')]);
}
class _AcquisitionContent extends ConsumerWidget {
  const _AcquisitionContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Acquisition')]);
}
class _InventoryContent extends ConsumerWidget {
  const _InventoryContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Inventaire')]);
}
class _DigitalContent extends ConsumerWidget {
  const _DigitalContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Ressources numériques')]);
}
class _StatisticsContent extends ConsumerWidget {
  const _StatisticsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Statistiques')]);
}
class _MembersContent extends ConsumerWidget {
  const _MembersContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Membres')]);
}
class _ReportsContent extends ConsumerWidget {
  const _ReportsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Rapports')]);
}
class _SettingsContent extends ConsumerWidget {
  const _SettingsContent();
  @override Widget build(BuildContext c, WidgetRef r) => const SubTabContentWrapper(children: [SectionHeader(title: 'Paramètres')]);
}

StatusBadgeType _st(dynamic s) {
  if (s == null) return StatusBadgeType.info;
  final v = s.toString().toLowerCase();
  if (v.contains('en cours') || v.contains('actif')) return StatusBadgeType.info;
  if (v.contains('retard')) return StatusBadgeType.warning;
  if (v.contains('rendu') || v.contains('valid')) return StatusBadgeType.success;
  return StatusBadgeType.info;
}
