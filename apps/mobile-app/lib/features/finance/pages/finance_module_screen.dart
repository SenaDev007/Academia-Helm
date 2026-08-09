import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/ah_app_bar.dart';
import '../../../features/dashboard/providers/dashboard_v2_provider.dart';

/// Finance module screen — mirrors the web's FinanceDashboard + tabs.
///
/// 13 sub-tabs (matching web finance/layout.tsx):
/// 1. Tableau de Bord — 7 KPI cards + monthly chart + arrears
/// 2-13. Other tabs (fees, overrides, accounts, cash-registers, payments, etc.)
class FinanceModuleScreen extends ConsumerStatefulWidget {
  const FinanceModuleScreen({super.key});

  @override
  ConsumerState<FinanceModuleScreen> createState() => _FinanceModuleScreenState();
}

class _FinanceModuleScreenState extends ConsumerState<FinanceModuleScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  static const _tabs = [
    'Tableau de Bord', 'Config. frais', 'Personnalisations', 'Comptes élèves',
    'Multi-caisses', 'Encaissements', 'Bilan', 'Recouvrement',
    'Dépenses', 'Trésorerie', 'Rapports', 'Audit', 'Paramétrage',
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
              labelStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
              unselectedLabelStyle: const TextStyle(fontSize: 11),
              tabs: _tabs.map((t) => Tab(text: t)).toList(),
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _FinanceDashboardTab(),
                _PlaceholderTab('Configuration des frais'),
                _PlaceholderTab('Personnalisations'),
                _PlaceholderTab('Comptes élèves'),
                _PlaceholderTab('Multi-caisses'),
                _PlaceholderTab('Encaissements'),
                _PlaceholderTab('Bilan des encaissements'),
                _PlaceholderTab('Recouvrement & Arriérés'),
                _PlaceholderTab('Dépenses'),
                _PlaceholderTab('Clôture & Trésorerie'),
                _PlaceholderTab('Rapports financiers'),
                _PlaceholderTab('Contrôle & Audit'),
                _PlaceholderTab('Paramétrage'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Finance Dashboard Tab ───────────────────────────────────────────────

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
            // 7 KPI cards (matching web FinanceDashboard)
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: AHSpacing.sm,
              crossAxisSpacing: AHSpacing.sm,
              childAspectRatio: 1.3,
              children: [
                _Kpi(label: 'Prévisionnel global', value: formatFCFA(kpis.valueOrNull?.previsonnementGlobal ?? 0),
                  icon: Icons.account_balance, color: const Color(0xFF6366F1), bg: const Color(0xFFEEF2FF)),
                _Kpi(label: 'Réductions', value: formatFCFA(kpis.valueOrNull?.totalReductions ?? 0),
                  icon: Icons.percent, color: const Color(0xFF9333EA), bg: const Color(0xFFFAF5FF)),
                _Kpi(label: 'Prévisionnel net', value: formatFCFA(kpis.valueOrNull?.totalDue ?? 0),
                  icon: Icons.account_balance_wallet, color: const Color(0xFF2563EB), bg: const Color(0xFFEFF6FF)),
                _Kpi(label: 'Total encaissé', value: formatFCFA(kpis.valueOrNull?.totalEncaissement ?? 0),
                  icon: Icons.trending_up, color: const Color(0xFF10B981), bg: const Color(0xFFF0FDF4)),
                _Kpi(label: 'Taux recouvrement', value: '${(kpis.valueOrNull?.tauxRecouvrement ?? 0).toStringAsFixed(1)}%',
                  icon: Icons.bar_chart, color: const Color(0xFFD97706), bg: const Color(0xFFFFFBEB)),
                _Kpi(label: 'Dépenses', value: formatFCFA(kpis.valueOrNull?.totalDepenses ?? 0),
                  icon: Icons.trending_down, color: const Color(0xFFF43F5E), bg: const Color(0xFFFFF1F2)),
                _Kpi(label: 'Solde net', value: formatFCFA(kpis.valueOrNull?.soldeNet ?? 0),
                  icon: Icons.wallet, color: (kpis.valueOrNull?.soldeNet ?? 0) >= 0 ? const Color(0xFF10B981) : const Color(0xFFDC2626),
                  bg: (kpis.valueOrNull?.soldeNet ?? 0) >= 0 ? const Color(0xFFF0FDF4) : const Color(0xFFFEF2F2)),
                _Kpi(label: 'Impayés', value: formatFCFA(kpis.valueOrNull?.totalUnpaid ?? 0),
                  icon: Icons.error_outline, color: const Color(0xFFDC2626), bg: const Color(0xFFFEF2F2)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Kpi extends StatelessWidget {
  const _Kpi({required this.label, required this.value, required this.icon, required this.color, required this.bg});
  final String label, value;
  final IconData icon;
  final Color color, bg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Container(width: 28, height: 28, decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
          child: Icon(icon, size: 16, color: color)),
        Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800,
          color: value.startsWith('0 ') ? AHColors.grey300 : const Color(0xFF0F172A))),
        Text(label, style: const TextStyle(fontSize: 9, color: AHColors.grey500)),
      ]),
    );
  }
}

class _PlaceholderTab extends StatelessWidget {
  const _PlaceholderTab(this.title);
  final String title;

  @override
  Widget build(BuildContext context) {
    return Center(child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.construction, size: 48, color: AHColors.grey300),
        const SizedBox(height: 8),
        Text(title, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AHColors.grey600)),
        const SizedBox(height: 4),
        Text('Module en cours d\'implémentation', style: TextStyle(fontSize: 11, color: AHColors.grey400)),
      ],
    ));
  }
}
