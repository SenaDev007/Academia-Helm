import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/pedagogy_space_service.dart';
import 'teacher_provider.dart';

// ── Models ──────────────────────────────────────────────────────────────

/// Daily attendance record for one student.
class AttendanceRecord {
  const AttendanceRecord({
    required this.studentId,
    required this.studentName,
    this.morningStatus = AttendanceStatus.unmarked,
    this.afternoonStatus = AttendanceStatus.unmarked,
    this.isLate = false,
  });

  final String studentId;
  final String studentName;
  final AttendanceStatus morningStatus;
  final AttendanceStatus afternoonStatus;
  final bool isLate;

  AttendanceRecord copyWith({
    AttendanceStatus? morningStatus,
    AttendanceStatus? afternoonStatus,
    bool? isLate,
  }) {
    return AttendanceRecord(
      studentId: studentId,
      studentName: studentName,
      morningStatus: morningStatus ?? this.morningStatus,
      afternoonStatus: afternoonStatus ?? this.afternoonStatus,
      isLate: isLate ?? this.isLate,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'studentId': studentId,
      'morningStatus': morningStatus.name.toUpperCase(),
      'afternoonStatus': afternoonStatus.name.toUpperCase(),
      'late': isLate,
    };
  }

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    return AttendanceRecord(
      studentId: (json['studentId'] ?? json['id'] ?? '').toString(),
      studentName: (json['studentName'] ?? json['name'] ?? '${json['firstName'] ?? ''} ${json['lastName'] ?? ''}').toString(),
      morningStatus: _parseStatus(json['morningStatus'] ?? json['morning']),
      afternoonStatus: _parseStatus(json['afternoonStatus'] ?? json['afternoon']),
      isLate: json['late'] == true || json['isLate'] == true,
    );
  }

  static AttendanceStatus _parseStatus(dynamic value) {
    if (value == null) return AttendanceStatus.unmarked;
    final str = value.toString().toUpperCase();
    if (str.contains('PRESENT') || str == 'PM' || str == 'P') return AttendanceStatus.present;
    if (str.contains('ABSENT') || str == 'AM' || str == 'A') return AttendanceStatus.absent;
    return AttendanceStatus.unmarked;
  }
}

enum AttendanceStatus { present, absent, unmarked }

// ── Homework Model ──────────────────────────────────────────────────────

class Homework {
  const Homework({
    required this.id,
    required this.title,
    this.description = '',
    this.dueDate,
    this.maxScore,
    this.className = '',
    this.subjectName = '',
    this.done = 0,
    this.notDone = 0,
    this.pending = 0,
    this.totalStudents = 0,
    this.status = HomeworkStatus.inProgress,
  });

  final String id;
  final String title;
  final String description;
  final DateTime? dueDate;
  final int? maxScore;
  final String className;
  final String subjectName;
  final int done;
  final int notDone;
  final int pending;
  final int totalStudents;
  final HomeworkStatus status;

  String get dueDateLabel {
    if (dueDate == null) return '';
    final d = dueDate!;
    return '${d.day}/${d.month}/${d.year}';
  }

  factory Homework.fromJson(Map<String, dynamic> json) {
    return Homework(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      description: (json['description'] ?? '').toString(),
      dueDate: json['dueDate'] != null ? DateTime.tryParse(json['dueDate'].toString()) : null,
      maxScore: json['maxScore'] is int ? json['maxScore'] : int.tryParse(json['maxScore']?.toString() ?? ''),
      className: (json['className'] ?? json['class']?['name'] ?? '').toString(),
      subjectName: (json['subjectName'] ?? json['subject']?['name'] ?? '').toString(),
      done: _parseInt(json, 'done'),
      notDone: _parseInt(json, 'notDone'),
      pending: _parseInt(json, 'pending'),
      totalStudents: _parseInt(json, 'totalStudents'),
      status: _parseStatus(json['status']),
    );
  }

  static int _parseInt(Map<String, dynamic> json, String key) {
    final v = json[key];
    if (v is int) return v;
    if (v is String) return int.tryParse(v) ?? 0;
    return 0;
  }

  static HomeworkStatus _parseStatus(dynamic value) {
    if (value == null) return HomeworkStatus.inProgress;
    final str = value.toString().toUpperCase();
    if (str.contains('DONE') || str.contains('COMPLETE')) return HomeworkStatus.done;
    if (str.contains('LATE')) return HomeworkStatus.late;
    return HomeworkStatus.inProgress;
  }
}

enum HomeworkStatus { done, late, inProgress }

// ── Evaluation Model ────────────────────────────────────────────────────

class TeacherEvaluation {
  const TeacherEvaluation({
    required this.id,
    required this.title,
    this.className = '',
    this.subjectName = '',
    this.evaluationType = '',
    this.maxScore = 20,
    this.coefficient = 1,
    this.status = EvaluationStatus.planned,
    this.evaluationDate,
  });

  final String id;
  final String title;
  final String className;
  final String subjectName;
  final String evaluationType;
  final int maxScore;
  final int coefficient;
  final EvaluationStatus status;
  final DateTime? evaluationDate;

  factory TeacherEvaluation.fromJson(Map<String, dynamic> json) {
    return TeacherEvaluation(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? json['name'] ?? '').toString(),
      className: (json['className'] ?? json['class']?['name'] ?? '').toString(),
      subjectName: (json['subjectName'] ?? json['subject']?['name'] ?? '').toString(),
      evaluationType: (json['evaluationType'] ?? json['type'] ?? '').toString(),
      maxScore: json['maxScore'] is int ? json['maxScore'] : int.tryParse(json['maxScore']?.toString() ?? '') ?? 20,
      coefficient: json['coefficient'] is int ? json['coefficient'] : int.tryParse(json['coefficient']?.toString() ?? '') ?? 1,
      status: _parseStatus(json['status']),
      evaluationDate: json['evaluationDate'] != null
          ? DateTime.tryParse(json['evaluationDate'].toString())
          : null,
    );
  }

  static EvaluationStatus _parseStatus(dynamic value) {
    if (value == null) return EvaluationStatus.planned;
    final str = value.toString().toUpperCase();
    if (str.contains('OPEN_FOR_GRADING')) return EvaluationStatus.openForGrading;
    if (str.contains('SUBMITTED')) return EvaluationStatus.submitted;
    if (str.contains('VALIDATED')) return EvaluationStatus.validated;
    if (str.contains('LOCKED')) return EvaluationStatus.locked;
    if (str.contains('CANCELLED')) return EvaluationStatus.cancelled;
    return EvaluationStatus.planned;
  }
}

enum EvaluationStatus {
  draft,
  planned,
  openForGrading,
  submitted,
  validated,
  locked,
  cancelled,
}

// ── Providers ───────────────────────────────────────────────────────────

/// Fetches daily attendance for a class on a date.
final dailyAttendanceProvider = FutureProvider.autoDispose
    .family<List<AttendanceRecord>, ({String classId, String date})>(
        (ref, params) async {
  final service = ref.watch(pedagogySpaceServiceProvider);
  final result = await service.getDailyAttendance(
    classId: params.classId,
    date: params.date,
  );

  return result.when(
    success: (data) {
      final list = data['records'] ?? data['data'] ?? data['students'] ?? [];
      if (list is! List) return <AttendanceRecord>[];
      return list
          .whereType<Map<String, dynamic>>()
          .map(AttendanceRecord.fromJson)
          .where((r) => r.studentId.isNotEmpty)
          .toList();
    },
    failure: (_) => <AttendanceRecord>[],
    loading: () => <AttendanceRecord>[],
  );
});

/// Fetches homeworks for a teacher.
final homeworksProvider = FutureProvider.autoDispose
    .family<List<Homework>, TeacherParams>((ref, params) async {
  if (params.teacherId.isEmpty) return <Homework>[];

  final service = ref.watch(pedagogySpaceServiceProvider);
  final result = await service.getHomeworks(
    teacherId: params.teacherId,
    academicYearId: params.academicYearId,
  );

  return result.when(
    success: (data) {
      final list = data['data'] ?? data['homeworks'] ?? data;
      if (list is! List) return <Homework>[];
      return list
          .whereType<Map<String, dynamic>>()
          .map(Homework.fromJson)
          .where((h) => h.id.isNotEmpty && h.title.isNotEmpty)
          .toList();
    },
    failure: (_) => <Homework>[],
    loading: () => <Homework>[],
  );
});

/// Fetches evaluations assigned to a teacher.
final teacherEvaluationsProvider = FutureProvider.autoDispose
    .family<List<TeacherEvaluation>, TeacherParams>((ref, params) async {
  if (params.teacherId.isEmpty) return <TeacherEvaluation>[];

  final service = ref.watch(pedagogySpaceServiceProvider);
  final result = await service.getTeacherEvaluations(
    teacherId: params.teacherId,
    academicYearId: params.academicYearId,
  );

  return result.when(
    success: (data) {
      final list = data['data'] ?? data['evaluations'] ?? data;
      if (list is! List) return <TeacherEvaluation>[];
      return list
          .whereType<Map<String, dynamic>>()
          .map(TeacherEvaluation.fromJson)
          .where((e) => e.id.isNotEmpty)
          .toList();
    },
    failure: (_) => <TeacherEvaluation>[],
    loading: () => <TeacherEvaluation>[],
  );
});
