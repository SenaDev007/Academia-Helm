import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/ah_app_bar.dart';
import '../../../core/widgets/dynamic_form_dialog.dart';
import '../../../core/widgets/generic_module_tab.dart' show KpiCardConfig;
import '../../../core/widgets/module_data_tab.dart';
import '../../../features/dashboard/providers/dashboard_v2_provider.dart';

/// Finance module screen — mirrors the web's /app/finance/* structure.
///
/// 13 sub-tabs (matching web finance/layout.tsx):
/// 1. Tableau de Bord — 7 KPI cards
/// 2. Configuration des frais
/// 3. Personnalisations
/// 4. Comptes élèves
/// 5. Multi-caisses
/// 6. Encaissements
/// 7. Bilan des encaissements
/// 8. Recouvrement & Arriérés
/// 9. Dépenses
/// 10. Clôture & Trésorerie
/// 11. Rapports financiers
/// 12. Contrôle & Audit
/// 13. Paramétrage
class FinanceModuleScreen extends ConsumerStatefulWidget {
  const FinanceModuleScreen({super.key});

  @override
  ConsumerState<FinanceModuleScreen> createState() => _FinanceModuleScreenState();
}

class _FinanceModuleScreenState extends ConsumerState<FinanceModuleScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  static const _tabs = [
    'Tableau de Bord',
    'Config. frais',
    'Personnalisations',
    'Comptes élèves',
    'Multi-caisses',
    'Encaissements',
    'Bilan',
    'Recouvrement',
    'Dépenses',
    'Trésorerie',
    'Rapports',
    'Audit',
    'Paramétrage',
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: const AHAppBar(showBackButton: true, title: 'Finances'),
      body: Column(
        children: [
          Container(
            color: Colors.white,
            child: TabBar(
              controller: _tabController,
              labelColor: AHColors.navy,
              unselectedLabelColor: AHColors.grey400,
              indicatorColor: AHColors.gold,
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              labelStyle:
                  const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
              unselectedLabelStyle: const TextStyle(fontSize: 11),
              tabs: _tabs.map((t) => Tab(text: t)).toList(),
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _FinanceDashboardTab(),
                _FeesTab(),
                _OverridesTab(),
                _AccountsTab(),
                _CashRegistersTab(),
                _PaymentsTab(),
                _CollectionSummaryTab(),
                _RecoveryTab(),
                _ExpensesTab(),
                _TreasuryTab(),
                _ReportsTab(),
                _AuditTab(),
                _SettingsTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Tab 1: Tableau de Bord ───────────────────────────────────────────────

class _FinanceDashboardTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final kpis = ref.watch(financeKpisProvider);

    return RefreshIndicator(
      color: AHColors.navy,
      onRefresh: () async => ref.invalidate(financeKpisProvider),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AHSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Vue d\'ensemble financière',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AHColors.navy)),
            const SizedBox(height: AHSpacing.sm),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: AHSpacing.sm,
              crossAxisSpacing: AHSpacing.sm,
              childAspectRatio: 1.3,
              children: [
                _Kpi(
                    label: 'Prévisionnel global',
                    value: formatFCFA(
                        kpis.valueOrNull?.previsonnementGlobal ?? 0),
                    icon: Icons.account_balance,
                    color: const Color(0xFF6366F1),
                    bg: const Color(0xFFEEF2FF)),
                _Kpi(
                    label: 'Réductions',
                    value: formatFCFA(
                        kpis.valueOrNull?.totalReductions ?? 0),
                    icon: Icons.percent,
                    color: const Color(0xFF9333EA),
                    bg: const Color(0xFFFAF5FF)),
                _Kpi(
                    label: 'Prévisionnel net',
                    value: formatFCFA(kpis.valueOrNull?.totalDue ?? 0),
                    icon: Icons.account_balance_wallet,
                    color: const Color(0xFF2563EB),
                    bg: const Color(0xFFEFF6FF)),
                _Kpi(
                    label: 'Total encaissé',
                    value: formatFCFA(
                        kpis.valueOrNull?.totalEncaissement ?? 0),
                    icon: Icons.trending_up,
                    color: const Color(0xFF10B981),
                    bg: const Color(0xFFF0FDF4)),
                _Kpi(
                    label: 'Taux recouvrement',
                    value:
                        '${(kpis.valueOrNull?.tauxRecouvrement ?? 0).toStringAsFixed(1)}%',
                    icon: Icons.bar_chart,
                    color: const Color(0xFFD97706),
                    bg: const Color(0xFFFFFBEB)),
                _Kpi(
                    label: 'Dépenses',
                    value: formatFCFA(
                        kpis.valueOrNull?.totalDepenses ?? 0),
                    icon: Icons.trending_down,
                    color: const Color(0xFFF43F5E),
                    bg: const Color(0xFFFFF1F2)),
                _Kpi(
                    label: 'Solde net',
                    value: formatFCFA(kpis.valueOrNull?.soldeNet ?? 0),
                    icon: Icons.account_balance_wallet,
                    color: (kpis.valueOrNull?.soldeNet ?? 0) >= 0
                        ? const Color(0xFF10B981)
                        : const Color(0xFFDC2626),
                    bg: (kpis.valueOrNull?.soldeNet ?? 0) >= 0
                        ? const Color(0xFFF0FDF4)
                        : const Color(0xFFFEF2F2)),
                _Kpi(
                    label: 'Impayés',
                    value: formatFCFA(kpis.valueOrNull?.totalUnpaid ?? 0),
                    icon: Icons.error_outline,
                    color: const Color(0xFFDC2626),
                    bg: const Color(0xFFFEF2F2)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Kpi extends StatelessWidget {
  const _Kpi({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.bg,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final Color bg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                    color: bg, borderRadius: BorderRadius.circular(6)),
                child: Icon(icon, size: 16, color: color)),
            Text(value,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: value.startsWith('0 ')
                        ? AHColors.grey300
                        : const Color(0xFF0F172A))),
            Text(label,
                style: const TextStyle(fontSize: 9, color: AHColors.grey500)),
          ]),
    );
  }
}

// ── Tab 2: Configuration des frais ───────────────────────────────────────

class _FeesTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/finance/fee-structures',
      titleField: 'name',
      tableColumns: const ['feeType', 'totalAmount', 'level', 'isMandatory'],
      icon: Icons.account_balance,
      createLabel: 'Nouveau frais',
      createFields: const [
        FormFieldDef(key: 'name', label: 'Nom du frais', required: true, hint: 'Ex: Frais d\'inscription'),
        FormFieldDef(key: 'feeType', label: 'Type', type: FieldType.dropdown, options: ['INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'CANTEEN', 'EXAMEN', 'OTHER'], required: true),
        FormFieldDef(key: 'totalAmount', label: 'Montant (F CFA)', type: FieldType.number, required: true),
        FormFieldDef(key: 'isInstallment', label: 'Paiement par tranches', type: FieldType.toggle),
        FormFieldDef(key: 'isMandatory', label: 'Obligatoire', type: FieldType.toggle, initialValue: true),
      ],
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
        const RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
        const RowAction(id: 'copy', icon: Icons.copy, label: 'Copier vers une année', color: Color(0xFF6366F1)),
        const RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
      ],
    );
  }
}

// ── Tab 3: Personnalisations ─────────────────────────────────────────────

class _OverridesTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/finance/fee-structures/override',
      titleField: 'studentName',
      tableColumns: const ['feeStructureName', 'originalAmount', 'personalizedAmount', 'reason'],
      icon: Icons.tune,
      createLabel: 'Nouvelle personnalisation',
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
        const RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
        const RowAction(id: 'import', icon: Icons.upload, label: 'Importer', color: Color(0xFF10B981)),
        const RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
      ],
    );
  }
}

// ── Tab 4: Comptes élèves ────────────────────────────────────────────────

class _AccountsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/finance/student-accounts',
      titleField: 'studentName',
      tableColumns: const ['totalDue', 'totalPaid', 'balance', 'arrears', 'status'],
      icon: Icons.account_circle,
      kpiConfigs: const [
        KpiCardConfig(
            label: 'Élèves',
            apiField: 'totalAccounts',
            icon: Icons.people,
            color: Color(0xFF2563EB),
            bg: Color(0xFFEFF6FF)),
        KpiCardConfig(
            label: 'Total dû',
            apiField: 'globalSums.totalDue',
            icon: Icons.account_balance,
            color: Color(0xFFD97706),
            bg: Color(0xFFFFFBEB)),
        KpiCardConfig(
            label: 'Total payé',
            apiField: 'globalSums.totalPaid',
            icon: Icons.check_circle,
            color: Color(0xFF10B981),
            bg: Color(0xFFF0FDF4)),
        KpiCardConfig(
            label: 'Reste à payer',
            apiField: 'globalSums.balance',
            icon: Icons.error_outline,
            color: Color(0xFFDC2626),
            bg: Color(0xFFFEF2F2)),
      ],
      showCreateButton: false,
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir l\'historique', color: AHColors.navy),
        const RowAction(id: 'unblock', icon: Icons.lock_open, label: 'Débloquer', color: Color(0xFF10B981)),
        const RowAction(id: 'export', icon: Icons.download, label: 'Exporter', color: Color(0xFF64748B)),
      ],
    );
  }
}

// ── Tab 5: Multi-caisses ─────────────────────────────────────────────────

class _CashRegistersTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/finance/cash-registers',
      titleField: 'name',
      tableColumns: const ['code', 'balance', 'isOpen'],
      icon: Icons.point_of_sale,
      createLabel: 'Nouvelle caisse',
      statusFilters: const [
        StatusFilter(id: 'ALL', label: 'Toutes'),
        StatusFilter(id: 'OPEN', label: 'Ouvertes'),
        StatusFilter(id: 'CLOSED', label: 'Fermées'),
      ],
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Statistiques', color: AHColors.navy),
        const RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
        RowAction(
            id: 'close',
            icon: Icons.lock,
            label: 'Fermer',
            color: const Color(0xFFD97706),
            isVisible: (item) => item['isOpen'] == true),
        RowAction(
            id: 'open',
            icon: Icons.lock_open,
            label: 'Ouvrir',
            color: const Color(0xFF10B981),
            isVisible: (item) => item['isOpen'] == false),
        const RowAction(id: 'transfer', icon: Icons.swap_horiz, label: 'Transfert', color: Color(0xFF6366F1)),
      ],
    );
  }
}

// ── Tab 6: Encaissements ─────────────────────────────────────────────────

class _PaymentsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/finance/transactions',
      titleField: 'receiptNumber',
      tableColumns: const ['studentName', 'amount', 'paymentMethod', 'type', 'createdAt'],
      icon: Icons.receipt_long,
      createLabel: 'Nouveau paiement',
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir reçu', color: AHColors.navy),
        const RowAction(id: 'download', icon: Icons.download, label: 'Télécharger reçu', color: Color(0xFF10B981)),
        const RowAction(id: 'email', icon: Icons.email, label: 'Renvoyer email', color: Color(0xFF06B6D4)),
        const RowAction(id: 'whatsapp', icon: Icons.message, label: 'Renvoyer WhatsApp', color: Color(0xFF10B981)),
        const RowAction(id: 'sms', icon: Icons.sms, label: 'Renvoyer SMS', color: Color(0xFFD97706)),
      ],
    );
  }
}

// ── Tab 7: Bilan des encaissements ───────────────────────────────────────

class _CollectionSummaryTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/finance/reports/collection-summary',
      titleField: 'studentName',
      tableColumns: const ['className', 'totalDue', 'totalPaid', 'balance', 'arrears'],
      icon: Icons.summarize,
      showCreateButton: false,
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
        const RowAction(id: 'export_excel', icon: Icons.grid_on, label: 'Excel', color: Color(0xFF10B981)),
        const RowAction(id: 'export_pdf', icon: Icons.picture_as_pdf, label: 'PDF', color: Color(0xFFDC2626)),
        const RowAction(id: 'import', icon: Icons.upload, label: 'Importer', color: Color(0xFF6366F1)),
      ],
    );
  }
}

// ── Tab 8: Recouvrement & Arriérés ───────────────────────────────────────

class _RecoveryTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/finance/reports/arrears',
      titleField: 'studentName',
      tableColumns: const ['className', 'feeName', 'totalDue', 'totalPaid', 'balance', 'arrearsLevel'],
      icon: Icons.trending_down,
      kpiConfigs: const [
        KpiCardConfig(
            label: 'Total arriérés',
            apiField: 'totalArrears',
            icon: Icons.error,
            color: Color(0xFFDC2626),
            bg: Color(0xFFFEF2F2)),
        KpiCardConfig(
            label: 'Taux recouvrement',
            apiField: 'recoveryRate',
            icon: Icons.check_circle,
            color: Color(0xFF10B981),
            bg: Color(0xFFF0FDF4),
            suffix: '%'),
        KpiCardConfig(
            label: 'Arriérés critiques',
            apiField: 'criticalCount',
            icon: Icons.warning,
            color: Color(0xFFD97706),
            bg: Color(0xFFFFFBEB)),
        KpiCardConfig(
            label: 'Élèves concernés',
            apiField: 'studentsWithArrears',
            icon: Icons.people,
            color: Color(0xFF2563EB),
            bg: Color(0xFFEFF6FF)),
      ],
      createLabel: 'Nouvel arriéré',
      statusFilters: const [
        StatusFilter(id: 'ALL', label: 'Tous'),
        StatusFilter(id: 'CRITICAL', label: 'Critiques'),
        StatusFilter(id: 'HIGH', label: 'Élevés'),
        StatusFilter(id: 'MEDIUM', label: 'Moyens'),
        StatusFilter(id: 'LOW', label: 'Faibles'),
      ],
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
        const RowAction(id: 'reminder', icon: Icons.send, label: 'Envoyer rappel', color: Color(0xFF06B6D4)),
        const RowAction(id: 'promise', icon: Icons.handshake, label: 'Promesse', color: Color(0xFF6366F1)),
        const RowAction(id: 'escalate', icon: Icons.arrow_upward, label: 'Escalader', color: Color(0xFFD97706)),
      ],
    );
  }
}

// ── Tab 9: Dépenses ──────────────────────────────────────────────────────

class _ExpensesTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/finance/expenses',
      titleField: 'description',
      tableColumns: const ['category', 'amount', 'expenseDate', 'requester', 'status'],
      icon: Icons.shopping_cart,
      createLabel: 'Nouvelle dépense',
      createFields: const [
        FormFieldDef(key: 'description', label: 'Description', required: true, type: FieldType.textarea, maxLines: 3),
        FormFieldDef(key: 'amount', label: 'Montant (F CFA)', type: FieldType.number, required: true),
        FormFieldDef(key: 'category', label: 'Catégorie', type: FieldType.dropdown, options: ['FOURNITURES', 'MAINTENANCE', 'ENERGIE', 'PERSONNEL', 'TRANSPORT', 'AUTRE'], required: true),
        FormFieldDef(key: 'expenseDate', label: 'Date', type: FieldType.date),
        FormFieldDef(key: 'vendor', label: 'Fournisseur'),
        FormFieldDef(key: 'invoiceRef', label: 'Référence facture'),
      ],
      statusFilters: const [
        StatusFilter(id: 'ALL', label: 'Toutes'),
        StatusFilter(id: 'PENDING', label: 'En attente'),
        StatusFilter(id: 'APPROVED', label: 'Approuvées'),
        StatusFilter(id: 'PAID', label: 'Payées'),
        StatusFilter(id: 'REJECTED', label: 'Refusées'),
      ],
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
        const RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
        RowAction(
            id: 'approve',
            icon: Icons.check_circle,
            label: 'Approuver',
            color: const Color(0xFF10B981),
            isVisible: (item) =>
                item['status']?.toString().toUpperCase() == 'PENDING'),
        RowAction(
            id: 'reject',
            icon: Icons.cancel,
            label: 'Rejeter',
            color: const Color(0xFFDC2626),
            isVisible: (item) =>
                item['status']?.toString().toUpperCase() == 'PENDING'),
        const RowAction(id: 'delete', icon: Icons.delete, label: 'Supprimer', color: Color(0xFFDC2626)),
      ],
    );
  }
}

// ── Tab 10: Clôture & Trésorerie ─────────────────────────────────────────

class _TreasuryTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/finance/treasury-closures',
      titleField: 'closureDate',
      tableColumns: const ['totalReceipts', 'totalExpenses', 'netBalance', 'physicalAmount', 'status'],
      icon: Icons.account_balance_wallet,
      createLabel: 'Nouvelle clôture',
      statusFilters: const [
        StatusFilter(id: 'ALL', label: 'Toutes'),
        StatusFilter(id: 'PENDING', label: 'En attente'),
        StatusFilter(id: 'VALIDATED', label: 'Validées'),
        StatusFilter(id: 'LOCKED', label: 'Verrouillées'),
      ],
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
        RowAction(
            id: 'validate',
            icon: Icons.check_circle,
            label: 'Valider',
            color: const Color(0xFF10B981),
            isVisible: (item) =>
                item['status']?.toString().toUpperCase() == 'PENDING'),
        const RowAction(id: 'export_excel', icon: Icons.grid_on, label: 'Excel', color: Color(0xFF10B981)),
        const RowAction(id: 'export_pdf', icon: Icons.picture_as_pdf, label: 'PDF', color: Color(0xFFDC2626)),
      ],
    );
  }
}

// ── Tab 11: Rapports financiers ─────────────────────────────────────────

class _ReportsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/finance/reports/kpi',
      icon: Icons.bar_chart,
      showCreateButton: false,
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
        const RowAction(id: 'export_excel', icon: Icons.grid_on, label: 'Excel', color: Color(0xFF10B981)),
        const RowAction(id: 'export_pdf', icon: Icons.picture_as_pdf, label: 'PDF', color: Color(0xFFDC2626)),
        const RowAction(id: 'accounting', icon: Icons.calculate, label: 'Export comptable', color: Color(0xFF6366F1)),
      ],
    );
  }
}

// ── Tab 12: Contrôle & Audit ─────────────────────────────────────────────

class _AuditTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/finance/audit/logs',
      titleField: 'entity',
      tableColumns: const ['action', 'user', 'reference', 'createdAt'],
      icon: Icons.fact_check,
      showCreateButton: false,
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
        const RowAction(id: 'export_excel', icon: Icons.grid_on, label: 'Excel', color: Color(0xFF10B981)),
        const RowAction(id: 'export_pdf', icon: Icons.picture_as_pdf, label: 'PDF', color: Color(0xFFDC2626)),
      ],
    );
  }
}

// ── Tab 13: Paramétrage ─────────────────────────────────────────────────

class _SettingsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ModuleDataTab(
      endpoint: '/finance/settings',
      icon: Icons.settings,
      showCreateButton: false,
      rowActions: [
        const RowAction(id: 'view', icon: Icons.visibility, label: 'Voir', color: AHColors.navy),
        const RowAction(id: 'edit', icon: Icons.edit, label: 'Modifier', color: AHColors.navy),
      ],
    );
  }
}
