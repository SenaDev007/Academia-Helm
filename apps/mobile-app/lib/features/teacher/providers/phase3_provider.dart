import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' show Color;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/pedagogy_space_service.dart';
import 'teacher_provider.dart';

// ── Registre d'Appel Models ────────────────────────────────────────────

/// Monthly attendance register for a class.
class AttendanceRegister {
  const AttendanceRegister({
    required this.id,
    required this.classId,
    required this.className,
    required this.month,
    required this.year,
    this.studentsData = const [],
    this.status = RegisterStatus.draft,
    this.holidays = const [],
  });

  final String id;
  final String classId;
  final String className;
  final int month;
  final int year;
  final List<RegisterStudentData> studentsData;
  final RegisterStatus status;
  final List<String> holidays;

  factory AttendanceRegister.fromJson(Map<String, dynamic> json) {
    final list = json['studentsData'] ?? json['students'] ?? [];
    return AttendanceRegister(
      id: (json['id'] ?? '').toString(),
      classId: (json['classId'] ?? '').toString(),
      className: (json['className'] ?? json['class']?['name'] ?? '').toString(),
      month: _parseInt(json, 'month') ?? DateTime.now().month,
      year: _parseInt(json, 'year') ?? DateTime.now().year,
      studentsData: list is List
          ? list.whereType<Map<String, dynamic>>().map(RegisterStudentData.fromJson).toList()
          : [],
      status: _parseRegisterStatus(json['status']),
      holidays: (json['holidays'] as List?)?.map((e) => e.toString()).toList() ?? [],
    );
  }
}

enum RegisterStatus { draft, submitted, validated }

class RegisterStudentData {
  const RegisterStudentData({
    required this.studentId,
    required this.studentName,
    this.absences = const [],
    this.totalPresences = 0,
    this.totalAbsences = 0,
  });

  final String studentId;
  final String studentName;
  final List<RegisterAbsence> absences;
  final int totalPresences;
  final int totalAbsences;

  factory RegisterStudentData.fromJson(Map<String, dynamic> json) {
    final list = json['absences'] ?? [];
    return RegisterStudentData(
      studentId: (json['studentId'] ?? json['id'] ?? '').toString(),
      studentName: (json['studentName'] ?? json['name'] ?? '${json['firstName'] ?? ''} ${json['lastName'] ?? ''}').toString().trim(),
      absences: list is List
          ? list.whereType<Map<String, dynamic>>().map(RegisterAbsence.fromJson).toList()
          : [],
      totalPresences: _parseInt(json, 'totalPresencesPossibles') ?? _parseInt(json, 'totalPresences') ?? 0,
      totalAbsences: _parseInt(json, 'totalAbsences') ?? 0,
    );
  }
}

class RegisterAbsence {
  const RegisterAbsence({required this.week, required this.day, this.marked = '', this.motif = ''});
  final int week;
  final int day;
  final String marked; // '-', '|', '+', ''
  final String motif;

  factory RegisterAbsence.fromJson(Map<String, dynamic> json) {
    return RegisterAbsence(
      week: _parseInt(json, 'week') ?? 0,
      day: _parseInt(json, 'day') ?? 0,
      marked: (json['marked'] ?? '').toString(),
      motif: (json['motif'] ?? '').toString(),
    );
  }
}

// ── Fiche Pédagogique Models ────────────────────────────────────────────

class FichePedagogique {
  const FichePedagogique({
    required this.id,
    required this.sheetType,
    required this.title,
    this.className = '',
    this.subjectName = '',
    this.date,
    this.status = FicheStatus.draft,
    this.duration = '',
    this.sequenceNumber,
  });

  final String id;
  final FicheType sheetType;
  final String title;
  final String className;
  final String subjectName;
  final DateTime? date;
  final FicheStatus status;
  final String duration;
  final int? sequenceNumber;

  factory FichePedagogique.fromJson(Map<String, dynamic> json) {
    return FichePedagogique(
      id: (json['id'] ?? '').toString(),
      sheetType: _parseFicheType(json['sheetType'] ?? json['type']),
      title: (json['title'] ?? json['cours'] ?? '').toString(),
      className: (json['className'] ?? json['class']?['name'] ?? '').toString(),
      subjectName: (json['subjectName'] ?? json['subject']?['name'] ?? '').toString(),
      date: json['date'] != null ? DateTime.tryParse(json['date'].toString()) : null,
      status: _parseFicheStatus(json['status']),
      duration: (json['duration'] ?? '').toString(),
      sequenceNumber: _parseInt(json, 'sequenceNumber'),
    );
  }
}

enum FicheType {
  math('MATH', 'Mathématiques', Color(0xFF3B82F6)),
  francais('FRANCAIS', 'Français', Color(0xFFEF4444)),
  est('EST', 'Éduc. Scientifique & Tech.', Color(0xFF10B981)),
  es('ES', 'Éducation Sociale', Color(0xFFF59E0B)),
  ea('EA', 'Éducation Artistique', Color(0xFF8B5CF6));

  const FicheType(this.code, this.label, this.color);
  final String code;
  final String label;
  final Color color;
}

enum FicheStatus { draft, submitted, validated, rejected }

// ── Seminar (Cahier de Semaine) Models ──────────────────────────────────

class SeminarConfig {
  const SeminarConfig({
    required this.id,
    required this.weekNumber,
    this.teacherName = '',
    this.status = SeminarStatus.pending,
    this.startDate,
    this.endDate,
  });

  final String id;
  final int weekNumber;
  final String teacherName;
  final SeminarStatus status;
  final DateTime? startDate;
  final DateTime? endDate;

  factory SeminarConfig.fromJson(Map<String, dynamic> json) {
    return SeminarConfig(
      id: (json['id'] ?? '').toString(),
      weekNumber: _parseInt(json, 'weekNumber') ?? _parseInt(json, 'week') ?? 0,
      teacherName: (json['teacherName'] ?? json['teacher']?['name'] ?? '').toString(),
      status: _parseSeminarStatus(json['status']),
      startDate: json['startDate'] != null ? DateTime.tryParse(json['startDate'].toString()) : null,
      endDate: json['endDate'] != null ? DateTime.tryParse(json['endDate'].toString()) : null,
    );
  }
}

enum SeminarStatus { pending, signed, submitted, validated }

// ── Cahier de Texte (Test) Models ──────────────────────────────────────

class CahierTexte {
  const CahierTexte({
    required this.id,
    required this.title,
    this.testType = TestType.devoir,
    this.className = '',
    this.subjectName = '',
    this.testNumber,
    this.trimester,
    this.testDate,
    this.durationMinutes,
    this.maxScore = 20,
    this.passingScore = 10,
    this.coefficient = 1,
    this.status = FicheStatus.draft,
  });

  final String id;
  final String title;
  final TestType testType;
  final String className;
  final String subjectName;
  final int? testNumber;
  final int? trimester;
  final DateTime? testDate;
  final int? durationMinutes;
  final int maxScore;
  final int passingScore;
  final int coefficient;
  final FicheStatus status;

  factory CahierTexte.fromJson(Map<String, dynamic> json) {
    return CahierTexte(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? json['testTitle'] ?? '').toString(),
      testType: _parseTestType(json['testType'] ?? json['type']),
      className: (json['className'] ?? json['class']?['name'] ?? '').toString(),
      subjectName: (json['subjectName'] ?? json['subject']?['name'] ?? '').toString(),
      testNumber: _parseInt(json, 'testNumber'),
      trimester: _parseInt(json, 'trimester'),
      testDate: json['testDate'] != null ? DateTime.tryParse(json['testDate'].toString()) : null,
      durationMinutes: _parseInt(json, 'durationMinutes'),
      maxScore: _parseInt(json, 'maxScore') ?? 20,
      passingScore: _parseInt(json, 'passingScore') ?? 10,
      coefficient: _parseInt(json, 'coefficient') ?? 1,
      status: _parseFicheStatus(json['status']),
    );
  }
}

enum TestType { devoir, composition, interrogation, test }

// ── Providers ───────────────────────────────────────────────────────────

/// Fetches the monthly attendance register for a class.
final attendanceRegisterProvider = FutureProvider.autoDispose
    .family<AttendanceRegister?, ({String classId, int month, int year, String? academicYearId})>(
        (ref, params) async {
  if (params.classId.isEmpty) return null;

  final service = ref.watch(pedagogySpaceServiceProvider);
  final result = await service.loadAttendanceRegister(
    academicYearId: params.academicYearId ?? '',
    classId: params.classId,
    month: params.month,
    year: params.year,
  );

  return result.when(
    success: (data) {
      final regData = data['data'] ?? data['register'] ?? data;
      if (regData is! Map<String, dynamic>) return null;
      return AttendanceRegister.fromJson(regData);
    },
    failure: (_) => null,
    loading: () => null,
  );
});

/// Fetches fiches pédagogiques for a teacher.
final fichesProvider = FutureProvider.autoDispose
    .family<List<FichePedagogique>, TeacherParams>((ref, params) async {
  if (params.teacherId.isEmpty) return <FichePedagogique>[];

  final service = ref.watch(pedagogySpaceServiceProvider);
  final result = await service.getFiches(
    teacherId: params.teacherId,
    academicYearId: params.academicYearId,
  );

  return result.when(
    success: (data) {
      final list = data['data'] ?? data['fiches'] ?? data;
      if (list is! List) return <FichePedagogique>[];
      return list
          .whereType<Map<String, dynamic>>()
          .map(FichePedagogique.fromJson)
          .where((f) => f.id.isNotEmpty)
          .toList();
    },
    failure: (_) => <FichePedagogique>[],
    loading: () => <FichePedagogique>[],
  );
});

/// Fetches seminar config (cahier de semaine).
final seminarConfigProvider = FutureProvider.autoDispose
    .family<List<SeminarConfig>, String>((ref, academicYearId) async {
  if (academicYearId.isEmpty) return <SeminarConfig>[];

  final service = ref.watch(pedagogySpaceServiceProvider);
  final result = await service.getSeminarConfig(academicYearId: academicYearId);

  return result.when(
    success: (data) {
      final list = data['data'] ?? data['configs'] ?? data;
      if (list is! List) return <SeminarConfig>[];
      return list
          .whereType<Map<String, dynamic>>()
          .map(SeminarConfig.fromJson)
          .where((s) => s.id.isNotEmpty)
          .toList();
    },
    failure: (_) => <SeminarConfig>[],
    loading: () => <SeminarConfig>[],
  );
});

/// Fetches cahier de textes (tests) for a teacher.
final cahierTextesProvider = FutureProvider.autoDispose
    .family<List<CahierTexte>, TeacherParams>((ref, params) async {
  if (params.teacherId.isEmpty) return <CahierTexte>[];

  final service = ref.watch(pedagogySpaceServiceProvider);
  final result = await service.getCahierTextes(
    teacherId: params.teacherId,
    academicYearId: params.academicYearId,
  );

  return result.when(
    success: (data) {
      final list = data['data'] ?? data['cahierTextes'] ?? data;
      if (list is! List) return <CahierTexte>[];
      return list
          .whereType<Map<String, dynamic>>()
          .map(CahierTexte.fromJson)
          .where((c) => c.id.isNotEmpty)
          .toList();
    },
    failure: (_) => <CahierTexte>[],
    loading: () => <CahierTexte>[],
  );
});

// ── Helpers ────────────────────────────────────────────────────────────

int? _parseInt(Map<String, dynamic> json, String key) {
  final v = json[key];
  if (v is int) return v;
  if (v is String) return int.tryParse(v);
  if (v is double) return v.toInt();
  return null;
}

RegisterStatus _parseRegisterStatus(dynamic value) {
  if (value == null) return RegisterStatus.draft;
  final str = value.toString().toUpperCase();
  if (str.contains('VALIDATED')) return RegisterStatus.validated;
  if (str.contains('SUBMITTED')) return RegisterStatus.submitted;
  return RegisterStatus.draft;
}

FicheType _parseFicheType(dynamic value) {
  if (value == null) return FicheType.math;
  final str = value.toString().toUpperCase();
  for (final t in FicheType.values) {
    if (str.contains(t.code)) return t;
  }
  return FicheType.math;
}

FicheStatus _parseFicheStatus(dynamic value) {
  if (value == null) return FicheStatus.draft;
  final str = value.toString().toUpperCase();
  if (str.contains('VALIDATED')) return FicheStatus.validated;
  if (str.contains('SUBMITTED')) return FicheStatus.submitted;
  if (str.contains('REJECTED')) return FicheStatus.rejected;
  return FicheStatus.draft;
}

SeminarStatus _parseSeminarStatus(dynamic value) {
  if (value == null) return SeminarStatus.pending;
  final str = value.toString().toUpperCase();
  if (str.contains('VALIDATED')) return SeminarStatus.validated;
  if (str.contains('SUBMITTED')) return SeminarStatus.submitted;
  if (str.contains('SIGNED')) return SeminarStatus.signed;
  return SeminarStatus.pending;
}

TestType _parseTestType(dynamic value) {
  if (value == null) return TestType.devoir;
  final str = value.toString().toUpperCase();
  if (str.contains('COMPOSITION')) return TestType.composition;
  if (str.contains('INTERROGATION')) return TestType.interrogation;
  if (str.contains('TEST')) return TestType.test;
  return TestType.devoir;
}
