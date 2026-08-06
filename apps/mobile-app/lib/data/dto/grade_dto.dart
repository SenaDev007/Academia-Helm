import 'package:freezed_annotation/freezed_annotation.dart';
import '../../domain/entities/grade.dart';

part 'grade_dto.g.dart';

/// DTO for [Grade] with snake_case field names matching the API response.
@JsonSerializable(fieldRename: FieldRename.snake)
class GradeDto {
  final String id;
  final String studentId;
  final String subjectId;
  final String subjectName;
  final double score;
  final double maxScore;
  final double? coefficient;
  final String? evaluationType;
  final String? period;
  final String? periodLabel;
  final String? comment;
  final String? evaluatedAt;
  final String? createdAt;

  GradeDto({
    required this.id,
    required this.studentId,
    required this.subjectId,
    required this.subjectName,
    required this.score,
    required this.maxScore,
    this.coefficient,
    this.evaluationType,
    this.period,
    this.periodLabel,
    this.comment,
    this.evaluatedAt,
    this.createdAt,
  });

  factory GradeDto.fromJson(Map<String, dynamic> json) =>
      _$GradeDtoFromJson(json);

  Map<String, dynamic> toJson() => _$GradeDtoToJson(this);

  Grade toDomain() => Grade(
        id: id,
        studentId: studentId,
        subjectId: subjectId,
        subjectName: subjectName,
        score: score,
        maxScore: maxScore,
        coefficient: coefficient ?? 1.0,
        evaluationType: evaluationType,
        period: period,
        periodLabel: periodLabel,
        comment: comment,
        evaluatedAt:
            evaluatedAt != null ? DateTime.tryParse(evaluatedAt!) : null,
        createdAt:
            createdAt != null ? DateTime.tryParse(createdAt!) : null,
      );
}

/// DTO for [SubjectAverage] with snake_case field names matching the API response.
@JsonSerializable(fieldRename: FieldRename.snake)
class SubjectAverageDto {
  final String subjectId;
  final String subjectName;
  final double average;
  final double maxAverage;
  final int? gradeCount;
  final double? classAverage;
  final double? rank;
  final int? classSize;

  SubjectAverageDto({
    required this.subjectId,
    required this.subjectName,
    required this.average,
    required this.maxAverage,
    this.gradeCount,
    this.classAverage,
    this.rank,
    this.classSize,
  });

  factory SubjectAverageDto.fromJson(Map<String, dynamic> json) =>
      _$SubjectAverageDtoFromJson(json);

  Map<String, dynamic> toJson() => _$SubjectAverageDtoToJson(this);

  SubjectAverage toDomain() => SubjectAverage(
        subjectId: subjectId,
        subjectName: subjectName,
        average: average,
        maxAverage: maxAverage,
        gradeCount: gradeCount ?? 0,
        classAverage: classAverage,
        rank: rank,
        classSize: classSize,
      );
}

/// DTO for [PeriodReport] with snake_case field names matching the API response.
@JsonSerializable(fieldRename: FieldRename.snake)
class PeriodReportDto {
  final String id;
  final String studentId;
  final String period;
  final String periodLabel;
  final double generalAverage;
  final double maxAverage;
  final double? classAverage;
  final int? rank;
  final int? classSize;
  final List<SubjectAverageDto> subjectAverages;
  final String? appreciation;
  final String? generatedAt;

  PeriodReportDto({
    required this.id,
    required this.studentId,
    required this.period,
    required this.periodLabel,
    required this.generalAverage,
    required this.maxAverage,
    this.classAverage,
    this.rank,
    this.classSize,
    required this.subjectAverages,
    this.appreciation,
    this.generatedAt,
  });

  factory PeriodReportDto.fromJson(Map<String, dynamic> json) =>
      _$PeriodReportDtoFromJson(json);

  Map<String, dynamic> toJson() => _$PeriodReportDtoToJson(this);

  PeriodReport toDomain() => PeriodReport(
        id: id,
        studentId: studentId,
        period: period,
        periodLabel: periodLabel,
        generalAverage: generalAverage,
        maxAverage: maxAverage,
        classAverage: classAverage,
        rank: rank,
        classSize: classSize,
        subjectAverages:
            subjectAverages.map((dto) => dto.toDomain()).toList(),
        appreciation: appreciation,
        generatedAt:
            generatedAt != null ? DateTime.tryParse(generatedAt!) : null,
      );
}
