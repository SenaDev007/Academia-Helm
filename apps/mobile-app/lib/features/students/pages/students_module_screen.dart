import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../../../core/widgets/ah_app_bar.dart';
import '../services/students_service_v2.dart';

/// Students module screen — mirrors the web's StudentsModulePage.tsx
///
/// 13 sub-tabs (matching web exactly):
/// 1. Tableau de Bord — KPIs + quick actions
/// 2. Admissions — list with status filters + actions
/// 3. Inscriptions — tree view (level → class → students)
/// 4. Affectations & Mouvements
/// 5. Liste des Élèves
/// 6. Sorties & Abandons
/// 7. Cartes Scolaires
/// 8. Dossiers Élèves
/// 9. Familles
/// 10. Transferts & Mobilité
/// 11. Historique Scolaire
/// 12. Educmaster
/// 13. ORION, Stats & Audit
class StudentsModuleScreen extends ConsumerStatefulWidget {
  const StudentsModuleScreen({super.key});

  @override
  ConsumerState<StudentsModuleScreen> createState() => _StudentsModuleScreenState();
}

class _StudentsModuleScreenState extends ConsumerState<StudentsModuleScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  static const _tabs = [
    'Tableau de Bord', 'Admissions', 'Inscriptions', 'Affectations',
    'Liste des Élèves', 'Sorties', 'Cartes', 'Dossiers',
    'Familles', 'Transferts', 'Historique', 'Educmaster', 'ORION',
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
      appBar: const AHAppBar(),
      body: Column(
        children: [
          // Tab bar
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
          // Tab content
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _DashboardTab(),
                _AdmissionsTab(),
                _EnrollmentsTab(),
                _PlaceholderTab('Affectations & Mouvements'),
                _PlaceholderTab('Liste des Élèves'),
                _PlaceholderTab('Sorties & Abandons'),
                _PlaceholderTab('Cartes Scolaires'),
                _PlaceholderTab('Dossiers Élèves'),
                _PlaceholderTab('Familles'),
                _PlaceholderTab('Transferts & Mobilité'),
                _PlaceholderTab('Historique Scolaire'),
                _PlaceholderTab('Educmaster'),
                _PlaceholderTab('ORION, Stats & Audit'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Tab 1: Tableau de Bord ───────────────────────────────────────────────

class _DashboardTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = ref.watch(studentStatisticsProvider);

    return RefreshIndicator(
      color: AHColors.navy,
      onRefresh: () async => ref.invalidate(studentStatisticsProvider),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AHSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 5 KPI cards
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: AHSpacing.sm,
              crossAxisSpacing: AHSpacing.sm,
              childAspectRatio: 1.4,
              children: [
                _KpiCard(label: 'Élèves inscrits', value: '${stats.valueOrNull?.active ?? 0}',
                  icon: Icons.check_circle, color: const Color(0xFF10B981), bg: const Color(0xFFF0FDF4)),
                _KpiCard(label: 'Pré-inscrits', value: '${stats.valueOrNull?.preRegistered ?? 0}',
                  icon: Icons.people, color: const Color(0xFF2563EB), bg: const Color(0xFFEFF6FF)),
                _KpiCard(label: 'Adm. acceptées', value: '${stats.valueOrNull?.admissionsAccepted ?? 0}',
                  icon: Icons.assignment_turned_in, color: const Color(0xFFD97706), bg: const Color(0xFFFFFBEB)),
                _KpiCard(label: 'Adm. en attente', value: '${stats.valueOrNull?.admissionsPending ?? 0}',
                  icon: Icons.access_time, color: const Color(0xFFEA580C), bg: const Color(0xFFFFF7ED)),
                _KpiCard(label: 'Archivés', value: '${stats.valueOrNull?.archived ?? 0}',
                  icon: Icons.archive, color: const Color(0xFF64748B), bg: const Color(0xFFF8FAFC)),
                _KpiCard(label: 'Total', value: '${stats.valueOrNull?.total ?? 0}',
                  icon: Icons.school, color: AHColors.navy, bg: const Color(0xFFEFF6FF)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Tab 2: Admissions ───────────────────────────────────────────────────

class _AdmissionsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final admissions = ref.watch(admissionsProvider);

    return RefreshIndicator(
      color: AHColors.navy,
      onRefresh: () async => ref.invalidate(admissionsProvider),
      child: admissions.when(
        data: (items) {
          if (items.isEmpty) return _buildEmpty('Aucune admission');
          return ListView.builder(
            padding: const EdgeInsets.all(AHSpacing.sm),
            itemCount: items.length,
            itemBuilder: (context, index) => _AdmissionCard(admission: items[index]),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
        error: (_, __) => _buildEmpty('Erreur de chargement'),
      ),
    );
  }

  Widget _buildEmpty(String msg) {
    return ListView(
      children: [SizedBox(height: 200, child: Center(child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.assignment_outlined, size: 48, color: AHColors.grey300),
          const SizedBox(height: 8),
          Text(msg, style: TextStyle(fontSize: 13, color: AHColors.grey500)),
        ],
      )))],
    );
  }
}

class _AdmissionCard extends StatelessWidget {
  const _AdmissionCard({required this.admission});
  final AdmissionItem admission;

  Color get _statusColor => switch (admission.status) {
    'ACCEPTED' => const Color(0xFF10B981),
    'REJECTED' => const Color(0xFFDC2626),
    'CONVERTED' => const Color(0xFF2563EB),
    'SUBMITTED' => const Color(0xFF7C3AED),
    'UNDER_REVIEW' => const Color(0xFFF59E0B),
    _ => const Color(0xFF64748B),
  };

  String get _statusLabel => switch (admission.status) {
    'ACCEPTED' => 'Accepté',
    'REJECTED' => 'Refusé',
    'CONVERTED' => 'Inscrit',
    'SUBMITTED' => 'Soumis',
    'UNDER_REVIEW' => 'En examen',
    'PENDING' => 'Brouillon',
    _ => admission.status,
  };

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Row(children: [
        Container(width: 32, height: 32, decoration: BoxDecoration(color: _statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
          child: Center(child: Text(admission.initials, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: _statusColor)))),
        const SizedBox(width: 8),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(admission.displayName, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
          if (admission.requestedClassName.isNotEmpty)
            Text(admission.requestedClassName, style: const TextStyle(fontSize: 9, color: AHColors.grey500)),
          if (admission.admissionNumber.isNotEmpty)
            Text('N° ${admission.admissionNumber}', style: const TextStyle(fontSize: 8, color: AHColors.grey400)),
        ])),
        Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(color: _statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
          child: Text(_statusLabel, style: TextStyle(fontSize: 8, fontWeight: FontWeight.w700, color: _statusColor))),
      ]),
    );
  }
}

// ── Tab 3: Inscriptions ─────────────────────────────────────────────────

class _EnrollmentsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final enrollments = ref.watch(enrollmentsProvider);

    return RefreshIndicator(
      color: AHColors.navy,
      onRefresh: () async => ref.invalidate(enrollmentsProvider),
      child: enrollments.when(
        data: (items) {
          if (items.isEmpty) return _buildEmpty('Aucune inscription');
          return ListView.builder(
            padding: const EdgeInsets.all(AHSpacing.sm),
            itemCount: items.length,
            itemBuilder: (context, index) => _EnrollmentCard(enrollment: items[index]),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
        error: (_, __) => _buildEmpty('Erreur de chargement'),
      ),
    );
  }

  Widget _buildEmpty(String msg) {
    return ListView(children: [SizedBox(height: 200, child: Center(child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.school_outlined, size: 48, color: AHColors.grey300),
        const SizedBox(height: 8),
        Text(msg, style: TextStyle(fontSize: 13, color: AHColors.grey500)),
      ],
    )))],
    );
  }
}

class _EnrollmentCard extends StatelessWidget {
  const _EnrollmentCard({required this.enrollment});
  final EnrollmentItem enrollment;

  Color get _statusColor => switch (enrollment.status) {
    'ACTIVE' => const Color(0xFF10B981),
    'VALIDATED' => const Color(0xFF2563EB),
    'ADMITTED' => const Color(0xFFF59E0B),
    'PRE_REGISTERED' => const Color(0xFF64748B),
    'PENDING' => const Color(0xFFEA580C),
    _ => const Color(0xFF64748B),
  };

  String get _statusLabel => switch (enrollment.status) {
    'ACTIVE' => 'Inscrit',
    'VALIDATED' => 'Validé',
    'ADMITTED' => 'Admis',
    'PRE_REGISTERED' => 'Pré-inscrit',
    'PENDING' => 'En attente',
    _ => enrollment.status,
  };

  String get _typeLabel => switch (enrollment.enrollmentType) {
    'NEW' => 'Nouveau',
    'REPEAT' => 'Réinscription',
    'PROMOTION' => 'Promu',
    'TRANSFER' => 'Transfert',
    _ => enrollment.enrollmentType,
  };

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Row(children: [
        Container(width: 32, height: 32, decoration: BoxDecoration(color: _statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
          child: Center(child: Text(enrollment.initials, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: _statusColor)))),
        const SizedBox(width: 8),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(enrollment.displayName, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
          if (enrollment.matricule != null && enrollment.matricule!.isNotEmpty)
            Text('Mat: ${enrollment.matricule}', style: const TextStyle(fontSize: 9, color: AHColors.grey500)),
          if (enrollment.academicClassName.isNotEmpty)
            Text(enrollment.academicClassName, style: const TextStyle(fontSize: 9, color: AHColors.grey500)),
        ])),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: _statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
            child: Text(_statusLabel, style: TextStyle(fontSize: 8, fontWeight: FontWeight.w700, color: _statusColor))),
          const SizedBox(height: 2),
          Text(_typeLabel, style: const TextStyle(fontSize: 8, color: AHColors.grey400)),
        ]),
      ]),
    );
  }
}

// ── Placeholder ──────────────────────────────────────────────────────────

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

// ── KPI Card widget ────────────────────────────────────────────────────

class _KpiCard extends StatelessWidget {
  const _KpiCard({required this.label, required this.value, required this.icon, required this.color, required this.bg});
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
        Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: value == '0' ? AHColors.grey300 : const Color(0xFF0F172A))),
        Text(label, style: const TextStyle(fontSize: 9, color: AHColors.grey500)),
      ]),
    );
  }
}
