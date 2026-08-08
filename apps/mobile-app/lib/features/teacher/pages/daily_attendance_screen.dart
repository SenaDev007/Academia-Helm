import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/ah_colors.dart';
import '../../../core/theme/ah_spacing.dart';
import '../providers/pedagogy_space_provider.dart';
import '../providers/teacher_provider.dart';

/// Daily Attendance screen — mirrors the web's AttendanceTab.
///
/// Features:
/// - Date selector (prev/next/today)
/// - Per-student morning/afternoon status (PM/AM/PS/AS)
/// - Late toggle
/// - Auto-save indicator
/// - Stats summary (presents/absents/late)
class DailyAttendanceScreen extends ConsumerStatefulWidget {
  const DailyAttendanceScreen({
    super.key,
    required this.classId,
    required this.className,
  });

  final String classId;
  final String className;

  @override
  ConsumerState<DailyAttendanceScreen> createState() => _DailyAttendanceScreenState();
}

class _DailyAttendanceScreenState extends ConsumerState<DailyAttendanceScreen> {
  late DateTime _selectedDate;
  List<AttendanceRecord> _records = [];
  bool _hasChanges = false;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _selectedDate = DateTime.now();
  }

  String get _dateString {
    final y = _selectedDate.year;
    final m = _selectedDate.month.toString().padLeft(2, '0');
    final d = _selectedDate.day.toString().padLeft(2, '0');
    return '$y-$m-$d';
  }

  void _changeDate(int days) {
    setState(() {
      _selectedDate = _selectedDate.add(Duration(days: days));
      _hasChanges = false;
    });
  }

  void _toggleMorning(int index, AttendanceStatus status) {
    setState(() {
      final r = _records[index];
      _records[index] = r.copyWith(
        morningStatus: r.morningStatus == status ? AttendanceStatus.unmarked : status,
      );
      _hasChanges = true;
    });
  }

  void _toggleAfternoon(int index, AttendanceStatus status) {
    setState(() {
      final r = _records[index];
      _records[index] = r.copyWith(
        afternoonStatus: r.afternoonStatus == status ? AttendanceStatus.unmarked : status,
      );
      _hasChanges = true;
    });
  }

  void _toggleLate(int index) {
    setState(() {
      final r = _records[index];
      _records[index] = r.copyWith(isLate: !r.isLate);
      _hasChanges = true;
    });
  }

  Future<void> _save() async {
    if (!_hasChanges) return;
    setState(() => _isSaving = true);

    // TODO: call pedagogySpaceServiceProvider.saveDailyAttendance()
    // For now, just simulate save
    await Future.delayed(const Duration(milliseconds: 500));

    setState(() {
      _isSaving = false;
      _hasChanges = false;
    });
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Présences enregistrées'),
          backgroundColor: AHColors.success,
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final params = (classId: widget.classId, date: _dateString);
    final attendanceAsync = ref.watch(dailyAttendanceProvider(params));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AHColors.navy,
        elevation: 0,
        title: Text(
          'Appel — ${widget.className}',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          if (_hasChanges)
            TextButton(
              onPressed: _isSaving ? null : _save,
              child: _isSaving
                  ? const SizedBox(
                      width: 16, height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Enregistrer', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
        ],
      ),
      body: Column(
        children: [
          // Date selector
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: AHSpacing.md, vertical: AHSpacing.sm),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.chevron_left, color: AHColors.navy),
                  onPressed: () => _changeDate(-1),
                ),
                Expanded(
                  child: GestureDetector(
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: _selectedDate,
                        firstDate: DateTime(2025, 1, 1),
                        lastDate: DateTime.now().add(const Duration(days: 1)),
                      );
                      if (picked != null) {
                        setState(() {
                          _selectedDate = picked;
                          _hasChanges = false;
                        });
                      }
                    },
                    child: Text(
                      _formatDate(_selectedDate),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w700, color: AHColors.navy,
                      ),
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.chevron_right, color: AHColors.navy),
                  onPressed: () => _changeDate(1),
                ),
                IconButton(
                  icon: const Icon(Icons.today, color: AHColors.navy, size: 20),
                  onPressed: () {
                    setState(() {
                      _selectedDate = DateTime.now();
                      _hasChanges = false;
                    });
                  },
                ),
              ],
            ),
          ),

          // Students list
          Expanded(
            child: attendanceAsync.when(
              data: (records) {
                if (records.isEmpty && _records.isEmpty) {
                  _records = [];
                  return _buildEmptyState();
                }
                if (_records.isEmpty || !_hasChanges) {
                  _records = records;
                }
                if (_records.isEmpty) return _buildEmptyState();
                return _buildStudentList();
              },
              loading: () => const Center(child: CircularProgressIndicator(color: AHColors.navy)),
              error: (_, __) => _buildEmptyState(),
            ),
          ),

          // Stats bar
          if (_records.isNotEmpty)
            Container(
              color: Colors.white,
              padding: const EdgeInsets.all(AHSpacing.md),
              child: _buildStatsBar(),
            ),
        ],
      ),
    );
  }

  Widget _buildStudentList() {
    return ListView.separated(
      padding: const EdgeInsets.all(AHSpacing.sm),
      itemCount: _records.length,
      separatorBuilder: (_, __) => const SizedBox(height: 4),
      itemBuilder: (context, index) {
        final r = _records[index];
        return _AttendanceCard(
          record: r,
          onMorningPresent: () => _toggleMorning(index, AttendanceStatus.present),
          onMorningAbsent: () => _toggleMorning(index, AttendanceStatus.absent),
          onAfternoonPresent: () => _toggleAfternoon(index, AttendanceStatus.present),
          onAfternoonAbsent: () => _toggleAfternoon(index, AttendanceStatus.absent),
          onToggleLate: () => _toggleLate(index),
        );
      },
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.event_busy, size: 48, color: AHColors.grey300),
          const SizedBox(height: AHSpacing.md),
          const Text('Aucun élève dans cette classe',
            style: TextStyle(fontSize: 14, color: AHColors.grey500),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsBar() {
    final present = _records.where((r) => r.morningStatus == AttendanceStatus.present).length;
    final absent = _records.where((r) => r.morningStatus == AttendanceStatus.absent).length;
    final late = _records.where((r) => r.isLate).length;
    return Row(
      children: [
        _StatChip('Présents', present, const Color(0xFF16A34A)),
        const SizedBox(width: 8),
        _StatChip('Absents', absent, const Color(0xFFDC2626)),
        const SizedBox(width: 8),
        _StatChip('Retards', late, const Color(0xFFF59E0B)),
      ],
    );
  }

  String _formatDate(DateTime date) {
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const months = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    return '${days[date.weekday - 1]} ${date.day} ${months[date.month]}';
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip(this.label, this.count, this.color);
  final String label;
  final int count;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('$count', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: color)),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 10, color: color)),
        ],
      ),
    );
  }
}

class _AttendanceCard extends StatelessWidget {
  const _AttendanceCard({
    required this.record,
    required this.onMorningPresent,
    required this.onMorningAbsent,
    required this.onAfternoonPresent,
    required this.onAfternoonAbsent,
    required this.onToggleLate,
  });

  final AttendanceRecord record;
  final VoidCallback onMorningPresent;
  final VoidCallback onMorningAbsent;
  final VoidCallback onAfternoonPresent;
  final VoidCallback onAfternoonAbsent;
  final VoidCallback onToggleLate;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          // Student name
          Expanded(
            child: Row(
              children: [
                if (record.isLate)
                  Padding(
                    padding: const EdgeInsets.only(right: 4),
                    child: Icon(Icons.access_time, size: 14, color: const Color(0xFFF59E0B)),
                  ),
                Flexible(
                  child: Text(
                    record.studentName,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
          // Morning buttons
          _StatusButton(
            label: 'PM',
            isActive: record.morningStatus == AttendanceStatus.present,
            color: const Color(0xFF16A34A),
            onTap: onMorningPresent,
          ),
          const SizedBox(width: 4),
          _StatusButton(
            label: 'AM',
            isActive: record.morningStatus == AttendanceStatus.absent,
            color: const Color(0xFFDC2626),
            onTap: onMorningAbsent,
          ),
          const SizedBox(width: 8),
          // Afternoon buttons
          _StatusButton(
            label: 'PS',
            isActive: record.afternoonStatus == AttendanceStatus.present,
            color: const Color(0xFF16A34A),
            onTap: onAfternoonPresent,
          ),
          const SizedBox(width: 4),
          _StatusButton(
            label: 'AS',
            isActive: record.afternoonStatus == AttendanceStatus.absent,
            color: const Color(0xFFDC2626),
            onTap: onAfternoonAbsent,
          ),
          const SizedBox(width: 8),
          // Late toggle
          GestureDetector(
            onTap: onToggleLate,
            child: Icon(
              Icons.access_time,
              size: 18,
              color: record.isLate ? const Color(0xFFF59E0B) : const Color(0xFFCBD5E1),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusButton extends StatelessWidget {
  const _StatusButton({
    required this.label,
    required this.isActive,
    required this.color,
    required this.onTap,
  });

  final String label;
  final bool isActive;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 28,
        height: 24,
        decoration: BoxDecoration(
          color: isActive ? color : Colors.transparent,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: isActive ? color : const Color(0xFFCBD5E1)),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: isActive ? Colors.white : const Color(0xFF94A3B8),
            ),
          ),
        ),
      ),
    );
  }
}
