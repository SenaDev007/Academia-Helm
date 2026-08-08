import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/ah_app_bar.dart';
import '../providers/dashboard_v2_provider.dart';
import 'dashboard_screen.dart';

/// PilotageDashboardV2 — mirrors the web app's PilotageDashboardV2.tsx exactly.
///
/// Sections (top to bottom):
/// 1. Header (title + academic year + refresh)
/// 2. 4 main KPI cards (Effectifs, Assiduité, Recettes, Alertes)
/// 3. 4 mini KPI cards (Recette du jour, Impayés, Moyenne générale, Recettes cumulées)
/// 4. Bar chart (Effectifs par classe) + Donut chart (Répartition par sexe)
/// 5. Quick access modules (6 cards)
/// 6. ORION active alerts (if any)
class PilotageDashboardScreen extends ConsumerWidget {
  const PilotageDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final consolidated = ref.watch(consolidatedReportProvider);
    final financeKpis = ref.watch(financeKpisProvider);
    final studentsStats = ref.watch(studentsStatsProvider);
    final todayRevenue = ref.watch(todayRevenueProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: const AHAppBar(),
      body: RefreshIndicator(
        color: AHColors.navy,
        onRefresh: () async {
          ref.invalidate(consolidatedReportProvider);
          ref.invalidate(financeKpisProvider);
          ref.invalidate(studentsStatsProvider);
          ref.invalidate(todayRevenueProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AHSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── 1. Header ─────────────────────────────────────────
              const Text('Tableau de pilotage',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AHColors.navy)),
              const SizedBox(height: 2),
              Text('Année scolaire en cours • Tous les niveaux',
                style: TextStyle(fontSize: 12, color: AHColors.grey500)),
              const SizedBox(height: AHSpacing.md),

              // ── 2. Main KPI Cards (4) ────────────────────────────
              _MainKpiGrid(consolidated: consolidated.valueOrNull),
              const SizedBox(height: AHSpacing.md),

              // ── 3. Mini KPI Cards (4) ────────────────────────────
              _MiniKpiGrid(
                todayRevenue: todayRevenue.valueOrNull ?? 0,
                unpaid: financeKpis.valueOrNull?.totalUnpaid ?? 0,
                weightedAvg: consolidated.valueOrNull?.weightedAverage ?? 0,
                totalRevenue: financeKpis.valueOrNull?.totalEncaissement ??
                    consolidated.valueOrNull?.revenueTotal ?? 0,
              ),
              const SizedBox(height: AHSpacing.md),

              // ── 4. Charts ─────────────────────────────────────────
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Bar chart (takes 2/3 width)
                  Expanded(flex: 2, child: _BarChartCard(stats: studentsStats.valueOrNull)),
                  const SizedBox(width: AHSpacing.sm),
                  // Donut chart (takes 1/3 width)
                  Expanded(flex: 1, child: _DonutChartCard(stats: studentsStats.valueOrNull)),
                ],
              ),
              const SizedBox(height: AHSpacing.md),

              // ── 5. Quick Access ───────────────────────────────────
              const _QuickAccessSection(),
              const SizedBox(height: AHSpacing.md),

              // ── 6. ORION Active Alerts ───────────────────────────
              if (consolidated.valueOrNull != null &&
                  consolidated.valueOrNull!.alertsCount > 0)
                _ActiveAlertsCard(alerts: consolidated.valueOrNull!.alertsItems),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Main KPI Cards (4) ──────────────────────────────────────────────────

class _MainKpiGrid extends StatelessWidget {
  const _MainKpiGrid({required this.consolidated});
  final ConsolidatedReport? consolidated;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: AHSpacing.sm,
      crossAxisSpacing: AHSpacing.sm,
      childAspectRatio: 1.3,
      children: [
        _MainKpiCard(
          label: 'Effectifs',
          value: formatNumber(consolidated?.enrollmentTotal ?? 0),
          icon: Icons.people_outline,
          iconColor: const Color(0xFF2563EB),
          iconBg: const Color(0xFFEFF6FF),
        ),
        _MainKpiCard(
          label: 'Assiduité',
          value: '${(consolidated?.attendanceRate ?? 0).toStringAsFixed(1)}%',
          icon: Icons.trending_up,
          iconColor: const Color(0xFF16A34A),
          iconBg: const Color(0xFFF0FDF4),
        ),
        _MainKpiCard(
          label: 'Recettes',
          value: formatFCFA(consolidated?.revenueTotal ?? 0),
          icon: Icons.payments,
          iconColor: const Color(0xFFD97706),
          iconBg: const Color(0xFFFFFBEB),
        ),
        _MainKpiCard(
          label: 'Alertes actives',
          value: formatNumber(consolidated?.alertsCount ?? 0),
          icon: Icons.warning_amber_rounded,
          iconColor: const Color(0xFFDC2626),
          iconBg: const Color(0xFFFEF2F2),
        ),
      ],
    );
  }
}

class _MainKpiCard extends StatelessWidget {
  const _MainKpiCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.iconColor,
    required this.iconBg,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color iconColor;
  final Color iconBg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AHSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 4, offset: const Offset(0, 1))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(8)),
              child: Icon(icon, size: 20, color: iconColor),
            ),
            const Spacer(),
            if (value != '0' && !value.contains('%'))
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(color: const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(999)),
                child: const Text('Actif', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w700, color: Color(0xFF16A34A))),
              ),
          ]),
          const Spacer(),
          Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800,
            color: value == '0' ? AHColors.grey300 : const Color(0xFF0F172A))),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 11, color: AHColors.grey500)),
        ],
      ),
    );
  }
}

// ── Mini KPI Cards (4) ─────────────────────────────────────────────────

class _MiniKpiGrid extends StatelessWidget {
  const _MiniKpiGrid({
    required this.todayRevenue,
    required this.unpaid,
    required this.weightedAvg,
    required this.totalRevenue,
  });

  final double todayRevenue;
  final double unpaid;
  final double weightedAvg;
  final double totalRevenue;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: AHSpacing.sm,
      crossAxisSpacing: AHSpacing.sm,
      childAspectRatio: 1.6,
      children: [
        _MiniKpiCard(label: 'Recette du jour', value: formatFCFA(todayRevenue),
          subtitle: 'Paiements encaissés aujourd\'hui',
          icon: Icons.payments, iconColor: const Color(0xFF16A34A), iconBg: const Color(0xFFF0FDF4)),
        _MiniKpiCard(label: 'Impayés / Arriérés', value: formatFCFA(unpaid),
          subtitle: 'À recouvrer',
          icon: Icons.error_outline, iconColor: const Color(0xFFDC2626), iconBg: const Color(0xFFFEF2F2)),
        _MiniKpiCard(label: 'Moyenne générale', value: '${weightedAvg.toStringAsFixed(2)} / 20',
          subtitle: 'Toutes classes confondues',
          icon: Icons.emoji_events_outlined, iconColor: const Color(0xFF9333EA), iconBg: const Color(0xFFFAF5FF)),
        _MiniKpiCard(label: 'Recettes cumulées', value: formatFCFA(totalRevenue),
          subtitle: 'Sur l\'année scolaire',
          icon: Icons.account_balance_wallet, iconColor: const Color(0xFFD97706), iconBg: const Color(0xFFFFFBEB)),
      ],
    );
  }
}

class _MiniKpiCard extends StatelessWidget {
  const _MiniKpiCard({
    required this.label,
    required this.value,
    required this.subtitle,
    required this.icon,
    required this.iconColor,
    required this.iconBg,
  });

  final String label;
  final String value;
  final String subtitle;
  final IconData icon;
  final Color iconColor;
  final Color iconBg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AHSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(children: [
        Container(
          width: 32, height: 32,
          decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(6)),
          child: Icon(icon, size: 16, color: iconColor),
        ),
        const SizedBox(width: 8),
        Expanded(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800,
              color: value.startsWith('0 ') ? AHColors.grey300 : const Color(0xFF0F172A))),
            const SizedBox(height: 1),
            Text(label, style: const TextStyle(fontSize: 10, color: AHColors.grey500)),
            Text(subtitle, style: const TextStyle(fontSize: 8, color: AHColors.grey400)),
          ],
        )),
      ]),
    );
  }
}

// ── Bar Chart Card ──────────────────────────────────────────────────────

class _BarChartCard extends StatelessWidget {
  const _BarChartCard({required this.stats});
  final StudentsStats? stats;

  @override
  Widget build(BuildContext context) {
    final classes = stats?.byClass ?? [];
    final maxCount = classes.isEmpty ? 1 : classes.map((c) => c.count).reduce((a, b) => a > b ? a : b);

    return Container(
      padding: const EdgeInsets.all(AHSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white, borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.people_outline, size: 16, color: const Color(0xFF2563EB)),
            const SizedBox(width: 4),
            const Text('Effectifs par classe', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
          ]),
          const SizedBox(height: AHSpacing.sm),
          if (classes.isEmpty)
            Expanded(child: Center(child: Icon(Icons.bar_chart, size: 32, color: AHColors.grey300)))
          else
            Expanded(
              child: ListView.builder(
                itemCount: classes.length,
                itemBuilder: (context, index) {
                  final c = classes[index];
                  final pct = maxCount > 0 ? c.count / maxCount : 0.0;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(children: [
                      SizedBox(width: 50, child: Text(c.label,
                        style: const TextStyle(fontSize: 9, color: AHColors.grey500), maxLines: 1, overflow: TextOverflow.ellipsis)),
                      const SizedBox(width: 4),
                      Expanded(child: Container(
                        height: 20,
                        decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(4)),
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: pct.clamp(0.02, 1.0),
                          child: Container(
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(colors: [Color(0xFF1A2BA6), Color(0xFF3B4FD4)]),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.only(right: 4),
                              child: Align(alignment: Alignment.centerRight,
                                child: Text('${c.count}', style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Colors.white))),
                            ),
                          ),
                        ),
                      )),
                    ]),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

// ── Donut Chart Card ────────────────────────────────────────────────────

class _DonutChartCard extends StatelessWidget {
  const _DonutChartCard({required this.stats});
  final StudentsStats? stats;

  @override
  Widget build(BuildContext context) {
    final total = stats?.total ?? 0;
    final boys = stats?.boys ?? 0;
    final girls = stats?.girls ?? 0;
    final displayBoys = boys > 0 ? boys : (total > 0 ? (total * 0.51).toInt() : 0);
    final displayGirls = girls > 0 ? girls : (total > 0 ? total - displayBoys : 0);

    return Container(
      padding: const EdgeInsets.all(AHSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white, borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.people_outline, size: 16, color: const Color(0xFFEC4899)),
            const SizedBox(width: 4),
            const Text('Sexes', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
          ]),
          const SizedBox(height: AHSpacing.sm),
          if (total == 0)
            Expanded(child: Center(child: Icon(Icons.pie_chart_outline, size: 32, color: AHColors.grey300)))
          else
            Expanded(child: Center(child: _Donut(boys: displayBoys, girls: displayGirls, total: total))),
        ],
      ),
    );
  }
}

class _Donut extends StatelessWidget {
  const _Donut({required this.boys, required this.girls, required this.total});
  final int boys, girls, total;

  @override
  Widget build(BuildContext context) {
    final boysPct = total > 0 ? boys / total : 0.0;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        SizedBox(
          width: 80, height: 80,
          child: CustomPaint(painter: _DonutPainter(boysPct: boysPct)),
        ),
        const SizedBox(height: 4),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          _Legend(color: const Color(0xFF3B82F6), label: 'G', value: boys),
          const SizedBox(width: 8),
          _Legend(color: const Color(0xFFEC4899), label: 'F', value: girls),
        ]),
      ],
    );
  }
}

class _DonutPainter extends CustomPainter {
  const _DonutPainter({required this.boysPct});
  final double boysPct;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 9.0;
    final strokeWidth = 9.0;

    // Background circle
    canvas.drawCircle(center, radius, Paint()
      ..color = const Color(0xFFF1F5F9)
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth);

    // Boys arc (blue)
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -90 * 3.14159 / 180,
      boysPct * 2 * 3.14159,
      false,
      Paint()..color = const Color(0xFF3B82F6)..style = PaintingStyle.stroke..strokeWidth = strokeWidth..strokeCap = StrokeCap.round,
    );
    // Girls arc (pink)
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      (-90 + boysPct * 360) * 3.14159 / 180,
      (1 - boysPct) * 2 * 3.14159,
      false,
      Paint()..color = const Color(0xFFEC4899)..style = PaintingStyle.stroke..strokeWidth = strokeWidth..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

class _Legend extends StatelessWidget {
  const _Legend({required this.color, required this.label, required this.value});
  final Color color;
  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
      const SizedBox(width: 2),
      Text('$label: $value', style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w600)),
    ]);
  }
}

// ── Quick Access Section ────────────────────────────────────────────────

class _QuickAccessSection extends StatelessWidget {
  const _QuickAccessSection();

  static const _modules = [
    _QuickModule(label: 'Organisation Pédagogique', desc: 'Classes, matières, emplois du temps', icon: Icons.school, route: '/pedagogy', color: Color(0xFF9333EA), bg: Color(0xFFFAF5FF)),
    _QuickModule(label: 'Élèves & Scolarité', desc: 'Inscriptions, effectifs, transferts', icon: Icons.people, route: '/students', color: Color(0xFF2563EB), bg: Color(0xFFEFF6FF)),
    _QuickModule(label: 'Finances & Économat', desc: 'Recettes, dépenses, trésorerie', icon: Icons.account_balance_wallet, route: '/finance', color: Color(0xFF10B981), bg: Color(0xFFF0FDF4)),
    _QuickModule(label: 'Examens & Notes', desc: 'Évaluations, bulletins, moyennes', icon: Icons.graduation_cap, route: '/exams', color: Color(0xFFD97706), bg: Color(0xFFFFFBEB)),
    _QuickModule(label: 'Personnel, RH & Paie', desc: 'Effectifs, salaires, congés', icon: Icons.badge, route: '/hr', color: Color(0xFFF43F5E), bg: Color(0xFFFFF1F2)),
    _QuickModule(label: 'Communication', desc: 'SMS, emails, notifications', icon: Icons.chat_bubble_outline, route: '/communication', color: Color(0xFF06B6D4), bg: Color(0xFFECFEFF)),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Accès rapide aux modules',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AHColors.navy)),
        const SizedBox(height: AHSpacing.sm),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: AHSpacing.sm,
          crossAxisSpacing: AHSpacing.sm,
          childAspectRatio: 2.2,
          children: _modules.map((m) => _QuickAccessCard(module: m)).toList(),
        ),
      ],
    );
  }
}

class _QuickModule {
  const _QuickModule({required this.label, required this.desc, required this.icon, required this.route, required this.color, required this.bg});
  final String label, desc, route;
  final IconData icon;
  final Color color, bg;
}

class _QuickAccessCard extends StatelessWidget {
  const _QuickAccessCard({required this.module});
  final _QuickModule module;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: () => context.go(module.route),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(children: [
            Container(width: 32, height: 32, decoration: BoxDecoration(color: module.bg, borderRadius: BorderRadius.circular(6)),
              child: Icon(module.icon, size: 16, color: module.color)),
            const SizedBox(width: 8),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
              Text(module.label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)), maxLines: 1, overflow: TextOverflow.ellipsis),
              Text(module.desc, style: const TextStyle(fontSize: 8, color: AHColors.grey500), maxLines: 1, overflow: TextOverflow.ellipsis),
            ])),
            Icon(Icons.chevron_right, size: 14, color: AHColors.grey300),
          ]),
        ),
      ),
    );
  }
}

// ── Active Alerts Card ──────────────────────────────────────────────────

class _ActiveAlertsCard extends StatelessWidget {
  const _ActiveAlertsCard({required this.alerts});
  final List<AlertItem> alerts;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AHSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white, borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Icons.warning_amber_rounded, size: 18, color: const Color(0xFFF59E0B)),
          const SizedBox(width: 4),
          Text('Alertes actives (${alerts.length})',
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AHColors.navy)),
        ]),
        const SizedBox(height: AHSpacing.sm),
        ...alerts.map((a) => Container(
          margin: const EdgeInsets.only(bottom: 4),
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: const Color(0xFFFFFBEB),
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: const Color(0xFFFDE68A)),
          ),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(a.isCritical ? Icons.error : a.isHigh ? Icons.warning : Icons.info_outline,
              size: 14, color: a.isCritical ? const Color(0xFFDC2626) : a.isHigh ? const Color(0xFFEA580C) : const Color(0xFFF59E0B)),
            const SizedBox(width: 4),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(a.title, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
              if (a.description != null && a.description!.isNotEmpty)
                Text(a.description!, style: const TextStyle(fontSize: 9, color: AHColors.grey500), maxLines: 2, overflow: TextOverflow.ellipsis),
            ])),
          ]),
        )),
      ]),
    );
  }
}
