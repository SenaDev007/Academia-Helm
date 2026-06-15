import 'package:flutter/material.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/sub_tab_content.dart';

class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key});

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  @override
  Widget build(BuildContext context) {
    final module = allModules.firstWhere((m) => m.id == 'library');
    final subTabs = module.subTabs;
    return StatefulModulePage(
      module: module,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'library-dashboard': return _buildDashboardContent(context);
          case 'library-catalog': return _buildCatalogContent(context);
          case 'library-borrowings': return _buildBorrowingsContent(context);
          case 'library-returns': return _buildReturnsContent(context);
          case 'library-reservations': return _buildReservationsContent(context);
          case 'library-fines': return _buildFinesContent(context);
          case 'library-acquisition': return _buildAcquisitionContent(context);
          case 'library-inventory': return _buildInventoryContent(context);
          case 'library-digital': return _buildDigitalContent(context);
          case 'library-statistics': return _buildStatisticsContent(context);
          case 'library-members': return _buildMembersContent(context);
          case 'library-reports': return _buildReportsContent(context);
          case 'library-settings': return _buildSettingsContent(context);
          default: return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }

  Widget _buildDashboardContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Tableau de bord Bibliothèque'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Ouvrages', value: '4 832', icon: Icons.menu_book, subtitle: 'Catalogue complet'),
        StatCard(title: 'Emprunts en cours', value: '187', icon: Icons.logout, iconColor: AHColors.info, subtitle: '12 en retard'),
        StatCard(title: 'Membres actifs', value: '456', icon: Icons.people, iconColor: AHColors.success, subtitle: 'Élèves + enseignants'),
        StatCard(title: 'Réservations', value: '23', icon: Icons.bookmark, iconColor: AHColors.gold, subtitle: 'En attente'),
      ]),
    ]);
  }

  Widget _buildCatalogContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Catalogue'), ...[ListItemCard(title: 'Les Misérables', subtitle: 'Victor Hugo - 3 exemplaires', leadingIcon: Icons.menu_book), ListItemCard(title: 'Mathématiques 3ème', subtitle: 'Manuel - 28 exemplaires', leadingIcon: Icons.menu_book), ListItemCard(title: 'Dictionnaire Larousse', subtitle: 'Référence - 5 exemplaires', leadingIcon: Icons.menu_book)]]); }
  Widget _buildBorrowingsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Emprunts'), ...[ListItemCard(title: 'Dupont Marie - 3ème B', subtitle: 'Les Misérables - Retour le 15/03', leadingIcon: Icons.logout, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)), ListItemCard(title: 'Martin Lucas - 2nde A', subtitle: 'Sciences & Vie - Retour le 10/03', leadingIcon: Icons.logout, badge: StatusBadge(label: 'En retard', type: StatusBadgeType.error))]]); }
  Widget _buildReturnsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Retours'), ...[ListItemCard(title: 'Retour: Histoire de France', subtitle: 'Par Ben A. Youssef - 10/03/2025', leadingIcon: Icons.login, badge: StatusBadge(label: 'Rendu', type: StatusBadgeType.success)), ListItemCard(title: 'Retour: Grammaire avancée', subtitle: 'Par Petit Sophie - 09/03/2025', leadingIcon: Icons.login, badge: StatusBadge(label: 'Rendu', type: StatusBadgeType.success))]]); }
  Widget _buildReservationsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Réservations'), ...[ListItemCard(title: 'Physique Chimie 1ère S', subtitle: 'Réservé par Kone A. - Disponible le 18/03', leadingIcon: Icons.bookmark, badge: StatusBadge(label: 'En attente', type: StatusBadgeType.warning)), ListItemCard(title: 'Anglais B2.1', subtitle: 'Réservé par Moreau T. - Disponible le 20/03', leadingIcon: Icons.bookmark, badge: StatusBadge(label: 'En attente', type: StatusBadgeType.warning))]]); }
  Widget _buildFinesContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Amendes'), ...[ListItemCard(title: 'Martin Lucas', subtitle: 'Retard 5 jours - 2.50 €', leadingIcon: Icons.euro, leadingIconColor: AHColors.error, badge: StatusBadge(label: 'Non payée', type: StatusBadgeType.error)), ListItemCard(title: 'Petit Sophie', subtitle: 'Retard 2 jours - 1.00 €', leadingIcon: Icons.euro, leadingIconColor: AHColors.warning, badge: StatusBadge(label: 'Payée', type: StatusBadgeType.success))]]); }
  Widget _buildAcquisitionContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Acquisition'), ...[ListItemCard(title: 'Commande #CMD-2025-012', subtitle: '15 ouvrages - 342 € - En livraison', leadingIcon: Icons.shopping_cart, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)), ListItemCard(title: 'Commande #CMD-2025-011', subtitle: '8 ouvrages - 198 € - Réceptionnée', leadingIcon: Icons.shopping_cart, badge: StatusBadge(label: 'Livrée', type: StatusBadgeType.success))]]); }
  Widget _buildInventoryContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Inventaire'), ...[ListItemCard(title: 'Dernier inventaire', subtitle: 'Janvier 2025 - 4 832 ouvrages', leadingIcon: Icons.inventory, badge: StatusBadge(label: 'Complet', type: StatusBadgeType.success)), ListItemCard(title: 'Prochain inventaire', subtitle: 'Programmé juillet 2025', leadingIcon: Icons.inventory, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.neutral))]]); }
  Widget _buildDigitalContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Ressources numériques'), ...[ListItemCard(title: 'E-books disponibles', subtitle: '234 titres numériques', leadingIcon: Icons.tablet_mac, leadingIconColor: AHColors.info), ListItemCard(title: 'Bases de données', subtitle: '3 abonnements actifs', leadingIcon: Icons.storage, leadingIconColor: AHColors.navy), ListItemCard(title: 'Périodiques en ligne', subtitle: '12 revues accessibles', leadingIcon: Icons.article, leadingIconColor: AHColors.gold)]]); }
  Widget _buildStatisticsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Statistiques'), GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [StatCard(title: 'Emprunts/mois', value: '234', icon: Icons.trending_up, iconColor: AHColors.info), StatCard(title: 'Taux rotation', value: '4.2', icon: Icons.refresh, iconColor: AHColors.success), StatCard(title: 'Fréquentation/jour', value: '87', icon: Icons.people, iconColor: AHColors.navy), StatCard(title: 'Satisfaction', value: '92%', icon: Icons.thumb_up, iconColor: AHColors.gold)])]); }
  Widget _buildMembersContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Membres'), ...[ListItemCard(title: 'Élèves inscrits', subtitle: '412 membres', leadingIcon: Icons.school, leadingIconColor: AHColors.info), ListItemCard(title: 'Enseignants inscrits', subtitle: '44 membres', leadingIcon: Icons.person, leadingIconColor: AHColors.navy)]]); }
  Widget _buildReportsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Rapports'), ...[ListItemCard(title: 'Rapport mensuel mars', subtitle: 'Généré le 01/04/2025', leadingIcon: Icons.assessment, badge: StatusBadge(label: 'Nouveau', type: StatusBadgeType.gold)), ListItemCard(title: 'Bilan annuel 2024', subtitle: '4 567 emprunts traités', leadingIcon: Icons.summarize, badge: StatusBadge(label: 'Complet', type: StatusBadgeType.success))]]); }
  Widget _buildSettingsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Paramètres'), ...[ListItemCard(title: 'Durée emprunt', subtitle: '14 jours (configurable)', leadingIcon: Icons.settings), ListItemCard(title: 'Amende retard', subtitle: '0.50 €/jour', leadingIcon: Icons.settings), ListItemCard(title: 'Max emprunts', subtitle: '3 par élève, 5 par enseignant', leadingIcon: Icons.settings)]]); }
}
