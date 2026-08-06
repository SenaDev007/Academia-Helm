import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';
import '../../../core/theme/ah_colors.dart';

// ── Models ────────────────────────────────────────────────────────────

/// Schedule entry type (COURS, TD, TP).
enum ScheduleEntryType {
  cours('COURS', Icons.menu_book_outlined, AHColors.navy),
  td('TD', Icons.group_outlined, AHColors.blue),
  tp('TP', Icons.science_outlined, AHColors.success);

  const ScheduleEntryType(this.label, this.icon, this.color);
  final String label;
  final IconData icon;
  final Color color;
}

/// A single schedule entry.
class ScheduleEntry {
  final String id;
  final String subjectId;
  final String subjectName;
  final String? room;
  final String? teacherName;
  final ScheduleEntryType type;
  final TimeOfDay startTime;
  final TimeOfDay endTime;
  final int dayOfWeek; // 1=Monday, 6=Saturday
  final Color subjectColor;

  const ScheduleEntry({
    required this.id,
    required this.subjectId,
    required this.subjectName,
    this.room,
    this.teacherName,
    required this.type,
    required this.startTime,
    required this.endTime,
    required this.dayOfWeek,
    required this.subjectColor,
  });

  String get startTimeLabel =>
      '${startTime.hour.toString().padLeft(2, '0')}:${startTime.minute.toString().padLeft(2, '0')}';

  String get endTimeLabel =>
      '${endTime.hour.toString().padLeft(2, '0')}:${endTime.minute.toString().padLeft(2, '0')}';

  String get timeLabel => '$startTimeLabel - $endTimeLabel';

  factory ScheduleEntry.fromJson(Map<String, dynamic> json) {
    return ScheduleEntry(
      id: json['id'] as String? ?? '',
      subjectId: json['subjectId'] as String? ?? json['subject_id'] as String? ?? '',
      subjectName: json['subjectName'] as String? ?? json['subject_name'] as String? ?? '',
      room: json['room'] as String?,
      teacherName: json['teacherName'] as String? ?? json['teacher_name'] as String?,
      type: _parseEntryType(json['type'] as String?),
      startTime: _parseTime(json['startTime'] as String? ?? json['start_time'] as String? ?? '08:00'),
      endTime: _parseTime(json['endTime'] as String? ?? json['end_time'] as String? ?? '09:00'),
      dayOfWeek: (json['dayOfWeek'] as num?)?.toInt() ?? (json['day_of_week'] as num?)?.toInt() ?? 1,
      subjectColor: _parseColor(json['subjectColor'] as String? ?? json['subject_color'] as String?),
    );
  }

  static ScheduleEntryType _parseEntryType(String? value) {
    if (value == null) return ScheduleEntryType.cours;
    switch (value.toUpperCase()) {
      case 'TD':
        return ScheduleEntryType.td;
      case 'TP':
        return ScheduleEntryType.tp;
      case 'COURS':
      default:
        return ScheduleEntryType.cours;
    }
  }

  static TimeOfDay _parseTime(String value) {
    final parts = value.split(':');
    if (parts.length >= 2) {
      return TimeOfDay(
        hour: int.tryParse(parts[0]) ?? 8,
        minute: int.tryParse(parts[1]) ?? 0,
      );
    }
    return const TimeOfDay(hour: 8, minute: 0);
  }

  static Color _parseColor(String? value) {
    if (value == null) return AHColors.navy;
    try {
      final hex = value.replaceFirst('#', '');
      return Color(int.parse('FF$hex', radix: 16));
    } catch (_) {
      return AHColors.navy;
    }
  }
}

/// A week of schedule entries.
class WeeklySchedule {
  final DateTime weekStart;
  final DateTime weekEnd;
  final List<ScheduleEntry> entries;

  const WeeklySchedule({
    required this.weekStart,
    required this.weekEnd,
    required this.entries,
  });

  /// Get entries for a specific day of week (1=Monday, 6=Saturday).
  List<ScheduleEntry> entriesForDay(int dayOfWeek) {
    return entries
        .where((e) => e.dayOfWeek == dayOfWeek)
        .toList()
      ..sort((a, b) {
        final aMinutes = a.startTime.hour * 60 + a.startTime.minute;
        final bMinutes = b.startTime.hour * 60 + b.startTime.minute;
        return aMinutes.compareTo(bMinutes);
      });
  }
}

// ── Schedule Notifier ─────────────────────────────────────────────────

class ScheduleNotifier extends FamilyAsyncNotifier<WeeklySchedule, DateTime> {
  @override
  Future<WeeklySchedule> build(DateTime arg) async {
    final apiClient = ref.read(apiClientProvider);

    // Calculate week start (Monday) and end (Saturday) from the given date
    final weekStart = _getWeekStart(arg);
    final weekEnd = weekStart.add(const Duration(days: 5));

    final result = await apiClient.get<List<ScheduleEntry>>(
      '${ApiConfig.versionedBaseUrl}/schedule',
      queryParameters: {
        'weekStart': weekStart.toIso8601String().split('T')[0],
        'weekEnd': weekEnd.toIso8601String().split('T')[0],
      },
      fromJson: (json) {
        final data = json['data'] ?? json;
        if (data is List) {
          return data.map((e) => ScheduleEntry.fromJson(e as Map<String, dynamic>)).toList();
        }
        return <ScheduleEntry>[];
      },
    );

    return result.when(
      success: (entries) => WeeklySchedule(
        weekStart: weekStart,
        weekEnd: weekEnd,
        entries: entries,
      ),
      failure: (error) => throw Exception(error.displayMessage),
      loading: () => WeeklySchedule(weekStart: weekStart, weekEnd: weekEnd, entries: []),
    );
  }

  DateTime _getWeekStart(DateTime date) {
    final dayOfWeek = date.weekday; // Monday = 1, Sunday = 7
    return date.subtract(Duration(days: dayOfWeek - 1));
  }
}

/// Provider for weekly schedule.
final scheduleProvider = AsyncNotifierProvider.family<ScheduleNotifier, WeeklySchedule, DateTime>(
  ScheduleNotifier.new,
);

/// Selected day state provider.
final selectedDayProvider = StateProvider<int>((ref) {
  // Default to current day of week (1=Monday, 6=Saturday, 7=Sunday)
  final now = DateTime.now();
  final weekday = now.weekday;
  return weekday > 6 ? 1 : weekday; // If Sunday, default to Monday
});

/// Current week start date state provider.
final currentWeekStartProvider = StateProvider<DateTime>((ref) {
  final now = DateTime.now();
  final dayOfWeek = now.weekday;
  return now.subtract(Duration(days: dayOfWeek - 1));
});

// ── Day names ─────────────────────────────────────────────────────────

const Map<int, String> dayNames = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mer',
  4: 'Jeu',
  5: 'Ven',
  6: 'Sam',
};

const Map<int, String> dayFullNames = {
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
};

// ── Mock Data ─────────────────────────────────────────────────────────

WeeklySchedule getMockWeeklySchedule(DateTime weekStart) {
  final entries = <ScheduleEntry>[
    // Monday
    const ScheduleEntry(id: 'se-01', subjectId: 'subj-math', subjectName: 'Mathématiques', room: 'Salle 201', teacherName: 'M. Koné', type: ScheduleEntryType.cours, startTime: TimeOfDay(hour: 8, minute: 0), endTime: TimeOfDay(hour: 10, minute: 0), dayOfWeek: 1, subjectColor: AHColors.navy),
    const ScheduleEntry(id: 'se-02', subjectId: 'subj-fr', subjectName: 'Français', room: 'Salle 105', teacherName: 'Mme Diallo', type: ScheduleEntryType.cours, startTime: TimeOfDay(hour: 10, minute: 15), endTime: TimeOfDay(hour: 12, minute: 15), dayOfWeek: 1, subjectColor: Color(0xFFE11D48)),
    const ScheduleEntry(id: 'se-03', subjectId: 'subj-ang', subjectName: 'Anglais', room: 'Salle 302', teacherName: 'Ms. Johnson', type: ScheduleEntryType.td, startTime: TimeOfDay(hour: 14, minute: 0), endTime: TimeOfDay(hour: 16, minute: 0), dayOfWeek: 1, subjectColor: Color(0xFF7C3AED)),

    // Tuesday
    const ScheduleEntry(id: 'se-04', subjectId: 'subj-phys', subjectName: 'Physique-Chimie', room: 'Labo A', teacherName: 'M. Touré', type: ScheduleEntryType.tp, startTime: TimeOfDay(hour: 8, minute: 0), endTime: TimeOfDay(hour: 10, minute: 0), dayOfWeek: 2, subjectColor: Color(0xFF059669)),
    const ScheduleEntry(id: 'se-05', subjectId: 'subj-hist', subjectName: 'Histoire-Géographie', room: 'Salle 204', teacherName: 'M. Bah', type: ScheduleEntryType.cours, startTime: TimeOfDay(hour: 10, minute: 15), endTime: TimeOfDay(hour: 12, minute: 15), dayOfWeek: 2, subjectColor: Color(0xFFD97706)),
    const ScheduleEntry(id: 'se-06', subjectId: 'subj-svt', subjectName: 'SVT', room: 'Labo B', teacherName: 'Mme Kouyaté', type: ScheduleEntryType.cours, startTime: TimeOfDay(hour: 14, minute: 0), endTime: TimeOfDay(hour: 16, minute: 0), dayOfWeek: 2, subjectColor: Color(0xFF0891B2)),

    // Wednesday
    const ScheduleEntry(id: 'se-07', subjectId: 'subj-math', subjectName: 'Mathématiques', room: 'Salle 201', teacherName: 'M. Koné', type: ScheduleEntryType.td, startTime: TimeOfDay(hour: 8, minute: 0), endTime: TimeOfDay(hour: 10, minute: 0), dayOfWeek: 3, subjectColor: AHColors.navy),
    const ScheduleEntry(id: 'se-08', subjectId: 'subj-fr', subjectName: 'Français', room: 'Salle 105', teacherName: 'Mme Diallo', type: ScheduleEntryType.cours, startTime: TimeOfDay(hour: 10, minute: 15), endTime: TimeOfDay(hour: 12, minute: 15), dayOfWeek: 3, subjectColor: Color(0xFFE11D48)),
    const ScheduleEntry(id: 'se-09', subjectId: 'subj-eps', subjectName: 'EPS', room: 'Terrain', teacherName: 'M. Camara', type: ScheduleEntryType.tp, startTime: TimeOfDay(hour: 14, minute: 0), endTime: TimeOfDay(hour: 16, minute: 0), dayOfWeek: 3, subjectColor: Color(0xFFEA580C)),

    // Thursday
    const ScheduleEntry(id: 'se-10', subjectId: 'subj-phys', subjectName: 'Physique-Chimie', room: 'Salle 301', teacherName: 'M. Touré', type: ScheduleEntryType.cours, startTime: TimeOfDay(hour: 8, minute: 0), endTime: TimeOfDay(hour: 10, minute: 0), dayOfWeek: 4, subjectColor: Color(0xFF059669)),
    const ScheduleEntry(id: 'se-11', subjectId: 'subj-ang', subjectName: 'Anglais', room: 'Salle 302', teacherName: 'Ms. Johnson', type: ScheduleEntryType.cours, startTime: TimeOfDay(hour: 10, minute: 15), endTime: TimeOfDay(hour: 12, minute: 15), dayOfWeek: 4, subjectColor: Color(0xFF7C3AED)),
    const ScheduleEntry(id: 'se-12', subjectId: 'subj-hist', subjectName: 'Histoire-Géographie', room: 'Salle 204', teacherName: 'M. Bah', type: ScheduleEntryType.td, startTime: TimeOfDay(hour: 14, minute: 0), endTime: TimeOfDay(hour: 16, minute: 0), dayOfWeek: 4, subjectColor: Color(0xFFD97706)),

    // Friday
    const ScheduleEntry(id: 'se-13', subjectId: 'subj-svt', subjectName: 'SVT', room: 'Labo B', teacherName: 'Mme Kouyaté', type: ScheduleEntryType.tp, startTime: TimeOfDay(hour: 8, minute: 0), endTime: TimeOfDay(hour: 10, minute: 0), dayOfWeek: 5, subjectColor: Color(0xFF0891B2)),
    const ScheduleEntry(id: 'se-14', subjectId: 'subj-math', subjectName: 'Mathématiques', room: 'Salle 201', teacherName: 'M. Koné', type: ScheduleEntryType.cours, startTime: TimeOfDay(hour: 10, minute: 15), endTime: TimeOfDay(hour: 12, minute: 15), dayOfWeek: 5, subjectColor: AHColors.navy),
    const ScheduleEntry(id: 'se-15', subjectId: 'subj-fr', subjectName: 'Français', room: 'Salle 105', teacherName: 'Mme Diallo', type: ScheduleEntryType.td, startTime: TimeOfDay(hour: 14, minute: 0), endTime: TimeOfDay(hour: 16, minute: 0), dayOfWeek: 5, subjectColor: Color(0xFFE11D48)),

    // Saturday
    const ScheduleEntry(id: 'se-16', subjectId: 'subj-phys', subjectName: 'Physique-Chimie', room: 'Salle 301', teacherName: 'M. Touré', type: ScheduleEntryType.td, startTime: TimeOfDay(hour: 8, minute: 0), endTime: TimeOfDay(hour: 10, minute: 0), dayOfWeek: 6, subjectColor: Color(0xFF059669)),
  ];

  return WeeklySchedule(
    weekStart: weekStart,
    weekEnd: weekStart.add(const Duration(days: 5)),
    entries: entries,
  );
}
