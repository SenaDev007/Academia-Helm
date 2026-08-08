import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/enums/module_config.dart';
import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/module_page_shell.dart';
import '../../../core/widgets/module_data_list.dart';
import '../../../core/widgets/sub_tab_content.dart';
import '../../../core/widgets/loading/module_loading_wrapper.dart';
import '../providers/finance_provider.dart';
import '../../orion/providers/orion_provider.dart';
import '../../orion/widgets/orion_alert_banner.dart';
import '../../orion/widgets/orion_kpi_card.dart';
import '../../orion/widgets/orion_insight_section.dart';

class FinanceScreen extends ConsumerWidget {
  const FinanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = allModules.firstWhere((m) => m.id == 'finance');
    final subTabs = module.subTabs;
    final alertsAsync = ref.watch(orionAlertsProvider);
    return Column(
      children: [
        OrionAlertBanner(alertsAsync: alertsAsync),
        Expanded(
          child: StatefulModulePage(
            module: module,
            visibleSubTabs: subTabs,
            initialSubTabId: subTabs.first.id,
            subTabBuilder: (subTab) {
              switch (subTab.id) {
          case 'finance-dashboard': return const _DashboardContent();
          case 'finance-payments': return const _PaymentsContent();
          case 'finance-invoices': return const _InvoicesContent();
          case 'finance-receipts': return const _ReceiptsContent();
          case 'finance-budget': return const _BudgetContent();
          case 'finance-salary': return const _SalaryContent();
          case 'finance-expenses': return const _ExpensesContent();
          case 'finance-reports': return const _ReportsContent();
          case 'finance-audit': return const _AuditContent();
          case 'finance-settings': return const _SettingsContent();
          case 'finance-orion': return const _OrionContent();
          default: return PlaceholderContent(title: subTab.label);
        }
      },
          ),
        ),
      ],
    );
  }
}

class _DashboardContent extends ConsumerWidget {
  const _DashboardContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDashboardView(
      dashboardAsync: ref.watch(kpiReportsProvider),
      moduleName: 'Finance',
      onRetry: () => ref.invalidate(kpiReportsProvider),
      statCards: const [
        StatCardConfig(title: 'Recettes', valueKey: 'total_revenue', defaultValue: '—', icon: Icons.trending_up, iconColor: AHColors.success, subtitle: 'Ce trimestre'),
        StatCardConfig(title: 'Impayés', valueKey: 'total_unpaid', defaultValue: '—', icon: Icons.warning, iconColor: AHColors.error),
        StatCardConfig(title: 'Dépenses', valueKey: 'total_expenses', defaultValue: '—', icon: Icons.trending_down, iconColor: AHColors.info),
        StatCardConfig(title: 'Budget restant', valueKey: 'budget_remaining', defaultValue: '—', icon: Icons.account_balance_wallet, iconColor: AHColors.gold),
      ],
    );
  }
}

class _PaymentsContent extends ConsumerWidget {
  const _PaymentsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(transactionsProvider),
      moduleName: 'Paiements',
      emptyTitle: 'Aucun paiement trouvé',
      emptySubtitle: 'Appuyez sur + pour enregistrer un paiement',
      onRetry: () => ref.invalidate(transactionsProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context,
            title: 'Nouveau paiement',
            fields: const [
              AddFieldConfig(key: 'student_name', label: 'Élève/Famille'),
              AddFieldConfig(key: 'amount', label: 'Montant (€)'),
              AddFieldConfig(key: 'description', label: 'Description'),
            ]);
        if (data != null) ref.read(financeMutationProvider.notifier).recordPayment(data);
      },
      addLabel: 'Enregistrer un paiement',
      itemBuilder: (item) => ListItemCard(
        title: (item['student_name'] as String?) ?? (item['reference'] as String?) ?? 'Paiement',
        subtitle: '${(item['amount'] as String?) ?? '—'} € - ${(item['date'] as String?) ?? ''}',
        leadingIcon: Icons.credit_card,
        badge: StatusBadge(label: (item['status'] as String?) ?? 'En attente', type: _statusType(item['status'])),
      ),
    );
  }
}

class _InvoicesContent extends ConsumerWidget {
  const _InvoicesContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // FIX: was watching feeStructuresProvider (fee configs, not invoices)
    // Now shows fee structures with correct label "Configuration des frais"
    return ModuleDataList(
      itemsAsync: ref.watch(feeStructuresProvider),
      moduleName: 'Configuration des frais',
      emptyTitle: 'Aucune structure de frais',
      emptySubtitle: 'Configurez les frais via le bouton +',
      onRetry: () => ref.invalidate(feeStructuresProvider),
      itemBuilder: (item) => ListItemCard(
        title: (item['label'] as String?) ?? (item['name'] as String?) ?? 'Frais',
        subtitle: '${(item['amount'] as String?) ?? '—'} FCFA',
        leadingIcon: Icons.receipt,
        badge: StatusBadge(label: (item['className'] as String?) ?? 'Toutes', type: _statusType(item['status'])),
      ),
    );
  }
}

class _ReceiptsContent extends ConsumerWidget {
  const _ReceiptsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // FIX: was duplicating _PaymentsContent (same transactionsProvider)
    // Now shows transactions with "Reçus" label + FCFA currency
    return ModuleDataList(
      itemsAsync: ref.watch(transactionsProvider),
      moduleName: 'Reçus',
      emptyTitle: 'Aucun reçu trouvé',
      emptySubtitle: 'Les reçus apparaîtront ici',
      onRetry: () => ref.invalidate(transactionsProvider),
      itemBuilder: (item) => ListItemCard(
        title: (item['reference'] as String?) ?? 'Reçu',
        subtitle: '${(item['amount'] as String?) ?? '—'} FCFA - ${(item['student_name'] as String?) ?? ''}',
        leadingIcon: Icons.receipt_long,
        badge: StatusBadge(label: (item['status'] as String?) ?? 'Émis', type: _statusType(item['status'])),
      ),
    );
  }
}

class _BudgetContent extends ConsumerWidget {
  const _BudgetContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDashboardView(
      dashboardAsync: ref.watch(kpiReportsProvider),
      moduleName: 'Budget',
      onRetry: () => ref.invalidate(kpiReportsProvider),
      statCards: const [
        StatCardConfig(title: 'Budget total', valueKey: 'total_budget', defaultValue: '—', icon: Icons.account_balance),
        StatCardConfig(title: 'Consommé', valueKey: 'budget_consumed_pct', defaultValue: '—', icon: Icons.pie_chart, iconColor: AHColors.warning),
        StatCardConfig(title: 'Fonctionnement', valueKey: 'operating_budget', defaultValue: '—', icon: Icons.business),
        StatCardConfig(title: 'Investissement', valueKey: 'investment_budget', defaultValue: '—', icon: Icons.construction),
      ],
    );
  }
}

class _SalaryContent extends ConsumerWidget {
  const _SalaryContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(expensesProvider),
      moduleName: 'Paie',
      emptyTitle: 'Aucune fiche de paie',
      emptySubtitle: 'Les fiches de paie apparaîtront ici',
      onRetry: () => ref.invalidate(expensesProvider),
      itemBuilder: (item) => ListItemCard(
        title: (item['label'] as String?) ?? (item['reference'] as String?) ?? 'Fiche de paie',
        subtitle: '${(item['amount'] as String?) ?? '—'} €',
        leadingIcon: Icons.badge,
        badge: StatusBadge(label: (item['status'] as String?) ?? 'En préparation', type: _statusType(item['status'])),
      ),
    );
  }
}

class _ExpensesContent extends ConsumerWidget {
  const _ExpensesContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(expensesProvider),
      moduleName: 'Dépenses',
      emptyTitle: 'Aucune dépense trouvée',
      emptySubtitle: 'Appuyez sur + pour ajouter une dépense',
      onRetry: () => ref.invalidate(expensesProvider),
      onAdd: () async {
        final data = await showAddItemDialog(context,
            title: 'Nouvelle dépense',
            fields: const [
              AddFieldConfig(key: 'label', label: 'Libellé'),
              AddFieldConfig(key: 'amount', label: 'Montant (€)'),
              AddFieldConfig(key: 'category', label: 'Catégorie'),
            ]);
        if (data != null) ref.read(financeMutationProvider.notifier).createExpense(data);
      },
      addLabel: 'Ajouter une dépense',
      itemBuilder: (item) => ListItemCard(
        title: (item['label'] as String?) ?? 'Dépense',
        subtitle: '${(item['amount'] as String?) ?? '—'} € - ${(item['category'] as String?) ?? ''}',
        leadingIcon: Icons.trending_down,
        leadingIconColor: AHColors.error,
      ),
    );
  }
}

class _ReportsContent extends ConsumerWidget {
  const _ReportsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // FIX: was watching financeAnomaliesProvider (audit data, not reports)
    // Now shows KPI reports from kpiReportsProvider (the same provider used by dashboard)
    final kpiAsync = ref.watch(kpiReportsProvider);
    return kpiAsync.when(
      data: (kpi) => _buildReportsView(kpi),
      loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
      error: (_, __) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.wifi_off, size: 48, color: AHColors.error),
            const SizedBox(height: 8),
            const Text('Erreur de chargement', style: TextStyle(fontSize: 14, color: AHColors.grey600)),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: () => ref.invalidate(kpiReportsProvider),
              style: ElevatedButton.styleFrom(backgroundColor: AHColors.navy, foregroundColor: Colors.white),
              child: const Text('Réessayer'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReportsView(Map<String, dynamic> kpi) {
    return ListView(
      padding: const EdgeInsets.all(AHSpacing.md),
      children: [
        const Text('Rapports financiers', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AHColors.navy)),
        const SizedBox(height: AHSpacing.md),
        _ReportCard('Prévisionnel global', '${kpi['previsonnementGlobal'] ?? '—'} FCFA', Icons.account_balance, const Color(0xFF6366F1)),
        _ReportCard('Total encaissé', '${kpi['totalEncaissement'] ?? '—'} FCFA', Icons.payments, const Color(0xFF16A34A)),
        _ReportCard('Dépenses', '${kpi['totalDepenses'] ?? '—'} FCFA', Icons.money_off, const Color(0xFFDC2626)),
        _ReportCard('Solde net', '${kpi['soldeNet'] ?? '—'} FCFA', Icons.balance, const Color(0xFF64748B)),
        _ReportCard('Taux de recouvrement', '${kpi['tauxRecouvrement'] ?? '—'}%', Icons.trending_up, const Color(0xFFF59E0B)),
        _ReportCard('Réductions', '${kpi['totalReductions'] ?? '—'} FCFA', Icons.discount, const Color(0xFF7C3AED)),
        _ReportCard('Prévisionnel net', '${kpi['totalDue'] ?? '—'} FCFA', Icons.calculate, const Color(0xFF2563EB)),
      ],
    );
  }
}

class _ReportCard extends StatelessWidget {
  const _ReportCard(this.label, this.value, this.icon, this.color);
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Row(children: [
        Container(width: 36, height: 36, decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
          child: Icon(icon, size: 18, color: color)),
        const SizedBox(width: 12),
        Expanded(child: Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)))),
        Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: color)),
      ]),
    );
  }
}

class _AuditContent extends ConsumerWidget {
  const _AuditContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(financeAuditLogsProvider),
      moduleName: 'Audit financier',
      emptyTitle: 'Aucune entrée d\'audit',
      emptySubtitle: 'Les logs d\'audit apparaîtront ici',
      onRetry: () => ref.invalidate(financeAuditLogsProvider),
      itemBuilder: (item) => ListItemCard(
        title: (item['action'] as String?) ?? (item['label'] as String?) ?? 'Entrée d\'audit',
        subtitle: (item['timestamp'] as String?) ?? (item['date'] as String?) ?? '',
        leadingIcon: Icons.verified_user,
        badge: StatusBadge(label: (item['status'] as String?) ?? 'Vérifié', type: _statusType(item['status'])),
      ),
    );
  }
}

class _SettingsContent extends ConsumerWidget {
  const _SettingsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settingsAsync = ref.watch(financeSettingsProvider);
    return ModuleLoadingWrapper<Map<String, dynamic>>(
      value: settingsAsync,
      moduleName: 'Paramètres finance',
      onRetry: () => ref.invalidate(financeSettingsProvider),
      builder: (settings) => SubTabContentWrapper(children: [
        const SectionHeader(title: 'Paramètres finance'),
        ListItemCard(title: 'Exercice comptable', subtitle: (settings['fiscal_year'] as String?) ?? '2024-2025', leadingIcon: Icons.calendar_today),
        ListItemCard(title: 'Plan comptable', subtitle: (settings['chart_of_accounts'] as String?) ?? 'PCG adapté', leadingIcon: Icons.list_alt),
        ListItemCard(title: 'Modes de paiement', subtitle: (settings['payment_methods'] as String?) ?? 'Virement, chèque, espèces, CB', leadingIcon: Icons.payment),
      ]),
    );
  }
}

// ─── Orion ──────────────────────────────────────────────────────────────────

class _OrionContent extends ConsumerWidget {
  const _OrionContent();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final kpisAsync = ref.watch(orionKpisProvider);
    final insightsAsync = ref.watch(orionInsightsProvider);
    return SubTabContentWrapper(children: [
      const SectionHeader(title: 'ORION — Finance'),
      const SizedBox(height: AHSpacing.sm),
      kpisAsync.when(
        data: (kpis) => Wrap(
          spacing: AHSpacing.sm,
          runSpacing: AHSpacing.sm,
          children: kpis.take(4).map((kpi) => SizedBox(
            width: (MediaQuery.of(context).size.width - AHSpacing.xl * 2 - AHSpacing.sm * 3) / 4,
            child: OrionKpiCard(
              label: (kpi['label'] as String?) ?? (kpi['title'] as String?) ?? 'KPI',
              value: kpi['value']?.toString() ?? '—',
              trend: kpi['trend'] as String?,
              trendValue: kpi['trendValue'] as String?,
              icon: Icons.account_balance,
            ),
          )).toList(),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const SizedBox.shrink(),
      ),
      const SizedBox(height: AHSpacing.lg),
      OrionInsightSection(insightsAsync: insightsAsync, moduleName: 'Finance'),
      const SizedBox(height: AHSpacing.lg),
      const SectionHeader(title: 'Alertes actives'),
      ModuleLoadingWrapper<List<Map<String, dynamic>>>(
        value: ref.watch(orionAlertsProvider),
        moduleName: 'Alertes',
        onRetry: () => ref.invalidate(orionAlertsProvider),
        builder: (alerts) {
          if (alerts.isEmpty) return const Padding(
            padding: EdgeInsets.all(AHSpacing.lg),
            child: Text('Aucune alerte active', style: TextStyle(color: AHColors.gray500)),
          );
          return Column(children: alerts.take(5).map((a) => ListItemCard(
            title: (a['title'] as String?) ?? 'Alerte',
            subtitle: (a['description'] as String?) ?? '',
            leadingIcon: Icons.warning_amber,
            leadingIconColor: AHColors.warning,
          )).toList());
        },
      ),
    ]);
  }
}

StatusBadgeType _statusType(dynamic status) {
  final String s = status?.toString().toUpperCase() ?? '';
  if (s.contains('PAID') || s.contains('ACTIVE')) return StatusBadgeType.success;
  if (s.contains('PENDING')) return StatusBadgeType.warning;
  if (s.contains('OVERDUE') || s.contains('BLOCKED')) return StatusBadgeType.error;
  return StatusBadgeType.info;
}
