import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';

/// Model representing a class assigned to a teacher.
/// Matches the web app's `/api/pedagogy-space/my-classes` response.
class TeacherClass {
  const TeacherClass({
    required this.classId,
    required this.className,
    required this.schoolLevelName,
    required this.totalStudents,
    required this.boys,
    required this.girls,
  });

  final String classId;
  final String className;
  final String schoolLevelName;
  final int totalStudents;
  final int boys;
  final int girls;

  factory TeacherClass.fromJson(Map<String, dynamic> json) {
    return TeacherClass(
      classId: (json['classId'] ?? json['id'] ?? '').toString(),
      className: (json['className'] ?? json['name'] ?? '').toString(),
      schoolLevelName: (json['schoolLevelName'] ?? json['levelName'] ?? '').toString(),
      totalStudents: (json['totalStudents'] ?? json['students'] ?? 0) as int,
      boys: (json['boys'] ?? 0) as int,
      girls: (json['girls'] ?? 0) as int,
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

/// Riverpod provider that fetches the teacher's assigned classes.
/// Matches the web app's `GET /api/pedagogy-space/my-classes?teacherId=…&academicYearId=…`.
final teacherClassesProvider = FutureProvider.autoDispose
    .family<List<TeacherClass>, ({String teacherId, String? academicYearId})>(
        (ref, params) async {
  final apiClient = ref.watch(apiClientProvider);
  final result = await apiClient.getRaw(
    '/pedagogy-space/my-classes',
    queryParameters: <String, dynamic>{
      'teacherId': params.teacherId,
      if (params.academicYearId != null) 'academicYearId': params.academicYearId,
    },
  );

  return result.when(
    success: (data) {
      final list = data['data'] ?? data['classes'] ?? data;
      if (list is! List) return <TeacherClass>[];
      return list
          .whereType<Map<String, dynamic>>()
          .map(TeacherClass.fromJson)
          .where((c) => c.className.isNotEmpty)
          .toList();
    },
    failure: (_) => <TeacherClass>[],
    loading: () => <TeacherClass>[],
  );
});

/// Derives aggregate stats from the teacher's classes.
final teacherStatsProvider = Provider.autoDispose
    .family<TeacherStats?, ({String teacherId, String? academicYearId})>(
        (ref, params) {
  final classesAsync = ref.watch(teacherClassesProvider(params));
  return classesAsync.maybeWhen(
    data: (classes) => TeacherStats.fromClasses(classes),
    orElse: () => null,
  );
});
