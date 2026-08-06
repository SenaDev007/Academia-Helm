import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';
import '../../../core/theme/ah_colors.dart';

// ── Models ────────────────────────────────────────────────────────────

/// Absence/tardiness type.
enum AbsenceType {
  absence('Absence', Icons.person_off_outlined, AHColors.error),
  tardiness('Retard', Icons.schedule_outlined, AHColors.warning);

  const AbsenceType(this.label, this.icon, this.color);
  final String label;
  final IconData icon;
  final Color color;
}

/// Justification status for an absence.
enum JustificationStatus {
  justified('Justifié', AHColors.success, AHColors.successLight),
  unjustified('Non justifié', AHColors.error, AHColors.errorLight),
  pending('En attente', AHColors.warning, AHColors.warningLight);

  const JustificationStatus(this.label, this.color, this.backgroundColor);
  final String label;
  final Color color;
  final Color backgroundColor;
}

/// A single absence or tardiness record.
class AbsenceRecord {
  final String id;
  final String studentId;
  final AbsenceType type;
  final DateTime date;
  final TimeOfDay? time; // For tardiness
  final String? subjectId;
  final String? subjectName;
  final JustificationStatus justificationStatus;
  final String? justificationReason;
  final String? reporterName;
  final Duration? duration;

  const AbsenceRecord({
    required this.id,
    required this.studentId,
    required this.type,
    required this.date,
    this.time,
    this.subjectId,
    this.subjectName,
    required this.justificationStatus,
    this.justificationReason,
    this.reporterName,
    this.duration,
  });

  String get durationLabel {
    if (duration == null) return type == AbsenceType.absence ? 'Journée' : '';
    final hours = duration!.inHours;
    final minutes = duration!.inMinutes % 60;
    if (hours > 0 && minutes > 0) return '${hours}h${minutes}min';
    if (hours > 0) return '${hours}h';
    return '${minutes}min';
  }

  factory AbsenceRecord.fromJson(Map<String, dynamic> json) {
    return AbsenceRecord(
      id: json['id'] as String? ?? '',
      studentId: json['studentId'] as String? ?? json['student_id'] as String? ?? '',
      type: _parseAbsenceType(json['type'] as String?),
      date: json['date'] != null ? DateTime.parse(json['date'] as String) : DateTime.now(),
      time: json['time'] != null ? _parseTime(json['time'] as String) : null,
      subjectId: json['subjectId'] as String? ?? json['subject_id'] as String?,
      subjectName: json['subjectName'] as String? ?? json['subject_name'] as String?,
      justificationStatus: _parseJustificationStatus(json['justificationStatus'] as String? ?? json['justification_status'] as String?),
      justificationReason: json['justificationReason'] as String? ?? json['justification_reason'] as String?,
      reporterName: json['reporterName'] as String? ?? json['reporter_name'] as String?,
      duration: json['durationMinutes'] != null
          ? Duration(minutes: (json['durationMinutes'] as num).toInt())
          : json['duration_minutes'] != null
              ? Duration(minutes: (json['duration_minutes'] as num).toInt())
              : null,
    );
  }

  static AbsenceType _parseAbsenceType(String? value) {
    if (value == null) return AbsenceType.absence;
    switch (value.toLowerCase()) {
      case 'tardiness':
      case 'retard':
        return AbsenceType.tardiness;
      case 'absence':
      default:
        return AbsenceType.absence;
    }
  }

  static JustificationStatus _parseJustificationStatus(String? value) {
    if (value == null) return JustificationStatus.pending;
    switch (value.toLowerCase()) {
      case 'justified':
      case 'justifié':
        return JustificationStatus.justified;
      case 'unjustified':
      case 'non justifié':
        return JustificationStatus.unjustified;
      case 'pending':
      case 'en attente':
      default:
        return JustificationStatus.pending;
    }
  }

  static TimeOfDay? _parseTime(String? value) {
    if (value == null) return null;
    final parts = value.split(':');
    if (parts.length >= 2) {
      return TimeOfDay(
        hour: int.tryParse(parts[0]) ?? 0,
        minute: int.tryParse(parts[1]) ?? 0,
      );
    }
    return null;
  }
}

/// Statistics about absences and tardiness.
class AbsencesStats {
  final int totalAbsences;
  final int totalTardiness;
  final int justifiedCount;
  final int unjustifiedCount;
  final int pendingCount;

  const AbsencesStats({
    required this.totalAbsences,
    required this.totalTardiness,
    required this.justifiedCount,
    required this.unjustifiedCount,
    required this.pendingCount,
  });

  int get total => totalAbsences + totalTardiness;
}

/// Filter for absences.
enum AbsenceFilter {
  all('Tous', null),
  absence('Absences', AbsenceType.absence),
  tardiness('Retards', AbsenceType.tardiness);

  const AbsenceFilter(this.label, this.type);
  final String label;
  final AbsenceType? type;
}

// ── Absences List Notifier ────────────────────────────────────────────

class AbsencesListNotifier extends FamilyAsyncNotifier<List<AbsenceRecord>, AbsenceFilter> {
  @override
  Future<List<AbsenceRecord>> build(AbsenceFilter arg) async {
    final apiClient = ref.read(apiClientProvider);
    final queryParams = <String, dynamic>{};
    if (arg.type != null) {
      queryParams['type'] = arg.type!.name;
    }

    final result = await apiClient.get<List<AbsenceRecord>>(
      '${ApiConfig.versionedBaseUrl}/absences',
      queryParameters: queryParams.isNotEmpty ? queryParams : null,
      fromJson: (json) {
        final data = json['data'] ?? json;
        if (data is List) {
          return data.map((e) => AbsenceRecord.fromJson(e as Map<String, dynamic>)).toList();
        }
        return <AbsenceRecord>[];
      },
    );

    return result.when(
      success: (records) => records,
      failure: (error) => throw Exception(error.displayMessage),
      loading: () => <AbsenceRecord>[],
    );
  }

  /// Refresh the absences list.
  Future<void> refresh() async {
    state = const AsyncLoading();
    state = AsyncData(await build(arg));
  }
}

/// Provider for the absences list with filter.
final absencesListProvider = AsyncNotifierProvider.family<AbsencesListNotifier, List<AbsenceRecord>, AbsenceFilter>(
  AbsencesListNotifier.new,
);

// ── Absences Stats Provider ───────────────────────────────────────────

/// Provider that computes absences statistics from the full list.
final absencesStatsProvider = FutureProvider<AbsencesStats>((ref) async {
  final recordsAsync = ref.watch(absencesListProvider(AbsenceFilter.all));
  return recordsAsync.when(
    data: (records) {
      int totalAbsences = 0;
      int totalTardiness = 0;
      int justifiedCount = 0;
      int unjustifiedCount = 0;
      int pendingCount = 0;

      for (final record in records) {
        if (record.type == AbsenceType.absence) {
          totalAbsences++;
        } else {
          totalTardiness++;
        }

        switch (record.justificationStatus) {
          case JustificationStatus.justified:
            justifiedCount++;
            break;
          case JustificationStatus.unjustified:
            unjustifiedCount++;
            break;
          case JustificationStatus.pending:
            pendingCount++;
            break;
        }
      }

      return AbsencesStats(
        totalAbsences: totalAbsences,
        totalTardiness: totalTardiness,
        justifiedCount: justifiedCount,
        unjustifiedCount: unjustifiedCount,
        pendingCount: pendingCount,
      );
    },
    loading: () => const AbsencesStats(
      totalAbsences: 0,
      totalTardiness: 0,
      justifiedCount: 0,
      unjustifiedCount: 0,
      pendingCount: 0,
    ),
    error: (_, __) => const AbsencesStats(
      totalAbsences: 0,
      totalTardiness: 0,
      justifiedCount: 0,
      unjustifiedCount: 0,
      pendingCount: 0,
    ),
  );
});

/// Selected absence filter state.
final selectedAbsenceFilterProvider = StateProvider<AbsenceFilter>((ref) => AbsenceFilter.all);

// ── Mock Data ─────────────────────────────────────────────────────────

List<AbsenceRecord> getMockAbsences(AbsenceFilter filter) {
  final allRecords = [
    AbsenceRecord(
      id: 'abs-001',
      studentId: 'student-001',
      type: AbsenceType.absence,
      date: DateTime(2025, 2, 20),
      subjectName: 'Mathématiques',
      justificationStatus: JustificationStatus.justified,
      justificationReason: 'Raison médicale',
      reporterName: 'M. Koné',
      duration: const Duration(hours: 2),
    ),
    AbsenceRecord(
      id: 'abs-002',
      studentId: 'student-001',
      type: AbsenceType.tardiness,
      date: DateTime(2025, 2, 25),
      time: const TimeOfDay(hour: 8, minute: 35),
      subjectName: 'Français',
      justificationStatus: JustificationStatus.unjustified,
      reporterName: 'Mme Diallo',
      duration: const Duration(minutes: 35),
    ),
    AbsenceRecord(
      id: 'abs-003',
      studentId: 'student-001',
      type: AbsenceType.absence,
      date: DateTime(2025, 3, 1),
      justificationStatus: JustificationStatus.pending,
      reporterName: 'CPE',
    ),
    AbsenceRecord(
      id: 'abs-004',
      studentId: 'student-001',
      type: AbsenceType.tardiness,
      date: DateTime(2025, 3, 3),
      time: const TimeOfDay(hour: 10, minute: 20),
      subjectName: 'Physique-Chimie',
      justificationStatus: JustificationStatus.justified,
      justificationReason: 'Transport en retard',
      reporterName: 'M. Touré',
      duration: const Duration(minutes: 20),
    ),
    AbsenceRecord(
      id: 'abs-005',
      studentId: 'student-001',
      type: AbsenceType.absence,
      date: DateTime(2025, 1, 15),
      subjectName: 'Anglais',
      justificationStatus: JustificationStatus.justified,
      justificationReason: 'Consultation médicale',
      reporterName: 'Ms. Johnson',
      duration: const Duration(hours: 1),
    ),
  ];

  if (filter.type == null) return allRecords;
  return allRecords.where((r) => r.type == filter.type).toList();
}
