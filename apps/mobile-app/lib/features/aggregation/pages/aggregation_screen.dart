import 'package:flutter/material.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/sub_tab_content.dart';

class AggregationScreen extends StatefulWidget {
  const AggregationScreen({super.key});

  @override
  State<AggregationScreen> createState() => _AggregationScreenState();
}

class _AggregationScreenState extends State<AggregationScreen> {
  @override
  Widget build(BuildContext context) {
    final module = allModules.firstWhere((m) => m.id == 'aggregation');
    final subTabs = module.subTabs;
    return StatefulModulePage(
      module: module,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'aggregation-dashboard': return _buildDashboardContent(context);
          case 'aggregation-data': return _buildDataContent(context);
          case 'aggregation-reports': return _buildReportsContent(context);
          default: return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }

  Widget _buildDashboardContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Tableau de bord Agrégation'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Sources de données', value: '8', icon: Icons.storage, subtitle: 'Toutes connectées'),
        StatCard(title: 'Dernière synchro', value: '2h', icon: Icons.sync, iconColor: AHColors.success, subtitle: 'Succès'),
        StatCard(title: 'Enregistrements', value: '45K', icon: Icons.dataset, iconColor: AHColors.info, subtitle: 'Total agrégé'),
        StatCard(title: 'Erreurs', value: '0', icon: Icons.check_circle, iconColor: AHColors.success, subtitle: 'Aucune'),
      ]),
    ]);
  }

  Widget _buildDataContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Données agrégées'), ...[ListItemCard(title: 'Données élèves', subtitle: '1 247 enregistrements - Dernière MAJ: 2h', leadingIcon: Icons.school, badge: StatusBadge(label: 'Synchro', type: StatusBadgeType.success)), ListItemCard(title: 'Données financières', subtitle: '3 456 enregistrements - Dernière MAJ: 4h', leadingIcon: Icons.account_balance, badge: StatusBadge(label: 'Synchro', type: StatusBadgeType.success)), ListItemCard(title: 'Données RH', subtitle: '87 enregistrements - Dernière MAJ: 6h', leadingIcon: Icons.people, badge: StatusBadge(label: 'Synchro', type: StatusBadgeType.success))]]); }
  Widget _buildReportsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Rapports d\'agrégation'), ...[ListItemCard(title: 'Rapport mensuel mars 2025', subtitle: 'Généré automatiquement', leadingIcon: Icons.assessment, badge: StatusBadge(label: 'Nouveau', type: StatusBadgeType.gold)), ListItemCard(title: 'Rapport hebdomadaire S10', subtitle: 'Généré le 09/03/2025', leadingIcon: Icons.assessment, badge: StatusBadge(label: 'Disponible', type: StatusBadgeType.success))]]); }
}
