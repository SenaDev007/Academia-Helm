import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../providers/parent_provider.dart';

/// Child Detail screen — mirrors the web's /app/parent/children/[childId].
///
/// 4 tabs:
/// 1. Suivi journalier (today summary: attendance + subjects + homeworks)
/// 2. Assiduité (attendance history with stats)
/// 3. Scolarité (finance breakdown)
/// 4. Notes & Bulletins (grades + bulletins)
class ChildDetailScreen extends ConsumerStatefulWidget {
  const ChildDetailScreen({super.key, required this.child, this.academicYearId});

  final ParentChild child;
  final String? academicYearId;

  @override
  ConsumerState<ChildDetailScreen> createState() => _ChildDetailScreenState();
}

class _ChildDetailScreenState extends ConsumerState<ChildDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final child = widget.child;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: CustomScrollView(
        slivers: [
          // Gradient header with avatar
          SliverAppBar(
            expandedHeight: 200,
            pinned: true,
            backgroundColor: AHColors.navy,
            foregroundColor: Colors.white,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () => Navigator.of(context).pop(),
            ),
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [const Color(0xFF2563EB), const Color(0xFF7C3AED)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: SafeArea(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      _buildAvatar(child),
                      const SizedBox(height: 8),
                      Text(child.displayName,
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
                      const SizedBox(height: 2),
                      Text('${child.className} · ${child.levelName}',
                        style: const TextStyle(fontSize: 12, color: Colors.white70)),
                      if (child.matricule.isNotEmpty)
                        Text('Mat: ${child.matricule}',
                          style: const TextStyle(fontSize: 10, color: Colors.white54)),
                      const SizedBox(height: 12),
                    ],
                  ),
                ),
              ),
            ),
          ),
          // Tab bar
          SliverPersistentHeader(
            pinned: true,
            delegate: _TabBarDelegate(TabBar(
              controller: _tabController,
              labelColor: AHColors.navy,
              unselectedLabelColor: AHColors.grey400,
              indicatorColor: AHColors.gold,
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              tabs: const [
                Tab(text: 'Suivi'),
                Tab(text: 'Assiduité'),
                Tab(text: 'Scolarité'),
                Tab(text: 'Notes'),
              ],
            )),
          ),
          // Tab content
          SliverFillRemaining(
            child: TabBarView(
              controller: _tabController,
              children: [
                _TodayTab(childId: child.id, academicYearId: widget.academicYearId, child: child),
                _AttendanceTab(childId: child.id),
                _FinanceTab(childId: child.id, academicYearId: widget.academicYearId),
                _GradesTab(childId: child.id, academicYearId: widget.academicYearId),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatar(ParentChild child) {
    return Container(
      width: 64, height: 64,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white.withOpacity(0.3), width: 2),
      ),
      child: ClipOval(
        child: (child.avatarUrl != null && child.avatarUrl!.isNotEmpty)
          ? Image.network(child.avatarUrl!, fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => _buildInitials(child))
          : _buildInitials(child),
      ),
    );
  }

  Widget _buildInitials(ParentChild child) {
    return Container(
      decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), shape: BoxShape.circle),
      child: Center(child: Text(child.initials,
        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Colors.white))),
    );
  }
}

// ── Tab 1: Suivi journalier ─────────────────────────────────────────────

class _TodayTab extends ConsumerWidget {
  const _TodayTab({required this.childId, this.academicYearId, required this.child});
  final String childId;
  final String? academicYearId;
  final ParentChild child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final todayAsync = ref.watch(parentTodayProvider((childId: childId, academicYearId: academicYearId)));

    return todayAsync.when(
      data: (summary) {
        if (summary == null) return _buildEmpty('Aucune donnée pour aujourd\'hui');
        return _buildTodayContent(summary);
      },
      loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
      error: (_, __) => _buildEmpty('Erreur de chargement'),
    );
  }

  Widget _buildTodayContent(TodaySummary summary) {
    return ListView(
      padding: const EdgeInsets.all(AHSpacing.md),
      children: [
        // Attendance status
        _buildAttendanceCard(summary.attendanceStatus),
        const SizedBox(height: AHSpacing.md),
        // Scheduled subjects
        if (summary.scheduledSubjects.isNotEmpty) ...[
          const Text('Cours du jour', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AHColors.navy)),
          const SizedBox(height: 8),
          ...summary.scheduledSubjects.map((s) => _SubjectCard(subject: s)),
          const SizedBox(height: AHSpacing.md),
        ],
        // Pending homeworks
        if (summary.pendingHomeworks.isNotEmpty) ...[
          const Text('Devoirs en cours', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AHColors.navy)),
          const SizedBox(height: 8),
          ...summary.pendingHomeworks.map((h) => _HomeworkCard(homework: h)),
        ],
      ],
    );
  }

  Widget _buildAttendanceCard(String status) {
    final isPresent = status.toUpperCase().contains('PRESENT');
    final isAbsent = status.toUpperCase().contains('ABSENT');
    final isLate = status.toUpperCase().contains('LATE');
    final color = isPresent ? const Color(0xFF16A34A) : isAbsent ? const Color(0xFFDC2626) : isLate ? const Color(0xFFF59E0B) : AHColors.grey400;
    final label = isPresent ? 'Présent' : isAbsent ? 'Absent' : isLate ? 'En retard' : 'Non renseigné';

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8), border: Border.all(color: color.withOpacity(0.3))),
      child: Row(children: [
        Icon(isPresent ? Icons.check_circle : isAbsent ? Icons.cancel : Icons.access_time, color: color, size: 24),
        const SizedBox(width: 8),
        Text('Présence du jour: $label', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: color)),
      ]),
    );
  }

  Widget _buildEmpty(String message) {
    return Center(child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.today, size: 48, color: AHColors.grey300),
        const SizedBox(height: 8),
        Text(message, style: TextStyle(fontSize: 13, color: AHColors.grey500)),
      ],
    ));
  }
}

class _SubjectCard extends StatelessWidget {
  const _SubjectCard({required this.subject});
  final TodaySubject subject;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Icons.book, size: 14, color: AHColors.blue),
          const SizedBox(width: 4),
          Expanded(child: Text(subject.subjectName, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)))),
          if (subject.duration.isNotEmpty) Text(subject.duration, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
        ]),
        if (subject.topic.isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(subject.topic, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
        ],
      ]),
    );
  }
}

class _HomeworkCard extends StatelessWidget {
  const _HomeworkCard({required this.homework});
  final TodayHomework homework;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Icons.assignment, size: 14, color: const Color(0xFFF59E0B)),
          const SizedBox(width: 4),
          Expanded(child: Text(homework.title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)))),
        ]),
        if (homework.subject.isNotEmpty) Text(homework.subject, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
      ]),
    );
  }
}

// ── Tab 2: Assiduité ────────────────────────────────────────────────────

class _AttendanceTab extends ConsumerWidget {
  const _AttendanceTab({required this.childId});
  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final attendanceAsync = ref.watch(parentAttendanceProvider(childId));

    return attendanceAsync.when(
      data: (history) {
        if (history == null) return _buildEmpty();
        return _buildAttendanceContent(history);
      },
      loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
      error: (_, __) => _buildEmpty(),
    );
  }

  Widget _buildAttendanceContent(AttendanceHistory history) {
    return ListView(
      padding: const EdgeInsets.all(AHSpacing.md),
      children: [
        // Stats cards
        Row(children: [
          Expanded(child: _StatCard('Total', history.totalDays, const Color(0xFF64748B))),
          const SizedBox(width: 4),
          Expanded(child: _StatCard('Présents', history.presentDays, const Color(0xFF16A34A))),
          const SizedBox(width: 4),
          Expanded(child: _StatCard('Absents', history.absentDays, const Color(0xFFDC2626))),
          const SizedBox(width: 4),
          Expanded(child: _StatCard('Retards', history.lateDays, const Color(0xFFF59E0B))),
        ]),
        const SizedBox(height: AHSpacing.md),
        // Records list
        if (history.records.isEmpty)
          const Text('Aucun enregistrement', style: TextStyle(fontSize: 12, color: AHColors.grey400))
        else
          ...history.records.map((r) => _RecordTile(record: r)),
      ],
    );
  }

  Widget _buildEmpty() {
    return Center(child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.calendar_today, size: 48, color: AHColors.grey300),
        const SizedBox(height: 8),
        const Text('Aucune donnée d\'assiduité', style: TextStyle(fontSize: 13, color: AHColors.grey500)),
      ],
    ));
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard(this.label, this.value, this.color);
  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
      child: Column(children: [
        Text('$value', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: color)),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(fontSize: 8, fontWeight: FontWeight.w600, color: color), textAlign: TextAlign.center),
      ]),
    );
  }
}

class _RecordTile extends StatelessWidget {
  const _RecordTile({required this.record});
  final AttendanceRecord record;

  @override
  Widget build(BuildContext context) {
    final isPresent = record.status.toUpperCase().contains('PRESENT');
    final isAbsent = record.status.toUpperCase().contains('ABSENT');
    final color = isPresent ? const Color(0xFF16A34A) : isAbsent ? const Color(0xFFDC2626) : const Color(0xFFF59E0B);

    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Row(children: [
        Icon(isPresent ? Icons.check_circle : isAbsent ? Icons.cancel : Icons.access_time, color: color, size: 18),
        const SizedBox(width: 8),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${record.date.day}/${record.date.month}/${record.date.year}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
          if (record.detail.isNotEmpty) Text(record.detail, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
        ])),
        Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
          child: Text(record.status, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: color))),
      ]),
    );
  }
}

// ── Tab 3: Scolarité (Finance) ──────────────────────────────────────────

class _FinanceTab extends ConsumerWidget {
  const _FinanceTab({required this.childId, this.academicYearId});
  final String childId;
  final String? academicYearId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final financeAsync = ref.watch(parentFinanceProvider((childId: childId, academicYearId: academicYearId)));

    return financeAsync.when(
      data: (breakdown) {
        if (breakdown == null) return _buildEmpty();
        return _buildFinanceContent(breakdown);
      },
      loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
      error: (_, __) => _buildEmpty(),
    );
  }

  Widget _buildFinanceContent(FinanceBreakdown breakdown) {
    return ListView(
      padding: const EdgeInsets.all(AHSpacing.md),
      children: [
        // Récapitulatif
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: AHColors.navy, borderRadius: BorderRadius.circular(8)),
          child: Column(children: [
            Row(children: [
              Expanded(child: _FinanceStat('Total dû', breakdown.totalDue)),
              Expanded(child: _FinanceStat('Payé', breakdown.totalPaid, color: const Color(0xFF16A34A))),
              Expanded(child: _FinanceStat('Restant', breakdown.remaining, color: breakdown.remaining > 0 ? const Color(0xFFDC2626) : const Color(0xFF16A34A))),
            ]),
          ]),
        ),
        if (breakdown.accountBlocked) ...[
          const SizedBox(height: 8),
          Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(6)),
            child: const Row(children: [
              Icon(Icons.block, color: Color(0xFFDC2626), size: 16),
              SizedBox(width: 4),
              Text('Compte bloqué', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFDC2626))),
            ])),
        ],
        const SizedBox(height: AHSpacing.md),
        // Fee items
        if (breakdown.fees.isNotEmpty) ...[
          const Text('Frais détaillés', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AHColors.navy)),
          const SizedBox(height: 8),
          ...breakdown.fees.map((f) => _FeeTile(fee: f)),
        ],
        // Arrears
        if (breakdown.arrears.isNotEmpty) ...[
          const SizedBox(height: AHSpacing.md),
          const Text('Arriérés', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AHColors.navy)),
          const SizedBox(height: 8),
          ...breakdown.arrears.map((a) => _ArrearTile(arrear: a)),
        ],
      ],
    );
  }

  Widget _buildEmpty() {
    return Center(child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.credit_card, size: 48, color: AHColors.grey300),
        const SizedBox(height: 8),
        const Text('Aucune donnée financière', style: TextStyle(fontSize: 13, color: AHColors.grey500)),
      ],
    ));
  }
}

class _FinanceStat extends StatelessWidget {
  const _FinanceStat(this.label, this.amount, {this.color = Colors.white});
  final String label;
  final double amount;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Text('${amount.toStringAsFixed(0)} FCFA', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: color)),
      const SizedBox(height: 2),
      Text(label, style: TextStyle(fontSize: 9, color: Colors.white70)),
    ]);
  }
}

class _FeeTile extends StatelessWidget {
  const _FeeTile({required this.fee});
  final FeeItem fee;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(fee.label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
          if (fee.overridden) Text('Montant modifié', style: const TextStyle(fontSize: 9, color: Color(0xFFF59E0B))),
        ])),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text('${fee.amount.toStringAsFixed(0)} FCFA', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: fee.isFullyPaid ? const Color(0xFF16A34A) : const Color(0xFF0F172A))),
          if (fee.paid > 0) Text('Payé: ${fee.paid.toStringAsFixed(0)}', style: const TextStyle(fontSize: 9, color: Color(0xFF64748B))),
        ]),
      ]),
    );
  }
}

class _ArrearTile extends StatelessWidget {
  const _ArrearTile({required this.arrear});
  final ArrearItem arrear;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(8)),
      child: Row(children: [
        Expanded(child: Text(arrear.academicYear, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFFDC2626)))),
        Text('${arrear.balance.toStringAsFixed(0)} FCFA', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFFDC2626))),
      ]),
    );
  }
}

// ── Tab 4: Notes & Bulletins ───────────────────────────────────────────

class _GradesTab extends ConsumerWidget {
  const _GradesTab({required this.childId, this.academicYearId});
  final String childId;
  final String? academicYearId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.grade, size: 48, color: AHColors.grey300),
          const SizedBox(height: 8),
          const Text('Notes & Bulletins', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AHColors.grey600)),
          const SizedBox(height: 4),
          const Text('Serait disponible après importation des notes',
            textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: AHColors.grey400)),
        ],
      ),
    );
  }
}

// ── TabBar Delegate ────────────────────────────────────────────────────

class _TabBarDelegate extends SliverPersistentHeaderDelegate {
  _TabBarDelegate(this._tabBar);
  final TabBar _tabBar;

  @override
  double get minExtent => _tabBar.preferredSize.height;
  @override
  double get maxExtent => _tabBar.preferredSize.height;
  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(color: Colors.white, child: _tabBar);
  }
  @override
  bool shouldRebuild(_TabBarDelegate oldDelegate) => false;
}
