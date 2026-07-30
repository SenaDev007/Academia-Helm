import 'package:freezed_annotation/freezed_annotation.dart';

part 'grade.freezed.dart';
part 'grade.g.dart';

/// Represents a student grade/evaluation result.
@freezed
class Grade with _$Grade {
  const factory Grade({
    required String id,
    required String studentId,
    required String subjectId,
    required String subjectName,
    required double score,
    required double maxScore,
    @Default(1.0) double coefficient,
    String? evaluationType, // 'DEVOIR', 'EXAMEN', 'COMPOSITION', 'INTERROGATION'
    String? period, // 'TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3', 'SEMESTRE_1', 'SEMESTRE_2'
    String? periodLabel, // Display label like "1er Trimestre"
    String? comment,
    DateTime? evaluatedAt,
    DateTime? createdAt,
  }) = _Grade;

  const Grade._();

  /// Percentage score.
  double get percentage => maxScore > 0 ? (score / maxScore) * 100 : 0;

  /// Weighted score.
  double get weightedScore => score * coefficient;

  /// Whether this is a passing grade (>= 50%).
  bool get isPassing => percentage >= 50;

  /// Whether this is an excellent grade (>= 80%).
  bool get isExcellent => percentage >= 80;

  /// Display string for score.
  String get displayScore => '${score.toStringAsFixed(1)}/$maxScoreToString';

  String get maxScoreToString => maxScore == maxScore.roundToDouble()
      ? maxScore.round().toString()
      : maxScore.toStringAsFixed(1);

  factory Grade.fromJson(Map<String, dynamic> json) => _$GradeFromJson(json);
}

/// Represents a subject average.
@freezed
class SubjectAverage with _$SubjectAverage {
  const factory SubjectAverage({
    required String subjectId,
    required String subjectName,
    required double average,
    required double maxAverage,
    @Default(0) int gradeCount,
    double? classAverage,
    double? rank,
    int? classSize,
  }) = _SubjectAverage;

  const SubjectAverage._();

  double get percentage =>
      maxAverage > 0 ? (average / maxAverage) * 100 : 0;
  bool get isPassing => percentage >= 50;
  String get displayAverage =>
      '${average.toStringAsFixed(2)}/$maxAverageDisplay';
  String get maxAverageDisplay =>
      maxAverage == maxAverage.roundToDouble()
          ? maxAverage.round().toString()
          : maxAverage.toStringAsFixed(1);

  factory SubjectAverage.fromJson(Map<String, dynamic> json) =>
      _$SubjectAverageFromJson(json);
}

/// Represents a period report (bulletin summary).
@freezed
class PeriodReport with _$PeriodReport {
  const factory PeriodReport({
    required String id,
    required String studentId,
    required String period,
    required String periodLabel,
    required double generalAverage,
    required double maxAverage,
    double? classAverage,
    int? rank,
    int? classSize,
    required List<SubjectAverage> subjectAverages,
    String? appreciation,
    DateTime? generatedAt,
  }) = _PeriodReport;

  const PeriodReport._();

  double get percentage =>
      maxAverage > 0 ? (generalAverage / maxAverage) * 100 : 0;
  bool get isPassing => percentage >= 50;
  String get displayGeneralAverage =>
      '${generalAverage.toStringAsFixed(2)}/$maxAverageDisplay';
  String get maxAverageDisplay =>
      maxAverage == maxAverage.roundToDouble()
          ? maxAverage.round().toString()
          : maxAverage.toStringAsFixed(1);

  factory PeriodReport.fromJson(Map<String, dynamic> json) =>
      _$PeriodReportFromJson(json);
}
