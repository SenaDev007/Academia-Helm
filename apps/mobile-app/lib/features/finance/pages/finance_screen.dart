import 'package:flutter/material.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/sub_tab_content.dart';

class FinanceScreen extends StatefulWidget {
  const FinanceScreen({super.key});

  @override
  State<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends State<FinanceScreen> {
  @override
  Widget build(BuildContext context) {
    final module = allModules.firstWhere((m) => m.id == 'finance');
    final subTabs = module.subTabs;
    return StatefulModulePage(
      module: module,
      visibleSubTabs: subTabs,
      initialSubTabId: subTabs.first.id,
      subTabBuilder: (subTab) {
        switch (subTab.id) {
          case 'finance-dashboard':
            return _buildDashboardContent(context);
          case 'finance-payments':
            return _buildPaymentsContent(context);
          case 'finance-invoices':
            return _buildInvoicesContent(context);
          case 'finance-receipts':
            return _buildReceiptsContent(context);
          case 'finance-budget':
            return _buildBudgetContent(context);
          case 'finance-salary':
            return _buildSalaryContent(context);
          case 'finance-expenses':
            return _buildExpensesContent(context);
          case 'finance-reports':
            return _buildReportsContent(context);
          case 'finance-audit':
            return _buildAuditContent(context);
          case 'finance-settings':
            return _buildSettingsContent(context);
          default:
            return PlaceholderContent(title: subTab.label);
        }
      },
    );
  }

  Widget _buildDashboardContent(BuildContext context) {
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'Tableau de bord Finance'),
      GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [
        StatCard(title: 'Recettes', value: '2.4M €', icon: Icons.trending_up, iconColor: AHColors.success, subtitle: '+8% vs N-1'),
        StatCard(title: 'Impayés', value: '185K €', icon: Icons.warning, iconColor: AHColors.error, subtitle: '42 familles'),
        StatCard(title: 'Dépenses', value: '1.8M €', icon: Icons.trending_down, iconColor: AHColors.info, subtitle: 'Ce trimestre'),
        StatCard(title: 'Budget restant', value: '620K €', icon: Icons.account_balance_wallet, iconColor: AHColors.gold, subtitle: 'Q3-Q4'),
      ]),
      const SectionHeader(title: 'Derniers paiements'),
      ...[
        ListItemCard(title: 'Famille Dupont', subtitle: '1 200 € - Trimestre 2', leadingIcon: Icons.payment, badge: StatusBadge(label: 'Payé', type: StatusBadgeType.success)),
        ListItemCard(title: 'Famille Martin', subtitle: '850 € - Trimestre 2', leadingIcon: Icons.payment, badge: StatusBadge(label: 'En retard', type: StatusBadgeType.error)),
      ],
    ]);
  }

  Widget _buildPaymentsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Paiements'), ...[ListItemCard(title: 'Paiement #2025-0342', subtitle: 'Dupont M. - 1 200 € - 01/03/2025', leadingIcon: Icons.credit_card, badge: StatusBadge(label: 'Validé', type: StatusBadgeType.success)), ListItemCard(title: 'Paiement #2025-0341', subtitle: 'Ben A. Y. - 950 € - 28/02/2025', leadingIcon: Icons.credit_card, badge: StatusBadge(label: 'En attente', type: StatusBadgeType.warning)), ListItemCard(title: 'Paiement #2025-0340', subtitle: 'Petit S. - 1 100 € - 27/02/2025', leadingIcon: Icons.credit_card, badge: StatusBadge(label: 'Validé', type: StatusBadgeType.success))]]); }
  Widget _buildInvoicesContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Factures'), ...[ListItemCard(title: 'Facture #F-2025-0189', subtitle: 'Famille Martin - 850 €', leadingIcon: Icons.receipt, badge: StatusBadge(label: 'En attente', type: StatusBadgeType.warning)), ListItemCard(title: 'Facture #F-2025-0188', subtitle: 'Famille Kone - 1 050 €', leadingIcon: Icons.receipt, badge: StatusBadge(label: 'Payée', type: StatusBadgeType.success))]]); }
  Widget _buildReceiptsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Reçus'), ...[ListItemCard(title: 'Reçu #R-2025-0342', subtitle: 'Dupont M. - 1 200 €', leadingIcon: Icons.receipt_long, badge: StatusBadge(label: 'Émis', type: StatusBadgeType.success)), ListItemCard(title: 'Reçu #R-2025-0341', subtitle: 'Ben A. Y. - 950 €', leadingIcon: Icons.receipt_long, badge: StatusBadge(label: 'Émis', type: StatusBadgeType.success))]]); }
  Widget _buildBudgetContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Budget'), GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 2, mainAxisSpacing: AHSpacing.sm, crossAxisSpacing: AHSpacing.sm, childAspectRatio: 1.4, children: const [StatCard(title: 'Budget total', value: '3.0M €', icon: Icons.account_balance), StatCard(title: 'Consommé', value: '79%', icon: Icons.pie_chart, iconColor: AHColors.warning), StatCard(title: 'Fonctionnement', value: '1.2M €', icon: Icons.business), StatCard(title: 'Investissement', value: '180K €', icon: Icons.construction)])]); }
  Widget _buildSalaryContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Paie'), ...[ListItemCard(title: 'Fiche de paie mars 2025', subtitle: '87 fiches générées', leadingIcon: Icons.badge, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info)), ListItemCard(title: 'Virement bancaire', subtitle: 'Montant total: 245K €', leadingIcon: Icons.account_balance, badge: StatusBadge(label: 'Planifié', type: StatusBadgeType.neutral))]]); }
  Widget _buildExpensesContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Dépenses'), ...[ListItemCard(title: 'Fournitures bureautiques', subtitle: '2 340 € - 05/03/2025', leadingIcon: Icons.shopping_bag, leadingIconColor: AHColors.error), ListItemCard(title: 'Maintenance bâtiment B', subtitle: '8 500 € - 01/03/2025', leadingIcon: Icons.build, leadingIconColor: AHColors.error), ListItemCard(title: 'Énergie - Février', subtitle: '12 200 € - 28/02/2025', leadingIcon: Icons.electric_bolt, leadingIconColor: AHColors.warning)]]); }
  Widget _buildReportsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Rapports financiers'), ...[ListItemCard(title: 'Rapport trimestriel Q1 2025', subtitle: 'Généré le 01/04/2025', leadingIcon: Icons.assessment, badge: StatusBadge(label: 'Nouveau', type: StatusBadgeType.gold)), ListItemCard(title: 'Bilan annuel 2024', subtitle: 'Généré le 15/01/2025', leadingIcon: Icons.summarize, badge: StatusBadge(label: 'Complet', type: StatusBadgeType.success))]]); }
  Widget _buildAuditContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Audit financier'), ...[ListItemCard(title: 'Audit interne 2024', subtitle: 'Conforme - 3 observations', leadingIcon: Icons.verified_user, badge: StatusBadge(label: 'Clôturé', type: StatusBadgeType.success)), ListItemCard(title: 'Audit comptable en cours', subtitle: 'Phase de vérification', leadingIcon: Icons.search, badge: StatusBadge(label: 'En cours', type: StatusBadgeType.info))]]); }
  Widget _buildSettingsContent(BuildContext context) { return SubTabContentWrapper(children: [const SectionHeader(title: 'Paramètres finance'), ...[ListItemCard(title: 'Exercice comptable', subtitle: '2024-2025 (en cours)', leadingIcon: Icons.calendar_today), ListItemCard(title: 'Plan comptable', subtitle: 'PCG adapté enseignement', leadingIcon: Icons.list_alt), ListItemCard(title: 'Modes de paiement', subtitle: 'Virement, chèque, espèces, CB', leadingIcon: Icons.payment)]]); }
}
