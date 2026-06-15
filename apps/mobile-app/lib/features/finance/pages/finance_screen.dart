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
        title: item['student_name'] ?? item['reference'] ?? 'Paiement',
        subtitle: '${item['amount'] ?? '—'} € - ${item['date'] ?? ''}',
        leadingIcon: Icons.credit_card,
        badge: StatusBadge(label: item['status'] ?? 'En attente', type: _statusType(item['status'])),
      ),
    );
  }
}

class _InvoicesContent extends ConsumerWidget {
  const _InvoicesContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(feeStructuresProvider),
      moduleName: 'Factures',
      emptyTitle: 'Aucune facture trouvée',
      emptySubtitle: 'Les factures apparaîtront ici',
      onRetry: () => ref.invalidate(feeStructuresProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['label'] ?? item['reference'] ?? 'Facture',
        subtitle: '${item['amount'] ?? '—'} €',
        leadingIcon: Icons.receipt,
        badge: StatusBadge(label: item['status'] ?? 'En attente', type: _statusType(item['status'])),
      ),
    );
  }
}

class _ReceiptsContent extends ConsumerWidget {
  const _ReceiptsContent();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataList(
      itemsAsync: ref.watch(transactionsProvider),
      moduleName: 'Reçus',
      emptyTitle: 'Aucun reçu trouvé',
      emptySubtitle: 'Les reçus apparaîtront ici',
      onRetry: () => ref.invalidate(transactionsProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['reference'] ?? 'Reçu',
        subtitle: '${item['amount'] ?? '—'} € - ${item['student_name'] ?? ''}',
        leadingIcon: Icons.receipt_long,
        badge: StatusBadge(label: item['status'] ?? 'Émis', type: _statusType(item['status'])),
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
        title: item['label'] ?? item['reference'] ?? 'Fiche de paie',
        subtitle: '${item['amount'] ?? '—'} €',
        leadingIcon: Icons.badge,
        badge: StatusBadge(label: item['status'] ?? 'En préparation', type: _statusType(item['status'])),
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
        title: item['label'] ?? 'Dépense',
        subtitle: '${item['amount'] ?? '—'} € - ${item['category'] ?? ''}',
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
    return ModuleDataList(
      itemsAsync: ref.watch(financeAnomaliesProvider),
      moduleName: 'Rapports financiers',
      emptyTitle: 'Aucun rapport disponible',
      emptySubtitle: 'Les rapports apparaîtront ici',
      onRetry: () => ref.invalidate(financeAnomaliesProvider),
      itemBuilder: (item) => ListItemCard(
        title: item['label'] ?? item['title'] ?? 'Rapport',
        subtitle: item['date'] ?? '',
        leadingIcon: Icons.assessment,
        badge: StatusBadge(label: item['status'] ?? 'Disponible', type: _statusType(item['status'])),
      ),
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
        title: item['action'] ?? item['label'] ?? 'Entrée d\'audit',
        subtitle: item['timestamp'] ?? item['date'] ?? '',
        leadingIcon: Icons.verified_user,
        badge: StatusBadge(label: item['status'] ?? 'Vérifié', type: _statusType(item['status'])),
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
        ListItemCard(title: 'Exercice comptable', subtitle: settings['fiscal_year'] ?? '2024-2025', leadingIcon: Icons.calendar_today),
        ListItemCard(title: 'Plan comptable', subtitle: settings['chart_of_accounts'] ?? 'PCG adapté', leadingIcon: Icons.list_alt),
        ListItemCard(title: 'Modes de paiement', subtitle: settings['payment_methods'] ?? 'Virement, chèque, espèces, CB', leadingIcon: Icons.payment),
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
              label: kpi['label'] ?? kpi['title'] ?? 'KPI',
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
            title: a['title'] ?? 'Alerte',
            subtitle: a['description'] ?? '',
            leadingIcon: Icons.warning_amber,
            leadingIconColor: AHColors.warning,
          )).toList());
        },
      ),
    ]);
  }
}

StatusBadgeType _statusType(dynamic status) {
