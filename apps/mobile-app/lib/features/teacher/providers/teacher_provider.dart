import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';

/// Model representing a class assigned to a teacher.
/// Matches the web app's GET /api/pedagogy-space/my-classes response.
class TeacherClass {
  const TeacherClass({
    required this.classId,
    required this.className,
    required this.schoolLevelName,
    required this.totalStudents,
    required this.boys,
    required this.girls,
    this.subjects = const [],
  });

  final String classId;
  final String className;
  final String schoolLevelName;
  final int totalStudents;
  final int boys;
  final int girls;
  final List<TeacherSubject> subjects;

  factory TeacherClass.fromJson(Map<String, dynamic> json) {
    // Parse subjects array if present
    final subjectsRaw = json['subjects'] ?? json['subjectList'];
    List<TeacherSubject> subjects = [];
    if (subjectsRaw is List) {
      subjects = subjectsRaw
          .whereType<Map<String, dynamic>>()
          .map(TeacherSubject.fromJson)
          .toList();
    }

    return TeacherClass(
      classId: _extractString(json, ['classId', 'id', 'class_id']),
      className: _extractString(json, ['className', 'name', 'class_name']),
      schoolLevelName: _extractString(json, ['schoolLevelName', 'levelName', 'school_level_name', 'level']),
      totalStudents: _extractInt(json, ['totalStudents', 'students', 'total_students', 'count']) ?? 0,
      boys: _extractInt(json, ['boys', 'boysCount', 'boys_count']) ?? 0,
      girls: _extractInt(json, ['girls', 'girlsCount', 'girls_count']) ?? 0,
      subjects: subjects,
    );
  }

  static String _extractString(Map<String, dynamic> json, List<String> keys) {
    for (final key in keys) {
      final value = json[key];
      if (value is String && value.isNotEmpty) return value;
      if (value != null) return value.toString();
    }
    return '';
  }

  static int? _extractInt(Map<String, dynamic> json, List<String> keys) {
    for (final key in keys) {
      final value = json[key];
      if (value is int) return value;
      if (value is String) return int.tryParse(value);
      if (value is double) return value.toInt();
    }
    return null;
  }
}

/// Model representing a subject assigned to a teacher for a class.
class TeacherSubject {
  const TeacherSubject({
    required this.subjectId,
    required this.subjectName,
    this.weeklyHours,
  });

  final String subjectId;
  final String subjectName;
  final double? weeklyHours;

  factory TeacherSubject.fromJson(Map<String, dynamic> json) {
    return TeacherSubject(
      subjectId: (json['subjectId'] ?? json['id'] ?? '').toString(),
      subjectName: (json['subjectName'] ?? json['name'] ?? '').toString(),
      weeklyHours: json['weeklyHours'] != null
          ? double.tryParse(json['weeklyHours'].toString())
          : null,
    );
  }
}

/// Model representing a student in a class roster.
class ClassStudent {
  const ClassStudent({
    required this.studentId,
    required this.firstName,
    required this.lastName,
    required this.matricule,
    required this.gender,
  });

  final String studentId;
  final String firstName;
  final String lastName;
  final String matricule;
  final String gender; // 'M' or 'F'

  String get displayName => '$firstName $lastName';
  String get initials {
    final f = firstName.isNotEmpty ? firstName[0].toUpperCase() : '';
    final l = lastName.isNotEmpty ? lastName[0].toUpperCase() : '';
    return '$f$l';
  }

  factory ClassStudent.fromJson(Map<String, dynamic> json) {
    return ClassStudent(
      studentId: (json['studentId'] ?? json['id'] ?? '').toString(),
      firstName: (json['firstName'] ?? json['firstname'] ?? '').toString(),
      lastName: (json['lastName'] ?? json['lastname'] ?? '').toString(),
      matricule: (json['matricule'] ?? json['matriculeNumber'] ?? '').toString(),
      gender: (json['gender'] ?? json['sexe'] ?? 'M').toString().toUpperCase(),
    );
  }
}

/// Aggregate stats for a teacher's dashboard.
class TeacherStats {
  const TeacherStats({
    required this.totalClasses,
    required this.totalBoys,
    required this.totalGirls,
    required this.totalStudents,
  });

  final int totalClasses;
  final int totalBoys;
  final int totalGirls;
  final int totalStudents;

  factory TeacherStats.fromClasses(List<TeacherClass> classes) {
    return TeacherStats(
      totalClasses: classes.length,
      totalBoys: classes.fold(0, (sum, c) => sum + c.boys),
      totalGirls: classes.fold(0, (sum, c) => sum + c.girls),
      totalStudents: classes.fold(0, (sum, c) => sum + c.totalStudents),
    );
  }
}

/// Parameters for fetching teacher data.
class TeacherParams {
  const TeacherParams({
    required this.teacherId,
    this.academicYearId,
  });

  final String teacherId;
  final String? academicYearId;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TeacherParams &&
          teacherId == other.teacherId &&
          academicYearId == other.academicYearId;

  @override
  int get hashCode => teacherId.hashCode ^ (academicYearId?.hashCode ?? 0);
}

/// Riverpod provider that fetches the teacher's assigned classes.
/// Matches the web app's GET /api/pedagogy-space/my-classes?teacherId=…&academicYearId=…
final teacherClassesProvider = FutureProvider.autoDispose
    .family<List<TeacherClass>, TeacherParams>((ref, params) async {
  if (params.teacherId.isEmpty) {
    debugPrint('[TeacherClasses] teacherId is empty, returning []');
    return <TeacherClass>[];
  }

  final apiClient = ref.watch(apiClientProvider);
  debugPrint('[TeacherClasses] Fetching from ${ApiConfig.pedagogySpaceMyClasses}');

  final result = await apiClient.getRaw(
    ApiConfig.pedagogySpaceMyClasses,
    queryParameters: <String, dynamic>{
      'teacherId': params.teacherId,
      if (params.academicYearId != null)
        'academicYearId': params.academicYearId,
    },
  );

  return result.when(
    success: (data) {
      debugPrint('[TeacherClasses] Response keys: ${data.keys.toList()}');

      // The API may return: array | {data: [...]} | {classes: [...]}
      final dynamic listRaw = data['data'] ?? data['classes'] ?? data;
      List<dynamic> list;
      if (listRaw is List) {
        list = listRaw;
      } else if (listRaw is Map<String, dynamic> && listRaw['classes'] is List) {
        list = listRaw['classes'] as List;
      } else {
        list = <dynamic>[];
      }

      final classes = list
          .whereType<Map<String, dynamic>>()
          .map(TeacherClass.fromJson)
          .where((c) => c.classId.isNotEmpty && c.className.isNotEmpty)
          .toList();

      debugPrint('[TeacherClasses] Parsed ${classes.length} classes');
      return classes;
    },
    failure: (error) {
      debugPrint('[TeacherClasses] ERROR: ${error.message}');
      return <TeacherClass>[];
    },
    loading: () => <TeacherClass>[],
  );
});

/// Derives aggregate stats from the teacher's classes.
final teacherStatsProvider =
    Provider.autoDispose.family<TeacherStats?, TeacherParams>((ref, params) {
  final classesAsync = ref.watch(teacherClassesProvider(params));
  return classesAsync.maybeWhen(
    data: (classes) => TeacherStats.fromClasses(classes),
    orElse: () => null,
  );
});

/// Fetches the student roster for a specific class.
/// Matches the web's drill-down in MyClassesTab.
final classStudentsProvider = FutureProvider.autoDispose
    .family<List<ClassStudent>, String>((ref, classId) async {
  if (classId.isEmpty) return <ClassStudent>[];

  final apiClient = ref.watch(apiClientProvider);
  // The web app loads students from the class detail endpoint
  // For now we use /students?classId=... as a placeholder
  // The real endpoint may be /pedagogy-space/my-classes/:classId/students
  final result = await apiClient.getRaw(
    '/students',
    queryParameters: <String, dynamic>{
      'classId': classId,
      'limit': 200,
    },
  );

  return result.when(
    success: (data) {
      final list = data['data'] ?? data['students'] ?? data;
      if (list is! List) return <ClassStudent>[];
      return list
          .whereType<Map<String, dynamic>>()
          .map(ClassStudent.fromJson)
          .where((s) => s.studentId.isNotEmpty)
          .toList();
    },
    failure: (_) => <ClassStudent>[],
    loading: () => <ClassStudent>[],
  );
});
