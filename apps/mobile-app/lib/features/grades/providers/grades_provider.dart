import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_config.dart';

// ── Models ────────────────────────────────────────────────────────────

/// Evaluation type for a grade.
enum EvaluationType {
  devoir('Devoir'),
  examen('Examen'),
  controle('Contrôle'),
  tp('TP'),
  td('TD'),
  projet('Projet'),
  oral('Oral');

  const EvaluationType(this.label);
  final String label;
}

/// A single grade entry for a student.
class Grade {
  final String id;
  final String studentId;
  final String subjectId;
  final String subjectName;
  final double score;
  final double maxScore;
  final double coefficient;
  final EvaluationType evaluationType;
  final DateTime date;
  final String? periodId;
  final String? periodName;
  final String? comment;
  final String? teacherName;

  const Grade({
    required this.id,
    required this.studentId,
    required this.subjectId,
    required this.subjectName,
    required this.score,
    required this.maxScore,
    required this.coefficient,
    required this.evaluationType,
    required this.date,
    this.periodId,
    this.periodName,
    this.comment,
    this.teacherName,
  });

  /// Percentage score (0–100).
  double get percentage => maxScore > 0 ? (score / maxScore) * 100 : 0;

  /// Whether the grade is passing (>=50%).
  bool get isPassing => percentage >= 50;

  /// Whether the grade is excellent (>=80%).
  bool get isExcellent => percentage >= 80;

  /// Whether the grade is failing (<50%).
  bool get isFailing => percentage < 50;

  /// Weighted score (score * coefficient).
  double get weightedScore => score * coefficient;

  factory Grade.fromJson(Map<String, dynamic> json) {
    return Grade(
      id: json['id'] as String? ?? '',
      studentId: json['studentId'] as String? ?? json['student_id'] as String? ?? '',
      subjectId: json['subjectId'] as String? ?? json['subject_id'] as String? ?? '',
      subjectName: json['subjectName'] as String? ?? json['subject_name'] as String? ?? '',
      score: (json['score'] as num?)?.toDouble() ?? 0.0,
      maxScore: (json['maxScore'] as num?)?.toDouble() ?? (json['max_score'] as num?)?.toDouble() ?? 20.0,
      coefficient: (json['coefficient'] as num?)?.toDouble() ?? 1.0,
      evaluationType: _parseEvaluationType(json['evaluationType'] as String? ?? json['evaluation_type'] as String?),
      date: json['date'] != null ? DateTime.parse(json['date'] as String) : DateTime.now(),
      periodId: json['periodId'] as String? ?? json['period_id'] as String?,
      periodName: json['periodName'] as String? ?? json['period_name'] as String?,
      comment: json['comment'] as String?,
      teacherName: json['teacherName'] as String? ?? json['teacher_name'] as String?,
    );
  }

  static EvaluationType _parseEvaluationType(String? value) {
    if (value == null) return EvaluationType.devoir;
    switch (value.toLowerCase()) {
      case 'examen':
        return EvaluationType.examen;
      case 'controle':
      case 'contrôle':
        return EvaluationType.controle;
      case 'tp':
        return EvaluationType.tp;
      case 'td':
        return EvaluationType.td;
      case 'projet':
        return EvaluationType.projet;
      case 'oral':
        return EvaluationType.oral;
      case 'devoir':
      default:
        return EvaluationType.devoir;
    }
  }
}

/// Subject average summary.
class SubjectAverage {
  final String subjectId;
  final String subjectName;
  final double average;
  final double maxAverage;
  final int gradeCount;
  final double coefficient;

  const SubjectAverage({
    required this.subjectId,
    required this.subjectName,
    required this.average,
    required this.maxAverage = 20.0,
    required this.gradeCount,
    required this.coefficient,
  });

  double get percentage => maxAverage > 0 ? (average / maxAverage) * 100 : 0;
  bool get isPassing => percentage >= 50;
  bool get isExcellent => percentage >= 80;
  bool get isFailing => percentage < 50;

  factory SubjectAverage.fromJson(Map<String, dynamic> json) {
    return SubjectAverage(
      subjectId: json['subjectId'] as String? ?? json['subject_id'] as String? ?? '',
      subjectName: json['subjectName'] as String? ?? json['subject_name'] as String? ?? '',
      average: (json['average'] as num?)?.toDouble() ?? 0.0,
      maxAverage: (json['maxAverage'] as num?)?.toDouble() ?? (json['max_average'] as num?)?.toDouble() ?? 20.0,
      gradeCount: (json['gradeCount'] as num?)?.toInt() ?? (json['grade_count'] as num?)?.toInt() ?? 0,
      coefficient: (json['coefficient'] as num?)?.toDouble() ?? 1.0,
    );
  }
}

/// Filter for period selection.
enum PeriodFilter {
  all('Tous', null),
  trimester1('Trimestre 1', 'trimester-1'),
  trimester2('Trimestre 2', 'trimester-2'),
  trimester3('Trimestre 3', 'trimester-3');

  const PeriodFilter(this.label, this.id);
  final String label;
  final String? id;
}

// ── Grades List Notifier ──────────────────────────────────────────────

class GradesListNotifier extends FamilyAsyncNotifier<List<Grade>, PeriodFilter> {
  @override
  Future<List<Grade>> build(PeriodFilter arg) async {
    final apiClient = ref.read(apiClientProvider);
    final queryParams = <String, dynamic>{};
    if (arg.id != null) {
      queryParams['periodId'] = arg.id;
    }

    final result = await apiClient.get<List<Grade>>(
      '${ApiConfig.versionedBaseUrl}/grades',
      queryParameters: queryParams.isNotEmpty ? queryParams : null,
      fromJson: (json) {
        final data = json['data'] ?? json;
        if (data is List) {
          return data.map((e) => Grade.fromJson(e as Map<String, dynamic>)).toList();
        }
        return <Grade>[];
      },
    );

    return result.when(
      success: (grades) => grades,
      failure: (error) => throw Exception(error.displayMessage),
      loading: () => <Grade>[],
    );
  }

  /// Refresh the grades list.
  Future<void> refresh() async {
    state = const AsyncLoading();
    state = AsyncData(await build(arg));
  }
}

/// Provider for the grades list with period filter.
final gradesListProvider = AsyncNotifierProvider.family<GradesListNotifier, List<Grade>, PeriodFilter>(
  GradesListNotifier.new,
);

// ── Grade Detail Notifier ─────────────────────────────────────────────

class GradeDetailNotifier extends FamilyAsyncNotifier<Grade, String> {
  @override
  Future<Grade> build(String arg) async {
    final apiClient = ref.read(apiClientProvider);
    final result = await apiClient.get<Grade>(
      '${ApiConfig.versionedBaseUrl}/grades/$arg',
      fromJson: (json) => Grade.fromJson(json),
    );

    return result.when(
      success: (grade) => grade,
      failure: (error) => throw Exception(error.displayMessage),
      loading: () => Grade(
        id: '',
        studentId: '',
        subjectId: '',
        subjectName: '',
        score: 0,
        maxScore: 20,
        coefficient: 1,
        evaluationType: EvaluationType.devoir,
        date: DateTime.now(),
      ),
    );
  }

  /// Refresh the grade detail.
  Future<void> refresh() async {
    state = const AsyncLoading();
    state = AsyncData(await build(arg));
  }
}

/// Provider for a single grade detail.
final gradeDetailProvider = AsyncNotifierProvider.family<GradeDetailNotifier, Grade, String>(
  GradeDetailNotifier.new,
);

// ── Subject Averages Provider ─────────────────────────────────────────

/// Provider that fetches subject averages for a student.
final subjectAveragesProvider = FutureProvider.family<List<SubjectAverage>, String>((ref, studentId) async {
  final apiClient = ref.read(apiClientProvider);
  final result = await apiClient.get<List<SubjectAverage>>(
    '${ApiConfig.versionedBaseUrl}/grades/averages',
    queryParameters: {'studentId': studentId},
    fromJson: (json) {
      final data = json['data'] ?? json;
      if (data is List) {
        return data.map((e) => SubjectAverage.fromJson(e as Map<String, dynamic>)).toList();
      }
      return <SubjectAverage>[];
    },
  );

  return result.when(
    success: (averages) => averages,
    failure: (error) => throw Exception(error.displayMessage),
    loading: () => <SubjectAverage>[],
  );
});

/// Selected period filter state.
final selectedPeriodProvider = StateProvider<PeriodFilter>((ref) => PeriodFilter.all);

// ── Mock Data (for development) ───────────────────────────────────────

/// Returns mock grades for development / demo mode.
List<Grade> getMockGrades(PeriodFilter period) {
  final allGrades = [
    Grade(
      id: 'grade-001',
      studentId: 'student-001',
      subjectId: 'subj-math',
      subjectName: 'Mathématiques',
      score: 16.5,
      maxScore: 20,
      coefficient: 3,
      evaluationType: EvaluationType.examen,
      date: DateTime(2025, 1, 15),
      periodId: 'trimester-2',
      periodName: 'Trimestre 2',
      comment: 'Excellent travail, continuez ainsi !',
      teacherName: 'M. Koné',
    ),
    Grade(
      id: 'grade-002',
      studentId: 'student-001',
      subjectId: 'subj-fr',
      subjectName: 'Français',
      score: 14.0,
      maxScore: 20,
      coefficient: 3,
      evaluationType: EvaluationType.devoir,
      date: DateTime(2025, 1, 18),
      periodId: 'trimester-2',
      periodName: 'Trimestre 2',
      comment: 'Bonne rédaction, quelques fautes d\'orthographe.',
      teacherName: 'Mme Diallo',
    ),
    Grade(
      id: 'grade-003',
      studentId: 'student-001',
      subjectId: 'subj-phys',
      subjectName: 'Physique-Chimie',
      score: 9.5,
      maxScore: 20,
      coefficient: 2,
      evaluationType: EvaluationType.controle,
      date: DateTime(2025, 1, 20),
      periodId: 'trimester-2',
      periodName: 'Trimestre 2',
      comment: 'Des lacunes en électricité. Révisez les circuits.',
      teacherName: 'M. Touré',
    ),
    Grade(
      id: 'grade-004',
      studentId: 'student-001',
      subjectId: 'subj-svt',
      subjectName: 'SVT',
      score: 17.0,
      maxScore: 20,
      coefficient: 2,
      evaluationType: EvaluationType.examen,
      date: DateTime(2025, 1, 22),
      periodId: 'trimester-2',
      periodName: 'Trimestre 2',
      teacherName: 'Mme Kouyaté',
    ),
    Grade(
      id: 'grade-005',
      studentId: 'student-001',
      subjectId: 'subj-hist',
      subjectName: 'Histoire-Géographie',
      score: 12.0,
      maxScore: 20,
      coefficient: 2,
      evaluationType: EvaluationType.devoir,
      date: DateTime(2025, 2, 5),
      periodId: 'trimester-2',
      periodName: 'Trimestre 2',
      teacherName: 'M. Bah',
    ),
    Grade(
      id: 'grade-006',
      studentId: 'student-001',
      subjectId: 'subj-ang',
      subjectName: 'Anglais',
      score: 18.0,
      maxScore: 20,
      coefficient: 2,
      evaluationType: EvaluationType.oral,
      date: DateTime(2025, 2, 10),
      periodId: 'trimester-2',
      periodName: 'Trimestre 2',
      comment: 'Excellente expression orale !',
      teacherName: 'Ms. Johnson',
    ),
    Grade(
      id: 'grade-007',
      studentId: 'student-001',
      subjectId: 'subj-math',
      subjectName: 'Mathématiques',
      score: 11.5,
      maxScore: 20,
      coefficient: 1,
      evaluationType: EvaluationType.td,
      date: DateTime(2024, 11, 10),
      periodId: 'trimester-1',
      periodName: 'Trimestre 1',
      teacherName: 'M. Koné',
    ),
    Grade(
      id: 'grade-008',
      studentId: 'student-001',
      subjectId: 'subj-fr',
      subjectName: 'Français',
      score: 15.5,
      maxScore: 20,
      coefficient: 2,
      evaluationType: EvaluationType.examen,
      date: DateTime(2024, 11, 15),
      periodId: 'trimester-1',
      periodName: 'Trimestre 1',
      teacherName: 'Mme Diallo',
    ),
    Grade(
      id: 'grade-009',
      studentId: 'student-001',
      subjectId: 'subj-eps',
      subjectName: 'EPS',
      score: 8.0,
      maxScore: 20,
      coefficient: 1,
      evaluationType: EvaluationType.tp,
      date: DateTime(2025, 2, 15),
      periodId: 'trimester-2',
      periodName: 'Trimestre 2',
      teacherName: 'M. Camara',
    ),
    Grade(
      id: 'grade-010',
      studentId: 'student-001',
      subjectId: 'subj-math',
      subjectName: 'Mathématiques',
      score: 5.0,
      maxScore: 20,
      coefficient: 1,
      evaluationType: EvaluationType.controle,
      date: DateTime(2024, 10, 5),
      periodId: 'trimester-1',
      periodName: 'Trimestre 1',
      comment: 'Resultat insuffisant. Un effort soutenu est nécessaire.',
      teacherName: 'M. Koné',
    ),
  ];

  if (period == PeriodFilter.all) return allGrades;
  return allGrades.where((g) => g.periodId == period.id).toList();
}

/// Returns mock subject averages.
List<SubjectAverage> getMockSubjectAverages() {
  return [
    const SubjectAverage(subjectId: 'subj-math', subjectName: 'Mathématiques', average: 14.0, gradeCount: 3, coefficient: 3),
    const SubjectAverage(subjectId: 'subj-fr', subjectName: 'Français', average: 14.75, gradeCount: 2, coefficient: 3),
    const SubjectAverage(subjectId: 'subj-phys', subjectName: 'Physique-Chimie', average: 9.5, gradeCount: 1, coefficient: 2),
    const SubjectAverage(subjectId: 'subj-svt', subjectName: 'SVT', average: 17.0, gradeCount: 1, coefficient: 2),
    const SubjectAverage(subjectId: 'subj-hist', subjectName: 'Histoire-Géographie', average: 12.0, gradeCount: 1, coefficient: 2),
    const SubjectAverage(subjectId: 'subj-ang', subjectName: 'Anglais', average: 18.0, gradeCount: 1, coefficient: 2),
    const SubjectAverage(subjectId: 'subj-eps', subjectName: 'EPS', average: 8.0, gradeCount: 1, coefficient: 1),
  ];
}
