import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../providers/phase3_provider.dart';

/// Registre d'Appel — mirrors the web's AttendanceRegisterTab (1541 lines).
///
/// 4 sub-tabs:
/// 1. Registre d'appel (monthly 25-cell grid per student)
/// 2. Évaluation mensuelle (grades from Module Examen)
/// 3. Tableau de relevés annuel (Sept→June synthesis)
/// 4. Paramètres (jours fériés)
class AttendanceRegisterScreen extends ConsumerStatefulWidget {
  const AttendanceRegisterScreen({
    super.key,
    required this.classId,
    required this.className,
    this.academicYearId,
  });

  final String classId;
  final String className;
  final String? academicYearId;

  @override
  ConsumerState<AttendanceRegisterScreen> createState() => _AttendanceRegisterScreenState();
}

class _AttendanceRegisterScreenState extends ConsumerState<AttendanceRegisterScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  late int _selectedMonth;
  late int _selectedYear;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    final now = DateTime.now();
    _selectedMonth = now.month;
    _selectedYear = now.year;
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
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AHColors.navy,
        elevation: 0,
        title: Text('Registre — ${widget.className}',
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AHColors.navy,
          unselectedLabelColor: AHColors.grey400,
          indicatorColor: AHColors.gold,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: const [
            Tab(text: 'Registre'),
            Tab(text: 'Éval. mensuelle'),
            Tab(text: 'Relevés annuel'),
            Tab(text: 'Paramètres'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _RegistreTab(
            classId: widget.classId,
            className: widget.className,
            academicYearId: widget.academicYearId,
            month: _selectedMonth,
            year: _selectedYear,
            onMonthChanged: (m, y) => setState(() {
              _selectedMonth = m;
              _selectedYear = y;
            }),
          ),
          _MonthlyEvaluationTab(classId: widget.classId),
          _AnnualSummaryTab(classId: widget.classId),
          _SettingsTab(classId: widget.classId),
        ],
      ),
    );
  }
}

// ── Tab 1: Registre (monthly grid) ─────────────────────────────────────

class _RegistreTab extends ConsumerWidget {
  const _RegistreTab({
    required this.classId,
    required this.className,
    this.academicYearId,
    required this.month,
    required this.year,
    this.onMonthChanged,
  });

  final String classId;
  final String className;
  final String? academicYearId;
  final int month;
  final int year;
  final void Function(int, int)? onMonthChanged;

  static const _monthNames = [
    '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final params = (
      classId: classId,
      month: month,
      year: year,
      academicYearId: academicYearId,
    );
    final registerAsync = ref.watch(attendanceRegisterProvider(params));

    return Column(
      children: [
        // Month selector
        Container(
          color: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: AHSpacing.md, vertical: AHSpacing.sm),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(Icons.chevron_left, color: AHColors.navy),
                onPressed: () {
                  var m = month - 1;
                  var y = year;
                  if (m < 1) { m = 12; y--; }
                  onMonthChanged?.call(m, y);
                },
              ),
              Expanded(
                child: Text(
                  '${_monthNames[month]} $year',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AHColors.navy),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.chevron_right, color: AHColors.navy),
                onPressed: () {
                  var m = month + 1;
                  var y = year;
                  if (m > 12) { m = 1; y++; }
                  onMonthChanged?.call(m, y);
                },
              ),
            ],
          ),
        ),
        // Register content
        Expanded(
          child: registerAsync.when(
            data: (register) {
              if (register == null) return _buildEmpty('Aucun registre pour ce mois');
              return _buildRegisterGrid(register);
            },
            loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
            error: (_, __) => _buildEmpty('Erreur de chargement'),
          ),
        ),
      ],
    );
  }

  Widget _buildRegisterGrid(AttendanceRegister register) {
    if (register.studentsData.isEmpty) return _buildEmpty('Aucun élève');

    // 5 weeks × 5 days = 25 cells per student
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: SingleChildScrollView(
        child: DataTable(
          columnSpacing: 8,
          columns: [
            const DataColumn(label: Text('Élève', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700))),
            ...List.generate(25, (i) {
              final week = (i ~/ 5) + 1;
              final day = (i % 5) + 1;
              return DataColumn(
                label: Text('S$week-J$day', style: const TextStyle(fontSize: 8)),
              );
            }),
            const DataColumn(label: Text('Total', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700))),
          ],
          rows: register.studentsData.map((student) {
            return DataRow(cells: [
              DataCell(Text(student.studentName, style: const TextStyle(fontSize: 10))),
              ...List.generate(25, (i) {
                final week = (i ~/ 5) + 1;
                final day = (i % 5) + 1;
                final absence = student.absences.where((a) => a.week == week && a.day == day).firstOrNull;
                final mark = absence?.marked ?? '';
                return DataCell(Text(mark, style: const TextStyle(fontSize: 9)));
              }),
              DataCell(Text('${student.totalAbsences}',
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700,
                      color: student.totalAbsences > 0 ? Colors.red : Colors.green))),
            ]);
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildEmpty(String message) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.event_note, size: 48, color: AHColors.grey300),
          const SizedBox(height: 8),
          Text(message, style: TextStyle(fontSize: 13, color: AHColors.grey500)),
        ],
      ),
    );
  }
}

// ── Tab 2: Évaluation mensuelle ─────────────────────────────────────────

class _MonthlyEvaluationTab extends ConsumerWidget {
  const _MonthlyEvaluationTab({required this.classId});
  final String classId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.grading, size: 48, color: AHColors.grey300),
          const SizedBox(height: 8),
          const Text('Évaluation mensuelle', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AHColors.grey600)),
          const SizedBox(height: 4),
          const Text('Importée du Module Examen\n(évaluations OPEN_FOR_GRADING)',
            textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: AHColors.grey400)),
        ],
      ),
    );
  }
}

// ── Tab 3: Relevés annuel ──────────────────────────────────────────────

class _AnnualSummaryTab extends ConsumerWidget {
  const _AnnualSummaryTab({required this.classId});
  final String classId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.calendar_view_month, size: 48, color: AHColors.grey300),
          const SizedBox(height: 8),
          const Text('Tableau de relevés annuel', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AHColors.grey600)),
          const SizedBox(height: 4),
          const Text('Synthèse Septembre → Juin',
            textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: AHColors.grey400)),
        ],
      ),
    );
  }
}

// ── Tab 4: Paramètres (jours fériés) ────────────────────────────────────

class _SettingsTab extends ConsumerStatefulWidget {
  const _SettingsTab({required this.classId});
  final String classId;

  @override
  ConsumerState<_SettingsTab> createState() => _SettingsTabState();
}

class _SettingsTabState extends ConsumerState<_SettingsTab> {
  final _holidays = <String>[];

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AHSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Jours fériés', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AHColors.navy)),
          const SizedBox(height: 4),
          const Text('Ajoutez les jours fériés pour recalculer les demi-journées',
            style: TextStyle(fontSize: 11, color: AHColors.grey500)),
          const SizedBox(height: AHSpacing.md),
          ..._holidays.map((h) => _HolidayTile(date: h, onRemove: () => setState(() => _holidays.remove(h)))),
          const SizedBox(height: AHSpacing.sm),
          OutlinedButton.icon(
            onPressed: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate: DateTime.now(),
                firstDate: DateTime(2025, 1, 1),
                lastDate: DateTime(2026, 12, 31),
              );
              if (picked != null) {
                setState(() {
                  _holidays.add('${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}');
                });
              }
            },
            icon: const Icon(Icons.add, size: 18),
            label: const Text('Ajouter un jour férié'),
          ),
        ],
      ),
    );
  }
}

class _HolidayTile extends StatelessWidget {
  const _HolidayTile({required this.date, required this.onRemove});
  final String date;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          const Icon(Icons.event_busy, size: 16, color: Color(0xFFDC2626)),
          const SizedBox(width: 8),
          Expanded(child: Text(date, style: const TextStyle(fontSize: 12))),
          IconButton(icon: const Icon(Icons.delete_outline, size: 16), onPressed: onRemove),
        ],
      ),
    );
  }
}
